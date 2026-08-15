import { describe, expect, it } from 'vitest';
import {
  computeCacheHitRate,
  renderCacheRate,
  CACHE_RATE_OK_THRESHOLD,
  type CacheUsage,
} from '../../hud/elements/cache-rate.js';

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';

function strip(p: string | null): string {
  return (p ?? '').replace(/\x1b\[[0-9;]*m/g, '');
}

describe('computeCacheHitRate', () => {
  it('computes cache_read share of total input traffic', () => {
    const usage: CacheUsage = {
      inputTokens: 1000,
      cacheCreationInputTokens: 2000,
      cacheReadInputTokens: 7000,
    };
    // 7000 / (1000 + 2000 + 7000) = 70%
    expect(computeCacheHitRate(usage)).toBe(70);
  });

  it('returns 100 when everything was served from cache', () => {
    const usage: CacheUsage = {
      inputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 500,
    };
    expect(computeCacheHitRate(usage)).toBe(100);
  });

  it('returns null for null/undefined input', () => {
    expect(computeCacheHitRate(null)).toBeNull();
    expect(computeCacheHitRate(undefined)).toBeNull();
  });

  it('returns null when there is no cache traffic at all', () => {
    const usage: CacheUsage = {
      inputTokens: 100,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };
    expect(computeCacheHitRate(usage)).toBeNull();
  });

  it('clamps to 0-100', () => {
    const usage: CacheUsage = {
      inputTokens: -10,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 500,
    };
    const rate = computeCacheHitRate(usage);
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThanOrEqual(0);
    expect(rate!).toBeLessThanOrEqual(100);
  });
});

describe('renderCacheRate', () => {
  it('renders green when hit rate is at or above the 70% threshold', () => {
    const usage: CacheUsage = {
      inputTokens: 1000,
      cacheCreationInputTokens: 2000,
      cacheReadInputTokens: 7000,
    };
    const out = renderCacheRate(usage);
    expect(out).toContain(GREEN);
    expect(strip(out)).toBe('cache:70%');
  });

  it('renders yellow when hit rate is below the 70% threshold', () => {
    const usage: CacheUsage = {
      inputTokens: 5000,
      cacheCreationInputTokens: 3000,
      cacheReadInputTokens: 2000,
    };
    const out = renderCacheRate(usage);
    expect(out).toContain(YELLOW);
    expect(strip(out)).toBe('cache:20%');
  });

  it('uses localized label when provided', () => {
    const usage: CacheUsage = {
      inputTokens: 1000,
      cacheCreationInputTokens: 2000,
      cacheReadInputTokens: 7000,
    };
    const out = renderCacheRate(usage, { cache: '缓存' });
    expect(strip(out)).toBe('缓存:70%');
  });

  it('returns null when no cache data is present', () => {
    expect(renderCacheRate(null)).toBeNull();
    expect(renderCacheRate(undefined)).toBeNull();
  });

  it('exposes the 70% ok threshold constant', () => {
    expect(CACHE_RATE_OK_THRESHOLD).toBe(70);
  });
});
