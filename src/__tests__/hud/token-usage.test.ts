import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { parseTranscript } from "../../hud/transcript.js";
import {
  renderTokenUsage,
  splitTokenUsage,
} from "../../hud/elements/token-usage.js";

const tempDirs: string[] = [];

function createTempTranscript(lines: unknown[]): string {
  const dir = mkdtempSync(join(tmpdir(), "omc-hud-token-usage-"));
  tempDirs.push(dir);

  const transcriptPath = join(dir, "transcript.jsonl");
  writeFileSync(
    transcriptPath,
    `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
    "utf8",
  );

  return transcriptPath;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("HUD transcript token usage plumbing", () => {
  it("captures the latest transcript message usage as last-request input/output tokens", async () => {
    const transcriptPath = createTempTranscript([
      {
        timestamp: "2026-03-12T00:00:00.000Z",
        message: {
          usage: { input_tokens: 120, output_tokens: 45 },
          content: [],
        },
      },
      {
        timestamp: "2026-03-12T00:01:00.000Z",
        message: {
          usage: { input_tokens: 1530, output_tokens: 987 },
          content: [],
        },
      },
    ]);

    const result = await parseTranscript(transcriptPath);

    expect(result.lastRequestTokenUsage).toEqual({
      inputTokens: 1530,
      outputTokens: 987,
    });
    expect(result.sessionTotalTokens).toBe(2682);
  });

  it("treats missing token fields as zero when transcript usage only exposes one side", async () => {
    const transcriptPath = createTempTranscript([
      {
        timestamp: "2026-03-12T00:00:00.000Z",
        message: {
          usage: { output_tokens: 64 },
          content: [],
        },
      },
    ]);

    const result = await parseTranscript(transcriptPath);

    expect(result.lastRequestTokenUsage).toEqual({
      inputTokens: 0,
      outputTokens: 64,
    });
    expect(result.sessionTotalTokens).toBe(64);
  });

  it("captures reasoning tokens when transcript usage exposes them", async () => {
    const transcriptPath = createTempTranscript([
      {
        timestamp: "2026-03-12T00:00:00.000Z",
        message: {
          usage: {
            input_tokens: 1200,
            output_tokens: 450,
            output_tokens_details: { reasoning_tokens: 321 },
          },
          content: [],
        },
      },
    ]);

    const result = await parseTranscript(transcriptPath);

    expect(result.lastRequestTokenUsage).toEqual({
      inputTokens: 1200,
      outputTokens: 450,
      reasoningTokens: 321,
    });
    expect(result.sessionTotalTokens).toBe(1650);
  });

  it("returns stable transcript results across repeated parses of an unchanged file", async () => {
    const transcriptPath = createTempTranscript([
      {
        timestamp: "2026-03-12T00:00:00.000Z",
        message: {
          usage: { input_tokens: 120, output_tokens: 45 },
          content: [],
        },
      },
    ]);

    const first = await parseTranscript(transcriptPath);
    first.todos.push({ content: "mutated", status: "pending" });

    const second = await parseTranscript(transcriptPath);

    expect(second.lastRequestTokenUsage).toEqual({
      inputTokens: 120,
      outputTokens: 45,
    });
    expect(second.todos).toEqual([]);
  });

  it("omits session totals when the transcript contains multiple session IDs", async () => {
    const transcriptPath = createTempTranscript([
      {
        sessionId: "session-a",
        timestamp: "2026-03-12T00:00:00.000Z",
        message: {
          usage: { input_tokens: 100, output_tokens: 50 },
          content: [],
        },
      },
      {
        sessionId: "session-b",
        timestamp: "2026-03-12T00:01:00.000Z",
        message: {
          usage: { input_tokens: 200, output_tokens: 75 },
          content: [],
        },
      },
    ]);

    const result = await parseTranscript(transcriptPath);

    expect(result.lastRequestTokenUsage).toEqual({
      inputTokens: 200,
      outputTokens: 75,
    });
    expect(result.sessionTotalTokens).toBeUndefined();
  });
});

describe("HUD token usage rendering", () => {
  it("formats last-request token usage with ↑/↓ arrows for input/output", () => {
    const out = renderTokenUsage({ inputTokens: 1530, outputTokens: 987 });
    // strip ANSI to assert structure
    const stripped = out!.replace(/\x1b\[[0-9;]*m/g, "");
    // ↑ = input (sent to model), ↓ = output (received from model)
    expect(stripped).toBe("↑1.5k ↓987");
  });

  it("includes reasoning (magenta r:) and session total (cyan tot:) when available", () => {
    const out = renderTokenUsage(
      { inputTokens: 1530, outputTokens: 987, reasoningTokens: 321 },
      8765,
    );
    const stripped = out!.replace(/\x1b\[[0-9;]*m/g, "");
    // P0-3：r→r:、s→tot:（带冒号自解释前缀）
    expect(stripped).toBe("↑1.5k ↓987 r:321 tot:8.8k");
    // reasoning uses magenta, session uses cyan
    expect(out).toContain("\x1b[35m");
    expect(out).toContain("\x1b[36m");
  });

  it("splits token usage into I/O/S parts for region-aware rendering", () => {
    const parts = splitTokenUsage(
      { inputTokens: 1530, outputTokens: 987, reasoningTokens: 321 },
      8765,
    );
    expect(parts).not.toBeNull();
    const strip = (p: string | null): string =>
      (p ?? "").replace(/\x1b\[[0-9;]*m/g, "");
    expect(strip(parts!.input)).toBe("↑1.5k");
    expect(strip(parts!.output)).toBe("↓987");
    // P0-3：r→r:、s→tot:
    expect(strip(parts!.reasoning)).toBe("r:321");
    expect(strip(parts!.session)).toBe("tot:8.8k");
  });

  it("returns null from splitTokenUsage when no usage is available", () => {
    expect(splitTokenUsage(null)).toBeNull();
  });

  it("returns null when no last-request token usage is available", () => {
    expect(renderTokenUsage(null)).toBeNull();
  });
});
