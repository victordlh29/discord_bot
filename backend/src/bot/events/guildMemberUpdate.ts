import { GuildMember, PartialGuildMember } from "discord.js";
import prisma from "../../core/database/prisma";
import { logger } from "../../core/utils/logger";

export async function onGuildMemberUpdate(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
): Promise<void> {
  try {
    if (!oldMember.partial) {
      const oldIds = Array.from(oldMember.roles.cache.keys()).sort().join(",");
      const newIds = Array.from(newMember.roles.cache.keys()).sort().join(",");
      if (oldIds === newIds) return;
    }

    const guildId = newMember.guild.id;
    const ranks = await prisma.rank.findMany({ where: { guildId }, orderBy: { requiredXp: "desc" } });

    const user = await prisma.user.findUnique({ where: { discordId_guildId: { discordId: newMember.id, guildId } } });
    if (!user) return;

    const assignedRankRole = ranks.find((r) =>
      r.discordRoleId && newMember.roles.cache.has(r.discordRoleId)
    );

    if (!assignedRankRole && user.rankId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { rankId: null },
      });
      logger.info(`Rank removed from ${newMember.user.tag} — role no longer present`);
    } else if (assignedRankRole && assignedRankRole.id !== user.rankId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { rankId: assignedRankRole.id },
      });
      logger.info(`Rank synced for ${newMember.user.tag} → ${assignedRankRole.name}`);
    }
  } catch (error) {
    logger.error("Error syncing rank on member update", { error: String(error) });
  }
}
