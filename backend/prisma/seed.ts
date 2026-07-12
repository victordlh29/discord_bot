import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const guildId = process.env.DISCORD_GUILD_ID || "default";

const defaultSettings: { key: string; value: string }[] = [
  { key: "xp_min_per_message", value: "5" },
  { key: "xp_max_per_message", value: "25" },
  { key: "xp_per_voice_minute", value: "2" },
  { key: "message_cooldown_seconds", value: "60" },
  { key: "voice_cooldown_seconds", value: "300" },
  { key: "global_multiplier", value: "1.0" },
  { key: "voice_min_users", value: "2" },
  { key: "voice_check_interval_minutes", value: "5" },
  { key: "antispam_min_length", value: "5" },
  { key: "season_active", value: "false" },
  { key: "season_name", value: "" },
  { key: "prestige_enabled", value: "false" },
  { key: "prestige_multiplier", value: "1.0" },
  { key: "xp_rule_5_20", value: "5" },
  { key: "xp_rule_21_50", value: "10" },
  { key: "xp_rule_51_100", value: "15" },
  { key: "xp_rule_101_200", value: "20" },
  { key: "xp_rule_200_plus", value: "25" },
  { key: "xp_text_channels", value: "" },
  { key: "xp_voice_channels", value: "" },
  { key: "missions_announce_channel", value: "" },
  { key: "events_announce_channel", value: "" },
  { key: "ranks_announce_channel", value: "" },
  { key: "allowed_dashboard_roles", value: "" },
  { key: "blocked_words", value: "" },
  { key: "xp_bracket_1_min", value: "5" },
  { key: "xp_bracket_1_max", value: "20" },
  { key: "xp_bracket_2_min", value: "21" },
  { key: "xp_bracket_2_max", value: "50" },
  { key: "xp_bracket_3_min", value: "51" },
  { key: "xp_bracket_3_max", value: "100" },
  { key: "xp_bracket_4_min", value: "101" },
  { key: "xp_bracket_4_max", value: "200" },
  { key: "xp_bracket_5_min", value: "201" },
];

const defaultRanks: { name: string; requiredXp: bigint; color: string; position: number; gifUrl?: string }[] = [
  { name: "⚪ Mago Blanco", requiredXp: BigInt(5000), color: "#FFFFFF", position: 1 },
  { name: "🟣 Mago Oscuro", requiredXp: BigInt(15000), color: "#9B59B6", position: 2 },
  { name: "🟢 Mago Mítico", requiredXp: BigInt(35000), color: "#2ECC71", position: 3 },
  { name: "🔴 Mago Divino", requiredXp: BigInt(70000), color: "#E74C3C", position: 4 },
  { name: "🔵 Seres Míticos", requiredXp: BigInt(120000), color: "#3498DB", position: 5 },
  { name: "🛡️ Semi Dioses", requiredXp: BigInt(200000), color: "#F1C40F", position: 6 },
];

async function main() {
  console.log("Seeding database for guild:", guildId);

  // ── Settings que los usuarios configuran desde el dashboard — preservar si ya existen ──
  const PROTECTED_KEYS = [
    "allowed_dashboard_roles",
    "xp_text_channels",
    "xp_voice_channels",
    "blocked_words",
    "missions_announce_channel",
    "events_announce_channel",
    "ranks_announce_channel",
    "season_name",
    "xp_bracket_1_min",
    "xp_bracket_1_max",
    "xp_bracket_2_min",
    "xp_bracket_2_max",
    "xp_bracket_3_min",
    "xp_bracket_3_max",
    "xp_bracket_4_min",
    "xp_bracket_4_max",
    "xp_bracket_5_min",
  ];

  // ── Proteger settings existentes (los que YA ESTÁN en la DB no se sobrescriben) ──
  const preservedKeys = new Set<string>();
  for (const key of PROTECTED_KEYS) {
    const existing = await prisma.setting.findUnique({
      where: { key_guildId: { key, guildId } },
    });
    if (existing) {
      console.log(`  ⏭️  Preserving ${key} (already configured, skipping reset)`);
      preservedKeys.add(key);
    }
  }

  // ── Upsert del resto de settings (los que no se preservaron) en paralelo ──
  await Promise.all(
    defaultSettings
      .filter((s) => !preservedKeys.has(s.key))
      .map((setting) =>
        prisma.setting.upsert({
          where: { key_guildId: { key: setting.key, guildId } },
          update: { value: setting.value },
          create: { ...setting, guildId },
        })
      )
  );
  console.log("Settings created.");

  await Promise.all(defaultRanks.map((rank) =>
    prisma.rank.upsert({
      where: { name_guildId: { name: rank.name, guildId } },
      update: { requiredXp: rank.requiredXp, color: rank.color, position: rank.position },
      create: { ...rank, guildId },
    })
  ));
  console.log("Ranks created.");

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
