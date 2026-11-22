/**
 * Jalankan `next dev` memakai SALINAN database produksi (sqlite-prod.db), khusus pengujian lokal.
 *
 *   node scripts/dev-prod-copy.js
 *
 * Reset data uji: salin sqlite-prod.original.db menimpa sqlite-prod.db,
 * lalu `node scripts/seed-test-users.js sqlite-prod.db`.
 */
const { spawn } = require("child_process");
const path = require("path");

const cwd = path.resolve(__dirname, "..");
const child = spawn(
  process.execPath,
  [path.join("node_modules", "next", "dist", "bin", "next"), "dev", "--webpack", "-p", "3000"],
  { cwd, stdio: "inherit", env: { ...process.env, DATABASE: "sqlite-prod.db" } }
);
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
