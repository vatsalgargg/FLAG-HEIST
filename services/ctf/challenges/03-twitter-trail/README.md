# Challenge 03 — The Twitter Trail (Organiser Setup Instructions)

## Overview
- **Category:** OSINT (Open Source Intelligence)
- **Target:** Fictional Veyra Operations Engineer Ethan Cole
- **Account Handle:** `@ethancole_ops7`
- **Designated Flag:** `ROOT{tw1tt3r_0s1nt_tr41l_3th4n_c0l3_9a7b}`

> [!IMPORTANT]
> **NO BACKEND SERVICE REQUIRED.**
> This challenge is hosted on an external social media platform (X / Twitter). Do NOT deploy a backend container.

---

## Instructions for the Organiser (Manual Setup)

Prior to competition kickoff, an organiser must set up the external account following these steps:

1. **Register Fictional Persona:**
   - Platform: X / Twitter
   - Username: `@ethancole_ops7` (or similar available handle, updating `.env` if changed).
   - Display Name: `Ethan Cole`
   - Bio: `Staff Infrastructure & SRE Architect @ Veyra Cloud Solutions. Focused on edge compute meshes, distributed tracing, and cluster resilience. All thoughts strictly corporate.`
   - Profile Photo: A stock or AI-generated corporate engineer headshot.
   - Banner: Abstract server rack or network topology graphic.

2. **Seed Realistic Activity (3–5 Posts):**
   - Post 1 (Oldest): *"Migrating our us-east staging mesh over to the new zero-trust ingress routers today. Let's see if the latency metrics hold up under peak load."*
   - Post 2: *"Shoutout to the Veyra telemetry team for keeping correlation IDs unified across all microservice layers. Makes incident tracing actually bearable."*
   - Post 3: *"Late night maintenance window on the internal invoice dispatchers. Coffee is the only runtime dependency that matters."*

3. **Embed the Flag in ONE Chosen Location:**
   Choose **ONE** of the following locations to embed `ROOT{tw1tt3r_0s1nt_tr41l_3th4n_c0l3_9a7b}`:
   - **Option A (Recommended):** In an image's accessibility ALT text on a post showing a code snippet or terminal window.
   - **Option B:** In an archived reply to a comment or query.
   - **Option C:** In the bio text or a pinned tweet linking to a pastebin / gist.
   - **CRITICAL RESTRICTION:** Do **NOT** rely on image EXIF metadata, because Twitter automatically strips all EXIF metadata upon upload!

4. **Safety & Policy Verification:**
   - Ensure the account bio explicitly mentions fictional affiliation with "Veyra Cloud Solutions (CTF Persona)".
   - Do NOT use real personal emails, phone numbers, or likenesses of real individuals.

5. **Update Platform Configuration:**
   - Set `CHALLENGE_03_TWITTER_URL=https://twitter.com/ethancole_ops7` in `.env`.
   - Update `/docs/03-twitter-trail-writeup.md` with the live URL.
