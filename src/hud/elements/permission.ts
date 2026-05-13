/**
 * OMC HUD - Permission Status Element
 *
 * Renders heuristic-based permission pending indicator.
 */

import type { PendingPermission, HudLabels } from '../types.js';
import { DEFAULT_HUD_LABELS } from '../types.js';
import { dim, appleOrange } from '../colors.js';

/**
 * Render permission pending indicator.
 *
 * Format: APPROVE? edit:filename.ts
 */
export function renderPermission(
  pending: PendingPermission | null,
  labels: HudLabels = DEFAULT_HUD_LABELS,
): string | null {
  if (!pending) return null;
  return `${appleOrange(labels.approve)} ${dim(pending.toolName.toLowerCase())}:${pending.targetSummary}`;
}
