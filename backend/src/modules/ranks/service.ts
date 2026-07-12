import prisma from "../../core/database/prisma";
import { createLog } from "../logs/service";
import { logger } from "../../core/utils/logger";

export interface RankInput {
  name: string;
  requiredXp: number;
  discordRoleId?: string | null;
  color?: string | null;
  icon?: string | null;
  gifUrl?: string | null;
  position: number;
}

export async function getRanks(guildId: string) {
  return prisma.rank.findMany({ where: { guildId }, orderBy: { position: "asc" } });
}

export async function createRank(data: RankInput, guildId: string, userId?: string) {
  const rank = await prisma.rank.create({ data: { ...data, guildId } });
  await createLog({
    action: "RANK_CREATE",
    entity: "rank",
    entityId: rank.id,
    userId,
    details: JSON.stringify(data),
  }).catch((err) => logger.error("Failed to log rank creation", { error: String(err) }));
  return rank;
}

export async function updateRank(id: string, updates: Partial<RankInput>, guildId: string, userId?: string) {
  const rank = await prisma.rank.update({ where: { id, guildId }, data: updates });
  await createLog({
    action: "RANK_UPDATE",
    entity: "rank",
    entityId: id,
    userId,
    details: JSON.stringify(updates),
  }).catch((err) => logger.error("Failed to log rank update", { error: String(err) }));
  return rank;
}

export async function deleteRank(id: string, guildId: string, userId?: string) {
  await prisma.rank.delete({ where: { id, guildId } });
  await createLog({
    action: "RANK_DELETE",
    entity: "rank",
    entityId: id,
    userId,
  }).catch((err) => logger.error("Failed to log rank deletion", { error: String(err) }));
}

export async function reorderRank(id: string, position: number, guildId: string) {
  return prisma.rank.update({ where: { id, guildId }, data: { position } });
}
