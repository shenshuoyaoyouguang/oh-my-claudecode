/**
 * OMC HUD - State Readers
 *
 * Read ralph, ultrawork, and PRD state from existing OMC files.
 * These are read-only functions that don't modify the state files.
 */


import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { getOmcRoot } from '../lib/worktree-paths.js';
import type {
  RalphStateForHud,
  UltraworkStateForHud,
  PrdStateForHud,
} from './types.js';
import type { AutopilotStateForHud } from './elements/autopilot.js';
import { validateNamedWorkflowStateStructure } from '../hooks/autopilot/named-workflow-resume-validator.js';
import type { AutopilotState } from '../hooks/autopilot/types.js';

/**
 * Maximum age for state files to be considered "active".
 * Files older than this are treated as stale/abandoned.
 */
const MAX_STATE_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Check if a state file is stale based on file modification time.
 */
function isStateFileStale(filePath: string): boolean {
  try {
    const stat = statSync(filePath);
    const age = Date.now() - stat.mtimeMs;
    return age > MAX_STATE_AGE_MS;
  } catch {
    return true; // Treat errors as stale
  }
}

/**
 * Resolve state file path with rigid lookup chain:
 * 1. Session-scoped path (.omc/state/sessions/{id}/{filename}) — when sessionId is provided
 * 2. Standard path (.omc/state/{filename})
 * 3. Legacy path (.omc/{filename})
 *
 * CRITICAL: When sessionId is provided, ONLY the session-scoped path is checked.
 * No mtime-based scanning across sessions — that caused cross-session state pollution
 * (Issue #3487 fix). Each session owns its state files; HUD must never read another
 * session's state.
 */
function resolveStatePath(directory: string, filename: string, sessionId?: string): string | null {
  const omcRoot = getOmcRoot(directory);

  // When a specific session is identified, ONLY read its session-scoped file.
  // No fallback chain — we must not accidentally read another session's state.
  if (sessionId) {
    const sessionPath = join(omcRoot, 'state', 'sessions', sessionId, filename);
    return existsSync(sessionPath) ? sessionPath : null;
  }

  // No session context available — try the shared project-level paths.
  // This preserves backward compatibility for --watch mode / detached processes
  // that lack CLAUDE_SESSION_ID. These are inherently ambiguous; we accept the
  // risk of reading stale state rather than corrupting another session's data.

  // Check standard path (.omc/state/{filename})
  const newPath = join(omcRoot, 'state', filename);
  if (existsSync(newPath)) return newPath;

  // Check legacy path (.omc/{filename})
  const legacyPath = join(omcRoot, filename);
  if (existsSync(legacyPath)) return legacyPath;

  return null;
}

// ============================================================================
// Ralph State
// ============================================================================

interface RalphLoopState {
  active: boolean;
  iteration: number;
  max_iterations: number;
  prd_mode?: boolean;
  current_story_id?: string;
}

/**
 * Read Ralph Loop state for HUD display.
 * Returns null if no state file exists or on error.
 */
export function readRalphStateForHud(directory: string, sessionId?: string): RalphStateForHud | null {
  const stateFile = resolveStatePath(directory, 'ralph-state.json', sessionId);

  if (!stateFile) {
    return null;
  }

  // Check for stale state file (abandoned session)
  if (isStateFileStale(stateFile)) {
    return null;
  }

  try {
    const content = readFileSync(stateFile, 'utf-8');
    const state = JSON.parse(content) as RalphLoopState;

    if (!state.active) {
      return null;
    }

    return {
      active: state.active,
      iteration: state.iteration,
      maxIterations: state.max_iterations,
      prdMode: state.prd_mode,
      currentStoryId: state.current_story_id,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Ultrawork State
// ============================================================================

interface UltraworkState {
  active: boolean;
  reinforcement_count: number;
}

/**
 * Read Ultrawork state for HUD display.
 * Checks only local .omc/state location.
 */
export function readUltraworkStateForHud(
  directory: string,
  sessionId?: string
): UltraworkStateForHud | null {
  // Check local state only (with new path fallback)
  const localFile = resolveStatePath(directory, 'ultrawork-state.json', sessionId);

  if (!localFile || isStateFileStale(localFile)) {
    return null;
  }

  try {
    const content = readFileSync(localFile, 'utf-8');
    const state = JSON.parse(content) as UltraworkState;

    if (!state.active) {
      return null;
    }

    return {
      active: state.active,
      reinforcementCount: state.reinforcement_count,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// PRD State
// ============================================================================

interface UserStory {
  id: string;
  passes: boolean;
  priority: number;
}

interface PRD {
  userStories: UserStory[];
}

/**
 * Read PRD state for HUD display.
 * Checks both root prd.json and .omc/prd.json.
 */
export function readPrdStateForHud(directory: string): PrdStateForHud | null {
  // Check root first
  let prdPath = join(directory, 'prd.json');

  if (!existsSync(prdPath)) {
    // Check .omc
    prdPath = join(getOmcRoot(directory), 'prd.json');

    if (!existsSync(prdPath)) {
      return null;
    }
  }

  try {
    const content = readFileSync(prdPath, 'utf-8');
    const prd = JSON.parse(content) as PRD;

    if (!prd.userStories || !Array.isArray(prd.userStories)) {
      return null;
    }

    const stories = prd.userStories;
    const completed = stories.filter((s) => s.passes).length;
    const total = stories.length;

    // Find current story (first incomplete, sorted by priority)
    const incomplete = stories
      .filter((s) => !s.passes)
      .sort((a, b) => a.priority - b.priority);

    return {
      currentStoryId: incomplete[0]?.id || null,
      completed,
      total,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Autopilot State
// ============================================================================

interface WorkflowDescriptor {
  descriptorVersion: number;
  workflowName: string;
  profileVersion: number;
  stages: string[];
  profileHash: string;
}

interface AutopilotStateFile {
  active: boolean;
  phase?: string;
  current_phase?: string;
  iteration: number;
  max_iterations: number;
  workflow?: WorkflowDescriptor;
  pipelineTracking?: {
    stages?: Array<{ id?: string; status?: string }>;
    currentStageIndex?: number;
    trackingRevision?: number;
    activationBoundary?: { transcriptPath?: string; byteOffset?: number } | null;
    completionObservations?: unknown[];
  };
  execution?: {
    tasks_completed?: number;
    tasks_total?: number;
    files_created?: string[];
  };
}


function hasNamedWorkflowMarker(state: AutopilotStateFile): boolean {
  const record = state as unknown as Record<string, unknown>;
  return ['workflow', 'workflowRunId', 'pipelineTracking'].some((marker) => (
    Object.prototype.hasOwnProperty.call(record, marker)
  ));
}

function getWorkflowHudState(state: AutopilotStateFile): AutopilotStateForHud['workflow'] | undefined {
  if (!hasNamedWorkflowMarker(state)) {
    return undefined;
  }
  const record = state as unknown as Record<string, unknown>;
  const sessionId = typeof record.session_id === 'string'
    ? record.session_id
    : undefined;
  if (!sessionId || !validateNamedWorkflowStateStructure(state as unknown as AutopilotState, sessionId)) {
    return { invalid: true };
  }

  const workflow = state.workflow!;
  const pipelineTracking = state.pipelineTracking!;
  const currentStageIndex = pipelineTracking.currentStageIndex!;
  const currentStage = pipelineTracking.stages![currentStageIndex]?.id;
  return {
    name: workflow.workflowName,
    version: workflow.profileVersion,
    shortHash: workflow.profileHash.slice(0, 12),
    currentStage: currentStage ?? 'complete',
    currentStageIndex: Math.min(currentStageIndex + 1, workflow.stages.length),
    stagesTotal: workflow.stages.length,
  };
}


/**
 * Read Autopilot state for HUD display.
 * Returns shape matching AutopilotStateForHud from elements/autopilot.ts.
 */
export function readAutopilotStateForHud(directory: string, sessionId?: string): AutopilotStateForHud | null {
  const stateFile = resolveStatePath(directory, 'autopilot-state.json', sessionId);

  if (!stateFile) {
    return null;
  }

  // Check for stale state file (abandoned session)
  if (isStateFileStale(stateFile)) {
    return null;
  }

  try {
    const content = readFileSync(stateFile, 'utf-8');
    const state = JSON.parse(content) as AutopilotStateFile;

    if (!state.active) {
      return null;
    }

    const phase = state.phase ?? state.current_phase;
    if (!phase) {
      return null;
    }

    return {
      active: state.active,
      phase,
      iteration: state.iteration,
      maxIterations: state.max_iterations,
      tasksCompleted: state.execution?.tasks_completed,
      tasksTotal: state.execution?.tasks_total,
      filesCreated: state.execution?.files_created?.length,
      workflow: getWorkflowHudState(state),
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Combined State Check
// ============================================================================

/**
 * Check if any OMC mode is currently active
 */
export function isAnyModeActive(directory: string, sessionId?: string): boolean {
  const ralph = readRalphStateForHud(directory, sessionId);
  const ultrawork = readUltraworkStateForHud(directory, sessionId);
  const autopilot = readAutopilotStateForHud(directory, sessionId);

  return (ralph?.active ?? false) || (ultrawork?.active ?? false) || (autopilot?.active ?? false);
}

/**
 * Get active skill names for display
 */
export function getActiveSkills(directory: string, sessionId?: string): string[] {
  const skills: string[] = [];

  const autopilot = readAutopilotStateForHud(directory, sessionId);
  if (autopilot?.active) {
    skills.push('autopilot');
  }

  const ralph = readRalphStateForHud(directory, sessionId);
  if (ralph?.active) {
    skills.push('ralph');
  }

  const ultrawork = readUltraworkStateForHud(directory, sessionId);
  if (ultrawork?.active) {
    skills.push('ultrawork');
  }

  return skills;
}

// Re-export for convenience
export type { AutopilotStateForHud } from './elements/autopilot.js';
