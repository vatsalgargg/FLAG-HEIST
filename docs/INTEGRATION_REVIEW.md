# Historical integration review

This records the original PostgreSQL integration. Current setup uses SQLite, organiser-provisioned leader-email login, and no register/status pages. See README.md and OPERATIONS.md for the current implementation.

# Archive integration and feature review

Reviewed against `/home/kadenstack/downloads/ROOT_CTF_Feature_List-1.pdf` and this repository's existing application on 10 November 2026.

## Integration decisions

The archive is compatible with this app's challenge structure: the same 13 names, tiers, Veyra story and 200-point baseline. It was not a drop-in UI replacement: its Express API, standalone HTML platform, ports, asset paths, flags and operational assumptions differ from this Next.js app.

- Keep the existing landing page, event facts, branding, arena components, story text, navigation and styling. New platform pages reuse that palette and typography.
- Import the API, database schema/migrations, scoring, admin tools, target services, callback service, actual artifacts and private instructor materials under `services/ctf`.
- Exclude the alternate platform frontend and inline admin frontend. The existing Next.js platform owns `/platform`, `/login`, `/register`, `/leaderboard`, `/status` and `/admin`.
- Do not import `.env.production`, database backups, existing team exports, runtime databases, dependency folders or generated builds. Never use the ZIP's environment values to contact production services.
- Preserve every supplied `challenges/**/public/**` and `challenges/**/artifacts/**` file byte-for-byte. Backend packaging/security corrections do not restyle these sites. Challenge 3 had only instructions for creating an external X account; a separate local profile fallback uses that supplied content and intended alt-text clue. No external account or post was created.
- Remove client-side answer strings and paid hint text. Server seed flags match the actual supplied exercises; all 34 original arena hints and their prices are retained on the server. LocalStorage scores and mock rankings no longer affect competition results.
- Keep the current scoring behavior: start at 200, deduct purchased hints immediately, record solves with zero-delta audit entries, and permit reasoned admin adjustments. No additional unsolved-challenge penalty is invented; the PDF does not specify one.

## PDF applicability and implementation

All inventory areas serve a hosted team competition. Some are product behavior, some are security constraints, and others need deployment configuration or an organiser action. “Implemented” below means code exists; it does not claim credentials, remote infrastructure or delivery have been configured.

| PDF area | Necessary / decision | Implementation and remaining configuration |
| --- | --- | --- |
| Team registration, solo/duo/trio, member emails | Yes | `/register`, server validation, bcrypt passwords, unique team names. |
| Generic login failures | Yes | `/login`, same failure body for missing teams and incorrect passwords, throttled login. |
| Stateless secure HTTP-only cookies | Yes | Separate signed team/admin JWTs, production secure cookies, SameSite, no session store. Credential-version checks revoke old team tokens after a reset. |
| Independent admin login | Yes | `/admin`, separate cookie/key and explicit token type checks on every protected route. |
| Manual credential reset | Yes | Admin team controls, required reason, audit entry and revocation of prior team tokens. No self-service reset. |
| Rules acceptance and recorded timestamp | Yes | Registration checkbox, written rules and server-side timestamp. |
| Registration CAPTCHA | Yes for public registration | Turnstile widget and server verification; production fails closed if the secret is missing. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Test bypasses apply only under `NODE_ENV=test`. |
| Personalised 13-challenge dashboard | Yes | Existing sequential arena plus server-owned points, availability, solves, hint metadata, assets, target links and access credentials. |
| Story detail, flag form and hints | Yes | Existing challenge cards retained; missing download links and callback details added. Hint contents arrive only after purchase. |
| Temporary challenge unavailability | Yes | Admin toggle gates server submissions/hints; arena polls availability and disables controls. Cross-instance metadata TTL is one second; arena polls every 15 seconds. |
| Solve count and first blood | Yes | Public solve statistics rendered on the current challenge, auto-refreshed. |
| Single flag endpoint, exact feedback, duplicates | Yes | `/api/submit`, trimmed exact hash comparison, no partial answers, database uniqueness and transactionally committed solve/audit writes. |
| 200-point loss-based scoring | Yes; preserve existing rule | Server ledger starts at 200; hints subtract immediately. Solves are audited without an invented reward/penalty. |
| Append-only score audit | Yes | Central event recorder used for solves, hints, admin adjustments and resets; app exposes read-only chronological history. |
| Paid hints persist per team | Yes | Unique reveal records, reveal and deduction in one PostgreSQL transaction, repeated requests never charge twice. Seed reruns preserve reveal IDs. |
| Public live leaderboard and tie breaks | Yes | Real API data, public responsive table, 10-second refresh, authoritative ledger calculation. Zero-delta audit events do not change tie timestamps. |
| Freeze/final reveal | Yes | Separate frozen snapshot, admin freeze/unfreeze; scoring continues underneath. |
| Venue projection | Useful | Full-width public `/leaderboard` page, responsive type and numeric alignment; browser fullscreen/zoom works. |
| All 13 training modules | Yes | Supplied targets/assets plus local OSINT fallback; 7 and 8 share the supplied portal. Operational URLs are configurable. |
| Standard reset/health, instructor path | Yes, with static no-op | Common admin reset contract, health probes, all 13 private instructor write-ups. Static/download-only exercises return a documented no-op reset because they have no mutable state. |
| Team callback logging for 12/13 | Yes | Per-token capability URLs and partitioned logs; internal callback URL is distinct from browser log-view URL. Treat team callback tokens as private. |
| Per-request isolation for 10/12/13 | Yes | Fresh, non-root, read-only Docker container per request, separate internal network with isolated gateway mode (no host bridge address), bounded tmpfs, CPU/memory/PID/time limits, no host sockets or platform secrets inside a target container. Module 13 uses expiring signed codes across disposable requests. |
| Metadata and outbound restrictions | Yes | Module 10 has no network peer; 12/13 can reach only the callback service on request-specific internal networks. Metadata reachability checks are in `verify-sandboxes.mjs`; validate again on the production host. |
| Searchable, paginated admin directory | Yes | Real team directory, scores, solve counts, search and pagination. Aggregation no longer multiplies deductions by solve count. |
| Admin adjustment/history | Yes | Required reason, integer validation, append-only ledger, team history view. |
| Challenge enable/reset | Yes | Admin table calls the standard backend endpoints; reset does not erase team scoring history. |
| Announcements, severity and withdrawal | Yes | Admin post/withdraw, info/warning/critical, global banner in the root layout including landing/auth/status pages. |
| Global maintenance | Yes | Admin pause/resume; both flag and hint endpoints fail closed while paused. |
| Public service status | Yes | `/status`, real database/cache/callback/target health checks and static artifact presence checks. |
| Distributed rate limiting | Yes | Shared Redis registration, login, admin login and team flag-submission counters. Per-instance supplemental lockout is not the distributed enforcement mechanism. |
| Constant-time comparison, hashed stored flags | Yes | Salted SHA-256 database hashes and `timingSafeEqual`; flags never returned to arena clients. Intended target artifacts contain their challenge clues. |
| Headers and auth separation | Yes | Next.js and API security headers, target headers, CSP, anti-framing and strict cookie/token separation. Production requires HTTPS and separate target hostnames. |
| Health and structured logs | Yes | Dependency-aware API probes, target health, request logs without cookies/bodies/flag submissions. Sandbox health checks image/runtime/callback availability. |
| Sentry error tracking | Useful production requirement | Real `@sentry/node` event capture replaces the archive's log-only placeholder. Set `SENTRY_DSN`; remote event delivery is not verified without a project DSN. |
| External uptime and alerts | Yes for an event | `ops/monitor.mjs` sends outage/recovery webhooks and retries failed delivery. Local Compose monitor exercises probes; deploy it on an independent host and set `ALERT_WEBHOOK_URL` for real external alerting. |
| Automated backups and tested restore | Yes | Hourly `pg_dump` service, seven-day local retention, complete `pg_restore` into a disposable DB with content fingerprints for eight tables. Keep an encrypted off-host copy in production. |
| Break-glass recovery | Yes | Imported private runbook and CLI retained; protect direct DB access and rotate admin credentials after recovery. |
| CI tests, lint, staged rollout and manual production gate | Yes | GitLab verify/package jobs, Docker builds, API race tests, restore verification; manual staging and production jobs. Configure protected SSH keys/known-hosts, deployment targets and the documented web service. Rollback steps in operations guide. |
| Final authoritative exports | Yes | Admin CSV/JSON derive from database ground truth independently of a frozen/live cache; protect exports as private team data. |
| Teardown and live-ops runbooks | Yes | Supplied private runbooks retained, current startup/deployment/rollback differences recorded in operations guide. |

## Corrections to archive assumptions

The ZIP's existing test results and “100% verified” statements are historical claims, not evidence for this checkout. In particular, `containerConcurrency: 1` does not create a fresh process/filesystem for each sequential request; scratch directories alone do not isolate arbitrary commands. The local Docker runner implements actual request disposal instead. It requires a dedicated Linux Docker host; its trusted gateways hold Docker control access and must never be placed in the challenge containers or exposed as a general command API.

The archive's old Next-free frontend test is not an acceptance test for this Next.js UI. Root integration/browser checks cover the current implementation. Production configuration remains subject to the launch checklist, not the historical archive certification.

## Verification record

The final task report records the checks actually run. Re-run the commands in README after changes; no remote deployment, real external alert or paid/cloud account setup is implied by local verification.

Final local verification completed:

- Root ESLint and TypeScript checks; optimized Next.js production build; API TypeScript build; complete Compose image builds and dependency startup.
- Imported auth, scoring and admin acceptance suites on disposable PostgreSQL/Redis; concurrent duplicate scoring and hint purchase checks; two independent API processes sharing one rate limit.
- Current Next.js-to-API integration covering all 13 challenge records, protected hints, audit consistency, maintenance, scoreboard freeze, announcements, password reset/session revocation, authoritative exports and every download.
- Browser registration, hint purchase, incorrect and correct flag feedback, original sequential progression, public standings/status, admin access and both logout flows. Checked desktop, tablet and phone; no client exceptions or page overflow.
- Production CAPTCHA rejects missing configuration and development bypass tokens; mandatory rules remain enforced after CAPTCHA succeeds.
- Real `pg_dump`/`pg_restore` with complete content fingerprints for all eight application tables, not row-count-only checks.
- Original RSA artifact solved; supplied portal, directory, invoice, internal-dashboard and custom-session solve paths exercised; modules 10/12/13 checked through disposable runners, including the final five-stage path, private callbacks, fresh filesystems, denied internet and unreachable metadata.
- All 34 existing hint texts/prices verified against server seed metadata. All 13 supplied public/artifact files compared byte-for-byte with the ZIP. Challenge pages received no visual redesign.
- Login and leaderboard inspector: zero failures at 1440/768/390px. One deliberate short-page whitespace warning per screen; screenshot review also covered the authenticated arena and admin pages.

Not verified remotely: production deployment, real Turnstile/Sentry delivery, independent external alert delivery, cloud host firewall behavior and off-host backup storage. Configure and verify these launch gates using the operations guide. No external account, post, notification or deployment was created during this integration.
