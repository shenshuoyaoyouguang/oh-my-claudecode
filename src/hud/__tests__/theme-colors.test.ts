/**
 * Tests for the semantic color system and preset theme palettes.
 */
import { describe, it, expect } from "vitest";
import {
  resolveThemeColor,
  resolveThemeColors,
  PRESET_THEME_COLORS,
  thresholdColor,
  ThemeColors,
} from "../colors.js";

describe("PRESET_THEME_COLORS", () => {
  it("defines all 5 presets", () => {
    expect(Object.keys(PRESET_THEME_COLORS)).toHaveLength(5);
    expect(PRESET_THEME_COLORS).toHaveProperty("focused");
    expect(PRESET_THEME_COLORS).toHaveProperty("minimal");
    expect(PRESET_THEME_COLORS).toHaveProperty("full");
    expect(PRESET_THEME_COLORS).toHaveProperty("dense");
    expect(PRESET_THEME_COLORS).toHaveProperty("opencode");
  });

  it("has all 6 semantic colors per preset", () => {
    const semantics: Array<keyof ThemeColors> = [
      "success",
      "warning",
      "error",
      "info",
      "muted",
      "accent",
    ];
    for (const [, palette] of Object.entries(PRESET_THEME_COLORS)) {
      for (const sem of semantics) {
        expect(palette[sem]).toBeTypeOf("string");
        expect(palette[sem].length).toBeGreaterThan(0);
      }
    }
  });

  it("focused preset maps to Apple palette (current default)", () => {
    const apple = PRESET_THEME_COLORS.focused;
    // All Apple palette colors should be 24-bit true color
    for (const key of Object.keys(apple) as Array<keyof ThemeColors>) {
      expect(apple[key]).toContain("\x1b[38;2;");
    }
  });

  it("minimal preset uses low-noise colors (dim/white/red only)", () => {
    const m = PRESET_THEME_COLORS.minimal;
    // success/info/muted should be dim (not full color)
    expect(m.success).toBe("\x1b[2m");
    expect(m.info).toBe("\x1b[2m");
    expect(m.muted).toBe("\x1b[2m");
    // warning/accent should be white (normal brightness, no hue)
    expect(m.warning).toBe("\x1b[37m");
    expect(m.accent).toBe("\x1b[37m");
  });

  it("full preset uses higher-contrast palette", () => {
    const f = PRESET_THEME_COLORS.full;
    // full uses APPLE_YELLOW for warning (brighter than APPLE_ORANGE used by focused)
    expect(f.warning).not.toBe(PRESET_THEME_COLORS.focused.warning);
    // full uses APPLE_BLUE for info (higher contrast than APPLE_CYAN)
    expect(f.info).not.toBe(PRESET_THEME_COLORS.focused.info);
  });

  it("dense preset uses standard ANSI colors", () => {
    const d = PRESET_THEME_COLORS.dense;
    // dense uses standard ANSI (16-color, not 24-bit)
    expect(d.success).toBe("\x1b[32m"); // GREEN
    expect(d.warning).toBe("\x1b[33m"); // YELLOW
    expect(d.error).toBe("\x1b[31m"); // RED
    expect(d.info).toBe("\x1b[36m"); // CYAN
    expect(d.muted).toBe("\x1b[2m"); // DIM
    expect(d.accent).toBe("\x1b[35m"); // MAGENTA
  });

  it("opencode matches focused (compatibility)", () => {
    const o = PRESET_THEME_COLORS.opencode;
    const f = PRESET_THEME_COLORS.focused;
    for (const key of Object.keys(o) as Array<keyof ThemeColors>) {
      expect(o[key]).toBe(f[key]);
    }
  });
});

describe("resolveThemeColor", () => {
  it("returns the correct ANSI code for a given semantic + preset", () => {
    expect(resolveThemeColor("success", "focused")).toBe(
      PRESET_THEME_COLORS.focused.success,
    );
    expect(resolveThemeColor("error", "focused")).toBe(
      PRESET_THEME_COLORS.focused.error,
    );
  });

  it("falls back to focused for unknown presets", () => {
    expect(resolveThemeColor("success", "nonexistent")).toBe(
      PRESET_THEME_COLORS.focused.success,
    );
  });
});

describe("resolveThemeColors", () => {
  it("returns the full palette for a preset", () => {
    const palette = resolveThemeColors("focused");
    expect(palette).toEqual(PRESET_THEME_COLORS.focused);
  });

  it("falls back to focused for unknown presets", () => {
    const palette = resolveThemeColors("invalid_preset");
    expect(palette).toEqual(PRESET_THEME_COLORS.focused);
  });
});

describe("thresholdColor", () => {
  const theme = PRESET_THEME_COLORS.focused;

  it("returns success color below warning threshold", () => {
    expect(thresholdColor(50, 70, 85, theme)).toBe(theme.success);
  });

  it("returns warning color between warning and critical thresholds", () => {
    expect(thresholdColor(75, 70, 85, theme)).toBe(theme.warning);
  });

  it("returns error color at or above critical threshold", () => {
    expect(thresholdColor(85, 70, 85, theme)).toBe(theme.error);
    expect(thresholdColor(95, 70, 85, theme)).toBe(theme.error);
  });

  it("uses theme-specific colors", () => {
    const denseTheme = PRESET_THEME_COLORS.dense;
    expect(thresholdColor(40, 50, 80, denseTheme)).toBe(denseTheme.success);
    expect(thresholdColor(60, 50, 80, denseTheme)).toBe(denseTheme.warning);
  });
});