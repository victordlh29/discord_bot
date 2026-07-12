import { Router, Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../../types";
import { requireAdmin } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { resolveGuildId } from "../../core/utils/guild";
import {
  getRanks,
  createRank,
  updateRank,
  deleteRank,
  reorderRank,
} from "../../modules/ranks/service";

const router = Router();
const rankSchema = z.object({
  name: z.string().min(1).max(100),
  requiredXp: z.number().min(0),
  discordRoleId: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  gifUrl: z.string().optional().nullable(),
  position: z.number().int().min(0),
});
const rankUpdateSchema = rankSchema.partial();

router.get("/", async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const ranks = await getRanks(guildId);
  res.json({ status: "success", data: ranks });
});

router.post("/", requireAdmin, validate(rankSchema), async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const rank = await createRank(req.body, guildId, req.user?.discordId);
  res.status(201).json({ status: "success", data: rank });
});

router.put("/:id", requireAdmin, validate(rankUpdateSchema), async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const id = req.params.id as string;
  const rank = await updateRank(id, req.body, guildId, req.user?.discordId);
  res.json({ status: "success", data: rank });
});

router.delete("/:id", requireAdmin, async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const id = req.params.id as string;
  await deleteRank(id, guildId, req.user?.discordId);
  res.json({ status: "success", message: "Rank deleted" });
});

router.put("/:id/reorder", requireAdmin, validate(z.object({ position: z.number().int().min(0) })), async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const id = req.params.id as string;
  const { position } = req.body;
  const rank = await reorderRank(id, position, guildId);
  res.json({ status: "success", data: rank });
});

export default router;
