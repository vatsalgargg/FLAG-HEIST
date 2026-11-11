# ROOT CTF — Live-Operations Runbook & Incident Response Guide

**Audience:** All CTF Organisers, Desk Volunteers, Shift Leads (Non-Engineers and Engineers alike)
**Classification:** Confidential — Internal Organising Committee Use Only
**Purpose:** Clear, step-by-step instructions on operating ROOT CTF during the 72-hour live event.

---

## 1. What "Healthy" Looks Like

During normal competition operations, the system should look like this:

| Component | Healthy Indicator | Where to Check |
| :--- | :--- | :--- |
| **Scoring Platform** | Returns HTTP 200 with `"status": "ok"` and both `database` and `redis` marked `"connected"`. | Browser or terminal: `GET /healthz` |
| **Leaderboard** | Refreshes smoothly every 10–15 seconds; ranks update in real time when teams solve challenges. | `/leaderboard` or `/api/leaderboard` |
| **Participant Dashboard** | Displays 13 challenge cards; hints show point costs; teams can submit flags without error. | `/dashboard` (logged in as team) |
| **Challenge Targets** | All 13 target endpoints respond within 1–2 seconds. | Uptime dashboard or `/admin` |
| **Collaborator (/collab)** | Returns HTTP 200 on `/healthz`; correctly records callbacks for Challenges 12 and 13. | `http://collab:8082/healthz` |

---

## 2. How to Handle a Reported Broken Challenge

When participants report in support chat or Discord that a challenge is "down", "broken", or "not responding":

```
Participant reports challenge broken
               │
               ▼
   Check Admin Console (/admin)
   Is challenge Active or Down?
               │
      ┌────────┴────────┐
      ▼                 ▼
[Is Inactive]      [Is Active]
Announce in chat:  Test challenge healthz
"Under maintenance" ┌────┴────────────────────────┐
                   ▼                             ▼
             [Healthz 200]                 [Healthz Fails/500]
        Check participant input:        1. Click "Force Reset" in /admin
        Are they formatting correctly?  2. Check Uptime Kuma alerts
        (e.g. wrong flag format)        3. If still failing, click "Toggle Active"
                                           to pause submissions safely.
```

### Step-by-Step Actions:

1. **Verify if the Challenge is Actually Down:**
   - Log into the Admin Console at `/admin`.
   - Look at Section 1: "Challenges Status & Force-Reset Control".
   - Check the health indicator for the reported challenge.
   - You can also test the health URL directly (e.g. `http://challenge-04:3004/healthz`).

2. **If the Challenge is Unresponsive or Corrupted:**
   - Click the **"Force Reset"** button next to that challenge in `/admin`.
   - The platform will send an authorized reset hook (`POST /reset/{id}`) to the container.
   - For Challenge 12 or 13, this will also clear the team's Collaborator interaction logs.
   - Wait 10 seconds and verify the health check turns green.

3. **If a Container Cannot Self-Heal:**
   - Click the **"Toggle Active"** button in `/admin` to pause submissions for that challenge.
   - A yellow badge ("Temporarily Down") will immediately appear on the participant dashboard, and attempts to submit flags will receive a clear, polite notification that submissions are paused.
   - Post an announcement in the participant announcement channel:
     > *"Heads up: Challenge #X is temporarily paused for routine sandbox maintenance. All existing solves are safe. We will update you in ~15 minutes."*
   - Escalate to the Technical Lead on call.

---

## 3. How to Handle Score Disputes

Because ROOT CTF uses an **append-only ledger** (`score_log`) and loss-based scoring, every single point transaction is permanently recorded with a timestamp, reason, and actor.

### Resolving Disputes in 3 Steps:

1. **Open the Team's Audit History:**
   - Go to `/admin`.
   - In Section 2 ("Teams Directory & Score Disputes"), enter the team name in the search box and click **"Search"**.
   - Click the **"Score History"** button next to the team.

2. **Audit the Log:**
   - Every row displays:
     - The point delta (e.g., `-3` for revealing Challenge 1 Hint, `0` for solving Challenge 1).
     - The reason (e.g., `hint_reveal:<hint_id>`, `solve:ch1`).
     - The exact timestamp.
   - The team's score is mathematically guaranteed to equal:
     `200 + SUM(all deltas)`.
   - Explain the exact breakdown to the team with timestamps from their audit ledger.

3. **Manual Score Adjustment (If Compensation is Justified):**
   - If an organizer ruling warrants a score adjustment (e.g. compensating for verified platform downtime):
     - In the Score History modal, enter the point delta (e.g. `+15` or `-15`).
     - Enter a **mandatory audit reason** explaining the decision (e.g., *"Organizer ruling: Comp for 20m Ch04 outage at 14:20 UTC"*).
     - Click **"Commit Adjustment"**.
     - The adjustment is permanently written to the ledger, and the public leaderboard updates in under 1 second.

---

## 4. How to Respond to Monitoring Alerts

When you receive an automated alert from PagerDuty, Slack, or Uptime Kuma:

| Alert | What It Means | Immediate Action |
| :--- | :--- | :--- |
| **`Platform API Health Degraded (HTTP 503)`** | The scoring platform cannot communicate with PostgreSQL or Redis. | 1. Check managed database provider status (Neon/Supabase/RDS).<br>2. Check Redis cluster connectivity.<br>3. Escalate immediately to Infrastructure Lead. |
| **`Challenge [04, 05, 07, 09, 10, 12, 13] Down`** | A dynamic challenge microservice has stopped responding. | 1. Open `/admin` and click **"Force Reset"** for that challenge.<br>2. If it does not recover in 60s, click **"Toggle Active"** and notify participants. |
| **`Leaderboard Cache Expiry Warning`** | Background sync from PostgreSQL took longer than 30s. | Edge CDN and Redis continue serving cached rankings. No participant impact unless sustained >2 minutes. |
| **`Rate Limiter Saturation Alert`** | A team or IP is aggressively spamming login or submit endpoints (>60 req/min). | The Redis token bucket is automatically rejecting the spam with HTTP 429. No action required unless platform latency rises. |

---

## 5. Shift-Handoff Template

When handing over duty to the next shift lead, copy and paste this template into the internal operations channel:

```markdown
### 📋 ROOT CTF Shift Handoff Report
**Date / Time:** 2026-11-XX [HH:MM UTC]
**Outgoing Lead:** @[Name]
**Incoming Lead:** @[Name]

---

1. **System Health Status:**
   - Platform Core API: [GREEN / YELLOW / RED]
   - Redis & Edge Cache: [GREEN / YELLOW / RED]
   - All 13 Challenges: [ALL GREEN / List any active issues]

2. **Incidents During Shift:**
   - [e.g., 14:15 UTC - Ch 12 container restarted via Force-Reset after memory spike. Resolved.]
   - [e.g., 15:30 UTC - Score dispute for Team 'CyberHawks' investigated; confirmed hint deduction valid.]

3. **Active Maintenance / Paused Challenges:**
   - [None / or list challenges currently set to Inactive]

4. **Participant Communication Items:**
   - [e.g., Hourly hint unlock scheduled for 18:00 UTC]

5. **Outstanding Tasks for Next Shift:**
   - [e.g., Monitor memory on Challenge 13 host node]
```
