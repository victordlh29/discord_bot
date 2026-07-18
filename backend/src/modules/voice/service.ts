import { VoiceState, GuildMember } from "discord.js";
import prisma from "../../core/database/prisma";
import { getSetting, getSettingInt, getSettingFloat } from "../settings/service";
import { calculateLevel } from "../../core/utils/helpers";
import { createLog } from "../logs/service";
import { checkRankUp } from "../levels/service";
import { trackMissionProgress } from "../missions/service";
import { getActiveEvents } from "../events/service";
import { getClient } from "../../core/utils/client";
import { logger } from "../../core/utils/logger";

let isProcessingVoiceSessions = false;

/** Crea una sesión de voz para un miembro si cumple las condiciones (whitelist, bot en mismo canal) */
async function createVoiceSessionForMember(member: GuildMember, guildId: string, channelId: string): Promise<void> {
  if (member.user.bot) return;

  // Verificar whitelist de canales de voz
  const allowedChannels = await getSetting("xp_voice_channels", guildId);
  if (allowedChannels) {
    const channels = allowedChannels.split(",").map((c) => c.trim());
    if (!channels.includes(channelId)) return;
  }

  const userId = member.id;
  let user = await prisma.user.findUnique({ where: { discordId_guildId: { discordId: userId, guildId } } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        discordId: userId,
        guildId,
        username: member.user.username,
        discriminator: member.user.discriminator,
        avatar: member.user.displayAvatarURL(),
      },
    });
  }

  await prisma.voiceSession.create({
    data: {
      userId: user.id,
      guildId,
      joinTime: new Date(),
    },
  });
}

/** Procesa el cierre de sesión de voz y otorga XP a un miembro */
async function processVoiceXpForMember(member: GuildMember, guildId: string): Promise<void> {
  const userId = member.id;
  const user = await prisma.user.findUnique({ where: { discordId_guildId: { discordId: userId, guildId } } });
  if (!user) return;

  const activeSession = await prisma.voiceSession.findFirst({
    where: { userId: user.id, leaveTime: null, guildId },
    orderBy: { joinTime: "desc" },
  });

  if (!activeSession) return;

  const now = new Date();
  const durationSeconds = Math.floor((now.getTime() - activeSession.joinTime.getTime()) / 1000);
  const durationMinutes = Math.floor(durationSeconds / 60);

  if (durationMinutes < 1) {
    await prisma.voiceSession.delete({ where: { id: activeSession.id } });
    return;
  }

  await prisma.voiceSession.update({
    where: { id: activeSession.id },
    data: { leaveTime: now, duration: durationMinutes },
  });

  // Voice cooldown check
  const voiceCooldown = await getSettingInt("voice_cooldown_seconds", 300, guildId);
  const cooldownActive = voiceCooldown > 0 && user.lastVoiceAt !== null &&
    (Date.now() - user.lastVoiceAt.getTime()) / 1000 < voiceCooldown;

  if (cooldownActive) {
    await prisma.user.update({
      where: { id: user.id },
      data: { voiceTime: { increment: durationMinutes } },
    });
    logger.debug(`Voice XP skipped for ${userId} (bot left) — cooldown active`);
    return;
  }

  const [xpPerMinute, globalMultiplier] = await Promise.all([
    getSettingInt("xp_per_voice_minute", 2, guildId),
    getSettingFloat("global_multiplier", 1.0, guildId),
  ]);
  let xpEarned = Math.round(durationMinutes * xpPerMinute * globalMultiplier);

  if (xpEarned <= 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { voiceTime: { increment: durationMinutes } },
    });
    return;
  }

  const activeEvents = await getActiveEvents(guildId);
  if (activeEvents.doubleXp) xpEarned *= 2;
  if (activeEvents.voiceActive && activeEvents.voiceBonus > 0) xpEarned += activeEvents.voiceBonus;

  const newXp = user.xp + BigInt(xpEarned);
  const newLevel = calculateLevel(newXp);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      xp: newXp,
      level: newLevel,
      voiceTime: { increment: durationMinutes },
      lastVoiceAt: new Date(),
    },
  });

  await prisma.xpLog.create({
    data: {
      userId: user.id,
      xpAmount: BigInt(xpEarned),
      reason: "voice",
      guildId,
    },
  });

  if (newLevel > user.level) {
    await createLog({
      action: "LEVEL_UP",
      entity: "user",
      entityId: user.id,
      userId,
      details: `Level ${user.level} → ${newLevel}`,
      guildId,
    });
    await trackMissionProgress(userId, "level_up", 1, guildId);
  }

  await checkRankUp(user.id, newXp, guildId, member);
  await trackMissionProgress(userId, "voice_minutes", durationMinutes, guildId);
  await trackMissionProgress(userId, "xp_earned", xpEarned, guildId);
}

/**
 * Cuando el bot SALE de un canal de voz, cierra las sesiones activas
 * de los miembros que aún están en ese canal y les otorga XP
 * por el tiempo que estuvieron con el bot.
 */
export async function closeSessionsOnBotLeave(guildId: string, channelId: string): Promise<void> {
  const client = getClient();
  if (!client) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  // Miembros que siguen en el canal (después de que el bot se fue)
  const members = guild.members.cache.filter(
    (m) => !m.user.bot && m.voice.channelId === channelId
  );

  if (members.size === 0) return;

  logger.info(`🎤 Bot left channel ${channelId}, closing ${members.size} voice session(s)`);
  await Promise.allSettled(
    members.map((member) => processVoiceXpForMember(member, guildId))
  );
}

/**
 * Cuando el bot se une a un canal de voz, crea sesiones de voz
 * para todos los miembros NO bots que ya están en ese canal.
 */
export async function createSessionsForExistingMembers(guildId: string, channelId: string): Promise<void> {
  const allowedChannels = await getSetting("xp_voice_channels", guildId);
  if (allowedChannels) {
    const channels = allowedChannels.split(",").map((c) => c.trim());
    if (!channels.includes(channelId)) return;
  }

  const client = getClient();
  if (!client) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isVoiceBased()) return;

  // Crear sesiones para todos los miembros NO bot en el canal
  const members = channel.members.filter((m) => !m.user.bot);
  await Promise.allSettled(
    members.map((member) => createVoiceSessionForMember(member, guildId, channelId))
  );
}

export async function handleVoiceJoin(state: VoiceState): Promise<void> {
  if (!state.member || state.member.user.bot) return;
  if (!state.channelId) return;
  if (!state.guild) return;

  const guildId = state.guild.id;
  const userId = state.member.id;

  // 🎤 XP condicional: solo dar XP por voz si el bot está en el MISMO canal
  // (los usuarios deben estar escuchando música con el bot)
  const botMember = state.guild.members.me;
  if (!botMember?.voice.channelId || botMember.voice.channelId !== state.channelId) {
    return;
  }

  // Verificar whitelist de canales de voz
  const allowedChannels = await getSetting("xp_voice_channels", guildId);
  if (allowedChannels) {
    const channels = allowedChannels.split(",").map((c) => c.trim());
    if (!channels.includes(state.channelId)) return;
  }

  let user = await prisma.user.findUnique({ where: { discordId_guildId: { discordId: userId, guildId } } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        discordId: userId,
        guildId,
        username: state.member.user.username,
        discriminator: state.member.user.discriminator,
        avatar: state.member.user.displayAvatarURL(),
      },
    });
  }

  await prisma.voiceSession.create({
    data: {
      userId: user.id,
      guildId,
      joinTime: new Date(),
    },
  });
}

export async function handleVoiceLeave(state: VoiceState): Promise<void> {
  if (!state.member || state.member.user.bot) return;

  const userId = state.member.id;
  const guildId = state.guild.id;
  const user = await prisma.user.findUnique({ where: { discordId_guildId: { discordId: userId, guildId } } });
  if (!user) return;

  const activeSession = await prisma.voiceSession.findFirst({
    where: { userId: user.id, leaveTime: null, guildId },
    orderBy: { joinTime: "desc" },
  });

  if (!activeSession) return;

  const now = new Date();
  const durationSeconds = Math.floor((now.getTime() - activeSession.joinTime.getTime()) / 1000);
  const durationMinutes = Math.floor(durationSeconds / 60);

  if (durationMinutes < 1) {
    await prisma.voiceSession.delete({ where: { id: activeSession.id } });
    return;
  }

  await prisma.voiceSession.update({
    where: { id: activeSession.id },
    data: { leaveTime: now, duration: durationMinutes },
  });

  // Voice cooldown: skip XP if user left voice recently
  // NOTE: voiceTime y lastVoiceAt se actualizan ANTES del cooldown
  // para mantener el tracking de tiempo preciso incluso cuando no se otorga XP
  const voiceCooldown = await getSettingInt("voice_cooldown_seconds", 300, guildId);
  const cooldownActive = voiceCooldown > 0 && user.lastVoiceAt !== null &&
    (Date.now() - user.lastVoiceAt.getTime()) / 1000 < voiceCooldown;

  if (cooldownActive) {
    // Solo actualizar voiceTime — no otorgar XP
    // lastVoiceAt NO se actualiza para preservar la referencia del cooldown
    await prisma.user.update({
      where: { id: user.id },
      data: {
        voiceTime: { increment: durationMinutes },
      },
    });
    logger.debug(`Voice XP skipped for ${userId} — cooldown active`);
    return;
  }

  const [xpPerMinute, globalMultiplier] = await Promise.all([
    getSettingInt("xp_per_voice_minute", 2, guildId),
    getSettingFloat("global_multiplier", 1.0, guildId),
  ]);
  let xpEarned = Math.round(durationMinutes * xpPerMinute * globalMultiplier);

  if (xpEarned <= 0) {
    // Aún así registrar tiempo aunque no haya XP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        voiceTime: { increment: durationMinutes },
      },
    });
    return;
  }

  const activeEvents = await getActiveEvents(guildId);
  if (activeEvents.doubleXp) {
    xpEarned *= 2;
  }
  if (activeEvents.voiceActive && activeEvents.voiceBonus > 0) {
    xpEarned += activeEvents.voiceBonus;
  }

  const newXp = user.xp + BigInt(xpEarned);
  const newLevel = calculateLevel(newXp);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      xp: newXp,
      level: newLevel,
      voiceTime: { increment: durationMinutes },
      lastVoiceAt: new Date(),
    },
  });

  await prisma.xpLog.create({
    data: {
      userId: user.id,
      xpAmount: BigInt(xpEarned),
      reason: "voice",
      guildId,
    },
  });

  if (newLevel > user.level) {
    await createLog({
      action: "LEVEL_UP",
      entity: "user",
      entityId: user.id,
      userId: userId,
      details: `Level ${user.level} → ${newLevel}`,
      guildId,
    });
    await trackMissionProgress(userId, "level_up", 1, guildId);
  }

  if (state.member) {
    await checkRankUp(user.id, newXp, guildId, state.member);
  }

  await trackMissionProgress(userId, "voice_minutes", durationMinutes, guildId);
  await trackMissionProgress(userId, "xp_earned", xpEarned, guildId);
}

export async function processActiveVoiceSessions(): Promise<void> {
  if (isProcessingVoiceSessions) {
    logger.debug("Voice session processor already running, skipping");
    return;
  }
  isProcessingVoiceSessions = true;
  try {
    const sessions = await prisma.voiceSession.findMany({
      where: { leaveTime: null },
      include: { user: true },
    });

    if (sessions.length === 0) return;

    const client = getClient();
    if (!client) return;

    const now = new Date();
    const updates: Array<{ id: string; leaveTime: Date; duration: number }> = [];

    for (const session of sessions) {
      try {
        const guild = client.guilds.cache.get(session.guildId);
        const member = guild ? await guild.members.fetch(session.user.discordId).catch(() => null) : null;
        if (!member || !member.voice?.channelId) {
          const durationSec = Math.floor((now.getTime() - session.joinTime.getTime()) / 1000);
          updates.push({
            id: session.id,
            leaveTime: now,
            duration: Math.floor(durationSec / 60),
          });
        }
      } catch (error) {
        logger.warn(`Failed to auto-close voice session ${session.id}`, { error: String(error) });
        updates.push({ id: session.id, leaveTime: new Date(), duration: 0 });
      }
    }

    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.voiceSession.update({
            where: { id: u.id },
            data: { leaveTime: u.leaveTime, duration: u.duration },
          })
        )
      );
      logger.info(`Cleaned up ${updates.length} orphaned voice sessions`);
    }
  } finally {
    isProcessingVoiceSessions = false;
  }
}
