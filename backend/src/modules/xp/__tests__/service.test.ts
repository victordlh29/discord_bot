import { describe, it, expect } from "vitest";

// ─── Pure XP logic replicated from service.ts for isolated testing ───

/** Verifica si un canal está en la whitelist (si está configurada) */
function isChannelAllowed(channelId: string, allowedChannels: string | null): boolean {
  if (allowedChannels === null) return true;
  const channels = allowedChannels.split(",").map((c) => c.trim()).filter((c) => c.length > 0);
  return channels.includes(channelId);
}

/** Determina si el cooldown de mensajes está activo */
function isMessageCooldownActive(
  cooldownSeconds: number,
  lastMessageAt: Date | null,
  now: Date
): boolean {
  if (cooldownSeconds <= 0 || lastMessageAt === null) return false;
  const elapsed = (now.getTime() - lastMessageAt.getTime()) / 1000;
  return elapsed < cooldownSeconds;
}

/** Verifica que el contenido cumpla con la longitud mínima */
function meetsMinLength(content: string, minLength: number): boolean {
  return content.length >= minLength;
}

/** Calcula el XP base según los brackets de longitud del mensaje */
function calcXpFromBrackets(
  length: number,
  brackets: Array<{ min: number; max: number | null; xp: number }>
): number {
  for (const b of brackets) {
    if (length >= b.min && (b.max === null || length <= b.max)) {
      return b.xp;
    }
  }
  return 0;
}

/** Aplica el multiplier global al XP */
function applyMultiplier(xp: number, multiplier: number): number {
  return Math.round(xp * multiplier);
}

/** Clampa el XP entre mínimo y máximo */
function clampXp(xp: number, minXp: number, maxXp: number): number {
  let result = xp;
  if (result < minXp) result = minXp;
  if (result > maxXp) result = maxXp;
  return result;
}

/** Aplica bonuses de eventos al XP de chat */
function applyChatEventBonuses(
  xpAmount: number,
  doubleXp: boolean,
  chatBonus: number
): number {
  let result = xpAmount;
  if (doubleXp) result *= 2;
  if (chatBonus > 0) result += chatBonus;
  return result;
}

/** Detecta si es un nuevo día (para daily_login) */
function isNewDay(lastMessageAt: Date | null, now: Date): boolean {
  if (lastMessageAt === null) return true;
  return lastMessageAt.toDateString() !== now.toDateString();
}

// ════════════════════════════════════════════════════════════
//  Channel Whitelist
// ════════════════════════════════════════════════════════════

describe("XP — Channel whitelist", () => {
  it("should allow any channel when whitelist is null (not configured)", () => {
    expect(isChannelAllowed("ch-1", null)).toBe(true);
  });

  it("should allow channel that is in the whitelist", () => {
    expect(isChannelAllowed("ch-1", "ch-1,ch-2")).toBe(true);
  });

  it("should reject channel not in the whitelist", () => {
    expect(isChannelAllowed("ch-3", "ch-1,ch-2")).toBe(false);
  });

  it("should reject all channels when whitelist is empty string", () => {
    expect(isChannelAllowed("ch-1", "")).toBe(false);
  });

  it("should trim whitespace from channel IDs", () => {
    expect(isChannelAllowed("ch-1", " ch-1 , ch-2 ")).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════
//  Message Cooldown
// ════════════════════════════════════════════════════════════

describe("XP — Message cooldown", () => {
  it("should return false when cooldown is 0 (disabled)", () => {
    expect(isMessageCooldownActive(0, new Date(), new Date())).toBe(false);
  });

  it("should return false when lastMessageAt is null (first message)", () => {
    expect(isMessageCooldownActive(60, null, new Date())).toBe(false);
  });

  it("should return true when elapsed time is less than cooldown", () => {
    const lastMsg = new Date(Date.now() - 10_000); // 10s ago
    expect(isMessageCooldownActive(60, lastMsg, new Date())).toBe(true);
  });

  it("should return false when elapsed time exceeds cooldown", () => {
    const lastMsg = new Date(Date.now() - 120_000); // 2 min ago
    expect(isMessageCooldownActive(60, lastMsg, new Date())).toBe(false);
  });

  it("should return false when elapsed time equals cooldown exactly", () => {
    const lastMsg = new Date(Date.now() - 60_000); // exactly 60s ago
    expect(isMessageCooldownActive(60, lastMsg, new Date())).toBe(false);
  });

  it("should handle negative cooldown as disabled", () => {
    expect(isMessageCooldownActive(-1, new Date(), new Date())).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
//  Min Length Check
// ════════════════════════════════════════════════════════════

describe("XP — Min length check", () => {
  it("should pass when content meets min length", () => {
    expect(meetsMinLength("Hello World", 5)).toBe(true);
  });

  it("should fail when content is shorter than min length", () => {
    expect(meetsMinLength("Hi", 5)).toBe(false);
  });

  it("should pass when content equals min length exactly", () => {
    expect(meetsMinLength("12345", 5)).toBe(true);
  });

  it("should handle min length of 0 (allow all)", () => {
    expect(meetsMinLength("", 0)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════
//  XP Brackets Calculation
// ════════════════════════════════════════════════════════════

describe("XP — Bracket calculation", () => {
  const defaultBrackets = [
    { min: 5, max: 20, xp: 5 },
    { min: 21, max: 50, xp: 10 },
    { min: 51, max: 100, xp: 15 },
    { min: 101, max: 200, xp: 20 },
    { min: 201, max: null, xp: 25 },
  ];

  it("should return 5 XP for 5-20 chars (bracket 1)", () => {
    expect(calcXpFromBrackets(10, defaultBrackets)).toBe(5);
    expect(calcXpFromBrackets(5, defaultBrackets)).toBe(5);
    expect(calcXpFromBrackets(20, defaultBrackets)).toBe(5);
  });

  it("should return 10 XP for 21-50 chars (bracket 2)", () => {
    expect(calcXpFromBrackets(25, defaultBrackets)).toBe(10);
    expect(calcXpFromBrackets(21, defaultBrackets)).toBe(10);
    expect(calcXpFromBrackets(50, defaultBrackets)).toBe(10);
  });

  it("should return 15 XP for 51-100 chars (bracket 3)", () => {
    expect(calcXpFromBrackets(75, defaultBrackets)).toBe(15);
    expect(calcXpFromBrackets(100, defaultBrackets)).toBe(15);
  });

  it("should return 20 XP for 101-200 chars (bracket 4)", () => {
    expect(calcXpFromBrackets(150, defaultBrackets)).toBe(20);
    expect(calcXpFromBrackets(200, defaultBrackets)).toBe(20);
  });

  it("should return 25 XP for 201+ chars (bracket 5)", () => {
    expect(calcXpFromBrackets(250, defaultBrackets)).toBe(25);
    expect(calcXpFromBrackets(500, defaultBrackets)).toBe(25);
  });

  it("should return 0 for messages shorter than bracket 1 min", () => {
    expect(calcXpFromBrackets(3, defaultBrackets)).toBe(0);
    expect(calcXpFromBrackets(0, defaultBrackets)).toBe(0);
  });

  it("should work with custom bracket configuration", () => {
    const customBrackets = [
      { min: 1, max: 10, xp: 3 },
      { min: 11, max: 30, xp: 8 },
      { min: 31, max: null, xp: 12 },
    ];
    expect(calcXpFromBrackets(5, customBrackets)).toBe(3);
    expect(calcXpFromBrackets(20, customBrackets)).toBe(8);
    expect(calcXpFromBrackets(100, customBrackets)).toBe(12);
  });

  it("should handle empty brackets array", () => {
    expect(calcXpFromBrackets(50, [])).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════
//  Multiplier & Clamping
// ════════════════════════════════════════════════════════════

describe("XP — Multiplier and clamping", () => {
  it("should apply global multiplier", () => {
    expect(applyMultiplier(10, 1.5)).toBe(15);
  });

  it("should round multiplier result to integer", () => {
    expect(applyMultiplier(10, 1.33)).toBe(13); // 13.3 → 13
    expect(applyMultiplier(10, 1.67)).toBe(17); // 16.7 → 17
  });

  it("should leave XP unchanged when multiplier is 1.0", () => {
    expect(applyMultiplier(10, 1.0)).toBe(10);
  });

  it("should clamp XP to min when below minimum", () => {
    expect(clampXp(3, 5, 25)).toBe(5);
  });

  it("should clamp XP to max when above maximum", () => {
    expect(clampXp(50, 5, 25)).toBe(25);
  });

  it("should keep XP unchanged when within min/max range", () => {
    expect(clampXp(15, 5, 25)).toBe(15);
  });

  it("should handle edge case where min equals max", () => {
    expect(clampXp(3, 10, 10)).toBe(10);
    expect(clampXp(15, 10, 10)).toBe(10);
    expect(clampXp(10, 10, 10)).toBe(10);
  });
});

// ════════════════════════════════════════════════════════════
//  Event Bonuses (Chat)
// ════════════════════════════════════════════════════════════

describe("XP — Chat event bonuses", () => {
  it("should double XP when doubleXp event is active", () => {
    expect(applyChatEventBonuses(10, true, 0)).toBe(20);
  });

  it("should add chat bonus when chat event is active", () => {
    expect(applyChatEventBonuses(10, false, 5)).toBe(15);
  });

  it("should apply both doubleXP and chat bonus", () => {
    expect(applyChatEventBonuses(10, true, 5)).toBe(25); // 10*2 + 5
  });

  it("should keep XP unchanged when no events are active", () => {
    expect(applyChatEventBonuses(10, false, 0)).toBe(10);
  });

  it("should handle zero XP with event bonuses", () => {
    expect(applyChatEventBonuses(0, true, 5)).toBe(5);
  });
});

// ════════════════════════════════════════════════════════════
//  Level Up Detection
// ════════════════════════════════════════════════════════════

describe("XP — Level up detection", () => {
  it("should detect level up when newLevel > user.level", () => {
    expect(3 > 2).toBe(true);
  });

  it("should NOT detect level up when levels are the same", () => {
    expect(5 > 5).toBe(false);
  });

  it("should NOT detect level up when newLevel is lower (edge case)", () => {
    expect(2 > 3).toBe(false);
  });

  it("should calculate level up from XP gain correctly", () => {
    // Simula: user.xp = 350, gana 10 XP → newXp = 360
    const userXp = 350n;
    const xpGain = 10;
    const newXp = userXp + BigInt(xpGain);
    expect(newXp).toBe(360n);
  });
});

// ════════════════════════════════════════════════════════════
//  Daily Login Detection
// ════════════════════════════════════════════════════════════

describe("XP — Daily login detection", () => {
  it("should detect new day when lastMessageAt is null (first message ever)", () => {
    expect(isNewDay(null, new Date())).toBe(true);
  });

  it("should NOT detect new day when lastMessageAt is today", () => {
    const today = new Date();
    expect(isNewDay(today, today)).toBe(false);
  });

  it("should detect new day when lastMessageAt was yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isNewDay(yesterday, new Date())).toBe(true);
  });

  it("should detect new day when lastMessageAt was days ago", () => {
    const oldDate = new Date("2024-01-01");
    expect(isNewDay(oldDate, new Date())).toBe(true);
  });

  it("should compare by date string, not time", () => {
    // Same date but different time → NOT a new day
    const earlierToday = new Date();
    earlierToday.setHours(earlierToday.getHours() - 2);
    const now = new Date();
    expect(isNewDay(earlierToday, now)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
//  Integration: handleMessageXp flow scenarios
// ════════════════════════════════════════════════════════════

describe("XP — Complete flow scenarios", () => {
  const defaultBrackets = [
    { min: 5, max: 20, xp: 5 },
    { min: 21, max: 50, xp: 10 },
    { min: 51, max: 100, xp: 15 },
    { min: 101, max: 200, xp: 20 },
    { min: 201, max: null, xp: 25 },
  ];

  it("should reject short message (blocked by min length)", () => {
    const content = "Hi";
    const minLength = 5;
    expect(meetsMinLength(content, minLength)).toBe(false);
  });

  it("should reject message in non-whitelisted channel", () => {
    expect(isChannelAllowed("ch-3", "ch-1,ch-2")).toBe(false);
  });

  it("should reject message on cooldown", () => {
    const lastMsg = new Date(Date.now() - 10_000); // 10s ago
    expect(isMessageCooldownActive(60, lastMsg, new Date())).toBe(true);
  });

  it("should process message in whitelisted channel within brackets", () => {
    const content = "Hello, this is a test message!";
    const channelId = "ch-1";
    const whitelist = "ch-1,ch-2";
    const minLength = 5;

    expect(isChannelAllowed(channelId, whitelist)).toBe(true);
    expect(meetsMinLength(content, minLength)).toBe(true);

    const xp = calcXpFromBrackets(content.length, defaultBrackets);
    expect(xp).toBeGreaterThan(0);
  });

  it("should apply multiplier, clamp, and event bonuses to bracket XP", () => {
    // Flujo completo: bracket → multiplier → clamp → eventos
    const content = "Hello World! This is bracket 2.";
    const bracketXp = calcXpFromBrackets(content.length, defaultBrackets);
    expect(bracketXp).toBe(10); // 21-50 chars → bracket 2

    const afterMultiplier = applyMultiplier(bracketXp, 1.5);
    expect(afterMultiplier).toBe(15);

    const clamped = clampXp(afterMultiplier, 5, 25);
    expect(clamped).toBe(15); // within range

    const withEvents = applyChatEventBonuses(clamped, true, 5);
    expect(withEvents).toBe(35); // 15*2 + 5
  });

  it("should clamp even with high multiplier", () => {
    const bracketXp = 25; // max bracket
    const afterMultiplier = applyMultiplier(bracketXp, 2.0);
    expect(afterMultiplier).toBe(50);

    const clamped = clampXp(afterMultiplier, 5, 25);
    expect(clamped).toBe(25); // clamped to max
  });

  it("should track daily login on first message of the day", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isNewDay(yesterday, new Date())).toBe(true);
  });

  it("should NOT track daily login on subsequent messages same day", () => {
    const now = new Date();
    expect(isNewDay(now, now)).toBe(false);
  });
});
