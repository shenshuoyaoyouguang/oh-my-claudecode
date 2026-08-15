/**
 * OMC HUD - ANSI Color Utilities
 *
 * 全新色彩系统「Aurora 光谱语义」v2（2026-08-15，UiDesigner 像素君）
 *
 * 设计理念：告别"红绿灯三档"，升级为五维光谱语义：
 *   1. 状态光谱（暖系）  —— 表达健康度：ok → notice → warn → critical
 *   2. 活动光谱（品红）  —— 表达"正在运行"：thinking / autopilot / 进行中
 *   3. 档位光谱（冷系）  —— 表达模型能力：opus / sonnet / haiku
 *   4. 进度光谱          —— 表达完成度（非危险语义）
 *   5. 字体分层          —— label(默认) / value(语义色) / emphasis(bold)
 *
 * 关键规则（延续 R-COLOR-1 色相不相交）：
 *   - 状态色相组（暖）与档位色相组（冷）不相交
 *   - 活动色相（品红）独立于状态/档位
 *   - 标签永远 dim/默认，值才着色；每值至多一色
 *   - critical 值使用 bold+red 双信号（R-WEIGHT-1 白名单第 3 条）
 */

// ANSI escape codes
export const RESET = '\x1b[0m';
export const DIM = '\x1b[2m';
export const BOLD = '\x1b[1m';
export const RED = '\x1b[31m';
export const GREEN = '\x1b[32m';
export const YELLOW = '\x1b[33m';
export const BLUE = '\x1b[34m';
export const MAGENTA = '\x1b[35m';
export const CYAN = '\x1b[36m';
export const WHITE = '\x1b[37m';
export const BRIGHT_BLUE = '\x1b[94m';
export const BRIGHT_MAGENTA = '\x1b[95m';
export const BRIGHT_CYAN = '\x1b[96m';

// ============================================================================
// 语义色令牌表（单一来源，供全 HUD 消费）
// ============================================================================

/**
 * 状态光谱（暖系）：健康度五档。
 * - ok:       正常（GREEN）
 * - notice:   有变化但安全（BRIGHT_CYAN）—— stale、次要信息、新数据
 * - warn:     警告（YELLOW）
 * - critical: 临界（RED），值渲染时叠加 BOLD 双信号
 */
export const STATUS = {
  ok: GREEN,
  notice: BRIGHT_CYAN,
  warn: YELLOW,
  critical: RED,
} as const;

/**
 * 活动光谱（品红系）：表达"正在进行"的智能活动。
 * - running:  进行中（thinking / autopilot / agents 活跃）
 * - done:     完成（回到状态绿）
 * - failed:   失败（回到状态红）
 */
export const ACTIVITY = {
  running: MAGENTA,
  done: GREEN,
  failed: RED,
} as const;

/**
 * 档位光谱（冷系）：模型能力档位（与状态暖系不相交）。
 * - opus:   高能力（BRIGHT_BLUE）
 * - sonnet: 标准（BLUE）
 * - haiku:  轻量（CYAN）
 * - unknown: 未知（WHITE）—— 明亮中性默认前景，替代暗灰 DIM，
 *            使 DeepSeek/GPT/Qwen 等非 Claude 外部模型名清晰可读
 */
export const TIER = {
  opus: BRIGHT_BLUE,
  sonnet: BLUE,
  haiku: CYAN,
  unknown: WHITE,
} as const;

/**
 * 进度光谱：表达完成度，不使用状态黄（R-THRESH-2）。
 * - good:   ≥80%（GREEN）
 * - partial: 1-79%（CYAN）
 * - empty:  0（DIM）
 */
export const PROGRESS = {
  good: GREEN,
  partial: CYAN,
  empty: DIM,
} as const;

/**
 * 字体分层（R-WEIGHT-1）：
 * - label:  标签用 DIM
 * - value:  值用语义色（由调用方选择）
 * - emphasis: 仅三类白名单（update 提醒 / warning banner 标题 / critical 值）
 */
export const FONT = {
  label: DIM,
  emphasis: BOLD,
  brand: '', // [OMC] 默认前景，无彩色非 bold
} as const;

// ============================================================================
// 兼容导出（保留旧 API 以避免破坏既有调用点）
// ============================================================================

// 修饰
export const dim = (text: string): string => `${DIM}${text}${RESET}`;
export const bold = (text: string): string => `${BOLD}${text}${RESET}`;
export const white = (text: string): string => `${WHITE}${text}${RESET}`;

// 状态色函数
export function green(text: string): string {
  return `${GREEN}${text}${RESET}`;
}
export function yellow(text: string): string {
  return `${YELLOW}${text}${RESET}`;
}
export function red(text: string): string {
  return `${RED}${text}${RESET}`;
}
export function cyan(text: string): string {
  return `${CYAN}${text}${RESET}`;
}
export function magenta(text: string): string {
  return `${MAGENTA}${text}${RESET}`;
}
export function blue(text: string): string {
  return `${BLUE}${text}${RESET}`;
}
export function brightCyan(text: string): string {
  return `${BRIGHT_CYAN}${text}${RESET}`;
}
export function brightMagenta(text: string): string {
  return `${BRIGHT_MAGENTA}${text}${RESET}`;
}
export function brightBlue(text: string): string {
  return `${BRIGHT_BLUE}${text}${RESET}`;
}

// ============================================================================
// 语义函数（v2 新增，推荐优先使用）
// ============================================================================

/** notice：有新变化但安全（stale、次要信息、新数据） */
export function notice(text: string): string {
  return `${STATUS.notice}${text}${RESET}`;
}

/** activity：正在进行中的智能活动（thinking / autopilot） */
export function activity(text: string): string {
  return `${ACTIVITY.running}${text}${RESET}`;
}

/** critical 双信号：bold + red（R-WEIGHT-1 白名单第 3 条） */
export function critical(text: string): string {
  return `${BOLD}${RED}${text}${RESET}`;
}

// ============================================================================
// 阈值与取色（单一来源）
// ============================================================================

/**
 * 统一百分比阈值（设计令牌 THRESHOLDS.percent，见 docs/design/hud-ui-review.md §2.2）。
 * 所有"越满越危险"的百分比仪表（context / rate limits / cost / payload）共用同一套，
 * 消灭 P1-07"同数值、不同色"。
 */
export const PERCENT_WARN = 70;
export const PERCENT_CRITICAL = 90;

/**
 * 五档状态光谱取色（v2）：
 * - ≥90% critical（RED）
 * - ≥70% warn（YELLOW）
 * - ≥30% notice（BRIGHT_CYAN）—— 新增中档，表达"已有一定占用但尚安全"
 * - <30%  ok（GREEN）
 * 返回 ANSI 码，值渲染层可叠加 BOLD 双信号。
 */
export function getStateColor(percent: number): string {
  if (percent >= PERCENT_CRITICAL) return STATUS.critical;
  if (percent >= PERCENT_WARN) return STATUS.warn;
  if (percent >= 30) return STATUS.notice;
  return STATUS.ok;
}

/**
 * Get color code based on context window percentage.
 * critical 阈值 85→90，与 rate limits 对齐（P0-1 / P1-07）。
 * v2：改用五档光谱 getStateColor。
 */
export function getContextColor(percent: number): string {
  return getStateColor(percent);
}

/**
 * Get color code based on ralph iteration.
 */
export function getRalphColor(iteration: number, maxIterations: number): string {
  const warningThreshold = Math.floor(maxIterations * 0.7);
  const criticalThreshold = Math.floor(maxIterations * 0.9);

  if (iteration >= criticalThreshold) return RED;
  if (iteration >= warningThreshold) return YELLOW;
  return GREEN;
}

/**
 * Get color for todo progress.
 * 进度色 ≠ 危险色（R-THRESH-2）：进度只表达"完成度"，不使用状态黄。
 * ≥80% GREEN / ≥1% CYAN / 0 DIM。
 */
export function getTodoColor(completed: number, total: number): string {
  if (total === 0) return DIM;
  const percent = (completed / total) * 100;
  if (percent >= 80) return GREEN;
  if (percent >= 1) return CYAN;
  return DIM;
}

// ============================================================================
// Model Tier Colors (for agent visualization)
// ============================================================================

/**
 * Get color for model tier.
 * 档位色与状态色色相不相交（R-COLOR-1，P0-1 / P1-08）：
 * - Opus: Bright Blue (高能力)   — 原 Magenta（在部分终端近似红）
 * - Sonnet: Blue (标准)          — 原 Yellow（与状态警告色冲突）
 * - Haiku: Cyan (轻量)           — 原 Green（与状态健康色冲突）
 * - 未知: White（明亮中性，避免外部/未知模型名落回暗灰不可读）
 */
export function getModelTierColor(model: string | undefined): string {
  if (!model) return TIER.unknown; // Default/unknown
  const tier = model.toLowerCase();
  if (tier.includes('opus')) return TIER.opus;
  if (tier.includes('sonnet')) return TIER.sonnet;
  if (tier.includes('haiku')) return TIER.haiku;
  return TIER.unknown; // Unknown model
}

/**
 * Get color for agent duration (warning/alert).
 * - <2min: normal (green)
 * - 2-5min: warning (yellow)
 * - >5min: alert (red)
 */
export function getDurationColor(durationMs: number): string {
  const minutes = durationMs / 60000;
  if (minutes >= 5) return RED;
  if (minutes >= 2) return YELLOW;
  return GREEN;
}

// ============================================================================
// Progress Bars
// ============================================================================

/**
 * Create a colored progress bar.
 */
export function coloredBar(percent: number, width: number = 10): string {
  const safeWidth = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0;
  const safePercent = Number.isFinite(percent)
    ? Math.min(100, Math.max(0, percent))
    : 0;

  const filled = Math.round((safePercent / 100) * safeWidth);
  const empty = safeWidth - filled;

  const color = getContextColor(safePercent);
  return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
}

/**
 * Create a simple numeric display with color.
 */
export function coloredValue(
  value: number,
  total: number,
  getColor: (value: number, total: number) => string
): string {
  const color = getColor(value, total);
  return `${color}${value}/${total}${RESET}`;
}
