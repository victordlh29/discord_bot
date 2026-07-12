import { Router, Response } from "express";
import jwt from "jsonwebtoken";
import { subscribeToSSE } from "../../core/utils/sse";
import { AuthRequest, AuthPayload } from "../../types";
import { logger } from "../../core/utils/logger";
import { extractToken } from "../middleware/auth";

const router = Router();

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "stanplaya-jwt-secret-dev") {
    logger.error("JWT_SECRET no está configurado o usa el valor por defecto");
    throw new Error("JWT_SECRET no configurado");
  }
  return secret;
}

router.get("/missions", (req: AuthRequest, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ status: "error", message: "No token" });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthPayload;
    req.user = decoded;
    subscribeToSSE(req, res);
  } catch (err) {
    logger.warn("SSE auth failed", { error: String(err) });
    if (!res.headersSent) {
      res.status(401).json({ status: "error", message: "Token inválido" });
    }
  }
});

export default router;
