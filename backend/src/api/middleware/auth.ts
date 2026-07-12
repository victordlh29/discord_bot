import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest, AuthPayload } from "../../types";
import { logger } from "../../core/utils/logger";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "stanplaya-jwt-secret-dev") {
    logger.error("JWT_SECRET no está configurado o usa el valor por defecto");
    throw new Error("JWT_SECRET no configurado");
  }
  return secret;
}

export function extractToken(req: AuthRequest): string | null {
  // 1. Intentar con Bearer header (compatibilidad con clientes que aún lo usen)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  // 2. Fallback: cookie HttpOnly 'token'
  if (req.cookies?.token) {
    return req.cookies.token;
  }
  return null;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ status: "error", message: "No token provided" });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    logger.warn("Invalid JWT token");
    res.status(401).json({ status: "error", message: "Invalid token" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ status: "error", message: "Admin access required" });
    return;
  }
  next();
}

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user?.isSuperAdmin) {
    res.status(403).json({ status: "error", message: "Super admin access required" });
    return;
  }
  next();
}
