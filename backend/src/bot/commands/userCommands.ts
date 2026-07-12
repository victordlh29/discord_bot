import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from "discord.js";
import prisma from "../../core/database/prisma";
import { xpToNextLevel, progressToNextLevel } from "../../core/utils/helpers";

async function getUserProfile(discordId: string, guildId: string, username?: string) {
  let user = await prisma.user.findUnique({
    where: { discordId_guildId: { discordId, guildId } },
    include: { rank: true },
  });
  if (!user) {
    user = await prisma.user.create({
      data: { discordId, guildId, username: username || discordId },
      include: { rank: true },
    });
  }
  const position = await prisma.user.count({ where: { xp: { gt: user.xp }, guildId } });
  return { ...user, position: position + 1, nextLevelXp: xpToNextLevel(user.xp, user.level), progress: progressToNextLevel(user.xp, user.level) };
}

export const rankCommand = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Ver tu rango o el de otro usuario")
    .addUserOption((opt) => opt.setName("user").setDescription("Usuario").setRequired(false)),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const target = interaction.options.getUser("user") || interaction.user;
    const profile = await getUserProfile(target.id, guildId, target.username);
    const embed = new EmbedBuilder()
      .setTitle(`Rango de ${target.username}`)
      .setColor(profile.rank?.color ? parseInt(profile.rank.color.replace("#", ""), 16) : 0x00aaff)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "Nivel", value: `${profile.level}`, inline: true },
        { name: "XP", value: `${profile.xp.toString()}`, inline: true },
        { name: "Rango", value: profile.rank?.name || "Sin rango", inline: true },
        { name: "Posición", value: `#${profile.position}`, inline: true },
        { name: "XP para siguiente nivel", value: `${profile.nextLevelXp.toString()}`, inline: true },
        { name: "Tiempo en voz", value: `${Math.floor(profile.voiceTime / 60)}h ${profile.voiceTime % 60}m`, inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

export const xpCommand = {
  data: new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Ver tu XP actual")
    .addUserOption((opt) => opt.setName("user").setDescription("Usuario").setRequired(false)),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const target = interaction.options.getUser("user") || interaction.user;
    const profile = await getUserProfile(target.id, guildId, target.username);
    const embed = new EmbedBuilder()
      .setTitle(`XP de ${target.username}`)
      .setColor(0x00aaff)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "XP Total", value: `${profile.xp.toString()}`, inline: true },
        { name: "Nivel", value: `${profile.level}`, inline: true },
        { name: `XP para nivel ${profile.level + 1}`, value: `${profile.nextLevelXp.toString()}`, inline: true },
        { name: "Progreso", value: `${Math.round(profile.progress * 100)}%`, inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

export const profileCommand = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Ver tu perfil completo")
    .addUserOption((opt) => opt.setName("user").setDescription("Usuario").setRequired(false)),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const target = interaction.options.getUser("user") || interaction.user;
    const profile = await getUserProfile(target.id, guildId, target.username);
    const embed = new EmbedBuilder()
      .setTitle(`Perfil de ${target.username}`)
      .setColor(profile.rank?.color ? parseInt(profile.rank.color.replace("#", ""), 16) : 0x00aaff)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(profile.rank ? `**${profile.rank.name}**` : "Sin rango")
      .addFields(
        { name: "Nivel", value: `${profile.level}`, inline: true },
        { name: "XP Total", value: `${profile.xp.toString()}`, inline: true },
        { name: "Posición Global", value: `#${profile.position}`, inline: true },
        { name: "Tiempo en Voz", value: `${Math.floor(profile.voiceTime / 60)}h ${profile.voiceTime % 60}m`, inline: true },
        { name: "Progreso al Siguiente Nivel", value: `${Math.round(profile.progress * 100)}%`, inline: true },
      )
      .setFooter({ text: "STAN PLAYA SEGUNDO" })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

export const statsCommand = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Ver estadísticas del servidor"),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const [totalUsers, totalXp, totalVoice, totalMessages, totalRanks, activeEvents] = await Promise.all([
      prisma.user.count({ where: { guildId } }),
      prisma.user.aggregate({ where: { guildId }, _sum: { xp: true } }),
      prisma.user.aggregate({ where: { guildId }, _sum: { voiceTime: true } }),
      prisma.messageLog.count({ where: { guildId } }),
      prisma.rank.count({ where: { guildId } }),
      prisma.event.count({ where: { isActive: true, guildId } }),
    ]);
    const embed = new EmbedBuilder()
      .setTitle("📊 Estadísticas del Servidor")
      .setColor(0x00aaff)
      .addFields(
        { name: "Usuarios Registrados", value: `${totalUsers}`, inline: true },
        { name: "XP Total", value: `${totalXp._sum.xp?.toString() || "0"}`, inline: true },
        { name: "Horas en Voz", value: `${Math.floor((totalVoice._sum.voiceTime || 0) / 60)}h`, inline: true },
        { name: "Mensajes Procesados", value: `${totalMessages}`, inline: true },
        { name: "Rangos", value: `${totalRanks}`, inline: true },
        { name: "Eventos Activos", value: `${activeEvents}`, inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};
