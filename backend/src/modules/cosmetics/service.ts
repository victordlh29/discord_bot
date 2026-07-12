import prisma from "../../core/database/prisma";
import { createLog } from "../logs/service";
import { logger } from "../../core/utils/logger";

export interface CosmeticInput {
  name: string;
  type: "TITLE" | "BADGE" | "BACKGROUND" | "FRAME";
  rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";
  imageUrl?: string | null;
}

export async function getCosmetics(guildId: string) {
  return prisma.cosmetic.findMany({ where: { guildId }, orderBy: { createdAt: "desc" } });
}

export async function createCosmetic(data: CosmeticInput, guildId: string, userId?: string) {
  const cosmetic = await prisma.cosmetic.create({ data: { ...data, guildId } });
  await createLog({
    action: "COSMETIC_CREATE",
    entity: "cosmetic",
    entityId: cosmetic.id,
    userId,
  }).catch((err) => logger.error("Failed to log cosmetic creation", { error: String(err) }));
  return cosmetic;
}

export async function updateCosmetic(id: string, data: Partial<CosmeticInput>, guildId: string, userId?: string) {
  const cosmetic = await prisma.cosmetic.update({ where: { id, guildId }, data });
  await createLog({
    action: "COSMETIC_UPDATE",
    entity: "cosmetic",
    entityId: id,
    userId,
  }).catch((err) => logger.error("Failed to log cosmetic update", { error: String(err) }));
  return cosmetic;
}

export async function deleteCosmetic(id: string, guildId: string, userId?: string) {
  await prisma.cosmetic.delete({ where: { id, guildId } });
  await createLog({
    action: "COSMETIC_DELETE",
    entity: "cosmetic",
    entityId: id,
    userId,
  }).catch((err) => logger.error("Failed to log cosmetic deletion", { error: String(err) }));
}
