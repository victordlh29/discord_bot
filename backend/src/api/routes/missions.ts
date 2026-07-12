import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../core/database/prisma";
import { AuthRequest } from "../../types";
import { requireAdmin } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createLog } from "../../modules/logs/service";
import { announceMission } from "../../core/utils/announcer";
import { resolveGuildId } from "../../core/utils/guild";
import { emitMissionUpdate } from "../../core/utils/sse";
import { calculateLevel } from "../../core/utils/helpers";
import { trackMissionProgress, getResetDate, invalidateMissionCache } from "../../modules/missions/service";
import { logger } from "../../core/utils/logger";

const router = Router();
const missionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["send_messages", "voice_minutes", "xp_earned", "level_up", "daily_login", "role_gift"]),
  objective: z.string().regex(/^\d+$/, "El objetivo debe ser un número positivo"),
  reward: z.number().int().default(0),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "UNICA"]),
});
const missionUpdateSchema = missionSchema.partial();
const simulateTypeSchema = z.enum(["send_messages", "voice_minutes", "xp_earned", "level_up", "daily_login", "role_gift"]);
type MissionInput = z.infer<typeof missionSchema>;
type MissionUpdateInput = z.infer<typeof missionUpdateSchema>;

router.get("/", async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const missions = await prisma.mission.findMany({ where: { guildId }, orderBy: { createdAt: "desc" } });
  res.json({ status: "success", data: missions });
});

router.get("/progress", async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const progress = await prisma.userMissionProgress.findMany({
    where: { mission: { guildId } },
    include: { mission: true, user: { select: { discordId: true, username: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const mapped = progress.map((p) => {
    const resetNeeded = p.completed && p.resetAt && p.resetAt <= new Date();
    return {
      id: p.id,
      userId: p.userId,
      discordId: p.user.discordId,
      username: p.user.username,
      missionId: p.missionId,
      missionName: p.mission.name,
      missionType: p.mission.type,
      objective: parseInt(p.mission.objective, 10) || 0,
      reward: p.mission.reward,
      progress: resetNeeded ? 0 : p.progress,
      completed: resetNeeded ? false : p.completed,
      completedAt: p.completedAt,
      updatedAt: p.updatedAt,
      resetAt: p.resetAt,
    };
  });

  res.json({ status: "success", data: mapped });
});

router.post("/", requireAdmin, validate(missionSchema), async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const data = req.body as MissionInput;
  const mission = await prisma.mission.create({ data: { ...data, guildId } });

  // Initialize progress for all existing users so the mission appears immediately in the dashboard
  const users = await prisma.user.findMany({ where: { guildId }, select: { id: true, xp: true, voiceTime: true } });
  if (users.length > 0) {
    const isTotalType = mission.type === "xp_earned" || mission.type === "voice_minutes";
    const missionObj = parseInt(mission.objective, 10) || 0;

    await prisma.userMissionProgress.createMany({
      data: users.map((u) => {
        let initialProgress = 0;

        if (isTotalType) {
          const source = mission.type === "xp_earned" ? Number(u.xp) : u.voiceTime;
          initialProgress = Math.min(source, missionObj);
        }

        return {
          userId: u.id,
          missionId: mission.id,
          guildId,
          progress: initialProgress,
          completed: false,
          completedAt: null,
          resetAt: null,
        };
      }),
      skipDuplicates: true,
    });

    // Para misiones de tipo total (xp_earned, voice_minutes): si el usuario ya cumple
    // el objetivo, marcar como completada y otorgar la recompensa inmediatamente
    if (isTotalType && missionObj > 0 && mission.reward > 0) {
      const now = new Date();
      for (const u of users) {
        const source = mission.type === "xp_earned" ? Number(u.xp) : u.voiceTime;
        if (source >= missionObj) {
          const progressEntry = await prisma.userMissionProgress.findFirst({
            where: { userId: u.id, missionId: mission.id },
          });
          if (progressEntry && !progressEntry.completed) {
            const newXp = Number(u.xp) + mission.reward;
            await prisma.$transaction(async (tx) => {
              await tx.userMissionProgress.update({
                where: { id: progressEntry.id },
                data: {
                  completed: true,
                  completedAt: now,
                  resetAt: getResetDate(mission.frequency),
                },
              });
              await tx.user.update({
                where: { id: u.id },
                data: {
                  xp: { increment: BigInt(mission.reward) },
                  level: calculateLevel(BigInt(newXp)),
                },
              });
              await tx.xpLog.create({
                data: {
                  userId: u.id,
                  xpAmount: BigInt(mission.reward),
                  reason: `mission:${mission.id}`,
                  guildId,
                },
              });
            });
          }
        }
      }
    }
  }

  invalidateMissionCache(guildId);
  emitMissionUpdate(guildId);

  await Promise.all([
    createLog({ action: "MISSION_CREATE", entity: "mission", entityId: mission.id, userId: req.user?.discordId, details: JSON.stringify(data) }),
    announceMission("create", mission),
  ]);
  res.status(201).json({ status: "success", data: mission });
});

router.put("/:id", requireAdmin, validate(missionUpdateSchema), async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const id = req.params.id as string;
  const updates = req.body as MissionUpdateInput;
  const mission = await prisma.mission.update({ where: { id, guildId }, data: updates });

  invalidateMissionCache(guildId);
  emitMissionUpdate(guildId);

  await Promise.all([
    createLog({ action: "MISSION_UPDATE", entity: "mission", entityId: id, userId: req.user?.discordId, details: JSON.stringify(updates) }),
    announceMission("update", mission),
  ]);
  res.json({ status: "success", data: mission });
});

router.post("/simulate-daily-login", requireAdmin, async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const { userId } = req.body as { userId?: string };

  if (!userId) {
    res.status(400).json({ status: "error", message: "Se requiere userId (discordId del usuario)" });
    return;
  }

  try {
    await trackMissionProgress(userId, "daily_login", 1, guildId);

    const user = await prisma.user.findUnique({
      where: { discordId_guildId: { discordId: userId, guildId } },
      select: { id: true },
    });

    if (user) {
      const progress = await prisma.userMissionProgress.findMany({
        where: { userId: user.id, mission: { type: "daily_login", guildId } },
        include: { mission: true },
      });

      emitMissionUpdate(guildId);

      res.json({
        status: "success",
        message: "Daily login simulado correctamente",
        data: progress.map((p) => ({
          missionName: p.mission.name,
          progress: p.progress,
          objective: parseInt(p.mission.objective, 10),
          completed: p.completed,
          reward: p.mission.reward,
        })),
      });
    } else {
      res.json({ status: "success", message: "Usuario no encontrado en la BD. No se pudo registrar progreso." });
    }
  } catch {
    logger.error("Error in simulate-daily-login");
    res.status(500).json({ status: "error", message: "Error interno del servidor" });
  }
});

router.post("/simulate", requireAdmin, async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const { userId, type, amount } = req.body as { userId?: string; type?: string; amount?: number };

  if (!userId) {
    res.status(400).json({ status: "error", message: "Se requiere userId (discordId del usuario)" });
    return;
  }

  const missionType = type || "daily_login";
  const parsed = simulateTypeSchema.safeParse(missionType);
  if (!parsed.success) {
    res.status(400).json({
      status: "error",
      message: "Tipo invalido. Usar: send_messages, voice_minutes, xp_earned, level_up, daily_login, role_gift",
    });
    return;
  }

  const simAmount = Math.max(1, amount || 1);

  try {
    await trackMissionProgress(userId, parsed.data, simAmount, guildId);

    const user = await prisma.user.findUnique({
      where: { discordId_guildId: { discordId: userId, guildId } },
      select: { id: true },
    });

    if (user) {
      const progress = await prisma.userMissionProgress.findMany({
        where: { userId: user.id, mission: { guildId } },
        include: { mission: true },
        orderBy: { updatedAt: "desc" },
      });

      emitMissionUpdate(guildId);

      res.json({
        status: "success",
        message: "Simulacion de " + missionType + " ejecutada (+" + simAmount + ")",
        data: progress.map((p) => ({
          missionName: p.mission.name,
          missionType: p.mission.type,
          missionFrequency: p.mission.frequency,
          progress: p.progress,
          objective: parseInt(p.mission.objective, 10),
          completed: p.completed,
          reward: p.mission.reward,
        })),
      });
    } else {
      res.json({ status: "success", message: "Usuario no encontrado en la BD. No se pudo registrar progreso." });
    }
  } catch {
    logger.error("Error in simulate mission");
    res.status(500).json({ status: "error", message: "Error interno del servidor" });
  }
});

router.post("/recalculate", requireAdmin, async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);

  try {
    const users = await prisma.user.findMany({ where: { guildId } });
    const xpMissions = await prisma.mission.findMany({
      where: { type: "xp_earned", guildId },
      orderBy: { createdAt: "asc" },
    });
    const voiceMissions = await prisma.mission.findMany({
      where: { type: "voice_minutes", guildId },
      orderBy: { createdAt: "asc" },
    });

    let updatedCount = 0;

    for (const user of users) {
      for (const mission of xpMissions) {
        const obj = parseInt(mission.objective, 10) || 0;
        if (obj <= 0) continue;

        const newProgress = Math.min(Number(user.xp), obj);
        const isCompleted = newProgress >= obj;

        await prisma.userMissionProgress.upsert({
          where: { userId_missionId: { userId: user.id, missionId: mission.id } },
          update: {
            progress: newProgress,
            completed: isCompleted,
            completedAt: isCompleted ? new Date() : null,
            resetAt: isCompleted ? getResetDate(mission.frequency) : null,
          },
          create: {
            userId: user.id,
            missionId: mission.id,
            guildId,
            progress: newProgress,
            completed: isCompleted,
            completedAt: isCompleted ? new Date() : null,
            resetAt: isCompleted ? getResetDate(mission.frequency) : null,
          },
        });
        updatedCount++;
      }

      for (const mission of voiceMissions) {
        const obj = parseInt(mission.objective, 10) || 0;
        if (obj <= 0) continue;

        const newProgress = Math.min(user.voiceTime, obj);
        const isCompleted = newProgress >= obj;

        await prisma.userMissionProgress.upsert({
          where: { userId_missionId: { userId: user.id, missionId: mission.id } },
          update: {
            progress: newProgress,
            completed: isCompleted,
            completedAt: isCompleted ? new Date() : null,
            resetAt: isCompleted ? getResetDate(mission.frequency) : null,
          },
          create: {
            userId: user.id,
            missionId: mission.id,
            guildId,
            progress: newProgress,
            completed: isCompleted,
            completedAt: isCompleted ? new Date() : null,
            resetAt: isCompleted ? getResetDate(mission.frequency) : null,
          },
        });
        updatedCount++;
      }
    }

    invalidateMissionCache(guildId);
    emitMissionUpdate(guildId);
    res.json({
      status: "success",
      message: "Progreso recalculado para " + users.length + " usuarios (" + updatedCount + " entradas actualizadas)",
    });
  } catch {
    logger.error("Error in recalculate missions");
    res.status(500).json({ status: "error", message: "Error interno del servidor" });
  }
});

router.delete("/:id", requireAdmin, async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const id = req.params.id as string;
  await prisma.userMissionProgress.deleteMany({ where: { missionId: id, mission: { guildId } } });
  await Promise.all([
    prisma.mission.delete({ where: { id, guildId } }),
    createLog({ action: "MISSION_DELETE", entity: "mission", entityId: id, userId: req.user?.discordId }),
  ]);
  invalidateMissionCache(guildId);
  emitMissionUpdate(guildId);
  res.json({ status: "success", message: "Mission deleted" });
});

export default router;
