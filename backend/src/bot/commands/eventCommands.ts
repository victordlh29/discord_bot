import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from "discord.js";
import prisma from "../../core/database/prisma";
import { createLog } from "../../modules/logs/service";

export const createeventCommand = {
  data: new SlashCommandBuilder()
    .setName("createevent")
    .setDescription("Crear un nuevo evento")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName("name").setDescription("Nombre del evento").setRequired(true))
    .addStringOption((opt) => opt.setName("type").setDescription("Tipo de evento").setRequired(true).addChoices(
      { name: "Chat", value: "CHAT" },
      { name: "Voz", value: "VOICE" },
      { name: "Doble XP", value: "DOUBLE_XP" },
      { name: "Mensual", value: "MONTHLY" }
    ))
    .addIntegerOption((opt) => opt.setName("duration").setDescription("Duración en minutos").setRequired(true).setMinValue(0))
    .addIntegerOption((opt) => opt.setName("reward").setDescription("Recompensa en XP").setRequired(false).setMinValue(0)),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const name = interaction.options.getString("name", true);
    const type = interaction.options.getString("type", true) as "CHAT" | "VOICE" | "DOUBLE_XP" | "MONTHLY";
    const duration = interaction.options.getInteger("duration", true);
    const reward = interaction.options.getInteger("reward") || 0;

    const event = await prisma.event.create({ data: { name, type, duration, reward, guildId } });
    await Promise.all([
      createLog({ action: "EVENT_CREATE", entity: "event", entityId: event.id, userId: interaction.user.id, details: name }),
      interaction.reply({ content: `✅ Evento **${name}** creado.`, ephemeral: true }),
    ]);
  },
};

export const editeventCommand = {
  data: new SlashCommandBuilder()
    .setName("editevent")
    .setDescription("Editar un evento")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName("id").setDescription("ID del evento").setRequired(true))
    .addStringOption((opt) => opt.setName("name").setDescription("Nuevo nombre").setRequired(false))
    .addIntegerOption((opt) => opt.setName("duration").setDescription("Nueva duración (min)").setRequired(false).setMinValue(0))
    .addIntegerOption((opt) => opt.setName("reward").setDescription("Nueva recompensa").setRequired(false).setMinValue(0)),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const id = interaction.options.getString("id", true);
    const data: Record<string, unknown> = {};
    const name = interaction.options.getString("name");
    const duration = interaction.options.getInteger("duration");
    const reward = interaction.options.getInteger("reward");
    if (name !== null) data.name = name;
    if (duration !== null) data.duration = duration;
    if (reward !== null) data.reward = reward;
    await prisma.event.update({ where: { id, guildId }, data });
    await Promise.all([
      createLog({ action: "EVENT_UPDATE", entity: "event", entityId: id, userId: interaction.user.id }),
      interaction.reply({ content: `✅ Evento actualizado.`, ephemeral: true }),
    ]);
  },
};

export const deleventCommand = {
  data: new SlashCommandBuilder()
    .setName("delevent")
    .setDescription("Eliminar un evento")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName("id").setDescription("ID del evento").setRequired(true)),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const id = interaction.options.getString("id", true);
    await prisma.event.delete({ where: { id, guildId } });
    await Promise.all([
      createLog({ action: "EVENT_DELETE", entity: "event", entityId: id, userId: interaction.user.id }),
      interaction.reply({ content: `✅ Evento eliminado.`, ephemeral: true }),
    ]);
  },
};
