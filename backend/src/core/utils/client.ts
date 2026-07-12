import { Client } from "discord.js";

let _client: Client | null = null;

export function setClient(client: Client): void {
  _client = client;
}

export function getClient(): Client | null {
  return _client;
}

/**
 * Verifica si el bot está en un canal de voz en el mismo servidor
 * que el usuario especificado. Si es así, el usuario solo debería
 * recibir XP por voz (no por mensajes de texto).
 */
export function isBotInVoiceWithUser(discordId: string, guildId: string): boolean {
  const client = _client;
  if (!client) return false;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return false;

  // Buscar al miembro del usuario
  const member = guild.members.cache.get(discordId);
  if (!member?.voice.channelId) return false;

  // Verificar si el bot está en el MISMO canal de voz
  const botMember = guild.members.me;
  if (!botMember?.voice.channelId) return false;

  // El bot está en un canal de voz - verificar si es el mismo que el del usuario
  return botMember.voice.channelId === member.voice.channelId;
}
