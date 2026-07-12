import { describe, it, expect } from "vitest";

// ─── Pure logic replicated from cosmetics/service.ts ───

const VALID_TYPES = ["TITLE", "BADGE", "BACKGROUND", "FRAME"] as const;
const VALID_RARITIES = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"] as const;

type CosmeticType = (typeof VALID_TYPES)[number];
type CosmeticRarity = (typeof VALID_RARITIES)[number];

interface CosmeticInput {
  name: string;
  type: CosmeticType;
  rarity: CosmeticRarity;
  imageUrl?: string | null;
}

function isValidCosmeticType(type: string): type is CosmeticType {
  return (VALID_TYPES as readonly string[]).includes(type);
}

function isValidCosmeticRarity(rarity: string): rarity is CosmeticRarity {
  return (VALID_RARITIES as readonly string[]).includes(rarity);
}

function validateCosmeticInput(data: CosmeticInput): string[] {
  const errors: string[] = [];
  if (!data.name || data.name.trim().length === 0) {
    errors.push("Name is required");
  }
  if (!isValidCosmeticType(data.type)) {
    errors.push(`Invalid type: ${data.type}. Must be one of: ${VALID_TYPES.join(", ")}`);
  }
  if (!isValidCosmeticRarity(data.rarity)) {
    errors.push(`Invalid rarity: ${data.rarity}. Must be one of: ${VALID_RARITIES.join(", ")}`);
  }
  return errors;
}

// ════════════════════════════════════════════════════════════
//  Type Validation
// ════════════════════════════════════════════════════════════

describe("isValidCosmeticType", () => {
  it("should accept TITLE", () => {
    expect(isValidCosmeticType("TITLE")).toBe(true);
  });

  it("should accept BADGE", () => {
    expect(isValidCosmeticType("BADGE")).toBe(true);
  });

  it("should accept BACKGROUND", () => {
    expect(isValidCosmeticType("BACKGROUND")).toBe(true);
  });

  it("should accept FRAME", () => {
    expect(isValidCosmeticType("FRAME")).toBe(true);
  });

  it("should reject invalid type", () => {
    expect(isValidCosmeticType("INVALID")).toBe(false);
  });

  it("should be case-sensitive", () => {
    expect(isValidCosmeticType("title")).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
//  Rarity Validation
// ════════════════════════════════════════════════════════════

describe("isValidCosmeticRarity", () => {
  it("should accept COMMON", () => {
    expect(isValidCosmeticRarity("COMMON")).toBe(true);
  });

  it("should accept UNCOMMON", () => {
    expect(isValidCosmeticRarity("UNCOMMON")).toBe(true);
  });

  it("should accept RARE", () => {
    expect(isValidCosmeticRarity("RARE")).toBe(true);
  });

  it("should accept EPIC", () => {
    expect(isValidCosmeticRarity("EPIC")).toBe(true);
  });

  it("should accept LEGENDARY", () => {
    expect(isValidCosmeticRarity("LEGENDARY")).toBe(true);
  });

  it("should reject invalid rarity", () => {
    expect(isValidCosmeticRarity("MYTHIC")).toBe(false);
  });

  it("should be case-sensitive", () => {
    expect(isValidCosmeticRarity("rare")).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
//  CosmeticInput Validation
// ════════════════════════════════════════════════════════════

describe("validateCosmeticInput", () => {
  const validInput: CosmeticInput = {
    name: "Corona Dorada",
    type: "TITLE",
    rarity: "LEGENDARY",
  };

  it("should return no errors for valid input", () => {
    expect(validateCosmeticInput(validInput)).toEqual([]);
  });

  it("should reject empty name", () => {
    const errors = validateCosmeticInput({ ...validInput, name: "" });
    expect(errors).toContain("Name is required");
  });

  it("should reject invalid type", () => {
    const errors = validateCosmeticInput({ ...validInput, type: "HAT" as CosmeticType });
    expect(errors.some((e) => e.includes("Invalid type"))).toBe(true);
  });

  it("should reject invalid rarity", () => {
    const errors = validateCosmeticInput({ ...validInput, rarity: "MYTHIC" as CosmeticRarity });
    expect(errors.some((e) => e.includes("Invalid rarity"))).toBe(true);
  });

  it("should accept optional imageUrl", () => {
    const input = { ...validInput, imageUrl: "https://example.com/img.png" };
    expect(validateCosmeticInput(input)).toEqual([]);
  });
});
