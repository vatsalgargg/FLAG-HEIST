> Historical subsystem notes. Current persistence uses SQLite; see `../db/README.md` and the root operations guide.

# ROOT CTF — Administrator Console & Incident Control Plane

This directory defines the administrative architecture, API endpoints, microservice reset contract, and operational runbooks for organisers running the **ROOT CTF** competition.

---

## 1. Architectural Philosophy & Invariants

1. **Physical Auth Isolation:**
   Administrator accounts are stored strictly in `admin_users`, completely decoupled from participant `teams`. Administrator session tokens are signed with a distinct cryptographic secret (`ADMIN_JWT_SECRET`) and issued in the `veyra_admin_session` httpOnly cookie. No participant JWT or team cookie can ever authorize an admin endpoint.

2. **Immutable Audit Trail:**
   Organisers **never** manually edit PostgreSQL rows during the live event. All manual score adjustments require a mandatory, non-empty justification string and are appended to the immutable `score_log` ledger with the admin's username as `actor`. A team's score remains strictly derived as:
   $$\text{Current Score} = 200 + \sum(\text{score\_log.delta})$$

3. **Indirection via Standardized Reset Contract:**
   The admin panel does not know or care *how* a specific challenge resets internally (whether it restarts an isolated Docker container, purges an in-memory session table, or regenerates a database fixture). All challenge services implement an identical HTTP reset contract.

4. **Distributed Redis Rate Limiting:**
   Administrator login endpoints are tightly throttled via atomic Redis `INCR` + `EXPIRE` token counters (10 requests/min per IP) to prevent dictionary attacks across autoscaling container instances. If Redis encounters a temporary failure, the rate limiter fails open (logs a warning and allows traffic through) to prevent minor cache blips from taking down the administration portal.

---

## 2. Admin API Endpoints

All admin endpoints support both `/api/admin/*` and `/admin/*` route prefixes. Except for `POST /api/admin/login` and the HTML views `GET /admin` / `GET /api/admin`, all routes require a valid `veyra_admin_session` cookie via `requireAdminAuth`.

### 2.1 `POST /api/admin/login`
Authenticates an administrator and sets the `veyra_admin_session` cookie.

- **Rate Limit:** 10 attempts/min per IP.
- **Request Body:**
  ```json
  {
    "username": "admin",
    "password": "admin-secure-password"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Administrator login successful.",
    "admin": {
      "id": "c4b3f81e-...",
      "username": "admin",
      "role": "admin"
    }
  }
  ```
- **Error (401 Unauthorized):**
  ```json
  {
    "error": "Unauthorized",
    "message": "Invalid username or password"
  }
  ```

---

### 2.2 `GET /api/admin/me`
Inspects current authenticated administrator session.

- **Response (200 OK):**
  ```json
  {
    "authenticated": true,
    "admin": {
      "id": "c4b3f81e-...",
      "username": "admin",
      "role": "admin"
    }
  }
  ```

---

### 2.3 `POST /api/admin/logout`
Clears the `veyra_admin_session` cookie.

- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Admin logged out successfully."
  }
  ```

---

### 2.4 `GET /api/admin/teams`
Retrieves a paginated and searchable directory of registered teams with their derived score, solve count, and registration time.

- **Query Parameters:**
  - `page` *(optional, integer, default `1`)*: Page number.
  - `limit` *(optional, integer, default `100`, max `500`)*: Page size.
  - `search` *(optional, string)*: Substring search filter against `team_name` (case-insensitive).
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "teams": [
      {
        "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "team_name": "ZeroDayExploiters",
        "team_size": 3,
        "member_emails": ["alice@corp.test", "bob@corp.test", "charlie@corp.test"],
        "created_at": "2026-11-07T08:00:00.000Z",
        "score": 185,
        "solved_count": 4
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total_teams": 8420,
      "total_pages": 85
    }
  }
  ```

---

### 2.5 `POST /api/admin/teams/:teamId/adjust-score`
Manually adjusts a team's score.

- **Audit Requirement:** The `reason` field is **strictly required**. Requests with missing or whitespace-only reasons are rejected with HTTP 400.
- **Request Body:**
  ```json
  {
    "delta": 15,
    "reason": "Corrected Challenge 04 solve crediting after verified race condition dispute"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Score adjusted by +15 points for team \"ZeroDayExploiters\".",
    "team_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "team_name": "ZeroDayExploiters",
    "new_score": 200,
    "history": [
      {
        "id": "e4a1...",
        "team_id": "9b1deb4d-...",
        "delta": -15,
        "reason": "hint_reveal:ch4_hint1",
        "actor": "system",
        "created_at": "2026-11-07T08:30:00.000Z"
      },
      {
        "id": "f5b2...",
        "team_id": "9b1deb4d-...",
        "delta": 15,
        "reason": "Corrected Challenge 04 solve crediting after verified race condition dispute",
        "actor": "admin",
        "created_at": "2026-11-07T09:15:00.000Z"
      }
    ]
  }
  ```

---

### 2.6 `GET /api/admin/teams/:teamId/history`
Returns every `score_log` event for the specified team in chronological order. This provides an instant answer to score disputes with zero manual SQL queries.

- **Response (200 OK):**
  ```json
  {
    "success": true,
    "team_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "team_name": "ZeroDayExploiters",
    "current_score": 200,
    "history": [
      {
        "id": "a1b2...",
        "team_id": "9b1deb4d-...",
        "delta": 0,
        "reason": "solve:ch1",
        "actor": "system",
        "created_at": "2026-11-07T08:12:00.000Z"
      }
    ]
  }
  ```

---

### 2.7 `GET /api/admin/challenges`
Returns all 13 competition challenges and their operational configuration (tier, points, active status, microservice type, and configured service URL).

- **Response (200 OK):**
  ```json
  {
    "success": true,
    "challenges": [
      {
        "id": 1,
        "name": "The Forgotten Staging Site",
        "tier": "intro",
        "points": 15,
        "is_active": true,
        "is_dynamic": false,
        "service_url": null
      },
      {
        "id": 4,
        "name": "The Employee Portal",
        "tier": "progressive",
        "points": 15,
        "is_active": true,
        "is_dynamic": true,
        "service_url": "http://localhost:3004"
      }
    ]
  }
  ```

---

### 2.8 `POST /api/admin/challenges/:challengeId/toggle-active`
Toggles `is_active` on the challenge.
- **Immediate Effect:** When deactivated, `/api/submit` instantly rejects flag submissions for this challenge with HTTP 400 (`ChallengeInactive`), and participant dashboards display a `"Temporarily Down"` badge. Toggling active resumes flag submissions immediately.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Challenge #4 (\"The Employee Portal\") is now INACTIVE.",
    "challenge_id": 4,
    "name": "The Employee Portal",
    "is_active": false
  }
  ```

---

### 2.9 `POST /api/admin/challenges/:challengeId/force-reset`
Proxies a force-reset command to the target challenge microservice.

- **Response (200 OK on Success):**
  ```json
  {
    "success": true,
    "challenge_id": 4,
    "message": "Challenge #4 reset successfully executed.",
    "reset_at": "2026-11-07T09:30:00.000Z",
    "upstream_status": 200,
    "upstream_response": {
      "status": "ok",
      "challenge_id": 4,
      "reset_at": "2026-11-07T09:30:00.000Z"
    }
  }
  ```
- **Response (502 Bad Gateway on Failure or Timeout):**
  ```json
  {
    "success": false,
    "challenge_id": 4,
    "error": "UpstreamResetFailure",
    "message": "Challenge service returned HTTP 500",
    "upstream_status": 500,
    "upstream_response": {
      "status": "error",
      "message": "SQLite database lock contention"
    }
  }
  ```

---

## 3. Standardized Challenge Reset Contract Specification

Every dynamic challenge backend (Challenges 04, 05, 07, 08, 09, 10, 12, 13) **MUST** implement this exact endpoint contract:

```http
POST /reset/{challenge_id}
Host: {challenge_service_host}:{port}
Authorization: Bearer {RESET_TOKEN}
Content-Type: application/json

{
  "challenge_id": 4,
  "requested_by": "admin",
  "timestamp": "2026-11-07T09:30:00.000Z"
}
```

### Authentication Contract:
- The challenge service reads `RESET_TOKEN` from its own environment variables.
- The challenge service verifies:
  `req.headers['authorization'] === 'Bearer ' + process.env.RESET_TOKEN`
- If missing or invalid, return `HTTP 401 Unauthorized`:
  ```json
  { "status": "error", "message": "Invalid or missing reset authorization bearer token." }
  ```

### Expected Success Response:
```json
{
  "status": "ok",
  "challenge_id": 4,
  "reset_at": "2026-11-07T09:30:00.123Z"
}
```

### Expected Failure Response:
```json
{
  "status": "error",
  "challenge_id": 4,
  "message": "Detailed description of reset failure"
}
```

---

## 4. Operational Runbooks for the Organiser Team

### Runbook A: "A Team Disputes Their Score"

**Scenario:** A team claims their score dropped unexpectedly, or that a hint was erroneously billed, or that a solved challenge did not register.

1. **Do NOT run manual SQL queries against production database tables.**
2. Open the Admin Console at `http://<platform_host>/admin` (or make API calls).
3. Search for the team name in the **Teams Directory** search bar.
4. Click **"Manage Score"** to open the team's score modal.
5. Inspect the **Append-Only Score Ledger History**:
   - Every solve event is logged (`solve:ch<id>`, delta `0`).
   - Every revealed hint is logged (`hint_reveal:<hint_id>`, negative delta).
   - Any previous admin overrides are logged with the acting admin's username and rationale.
6. If the dispute is valid (e.g., organizer awarded points for an infrastructure glitch):
   - Enter the point adjustment `delta` (e.g. `+15` or `-15`).
   - Enter a detailed `reason` (e.g. `"Dispute verified: Participant submitted valid flag prior to Challenge 08 downtime"`).
   - Click **"Commit Adjustment"**.
7. The ledger is immediately appended, the team's dashboard cache is purged, and the public leaderboard reflects the change within ~1 second.

---

### Runbook B: "A Challenge Seems Broken or Unresponsive"

**Scenario:** Participants in Discord/Slack report that Challenge 04 or Challenge 08 is returning 500 errors, timing out, or corrupted by an injection payload.

1. **Step 1: Pause Submissions (Optional)**
   - If the challenge is generating false flags or failing critically, click **"Deactivate"** on that challenge in the Admin Console.
   - This immediately causes `/api/submit` to reject flags for that challenge with `ChallengeInactive` and badges the challenge as `"Temporarily Down"` on participant dashboards, preventing participant panic.
2. **Step 2: Force Reset the Challenge Container**
   - Click **"Force Reset"** for that challenge in the Admin Console.
   - The platform will issue `POST /reset/{challenge_id}` with the shared `RESET_TOKEN`.
   - The admin UI will display the upstream service's response (`SUCCESS` or `FAILED`).
3. **Step 3: Verify Challenge Health**
   - Confirm the challenge returns HTTP 200 on its public URL.
4. **Step 4: Re-Activate Challenge**
   - Click **"Activate"** in the Admin Console. Flag submissions immediately resume.

---

## 5. Security Checklist
- [x] Admin routes require `ADMIN_JWT_SECRET` cookie (`veyra_admin_session`).
- [x] Admin login is rate-limited via Redis `INCR` + `EXPIRE` Lua script (10 req/min).
- [x] Redis failure fails open for availability with loud warnings logged.
- [x] Manual score adjustment strictly enforces non-empty `reason`.
- [x] Challenge reset requests require secret `RESET_TOKEN` bearer authentication.
- [x] Team cookies are 100% rejected by `requireAdminAuth`.
- [x] Admin cookies are 100% rejected by `requireTeamAuth`.
