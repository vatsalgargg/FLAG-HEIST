> Historical subsystem notes. Current persistence uses SQLite; see `../db/README.md` and the root operations guide.

# Scoring Engine & Leaderboard Caching (/src/scoring)

This directory implements the core scoring logic, append-only event logging, and high-performance caching for ROOT CTF.

---

## 1. Why Do We Cache the Leaderboard Instead of Querying Live?

In a 3-day competition with 15,000 teams and 40,000 participants:
- The scoreboard is the **single most frequently requested page** in the entire system.
- Participants and spectators refresh the leaderboard thousands of times per minute.
- A naive architecture that runs `SELECT ... GROUP BY ... ORDER BY` against PostgreSQL on every single refresh would collapse the database connection pool in seconds.

### The Hybrid Solution: Fast Path + CDN Edge Caching
1. **Cloudflare CDN Edge Cache:** The `/api/leaderboard` response includes:
   ```
   Cache-Control: public, max-age=5, s-maxage=5, stale-while-revalidate=10
   ```
   Cloudflare's worldwide CDN absorbs 99%+ of all requests at the edge. Only one request every 5 seconds per CDN edge location ever reaches our origin server.
2. **Redis In-Memory Cache:** When a request does reach the server, it reads a precomputed JSON array from Redis in **<1 millisecond** with **zero database load**.

---

## 2. "Incremental Update" (Fast Path) vs "Full Rebuild" (Slow Path)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Fast Path (Real-Time): recordScoreEvent()                                   │
│  1. Appends audit row to score_log table in Postgres.                      │
│  2. Calls applyIncrementalScoreChange(teamId, delta).                       │
│  3. Modifies the team's score in the cached Redis array & re-sorts.         │
│  ⏱️ Latency: ~1-2ms | SQL Queries on Read: 0                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Slow Path (Self-Healing Fallback): rebuildLeaderboardCache()                │
│  1. Executes single aggregated SQL query joining teams and score_log.       │
│  2. Calculates accurate ground-truth scores and tie-breaking timestamps.    │
│  3. Overwrites Redis key `leaderboard:current`.                             │
│  🔄 Triggers: Cold starts, cache flushes, and background job every 30s.     │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Incremental Update (Fast Path):** Runs instantly whenever a flag is solved or hint unlocked. Rather than querying the database for all 15,000 teams, we update only the single team's score in Redis and re-sort the array in memory.
- **Full Rebuild (Self-Healing Slow Path):** Runs automatically every 30 seconds via a background timer (`startLeaderboardBackgroundRefresher`). If a network blip or worker crash ever caused an incremental update to be missed, the background job self-heals the scoreboard within 30 seconds.

---

## 3. The Tie-Breaking Rule (Worked Example)

### The Rule
> **"Ties break by earliest time the team reached their current score."**

### How It Is Tracked
Alongside each team's score, the system tracks `last_score_change_at`:
- For teams that have made solves or unlocked hints: the timestamp of their most recent `score_log` entry.
- For teams still at their initial 200 points: the team's registration timestamp (`teams.created_at`).

### Worked Example
Suppose Team Alpha and Team Bravo both have **170 points**:
- **Team Alpha** registered at 09:00 AM, revealed a 15-point hint at 09:30 AM, and another 15-point hint at **10:04 AM** (Score: 170). Their `last_score_change_at` is `10:04 AM`.
- **Team Bravo** registered at 09:05 AM, revealed two hints at **10:09 AM** (Score: 170). Their `last_score_change_at` is `10:09 AM`.

**Result:**
1. **Rank #1: Team Alpha (170 pts, reached at 10:04 AM)** — *Wins the tie-break because their score was established earlier.*
2. **Rank #2: Team Bravo (170 pts, reached at 10:09 AM)**

---

## 4. Why ALL Score Mutations MUST Call `recordScoreEvent()`

```
                                  ┌───────────────────────────┐
                                  │    recordScoreEvent()     │
                                  └─────────────┬─────────────┘
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       │                                                 │
                       ▼                                                 ▼
          ┌──────────────────────────┐                      ┌──────────────────────────┐
          │   PostgreSQL score_log   │                      │  Redis Leaderboard Cache │
          │  (Immutable Ground Truth)│                      │    (Real-Time Sub-1ms)   │
          └──────────────────────────┘                      └──────────────────────────┘
```

`recordScoreEvent(teamId, delta, reason, actor)` in `platform/src/scoring/recordScoreEvent.ts` is the **only sanctioned method** to adjust scores.

**Never write raw SQL `INSERT INTO score_log` outside this function!**
- If application code inserts directly into `score_log`, the database ledger updates, but the Redis cache and public leaderboard will not reflect the change until the 30-second background cycle.
- Calling `recordScoreEvent()` guarantees atomic consistency: the database audit row is inserted, and the fast-path incremental cache update fires in the same operation.
