/**
 * OMC HUD - Output Sanitizer
 *
 * Sanitizes HUD output to prevent terminal rendering corruption
 * when Claude Code's Ink renderer is concurrently updating the display.
 *
 * Issue #346: Terminal rendering corruption during AI generation with HUD enabled.
 *
 * Root cause: Multi-line output containing ANSI escape sequences and
 * variable-width Unicode characters (progress bar blocks) can interfere
 * with Claude Code's terminal cursor positioning during active rendering.
 *
 * This module provides:
 * - Terminal control sequence stripping (preserving color/style codes)
 * - Unicode block character replacement with ASCII equivalents
 * - Line count enforcement (collapse to single line if needed)
 */

// Matches CSI sequences that are NOT SGR (color/style) codes
// SGR sequences end with 'm' and should be preserved for color output
// Other CSI sequences (cursor movement, clear screen, etc.) should be stripped:
// - H: cursor position, J: erase display, K: erase line
// - A/B/C/D: cursor up/down/forward/back, etc.
// - ?25l/?25h: cursor visibility (private sequences with ? prefix)
const CSI_NON_SGR_REGEX = /\x1b\[\??[0-9;]*[A-LN-Za-ln-z]/g;

// Matches OSC sequences (ESC]...BEL) - operating system commands
const OSC_REGEX = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

// Matches simple escape sequences (ESC + single char, but not [ or ])
const SIMPLE_ESC_REGEX = /\x1b[^[\]]/g;

/**
 * Strip terminal control ANSI sequences while preserving color/style (SGR) codes.
 *
 * SGR (Select Graphic Rendition) sequences end with 'm' and control text appearance:
 * - Colors: \x1b[32m (green), \x1b[31m (red), etc.
 * - Styles: \x1b[1m (bold), \x1b[0m (reset), etc.
 *
 * Other CSI sequences are stripped as they can interfere with terminal rendering:
 * - Cursor positioning: \x1b[H, \x1b[10;20H
 * - Erase commands: \x1b[2J (clear screen), \x1b[K (erase line)
 * - Cursor movement: \x1b[A (up), \x1b[B (down), etc.
 * - Cursor visibility: \x1b[?25l (hide), \x1b[?25h (show)
 */
export function stripAnsi(text: string): string {
  return text
    .replace(CSI_NON_SGR_REGEX, '') // Strip non-SGR CSI sequences
    .replace(OSC_REGEX, '') // Strip OSC sequences
    .replace(SIMPLE_ESC_REGEX, ''); // Strip simple escape sequences
}

/**
 * Unicode → ASCII replacement table for safeMode (R-WIDTH-3, P1-13).
 *
 * Emoji and ambiguous-width characters render at 2 columns in most terminals
 * but safeMode guarantees fixed-width ASCII output. Region separator ╎ (U+257E)
 * is included so safeMode falls back to the element separator |.
 *
 * Block characters (█░▓▒) are intentionally NOT replaced — modern terminals
 * render them at width 1 and replacing them destroys the progress-bar gradient
 * (see Issue #3487 fix note below).
 */
const UNICODE_TO_ASCII: Record<string, string> = {
  '🔧': 'Tl:',  // width 2 → 2 (preserved)
  '🤖': 'Ag:',  // width 2 → 2 (preserved)
  '⚡': 'Sk:',  // width 2 → 2 (preserved)
  '💭': '*',    // width 2 → 1 (narrowed — thinking bubble is decorative)
  '⏱': 't:',    // width 2 → 2 (preserved)
  '╎': '|',     // width 1 → 1 (preserved)
  '⇡': '^',     // width 2 → 1 (narrowed — git ahead, ASCII has no double-width arrow)
  '⇣': 'v',     // width 2 → 1 (narrowed — git behind, ASCII has no double-width arrow)
  '↑': '^',     // width 2 → 1 (narrowed — token input, ASCII has no double-width arrow)
  '↓': 'v',     // width 2 → 1 (narrowed — token output, ASCII has no double-width arrow)
};

/**
 * Replace emoji/ambiguous-width/region-separator Unicode with fixed-width ASCII.
 *
 * Block characters (█, ░, ▓, ▒) are preserved — modern terminals handle them
 * at the correct width and ASCII replacement destroys the progress-bar gradient.
 *
 * Emoji/ambiguous chars (🔧🤖⚡💭⏱⇡⇣↑↓╎) are replaced so safeMode output has
 * deterministic column widths (R-WIDTH-3).
 */
export function replaceUnicodeBlocks(text: string): string {
  if (text.length === 0) return text;
  let result = '';
  for (const char of text) {
    result += UNICODE_TO_ASCII[char] ?? char;
  }
  return result;
}

/**
 * Sanitize HUD output for safe terminal rendering.
 *
 * Processing steps:
 * 1. Strips terminal control sequences while preserving color/style SGR codes
 * 2. Replaces Unicode block characters with ASCII (prevents width miscalculation)
 * 3. Preserves multi-line output (newlines are kept for proper HUD rendering)
 * 4. Trims excessive whitespace within lines
 *
 * Note: Multi-line output is preserved to maintain HUD tree structure display.
 * The original single-line collapse was too aggressive and broke readability.
 *
 * @param output - Raw HUD output (may contain ANSI codes and newlines)
 * @returns Sanitized output safe for concurrent terminal rendering
 */
export function sanitizeOutput(output: string): string {
  // Step 1: Strip terminal control sequences (preserving color/style SGR codes)
  let sanitized = stripAnsi(output);

  // Step 2: Replace variable-width Unicode with ASCII
  sanitized = replaceUnicodeBlocks(sanitized);

  // Step 3: Preserve multi-line output, just trim each line
  // Do NOT collapse to single line - HUD needs proper line breaks for tree display
  const lines = sanitized.split('\n').map(line => line.trimEnd());
  sanitized = lines.join('\n');

  // Step 4: Remove leading/trailing empty lines
  sanitized = sanitized.replace(/^\n+|\n+$/g, '');

  return sanitized;
}
