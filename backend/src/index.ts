import "dotenv/config";
import app from "./app";
import { createBot, startBot } from "./bot";
import { autoEndExpiredEvents } from "./modules/events/autoEnd";
import { processActiveVoiceSessions } from "./modules/voice/service";
import { checkAndResetMissions } from "./modules/missions/service";
import { cleanupExpiredTokens } from "./modules/auth/refreshTokens";
import { logger } from "./core/utils/logger";

const PORT = process.env.API_PORT || 4000;

async function main(): Promise<void> {
  const bot = await createBot();

  app.listen(PORT, () => {
    logger.info(`API server running on port ${PORT}`);
    if (process.env.SWAGGER_ENABLED === "true") {
      logger.info(`Swagger docs at http://localhost:${PORT}/api-docs`);
    }
  });

  await startBot(bot);

  autoEndExpiredEvents().catch((err) =>
    logger.error("Auto-end events initial check failed", { error: String(err) })
  );

  setInterval(() => {
    autoEndExpiredEvents().catch((err) =>
      logger.error("Auto-end events check failed", { error: String(err) })
    );
  }, 10_000);
  logger.info("Auto-end events checker started (every 10s)");

  setInterval(() => {
    processActiveVoiceSessions().catch((err) =>
      logger.error("Voice session cleanup failed", { error: String(err) })
    );
  }, 60_000);
  logger.info("Voice session cleanup started (every 60s)");

  setInterval(() => {
    checkAndResetMissions().catch((err) =>
      logger.error("Mission reset check failed", { error: String(err) })
    );
  }, 60_000);
  logger.info("Mission reset checker started (every 60s)");

  setInterval(() => {
    cleanupExpiredTokens().catch((err) =>
      logger.error("Expired token cleanup failed", { error: String(err) })
    );
  }, 3600_000);
  logger.info("Expired refresh token cleanup started (every 60min)");
}

main().catch((error) => {
  logger.error("Failed to start application", { error: String(error) });
  process.exit(1);
});
