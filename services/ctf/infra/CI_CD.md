# ROOT CTF: CI/CD Pipeline & 5-Minute Emergency Rollback Guide

This guide documents the continuous integration, continuous delivery (CI/CD) pipeline, GitHub Secrets configuration, and actionable 5-minute rollback runbook for the **ROOT CTF** competition platform.

---

## 1. CI/CD Architecture & Promotion Flow

```mermaid
flowchart LR
    A["Developer PR / Push"] --> B["GitHub Actions CI"]
    B --> C["1. Schema Migration\n2. Seed Tests\n3. Race Condition Test\n4. Hardening Tests\n5. Multi-stage Docker Builds"]
    C -->|Merge to main| D["Deploy to Staging\n(Cloud Run / Staging Cluster)"]
    D -->|Organizer Approval & Git Tag v*.*.*| E["Promote to Production\n(Live Competition)"]
```

### 1.1 Pull Requests & `main` Push (Continuous Integration)
Every pull request and merge to `main` automatically triggers `.github/workflows/ci.yml`. No code merges unless 100% of the following verification gates pass:
1. **Database Schema & Migrations:** Boots ephemeral Postgres 16 and applies Drizzle migrations idempotently (`npm run db:migrate`).
2. **Seed & Integrity:** Seeds 13 challenge modules and placeholder flags (`npm run db:seed`).
3. **TypeScript Compilation:** Zero compiler warnings or type errors (`npm run build`).
4. **Idempotency & Race-Condition Verification:** Executes concurrent flag submissions (`npm run test:scoring`) verifying that PostgreSQL `UNIQUE(team_id, challenge_id)` constraints prevent double-scoring without check-then-insert races.
5. **Operational Hardening Suites:** Verifies announcement caching, global kill-switch, scoreboard freeze snapshots, per-request sandbox isolation, and registration anti-automation (`npm run test:hardening`).
6. **High-Concurrency Capacity Verification:** Simulates burst traffic and verifies fail-fast sub-50ms latency (`npm run test:load`).
7. **Container Integrity:** Builds production multi-stage Alpine Docker images for Platform, Challenge 12, and Collaborator to guarantee Dockerfiles never drift or break.

### 1.2 Staging Deployment
- Merges to `main` automatically build and tag container images (`gcr.io/$PROJECT/root-ctf-platform:staging-$GITHUB_SHA`) and deploy to the staging environment.
- Staging runs identical configurations to production, connected to a staging Neon/Supabase PostgreSQL branch and Upstash Redis database.

### 1.3 Production Promotion Gate
- Production deployments are **never** triggered by raw Git commits.
- Promotion requires creating an immutable semantic Git release tag (e.g. `v1.2.0`).
- A release tag triggers the production deploy workflow, which prompts a mandatory Organizer Approval review before routing 100% of live traffic to the newly tagged container revision.

---

## 2. Required GitHub Repository Secrets

Configure the following secrets in GitHub Repository Settings (`Settings > Secrets and variables > Actions`):

| Secret Name | Purpose & Environment | Example / Format |
|---|---|---|
| `DATABASE_URL` | Direct connection to production PostgreSQL | `postgres://user:pass@ep-xyz.us-east-1.aws.neon.tech/root_ctf?sslmode=require` |
| `DATABASE_POOLED_URL` | PgBouncer pooled connection (for high concurrency) | `postgres://user:pass@ep-xyz-pooler.us-east-1.aws.neon.tech/root_ctf?sslmode=require` |
| `REDIS_URL` | Redis cache and state store (Upstash/Managed Redis) | `rediss://default:token@us1-quick-fox-12345.upstash.io:6379` |
| `JWT_SECRET` | Secret key signing team session tokens | 64-character random hex string (`openssl rand -hex 32`) |
| `ADMIN_JWT_SECRET` | High-privilege organizer JWT secret | 64-character random hex string (`openssl rand -hex 32`) |
| `RESET_TOKEN` | Bearer token for inter-service challenge resets | 32-character random string |
| `FLAG_PEPPER` | Pepper applied to flag strings prior to hashing | 32-character random string |
| `SESSION_BUG_SECRET` | HMAC signature key for Challenge 09 | 32-character random string |
| `INVOICE_TRANSFORM_KEY` | AES-256-GCM encryption key for Challenge 07/08 | 64-character hex string (32 bytes) |
| `GCP_SA_KEY` | Google Cloud Service Account JSON for Cloud Run deploy | Valid GCP service account key JSON with Cloud Run Admin role |
| `GCP_PROJECT_ID` | Google Cloud Project ID | `veyra-root-ctf-prod` |
| `CLOUDFLARE_API_TOKEN` | Edge cache purge and DDoS protection rule API token | Cloudflare Zone:Cache Purge token |
| `CLOUDFLARE_ZONE_ID` | Cloudflare DNS Zone ID | 32-character hex string |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile anti-bot verification secret | Turnstile secret key (`0x4AAAAAA...`) |

---

## 3. 5-Minute Emergency Rollback Runbook (3:00 AM Guide)

In an emergency (e.g. critical regression, memory leak, accidental maintenance mode lockout), follow these exact numbered steps. Do not improvise.

---

### Procedure A: Roll Back a Defective Code Deployment (Time: < 60 seconds)

#### Option 1: Google Cloud Run (Zero-Downtime Traffic Shift)
Cloud Run revisions are immutable. To revert live traffic to the previous known-good revision:

1. Open your terminal or Cloud Shell:
   ```bash
   # List recent active revisions
   gcloud run revisions list --service=root-ctf-platform --region=us-central1
   ```
2. Instantly shift 100% of user traffic back to the previous stable revision:
   ```bash
   gcloud run services update-traffic root-ctf-platform \
     --region=us-central1 \
     --to-revisions=root-ctf-platform-00042-xyz=100
   ```
3. Purge Cloudflare edge cache so participants receive the previous assets immediately:
   ```bash
   curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"purge_everything":true}'
   ```
   *Result:* Live traffic is reverted in < 15 seconds.

#### Option 2: Docker Compose (Self-Hosted / Single VM)
1. SSH into the production host:
   ```bash
   ssh deploy@ctf.domain.internal
   cd /opt/root-ctf
   ```
2. Change the image tag in `.env` or run with previous container hash:
   ```bash
   docker compose down platform
   docker compose up -d --no-build platform
   ```
3. Verify container health:
   ```bash
   curl -i http://localhost:8080/healthz
   ```

---

### Procedure B: Emergency Override for Maintenance Mode & Scoreboard Freeze (Time: < 30 seconds)

If the platform is stuck in maintenance mode or the scoreboard freeze is locked and admin UI is inaccessible:

1. **Disable Platform Maintenance Mode via Redis CLI:**
   ```bash
   redis-cli -u "$REDIS_URL" SET platform:maintenance_mode "false"
   ```
   *Verification:* Submissions will immediately resume:
   ```bash
   curl -i https://ctf.domain.internal/healthz
   ```

2. **Unfreeze Scoreboard via Redis CLI:**
   ```bash
   # Remove freeze flag
   redis-cli -u "$REDIS_URL" DEL leaderboard:frozen_flag
   redis-cli -u "$REDIS_URL" DEL leaderboard:frozen
   # Delete stale cached leaderboard to trigger immediate fresh rebuild
   redis-cli -u "$REDIS_URL" DEL leaderboard:cache
   ```
   *Result:* Scoreboard unfreezes and recalculates ground-truth ranks within 10 seconds.

3. **Emergency Override via Platform Admin API:**
   ```bash
   # Generate or use an admin JWT to unfreeze via curl:
   curl -X POST https://ctf.domain.internal/api/admin/maintenance-mode/off \
     -H "Authorization: Bearer $ADMIN_JWT_TOKEN"

   curl -X POST https://ctf.domain.internal/api/admin/leaderboard/unfreeze \
     -H "Authorization: Bearer $ADMIN_JWT_TOKEN"
   ```

---

### Procedure C: Restore Database from Automated Hourly Backup (Time: < 3 minutes)

If data corruption occurs (e.g., accidental truncation, errant score adjustment), restore from the latest automated snapshot:

1. **Enable Platform Maintenance Mode immediately** so participants cannot submit while restoration is in flight:
   ```bash
   redis-cli -u "$REDIS_URL" SET platform:maintenance_mode "true"
   ```

2. **Locate the most recent hourly backup in Cloud Storage / S3:**
   ```bash
   # List latest backups
   gsutil ls -l gs://veyra-ctf-backups/hourly/ | tail -n 5
   # Download the latest snapshot (e.g. backup_20261109_1400.dump)
   gsutil cp gs://veyra-ctf-backups/hourly/backup_20261109_1400.dump /tmp/restore.dump
   ```

3. **Restore to PostgreSQL Primary:**
   ```bash
   # Terminate active client connections to clear existing locks
   psql "$DATABASE_URL" -c "
     SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE pid <> pg_backend_pid() AND datname = 'root_ctf';"

   # Restore schema and data using pg_restore
   pg_restore --clean --if-exists --no-owner --no-privileges \
     --dbname="$DATABASE_URL" /tmp/restore.dump
   ```

4. **Wipe Redis Caches to Prevent Stale State Mismatch:**
   ```bash
   # Flush cached leaderboards and first bloods so they regenerate from restored DB
   redis-cli -u "$REDIS_URL" DEL leaderboard:cache
   redis-cli -u "$REDIS_URL" DEL leaderboard:frozen
   redis-cli -u "$REDIS_URL" DEL stats:solves:cache
   ```

5. **Verify Row Counts & Score Derivations:**
   ```bash
   # Run automated verification against restored DB
   npm run db:backup-test --prefix platform
   ```

6. **Disable Maintenance Mode:**
   ```bash
   redis-cli -u "$REDIS_URL" SET platform:maintenance_mode "false"
   ```
   *Verification:* Scoreboard and submissions are now fully restored to the exact point in time of the backup.
