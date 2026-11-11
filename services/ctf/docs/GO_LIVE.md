# ROOT CTF 2026 — Production Go-Live Operations Guide

This document is the operational playbook for organisers, infrastructure engineers, and incident responders running **ROOT CTF: Flag Heist** for 15,000 teams (~40,000 participants) over the 72-hour competition window.

---

## 1. System Architecture & Topology

```
                  [ Cloudflare Edge CDN (DDoS & 5s Caching) ]
                                      |
                     +----------------+----------------+
                     |                                 |
         [ /api/leaderboard, /artifacts/* ]      [ Dynamic API Requests ]
                     |                                 |
            (Edge Cache Hit 99%+)                      v
                                            [ Cloud Run / Platform Instances ]
                                            (Stateless Node.js / Express)
                                                       |
                             +-------------------------+-------------------------+
                             |                                                   |
                             v                                                   v
                  [ Redis 7 Cluster ]                                 [ PostgreSQL 16 (Primary) ]
             - Precomputed Leaderboard Cache                     - Append-only score_log
             - Distributed Rate Limiters                         - solves UNIQUE(team_id, ch_id)
             - Ephemeral Dashboard Snapshots                     - teams & hints_revealed
```

### Key Scale Invariants:
1. **Stateless Node Service:** Platform instances hold zero in-memory sessions; any request can be routed to any instance behind the load balancer.
2. **Loss-Based Scoring:** Starting score is 200 points. Derived strictly from append-only ledger `Current Score = 200 + SUM(score_log.delta)`.
3. **Database Read Offloading:** The public scoreboard read path never queries PostgreSQL directly; it serves from Redis in <15ms or from Cloudflare's edge in <5ms.

---

## 2. Production Service Port & URL Matrix

| Service | Internal Port | Public Route / Subdomain | Target Challenge | Reset Contract |
| :--- | :--- | :--- | :--- | :--- |
| **Scoring Platform** | `3000` | `https://ctf.veyra.cloud` | Platform & Artifacts | N/A |
| **Collab Logger** | `8082` | `https://collab.veyra.cloud` | Out-of-Band Callbacks | `POST /reset/collab` |
| **Static Staging** | `3001` (CDN) | `https://staging.veyra.cloud` | Challenge 01 | None (Static) |
| **Broken Lock** | CDN | `https://ctf.veyra.cloud/artifacts/ch02/*`| Challenge 02 | None (Static) |
| **Twitter Trail** | Public Web | `https://twitter.com/ethancole_ops7` | Challenge 03 | None (OSINT) |
| **Employee Portal**| `3004` | `https://portal-legacy.veyra.cloud` | Challenge 04 | `POST /reset/4` |
| **Who is Ethan?** | `3005` | `https://directory.veyra.cloud` | Challenge 05 | `POST /reset/5` |
| **Leaked Photo** | CDN | `https://ctf.veyra.cloud/artifacts/ch06/*`| Challenge 06 | None (Static) |
| **Invoice Trail** | `3007` | `https://portal.veyra.cloud` | Challenge 07 | `POST /reset/7` |
| **Internal Dash** | `3007` | `https://portal.veyra.cloud` | Challenge 08 | `POST /reset/8` |
| **Session Bug** | `3009` | `https://session-auth.veyra.cloud` | Challenge 09 | `POST /reset/9` |
| **Config Backup** | `3010` | `https://backup-gw.veyra.cloud` | Challenge 10 | `POST /reset/10` |
| **Debug Trace** | CDN | `https://ctf.veyra.cloud/artifacts/ch11/*`| Challenge 11 | None (Static) |
| **Diagnostics** | `3012` | `https://diagnostics.veyra.cloud` | Challenge 12 | `POST /reset/12` |
| **Admin Cover-Up**| `3013` | `https://preview-mesh.veyra.cloud` | Challenge 13 | `POST /reset/13` |

---

## 3. Production Environment Configuration (`.env.production`)

Production secrets are loaded strictly from `.env.production` (gitignored). Before opening the event to participants, verify all cryptographic secrets meet minimum entropy requirements:

```bash
# Verify non-placeholder secrets in production environment
grep -E '^(JWT_SECRET|ADMIN_JWT_SECRET|RESET_TOKEN|FLAG_PEPPER)=' .env.production
```

Mandatory checks:
- `JWT_SECRET`: 256-bit cryptographically secure random hexadecimal or base64.
- `ADMIN_JWT_SECRET`: Distinct 256-bit key (never reused with team secret).
- `RESET_TOKEN`: High-entropy Bearer token shared only between platform admin and microservices.
- `FLAG_PEPPER`: Secret cryptographic salt appended to all submitted flags before SHA-256 hashing.

---

## 4. Live Force-Reset Runbook

If a challenge microservice becomes degraded, unresponsive, or corrupted during the competition:

### Method A: Via Web Admin Panel (Recommended)
1. Navigate to `https://ctf.veyra.cloud/admin` and sign in with admin credentials.
2. In the **Challenge Controls** section, locate the affected challenge.
3. Click the **"Force Reset Service"** button.
4. The platform dispatches an authenticated HTTP call (`Authorization: Bearer <RESET_TOKEN>`) to the microservice's `/reset/{id}` endpoint and invalidates associated Redis keys.

### Method B: Via CLI Command Line
Dispatch an authenticated reset request directly to the service:
```bash
# Example: Reset Challenge 07 & 08 (Invoice Portal)
curl -X POST "http://localhost:3007/reset/7" \
  -H "Authorization: Bearer ${RESET_TOKEN}" \
  -H "Content-Type: application/json"

# Example: Reset Collaborator Partition Logs
curl -X POST "http://localhost:8082/collab/reset" \
  -H "Authorization: Bearer ${RESET_TOKEN}"
```

---

## 5. Score Adjustment & Dispute Resolution

If an organiser needs to adjust a team's score due to a verified platform bug, network disruption, or disciplinary action:

### Rules:
- **NEVER manually edit a score in the database!** There is no mutable score column.
- All point adjustments must be recorded as an append-only entry in `score_log`.

### Execution via Admin Panel:
1. Navigate to `/admin` -> **Teams & Adjustments**.
2. Select the Team ID.
3. Enter Point Delta (e.g. `+10` or `-5`) and a detailed reason (e.g., `Dispute #14: Platform transient timeout credit`).
4. Click **Apply Adjustment**.

### Execution via Direct Platform CLI:
```typescript
import { recordScoreEvent } from './platform/src/scoring/recordScoreEvent';

// Apply credit of +10 points to team
await recordScoreEvent(
  'a37d2435-1ba5-4aae-bad1-7d5ee732c7ab',
  10,
  'Admin Credit: verified infrastructure timeout on Challenge 12',
  'admin_organizer_id'
);
```
The Redis leaderboard cache automatically recalculates and syncs within 1 second.

---

## 6. Emergency Incident Escalation Matrix

| Severity | Condition | Action Plan | Owner |
| :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Core platform or database offline | 1. Fail over to Cloudflare static maintenance page.<br>2. Check Cloud Run / PostgreSQL connection pool exhaustion.<br>3. Restart stateless platform pods. | Lead Architect |
| **SEV-2 (High)** | A challenge target service is crashing | 1. Deactivate challenge in Admin Panel (`isActive = false`).<br>2. Dispatch `/reset/{id}`.<br>3. Inspect container logs and re-enable. | Challenge Lead |
| **SEV-3 (Medium)** | Scoreboard lag or Redis connection blip | 1. Flush Redis cache key `leaderboard:cache:ranked`.<br>2. Trigger `/api/admin/rebuild-leaderboard`. | Platform SRE |
| **SEV-4 (Low)** | User reports typo or ambiguous wording | Update hint or briefing copy in `challenges.ts` (zero restart required). | Content Lead |
