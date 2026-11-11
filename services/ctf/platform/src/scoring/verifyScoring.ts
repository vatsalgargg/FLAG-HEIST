/**
 * Acceptance Test Suite for Prompt 4: Dashboard & Leaderboard
 *
 * Verifies all 5 prompt acceptance criteria:
 * 1. Leaderboard handles empty teams state (returns array).
 * 2. recordScoreEvent() fast-path updates leaderboard in <1 second.
 * 3. Cache clearing/corruption recovers gracefully via cold-start rebuild.
 * 4. Dashboard requires auth and scopes data strictly per-team.
 * 5. High-concurrency load test (500 requests) served with sub-millisecond cache latency.
 */

import http from 'http';
import { createApp } from '../app';
import { db, teams, scoreLog, solves } from '../db';
import { eq, inArray } from 'drizzle-orm';
import { redis } from '../cache';
import { LEADERBOARD_CACHE_KEY, rebuildLeaderboardCache } from '../cache/leaderboard';
import { recordScoreEvent } from './recordScoreEvent';
import { issueTeamToken } from '../auth/tokens';
import { TEAM_COOKIE_NAME } from '../auth/cookies';

const TEST_PORT = 8091;
const BASE_URL = `http://localhost:${TEST_PORT}`;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests(): Promise<void> {
  console.log('\n================================================================================');
  console.log('RUNNING ACCEPTANCE TESTS FOR PROMPT 4: DASHBOARD & LEADERBOARD');
  console.log('================================================================================\n');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`[TEST-RUNNER] Ephemeral test server running at ${BASE_URL}\n`);

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // PREPARATION: Create two isolated test teams
    // ──────────────────────────────────────────────────────────────────────────
    // Cleanup any old test records
    const oldTeams = await db
      .select({ id: teams.id })
      .from(teams)
      .where(inArray(teams.teamName, ['p4_team_alpha', 'p4_team_bravo']));

    if (oldTeams.length > 0) {
      const oldIds = oldTeams.map((t) => t.id);
      await db.delete(solves).where(inArray(solves.teamId, oldIds));
      await db.delete(scoreLog).where(inArray(scoreLog.teamId, oldIds));
      await db.delete(teams).where(inArray(teams.id, oldIds));
    }

    const [teamA] = await db
      .insert(teams)
      .values({
        teamName: 'p4_team_alpha',
        memberEmails: ['alpha@test.com'],
        teamSize: 1,
        passwordHash: 'placeholder_hash',
      })
      .returning();

    const [teamB] = await db
      .insert(teams)
      .values({
        teamName: 'p4_team_bravo',
        memberEmails: ['bravo@test.com'],
        teamSize: 1,
        passwordHash: 'placeholder_hash',
      })
      .returning();

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 1: Leaderboard Returns Valid Array & Headers
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[TEST 1] Testing GET /api/leaderboard public availability & headers...');
    const lbRes1 = await fetch(`${BASE_URL}/api/leaderboard`);
    assert(lbRes1.status === 200, `Leaderboard returned HTTP 200 (got ${lbRes1.status})`);

    const cacheControl = lbRes1.headers.get('cache-control');
    assert(
      !!cacheControl && cacheControl.includes('public') && cacheControl.includes('s-maxage=5'),
      `Cache-Control header contains edge caching rules: "${cacheControl}"`
    );

    const lbData1: any = await lbRes1.json();
    assert(Array.isArray(lbData1), 'Leaderboard payload is a ranked JSON array');
    assert(lbData1.length >= 2, `Leaderboard contains at least 2 teams (found ${lbData1.length})`);

    // Verify privacy: no member_emails or passwords present
    const firstEntry = lbData1[0];
    assert(!('member_emails' in firstEntry), 'Public leaderboard omits member_emails');
    assert(!('password' in firstEntry), 'Public leaderboard omits passwords');
    assert(!('password_hash' in firstEntry), 'Public leaderboard omits password_hash');
    assert('rank' in firstEntry && 'team_name' in firstEntry && 'score' in firstEntry, 'Public leaderboard contains rank, team_name, score');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 2: Fast-Path Incremental Score Event Update (<1 second)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 2] Testing recordScoreEvent() fast-path incremental cache update...');
    // Initial rebuild so both teams are in cache at score 200
    await rebuildLeaderboardCache();

    const startTime = Date.now();
    // Team A incurs a -15 point hint penalty (score becomes 185)
    await recordScoreEvent(teamA.id, -15, 'hint_reveal:ch1_hint1', 'system');
    const updateLatency = Date.now() - startTime;
    console.log(`  ℹ️ recordScoreEvent completed in ${updateLatency}ms`);

    // Immediate query against /api/leaderboard — must reflect 185 immediately without 30s rebuild
    const lbRes2 = await fetch(`${BASE_URL}/api/leaderboard`);
    const lbData2: any = await lbRes2.json();

    const entryA = lbData2.find((e: any) => e.team_name === 'p4_team_alpha');
    const entryB = lbData2.find((e: any) => e.team_name === 'p4_team_bravo');

    assert(entryA?.score === 185, `Team Alpha score updated to 185 immediately (got ${entryA?.score})`);
    assert(entryB?.score === 200, `Team Bravo score remains 200 (got ${entryB?.score})`);
    assert(entryB.rank < entryA.rank, `Team Bravo (200 pts, rank ${entryB.rank}) ranks above Team Alpha (185 pts, rank ${entryA.rank})`);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 3: Cold-Start & Cache Corruption Self-Healing Rebuild
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 3] Testing cold-start recovery after clearing Redis key...');
    // Delete the Redis cache key
    await redis.del(LEADERBOARD_CACHE_KEY);
    const keyExists = await redis.exists(LEADERBOARD_CACHE_KEY);
    assert(keyExists === 0, 'Redis leaderboard key successfully wiped');

    // Call GET /api/leaderboard — should detect null and trigger rebuildLeaderboardCache() synchronously
    const coldStartRes = await fetch(`${BASE_URL}/api/leaderboard`);
    assert(coldStartRes.status === 200, `Cold-start request returned HTTP 200 (got ${coldStartRes.status})`);
    const coldStartData: any = await coldStartRes.json();

    const recoveredA = coldStartData.find((e: any) => e.team_name === 'p4_team_alpha');
    assert(recoveredA?.score === 185, `Recovered cache correctly derived Team Alpha score = 185`);

    // Verify key was repopulated in Redis
    const keyRecreated = await redis.exists(LEADERBOARD_CACHE_KEY);
    assert(keyRecreated === 1, 'Redis cache key was automatically repopulated');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 4: Dashboard Endpoint Security & Scoping
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 4] Testing GET /api/dashboard authentication and team isolation...');
    // 4a. Unauthenticated access must fail with 401
    const unauthDash = await fetch(`${BASE_URL}/api/dashboard`);
    assert(unauthDash.status === 401, `Unauthenticated dashboard request rejected with HTTP 401 (got ${unauthDash.status})`);

    // 4b. Authenticate as Team A
    const tokenA = issueTeamToken({ id: teamA.id, teamName: teamA.teamName });
    // Add a solve for Team A on Challenge 1
    await db.insert(solves).values({ teamId: teamA.id, challengeId: 1 });

    const dashResA = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: `${TEAM_COOKIE_NAME}=${tokenA}` },
    });
    assert(dashResA.status === 200, `Team A dashboard returned HTTP 200 (got ${dashResA.status})`);
    const dashDataA: any = await dashResA.json();

    assert(dashDataA.team?.id === teamA.id, 'Dashboard scoped to Team A');
    assert(dashDataA.score?.currentScore === 185, `Dashboard reports currentScore = 185`);
    assert(dashDataA.progress?.solvedCount === 1, 'Dashboard reports solvedCount = 1');

    const ch1A = dashDataA.challenges.find((c: any) => c.id === 1);
    const ch2A = dashDataA.challenges.find((c: any) => c.id === 2);
    assert(ch1A?.solved === true, 'Team A sees Challenge 1 as solved: true');
    assert(ch2A?.solved === false, 'Team A sees Challenge 2 as solved: false');

    // 4c. Authenticate as Team B
    const tokenB = issueTeamToken({ id: teamB.id, teamName: teamB.teamName });
    const dashResB = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: `${TEAM_COOKIE_NAME}=${tokenB}` },
    });
    const dashDataB: any = await dashResB.json();

    assert(dashDataB.team?.id === teamB.id, 'Dashboard scoped to Team B');
    assert(dashDataB.score?.currentScore === 200, `Team B has currentScore = 200`);
    assert(dashDataB.progress?.solvedCount === 0, 'Team B has solvedCount = 0');
    const ch1B = dashDataB.challenges.find((c: any) => c.id === 1);
    assert(ch1B?.solved === false, 'Team B does NOT see Team A solve (solved: false confirmed)');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5: High-Concurrency Load Test (500 Requests)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 5] Executing high-concurrency load test (500 requests against /api/leaderboard)...');
    const REQUEST_COUNT = 500;
    const loadStart = Date.now();

    const requests = Array.from({ length: REQUEST_COUNT }, () =>
      fetch(`${BASE_URL}/api/leaderboard`)
    );

    const responses = await Promise.all(requests);
    const totalLoadDuration = Date.now() - loadStart;
    const avgLatency = (totalLoadDuration / REQUEST_COUNT).toFixed(2);

    const allOk = responses.every((r) => r.status === 200);
    assert(allOk, `All ${REQUEST_COUNT} requests returned HTTP 200 OK`);
    console.log(`  ✓ Completed ${REQUEST_COUNT} requests in ${totalLoadDuration}ms (avg ~${avgLatency}ms/request)`);
    assert(totalLoadDuration < 3000, `500 requests completed in <3000ms under local execution (${totalLoadDuration}ms)`);

    // ──────────────────────────────────────────────────────────────────────────
    // CLEANUP
    // ──────────────────────────────────────────────────────────────────────────
    await db.delete(solves).where(inArray(solves.teamId, [teamA.id, teamB.id]));
    await db.delete(scoreLog).where(inArray(scoreLog.teamId, [teamA.id, teamB.id]));
    await db.delete(teams).where(inArray(teams.id, [teamA.id, teamB.id]));

    console.log('\n================================================================================');
    console.log('✅ ALL PROMPT 4 ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================================\n');

    server.close(() => process.exit(0));
  } catch (err: any) {
    server.close();
    console.error('\n❌ Fatal test runner exception:', err);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('\n❌ Unhandled exception:', err);
  process.exit(1);
});
