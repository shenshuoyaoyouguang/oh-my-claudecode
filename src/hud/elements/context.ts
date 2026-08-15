/**
 * OMC HUD - Context Element
 *
 * Renders context window usage display.
 */

import type { HudLabels, HudThresholds } from '../types.js';
import { DEFAULT_HUD_LABELS } from '../types.js';
import { RESET, STATUS, DIM } from '../colors.js';

const CONTEXT_DISPLAY_HYSTERESIS = 2;
const CONTEXT_DISPLAY_STATE_TTL_MS = 5_000;

type ContextSeverity = 'normal' | 'warning' | 'compact' | 'critical';

let lastDisplayedPercent: number | null = null;
let lastDisplayedSeverity: ContextSeverity | null = null;
let lastDisplayScope: string | null = null;
let lastDisplayUpdatedAt = 0;

function clampContextPercent(percent: number): number {
  return Math.min(100, Math.max(0, Math.round(percent)));
}

function getContextSeverity(
  safePercent: number,
  thresholds: HudThresholds,
): ContextSeverity {
  if (safePercent >= thresholds.contextCritical) {
    return 'critical';
  }
  if (safePercent >= thresholds.contextCompactSuggestion) {
    return 'compact';
  }
  if (safePercent >= thresholds.contextWarning) {
    return 'warning';
  }
  return 'normal';
}

function getContextDisplayStyle(
  safePercent: number,
  thresholds: HudThresholds,
): { color: string; suffix: string } {
  const severity = getContextSeverity(safePercent, thresholds);

  switch (severity) {
    case 'critical':
      return { color: STATUS.critical, suffix: ' CRITICAL' };
    case 'compact':
      return { color: STATUS.warn, suffix: ' COMPRESS?' };
    case 'warning':
      return { color: STATUS.warn, suffix: '' };
    default:
      // v2 光谱：<warning 阈值内再分 notice（≥30%）与 ok（<30%）
      return safePercent >= 30
        ? { color: STATUS.notice, suffix: '' }
        : { color: STATUS.ok, suffix: '' };
  }
}

/**
 * Reset cached context display state.
 * Useful for test isolation and fresh render sessions.
 */
export function resetContextDisplayState(): void {
  lastDisplayedPercent = null;
  lastDisplayedSeverity = null;
  lastDisplayScope = null;
  lastDisplayUpdatedAt = 0;
}

/**
 * Apply display-layer hysteresis so small refresh-to-refresh ctx fluctuations
 * do not visibly jitter in the HUD.
 */
export function getStableContextDisplayPercent(
  percent: number,
  thresholds: HudThresholds,
  displayScope?: string | null,
): number {
  const safePercent = clampContextPercent(percent);
  const severity = getContextSeverity(safePercent, thresholds);
  const nextScope = displayScope ?? null;
  const now = Date.now();

  if (nextScope !== lastDisplayScope) {
    lastDisplayedPercent = null;
    lastDisplayedSeverity = null;
    lastDisplayScope = nextScope;
  }

  if (
    lastDisplayedPercent === null
    || lastDisplayedSeverity === null
    || now - lastDisplayUpdatedAt > CONTEXT_DISPLAY_STATE_TTL_MS
  ) {
    lastDisplayedPercent = safePercent;
    lastDisplayedSeverity = severity;
    lastDisplayUpdatedAt = now;
    return safePercent;
  }

  if (severity !== lastDisplayedSeverity) {
    lastDisplayedPercent = safePercent;
    lastDisplayedSeverity = severity;
    lastDisplayUpdatedAt = now;
    return safePercent;
  }

  if (Math.abs(safePercent - lastDisplayedPercent) <= CONTEXT_DISPLAY_HYSTERESIS) {
    lastDisplayUpdatedAt = now;
    return lastDisplayedPercent;
  }

  lastDisplayedPercent = safePercent;
  lastDisplayedSeverity = severity;
  lastDisplayUpdatedAt = now;
  return safePercent;
}

/**
 * Render context window percentage.
 *
 * Format: ctx:67%
 */
export function renderContext(
  percent: number,
  thresholds: HudThresholds,
  displayScope?: string | null,
  labels: Pick<HudLabels, 'context'> = DEFAULT_HUD_LABELS,
): string | null {
  const safePercent = getStableContextDisplayPercent(percent, thresholds, displayScope);
  const { color, suffix } = getContextDisplayStyle(safePercent, thresholds);

  return `${labels.context}:${color}${safePercent}%${suffix}${RESET}`;
}

/**
 * Render context window with visual bar.
 *
 * Format: ctx:[████░░░░░░]67%
 */
export function renderContextWithBar(
  percent: number,
  thresholds: HudThresholds,
  barWidth: number = 10,
  displayScope?: string | null,
  labels: Pick<HudLabels, 'context'> = DEFAULT_HUD_LABELS,
): string | null {
  const safePercent = getStableContextDisplayPercent(percent, thresholds, displayScope);
  const filled = Math.round((safePercent / 100) * barWidth);
  const empty = barWidth - filled;

  const { color, suffix } = getContextDisplayStyle(safePercent, thresholds);
  const bar = `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
  return `${labels.context}:[${bar}]${color}${safePercent}%${suffix}${RESET}`;
}
