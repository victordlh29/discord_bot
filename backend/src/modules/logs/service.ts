import prisma from "../../core/database/prisma";
import { logger } from "../../core/utils/logger";

interface CreateLogParams {
  action: string;
  entity?: string;
  entityId?: string;
  userId?: string;
  details?: string;
  guildId?: string;
}

export async function createLog(params: CreateLogParams): Promise<void> {
  try {
    await prisma.log.create({
      data: {
        action: params.action,
        entity: params.entity || null,
        entityId: params.entityId || null,
        userId: params.userId || null,
        details: params.details || null,
        guildId: params.guildId || null,
      },
    });
  } catch (error) {
    logger.error("Failed to create audit log", { action: params.action, error: String(error) });
  }
}
