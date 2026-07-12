import { EmbedBuilder, GuildMember, TextChannel } from "discord.js";
import prisma from "../../core/database/prisma";
import { createLog } from "../logs/service";
import { logger } from "../../core/utils/logger";
import { getClient } from "../../core/utils/client";
import { getSetting } from "../settings/service";

export async function checkRankUp(
  userId: string,
  newXp: bigint,
  guildId: string,
  member?: GuildMember | null,
  channel?: { send: (content: string | { embeds: EmbedBuilder[] }) => Promise<unknown> } | null
): Promise<void> {
  const ranks = await prisma.rank.findMany({
    where: { guildId },
    orderBy: { requiredXp: "asc" },
  });

  let newRank: typeof ranks[0] | null = null;
  for (const rank of ranks) {
    if (newXp >= rank.requiredXp) {
      newRank = rank;
    } else {
      break;
    }
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { rank: true } });
  if (!user) return;

  if (!newRank) {
    if (user.rankId) {
      await prisma.user.update({ where: { id: userId }, data: { rankId: null } });
    }
    return;
  }

  if (!user.rankId || user.rankId !== newRank.id) {
    await prisma.user.update({
      where: { id: userId },
      data: { rankId: newRank.id },
    });

    await createLog({
      action: "RANK_UP",
      entity: "user",
      entityId: userId,
      userId: user.discordId,
      details: `${user.rank?.name || "Sin rango"} → ${newRank.name}`,
      guildId,
    });

    // Assign Discord role if possible
    if (member && newRank.discordRoleId && member.guild) {
      const role = member.guild.roles.cache.get(newRank.discordRoleId);
      if (role) {
        for (const oldRank of ranks) {
          if (oldRank.id !== newRank.id && oldRank.discordRoleId) {
            const oldRole = member.guild.roles.cache.get(oldRank.discordRoleId);
            if (oldRole && member.roles.cache.has(oldRole.id)) {
              await member.roles.remove(oldRole).catch((err) => {
                logger.warn(`Failed to remove role ${oldRank.name} from ${member.user.tag}`, { error: String(err) });
              });
            }
          }
        }
        await member.roles.add(role).catch((err) => {
          logger.warn(`Failed to add role ${newRank.name} to ${member.user.tag}`, { error: String(err) });
        });
      }
    }

    // Send DM notification
    try {
      const target = member?.user || (await getClient()?.users.fetch(user.discordId).catch(() => null));
      if (target) {
        await target.send(`🎉 ¡Felicidades! Has subido al rango **${newRank.name}**!`);
      }
    } catch {
      // DMs may be disabled
      logger.warn(`Failed to send rank-up DM to ${user.discordId}`);
    }

    // Send public message to channel (or configured ranks announce channel as fallback)
    let imageUrl: string | null = null;
    if (newRank.gifUrl) {
      try {
        const urls: string[] = JSON.parse(newRank.gifUrl);
        if (Array.isArray(urls) && urls.length > 0) {
          imageUrl = urls[Math.floor(Math.random() * urls.length)];
        }
      } catch {
        imageUrl = newRank.gifUrl;
      }
      // Normalizar URLs para que Discord las incruste
      if (imageUrl) {
        const tenorMatch = imageUrl.match(/tenor\.com\/m\/(\w+)/);
        if (tenorMatch) {
          imageUrl = `https://media.tenor.com/${tenorMatch[1]}/tenor.gif`;
        }
        const giphyMatch = imageUrl.match(/media\d?\.giphy\.com\/media\/.*\/(\w+)\/giphy\.gif/);
        if (giphyMatch) {
          imageUrl = `https://i.giphy.com/${giphyMatch[1]}.gif`;
        }
      }
    }
    const embed = new EmbedBuilder()
      .setDescription(`🎉 ¡Felicidades <@${user.discordId}>! Has subido al rango **${newRank.name}**!`)
      .setColor(newRank.color ? parseInt(newRank.color.replace("#", ""), 16) : 0xffd700);
    if (imageUrl) {
      embed.setImage(imageUrl);
    }
    let sendChannel = channel;
    if (!sendChannel) {
      const ranksChannelId = await getSetting("ranks_announce_channel", guildId);
      if (ranksChannelId) {
        const client = getClient();
        if (client) {
          const fetched = await client.channels.fetch(ranksChannelId).catch(() => null);
          if (fetched && 'send' in fetched) {
            sendChannel = fetched as TextChannel;
          }
        }
      }
    }
    if (sendChannel) {
      try {
        await sendChannel.send({ embeds: [embed] });
      } catch {
        logger.warn(`Failed to send rank-up message to channel for ${user.discordId}`);
      }
    }
  }
}
