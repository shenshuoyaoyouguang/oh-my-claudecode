import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { parseTranscript } from '../../hud/transcript.js';
import { renderTokenUsage } from '../../hud/elements/token-usage.js';
import { getContextPercent, getCurrentRequestTokenUsage } from '../../hud/stdin.js';

const tempDirs: string[] = [];

function createTempTranscript(lines: unknown[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'omc-hud-token-usage-'));
  tempDirs.push(dir);

  const transcriptPath = join(dir, 'transcript.jsonl');
  writeFileSync(
    transcriptPath,
    `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
    'utf8',
  );

  return transcriptPath;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('HUD transcript token usage plumbing', () => {
  it('captures the latest transcript message usage as last-request input/output tokens', async () => {
    const transcriptPath = createTempTranscript([
      {
        timestamp: '2026-03-12T00:00:00.000Z',
        message: {
          usage: { input_tokens: 120, output_tokens: 45 },
          content: [],
        },
      },
      {
        timestamp: '2026-03-12T00:01:00.000Z',
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

  it('treats missing token fields as zero when transcript usage only exposes one side', async () => {
    const transcriptPath = createTempTranscript([
      {
        timestamp: '2026-03-12T00:00:00.000Z',
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

  it('captures reasoning tokens when transcript usage exposes them', async () => {
    const transcriptPath = createTempTranscript([
      {
        timestamp: '2026-03-12T00:00:00.000Z',
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

  it('omits session totals when the transcript contains multiple session IDs', async () => {
    const transcriptPath = createTempTranscript([
      {
        sessionId: 'session-a',
        timestamp: '2026-03-12T00:00:00.000Z',
        message: {
          usage: { input_tokens: 100, output_tokens: 50 },
          content: [],
        },
      },
      {
        sessionId: 'session-b',
        timestamp: '2026-03-12T00:01:00.000Z',
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

describe('HUD stdin token usage helpers', () => {
  it('reads current request token usage from statusline stdin', () => {
    const stdin = {
      transcript_path: '/tmp/transcript.jsonl',
      cwd: '/tmp',
      model: { id: 'claude-sonnet', display_name: 'Claude Sonnet' },
      context_window: {
        context_window_size: 200000,
        current_usage: {
          input_tokens: 1530,
          output_tokens: 987,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
    };

    expect(getCurrentRequestTokenUsage(stdin)).toEqual({
      inputTokens: 1530,
      outputTokens: 987,
    });
  });

  it('returns null when current request usage has no input or output tokens', () => {
    const stdin = {
      transcript_path: '/tmp/transcript.jsonl',
      cwd: '/tmp',
      model: { id: 'claude-sonnet', display_name: 'Claude Sonnet' },
      context_window: {
        context_window_size: 200000,
        current_usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_creation_input_tokens: 120,
          cache_read_input_tokens: 340,
        },
      },
    };

    expect(getCurrentRequestTokenUsage(stdin)).toBeNull();
  });

  it('returns null when output tokens are unavailable in statusline stdin', () => {
    const stdin = {
      transcript_path: '/tmp/transcript.jsonl',
      cwd: '/tmp',
      model: { id: 'claude-sonnet', display_name: 'Claude Sonnet' },
      context_window: {
        context_window_size: 200000,
        current_usage: {
          input_tokens: 1530,
          cache_creation_input_tokens: 120,
          cache_read_input_tokens: 340,
        },
      },
    };

    expect(getCurrentRequestTokenUsage(stdin)).toBeNull();
  });

  it('keeps output tokens out of context percentage calculations', () => {
    const stdin = {
      transcript_path: '/tmp/transcript.jsonl',
      cwd: '/tmp',
      model: { id: 'claude-sonnet', display_name: 'Claude Sonnet' },
      context_window: {
        context_window_size: 1000,
        current_usage: {
          input_tokens: 100,
          output_tokens: 900,
          cache_creation_input_tokens: 50,
          cache_read_input_tokens: 50,
        },
      },
    };

    expect(getContextPercent(stdin)).toBe(20);
  });
});

describe('HUD token usage rendering', () => {
  it('formats last-request token usage as a compact total', () => {
    expect(renderTokenUsage({ inputTokens: 1530, outputTokens: 987 })).toBe('tok 2.5k');
  });

  it('shows approximate session totals when available', () => {
    expect(
      renderTokenUsage(
        { inputTokens: 1530, outputTokens: 987, reasoningTokens: 321 },
        8765,
      ),
    ).toBe('tok 2.5k · total ~8.7k');
  });

  it('uses ASCII separators when requested', () => {
    expect(
      renderTokenUsage({ inputTokens: 37600, outputTokens: 109 }, 37709, true),
    ).toBe('tok 37.7k | total ~37.7k');
  });

  it('returns null when no last-request token usage is available', () => {
    expect(renderTokenUsage(null)).toBeNull();
  });
});
