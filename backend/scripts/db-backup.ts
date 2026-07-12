import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  const backupDir = path.join(__dirname, "..", "backups");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(backupDir, `backup-${timestamp}`);

  fs.mkdirSync(dir, { recursive: true });

  console.log(`💾 Backup directory: ${dir}\n`);

  const models = [
    { name: "settings", data: () => prisma.setting.findMany() },
    { name: "ranks", data: () => prisma.rank.findMany() },
    { name: "events", data: () => prisma.event.findMany() },
    { name: "missions", data: () => prisma.mission.findMany() },
    { name: "cosmetics", data: () => prisma.cosmetic.findMany() },
    { name: "users", data: () => prisma.user.findMany() },
    { name: "voice_sessions", data: () => prisma.voiceSession.findMany() },
    { name: "xp_logs", data: () => prisma.xpLog.findMany() },
    { name: "message_logs", data: () => prisma.messageLog.findMany() },
    { name: "mission_progress", data: () => prisma.userMissionProgress.findMany() },
    { name: "music_queue", data: () => prisma.musicQueueItem.findMany() },
    { name: "logs", data: () => prisma.log.findMany() },
  ];

  for (const model of models) {
    const records = await model.data();
    const filePath = path.join(dir, `${model.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(records, (key, value) =>
      typeof value === "bigint" ? value.toString() : value, 2));
    console.log(`  ✅ ${model.name}: ${records.length} registros`);
  }

  console.log(`\n🎉 Backup completado: ${dir}`);
}

main()
  .catch((e) => {
    console.error("❌ Backup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
