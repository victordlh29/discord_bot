import { Router, Response } from "express";
import { getClient } from "../../core/utils/client";
import { AuthRequest } from "../../types";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const client = getClient();
  if (!client) {
    res.status(503).json({ status: "error", message: "Discord client not ready" });
    return;
  }

  const allGuilds = client.guilds.cache.map((g) => ({ id: g.id, name: g.name }));

  let guilds = allGuilds;
  if (!req.user?.isSuperAdmin && req.user?.adminGuildId) {
    guilds = allGuilds.filter((g) => g.id === req.user!.adminGuildId);
  }

  res.json({ status: "success", data: guilds });
});

export default router;
