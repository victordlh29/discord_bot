import { Router, Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../../types";
import { requireAdmin } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { resolveGuildId } from "../../core/utils/guild";
import {
  getCosmetics,
  createCosmetic,
  updateCosmetic,
  deleteCosmetic,
} from "../../modules/cosmetics/service";

const router = Router();
const cosmeticSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["TITLE", "BADGE", "BACKGROUND", "FRAME"]),
  rarity: z.enum(["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"]),
  imageUrl: z.string().optional().nullable(),
});

router.get("/", async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const cosmetics = await getCosmetics(guildId);
  res.json({ status: "success", data: cosmetics });
});

router.post("/", requireAdmin, validate(cosmeticSchema), async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const cosmetic = await createCosmetic(req.body, guildId, req.user?.discordId);
  res.status(201).json({ status: "success", data: cosmetic });
});

router.put("/:id", requireAdmin, validate(cosmeticSchema), async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const id = req.params.id as string;
  const cosmetic = await updateCosmetic(id, req.body, guildId, req.user?.discordId);
  res.json({ status: "success", data: cosmetic });
});

router.delete("/:id", requireAdmin, async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const id = req.params.id as string;
  await deleteCosmetic(id, guildId, req.user?.discordId);
  res.json({ status: "success", message: "Cosmetic deleted" });
});

export default router;
