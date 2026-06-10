import { describe, it, expect, vi } from 'vitest';
import { renderCallCounts } from '../../hud/elements/call-counts.js';
import { DEFAULT_HUD_CONFIG, PRESET_CONFIGS } from '../../hud/types.js';
// On Windows, auto mode picks ASCII. Mock to non-Windows so default tests get emoji.
vi.mock('../../platform/index.js', () => ({ isWSL: () => false }));
const originalPlatform = process.platform;
Object.defineProperty(process, 'platform', { value: 'linux' });
describe('renderCallCounts', () => {
    describe('basic rendering', () => {
        it('renders all three counts when all are non-zero', () => {
            const result = renderCallCounts(42, 7, 3);
            expect(result).not.toBeNull();
            expect(result).toContain('🔧42');
            expect(result).toContain('🤖7');
            expect(result).toContain('⚡3');
        });
        it('returns null when all counts are zero', () => {
            const result = renderCallCounts(0, 0, 0);
            expect(result).toBeNull();
        });
        it('renders only tool count when only tools are non-zero', () => {
            const result = renderCallCounts(10, 0, 0);
            expect(result).toBe('🔧10');
        });
        it('renders only agent count when only agents are non-zero', () => {
            const result = renderCallCounts(0, 5, 0);
            expect(result).toBe('🤖5');
        });
        it('renders only skill count when only skills are non-zero', () => {
            const result = renderCallCounts(0, 0, 2);
            expect(result).toBe('⚡2');
        });
    });
    describe('partial counts', () => {
        it('omits zero tool count', () => {
            const result = renderCallCounts(0, 3, 1);
            expect(result).not.toContain('🔧');
            expect(result).toContain('🤖3');
            expect(result).toContain('⚡1');
        });
        it('omits zero agent count', () => {
            const result = renderCallCounts(15, 0, 2);
            expect(result).toContain('🔧15');
            expect(result).not.toContain('🤖');
            expect(result).toContain('⚡2');
        });
        it('omits zero skill count', () => {
            const result = renderCallCounts(8, 4, 0);
            expect(result).toContain('🔧8');
            expect(result).toContain('🤖4');
            expect(result).not.toContain('⚡');
        });
    });
    describe('output format', () => {
        it('supports explicit ASCII rendering overrides', () => {
            const result = renderCallCounts(5, 2, 1, 'ascii');
            // ASCII labels use APPLE_GRAY color codes
            expect(result).toContain('T:');
            expect(result).toContain('5');
            expect(result).toContain('A:');
            expect(result).toContain('2');
            expect(result).toContain('S:');
            expect(result).toContain('1');
        });
        it('supports explicit emoji rendering overrides', () => {
            const result = renderCallCounts(5, 2, 1, 'emoji');
            expect(result).toBe('🔧5 🤖2 ⚡1');
        });
        it('separates parts with a space', () => {
            const result = renderCallCounts(5, 2, 1);
            expect(result).toBe('🔧5 🤖2 ⚡1');
        });
        it('handles large numbers', () => {
            const result = renderCallCounts(1000, 99, 50);
            expect(result).toContain('🔧1000');
            expect(result).toContain('🤖99');
            expect(result).toContain('⚡50');
        });
    });
});
describe('showCallCounts config option', () => {
    it('DEFAULT_HUD_CONFIG uses auto call-count icon selection', () => {
        expect(DEFAULT_HUD_CONFIG.elements.callCountsFormat).toBe('auto');
    });
    it('DEFAULT_HUD_CONFIG has showCallCounts enabled', () => {
        expect(DEFAULT_HUD_CONFIG.elements.showCallCounts).toBe(true);
    });
    it('minimal preset disables showCallCounts', () => {
        expect(PRESET_CONFIGS.minimal.showCallCounts).toBe(false);
    });
    it('focused preset enables showCallCounts', () => {
        expect(PRESET_CONFIGS.focused.showCallCounts).toBe(true);
    });
    it('full preset enables showCallCounts', () => {
        expect(PRESET_CONFIGS.full.showCallCounts).toBe(true);
    });
    it('dense preset enables showCallCounts', () => {
        expect(PRESET_CONFIGS.dense.showCallCounts).toBe(true);
    });
    it('opencode preset enables showCallCounts', () => {
        expect(PRESET_CONFIGS.opencode.showCallCounts).toBe(true);
    });
});
//# sourceMappingURL=call-counts.test.js.map