/**
 * OMC HUD - Session Health Element
 *
 * Renders session duration and health indicator.
 */

import type { SessionHealth } from '../types.js';
import { appleGreen, appleRed, appleOrange } from '../colors.js';

/**
 * Render session health indicator.
 *
 * Format: session:45m or session:45m (healthy)
 */
export function renderSession(session: SessionHealth | null): string | null {
  if (!session) return null;

  const colorize = session.health === 'critical' ? appleRed
    : session.health === 'warning' ? appleOrange
    : appleGreen;

  return `session:${colorize(`${session.durationMinutes}m`)}`;
}
