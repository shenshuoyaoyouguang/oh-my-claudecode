/**
 * OMC HUD - ANSI Color Utilities
 *
 * Terminal color codes for statusline rendering.
 *
 * Two-layer color system:
 * 1. Raw ANSI constants (APPLE_*, standard colors) — direct access for
 *    element-level code that needs specific colors.
 * 2. Semantic color system — preset-bound ThemeColors map semantic names
 *    (success/warning/error/info/muted/accent) to ANSI codes, enabling
 *    per-preset color palettes without touching element code.
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

// ── Catppuccin Mocha true-color palette ──────────────────────────
const CAT_GREEN       = '\x1b[38;2;166;227;161m';  // #A6E3A1 (Green)
const CAT_YELLOW      = '\x1b[38;2;249;226;175m';  // #F9E2AF (Yellow)
const CAT_PEACH       = '\x1b[38;2;250;179;135m';  // #FAB387 (Peach)
const CAT_RED          = '\x1b[38;2;243;139;168m';  // #F38BA8 (Red)
const CAT_BLUE        = '\x1b[38;2;137;180;250m';  // #89B4FA (Blue)
const CAT_MAUVE       = '\x1b[38;2;203;166;247m';  // #CBA6F7 (Mauve)
const CAT_SKY          = '\x1b[38;2;137;220;235m';  // #89DCEB (Sky)
const CAT_OVERLAY0    = '\x1b[38;2;108;112;134m';  // #6C7086 (Overlay0)

// ── Tokyo Night true-color palette ───────────────────────────────
const TOKYO_GREEN     = '\x1b[38;2;158;206;106m';  // #9ECE6A
const TOKYO_YELLOW    = '\x1b[38;2;224;175;104m';  // #E0AF68
const TOKYO_RED       = '\x1b[38;2;247;118;142m';  // #F7768E
const TOKYO_BLUE      = '\x1b[38;2;122;162;247m';  // #7AA2F7
const TOKYO_PURPLE    = '\x1b[38;2;187;154;247m';  // #BB9AF7
const TOKYO_CYAN      = '\x1b[38;2;125;207;255m';  // #7DCFFF
const TOKYO_GRAY      = '\x1b[38;2;86;95;137m';    // #565F89

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
// Semantic Color System
// ============================================================================

/**
 * Semantic color names — describe the MEANING of a color, not its appearance.
 * Element-level code uses these names; the ThemeColors palette resolves them
 * to actual ANSI escape codes based on the active preset.
 */
export type SemanticColor =
  | 'success'   // healthy, normal, done, low-usage
  | 'warning'   // medium threshold, near-capacity
  | 'error'     // critical, high threshold, failure
  | 'info'      // informational labels, git branch, model display
  | 'muted'     // secondary labels, dim text
  | 'accent';   // highlighted labels (skills, team modes)

/**
 * ThemeColors maps each semantic color to its ANSI escape code.
 */
export interface ThemeColors {
  success: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
  accent: string;
}

/**
 * Resolve a semantic color name to its ANSI code for the given preset.
 */
export function resolveThemeColor(semantic: SemanticColor, preset: string): string {
  const palette = PRESET_THEME_COLORS[preset as keyof typeof PRESET_THEME_COLORS];
  return palette ? palette[semantic] : PRESET_THEME_COLORS.focused[semantic];
}

/**
 * Create a ThemeColors object for a given preset.
 * Falls back to focused (Apple) palette for unknown presets.
 * Cached for performance — called once per render cycle.
 */
export function resolveThemeColors(preset: string): ThemeColors {
  return PRESET_THEME_COLORS[preset as keyof typeof PRESET_THEME_COLORS] ?? PRESET_THEME_COLORS.focused;
}

/**
 * Per-preset color palettes. Each preset maps semantic color names
 * to actual ANSI escape codes (24-bit true color or standard ANSI).
 */
export const PRESET_THEME_COLORS: Record<string, ThemeColors> = {
  // focused — Apple Terminal palette (current default, unchanged)
  focused: {
    success: APPLE_GREEN,
    warning: APPLE_ORANGE,
    error:   APPLE_RED,
    info:    APPLE_CYAN,
    muted:   APPLE_GRAY,
    accent:  APPLE_PURPLE,
  },

  // minimal — monochrome grayscale (low visual noise)
  minimal: {
    success: DIM,          // no color, just dim
    warning: WHITE,        // normal brightness for attention
    error:   BOLD + RED,   // bold red for critical states
    info:    DIM,          // subdued informational text
    muted:   DIM,          // secondary labels
    accent:  WHITE,        // normal brightness (no color)
  },

  // full — high-contrast Apple palette (max readability)
  full: {
    success: APPLE_GREEN,
    warning: APPLE_YELLOW,  // brighter yellow for better visibility
    error:   APPLE_RED,
    info:    APPLE_BLUE,    // blue instead of cyan for higher contrast
    muted:   APPLE_GRAY,
    accent:  APPLE_PURPLE,
  },

  // dense — low-saturation, compact-friendly colors
  dense: {
    success: GREEN,          // standard ANSI green (less intense than Apple)
    warning: YELLOW,         // standard ANSI yellow
    error:   RED,            // standard ANSI red
    info:    CYAN,           // standard ANSI cyan
    muted:   DIM,            // dim for secondary text
    accent:  MAGENTA,        // standard ANSI magenta
  },

  // opencode — Apple palette (matches focused for compatibility)
  opencode: {
    success: APPLE_GREEN,
    warning: APPLE_ORANGE,
    error:   APPLE_RED,
    info:    APPLE_CYAN,
    muted:   APPLE_GRAY,
    accent:  APPLE_PURPLE,
  },
};

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
 * Get a color based on a value's position within threshold bands.
 * Uses semantic colors so the output adapts to the active preset palette.
 *
 * @param value - Current value (e.g., percent, count)
 * @param warningThreshold - Value above which warning color kicks in
 * @param criticalThreshold - Value above which error color kicks in
 * @param theme - ThemeColors palette from resolveThemeColors()
 * @returns ANSI color escape code
 */
export function thresholdColor(
  value: number,
  warningThreshold: number,
  criticalThreshold: number,
  theme: ThemeColors,
): string {
  if (value >= criticalThreshold) return theme.error;
  if (value >= warningThreshold) return theme.warning;
  return theme.success;
}

/**
 * Get color code based on context window percentage.
 * @deprecated Prefer thresholdColor() with a ThemeColors palette.
 */
export function getContextColor(percent: number): string {
  if (percent >= 85) return RED;
  if (percent >= 70) return YELLOW;
  return GREEN;
}

/**
 * Get color code based on ralph iteration.
 * @deprecated Prefer thresholdColor() with a ThemeColors palette.
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
 * @deprecated Use thresholdColor() with a ThemeColors palette and todo-specific thresholds.
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
 * Progress bar character sets.
 */
export type ProgressBarStyle = 'block' | 'smooth' | 'dot';
const BAR_CHARS: Record<ProgressBarStyle, { filled: string; empty: string }> = {
  block:  { filled: '█', empty: '░' },
  smooth: { filled: '╺', empty: '╸' }, // half-width smooth — pair forms thin line
  dot:    { filled: '●', empty: '○' },
};

/**
 * Create a colored progress bar with theme-aware threshold coloring.
 *
 * @param percent - Fill percentage (0-100)
 * @param width - Bar width in columns (default 10)
 * @param style - Bar character style (default 'block')
 * @param theme - ThemeColors palette for threshold coloring (defaults to standard ANSI)
 */
export function coloredBar(
  percent: number,
  width: number = 10,
  style: ProgressBarStyle = 'block',
  theme?: ThemeColors,
): string {
  const safeWidth = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0;
  const safePercent = Number.isFinite(percent)
    ? Math.min(100, Math.max(0, percent))
    : 0;

  const filled = Math.round((safePercent / 100) * safeWidth);
  const empty = safeWidth - filled;

  // Use theme-aware threshold coloring when available
  const color = theme
    ? thresholdColor(safePercent, 70, 85, theme)
    : getContextColor(safePercent);

  const chars = BAR_CHARS[style] ?? BAR_CHARS.block;
  return `${color}${chars.filled.repeat(filled)}${DIM}${chars.empty.repeat(empty)}${RESET}`;
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
