import { Message } from "discord.js";
import { handleMessageXp } from "../../modules/xp/service";
import { trackMissionProgress } from "../../modules/missions/service";
import { logger } from "../../core/utils/logger";

export async function onMessageCreate(message: Message): Promise<void> {
  if (message.author.bot) return;
  if (!message.guild) return;

  try {
    await handleMessageXp(message);
    if (message.guildId) {
      await trackMissionProgress(message.author.id, "role_gift", 1, message.guildId);
    }
  } catch (error) {
    logger.error("Error processing message XP", { error: String(error), userId: message.author.id });
  }
}
