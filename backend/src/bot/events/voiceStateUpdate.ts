import { VoiceState } from "discord.js";
import { handleVoiceJoin, handleVoiceLeave, createSessionsForExistingMembers, closeSessionsOnBotLeave } from "../../modules/voice/service";
import { logger } from "../../core/utils/logger";

export async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
  try {
    // 🎤 Cuando el BOT se une a un canal de voz, crear sesiones
    // para los miembros que ya están en ese canal
    if (newState.member?.user.bot && !oldState.channelId && newState.channelId) {
      await createSessionsForExistingMembers(newState.guild.id, newState.channelId);
      return;
    }

    // 🎤 Cuando el BOT SALE de un canal de voz, cerrar sesiones
    // de los miembros que aún están en el canal y otorgar XP
    if (oldState.member?.user.bot && oldState.channelId && !newState.channelId) {
      await closeSessionsOnBotLeave(oldState.guild.id, oldState.channelId);
      return;
    }

    if (!oldState.channelId && newState.channelId) {
      await handleVoiceJoin(newState);
    } else if (oldState.channelId && !newState.channelId) {
      await handleVoiceLeave(oldState);
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      await handleVoiceLeave(oldState);
      await handleVoiceJoin(newState);
    }
  } catch (error) {
    logger.error("Error processing voice state", { error: String(error) });
  }
}
