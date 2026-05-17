/**
 * OMC HUD - Token Usage Element
 *
 * Renders last-request input/output token usage from transcript metadata.
 */
import { DEFAULT_HUD_LABELS } from '../types.js';
import { formatTokenCount } from '../../cli/utils/formatting.js';
export function renderTokenUsage(usage, sessionTotalTokens, labels = DEFAULT_HUD_LABELS, locale, tokenFormat = 'detailed') {
    if (!usage)
        return null;
    const hasUsage = usage.inputTokens > 0 || usage.outputTokens > 0;
    if (!hasUsage)
        return null;
    // 'total' mode: show only session total
    if (tokenFormat === 'total' && sessionTotalTokens && sessionTotalTokens > 0) {
        return `Σ${formatTokenCount(sessionTotalTokens, locale)}`;
    }
    const parts = [
        `↓${formatTokenCount(usage.inputTokens, locale)} ↑${formatTokenCount(usage.outputTokens, locale)}`,
    ];
    if (usage.reasoningTokens && usage.reasoningTokens > 0) {
        parts.push(`≈${formatTokenCount(usage.reasoningTokens, locale)}`);
    }
    if (sessionTotalTokens && sessionTotalTokens > 0) {
        parts.push(`Σ${formatTokenCount(sessionTotalTokens, locale)}`);
    }
    return parts.join(' ');
}
//# sourceMappingURL=token-usage.js.map