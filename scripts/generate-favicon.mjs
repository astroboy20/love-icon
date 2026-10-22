/**
 * generate-favicon.mjs
 *
 * Converts public/favicon.svg → public/favicon.ico (16x16, 32x32, 48x48 embedded).
 *
 * Run once:
 *   node scripts/generate-favicon.mjs
 *
 * Requires: sharp, to-ico  (installed automatically via npx if not present)
 *   npm install --save-dev sharp to-ico
 *   node scripts/generate-favicon.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Dynamically import so the script gives a clear message if deps are missing
let sharp, toIco;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("❌  'sharp' is not installed. Run:  npm install --save-dev sharp");
  process.exit(1);
}
try {
  toIco = (await import("to-ico")).default;
} catch {
  console.error("❌  'to-ico' is not installed. Run:  npm install --save-dev to-ico");
  process.exit(1);
}

const svgPath = resolve(root, "public", "favicon.svg");
const icoPath = resolve(root, "public", "favicon.ico");

const svgBuffer = readFileSync(svgPath);

// Render at three standard ICO sizes
const sizes = [16, 32, 48];
const pngBuffers = await Promise.all(
  sizes.map((size) =>
    sharp(svgBuffer, { density: 300 })
      .resize(size, size)
      .png()
      .toBuffer()
  )
);

const icoBuffer = await toIco(pngBuffers);
writeFileSync(icoPath, icoBuffer);

console.log(`✅  favicon.ico written (${sizes.join(", ")}px) → ${icoPath}`);
