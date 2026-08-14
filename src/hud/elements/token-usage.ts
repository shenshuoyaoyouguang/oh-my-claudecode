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

import type { HudLabels, LastRequestTokenUsage } from '../types.js';
import { DEFAULT_HUD_LABELS } from '../types.js';
import { formatTokenCount } from '../../cli/utils/formatting.js';
import { cyan, dim, magenta } from '../colors.js';

/** I/O/S token parts for region-aware rendering. */
export interface TokenUsageParts {
  /** ↑ input tokens (dim) — Input (I) region */
  input: string;
  /** ↓ output tokens (dim) — Output (O) region */
  output: string;
  /** r reasoning tokens (magenta) — Output (O) region, optional */
  reasoning: string | null;
  /** s session total (cyan) — Status (S) region, optional */
  session: string | null;
}

export function splitTokenUsage(
  usage: LastRequestTokenUsage | null | undefined,
  sessionTotalTokens?: number | null,
  _labels: Pick<HudLabels, 'tokens'> = DEFAULT_HUD_LABELS,
): TokenUsageParts | null {
  if (!usage) return null;

  const hasUsage = usage.inputTokens > 0 || usage.outputTokens > 0;
  if (!hasUsage) return null;

  return {
    input: `${dim(`↑${formatTokenCount(usage.inputTokens)}`)}`,
    output: `${dim(`↓${formatTokenCount(usage.outputTokens)}`)}`,
    reasoning:
      usage.reasoningTokens && usage.reasoningTokens > 0
        ? `${magenta(`r${formatTokenCount(usage.reasoningTokens)}`)}`
        : null,
    session:
      sessionTotalTokens && sessionTotalTokens > 0
        ? `${cyan(`s${formatTokenCount(sessionTotalTokens)}`)}`
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
  labels: Pick<HudLabels, 'tokens'> = DEFAULT_HUD_LABELS,
): string | null {
  const parts = splitTokenUsage(usage, sessionTotalTokens, labels);
  return parts ? joinTokenParts(parts) : null;
}