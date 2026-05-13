/**
 * OMC HUD - Token Usage Element
 *
 * Renders last-request input/output token usage from transcript metadata.
 */
import { DEFAULT_HUD_LABELS } from '../types.js';
import { formatTokenCount } from '../../cli/utils/formatting.js';
export function renderTokenUsage(usage, sessionTotalTokens, labels = DEFAULT_HUD_LABELS, locale) {
    if (!usage)
        return null;
    const hasUsage = usage.inputTokens > 0 || usage.outputTokens > 0;
    if (!hasUsage)
        return null;
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
//# sourceMappingURL=token-usage.js.map