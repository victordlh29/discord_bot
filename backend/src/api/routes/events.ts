import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../core/database/prisma";
import { AuthRequest } from "../../types";
import { requireAdmin } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createLog } from "../../modules/logs/service";
import { announceEvent } from "../../core/utils/announcer";
import { announceEventEnd, invalidateActiveEventsCache } from "../../modules/events/service";
import { resolveGuildId } from "../../core/utils/guild";

const router = Router();
const eventSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["CHAT", "VOICE", "DOUBLE_XP", "MONTHLY"]),
  duration: z.number().int().min(0),
  reward: z.number().int().default(0),
});
const eventUpdateSchema = eventSchema.partial();
type EventInput = z.infer<typeof eventSchema>;
type EventUpdateInput = z.infer<typeof eventUpdateSchema>;

router.get("/", async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const events = await prisma.event.findMany({ where: { guildId }, orderBy: { createdAt: "desc" } });
  res.json({ status: "success", data: events });
});

router.post("/", requireAdmin, validate(eventSchema), async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const data = req.body as EventInput;
  const event = await prisma.event.create({ data: { ...data, guildId } });
  await Promise.all([
    createLog({ action: "EVENT_CREATE", entity: "event", entityId: event.id, userId: req.user?.discordId, details: JSON.stringify(data) }),
    announceEvent("create", event),
  ]);
  res.status(201).json({ status: "success", data: event });
});

router.put("/:id", requireAdmin, validate(eventUpdateSchema), async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const id = req.params.id as string;
  const updates = req.body as EventUpdateInput;
  const event = await prisma.event.update({ where: { id, guildId }, data: updates });
  await createLog({ action: "EVENT_UPDATE", entity: "event", entityId: id, userId: req.user?.discordId, details: JSON.stringify(updates) });
  res.json({ status: "success", data: event });
});

router.delete("/:id", requireAdmin, async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const id = req.params.id as string;
  await prisma.event.delete({ where: { id, guildId } });
  await createLog({
    action: "EVENT_DELETE",
    entity: "event",
    entityId: id,
    userId: req.user?.discordId,
  });
  res.json({ status: "success", message: "Event deleted" });
});

router.put("/:id/activate", requireAdmin, async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const id = req.params.id as string;
  const event = await prisma.event.findUnique({ where: { id, guildId } });
  if (!event) {
    res.status(404).json({ status: "error", message: "Event not found" });
    return;
  }
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + event.duration * 1000);
  const updated = await prisma.event.update({
    where: { id, guildId },
    data: { isActive: true, startsAt, endsAt },
  });
  invalidateActiveEventsCache(guildId);
  await Promise.all([
    createLog({ action: "EVENT_ACTIVATE", entity: "event", entityId: id, userId: req.user?.discordId }),
    announceEvent("activate", updated),
  ]);
  res.json({ status: "success", data: updated });
});

router.put("/:id/deactivate", requireAdmin, async (req: AuthRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const id = req.params.id as string;
  const event = await prisma.event.update({
    where: { id, guildId },
    data: { isActive: false, endsAt: new Date() },
  });
  invalidateActiveEventsCache(guildId);
  await Promise.all([
    createLog({ action: "EVENT_DEACTIVATE", entity: "event", entityId: id, userId: req.user?.discordId }),
    announceEventEnd(event),
  ]);
  res.json({ status: "success", data: event });
});

export default router;
