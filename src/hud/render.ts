/**
 * OMC HUD - Main Renderer
 *
 * Composes statusline output from render context.
 */

import type {
  HudRenderContext,
  HudConfig,
  LayoutConfig,
  HudRegionGroup,
} from "./types.js";
import {
  DEFAULT_HUD_CONFIG,
  DEFAULT_ELEMENT_ORDER,
  DEFAULT_HUD_LABELS,
  DEFAULT_REGION_MAP,
} from "./types.js";
import { bold, dim } from "./colors.js";
import { isRuntimePackageLocal } from "../lib/version.js";
import { stringWidth, getCharWidth } from "../utils/string-width.js";
import { renderRalph } from "./elements/ralph.js";
import {
  renderAgentsByFormat,
  renderAgentsMultiLine,
} from "./elements/agents.js";
import { renderTodosWithCurrent } from "./elements/todos.js";
import { renderSkills, renderLastSkill } from "./elements/skills.js";
import { renderContext, renderContextWithBar } from "./elements/context.js";
import { renderBackground } from "./elements/background.js";
import { renderPrd } from "./elements/prd.js";
import {
  renderRateLimits,
  renderRateLimitsWithBar,
  renderRateLimitsError,
  renderApiKeyUsageHint,
  renderCustomBuckets,
} from "./elements/limits.js";
import { renderPermission } from "./elements/permission.js";
import { renderThinking } from "./elements/thinking.js";
import { renderSession } from "./elements/session.js";
import { renderCacheRate } from "./elements/cache-rate.js";
import {
  joinTokenParts,
  splitTokenUsage,
  type TokenUsageParts,
} from "./elements/token-usage.js";
import { renderEnterpriseCost } from "./elements/enterprise-cost.js";
import { renderPromptTime } from "./elements/prompt-time.js";
import { renderAutopilot } from "./elements/autopilot.js";
import { renderCwd } from "./elements/cwd.js";
import { renderHostname } from "./elements/hostname.js";
import { renderGitRepo, renderGitBranch, renderGitStatus } from "./elements/git.js";
import { renderMultiRepo } from "./elements/multi-repo.js";
import { renderModel } from "./elements/model.js";
import { renderApiKeySource } from "./elements/api-key-source.js";
import { renderCallCounts } from "./elements/call-counts.js";
import {
  renderContextLimitWarning,
  renderPayloadLimitWarning,
} from "./elements/context-warning.js";
import { renderMissionBoard } from "./mission-board.js";
import { renderSessionSummary } from "./elements/session-summary.js";
import { renderLastTool } from "./elements/last-tool.js";

// ============================================================================
// 元素注册表
// ============================================================================

/**
 * 元素渲染模式:
 * - inline: 渲染到主状态行(以分隔符连接)
 * - detail: 渲染为独立详情行
 */
export type ElementRenderMode = 'inline' | 'detail';

/**
 * 元素所属布局组:
 * - line1: git/信息行
 * - main: 主状态行
 * - detail: 独立详情行
 */
export type ElementLayoutGroup = 'line1' | 'main' | 'detail';

/**
 * 元素注册表项:携带每个元素的元数据(name、render mode、layout group)。
 * render 函数主循环仍保留 if/else 分支以保持向后兼容,
 * 此注册表作为元数据的集中来源,供外部工具与测试消费。
 */
export interface ElementRegistryEntry {
  name: string;
  mode: ElementRenderMode;
  group: ElementLayoutGroup;
}

/**
 * HUD 元素注册表:集中声明所有核心元素的元数据(对应提交 eacb0ae9)。
 * 包含每个元素的渲染模式(inline/detail)与所属布局组。
 * 测试与外部工具可通过此注册表查询元素元数据,无需扫描 render 源码。
 */
export const ELEMENT_REGISTRY: Record<string, ElementRegistryEntry> = {
  // line1 组(git/信息行)
  hostname: { name: 'hostname', mode: 'inline', group: 'line1' },
  cwd: { name: 'cwd', mode: 'inline', group: 'line1' },
  gitRepo: { name: 'gitRepo', mode: 'inline', group: 'line1' },
  gitBranch: { name: 'gitBranch', mode: 'inline', group: 'line1' },
  gitStatus: { name: 'gitStatus', mode: 'inline', group: 'line1' },
  apiKeySource: { name: 'apiKeySource', mode: 'inline', group: 'line1' },
  profile: { name: 'profile', mode: 'inline', group: 'line1' },
  // main 组(主状态行)
  omcLabel: { name: 'omcLabel', mode: 'inline', group: 'main' },
  model: { name: 'model', mode: 'inline', group: 'main' },
  enterpriseCost: { name: 'enterpriseCost', mode: 'inline', group: 'main' },
  rateLimits: { name: 'rateLimits', mode: 'inline', group: 'main' },
  customBuckets: { name: 'customBuckets', mode: 'inline', group: 'main' },
  permission: { name: 'permission', mode: 'inline', group: 'main' },
  thinking: { name: 'thinking', mode: 'inline', group: 'main' },
  promptTime: { name: 'promptTime', mode: 'inline', group: 'main' },
  session: { name: 'session', mode: 'inline', group: 'main' },
  tokens: { name: 'tokens', mode: 'inline', group: 'main' },
  ralph: { name: 'ralph', mode: 'inline', group: 'main' },
  autopilot: { name: 'autopilot', mode: 'inline', group: 'main' },
  prd: { name: 'prd', mode: 'inline', group: 'main' },
  skills: { name: 'skills', mode: 'inline', group: 'main' },
  lastSkill: { name: 'lastSkill', mode: 'inline', group: 'main' },
  contextBar: { name: 'contextBar', mode: 'inline', group: 'main' },
  agents: { name: 'agents', mode: 'inline', group: 'main' },
  background: { name: 'background', mode: 'inline', group: 'main' },
  callCounts: { name: 'callCounts', mode: 'inline', group: 'main' },
  lastTool: { name: 'lastTool', mode: 'inline', group: 'main' },
  sessionSummary: { name: 'sessionSummary', mode: 'inline', group: 'main' },
  // detail 组(独立详情行)
  missionBoard: { name: 'missionBoard', mode: 'detail', group: 'detail' },
  contextWarning: { name: 'contextWarning', mode: 'detail', group: 'detail' },
  payloadWarning: { name: 'payloadWarning', mode: 'detail', group: 'detail' },
  todos: { name: 'todos', mode: 'detail', group: 'detail' },
};

/**
 * ANSI escape sequence regex (matches SGR and other CSI sequences).
 * Used to skip escape codes when measuring/truncating visible width.
 */
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/;

const PLAIN_SEPARATOR = " | ";
const DIM_SEPARATOR = dim(PLAIN_SEPARATOR);
// L2 region separator (B-3, P1-10): visually distinct from the L1 element
// separator so I/O/S region boundaries are discernible at a glance.
// U+257E BOX DRAWINGS LIGHT QUADRUPLE DASH HORIZONTAL — safeMode falls back
// to | via sanitize.ts UNICODE_TO_ASCII.
const PLAIN_REGION_SEPARATOR = " ╎ ";
const REGION_SEPARATOR = dim(PLAIN_REGION_SEPARATOR);

// Narrow terminal threshold (B-6, P1-14): below this width, detail lines
// (warnings/agents/todos) are prioritized over the main statusline so the
// user never loses actionable context on small terminals.
const NARROW_TERMINAL_THRESHOLD = 70;

/** I/O/S region display order for ioGrouping (Input → Output → Status). */
const REGION_ORDER: readonly HudRegionGroup[] = ['I', 'O', 'S'];

function buildMainElementOrder(elementOrder: string[] | undefined): string[] {
  if (!Array.isArray(elementOrder) || elementOrder.length === 0) {
    return DEFAULT_ELEMENT_ORDER.main;
  }

  const known = new Set(DEFAULT_ELEMENT_ORDER.main);
  const seen = new Set<string>();
  const configured = elementOrder.filter((name) => {
    if (!known.has(name) || seen.has(name)) {
      return false;
    }
    seen.add(name);
    return true;
  });

  const remaining = DEFAULT_ELEMENT_ORDER.main.filter(
    (name) => !configured.includes(name),
  );

  return [...configured, ...remaining];
}

/**
 * Truncate a single line to a maximum visual width, preserving ANSI escape codes.
 * When the visible content exceeds maxWidth columns, it is truncated with an ellipsis.
 *
 * @param line - The line to truncate (may contain ANSI codes)
 * @param maxWidth - Maximum visual width in terminal columns
 * @returns Truncated line that fits within maxWidth visible columns
 */
export function truncateLineToMaxWidth(line: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (stringWidth(line) <= maxWidth) return line;

  const ELLIPSIS = "...";
  const ellipsisWidth = 3;
  const targetWidth = Math.max(0, maxWidth - ellipsisWidth);

  let visibleWidth = 0;
  let result = "";
  let hasAnsi = false;
  let i = 0;

  while (i < line.length) {
    // Check for ANSI escape sequence at current position
    const remaining = line.slice(i);
    const ansiMatch = remaining.match(ANSI_REGEX);

    if (ansiMatch && ansiMatch.index === 0) {
      // Pass through the entire ANSI sequence without counting width
      result += ansiMatch[0];
      hasAnsi = true;
      i += ansiMatch[0].length;
      continue;
    }

    // Read the full code point (handles surrogate pairs for astral-plane chars like emoji)
    const codePoint = line.codePointAt(i)!;
    const codeUnits = codePoint > 0xffff ? 2 : 1;
    const char = line.slice(i, i + codeUnits);
    const charWidth = getCharWidth(char);

    if (visibleWidth + charWidth > targetWidth) break;

    result += char;
    visibleWidth += charWidth;
    i += codeUnits;
  }

  // Append ANSI reset before ellipsis if any escape codes were seen,
  // to prevent color/style bleed into subsequent terminal output
  const reset = hasAnsi ? "\x1b[0m" : "";
  return result + reset + ELLIPSIS;
}

/**
 * Wrap a single line at HUD separator boundaries so each wrapped line
 * fits within maxWidth visible columns.
 *
 * Falls back to truncation when:
 * - no separator is present
 * - any single segment exceeds maxWidth
 */
function wrapLineToMaxWidth(line: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [""];
  if (stringWidth(line) <= maxWidth) return [line];

  const separator = line.includes(REGION_SEPARATOR)
    ? REGION_SEPARATOR
    : line.includes(PLAIN_REGION_SEPARATOR)
      ? PLAIN_REGION_SEPARATOR
      : line.includes(DIM_SEPARATOR)
        ? DIM_SEPARATOR
        : line.includes(PLAIN_SEPARATOR)
          ? PLAIN_SEPARATOR
          : null;

  if (!separator) {
    return [truncateLineToMaxWidth(line, maxWidth)];
  }

  const segments = line.split(separator);
  if (segments.length <= 1) {
    return [truncateLineToMaxWidth(line, maxWidth)];
  }

  const wrapped: string[] = [];
  let current = segments[0] ?? "";

  for (let i = 1; i < segments.length; i += 1) {
    const nextSegment = segments[i] ?? "";
    const candidate = `${current}${separator}${nextSegment}`;

    if (stringWidth(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (stringWidth(current) > maxWidth) {
      wrapped.push(truncateLineToMaxWidth(current, maxWidth));
    } else {
      wrapped.push(current);
    }

    current = nextSegment;
  }

  if (stringWidth(current) > maxWidth) {
    wrapped.push(truncateLineToMaxWidth(current, maxWidth));
  } else {
    wrapped.push(current);
  }

  return wrapped;
}

/**
 * Apply maxWidth behavior by mode.
 */
function applyMaxWidthByMode(
  lines: string[],
  maxWidth: number | undefined,
  wrapMode: "truncate" | "wrap" | undefined,
): string[] {
  if (!maxWidth || maxWidth <= 0) return lines;

  if (wrapMode === "wrap") {
    return lines.flatMap((line) => wrapLineToMaxWidth(line, maxWidth));
  }

  return lines.map((line) => truncateLineToMaxWidth(line, maxWidth));
}

/**
 * Limit output lines to prevent input field shrinkage (Issue #222).
 * Trims lines from the end while preserving the first (header) line.
 *
 * @param lines - Array of output lines
 * @param maxLines - Maximum number of lines to output (uses DEFAULT_HUD_CONFIG if not specified)
 * @returns Trimmed array of lines
 */
export function limitOutputLines(lines: string[], maxLines?: number): string[] {
  const limit = Math.max(
    1,
    maxLines ?? DEFAULT_HUD_CONFIG.elements.maxOutputLines,
  );
  if (lines.length <= limit) {
    return lines;
  }
  const truncatedCount = lines.length - limit + 1;
  return [...lines.slice(0, limit - 1), `... (+${truncatedCount} lines)`];
}

/**
 * Render the complete statusline (single or multi-line)
 */
export async function render(
  context: HudRenderContext,
  config: HudConfig,
): Promise<string> {
  const { elements: enabledElements } = config;
  const hudLabels = config.labels ?? DEFAULT_HUD_LABELS;

  const enableGrouping = config.elements.ioGrouping ?? false;
  // Token parts computed once and either joined into the single "tokens"
  // element (grouping off) or distributed across I/O/S regions (grouping on).
  let tokenParts: TokenUsageParts | null = null;

  // ── Render all elements into maps ──────────────────────────────────
  // Each element is rendered independently and stored by name.
  // The layout (or DEFAULT_ELEMENT_ORDER) determines final ordering.
  const rendered = new Map<string, string>();
  const renderedDetail = new Map<string, string[]>();

  // -- line1-group elements (default: git info line) --

  if (enabledElements.hostname) {
    const hostnameElement = renderHostname();
    if (hostnameElement) rendered.set("hostname", hostnameElement);
  }

  if (enabledElements.cwd) {
    const cwdElement = renderCwd(
      context.cwd,
      enabledElements.cwdFormat || "relative",
      enabledElements.useHyperlinks ?? false,
    );
    if (cwdElement) rendered.set("cwd", cwdElement);
  }

  // Multi-repo parent dir: replace the per-repo chips with a single
  // workspace summary. When cwd is itself a git repo, renderMultiRepo
  // returns null and the normal git elements take over.
  const multiRepoElement = enabledElements.gitRepo
    ? renderMultiRepo(context.cwd, hudLabels)
    : null;

  if (multiRepoElement) {
    rendered.set("gitRepo", multiRepoElement);
  } else {
    if (enabledElements.gitRepo) {
      const gitRepoElement = renderGitRepo(context.cwd);
      if (gitRepoElement) rendered.set("gitRepo", gitRepoElement);
    }

    if (enabledElements.gitBranch) {
      const gitBranchElement = renderGitBranch(context.cwd);
      if (gitBranchElement) rendered.set("gitBranch", gitBranchElement);
    }

    if (enabledElements.gitStatus) {
      const gitStatusElement = renderGitStatus(context.cwd, hudLabels);
      if (gitStatusElement) rendered.set("gitStatus", gitStatusElement);
    }
  }

  const modelSource = enabledElements.modelFormat === 'full'
    ? context.modelId ?? context.modelName
    : context.modelName;
  if (enabledElements.model && modelSource) {
    const modelElement = renderModel(
      modelSource,
      enabledElements.modelFormat,
      hudLabels,
    );
    if (modelElement) rendered.set("model", modelElement);
  }

  if (enabledElements.apiKeySource && context.apiKeySource) {
    const keySource = renderApiKeySource(context.apiKeySource);
    if (keySource) rendered.set("apiKeySource", keySource);
  }

  if (enabledElements.profile && context.profileName) {
    // P0-2：profile 非 bold（bold 只保留给 update 提醒与 warning banner — R-WEIGHT-3）
    rendered.set("profile", dim(`profile:${context.profileName}`));
  }

  // -- main-group elements (default: main statusline) --

  if (enabledElements.omcLabel) {
    const localSuffix = isRuntimePackageLocal() ? "L" : "";
    const versionTag = context.omcVersion
      ? `#${context.omcVersion}${localSuffix}`
      : (localSuffix ? `#${localSuffix}` : "");
    if (enabledElements.updateNotification !== false && context.updateAvailable) {
      rendered.set(
        "omcLabel",
        bold(`[OMC${versionTag}] -> ${context.updateAvailable} omc update`),
      );
    } else {
      // R-WEIGHT-3 品牌降权：品牌标签默认前景、非 bold（bold 白名单只留给 update/警告/临界）
      rendered.set("omcLabel", `[OMC${versionTag}]`);
    }
  }

  // Determine effective enterprise mode before rendering limits: only real
  // enterprise accounts replace token-window limits with enterprise cost.
  const isEnterprise = enabledElements.enterpriseMode !== undefined
    ? enabledElements.enterpriseMode
    : (
        (context.subscriptionType ?? '').toLowerCase() === 'enterprise' ||
        /claude_zero/i.test(context.rateLimitTier ?? '')
      );

  // Rate limits (5h and weekly) - data takes priority over error indicator.
  // Enterprise cost data only replaces token-window limits for accounts that
  // are actually enterprise/claude_zero. Anthropic may include zero-dollar
  // enterprise fields for non-enterprise paid plans; those must still show
  // normal 5h/wk limits.
  const enterpriseCostReplacesRateLimits =
    isEnterprise &&
    context.rateLimitsResult?.rateLimits?.enterpriseSpentUsd !== undefined;
  if (enabledElements.rateLimits && context.rateLimitsResult && !enterpriseCostReplacesRateLimits) {
    if (context.rateLimitsResult.rateLimits) {
      const stale = context.rateLimitsResult.stale;
      const limits = enabledElements.useBars
        ? renderRateLimitsWithBar(
            context.rateLimitsResult.rateLimits,
            undefined,
            stale,
          )
        : renderRateLimits(context.rateLimitsResult.rateLimits, stale);
      if (limits) rendered.set("rateLimits", limits);
    } else {
      const errorIndicator = renderRateLimitsError(context.rateLimitsResult, hudLabels);
      if (errorIndicator) {
        rendered.set("rateLimits", errorIndicator);
      } else {
        const hint = renderApiKeyUsageHint(
          context.rateLimitsResult,
          context.apiKeyMode ?? false,
          config.rateLimitsProvider?.type === "custom",
          hudLabels,
        );
        if (hint) rendered.set("rateLimits", hint);
      }
    }
  }

  if (context.customBuckets) {
    const thresholdPercent =
      config.rateLimitsProvider?.resetsAtDisplayThresholdPercent;
    const custom = renderCustomBuckets(context.customBuckets, thresholdPercent);
    if (custom) rendered.set("customBuckets", custom);
  }

  if (enabledElements.permissionStatus && context.pendingPermission) {
    const permission = renderPermission(context.pendingPermission);
    if (permission) rendered.set("permission", permission);
  }

  if (enabledElements.thinking && context.thinkingState) {
    const thinking = renderThinking(
      context.thinkingState,
      enabledElements.thinkingFormat,
      hudLabels,
    );
    if (thinking) rendered.set("thinking", thinking);
  }

  if (enabledElements.promptTime) {
    const prompt = renderPromptTime(context.promptTime, new Date());
    if (prompt) rendered.set("promptTime", prompt);
  }

  // Cache hit rate (I region, before tokens) — null when stdin has no cache data
  if (enabledElements.cacheRate && context.cacheUsage) {
    const cache = renderCacheRate(context.cacheUsage, hudLabels);
    if (cache) rendered.set("cacheRate", cache);
  }

  if (enabledElements.sessionHealth && context.sessionHealth) {
    const showDuration = enabledElements.showSessionDuration ?? true;
    const showIndicator = enabledElements.showHealthIndicator ?? true;
    if (showDuration || showIndicator) {
      const session = renderSession(context.sessionHealth, showIndicator, hudLabels);
      if (session) rendered.set("session", session);
    }
  }

  if (isEnterprise && enabledElements.showEnterpriseCost !== false) {
    const stale = context.rateLimitsResult?.stale;
    const cost = renderEnterpriseCost(
      context.rateLimitsResult?.rateLimits,
      stale,
    );
    if (cost) {
      rendered.set("enterpriseCost", cost);
    } else if (enabledElements.showTokens === true) {
      // Enterprise but no cost data — fall back to token usage
      tokenParts = splitTokenUsage(
        context.lastRequestTokenUsage,
        context.sessionTotalTokens,
        hudLabels,
      );
      if (tokenParts && !enableGrouping) {
        rendered.set("tokens", joinTokenParts(tokenParts));
      }
    }
  } else if (enabledElements.showTokens === true) {
    tokenParts = splitTokenUsage(
      context.lastRequestTokenUsage,
      context.sessionTotalTokens,
      hudLabels,
    );
    if (tokenParts && !enableGrouping) {
      rendered.set("tokens", joinTokenParts(tokenParts));
    }
  }

  if (enabledElements.ralph && context.ralph) {
    const ralph = renderRalph(context.ralph, config.thresholds, hudLabels);
    if (ralph) rendered.set("ralph", ralph);
  }

  if (enabledElements.autopilot && context.autopilot) {
    const autopilot = renderAutopilot(context.autopilot, config.thresholds);
    if (autopilot) rendered.set("autopilot", autopilot);
  }

  if (enabledElements.prdStory && context.prd) {
    const prd = renderPrd(context.prd);
    if (prd) rendered.set("prd", prd);
  }

  if (enabledElements.activeSkills) {
    const skills = renderSkills(
      context.ultrawork,
      context.ralph,
      (enabledElements.lastSkill ?? true) ? context.lastSkill : null,
    );
    if (skills) rendered.set("skills", skills);
  }

  if ((enabledElements.lastSkill ?? true) && !enabledElements.activeSkills) {
    const lastSkillElement = renderLastSkill(context.lastSkill);
    if (lastSkillElement) rendered.set("lastSkill", lastSkillElement);
  }

  if (enabledElements.contextBar) {
    const ctx = enabledElements.useBars
      ? renderContextWithBar(
          context.contextPercent,
          config.thresholds,
          10,
          context.contextDisplayScope,
          hudLabels,
        )
      : renderContext(
          context.contextPercent,
          config.thresholds,
          context.contextDisplayScope,
          hudLabels,
        );
    if (ctx) rendered.set("contextBar", ctx);
  }

  // Active agents - handle multi-line format specially
  if (enabledElements.agents) {
    const format = enabledElements.agentsFormat || "codes";

    if (format === "multiline") {
      const maxLines = enabledElements.agentsMaxLines || 5;
      const result = renderAgentsMultiLine(context.activeAgents, maxLines);
      if (result.headerPart) rendered.set("agents", result.headerPart);
      if (result.detailLines.length > 0) {
        renderedDetail.set("agents", result.detailLines);
      }
    } else {
      const agents = renderAgentsByFormat(context.activeAgents, format);
      if (agents) rendered.set("agents", agents);
    }
  }

  if (enabledElements.backgroundTasks) {
    const bg = renderBackground(context.backgroundTasks, hudLabels);
    if (bg) rendered.set("background", bg);
  }

  const showCounts = enabledElements.showCallCounts ?? true;
  if (showCounts) {
    const counts = renderCallCounts(
      context.toolCallCount,
      context.agentCallCount,
      context.skillCallCount,
      enabledElements.callCountsFormat ?? 'auto',
      hudLabels,
    );
    if (counts) rendered.set("callCounts", counts);
  }

  if (enabledElements.showLastTool === true) {
    const tool = renderLastTool(context.lastToolName ?? null);
    if (tool) rendered.set("lastTool", tool);
  }

  if (enabledElements.sessionSummary && context.sessionSummary) {
    const summary = renderSessionSummary(context.sessionSummary);
    if (summary) rendered.set("sessionSummary", summary);
  }

  // -- detail-group elements --

  if (
    context.missionBoard &&
    (config.missionBoard?.enabled ?? config.elements.missionBoard ?? false)
  ) {
    const mbLines = renderMissionBoard(context.missionBoard, config.missionBoard);
    if (mbLines.length > 0) renderedDetail.set("missionBoard", mbLines);
  }

  const ctxWarning = renderContextLimitWarning(
    context.contextPercent,
    config.contextLimitWarning.threshold,
    config.contextLimitWarning.autoCompact,
  );
  if (ctxWarning) renderedDetail.set("contextWarning", [ctxWarning]);

  const payloadWarning = renderPayloadLimitWarning(context.payloadEstimate);
  if (payloadWarning) renderedDetail.set("payloadWarning", [payloadWarning]);

  if (enabledElements.todos) {
    const todos = renderTodosWithCurrent(context.todos);
    if (todos) renderedDetail.set("todos", [todos]);
  }

  // ── Assemble output using layout order ─────────────────────────────
  const safeArray = (v: unknown, fallback: string[]): string[] =>
    Array.isArray(v) ? v : fallback;

  const effectiveLayout: Required<LayoutConfig> = {
    line1: safeArray(config.layout?.line1, DEFAULT_ELEMENT_ORDER.line1),
    // `layout.main` remains the advanced authoritative layout control.
    // `elementOrder` is a narrow convenience alias for the main HUD line only.
    main: safeArray(config.layout?.main, buildMainElementOrder(config.elementOrder)),
    detail: safeArray(config.layout?.detail, DEFAULT_ELEMENT_ORDER.detail),
  };

  /** Collect inline elements in layout order.
   *  Also picks up detail-origin elements moved to an inline group —
   *  their detail lines are joined into a single inline string. */
  function collectInline(order: string[]): string[] {
    const result: string[] = [];
    for (const name of order) {
      const el = rendered.get(name);
      if (el) {
        result.push(el);
      } else {
        // Detail elements moved to an inline group render as joined inline
        const lines = renderedDetail.get(name);
        if (lines && lines.length > 0) result.push(lines.join(" "));
      }
    }
    return result;
  }

  /** Collect inline elements grouped into I/O/S regions (ioGrouping enabled).
   *  Each element is bucketed by DEFAULT_REGION_MAP (falling back to Status),
   *  `tokens` is split so input+session land in I, output+reasoning in O,
   *  and `omcLabel` stays an untagged leading brand prefix.
   *
   *  Region tag rules (排版 P0-①/④):
   *  - 区域标签只为该区第一个"裸值"(无自带 label 的元素,如 token 数字)提供语义。
   *  - 元素自带 label 的(模型:/缓存:/上下文:/会话:)排在裸值之后,
   *    区域不再重复贴标签,避免 `状态: 模型:` 这类双重标签连排。
   *  - 因此 tokens 拆分出的 input/output 必须排到各自区域首位,
   *    使 `输入:`/`输出:` 区域标签恰好充当它们的语义标签。
   */
  function collectInlineWithRegions(order: string[]): string[] {
    interface RegionEntry {
      els: string[];
      /** 区域第一个元素是否为裸值(无自带标签)——决定是否渲染区域标签 */
      firstBare: boolean;
    }
    const regions: Record<HudRegionGroup, RegionEntry> = {
      I: { els: [], firstBare: false },
      O: { els: [], firstBare: false },
      S: { els: [], firstBare: false },
    };
    const prefix: string[] = [];
    const regionLabels: Record<HudRegionGroup, string> = {
      I: hudLabels.input,
      O: hudLabels.output,
      S: hudLabels.status,
    };

    /** 追加元素到区域;bare=true 表示无自带 label 的裸值(如 token 数字)。 */
    function pushToRegion(group: HudRegionGroup, el: string, bare = false): void {
      const region = regions[group];
      if (region.els.length === 0) region.firstBare = bare;
      region.els.push(el);
    }

    for (const name of order) {
      if (name === 'omcLabel') {
        const el = rendered.get(name);
        if (el) prefix.push(el);
        continue;
      }
      if (name === 'tokens') {
        if (!tokenParts) continue;
        // input + session total both land in I (单次输入与累计并列);
        // output + reasoning land in O; S no longer carries token parts.
        // 元素间用 DIM_SEPARATOR 分隔,避免 `2.2k 累计:67.4k` 黏连(排版 P0-②)。
        const input = [tokenParts.input, tokenParts.session]
          .filter((p): p is string => p !== null)
          .join(DIM_SEPARATOR);
        if (input) pushToRegion('I', input, true);
        const output = [tokenParts.output, tokenParts.reasoning]
          .filter((p): p is string => p !== null)
          .join(DIM_SEPARATOR);
        if (output) pushToRegion('O', output, true);
        continue;
      }

      let el = rendered.get(name);
      if (!el) {
        // Detail elements moved to an inline group render as joined inline
        const lines = renderedDetail.get(name);
        if (lines && lines.length > 0) el = lines.join(' ');
      }
      if (el) {
        // 自带标签的元素(模型/缓存/上下文/会话/限额等)标记为非裸值;
        // thinking 是"进行中"状态词(无自带 label),标记为裸值以便区域标签可作其语义。
        const bare = name === 'thinking';
        pushToRegion(DEFAULT_REGION_MAP[name] ?? 'S', el, bare);
      }
    }

    const segments: string[] = [...prefix];
    for (const group of REGION_ORDER) {
      const region = regions[group];
      if (region.els.length === 0) continue;
      const label = region.firstBare
        ? `${dim(`${regionLabels[group]}: `)}`
        : '';
      segments.push(`${label}${region.els.join(DIM_SEPARATOR)}`);
    }
    // Return a single joined line (or an empty array) so the caller's
    // array contract (`elements.join(...)`) is preserved.
    return segments.length > 0 ? [segments.join(REGION_SEPARATOR)] : [];
  }

  /** Collect detail lines in layout order.
   *  Also picks up inline elements moved to the detail group —
   *  they become individual detail lines when placed here. */
  function collectDetailLines(order: string[]): string[] {
    const result: string[] = [];
    for (const name of order) {
      const lines = renderedDetail.get(name);
      if (lines) result.push(...lines);
      // Inline elements moved to the detail group render as detail lines
      if (!lines) {
        const inline = rendered.get(name);
        if (inline) result.push(inline);
      }
    }
    return result;
  }

  const gitElements = collectInline(effectiveLayout.line1);
  const elements = enableGrouping
    ? collectInlineWithRegions(effectiveLayout.main)
    : collectInline(effectiveLayout.main);

  // Detail lines from the detail group layout order.
  // Elements like 'agents' appear in both main (inline) and detail (detail lines),
  // preserving legacy ordering: missionBoard, agents detail, contextWarning, todos.
  const detailLines = collectDetailLines(effectiveLayout.detail);

  // Compose output
  const outputLines: string[] = [];
  const gitInfoLine =
    gitElements.length > 0 ? gitElements.join(dim(PLAIN_SEPARATOR)) : null;
  const headerLine =
    elements.length > 0 ? elements.join(dim(PLAIN_SEPARATOR)) : null;

  const gitPosition = config.elements.gitInfoPosition ?? "above";

  if (gitPosition === "above") {
    if (gitInfoLine) {
      outputLines.push(gitInfoLine);
    }
    if (headerLine) {
      outputLines.push(headerLine);
    }
  } else {
    if (headerLine) {
      outputLines.push(headerLine);
    }
    if (gitInfoLine) {
      outputLines.push(gitInfoLine);
    }
  }

  const widthAdjustedLines = applyMaxWidthByMode(
    [...outputLines, ...detailLines],
    config.maxWidth,
    config.wrapMode,
  );

  // Narrow terminal: prioritize detail lines so warnings/agents/todos
  // are preserved even when the main line consumes the line budget (B-6, P1-14).
  const isNarrowTerminal =
    config.maxWidth != null && config.maxWidth > 0 && config.maxWidth < NARROW_TERMINAL_THRESHOLD;
  let limitedLines: string[];
  if (isNarrowTerminal && detailLines.length > 0 && config.elements.maxOutputLines > 1) {
    const mainAdjusted = applyMaxWidthByMode(outputLines, config.maxWidth, config.wrapMode);
    const detailAdjusted = applyMaxWidthByMode(detailLines, config.maxWidth, config.wrapMode);
    const detailBudget = Math.min(detailAdjusted.length, Math.ceil(config.elements.maxOutputLines / 2));
    const mainBudget = config.elements.maxOutputLines - detailBudget;
    const mainSlice = mainAdjusted.slice(0, mainBudget);
    const detailSlice = detailAdjusted.slice(0, detailBudget);
    const droppedCount = (mainAdjusted.length - mainSlice.length)
      + (detailAdjusted.length - detailSlice.length);
    if (droppedCount > 0) {
      // Replace last line with truncation indicator to preserve line budget
      const allLines = [...mainSlice, ...detailSlice];
      limitedLines = [
        ...allLines.slice(0, allLines.length - 1),
        `... (+${droppedCount + 1} lines)`,
      ];
    } else {
      limitedLines = [...mainSlice, ...detailSlice];
    }
  } else {
    limitedLines = limitOutputLines(widthAdjustedLines, config.elements.maxOutputLines);
  }

  // Ensure line-limit indicator and all other lines still respect maxWidth.
  const finalLines =
    config.maxWidth && config.maxWidth > 0
      ? limitedLines.map((line) =>
          truncateLineToMaxWidth(line, config.maxWidth!),
        )
      : limitedLines;

  return finalLines.join("\n");
}
