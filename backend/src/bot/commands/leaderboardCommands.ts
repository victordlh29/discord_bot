import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from "discord.js";
import prisma from "../../core/database/prisma";

export const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Ver el top del servidor")
    .addStringOption((opt) =>
      opt.setName("type")
        .setDescription("Tipo de leaderboard")
        .setRequired(false)
        .addChoices(
          { name: "XP", value: "xp" },
          { name: "Voz", value: "voice" },
          { name: "Nivel", value: "level" }
        )
    ),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const type = interaction.options.getString("type") || "xp";
    const limit = 10;

    let users;
    let title: string;

    if (type === "voice") {
      users = await prisma.user.findMany({ where: { guildId }, orderBy: { voiceTime: "desc" }, take: limit, include: { rank: true } });
      title = "🎙️ Top Voz";
    } else if (type === "level") {
      users = await prisma.user.findMany({ where: { guildId }, orderBy: [{ level: "desc" }, { xp: "desc" }], take: limit, include: { rank: true } });
      title = "📈 Top Nivel";
    } else {
      users = await prisma.user.findMany({ where: { guildId }, orderBy: { xp: "desc" }, take: limit, include: { rank: true } });
      title = "⭐ Top XP";
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(0x00aaff)
      .setTimestamp();

    let description = "";
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const rankName = u.rank?.name || "Sin rango";
      const value = type === "voice"
        ? `${Math.floor(u.voiceTime / 60)}h ${u.voiceTime % 60}m`
        : type === "level"
          ? `Nivel ${u.level}`
          : `${u.xp.toString()} XP`;
      description += `**${i + 1}.** <@${u.discordId}> — ${rankName}\n${value}\n\n`;
    }
    embed.setDescription(description || "No hay datos aún.");

    await interaction.reply({ embeds: [embed] });
  },
};

export const topCommand = {
  data: new SlashCommandBuilder()
    .setName("top")
    .setDescription("Ver el top 10 del servidor")
    .addStringOption((opt) =>
      opt.setName("type")
        .setDescription("Categoría")
        .setRequired(false)
        .addChoices(
          { name: "XP", value: "xp" },
          { name: "Voz", value: "voice" },
          { name: "Nivel", value: "level" }
        )
    ),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    await leaderboardCommand.execute(interaction);
  },
};
