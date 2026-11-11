# Flag Heist API

The scoring API serves leader-email login, the arena, leaderboard, hints, admin controls, announcements, and challenge integration. The Next.js app owns the UI; the arena is `/arena`, with no `/platform`, `/register` or `/status` page. Admin remains available directly at `/admin` without navigation links.

Data is stored in one SQLite file through Drizzle and better-sqlite3. Redis provides caching and request throttling. There is no PostgreSQL service.

From the repository root, run `npm run services:up` and `npm run dev`. The API is available on port 8180. It applies SQLite migrations and seeds challenges, hints and the configured organiser account before listening.

For a standalone API, install this package and set `SQLITE_PATH`, `REDIS_URL`, and the signing/reset secrets described in the root `.env.example`. Run `npm run db:migrate`, `npm run db:seed`, then `npm run dev`. Do not share one SQLite file across hosts or run multiple API replicas against it.

Use `docker compose exec platform sqlite3 /app/data/flagheist.db` to inspect the live database. Participant accounts are provisioned manually in `teams`, using UUID IDs, JSON `member_emails` with the leader first, and bcrypt password hashes. See [database notes](src/db/README.md).

`npm test`, `npm run test:scoring`, and `npm run test:admin` cover authentication, scoring and organiser controls. Run them against a disposable SQLite file and Redis database. `npm run db:backup-test` verifies an online backup and restore, including every table, row, integrity, and foreign keys.
