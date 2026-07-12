import { REST, Routes, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder, SlashCommandOptionsOnlyBuilder, CommandInteraction } from "discord.js";
import { logger } from "../../core/utils/logger";

type CommandData = SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;
export interface Command {
  data: CommandData;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

const commands: Command[] = [];

export function registerCommand(command: Command): void {
  commands.push(command);
}

export function getCommands(): Command[] {
  return commands;
}

export async function deployCommands(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId) {
    logger.warn("Discord credentials not configured, skipping command deployment");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    const commandsData = commands.map((c) => c.data.toJSON());
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commandsData,
      });
      logger.info(`Deployed ${commandsData.length} commands to guild ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), {
        body: commandsData,
      });
      logger.info(`Deployed ${commandsData.length} global commands`);
    }
  } catch (error) {
    logger.error("Failed to deploy commands", { error: String(error) });
  }
}
