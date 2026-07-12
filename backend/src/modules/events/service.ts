import prisma from "../../core/database/prisma";
import { EmbedBuilder, TextChannel } from "discord.js";
import { getClient } from "../../core/utils/client";
import { logger } from "../../core/utils/logger";
import { createLog } from "../logs/service";
import { checkRankUp } from "../levels/service";

// Simple in-memory cache to avoid DB queries on every message/voice event
const activeEventsCache = new Map<string, { result: {
  doubleXp: boolean;
  chatActive: boolean;
  voiceActive: boolean;
  chatBonus: number;
  voiceBonus: number;
}; expiresAt: number }>();
const CACHE_TTL_MS = 10_000; // 10 seconds

export function invalidateActiveEventsCache(guildId?: string): void {
  if (guildId) {
    activeEventsCache.delete(guildId);
  } else {
    activeEventsCache.clear();
  }
}

export async function getActiveEvents(guildId?: string): Promise<{
  doubleXp: boolean;
  chatActive: boolean;
  voiceActive: boolean;
  chatBonus: number;
  voiceBonus: number;
}> {
  const gId = guildId || process.env.DISCORD_GUILD_ID || "";
  const now = Date.now();
  const cached = activeEventsCache.get(gId);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  const active = await prisma.event.findMany({
    where: {
      guildId: gId,
      isActive: true,
      OR: [
        { endsAt: { gte: new Date(now) } },
        { endsAt: null },
      ],
    },
  });

  let doubleXp = false;
  let chatActive = false;
  let voiceActive = false;
  let chatBonus = 0;
  let voiceBonus = 0;

  for (const event of active) {
    const startsAt = event.startsAt;
    const nowDate = new Date(now);
    if (startsAt && nowDate < startsAt) continue;

    if (event.endsAt && event.endsAt < nowDate) continue;

    if (event.type === "DOUBLE_XP") {
      doubleXp = true;
      logger.debug(`Active event: "${event.name}" type=DOUBLE_XP endsAt=${event.endsAt?.toISOString()}`);
    } else if (event.type === "CHAT") {
      chatActive = true;
      chatBonus = Math.max(chatBonus, event.reward);
      logger.debug(`Active event: "${event.name}" type=CHAT bonus=${event.reward} endsAt=${event.endsAt?.toISOString()}`);
    } else if (event.type === "VOICE") {
      voiceActive = true;
      voiceBonus = Math.max(voiceBonus, event.reward);
      logger.debug(`Active event: "${event.name}" type=VOICE bonus=${event.reward} endsAt=${event.endsAt?.toISOString()}`);
    }
  }

  const result = { doubleXp, chatActive, voiceActive, chatBonus, voiceBonus };
  activeEventsCache.set(gId, { result, expiresAt: now + CACHE_TTL_MS });
  return result;
}

async function getEventWinners(eventId: string): Promise<{ discordId: string; xp: bigint }[]> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return [];

  const startDate = event.startsAt || event.createdAt;
  const endDate = event.endsAt || new Date();

  logger.debug(`getEventWinners 🔍 Evento "${event.name}" | guild=${event.guildId} | rango: ${startDate.toISOString()} → ${endDate.toISOString()}`);

  const logs = await prisma.xpLog.findMany({
    where: {
      guildId: event.guildId,
      createdAt: { gte: startDate, lte: endDate },
    },
    include: { user: true },
    take: 10000,
  });

  logger.debug(`getEventWinners 📊 xpLogs encontrados: ${logs.length}`);

  const userXpMap = new Map<string, bigint>();
  for (const log of logs) {
    const current = userXpMap.get(log.user.discordId) || BigInt(0);
    userXpMap.set(log.user.discordId, current + log.xpAmount);
  }

  return Array.from(userXpMap.entries())
    .map(([discordId, xp]) => ({ discordId, xp }))
    .sort((a, b) => (b.xp > a.xp ? 1 : b.xp < a.xp ? -1 : 0))
    .slice(0, 10);
}

export async function announceEventEnd(event: { id: string; name: string; reward: number; guildId: string }): Promise<void> {
  const winners = await getEventWinners(event.id);

  const client = getClient();
  if (!client) {
    logger.warn("announceEventEnd: no Discord client available, can't announce");
    return;
  }

  const guild = client.guilds.cache.get(event.guildId);
  if (!guild) {
    logger.warn("announceEventEnd: guild not found in cache", { guildId: event.guildId });
    return;
  }

  const settings = await prisma.setting.findUnique({ where: { key_guildId: { key: "events_announce_channel", guildId: event.guildId } } });
  let channelId = settings?.value;

  if (!channelId) {
    await guild.channels.fetch();
    const fallback = guild.channels.cache.find(
      (c) => c.name === "eventos" && (c.type === 0 || c.type === 5)
    );
    if (fallback) channelId = fallback.id;
  }

  if (!channelId) {
    logger.warn("announceEventEnd: no announce channel configured and no #eventos fallback");
    return;
  }

  const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) {
    logger.warn("announceEventEnd: channel not found in cache", { channelId });
    return;
  }

  if (event.reward > 0 && winners.length > 0 && winners[0]) {
    const winnerUser = await prisma.user.findUnique({
      where: { discordId_guildId: { discordId: winners[0].discordId, guildId: event.guildId } },
    });
    if (winnerUser) {
      await Promise.all([
        prisma.user.update({
          where: { id: winnerUser.id },
          data: { xp: { increment: BigInt(event.reward) } },
        }),
        prisma.xpLog.create({
          data: {
            userId: winnerUser.id,
            xpAmount: BigInt(event.reward),
            reason: `event_winner:${event.id}`,
            guildId: event.guildId,
          },
        }),
        createLog({
          action: "EVENT_WINNER",
          entity: "event",
          entityId: event.id,
          userId: winners[0].discordId,
          details: `${event.name} — ${event.reward} XP`,
          guildId: event.guildId,
        }),
      ]);
      logger.info(`Winner ${winners[0].discordId} earned ${event.reward} XP from event "${event.name}"`);

      try {
        const member = guild.members.cache.get(winners[0].discordId) || await guild.members.fetch(winners[0].discordId).catch(() => null);
        const updatedUser = await prisma.user.findUnique({
          where: { discordId_guildId: { discordId: winners[0].discordId, guildId: event.guildId } },
        });
        if (updatedUser) {
          await checkRankUp(updatedUser.id, updatedUser.xp, event.guildId, member);
        }
      } catch (err) {
        logger.warn("Failed to check rank up for event winner", { error: String(err) });
      }
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏆 Evento Finalizado: ${event.name}`)
    .setColor(0xffd700)
    .setTimestamp();

  if (winners.length > 0) {
    embed.setDescription("Top participantes con más XP durante el evento:");

    for (let i = 0; i < Math.min(winners.length, 10); i++) {
      let displayXp = winners[i].xp;
      const isFirst = i === 0 && event.reward > 0;
      if (isFirst) {
        displayXp = displayXp + BigInt(event.reward);
      }
      const prefix = isFirst ? "👑 " : "";
      const suffix = isFirst ? ` (${winners[i].xp.toString()} + ${event.reward} recompensa)` : "";
      embed.addFields({
        name: `${prefix}#${i + 1}`,
        value: `<@${winners[i].discordId}> — **${displayXp.toString()} XP**${suffix}`,
      });
    }
  } else {
    embed.setDescription("No hubo participantes durante este evento.");
  }

  logger.info(`Announcing event end for "${event.name}" in channel ${channel.name}`);
  await channel.send({ embeds: [embed] }).catch((err) => {
    logger.error("Failed to send event end announcement", { error: String(err) });
  });
}
