/**
 * Challenge Reset Service URL Map
 *
 * Maps each of the 13 ROOT CTF challenges to its internal backend service base URL.
 *
 * ARCHITECTURAL CONTRACT:
 * ==============================================================================
 * Challenges are independently deployed and isolated (some static, some containerized
 * backend microservices). When an admin requests a "force reset", the platform
 * communicates with the target service via a standardized HTTP reset contract:
 *
 *   POST {challenge_service_base_url}/reset/{challenge_id}
 *   Headers: Authorization: Bearer {RESET_TOKEN}
 *   Response: { "status": "ok", "challenge_id": "...", "reset_at": "..." }
 *            or { "status": "error", "message": "..." }
 *
 * Why this indirection matters:
 * The scoring platform never needs to know HOW a challenge resets internally
 * (e.g., clearing an in-memory session map, rebuilding an SQLite DB, wiping a
 * temporary sandbox container, or re-seeding dummy invoice records). It only
 * relies on this single identical HTTP contract across all 13 targets.
 * ==============================================================================
 */

export interface ChallengeServiceConfig {
  id: number;
  name: string;
  isDynamic: boolean;
  envVar: string;
  defaultUrl: string;
}

export const CHALLENGE_SERVICES: Record<number, ChallengeServiceConfig> = {
  1: { id: 1, name: 'The Forgotten Staging Site', isDynamic: false, envVar: 'CHALLENGE_01_URL', defaultUrl: '' },
  2: { id: 2, name: 'The Broken Lock', isDynamic: false, envVar: 'CHALLENGE_02_URL', defaultUrl: '' },
  3: { id: 3, name: 'The Twitter Trail', isDynamic: false, envVar: 'CHALLENGE_03_URL', defaultUrl: '' },
  4: { id: 4, name: 'The Employee Portal', isDynamic: true, envVar: 'CHALLENGE_04_URL', defaultUrl: 'http://localhost:3004' },
  5: { id: 5, name: 'Who Is Ethan Cole?', isDynamic: true, envVar: 'CHALLENGE_05_URL', defaultUrl: 'http://localhost:3005' },
  6: { id: 6, name: 'The Leaked Photo', isDynamic: false, envVar: 'CHALLENGE_06_URL', defaultUrl: '' },
  7: { id: 7, name: 'The Invoice Trail', isDynamic: true, envVar: 'CHALLENGE_07_URL', defaultUrl: 'http://localhost:3007' },
  // Challenge 08 shares the same underlying Veyra enterprise app as Challenge 07 on port 3007
  8: { id: 8, name: 'The Internal Dashboard', isDynamic: true, envVar: 'CHALLENGE_08_URL', defaultUrl: 'http://localhost:3007' },
  9: { id: 9, name: 'The Session Bug', isDynamic: true, envVar: 'CHALLENGE_09_URL', defaultUrl: 'http://localhost:3009' },
  10: { id: 10, name: 'The Config Backup', isDynamic: true, envVar: 'CHALLENGE_10_URL', defaultUrl: 'http://localhost:3010' },
  11: { id: 11, name: 'The Debug Trace', isDynamic: false, envVar: 'CHALLENGE_11_URL', defaultUrl: '' },
  12: { id: 12, name: 'The Diagnostics Backdoor', isDynamic: true, envVar: 'CHALLENGE_12_URL', defaultUrl: 'http://localhost:3012' },
  13: { id: 13, name: 'The Admin Cover-Up (Final)', isDynamic: true, envVar: 'CHALLENGE_13_URL', defaultUrl: 'http://localhost:3013' },
};

/**
 * Returns the configured base service URL for a challenge.
 * Reads from process.env, falling back to defaultUrl if present.
 */
export function getChallengeBaseUrl(challengeId: number): string | null {
  const service = CHALLENGE_SERVICES[challengeId];
  if (!service) return null;

  const envVal = process.env[service.envVar]?.trim();
  if (envVal) return envVal;

  return service.defaultUrl || null;
}
