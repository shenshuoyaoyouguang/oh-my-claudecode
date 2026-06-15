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
export declare const RESET = "\u001B[0m";
declare const APPLE_GREEN = "\u001B[38;2;48;209;88m";
declare const APPLE_YELLOW = "\u001B[38;2;255;214;10m";
declare const APPLE_ORANGE = "\u001B[38;2;255;159;10m";
declare const APPLE_RED = "\u001B[38;2;255;69;58m";
declare const APPLE_BLUE = "\u001B[38;2;10;132;255m";
declare const APPLE_PURPLE = "\u001B[38;2;191;90;242m";
declare const APPLE_CYAN = "\u001B[38;2;100;210;255m";
declare const APPLE_GRAY = "\u001B[38;2;152;152;157m";
declare const APPLE_TEAL = "\u001B[38;2;108;204;192m";
export declare function appleGreen(text: string): string;
export declare function appleYellow(text: string): string;
export declare function appleOrange(text: string): string;
export declare function appleRed(text: string): string;
export declare function appleBlue(text: string): string;
export declare function applePurple(text: string): string;
export declare function appleCyan(text: string): string;
export declare function appleGray(text: string): string;
export declare function appleTeal(text: string): string;
export { APPLE_GREEN, APPLE_YELLOW, APPLE_ORANGE, APPLE_RED, APPLE_BLUE, APPLE_PURPLE, APPLE_CYAN, APPLE_GRAY, APPLE_TEAL };
/**
 * Semantic color names — describe the MEANING of a color, not its appearance.
 * Element-level code uses these names; the ThemeColors palette resolves them
 * to actual ANSI escape codes based on the active preset.
 */
export type SemanticColor = 'success' | 'warning' | 'error' | 'info' | 'muted' | 'accent';
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
export declare function resolveThemeColor(semantic: SemanticColor, preset: string): string;
/**
 * Create a ThemeColors object for a given preset.
 * Falls back to focused (Apple) palette for unknown presets.
 * Cached for performance — called once per render cycle.
 */
export declare function resolveThemeColors(preset: string): ThemeColors;
/**
 * Per-preset color palettes. Each preset maps semantic color names
 * to actual ANSI escape codes (24-bit true color or standard ANSI).
 */
export declare const PRESET_THEME_COLORS: Record<string, ThemeColors>;
export declare function green(text: string): string;
export declare function yellow(text: string): string;
export declare function red(text: string): string;
export declare function cyan(text: string): string;
export declare function magenta(text: string): string;
export declare function blue(text: string): string;
export declare function dim(text: string): string;
export declare function bold(text: string): string;
export declare function white(text: string): string;
export declare function brightCyan(text: string): string;
export declare function brightMagenta(text: string): string;
export declare function brightBlue(text: string): string;
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
export declare function thresholdColor(value: number, warningThreshold: number, criticalThreshold: number, theme: ThemeColors): string;
/**
 * Get color code based on context window percentage.
 * @deprecated Prefer thresholdColor() with a ThemeColors palette.
 */
export declare function getContextColor(percent: number): string;
/**
 * Get color code based on ralph iteration.
 * @deprecated Prefer thresholdColor() with a ThemeColors palette.
 */
export declare function getRalphColor(iteration: number, maxIterations: number): string;
/**
 * Get color for todo progress.
 * @deprecated Use thresholdColor() with a ThemeColors palette and todo-specific thresholds.
 */
export declare function getTodoColor(completed: number, total: number): string;
/**
 * Get color for model tier.
 * - Opus: Magenta (high-powered)
 * - Sonnet: Yellow (standard)
 * - Haiku: Green (lightweight)
 */
export declare function getModelTierColor(model: string | undefined): string;
/**
 * Get color for agent duration (warning/alert).
 * - <2min: normal (green)
 * - 2-5min: warning (yellow)
 * - >5min: alert (red)
 */
export declare function getDurationColor(durationMs: number): string;
/**
 * Progress bar character sets.
 */
export type ProgressBarStyle = 'block' | 'smooth' | 'dot';
/**
 * Create a colored progress bar with theme-aware threshold coloring.
 *
 * @param percent - Fill percentage (0-100)
 * @param width - Bar width in columns (default 10)
 * @param style - Bar character style (default 'block')
 * @param theme - ThemeColors palette for threshold coloring (defaults to standard ANSI)
 */
export declare function coloredBar(percent: number, width?: number, style?: ProgressBarStyle, theme?: ThemeColors): string;
/**
 * Create a simple numeric display with color.
 */
export declare function coloredValue(value: number, total: number, getColor: (value: number, total: number) => string): string;
//# sourceMappingURL=colors.d.ts.map