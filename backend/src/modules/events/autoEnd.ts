import prisma from "../../core/database/prisma";
import { announceEventEnd, invalidateActiveEventsCache } from "./service";
import { logger } from "../../core/utils/logger";

export async function autoEndExpiredEvents(): Promise<void> {
  const now = new Date();
  const expired = await prisma.event.findMany({
    where: {
      isActive: true,
      endsAt: { lte: now },
    },
    take: 1000,
  });

  if (expired.length === 0) return;

  await prisma.$transaction(
    expired.map((event) =>
      prisma.event.update({
        where: { id: event.id },
        data: { isActive: false },
      })
    )
  );

  for (const event of expired) {
    invalidateActiveEventsCache(event.guildId);

    try {
      await announceEventEnd(event);
      logger.info(`Event "${event.name}" auto-ended (duration expired)`);
    } catch (error) {
      logger.error(`Failed to announce event end for "${event.name}"`, { error: String(error) });
    }
  }
}
