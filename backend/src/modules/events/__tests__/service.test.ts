import { describe, it, expect, beforeEach } from "vitest";

// ─── Pure event cache logic replicated from service.ts for isolated testing ───

/** Simula el Map de caché de eventos */
const activeEventsCache = new Map<string, { result: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 10_000; // 10 seconds (mismo valor que en service.ts)

/** Simula getActiveEvents con caché */
function simulateGetActiveEvents(guildId: string): boolean {
  const cached = activeEventsCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) {
    return true; // cache hit
  }
  return false; // cache miss
}

/** Simula la invalidación de caché de eventos */
function invalidateActiveEventsCache(guildId?: string): void {
  if (guildId) {
    activeEventsCache.delete(guildId);
  } else {
    activeEventsCache.clear();
  }
}

/** Inserta un valor en caché (simula getActiveEvents) */
function seedCache(guildId: string, result: unknown): void {
  activeEventsCache.set(guildId, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

beforeEach(() => {
  activeEventsCache.clear();
});

// ════════════════════════════════════════════════════════════
//  Cache Invalidation with guildId
// ════════════════════════════════════════════════════════════

describe("invalidateActiveEventsCache with guildId (Bug #5)", () => {
  it("should remove the specific guild entry from cache", () => {
    seedCache("guild-1", { doubleXp: true, chatActive: false, voiceActive: false, chatBonus: 0, voiceBonus: 0 });
    seedCache("guild-2", { doubleXp: false, chatActive: true, voiceActive: false, chatBonus: 10, voiceBonus: 0 });

    expect(simulateGetActiveEvents("guild-1")).toBe(true);
    expect(simulateGetActiveEvents("guild-2")).toBe(true);

    invalidateActiveEventsCache("guild-1");

    expect(simulateGetActiveEvents("guild-1")).toBe(false); // invalidated
    expect(simulateGetActiveEvents("guild-2")).toBe(true); // still cached
  });

  it("should not affect other guilds when invalidating one guild", () => {
    seedCache("guild-1", { doubleXp: true, chatActive: false, voiceActive: false, chatBonus: 0, voiceBonus: 0 });
    seedCache("guild-3", { doubleXp: false, chatActive: false, voiceActive: true, chatBonus: 0, voiceBonus: 20 });

    invalidateActiveEventsCache("guild-1");

    expect(simulateGetActiveEvents("guild-1")).toBe(false);
    expect(simulateGetActiveEvents("guild-3")).toBe(true);
  });

  it("should handle invalidating a non-existent guild gracefully", () => {
    seedCache("guild-1", { doubleXp: true, chatActive: false, voiceActive: false, chatBonus: 0, voiceBonus: 0 });

    invalidateActiveEventsCache("non-existent-guild"); // no-op, no error

    expect(simulateGetActiveEvents("guild-1")).toBe(true); // guild-1 unaffected
  });

  it("should allow re-caching after invalidation", () => {
    seedCache("guild-1", { doubleXp: true, chatActive: false, voiceActive: false, chatBonus: 0, voiceBonus: 0 });

    invalidateActiveEventsCache("guild-1");
    expect(simulateGetActiveEvents("guild-1")).toBe(false);

    // Re-cache
    seedCache("guild-1", { doubleXp: false, chatActive: true, voiceActive: false, chatBonus: 5, voiceBonus: 0 });
    expect(simulateGetActiveEvents("guild-1")).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════
//  Cache Invalidation without guildId (clear all)
// ════════════════════════════════════════════════════════════

describe("invalidateActiveEventsCache without guildId (clear all)", () => {
  it("should clear all entries from cache", () => {
    seedCache("guild-1", { doubleXp: true, chatActive: false, voiceActive: false, chatBonus: 0, voiceBonus: 0 });
    seedCache("guild-2", { doubleXp: false, chatActive: true, voiceActive: false, chatBonus: 10, voiceBonus: 0 });
    seedCache("guild-3", { doubleXp: false, chatActive: false, voiceActive: true, chatBonus: 0, voiceBonus: 20 });

    invalidateActiveEventsCache(); // sin guildId → clear all

    expect(simulateGetActiveEvents("guild-1")).toBe(false);
    expect(simulateGetActiveEvents("guild-2")).toBe(false);
    expect(simulateGetActiveEvents("guild-3")).toBe(false);
  });

  it("should handle clearing an empty cache gracefully", () => {
    invalidateActiveEventsCache(); // no-op, no error
    expect(simulateGetActiveEvents("guild-1")).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
//  Cache TTL Behavior
// ════════════════════════════════════════════════════════════

describe("Cache TTL behavior", () => {
  it("should return cached data within TTL", () => {
    const guildId = "guild-1";
    const result = { doubleXp: true, chatActive: false, voiceActive: false, chatBonus: 0, voiceBonus: 0 };

    // Seed con expiresAt en el futuro
    activeEventsCache.set(guildId, {
      result,
      expiresAt: Date.now() + 5000, // 5s en el futuro
    });

    expect(simulateGetActiveEvents(guildId)).toBe(true); // cache hit
  });

  it("should NOT return cached data after TTL expires", () => {
    const guildId = "guild-1";
    const result = { doubleXp: true, chatActive: false, voiceActive: false, chatBonus: 0, voiceBonus: 0 };

    // Seed con expiresAt en el pasado (simula TTL expirado)
    activeEventsCache.set(guildId, {
      result,
      expiresAt: Date.now() - 1000, // 1s en el pasado
    });

    expect(simulateGetActiveEvents(guildId)).toBe(false); // cache miss
  });
});

// ════════════════════════════════════════════════════════════
//  Integration: Invalidation after activation/deactivation
// ════════════════════════════════════════════════════════════

describe("Cache invalidation on event activation/deactivation (Bug #5)", () => {
  it("should invalidate after activating an event", () => {
    seedCache("guild-1", { doubleXp: false, chatActive: false, voiceActive: false, chatBonus: 0, voiceBonus: 0 });

    // Simula: activar evento → invalidar caché
    invalidateActiveEventsCache("guild-1");

    expect(simulateGetActiveEvents("guild-1")).toBe(false);
  });

  it("should invalidate after deactivating an event", () => {
    seedCache("guild-1", { doubleXp: true, chatActive: false, voiceActive: false, chatBonus: 0, voiceBonus: 0 });

    // Simula: desactivar evento → invalidar caché
    invalidateActiveEventsCache("guild-1");

    expect(simulateGetActiveEvents("guild-1")).toBe(false);
  });

  it("should invalidate after auto-ending expired events", () => {
    seedCache("guild-1", { doubleXp: true, chatActive: false, voiceActive: false, chatBonus: 0, voiceBonus: 0 });
    seedCache("guild-2", { doubleXp: false, chatActive: true, voiceActive: false, chatBonus: 5, voiceBonus: 0 });

    // Simula: auto-end del guild-1 → invalidar solo guild-1
    invalidateActiveEventsCache("guild-1");

    expect(simulateGetActiveEvents("guild-1")).toBe(false);
    expect(simulateGetActiveEvents("guild-2")).toBe(true); // no afectado
  });
});
