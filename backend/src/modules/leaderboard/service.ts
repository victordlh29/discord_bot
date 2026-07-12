import prisma from "../../core/database/prisma";

export async function getXpLeaderboard(guildId: string, limit: number = 10) {
  return prisma.user.findMany({
    where: { guildId },
    orderBy: { xp: "desc" },
    take: limit,
    include: { rank: true },
  });
}

export async function getVoiceLeaderboard(guildId: string, limit: number = 10) {
  return prisma.user.findMany({
    where: { guildId },
    orderBy: { voiceTime: "desc" },
    take: limit,
    include: { rank: true },
  });
}

export async function getLevelLeaderboard(guildId: string, limit: number = 10) {
  return prisma.user.findMany({
    where: { guildId },
    orderBy: [{ level: "desc" }, { xp: "desc" }],
    take: limit,
    include: { rank: true },
  });
}

export async function getUserPosition(discordId: string, guildId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { discordId_guildId: { discordId, guildId } },
    select: { xp: true },
  });

  if (!user) return null;

  const higherCount = await prisma.user.count({
    where: { xp: { gt: user.xp }, guildId },
  });

  return higherCount + 1;
}
