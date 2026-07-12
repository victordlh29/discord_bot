import { GuildMember } from "discord.js";
import prisma from "../../core/database/prisma";
import { trackMissionProgress } from "../../modules/missions/service";
import { logger } from "../../core/utils/logger";

export async function onGuildMemberAdd(member: GuildMember): Promise<void> {
  if (member.user.bot) return;

  try {
    const activeRoleGiftMissions = await prisma.mission.findFirst({
      where: { type: "role_gift", guildId: member.guild.id },
    });

    if (!activeRoleGiftMissions) return;

    await prisma.user.upsert({
      where: { discordId_guildId: { discordId: member.id, guildId: member.guild.id } },
      update: { username: member.user.username, discriminator: member.user.discriminator, avatar: member.user.displayAvatarURL() },
      create: { discordId: member.id, guildId: member.guild.id, username: member.user.username, discriminator: member.user.discriminator, avatar: member.user.displayAvatarURL() },
    });

    await trackMissionProgress(member.id, "role_gift", 1, member.guild.id);

    logger.info(`🎁 Auto role_gift applied to new member ${member.user.tag} in ${member.guild.name}`);
  } catch (error) {
    logger.error(`Error in guildMemberAdd role_gift for ${member.user.tag}`, { error: String(error) });
  }
}
