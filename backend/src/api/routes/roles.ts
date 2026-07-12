import { Router, Response } from "express";
import { getClient } from "../../core/utils/client";
import { AuthRequest } from "../../types";

const router = Router();

router.get("/", async (req: AuthRequest, res: Response) => {
  const client = getClient();
  if (!client) {
    res.json({ status: "success", data: [], guildId: "", guildName: "" });
    return;
  }

  const guildId = req.query.guildId as string | undefined;
  const guild = guildId
    ? client.guilds.cache.get(guildId)
    : client.guilds.cache.first();

  if (!guild) {
    res.status(404).json({ status: "error", message: "Guild not found" });
    return;
  }

  const roles = [...guild.roles.cache.values()]
    .reduce((acc, r) => {
      if (r.name !== "@everyone") {
        acc.push({
          id: r.id,
          name: r.name,
          color: r.hexColor,
          position: r.position,
        });
      }
      return acc;
    }, [] as { id: string; name: string; color: string; position: number }[])
    .sort((a, b) => b.position - a.position);

  res.json({ status: "success", data: roles, guildId: guild.id, guildName: guild.name });
});

export default router;
