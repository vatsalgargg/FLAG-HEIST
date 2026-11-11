> Historical subsystem notes. Current persistence uses SQLite; see `../db/README.md` and the root operations guide.

# Platform Routes (/src/routes)

## Purpose & Scope
This directory defines the HTTP REST API route handlers for the ROOT CTF platform. Each sub-module represents an isolated functional domain.

## Route Map

| Path | File | Purpose | Phase / Prompt |
| :--- | :--- | :--- | :--- |
| `GET /healthz` | `health.ts` | **Active & Live**: Honest dependency health check (Postgres + Redis). | Prompt 1 (Now) |
| `/auth/*` | `auth.ts` | Team registration, login, and stateless JWT session cookie issuance. | Prompt 3 |
| `/dashboard/*` | `dashboard.ts` | Participant challenge status & solve matrix (cached in Redis). | Prompt 4 |
| `/leaderboard/*` | `leaderboard.ts` | Public loss-based leaderboard (Redis cached, edge CDN headers). | Prompt 4 |
| `/submit/*` | `submit.ts` | Flag submission, idempotent `solves` inserts, score updates. | Prompt 5 |
| `/hints/*` | `hints.ts` | Hint revelation with automatic loss-based point deductions. | Prompt 6 |
| `/admin/*` | `admin.ts` | Admin score overrides, audit log inspection, challenge reset triggers. | Prompt 7 |

## Health Check Contract (`GET /healthz`)
- **Success (HTTP 200)**: Returned ONLY when PostgreSQL executes `SELECT 1` AND Redis answers `PING`.
- **Degraded/Down (HTTP 503)**: Returned if any dependency is unreachable or times out, allowing auto-restarting and traffic rerouting by load balancers.
