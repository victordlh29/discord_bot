import { describe, it, expect } from "vitest";

// ─── Pure logic replicated from users/service.ts ───

/** Clampa el limit entre 1 y 100 */
function calculateSafeLimit(limit: number): number {
  return Math.min(100, Math.max(1, limit));
}

/** Calcula skip para paginación */
function calculateSkip(page: number, safeLimit: number): number {
  return (page - 1) * safeLimit;
}

/** Calcula totalPages */
function calculateTotalPages(total: number, safeLimit: number): number {
  return Math.ceil(total / safeLimit);
}

/** Determina el rango que corresponde según XP (ranks ordenados por requiredXp asc) */
function determineRank(
  userXp: bigint,
  ranks: Array<{ id: string; name: string; requiredXp: bigint }>
): { id: string; name: string } | null {
  let result: { id: string; name: string } | null = null;
  for (const rank of ranks) {
    if (userXp >= rank.requiredXp) {
      result = { id: rank.id, name: rank.name };
    } else {
      break;
    }
  }
  return result;
}

// ════════════════════════════════════════════════════════════
//  Safe Limit
// ════════════════════════════════════════════════════════════

describe("calculateSafeLimit", () => {
  it("should return the limit when within 1-100 range", () => {
    expect(calculateSafeLimit(50)).toBe(50);
  });

  it("should clamp to 1 when limit is 0", () => {
    expect(calculateSafeLimit(0)).toBe(1);
  });

  it("should clamp to 1 when limit is negative", () => {
    expect(calculateSafeLimit(-5)).toBe(1);
  });

  it("should clamp to 100 when limit exceeds 100", () => {
    expect(calculateSafeLimit(200)).toBe(100);
  });

  it("should handle limit exactly 1", () => {
    expect(calculateSafeLimit(1)).toBe(1);
  });

  it("should handle limit exactly 100", () => {
    expect(calculateSafeLimit(100)).toBe(100);
  });
});

// ════════════════════════════════════════════════════════════
//  Pagination
// ════════════════════════════════════════════════════════════

describe("Pagination calculation", () => {
  it("should calculate skip for page 1", () => {
    expect(calculateSkip(1, 50)).toBe(0);
  });

  it("should calculate skip for page 2", () => {
    expect(calculateSkip(2, 50)).toBe(50);
  });

  it("should calculate skip for page 3 with limit 25", () => {
    expect(calculateSkip(3, 25)).toBe(50);
  });

  it("should handle page 0 gracefully (would be clamped elsewhere)", () => {
    expect(calculateSkip(0, 50)).toBe(-50); // edge case, page < 1 handled by caller
  });

  it("should calculate totalPages with exact division", () => {
    expect(calculateTotalPages(100, 50)).toBe(2);
  });

  it("should calculate totalPages with remainder (ceil)", () => {
    expect(calculateTotalPages(101, 50)).toBe(3);
  });

  it("should calculate totalPages when total is 0", () => {
    expect(calculateTotalPages(0, 50)).toBe(0);
  });

  it("should calculate totalPages when total is less than limit", () => {
    expect(calculateTotalPages(10, 50)).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════
//  Determine Rank by XP
// ════════════════════════════════════════════════════════════

describe("determineRank", () => {
  const ranks = [
    { id: "r1", name: "Bronce", requiredXp: 0n },
    { id: "r2", name: "Plata", requiredXp: 1000n },
    { id: "r3", name: "Oro", requiredXp: 5000n },
    { id: "r4", name: "Diamante", requiredXp: 10000n },
  ];

  it("should return the first rank for 0 XP", () => {
    const result = determineRank(0n, ranks);
    expect(result?.id).toBe("r1");
    expect(result?.name).toBe("Bronce");
  });

  it("should return Bronze for XP below 1000", () => {
    expect(determineRank(500n, ranks)?.id).toBe("r1");
  });

  it("should return Plata for XP between 1000 and 4999", () => {
    expect(determineRank(1000n, ranks)?.id).toBe("r2");
    expect(determineRank(2500n, ranks)?.id).toBe("r2");
    expect(determineRank(4999n, ranks)?.id).toBe("r2");
  });

  it("should return Oro for XP between 5000 and 9999", () => {
    expect(determineRank(5000n, ranks)?.id).toBe("r3");
    expect(determineRank(7500n, ranks)?.id).toBe("r3");
  });

  it("should return Diamante for XP >= 10000", () => {
    expect(determineRank(10000n, ranks)?.id).toBe("r4");
    expect(determineRank(99999n, ranks)?.id).toBe("r4");
  });

  it("should return null for empty ranks array", () => {
    expect(determineRank(5000n, [])).toBeNull();
  });

  it("should handle single-rank system", () => {
    const singleRank = [{ id: "r1", name: "Unico", requiredXp: 0n }];
    expect(determineRank(0n, singleRank)?.id).toBe("r1");
    expect(determineRank(99999n, singleRank)?.id).toBe("r1");
  });

  it("should return highest rank when all requirements met", () => {
    const result = determineRank(100000n, ranks);
    expect(result?.id).toBe("r4");
    expect(result?.name).toBe("Diamante");
  });
});
