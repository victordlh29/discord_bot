import { EmbedBuilder, TextChannel, ChannelType } from "discord.js";
import { getClient } from "./client";
import prisma from "../database/prisma";
import { logger } from "./logger";

async function sendToChannel(
  channelId: string,
  embed: EmbedBuilder
): Promise<boolean> {
  const client = getClient();
  if (!client) {
    logger.error("sendToChannel: Discord client not available (bot not connected?)");
    return false;
  }
  try {
    logger.info("sendToChannel: fetching channel", { channelId });
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      logger.error("sendToChannel: channel not found", { channelId });
      return false;
    }
    if (!channel.isTextBased()) {
      logger.error("sendToChannel: channel is not text-based", { channelId, type: channel.type });
      return false;
    }
    const textChannel = channel as TextChannel;
    await textChannel.send({ embeds: [embed] });
    logger.info("sendToChannel: announcement sent successfully", { channelId });
    return true;
  } catch (error) {
    logger.error("sendToChannel: failed to send Discord announcement", { error: String(error), channelId });
  }
  return false;
}

export async function announceEvent(action: string, event: { name: string; type: string; duration: number; reward: number; guildId?: string }, guildId?: string): Promise<void> {
  const client = getClient();
  if (!client) return;

  const gId = guildId || event.guildId || process.env.DISCORD_GUILD_ID;
  if (!gId) return;

  const settings = await prisma.setting.findUnique({
    where: { key_guildId: { key: "events_announce_channel", guildId: gId } },
  });
  let channelId = settings?.value;

  if (!channelId) {
    if (!gId) return;
    const guild = client.guilds.cache.get(gId);
    if (!guild) return;
    await guild.channels.fetch();
    const channel = guild.channels.cache.find(
      (c) => c.name === "eventos" && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
    );
    if (channel) channelId = channel.id;
  }

  if (!channelId) {
    logger.error("No event announce channel configured and no #eventos channel found");
    return;
  }

  const color = action === "activate" ? 0x00ff00 : 0x00aaff;
  const title = action === "activate" ? "🎉 Evento Activado" : "📢 Nuevo Evento Creado";

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .addFields(
      { name: "Nombre", value: event.name, inline: true },
      { name: "Tipo", value: event.type, inline: true },
      { name: "Duración", value: `${event.duration} min`, inline: true },
      { name: "Recompensa", value: `${event.reward} XP`, inline: true }
    )
    .setTimestamp();

  const sent = await sendToChannel(channelId, embed);
  if (!sent) {
    logger.error(`Failed to send event announcement to channel ${channelId}. Verify the bot has permission to send messages there.`);
  }
}

export async function announceMission(action: string, mission: { name: string; type: string; objective: string; reward: number; frequency: string; guildId?: string }, guildId?: string): Promise<void> {
  const gId = guildId || mission.guildId || process.env.DISCORD_GUILD_ID;
  if (!gId) {
    logger.warn("announceMission: no guild ID available — skipping announcement", { action, missionName: mission.name });
    return;
  }
  logger.info("announceMission: sending announcement", { action, missionName: mission.name, guildId: gId });

  const settings = await prisma.setting.findUnique({
    where: { key_guildId: { key: "missions_announce_channel", guildId: gId } },
  });
  const channelId = settings?.value;
  if (!channelId) {
    logger.warn("announceMission: no missions_announce_channel configured for guild", { guildId: gId, action });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(action === "create" ? "📋 Nueva Misión" : "✏️ Misión Actualizada")
    .setColor(0x9b59b6)
    .addFields(
      { name: "Nombre", value: mission.name, inline: true },
      { name: "Tipo", value: mission.type, inline: true },
      { name: "Objetivo", value: mission.objective },
      { name: "Frecuencia", value: mission.frequency, inline: true },
      { name: "Recompensa", value: `${mission.reward} XP`, inline: true }
    )
    .setTimestamp();

  const sent = await sendToChannel(channelId, embed);
  if (!sent) {
    logger.error(`announceMission: failed to send announcement to channel ${channelId}`, { action, missionName: mission.name });
  }
}
