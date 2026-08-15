/**
 * OMC HUD - State Management
 *
 * Manages HUD state file for background task tracking.
 * Follows patterns from ultrawork-state.
 */

import { existsSync, readFileSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { getClaudeConfigDir } from "../utils/config-dir.js";
import {
  validateWorkingDirectory,
  getOmcRoot,
  ensureSessionStateDir,
  resolveSessionStatePath,
} from "../lib/worktree-paths.js";
import {
  atomicWriteFileSync,
  atomicWriteJsonSync,
} from "../lib/atomic-write.js";
import type {
  OmcHudState,
  BackgroundTask,
  HudConfig,
  HudElementConfig,
  HudThresholds,
  ContextLimitWarningConfig,
  HudLabels,
  HudLocale,
} from "./types.js";
import { MAX_BACKGROUND_CONCURRENT } from "./types.js";
import {
  DEFAULT_HUD_CONFIG,
  PRESET_CONFIGS,
  isHudLocale,
  resolveHudLabels,
  sanitizeHudLabels,
} from "./types.js";
import { DEFAULT_MISSION_BOARD_CONFIG } from "./mission-board.js";
import { withFileLockSync } from "../lib/file-lock.js";

// background-cleanup.ts 不再静态导入,改在 initializeHUDState 内部动态 import,
// 以打破 state.ts ↔ background-cleanup.ts 的运行时 import 循环(依赖注入)。

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the HUD state file path in the project's .omc/state directory
 */
function getLocalStateFilePath(directory?: string): string {
  const baseDir = validateWorkingDirectory(directory);
  const omcStateDir = join(getOmcRoot(baseDir), "state");
  return join(omcStateDir, "hud-state.json");
}

function getLegacyRootStateFilePath(directory?: string): string {
  const baseDir = validateWorkingDirectory(directory);
  return join(getOmcRoot(baseDir), "hud-state.json");
}

function getStateFilePath(directory?: string, sessionId?: string): string {
  const baseDir = validateWorkingDirectory(directory);
  if (sessionId) {
    return resolveSessionStatePath("hud", sessionId, baseDir);
  }
  return getLocalStateFilePath(baseDir);
}

/**
 * 返回 HUD state 文件对应的锁文件路径(供外部 RMW 流程使用)。
 * 锁文件位于 state 文件旁,命名为 `<stateFile>.lock`。
 */
export function getHudStateLockPath(directory?: string, sessionId?: string): string {
  return `${getStateFilePath(directory, sessionId)}.lock`;
}

/**
 * Get Claude Code settings.json path
 */
function getSettingsFilePath(): string {
  return join(getClaudeConfigDir(), "settings.json");
}

/**
 * Get the HUD config file path (legacy)
 */
function getConfigFilePath(): string {
  return join(getClaudeConfigDir(), ".omc", "hud-config.json");
}

function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function getLegacyHudConfig(): HudConfigInput | null {
  return readJsonFile<HudConfigInput>(getConfigFilePath());
}

function mergeElements(
  primary?: Partial<HudConfig["elements"]>,
  secondary?: Partial<HudConfig["elements"]>,
): Partial<HudConfig["elements"]> {
  return {
    ...(primary ?? {}),
    ...(secondary ?? {}),
  };
}

function mergeThresholds(
  primary?: Partial<HudConfig["thresholds"]>,
  secondary?: Partial<HudConfig["thresholds"]>,
): Partial<HudConfig["thresholds"]> {
  return {
    ...(primary ?? {}),
    ...(secondary ?? {}),
  };
}

function mergeContextLimitWarning(
  primary?: Partial<HudConfig["contextLimitWarning"]>,
  secondary?: Partial<HudConfig["contextLimitWarning"]>,
): Partial<HudConfig["contextLimitWarning"]> {
  return {
    ...(primary ?? {}),
    ...(secondary ?? {}),
  };
}

function mergeMissionBoardConfig(
  primary?: Partial<HudConfig["missionBoard"]>,
  secondary?: Partial<HudConfig["missionBoard"]>,
): Partial<HudConfig["missionBoard"]> {
  return {
    ...(primary ?? {}),
    ...(secondary ?? {}),
  };
}

function mergeElementsForWrite(
  legacyElements: HudConfigInput["elements"],
  nextElements: HudElementConfig,
): Partial<HudElementConfig> {
  const merged: Partial<HudElementConfig> = { ...(legacyElements ?? {}) };

  for (const [key, value] of Object.entries(nextElements) as Array<
    [keyof HudElementConfig, HudElementConfig[keyof HudElementConfig]]
  >) {
    const defaultValue = DEFAULT_HUD_CONFIG.elements[key];
    const legacyValue = legacyElements?.[key];
    (
      merged as Record<
        keyof HudElementConfig,
        HudElementConfig[keyof HudElementConfig] | undefined
      >
    )[key] =
      value === defaultValue && legacyValue !== undefined ? legacyValue : value;
  }

  return merged;
}

/**
 * Ensure the .omc/state directory exists
 */
function ensureStateDir(directory?: string): void {
  const baseDir = validateWorkingDirectory(directory);
  const omcStateDir = join(getOmcRoot(baseDir), "state");
  if (!existsSync(omcStateDir)) {
    mkdirSync(omcStateDir, { recursive: true });
  }
}

function ensureHudStateDir(directory?: string, sessionId?: string): void {
  if (sessionId) {
    ensureSessionStateDir(sessionId, validateWorkingDirectory(directory));
    return;
  }
  ensureStateDir(directory);
}

type HudConfigInput = Omit<
  Partial<HudConfig>,
  "elements" | "thresholds" | "contextLimitWarning" | "missionBoard" | "labels"
> & {
  locale?: unknown;
  labels?: Partial<Record<keyof HudLabels, unknown>>;
  elements?: Partial<HudElementConfig>;
  thresholds?: Partial<HudThresholds>;
  contextLimitWarning?: Partial<ContextLimitWarningConfig>;
  missionBoard?: Partial<NonNullable<HudConfig["missionBoard"]>>;
};

// ============================================================================
// HUD State Operations
// ============================================================================

/**
 * Read HUD state from disk (checks new local and legacy local only)
 */
export function readHudState(
  directory?: string,
  sessionId?: string,
): OmcHudState | null {
  // Session-scoped HUD state should never fall back to root/legacy files.
  // This prevents a stale root state from being revived after a pane/session
  // recreation when the current session has already been identified.
  if (sessionId) {
    const sessionStateFile = getStateFilePath(directory, sessionId);
    if (!existsSync(sessionStateFile)) {
      return null;
    }

    try {
      const content = readFileSync(sessionStateFile, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.error(
        "[HUD] Failed to read session state:",
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  // Check new local state first (.omc/state/hud-state.json)
  const localStateFile = getLocalStateFilePath(directory);
  if (existsSync(localStateFile)) {
    try {
      const content = readFileSync(localStateFile, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.error(
        "[HUD] Failed to read local state:",
        error instanceof Error ? error.message : error,
      );
      // Fall through to legacy check
    }
  }

  // Check legacy local state (.omc/hud-state.json)
  const legacyStateFile = getLegacyRootStateFilePath(directory);
  if (existsSync(legacyStateFile)) {
    try {
      const content = readFileSync(legacyStateFile, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.error(
        "[HUD] Failed to read legacy state:",
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  return null;
}

/**
 * writeHudState 的可选参数。
 * 默认行为:使用文件锁保证写入原子性(防止并发 lost update)。
 */
export interface WriteHudStateOptions {
  /**
   * 是否使用文件锁串行化并发写入。
   * 默认 true。设为 false 可在已知无并发场景下跳过锁开销。
   */
  lock?: boolean;
}

/**
 * Write HUD state to disk (local only)
 *
 * 默认通过 withFileLockSync 串行化并发写入,避免 lost update(对应提交 c1d4438d)。
 * 锁文件在写入完成后自动释放(withFileLockSync 内部 try/finally 语义),
 * 因此不会在写入完成后残留。
 */
export function writeHudState(
  state: OmcHudState,
  directory?: string,
  sessionId?: string,
  options?: WriteHudStateOptions,
): boolean {
  try {
    // Write to the session-scoped file when the current session is known,
    // otherwise keep the legacy local path for backwards compatibility.
    ensureHudStateDir(directory, sessionId);
    const stateFile = getStateFilePath(directory, sessionId);
    const lockPath = getHudStateLockPath(directory, sessionId);
    const useLock = options?.lock !== false;

    // 写入与遗留文件清理逻辑,可在锁内执行以保证 RMW 原子性
    const writeAndCleanup = (): boolean => {
      const nextState = sessionId ? { ...state, sessionId } : state;
      atomicWriteJsonSync(stateFile, nextState);

      if (sessionId) {
        const legacyCandidates = [
          getLegacyRootStateFilePath(directory),
        ];
        for (const legacyFile of legacyCandidates) {
          if (!existsSync(legacyFile)) {
            continue;
          }
          try {
            const content = readFileSync(legacyFile, "utf-8");
            const legacyState = JSON.parse(content) as Partial<OmcHudState>;
            if (!legacyState.sessionId || legacyState.sessionId === sessionId) {
              unlinkSync(legacyFile);
            }
          } catch {
            // Best-effort ghost cleanup only.
          }
        }
      }
      return true;
    };

    if (useLock) {
      // withFileLockSync 在 finally 中自动释放锁,锁文件不会残留
      return withFileLockSync(lockPath, writeAndCleanup);
    }
    return writeAndCleanup();
  } catch (error) {
    console.error(
      "[HUD] Failed to write state:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/**
 * Create a new empty HUD state
 */
export function createEmptyHudState(): OmcHudState {
  return {
    timestamp: new Date().toISOString(),
    backgroundTasks: [],
  };
}

/**
 * Get running background tasks from state
 */
export function getRunningTasks(state: OmcHudState | null): BackgroundTask[] {
  if (!state) return [];
  return state.backgroundTasks.filter((task) => task.status === "running");
}

/**
 * Get background task count string (e.g., "3/5")
 */
export function getBackgroundTaskCount(state: OmcHudState | null): {
  running: number;
  max: number;
} {
  const running = state
    ? state.backgroundTasks.filter((t) => t.status === "running").length
    : 0;
  return { running, max: MAX_BACKGROUND_CONCURRENT };
}

// ============================================================================
// HUD Config Operations
// ============================================================================

/**
 * Read HUD configuration from disk.
 * Priority: settings.json > hud-config.json (legacy) > defaults
 */
export function readHudConfig(): HudConfig {
  const settingsFile = getSettingsFilePath();
  const legacyConfig = getLegacyHudConfig();

  if (existsSync(settingsFile)) {
    try {
      const content = readFileSync(settingsFile, "utf-8");
      const settings = JSON.parse(content) as { omcHud?: HudConfigInput };
      if (settings.omcHud) {
        return mergeWithDefaults({
          ...legacyConfig,
          ...settings.omcHud,
          elements: mergeElements(
            legacyConfig?.elements,
            settings.omcHud.elements,
          ),
          thresholds: mergeThresholds(
            legacyConfig?.thresholds,
            settings.omcHud.thresholds,
          ),
          contextLimitWarning: mergeContextLimitWarning(
            legacyConfig?.contextLimitWarning,
            settings.omcHud.contextLimitWarning,
          ),
          missionBoard: mergeMissionBoardConfig(
            legacyConfig?.missionBoard,
            settings.omcHud.missionBoard,
          ),
          locale: isHudLocale(settings.omcHud.locale)
            ? settings.omcHud.locale
            : legacyConfig?.locale,
          labels: {
            ...sanitizeHudLabels(legacyConfig?.labels),
            ...sanitizeHudLabels(settings.omcHud.labels),
          },
        });
      }
    } catch (error) {
      console.error(
        "[HUD] Failed to read settings.json:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (legacyConfig) {
    return mergeWithDefaults(legacyConfig);
  }

  return mergeWithDefaults({});
}

/**
 * Merge partial config with defaults
 */
function mergeWithDefaults(config: HudConfigInput): HudConfig {
  const preset = config.preset ?? DEFAULT_HUD_CONFIG.preset;
  const presetElements = PRESET_CONFIGS[preset] ?? {};
  const missionBoardEnabled =
    config.missionBoard?.enabled ??
    config.elements?.missionBoard ??
    DEFAULT_HUD_CONFIG.missionBoard?.enabled ??
    false;
  const missionBoard = {
    ...DEFAULT_MISSION_BOARD_CONFIG,
    ...DEFAULT_HUD_CONFIG.missionBoard,
    ...config.missionBoard,
    enabled: missionBoardEnabled,
  };

  const locale: HudLocale | undefined = isHudLocale(config.locale)
    ? config.locale
    : DEFAULT_HUD_CONFIG.locale;

  return {
    preset,
    locale,
    labels: resolveHudLabels(locale, config.labels),
    elements: {
      ...DEFAULT_HUD_CONFIG.elements, // Base defaults
      ...presetElements, // Preset overrides
      ...config.elements, // User overrides
    },
    thresholds: {
      ...DEFAULT_HUD_CONFIG.thresholds,
      ...config.thresholds,
    },
    staleTaskThresholdMinutes:
      config.staleTaskThresholdMinutes ??
      DEFAULT_HUD_CONFIG.staleTaskThresholdMinutes,
    contextLimitWarning: {
      ...DEFAULT_HUD_CONFIG.contextLimitWarning,
      ...config.contextLimitWarning,
    },
    missionBoard,
    usageApiPollIntervalMs:
      config.usageApiPollIntervalMs ??
      DEFAULT_HUD_CONFIG.usageApiPollIntervalMs,
    ...(config.elementOrder !== undefined
      ? { elementOrder: config.elementOrder }
      : {}),
    wrapMode: config.wrapMode ?? DEFAULT_HUD_CONFIG.wrapMode,
    ...(config.rateLimitsProvider
      ? { rateLimitsProvider: config.rateLimitsProvider }
      : {}),
    ...(config.maxWidth != null ? { maxWidth: config.maxWidth } : {}),
    ...(config.layout ? { layout: config.layout } : {}),
  };
}

/**
 * Write HUD configuration to ~/.claude/settings.json (omcHud key)
 */
export function writeHudConfig(config: HudConfig): boolean {
  try {
    const settingsFile = getSettingsFilePath();
    const legacyConfig = getLegacyHudConfig();
    let settings: Record<string, unknown> = {};

    if (existsSync(settingsFile)) {
      const content = readFileSync(settingsFile, "utf-8");
      settings = JSON.parse(content) as Record<string, unknown>;
    }

    const mergedConfig = mergeWithDefaults({
      ...legacyConfig,
      ...config,
      elements: mergeElementsForWrite(legacyConfig?.elements, config.elements),
      thresholds: mergeThresholds(legacyConfig?.thresholds, config.thresholds),
      contextLimitWarning: mergeContextLimitWarning(
        legacyConfig?.contextLimitWarning,
        config.contextLimitWarning,
      ),
      missionBoard: mergeMissionBoardConfig(
        legacyConfig?.missionBoard,
        config.missionBoard,
      ),
      locale: isHudLocale(config.locale) ? config.locale : legacyConfig?.locale,
      labels: {
        ...sanitizeHudLabels(legacyConfig?.labels),
        ...sanitizeHudLabels(config.labels),
      },
    });

    settings.omcHud = mergedConfig;
    atomicWriteFileSync(settingsFile, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error(
      "[HUD] Failed to write config:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/**
 * Apply a preset to the configuration
 */
export function applyPreset(preset: HudConfig["preset"]): HudConfig {
  const config = readHudConfig();
  const presetElements = PRESET_CONFIGS[preset];

  const newConfig: HudConfig = {
    ...config,
    preset,
    elements: {
      ...config.elements,
      ...presetElements,
    },
  };

  writeHudConfig(newConfig);
  return newConfig;
}

/**
 * Initialize HUD state with cleanup of stale/orphaned tasks.
 * Should be called on HUD startup.
 *
 * background-cleanup.ts 通过动态 import 加载,避免与 state.ts 形成静态 import 循环。
 */
export async function initializeHUDState(
  directory?: string,
  sessionId?: string,
): Promise<void> {
  // 动态 import 打破 state.ts → background-cleanup.ts → state.ts 的循环依赖
  const { cleanupStaleBackgroundTasks, markOrphanedTasksAsStale } =
    await import("./background-cleanup.js");

  // Clean up stale background tasks from previous sessions
  const removedStale = await cleanupStaleBackgroundTasks(undefined, directory, sessionId);
  const markedOrphaned = await markOrphanedTasksAsStale(directory, sessionId);

  if (removedStale > 0 || markedOrphaned > 0) {
    console.error(
      `HUD cleanup: removed ${removedStale} stale tasks, marked ${markedOrphaned} orphaned tasks`,
    );
  }
}
