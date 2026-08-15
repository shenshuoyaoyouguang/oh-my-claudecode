import { describe, it, expect } from 'vitest';
import { formatModelName, renderModel } from '../../hud/elements/model.js';

describe('model element', () => {
  describe('formatModelName', () => {
    it('returns Opus for opus model IDs', () => {
      expect(formatModelName('claude-opus-4-8-20260528')).toBe('Opus');
      expect(formatModelName('claude-3-opus-20240229')).toBe('Opus');
    });

    it('returns Sonnet for sonnet model IDs', () => {
      expect(formatModelName('claude-sonnet-4-20250514')).toBe('Sonnet');
      expect(formatModelName('claude-3-5-sonnet-20241022')).toBe('Sonnet');
    });

    it('returns Haiku for haiku model IDs', () => {
      expect(formatModelName('claude-3-haiku-20240307')).toBe('Haiku');
    });

    it('returns null for null/undefined', () => {
      expect(formatModelName(null)).toBeNull();
      expect(formatModelName(undefined)).toBeNull();
    });

    it('returns versioned name from model IDs', () => {
      expect(formatModelName('claude-opus-4-8-20260528', 'versioned')).toBe('Opus 4.8');
      expect(formatModelName('claude-sonnet-4-6-20260217', 'versioned')).toBe('Sonnet 4.6');
      expect(formatModelName('claude-sonnet-5', 'versioned')).toBe('Sonnet 5');
      expect(formatModelName('global.anthropic.claude-sonnet-5', 'versioned')).toBe('Sonnet 5');
      expect(formatModelName('claude-haiku-4-5-20251001', 'versioned')).toBe('Haiku 4.5');
    });

    it('returns versioned name from display names', () => {
      expect(formatModelName('Sonnet 4.5', 'versioned')).toBe('Sonnet 4.5');
      expect(formatModelName('Opus 4.8', 'versioned')).toBe('Opus 4.8');
      expect(formatModelName('Haiku 4.5', 'versioned')).toBe('Haiku 4.5');
    });

    it('returns versioned name from legacy raw model IDs', () => {
      expect(formatModelName('claude-3-5-sonnet-20241022', 'versioned')).toBe('Sonnet 3.5');
      expect(formatModelName('claude-3-opus-20240229', 'versioned')).toBe('Opus 3');
      expect(formatModelName('claude-3-sonnet-20240229', 'versioned')).toBe('Sonnet 3');
      expect(formatModelName('claude-3-haiku-20240307', 'versioned')).toBe('Haiku 3');
    });

    it('falls back to short name when no version found', () => {
      expect(formatModelName('claude-opus-latest', 'versioned')).toBe('Opus');
    });

    it('returns full model ID in full format', () => {
      expect(formatModelName('claude-opus-4-8-20260528', 'full')).toBe('claude-opus-4-8-20260528');
    });

    it('formats common external models with friendly family names', () => {
      expect(formatModelName('deepseek-v4-flash', 'versioned')).toBe('DeepSeek V4');
      expect(formatModelName('deepseek-reasoner', 'versioned')).toBe('DeepSeek');
      expect(formatModelName('gpt-4o', 'versioned')).toBe('GPT 4o');
      expect(formatModelName('qwen-max', 'versioned')).toBe('Qwen Max');
      expect(formatModelName('gemini-2.5-pro', 'versioned')).toBe('Gemini 2.5 Pro');
    });

    it('truncates long unrecognized model names', () => {
      const longName = 'some-very-long-model-name-that-exceeds-limit';
      expect(formatModelName(longName)?.length).toBeLessThanOrEqual(20);
    });
  });

  describe('renderModel', () => {
    // P0-2：标签 dim + 值用档位色，ANSI 断言需剥离转义后检查文本
    const strip = (s: string | null): string => (s ?? '').replace(/\x1b\[[0-9;]*m/g, '');

    it('renders formatted model name', () => {
      const result = renderModel('claude-opus-4-8-20260528');
      expect(result).not.toBeNull();
      expect(strip(result)).toContain('Model: Opus 4.8');
    });

    it('renders versioned format', () => {
      const result = renderModel('claude-opus-4-8-20260528', 'versioned');
      expect(result).not.toBeNull();
      expect(strip(result)).toContain('Model: Opus 4.8');
    });

    it('renders full format', () => {
      const result = renderModel('claude-opus-4-8-20260528', 'full');
      expect(result).not.toBeNull();
      expect(strip(result)).toContain('Model: claude-opus-4-8');
    });

    it('renders configured model label', () => {
      const result = renderModel('Claude Sonnet 4.5', 'versioned', { model: '模型' });
      expect(result).not.toBeNull();
      expect(strip(result)).toContain('模型: Sonnet 4.5');
    });

    it('returns null for null input', () => {
      expect(renderModel(null)).toBeNull();
    });
  });
});
