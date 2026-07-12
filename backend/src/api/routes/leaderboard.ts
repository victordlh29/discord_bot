import { Router, Response } from "express";
import { AuthRequest } from "../../types";
import { resolveGuildId } from "../../core/utils/guild";
import { isValidSnowflake } from "../../core/utils/helpers";
import {
  getXpLeaderboard,
  getVoiceLeaderboard,
  getLevelLeaderboard,
  getUserPosition,
} from "../../modules/leaderboard/service";

const router = Router();

router.get("/xp", async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 10));
  const users = await getXpLeaderboard(guildId, limit);
  res.json({ status: "success", data: users });
});

router.get("/voice", async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 10));
  const users = await getVoiceLeaderboard(guildId, limit);
  res.json({ status: "success", data: users });
});

router.get("/level", async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 10));
  const users = await getLevelLeaderboard(guildId, limit);
  res.json({ status: "success", data: users });
});

router.get("/position/:discordId", async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const discordId = req.params.discordId as string;

  if (!isValidSnowflake(discordId)) {
    res.status(400).json({ status: "error", message: "discordId inválido" });
    return;
  }

  const position = await getUserPosition(discordId, guildId);

  if (position === null) {
    res.status(404).json({ status: "error", message: "User not found" });
    return;
  }

  res.json({ status: "success", data: { position } });
});

export default router;
