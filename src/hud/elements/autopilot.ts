/**
 * OMC HUD - Autopilot Element
 *
 * Renders autopilot phase and progress display.
 */

import type { HudThresholds } from '../types.js';
import { RESET, activity, dim } from '../colors.js';

// ANSI color codes（v2：活动光谱）
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';

export interface AutopilotStateForHud {
  active: boolean;
  phase: string;
  iteration: number;
  maxIterations: number;
  tasksCompleted?: number;
  tasksTotal?: number;
  filesCreated?: number;
  workflow?: {
    invalid?: boolean;
    name?: string;
    version?: number;
    shortHash?: string;
    currentStage?: string;
    currentStageIndex?: number;
    stagesTotal?: number;
  };
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

  if (state.workflow?.invalid) {
    return `${activity('[AUTOPILOT]')} ${RED}workflow:invalid${RESET}`;
  }
  if (state.workflow?.name && state.workflow.currentStage && state.workflow.currentStageIndex && state.workflow.stagesTotal) {
    const workflowName = state.workflow.name.slice(0, 32);
    return `${activity('[AUTOPILOT]')} workflow:${workflowName} v${state.workflow.version}#${state.workflow.shortHash} | ${state.workflow.currentStage} ${state.workflow.currentStageIndex}/${state.workflow.stagesTotal}`;
  }

  const { phase, iteration, maxIterations, tasksCompleted, tasksTotal, filesCreated } = state;
  const phaseNum = PHASE_INDEX[phase] || 0;
  const phaseName = PHASE_NAMES[phase] || phase;

  // v2 活动光谱：进行中=品红（activity），qa=黄（注意），完成=绿，失败=红
  let phaseColor: string;
  switch (phase) {
    case 'complete':
      phaseColor = GREEN;
      break;
    case 'failed':
      phaseColor = RED;
      break;
    case 'qa':
      phaseColor = YELLOW;
      break;
    default:
      // expansion/planning/execution/validation 均属"进行中" → 活动品红
      phaseColor = MAGENTA;
  }

  let output = `${activity('[AUTOPILOT]')} Phase ${phaseColor}${phaseNum}/5${RESET}: ${phaseName}`;

  // Add iteration count if not first iteration
  if (iteration > 1) {
    output += ` (iter ${iteration}/${maxIterations})`;
  }

  // Add task progress if in execution phase
  if (phase === 'execution' && tasksTotal && tasksTotal > 0) {
    const taskColor = tasksCompleted === tasksTotal ? GREEN : YELLOW;
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

  if (state.workflow?.invalid) {
    return `${RED}AP:workflow:invalid${RESET}`;
  }
  if (state.workflow?.currentStageIndex && state.workflow.stagesTotal) {
    return `${CYAN}AP:${state.workflow.currentStageIndex}/${state.workflow.stagesTotal}${RESET}`;
  }
  const { phase } = state;
  const phaseNum = PHASE_INDEX[phase] || 0;

  if (phase === 'complete') {
    return `${GREEN}AP:Done${RESET}`;
  }

  if (phase === 'failed') {
    return `${RED}AP:Fail${RESET}`;
  }

  return `${CYAN}AP:${phaseNum}/5${RESET}`;
}
