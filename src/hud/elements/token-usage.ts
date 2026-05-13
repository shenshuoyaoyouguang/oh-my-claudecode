/**
 * OMC HUD - Token Usage Element
 *
 * Renders last-request input/output token usage from transcript metadata.
 */

import type { HudLabels, HudLocale, LastRequestTokenUsage, TokenFormat } from '../types.js';
import { DEFAULT_HUD_LABELS } from '../types.js';
import { formatTokenCount } from '../../cli/utils/formatting.js';

export function renderTokenUsage(
  usage: LastRequestTokenUsage | null | undefined,
  sessionTotalTokens?: number | null,
  labels: HudLabels = DEFAULT_HUD_LABELS,
  locale?: HudLocale,
  tokenFormat: TokenFormat = 'detailed',
): string | null {
  if (!usage) return null;

  const hasUsage = usage.inputTokens > 0 || usage.outputTokens > 0;
  if (!hasUsage) return null;

  // 'total' mode: show only session total
  if (tokenFormat === 'total' && sessionTotalTokens && sessionTotalTokens > 0) {
    return `${labels.tokens}:${formatTokenCount(sessionTotalTokens, locale)}`;
  }

  const parts = [
    `${labels.tokens}:${labels.tokenInput}${formatTokenCount(usage.inputTokens, locale)}/${labels.tokenOutput}${formatTokenCount(usage.outputTokens, locale)}`,
  ];

  if (usage.reasoningTokens && usage.reasoningTokens > 0) {
    parts.push(`${labels.tokenReasoning}${formatTokenCount(usage.reasoningTokens, locale)}`);
  }

  if (sessionTotalTokens && sessionTotalTokens > 0) {
    parts.push(`${labels.tokenSession}${formatTokenCount(sessionTotalTokens, locale)}`);
  }

  return parts.join(' ');
}
