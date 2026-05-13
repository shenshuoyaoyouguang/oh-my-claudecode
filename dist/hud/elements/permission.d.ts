/**
 * OMC HUD - Permission Status Element
 *
 * Renders heuristic-based permission pending indicator.
 */
import type { PendingPermission, HudLabels } from '../types.js';
/**
 * Render permission pending indicator.
 *
 * Format: APPROVE? edit:filename.ts
 */
export declare function renderPermission(pending: PendingPermission | null, labels?: HudLabels): string | null;
//# sourceMappingURL=permission.d.ts.map