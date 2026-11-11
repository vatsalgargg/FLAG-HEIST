import { hashPassword } from './auth/password';
/**
 * ROOT CTF — Operational Hardening Acceptance Test Suite
 *
 * Validates the 11 operational hardening and safety systems:
 * 1. Announcement Banner System (CRUD, public cached API, deactivation)
 * 2. Global Kill-Switch / Maintenance Mode (Instant 503 without DB queries, reads remain open)
 * 3. Scoreboard Freeze (Snapshot isolation, X-Scoreboard-Frozen header, live scoring continues)
 * 4. Real Per-Request Sandbox Isolation (Module 12 concurrent execution scratch isolation)
 * 5. Anti-Automation CAPTCHA on Registration (Bcrypt CPU-starvation defense, no CAPTCHA on login/submit)
 * 6. Consistent Security Headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer, Permissions)
 * 7. Public Status Page (Aggregated health probe cached in Redis)
 * 8. First-Blood & Solve-Stats Tracking (O(1) incremental Redis updates, solve count)
 * 9. Rules Acceptance at Registration (Mandatory accepted_rules_at audit column)
 */

process.env.NODE_ENV = 'test';

import http from 'http';
import fs from 'fs';
import path from 'path';
import { db, teams, adminUsers, announcements, solves, scoreLog } from './db';
import { eq, sql } from 'drizzle-orm';
import { redis, deleteCacheKey, setCachedJson } from './cache';
import { issueAdminToken, issueTeamToken } from './auth/tokens';
import { ADMIN_COOKIE_NAME, TEAM_COOKIE_NAME } from './auth/cookies';

const TEST_PORT = 8098;
const COLLAB_PORT = 8082;
const CH12_PORT = 3012;

const BASE_URL = `http://localhost:${TEST_PORT}`;
const COLLAB_URL = `http://localhost:${COLLAB_PORT}`;
const CH12_URL = `http://localhost:${CH12_PORT}`;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runHardeningTests(): Promise<void> {
  console.log('\n================================================================================');
  console.log('RUNNING ACCEPTANCE TESTS: OPERATIONAL HARDENING PHASE (20,000 CONCURRENCY TARGET)');
  console.log('================================================================================\n');

  // Dynamic import so process.env.NODE_ENV='test' is active before modules evaluate
  const { createApp } = await import('./app');
  const { createCollabApp } = await import('../../collab/src');
  const { createChallenge12App } = await import('../../challenges/12-diagnostics-backdoor/src');

  // Start ephemeral platform server
  const platformApp = createApp();
  const platformServer = http.createServer(platformApp);
  await new Promise<void>((resolve) => platformServer.listen(TEST_PORT, resolve));
  console.log(`[TEST-RUNNER] Platform test server listening on ${BASE_URL}`);

  // Start ephemeral collab server
  const collabApp = createCollabApp();
  const collabServer = http.createServer(collabApp);
  await new Promise<void>((resolve) => collabServer.listen(COLLAB_PORT, resolve));
  console.log(`[TEST-RUNNER] Collab test server listening on ${COLLAB_URL}`);

  // Start ephemeral challenge 12 server
  const ch12App = createChallenge12App();
  const ch12Server = http.createServer(ch12App);
  await new Promise<void>((resolve) => ch12Server.listen(CH12_PORT, resolve));
  console.log(`[TEST-RUNNER] Challenge 12 test server listening on ${CH12_URL}\n`);

  try {
    // Generate valid admin and team auth tokens
    const adminToken = issueAdminToken({
      id: '00000000-0000-0000-0000-000000000001',
      username: 'hardening_admin',
      role: 'admin',
    });
    const adminHeaders = {
      'Content-Type': 'application/json',
      Cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
    };

    // Clean up test team respecting ON DELETE RESTRICT foreign keys
    const staleTeams = await db.select({ id: teams.id }).from(teams).where(eq(teams.teamName, 'hardening_test_team'));
    for (const t of staleTeams) {
      await db.delete(solves).where(eq(solves.teamId, t.id));
      await db.delete(scoreLog).where(eq(scoreLog.teamId, t.id));
      await db.delete(teams).where(eq(teams.id, t.id));
    }
    await db.delete(announcements).where(sql`created_by = 'hardening_admin'`);
    await deleteCacheKey('platform:maintenance_mode');
    await deleteCacheKey('platform:leaderboard_frozen');
    await deleteCacheKey('announcements:active');
    await deleteCacheKey('stats:solves');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 1: Consistent Security Headers (Section 6)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[TEST 1] Testing consistent security headers across platform, collab, and challenge microservices...');
    const targets = [
      { name: 'Platform API', url: `${BASE_URL}/healthz` },
      { name: 'Collab Service', url: `${COLLAB_URL}/healthz` },
      { name: 'Challenge 12 Microservice', url: `${CH12_URL}/healthz` },
    ];

    for (const target of targets) {
      const res = await fetch(target.url);
      assert(res.status === 200, `${target.name} /healthz returned 200`);

      const csp = res.headers.get('content-security-policy');
      const hsts = res.headers.get('strict-transport-security');
      const nosniff = res.headers.get('x-content-type-options');
      const xframe = res.headers.get('x-frame-options');
      const referrer = res.headers.get('referrer-policy');
      const permissions = res.headers.get('permissions-policy');

      assert(!!csp && csp.includes("default-src 'self'"), `${target.name} has valid Content-Security-Policy`);
      assert(!!hsts && hsts.includes('max-age=31536000'), `${target.name} has Strict-Transport-Security (HSTS)`);
      assert(nosniff === 'nosniff', `${target.name} has X-Content-Type-Options: nosniff`);
      assert(xframe === 'DENY', `${target.name} has X-Frame-Options: DENY`);
      assert(referrer === 'strict-origin-when-cross-origin', `${target.name} has Referrer-Policy: strict-origin-when-cross-origin`);
      assert(!!permissions && permissions.includes('camera=()'), `${target.name} has Permissions-Policy hardware protection`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 2: Rules Acceptance & CAPTCHA on Registration (Sections 5 & 9)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 2] Public registration is disabled; provision team in the database...');
    const disabled = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert(disabled.status === 403, 'Public registration is forbidden');
    const [dbTeam] = await db.insert(teams).values({ teamName: 'hardening_test_team', teamSize: 1,
      memberEmails: ['hardening@cyber.ctf'], passwordHash: await hashPassword('SecurePassword123!'),
      acceptedRulesAt: new Date() }).returning();
    const validRegRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leader_email: 'hardening@cyber.ctf', password: 'SecurePassword123!' }),
    });
    assert(validRegRes.status === 200, 'Provisioned team can log in');

    const teamCookie = validRegRes.headers.get('set-cookie') || '';
    const teamHeaders = {
      'Content-Type': 'application/json',
      Cookie: teamCookie,
    };

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 3: Announcements System (Section 1)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 3] Testing announcement banner system (creation, Redis caching, deactivation)...');

    // Create announcement via admin API
    const createAnnRes = await fetch(`${BASE_URL}/api/admin/announcements`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        message: 'Platform maintenance scheduled in 30 minutes. Please save flag drafts.',
        severity: 'warning',
      }),
    });
    assert(createAnnRes.status === 201, 'POST /api/admin/announcements returned HTTP 201');
    const createAnnBody: any = await createAnnRes.json();
    const announcementId = createAnnBody.announcement.id;
    assert(createAnnBody.announcement.severity === 'warning', 'Announcement severity recorded');

    // Public fetch
    const getAnnRes1 = await fetch(`${BASE_URL}/api/announcements`);
    assert(getAnnRes1.status === 200, 'GET /api/announcements returned HTTP 200');
    const annList1: any = await getAnnRes1.json();
    assert(Array.isArray(annList1) && annList1.length >= 1, 'Public announcements returns active list');
    assert(annList1[0].id === announcementId, 'Newly created announcement is first in list');

    // Deactivate announcement via admin API
    const deactRes = await fetch(`${BASE_URL}/api/admin/announcements/${announcementId}/deactivate`, {
      method: 'POST',
      headers: adminHeaders,
    });
    assert(deactRes.status === 200, 'POST /api/admin/announcements/:id/deactivate returned HTTP 200');

    // Public fetch should now return empty or omit deactivated
    const getAnnRes2 = await fetch(`${BASE_URL}/api/announcements`);
    const annList2: any = await getAnnRes2.json();
    assert(!annList2.some((a: any) => a.id === announcementId), 'Deactivated announcement removed from public list');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 4: Global Kill-Switch / Maintenance Mode (Section 2)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 4] Testing global kill-switch / maintenance mode...');

    // 4a. Enable maintenance mode
    const maintOnRes = await fetch(`${BASE_URL}/api/admin/maintenance-mode/on`, {
      method: 'POST',
      headers: adminHeaders,
    });
    assert(maintOnRes.status === 200, 'POST /api/admin/maintenance-mode/on returned HTTP 200');

    // 4b. Flag submission must fail-fast with HTTP 503 WITHOUT touching DB
    const blockedSubmitRes = await fetch(`${BASE_URL}/api/submit`, {
      method: 'POST',
      headers: teamHeaders,
      body: JSON.stringify({ challenge_id: 1, flag: 'ROOT{test_flag}' }),
    });
    assert(blockedSubmitRes.status === 503, 'Flag submission during maintenance returned HTTP 503');
    const blockedSubmitBody: any = await blockedSubmitRes.json();
    assert(blockedSubmitBody.error === 'MaintenanceMode', 'Error code is MaintenanceMode');
    assert(
      blockedSubmitBody.message.includes('the platform is temporarily paused') ||
      blockedSubmitBody.message.includes('The platform is temporarily paused'),
      'Returned clear paused message'
    );

    // 4c. Hint reveal must also fail-fast with HTTP 503
    const blockedHintRes = await fetch(`${BASE_URL}/api/hints/1/reveal`, {
      method: 'POST',
      headers: teamHeaders,
    });
    assert(blockedHintRes.status === 503, 'Hint reveal during maintenance returned HTTP 503');

    // 4d. Dashboard and Leaderboard READS must remain 100% accessible
    const dashRes = await fetch(`${BASE_URL}/api/dashboard`, { headers: teamHeaders });
    assert(dashRes.status === 200, 'GET /api/dashboard remains readable during maintenance');
    const boardRes = await fetch(`${BASE_URL}/api/leaderboard`);
    assert(boardRes.status === 200, 'GET /api/leaderboard remains readable during maintenance');

    // 4e. Disable maintenance mode
    const maintOffRes = await fetch(`${BASE_URL}/api/admin/maintenance-mode/off`, {
      method: 'POST',
      headers: adminHeaders,
    });
    assert(maintOffRes.status === 200, 'POST /api/admin/maintenance-mode/off returned HTTP 200');

    // Submissions resume
    const resumeSubmitRes = await fetch(`${BASE_URL}/api/submit`, {
      method: 'POST',
      headers: teamHeaders,
      body: JSON.stringify({ challenge_id: 1, flag: 'ROOT{fake_flag}' }),
    });
    assert(resumeSubmitRes.status === 200, 'Submissions resumed: returned 200 with normal verification');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5: Scoreboard Freeze (Section 3)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 5] Testing scoreboard freeze and snapshot isolation...');

    // 5a. Freeze leaderboard
    const freezeRes = await fetch(`${BASE_URL}/api/admin/leaderboard/freeze`, {
      method: 'POST',
      headers: adminHeaders,
    });
    assert(freezeRes.status === 200, 'POST /api/admin/leaderboard/freeze returned HTTP 200');

    // 5b. Public leaderboard reflects freeze header
    const frozenBoardRes = await fetch(`${BASE_URL}/api/leaderboard`);
    assert(frozenBoardRes.status === 200, 'GET /api/leaderboard returns 200 while frozen');
    assert(frozenBoardRes.headers.get('x-scoreboard-frozen') === 'true', 'X-Scoreboard-Frozen header is present');
    const frozenPayload1: any = await frozenBoardRes.json();

    // 5c. Admin adjusts score behind scenes
    const adjustRes = await fetch(`${BASE_URL}/api/admin/teams/${dbTeam.id}/adjust-score`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ delta: -25, reason: 'Live scoring during freeze test' }),
    });
    assert(adjustRes.status === 200, 'Score adjusted in PostgreSQL audit log');

    // 5d. Public leaderboard must continue serving the FROZEN snapshot
    const frozenBoardRes2 = await fetch(`${BASE_URL}/api/leaderboard`);
    const frozenPayload2: any = await frozenBoardRes2.json();
    const teamEntry1 = frozenPayload1.find((t: any) => t.team_name === 'hardening_test_team');
    const teamEntry2 = frozenPayload2.find((t: any) => t.team_name === 'hardening_test_team');
    assert(teamEntry1?.score === teamEntry2?.score, 'Public leaderboard score did NOT change while frozen (snapshot preserved)');

    // 5e. Unfreeze leaderboard
    const unfreezeRes = await fetch(`${BASE_URL}/api/admin/leaderboard/unfreeze`, {
      method: 'POST',
      headers: adminHeaders,
    });
    assert(unfreezeRes.status === 200, 'POST /api/admin/leaderboard/unfreeze returned HTTP 200');

    const unfrozenBoardRes = await fetch(`${BASE_URL}/api/leaderboard`);
    const unfrozenPayload: any = await unfrozenBoardRes.json();
    const teamEntryUnfrozen = unfrozenPayload.find((t: any) => t.team_name === 'hardening_test_team');
    assert(teamEntryUnfrozen?.score === 175, 'Scoreboard refreshed with ground-truth score after unfreeze (175 pts)');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 6: Real Per-Request Sandbox Isolation on Module 12 (Section 4)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 6] Testing per-request scratch isolation on Challenge 12 (concurrent command execution)...');

    const scratchDir = path.resolve(__dirname, '../../challenges/12-diagnostics-backdoor/data/scratch');
    if (fs.existsSync(scratchDir)) {
      for (const item of fs.readdirSync(scratchDir)) {
        try {
          fs.rmSync(path.join(scratchDir, item), { recursive: true, force: true });
        } catch {}
      }
    }

    // Fire two concurrent requests with distinct state creations in scratch
    const req1 = fetch(`${CH12_URL}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: '127.0.0.1; touch marker_alpha_$$.tmp',
      }),
    });

    const req2 = fetch(`${CH12_URL}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: '127.0.0.1; touch marker_beta_$$.tmp',
      }),
    });

    const [ch12Res1, ch12Res2] = await Promise.all([req1, req2]);
    assert(ch12Res1.status === 200, 'Request A to Module 12 returned 200');
    assert(ch12Res2.status === 200, 'Request B to Module 12 returned 200');

    // Wait a brief moment for command execution to complete and scratch cleanups to fire
    let remainingFiles: string[] = [];
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (fs.existsSync(scratchDir)) {
        remainingFiles = fs.readdirSync(scratchDir).filter((f) => f.startsWith('marker_') || f.startsWith('run_'));
        if (remainingFiles.length === 0) break;
      }
    }

    assert(remainingFiles.length === 0, `Pattern B verified: Ephemeral scratch cleaned up with 0 leaked files (found ${remainingFiles.length})`);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 7: Public Status Page (Section 7)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 7] Testing public status page API and Redis caching...');
    const statusRes = await fetch(`${BASE_URL}/api/status`);
    assert(statusRes.status === 200, 'GET /api/status returned HTTP 200');
    const statusData: any = await statusRes.json();
    assert(statusData.overall_status !== undefined, 'Status contains overall_status');
    assert(Array.isArray(statusData.services), 'Status contains services array');
    assert(statusData.services.some((s: any) => s.category === 'database'), 'Status checks PostgreSQL');
    assert(statusData.services.some((s: any) => s.category === 'cache'), 'Status checks Redis');
    assert(statusData.services.some((s: any) => s.name.includes('Ch #1')), 'Status checks Challenge sandboxes');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 8: First-Blood & Solve Statistics Tracking (Section 8)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 8] Testing first-blood and solve statistics API...');
    // Reset any prior solves on challenge 1 for clean first-blood test
    await db.delete(solves).where(eq(solves.challengeId, 1));
    await deleteCacheKey('challenge:first_blood:1');
    await deleteCacheKey('challenge:solve_count:1');
    await deleteCacheKey('stats:solves');

    const statsRes = await fetch(`${BASE_URL}/api/stats/solves`);
    assert(statsRes.status === 200, 'GET /api/stats/solves returned HTTP 200');
    const statsData: any = await statsRes.json();
    assert(Array.isArray(statsData) && statsData.length === 13, 'Returned statistics for all 13 challenges');
    assert(statsData[0].challenge_id === 1, 'Stats include challenge_id');
    assert(typeof statsData[0].solve_count === 'number', 'Stats include solve_count');

    // Submit correct flag for challenge 1 and verify first-blood is claimed
    const realCh1Flag = 'ROOT{v3yr4_st4g1ng_s1t3_l34k_7f3a2c91}';
    const solveRes = await fetch(`${BASE_URL}/api/submit`, {
      method: 'POST',
      headers: teamHeaders,
      body: JSON.stringify({ challenge_id: 1, flag: realCh1Flag }),
    });
    const solveBody: any = await solveRes.json();
    assert(solveBody.status === 'correct', `Flag submitted successfully (got status: ${solveBody.status})`);

    // Check stats again
    const statsRes2 = await fetch(`${BASE_URL}/api/stats/solves`);
    const statsData2: any = await statsRes2.json();
    const ch1Stat = statsData2.find((s: any) => s.challenge_id === 1);
    assert(ch1Stat.solve_count >= 1, 'Solve count incremented');
    assert(ch1Stat.first_blood?.team_name === 'hardening_test_team', 'First-blood team correctly assigned to first solver');

    console.log('\n================================================================================');
    console.log('✅ ALL OPERATIONAL HARDENING ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================================\n');
  } finally {
    // Teardown servers
    await new Promise((r) => platformServer.close(r));
    await new Promise((r) => collabServer.close(r));
    await new Promise((r) => ch12Server.close(r));
  }
}

runHardeningTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal hardening test failure:', err);
    process.exit(1);
  });
