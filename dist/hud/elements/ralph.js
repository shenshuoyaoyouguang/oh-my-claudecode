/**
 * OMC HUD - Ralph Element
 *
 * Renders Ralph loop iteration display.
 */
import { DEFAULT_HUD_LABELS } from '../types.js';
import { RESET, APPLE_GREEN, APPLE_ORANGE, APPLE_RED } from '../colors.js';
/**
 * Render Ralph loop state.
 * Returns null if ralph is not active.
 *
 * Format: ralph:3/10
 */
export function renderRalph(state, thresholds, labels = DEFAULT_HUD_LABELS) {
    if (!state?.active) {
        return null;
    }
    const { iteration, maxIterations } = state;
    const warningThreshold = thresholds.ralphWarning;
    const criticalThreshold = Math.floor(maxIterations * 0.9);
    let color;
    if (iteration >= criticalThreshold) {
        color = APPLE_RED;
    }
    else if (iteration >= warningThreshold) {
        color = APPLE_ORANGE;
    }
    else {
        color = APPLE_GREEN;
    }
    return `${labels.ralph}:${color}${iteration}/${maxIterations}${RESET}`;
}
//# sourceMappingURL=ralph.js.map