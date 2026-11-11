# ROOT CTF — Emergency Break-Glass Admin Access Recovery Runbook

**Audience:** CTF Operations Leads, Systems Engineers, On-Call Organisers
**Classification:** Confidential — Committee Internal Use Only
**Purpose:** Restoring administrative access to the ROOT CTF Admin Console in the event of credential loss, session revocation, or total administrative lockout.

---

## 1. When to Use This Procedure

Use this emergency procedure **only** if:
- All active administrators are locked out of the Admin Console (`/admin`).
- Administrative passwords have been forgotten, lost, or corrupted.
- Emergency score adjustment or challenge status intervention is required during a live incident and standard administrative login fails.

---

## 2. Architectural Guarantee: Complete Out-of-Band Recovery

This break-glass procedure connects directly to the underlying PostgreSQL database (`admin_users` table) using direct credentials (`DATABASE_URL`).
It intentionally **bypasses**:
- The platform HTTP server and reverse proxy.
- Redis cache layers and distributed rate limiters.
- Web session cookie issuance and browser CORS policies.

Even if the web server is under high load or rate limiters are tripping, direct database recovery remains 100% operational.

---

## 3. Step-by-Step Execution

### Option A: Via Command Line (Recommended)

From a server terminal or local environment connected to the production database:

1. **Navigate to the platform directory:**
   ```bash
   cd platform
   ```

2. **Execute the automated break-glass CLI utility:**
   ```bash
   npm run admin:break-glass <username> <new_password>
   ```
   *Example:*
   ```bash
   npm run admin:break-glass incident_lead P@ssw0rd2026!SecureRoot
   ```

3. **Auto-Generated Secure Password:**
   If no password argument is provided, the tool automatically generates a cryptographically secure 16-character alphanumeric passphrase:
   ```bash
   npm run admin:break-glass emergency_admin
   ```

4. **Verify Immediate Login:**
   Navigate in your browser to:
   ```
   https://ctf.veyra.example.com/admin
   ```
   Log in with the username and password output by the CLI tool.

---

### Option B: Direct PostgreSQL SQL Override (Manual Fallback)

If Node.js or npm is unavailable, run the following SQL command directly in `psql`:

1. Generate a bcrypt hash for your new password (using cost factor 10).
2. Execute the UPSERT query:
   ```sql
   INSERT INTO admin_users (username, password_hash, role)
   VALUES ('emergency_ops', '$2a$10$abcdef...', 'admin')
   ON CONFLICT (username) DO UPDATE
   SET password_hash = EXCLUDED.password_hash,
       role = 'admin';
   ```
3. Test authentication against `POST /api/admin/login`.

---

## 4. Post-Incident Security Checklist

Once the operational emergency is resolved:
- [ ] Record the incident reason in the operational shift log.
- [ ] If the emergency account is temporary, delete or rotate it from the Admin Console or database:
  ```sql
  DELETE FROM admin_users WHERE username = 'emergency_admin';
  ```
- [ ] Review access logs to verify zero unauthorized administrative actions occurred.
