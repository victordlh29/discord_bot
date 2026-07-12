import { describe, it, expect } from "vitest";

// ─── Pure logic replicated from settings/service.ts ───

function parseSettingInt(value: string | null, defaultValue: number): number {
  return value !== null ? parseInt(value, 10) : defaultValue;
}

function parseSettingFloat(value: string | null, defaultValue: number): number {
  return value !== null ? parseFloat(value) : defaultValue;
}

// ════════════════════════════════════════════════════════════
//  parseSettingInt
// ════════════════════════════════════════════════════════════

describe("parseSettingInt", () => {
  it("should parse a valid integer string", () => {
    expect(parseSettingInt("10", 0)).toBe(10);
  });

  it("should parse a string with leading zeros", () => {
    expect(parseSettingInt("05", 0)).toBe(5);
  });

  it("should return default when value is null", () => {
    expect(parseSettingInt(null, 300)).toBe(300);
  });

  it("should return default when value is empty string", () => {
    expect(parseSettingInt("", 5)).toBe(NaN);
  });

  it("should parse negative numbers", () => {
    expect(parseSettingInt("-1", 0)).toBe(-1);
  });

  it("should parse zero", () => {
    expect(parseSettingInt("0", 100)).toBe(0);
  });

  it("should handle large numbers", () => {
    expect(parseSettingInt("999999", 0)).toBe(999999);
  });
});

// ════════════════════════════════════════════════════════════
//  parseSettingFloat
// ════════════════════════════════════════════════════════════

describe("parseSettingFloat", () => {
  it("should parse a valid float string", () => {
    expect(parseSettingFloat("1.5", 1.0)).toBe(1.5);
  });

  it("should parse an integer string as float", () => {
    expect(parseSettingFloat("2", 1.0)).toBe(2);
  });

  it("should return default when value is null", () => {
    expect(parseSettingFloat(null, 1.0)).toBe(1.0);
  });

  it("should handle zero", () => {
    expect(parseSettingFloat("0", 1.0)).toBe(0);
  });

  it("should handle negative floats", () => {
    expect(parseSettingFloat("-0.5", 1.0)).toBe(-0.5);
  });
});
