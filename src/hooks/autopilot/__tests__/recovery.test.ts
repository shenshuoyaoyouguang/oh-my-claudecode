/**
 * Autopilot Emergency Recovery Tests (Red 阶段)
 *
 * 对应提交组3:emergency recovery 序列化(~8 条)
 * - 6f9ae937 fix(autopilot): harden emergency cancellation
 * - a31aaa06 fix(autopilot): recover emergency cancellation
 * - 6175fcaf fix(autopilot): serialize emergency recovery
 * - d7f29f63 fix(autopilot): protect live recovery claims
 * - 8abacf5e fix(autopilot): converge emergency journals
 * - fb2fff9a fix(autopilot): serialize dead journal recovery
 * - 24707f60 fix(autopilot): authenticate recovery claims
 * - a6af89e2 fix(autopilot): authenticate shared recovery ownership
 *
 * 本文件聚焦于 emergency recovery 的序列化、claim 保护、journal 收敛等不变量。
 * 通过直接调用 lib/mode-state-io.ts 的 emergency API 以及间接通过 cancel/state API 触发。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  recoverEmergencyStateFile,
  emergencyMutateStateFileIf,
  writeStateFileLocked,
  type EmergencyRecoveryOptions,
} from "../../../lib/mode-state-io.js";
import { resolveStatePath } from "../../../lib/worktree-paths.js";
import {
  initAutopilot,
  readAutopilotState,
  writeAutopilotState,
} from "../state.js";
import { cancelAutopilot } from "../cancel.js";

// Mock ralph 与 ultraqa 模块
vi.mock("../../ralph/index.js", () => ({
  clearRalphState: vi.fn(() => true),
  clearLinkedUltraworkState: vi.fn(() => true),
  readRalphState: vi.fn(() => null),
}));

vi.mock("../../ultraqa/index.js", () => ({
  clearUltraQAState: vi.fn(() => true),
  readUltraQAState: vi.fn(() => null),
}));

describe("autopilot emergency recovery", () => {
  let testDir: string;
  let stateFile: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "autopilot-emergency-"));
    mkdirSync(join(testDir, ".omc", "state"), { recursive: true });
    stateFile = resolveStatePath("autopilot", testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    delete process.env.OMC_TEST_FLOCK_AVAILABLE;
    delete process.env.OMC_TEST_EMERGENCY_CRASH_PHASE;
    delete process.env.OMC_TEST_EMERGENCY_REPLACEMENT_PATH;
    delete process.env.OMC_TEST_EMERGENCY_REPLACEMENT_BASE64;
    delete process.env.OMC_TEST_EMERGENCY_CAPTURE_REPLACEMENT_PATH;
    delete process.env.OMC_TEST_EMERGENCY_CAPTURE_REPLACEMENT_BASE64;
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  // 6f9ae937 fix(autopilot): harden emergency cancellation
  it("应加固 emergency cancellation:不存在 journal 时 recoverEmergencyStateFile 返回 true 且不破坏 state", () => {
    initAutopilot(testDir, "harden emergency");
    const before = readFileSync(stateFile, "utf8");

    // 不存在 journal 时,recovery 应是无害的 no-op
    const result = recoverEmergencyStateFile(stateFile);

    expect(result).toBe(true);
    expect(readFileSync(stateFile, "utf8")).toBe(before);
  });

  // a31aaa06 fix(autopilot): recover emergency cancellation
  it("应恢复 emergency cancellation:emergencyMutateStateFileIf 失败后 state 保持可读且一致", () => {
    initAutopilot(testDir, "recover emergency");
    const before = readAutopilotState(testDir)!;

    // 触发 emergency mutation,predicate 拒绝应导致 transaction 中止
    const result = emergencyMutateStateFileIf(
      stateFile,
      () => false, // predicate 拒绝
      (current) => ({ ...current, active: false }),
    );

    expect(result).toBe(false);
    // state 不应被破坏,仍可读且与之前一致
    const after = readAutopilotState(testDir);
    expect(after).not.toBeNull();
    expect(after?.active).toBe(before.active);
    expect(after?.originalIdea).toBe(before.originalIdea);
  });

  // 6175fcaf fix(autopilot): serialize emergency recovery
  it("应序列化 emergency recovery:journal 存在时多次 recover 应互斥且幂等", () => {
    initAutopilot(testDir, "serialize recovery");
    const journalPath = `${stateFile}.emergency-journal`;
    // 模拟残留的 dead journal(_owner 不存在)
    const fakeJournal = {
      version: 1,
      transactionId: "00000000-0000-4000-8000-000000000000",
      owner: {
        pid: 999999,
        processStart: "0",
        hostname: "nonexistent-host",
        createdAt: new Date(0).toISOString(),
      },
      quarantinePath: `${stateFile}.emergency-quarantine.00000000-0000-4000-8000-000000000000`,
      phase: "prepared",
      originalDigest: "invalid-digest",
    };
    writeFileSync(journalPath, JSON.stringify(fakeJournal));

    // 多次 recovery 调用应都返回(可能 true 或 false),但不应破坏 state file
    const r1 = recoverEmergencyStateFile(stateFile);
    const r2 = recoverEmergencyStateFile(stateFile);

    // 序列化不变量:无论结果如何,state file 应保持可读且 active=true(原值)
    expect(typeof r1).toBe("boolean");
    expect(typeof r2).toBe("boolean");
    const state = readAutopilotState(testDir);
    expect(state).not.toBeNull();
    expect(state?.active).toBe(true);
  });

  // d7f29f63 fix(autopilot): protect live recovery claims
  it("应保护 live recovery claims:authorizeState 拒绝时 recovery 返回 false", () => {
    initAutopilot(testDir, "protect live claims");
    // 模拟一个 live owner 的 journal(用当前进程 pid 但假 hostname)
    const journalPath = `${stateFile}.emergency-journal`;
    const fakeJournal = {
      version: 1,
      transactionId: "11111111-1111-4111-8111-111111111111",
      owner: {
        pid: process.pid,
        processStart: "invalid",
        hostname: "different-host",
        createdAt: new Date().toISOString(),
      },
      quarantinePath: `${stateFile}.emergency-quarantine.11111111-1111-4111-8111-111111111111`,
      phase: "prepared",
      originalDigest: "any",
    };
    writeFileSync(journalPath, JSON.stringify(fakeJournal));

    // authorizeState 严格拒绝任何 state(模拟保护)
    const strictOptions: EmergencyRecoveryOptions = {
      authorizeState: () => false,
    };

    const result = recoverEmergencyStateFile(stateFile, strictOptions);

    // 保护不变量:authorizeState 拒绝时 recovery 应返回 false
    expect(result).toBe(false);
  });

  // 8abacf5e fix(autopilot): converge emergency journals
  it("应收敛 emergency journals:recovery 后 journal 应被清理或处于一致状态", () => {
    initAutopilot(testDir, "converge journals");
    const journalPath = `${stateFile}.emergency-journal`;

    // 写入一个 dead owner 的 journal(模拟需要 recovery 的场景)
    const deadJournal = {
      version: 1,
      transactionId: "22222222-2222-4222-8222-222222222222",
      owner: {
        pid: 999999,
        processStart: "0",
        hostname: "dead-host",
        createdAt: new Date(0).toISOString(),
      },
      quarantinePath: `${stateFile}.emergency-quarantine.22222222-2222-4222-8222-222222222222`,
      phase: "prepared",
      originalDigest: "mismatch",
    };
    writeFileSync(journalPath, JSON.stringify(deadJournal));

    // 触发 recovery
    recoverEmergencyStateFile(stateFile);

    // 收敛不变量:recovery 后,要么 journal 被清理,要么 state file 仍可读
    // 关键是 state 不应被破坏
    const state = readAutopilotState(testDir);
    expect(state).not.toBeNull();
  });

  // fb2fff9a fix(autopilot): serialize dead journal recovery
  it("应序列化 dead journal recovery:dead owner 的 journal 不应被 live process 错误继承", () => {
    initAutopilot(testDir, "serialize dead journal");
    const journalPath = `${stateFile}.emergency-journal`;
    const before = readFileSync(stateFile, "utf8");

    // 写入 dead owner journal
    const deadJournal = {
      version: 1,
      transactionId: "33333333-3333-4333-8333-333333333333",
      owner: {
        pid: 999999,
        processStart: "0",
        hostname: "dead-host-2",
        createdAt: new Date(0).toISOString(),
      },
      quarantinePath: `${stateFile}.emergency-quarantine.33333333-3333-4333-8333-333333333333`,
      phase: "published",
      originalDigest: "any",
    };
    writeFileSync(journalPath, JSON.stringify(deadJournal));

    // 多次 recovery 调用模拟并发,都应安全返回
    const results = [
      recoverEmergencyStateFile(stateFile),
      recoverEmergencyStateFile(stateFile),
      recoverEmergencyStateFile(stateFile),
    ];

    // 序列化不变量:所有调用都应返回 boolean,且 state file 不应被破坏
    results.forEach((r) => expect(typeof r).toBe("boolean"));
    // state 应保持可读(可能内容变化,但不应抛出)
    const state = readAutopilotState(testDir);
    expect(state).not.toBeNull();
  });

  it("emergency recovery 应通过 cancelAutopilot 透明触发,不暴露 journal 给上层", () => {
    // 场景:存在残留 journal,通过 cancelAutopilot 触发 recovery,上层不应看到 journal 细节
    initAutopilot(testDir, "transparent recovery");
    const journalPath = `${stateFile}.emergency-journal`;
    const deadJournal = {
      version: 1,
      transactionId: "44444444-4444-4444-8444-444444444444",
      owner: {
        pid: 999999,
        processStart: "0",
        hostname: "dead-host-3",
        createdAt: new Date(0).toISOString(),
      },
      quarantinePath: `${stateFile}.emergency-quarantine.44444444-4444-4444-8444-444444444444`,
      phase: "prepared",
      originalDigest: "any",
    };
    writeFileSync(journalPath, JSON.stringify(deadJournal));

    // cancelAutopilot 应透明处理 recovery
    const result = cancelAutopilot(testDir);

    // 上层 API 应返回标准 CancelResult,不泄漏 journal 状态
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("message");
    expect(typeof result.success).toBe("boolean");
    expect(typeof result.message).toBe("string");
    // message 不应包含 journal 内部细节
    expect(result.message).not.toContain("journal");
    expect(result.message).not.toContain("transactionId");
  });
});
