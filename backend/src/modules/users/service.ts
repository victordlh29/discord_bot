import prisma from "../../core/database/prisma";
import { Prisma } from "@prisma/client";
import { getClient } from "../../core/utils/client";
import { createLog } from "../logs/service";
import { logger } from "../../core/utils/logger";

type UserWithRank = Prisma.UserGetPayload<{ include: { rank: true } }>;

export interface PaginatedUsers {
  users: UserWithRank[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function getUsers(
  guildId: string,
  page: number = 1,
  limit: number = 50,
  search?: string
): Promise<PaginatedUsers> {
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (page - 1) * safeLimit;

  const where: Prisma.UserWhereInput = { guildId };
  if (search) {
    where.OR = [
      { username: { contains: search, mode: "insensitive" as const } },
      { discordId: { contains: search } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { xp: "desc" },
      skip,
      take: safeLimit,
      include: { rank: true },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      page,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

export async function getUser(discordId: string, guildId: string) {
  return prisma.user.findUnique({
    where: { discordId_guildId: { discordId, guildId } },
    include: {
      rank: true,
      voiceSessions: { take: 10, orderBy: { createdAt: "desc" } },
    },
  });
}

export interface AssignRoleResult {
  success: boolean;
  message?: string;
  rank?: Prisma.RankGetPayload<Record<string, never>>;
  member?: string;
}

export async function assignRole(discordId: string, guildId: string): Promise<AssignRoleResult> {
  const client = getClient();
  if (!client) {
    return { success: false, message: "Discord client not ready" };
  }

  const user = await prisma.user.findUnique({
    where: { discordId_guildId: { discordId, guildId } },
    include: { rank: true },
  });
  if (!user) {
    return { success: false, message: "User not found" };
  }

  const ranks = await prisma.rank.findMany({ where: { guildId }, orderBy: { requiredXp: "asc" } });
  let newRank: typeof ranks[0] | null = null;
  for (const rank of ranks) {
    if (user.xp >= rank.requiredXp) newRank = rank;
    else break;
  }

  if (!newRank) {
    return { success: false, message: "El usuario no tiene XP suficiente para ningún rango." };
  }

  if (!newRank.discordRoleId) {
    return { success: false, message: "El rango no tiene un rol de Discord vinculado. Asigna uno primero." };
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return { success: false, message: "Guild not found" };
  }

  let member;
  try {
    member = await guild.members.fetch(discordId);
  } catch {
    return { success: false, message: "Miembro no encontrado en el servidor" };
  }

  const role = guild.roles.cache.get(newRank.discordRoleId);
  if (!role) {
    return { success: false, message: "El rol vinculado ya no existe en Discord" };
  }

  try {
    for (const rank of ranks) {
      if (rank.id !== newRank.id && rank.discordRoleId) {
        const oldRole = guild.roles.cache.get(rank.discordRoleId);
        if (oldRole && member.roles.cache.has(oldRole.id)) {
          await member.roles.remove(oldRole);
        }
      }
    }
    await member.roles.add(role);

    await prisma.user.update({
      where: { id: user.id },
      data: { rankId: newRank.id },
    });

    return {
      success: true,
      message: `✅ Rol **${newRank.name}** asignado correctamente a ${member.user.tag}`,
      rank: newRank,
      member: member.user.tag,
    };
  } catch (error: unknown) {
    logger.error("Error al asignar rol", { discordId, guildId, error: error instanceof Error ? error.message : "Unknown" });
    return {
      success: false,
      message: "Error al asignar rol. Verifica que el bot tenga permiso 'Gestionar Roles' y que su rol esté arriba en la jerarquía.",
    };
  }
}

export interface AssignAllRolesResult {
  assigned: string[];
  errors: string[];
}

export async function assignAllRoles(discordId: string, guildId: string): Promise<{ success: boolean; message?: string } & Partial<AssignAllRolesResult>> {
  const client = getClient();
  if (!client) return { success: false, message: "Discord client not ready" };

  const ranks = await prisma.rank.findMany({ where: { guildId }, orderBy: { requiredXp: "asc" } });
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { success: false, message: "Guild not found" };

  let member;
  try { member = await guild.members.fetch(discordId); }
  catch { return { success: false, message: "Miembro no encontrado" }; }

  const assigned: string[] = [];
  const errors: string[] = [];

  for (const rank of ranks) {
    if (!rank.discordRoleId) continue;
    try {
      const role = guild.roles.cache.get(rank.discordRoleId);
      if (role) {
        await member.roles.add(role);
        assigned.push(rank.name);
      }
    } catch {
      logger.warn(`Failed to assign role ${rank.name} to ${discordId}`);
      errors.push(rank.name);
    }
  }

  return { success: true, assigned, errors };
}

export async function removeRoles(discordId: string, guildId: string): Promise<{ success: boolean; message?: string } & { removed?: string[]; errors?: string[] }> {
  const client = getClient();
  if (!client) return { success: false, message: "Discord client not ready" };

  const ranks = await prisma.rank.findMany({ where: { guildId }, orderBy: { requiredXp: "asc" } });
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { success: false, message: "Guild not found" };

  let member;
  try { member = await guild.members.fetch(discordId); }
  catch { return { success: false, message: "Miembro no encontrado" }; }

  const removed: string[] = [];
  const errors: string[] = [];

  for (const rank of ranks) {
    if (!rank.discordRoleId) continue;
    try {
      const role = guild.roles.cache.get(rank.discordRoleId);
      if (role && member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        removed.push(rank.name);
      }
    } catch {
      logger.warn(`Failed to remove role ${rank.name} from ${discordId}`);
      errors.push(rank.name);
    }
  }

  return { success: true, removed, errors };
}

export interface ResetXpResult {
  count: number;
}

export async function resetXp(guildId: string, userId?: string): Promise<ResetXpResult> {
  const result = await prisma.user.updateMany({
    where: { guildId },
    data: { xp: 0n, level: 1, rankId: null },
  });

  await createLog({
    action: "XP_RESET",
    entity: "user",
    entityId: "all",
    userId: userId || "unknown",
    guildId,
    details: `XP reiniciado para ${result.count} usuarios`,
  }).catch((err) => logger.error("Failed to log XP reset", { error: String(err) }));

  return { count: result.count };
}
