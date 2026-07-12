import { Request } from "express";

export interface AuthPayload {
  userId: string;
  discordId: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  adminGuildId: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}


