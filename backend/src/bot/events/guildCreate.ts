import { EmbedBuilder, Guild, GuildMember } from "discord.js";
import { logger } from "../../core/utils/logger";

/** Construye y envía un DM con el link del dashboard al owner de un servidor */
export async function sendDashboardDM(
  guildName: string,
  owner: GuildMember,
  isNewGuild: boolean
): Promise<void> {
  try {
    const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3000";

    const title = isNewGuild ? "🏆 ¡Dashboard listo!" : "🔄 Bot reiniciado";
    const greeting = isNewGuild
      ? `Gracias por agregar **STAN PLAYA SEGUNDO** a **${guildName}**.`
      : `**STAN PLAYA SEGUNDO** se ha reiniciado en **${guildName}**.`;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(
        `${greeting}\n\n` +
        `Accedé a tu panel de administración para configurar el sistema de gamificación:\n\n` +
        `🔗 **${dashboardUrl}**\n\n` +
        `Iniciá sesión con Discord y tendrás acceso automático como propietario del servidor. 👑\n\n` +
        `Desde el dashboard podés gestionar:\n` +
        `• Rangos y experiencia\n` +
        `• Eventos y misiones\n` +
        `• Cosméticos y leaderboard\n` +
        `• Control de acceso para admins`
      )
      .setColor(isNewGuild ? 0xffd700 : 0x5865f2) // Dorado 👑 o azul Discord
      .setFooter({ text: "STAN PLAYA SEGUNDO" })
      .setTimestamp();

    await owner.send({ embeds: [embed] });
    logger.info(`📬 DM enviado al owner de ${guildName} (${owner.user.tag})`);
  } catch (error) {
    logger.warn(`No se pudo enviar DM al owner de ${guildName}`, {
      error: String(error),
      hint: "El owner probablemente tiene los DMs cerrados",
    });
  }
}

export async function onGuildCreate(guild: Guild): Promise<void> {
  try {
    // Fetch owner para asegurarnos de tenerlo en caché
    await guild.members.fetch(guild.ownerId);
    const owner = guild.members.cache.get(guild.ownerId);

    if (!owner) {
      logger.warn(`onGuildCreate: no se pudo obtener el owner del guild ${guild.id} (${guild.name})`);
      return;
    }

    await sendDashboardDM(guild.name, owner, true);
  } catch (error) {
    logger.warn(`onGuildCreate: error para ${guild.id} (${guild.name})`, {
      error: String(error),
    });
  }
}
