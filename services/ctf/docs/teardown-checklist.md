# ROOT CTF — Post-Event Teardown, Archive & Security Decommission Checklist

**Audience:** CTF Infrastructure Leads, Security Officers, Organising Committee
**Classification:** Confidential — Internal Organising Committee Use Only
**Execution Timing:** Immediately following competition closing ceremonies and official score finalization.

---

## 1. Export Authoritative Ground-Truth Results

Before terminating any compute or storage instances:

- [ ] **Generate Official Results Snapshot (JSON & CSV):**
  - Run the CLI exporter:
    ```bash
    cd platform && npm run admin:export
    ```
  - Or click **"Download Official JSON Snapshot"** and **"Download Official CSV Results"** in the Admin Console (`/admin`).
  - Store the output files in secure cold storage (Google Drive / S3 / Committee Archive).
- [ ] **Create Final Database Backup:**
  - Run the automated backup script:
    ```bash
    cd platform && npm run db:backup-test
    ```
  - Download the raw PostgreSQL `.sql` dump from `/backups`.
- [ ] **Publish Public Results:**
  - Publish the frozen final leaderboard standings to participants and social channels.

---

## 2. Infrastructure Decommissioning Sequence (What to Shut Down)

Follow this strict ordering to avoid hanging dependencies:

### Step A: Public Challenge Services & Sandboxes
- [ ] Stop and terminate Challenge microservice containers:
  - Challenge 04 (Employee Portal)
  - Challenge 05 (Ethan Cole Search)
  - Challenges 07 & 08 (Shared Veyra Enterprise Portal)
  - Challenge 09 (Session Bug)
  - Challenge 10 (Config Backup)
  - Challenge 12 (Diagnostics Backdoor)
  - Challenge 13 (Admin Cover-Up)
- [ ] Stop and terminate Collaborator service (`/collab`).
- [ ] Purge and delete ephemeral container scratch volumes and tmpfs filesystems.

### Step B: Public Platform Scoring Engine
- [ ] Scale down Platform Cloud Run / ECS service instances to zero (`0`).
- [ ] Disable public DNS records or update Cloudflare routing to serve a static "Competition Concluded" landing page.

### Step C: Caches & Ephemeral Storage
- [ ] Flush Redis cache (`FLUSHALL`) and delete Redis cluster / Upstash database instances to halt billing.

---

## 3. Data Retention Policy (What to Keep and For How Long)

| Data Artifact | Retention Period | Storage Location | Notes |
| :--- | :--- | :--- | :--- |
| **Final Official Results Snapshot (JSON/CSV)** | Permanent (5+ years) | Secure Archive | The official, immutable record of final scores, ranks, and solve timelines. |
| **Full PostgreSQL Database Dump** | 90 Days | Encrypted Cold Storage | Retained for dispute appeals or forensic review; permanently wiped after 90 days. |
| **Participant Registration Details (Emails)** | 30 Days | Encrypted Storage | Retained strictly to distribute certificates of completion and prizes, then purged for GDPR compliance. |
| **Collaborator Callback Logs** | 7 Days | Temporary Storage | Purged 7 days post-event. |
| **Application & Access Logs (Sentry / Cloud Logging)** | 30 Days | Log Storage | Retained for post-mortem analysis, then auto-expired. |

---

## 4. Secret & Credential Rotation Matrix

Rotate all credentials to render any scenario artifacts completely inert:

- [ ] **Rotate JWT Secrets:**
  - Invalidate `JWT_SECRET` and `ADMIN_JWT_SECRET` in Secret Manager.
- [ ] **Rotate Reset Tokens:**
  - Revoke and delete `RESET_TOKEN`.
- [ ] **Rotate Database Passwords:**
  - Rotate PostgreSQL user passwords in database provider.
- [ ] **Rotate Sentry & Cloud Provider API Keys:**
  - Revoke monitoring DSNs and service account keys used for deployment.
- [ ] **Rotate Scenario Secrets:**
  - Delete `SESSION_BUG_SECRET`, `INVOICE_TRANSFORM_KEY`, `FLAG_PEPPER`.

---

## 5. Active Verification: Confirm Public Targets Are Genuinely Unreachable

**NEVER assume services are down because a console dashboard says "stopped".**
Run this programmatic verification script from an external network:

```bash
# Verify Platform API is unreachable or returns static maintenance page
curl -I https://ctf.veyra.example.com/api/dashboard
# Expected: 404 Not Found / 502 Bad Gateway / Connection Refused

# Verify all dynamic challenge ports are closed
for port in 3004 3005 3007 3009 3010 3012 3013 8082; do
  nc -z -w 2 ctf-targets.veyra.example.com $port && echo "❌ Port $port still OPEN!" || echo "✓ Port $port CLOSED"
done
```

- [ ] All public challenge URLs verified unreachable from external networks.
- [ ] Cloud billing alerts verified at $0.00 spend rate post-teardown.
- [ ] Final sign-off recorded by Technical Operations Lead.
