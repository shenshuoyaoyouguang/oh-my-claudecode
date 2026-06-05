/**
 * OMC HUD - ANSI Color Utilities
 *
 * Terminal color codes for statusline rendering.
 * Based on claude-hud reference implementation.
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
 * Get color code based on context window percentage.
 */
export declare function getContextColor(percent: number): string;
/**
 * Get color code based on ralph iteration.
 */
export declare function getRalphColor(iteration: number, maxIterations: number): string;
/**
 * Get color for todo progress.
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
 * Create a colored progress bar.
 */
export declare function coloredBar(percent: number, width?: number): string;
/**
 * Create a simple numeric display with color.
 */
export declare function coloredValue(value: number, total: number, getColor: (value: number, total: number) => string): string;
//# sourceMappingURL=colors.d.ts.map