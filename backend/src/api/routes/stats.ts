import { Router, Response } from "express";
import prisma from "../../core/database/prisma";
import { AuthRequest } from "../../types";
import { resolveGuildId } from "../../core/utils/guild";

const router = Router();

router.get("/", async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const [
    totalUsers,
    totalXp,
    totalVoiceTime,
    totalMessages,
    totalRanks,
    activeEvents,
    activeMissions,
    recentLogs,
  ] = await Promise.all([
    prisma.user.count({ where: { guildId } }),
    prisma.user.aggregate({ where: { guildId }, _sum: { xp: true } }),
    prisma.user.aggregate({ where: { guildId }, _sum: { voiceTime: true } }),
    prisma.messageLog.count({ where: { guildId } }),
    prisma.rank.count({ where: { guildId } }),
    prisma.event.count({ where: { isActive: true, guildId } }),
    prisma.mission.count({ where: { guildId } }),
    prisma.log.findMany({ where: { guildId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  res.json({
    status: "success",
    data: {
      totalUsers,
      totalXp: totalXp._sum.xp?.toString() || "0",
      totalVoiceTime: totalVoiceTime._sum.voiceTime || 0,
      totalMessages,
      totalRanks,
      activeEvents,
      activeMissions,
      recentLogs,
    },
  });
});

export default router;
