import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from "discord.js";
import prisma from "../../core/database/prisma";
import { createLog } from "../../modules/logs/service";
import { emitMissionUpdate } from "../../core/utils/sse";
import { announceMission } from "../../core/utils/announcer";
import { getResetDate, invalidateMissionCache } from "../../modules/missions/service";
import { calculateLevel } from "../../core/utils/helpers";

export const createmissionCommand = {
  data: new SlashCommandBuilder()
    .setName("createmission")
    .setDescription("Crear una nueva misión")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName("name").setDescription("Nombre").setRequired(true))
    .addStringOption((opt) => opt.setName("type").setDescription("Tipo").setRequired(true).addChoices(
      { name: "Enviar mensajes", value: "send_messages" },
      { name: "Minutos en voz", value: "voice_minutes" },
      { name: "Ganar XP", value: "xp_earned" },
      { name: "Subir de nivel", value: "level_up" },
      { name: "Inicio de sesión diario", value: "daily_login" },
      { name: "Regalo de rol (+XP)", value: "role_gift" }
    ))
    .addStringOption((opt) => opt.setName("objective").setDescription("Objetivo").setRequired(true))
    .addStringOption((opt) => opt.setName("frequency").setDescription("Frecuencia").setRequired(true).addChoices(
      { name: "Diaria", value: "DAILY" },
      { name: "Semanal", value: "WEEKLY" },
      { name: "Mensual", value: "MONTHLY" },
      { name: "Única", value: "UNICA" }
    ))
    .addIntegerOption((opt) => opt.setName("reward").setDescription("Recompensa XP").setRequired(false).setMinValue(0)),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const name = interaction.options.getString("name", true);
    const type = interaction.options.getString("type", true);
    const objective = interaction.options.getString("objective", true);
    const frequency = interaction.options.getString("frequency", true) as "DAILY" | "WEEKLY" | "MONTHLY";
    const reward = interaction.options.getInteger("reward") || 0;

    const mission = await prisma.mission.create({ data: { name, type, objective, frequency, reward, guildId } });

    // Initialize progress for existing users
    const users = await prisma.user.findMany({ where: { guildId }, select: { id: true, xp: true, voiceTime: true } });
    if (users.length > 0) {
      const isTotalType = type === "xp_earned" || type === "voice_minutes";
      const missionObj = parseInt(objective, 10) || 0;

      await prisma.userMissionProgress.createMany({
        data: users.map((u) => {
          let initialProgress = 0;

          if (isTotalType) {
            const source = type === "xp_earned" ? Number(u.xp) : u.voiceTime;
            initialProgress = Math.min(source, missionObj);
          }

          return {
            userId: u.id,
            missionId: mission.id,
            guildId,
            progress: initialProgress,
            completed: false,
          };
        }),
        skipDuplicates: true,
      });

      // Para misiones de tipo total (xp_earned, voice_minutes): si el usuario ya cumple
      // el objetivo, otorgar la recompensa inmediatamente
      if (isTotalType && missionObj > 0 && reward > 0) {
        const now = new Date();
        for (const u of users) {
          const source = type === "xp_earned" ? Number(u.xp) : u.voiceTime;
          if (source >= missionObj) {
            const progressEntry = await prisma.userMissionProgress.findFirst({
              where: { userId: u.id, missionId: mission.id },
            });
            if (progressEntry && !progressEntry.completed) {
              await prisma.$transaction(async (tx) => {
                await tx.userMissionProgress.update({
                  where: { id: progressEntry.id },
                  data: {
                    completed: true,
                    completedAt: now,
                    resetAt: getResetDate(frequency),
                  },
                });
                await tx.user.update({
                  where: { id: u.id },
                  data: {
                    xp: { increment: BigInt(reward) },
                    level: calculateLevel(BigInt(Number(u.xp) + reward)),
                  },
                });
                await tx.xpLog.create({
                  data: {
                    userId: u.id,
                    xpAmount: BigInt(reward),
                    reason: `mission:${mission.id}`,
                    guildId,
                  },
                });
              });
            }
          }
        }
      }
    }

    invalidateMissionCache(guildId);
    emitMissionUpdate(guildId);

    await Promise.all([
      createLog({ action: "MISSION_CREATE", entity: "mission", entityId: mission.id, userId: interaction.user.id, details: name }),
      announceMission("create", mission),
      interaction.reply({ content: `✅ Misión **${name}** creada.`, ephemeral: true }),
    ]);
  },
};

export const editmissionCommand = {
  data: new SlashCommandBuilder()
    .setName("editmission")
    .setDescription("Editar una misión")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName("id").setDescription("ID de la misión").setRequired(true))
    .addStringOption((opt) => opt.setName("name").setDescription("Nuevo nombre").setRequired(false))
    .addStringOption((opt) => opt.setName("objective").setDescription("Nuevo objetivo").setRequired(false))
    .addIntegerOption((opt) => opt.setName("reward").setDescription("Nueva recompensa").setRequired(false).setMinValue(0)),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const id = interaction.options.getString("id", true);

    // Fetch the mission first to have full data for announcement
    const mission = await prisma.mission.findUnique({ where: { id, guildId } });
    if (!mission) {
      await interaction.reply({ content: "❌ Misión no encontrada.", ephemeral: true });
      return;
    }

    const data: Record<string, unknown> = {};
    const name = interaction.options.getString("name");
    const objective = interaction.options.getString("objective");
    const reward = interaction.options.getInteger("reward");
    if (name !== null) data.name = name;
    if (objective !== null) data.objective = objective;
    if (reward !== null) data.reward = reward;

    const updatedMission = { ...mission, ...data };

    if (Object.keys(data).length > 0) {
      await prisma.mission.update({ where: { id, guildId }, data });
    }

    emitMissionUpdate(guildId);
    await Promise.all([
      createLog({ action: "MISSION_UPDATE", entity: "mission", entityId: id, userId: interaction.user.id }),
      announceMission("update", updatedMission),
      interaction.reply({ content: `✅ Misión actualizada.`, ephemeral: true }),
    ]);
  },
};

export const deletemissionCommand = {
  data: new SlashCommandBuilder()
    .setName("deletemission")
    .setDescription("Eliminar una misión")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName("id").setDescription("ID de la misión").setRequired(true)),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId!;
    const id = interaction.options.getString("id", true);
    await prisma.userMissionProgress.deleteMany({ where: { missionId: id, mission: { guildId } } });
    await prisma.mission.delete({ where: { id, guildId } });
    emitMissionUpdate(guildId);
    await Promise.all([
      createLog({ action: "MISSION_DELETE", entity: "mission", entityId: id, userId: interaction.user.id }),
      interaction.reply({ content: `✅ Misión eliminada.`, ephemeral: true }),
    ]);
  },
};
