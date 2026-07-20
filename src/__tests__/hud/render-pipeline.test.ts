/**
 * HUD 渲染管线测试
 *
 * 对应提交:
 * - eacb0ae9 feat(hud): element registry, render modes and render refactor
 * - 5f426397 refactor(hud): co-locate element metadata with render functions
 *
 * Red 阶段目标:描述期望的元素注册表行为,当前应失败。
 *
 * 期望(Green 阶段后):
 *   - 存在一个 element registry,集中注册所有 HUD 元素
 *   - 每个元素携带元数据(名称、渲染模式、所属布局组)
 *   - render 函数通过 registry 驱动而非硬编码 if/else 分支
 */
import { describe, it, expect, vi } from 'vitest';
import type { HudRenderContext, HudConfig } from '../../hud/types.js';
import { DEFAULT_HUD_CONFIG } from '../../hud/types.js';

// 构造最小可用的 render context
function makeMinimalContext(overrides: Partial<HudRenderContext> = {}): HudRenderContext {
  return {
    contextPercent: 50,
    contextDisplayScope: 'test',
    modelName: 'Test',
    modelId: 'test-1',
    ralph: null,
    ultrawork: null,
    prd: null,
    autopilot: null,
    activeAgents: [],
    todos: [],
    backgroundTasks: [],
    cwd: '/tmp',
    missionBoard: null,
    lastSkill: null,
    rateLimitsResult: null,
    customBuckets: null,
    pendingPermission: null,
    thinkingState: null,
    sessionHealth: null,
    lastRequestTokenUsage: null,
    sessionTotalTokens: null,
    omcVersion: '0.0.0',
    updateAvailable: null,
    toolCallCount: 0,
    agentCallCount: 0,
    skillCallCount: 0,
    promptTime: null,
    apiKeySource: null,
    apiKeyMode: false,
    subscriptionType: null,
    rateLimitTier: null,
    profileName: null,
    sessionSummary: null,
    lastToolName: null,
    payloadEstimate: null,
    ...overrides,
  };
}

describe('HUD render pipeline', () => {
  describe('render function contract', () => {
    it('render 接收 context 与 config 并返回字符串', async () => {
      const { render } = await import('../../hud/render.js');
      const ctx = makeMinimalContext();
      const config: HudConfig = { ...DEFAULT_HUD_CONFIG };

      const output = await render(ctx, config);
      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
    });

    it('render 输出应包含 OMC 标签(当 omcLabel 启用时)', async () => {
      const { render } = await import('../../hud/render.js');
      const ctx = makeMinimalContext({ omcVersion: '9.9.9' });
      const config: HudConfig = {
        ...DEFAULT_HUD_CONFIG,
        elements: { ...DEFAULT_HUD_CONFIG.elements, omcLabel: true },
      };

      const output = await render(ctx, config);
      expect(output).toContain('[OMC');
    });

    it('render 在所有元素禁用时仍返回非空字符串(至少 OMC 标签)', async () => {
      const { render } = await import('../../hud/render.js');
      const ctx = makeMinimalContext();
      const config: HudConfig = {
        ...DEFAULT_HUD_CONFIG,
        elements: {
          ...DEFAULT_HUD_CONFIG.elements,
          omcLabel: true,
          contextBar: false,
          agents: false,
          todos: false,
          rateLimits: false,
          ralph: false,
          autopilot: false,
          prdStory: false,
          activeSkills: false,
          backgroundTasks: false,
          promptTime: false,
          sessionHealth: false,
          showCallCounts: false,
          model: false,
          lastSkill: false,
        },
      };

      const output = await render(ctx, config);
      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe('element registry', () => {
    /**
     * 元素注册表测试。
     *
     * 期望:Green 阶段后,render.ts 或新模块应导出 ELEMENT_REGISTRY,
     * 包含所有 HUD 元素的元数据。当前 render.ts 无此注册表,测试应失败。
     */
    it('HUD 模块应导出 ELEMENT_REGISTRY 常量', async () => {
      const renderModule = await import('../../hud/render.js');

      // 期望:Green 阶段后存在 ELEMENT_REGISTRY
      expect('ELEMENT_REGISTRY' in renderModule).toBe(true);
    });

    it('ELEMENT_REGISTRY 应包含所有核心元素', async () => {
      const renderModule = await import('../../hud/render.js');
      const registry = (renderModule as unknown as { ELEMENT_REGISTRY?: unknown }).ELEMENT_REGISTRY;

      // 如果不存在,跳过断言细节但仍标记为失败
      if (!registry) {
        expect(registry).toBeDefined();
        return;
      }

      // 期望:registry 是一个 Map 或 Record,包含至少以下键
      const expectedElements = [
        'omcLabel',
        'model',
        'rateLimits',
        'contextBar',
        'agents',
        'todos',
        'ralph',
        'autopilot',
        'background',
        'callCounts',
      ];

      const registryKeys = registry instanceof Map
        ? Array.from(registry.keys())
        : Object.keys(registry as Record<string, unknown>);

      for (const elem of expectedElements) {
        expect(registryKeys, `ELEMENT_REGISTRY 缺少元素:${elem}`).toContain(elem);
      }
    });

    it('ELEMENT_REGISTRY 中每个元素应携带 render mode 元数据', async () => {
      const renderModule = await import('../../hud/render.js');
      const registry = (renderModule as unknown as { ELEMENT_REGISTRY?: unknown }).ELEMENT_REGISTRY;

      if (!registry) {
        expect(registry).toBeDefined();
        return;
      }

      const entries: Array<[string, unknown]> = registry instanceof Map
        ? Array.from(registry.entries())
        : Object.entries(registry as Record<string, unknown>);

      // 每个元素应至少有 name 和 render mode
      for (const [name, meta] of entries) {
        expect(meta, `元素 ${name} 的元数据不应为空`).toBeDefined();
        if (meta && typeof meta === 'object') {
          // 期望有 render mode 字段(具体字段名 Green 阶段确定)
          const metaObj = meta as Record<string, unknown>;
          const hasModeField =
            'mode' in metaObj ||
            'renderMode' in metaObj ||
            'layout' in metaObj ||
            'group' in metaObj;
          expect(hasModeField, `元素 ${name} 缺少 render mode 元数据`).toBe(true);
        }
      }
    });
  });

  describe('render modes', () => {
    /**
     * 渲染模式测试。
     *
     * 期望:Green 阶段后,render 支持 'inline' / 'detail' / 'line1' 等渲染模式,
     * 元素可根据 mode 决定输出位置。
     */
    it('render 应支持通过 layout 配置将元素在 inline/detail 间切换', async () => {
      const { render } = await import('../../hud/render.js');
      const ctx = makeMinimalContext({
        todos: [{ content: 'test todo', status: 'in_progress' }],
      });

      // 将 todos 从默认的 detail 移到 main(inline)
      const config: HudConfig = {
        ...DEFAULT_HUD_CONFIG,
        elements: {
          ...DEFAULT_HUD_CONFIG.elements,
          todos: true,
          contextBar: false,
          agents: false,
          rateLimits: false,
          ralph: false,
          autopilot: false,
          prdStory: false,
          activeSkills: false,
          backgroundTasks: false,
          promptTime: false,
          sessionHealth: false,
          showCallCounts: false,
          model: false,
          lastSkill: false,
        },
        layout: {
          line1: [],
          main: ['omcLabel', 'todos'],
          detail: [],
        },
      };

      const output = await render(ctx, config);
      // todos 应出现在主行(inline)而非独立 detail 行
      expect(output).toContain('test todo');
    });
  });

  describe('render robustness', () => {
    it('render 在 context 字段缺失时不抛错(使用 null 填充)', async () => {
      const { render } = await import('../../hud/render.js');
      // 仅提供必需字段,其余 undefined
      const ctx = {
        contextPercent: 0,
        modelName: null,
        ralph: null,
        ultrawork: null,
        prd: null,
        autopilot: null,
        activeAgents: [],
        todos: [],
        backgroundTasks: [],
        cwd: '/tmp',
        lastSkill: null,
        rateLimitsResult: null,
        customBuckets: null,
        pendingPermission: null,
        thinkingState: null,
        sessionHealth: null,
        omcVersion: null,
        updateAvailable: null,
        toolCallCount: 0,
        agentCallCount: 0,
        skillCallCount: 0,
        promptTime: null,
        apiKeySource: null,
        profileName: null,
        sessionSummary: null,
      } as unknown as HudRenderContext;

      const config: HudConfig = { ...DEFAULT_HUD_CONFIG };

      await expect(render(ctx, config)).resolves.toBeTypeOf('string');
    });

    it('render 是幂等的:相同输入产生相同输出', async () => {
      const { render } = await import('../../hud/render.js');
      const ctx = makeMinimalContext({ contextPercent: 42 });
      const config: HudConfig = { ...DEFAULT_HUD_CONFIG };

      const out1 = await render(ctx, config);
      const out2 = await render(ctx, config);
      expect(out1).toBe(out2);
    });
  });
});
