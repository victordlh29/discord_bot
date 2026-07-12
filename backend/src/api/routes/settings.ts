import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../core/database/prisma";
import { AuthRequest } from "../../types";
import { requireAdmin } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createLog } from "../../modules/logs/service";
import { resolveGuildId } from "../../core/utils/guild";

const router = Router();

const settingsSchema = z.record(z.string().min(1).max(100), z.string().max(10000));

router.get("/", async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const settings = await prisma.setting.findMany({ where: { guildId }, orderBy: { key: "asc" } });
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  res.json({ status: "success", data: map });
});

router.put("/", requireAdmin, validate(settingsSchema), async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const updates = req.body as Record<string, string>;
  const results: Record<string, string> = {};

  const entries = Object.entries(updates);
  const settings = await Promise.all(entries.map(([key, value]) =>
    prisma.setting.upsert({
      where: { key_guildId: { key, guildId } },
      update: { value: String(value) },
      create: { key, value: String(value), guildId },
    })
  ));
  for (let i = 0; i < entries.length; i++) {
    results[entries[i][0]] = settings[i].value;
  }

  await createLog({
    action: "SETTINGS_UPDATE",
    entity: "settings",
    userId: req.user?.discordId,
    details: JSON.stringify(updates),
  });

  res.json({ status: "success", data: results });
});

export default router;
