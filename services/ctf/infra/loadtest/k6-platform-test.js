import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

/**
 * ROOT CTF — Production Scalability & Concurrency Load Test (k6)
 *
 * SPECIFICATION TARGET:
 * - 5,000 to 10,000 peak concurrent participants
 * - Realistic traffic distribution:
 *   - 80% Public Leaderboard reads (Edge / Redis fast-path)
 *   - 15% Authenticated Dashboard refreshes
 *   - 5% Flag submissions
 * - Strict latency thresholds:
 *   - Leaderboard p95 latency < 50ms
 *   - Error rate < 1.0%
 */

// Custom metrics
const leaderboardDuration = new Trend('leaderboard_duration_ms');
const dashboardDuration = new Trend('dashboard_duration_ms');
const submitDuration = new Trend('submit_duration_ms');
const failedRequests = new Rate('failed_requests');

export const options = {
  stages: [
    { duration: '30s', target: 500 },   // Warm-up ramp
    { duration: '1m',  target: 2000 },  // Standard event load
    { duration: '1m',  target: 5000 },  // Peak traffic burst (e.g. Kickoff / Hour 71)
    { duration: '30s', target: 1000 },  // Scale-down
    { duration: '15s', target: 0 },     // Drain
  ],
  thresholds: {
    'http_req_failed': ['rate<0.01'],              // Max 1% error rate
    'leaderboard_duration_ms': ['p(95)<50'],       // 95% of leaderboard queries < 50ms
    'http_req_duration{endpoint:leaderboard}': ['p(95)<50'],
    'http_req_duration': ['p(99)<250'],           // Overall p99 under 250ms
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';
const SAMPLE_TEAM_TOKEN = __ENV.SAMPLE_TEAM_TOKEN || '';

export default function () {
  const rand = Math.random();

  // ── 1. 80% Public Leaderboard Reads (Edge Cache & Redis Fast-Path) ─────────
  if (rand < 0.80) {
    const res = http.get(`${BASE_URL}/api/leaderboard`, {
      tags: { endpoint: 'leaderboard' },
      headers: {
        'Accept': 'application/json',
      },
    });

    leaderboardDuration.add(res.timings.duration);
    const success = check(res, {
      'leaderboard status is 200': (r) => r.status === 200,
      'cache header present': (r) => r.headers['Cache-Control'] !== undefined,
    });
    if (!success) failedRequests.add(1);

    // Participants refresh or poll leaderboard every 10-15s
    sleep(Math.random() * 2 + 1);
  }
  // ── 2. 15% Authenticated Dashboard Refreshes ──────────────────────────────
  else if (rand < 0.95) {
    const params = {
      tags: { endpoint: 'dashboard' },
      headers: {
        'Accept': 'application/json',
      },
    };

    if (SAMPLE_TEAM_TOKEN) {
      params.headers['Cookie'] = `veyra_team_session=${SAMPLE_TEAM_TOKEN}`;
    }

    const res = http.get(`${BASE_URL}/api/dashboard`, params);
    dashboardDuration.add(res.timings.duration);

    const success = check(res, {
      'dashboard status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    });
    if (!success) failedRequests.add(1);

    sleep(Math.random() * 3 + 2);
  }
  // ── 3. 5% Flag Submissions ────────────────────────────────────────────────
  else {
    const chId = Math.floor(Math.random() * 13) + 1;
    const payload = JSON.stringify({
      challenge_id: chId,
      flag: `ROOT{load_test_guess_${Math.floor(Math.random() * 100000)}}`,
    });

    const params = {
      tags: { endpoint: 'submit' },
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (SAMPLE_TEAM_TOKEN) {
      params.headers['Cookie'] = `veyra_team_session=${SAMPLE_TEAM_TOKEN}`;
    }

    const res = http.post(`${BASE_URL}/api/submit`, payload, params);
    submitDuration.add(res.timings.duration);

    const success = check(res, {
      'submit status is expected': (r) => [200, 400, 401, 429].includes(r.status),
    });
    if (!success) failedRequests.add(1);

    sleep(Math.random() * 4 + 2);
  }
}
