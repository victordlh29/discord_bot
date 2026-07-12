import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from "discord.js";
import prisma from "../../core/database/prisma";

export const eventstatusCommand = {
  data: new SlashCommandBuilder()
    .setName("eventstatus")
    .setDescription("Ver los eventos activos actualmente"),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const now = new Date();
    const guildId = interaction.guildId!;
    const activeEvents = await prisma.event.findMany({
      where: {
        isActive: true,
        guildId,
        OR: [
          { endsAt: { gte: now } },
          { endsAt: null },
        ],
      },
    });

    const filtered = activeEvents.filter((e) => {
      if (e.startsAt && now < e.startsAt) return false;
      if (e.endsAt && e.endsAt < now) return false;
      return true;
    });

    if (filtered.length === 0) {
      await interaction.reply({ content: "📢 No hay eventos activos en este momento.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("📢 Eventos Activos")
      .setColor(0x00aaff)
      .setTimestamp();

    for (const event of filtered) {
      const typeLabel = event.type === "DOUBLE_XP" ? "🎯 Doble XP" : event.type === "CHAT" ? "💬 Chat" : event.type === "VOICE" ? "🎤 Voz" : "📅 Mensual";

      let timeLeft = "⏳ Sin límite";
      if (event.endsAt) {
        const ms = Math.max(0, event.endsAt.getTime() - now.getTime());
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        timeLeft = `⏳ ${mins}m ${secs}s restantes`;
      }

      embed.addFields({
        name: `${event.name} (${typeLabel})`,
        value: `${timeLeft}\n💰 Recompensa: ${event.reward} XP`,
        inline: true,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
