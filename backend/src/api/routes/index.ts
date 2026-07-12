import { Router } from "express";
import settingsRoutes from "./settings";
import ranksRoutes from "./ranks";
import eventsRoutes from "./events";
import missionsRoutes from "./missions";
import cosmeticsRoutes from "./cosmetics";
import logsRoutes from "./logs";
import usersRoutes from "./users";
import leaderboardRoutes from "./leaderboard";
import authRoutes from "./auth";
import statsRoutes from "./stats";
import rolesRoutes from "./roles";
import channelsRoutes from "./channels";
import guildsRoutes from "./guilds";
import sseRoutes from "./sse";
import accessRoutes from "./access";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use("/auth", authRoutes);
router.use("/sse", sseRoutes);
router.use("/guilds", guildsRoutes);
router.use("/settings", authenticate, settingsRoutes);
router.use("/ranks", authenticate, ranksRoutes);
router.use("/events", authenticate, eventsRoutes);
router.use("/missions", authenticate, missionsRoutes);
router.use("/cosmetics", authenticate, cosmeticsRoutes);
router.use("/logs", authenticate, logsRoutes);
router.use("/users", authenticate, usersRoutes);
router.use("/leaderboard", authenticate, leaderboardRoutes);
router.use("/stats", authenticate, statsRoutes);
router.use("/roles", authenticate, rolesRoutes);
router.use("/channels", authenticate, channelsRoutes);
router.use("/access", authenticate, accessRoutes);

export default router;
