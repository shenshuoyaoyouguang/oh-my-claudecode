/**
 * OMC HUD - Thinking Indicator Element
 *
 * Renders extended thinking mode indicator with configurable format.
 */

import type { ThinkingState, ThinkingFormat, HudLabels } from '../types.js';
import { DEFAULT_HUD_LABELS } from '../types.js';
import { activity } from '../colors.js';

/**
 * Render thinking indicator based on format.
 *
 * @param state - Thinking state from transcript
 * @param format - Display format (bubble, brain, face, text)
 * @returns Formatted thinking indicator or null if not active
 */
export function renderThinking(
  state: ThinkingState | null,
  format: ThinkingFormat = 'text',
  labels: Pick<HudLabels, 'thinking'> = DEFAULT_HUD_LABELS,
): string | null {
  if (!state?.active) return null;

  switch (format) {
    case 'bubble':
      return '💭';
    case 'brain':
      return '🧠';
    case 'face':
      return '🤔';
    case 'text':
      // v2：思考中属于"活动光谱"（进行中的智能活动），用品红而非青色
      return activity(labels.thinking);
    default:
      return '💭';
  }
}
