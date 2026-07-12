import { Router, Response } from "express";
import { AuthRequest } from "../../types";
import { resolveGuildId } from "../../core/utils/guild";
import { requireSuperAdmin } from "../middleware/auth";
import { isValidSnowflake } from "../../core/utils/helpers";
import {
  getUsers,
  getUser,
  assignRole,
  assignAllRoles,
  removeRoles,
  resetXp,
} from "../../modules/users/service";

const router = Router();

router.get("/", async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 50));
  const search = req.query.search as string | undefined;

  const result = await getUsers(guildId, page, limit, search);
  res.json({
    status: "success",
    data: result.users,
    pagination: result.pagination,
  });
});

router.get("/:discordId", async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const discordId = req.params.discordId as string;

  if (!isValidSnowflake(discordId)) {
    res.status(400).json({ status: "error", message: "discordId inválido" });
    return;
  }

  const user = await getUser(discordId, guildId);

  if (!user) {
    res.status(404).json({ status: "error", message: "User not found" });
    return;
  }
  res.json({ status: "success", data: user });
});

router.post("/:discordId/assign-role", requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const discordId = req.params.discordId as string;

  if (!isValidSnowflake(discordId)) {
    res.status(400).json({ status: "error", message: "discordId inválido" });
    return;
  }

  const result = await assignRole(discordId, guildId);
  if (!result.success) {
    res.status(result.message?.includes("Discord client") ? 503 : 400).json({ status: "error", message: result.message });
    return;
  }

  res.json({
    status: "success",
    message: result.message,
    data: { rank: result.rank, member: result.member },
  });
});

router.post("/:discordId/assign-all-roles", requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const discordId = req.params.discordId as string;

  if (!isValidSnowflake(discordId)) {
    res.status(400).json({ status: "error", message: "discordId inválido" });
    return;
  }

  const result = await assignAllRoles(discordId, guildId);
  if (!result.success) {
    const status = result.message?.includes("Discord client") ? 503 : 400;
    res.status(status).json({ status: "error", message: result.message });
    return;
  }

  res.json({
    status: "success",
    message: `Roles asignados: ${result.assigned?.length || 0}. Errores: ${result.errors?.length || 0}.`,
    data: { assigned: result.assigned, errors: result.errors },
  });
});

router.post("/:discordId/remove-roles", requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const discordId = req.params.discordId as string;

  if (!isValidSnowflake(discordId)) {
    res.status(400).json({ status: "error", message: "discordId inválido" });
    return;
  }

  const result = await removeRoles(discordId, guildId);
  if (!result.success) {
    const status = result.message?.includes("Discord client") ? 503 : 400;
    res.status(status).json({ status: "error", message: result.message });
    return;
  }

  res.json({
    status: "success",
    message: `Roles eliminados: ${result.removed?.length || 0}. Errores: ${result.errors?.length || 0}.`,
    data: { removed: result.removed, errors: result.errors },
  });
});

router.post("/reset-xp", requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const result = await resetXp(guildId, req.user?.discordId);

  res.json({
    status: "success",
    message: `XP reiniciado para ${result.count} usuarios. Los rangos y roles de Discord no se modifican automáticamente.`,
    data: { count: result.count },
  });
});

export default router;
