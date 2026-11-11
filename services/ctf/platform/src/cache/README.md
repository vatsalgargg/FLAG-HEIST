> Historical subsystem notes. Current persistence uses SQLite; see `../db/README.md` and the root operations guide.

# Platform Cache Layer (/src/cache)

## Purpose & Scope
This directory manages Redis caching, pub/sub score notifications, and rate-limiting storage for the ROOT CTF platform.

## Architecture
- **Edge & Origin Caching:** Leaderboard reads represent 10–50x the traffic of flag submissions. Redis holds the materialized score rankings and per-team solve state snapshots so read spikes never hit PostgreSQL.
- **Idempotency & Locks:** Redis keys protect critical paths like flag submissions and hint reveals from double-submission race conditions.

## What is Built Here
- `index.ts`: `ioredis` client configuration with connection pooling, exponential backoff, health checking (`PING`), and loud startup connectivity assertions.

## What Will Live Here (Future Prompts)
- **Prompt 4 (Dashboard & Leaderboard):**
  - Materialized leaderboard caching (5-second TTL).
  - Per-team solve snapshot caching (5–10s TTL) for instant dashboard rendering.
- **Prompt 5 (Flag Submission):**
  - Incremental score-delta updates to the Redis leaderboard cache upon valid flag submission.
- **Prompt 8 (Rate Limiting & Abuse Guards):**
  - Token-bucket rate limiter keys (`rate_limit:ip:team`).
