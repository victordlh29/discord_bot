/**
 * patch-file-type.js
 * 
 * Aplica el fix para GHSA-5v7r-6r5c-r473 (CVE-2026-31808)
 * en file-type v16.5.4 dentro de @discord-player/extractor.
 * 
 * La vulnerabilidad es un loop infinito en el parser ASF cuando
 * header.size < 24, causando payload negativo y posición regresiva.
 * 
 * El fix agrega un guard: if (payload < 0) break;
 * 
 * Se ejecuta automáticamente en postinstall.
 */

const fs = require("fs");
const path = require("path");

// file-type está anidado dentro de @discord-player/extractor
const FILE_PATH = path.join(
  __dirname,
  "..",
  "node_modules",
  "@discord-player",
  "extractor",
  "node_modules",
  "file-type",
  "core.js"
);

const MARKER = "// 🛡️ Fix GHSA-5v7r-6r5c-r473";

function patch() {
  if (!fs.existsSync(FILE_PATH)) {
    console.log(
      "  ⚠️  file-type/core.js not found at expected path. " +
      "The vulnerability may already be resolved or the package structure changed."
    );
    return;
  }

  let source = fs.readFileSync(FILE_PATH, "utf-8");

  // Skip if already patched
  if (source.includes(MARKER)) {
    console.log("  ✅ file-type ASF vulnerability already patched.");
    return;
  }

  const target = 'let payload = header.size - 24;';
  const replacement =
    `let payload = header.size - 24;\n\t\t\t// 🛡️ Fix GHSA-5v7r-6r5c-r473: payload negativo causa loop infinito (ASF malicioso)\n\t\t\tif (payload < 0) break;`;

  if (!source.includes(target)) {
    console.log(
      "  ⚠️  Could not find the vulnerable code in file-type/core.js. " +
      "The vulnerability may already be fixed or the file structure changed."
    );
    return;
  }

  source = source.replace(target, replacement);
  fs.writeFileSync(FILE_PATH, source, "utf-8");
  console.log("  ✅ Patched file-type ASF infinite loop vulnerability (GHSA-5v7r-6r5c-r473).");
}

patch();
