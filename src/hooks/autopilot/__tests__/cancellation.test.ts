/**
 * Autopilot Cancellation Transactionality Tests (Red 阶段)
 *
 * 对应提交组2:cancellation 事务性(~8 条)
 * - 9200ff1d fix(autopilot): make cancellation transactional
 * - bc87f5a7 fix(autopilot): bind cancellation to current state
 * - f9b31680 fix(autopilot): authenticate named cancellation
 * - 728a6b51 fix(autopilot): close cancellation and recovery gaps
 * - f43dff08 fix(cancel): expose exact workflow run capability
 * - 4cd39c32 fix(autopilot): scope global fallback cancellation
 * - d119a16d fix(autopilot): clear global fallback state
 * - 1d16b929 fix(autopilot): recheck global project ownership
 *
 * 本文件聚焦于 cancellation 的事务性、状态绑定、认证和 global fallback 限定,
 * 与现有 cancel.test.ts 互补,验证关键不变量在边界场景下的行为。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createHash } from "crypto";

import {
  cancelAutopilot,
  clearAutopilot,
  canResumeAutopilot,
  type CancelResult,
} from "../cancel.js";
import {
  initAutopilot,
  readAutopilotState,
  writeAutopilotState,
  transitionPhase,
} from "../state.js";
import { createWorkflowDescriptor } from "../pipeline.js";
import { resolveSessionStatePath } from "../../../lib/worktree-paths.js";

// Mock ralph 与 ultraqa 模块,与现有 cancel.test.ts 风格一致
vi.mock("../../ralph/index.js", () => ({
  clearRalphState: vi.fn(() => true),
  clearLinkedUltraworkState: vi.fn(() => true),
  readRalphState: vi.fn(() => null),
}));

vi.mock("../../ultraqa/index.js", () => ({
  clearUltraQAState: vi.fn(() => true),
  readUltraQAState: vi.fn(() => null),
}));

import * as ralphLoop from "../../ralph/index.js";
import * as ultraqaLoop from "../../ultraqa/index.js";

describe("autopilot cancellation transactionality", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "autopilot-cancel-txn-"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    delete process.env.OMC_TEST_FLOCK_AVAILABLE;
    delete process.env.OMC_TEST_CONDITIONAL_CLEAR_REPLACEMENT_PATH;
    delete process.env.OMC_TEST_CONDITIONAL_CLEAR_REPLACEMENT_BASE64;
    delete process.env.OMC_TEST_EMERGENCY_REPLACEMENT_PATH;
    delete process.env.OMC_TEST_EMERGENCY_REPLACEMENT_BASE64;
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  // 9200ff1d fix(autopilot): make cancellation transactional
  it("应事务性地提交 primary mutation,即便 dependent cleanup 失败也保留可重试状态", () => {
    const sessionId = "txn-primary-committed";
    const state = initAutopilot(testDir, "ship it", sessionId)!;
    const identity = {
      device: 1,
      inode: 1,
      size: 0,
      mtimeNs: "0",
      ctimeNs: "0",
      contentSha256: createHash("sha256").update("").digest("hex"),
    };
    Object.assign(state, {
      phase: "ralplan",
      prompt: "ship it",
      workflow: createWorkflowDescriptor("release-flow", {
        version: 1,
        stages: ["ralplan", "execution"],
      })!,
      workflowRunId: "11111111-1111-4111-8111-111111111111",
      pipelineTracking: {
        stages: [
          { id: "ralplan", status: "active", iterations: 0, startedAt: new Date().toISOString() },
          { id: "execution", status: "pending", iterations: 0 },
        ],
        currentStageIndex: 0,
        trackingRevision: 0,
        activationBoundary: {
          transcriptPath: join(testDir, `${sessionId}.jsonl`),
          transcriptRoot: testDir,
          transcriptBasename: `${sessionId}.jsonl`,
          sessionId,
          byteOffset: 0,
          fileIdentity: identity,
        },
        completionObservations: [],
      },
    });
    writeAutopilotState(testDir, state, sessionId);
    process.env.OMC_TEST_FLOCK_AVAILABLE = "0";

    // 模拟 dependent cleanup 失败:ralph.clearLinkedUltraworkState 返回 false
    vi.mocked(ralphLoop.readRalphState).mockReturnValue({
      active: true,
      linked_ultrawork: true,
    } as any);
    vi.mocked(ralphLoop.clearLinkedUltraworkState).mockReturnValueOnce(false);

    const first = cancelAutopilot(testDir, sessionId);

    // 事务性不变量:primary mutation 已提交(state.active=false),但整体失败,保留状态供重试
    expect(first.success).toBe(false);
    expect(first.preservedState).toBeDefined();
    expect(first.preservedState?.active).toBe(false);
    expect(first.message).toContain("ultrawork");

    // 重试应能成功完成 dependent cleanup
    const retried = cancelAutopilot(testDir, sessionId);
    expect(retried.success).toBe(true);
    expect(ralphLoop.clearLinkedUltraworkState).toHaveBeenCalledTimes(2);
  });

  // bc87f5a7 fix(autopilot): bind cancellation to current state
  it("应绑定到当前 state,run 在取消前被替换时拒绝取消并保留替换 run", () => {
    const sessionId = "txn-bind-current";
    const state = initAutopilot(testDir, "ship it", sessionId)!;
    const identity = {
      device: 1,
      inode: 1,
      size: 0,
      mtimeNs: "0",
      ctimeNs: "0",
      contentSha256: createHash("sha256").update("").digest("hex"),
    };
    Object.assign(state, {
      phase: "ralplan",
      prompt: "ship it",
      workflow: createWorkflowDescriptor("release-flow", {
        version: 1,
        stages: ["ralplan", "execution"],
      })!,
      workflowRunId: "11111111-1111-4111-8111-111111111111",
      pipelineTracking: {
        stages: [
          { id: "ralplan", status: "active", iterations: 0, startedAt: new Date().toISOString() },
          { id: "execution", status: "pending", iterations: 0 },
        ],
        currentStageIndex: 0,
        trackingRevision: 0,
        activationBoundary: {
          transcriptPath: join(testDir, `${sessionId}.jsonl`),
          transcriptRoot: testDir,
          transcriptBasename: `${sessionId}.jsonl`,
          sessionId,
          byteOffset: 0,
          fileIdentity: identity,
        },
        completionObservations: [],
      },
    });
    writeAutopilotState(testDir, state, sessionId);
    const statePath = resolveSessionStatePath("autopilot", sessionId, testDir);
    const replacement = { ...state, originalIdea: "replacement run" };
    process.env.OMC_TEST_FLOCK_AVAILABLE = "0";
    process.env.OMC_TEST_EMERGENCY_REPLACEMENT_PATH = statePath;
    process.env.OMC_TEST_EMERGENCY_REPLACEMENT_BASE64 = Buffer.from(
      JSON.stringify(replacement),
    ).toString("base64");

    const result = cancelAutopilot(testDir, sessionId);

    // 绑定不变量:取消应失败,且替换 run 应被保留(active=true)
    expect(result.success).toBe(false);
    expect(result.message).toContain("changed before cancellation");
    expect(readAutopilotState(testDir, sessionId)).toMatchObject({
      active: true,
      originalIdea: "replacement run",
    });
    expect(ralphLoop.clearRalphState).not.toHaveBeenCalled();
    expect(ultraqaLoop.clearUltraQAState).not.toHaveBeenCalled();
  });

  // f9b31680 fix(autopilot): authenticate named cancellation
  it("应认证 named cancellation 请求,结构损坏的 named state 取消时字节级保留且不清理 linked state", () => {
    const sessionId = "txn-auth-named";
    const state = initAutopilot(testDir, "ship it", sessionId)!;
    // 制造结构损坏的 named state:有 workflowRunId 但缺少 workflow 描述符
    state.workflowRunId = "11111111-1111-4111-8111-111111111111";
    writeAutopilotState(testDir, state, sessionId);
    const statePath = resolveSessionStatePath("autopilot", sessionId, testDir);
    const before = readFileSync(statePath);

    const result = cancelAutopilot(testDir, sessionId);

    // 认证不变量:结构损坏时返回 integrity_failed,字节保留,linked state 不被清理
    expect(result.success).toBe(false);
    expect(result.message).toBe("workflow_descriptor_integrity_failed");
    expect(readFileSync(statePath)).toEqual(before);
    expect(ralphLoop.clearRalphState).not.toHaveBeenCalled();
    expect(ralphLoop.clearLinkedUltraworkState).not.toHaveBeenCalled();
    expect(ultraqaLoop.clearUltraQAState).not.toHaveBeenCalled();
  });

  // 4cd39c32 fix(autopilot): scope global fallback cancellation
  it("global fallback cancellation(无 sessionId)应限定范围,不污染特定 session 的 linked state", () => {
    // 场景:存在一个 named session,但调用方未传 sessionId 进行 global fallback 取消
    const sessionId = "txn-global-scope";
    const state = initAutopilot(testDir, "ship it", sessionId)!;
    state.workflow = createWorkflowDescriptor("release-flow", {
      version: 1,
      stages: ["ralplan", "execution"],
    })!;
    state.workflowRunId = "11111111-1111-4111-8111-111111111111";
    writeAutopilotState(testDir, state, sessionId);

    // 全局 fallback 路径不应误清特定 session 的 linked state
    // 注意:不带 sessionId 的 cancelAutopilot 在 named workflow 存在时应 fail closed 或仅处理 global state
    const result = cancelAutopilot(testDir); // 无 sessionId

    // 限定范围不变量:不应成功清除 named session(因为没有 sessionId 绑定)
    // 至少不应清理未绑定的 linked state
    expect(ralphLoop.clearRalphState).not.toHaveBeenCalledWith(testDir, sessionId);
    expect(ultraqaLoop.clearUltraQAState).not.toHaveBeenCalledWith(testDir, sessionId);

    // 验证 named session state 仍然存在(或被正确处理,但未误清 linked)
    const persisted = readAutopilotState(testDir, sessionId);
    expect(persisted).not.toBeNull();
    // 结果应该是失败(integrity check 或 not active),不应是成功清除
    expect(result.success).toBe(false);
  });

  // d119a16d fix(autopilot): clear global fallback state
  it("clearAutopilot(无 sessionId)应清除 global fallback state,且不依赖特定 session", () => {
    // 场景:legacy 模式下,global autopilot state(无 session)应能被清除
    initAutopilot(testDir, "legacy global task"); // 不带 sessionId

    const result = clearAutopilot(testDir); // 无 sessionId

    expect(result.success).toBe(true);
    // global state 应被清除
    expect(readAutopilotState(testDir)).toBeNull();
  });

  it("clearAutopilot 对已完成的 global state 也应彻底清除,不残留 fallback artifacts", () => {
    initAutopilot(testDir, "completed global task");
    transitionPhase(testDir, "complete");

    const result = clearAutopilot(testDir);

    expect(result.success).toBe(true);
    expect(readAutopilotState(testDir)).toBeNull();
    // 不应残留任何 fallback artifacts
    const stateFile = join(testDir, ".omc", "state", "autopilot-state.json");
    expect(existsSync(stateFile)).toBe(false);
  });
});
