import { Message, SendableChannels } from "discord.js";
import prisma from "../../core/database/prisma";
import { getSetting, getSettingInt, getSettingFloat } from "../settings/service";
import { isSpam, calculateLevel, hasBlockedWords, isRepeatedMessage } from "../../core/utils/helpers";
import { createLog } from "../logs/service";
import { checkRankUp } from "../levels/service";
import { trackMissionProgress } from "../missions/service";
import { getActiveEvents } from "../events/service";
import { isBotInVoiceWithUser } from "../../core/utils/client";
import { logger } from "../../core/utils/logger";

export async function handleMessageXp(message: Message): Promise<void> {
  const guildId = message.guildId!;
  const userId = message.author.id;
  const content = message.content;

  const allowedChannels = await getSetting("xp_text_channels", guildId);
  if (allowedChannels) {
    const channels = allowedChannels.split(",").map((c: string) => c.trim());
    if (!channels.includes(message.channel.id)) {
      logger.debug(`handleMessageXp 🚫 Canal no whitelisted: ${message.channel.id} (whitelist: ${allowedChannels})`);
      return;
    }
  }

  if (isSpam(content)) {
    logger.debug(`handleMessageXp 🚫 Spam detectado: ${userId} content="${content.slice(0, 50)}"`);
    return;
  }

  // Check blocked words
  const blockedWordsRaw = await getSetting("blocked_words", guildId);
  if (blockedWordsRaw) {
    const blockedWords = blockedWordsRaw.split(",").map((w: string) => w.trim()).filter(Boolean);
    if (hasBlockedWords(content, blockedWords)) {
      logger.debug(`handleMessageXp 🚫 Palabra bloqueada: ${userId}`);
      return;
    }
  }

  const minLength = await getSettingInt("antispam_min_length", 5, guildId);
  if (content.length < minLength) {
    logger.debug(`handleMessageXp 🚫 Mensaje muy corto (${content.length} < ${minLength}): ${userId}`);
    return;
  }

  // 🎤 XP condicional por canal de voz:
  // Si el bot está en un canal de voz con este usuario, solo da XP por voz
  // (no por mensajes de texto), para evitar farming dual.
  if (isBotInVoiceWithUser(userId, guildId)) {
    logger.debug(`handleMessageXp 🚫 Bot en voz con usuario, saltando XP texto: ${userId}`);
    return;
  }

  const [cooldownSeconds, globalMultiplier, user] = await Promise.all([
    getSettingInt("message_cooldown_seconds", 60, guildId),
    getSettingFloat("global_multiplier", 1.0, guildId),
    prisma.user.upsert({
      where: { discordId_guildId: { discordId: userId, guildId } },
      update: { username: message.author.username, discriminator: message.author.discriminator, avatar: message.author.displayAvatarURL() },
      create: { discordId: userId, guildId, username: message.author.username, discriminator: message.author.discriminator, avatar: message.author.displayAvatarURL() },
    }),
  ]);

  const lastMsgDate = user.lastMessageAt?.toDateString();
  const today = new Date().toDateString();
  const isNewDay = lastMsgDate !== today;

  if (user.lastMessageAt) {
    const elapsed = (Date.now() - user.lastMessageAt.getTime()) / 1000;
    if (elapsed < cooldownSeconds) {
      logger.debug(`handleMessageXp 🚫 Cooldown activo (${Math.round(elapsed)}s < ${cooldownSeconds}s): ${userId}`);
      return;
    }
  }

  // 🚫 Mensaje repetido (copiar/pegar): saltea XP pero no misión/eventos
  if (isRepeatedMessage(content, user.lastMessageContent)) {
    logger.debug(`handleMessageXp 🚫 Mensaje repetido (copiar/pegar): ${userId}`);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastMessageAt: new Date(),
        lastMessageContent: content.slice(0, 200),
      },
    });
    await trackMissionProgress(userId, "send_messages", 1, guildId);
    if (isNewDay) {
      await trackMissionProgress(userId, "daily_login", 1, guildId);
    }
    return;
  }

  // Dynamic XP bracket boundaries (configurable from dashboard)
  const [
    bracket1Min, bracket1Max,
    bracket2Min, bracket2Max,
    bracket3Min, bracket3Max,
    bracket4Min, bracket4Max,
    bracket5Min,
  ] = await Promise.all([
    getSettingInt("xp_bracket_1_min", 5, guildId),
    getSettingInt("xp_bracket_1_max", 20, guildId),
    getSettingInt("xp_bracket_2_min", 21, guildId),
    getSettingInt("xp_bracket_2_max", 50, guildId),
    getSettingInt("xp_bracket_3_min", 51, guildId),
    getSettingInt("xp_bracket_3_max", 100, guildId),
    getSettingInt("xp_bracket_4_min", 101, guildId),
    getSettingInt("xp_bracket_4_max", 200, guildId),
    getSettingInt("xp_bracket_5_min", 201, guildId),
  ]);

  let xpAmount = 0;
  const len = content.length;
  if (len >= bracket1Min && len <= bracket1Max) xpAmount = await getSettingInt("xp_rule_5_20", 5, guildId);
  else if (len >= bracket2Min && len <= bracket2Max) xpAmount = await getSettingInt("xp_rule_21_50", 10, guildId);
  else if (len >= bracket3Min && len <= bracket3Max) xpAmount = await getSettingInt("xp_rule_51_100", 15, guildId);
  else if (len >= bracket4Min && len <= bracket4Max) xpAmount = await getSettingInt("xp_rule_101_200", 20, guildId);
  else if (len >= bracket5Min) xpAmount = await getSettingInt("xp_rule_200_plus", 25, guildId);

  xpAmount = Math.round(xpAmount * globalMultiplier);

  const [minXp, maxXp] = await Promise.all([
    getSettingInt("xp_min_per_message", 5, guildId),
    getSettingInt("xp_max_per_message", 25, guildId),
  ]);
  if (xpAmount < minXp) xpAmount = minXp;
  if (xpAmount > maxXp) xpAmount = maxXp;

  if (xpAmount <= 0) return;

  const activeEvents = await getActiveEvents(guildId);
  if (activeEvents.doubleXp) {
    xpAmount *= 2;
  }
  if (activeEvents.chatActive && activeEvents.chatBonus > 0) {
    xpAmount += activeEvents.chatBonus;
  }

  const newXp = user.xp + BigInt(xpAmount);
  const newLevel = calculateLevel(newXp);

  await Promise.all([
    prisma.user.update({
      where: { id: user.id },
      data: {
        xp: newXp,
        level: newLevel,
        lastMessageAt: new Date(),
        lastXpClaim: new Date(),
        lastMessageContent: content.slice(0, 200),
      },
    }),
    prisma.messageLog.create({
      data: {
        userId: user.id,
        content: content.slice(0, 200),
        channelId: message.channel.id,
        guildId,
        xpEarned: BigInt(xpAmount),
      },
    }),
    prisma.xpLog.create({
      data: {
        userId: user.id,
        xpAmount: BigInt(xpAmount),
        reason: "message",
        guildId,
      },
    }),
  ]);

  logger.debug(`handleMessageXp ✅ ${xpAmount} XP otorgados a ${userId} (canal: ${message.channel.id})`);

  await trackMissionProgress(userId, "send_messages", 1, guildId);

  if (isNewDay) {
    await trackMissionProgress(userId, "daily_login", 1, guildId);
  }

  if (newLevel > user.level) {
    logger.info(`User ${message.author.tag} leveled up to ${newLevel}`);
    await createLog({
      action: "LEVEL_UP",
      entity: "user",
      entityId: user.id,
      userId: userId,
      details: `Level ${user.level} → ${newLevel}`,
      guildId,
    });
    try {
      const channel = message.channel as SendableChannels;
      if (channel) {
        await channel.send(
          `🎉 ¡Felicidades ${message.author}! ¡Has subido al nivel **${newLevel}**!`
        );
      }
    } catch {
      // Channel might not be accessible
      logger.warn(`Error sending level-up message for ${message.author.tag}`);
    }
    await trackMissionProgress(userId, "level_up", 1, guildId);
  }

  await checkRankUp(user.id, newXp, guildId, message.member, message.channel as SendableChannels);
  await trackMissionProgress(userId, "xp_earned", xpAmount, guildId);
}
