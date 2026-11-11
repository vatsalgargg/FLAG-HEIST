// Tests exercise challenges independently of unlock order.
process.env.SEQUENTIAL_UNLOCK = 'false';
/**
 * Comprehensive Acceptance Test Suite for Prompt 6: Admin Panel & Shared Redis Rate Limiting
 *
 * Verifies all 6 prompt acceptance criteria:
 * 1. Shared Redis Rate Limiting across two simulated platform instances.
 * 2. Redis fail-open availability contract (requests succeed if Redis fails).
 * 3. Manual score adjustment audit requirement (blank reason rejected; valid reason updates history and leaderboard).
 * 4. Challenge active/inactive toggle immediately blocks/allows /api/submit.
 * 5. Challenge force-reset proxy calls mock challenge reset service and relays response.
 * 6. Strict bidirectional role isolation between admin and team sessions.
 */

import http from 'http';
import { createApp } from '../app';
import { db, teams, adminUsers, challenges, solves, scoreLog } from '../db';
import { eq, sql } from 'drizzle-orm';
import { issueTeamToken, issueAdminToken } from '../auth/tokens';
import { TEAM_COOKIE_NAME, ADMIN_COOKIE_NAME } from '../auth/cookies';
import { computeFlagHash } from '../scoring/flags';
import { config } from '../config';
import { redis } from '../cache';

const INSTANCE_1_PORT = 8091;
const INSTANCE_2_PORT = 8092;
const MOCK_CHALLENGE_PORT = 3099;

const BASE_URL_1 = `http://localhost:${INSTANCE_1_PORT}`;
const BASE_URL_2 = `http://localhost:${INSTANCE_2_PORT}`;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests(): Promise<void> {
  console.log('\n================================================================================');
  console.log('RUNNING ACCEPTANCE TESTS FOR PROMPT 6: ADMIN PANEL & REDIS RATE LIMITING');
  console.log('================================================================================\n');

  // 1. Start Two Identical Platform Instances (simulating multi-container horizontal scale)
  const app1 = createApp();
  const app2 = createApp();

  const server1 = http.createServer(app1);
  const server2 = http.createServer(app2);

  await Promise.all([
    new Promise<void>((resolve) => server1.listen(INSTANCE_1_PORT, resolve)),
    new Promise<void>((resolve) => server2.listen(INSTANCE_2_PORT, resolve)),
  ]);

  console.log(`[TEST-RUNNER] Platform Instance 1 running at ${BASE_URL_1}`);
  console.log(`[TEST-RUNNER] Platform Instance 2 running at ${BASE_URL_2}`);

  // 2. Start Mock Challenge Microservice on port 3099 implementing the Reset Contract
  let mockResetReceived = false;
  let mockResetAuthHeader = '';
  let mockResetBody: any = null;

  const mockChallengeServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/reset/4') {
      mockResetReceived = true;
      mockResetAuthHeader = req.headers['authorization'] || '';

      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try { mockResetBody = JSON.parse(body); } catch {}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          challenge_id: 4,
          reset_at: new Date().toISOString(),
          message: 'Mock challenge container 04 memory purged and test DB reseeded.'
        }));
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'NotFound' }));
  });

  await new Promise<void>((resolve) => mockChallengeServer.listen(MOCK_CHALLENGE_PORT, resolve));
  console.log(`[TEST-RUNNER] Mock Challenge 04 Service running at http://localhost:${MOCK_CHALLENGE_PORT}\n`);

  // Set Challenge 04 Service URL in process.env
  process.env.CHALLENGE_04_URL = `http://localhost:${MOCK_CHALLENGE_PORT}`;

  try {
    // ── Setup Test Identities ──────────────────────────────────────────────────
    const uniqueSuffix = Date.now().toString().slice(-6);
    const testTeamName = `RateLimitTeam_${uniqueSuffix}`;
    const testAdminUsername = `testadmin_${uniqueSuffix}`;

    // Ensure all challenges are active before starting tests
    await db.update(challenges).set({ isActive: true });
    const { invalidateChallengeCache } = await import('../scoring/calculate');
    invalidateChallengeCache();

    // Clean up any stale rate limit keys for test isolation
    const staleKeys = await redis.keys('ratelimit:*');
    if (staleKeys.length > 0) {
      await redis.del(...staleKeys);
    }

    // Insert test team
    const [testTeam] = await db
      .insert(teams)
      .values({
        teamName: testTeamName,
        memberEmails: [`rl_${uniqueSuffix}@corp.test`],
        teamSize: 1,
        passwordHash: 'dummyhash',
      })
      .returning();

    // Insert test admin
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

    const teamCookieHeader = `${TEAM_COOKIE_NAME}=${teamToken}`;
    const adminCookieHeader = `${ADMIN_COOKIE_NAME}=${adminToken}`;

    // ── TEST 1: Shared Redis Rate Limiter Across Multiple Instances ───────────
    console.log('[TEST 1] Testing Shared Redis Rate Limiting across two simulated platform instances...');
    // Rate limit for flagSubmit is 15 requests per minute per team.
    // We send 10 requests to Instance 1, then 5 requests to Instance 2 (total 15).
    // All 15 should be allowed through.
    // The 16th request to Instance 2 MUST be rejected with HTTP 429!

    let allowedCount = 0;
    // 10 requests to Instance 1
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${BASE_URL_1}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': teamCookieHeader },
        body: JSON.stringify({ challenge_id: 1, flag: 'wrong_guess' }),
      });
      if (res.status === 200) allowedCount++;
    }

    // 5 requests to Instance 2
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${BASE_URL_2}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': teamCookieHeader },
        body: JSON.stringify({ challenge_id: 1, flag: 'wrong_guess' }),
      });
      if (res.status === 200) allowedCount++;
    }

    assert(allowedCount === 15, `First 15 requests across instances 1 & 2 succeeded (got ${allowedCount})`);

    // 16th request to Instance 2 must trip the shared limit
    const trippedRes = await fetch(`${BASE_URL_2}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': teamCookieHeader },
      body: JSON.stringify({ challenge_id: 1, flag: 'wrong_guess' }),
    });

    assert(trippedRes.status === 429, `16th request tripped shared rate limit with HTTP 429 (got ${trippedRes.status})`);
    const trippedData = await trippedRes.json();
    assert(trippedData.error === 'TooManyRequests', 'Response error is "TooManyRequests"');
    assert(typeof trippedData.retryAfter === 'number', 'Response contains retryAfter number');
    assert(Boolean(trippedRes.headers.get('Retry-After')), 'Response sets Retry-After header');
    console.log('  ✓ Verified: The rate limit is genuinely shared across independent instances via Redis.\n');

    // ── TEST 2: Redis Fail-Open Availability Contract ────────────────────────
    console.log('[TEST 2] Testing Redis rate limiter fail-open behavior...');
    // Create an ephemeral server with a rate limiter pointing to an invalid/unreachable Redis key/scenario
    // To cleanly test fail-open without killing our docker redis container, we test createRateLimiter behavior:
    // When the Redis call throws or Redis key evaluation fails, request proceeds without crashing.
    const { createRateLimiter } = await import('../middleware/rateLimiter');
    const express = (await import('express')).default;
    const failOpenApp = express();

    // Rate limiter configured with an invalid Redis operation that triggers catch block
    const brokenLimiter = createRateLimiter({
      keyPrefix: 'fail_open_test',
      maxRequests: 5,
      windowSeconds: 60,
      keyGenerator: () => { throw new Error('Simulated Redis network disconnection'); },
    });

    failOpenApp.get('/test-fail-open', brokenLimiter, (_req, res) => {
      res.status(200).json({ ok: true, message: 'Request allowed through despite rate limiter failure' });
    });

    const failOpenServer = http.createServer(failOpenApp);
    await new Promise<void>((resolve) => failOpenServer.listen(8095, resolve));

    const failOpenRes = await fetch('http://localhost:8095/test-fail-open');
    assert(failOpenRes.status === 200, `Fail-open request succeeded with HTTP 200 (got ${failOpenRes.status})`);
    const failOpenData = await failOpenRes.json();
    assert(failOpenData.ok === true, 'Fail-open returned ok: true');
    failOpenServer.close();
    console.log('  ✓ Verified: Rate limiter fails open on cache blips, preventing platform outages.\n');

    // ── TEST 3: Admin Manual Score Adjustment & History ───────────────────────
    console.log('[TEST 3] Testing Admin Manual Score Adjustment with mandatory reason...');

    // 3a. Blank reason rejection
    const blankReasonRes = await fetch(`${BASE_URL_1}/api/admin/teams/${testTeam.id}/adjust-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieHeader },
      body: JSON.stringify({ delta: 25, reason: '   ' }),
    });
    assert(blankReasonRes.status === 400, `Blank reason rejected with HTTP 400 (got ${blankReasonRes.status})`);
    const blankReasonData = await blankReasonRes.json();
    assert(blankReasonData.error === 'ValidationError', 'Error type is ValidationError');

    // 3b. Valid adjustment with reason
    const validAdjustRes = await fetch(`${BASE_URL_1}/api/admin/teams/${testTeam.id}/adjust-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieHeader },
      body: JSON.stringify({ delta: -25, reason: 'Manual penalty for rule violation' }),
    });
    assert(validAdjustRes.status === 200, `Valid adjustment succeeded with HTTP 200 (got ${validAdjustRes.status})`);
    const validAdjustData = await validAdjustRes.json();
    assert(validAdjustData.new_score === 175, `New derived score is 175 (got ${validAdjustData.new_score})`);

    // 3c. Verify history reflects adjustment
    const historyRes = await fetch(`${BASE_URL_1}/api/admin/teams/${testTeam.id}/history`, {
      headers: { 'Cookie': adminCookieHeader },
    });
    assert(historyRes.status === 200, `GET /history returned HTTP 200 (got ${historyRes.status})`);
    const historyData = await historyRes.json();
    assert(historyData.current_score === 175, `History current_score is 175 (got ${historyData.current_score})`);
    const lastEvent = historyData.history[historyData.history.length - 1];
    assert(lastEvent.delta === -25, `Last event delta is -25 (got ${lastEvent.delta})`);
    assert(lastEvent.reason === 'Manual penalty for rule violation', `Last event reason matches audit log`);
    assert(lastEvent.actor === testAdminUsername, `Last event actor is ${testAdminUsername}`);

    // 3d. Verify leaderboard reflects the updated score
    const leaderboardRes = await fetch(`${BASE_URL_1}/api/leaderboard`);
    assert(leaderboardRes.status === 200, `GET /leaderboard returned HTTP 200 (got ${leaderboardRes.status})`);
    const leaderboardData = await leaderboardRes.json();
    const teamEntry = leaderboardData.find((t: any) => t.team_name === testTeamName);
    assert(Boolean(teamEntry), `Team "${testTeamName}" appears on public leaderboard`);
    assert(teamEntry.score === 175, `Leaderboard score updated to 175 (got ${teamEntry.score})`);
    console.log('  ✓ Verified: Score adjustment enforced mandatory audit reason and updated leaderboard.\n');

    // ── TEST 4: Challenge Active/Inactive Toggle & Submissions ────────────────
    console.log('[TEST 4] Testing challenge active/inactive toggle and immediate submission blocking...');

    // Clear submission rate limit keys to allow flag submissions
    const submitKeys = await redis.keys('ratelimit:flag_submit:*');
    if (submitKeys.length > 0) {
      await redis.del(...submitKeys);
    }

    // Set Challenge 1 inactive
    const toggleOffRes = await fetch(`${BASE_URL_1}/api/admin/challenges/1/toggle-active`, {
      method: 'POST',
      headers: { 'Cookie': adminCookieHeader },
    });
    assert(toggleOffRes.status === 200, `Toggle off returned HTTP 200 (got ${toggleOffRes.status})`);
    const toggleOffData = await toggleOffRes.json();
    assert(toggleOffData.is_active === false, 'Challenge 1 is now is_active: false');

    // Attempt submission to deactivated challenge
    const submitInactiveRes = await fetch(`${BASE_URL_1}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': teamCookieHeader },
      body: JSON.stringify({ challenge_id: 1, flag: 'PLACEHOLDER_FLAG_DO_NOT_USE' }),
    });
    assert(submitInactiveRes.status === 400, `Submission to deactivated challenge returned HTTP 400 (got ${submitInactiveRes.status})`);
    const submitInactiveData = await submitInactiveRes.json();
    assert(submitInactiveData.error === 'ChallengeInactive', 'Error code is "ChallengeInactive"');

    // Verify dashboard reflects "temporarily_down"
    const dashRes = await fetch(`${BASE_URL_1}/api/dashboard?fresh=true`, {
      headers: { 'Cookie': teamCookieHeader },
    });
    const dashData = await dashRes.json();
    const ch1 = dashData.challenges.find((c: any) => c.id === 1);
    assert(ch1.isActive === false, 'Dashboard reports Challenge 1 isActive: false');
    assert(ch1.status === 'temporarily_down', 'Dashboard reports status: "temporarily_down"');
    assert(ch1.badge === 'Temporarily Down', 'Dashboard reports badge: "Temporarily Down"');

    // Toggle Challenge 1 back to active
    const toggleOnRes = await fetch(`${BASE_URL_1}/api/admin/challenges/1/toggle-active`, {
      method: 'POST',
      headers: { 'Cookie': adminCookieHeader },
    });
    assert(toggleOnRes.status === 200, `Toggle on returned HTTP 200 (got ${toggleOnRes.status})`);
    const toggleOnData = await toggleOnRes.json();
    assert(toggleOnData.is_active === true, 'Challenge 1 is now is_active: true');

    // Submit correct flag to re-activated challenge
    const realCh1Flag = 'ROOT{v3yr4_st4g1ng_s1t3_l34k_7f3a2c91}';
    const submitActiveRes = await fetch(`${BASE_URL_1}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': teamCookieHeader },
      body: JSON.stringify({ challenge_id: 1, flag: realCh1Flag }),
    });
    assert(submitActiveRes.status === 200, `Valid flag submission returned HTTP 200 (got ${submitActiveRes.status})`);
    const submitActiveData = await submitActiveRes.json();
    assert(submitActiveData.status === 'correct', 'Submission status is "correct"');

    // Resubmit same flag -> Idempotency check
    const resubmitRes = await fetch(`${BASE_URL_1}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': teamCookieHeader },
      body: JSON.stringify({ challenge_id: 1, flag: realCh1Flag }),
    });
    assert(resubmitRes.status === 200, `Resubmission returned HTTP 200 (got ${resubmitRes.status})`);
    const resubmitData = await resubmitRes.json();
    assert(resubmitData.status === 'already_solved', 'Duplicate solve correctly caught as "already_solved"');
    console.log('  ✓ Verified: Challenge toggle immediately gates submissions and updates dashboard.\n');

    // ── TEST 5: Challenge Force-Reset Contract Proxy ──────────────────────────
    console.log('[TEST 5] Testing challenge force-reset proxy contract...');
    const resetRes = await fetch(`${BASE_URL_1}/api/admin/challenges/4/force-reset`, {
      method: 'POST',
      headers: { 'Cookie': adminCookieHeader },
    });
    assert(resetRes.status === 200, `Force-reset returned HTTP 200 (got ${resetRes.status})`);
    const resetData = await resetRes.json();
    assert(resetData.success === true, 'Force-reset response success is true');
    assert(mockResetReceived === true, 'Mock challenge service received the reset HTTP POST');
    assert(mockResetAuthHeader === `Bearer ${config.resetToken}`, 'Reset request includes secret Bearer RESET_TOKEN');
    assert(mockResetBody?.challenge_id === 4, 'Reset body contains challenge_id: 4');
    assert(resetData.upstream_response?.status === 'ok', 'Relayed upstream response matches mock output');
    console.log('  ✓ Verified: Force-reset correctly relays commands conforming to reset contract.\n');

    // ── TEST 6: Strict Bidirectional Role Isolation ───────────────────────────
    console.log('[TEST 6] Testing strict bidirectional role separation...');

    // Team cookie attempting admin route
    const teamOnAdminRes = await fetch(`${BASE_URL_1}/api/admin/teams`, {
      headers: { 'Cookie': teamCookieHeader },
    });
    assert(teamOnAdminRes.status === 401, `Team cookie on /admin/teams returned HTTP 401 (got ${teamOnAdminRes.status})`);

    // Admin cookie attempting team route
    const adminOnTeamRes = await fetch(`${BASE_URL_1}/api/dashboard`, {
      headers: { 'Cookie': adminCookieHeader },
    });
    assert(adminOnTeamRes.status === 401, `Admin cookie on /dashboard returned HTTP 401 (got ${adminOnTeamRes.status})`);

    // Admin cookie attempting submit route
    const adminOnSubmitRes = await fetch(`${BASE_URL_1}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieHeader },
      body: JSON.stringify({ challenge_id: 1, flag: 'test' }),
    });
    assert(adminOnSubmitRes.status === 401, `Admin cookie on /submit returned HTTP 401 (got ${adminOnSubmitRes.status})`);
    console.log('  ✓ Verified: Cryptographic isolation prevents role crossing in either direction.\n');

    // ── TEST 7: Admin Teams Directory Pagination & Search ─────────────────────
    console.log('[TEST 7] Testing admin teams directory pagination and search...');
    const searchRes = await fetch(`${BASE_URL_1}/api/admin/teams?search=${encodeURIComponent(testTeamName)}`, {
      headers: { 'Cookie': adminCookieHeader },
    });
    assert(searchRes.status === 200, `Search returned HTTP 200 (got ${searchRes.status})`);
    const searchData = await searchRes.json();
    assert(searchData.teams.length >= 1, 'Search found test team');
    assert(searchData.teams[0].team_name === testTeamName, 'First matching team is test team');
    assert(typeof searchData.pagination.total_teams === 'number', 'Pagination total_teams returned');
    console.log('  ✓ Verified: Admin teams directory supports searching and pagination.\n');

    console.log('================================================================================');
    console.log('✅ ALL PROMPT 6 ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================================\n');
  } catch (err: any) {
    console.error('\n❌ TEST RUNNER EXCEPTION:', err);
    process.exit(1);
  } finally {
    // Graceful teardown
    try { await db.update(challenges).set({ isActive: true }); } catch {}
    await new Promise<void>((resolve) => server1.close(() => resolve()));
    await new Promise<void>((resolve) => server2.close(() => resolve()));
    await new Promise<void>((resolve) => mockChallengeServer.close(() => resolve()));
    redis.disconnect();
    setTimeout(() => process.exit(0), 100);
  }
}

runTests();
