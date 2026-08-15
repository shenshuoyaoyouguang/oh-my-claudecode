/**
 * OMC HUD - Todos Element
 *
 * Renders todo progress display.
 */

import type { TodoItem } from "../types.js";
import { RESET, DIM, getTodoColor } from "../colors.js";
import { truncateToWidth } from "../../utils/string-width.js";

/**
 * 进度色（R-THRESH-2，P0-1）：≥80% GREEN / ≥1% CYAN / 0 DIM。
 * 进度只表达"完成度"，不使用状态黄（去 YELLOW，避免"进度黄=危险黄"）。
 * v2：统一收敛到 colors.ts 的 getTodoColor（单一来源）。
 */
function getProgressColor(completed: number, total: number): string {
  return getTodoColor(completed, total);
}

/**
 * Render todo progress.
 * Returns null if no todos.
 *
 * Format: todos:2/5
 */
export function renderTodos(todos: TodoItem[]): string | null {
  if (todos.length === 0) {
    return null;
  }

  const completed = todos.filter((t) => t.status === "completed").length;
  const total = todos.length;

  const color = getProgressColor(completed, total);

  return `todos:${color}${completed}/${total}${RESET}`;
}

/**
 * Render current in-progress todo (for full mode).
 *
 * Format: todos:2/5 (working: Implementing feature)
 */
export function renderTodosWithCurrent(todos: TodoItem[]): string | null {
  if (todos.length === 0) {
    return null;
  }

  const completed = todos.filter((t) => t.status === "completed").length;
  const total = todos.length;
  const inProgress = todos.find((t) => t.status === "in_progress");

  const color = getProgressColor(completed, total);

  let result = `todos:${color}${completed}/${total}${RESET}`;

  if (inProgress) {
    const activeText = inProgress.activeForm || inProgress.content || "...";
    // Use CJK-aware truncation (30 visual columns)
    const truncated = truncateToWidth(activeText, 30);
    result += ` ${DIM}(working: ${truncated})${RESET}`;
  }

  return result;
}
