/**
 * Autopilot State Mutations & Named Integrity Tests (Red 阶段)
 *
 * 对应提交组1:state mutations 与 named integrity(~9 条)
 * - 9ac292dc fix(autopilot): gate named state mutations
 * - 3f479a9e fix(autopilot): protect cancellation surfaces
 * - c28806d2 fix(autopilot): unify named state integrity
 * - 9c4fbd2a fix(autopilot): complete named identity fences
 * - 2c238ae1 fix(autopilot): enforce portable named integrity
 * - 4ee8a8c0 fix(autopilot): harden public named workflow paths
 * - e3a883da fix(autopilot): fence first state write
 * - d3ed37cb fix(autopilot): close named workflow review gaps
 * - 456572c1 fix(autopilot): harden named workflow stop transitions
 *
 * 本文件聚焦于 state mutations 的 gating、cancellation surface 保护、
 * named identity fences 和首次 write fence 等不变量。
 *
 * 注:现有 state.test.ts 已覆盖基础 read/write/clear/transition 行为,
 * 本文件作为补充,聚焦于 named integrity 与 mutation gating 不变量。
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createHash } from "crypto";

import {
  initAutopilot,
  readAutopilotState,
  writeAutopilotState,
  updateAutopilotStateIfCurrent,
  updateAutopilotStateIfExact,
  clearAutopilotState,
  transitionPhase,
} from "../state.js";
import { createWorkflowDescriptor } from "../pipeline.js";
import { validateNamedWorkflowStateStructure } from "../named-workflow-resume-validator.js";
import { resolveSessionStatePath } from "../../../lib/worktree-paths.js";
import type { AutopilotState } from "../types.js";

describe("autopilot state mutations", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "autopilot-state-mutations-"));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    delete process.env.OMC_TEST_FLOCK_AVAILABLE;
    delete process.env.OMC_TEST_CONDITIONAL_WRITE_REPLACEMENT_PATH;
    delete process.env.OMC_TEST_CONDITIONAL_WRITE_REPLACEMENT_BASE64;
    delete process.env.OMC_TEST_CONDITIONAL_CLEAR_REPLACEMENT_PATH;
    delete process.env.OMC_TEST_CONDITIONAL_CLEAR_REPLACEMENT_BASE64;
  });

  // 辅助函数:构造一个完整可用的 named workflow state
  function buildNamedState(sessionId: string): AutopilotState {
    const base = initAutopilot(testDir, "ship it", sessionId)!;
    const identity = {
      device: 1,
      inode: 1,
      size: 0,
      mtimeNs: "0",
      ctimeNs: "0",
      contentSha256: createHash("sha256").update("").digest("hex"),
    };
    const descriptor = createWorkflowDescriptor("release-flow", {
      version: 1,
      stages: ["ralplan", "execution"],
    })!;
    Object.assign(base, {
      phase: "ralplan",
      prompt: "ship it",
      workflow: descriptor,
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
    return base;
  }

  // 9ac292dc fix(autopilot): gate named state mutations
  it("应原子性地 gate named state mutations:observed state 不匹配时拒绝 mutation 且不破坏字节", () => {
    const sessionId = "gate-named-mutation";
    const state = buildNamedState(sessionId);
    writeAutopilotState(testDir, state, sessionId);
    const statePath = resolveSessionStatePath("autopilot", sessionId, testDir);
    const before = readFileSync(statePath);

    // 模拟 runtime 不支持 flock
    process.env.OMC_TEST_FLOCK_AVAILABLE = "0";

    // 用一个不匹配的 observed state 尝试 mutation
    const mismatchedObserved = { ...state, workflowRunId: "22222222-2222-4222-8222-222222222222" };
    const result = updateAutopilotStateIfCurrent(
      testDir,
      mismatchedObserved,
      { active: false },
      sessionId,
    );

    // gate 不变量:不匹配时返回 null,字节保留
    expect(result).toBeNull();
    expect(readFileSync(statePath)).toEqual(before);
  });

  // 3f479a9e fix(autopilot): protect cancellation surfaces
  it("应保护 cancellation surfaces:cancelled named state 不应被非法 reactivation", () => {
    const sessionId = "protect-cancel-surface";
    const state = buildNamedState(sessionId);
    state.active = false; // 模拟已 cancelled
    writeAutopilotState(testDir, state, sessionId);
    process.env.OMC_TEST_FLOCK_AVAILABLE = "0";

    // 尝试用一个 active=true 的 observed state 来"reactivate"
    // 但 observed 与 disk 不匹配(workflowRunId 不同),应被拒绝
    const forgedActive = { ...state, active: true, workflowRunId: "33333333-3333-4333-8333-333333333333" };
    const result = updateAutopilotStateIfCurrent(
      testDir,
      forgedActive,
      { active: true },
      sessionId,
    );

    // 保护不变量:forged reactivation 应被拒绝
    expect(result).toBeNull();
    const persisted = readAutopilotState(testDir, sessionId);
    expect(persisted?.active).toBe(false);
    expect(persisted?.workflowRunId).toBe(state.workflowRunId);
  });

  // c28806d2 fix(autopilot): unify named state integrity
  it("应统一 named state integrity:structural validation 应在所有 mutation 路径上一致", () => {
    const sessionId = "unify-integrity";
    const state = buildNamedState(sessionId);
    writeAutopilotState(testDir, state, sessionId);

    // 原始 state 应通过 structural validation
    const original = readAutopilotState(testDir, sessionId)!;
    expect(validateNamedWorkflowStateStructure(original, sessionId)).not.toBeNull();

    // 篡改 workflowRunId 为空字符串(破坏 named identity)
    const tampered = { ...original, workflowRunId: "" };
    writeAutopilotState(testDir, tampered, sessionId);

    // 统一 integrity 不变量:所有路径都应拒绝被篡改的 state
    process.env.OMC_TEST_FLOCK_AVAILABLE = "0";
    expect(validateNamedWorkflowStateStructure(tampered, sessionId)).toBeNull();

    // updateAutopilotStateIfCurrent 也应拒绝
    const updateResult = updateAutopilotStateIfCurrent(
      testDir,
      tampered,
      { active: false },
      sessionId,
    );
    expect(updateResult).toBeNull();
  });

  // 9c4fbd2a fix(autopilot): complete named identity fences
  it("应完成 named identity fences:workflowRunId 与 profileHash 共同构成 identity fence", () => {
    const sessionId = "identity-fence";
    const state = buildNamedState(sessionId);
    writeAutopilotState(testDir, state, sessionId);
    process.env.OMC_TEST_FLOCK_AVAILABLE = "0";

    // 仅 workflowRunId 匹配但 profileHash 不同应被拒绝
    const sameRunIdDiffHash = {
      ...state,
      workflow: { ...state.workflow!, profileHash: "0".repeat(64) },
    };
    writeAutopilotState(testDir, sameRunIdDiffHash, sessionId);
    const diskState = readAutopilotState(testDir, sessionId)!;

    // 用原始 state(observed)尝试 mutation,disk 已被篡改
    const result = updateAutopilotStateIfCurrent(
      testDir,
      state, // observed 是原始 state
      { active: false },
      sessionId,
    );

    // identity fence 不变量:disk state 与 observed 不匹配(profileHash 不同),应拒绝
    expect(result).toBeNull();
    // disk 应保留篡改后的 state(因为 mutation 被拒绝,未变更)
    expect(readAutopilotState(testDir, sessionId)?.workflow?.profileHash).toBe("0".repeat(64));
  });

  // e3a883da fix(autopilot): fence first state write
  it("应在首次 state write 时建立 fence:initAutopilot 应写入完整的 identity 字段", () => {
    const sessionId = "first-write-fence";
    const state = initAutopilot(testDir, "brand new run", sessionId);

    expect(state).not.toBeNull();
    // identity fence 字段应被写入
    expect(state!.session_id).toBe(sessionId);
    expect(state!.started_at).toBeDefined();
    expect(typeof state!.started_at).toBe("string");
    expect(state!.active).toBe(true);
    expect(state!.phase).toBe("expansion");
    expect(state!.iteration).toBe(1);

    // 重新读取应与写入一致(fence 已建立)
    const reread = readAutopilotState(testDir, sessionId);
    expect(reread).not.toBeNull();
    expect(reread?.session_id).toBe(sessionId);
    expect(reread?.started_at).toBe(state!.started_at);
  });

  it("首次 write 后,clearAutopilotState 应能基于 expectedState 安全清除 named state", () => {
    const sessionId = "first-write-clear";
    const state = buildNamedState(sessionId);
    writeAutopilotState(testDir, state, sessionId);
    process.env.OMC_TEST_FLOCK_AVAILABLE = "0";

    // expectedState 匹配时应能清除
    const expected = readAutopilotState(testDir, sessionId)!;
    const cleared = clearAutopilotState(testDir, sessionId, expected);
    expect(cleared).toBe(true);
    expect(readAutopilotState(testDir, sessionId)).toBeNull();
  });

  it("首次 write 后,clearAutopilotState 应拒绝与 disk 不匹配的 expectedState", () => {
    const sessionId = "first-write-clear-mismatch";
    const state = buildNamedState(sessionId);
    writeAutopilotState(testDir, state, sessionId);
    process.env.OMC_TEST_FLOCK_AVAILABLE = "0";

    // 用一个不匹配的 expectedState(workflowRunId 不同)尝试 clear
    const mismatchedExpected = {
      ...state,
      workflowRunId: "55555555-5555-4555-8555-555555555555",
    };
    const cleared = clearAutopilotState(testDir, sessionId, mismatchedExpected);

    // 不匹配时应拒绝清除
    expect(cleared).toBe(false);
    expect(readAutopilotState(testDir, sessionId)).not.toBeNull();
  });
});
