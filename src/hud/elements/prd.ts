/**
 * OMC HUD - PRD Element
 *
 * Renders current PRD story display.
 */

import type { PrdStateForHud } from '../types.js';
import { RESET, dim, STATUS, PROGRESS } from '../colors.js';

/**
 * Render current PRD story.
 * Returns null if no PRD is active.
 *
 * Format: PRD:US-002  （P0-2：裸 US-002 加 PRD: 前缀，避免误读为版本号/分支名）
 */
export function renderPrd(state: PrdStateForHud | null): string | null {
  if (!state) {
    return null;
  }

  const { currentStoryId, completed, total } = state;

  // If all complete, show completion
  if (completed === total) {
    return `${STATUS.ok}PRD:done${RESET}`;
  }

  // Show current story ID
  if (currentStoryId) {
    return `${dim('PRD:')}${PROGRESS.partial}${currentStoryId}${RESET}`;
  }

  return null;
}

/**
 * Render PRD with progress (for full mode).
 *
 * Format: PRD:US-002 (2/5)
 */
export function renderPrdWithProgress(state: PrdStateForHud | null): string | null {
  if (!state) {
    return null;
  }

  const { currentStoryId, completed, total } = state;

  // If all complete, show completion
  if (completed === total) {
    return `${STATUS.ok}PRD:${completed}/${total} done${RESET}`;
  }

  // Show current story with progress
  if (currentStoryId) {
    return `${dim('PRD:')}${PROGRESS.partial}${currentStoryId}${RESET} ${dim(`(${completed}/${total})`)}`;
  }

  // No current story but PRD exists
  return `${dim(`PRD:${completed}/${total}`)}`;
}
