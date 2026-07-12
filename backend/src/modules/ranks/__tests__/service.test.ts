import { describe, it, expect } from "vitest";

// ─── Pure logic replicated from ranks/service.ts ───

interface RankInput {
  name: string;
  requiredXp: number;
  discordRoleId?: string | null;
  color?: string | null;
  icon?: string | null;
  position: number;
}

function validateRankInput(data: RankInput): string[] {
  const errors: string[] = [];
  if (!data.name || data.name.trim().length === 0) {
    errors.push("Name is required");
  }
  if (data.requiredXp < 0) {
    errors.push("requiredXp must be >= 0");
  }
  if (data.position < 0) {
    errors.push("Position must be >= 0");
  }
  return errors;
}

function sortRanksByPosition(ranks: Array<{ position: number; name: string }>): Array<{ position: number; name: string }> {
  return [...ranks].sort((a, b) => a.position - b.position);
}

// ════════════════════════════════════════════════════════════
//  RankInput Validation
// ════════════════════════════════════════════════════════════

describe("validateRankInput", () => {
  const validInput: RankInput = {
    name: "Bronce",
    requiredXp: 0,
    position: 1,
  };

  it("should return no errors for valid input", () => {
    expect(validateRankInput(validInput)).toEqual([]);
  });

  it("should reject empty name", () => {
    const errors = validateRankInput({ ...validInput, name: "" });
    expect(errors).toContain("Name is required");
  });

  it("should reject whitespace-only name", () => {
    const errors = validateRankInput({ ...validInput, name: "   " });
    expect(errors).toContain("Name is required");
  });

  it("should reject negative requiredXp", () => {
    const errors = validateRankInput({ ...validInput, requiredXp: -100 });
    expect(errors).toContain("requiredXp must be >= 0");
  });

  it("should accept 0 requiredXp", () => {
    expect(validateRankInput({ ...validInput, requiredXp: 0 })).toEqual([]);
  });

  it("should reject negative position", () => {
    const errors = validateRankInput({ ...validInput, position: -1 });
    expect(errors).toContain("Position must be >= 0");
  });

  it("should accept position 0", () => {
    expect(validateRankInput({ ...validInput, position: 0 })).toEqual([]);
  });

  it("should accept optional fields", () => {
    const input: RankInput = {
      name: "Oro",
      requiredXp: 5000,
      position: 3,
      discordRoleId: "123",
      color: "#FFD700",
      icon: "👑",
    };
    expect(validateRankInput(input)).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════
//  Sort by Position
// ════════════════════════════════════════════════════════════

describe("sortRanksByPosition", () => {
  it("should sort ranks by position ascending", () => {
    const ranks = [
      { position: 3, name: "Oro" },
      { position: 1, name: "Bronce" },
      { position: 2, name: "Plata" },
    ];
    const sorted = sortRanksByPosition(ranks);
    expect(sorted[0].name).toBe("Bronce");
    expect(sorted[1].name).toBe("Plata");
    expect(sorted[2].name).toBe("Oro");
  });

  it("should not mutate the original array", () => {
    const ranks = [{ position: 2, name: "B" }, { position: 1, name: "A" }];
    const sorted = sortRanksByPosition(ranks);
    expect(sorted[0].name).toBe("A");
    expect(ranks[0].name).toBe("B"); // original unchanged
  });

  it("should handle empty array", () => {
    expect(sortRanksByPosition([])).toEqual([]);
  });

  it("should handle single rank", () => {
    expect(sortRanksByPosition([{ position: 1, name: "Unico" }])).toEqual([
      { position: 1, name: "Unico" },
    ]);
  });
});
