import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
// Run only against a disposable local/test event: this creates a team and exercises organiser controls.
const base = process.env.CTF_TEST_BASE_URL || "http://127.0.0.1:3000";
const name = `Integration ${Date.now()}`;
let teamCookie = "",
  adminCookie = "";
async function request(path, body, cookie = teamCookie, expected = 200) {
  const response = await fetch(base + "/api" + path, {
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined
      ? {}
      : { method: "POST", body: JSON.stringify(body) }),
  });
  const json = await response.json();
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(json)}`);
  return {
    json,
    cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
const email = `integration-${Date.now()}@example.test`;
// Provision the fixture through the local database, just as organisers do.
const provision = `
  const { db, teams, closeDatabase } = require('./dist/db');
  const bcrypt = require('bcryptjs');
  let input = '';
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', async () => {
    const { name, email, password } = JSON.parse(input);
    try {
      const team = db.insert(teams).values({teamName: name, memberEmails: [email], teamSize: 1,
        passwordHash: await bcrypt.hash(password, 10)}).returning({id: teams.id}).get();
      process.stdout.write(team.id);
    } finally { closeDatabase(); }
  });
`;
// CI can provision directly; local integration uses the running Compose service.
const teamId = execFileSync(process.env.CTF_TEST_LOCAL_DB ? process.execPath : "docker",
  process.env.CTF_TEST_LOCAL_DB ? ["-e", provision] : ["compose", "exec", "-T", "platform", "node", "-e", provision],
  { ...(process.env.CTF_TEST_LOCAL_DB ? { cwd: new URL("../services/ctf/platform/", import.meta.url) } : {}),
    input: JSON.stringify({ name, email, password: "integration-password" }), encoding: "utf8" }).trim();
await request("/auth/register", {}, "", 403);
teamCookie = (await request("/auth/login", {
  leader_email: email, password: "integration-password",
}, "")).cookie;
assert.ok(teamCookie);
let board = (await request("/dashboard")).json;
assert.equal(board.challenges.length, 13);
assert.equal(board.team.score, 200);
assert.ok(
  board.challenges.every((ch) =>
    ch.hints.every((hint) => !hint.revealed && hint.content === null),
  ),
);
assert.ok(!JSON.stringify(board).includes("flagHash"));
const privateResponse = await fetch(base + "/api/dashboard", {
  headers: { Cookie: teamCookie },
});
assert.match(privateResponse.headers.get("cache-control"), /no-store/);
assert.equal(
  (await request("/submit", { challenge_id: 1, flag: "ROOT{wrong}" })).json
    .status,
  "incorrect",
);
const seed = await fs.readFile(
  new URL("../services/ctf/platform/src/db/seed.ts", import.meta.url),
  "utf8",
);
const flag = seed.match(/1: '(ROOT\{[^']+\})'/)[1];
const results = await Promise.all(
  Array.from({ length: 5 }, () =>
    request("/submit", { challenge_id: 1, flag }),
  ),
);
assert.equal(results.filter((r) => r.json.status === "correct").length, 1);
assert.equal(
  results.filter((r) => r.json.status === "already_solved").length,
  4,
);
const hint = board.challenges.find((ch) => ch.id === 2).hints[0];
const hintResults = await Promise.all(
  Array.from({ length: 5 }, () => request(`/hints/${hint.id}/reveal`, {})),
);
assert.equal(hintResults.filter((r) => !r.json.already_revealed).length, 1);
board = (await request("/dashboard?fresh=true")).json;
assert.equal(board.team.score, 200 - hint.cost);
assert.ok(board.challenges.find((ch) => ch.id === 2).hints[0].content);
adminCookie = (
  await request(
    "/admin/login",
    {
      username: process.env.ADMIN_SEED_USERNAME || "admin",
      password: process.env.ADMIN_SEED_PASSWORD || "local-organiser-password",
    },
    "",
  )
).cookie;
assert.ok(adminCookie);
await request("/admin/me", undefined, teamCookie, 401);
await request("/auth/me", undefined, adminCookie, 401);
const directory = (
  await request(
    `/admin/teams?search=${encodeURIComponent(name)}`,
    undefined,
    adminCookie,
  )
).json;
assert.equal(
  directory.teams[0].score,
  board.team.score,
  "Team directory must not multiply deductions by solve count",
);
const history = (
  await request(`/admin/teams/${teamId}/history`, undefined, adminCookie)
).json.history;
assert.equal(history.filter((row) => row.reason === "solve:ch1").length, 1);
assert.equal(
  history.filter((row) => row.reason === `hint_reveal:${hint.id}`).length,
  1,
);
await request("/admin/maintenance-mode/on", {}, adminCookie);
try {
  await request(
    "/submit",
    { challenge_id: 2, flag: "ROOT{wrong}" },
    teamCookie,
    503,
  );
} finally {
  await request("/admin/maintenance-mode/off", {}, adminCookie);
}
await request("/admin/leaderboard/freeze", {}, adminCookie);
try {
  const frozen = (await request("/leaderboard", undefined, "")).json;
  await request(
    `/admin/teams/${teamId}/adjust-score`,
    { delta: -2, reason: "Integration audit adjustment" },
    adminCookie,
  );
  assert.deepEqual((await request("/leaderboard", undefined, "")).json, frozen);
} finally {
  await request("/admin/leaderboard/unfreeze", {}, adminCookie);
}
const announcement = (
  await request(
    "/admin/announcements",
    { message: "Integration announcement", severity: "info" },
    adminCookie,
    201,
  )
).json;
const announcements = (await request("/announcements", undefined, "")).json;
const posted = announcements.find(
  (item) => item.message === "Integration announcement",
);
assert.ok(posted, JSON.stringify(announcement));
await request(`/admin/announcements/${posted.id}/deactivate`, {}, adminCookie);
await request(
  `/admin/teams/${teamId}/reset-password`,
  { password: "replacement-password", reason: "Integration credential reset" },
  adminCookie,
);
await request("/dashboard", undefined, teamCookie, 401);
teamCookie = (
  await request(
    "/auth/login",
    { leader_email: email, password: "replacement-password" },
    "",
  )
).cookie;
assert.ok(teamCookie);
const afterReset = (await request("/dashboard?fresh=true")).json;
assert.equal(afterReset.team.score, 198 - hint.cost);
const finalResults = (
  await request("/admin/export/results", undefined, adminCookie)
).json;
assert.ok(JSON.stringify(finalResults).includes(name));
for (const artifact of [
  "/artifacts/ch02/public_key.txt",
  "/artifacts/ch02/ciphertext.txt",
  "/artifacts/ch06/leaked_office.jpg",
  "/artifacts/ch08/veyra-frontend-portal-release.zip",
  "/artifacts/ch11/svc-a.log",
  "/artifacts/ch11/gateway-7.log",
  "/artifacts/ch11/proc-core.log",
  "/artifacts/ch11/proc-core/debug-internal-cfg-49a1.txt",
]) {
  const response = await fetch(base + artifact);
  assert.equal(response.status, 200, artifact);
  assert.ok((await response.arrayBuffer()).byteLength > 0);
}
const health = (await request("/status", undefined, "")).json;
assert.equal(
  health.services.filter((s) => s.category === "challenge").length,
  13,
);
console.log(
  "PASS: 13 challenges, protected hints, concurrent duplicate solves/reveals, audit consistency, auth separation, credential revocation, maintenance, freeze, announcements, exports and all downloads.",
);
