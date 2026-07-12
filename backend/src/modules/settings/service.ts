import prisma from "../../core/database/prisma";
import { cacheGet, cacheSet, cacheDel } from "../../core/utils/redis";

const CACHE_KEY = "settings:all";
const CACHE_TTL = 60;

async function getAllSettings(guildId?: string): Promise<Record<string, string>> {
  const gId = guildId || process.env.DISCORD_GUILD_ID || "default";
  const cacheKey = `${CACHE_KEY}:${gId}`;
  const cached = await cacheGet<Record<string, string>>(cacheKey);
  if (cached) return cached;

  const settings = await prisma.setting.findMany({ where: { guildId: gId } });
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  await cacheSet(cacheKey, map, CACHE_TTL);
  return map;
}

export async function getSetting(key: string, guildId?: string): Promise<string | null> {
  const all = await getAllSettings(guildId);
  return all[key] || null;
}

export async function getSettingInt(key: string, defaultValue = 0, guildId?: string): Promise<number> {
  const val = await getSetting(key, guildId);
  return val ? parseInt(val, 10) : defaultValue;
}

export async function getSettingFloat(key: string, defaultValue = 1, guildId?: string): Promise<number> {
  const val = await getSetting(key, guildId);
  return val ? parseFloat(val) : defaultValue;
}

export async function updateSetting(key: string, value: string, guildId?: string): Promise<void> {
  const gId = guildId || process.env.DISCORD_GUILD_ID || "default";
  const cacheKey = `${CACHE_KEY}:${gId}`;
  await prisma.setting.upsert({
    where: { key_guildId: { key, guildId: gId } },
    update: { value },
    create: { key, value, guildId: gId },
  });
  await cacheDel(cacheKey);
}
