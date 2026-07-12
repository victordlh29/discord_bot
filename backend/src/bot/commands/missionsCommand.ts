import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from "discord.js";
import { getUserMissionProgress } from "../../modules/missions/service";

export const missionsCommand = {
  data: new SlashCommandBuilder()
    .setName("missions")
    .setDescription("Ver tu progreso en las misiones activas"),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply({ ephemeral: true });

    const progress = await getUserMissionProgress(interaction.user.id, interaction.guildId!);
    if (progress.length === 0) {
      await interaction.editReply({ content: "📋 No hay misiones activas en este momento." });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("📋 Tus Misiones")
      .setColor(0x9b59b6)
      .setTimestamp();

    for (const mp of progress) {
      const status = mp.completed
        ? "✅ Completada"
        : `⏳ ${mp.progress}/${mp.objective}`;
      const freqLabel = mp.frequency === "DAILY" ? "Diaria" : mp.frequency === "WEEKLY" ? "Semanal" : mp.frequency === "MONTHLY" ? "Mensual" : "Única";
      embed.addFields({
        name: `${mp.missionName} (${freqLabel})`,
        value: `${status}\nRecompensa: ${mp.reward} XP`,
        inline: true,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
