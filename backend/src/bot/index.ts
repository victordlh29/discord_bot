import { Client, GatewayIntentBits, Partials, Events } from "discord.js";
import { logger } from "../core/utils/logger";
import { registerCommand, deployCommands } from "./commands";
import { configCommand } from "./commands/config";
import { setxpCommand, setvoicexpCommand, setcooldownCommand } from "./commands/xpCommands";
import { addrankCommand, editrankCommand, removerankCommand } from "./commands/rankCommands";
import { createeventCommand, editeventCommand, deleventCommand } from "./commands/eventCommands";
import { createmissionCommand, editmissionCommand, deletemissionCommand } from "./commands/missionCommands";
import { rankCommand, xpCommand, profileCommand, statsCommand } from "./commands/userCommands";
import { leaderboardCommand, topCommand } from "./commands/leaderboardCommands";
import { missionsCommand } from "./commands/missionsCommand";
import { eventstatusCommand } from "./commands/eventStatusCommand";
import { dashboardCommand } from "./commands/dashboardCommand";
import {
  playCommand,
  skipCommand,
  stopCommand,
  queueCommand,
  pauseCommand,
  resumeCommand,
  nowplayingCommand,
  volumeCommand,
  removeCommand,
} from "./commands/musicCommands";
import { setupCommandHandler } from "./handlers/commandHandler";
import { setClient } from "../core/utils/client";
import { initPlayer } from "../modules/music/service";
import { onMessageCreate } from "./events/messageCreate";
import { onVoiceStateUpdate } from "./events/voiceStateUpdate";
import { onGuildMemberUpdate } from "./events/guildMemberUpdate";
import { onGuildCreate, sendDashboardDM } from "./events/guildCreate";
import { onGuildMemberAdd } from "./events/guildMemberAdd";

export async function createBot(): Promise<Client> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel],
  });

  registerCommand(configCommand);
  registerCommand(setxpCommand);
  registerCommand(setvoicexpCommand);
  registerCommand(setcooldownCommand);
  registerCommand(addrankCommand);
  registerCommand(editrankCommand);
  registerCommand(removerankCommand);
  registerCommand(createeventCommand);
  registerCommand(editeventCommand);
  registerCommand(deleventCommand);
  registerCommand(createmissionCommand);
  registerCommand(editmissionCommand);
  registerCommand(deletemissionCommand);
  registerCommand(rankCommand);
  registerCommand(xpCommand);
  registerCommand(profileCommand);
  registerCommand(statsCommand);
  registerCommand(leaderboardCommand);
  registerCommand(topCommand);
  registerCommand(missionsCommand);
  registerCommand(eventstatusCommand);
  registerCommand(dashboardCommand);
  // ── Comandos de música ──
  registerCommand(playCommand);
  registerCommand(skipCommand);
  registerCommand(stopCommand);
  registerCommand(queueCommand);
  registerCommand(pauseCommand);
  registerCommand(resumeCommand);
  registerCommand(nowplayingCommand);
  registerCommand(volumeCommand);
  registerCommand(removeCommand);

  setupCommandHandler(client);
  setClient(client);

  // Inicializar reproductor de música
  await initPlayer(client);
  logger.info("🎵 Music player initialized");

  client.on(Events.ClientReady, async () => {
    logger.info(`Bot logged in as ${client.user?.tag}`);

    // Enviar DM con link del dashboard a todos los dueños de servidores
    const guilds = Array.from(client.guilds.cache.values());
    logger.info(`📬 Enviando DM del dashboard a ${guilds.length} servidor(es)...`);

    for (const guild of guilds) {
      try {
        await guild.members.fetch(guild.ownerId);
        const owner = guild.members.cache.get(guild.ownerId);
        if (owner) {
          await sendDashboardDM(guild.name, owner, false);
          // Pequeña pausa para evitar rate limiting de Discord
          await new Promise((r) => setTimeout(r, 1_000));
        }
      } catch {
        logger.warn(`No se pudo enviar DM al owner de ${guild.name}`);
      }
    }
  });

  client.on(Events.MessageCreate, onMessageCreate);
  client.on(Events.VoiceStateUpdate, onVoiceStateUpdate);
  client.on(Events.GuildMemberUpdate, onGuildMemberUpdate);
  client.on(Events.GuildCreate, onGuildCreate);
  client.on(Events.GuildMemberAdd, onGuildMemberAdd);

  return client;
}

export async function startBot(client: Client): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    logger.warn("DISCORD_BOT_TOKEN not configured, bot will not start");
    return;
  }

  try {
    await client.login(token);
    await deployCommands();
  } catch (error) {
    logger.error("Failed to start bot", { error: String(error) });
  }
}
