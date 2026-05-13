/**
 * OMC HUD - Autopilot Element
 *
 * Renders autopilot phase and progress display.
 */

import type { HudThresholds } from '../types.js';
import { RESET, APPLE_CYAN, APPLE_GREEN, APPLE_ORANGE, APPLE_RED, APPLE_PURPLE, APPLE_BLUE } from '../colors.js';

export interface AutopilotStateForHud {
  active: boolean;
  phase: string;
  iteration: number;
  maxIterations: number;
  tasksCompleted?: number;
  tasksTotal?: number;
  filesCreated?: number;
}

const PHASE_NAMES: Record<string, string> = {
  expansion: 'Expand',
  planning: 'Plan',
  execution: 'Build',
  qa: 'QA',
  validation: 'Verify',
  complete: 'Done',
  failed: 'Failed'
};

const PHASE_INDEX: Record<string, number> = {
  expansion: 1,
  planning: 2,
  execution: 3,
  qa: 4,
  validation: 5,
  complete: 5,
  failed: 0
};

/**
 * Render autopilot state.
 * Returns null if autopilot is not active.
 *
 * Format: [AUTOPILOT] Phase 2/5: Plan | Tasks: 5/12
 */
export function renderAutopilot(
  state: AutopilotStateForHud | null,
  _thresholds?: HudThresholds
): string | null {
  if (!state?.active) {
    return null;
  }

  const { phase, iteration, maxIterations, tasksCompleted, tasksTotal, filesCreated } = state;
  const phaseNum = PHASE_INDEX[phase] || 0;
  const phaseName = PHASE_NAMES[phase] || phase;

  // Color based on phase
  let phaseColor: string;
  switch (phase) {
    case 'complete':
      phaseColor = APPLE_GREEN;
      break;
    case 'failed':
      phaseColor = APPLE_RED;
      break;
    case 'validation':
      phaseColor = APPLE_PURPLE;
      break;
    case 'qa':
      phaseColor = APPLE_ORANGE;
      break;
    default:
      phaseColor = APPLE_BLUE;
  }

  let output = `${APPLE_CYAN}[AUTOPILOT]${RESET} Phase ${phaseColor}${phaseNum}/5${RESET}: ${phaseName}`;

  // Add iteration count if not first iteration
  if (iteration > 1) {
    output += ` (iter ${iteration}/${maxIterations})`;
  }

  // Add task progress if in execution phase
  if (phase === 'execution' && tasksTotal && tasksTotal > 0) {
    const taskColor = tasksCompleted === tasksTotal ? APPLE_GREEN : APPLE_ORANGE;
    output += ` | Tasks: ${taskColor}${tasksCompleted || 0}/${tasksTotal}${RESET}`;
  }

  // Add file count if available
  if (filesCreated && filesCreated > 0) {
    output += ` | ${filesCreated} files`;
  }

  return output;
}

/**
 * Render compact autopilot status for minimal displays.
 *
 * Format: AP:3/5 or AP:Done
 */
export function renderAutopilotCompact(
  state: AutopilotStateForHud | null
): string | null {
  if (!state?.active) {
    return null;
  }

  const { phase } = state;
  const phaseNum = PHASE_INDEX[phase] || 0;

  if (phase === 'complete') {
    return `${APPLE_GREEN}AP:Done${RESET}`;
  }

  if (phase === 'failed') {
    return `${APPLE_RED}AP:Fail${RESET}`;
  }

  return `${APPLE_BLUE}AP:${phaseNum}/5${RESET}`;
}
