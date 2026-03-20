/**
 * OMC HUD - Token Usage Element
 *
 * Renders last-request input/output token usage from transcript metadata.
 */

import type { LastRequestTokenUsage } from '../types.js';

function formatCompactTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return `${tokens}`;
  }

  if (tokens < 1000000) {
    const thousands = Math.floor((tokens / 1000) * 10) / 10;
    return `${Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
  }

  if (tokens < 1000000000) {
    const millions = Math.floor((tokens / 1000000) * 10) / 10;
    return `${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1)}m`;
  }

  const billions = Math.floor((tokens / 1000000000) * 10) / 10;
  return `${Number.isInteger(billions) ? billions.toFixed(0) : billions.toFixed(1)}b`;
}

export function renderTokenUsage(
  usage: LastRequestTokenUsage | null | undefined,
  sessionTotalTokens?: number | null,
  useAscii: boolean = false,
): string | null {
  if (!usage) return null;

  const currentTotalTokens = usage.inputTokens + usage.outputTokens;
  if (currentTotalTokens <= 0) return null;

  const separator = useAscii ? ' | ' : ' · ';
  const parts = [`tok ${formatCompactTokenCount(currentTotalTokens)}`];

  if (sessionTotalTokens && sessionTotalTokens > 0) {
    parts.push(`total ~${formatCompactTokenCount(sessionTotalTokens)}`);
  }

  return parts.join(separator);
}
