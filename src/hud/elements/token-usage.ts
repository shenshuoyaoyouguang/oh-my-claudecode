/**
 * OMC HUD - Token Usage Element
 *
 * Renders last-request input/output token usage from transcript metadata.
 * Tokens render as plain numbers (no arrow prefix) — the arrow glyphs were
 * removed for cleaner i18n-friendly output; labels distinguish meaning
 * (输入/输出 via region tags, 推理/累计 via label prefixes).
 *
 * The element can be rendered as a single compact string (renderTokenUsage)
 * or split into I/O/S parts (splitTokenUsage) so region-aware rendering can
 * place input under I, output+reasoning under O, and the session total under S.
 */

import type { HudLabels, LastRequestTokenUsage } from '../types.js';
import { DEFAULT_HUD_LABELS } from '../types.js';
import { formatTokenCount } from '../../cli/utils/formatting.js';
import { cyan, magenta, white } from '../colors.js';

/** I/O/S token parts for region-aware rendering. */
export interface TokenUsageParts {
  /** input token count (white) — Input (I) region */
  input: string;
  /** output token count (white) — Output (O) region */
  output: string;
  /** reasoning token count (magenta) — Output (O) region, optional */
  reasoning: string | null;
  /** session total (cyan) — Input (I) region (moved from S), optional */
  session: string | null;
}

export function splitTokenUsage(
  usage: LastRequestTokenUsage | null | undefined,
  sessionTotalTokens?: number | null,
  labels: Pick<HudLabels, 'reasoning' | 'sessionTotal'> = DEFAULT_HUD_LABELS,

): TokenUsageParts | null {
  if (!usage) return null;

  const hasUsage = usage.inputTokens > 0 || usage.outputTokens > 0;
  if (!hasUsage) return null;

  return {
    input: `${white(formatTokenCount(usage.inputTokens))}`,
    output: `${white(formatTokenCount(usage.outputTokens))}`,
    reasoning:
      usage.reasoningTokens && usage.reasoningTokens > 0
        ? `${magenta(`${labels.reasoning}:${formatTokenCount(usage.reasoningTokens)}`)}`
        : null,
    session:
      sessionTotalTokens && sessionTotalTokens > 0
        ? `${cyan(`${labels.sessionTotal}:${formatTokenCount(sessionTotalTokens)}`)}`
        : null,
  };
}

/** Join token parts into a single compact string (input → output → reasoning → session). */
export function joinTokenParts(parts: TokenUsageParts): string {
  return [parts.input, parts.output, parts.reasoning, parts.session]
    .filter((p): p is string => p !== null)
    .join(' ');
}

export function renderTokenUsage(
  usage: LastRequestTokenUsage | null | undefined,
  sessionTotalTokens?: number | null,
  labels: Pick<HudLabels, 'reasoning' | 'sessionTotal'> = DEFAULT_HUD_LABELS,

): string | null {
  const parts = splitTokenUsage(usage, sessionTotalTokens, labels);
  return parts ? joinTokenParts(parts) : null;
}
