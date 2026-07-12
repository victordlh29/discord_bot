/**
 * Script para generar un hash de bcrypt de una contraseña.
 *
 * Uso:
 *   npx tsx scripts/hash-password.ts <contraseña>
 *
 * Ejemplo:
 *   npx tsx scripts/hash-password.ts MiSuperPassword123
 *
 * Luego copiá el hash generado a .env como SUPERADMIN_PASSWORD
 *
 * ⚠️ IMPORTANTE: El hash contiene caracteres $ (signo de dólar).
 *    En el archivo .env NO uses comillas dobles, solo comillas simples
 *    o directamente sin comillas:
 *
 *    ✅ CORRECTO:  SUPERADMIN_PASSWORD=$2b$12$...
 *    ✅ CORRECTO:  SUPERADMIN_PASSWORD='$2b$12$...'
 *    ❌ INCORRECTO: SUPERADMIN_PASSWORD="$2b$12$..."
 *
 *    Las comillas dobles hacen que Node.js/dotenv intente expandir
 *    los $ como variables, corrompiendo el hash.
 */
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";

async function main() {
  const password = process.argv[2];

  if (!password) {
    console.error("❌ Uso: npx tsx scripts/hash-password.ts <contraseña>");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("❌ La contraseña debe tener al menos 8 caracteres");
    process.exit(1);
  }

  console.log("🔄 Generando hash de bcrypt (salt rounds: 12)...");
  const hash = await bcrypt.hash(password, 12);

  console.log("\n✅ Hash generado exitosamente:\n");
  console.log(hash);
  console.log("\n📝 Copiá esta línea a tu archivo .env (sin comillas dobles):");
  console.log(`\n   SUPERADMIN_PASSWORD='${hash}'\n`);

  // Opción: escribir automáticamente en .env si existe
  const envPath = path.resolve(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf-8");

    if (envContent.includes("SUPERADMIN_PASSWORD=")) {
      envContent = envContent.replace(
        /^SUPERADMIN_PASSWORD=.*$/m,
        `SUPERADMIN_PASSWORD='${hash}'`
      );
    } else {
      envContent += `\nSUPERADMIN_PASSWORD='${hash}'\n`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log("✅ También se actualizó automáticamente en tu archivo .env");
  } else {
    console.log("💡 Tip: Si creás un archivo .env, usá el formato SIN comillas dobles:");
    console.log(`   SUPERADMIN_PASSWORD='${hash}'`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
