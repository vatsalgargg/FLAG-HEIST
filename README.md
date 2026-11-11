# Flag Heist

The existing Next.js landing page and arena, connected to the scoring API and 13 training challenges supplied in `ctf.zip`. The alternate archive platform frontend is not used. Challenge pages and downloadable files retain their supplied appearance.

## Run locally

Requires Node 22.12+ and Docker Compose with a Linux Docker daemon supporting isolated bridge gateway mode (Docker 28+; verified with Docker 29).

```sh
npm ci
cp .env.example .env
npm run services:up
npm run dev
```

Open http://localhost:3000. The competition lives at `/arena`; `/platform` is removed. Approved teams sign in at `/login` using their team leader email and password. Organisers use the unlinked `/admin` route. Public account creation and the status page are removed. The example local admin is `admin` / `local-organiser-password`. These defaults are rejected in production mode. Old localStorage progress is not imported into authoritative competition scores.

The database is **SQLite**: one persistent file at `/app/data/flagheist.db` inside the API container, stored in the `sqlite_data` volume. Drizzle handles queries and migrations. No PostgreSQL service or database credentials are required. Redis remains the cache and rate limiter.

To provision an allowed team, use `docker compose exec platform sqlite3 /app/data/flagheist.db` and insert a `teams` row with a UUID `id`, unique `team_name`, `member_emails` as a JSON array (leader email first), `team_size` (1–3), and a bcrypt `password_hash` (cost 10). Store emails trimmed and lowercase, and use a unique leader email across teams; ambiguous leader emails are refused at login. Never store a plaintext password. Existing teams can log in using their first member email. SQLite timestamps are Unix milliseconds. The landing page’s Google Form remains the external event signup; it does not create platform accounts.

The API is at http://localhost:8180 and callback logs at http://localhost:8182. Targets use ports 3101, 3103, 3104, 3105, 3107 (shared by modules 7 and 8), 3109, 3110, 3112 and 3113. These ports avoid the older archive services already running on ports 3001–3013 and 8080. Override the `CTF_*_PORT` values in Compose when needed. Set `CTF_API_URL` before building Next.js if the API port changes. Public challenge URLs and the callback log URL are separate from internal Docker service URLs.

`services:up` builds the disposable sandbox images before starting the API, dependencies and target services. The API applies migrations and idempotent seeds before starting. SQLite and invoice data persist in named volumes. `npm run services:down` stops services and retains these volumes. Instructor solutions, generators, backend seed flags, environment files and database backups must remain private; they are never served by Next.js.

## Verify

```sh
npm run lint
npm run build
npm run build --prefix services/ctf/platform
npm run test:restore
CTF_TEST_BASE_URL=http://localhost:8180 npm run test:integration
node scripts/verify-sandboxes.mjs
```

The root integration test provisions its fixture through the local Compose database. Run integration tests only on a disposable event: they create teams, announcements, point adjustments and briefly exercise global maintenance/freeze controls. The test password reset revokes its team's previous session. Run restore verification while scoring is paused or on an idle test event so row fingerprints can be compared consistently.

The imported API acceptance suites are available under `services/ctf/platform`. Run them against an isolated database/cache with `NODE_ENV=test`, an isolated `SQLITE_PATH`, `REDIS_URL` and `RESET_TOKEN`. Some historical archive suites still describe its superseded frontend; the current frontend is covered by the root integration test and browser checks.

See [the feature and integration review](docs/INTEGRATION_REVIEW.md) and [operations guide](docs/OPERATIONS.md). GitLab CI is provided in `.gitlab-ci.yml`; Docker-in-Docker jobs need a privileged CI runner. Deployment jobs require configured SSH targets and are manual, with production depending on staging.
