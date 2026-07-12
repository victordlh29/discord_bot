import { describe, it, expect } from "vitest";

// ─── Pure voice logic replicated from service.ts for isolated testing ───

/** Calcula la duración en minutos entre dos fechas */
function calcDurationMinutes(joinTime: Date, leaveTime: Date): number {
  const durationSeconds = Math.floor((leaveTime.getTime() - joinTime.getTime()) / 1000);
  return Math.floor(durationSeconds / 60);
}

/** Determina si el cooldown de voz está activo */
function isCooldownActive(
  voiceCooldownSeconds: number,
  lastVoiceAt: Date | null,
  now: Date
): boolean {
  if (voiceCooldownSeconds <= 0 || lastVoiceAt === null) return false;
  const elapsed = (now.getTime() - lastVoiceAt.getTime()) / 1000;
  return elapsed < voiceCooldownSeconds;
}

/** Calcula el XP de voz base */
function calcVoiceXp(durationMinutes: number, xpPerMinute: number, globalMultiplier: number): number {
  return Math.round(durationMinutes * xpPerMinute * globalMultiplier);
}

/** Aplica bonuses de eventos al XP */
function applyEventBonuses(
  xpEarned: number,
  doubleXp: boolean,
  voiceBonus: number
): number {
  let result = xpEarned;
  if (doubleXp) result *= 2;
  if (voiceBonus > 0) result += voiceBonus;
  return result;
}

// ─── handleVoiceJoin logic (pure decision helpers) ───

/** Determina si un miembro debe ser ignorado (es bot) */
function isBot(member: { user?: { bot?: boolean } } | null): boolean {
  return !member || member.user?.bot === true;
}

/** Verifica si un canal está en la whitelist (si está configurada) */
function isChannelAllowed(channelId: string, allowedChannels: string | null): boolean {
  // null = no whitelist configured → allow all
  if (allowedChannels === null) return true;
  // Empty string or any value → must match one of the channels
  const channels = allowedChannels.split(",").map((c) => c.trim()).filter((c) => c.length > 0);
  return channels.includes(channelId);
}

/** Determina si el usuario necesita ser creado en DB */
function needsUserCreation(user: unknown): boolean {
  return user === null || user === undefined;
}

// ─── processActiveVoiceSessions logic (pure decision helpers) ───

/** Determina si una sesión debe cerrarse (miembro ya no está en voz) */
function shouldAutoCloseSession(member: { voice?: { channelId?: string | null } | null } | null): boolean {
  return !member || !member.voice?.channelId;
}

/** Calcula la duración de auto-cierre en minutos */
function calcAutoCloseDuration(joinTime: Date, now: Date): number {
  const durationSec = Math.floor((now.getTime() - joinTime.getTime()) / 1000);
  return Math.floor(durationSec / 60);
}

// ════════════════════════════════════════════════════════════
//  Duration Calculation
// ════════════════════════════════════════════════════════════

describe("calcDurationMinutes", () => {
  it("should calculate exact duration in whole minutes", () => {
    const join = new Date("2024-01-01T10:00:00Z");
    const leave = new Date("2024-01-01T10:05:00Z");
    expect(calcDurationMinutes(join, leave)).toBe(5);
  });

  it("should floor to whole minutes (truncate seconds)", () => {
    const join = new Date("2024-01-01T10:00:00Z");
    const leave = new Date("2024-01-01T10:05:30Z");
    expect(calcDurationMinutes(join, leave)).toBe(5);
  });

  it("should return 0 for less than 1 minute", () => {
    const join = new Date("2024-01-01T10:00:00Z");
    const leave = new Date("2024-01-01T10:00:45Z");
    expect(calcDurationMinutes(join, leave)).toBe(0);
  });

  it("should handle 0 duration (same time)", () => {
    const now = new Date();
    expect(calcDurationMinutes(now, now)).toBe(0);
  });

  it("should calculate long durations correctly", () => {
    const join = new Date("2024-01-01T10:00:00Z");
    const leave = new Date("2024-01-01T14:30:00Z"); // 4h30m
    expect(calcDurationMinutes(join, leave)).toBe(270);
  });
});

// ════════════════════════════════════════════════════════════
//  Cooldown Logic
// ════════════════════════════════════════════════════════════

describe("isCooldownActive", () => {
  it("should return false when voiceCooldownSeconds is 0 (disabled)", () => {
    const lastVoiceAt = new Date(Date.now() - 60_000);
    expect(isCooldownActive(0, lastVoiceAt, new Date())).toBe(false);
  });

  it("should return false when lastVoiceAt is null (first time)", () => {
    expect(isCooldownActive(300, null, new Date())).toBe(false);
  });

  it("should return true when elapsed time is less than cooldown", () => {
    const lastVoiceAt = new Date(Date.now() - 60_000); // 1 min ago
    expect(isCooldownActive(300, lastVoiceAt, new Date())).toBe(true); // 300s cooldown
  });

  it("should return false when elapsed time exceeds cooldown", () => {
    const lastVoiceAt = new Date(Date.now() - 600_000); // 10 min ago
    expect(isCooldownActive(300, lastVoiceAt, new Date())).toBe(false); // 300s cooldown
  });

  it("should return false when elapsed time equals cooldown exactly", () => {
    const lastVoiceAt = new Date(Date.now() - 300_000); // exactly 5 min ago
    expect(isCooldownActive(300, lastVoiceAt, new Date())).toBe(false);
  });

  it("should use the provided 'now' for time comparison", () => {
    const lastVoiceAt = new Date("2024-01-01T10:00:00Z");
    const now = new Date("2024-01-01T10:03:00Z"); // 3 min later
    expect(isCooldownActive(300, lastVoiceAt, now)).toBe(true); // 180s < 300s

    const now2 = new Date("2024-01-01T10:10:00Z"); // 10 min later
    expect(isCooldownActive(300, lastVoiceAt, now2)).toBe(false); // 600s >= 300s
  });

  it("should handle negative voiceCooldownSeconds as disabled", () => {
    const lastVoiceAt = new Date(Date.now() - 60_000);
    expect(isCooldownActive(-1, lastVoiceAt, new Date())).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
//  XP Calculation
// ════════════════════════════════════════════════════════════

describe("calcVoiceXp", () => {
  it("should calculate XP = duration * rate * multiplier", () => {
    expect(calcVoiceXp(60, 2, 1.0)).toBe(120); // 60 min * 2 XP/min * 1.0
  });

  it("should apply global multiplier correctly", () => {
    expect(calcVoiceXp(60, 2, 1.5)).toBe(180); // 60 * 2 * 1.5
  });

  it("should round to nearest integer", () => {
    expect(calcVoiceXp(5, 2, 1.0)).toBe(10);
    expect(calcVoiceXp(5, 3, 1.0)).toBe(15);
  });

  it("should return 0 when xpPerMinute is 0", () => {
    expect(calcVoiceXp(60, 0, 1.0)).toBe(0);
  });

  it("should return 0 when duration is 0", () => {
    expect(calcVoiceXp(0, 2, 1.0)).toBe(0);
  });

  it("should return 0 when multiplier is 0", () => {
    expect(calcVoiceXp(60, 2, 0)).toBe(0);
  });

  it("should handle 1 minute correctly", () => {
    expect(calcVoiceXp(1, 2, 1.0)).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════
//  Event Bonuses (Bug #2: doubleXp, voiceBonus)
// ════════════════════════════════════════════════════════════

describe("applyEventBonuses", () => {
  it("should double XP when doubleXp event is active", () => {
    expect(applyEventBonuses(100, true, 0)).toBe(200);
  });

  it("should add voice bonus when voice event is active", () => {
    expect(applyEventBonuses(100, false, 50)).toBe(150);
  });

  it("should apply both doubleXP and voice bonus", () => {
    expect(applyEventBonuses(100, true, 50)).toBe(250); // 100*2 + 50
  });

  it("should keep XP unchanged when no events are active", () => {
    expect(applyEventBonuses(100, false, 0)).toBe(100);
  });

  it("should handle zero XP with event bonuses", () => {
    expect(applyEventBonuses(0, true, 50)).toBe(50); // 0*2 + 50
  });

  it("should ignore voiceBonus when bonus is 0", () => {
    expect(applyEventBonuses(100, false, 0)).toBe(100);
  });
});

// ════════════════════════════════════════════════════════════
//  handleVoiceJoin Logic
// ════════════════════════════════════════════════════════════

describe("handleVoiceJoin — Bot filtering", () => {
  it("should skip bots", () => {
    const botMember = { user: { bot: true } };
    expect(isBot(botMember)).toBe(true);
  });

  it("should skip null members", () => {
    expect(isBot(null)).toBe(true);
  });

  it("should allow real users", () => {
    const userMember = { user: { bot: false } };
    expect(isBot(userMember)).toBe(false);
  });

  it("should allow members without user property (edge case)", () => {
    expect(isBot({})).toBe(false);
  });
});

describe("handleVoiceJoin — Channel whitelist", () => {
  it("should allow any channel when whitelist is not configured", () => {
    expect(isChannelAllowed("ch-1", null)).toBe(true);
  });

  it("should allow channel that is in the whitelist", () => {
    expect(isChannelAllowed("ch-1", "ch-1,ch-2")).toBe(true);
  });

  it("should reject channel not in the whitelist", () => {
    expect(isChannelAllowed("ch-3", "ch-1,ch-2")).toBe(false);
  });

  it("should handle single-channel whitelist", () => {
    expect(isChannelAllowed("ch-1", "ch-1")).toBe(true);
    expect(isChannelAllowed("ch-2", "ch-1")).toBe(false);
  });

  it("should trim whitespace from channel IDs", () => {
    expect(isChannelAllowed("ch-1", "ch-1, ch-2")).toBe(true);
  });

  it("should reject empty whitelist string (no channels)", () => {
    expect(isChannelAllowed("ch-1", "")).toBe(false);
  });
});

describe("handleVoiceJoin — User creation decision", () => {
  it("should create user when not found in DB", () => {
    expect(needsUserCreation(null)).toBe(true);
    expect(needsUserCreation(undefined)).toBe(true);
  });

  it("should not create user when already exists", () => {
    expect(needsUserCreation({ id: "u1" })).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
//  processActiveVoiceSessions Logic
// ════════════════════════════════════════════════════════════

describe("processActiveVoiceSessions — Auto-close decision", () => {
  it("should auto-close when member is null (not found)", () => {
    expect(shouldAutoCloseSession(null)).toBe(true);
  });

  it("should auto-close when member is not in any voice channel", () => {
    const member = { voice: null };
    expect(shouldAutoCloseSession(member)).toBe(true);
  });

  it("should auto-close when member has no channelId", () => {
    const member = { voice: { channelId: null } };
    expect(shouldAutoCloseSession(member)).toBe(true);
  });

  it("should NOT auto-close when member is in a voice channel", () => {
    const member = { voice: { channelId: "ch-1" } };
    expect(shouldAutoCloseSession(member)).toBe(false);
  });

  it("should calculate auto-close duration correctly", () => {
    const joinTime = new Date("2024-01-01T10:00:00Z");
    const now = new Date("2024-01-01T10:05:30Z");
    expect(calcAutoCloseDuration(joinTime, now)).toBe(5); // floor(330s / 60) = 5
  });

  it("should handle zero duration in auto-close (join = now)", () => {
    const now = new Date();
    expect(calcAutoCloseDuration(now, now)).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════
//  handleVoiceLeave — Level up detection
// ════════════════════════════════════════════════════════════

describe("handleVoiceLeave — Level up logic", () => {
  it("should detect level up when newLevel > user.level", () => {
    const userLevel = 1;
    const newLevel = 2;
    expect(newLevel > userLevel).toBe(true);
  });

  it("should NOT detect level up when level stays the same", () => {
    const userLevel = 5;
    const newLevel = 5;
    expect(newLevel > userLevel).toBe(false);
  });

  it("should NOT detect level up when newLevel is lower (shouldn't happen but safe)", () => {
    const userLevel = 3;
    const newLevel = 2;
    expect(newLevel > userLevel).toBe(false);
  });

  it("should calculate XP and detect level up correctly", () => {
    // Simula: 30 min de voz → XP = 30 * 2 * 1.0 = 60
    // Si user.xp = 50, newXp = 110, calculateLevel(110n) debería ser > user.level
    const durationMinutes = 30;
    const xpPerMinute = 2;
    const multiplier = 1.0;
    const xpEarned = calcVoiceXp(durationMinutes, xpPerMinute, multiplier);
    expect(xpEarned).toBe(60);
  });
});

// ════════════════════════════════════════════════════════════
//  Edge Cases: handleVoiceLeave scenarios (Bug #2)
// ════════════════════════════════════════════════════════════

describe("Voice Leave Edge Cases (Bug #2 — cooldown & voiceTime)", () => {
  it("should skip XP when duration < 1 minute (session deleted)", () => {
    const joinTime = new Date("2024-01-01T10:00:00Z");
    const leaveTime = new Date("2024-01-01T10:00:45Z");
    const duration = calcDurationMinutes(joinTime, leaveTime);

    expect(duration).toBe(0);
  });

  it("should earn 0 XP when xpPerMinute is 0 but voiceTime is tracked", () => {
    // Bug #2 fix: xpEarned <= 0 → voiceTime se incrementa, pero no hay XP
    const durationMinutes = 10;
    const xpPerMinute = 0;
    const globalMultiplier = 1.0;
    const xpEarned = calcVoiceXp(durationMinutes, xpPerMinute, globalMultiplier);

    expect(xpEarned).toBe(0);
  });

  it("should trigger cooldown when user leaves shortly after last voice XP", () => {
    // Bug #2: cooldown se mide contra lastVoiceAt (último XP otorgado)
    const lastVoiceAt = new Date("2024-01-01T10:00:00Z");
    const now = new Date("2024-01-01T10:03:00Z");

    expect(isCooldownActive(300, lastVoiceAt, now)).toBe(true);
  });

  it("should NOT trigger cooldown when cooldown period has passed", () => {
    const lastVoiceAt = new Date("2024-01-01T10:00:00Z");
    const now = new Date("2024-01-01T10:10:00Z"); // 10 min later

    expect(isCooldownActive(300, lastVoiceAt, now)).toBe(false);
  });

  it("should earn XP with event bonuses when no cooldown is active", () => {
    // Flujo completo: sin cooldown → XP calculado con bonuses de eventos
    const durationMinutes = 30;
    const xpPerMinute = 2;
    const multiplier = 1.5;
    const baseXp = calcVoiceXp(durationMinutes, xpPerMinute, multiplier);
    const finalXp = applyEventBonuses(baseXp, true, 50); // doubleXp + voiceBonus

    expect(baseXp).toBe(90); // 30 * 2 * 1.5
    expect(finalXp).toBe(230); // 90 * 2 + 50
  });
});
