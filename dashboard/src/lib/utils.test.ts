import { describe, it, expect } from "vitest";
import { formatXp, formatDate } from "./utils";

describe("formatXp", () => {
  it("should format bigint XP with locale separators", () => {
    const result = formatXp(BigInt(1000));
    expect(result.replace(/[.,]/g, "")).toBe("1000");
  });

  it("should format number XP", () => {
    const result = formatXp(50000);
    expect(result.replace(/[.,]/g, "")).toBe("50000");
  });

  it("should format string XP", () => {
    const result = formatXp("2500");
    expect(result.replace(/[.,]/g, "")).toBe("2500");
  });

  it("should handle 0 XP", () => {
    expect(formatXp(0)).toBe("0");
  });
});

describe("formatDate", () => {
  it("should return a formatted date string", () => {
    const result = formatDate("2024-01-15T10:30:00Z");
    expect(result).toContain("2024");
    expect(result).toContain("15");
  });

  it("should format a Date object", () => {
    const date = new Date("2024-06-15T12:00:00Z");
    const result = formatDate(date);
    expect(result).toContain("2024");
    expect(result).toContain("15");
  });
});
