/**
 * OMC HUD - Permission Status Element
 *
 * Renders heuristic-based permission pending indicator.
 */
import { DEFAULT_HUD_LABELS } from '../types.js';
import { dim, appleOrange } from '../colors.js';
/**
 * Render permission pending indicator.
 *
 * Format: APPROVE? edit:filename.ts
 */
export function renderPermission(pending, labels = DEFAULT_HUD_LABELS) {
    if (!pending)
        return null;
    return `${appleOrange(labels.approve)} ${dim(pending.toolName.toLowerCase())}:${pending.targetSummary}`;
}
//# sourceMappingURL=permission.js.map