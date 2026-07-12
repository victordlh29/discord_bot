import { Router, Response } from "express";
import prisma from "../../core/database/prisma";
import { AuthRequest } from "../../types";
import { resolveGuildId } from "../../core/utils/guild";

const router = Router();

router.get("/", async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const page = parseInt(String(req.query.page)) || 1;
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit)) || 50));
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.log.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.log.count({ where: { guildId } }),
  ]);

  res.json({
    status: "success",
    data: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export default router;
