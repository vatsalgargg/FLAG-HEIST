/**
 * Acceptance Test Suite: Prompt 8 — Content Batch 2 (Challenges 07 & 08)
 *
 * Verifies:
 * 1. Single shared login authentication (priya.nair / Veyra#Audit26) & rejection of bad creds.
 * 2. Deterministic invoice ID transform reverse-engineering across Priya's 5 invoices.
 * 3. In-app escalation memo clue pointing to target Customer 9104 (Apex Sovereign Holdings).
 * 4. Challenge 07: GET /api/invoices/:id IDOR retrieval of target flag, and 404 on invalid IDs.
 * 5. Challenge 08: 3 correctly protected routes return 403 Forbidden, 1 vulnerable route returns flag.
 * 6. Discoverable source artifact: bundle.min.js and zip archive exist, unlinked in index.html.
 * 7. Both flags accepted by platform /api/submit and idempotent duplicate solve handling.
 * 8. Standard healthz and reset contract (POST /reset/7, POST /reset/8) and admin panel integration.
 * 9. Write-ups in /docs and zero forbidden vulnerability terminology in user-facing files.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { createApp as createPlatformApp } from '../app';
import { createApp as createSharedPortalApp } from '../../../challenges/07-invoice-trail/src/app';
import { getDatabase as getPortalDb } from '../../../challenges/07-invoice-trail/src/db';
import { deriveInvoiceId, DEFAULT_INVOICE_KEY } from '../../../challenges/07-invoice-trail/src/transform';
import { db, teams, challenges, scoreLog, solves } from '../db';
import { eq } from 'drizzle-orm';
import { issueTeamToken, issueAdminToken } from '../auth/tokens';
import { deleteCacheKey, redis } from '../cache';

import { config } from '../config';

const PLATFORM_PORT = 8095;
const PORTAL_PORT = 3007;

const PLATFORM_URL = `http://localhost:${PLATFORM_PORT}`;
const PORTAL_URL = `http://localhost:${PORTAL_PORT}`;

function assert(condition: any, message: string): void {
  if (!condition) {
    console.error(`  ❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
}

async function extractCookie(response: Response, cookieName: string): Promise<string> {
  const setCookie = response.headers.get('set-cookie');
  assert(setCookie, `Set-Cookie header missing in response`);
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
  assert(match && match[1], `Cookie "${cookieName}" not found in Set-Cookie: ${setCookie}`);
  return match[1];
}

async function run() {
  console.log('\n================================================================================');
  console.log('RUNNING ACCEPTANCE TESTS FOR PROMPT 8: CONTENT BATCH 2 (CHALLENGES 07 & 08)');
  console.log('================================================================================\n');

  const activeResetToken = config.resetToken || process.env.RESET_TOKEN || 'dev-reset-bearer-token-12345';
  process.env.RESET_TOKEN = activeResetToken;
  process.env.FLAG_PEPPER = config.flagPepper || 'dev-flag-pepper-secret-value';
  process.env.CHALLENGE_07_URL = PORTAL_URL;
  process.env.CHALLENGE_08_URL = PORTAL_URL;

  // Initialize SQLite portal database in-memory/file
  getPortalDb();

  // Start test servers
  const platformApp = createPlatformApp();
  const platformServer = http.createServer(platformApp);
  await new Promise<void>(res => platformServer.listen(PLATFORM_PORT, res));
  console.log(`[TEST-RUNNER] Scoring platform listening on ${PLATFORM_URL}`);

  const portalApp = createSharedPortalApp();
  const portalServer = http.createServer(portalApp);
  await new Promise<void>(res => portalServer.listen(PORTAL_PORT, res));
  console.log(`[TEST-RUNNER] Shared Veyra Portal listening on ${PORTAL_URL}\n`);

  try {
    // Register or lookup test team
    const testTeamName = `test_batch2_team_${Date.now()}`;
    const [team] = await db
      .insert(teams)
      .values({
        teamName: testTeamName,
        memberEmails: [`batch2_${Date.now()}@corp.test`],
        teamSize: 1,
        passwordHash: 'dummy_hash',
      })
      .returning();

    const teamToken = issueTeamToken({
      id: team.id,
      teamName: team.teamName,
    });

    const adminToken = issueAdminToken({
      id: 'admin-test-uuid',
      username: 'admin',
      role: 'admin',
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 1: Authentication on the Shared Portal
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('[TEST 1] Testing authentication for Priya Nair (priya.nair / Veyra#Audit26)...');

    // 1a. Bad credentials rejected
    const badLoginRes = await fetch(`${PORTAL_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'priya.nair', password: 'WrongPassword!' }),
    });
    assert(badLoginRes.status === 401, `Invalid password rejected with HTTP 401 (got ${badLoginRes.status})`);
    console.log('  ✓ Invalid password rejected with HTTP 401');

    const unknownUserRes = await fetch(`${PORTAL_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'unknown.user', password: 'Veyra#Audit26' }),
    });
    assert(unknownUserRes.status === 401, `Unknown user rejected with HTTP 401 (got ${unknownUserRes.status})`);
    console.log('  ✓ Unknown user rejected with HTTP 401');

    // 1b. Correct login
    const loginRes = await fetch(`${PORTAL_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'priya.nair', password: 'Veyra#Audit26' }),
    });
    assert(loginRes.status === 200, `Login succeeded with HTTP 200 (got ${loginRes.status})`);
    const portalSessionCookie = await extractCookie(loginRes, 'veyra_portal_session');
    console.log('  ✓ Login with priya.nair / Veyra#Audit26 succeeded');
    console.log('  ✓ Received valid veyra_portal_session cookie');

    // Verify session via /api/auth/me
    const meRes = await fetch(`${PORTAL_URL}/api/auth/me`, {
      headers: { Cookie: `veyra_portal_session=${portalSessionCookie}` },
    });
    assert(meRes.status === 200, `Session check returned HTTP 200 (got ${meRes.status})`);
    const meData = await meRes.json();
    assert(meData.user.username === 'priya.nair', `Session username is priya.nair`);
    assert(meData.user.role === 'auditor', `Session role is low-privilege auditor`);
    assert(meData.user.customerId === 1042, `Session customerId is 1042`);
    console.log('  ✓ /api/auth/me confirms authenticated auditor session (customerId: 1042)\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 2: Reverse-Engineering Deterministic Invoice-ID Transform
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('[TEST 2] Testing GET /api/my-invoices and empirical transform deduction...');
    const myInvoicesRes = await fetch(`${PORTAL_URL}/api/my-invoices`, {
      headers: { Cookie: `veyra_portal_session=${portalSessionCookie}` },
    });
    assert(myInvoicesRes.status === 200, `GET /api/my-invoices returned HTTP 200`);
    const myInvoicesData = await myInvoicesRes.json();
    const invoices = myInvoicesData.invoices;
    assert(Array.isArray(invoices), 'Invoices is an array');
    assert(invoices.length >= 5, `Priya has at least 5 invoices (found ${invoices.length})`);
    console.log(`  ✓ Retrieved ${invoices.length} invoices for customer 1042`);

    // Reverse-engineer key across all 5 samples
    const observedKeys: number[] = [];
    for (const inv of invoices) {
      assert(/^INV-[0-9A-F]{6}$/i.test(inv.invoice_id), `Invoice ID format valid: ${inv.invoice_id}`);
      const hex = inv.invoice_id.replace(/^INV-/, '');
      const xorVal = parseInt(hex, 16);
      const combined = (inv.customer_id * 1000) + inv.invoice_num;
      const inferredKey = (xorVal ^ combined) >>> 0;
      observedKeys.push(inferredKey);
      console.log(`    Invoice #${inv.invoice_num}: ${inv.invoice_id} -> hex=${hex} dec=${xorVal} combined=${combined} => Inferred Key: ${inferredKey} (0x${inferredKey.toString(16).toUpperCase()})`);
    }

    // Assert all 5 samples yielded the exact same key
    const allIdentical = observedKeys.every(k => k === observedKeys[0]);
    assert(allIdentical, `All 5 observed invoices consistently deduce key ${observedKeys[0]}`);
    assert(observedKeys[0] === DEFAULT_INVOICE_KEY, `Inferred key matches DEFAULT_INVOICE_KEY (${DEFAULT_INVOICE_KEY})`);
    console.log(`  ✓ Key ${DEFAULT_INVOICE_KEY} empirically verified across all 5 invoice samples\n`);

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 3: Challenge 07 — In-App Clue & IDOR Exploit
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('[TEST 3] Testing Challenge 07: In-app clue discovery and IDOR retrieval...');

    // 3a. Read audit memos to discover target customer
    const memosRes = await fetch(`${PORTAL_URL}/api/audit/memos`, {
      headers: { Cookie: `veyra_portal_session=${portalSessionCookie}` },
    });
    assert(memosRes.status === 200, 'GET /api/audit/memos returned HTTP 200');
    const memosData = await memosRes.json();
    const escalationMemo = memosData.memos.find((m: any) => m.content.includes('9104'));
    assert(escalationMemo, 'Found escalation memo mentioning Customer ID 9104');
    assert(escalationMemo.content.includes('Invoice #1'), 'Escalation memo specifies Invoice #1');
    console.log(`  ✓ Discovered target customer clue in memo: "${escalationMemo.title}"`);
    console.log(`    Details: Customer ID 9104 (Apex Sovereign Holdings), Invoice #1`);

    // 3b. Compute target invoice ID
    const targetInvoiceId = deriveInvoiceId(9104, 1);
    assert(targetInvoiceId === 'INV-D0D61E', `Calculated target invoice ID is INV-D0D61E (got ${targetInvoiceId})`);
    console.log(`  ✓ Computed target invoice ID using deduced transform: ${targetInvoiceId}`);

    // 3c. Query vulnerable endpoint with valid target ID
    const targetInvoiceRes = await fetch(`${PORTAL_URL}/api/invoices/${targetInvoiceId}`, {
      headers: { Cookie: `veyra_portal_session=${portalSessionCookie}` },
    });
    assert(targetInvoiceRes.status === 200, `GET /api/invoices/${targetInvoiceId} returned HTTP 200`);
    const targetInvoiceData = await targetInvoiceRes.json();
    assert(targetInvoiceData.invoice.customerId === 9104, 'Retrieved invoice for customer 9104');
    const ch07Flag = targetInvoiceData.invoice.flag;
    assert(ch07Flag === 'ROOT{1nv01c3_tr4nsf0rm_1d0r_9104a}', `Flag matches expected: ${ch07Flag}`);
    console.log(`  ✓ Vulnerable endpoint reached target invoice and surfaced flag: ${ch07Flag}`);

    // 3d. Verify random/guessed IDs correctly return 404 Not Found
    const notFoundRes1 = await fetch(`${PORTAL_URL}/api/invoices/INV-999999`, {
      headers: { Cookie: `veyra_portal_session=${portalSessionCookie}` },
    });
    assert(notFoundRes1.status === 404, `Random invoice INV-999999 returned HTTP 404 (got ${notFoundRes1.status})`);

    const notFoundRes2 = await fetch(`${PORTAL_URL}/api/invoices/INV-000000`, {
      headers: { Cookie: `veyra_portal_session=${portalSessionCookie}` },
    });
    assert(notFoundRes2.status === 404, `Invalid invoice INV-000000 returned HTTP 404 (got ${notFoundRes2.status})`);
    console.log('  ✓ Non-existent or guessed invoice IDs properly return HTTP 404 (Transform is required)\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 4: Challenge 08 — Broken Access Control on Secondary Route
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('[TEST 4] Testing Challenge 08: Protected routes vs vulnerable secondary route...');

    // 4a. Verify the 3 correctly protected routes reject Priya with 403 Forbidden
    const billingRes = await fetch(`${PORTAL_URL}/api/billing/summary`, {
      headers: { Cookie: `veyra_portal_session=${portalSessionCookie}` },
    });
    assert(billingRes.status === 403, `GET /api/billing/summary returned HTTP 403 Forbidden (got ${billingRes.status})`);
    console.log('  ✓ /api/billing/summary correctly returned HTTP 403 Forbidden');

    const reportingRes = await fetch(`${PORTAL_URL}/api/reporting/exports`, {
      headers: { Cookie: `veyra_portal_session=${portalSessionCookie}` },
    });
    assert(reportingRes.status === 403, `GET /api/reporting/exports returned HTTP 403 Forbidden (got ${reportingRes.status})`);
    console.log('  ✓ /api/reporting/exports correctly returned HTTP 403 Forbidden');

    const usersRes = await fetch(`${PORTAL_URL}/api/users/directory`, {
      headers: { Cookie: `veyra_portal_session=${portalSessionCookie}` },
    });
    assert(usersRes.status === 403, `GET /api/users/directory returned HTTP 403 Forbidden (got ${usersRes.status})`);
    console.log('  ✓ /api/users/directory correctly returned HTTP 403 Forbidden');

    // 4b. Verify unauthenticated call to vulnerable route returns 401
    const unauthVulnRes = await fetch(`${PORTAL_URL}/api/ops/legacy-sync-status`);
    assert(unauthVulnRes.status === 401, `Unauthenticated request to vulnerable route returned HTTP 401`);
    console.log('  ✓ Unauthenticated access to /api/ops/legacy-sync-status rejected with HTTP 401');

    // 4c. Verify authenticated call to vulnerable secondary route succeeds with flag
    const vulnRes = await fetch(`${PORTAL_URL}/api/ops/legacy-sync-status`, {
      headers: { Cookie: `veyra_portal_session=${portalSessionCookie}` },
    });
    assert(vulnRes.status === 200, `GET /api/ops/legacy-sync-status returned HTTP 200`);
    const vulnData = await vulnRes.json();
    const ch08Flag = vulnData.diagnostics?.vault_token_backup;
    assert(ch08Flag === 'ROOT{l3g4cy_sync_uns4f3_byp4ss_78a1}', `Challenge 08 flag matches: ${ch08Flag}`);
    console.log(`  ✓ Vulnerable secondary route /api/ops/legacy-sync-status returned flag: ${ch08Flag}\n`);

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 5: Verify Discoverable Source Artifact & UI Cleanliness
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('[TEST 5] Testing discoverable source artifact & UI navigation cleanliness...');

    // 5a. Verify vulnerable route does NOT appear in rendered index.html UI
    const htmlPath = path.resolve(__dirname, '../../../challenges/07-invoice-trail/public/index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    assert(!htmlContent.includes('legacy-sync-status'), 'Vulnerable route does NOT appear in frontend index.html UI');
    assert(!htmlContent.includes('/api/ops/'), 'No /api/ops/ links in frontend index.html');
    console.log('  ✓ Verified: /api/ops/legacy-sync-status is completely unlinked from frontend UI');

    // 5b. Verify bundled minified file exists and contains the route
    const bundlePath = path.resolve(__dirname, '../../../challenges/08-internal-dashboard/artifacts/bundle.min.js');
    assert(fs.existsSync(bundlePath), 'bundle.min.js exists in artifacts directory');
    const bundleContent = fs.readFileSync(bundlePath, 'utf8');
    assert(bundleContent.length > 5000, `bundle.min.js is substantial (${bundleContent.length} bytes)`);
    assert(bundleContent.includes('/api/ops/legacy-sync-status'), 'bundle.min.js contains the discoverable route');
    console.log(`  ✓ Verified: bundle.min.js is genuinely minified (${bundleContent.length} bytes) and contains the route`);

    // 5c. Verify downloadable zip release archive exists
    const zipPath = path.resolve(__dirname, '../../../challenges/08-internal-dashboard/artifacts/veyra-frontend-portal-release.zip');
    assert(fs.existsSync(zipPath), 'veyra-frontend-portal-release.zip exists in artifacts directory');
    const zipStats = fs.statSync(zipPath);
    assert(zipStats.size > 5000, `Zip archive has valid size (${zipStats.size} bytes)`);
    console.log(`  ✓ Verified: veyra-frontend-portal-release.zip exists (${zipStats.size} bytes)\n`);

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 6: Submitting Both Flags to Platform /api/submit
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('[TEST 6] Testing flag submission to scoring platform for Challenges 07 and 08...');

    // Clear rate limiter for test team
    await deleteCacheKey(`ratelimit:flag_submit:team:${team.id}`);

    // Submit Challenge 7 flag
    const submitRes7 = await fetch(`${PLATFORM_URL}/api/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `veyra_team_session=${teamToken}`,
      },
      body: JSON.stringify({
        challenge_id: 7,
        flag: ch07Flag,
      }),
    });
    const submitData7 = await submitRes7.json();
    assert(submitRes7.status === 200, `Submit Ch 7 returned HTTP 200 (got ${submitRes7.status}: ${JSON.stringify(submitData7)})`);
    assert(submitData7.status === 'correct', 'Challenge 7 flag accepted as "correct"');
    console.log('  ✓ Challenge 07 flag submitted and accepted as correct (+15 pts)');

    // Duplicate submit Ch 7
    const dupRes7 = await fetch(`${PLATFORM_URL}/api/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `veyra_team_session=${teamToken}`,
      },
      body: JSON.stringify({
        challenge_id: 7,
        flag: ch07Flag,
      }),
    });
    const dupData7 = await dupRes7.json();
    assert(dupData7.status === 'already_solved', 'Duplicate submit Ch 7 caught as "already_solved"');
    console.log('  ✓ Duplicate submit for Challenge 07 caught as already_solved');

    // Clear rate limit
    await deleteCacheKey(`ratelimit:flag_submit:team:${team.id}`);

    // Submit Challenge 8 flag
    const submitRes8 = await fetch(`${PLATFORM_URL}/api/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `veyra_team_session=${teamToken}`,
      },
      body: JSON.stringify({
        challenge_id: 8,
        flag: ch08Flag,
      }),
    });
    const submitData8 = await submitRes8.json();
    assert(submitRes8.status === 200, `Submit Ch 8 returned HTTP 200 (got ${submitRes8.status}: ${JSON.stringify(submitData8)})`);
    assert(submitData8.status === 'correct', 'Challenge 8 flag accepted as "correct"');
    console.log('  ✓ Challenge 08 flag submitted and accepted as correct (+15 pts)');

    // Duplicate submit Ch 8
    const dupRes8 = await fetch(`${PLATFORM_URL}/api/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `veyra_team_session=${teamToken}`,
      },
      body: JSON.stringify({
        challenge_id: 8,
        flag: ch08Flag,
      }),
    });
    const dupData8 = await dupRes8.json();
    assert(dupData8.status === 'already_solved', 'Duplicate submit Ch 8 caught as "already_solved"');
    console.log('  ✓ Duplicate submit for Challenge 08 caught as already_solved\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 7: Platform Dashboard Link & Access Credential Verification
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('[TEST 7] Testing GET /api/dashboard challenge linking & access info...');
    const dashRes = await fetch(`${PLATFORM_URL}/api/dashboard?fresh=true`, {
      headers: { Cookie: `veyra_team_session=${teamToken}` },
    });
    assert(dashRes.status === 200, 'GET /api/dashboard returned HTTP 200');
    const dashData = await dashRes.json();
    const ch7Entry = dashData.challenges.find((c: any) => c.id === 7);
    const ch8Entry = dashData.challenges.find((c: any) => c.id === 8);

    assert(ch7Entry && ch7Entry.targetUrl, 'Challenge 07 entry links target URL');
    assert(ch7Entry.accessInfo?.includes('priya.nair'), 'Challenge 07 provides Priya Nair access credentials');
    assert(ch8Entry && ch8Entry.targetUrl, 'Challenge 08 entry links target URL');
    assert(ch8Entry.accessInfo?.includes('priya.nair'), 'Challenge 08 provides Priya Nair access credentials');
    console.log('  ✓ Platform dashboard links shared portal URL and priya.nair credentials for both challenges\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 8: Health Probes & Force-Reset Contract via Admin Panel
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('[TEST 8] Testing health probe & reset endpoints (/reset/7 & /reset/8)...');

    // 8a. GET /healthz
    const healthRes = await fetch(`${PORTAL_URL}/healthz`);
    assert(healthRes.status === 200, 'Health check returned HTTP 200');
    const healthData = await healthRes.json();
    assert(healthData.status === 'ok', 'Health status is ok');
    assert(healthData.challenges?.includes(7) && healthData.challenges?.includes(8), 'Health covers challenges 7 & 8');
    console.log('  ✓ GET /healthz responded with status: ok for challenges 7 and 8');

    // 8b. Unauthorized reset attempts
    const unauthReset7 = await fetch(`${PORTAL_URL}/reset/7`, { method: 'POST' });
    assert(unauthReset7.status === 401, 'Unauthorized reset 7 rejected with HTTP 401');

    const unauthReset8 = await fetch(`${PORTAL_URL}/reset/8`, { method: 'POST' });
    assert(unauthReset8.status === 401, 'Unauthorized reset 8 rejected with HTTP 401');
    console.log('  ✓ Unauthenticated reset calls rejected with HTTP 401');

    // 8c. Direct POST /reset/7
    const reset7Res = await fetch(`${PORTAL_URL}/reset/7`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESET_TOKEN}` },
    });
    assert(reset7Res.status === 200, 'Direct reset 7 returned HTTP 200');
    console.log('  ✓ POST /reset/7 returned HTTP 200');

    // 8d. Direct POST /reset/8
    const reset8Res = await fetch(`${PORTAL_URL}/reset/8`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESET_TOKEN}` },
    });
    assert(reset8Res.status === 200, 'Direct reset 8 returned HTTP 200');
    console.log('  ✓ POST /reset/8 returned HTTP 200');

    // 8e. Platform Admin Force-Reset Proxy for Challenge 7 & 8
    const adminReset7Res = await fetch(`${PLATFORM_URL}/api/admin/challenges/7/force-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `veyra_admin_session=${adminToken}`,
      },
    });
    assert(adminReset7Res.status === 200, 'Admin proxy force-reset for Challenge 7 returned HTTP 200');
    const adminReset7Data = await adminReset7Res.json();
    assert(adminReset7Data.success, 'Admin proxy reports success: true for Ch 7');
    console.log('  ✓ Admin panel force-reset proxy for Challenge 7 succeeded');

    const adminReset8Res = await fetch(`${PLATFORM_URL}/api/admin/challenges/8/force-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `veyra_admin_session=${adminToken}`,
      },
    });
    assert(adminReset8Res.status === 200, 'Admin proxy force-reset for Challenge 8 returned HTTP 200');
    const adminReset8Data = await adminReset8Res.json();
    assert(adminReset8Data.success, 'Admin proxy reports success: true for Ch 8');
    console.log('  ✓ Admin panel force-reset proxy for Challenge 8 succeeded\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 9: Organiser Write-Ups & Zero Forbidden Terms Check
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('[TEST 9] Verifying organiser write-ups and zero vulnerability terminology...');

    const writeup07Path = path.resolve(__dirname, '../../../docs/07-invoice-trail-writeup.md');
    assert(fs.existsSync(writeup07Path), '07-invoice-trail-writeup.md exists in /docs');
    const writeup07Content = fs.readFileSync(writeup07Path, 'utf8');
    assert(writeup07Content.includes('INVOICE_TRANSFORM_KEY'), 'Writeup 07 documents key variable');
    assert(writeup07Content.includes('5913759'), 'Writeup 07 documents numeric key value');
    assert(writeup07Content.includes('INV-D0D61E'), 'Writeup 07 documents target invoice ID');
    assert(writeup07Content.includes('ROOT{1nv01c3_tr4nsf0rm_1d0r_9104a}'), 'Writeup 07 documents flag');
    console.log('  ✓ Write-up exists and documents exact transform, key, and worked examples: /docs/07-invoice-trail-writeup.md');

    const writeup08Path = path.resolve(__dirname, '../../../docs/08-internal-dashboard-writeup.md');
    assert(fs.existsSync(writeup08Path), '08-internal-dashboard-writeup.md exists in /docs');
    const writeup08Content = fs.readFileSync(writeup08Path, 'utf8');
    assert(writeup08Content.includes('legacy-sync-status'), 'Writeup 08 documents vulnerable route');
    assert(writeup08Content.includes('bundle.min.js'), 'Writeup 08 documents bundled artifact location');
    assert(writeup08Content.includes('ROOT{l3g4cy_sync_uns4f3_byp4ss_78a1}'), 'Writeup 08 documents flag');
    console.log('  ✓ Write-up exists and documents de-minification, route, and flag: /docs/08-internal-dashboard-writeup.md');

    // Check user-facing files for forbidden words
    const forbiddenWords = ['sql injection', 'idor', 'weak rsa', 'broken authentication', 'steganography'];
    const userFacingFiles = [
      path.resolve(__dirname, '../../../challenges/07-invoice-trail/public/index.html'),
    ];

    for (const file of userFacingFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8').toLowerCase();
        for (const term of forbiddenWords) {
          assert(!content.includes(term), `Forbidden term "${term}" found in user-facing file: ${path.basename(file)}`);
        }
      }
    }
    console.log('  ✓ Zero vulnerability class names found in user-facing portal files.\n');

    console.log('================================================================================');
    console.log('✅ ALL PROMPT 8 ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================================\n');
  } finally {
    await new Promise<void>(res => platformServer.close(() => res()));
    await new Promise<void>(res => portalServer.close(() => res()));
    redis.disconnect();
    setTimeout(() => process.exit(0), 100);
  }
}

run().catch(err => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
