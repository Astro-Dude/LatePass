// Regenerates the PWA + home-screen icons from the master logo.
// Source: public/logo-source.png (square). Outputs the sizes the app/manifest
// reference. Uses macOS `sips` (no npm deps). Run: npm run icons
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const SRC = join(PUBLIC, "logo-source.png");

if (!existsSync(SRC)) {
  console.error("Missing public/logo-source.png — drop your square logo there.");
  process.exit(1);
}

const targets = [
  ["icon-512.png", 512],
  ["icon-192.png", 192],
  ["apple-touch-icon.png", 180],
  ["logo.png", 128],
];

for (const [name, size] of targets) {
  execFileSync(
    "sips",
    ["-z", String(size), String(size), SRC, "--out", join(PUBLIC, name)],
    { stdio: "ignore" },
  );
  console.log(`wrote public/${name} (${size}x${size})`);
}
