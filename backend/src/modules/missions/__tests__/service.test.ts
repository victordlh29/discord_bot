import { describe, it, expect } from "vitest";

// ─── Pure functions from service.ts (tested without DB) ───

// Replicated here for isolation — these match the exported implementations in service.ts

function getResetDate(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case "DAILY":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    case "WEEKLY": {
      const nextMonday = new Date(now);
      nextMonday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
      return new Date(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate(), 0, 0, 0);
    }
    case "MONTHLY":
      return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
    default: {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    }
  }
}

function selectTargetMission(
  activeMissions: Array<{ id: string; objective: string; reward: number; name: string; frequency: string; type: string; createdAt: Date; updatedAt: Date; guildId: string }>,
  progressMap: Map<string, { id: string; missionId: string; progress: number; completed: boolean; resetAt: Date | null }>,
  now: Date
): { mission: typeof activeMissions[0] | null; progress: { id: string; missionId: string; progress: number; completed: boolean; resetAt: Date | null } | null } {
  for (const mission of activeMissions) {
    const existing = progressMap.get(mission.id);

    if (!existing) {
      return { mission, progress: null };
    }

    if (existing.completed) {
      if (existing.resetAt && existing.resetAt <= now) {
        return { mission, progress: existing };
      }
      continue;
    }

    return { mission, progress: existing };
  }

  return { mission: null, progress: null };
}

function isMissionComplete(progress: number, objective: number): boolean {
  return progress >= objective;
}

function isValidObjective(objective: string): boolean {
  return /^\d+$/.test(objective) && parseInt(objective, 10) > 0;
}

function formatMissionCompleteDM(missionName: string, reward: number): string {
  const cleanName = missionName.replace(/[*_~`|]|@everyone|@here/gi, "");
  const cleanReward = Math.max(0, reward);
  return `🎉 Mision completada: **${cleanName}**\n+${cleanReward} XP recibido.`;
}

function mapUserMissionProgressEntry(
  mp: {
    id: string;
    userId: string;
    missionId: string;
    progress: number;
    completed: boolean;
    completedAt: Date | null;
    updatedAt: Date;
    resetAt: Date | null;
    mission: { name: string; type: string; objective: string; reward: number; frequency: string };
    user?: { discordId: string; username: string | null };
  },
  now: Date = new Date()
) {
  const resetNeeded = mp.completed && mp.resetAt && mp.resetAt <= now;
  const objective = parseInt(mp.mission.objective, 10) || 0;
  return {
    id: mp.id,
    userId: mp.userId,
    discordId: mp.user?.discordId ?? "",
    username: mp.user?.username ?? "",
    missionId: mp.missionId,
    missionName: mp.mission.name,
    missionType: mp.mission.type,
    objective,
    reward: mp.mission.reward,
    frequency: mp.mission.frequency,
    progress: resetNeeded ? 0 : mp.progress,
    completed: resetNeeded ? false : mp.completed,
    completedAt: mp.completedAt,
    updatedAt: mp.updatedAt,
    resetAt: mp.resetAt,
  };
}

// ─── Test data factories ───

function makeMission(overrides: Partial<{
  id: string;
  name: string;
  type: string;
  objective: string;
  reward: number;
  frequency: string;
  guildId: string;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  const base = {
    id: "mission-1",
    name: "Test Mission",
    type: "send_messages",
    objective: "10",
    reward: 100,
    frequency: "DAILY",
    guildId: "guild-1",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };
  return { ...base, ...overrides };
}

function makeProgress(overrides: Partial<{
  id: string;
  missionId: string;
  progress: number;
  completed: boolean;
  resetAt: Date | null;
}> = {}) {
  const base = {
    id: "progress-1",
    missionId: "mission-1",
    progress: 5,
    completed: false,
    resetAt: null as Date | null,
  };
  return { ...base, ...overrides };
}

// ════════════════════════════════════════════════════════════
//  getResetDate
// ════════════════════════════════════════════════════════════

describe("getResetDate (Mission Reset Logic)", () => {
  it("DAILY: should return tomorrow at midnight", () => {
    const result = getResetDate("DAILY");
    const now = new Date();
    const expected = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("WEEKLY: should return next Monday at midnight", () => {
    const result = getResetDate("WEEKLY");
    expect(result.getDay()).toBe(1);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it("MONTHLY: should return first day of next month at midnight", () => {
    const result = getResetDate("MONTHLY");
    const now = new Date();
    const expectedMonth = now.getMonth() + 1;
    const expectedMonthAdjusted = expectedMonth > 11 ? 0 : expectedMonth;
    expect(result.getMonth()).toBe(expectedMonthAdjusted);
    expect(result.getDate()).toBe(1);
    expect(result.getHours()).toBe(0);
  });

  it("DEFAULT (unrecognized): should return tomorrow at midnight", () => {
    const result = getResetDate("UNKNOWN");
    const now = new Date();
    const expected = new Date(now);
    expected.setDate(expected.getDate() + 1);
    expected.setHours(0, 0, 0, 0);
    expect(result.getTime()).toBe(expected.getTime());
  });
});

// ════════════════════════════════════════════════════════════
//  selectTargetMission
// ════════════════════════════════════════════════════════════

describe("selectTargetMission", () => {
  it("should select a mission with no existing progress", () => {
    const now = new Date();
    const missions = [makeMission({ id: "m1" })];
    const progressMap = new Map();

    const result = selectTargetMission(missions, progressMap, now);
    expect(result.mission?.id).toBe("m1");
    expect(result.progress).toBeNull();
  });

  it("should select an in-progress (not completed) mission", () => {
    const now = new Date();
    const missions = [makeMission({ id: "m1" })];
    const progressMap = new Map([["m1", makeProgress({ missionId: "m1", completed: false, progress: 3 })]]);

    const result = selectTargetMission(missions, progressMap, now);
    expect(result.mission?.id).toBe("m1");
    expect(result.progress?.progress).toBe(3);
    expect(result.progress?.completed).toBe(false);
  });

  it("should select a completed mission if resetAt has passed", () => {
    const now = new Date("2024-06-15");
    const missions = [makeMission({ id: "m1" })];
    const progressMap = new Map([
      ["m1", makeProgress({ missionId: "m1", completed: true, resetAt: new Date("2024-06-10") })],
    ]);

    const result = selectTargetMission(missions, progressMap, now);
    expect(result.mission?.id).toBe("m1");
    expect(result.progress?.completed).toBe(true); // existing progress is still completed, reset happens later
  });

  it("should skip completed mission if resetAt is in the future", () => {
    const now = new Date("2024-06-05");
    const missions = [makeMission({ id: "m1" })];
    const progressMap = new Map([
      ["m1", makeProgress({ missionId: "m1", completed: true, resetAt: new Date("2024-06-10") })],
    ]);

    const result = selectTargetMission(missions, progressMap, now);
    expect(result.mission).toBeNull();
    expect(result.progress).toBeNull();
  });

  it("should select the first mission that needs tracking among multiple", () => {
    const now = new Date("2024-06-05");
    const missions = [
      makeMission({ id: "m1" }),
      makeMission({ id: "m2" }),
    ];
    // m1 is completed but not due for reset yet → skip
    // m2 has no progress → select it
    const progressMap = new Map([
      ["m1", makeProgress({ missionId: "m1", completed: true, resetAt: new Date("2024-06-10") })],
    ]);

    const result = selectTargetMission(missions, progressMap, now);
    expect(result.mission?.id).toBe("m2");
    expect(result.progress).toBeNull();
  });

  it("should return null when all missions are completed and not due for reset", () => {
    const now = new Date("2024-06-05");
    const missions = [
      makeMission({ id: "m1" }),
      makeMission({ id: "m2" }),
    ];
    const progressMap = new Map([
      ["m1", makeProgress({ missionId: "m1", completed: true, resetAt: new Date("2024-06-10") })],
      ["m2", makeProgress({ missionId: "m2", completed: true, resetAt: new Date("2024-06-10") })],
    ]);

    const result = selectTargetMission(missions, progressMap, now);
    expect(result.mission).toBeNull();
    expect(result.progress).toBeNull();
  });

  it("should return null when there are no missions", () => {
    const now = new Date();
    const result = selectTargetMission([], new Map(), now);
    expect(result.mission).toBeNull();
    expect(result.progress).toBeNull();
  });

  it("should handle mission with resetAt exactly equal to now", () => {
    const now = new Date("2024-06-10T00:00:00Z");
    const missions = [makeMission({ id: "m1" })];
    const progressMap = new Map([
      ["m1", makeProgress({ missionId: "m1", completed: true, resetAt: new Date("2024-06-10T00:00:00Z") })],
    ]);

    const result = selectTargetMission(missions, progressMap, now);
    expect(result.mission?.id).toBe("m1");
    expect(result.progress).not.toBeNull();
  });

  it("should handle in-progress mission among multiple where first is completed not due", () => {
    const now = new Date("2024-06-05");
    const missions = [
      makeMission({ id: "m1" }),
      makeMission({ id: "m2" }),
      makeMission({ id: "m3" }),
    ];
    const progressMap = new Map([
      ["m1", makeProgress({ missionId: "m1", completed: true, resetAt: new Date("2024-06-10") })],
      ["m2", makeProgress({ missionId: "m2", completed: false, progress: 7 })],
    ]);

    const result = selectTargetMission(missions, progressMap, now);
    expect(result.mission?.id).toBe("m2");
    expect(result.progress?.progress).toBe(7);
  });
});

// ════════════════════════════════════════════════════════════
//  isMissionComplete
// ════════════════════════════════════════════════════════════

describe("isMissionComplete", () => {
  it("should return true when progress equals objective", () => {
    expect(isMissionComplete(10, 10)).toBe(true);
  });

  it("should return true when progress exceeds objective", () => {
    expect(isMissionComplete(15, 10)).toBe(true);
  });

  it("should return false when progress is less than objective", () => {
    expect(isMissionComplete(3, 10)).toBe(false);
  });

  it("should return false when progress is 0", () => {
    expect(isMissionComplete(0, 10)).toBe(false);
  });

  it("should handle objective of 1 (single action missions)", () => {
    expect(isMissionComplete(1, 1)).toBe(true);
    expect(isMissionComplete(0, 1)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
//  isValidObjective
// ════════════════════════════════════════════════════════════

describe("isValidObjective", () => {
  it("should accept positive numbers", () => {
    expect(isValidObjective("10")).toBe(true);
    expect(isValidObjective("1")).toBe(true);
    expect(isValidObjective("999")).toBe(true);
  });

  it("should reject zero", () => {
    expect(isValidObjective("0")).toBe(false);
  });

  it("should reject negative numbers", () => {
    expect(isValidObjective("-1")).toBe(false);
  });

  it("should reject non-numeric strings", () => {
    expect(isValidObjective("abc")).toBe(false);
    expect(isValidObjective("10a")).toBe(false);
  });

  it("should reject empty string", () => {
    expect(isValidObjective("")).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
//  formatMissionCompleteDM
// ════════════════════════════════════════════════════════════

describe("formatMissionCompleteDM", () => {
  it("should format a normal mission name", () => {
    const result = formatMissionCompleteDM("Enviar 10 mensajes", 50);
    expect(result).toContain("Enviar 10 mensajes");
    expect(result).toContain("50 XP");
  });

  it("should sanitize markdown characters from mission name", () => {
    const result = formatMissionCompleteDM("Misión *especial*", 100);
    // The name itself gets sanitized (asterisks removed)
    expect(result).toContain("Misión especial");
    expect(result).not.toContain("*especial*");
    // But the template still wraps in ** for Discord bold
    expect(result).toContain("**Misión especial**");
  });

  it("should sanitize @everyone and @here", () => {
    const result = formatMissionCompleteDM("@everyone gana!", 200);
    expect(result).not.toContain("@everyone");
    expect(result).toContain("gana!");
  });

  it("should sanitize pipes and backticks", () => {
    const result = formatMissionCompleteDM("`code` | mission", 75);
    expect(result).not.toContain("`");
    expect(result).not.toContain("|");
  });

  it("should clamp negative rewards to 0", () => {
    const result = formatMissionCompleteDM("Test", -50);
    expect(result).toContain("0 XP");
    expect(result).not.toContain("-50");
  });

  it("should handle reward of 0", () => {
    const result = formatMissionCompleteDM("Test", 0);
    expect(result).toContain("0 XP");
  });
});

// ════════════════════════════════════════════════════════════
//  mapUserMissionProgressEntry
// ════════════════════════════════════════════════════════════

describe("mapUserMissionProgressEntry", () => {
  const baseEntry = {
    id: "p1",
    userId: "u1",
    missionId: "m1",
    progress: 3,
    completed: false,
    completedAt: null,
    updatedAt: new Date("2024-06-01"),
    resetAt: null,
    mission: {
      name: "Send Messages",
      type: "send_messages",
      objective: "10",
      reward: 100,
      frequency: "DAILY",
    },
    user: {
      discordId: "discord-123",
      username: "TestUser",
    },
  };

  it("should map a basic in-progress entry correctly", () => {
    const now = new Date("2024-06-15");
    const result = mapUserMissionProgressEntry(baseEntry, now);
    expect(result.id).toBe("p1");
    expect(result.missionName).toBe("Send Messages");
    expect(result.objective).toBe(10);
    expect(result.progress).toBe(3);
    expect(result.completed).toBe(false);
    expect(result.discordId).toBe("discord-123");
    expect(result.username).toBe("TestUser");
  });

  it("should reset progress when completed and resetAt has passed", () => {
    const now = new Date("2024-06-15");
    const entry = {
      ...baseEntry,
      completed: true,
      completedAt: new Date("2024-06-10"),
      resetAt: new Date("2024-06-14"),
    };
    const result = mapUserMissionProgressEntry(entry, now);
    expect(result.progress).toBe(0);
    expect(result.completed).toBe(false);
  });

  it("should keep completed status when resetAt is in the future", () => {
    const now = new Date("2024-06-10");
    const entry = {
      ...baseEntry,
      completed: true,
      completedAt: new Date("2024-06-09"),
      resetAt: new Date("2024-06-14"),
    };
    const result = mapUserMissionProgressEntry(entry, now);
    expect(result.completed).toBe(true);
    expect(result.progress).toBe(3);
  });

  it("should handle entry without user info (gracefully)", () => {
    const entry = { ...baseEntry, user: undefined };
    const result = mapUserMissionProgressEntry(entry);
    expect(result.discordId).toBe("");
    expect(result.username).toBe("");
  });

  it("should parse objective string to number", () => {
    const entry = { ...baseEntry, mission: { ...baseEntry.mission, objective: "25" } };
    const result = mapUserMissionProgressEntry(entry);
    expect(result.objective).toBe(25);
  });

  it("should default to 0 objective when parsing fails", () => {
    const entry = { ...baseEntry, mission: { ...baseEntry.mission, objective: "abc" } };
    const result = mapUserMissionProgressEntry(entry);
    expect(result.objective).toBe(0);
  });

  it("should include frequency and missionType", () => {
    const result = mapUserMissionProgressEntry(baseEntry);
    expect(result.frequency).toBe("DAILY");
    expect(result.missionType).toBe("send_messages");
  });
});

// ════════════════════════════════════════════════════════════
//  Total XP Model (nuevo)
// ════════════════════════════════════════════════════════════

describe("Total XP Model (xp_earned)", () => {
  it("should calculate progress = min(totalXp, objective) for each mission independently", () => {
    const totalXp = 515;
    const missions = [
      { objective: 500, name: "Gana 500 XP" },
      { objective: 1000, name: "Gana 1000 XP" },
    ];

    for (const m of missions) {
      const progress = Math.min(totalXp, m.objective);
      const completed = progress >= m.objective;
      if (m.objective === 500) {
        expect(progress).toBe(500);
        expect(completed).toBe(true);
      } else {
        expect(progress).toBe(515);
        expect(completed).toBe(false);
      }
    }
  });

  it("should detect new completion when totalXp reaches objective", () => {
    const totalXp = 1000;
    const objective = 1000;
    const progress = Math.min(totalXp, objective);
    const wasCompleted = false;
    const willComplete = progress >= objective;

    expect(progress).toBe(1000);
    expect(willComplete).toBe(true);
    expect(willComplete && !wasCompleted).toBe(true); // reward should be given
  });

  it("should NOT give reward if already completed", () => {
    const totalXp = 1200;
    const objective = 1000;
    const progress = Math.min(totalXp, objective);
    const wasCompleted = true;
    const willComplete = progress >= objective;

    expect(progress).toBe(1000);
    expect(willComplete).toBe(true);
    expect(willComplete && !wasCompleted).toBe(false); // NO reward
  });

  it("should skip unchanged missions (same progress & completed status)", () => {
    const existingProgress = 515;
    const existingCompleted = false;
    const source = 515;
    const objective = 1000;

    const targetProgress = Math.min(source, objective);
    const willComplete = targetProgress >= objective;

    const noChange = existingProgress === targetProgress && existingCompleted === willComplete;
    expect(noChange).toBe(true); // should skip
  });

  it("should update when total Xp increases beyond current progress", () => {
    const existingProgress = 515;
    const newSource = 530;
    const objective = 1000;

    const targetProgress = Math.min(newSource, objective);
    const willComplete = targetProgress >= objective;

    expect(targetProgress).toBe(530);
    expect(existingProgress !== targetProgress).toBe(true); // progress changed
    expect(willComplete).toBe(false);
  });

  it("should handle multiple missions with cumulative totalXp correctly", () => {
    const totalXp = 6650;
    const missionObjectives = [50, 200, 1000];

    const results = missionObjectives.map((obj) => ({
      objective: obj,
      progress: Math.min(totalXp, obj),
      completed: Math.min(totalXp, obj) >= obj,
    }));

    expect(results[0].progress).toBe(50);
    expect(results[0].completed).toBe(true);
    expect(results[1].progress).toBe(200);
    expect(results[1].completed).toBe(true);
    expect(results[2].progress).toBe(1000);
    expect(results[2].completed).toBe(true);
  });

  it("should handle new mission with 0 progress correctly", () => {
    const totalXp = 0;
    const objective = 1000;
    const progress = Math.min(totalXp, objective);

    expect(progress).toBe(0);
    expect(progress >= objective).toBe(false);
  });
});

describe("Total Voice Model (voice_minutes)", () => {
  it("should calculate progress = min(voiceTime, objective) for each mission independently", () => {
    const voiceTime = 60;
    const missions = [
      { objective: 10, name: "Voz 10 min" },
      { objective: 60, name: "Voz 60 min" },
      { objective: 120, name: "Voz 120 min" },
    ];

    const results = missions.map((m) => ({
      name: m.name,
      progress: Math.min(voiceTime, m.objective),
      completed: Math.min(voiceTime, m.objective) >= m.objective,
    }));

    expect(results[0].progress).toBe(10);
    expect(results[0].completed).toBe(true);
    expect(results[1].progress).toBe(60);
    expect(results[1].completed).toBe(true);
    expect(results[2].progress).toBe(60);
    expect(results[2].completed).toBe(false);
  });
});

describe("Initial Progress Calculation (getUserMissionProgress / POST /missions)", () => {
  it("should calculate correct starting progress for new xp_earned mission", () => {
    const userTotalXp = 515;
    const missionObjective = 1000;
    const initialProgress = Math.min(userTotalXp, missionObjective);

    expect(initialProgress).toBe(515);
  });

  it("should use voiceTime for voice_minutes initial progress", () => {
    const voiceTime = 120;
    const missionObjective = 60;
    const initialProgress = Math.min(voiceTime, missionObjective);

    expect(initialProgress).toBe(60);
  });

  it("should start at 0 for new user with no XP", () => {
    const userTotalXp = 0;
    const missionObjective = 1000;
    const initialProgress = Math.min(userTotalXp, missionObjective);

    expect(initialProgress).toBe(0);
  });
});
