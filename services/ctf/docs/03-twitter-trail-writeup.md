# Challenge 03 — The Twitter Trail (Organiser Write-Up)

## Challenge Details
- **Challenge ID:** 3
- **Name:** The Twitter Trail
- **Tier:** Intro
- **Points:** 15
- **Category:** OSINT (Open Source Intelligence)
- **Designated Flag:** `ROOT{tw1tt3r_0s1nt_tr41l_3th4n_c0l3_9a7b}`

---

## Live Account Configuration (To be confirmed by Organiser)
- **Account URL:** `https://twitter.com/ethancole_ops7` *(Placeholder until account is live)*
- **Exact Flag Location:** Image Accessibility Alt-Text on Ethan Cole's pinned desk setup photo (or bio line).
- **Flag Plaintext:** `ROOT{tw1tt3r_0s1nt_tr41l_3th4n_c0l3_9a7b}`

---

## Precise Mechanism
Participants inspect references to Veyra Cloud Solutions personnel (e.g., from Challenge 1 staging notes or challenge description). They identify Ethan Cole's operational identity and locate his social profile on Twitter/X (`@ethancole_ops7`). By reviewing his profile activity and inspecting post accessibility alt-text, participants discover the embedded flag string.

---

## Exact Triggering Input & Solution Steps

### Step 1: Discover Persona
Participants search Twitter/X for `Ethan Cole Veyra` or `@ethancole_ops7`.

### Step 2: Inspect Account Media & Alt-Text
- Navigate to `https://twitter.com/ethancole_ops7`.
- Inspect the pinned post featuring a multi-monitor terminal setup.
- Open browser DevTools or accessibility inspector to view `alt` attribute on the post image:
  ```html
  <img alt="Dual terminal workspace monitoring Veyra us-east cluster. Ingress canary token: ROOT{tw1tt3r_0s1nt_tr41l_3th4n_c0l3_9a7b}" ... />
  ```

### Step 3: Flag Recovery
- **Flag Extracted:** `ROOT{tw1tt3r_0s1nt_tr41l_3th4n_c0l3_9a7b}`

---

## Reset Procedure
- **Mechanism:** None required in platform infrastructure.
- **Maintenance:** If Twitter bans or restricts the account during the event, the organiser updates `CHALLENGE_03_TWITTER_URL` in `.env` to a mirrored alternative account or archive link.
