// Generates the TryHackMe room content from the project's own challenge data.
//   node --experimental-strip-types deploy/tryhackme/generate-room.mjs
// Writes:
//   deploy/tryhackme/room/ROOM.md            public text: tasks, questions, hints (safe to paste into TryHackMe)
//   deploy/tryhackme/room/ANSWERS.private.md answers for the room editor ONLY (git-ignored, never copied to the VM)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const out = path.join(here, "room");
fs.mkdirSync(out, { recursive: true });

const { challenges } = await import(pathToFileURL(path.join(root, "src/data/challenges.ts")).href);
const { INITIAL_HINTS } = await import(pathToFileURL(path.join(root, "services/ctf/platform/src/db/hintContent.ts")).href);

// Read the flag table as data (no code from seed.ts is executed).
const seed = fs.readFileSync(path.join(root, "services/ctf/platform/src/db/seed.ts"), "utf8");
const block = seed.match(/REAL_CHALLENGE_FLAGS[^=]*=\s*\{([\s\S]*?)\n\};/);
if (!block) throw new Error("Could not find REAL_CHALLENGE_FLAGS in seed.ts");
const flags = {};
for (const m of block[1].matchAll(/^\s*(\d+)\s*:\s*(['"`])(.*?)\2\s*,?/gm)) flags[Number(m[1])] = m[3];

const target = {
  1: "Target: `http://MACHINE_IP:3101`",
  2: "Files: download from the mission console (`http://MACHINE_IP`) → Task 2",
  3: "Target: `http://MACHINE_IP:3103`",
  4: "Target: `http://MACHINE_IP:3104`",
  5: "Target: `http://MACHINE_IP:3105`",
  6: "Files: download from the mission console (`http://MACHINE_IP`) → Task 6",
  7: "Target: `http://MACHINE_IP:3107` — login `priya.nair` / `Veyra#Audit26`",
  8: "Target: `http://MACHINE_IP:3107` — same account as Task 7. Client bundle: mission console → Task 8",
  9: "Target: `http://MACHINE_IP:3109`",
  10: "Target: `http://MACHINE_IP:3110`",
  11: "Files: download from the mission console (`http://MACHINE_IP`) → Task 11",
  12: "Target: `http://MACHINE_IP:3112` — your callback URL and log are shown in the mission console → Task 12",
  13: "Target: `http://MACHINE_IP:3113` — your callback URL and log are shown in the mission console → Task 13",
};

const md = [];
md.push(`# Flag Heist: The Veyra Breach

**Room description (short):** Retrace a full breach of Veyra Cloud Solutions — from a forgotten staging site to the final admin cover-up — across 13 web, crypto, OSINT and forensics tasks.

**Difficulty:** Medium · **Estimated time:** 180 min · **Tags:** web, osint, crypto, forensics, ssrf, idor

---

## Task 0 — Introduction (no answer needed, or use a "No answer needed" question)

Veyra Cloud Solutions was breached. Your job is to retrace every step the attacker took.

**Start the machine** and wait about 3 minutes for all services to boot. Then open the **mission console**:

\`http://MACHINE_IP\`

Log in with:
- Email: \`operator@veyra.thm\`
- Password: \`HeistOperator2026\`

The console lists every target, the downloadable evidence, and — for the last two tasks — your personal callback URL and callback log.

| Task | Where |
|---|---|
${challenges.map((c) => `| ${c.id}. ${c.title} | ${target[c.id].replace(/^(Target|Files): /, "").replace(/\|/g, "\\|")} |`).join("\n")}

**Rules of engagement:** attack only the ports listed above. The mission console itself (port 80) and SSH are out of scope.

All answers are flags in the format \`ROOT{...}\`.
`);

for (const c of challenges) {
  const hints = INITIAL_HINTS.filter((h) => h.challengeId === c.id).sort((a, b) => a.displayOrder - b.displayOrder);
  md.push(`---

## Task ${c.id} — ${c.title}

*${c.storyBeat}*

${c.narrative}

${c.briefing}

${target[c.id]}

**Question:** What is the flag for "${c.title}"?
**Answer format:** \`ROOT{...}\`
${hints.length ? `**Hint (paste into the question's hint field):** ${hints[0].content}` : ""}
${hints.length > 1 ? `\n_Extra hints from the original event (optional, e.g. in the task text):_\n${hints.slice(1).map((h) => `- ${h.content}`).join("\n")}` : ""}
`);
}

fs.writeFileSync(path.join(out, "ROOM.md"), md.join("\n"));

const ans = [
  "# PRIVATE — answers for the TryHackMe room editor only",
  "",
  "Do not commit, share, or copy this file onto the machine.",
  "",
  ...challenges.map((c) => `- Task ${c.id} (${c.title}): ${flags[c.id] ?? "MISSING — check seed.ts"}`),
  "",
];
fs.writeFileSync(path.join(out, "ANSWERS.private.md"), ans.join("\n"));

const missing = challenges.filter((c) => !flags[c.id]).map((c) => c.id);
console.log(`ROOM.md written (${challenges.length} tasks).`);
console.log(`ANSWERS.private.md written — ${challenges.length - missing.length}/${challenges.length} answers found${missing.length ? `, missing: ${missing.join(", ")}` : ""}.`);
