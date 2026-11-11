// Run by build-vm.sh on the machine's copy ONLY (never on your source checkout).
// TryHackMe checks answers itself, so the scoring platform on the machine does not
// need real flags. This replaces every flag value inside services/ctf/platform with
// a placeholder BEFORE its Docker image is built, so no raw flag ends up in it.
//   node deploy/tryhackme/strip-platform-flags.mjs /opt/flagheist
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
if (!root || !root.startsWith("/opt/")) {
  console.error("Refusing to run outside the /opt build copy.");
  process.exit(1);
}
const platform = path.join(root, "services/ctf/platform");
const seedPath = path.join(platform, "src/db/seed.ts");
const block = fs.readFileSync(seedPath, "utf8").match(/REAL_CHALLENGE_FLAGS[^=]*=\s*\{([\s\S]*?)\n\};/);
if (!block) throw new Error("REAL_CHALLENGE_FLAGS not found");
const flags = [...block[1].matchAll(/^\s*(\d+)\s*:\s*(['"`])(.*?)\2/gm)].map((m) => [m[1], m[3]]);

let files = 0, replaced = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.name === "node_modules" || e.name === "dist") continue;
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(ts|js|mjs|json|md|txt)$/.test(e.name)) continue;
    let t = fs.readFileSync(p, "utf8"), before = t;
    for (const [id, v] of flags) t = t.split(v).join(`THM-REDACTED-${id}`);
    if (t !== before) { fs.writeFileSync(p, t); files++; replaced += before.split("ROOT{").length - t.split("ROOT{").length; }
  }
})(platform);

// Verify nothing is left
let left = 0;
(function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.name === "node_modules") continue;
    if (e.isDirectory()) scan(p);
    else { const t = fs.readFileSync(p); for (const [, v] of flags) if (t.includes(v)) left++; }
  }
})(platform);
console.log(`redacted ${replaced} flag literal(s) in ${files} file(s); remaining in platform: ${left}`);
if (left) process.exit(1);
