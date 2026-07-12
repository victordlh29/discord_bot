import { Request, Response } from "express";
import { EventEmitter } from "events";

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

const sseConnectionCount = new Map<string, number>();
const MAX_SSE_CONNECTIONS_PER_USER = 5;

export function subscribeToSSE(req: Request & { user?: { userId?: string } }, res: Response): void {
  const guildId = req.query.guildId as string;
  if (!guildId) {
    res.status(400).json({ status: "error", message: "guildId required" });
    return;
  }

  const userId = req.user?.userId || "anonymous";
  const currentCount = sseConnectionCount.get(userId) || 0;
  if (currentCount >= MAX_SSE_CONNECTIONS_PER_USER) {
    res.status(429).json({ status: "error", message: "Demasiadas conexiones SSE activas. Límite: 5 por usuario." });
    return;
  }
  sseConnectionCount.set(userId, currentCount + 1);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write(`data: ${JSON.stringify({ type: "connected", guildId })}\n\n`);

  const onProgress = (data: { guildId: string; missionId: string; discordId: string }) => {
    if (data.guildId === guildId) {
      res.write(`data: ${JSON.stringify({ type: "mission_progress", ...data })}\n\n`);
    }
  };

  const onMissionUpdate = (data: { guildId: string }) => {
    if (data.guildId === guildId) {
      res.write(`data: ${JSON.stringify({ type: "mission_update", ...data })}\n\n`);
    }
  };

  emitter.on("mission_progress", onProgress);
  emitter.on("mission_update", onMissionUpdate);

  const keepAlive = setInterval(() => {
    res.write(`:keepalive\n\n`);
  }, 15_000);

  req.on("close", () => {
    emitter.off("mission_progress", onProgress);
    emitter.off("mission_update", onMissionUpdate);
    clearInterval(keepAlive);
    const count = sseConnectionCount.get(userId) || 1;
    if (count <= 1) {
      sseConnectionCount.delete(userId);
    } else {
      sseConnectionCount.set(userId, count - 1);
    }
  });
}

export function emitMissionProgress(guildId: string, missionId: string, discordId: string): void {
  emitter.emit("mission_progress", { guildId, missionId, discordId });
}

export function emitMissionUpdate(guildId: string): void {
  emitter.emit("mission_update", { guildId });
}
