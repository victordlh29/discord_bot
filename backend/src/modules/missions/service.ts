import type { GuildMember } from "discord.js";
import prisma from "../../core/database/prisma";
import { logger } from "../../core/utils/logger";
import { getClient } from "../../core/utils/client";
import { emitMissionProgress } from "../../core/utils/sse";
import { checkRankUp } from "../levels/service";
import { calculateLevel } from "../../core/utils/helpers";

type ActiveMission = { id: string; objective: string; reward: number; name: string; frequency: string; type: string; createdAt: Date; updatedAt: Date; guildId: string };

// Caché en memoria para misiones activas — evita queries DB en cada mensaje/evento de voz
const activeMissionsCache = new Map<string, { result: ActiveMission[]; expiresAt: number }>();
const MISSION_CACHE_TTL_MS = 10_000; // 10 segundos

function getCachedMissions(guildId: string, type: string): ActiveMission[] | null {
  const cacheKey = `${guildId}:${type}`;
  const cached = activeMissionsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  return null;
}

function setCachedMissions(guildId: string, type: string, missions: ActiveMission[]): void {
  const cacheKey = `${guildId}:${type}`;
  activeMissionsCache.set(cacheKey, { result: missions, expiresAt: Date.now() + MISSION_CACHE_TTL_MS });
}

export function invalidateMissionCache(guildId?: string): void {
  if (guildId) {
    // Invalidar solo las entradas de ese guild
    for (const key of activeMissionsCache.keys()) {
      if (key.startsWith(guildId)) {
        activeMissionsCache.delete(key);
      }
    }
  } else {
    activeMissionsCache.clear();
  }
}

/** Pure: selects which mission to track progress for, given active missions and existing progress */
export function selectTargetMission(
  activeMissions: Array<{ id: string; objective: string; reward: number; name: string; frequency: string; type: string; createdAt: Date; updatedAt: Date; guildId: string }>,
  progressMap: Map<string, { id: string; missionId: string; progress: number; completed: boolean; resetAt: Date | null }>,
  now: Date
): { mission: typeof activeMissions[0] | null; progress: typeof progressMap extends Map<string, infer P> ? P | null : null } {
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

/** Pure: maps a UserMissionProgress entry to its API response shape */
export function mapUserMissionProgressEntry(
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

/** Pure: checks if progress has exceeded or met the objective */
export function isMissionComplete(progress: number, objective: number): boolean {
  return progress >= objective;
}

/** Pure: validates an objective string */
export function isValidObjective(objective: string): boolean {
  return /^\d+$/.test(objective) && parseInt(objective, 10) > 0;
}

/** Pure: generates a DM message for mission completion */
export function formatMissionCompleteDM(missionName: string, reward: number): string {
  const cleanName = missionName.replace(/[*_~`|]|@everyone|@here/gi, "");
  const cleanReward = Math.max(0, reward);
  return `🎉 Mision completada: **${cleanName}**\n+${cleanReward} XP recibido.`;
}

export async function trackMissionProgress(
  discordId: string,
  eventType: "send_messages" | "voice_minutes" | "xp_earned" | "level_up" | "daily_login" | "role_gift",
  amount: number = 1,
  guildId: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { discordId_guildId: { discordId, guildId } } });
  if (!user) return;

  let activeMissions = getCachedMissions(guildId, eventType);
  if (!activeMissions) {
    activeMissions = await prisma.mission.findMany({
      where: { type: eventType, guildId },
      orderBy: { createdAt: "asc" },
    });
    setCachedMissions(guildId, eventType, activeMissions);
  }

  if (activeMissions.length === 0) return;

  const allProgress = await prisma.userMissionProgress.findMany({
    where: { userId: user.id, missionId: { in: activeMissions.map((m) => m.id) } },
  });

  const progressMap = new Map(allProgress.map((p) => [p.missionId, p]));
  const now = new Date();

  const completedMissions: Array<{ id: string; name: string; reward: number }> = [];
  const progressedMissionIds = new Set<string>();

  await prisma.$transaction(async (tx) => {
    // Refrescar datos del usuario dentro de la transacción para evitar race conditions
    const freshUser = await tx.user.findUnique({ where: { id: user.id } });
    if (!freshUser) return;

    // Para tipos basados en total acumulado (xp_earned, voice_minutes)
    // Cada misión refleja el TOTAL del usuario de forma independiente
    if (eventType === "xp_earned" || eventType === "voice_minutes") {
      const source = eventType === "xp_earned" ? Number(freshUser.xp) : freshUser.voiceTime;
      let cumulativeXpReward = 0n;

      for (const mission of activeMissions) {
        const existing = progressMap.get(mission.id);
        const obj = parseInt(mission.objective, 10) || 0;
        if (obj <= 0) continue;

        // Calcular progreso basado en el total acumulado (XP o voiceTime)
        const targetProgress = Math.min(source, obj);
        const willComplete = targetProgress >= obj;
        const wasCompleted = existing?.completed ?? false;

        // Ya completada y no necesita reset → saltar
        if (existing?.completed) {
          const needsReset = existing.resetAt && existing.resetAt <= now;
          if (!needsReset) continue;
          // Reset: reiniciar progreso
          await tx.userMissionProgress.update({
            where: { id: existing.id },
            data: { progress: 0, completed: false, completedAt: null, resetAt: null },
          });
        }

        // Saltar si no hay cambios
        if (existing && existing.progress === targetProgress && existing.completed === willComplete) {
          continue;
        }

        if (existing) {
          await tx.userMissionProgress.update({
            where: { id: existing.id },
            data: {
              progress: targetProgress,
              completed: willComplete,
              completedAt: willComplete && !wasCompleted ? now : existing.completedAt,
              resetAt: willComplete && !wasCompleted ? getResetDate(mission.frequency) : existing.resetAt,
            },
          });
        } else {
          await tx.userMissionProgress.create({
            data: {
              userId: user.id,
              missionId: mission.id,
              guildId,
              progress: targetProgress,
              completed: willComplete,
              completedAt: willComplete ? now : null,
              resetAt: willComplete ? getResetDate(mission.frequency) : null,
            },
          });
        }

        // Otorgar recompensa solo si se acaba de completar ahora
        if (willComplete && !wasCompleted) {
          cumulativeXpReward += BigInt(mission.reward);
          const newXp = freshUser.xp + cumulativeXpReward;
          await tx.user.update({
            where: { id: user.id },
            data: {
              xp: { increment: BigInt(mission.reward) },
              level: calculateLevel(newXp),
            },
          });

          await tx.xpLog.create({
            data: {
              userId: user.id,
              xpAmount: BigInt(mission.reward),
              reason: `mission:${mission.id}`,
              guildId,
            },
          });

          completedMissions.push({ id: mission.id, name: mission.name, reward: mission.reward });
          logger.info(`User ${discordId} completed mission ${mission.name} (+${mission.reward} XP)`);
        }
      }
    } else {
      // Para tipos incrementales (send_messages, level_up, daily_login, role_gift)
      // Cada misión recibe el incremento de forma independiente
      let cumulativeXpReward = 0n;

      for (const mission of activeMissions) {
        const existing = progressMap.get(mission.id);
        const obj = parseInt(mission.objective, 10) || 0;
        if (obj <= 0) continue;

        const wasCompleted = existing?.completed ?? false;

        // Ya completada y no necesita reset → saltar
        if (existing?.completed) {
          const needsReset = existing.resetAt && existing.resetAt <= now;
          if (!needsReset) continue;
          // Reset: reiniciar progreso
          await tx.userMissionProgress.update({
            where: { id: existing.id },
            data: { progress: 0, completed: false, completedAt: null, resetAt: null },
          });
        }

        if (existing) {
          // Incrementar progreso existente
          await tx.userMissionProgress.updateMany({
            where: { id: existing.id, progress: { lt: obj } },
            data: { progress: { increment: amount } },
          });

          const updated = await tx.userMissionProgress.findUnique({ where: { id: existing.id } });
          const newProgress = updated?.progress ?? amount;
          const willComplete = isMissionComplete(newProgress, obj);

          progressedMissionIds.add(mission.id);

          if (willComplete && !wasCompleted) {
            await tx.userMissionProgress.update({
              where: { id: existing.id },
              data: {
                completed: true,
                completedAt: now,
                resetAt: getResetDate(mission.frequency),
              },
            });

            cumulativeXpReward += BigInt(mission.reward);
            const newXp = freshUser.xp + cumulativeXpReward;
            await tx.user.update({
              where: { id: user.id },
              data: {
                xp: { increment: BigInt(mission.reward) },
                level: calculateLevel(newXp),
              },
            });

            await tx.xpLog.create({
              data: {
                userId: user.id,
                xpAmount: BigInt(mission.reward),
                reason: `mission:${mission.id}`,
                guildId,
              },
            });

            completedMissions.push({ id: mission.id, name: mission.name, reward: mission.reward });
            logger.info(`User ${discordId} completed mission ${mission.name} (+${mission.reward} XP)`);
          }
        } else {
          // Crear nuevo progreso
          const newProgress = Math.min(amount, obj);
          const createCompleted = isMissionComplete(newProgress, obj);

          await tx.userMissionProgress.create({
            data: {
              userId: user.id,
              missionId: mission.id,
              guildId,
              progress: newProgress,
              completed: createCompleted,
              completedAt: createCompleted ? now : null,
              resetAt: createCompleted ? getResetDate(mission.frequency) : null,
            },
          });

          progressedMissionIds.add(mission.id);

          if (createCompleted) {
            cumulativeXpReward += BigInt(mission.reward);
            const newXp = freshUser.xp + cumulativeXpReward;
            await tx.user.update({
              where: { id: user.id },
              data: {
                xp: { increment: BigInt(mission.reward) },
                level: calculateLevel(newXp),
              },
            });

            await tx.xpLog.create({
              data: {
                userId: user.id,
                xpAmount: BigInt(mission.reward),
                reason: `mission:${mission.id}`,
                guildId,
              },
            });

            completedMissions.push({ id: mission.id, name: mission.name, reward: mission.reward });
            logger.info(`User ${discordId} completed mission ${mission.name} (+${mission.reward} XP)`);
          }
        }
      }
    }
  });

  // Emitir SSE para cada misión que tuvo progreso
  for (const cm of completedMissions) {
    emitMissionProgress(guildId, cm.id, discordId);
  }
  // Para misiones incrementales sin completar, emitir SSE para actualizar UI
  if (completedMissions.length === 0 && progressedMissionIds.size > 0) {
    for (const id of progressedMissionIds) {
      emitMissionProgress(guildId, id, discordId);
    }
  }

  if (completedMissions.length > 0) {
    const client = getClient();
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });

    for (const cm of completedMissions) {
      // Verificar rank-up después de cada reward
      if (updatedUser) {
        let member: GuildMember | null = null;
        if (client) {
          const guild = client.guilds.cache.get(guildId);
          if (guild) {
            member = await guild.members.fetch(discordId).catch(() => null);
          }
        }
        await checkRankUp(user.id, updatedUser.xp, guildId, member);
      }

      // Enviar DM por cada misión completada
      if (client) {
        try {
          const discordUser = await client.users.fetch(discordId);
          if (discordUser) {
            await discordUser.send(formatMissionCompleteDM(cm.name, cm.reward));
          }
        } catch {
          logger.warn(`Failed to send mission completion DM to ${discordId}`);
        }
      }
    }
  }
}

export async function getUserMissionProgress(discordId: string, guildId: string) {
  const user = await prisma.user.findUnique({
    where: { discordId_guildId: { discordId, guildId } },
    include: {
      missionProgress: {
        include: { mission: true },
      },
    },
  });
  if (!user) return [];

  // Auto-create progress entries for any active missions that the user doesn't have yet
  const activeMissions = await prisma.mission.findMany({
    where: { guildId },
  });

  const existingMissionIds = new Set(user.missionProgress.map((mp) => mp.missionId));
  const missingMissions = activeMissions.filter((m) => !existingMissionIds.has(m.id));

  let progressEntries = user.missionProgress;

  if (missingMissions.length > 0) {
    // Calcular progreso inicial para misiones basadas en total acumulado
    const userTotalXp = Number(user.xp);
    const userVoiceTime = user.voiceTime;

    const createData = missingMissions.map((m) => {
      let initialProgress = 0;

      if (m.type === "xp_earned") {
        initialProgress = Math.min(userTotalXp, parseInt(m.objective, 10) || 0);
      } else if (m.type === "voice_minutes") {
        initialProgress = Math.min(userVoiceTime, parseInt(m.objective, 10) || 0);
      }

      // Para tipos acumulativos (xp_earned, voice_minutes): si el usuario
      // ya cumple el objetivo, marcar como completada. El reward se otorgó
      // cuando se creó la misión (POST /missions) o lo otorgará
      // trackMissionProgress cuando se ejecute la próxima vez.
      const alreadyCompleted = isMissionComplete(initialProgress, parseInt(m.objective, 10) || 0);
      return {
        userId: user.id,
        missionId: m.id,
        guildId,
        progress: initialProgress,
        completed: alreadyCompleted,
        completedAt: alreadyCompleted ? new Date() : null,
        resetAt: alreadyCompleted ? getResetDate(m.frequency) : null,
      };
    });

    await prisma.userMissionProgress.createMany({
      data: createData,
      skipDuplicates: true,
    });

    // Otorgar rewards para misiones acumulativas que ya estaban completadas al crearse
    const completedCumulative = missingMissions.filter(
      (m) => (m.type === "xp_earned" || m.type === "voice_minutes") &&
        isMissionComplete(
          m.type === "xp_earned" ? userTotalXp : userVoiceTime,
          parseInt(m.objective, 10) || 0
        )
    );

    let xpRewardTotal = 0n;
    for (const cm of completedCumulative) {
      xpRewardTotal += BigInt(cm.reward);
    }

    if (xpRewardTotal > 0n) {
      const newXp = user.xp + xpRewardTotal;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          xp: { increment: xpRewardTotal },
          level: calculateLevel(newXp),
        },
      });

      // Crear xpLog por cada misión completada
      for (const cm of completedCumulative) {
        await prisma.xpLog.create({
          data: {
            userId: user.id,
            xpAmount: BigInt(cm.reward),
            reason: `mission:${cm.id}`,
            guildId,
          },
        });

        logger.info(`User ${discordId} auto-completed cumulative mission ${cm.name} (+${cm.reward} XP)`);

        // Emitir SSE
        emitMissionProgress(guildId, cm.id, discordId);

        // Enviar DM
        try {
          const client = getClient();
          if (client) {
            const discordUser = await client.users.fetch(discordId);
            if (discordUser) {
              await discordUser.send(formatMissionCompleteDM(cm.name, cm.reward));
            }
          }
        } catch {
          logger.warn(`Failed to send mission completion DM to ${discordId}`);
        }
      }

      // Verificar rank-up
      const client = getClient();
      let member: GuildMember | null = null;
      if (client) {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          member = await guild.members.fetch(discordId).catch(() => null);
        }
      }
      await checkRankUp(user.id, newXp, guildId, member);
    }

    // Re-fetch to get the new entries
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        missionProgress: {
          include: { mission: true },
        },
      },
    });
    if (updatedUser) {
      progressEntries = updatedUser.missionProgress;
    }
  }

  return progressEntries.map((mp) => {
    const { missionName, missionType, objective, reward, frequency, progress, completed, completedAt } =
      mapUserMissionProgressEntry({
        id: mp.id,
        userId: mp.userId,
        missionId: mp.missionId,
        progress: mp.progress,
        completed: mp.completed,
        completedAt: mp.completedAt,
        updatedAt: mp.updatedAt,
        resetAt: mp.resetAt,
        mission: {
          name: mp.mission.name,
          type: mp.mission.type,
          objective: mp.mission.objective,
          reward: mp.mission.reward,
          frequency: mp.mission.frequency,
        },
      });
    return {
      id: mp.id,
      missionId: mp.missionId,
      missionName,
      missionType,
      objective,
      reward,
      frequency,
      progress,
      completed,
      completedAt,
    };
  });
}

export function getResetDate(frequency: string): Date | null {
  // ÚNICA nunca se resetea
  if (frequency === "UNICA") return null;

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
    default:
      return null;
  }
}

export async function checkAndResetMissions(): Promise<void> {
  const now = new Date();
  const expired = await prisma.userMissionProgress.findMany({
    where: {
      resetAt: { lte: now },
    },
    include: { mission: { select: { frequency: true } } },
    take: 10000,
  });

  await Promise.all(expired.map((item) =>
    prisma.userMissionProgress.update({
      where: { id: item.id },
      data: {
        progress: 0,
        completed: false,
        completedAt: null,
        resetAt: getResetDate(item.mission.frequency),
      },
    })
  ));

  if (expired.length > 0) {
    logger.info(`Reset ${expired.length} expired mission progress entries`);
  }
}
