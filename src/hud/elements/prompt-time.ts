/**
 * OMC HUD - Prompt Time Element
 *
 * Renders elapsed time since the last user prompt submission.
 * Recorded by the keyword-detector hook on UserPromptSubmit.
 */

import { dim } from '../colors.js';

/**
 * Format elapsed milliseconds as human-readable duration.
 * < 60s  → 13s
 * < 1h   → 1m23s
 * >= 1h  → 2h3m
 */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m${totalSeconds % 60}s`;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}h${totalMinutes % 60}m`;
}

/**
 * Render elapsed time since prompt submission.
 * 标签语法统一（P0-2 / P2-06）：⏱13s → prompt:13s，消除与 session:45m 的"双时间无标签"歧义。
 *
 * Format: prompt:13s  or  prompt:1m23s  or  prompt:2h3m
 * Falls back to HH:MM:SS timestamp if now is not provided.
 */
export function renderPromptTime(promptTime: Date | null, now?: Date): string | null {
  if (!promptTime) return null;

  if (now) {
    const elapsed = now.getTime() - promptTime.getTime();
    if (elapsed >= 0) {
      return `${dim('prompt:')}${formatElapsed(elapsed)}`;
    }
  }

  const hours = String(promptTime.getHours()).padStart(2, '0');
  const minutes = String(promptTime.getMinutes()).padStart(2, '0');
  const seconds = String(promptTime.getSeconds()).padStart(2, '0');

  return `${dim('prompt:')}${hours}:${minutes}:${seconds}`;
}
