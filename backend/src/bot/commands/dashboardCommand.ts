import { CommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";

export const dashboardCommand = {
  data: new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Obtener el link del dashboard"),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3000";

    const embed = new EmbedBuilder()
      .setTitle("🏆 STAN PLAYA SEGUNDO - Dashboard")
      .setDescription(
        `Accedé al panel de administración desde el siguiente enlace:\n\n` +
        `🔗 **[${dashboardUrl}](${dashboardUrl})**\n\n` +
        `Iniciá sesión con Discord para gestionar rangos, eventos, misiones y más.`
      )
      .setColor(0xffd700)
      .setFooter({ text: "STAN PLAYA SEGUNDO" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: false });
  },
};
