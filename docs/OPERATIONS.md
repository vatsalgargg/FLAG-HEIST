# Current operations guide

The supplied detailed live-ops, break-glass, challenge write-ups and teardown instructions live in `services/ctf/docs/`. They are instructor-only source material. Their old paths/ports and historical test results must be read together with this integration guide.

## Local event

1. Copy `.env.example` to `.env`, install root dependencies and run `npm run services:up`.
2. Run `npm run dev` on port 3000; API requests are proxied to 8180.
3. Provision an approved team in SQLite, check the 13 targets/downloads, then log into `/admin` separately.
4. Verify `/healthz` and `/api/status`, announcements, maintenance, freeze/reveal and a real backup restore in a test event before opening the event.

The task environment also had an older copy running from another folder. This integration uses different target/API ports and does not stop that copy. Shutting down the old deployment is a separate deliberate organiser action.

## Production configuration and gates

- Run on a dedicated Docker 28+ host or replace the Docker gateway with an equally isolated managed runner. Never give a challenge container the Docker socket. Keep the trusted gateway and scoring API inaccessible except through their intended endpoints. The default Compose binds public target ports to loopback; publish them through a TLS reverse proxy on separate challenge hostnames.
- Set `CTF_NODE_ENV=production`, unique random `JWT_SECRET`, `ADMIN_JWT_SECRET`, `RESET_TOKEN`, `FLAG_PEPPER`, and strong seed administrator credentials. Production startup rejects missing/short/default secrets. Create the first administrator once; rerunning the seed does not overwrite an existing admin password.
- Development accepts loopback preview origins on any port and matching Next.js proxy origins. Production accepts only the configured origin.
- Set the single `PLATFORM_ORIGIN`, `CTF_API_URL`, every challenge public URL and callback public/internal URL for the target environment. Rebuild Next.js after changing rewrite destinations or the public Turnstile site key. Use HTTPS for secure cookies and isolate challenge domains from the platform domain.
- Configure Sentry if required. Team account creation is handled manually; public registration is disabled.
- Run the uptime monitor from a separate machine/provider, configure its private webhook and prove an outage/recovery delivery. The local sidecar cannot detect the whole host going offline.
- Store encrypted backups off the host, restrict filesystem permissions and provider access, set a retention policy and test one actual restore. Local hourly dumps do not protect against host loss.
- Confirm kernel/container support, memory/PID/time enforcement and metadata/outbound denial on the actual production host with `node scripts/verify-sandboxes.mjs`.
- Protect GitLab production environments and variables. Deployment hosts need a dedicated clean repository checkout, Docker, Node, `.env`, an SSH known-host entry, and a user systemd unit `flagheist-web` running `npm start` in that checkout on port 3000. CI SSH keys/known-hosts must be installed by the runner's secret configuration; host-key verification is never disabled.
- Configure staging/production `*_DEPLOY_HOST` and `*_DEPLOY_PATH`. Approve staging, run a smoke test, then explicitly approve production. The deployment script fetches the selected commit into the dedicated deployment checkout, builds services/UI and restarts that web unit. It is not invoked by this local integration task.

## Backups and recovery

The API uses one SQLite file at `/app/data/flagheist.db`, persisted in the Compose `sqlite_data` volume. Run one API instance on one host; this file is not a shared network database. To inspect or add approved users, run `docker compose exec platform sqlite3 /app/data/flagheist.db`. `member_emails` is a JSON array with the leader first; timestamps are Unix milliseconds and passwords are bcrypt hashes.

`backup` uses SQLite’s online backup API hourly into ignored `backups/`, with seven-day retention. It includes committed WAL data; do not copy only the live `.db` file. Run `docker compose exec backup sh /backup.sh` for an on-demand snapshot. `npm run test:restore` opens a temporary restored file, compares every table and row, checks integrity and foreign keys, and deletes the temporary file. Run comparisons on an idle or paused test event. Keep an encrypted off-host copy for host-loss recovery.

For live incidents: pause scoring, post an announcement, export authoritative results, take a backup, and use the instructor runbook to diagnose/reset only the affected target. Password resets are in `/admin` and invalidate old team JWTs without deleting scores or hints.

## Rollback

Keep the last known good image tags, commit and matching database backup. The deployment script records the previous commit in `.last-deployed-revision`. Pause scoring and take a fresh backup before rollback. In the dedicated deployment checkout, inspect that recorded revision, check out the approved earlier commit, rebuild/restart the services and web unit, then smoke-test health, login, scoring and downloads before resuming. Never automatically reverse database migrations. Restore a matching SQLite backup into a fresh file if the older app cannot use the current schema, and verify it before switching connections. Preserve both databases for dispute resolution.

## After the event

Freeze standings, export official CSV/JSON, verify the backup, stop web/API/targets/monitor in that order, and retain data under the organiser's stated retention policy. Rotate cookies/signing keys, callback/reset tokens and provider secrets. Verify platform and every challenge hostname is unreachable from outside. `docker compose down` keeps event data; do not use `--volumes` until retention is satisfied and backups have been checked. Follow the supplied teardown checklist for the remaining provider resources.
