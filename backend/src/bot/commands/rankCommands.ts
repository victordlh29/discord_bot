import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from "discord.js";
import prisma from "../../core/database/prisma";
import { createLog } from "../../modules/logs/service";

export const addrankCommand = {
  data: new SlashCommandBuilder()
    .setName("addrank")
    .setDescription("Crear un nuevo rango")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName("name").setDescription("Nombre del rango").setRequired(true))
    .addIntegerOption((opt) => opt.setName("xp").setDescription("XP requerida").setRequired(true))
    .addStringOption((opt) => opt.setName("color").setDescription("Color hex").setRequired(false))
    .addRoleOption((opt) => opt.setName("role").setDescription("Rol de Discord").setRequired(false)),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const name = interaction.options.getString("name", true);
    const requiredXp = interaction.options.getInteger("xp", true);
    const color = interaction.options.getString("color");
    const role = interaction.options.getRole("role");
    const maxPos = await prisma.rank.count({ where: { guildId } });

    const rank = await prisma.rank.create({
      data: {
        name,
        requiredXp: BigInt(requiredXp),
        color,
        discordRoleId: role?.id,
        position: maxPos + 1,
        guildId,
      },
    });

    await Promise.all([
      createLog({ action: "RANK_CREATE", entity: "rank", entityId: rank.id, userId: interaction.user.id, details: name }),
      interaction.reply({ content: `✅ Rango **${name}** creado con ${requiredXp} XP requeridos.`, ephemeral: true }),
    ]);
  },
};

export const editrankCommand = {
  data: new SlashCommandBuilder()
    .setName("editrank")
    .setDescription("Editar un rango existente")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName("id").setDescription("ID del rango").setRequired(true))
    .addStringOption((opt) => opt.setName("name").setDescription("Nuevo nombre").setRequired(false))
    .addIntegerOption((opt) => opt.setName("xp").setDescription("Nueva XP requerida").setRequired(false))
    .addStringOption((opt) => opt.setName("color").setDescription("Nuevo color hex").setRequired(false))
    .addRoleOption((opt) => opt.setName("role").setDescription("Nuevo rol Discord").setRequired(false)),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const id = interaction.options.getString("id", true);
    const data: Record<string, unknown> = {};
    const name = interaction.options.getString("name");
    const xp = interaction.options.getInteger("xp");
    const color = interaction.options.getString("color");
    const role = interaction.options.getRole("role");
    if (name !== null) data.name = name;
    if (xp !== null) data.requiredXp = BigInt(xp);
    if (color !== null) data.color = color;
    if (role !== null) data.discordRoleId = role.id;

    await prisma.rank.update({ where: { id, guildId }, data });
    await Promise.all([
      createLog({ action: "RANK_UPDATE", entity: "rank", entityId: id, userId: interaction.user.id }),
      interaction.reply({ content: `✅ Rango actualizado.`, ephemeral: true }),
    ]);
  },
};

export const removerankCommand = {
  data: new SlashCommandBuilder()
    .setName("removerank")
    .setDescription("Eliminar un rango")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName("id").setDescription("ID del rango").setRequired(true)),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const id = interaction.options.getString("id", true);
    await prisma.rank.delete({ where: { id, guildId } });
    await Promise.all([
      createLog({ action: "RANK_DELETE", entity: "rank", entityId: id, userId: interaction.user.id }),
      interaction.reply({ content: `✅ Rango eliminado.`, ephemeral: true }),
    ]);
  },
};
