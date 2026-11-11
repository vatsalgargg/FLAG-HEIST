# SQLite database

The platform uses Drizzle with better-sqlite3. Set `SQLITE_PATH` to a local file (default `./data/flagheist.db` relative to the API working directory). Docker stores `/app/data/flagheist.db` in `sqlite_data`.

Run `npm run db:migrate` and `npm run db:seed` before starting a standalone API. Docker performs both automatically. The seed creates challenges, hints, and the configured organiser account; it does not create participant accounts or overwrite existing passwords.

All eight application tables retain their existing names. IDs are UUID strings. `member_emails` is a JSON array, with the leader email first. Boolean columns use 0/1 and timestamps use Unix milliseconds. For manual SQL inserts, supply a UUID `id` and a bcrypt password hash. Team names and team leader emails must be unique. Login rejects ambiguous leader emails.

Foreign keys and uniqueness constraints protect scoring. SQLite uses WAL mode and a five-second busy timeout. Solve and hint purchases commit together with their ledger entries in synchronous transactions; duplicate submissions do not double charge. Use one API instance per database file.

`npm run db:backup` makes a consistent online backup. `npm run db:backup-test` verifies a temporary restore. Never copy only the live database file while WAL writes are active.
