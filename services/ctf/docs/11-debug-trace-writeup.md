# Challenge 11 — The Debug Trace (Organiser Write-Up)

## Challenge Details
- **Challenge ID:** 11
- **Name:** The Debug Trace
- **Tier:** Progressive
- **Points:** 15
- **Category:** Forensics / Log Analysis
- **Flag:** `ROOT{cl0ck_sk3w_l0g_c0rr3l4t10n_9b4e1a}`

---

## Log Streams & Architecture

The challenge provides three static log files representing separate microservices in the Veyra cluster:
1. `svc-a.log`: Ingress gateway routing. Formatted with standard ISO 8601 (`YYYY-MM-DDTHH:MM:SS.sssZ`). Offset: **0s (reference)**.
2. `gateway-7.log`: Internal dispatch broker. Formatted as Unix epoch timestamps with millisecond fractions (`1762352102.140`). Offset: **+47 seconds ahead**.
3. `proc-core.log`: Processing worker node. Formatted in Common Log timestamp format (`DD/Mon/YYYY:HH:MM:SS +0000`). Offset: **-23 seconds behind**.

### Key Correlation Parameter:
- Unique correlation key across all logs: `req-corr-9b4e72a1`

---

## Exact Triggering Input & Solution Steps

### Step 1: Discover Correlation Identifier
Participants search for rare trace identifiers shared across the three log files. Grepping for matching patterns:
```bash
grep -oE "req-corr-[a-f0-9]+" *.log | sort | uniq -c
```
This isolates the single correlated sequence: `req-corr-9b4e72a1`.

### Step 2: Normalize Timestamps with Clock Skew Offsets
Examining the matching lines:
- **`svc-a.log`:**
  `[2025-11-05T14:15:00.123Z] [INFO] router::ingress: trace=req-corr-9b4e72a1 ... upstream=gateway-7`
- **`gateway-7.log`:**
  `1762352149.263 gateway-7 dispatch.cc:184 [DEBUG] cid=req-corr-9b4e72a1 export_manifest=/artifacts/proc-core/debug-internal-cfg-49a1.txt target=proc-core action=flush_diagnostic`
  *(Note: 1762352149.263 - 47s offset = 1762352102.263 UTC)*
- **`proc-core.log`:**
  `05/Nov/2025:14:14:42 +0000 proc-core worker-03 [INFO] transaction_finalized trace_id=req-corr-9b4e72a1 ...`
  *(Note: 14:14:42 + 23s offset = 14:15:05 UTC)*

### Step 3: Extract Leaked Artifact Path
From the normalized Step 2 entry in `gateway-7.log`, notice the diagnostic configuration manifest path:
`/artifacts/proc-core/debug-internal-cfg-49a1.txt`

### Step 4: Retrieve Artifact & Recover Flag
Download `/artifacts/proc-core/debug-internal-cfg-49a1.txt`:
```
SYSTEM_CLUSTER_FLAG = ROOT{cl0ck_sk3w_l0g_c0rr3l4t10n_9b4e1a}
```
**Flag Recovered:** `ROOT{cl0ck_sk3w_l0g_c0rr3l4t10n_9b4e1a}`

---

## Reset Procedure
- **Mechanism:** None.
- **Explanation:** All logs and artifacts are static files served via CDN.
