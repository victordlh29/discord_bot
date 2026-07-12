import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from "discord.js";
import prisma from "../../core/database/prisma";
import { updateSetting } from "../../modules/settings/service";
import { createLog } from "../../modules/logs/service";
import { calculateLevel } from "../../core/utils/helpers";

export const setxpCommand = {
  data: new SlashCommandBuilder()
    .setName("setxp")
    .setDescription("Establecer XP de un usuario")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((opt) => opt.setName("user").setDescription("Usuario").setRequired(true))
    .addIntegerOption((opt) => opt.setName("amount").setDescription("Cantidad de XP").setRequired(true).setMinValue(0)),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const target = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    const safeAmount = BigInt(Math.max(0, Math.min(amount, Number(10n ** 15n))));
    const user = await prisma.user.upsert({
      where: { discordId_guildId: { discordId: target.id, guildId } },
      update: { xp: safeAmount, level: calculateLevel(safeAmount), username: target.username },
      create: { discordId: target.id, guildId, username: target.username, xp: safeAmount, level: calculateLevel(safeAmount) },
    });

    await Promise.all([
      createLog({ action: "XP_SET", entity: "user", entityId: user.id, userId: interaction.user.id, details: `${target.tag} → ${amount} XP` }),
      interaction.reply({ content: `✅ XP de **${target.tag}** establecido a **${amount}** (nivel ${user.level}).`, ephemeral: true }),
    ]);
  },
};

export const setvoicexpCommand = {
  data: new SlashCommandBuilder()
    .setName("setvoicexp")
    .setDescription("Establecer tiempo de voz de un usuario (minutos)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((opt) => opt.setName("user").setDescription("Usuario").setRequired(true))
    .addIntegerOption((opt) => opt.setName("minutes").setDescription("Minutos en voz").setRequired(true).setMinValue(0)),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const target = interaction.options.getUser("user", true);
    const minutes = interaction.options.getInteger("minutes", true);

    const user = await prisma.user.upsert({
      where: { discordId_guildId: { discordId: target.id, guildId } },
      update: { voiceTime: minutes, username: target.username },
      create: { discordId: target.id, guildId, username: target.username, voiceTime: minutes },
    });

    await Promise.all([
      createLog({ action: "VOICEXP_SET", entity: "user", entityId: user.id, userId: interaction.user.id, details: `${target.tag} → ${minutes} min` }),
      interaction.reply({ content: `✅ Tiempo de voz de **${target.tag}** establecido a **${minutes}** minutos.`, ephemeral: true }),
    ]);
  },
};

export const setcooldownCommand = {
  data: new SlashCommandBuilder()
    .setName("setcooldown")
    .setDescription("Establecer cooldown global de mensajes (segundos)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption((opt) => opt.setName("seconds").setDescription("Segundos de cooldown").setRequired(true).setMinValue(0)),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const seconds = interaction.options.getInteger("seconds", true);

    await updateSetting("message_cooldown_seconds", String(seconds), guildId);
    await Promise.all([
      createLog({ action: "COOLDOWN_SET", entity: "settings", userId: interaction.user.id, details: `${seconds}s` }),
      interaction.reply({ content: `✅ Cooldown global establecido a **${seconds}** segundos.`, ephemeral: true }),
    ]);
  },
};
