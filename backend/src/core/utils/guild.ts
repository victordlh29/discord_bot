import { AuthRequest } from "../../types";
import { getClient } from "./client";

export function resolveGuildId(req: AuthRequest): string {
  if (req.user?.isSuperAdmin) {
    return (req.query.guildId as string) || getClient()?.guilds.cache.first()?.id || process.env.DISCORD_GUILD_ID || "default";
  }
  return req.user?.adminGuildId || process.env.DISCORD_GUILD_ID || "default";
}
