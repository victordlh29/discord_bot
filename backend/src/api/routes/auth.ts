import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../../core/database/prisma";
import { getClient } from "../../core/utils/client";
import { AuthPayload } from "../../types";
import { logger } from "../../core/utils/logger";
import { isValidSnowflake } from "../../core/utils/helpers";
import { verifyPassword, isBcryptHash } from "../../core/utils/password";
import { loginProtector } from "../../core/utils/loginProtector";
import { extractToken } from "../middleware/auth";
import {
  signAccessToken,
  createRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} from "../../modules/auth/refreshTokens";

const router = Router();

// ── Helpers de cookie ────────────────────────────────────
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
};

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth", // Solo se envía a endpoints de auth (más seguro)
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
};

function setTokenCookie(res: Response, token: string): void {
  res.cookie("token", token, COOKIE_OPTIONS);
}

function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie("refreshToken", token, REFRESH_COOKIE_OPTIONS);
}

function clearAuthCookies(res: Response): void {
  res.clearCookie("token", { path: "/" });
  res.clearCookie("refreshToken", { path: "/api/auth" });
}

// ──────────────────────────────────────────────────────────

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "stanplaya-jwt-secret-dev") {
    logger.error("JWT_SECRET no está configurado o usa el valor por defecto. Configúralo en .env");
    throw new Error("JWT_SECRET no configurado");
  }
  return secret;
}

function getApiKey(): string {
  const key = process.env.API_KEY;
  if (!key) {
    logger.error("API_KEY no está configurada. Debe coincidir entre backend y dashboard.");
    throw new Error("API_KEY no configurada");
  }
  return key;
}

async function getUserAdminStatus(discordId: string): Promise<{ isAdmin: boolean; guildId: string | null; isSuperAdmin: boolean }> {
  try {
    const client = getClient();
    if (!client) return { isAdmin: false, guildId: null, isSuperAdmin: false };

    const guilds = Array.from(client.guilds.cache.entries());
    type MemberEntry = { guildId: string; member: import("discord.js").GuildMember };
    const memberResults = await Promise.allSettled(
      guilds.map(([guildId, guild]) =>
        guild.members.fetch(discordId).then((member) => ({ guildId, member }))
      )
    );

    const validEntries: MemberEntry[] = [];
    for (const result of memberResults) {
      if (result.status === "fulfilled") validEntries.push(result.value);
    }

    if (validEntries.length === 0) {
      return { isAdmin: false, guildId: null, isSuperAdmin: false };
    }

    // 👑 El propietario del servidor siempre tiene acceso
    for (const { guildId, member } of validEntries) {
      if (member.id === member.guild.ownerId) {
        logger.info(`👑 Owner access granted: discordId=${discordId} guildId=${guildId}`);
        return { isAdmin: true, guildId, isSuperAdmin: false };
      }
    }

    // ── Verificar roles permitidos desde la DB (configurados en el dashboard) ──
    const allowedSettings = await Promise.all(
      validEntries.map(({ guildId }) =>
        prisma.setting.findUnique({
          where: { key_guildId: { key: "allowed_dashboard_roles", guildId } },
        }).then((s) => ({ guildId, allowedRoles: s?.value ? s.value.split(",").filter(Boolean) : [] }))
      )
    );
    const allowedMap = new Map(allowedSettings.map((s) => [s.guildId, new Set(s.allowedRoles)]));

    for (const { guildId, member } of validEntries) {
      const memberRoleIds = new Set(member.roles.cache.map((r) => r.id));

      const allowedRolesSet = allowedMap.get(guildId);
      if (allowedRolesSet && allowedRolesSet.size > 0) {
        for (const roleId of allowedRolesSet) {
          if (memberRoleIds.has(roleId)) {
            return { isAdmin: true, guildId, isSuperAdmin: false };
          }
        }
      }
    }

    return { isAdmin: false, guildId: null, isSuperAdmin: false };
  } catch (err) {
    logger.error(`Error checking roles for ${discordId}`, { error: String(err) });
    return { isAdmin: false, guildId: null, isSuperAdmin: false };
  }
}

router.post("/login", async (req: Request, res: Response) => {
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey || apiKey !== getApiKey()) {
    res.status(401).json({ status: "error", message: "Acceso no autorizado" });
    return;
  }

  const { discordId, username, avatar } = req.body;

  if (!discordId) {
    res.status(400).json({ status: "error", message: "discordId is required" });
    return;
  }

  if (!isValidSnowflake(discordId)) {
    res.status(400).json({ status: "error", message: "discordId inválido" });
    return;
  }

  const { isAdmin, guildId, isSuperAdmin } = await getUserAdminStatus(discordId);
  logger.debug(`Login attempt: discordId=${discordId} isAdmin=${isAdmin} guildId=${guildId}`);

  if (!isAdmin || !guildId) {
    res.status(403).json({ status: "error", message: "No tienes permiso para acceder al dashboard" });
    return;
  }

  const user = await prisma.user.upsert({
    where: { discordId_guildId: { discordId, guildId } },
    update: { username, avatar },
    create: { discordId, username, avatar, guildId },
  });

  const payload: AuthPayload = {
    userId: user.id,
    discordId: user.discordId,
    isAdmin,
    isSuperAdmin,
    adminGuildId: guildId,
  };

  const token = signAccessToken(payload);
  const refreshToken = await createRefreshToken(payload);

  setTokenCookie(res, token);
  setRefreshTokenCookie(res, refreshToken);

  res.json({
    status: "success",
    data: { token, user: { ...user, xp: user.xp.toString() } },
  });
});

router.post("/admin-login", async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";

  // Verificar bloqueo por IP
  if (loginProtector.isBlocked(ip)) {
    const remaining = loginProtector.getBlockTimeRemaining(ip);
    const minutes = Math.ceil(remaining / 60);
    logger.warn(`🔒 Intento de login bloqueado desde IP: ${ip} (${remaining}s restantes)`);
    res.status(429).json({
      status: "error",
      message: `Demasiados intentos fallidos. IP bloqueada por ${minutes} minuto(s).`,
    });
    return;
  }

  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ status: "error", message: "Usuario y contraseña requeridos" });
    return;
  }

  const adminUser = process.env.SUPERADMIN_USER;
  const adminPass = process.env.SUPERADMIN_PASSWORD;

  if (username !== adminUser) {
    loginProtector.recordFailure(ip);
    logger.warn(`Intento de login con usuario incorrecto desde IP: ${ip} (${loginProtector.getRemainingAttempts(ip)} intentos restantes)`);
    res.status(401).json({ status: "error", message: "Credenciales inválidas" });
    return;
  }

  // ── Diagnóstico ──────────────────────────────────────
  const isHash = !!(adminPass && isBcryptHash(adminPass));
  const passPreview = adminPass
    ? adminPass.substring(0, Math.min(adminPass.length, 15)) + "..."
    : "(VACÍO)";
  logger.info(`🔍 SUPERADMIN_PASSWORD: tipo=${isHash ? "bcrypt" : "texto_plano"} valor="${passPreview}" longitud=${adminPass?.length || 0}`);

  let passwordValid = false;
  if (adminPass && isHash) {
    passwordValid = await verifyPassword(password, adminPass);
    logger.info(`🔍 bcrypt.compare("${password}", "${passPreview}") = ${passwordValid}`);
    if (!passwordValid) {
      loginProtector.recordFailure(ip);
      logger.warn(`Contraseña incorrecta para admin desde IP: ${ip} (${loginProtector.getRemainingAttempts(ip)} intentos restantes)`);
      res.status(401).json({ status: "error", message: "Credenciales inválidas" });
      return;
    }
  } else {
    // Fallback: comparación directa (texto plano) — obsoleto, migrar a bcrypt
    if (!adminPass) {
      logger.error("SUPERADMIN_PASSWORD no está configurada");
      res.status(500).json({ status: "error", message: "Error de configuración del servidor" });
      return;
    }
    logger.warn("SUPERADMIN_PASSWORD está en texto plano. Se recomienda usar un hash de bcrypt. Ejecutá: npx tsx scripts/hash-password.ts");
    if (password !== adminPass) {
      loginProtector.recordFailure(ip);
      logger.warn(`Contraseña incorrecta para admin desde IP: ${ip} (${loginProtector.getRemainingAttempts(ip)} intentos restantes)`);
      res.status(401).json({ status: "error", message: "Credenciales inválidas" });
      return;
    }
  }

  // Login exitoso — resetear contador
  loginProtector.recordSuccess(ip);
  logger.info(`✅ Login de admin exitoso desde IP: ${ip}`);

  const client = getClient();
  const firstGuildId = client?.guilds.cache.first()?.id || "";

  const payload: AuthPayload = {
    userId: "superadmin",
    discordId: "superadmin",
    isAdmin: true,
    isSuperAdmin: true,
    adminGuildId: firstGuildId,
  };

  const token = signAccessToken(payload);
  const refreshToken = await createRefreshToken(payload);

  setTokenCookie(res, token);
  setRefreshTokenCookie(res, refreshToken);

  res.json({
    status: "success",
    data: { token, user: { id: "superadmin", discordId: "superadmin", username: "Super Admin", xp: "0" } },
  });
});

router.post("/verify", async (req: Request, res: Response) => {
  const token = extractToken(req as import("express").Request & { cookies?: Record<string, string> });
  if (!token) {
    res.status(401).json({ status: "error", message: "No token" });
    return;
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthPayload;

    if (decoded.isSuperAdmin) {
      res.json({
        status: "success",
        data: { user: { id: "superadmin", discordId: "superadmin", username: "Super Admin", xp: "0" }, isAdmin: true, isSuperAdmin: true, adminGuildId: decoded.adminGuildId },
      });
      return;
    }

    const { isAdmin, guildId, isSuperAdmin } = await getUserAdminStatus(decoded.discordId);

    if (!isAdmin || !guildId) {
      res.status(403).json({ status: "error", message: "Ya no tienes permisos de administrador" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      res.status(404).json({ status: "error", message: "User not found" });
      return;
    }
    res.json({ status: "success", data: { user: { ...user, xp: user.xp.toString() }, isAdmin, isSuperAdmin, adminGuildId: guildId } });
  } catch {
    // No loguear como warn si el token expiró — es esperado y se maneja con refresh
    logger.debug("Token expirado o inválido durante verify");
    res.status(401).json({ status: "error", message: "Invalid token" });
  }
});

/**
 * POST /auth/refresh
 * Renueva el access token usando el refresh token (HttpOnly cookie).
 * El refresh token tiene path=/api/auth, solo se envía a endpoints de auth.
 */
router.post("/refresh", async (req: Request, res: Response) => {
  const refreshTokenStr = req.cookies?.refreshToken;
  if (!refreshTokenStr) {
    res.status(401).json({ status: "error", message: "No refresh token" });
    return;
  }

  const payload = await validateRefreshToken(refreshTokenStr);
  if (!payload) {
    // Refresh token inválido o expirado — limpiar cookies
    clearAuthCookies(res);
    res.status(401).json({ status: "error", message: "Refresh token inválido o expirado" });
    return;
  }

  try {
    // Revocar el refresh token usado (rotation: cada refresh invalida el anterior)
    await revokeRefreshToken(refreshTokenStr);

    // Emitir nuevos tokens
    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = await createRefreshToken(payload);

    setTokenCookie(res, newAccessToken);
    setRefreshTokenCookie(res, newRefreshToken);

    res.json({
      status: "success",
      data: { token: newAccessToken },
    });
  } catch (err) {
    logger.error("Error en refresh token", { error: String(err) });
    clearAuthCookies(res);
    res.status(500).json({ status: "error", message: "Error al renovar sesión" });
  }
});

/**
 * POST /auth/logout
 * Revoca el refresh token y limpia las cookies.
 */
router.post("/logout", async (req: Request, res: Response) => {
  const refreshTokenStr = req.cookies?.refreshToken;
  if (refreshTokenStr) {
    await revokeRefreshToken(refreshTokenStr).catch(() => {});
  }
  clearAuthCookies(res);
  res.json({ status: "success", message: "Sesión cerrada" });
});

/**
 * POST /auth/logout-all
 * Revoca TODOS los refresh tokens del usuario y cierra sesión en todos los dispositivos.
 * Primero intenta obtener el userId del access token JWT.
 * Si expiró, usa el refresh token como fallback para buscar el userId en DB.
 */
router.post("/logout-all", async (req: Request, res: Response) => {
  let userId: string | null = null;

  // Intentar con access token primero
  const token = extractToken(req as import("express").Request & { cookies?: Record<string, string> });
  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
      userId = decoded.userId;
    } catch {
      // Access token expirado — intentar con refresh token
    }
  }

  // Fallback: usar refresh token para buscar userId en DB
  if (!userId) {
    const refreshTokenStr = req.cookies?.refreshToken;
    if (refreshTokenStr) {
      try {
        const stored = await prisma.refreshToken.findUnique({ where: { token: refreshTokenStr } });
        if (stored && !stored.revoked && stored.expiresAt > new Date()) {
          userId = stored.userId;
        }
      } catch {
        // Error de DB — igual limpiamos cookies
      }
    }
  }

  if (userId) {
    await revokeAllUserTokens(userId);
    logger.info(`🔒 Logout de todos los dispositivos: userId=${userId}`);
  }

  clearAuthCookies(res);
  res.json({ status: "success", message: "Sesión cerrada en todos los dispositivos" });
});

export default router;
