import { CommandInteraction, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import prisma from "../../core/database/prisma";
import { createLog } from "../../modules/logs/service";
import { updateSetting } from "../../modules/settings/service";

export const configCommand = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configurar el sistema")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("Ver configuración actual")
    )
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Establecer un valor de configuración")
        .addStringOption((opt) =>
          opt.setName("key").setDescription("Clave de configuración").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("value").setDescription("Valor").setRequired(true)
        )
    ),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "view") {
      const settings = await prisma.setting.findMany({ where: { guildId }, orderBy: { key: "asc" } });
      const embed = new EmbedBuilder()
        .setTitle("Configuración Actual")
        .setColor(0x00aaff)
        .setTimestamp();

      for (const s of settings) {
        embed.addFields({ name: s.key, value: `\`${s.value}\``, inline: true });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (subcommand === "set") {
      const key = interaction.options.getString("key", true);
      const value = interaction.options.getString("value", true);

      await updateSetting(key, value, guildId);

      await Promise.all([
        createLog({ action: "SETTINGS_UPDATE", entity: "settings", userId: interaction.user.id, details: `${key} = ${value}` }),
        interaction.reply({ content: `✅ Configuración \`${key}\` actualizada a \`${value}\``, ephemeral: true }),
      ]);
    }
  },
};
