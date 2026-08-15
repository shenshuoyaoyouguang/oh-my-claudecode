/**
 * OMC HUD - Session Health Element
 *
 * Renders session duration and health indicator.
 */

import type { HudLabels, SessionHealth } from '../types.js';
import { DEFAULT_HUD_LABELS } from '../types.js';
import { green, red, yellow, DIM, RESET } from '../colors.js';

/**
 * 健康指示器字符（P0-4 补齐 showHealthIndicator 死配置）：
 * ● = critical / ◐ = warning / ○ = healthy
 * 使用几何字符（非 emoji），宽度 1 列，深浅色终端均可读。
 */
const HEALTH_INDICATOR = {
  critical: '●',
  warning: '◐',
  healthy: '○',
} as const;

/**
 * Render session health indicator.
 *
 * Format: ○session:45m（showIndicator=true 时前缀健康指示点）
 */
export function renderSession(
  session: SessionHealth | null,
  showIndicator = true,
  labels: Pick<HudLabels, 'session'> = DEFAULT_HUD_LABELS,
): string | null {
  if (!session) return null;

  const colorize = session.health === 'critical' ? red
    : session.health === 'warning' ? yellow
    : green;

  const indicator = showIndicator
    ? colorize(HEALTH_INDICATOR[session.health])
    : '';
  return `${indicator}${DIM}${labels.session}:${RESET}${colorize(`${session.durationMinutes}m`)}`;
}
