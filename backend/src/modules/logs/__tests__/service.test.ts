import { describe, it, expect } from "vitest";

// ─── Pure logic replicated from logs/service.ts ───

interface CreateLogParams {
  action: string;
  entity?: string;
  entityId?: string;
  userId?: string;
  details?: string;
  guildId?: string;
}

function validateLogParams(params: CreateLogParams): string[] {
  const errors: string[] = [];
  if (!params.action || params.action.trim().length === 0) {
    errors.push("Action is required");
  }
  return errors;
}

function sanitizeLogDetails(details: string | null | undefined, maxLength: number = 500): string | null {
  if (!details) return null;
  return details.length > maxLength ? details.slice(0, maxLength) + "..." : details;
}

// ════════════════════════════════════════════════════════════
//  Log Params Validation
// ════════════════════════════════════════════════════════════

describe("validateLogParams", () => {
  const validParams: CreateLogParams = {
    action: "USER_UPDATE",
    entity: "user",
    entityId: "u1",
    userId: "discord-123",
    guildId: "guild-1",
  };

  it("should return no errors for valid params", () => {
    expect(validateLogParams(validParams)).toEqual([]);
  });

  it("should reject empty action", () => {
    const errors = validateLogParams({ ...validParams, action: "" });
    expect(errors).toContain("Action is required");
  });

  it("should reject whitespace-only action", () => {
    const errors = validateLogParams({ ...validParams, action: "   " });
    expect(errors).toContain("Action is required");
  });

  it("should accept minimal params (only action)", () => {
    expect(validateLogParams({ action: "TEST" })).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════
//  Log Details Sanitization
// ════════════════════════════════════════════════════════════

describe("sanitizeLogDetails", () => {
  it("should return null for null details", () => {
    expect(sanitizeLogDetails(null)).toBeNull();
  });

  it("should return null for undefined details", () => {
    expect(sanitizeLogDetails(undefined)).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(sanitizeLogDetails("")).toBeNull();
  });

  it("should return short details unchanged", () => {
    expect(sanitizeLogDetails("Short log")).toBe("Short log");
  });

  it("should truncate long details with ellipsis", () => {
    const longString = "a".repeat(600);
    const result = sanitizeLogDetails(longString, 500);
    expect(result).toBe("a".repeat(500) + "...");
    expect(result?.length).toBe(503);
  });

  it("should not truncate when exactly at maxLength", () => {
    const exactString = "a".repeat(500);
    expect(sanitizeLogDetails(exactString, 500)).toBe(exactString);
  });
});
