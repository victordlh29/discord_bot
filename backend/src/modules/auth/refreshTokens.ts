import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../../core/database/prisma";
import { AuthPayload } from "../../types";
import { logger } from "../../core/utils/logger";

const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || "15m";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "stanplaya-jwt-secret-dev") {
    logger.error("JWT_SECRET no configurado");
    throw new Error("JWT_SECRET no configurado");
  }
  return secret;
}

/** Genera un access token JWT de corta duración (15 min) */
export function signAccessToken(payload: AuthPayload): string {
  const secret = getJwtSecret();
  const jwtid = crypto.randomUUID();
  return jwt.sign(payload, secret, { expiresIn: ACCESS_TOKEN_EXPIRY, jwtid } as jwt.SignOptions);
}

/** Genera un refresh token UUID, lo guarda en DB y devuelve el token string */
export async function createRefreshToken(payload: AuthPayload): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await prisma.refreshToken.create({
    data: {
      token,
      userId: payload.userId,
      discordId: payload.discordId,
      guildId: payload.adminGuildId,
      isAdmin: payload.isAdmin,
      isSuperAdmin: payload.isSuperAdmin,
      adminGuildId: payload.adminGuildId,
      expiresAt,
    },
  });

  return token;
}

/** Valida un refresh token, devuelve el payload si es válido, null si no */
export async function validateRefreshToken(token: string): Promise<AuthPayload | null> {
  try {
    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored) return null;
    if (stored.revoked) return null;
    if (stored.expiresAt < new Date()) {
      // Limpiar tokens expirados
      await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
      return null;
    }
    return {
      userId: stored.userId,
      discordId: stored.discordId,
      isAdmin: stored.isAdmin,
      isSuperAdmin: stored.isSuperAdmin,
      adminGuildId: stored.adminGuildId || "",
    };
  } catch {
    return null;
  }
}

/** Revoca un refresh token (logout) */
export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    await prisma.refreshToken.update({
      where: { token },
      data: { revoked: true, revokedAt: new Date() },
    });
  } catch {
    // Token no existe o ya fue revocado
  }
}

/** Revoca TODOS los refresh tokens de un usuario (logout de todos los dispositivos) */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  try {
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
  } catch {
    // ignore
  }
}

/** Limpieza periódica de tokens expirados (ejecutar cada hora) */
export async function cleanupExpiredTokens(): Promise<void> {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      logger.info(`🧹 Limpieza: ${result.count} refresh tokens expirados eliminados`);
    }
  } catch (error) {
    logger.error("Error limpiando refresh tokens expirados", { error: String(error) });
  }
}
