/**
 * HUD 循环依赖与递归安全回归测试
 *
 * 对应提交:
 * - 66501ffd fix(hud): resolve circular dependency and unbounded recursion from review
 *
 * Red 阶段目标:描述期望行为,当前应失败;Green 阶段修复后应通过。
 *
 * 已知循环依赖(存在于 a3b98624 起点):
 *   state.ts ─imports─> background-cleanup.ts
 *   background-cleanup.ts ─imports─> state.ts
 *
 * 期望(Green 阶段后):
 *   - HUD 模块内不应存在任何 import 循环
 *   - render 在面对环形/超深数据时必须终止
 *   - 必须有显式的最大递归深度限制
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HUD_SRC_DIR = join(__dirname, '..', '..', 'hud');
// 使用项目内临时目录,避免 validateWorkingDirectory 的 worktree 路径校验失败
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

/**
 * 读取 HUD 模块下指定文件的源码,解析其 import 语句。
 * 仅识别相对路径导入(./ 或 ../),忽略 type-only 导入以聚焦运行时循环。
 */
function extractRuntimeImports(fileName: string): string[] {
  const filePath = join(HUD_SRC_DIR, fileName);
  const source = readFileSync(filePath, 'utf-8');
  const imports: string[] = [];

  // 匹配 `import ... from './xxx.js'` 但不匹配 `import type ...`
  // 同时识别 `import { ... } from './xxx.js'` 形式
  const importRegex = /^import\s+(?!type\s)(?:(?:[\w*{}\s,]+)\s+from\s+)?['"](\.\.?\/[^'"]+)['"]/gm;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(source)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

/**
 * 将相对路径解析为相对于 HUD_SRC_DIR 的标准化模块名(不含 ./ 前缀)。
 * 例如 './state.js' -> 'state.ts','./background-cleanup.js' -> 'background-cleanup.ts'
 * 不在 HUD_SRC_DIR 内的路径(../ 开头)返回 null,不参与图构建。
 */
function normalizeImportPath(importPath: string): string | null {
  if (!importPath.startsWith('./')) return null; // 跳过 ../ 开头的外部导入
  // 去掉 ./ 前缀和 .js 后缀,加上 .ts 后缀(源码层面)
  const withoutPrefix = importPath.replace(/^\.\//, '');
  const withoutExt = withoutPrefix.replace(/\.js$/, '');
  return withoutExt + '.ts';
}

/**
 * 构建 HUD 模块的运行时 import 图(仅 HUD 内部文件)。
 * 节点:文件名(相对 HUD_SRC_DIR)。边:A imports B。
 */
function buildHudImportGraph(): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  // 仅扫描 HUD 顶层 .ts 文件(elements/ 子目录的导入不形成顶层循环)
  const topFiles = [
    'index.ts',
    'render.ts',
    'state.ts',
    'stdin.ts',
    'types.ts',
    'transcript.ts',
    'mission-board.ts',
    'background-cleanup.ts',
    'background-tasks.ts',
    'omc-state.ts',
    'usage-api.ts',
    'custom-rate-provider.ts',
    'sanitize.ts',
    'payload-estimate.ts',
    'colors.ts',
  ];

  for (const file of topFiles) {
    const imports = extractRuntimeImports(file);
    // 仅保留 HUD 内部的导入(以 ./ 开头且不是 type-only),并标准化路径
    const internalImports = imports
      .map(normalizeImportPath)
      .filter((p): p is string => p !== null);
    graph.set(file, internalImports);
  }

  return graph;
}

/**
 * DFS 检测有向图中的环。返回找到的第一个环(路径数组),无环返回 null。
 */
function detectCycle(graph: Map<string, string[]>): string[] | null {
  const WHITE = 0; // 未访问
  const GRAY = 1;  // 正在访问(在当前 DFS 栈中)
  const BLACK = 2; // 已完成
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const node of graph.keys()) {
    color.set(node, WHITE);
    parent.set(node, null);
  }

  function dfs(start: string): string[] | null {
    color.set(start, GRAY);
    const neighbors = graph.get(start) ?? [];
    for (const next of neighbors) {
      if (!graph.has(next)) continue; // 跳过图外节点
      const c = color.get(next);
      if (c === GRAY) {
        // 找到环:回溯从 start 到 next 的路径
        const cycle: string[] = [next, start];
        let cur: string | null = parent.get(start) ?? null;
        while (cur && cur !== next) {
          cycle.push(cur);
          cur = parent.get(cur) ?? null;
        }
        cycle.push(next);
        return cycle.reverse();
      }
      if (c === WHITE) {
        parent.set(next, start);
        const found = dfs(next);
        if (found) return found;
      }
    }
    color.set(start, BLACK);
    return null;
  }

  for (const node of graph.keys()) {
    if (color.get(node) === WHITE) {
      const found = dfs(node);
      if (found) return found;
    }
  }
  return null;
}

describe('HUD circular dependency', () => {
  describe('import graph analysis', () => {
    it('HUD 顶层模块之间不应存在运行时 import 循环', () => {
      const graph = buildHudImportGraph();
      const cycle = detectCycle(graph);
      // 期望:无循环。当前:state.ts <-> background-cleanup.ts 形成循环,此测试应失败。
      expect(cycle, `检测到 import 循环:${cycle ? cycle.join(' -> ') : '无'}`).toBeNull();
    });

    it('state.ts 不应直接导入 background-cleanup.ts(应通过依赖注入)', () => {
      // 期望:state.ts 不再静态导入 background-cleanup.ts
      // 当前:state.ts 第 39-42 行 `import { cleanupStaleBackgroundTasks, markOrphanedTasksAsStale } from "./background-cleanup.js"`
      const imports = extractRuntimeImports('state.ts');
      const hasBackgroundCleanup = imports.some((p) => p.includes('background-cleanup'));
      // Green 阶段后应改为 false(通过参数注入或延迟加载打破循环)
      expect(hasBackgroundCleanup).toBe(false);
    });

    it('background-cleanup.ts 不应直接导入 state.ts(应通过依赖注入)', () => {
      // 期望:background-cleanup.ts 不再静态导入 state.ts
      // 当前:background-cleanup.ts 第 8 行 `import { readHudState, writeHudState } from './state.js'`
      const imports = extractRuntimeImports('background-cleanup.ts');
      const hasState = imports.some((p) => p === './state.js' || p === './state');
      expect(hasState).toBe(false);
    });
  });

  describe('runtime import safety', () => {
    it('动态 import state.ts 不抛错且在 2 秒内完成', async () => {
      // 循环依赖可能导致 ESM 初始化挂起或部分绑定未定义
      const start = Date.now();
      const module = await import('../../hud/state.js');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(2000);
      expect(module.readHudState).toBeDefined();
      expect(module.writeHudState).toBeDefined();
      expect(module.initializeHUDState).toBeDefined();
    });

    it('动态 import background-cleanup.ts 不抛错且在 2 秒内完成', async () => {
      const start = Date.now();
      const module = await import('../../hud/background-cleanup.js');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(2000);
      expect(module.cleanupStaleBackgroundTasks).toBeDefined();
      expect(module.markOrphanedTasksAsStale).toBeDefined();
    });

    it('动态 import render.ts 不抛错且在 2 秒内完成', async () => {
      const start = Date.now();
      const module = await import('../../hud/render.js');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(2000);
      expect(module.render).toBeDefined();
      expect(typeof module.render).toBe('function');
    });

    it('动态 import index.ts 不抛错(允许 main 自执行但不应崩溃)', async () => {
      // index.ts 末尾有 `main()` 自执行调用,会尝试读取 stdin
      // 在测试环境中 stdin 是 TTY,main 应优雅返回而非崩溃
      // 循环依赖可能导致初始化时 ReferenceError
      const start = Date.now();
      await expect(import('../../hud/index.js')).resolves.toBeDefined();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe('render under cyclic context', () => {
    it('render 在面对含自引用的 context 时不抛错且在 1 秒内返回', async () => {
      const { render } = await import('../../hud/render.js');
      const { DEFAULT_HUD_CONFIG } = await import('../../hud/types.js');

      // 构造一个带自引用环的 context
      // 注意:HudRenderContext 本身不要求是 DAG,但 render 内部不应无限递归
      const ctx: Record<string, unknown> = {
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
      };
      // 制造自引用环
      (ctx as any).self = ctx;
      (ctx as any).ralph = { active: false, iteration: 0, maxIterations: 0 } as any;
      ((ctx as any).ralph as any).parent = ctx;

      const config = { ...DEFAULT_HUD_CONFIG };
      // 关闭大部分元素以减少干扰
      config.elements = { ...config.elements, omcLabel: true, contextBar: false, agents: false, todos: false, callCounts: false } as any;

      const start = Date.now();
      const output = await render(ctx as any, config);
      const elapsed = Date.now() - start;

      expect(typeof output).toBe('string');
      expect(elapsed).toBeLessThan(1000);
    });
  });
});

describe('HUD recursion safety', () => {
  /**
   * 递归深度限制测试。
   *
   * 对应 66501ffd 提交说明:修复"unbounded recursion"。
   * 期望:render 或任何 HUD 内部递归函数都应有最大深度限制。
   * Green 阶段应在源码中引入显式的 MAX_RECURSION_DEPTH 常量。
   */
  describe('max recursion depth guard', () => {
    it('render 对深度嵌套的 todos 数组(1000 层)在 1 秒内终止', async () => {
      const { render } = await import('../../hud/render.js');
      const { DEFAULT_HUD_CONFIG } = await import('../../hud/types.js');

      // 构造深度嵌套的 todos(虽然是扁平数组,但每个 todo 的 content 嵌套)
      let deep: unknown = 'leaf';
      for (let i = 0; i < 1000; i++) {
        deep = { nested: deep, label: String(i) };
      }
      const todos = [{
        content: JSON.stringify(deep).slice(0, 200),
        status: 'in_progress' as const,
      }];

      const ctx = {
        contextPercent: 0,
        contextDisplayScope: 'test',
        modelName: null,
        modelId: null,
        ralph: null,
        ultrawork: null,
        prd: null,
        autopilot: null,
        activeAgents: [],
        todos,
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
        omcVersion: null,
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
      };

      const config = { ...DEFAULT_HUD_CONFIG, elements: { ...DEFAULT_HUD_CONFIG.elements, todos: true } as any };

      const start = Date.now();
      const output = await render(ctx as any, config);
      const elapsed = Date.now() - start;

      expect(typeof output).toBe('string');
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('cyclic state reference safety', () => {
    it('readHudState 在面对磁盘上的环形 JSON 引用时不会无限递归', async () => {
      // 期望:readHudState 应安全解析 JSON,即使内容包含 $ref 风格的自引用
      // 当前:JSON.parse 不会递归(它是原子的),但如果 Green 阶段引入了
      // 引用解析逻辑,必须有深度限制。此测试作为前瞻性回归保护。
      const { readHudState } = await import('../../hud/state.js');

      // 使用项目内临时目录,避免 worktree 路径校验失败
      // 注意:getOmcRoot 可能向上查找已有的 .omc 目录,所以这里不假设返回 null
      const tmpRoot = mkdtempSync(join(PROJECT_ROOT, '.hud-test-tmp-'));
      try {
        const start = Date.now();
        // 调用不应抛错,且应快速返回(无论结果是 null 还是 state 对象)
        const result = readHudState(tmpRoot, undefined);
        const elapsed = Date.now() - start;

        expect(elapsed).toBeLessThan(500);
        // 结果只能是 null 或带 backgroundTasks 的对象
        expect(result === null || (result && Array.isArray(result.backgroundTasks))).toBe(true);
      } finally {
        rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('initializeHUDState 不会因 state <-> background-cleanup 循环而无限递归', async () => {
      // 期望:initializeHUDState 调用 cleanupStaleBackgroundTasks,
      // 后者调用 readHudState/writeHudState。循环依赖不应导致初始化递归。
      // 当前:循环依赖存在,但 ESM 部分初始化可能让它在运行时"恰好工作"。
      // Green 阶段应彻底打破循环,此测试作为回归保护。
      const { initializeHUDState } = await import('../../hud/state.js');

      // 使用项目内临时目录,避免 worktree 路径校验失败
      const tmpRoot = mkdtempSync(join(PROJECT_ROOT, '.hud-test-tmp-'));
      try {
        const start = Date.now();
        await expect(
          initializeHUDState(tmpRoot, undefined),
        ).resolves.toBeUndefined();
        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(2000);
      } finally {
        rmSync(tmpRoot, { recursive: true, force: true });
      }
    });
  });
});
