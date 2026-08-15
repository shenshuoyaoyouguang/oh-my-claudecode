import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { render } from '../../hud/render.js';
import { renderCallCounts } from '../../hud/elements/call-counts.js';
import { renderContext, resetContextDisplayState } from '../../hud/elements/context.js';
import { renderTokenUsage } from '../../hud/elements/token-usage.js';
import { readHudConfig } from '../../hud/state.js';
import {
  DEFAULT_HUD_CONFIG,
  DEFAULT_HUD_LABELS,
  resolveHudLabels,
  type HudConfig,
  type HudRenderContext,
} from '../../hud/types.js';

const ANSI_REGEX = /\x1b\[[0-9;]*m/g;
const tempDirs: string[] = [];
const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

function stripAnsi(value: string): string {
  return value.replace(ANSI_REGEX, '');
}

function createTempConfigDir(settings: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'omc-hud-labels-'));
  tempDirs.push(dir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'settings.json'), JSON.stringify(settings), 'utf8');
  return dir;
}

function createContext(): HudRenderContext {
  return {
    contextPercent: 67,
    modelName: 'claude-sonnet-4-5',
    ralph: { active: true, iteration: 3, maxIterations: 10 },
    ultrawork: null,
    prd: null,
    autopilot: null,
    activeAgents: [],
    todos: [],
    backgroundTasks: [
      { id: 'bg-1', description: 'task', startedAt: new Date().toISOString(), status: 'running' },
    ],
    cwd: '/home/user/project',
    lastSkill: null,
    rateLimitsResult: null,
    customBuckets: null,
    pendingPermission: null,
    thinkingState: { active: true },
    sessionHealth: null,
    lastRequestTokenUsage: { inputTokens: 1530, outputTokens: 987 },
    sessionTotalTokens: 8765,
    omcVersion: null,
    updateAvailable: null,
    toolCallCount: 5,
    agentCallCount: 3,
    skillCallCount: 2,
    promptTime: null,
    apiKeySource: null,
    profileName: null,
    sessionSummary: null,
  };
}

function createConfig(labels = DEFAULT_HUD_LABELS): HudConfig {
  return {
    ...DEFAULT_HUD_CONFIG,
    labels,
    elements: {
      ...DEFAULT_HUD_CONFIG.elements,
      omcLabel: false,
      rateLimits: false,
      permissionStatus: false,
      thinking: true,
      thinkingFormat: 'text',
      promptTime: false,
      sessionHealth: false,
      showTokens: true,
      ralph: true,
      autopilot: false,
      prdStory: false,
      activeSkills: false,
      lastSkill: false,
      contextBar: true,
      agents: false,
      backgroundTasks: true,
      todos: false,
      showCallCounts: true,
      callCountsFormat: 'ascii',
      useBars: false,
      gitBranch: false,
      gitStatus: false,
      maxOutputLines: 3,
    },
    contextLimitWarning: { ...DEFAULT_HUD_CONFIG.contextLimitWarning, threshold: 101 },
    layout: {
      line1: [],
      main: ['thinking', 'model', 'tokens', 'ralph', 'contextBar', 'background', 'callCounts'],
      detail: [],
    },
  };
}

describe('HUD labels', () => {
  beforeEach(() => {
    resetContextDisplayState();
  });

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
    if (originalClaudeConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR;
    } else {
      process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
    }
  });

  it('keeps default HUD labels unchanged for direct renderer calls', () => {
    expect(stripAnsi(renderContext(67, DEFAULT_HUD_CONFIG.thresholds, 'labels-default') ?? '')).toBe('ctx:67%');
    const tokenOut = renderTokenUsage({ inputTokens: 1530, outputTokens: 987 });
    expect(stripAnsi(tokenOut ?? '')).toBe('1.5k 987');
    // P0-3：ASCII 标签 Tl/Ag/Sk（原 T/A/S 与 agent 编码冲突）
    expect(renderCallCounts(5, 3, 2, 'ascii')).toBe('Tl:5 Ag:3 Sk:2');
    expect(DEFAULT_HUD_LABELS.input).toBe('I');
    expect(DEFAULT_HUD_LABELS.output).toBe('O');
    expect(DEFAULT_HUD_LABELS.status).toBe('S');
  });

  it('resolves zh-CN locale labels and lets explicit labels override locale', () => {
    const labels = resolveHudLabels('zh-CN', {
      context: 'CTX自定义',
      tool: '工具自定义',
      unknown: 'ignored',
    } as Record<string, unknown>);

    expect(labels.context).toBe('CTX自定义');
    expect(labels.tool).toBe('工具自定义');
    expect(labels.agent).toBe('智能体');
    expect(labels.tokens).toBe('令牌');
    expect(labels.input).toBe('输入');
    expect(labels.output).toBe('输出');
    expect(labels.status).toBe('状态');
    expect(labels.sessionTotal).toBe('累计');
    expect(labels.usage).toBe('用量');
    expect(labels.multiRepo).toBe('多仓');
    expect(labels.criticalSuffix).toBe(' 临界');
    expect(labels.compactSuffix).toBe('! 压缩');
    expect(labels.cache).toBe('缓存');
    expect('unknown' in labels).toBe(false);
  });

  it('ignores invalid locale and unsupported label keys in settings.json', () => {
    const configDir = createTempConfigDir({
      omcHud: {
        locale: 'pirate',
        labels: {
          context: 'context-custom',
          unknown: 'ignored',
          tokens: '',
        },
      },
    });
    process.env.CLAUDE_CONFIG_DIR = configDir;

    const config = readHudConfig();

    expect(config.locale).toBe('en');
    expect(config.labels?.context).toBe('context-custom');
    expect(config.labels?.tokens).toBe('tok');
    expect(config.labels).not.toHaveProperty('unknown');
  });

  it('applies configured labels through the composed HUD renderer', async () => {
    const labels = resolveHudLabels('zh-CN');
    const output = stripAnsi(await render(createContext(), createConfig(labels)));

    expect(output).toContain('思考');
    expect(output).toContain('1.5k 987');
    expect(output).toContain('循环:3/10');
    expect(output).toContain('上下文:67%');
    expect(output).toContain('后台:1/5');
    expect(output).toContain('工具:5 智能体:3 技能:2');
    expect(output).toContain('模型: Sonnet 4.5');
  });

  it('renders localized I/O/S region tags when ioGrouping is enabled', async () => {
    const labels = resolveHudLabels('zh-CN');
    const config = createConfig(labels);
    config.elements.ioGrouping = true;
    const output = stripAnsi(await render(createContext(), config));

    expect(output).toContain('输入:');
    expect(output).toContain('输出:');
    expect(output).toContain('状态:');
    // token parts are split: input under 输入, output under 输出
    expect(output.indexOf('1.5k')).toBeGreaterThan(output.indexOf('输入:'));
    expect(output.indexOf('1.5k')).toBeLessThan(output.indexOf('输出:'));
    expect(output.indexOf('987')).toBeGreaterThan(output.indexOf('输出:'));
    expect(output.indexOf('987')).toBeLessThan(output.indexOf('状态:'));
    // 累计用量已前移至 I 区：位于输入 token 之后、输出区域之前
    expect(output).toContain('累计:');
    expect(output.indexOf('累计:')).toBeGreaterThan(output.indexOf('1.5k'));
    expect(output.indexOf('累计:')).toBeLessThan(output.indexOf('输出:'));
    expect(output).toContain('循环:3/10');
  });
});
