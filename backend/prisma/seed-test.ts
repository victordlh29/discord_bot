import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Inline de calculateLevel para evitar dependencias del source
function calculateLevel(xp: bigint): number {
  const maxSafe = BigInt(10) ** BigInt(15);
  const clampedXp = xp > maxSafe ? maxSafe : xp;
  return Math.floor(Math.sqrt(Number(clampedXp / BigInt(100)))) + 1;
}

const guildId = process.env.DISCORD_GUILD_ID || "default";

const testRanks: { name: string; requiredXp: bigint; color: string; position: number; gifUrl?: string }[] = [
  { name: "🟢 Novato", requiredXp: BigInt(10), color: "#2ECC71", position: 1 },
  { name: "🔵 Aprendiz", requiredXp: BigInt(50), color: "#3498DB", position: 2 },
  { name: "🟣 Experto", requiredXp: BigInt(100), color: "#9B59B6", position: 3 },
  { name: "🟠 Maestro", requiredXp: BigInt(200), color: "#E67E22", position: 4 },
  { name: "🔴 Leyenda", requiredXp: BigInt(500), color: "#E74C3C", position: 5 },
  { name: "🛡️ Dios", requiredXp: BigInt(1000), color: "#F1C40F", position: 6 },
];

const testMissions: { name: string; type: string; objective: string; reward: number; frequency: "DAILY" | "WEEKLY" | "MONTHLY" }[] = [
  { name: "Primer mensaje", type: "send_messages", objective: "1", reward: 500, frequency: "DAILY" },
  { name: "Habla 5 veces", type: "send_messages", objective: "5", reward: 100, frequency: "DAILY" },
  { name: "Gana 50 XP", type: "xp_earned", objective: "50", reward: 100, frequency: "WEEKLY" },
  { name: "Gana 200 XP", type: "xp_earned", objective: "200", reward: 300, frequency: "WEEKLY" },
  { name: "Sube de nivel", type: "level_up", objective: "1", reward: 500, frequency: "WEEKLY" },
  { name: "Chatea 30 mensajes", type: "send_messages", objective: "30", reward: 200, frequency: "WEEKLY" },
  { name: "Acumula 1000 XP", type: "xp_earned", objective: "1000", reward: 800, frequency: "MONTHLY" },
  { name: "Conectate a diario", type: "daily_login", objective: "5", reward: 150, frequency: "MONTHLY" },
  { name: "Voz 10 minutos", type: "voice_minutes", objective: "10", reward: 150, frequency: "DAILY" },
  { name: "Voz 60 minutos", type: "voice_minutes", objective: "60", reward: 400, frequency: "WEEKLY" },
];

const missionTypeLabels: Record<string, string> = {
  send_messages: "mensajes",
  xp_earned: "XP ganados",
  level_up: "subida de nivel",
  daily_login: "inicios de sesión",
  voice_minutes: "minutos en voz",
};

async function main() {
  console.log(`🌱 Seeding test data for guild: ${guildId}\n`);

  // ── Test Ranks ──────────────────────────────────────────────
  console.log("📊 Creating/updating test ranks...");
  for (const rank of testRanks) {
    await prisma.rank.upsert({
      where: { name_guildId: { name: rank.name, guildId } },
      update: { requiredXp: rank.requiredXp, color: rank.color, position: rank.position },
      create: { ...rank, guildId },
    });
    console.log(`  ✅ ${rank.name} — ${rank.requiredXp.toString()} XP`);
  }

  // ── Test Missions ──────────────────────────────────────────
  console.log("\n📋 Creating test missions (skipping existing)...");
  let createdCount = 0;
  let skippedCount = 0;

  for (const mission of testMissions) {
    const exists = await prisma.mission.findFirst({
      where: { name: mission.name, guildId },
      select: { id: true },
    });

    if (exists) {
      console.log(`  ⏭️  ${mission.name} — ya existe`);
      skippedCount++;
      continue;
    }

    await prisma.mission.create({ data: { ...mission, guildId } });

    const obj = parseInt(mission.objective, 10);
    const label = missionTypeLabels[mission.type] || mission.type;
    const qty = obj > 1 ? `${obj} ${label}` : `1 ${label.slice(0, -1)}`;
    const rewardStr = mission.reward >= 500 ? `💰 ${mission.reward} XP (rank-up!)` : `${mission.reward} XP`;
    console.log(`  ✅ ${mission.name} — ${qty} → ${rewardStr}`);
    createdCount++;
  }

  // ── Initialize progress for existing users ──
  const users = await prisma.user.findMany({
    where: { guildId },
    select: { id: true, xp: true, voiceTime: true },
  });

  if (users.length > 0 && createdCount > 0) {
    console.log(`\n👤 Initializing mission progress for ${users.length} existing users...`);
    const allMissions = await prisma.mission.findMany({
      where: { guildId },
    });

    const now = new Date();
    let progressCreated = 0;

    for (const user of users) {
      for (const mission of allMissions) {
        const existing = await prisma.userMissionProgress.findUnique({
          where: { userId_missionId: { userId: user.id, missionId: mission.id } },
        });
        if (existing) continue;

        let initialProgress = 0;
        let isCompleted = false;

        if (mission.type === "xp_earned") {
          initialProgress = Math.min(Number(user.xp), parseInt(mission.objective, 10) || 0);
          isCompleted = initialProgress >= (parseInt(mission.objective, 10) || 0);
        } else if (mission.type === "voice_minutes") {
          initialProgress = Math.min(user.voiceTime, parseInt(mission.objective, 10) || 0);
          isCompleted = initialProgress >= (parseInt(mission.objective, 10) || 0);
        }

        await prisma.userMissionProgress.create({
          data: {
            userId: user.id,
            missionId: mission.id,
            guildId,
            progress: initialProgress,
            completed: isCompleted,
            completedAt: isCompleted ? now : null,
            resetAt: isCompleted ? (mission.frequency === "UNICA" ? null : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)) : null,
          },
        });
        progressCreated++;

        // Dar reward si se completa inmediatamente
        if (isCompleted && mission.reward > 0) {
          const newXp = BigInt(Number(user.xp) + mission.reward);
          const newLevel = calculateLevel(newXp);
          await prisma.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: user.id },
              data: {
                xp: { increment: BigInt(mission.reward) },
                level: newLevel,
              },
            });
            await tx.xpLog.create({
              data: {
                userId: user.id,
                xpAmount: BigInt(mission.reward),
                reason: `seed:${mission.id}`,
                guildId,
              },
            });
          });
          console.log(`  🎁 ${initialProgress}/${mission.objective} → ${mission.reward} XP para usuario ${user.id}`);
        } else {
          console.log(`  📊 ${initialProgress}/${mission.objective} para usuario ${user.id}`);
        }
      }
    }

    console.log(`   ${progressCreated} progress entries initialized`);
  } else if (users.length === 0) {
    console.log(`\n👤 No existing users to initialize progress for.`);
  } else {
    console.log(`\n👤 No new missions to initialize.`);
  }

  console.log(`\n🎉 Test seed complete!`);
  console.log(`   ${testRanks.length} ranks upserted`);
  console.log(`   ${createdCount} missions created, ${skippedCount} skipped (already exist)`);
  console.log(`   Users initialized: ${users.length}`);
  console.log(`\n💡 Tip: Send a message to complete "Primer mensaje" and get 500 XP — enough to reach 🟢 Novato (10 XP), 🔵 Aprendiz (50 XP) and 🟣 Experto (100 XP)!`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
