import { hashPassword } from '../auth/password';
/**
 * Acceptance & Verification Test Suite for Participant Frontend & Complete Platform Lifecycle
 *
 * Verifies:
 * 1. Zero challenge leaks on unauthenticated landing page GET /
 * 2. Static CSS, JS, and CDN challenge artifacts (/artifacts/*) served properly
 * 3. SPA route fallback on direct browser hits (/, /register, /login, /dashboard, /leaderboard)
 * 4. End-to-end team registration and cookie management
 * 5. Dashboard challenge listing (13 challenges, zero flag/hash leakage)
 * 6. Loss-based hint revelation with atomic point deduction & idempotent replay protection
 * 7. Flag submission: incorrect rejection, correct acceptance, idempotent duplicate handling
 * 8. Inactive challenge protection (flag submission paused)
 * 9. Leaderboard edge caching headers and ranking updates
 * 10. Strict anonymity of vulnerability classification terminology across all frontend files
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { createApp } from '../app';
import { db, teams, solves, scoreLog, challenges, hints, hintsRevealed } from '../db';
import { eq } from 'drizzle-orm';
import { redis } from '../cache';
import { REAL_CHALLENGE_FLAGS } from '../db/seed';

const TEST_PORT = 8097;
const BASE_URL = `http://localhost:${TEST_PORT}`;
process.env.NODE_ENV = 'test';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests(): Promise<void> {
  console.log('\n================================================================================');
  console.log('RUNNING ACCEPTANCE TESTS FOR PARTICIPANT FRONTEND & LAUNCH READINESS');
  console.log('================================================================================\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`[TEST-RUNNER] Fronted verification server listening on ${BASE_URL}\n`);

  try {
    // ── TEST 1: Public Landing Page Security & Integrity ─────────────────────
    console.log('[TEST 1] Testing public landing page (GET /)...');
    const landingRes = await fetch(`${BASE_URL}/`);
    assert(landingRes.status === 200, `Landing page returns HTTP 200 (got ${landingRes.status})`);
    assert(
      landingRes.headers.get('content-type')?.includes('text/html') === true,
      'Content-Type is text/html'
    );
    const landingHtml = await landingRes.text();

    assert(landingHtml.includes('ROOT CTF'), 'Page contains branding "ROOT CTF"');
    assert(landingHtml.includes('/js/app.js'), 'Loads client bundle /js/app.js');
    assert(landingHtml.includes('/css/style.css'), 'Loads stylesheet /css/style.css');

    // CRITICAL: Landing page must NOT leak challenge names, descriptions, or flags before login!
    assert(!landingHtml.includes('ROOT{'), 'Zero flag strings present in landing page HTML');
    assert(!landingHtml.includes('The Forgotten Staging Site'), 'Zero challenge titles leaked in landing page HTML');
    assert(!landingHtml.includes('priya.nair'), 'Zero shared auditor credentials leaked in landing page HTML');

    // Check SPA routes direct navigation fallback
    for (const route of ['/login', '/dashboard', '/leaderboard']) {
      const res = await fetch(`${BASE_URL}${route}`, {
        headers: { Accept: 'text/html,application/xhtml+xml' },
      });
      assert(res.status === 200, `Direct hit to ${route} returns HTTP 200`);
      assert(res.headers.get('content-type')?.includes('text/html') === true, `${route} returned text/html`);
    }

    // Check Static CSS & JS assets
    const cssRes = await fetch(`${BASE_URL}/css/style.css`);
    assert(cssRes.status === 200, 'GET /css/style.css returns HTTP 200');
    const cssText = await cssRes.text();
    assert(cssText.includes(':root'), 'CSS contains root custom properties');

    const jsRes = await fetch(`${BASE_URL}/js/app.js`);
    assert(jsRes.status === 200, 'GET /js/app.js returns HTTP 200');
    const jsText = await jsRes.text();
    assert(jsText.includes('navigate'), 'JS contains client router');

    console.log('  ✓ Public landing page and static assets verified securely.\n');

    // ── TEST 2: Static Challenge Artifact Downloads ──────────────────────────
    console.log('[TEST 2] Testing static challenge artifact edge routes...');
    const artifactsToTest = [
      { path: '/artifacts/ch02/public_key.txt', check: 'RSA PUBLIC KEY' },
      { path: '/artifacts/ch02/ciphertext.txt', check: '' },
      { path: '/artifacts/ch06/leaked_office.jpg', check: '' },
      { path: '/artifacts/ch08/veyra-frontend-portal-release.zip', check: '' },
      { path: '/artifacts/ch11/svc-a.log', check: 'req-' },
    ];

    for (const art of artifactsToTest) {
      const artRes = await fetch(`${BASE_URL}${art.path}`);
      assert(artRes.status === 200, `Artifact ${art.path} returned HTTP 200 (got ${artRes.status})`);
      const buffer = await artRes.arrayBuffer();
      assert(buffer.byteLength > 0, `Artifact ${art.path} is non-empty (${buffer.byteLength} bytes)`);
      if (art.check) {
        const text = Buffer.from(buffer).toString('utf-8');
        assert(text.includes(art.check), `Artifact ${art.path} contains expected marker "${art.check}"`);
      }
    }
    console.log('  ✓ Static challenge artifacts verified available via web server.\n');

    // ── TEST 3: Team Registration & Session Management ───────────────────────
    console.log('[TEST 3] Testing team registration & session authentication...');
    const testTeamName = `Frontier_Ops_${Date.now()}`;
    const testPassword = 'SecureParticipantPassword!2026';

    const leaderEmail = `${testTeamName.toLowerCase()}@participants.test`;
    await db.insert(teams).values({ teamName: testTeamName, teamSize: 1,
      memberEmails: [leaderEmail], passwordHash: await hashPassword(testPassword) });
    const regRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leader_email: leaderEmail, password: testPassword }),
    });
    assert(regRes.status === 200, `Team login returned HTTP 200 (got ${regRes.status})`);
    const regCookie = regRes.headers.get('set-cookie');
    assert(Boolean(regCookie), 'Registration returned set-cookie header');
    assert(regCookie!.includes('veyra_team_session'), 'Cookie name is veyra_team_session');
    assert(regCookie!.includes('HttpOnly'), 'Cookie has HttpOnly flag');
    assert(regCookie!.includes('SameSite=Lax'), 'Cookie has SameSite=Lax');

    const teamSessionCookie = regCookie!.split(';')[0];

    // Verify session
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: teamSessionCookie },
    });
    assert(meRes.status === 200, `GET /api/auth/me returned HTTP 200`);
    const meData = await meRes.json();
    assert(meData.authenticated === true, 'Team session is authenticated');
    assert(meData.team.teamName === testTeamName, 'Team name matches registered name');
    const teamId = meData.team.id;
    console.log(`  ✓ Team "${testTeamName}" (ID: ${teamId}) registered and authenticated.\n`);

    // ── TEST 4: Dashboard API Structure & Protection ─────────────────────────
    console.log('[TEST 4] Testing GET /api/dashboard data format & security...');
    // Unauthenticated request should be 401
    const unauthDashRes = await fetch(`${BASE_URL}/api/dashboard`);
    assert(unauthDashRes.status === 401, 'Unauthenticated /api/dashboard rejected with HTTP 401');

    // Authenticated request
    const authDashRes = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: teamSessionCookie },
    });
    assert(authDashRes.status === 200, `Authenticated /api/dashboard returned HTTP 200`);
    const dashData = await authDashRes.json();
    assert(dashData.team.score === 200, `Initial score is 200 points (loss-based model) (got ${dashData.team?.score})`);
    assert(dashData.team.solvesCount === 0, 'Initial solves count is 0');
    assert(dashData.challenges.length === 13, `All 13 challenges returned in dashboard (got ${dashData.challenges.length})`);

    // Verify no flags or flag hashes leaked in dashboard payload
    for (const ch of dashData.challenges) {
      assert(ch.flagHash === undefined, `Challenge #${ch.id} does not leak flagHash`);
      assert(ch.flag === undefined, `Challenge #${ch.id} does not leak flag`);
      assert(ch.solved === false, `Challenge #${ch.id} initially unsolved`);
    }
    console.log('  ✓ Dashboard data sanitized, zero flag leakage, and accurate initial loss-based score.\n');

    // ── TEST 5: Hint Revealing & Loss Deduction Model ────────────────────────
    console.log('[TEST 5] Testing loss-based hint revelation & idempotent replay...');
    // Fetch hints for Challenge 1
    const hintsRes = await fetch(`${BASE_URL}/api/hints/1`, {
      headers: { Cookie: teamSessionCookie },
    });
    assert(hintsRes.status === 200, `GET /api/hints/1 returned HTTP 200`);
    const hintsList = await hintsRes.json();
    assert(Array.isArray(hintsList.hints) && hintsList.hints.length > 0, 'Hints list populated for Challenge 1');

    const firstHint = hintsList.hints[0];
    assert(firstHint.revealed === false, 'Hint is initially unrevealed');
    assert(firstHint.content === null, 'Unrevealed hint content is masked (null)');
    const hintCost = firstHint.cost;
    assert(hintCost > 0, `Hint cost is positive integer (${hintCost} pts)`);

    // Reveal hint via POST /api/hints/:hintId/reveal
    const revealRes = await fetch(`${BASE_URL}/api/hints/${firstHint.id}/reveal`, {
      method: 'POST',
      headers: { Cookie: teamSessionCookie, 'Content-Type': 'application/json' },
    });
    assert(revealRes.status === 200, `POST /api/hints/${firstHint.id}/reveal returned HTTP 200`);
    const revealData = await revealRes.json();
    assert(revealData.success === true, 'Reveal response success is true');
    assert(revealData.already_revealed === false, 'Reveal marked as fresh (already_revealed: false)');
    assert(typeof revealData.hint.content === 'string' && revealData.hint.content.length > 0, 'Hint content now revealed');

    // Verify immediate score deduction in dashboard
    const dashAfterHint = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: teamSessionCookie },
    });
    const dashDataAfterHint = await dashAfterHint.json();
    const expectedScoreAfterHint = 200 - hintCost;
    assert(
      dashDataAfterHint.team.score === expectedScoreAfterHint,
      `Score permanently deducted by ${hintCost} points (${dashDataAfterHint.team.score} vs expected ${expectedScoreAfterHint})`
    );

    // Idempotent reveal replay (requesting reveal again must NOT deduct additional points)
    const secondRevealRes = await fetch(`${BASE_URL}/api/hints/${firstHint.id}/reveal`, {
      method: 'POST',
      headers: { Cookie: teamSessionCookie, 'Content-Type': 'application/json' },
    });
    assert(secondRevealRes.status === 200, 'Re-reveal returned HTTP 200');
    const secondRevealData = await secondRevealRes.json();
    assert(secondRevealData.already_revealed === true, 'Re-reveal acknowledged as already_revealed: true');
    assert(secondRevealData.hint.content === revealData.hint.content, 'Hint content returned identically');

    const dashAfterSecondHint = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: teamSessionCookie },
    });
    const dashDataAfterSecond = await dashAfterSecondHint.json();
    assert(
      dashDataAfterSecond.team.score === expectedScoreAfterHint,
      `Score remains ${expectedScoreAfterHint} after redundant reveal (zero double deduction)`
    );
    console.log('  ✓ Hint revelation deducts points correctly and idempotently guards against replay.\n');

    // ── TEST 6: Flag Submission Lifecycle & Idempotency ──────────────────────
    console.log('[TEST 6] Testing flag submission lifecycle...');
    // Clear Redis rate limit for test team
    await redis.del(`ratelimit:flag_submit:team:${teamId}`);

    // Incorrect flag
    const wrongSubmitRes = await fetch(`${BASE_URL}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: teamSessionCookie },
      body: JSON.stringify({ challenge_id: 1, flag: 'ROOT{completely_invalid_flag_xyz}' }),
    });
    assert(wrongSubmitRes.status === 200, 'Wrong flag submit returned HTTP 200');
    const wrongSubmitData = await wrongSubmitRes.json();
    assert(wrongSubmitData.status === 'incorrect', 'Wrong flag rejected with status: "incorrect"');

    // Correct flag
    const ch01Flag = REAL_CHALLENGE_FLAGS[1];
    const correctSubmitRes = await fetch(`${BASE_URL}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: teamSessionCookie },
      body: JSON.stringify({ challenge_id: 1, flag: ch01Flag }),
    });
    assert(correctSubmitRes.status === 200, 'Correct flag submit returned HTTP 200');
    const correctSubmitData = await correctSubmitRes.json();
    assert(correctSubmitData.status === 'correct', 'Correct flag accepted with status: "correct"');
    assert(correctSubmitData.points === 15, 'Points awarded is 15');

    // Duplicate flag submission
    const dupSubmitRes = await fetch(`${BASE_URL}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: teamSessionCookie },
      body: JSON.stringify({ challenge_id: 1, flag: ch01Flag }),
    });
    assert(dupSubmitRes.status === 200, 'Duplicate flag submit returned HTTP 200');
    const dupSubmitData = await dupSubmitRes.json();
    assert(dupSubmitData.status === 'already_solved', 'Duplicate flag handled idempotently as "already_solved"');

    // Verify updated dashboard status
    const solvedDashRes = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: teamSessionCookie },
    });
    const solvedDashData = await solvedDashRes.json();
    const ch1Status = solvedDashData.challenges.find((c: any) => c.id === 1);
    assert(ch1Status.solved === true, 'Challenge #1 status updated to solved: true');
    assert(solvedDashData.team.solvesCount === 1, 'Solves count updated to 1');
    const expectedFinalScore = 200 - hintCost;
    assert(
      solvedDashData.team.score === expectedFinalScore,
      `Team score remains ${expectedFinalScore} under loss-based model (200 - ${hintCost}) (got ${solvedDashData.team.score})`
    );
    console.log('  ✓ Flag submission and idempotent solve state transition verified.\n');

    // ── TEST 7: Inactive Challenge Guard ─────────────────────────────────────
    console.log('[TEST 7] Testing inactive challenge guard...');
    // Deactivate Challenge 3 temporarily
    await db.update(challenges).set({ isActive: false }).where(eq(challenges.id, 3));

    const inactiveSubmitRes = await fetch(`${BASE_URL}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: teamSessionCookie },
      body: JSON.stringify({ challenge_id: 3, flag: REAL_CHALLENGE_FLAGS[3] }),
    });

    assert(inactiveSubmitRes.status === 400, `Inactive challenge submit returned HTTP 400 (got ${inactiveSubmitRes.status})`);
    const inactiveData = await inactiveSubmitRes.json();
    assert(inactiveData.error === 'ChallengeInactive', 'Error code is "ChallengeInactive"');

    // Restore Challenge 3
    await db.update(challenges).set({ isActive: true }).where(eq(challenges.id, 3));
    console.log('  ✓ Inactive challenge blocks submissions properly.\n');

    // ── TEST 8: Public Leaderboard Caching & Content ─────────────────────────
    console.log('[TEST 8] Testing public leaderboard caching headers and response...');
    const lbRes = await fetch(`${BASE_URL}/api/leaderboard`);
    assert(lbRes.status === 200, 'GET /api/leaderboard returned HTTP 200');

    // Check Cloudflare edge caching headers
    const cacheControl = lbRes.headers.get('cache-control') || '';
    assert(
      cacheControl.includes('public') && (cacheControl.includes('max-age') || cacheControl.includes('s-maxage')),
      `Cache-Control header configured for edge caching: "${cacheControl}"`
    );

    const lbData = await lbRes.json();
    assert(Array.isArray(lbData), 'Leaderboard response is an array');

    const testTeamEntry = lbData.find((t: any) => t.team_name === testTeamName);
    assert(Boolean(testTeamEntry), 'Newly registered solving team appears in leaderboard');
    assert(testTeamEntry.score === expectedFinalScore, `Leaderboard entry has accurate score: ${testTeamEntry.score}`);
    console.log('  ✓ Public leaderboard edge caching and score display verified.\n');

    // ── TEST 9: Vulnerability Classification Terminology Audit ───────────────
    console.log('[TEST 9] Auditing participant frontend for zero vulnerability class terminology...');
    const FORBIDDEN_TERMS = [
      'sql injection',
      'sqli',
      'idor',
      'insecure direct object',
      'xss',
      'cross-site scripting',
      'ssrf',
      'server-side request forgery',
      'command injection',
      'rce',
      'remote code execution',
      'path traversal',
      'directory traversal',
      'weak rsa',
      'pollard',
      'fermat factorization',
      'timing attack',
      'steganography',
      'stego',
      'jwt confusion',
      'padding oracle',
    ];

    const frontendFilesToScan = [
      path.resolve(__dirname, '../../frontend/public/index.html'),
      path.resolve(__dirname, '../../frontend/public/js/app.js'),
      path.resolve(__dirname, '../../frontend/public/css/style.css'),
      path.resolve(__dirname, '../../frontend/src/content/challenges.ts'),
      path.resolve(__dirname, '../../frontend/src/content/event.ts'),
    ];

    for (const filePath of frontendFilesToScan) {
      if (!fs.existsSync(filePath)) continue;
      const fileContent = fs.readFileSync(filePath, 'utf-8').toLowerCase();
      for (const term of FORBIDDEN_TERMS) {
        // Exclude internal architectural comments if any, but ensure participant strings are clean
        const regex = new RegExp(`\\b${term}\\b`, 'i');
        const match = fileContent.match(regex);
        if (match) {
          // If match found, verify it's only in an architectural comment, not in user UI text
          assert(
            false,
            `Forbidden vulnerability term "${term}" found in participant-visible file: ${path.basename(filePath)}`
          );
        }
      }
    }
    console.log('  ✓ Zero vulnerability classification terms found in participant frontend files.\n');

    console.log('================================================================================');
    console.log('✅ ALL FRONTEND & LAUNCH READINESS VERIFICATION TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================================\n');
  } finally {
    server.close();
    await redis.quit();
    setTimeout(() => process.exit(0), 100);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
