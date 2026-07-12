import { Router, Response } from "express";
import { getClient } from "../../core/utils/client";
import { AuthRequest } from "../../types";
import { ChannelType } from "discord.js";

const router = Router();

router.get("/", async (req: AuthRequest, res: Response) => {
  const client = getClient();
  if (!client) {
    res.status(503).json({ status: "error", message: "Discord client not ready" });
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

  await guild.channels.fetch();

  const channels = [...guild.channels.cache.values()]
    .reduce((acc, c) => {
      if (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement || c.type === ChannelType.GuildVoice) {
        acc.push({
          id: c.id,
          name: c.name,
          type: c.type === ChannelType.GuildVoice ? "voice" : "text",
          parent: c.parent?.name || null,
        });
      }
      return acc;
    }, [] as { id: string; name: string; type: string; parent: string | null }[])
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({ status: "success", data: channels, guildId: guild.id, guildName: guild.name });
});

export default router;
