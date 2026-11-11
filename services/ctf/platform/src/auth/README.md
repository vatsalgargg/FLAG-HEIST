# Authentication Architecture & API Reference (/src/auth)

This directory implements team-level registration, authentication, token issuance, and administrative session management for ROOT CTF.

---

## 1. What is a JWT? (In Plain Language)

A **JSON Web Token (JWT)** is a digitally signed digital passport that your browser carries on every request. Instead of the database having to keep a record of who is currently logged in, the server packages the team's identity (their team ID and team name) into a JSON string and cryptographically signs it with a secret key known only to the backend. When the browser presents this token in future requests, any server instance can verify the signature mathematically in fractions of a millisecond. If the signature matches, the server knows with 100% mathematical certainty that the token was genuinely issued by the platform and has not been tampered with — all with **zero database lookups**.

---

## 2. Why Two Separate Token Types and Secrets?

```
┌────────────────────────┐                   ┌────────────────────────┐
│   Participant Token    │                   │   Admin Session Token  │
├────────────────────────┤                   ├────────────────────────┤
│ Secret: JWT_SECRET     │                   │ Secret: ADMIN_JWT_SECRET│
│ Type:   'team'         │                   │ Type:   'admin'        │
│ Cookie: veyra_team_... │                   │ Cookie: veyra_admin_...│
└────────────────────────┘                   └────────────────────────┘
```

1. **Compromise Boundary:** If an attacker discovers or cracks `JWT_SECRET` through a bug in a challenge or a leaked staging file, they can forge participant tokens — but they **cannot** forge administrator access because administrator tokens require `ADMIN_JWT_SECRET`.
2. **Explicit Role Enforcement:** Even if someone signs a token with the admin secret and attempts to use it on team routes, `requireTeamAuth` explicitly verifies `payload.type === 'team'`. Similarly, `requireAdminAuth` explicitly verifies `payload.type === 'admin'`. Cross-type usage is blocked at the code level.

---

## 3. Cookie Security Attributes Explained

| Attribute | Setting | What It Protects Against |
| :--- | :--- | :--- |
| `httpOnly` | `true` | **Prevents Token Theft via XSS:** JavaScript running in the browser (`document.cookie`) cannot read or access this cookie. Even if a participant discovers an XSS bug, they cannot exfiltrate other teams' or admins' tokens. |
| `secure` | `true` (prod)<br>`false` (dev) | **Prevents Network Sniffing:** Ensures the cookie is transmitted only over encrypted TLS (HTTPS). Relaxed in development so engineers can test over `http://localhost`. |
| `sameSite` | `'lax'` | **Prevents Cross-Site Request Forgery (CSRF):** Blocks the browser from sending the cookie on cross-site requests (e.g., malicious form submissions from another site), while still permitting safe top-level links (e.g., clicking a link from Discord). |
| `maxAge` | 72 Hours | Matches the 3-day competition duration so participants remain logged in throughout the event. |

---

## 4. REST API Endpoint Reference for Frontend Integration

### 4.1 Team Registration
Creates a team account, hashes password, sets session cookie, and returns team profile.

- **Method / Path:** `POST /api/auth/register` (or `/auth/register`)
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "team_name": "CyberKnights",
    "team_size": 2,
    "member_emails": ["alice@example.com", "bob@example.com"],
    "password": "CorrectHorseBattery99!"
  }
  ```
- **Validation Rules:**
  - `team_name`: 3–50 characters, unique.
  - `team_size`: 1 (solo), 2 (duo), or 3 (trio).
  - `member_emails`: Array of valid email strings whose length **must match** `team_size`.
  - `password`: Minimum 8 characters.
- **Success Response (HTTP 201 Created):**
  Sets `Set-Cookie: veyra_team_session=...; HttpOnly; SameSite=Lax; Max-Age=259200`
  ```json
  {
    "success": true,
    "message": "Team registered successfully.",
    "team": {
      "id": "c1f7b82e-9d22-4411-9a99-b13184f707f1",
      "teamName": "CyberKnights",
      "memberEmails": ["alice@example.com", "bob@example.com"],
      "teamSize": 2,
      "createdAt": "2026-11-07T12:00:00.000Z"
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Validation failure (e.g. invalid email format, mismatched member count).
  - `409 Conflict`: `{"error": "Conflict", "message": "That team name is already taken. Please choose another name."}`
  - `429 Too Many Requests`: Rate limit exceeded.

---

### 4.2 Team Login
Authenticates an existing team and issues a session cookie.

- **Method / Path:** `POST /api/auth/login` (or `/auth/login`)
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "team_name": "CyberKnights",
    "password": "CorrectHorseBattery99!"
  }
  ```
- **Success Response (HTTP 200 OK):**
  Sets `Set-Cookie: veyra_team_session=...; HttpOnly; SameSite=Lax; Max-Age=259200`
  ```json
  {
    "success": true,
    "message": "Login successful.",
    "team": {
      "id": "c1f7b82e-9d22-4411-9a99-b13184f707f1",
      "teamName": "CyberKnights",
      "teamSize": 2
    }
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: `{"error": "Unauthorized", "message": "Invalid team name or password"}` *(identical for non-existent teams and wrong passwords)*.
  - `429 Too Many Requests`: Brute-force lockout triggered (5 consecutive failures for a team name lock it for 5 minutes).

---

### 4.3 Session Check ("Who Am I")
Called by the frontend on every page load to check authentication state.

- **Method / Path:** `GET /api/auth/me` (or `/auth/me`)
- **Headers:** Automatically includes `Cookie: veyra_team_session=...`
- **Success Response (HTTP 200 OK):**
  ```json
  {
    "authenticated": true,
    "team": {
      "id": "c1f7b82e-9d22-4411-9a99-b13184f707f1",
      "teamName": "CyberKnights"
    }
  }
  ```
- **Failure Response (HTTP 401 Unauthorized):**
  ```json
  {
    "error": "Unauthorized",
    "message": "Authentication required. Please log in as a team."
  }
  ```

---

### 4.4 Team Logout
Clears the session cookie in the participant's browser.

- **Method / Path:** `POST /api/auth/logout` (or `/auth/logout`)
- **Success Response (HTTP 200 OK):**
  Sets `Set-Cookie: veyra_team_session=; Max-Age=0; Expires=...`
  ```json
  {
    "success": true,
    "message": "Logged out successfully."
  }
  ```

---

### 4.5 Administrator Login
Authenticates an administrator into the admin control panel.

- **Method / Path:** `POST /api/admin/login` (or `/admin/login`)
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "username": "admin",
    "password": "SecretAdminPassword!"
  }
  ```
- **Success Response (HTTP 200 OK):**
  Sets `Set-Cookie: veyra_admin_session=...; HttpOnly; SameSite=Lax; Max-Age=259200`
  ```json
  {
    "success": true,
    "message": "Administrator login successful.",
    "admin": {
      "id": "de39e791-ba05-40a6-94e9-d1bc34f49f49",
      "username": "admin",
      "role": "admin"
    }
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: `{"error": "Unauthorized", "message": "Invalid username or password"}`
  - `429 Too Many Requests`: Strict IP rate limit (max 5 requests/min).
