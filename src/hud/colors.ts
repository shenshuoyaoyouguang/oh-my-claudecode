/**
 * OMC HUD - ANSI Color Utilities
 *
 * Terminal color codes for statusline rendering.
 * Based on claude-hud reference implementation.
 *
 * Apple Terminal palette uses 24-bit true color (ESC[38;2;R;G;Bm)
 * for precise color matching to Apple's design system.
 */

// ANSI escape codes
export const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';
const BRIGHT_BLUE = '\x1b[94m';
const BRIGHT_MAGENTA = '\x1b[95m';
const BRIGHT_CYAN = '\x1b[96m';

// ── Apple Terminal true-color palette ─────────────────────────────
const APPLE_GREEN     = '\x1b[38;2;48;209;88m';    // #30D158
const APPLE_YELLOW    = '\x1b[38;2;255;214;10m';   // #FFD60A
const APPLE_ORANGE    = '\x1b[38;2;255;159;10m';   // #FF9F0A
const APPLE_RED       = '\x1b[38;2;255;69;58m';    // #FF453A
const APPLE_BLUE      = '\x1b[38;2;10;132;255m';   // #0A84FF
const APPLE_PURPLE    = '\x1b[38;2;191;90;242m';   // #BF5AF2
const APPLE_CYAN      = '\x1b[38;2;100;210;255m';  // #64D2FF
const APPLE_GRAY      = '\x1b[38;2;152;152;157m';  // #98989D
const APPLE_TEAL      = '\x1b[38;2;108;204;192m';  // #6CCCC0

// Apple color functions
export function appleGreen(text: string): string  { return `${APPLE_GREEN}${text}${RESET}`; }
export function appleYellow(text: string): string { return `${APPLE_YELLOW}${text}${RESET}`; }
export function appleOrange(text: string): string { return `${APPLE_ORANGE}${text}${RESET}`; }
export function appleRed(text: string): string    { return `${APPLE_RED}${text}${RESET}`; }
export function appleBlue(text: string): string   { return `${APPLE_BLUE}${text}${RESET}`; }
export function applePurple(text: string): string { return `${APPLE_PURPLE}${text}${RESET}`; }
export function appleCyan(text: string): string   { return `${APPLE_CYAN}${text}${RESET}`; }
export function appleGray(text: string): string   { return `${APPLE_GRAY}${text}${RESET}`; }
export function appleTeal(text: string): string   { return `${APPLE_TEAL}${text}${RESET}`; }

export { APPLE_GREEN, APPLE_YELLOW, APPLE_ORANGE, APPLE_RED, APPLE_BLUE, APPLE_PURPLE, APPLE_CYAN, APPLE_GRAY, APPLE_TEAL };

// ============================================================================
// Color Functions
// ============================================================================

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

export function dim(text: string): string {
  return `${DIM}${text}${RESET}`;
}

export function bold(text: string): string {
  return `${BOLD}${text}${RESET}`;
}

export function white(text: string): string {
  return `${WHITE}${text}${RESET}`;
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
// Threshold-based Colors
// ============================================================================

/**
 * Get color code based on context window percentage.
 */
export function getContextColor(percent: number): string {
  if (percent >= 85) return RED;
  if (percent >= 70) return YELLOW;
  return GREEN;
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
 */
export function getTodoColor(completed: number, total: number): string {
  if (total === 0) return DIM;
  const percent = (completed / total) * 100;
  if (percent >= 80) return GREEN;
  if (percent >= 50) return YELLOW;
  return CYAN;
}

// ============================================================================
// Model Tier Colors (for agent visualization)
// ============================================================================

/**
 * Get color for model tier.
 * - Opus: Magenta (high-powered)
 * - Sonnet: Yellow (standard)
 * - Haiku: Green (lightweight)
 */
export function getModelTierColor(model: string | undefined): string {
  if (!model) return CYAN; // Default/unknown
  const tier = model.toLowerCase();
  if (tier.includes('opus')) return MAGENTA;
  if (tier.includes('sonnet')) return YELLOW;
  if (tier.includes('haiku')) return GREEN;
  return CYAN; // Unknown model
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
