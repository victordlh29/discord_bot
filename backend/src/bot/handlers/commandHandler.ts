import { Interaction, Events, Client } from "discord.js";
import { getCommands } from "../commands";
import { logger } from "../../core/utils/logger";

export function setupCommandHandler(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const commands = getCommands();
    const command = commands.find((c) => c.data.name === interaction.commandName);

    if (!command) {
      await interaction.reply({ content: "❌ Comando no encontrado.", ephemeral: true });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}`, { error: String(error) });
      const reply = interaction.replied || interaction.deferred
        ? interaction.followUp.bind(interaction)
        : interaction.reply.bind(interaction);
      await reply({ content: "❌ Ocurrió un error al ejecutar el comando.", ephemeral: true });
    }
  });
}
