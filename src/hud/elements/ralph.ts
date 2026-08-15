/**
 * OMC HUD - Ralph Element
 *
 * Renders Ralph loop iteration display.
 */

import type { RalphStateForHud, HudLabels, HudThresholds } from '../types.js';
import { DEFAULT_HUD_LABELS } from '../types.js';
import { RESET, STATUS } from '../colors.js';

/**
 * Render Ralph loop state.
 * Returns null if ralph is not active.
 *
 * Format: ralph:3/10
 */
export function renderRalph(
  state: RalphStateForHud | null,
  thresholds: HudThresholds,
  labels: Pick<HudLabels, 'ralph'> = DEFAULT_HUD_LABELS,
): string | null {
  if (!state?.active) {
    return null;
  }

  const { iteration, maxIterations } = state;
  const warningThreshold = thresholds.ralphWarning;
  const criticalThreshold = Math.floor(maxIterations * 0.9);

  let color: string;
  if (iteration >= criticalThreshold) {
    color = STATUS.critical;
  } else if (iteration >= warningThreshold) {
    color = STATUS.warn;
  } else {
    color = STATUS.ok;
  }

  return `${labels.ralph}:${color}${iteration}/${maxIterations}${RESET}`;
}
