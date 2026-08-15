/**
 * OMC HUD - Token Usage Element
 *
 * Renders last-request input/output token usage from transcript metadata.
 * Arrow direction follows the upload/download intuition:
 *   ↑ = input  (tokens sent up to the model)
 *   ↓ = output (tokens received down from the model)
 *
 * The element can be rendered as a single compact string (renderTokenUsage)
 * or split into I/O/S parts (splitTokenUsage) so region-aware rendering can
 * place input under I, output+reasoning under O, and the session total under S.
 */

import type { LastRequestTokenUsage } from '../types.js';
import { formatTokenCount } from '../../cli/utils/formatting.js';
import { cyan, magenta, white } from '../colors.js';

/** I/O/S token parts for region-aware rendering. */
export interface TokenUsageParts {
  /** ↑ input tokens (white) — Input (I) region */
  input: string;
  /** ↓ output tokens (white) — Output (O) region */
  output: string;
  /** r: reasoning tokens (magenta) — Output (O) region, optional */
  reasoning: string | null;
  /** tot: session total (cyan) — Status (S) region, optional */
  session: string | null;
}

export function splitTokenUsage(
  usage: LastRequestTokenUsage | null | undefined,
  sessionTotalTokens?: number | null,

): TokenUsageParts | null {
  if (!usage) return null;

  const hasUsage = usage.inputTokens > 0 || usage.outputTokens > 0;
  if (!hasUsage) return null;

  return {
    input: `${white(`↑${formatTokenCount(usage.inputTokens)}`)}`,
    output: `${white(`↓${formatTokenCount(usage.outputTokens)}`)}`,
    reasoning:
      usage.reasoningTokens && usage.reasoningTokens > 0
        ? `${magenta(`r:${formatTokenCount(usage.reasoningTokens)}`)}`
        : null,
    session:
      sessionTotalTokens && sessionTotalTokens > 0
        ? `${cyan(`tot:${formatTokenCount(sessionTotalTokens)}`)}`
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

): string | null {
  const parts = splitTokenUsage(usage, sessionTotalTokens);
  return parts ? joinTokenParts(parts) : null;
}