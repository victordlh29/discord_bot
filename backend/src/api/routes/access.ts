import { Router, Response } from "express";
import prisma from "../../core/database/prisma";
import { AuthRequest } from "../../types";
import { getClient } from "../../core/utils/client";
import { resolveGuildId } from "../../core/utils/guild";
import { requireAdmin } from "../middleware/auth";
import { logger } from "../../core/utils/logger";

const router = Router();

interface RoleInfo {
  id: string;
  name: string;
  color: string;
}

interface MemberInfo {
  discordId: string;
  username: string;
  displayName: string;
  roles: string[];
}

interface AccessStatus {
  allowedRoles: RoleInfo[];
  membersWithAccess: MemberInfo[];
  totalMembers: number;
  serverOwnerId: string;
  guildId: string;
  guildName: string;
}

router.get("/status", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const client = getClient();

    if (!client) {
      res.status(503).json({ status: "error", message: "Discord client not ready" });
      return;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      res.status(404).json({ status: "error", message: "Guild not found" });
      return;
    }

    // 1. Obtener roles permitidos desde la DB
    const setting = await prisma.setting.findUnique({
      where: { key_guildId: { key: "allowed_dashboard_roles", guildId } },
    });
    const allowedRoleIds = setting?.value
      ? setting.value.split(",").filter(Boolean)
      : [];

    // 2. Obtener info de esos roles desde Discord
    const allowedRoles: RoleInfo[] = [];
    for (const roleId of allowedRoleIds) {
      const role = guild.roles.cache.get(roleId);
      if (role) {
        allowedRoles.push({
          id: role.id,
          name: role.name,
          color: role.hexColor,
        });
      } else {
        allowedRoles.push({ id: roleId, name: "(rol eliminado)", color: "#666666" });
      }
    }

    // 3. Obtener miembros con roles permitidos (usando role.members para eficiencia)
    const ownerId = guild.ownerId;
    const seenIds = new Set<string>();
    const membersWithAccess: MemberInfo[] = [];

    // Siempre incluir al dueño
    seenIds.add(ownerId);
    try {
      const owner = await guild.members.fetch(ownerId);
      membersWithAccess.push({
        discordId: owner.id,
        username: owner.user.username,
        displayName: owner.displayName,
        roles: [],
      });
    } catch {
      membersWithAccess.push({
        discordId: ownerId,
        username: "(desconocido)",
        displayName: "Dueño",
        roles: [],
      });
    }

    // Iterar sobre cada rol permitido y obtener sus miembros
    for (const roleId of allowedRoleIds) {
      const role = guild.roles.cache.get(roleId);
      if (!role) continue;

      for (const [, member] of role.members) {
        if (seenIds.has(member.id)) continue;
        seenIds.add(member.id);

        membersWithAccess.push({
          discordId: member.id,
          username: member.user.username,
          displayName: member.displayName,
          roles: member.roles.cache
            .filter((r) => r.name !== "@everyone" && allowedRoleIds.includes(r.id))
            .map((r) => r.name),
        });
      }
    }

    // Ordenar por username
    membersWithAccess.sort((a, b) => a.username.localeCompare(b.username));

    res.json({
      status: "success",
      data: {
        allowedRoles,
        membersWithAccess,
        totalMembers: guild.members.cache.size,
        serverOwnerId: ownerId,
        guildId: guild.id,
        guildName: guild.name,
      } satisfies AccessStatus,
    });
  } catch (err) {
    logger.error("Error fetching access status", { error: String(err) });
    res.status(500).json({ status: "error", message: "Error al obtener el estado de acceso" });
  }
});

export default router;
