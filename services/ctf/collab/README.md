# ROOT CTF — Collaborator Service (/collab)

## Overview
The **Collaborator Service** is a dedicated out-of-band interaction logger used by:
- **Challenge 12 (Diagnostics Backdoor):** Blind command injection requiring out-of-band callback proof.
- **Challenge 13 (Admin Cover-up):** Server-Side Request Forgery (SSRF) chained through internal services.

## Isolation Architecture
1. **Network Boundary:** In production, this service receives callbacks strictly from the challenge runners within the CTF egress boundary. It does not allow arbitrary outbound public internet access.
2. **Team Partitioning:** Each team is assigned an isolated token/subdomain (e.g. `{team_token}.collab.ctf-domain.example`). Callbacks are keyed exclusively by this token, preventing teams from reading another team's callback logs.
3. **Reset Support:** Exposes reset hooks to purge callback logs when a challenge is reset by admins.

## Current State
- Scaffold service with runnable HTTP server and `GET /healthz`.
- Full HTTP/DNS callback logging engine will be implemented in Prompt 17.
