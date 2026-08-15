/**
 * OMC HUD - Background Tasks Element
 *
 * Renders background task count display.
 */

import type { BackgroundTask, HudLabels } from '../types.js';
import { DEFAULT_HUD_LABELS, MAX_BACKGROUND_CONCURRENT } from '../types.js';
import { RESET, PROGRESS, DIM } from '../colors.js';
import { truncateToWidth } from '../../utils/string-width.js';

/**
 * Render background task count.
 * Returns null if no tasks are running.
 *
 * Format: bg:3/5
 */
export function renderBackground(
  tasks: BackgroundTask[],
  labels: Pick<HudLabels, 'background'> = DEFAULT_HUD_LABELS,
): string | null {
  const running = tasks.filter((t) => t.status === 'running').length;

  if (running === 0) {
    return null;
  }

  // 容量/进度色（R-THRESH-2，P0-1）：满=GREEN、近满=CYAN、有余=DIM —— 不表达"危险"，不使用状态黄
  let color: string;
  if (running >= MAX_BACKGROUND_CONCURRENT) {
    color = PROGRESS.good; // At capacity
  } else if (running >= MAX_BACKGROUND_CONCURRENT - 1) {
    color = PROGRESS.partial; // Near capacity
  } else {
    color = PROGRESS.empty; // Plenty of room
  }

  return `${labels.background}:${color}${running}/${MAX_BACKGROUND_CONCURRENT}${RESET}`;
}

/**
 * Render background tasks with descriptions (for full mode).
 *
 * Format: bg:3/5 [explore,architect,...]
 */
export function renderBackgroundDetailed(
  tasks: BackgroundTask[],
  labels: Pick<HudLabels, 'background'> = DEFAULT_HUD_LABELS,
): string | null {
  const running = tasks.filter((t) => t.status === 'running');

  if (running.length === 0) {
    return null;
  }

  // 容量/进度色（R-THRESH-2，P0-1）：满=GREEN、近满=CYAN、有余=DIM
  let color: string;
  if (running.length >= MAX_BACKGROUND_CONCURRENT) {
    color = PROGRESS.good;
  } else if (running.length >= MAX_BACKGROUND_CONCURRENT - 1) {
    color = PROGRESS.partial;
  } else {
    color = PROGRESS.empty;
  }

  // Get short descriptions
  const descriptions = running.slice(0, 3).map((t) => {
    // Extract agent type short name if available
    if (t.agentType) {
      const parts = t.agentType.split(':');
      return parts[parts.length - 1];
    }
    // Otherwise use truncated description (CJK-aware)
    return truncateToWidth(t.description, 8, '');
  });

  const suffix = running.length > 3 ? ',+' + (running.length - 3) : '';
  return `${labels.background}:${color}${running.length}/${MAX_BACKGROUND_CONCURRENT}${RESET} ${DIM}[${descriptions.join(',')}${suffix}]${RESET}`;
}
