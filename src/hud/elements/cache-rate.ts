/**
 * OMC HUD - Cache Hit Rate Element
 *
 * Renders the prompt-cache hit rate from stdin context_window.current_usage
 * (cache_read / (input + cache_creation + cache_read)). High hit rates mean
 * most of the context was served from cache — cheaper and faster.
 *
 * Hit rate = cache_read / (input + cache_creation + cache_read).
 * Threshold (user decision): ≥70% → ok (green), <70% → warn (yellow).
 * Renders null when no cache data is present (I3 degrade, never fails).
 */

import type { HudLabels, CacheUsage } from '../types.js';
import { DEFAULT_HUD_LABELS } from '../types.js';
import { STATUS, DIM, RESET } from '../colors.js';

// Re-export so existing importers (e.g. tests) can still source CacheUsage
// from this module while the canonical definition lives in types.ts.
export type { CacheUsage };

/** Cache hit rate threshold: ≥ this percent renders green (user decision, 70%). */
export const CACHE_RATE_OK_THRESHOLD = 70;

/**
 * Compute cache hit rate percent (0-100). Returns null when there is no
 * cache traffic at all (nothing read, nothing written) — the element stays
 * hidden, consistent with getCacheUsage()'s null filtering in stdin.ts.
 */
export function computeCacheHitRate(usage: CacheUsage | null | undefined): number | null {
  if (!usage) return null;
  if (usage.cacheReadInputTokens <= 0 && usage.cacheCreationInputTokens <= 0) {
    return null;
  }
  const total =
    usage.inputTokens + usage.cacheCreationInputTokens + usage.cacheReadInputTokens;
  if (!Number.isFinite(total) || total <= 0) return null;
  const rate = (usage.cacheReadInputTokens / total) * 100;
  return Math.min(100, Math.max(0, Math.round(rate)));
}

/**
 * Render cache hit rate.
 *
 * Format: cache:92%
 */
export function renderCacheRate(
  usage: CacheUsage | null | undefined,
  labels: Pick<HudLabels, 'cache'> = DEFAULT_HUD_LABELS,
): string | null {
  const rate = computeCacheHitRate(usage);
  if (rate === null) return null;

  const color = rate >= CACHE_RATE_OK_THRESHOLD ? STATUS.ok : STATUS.warn;
  return `${DIM}${labels.cache}:${RESET}${color}${rate}%${RESET}`;
}
