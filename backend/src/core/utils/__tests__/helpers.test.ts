import { describe, it, expect } from "vitest";
import { calculateLevel, isSpam, xpToNextLevel, progressToNextLevel } from "../helpers";

describe("calculateLevel", () => {
  it("should return level 1 for 0 XP", () => {
    expect(calculateLevel(0n)).toBe(1);
  });

  it("should return level 1 for low XP", () => {
    expect(calculateLevel(50n)).toBe(1);
  });

  it("should return level 2 at 100 XP", () => {
    expect(calculateLevel(100n)).toBe(2);
  });

  it("should return level 3 at 400 XP", () => {
    expect(calculateLevel(400n)).toBe(3);
  });

  it("should return level 5 at 1600 XP", () => {
    expect(calculateLevel(1600n)).toBe(5);
  });

  it("should return level 10 at 8100 XP", () => {
    expect(calculateLevel(8100n)).toBe(10);
  });

  it("should cap at MAX_SAFE_XP", () => {
    const hugeXp = 10n ** 20n; // Much larger than MAX_SAFE_XP
    const level = calculateLevel(hugeXp);
    expect(level).toBeLessThan(10 ** 8); // Sanity check, not overflow
    expect(Number.isFinite(level)).toBe(true);
  });

  it("should handle 0 XP gracefully", () => {
    expect(calculateLevel(0n)).toBe(1);
  });

  it("should clamp negative XP to 0", () => {
    expect(calculateLevel(-100n)).toBe(1);
  });
});

describe("isSpam", () => {
  it("should detect short messages as spam", () => {
    expect(isSpam("hi")).toBe(true);
    expect(isSpam("a")).toBe(true);
  });

  it("should detect emoji-only messages as spam", () => {
    expect(isSpam("😂😂😂")).toBe(true);
    expect(isSpam("🔥🔥🔥🔥🔥")).toBe(true);
  });

  it("should detect special character messages as spam", () => {
    expect(isSpam("!!!???!!!")).toBe(true);
    expect(isSpam(".....,,,,,")).toBe(true);
  });

  it("should detect repeated words as spam", () => {
    expect(isSpam("hola hola hola")).toBe(true);
  });

  it("should NOT flag normal messages as spam", () => {
    expect(isSpam("Hola, ¿cómo estás hoy?")).toBe(false);
    expect(isSpam("Este es un mensaje normal y corriente")).toBe(false);
  });

  it("should NOT flag unique 3-word messages as spam", () => {
    expect(isSpam("Hola mundo cruel")).toBe(false);
  });

  it("should handle mixed content correctly", () => {
    expect(isSpam("Hola 😊 ¿todo bien?")).toBe(false);
  });
});

describe("xpToNextLevel", () => {
  it("should calculate XP needed to next level", () => {
    const xp = 0n;
    const level = 1;
    const needed = xpToNextLevel(xp, level);
    expect(needed).toBe(100n);
  });

  it("should return 0n when at the exact XP boundary", () => {
    const xp = 100n;
    const level = 1;
    const needed = xpToNextLevel(xp, level);
    expect(needed).toBe(0n);
  });
});

describe("progressToNextLevel", () => {
  it("should return 0 at start of level", () => {
    expect(progressToNextLevel(0n, 1)).toBe(0);
  });

  it("should return 1 at exact next level boundary", () => {
    expect(progressToNextLevel(100n, 1)).toBe(1);
  });

  it("should return 0.5 at halfway to next level", () => {
    expect(progressToNextLevel(50n, 1)).toBe(0.5);
  });
});
