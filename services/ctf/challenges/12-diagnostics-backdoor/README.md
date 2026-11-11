# Challenge 12 — Diagnostics Backdoor

## Overview
- **Category:** Web / Blind Command Injection & Egress Filtering
- **Target:** Veyra Network Diagnostics Utility
- **Phase:** Phase F (Isolation challenges — Prompt 18)
- **Vulnerability Concept:** Diagnostic parameter allows blind command execution. The HTTP response is fixed and never mirrors output. Solution requires triggering an out-of-band network callback to the Collaborator service.

## Backend Service Requirements
- **Hosting Pattern:** Disposable sandboxed container per request.
- **Sandboxing & Network Egress:**
  - Outbound network traffic is locked to an egress allow-list permitting communication *only* with the Collaborator service (`/collab`).
  - Cloud metadata IP (`169.254.169.254`) is explicitly blocked.
  - Strict resource quotas: CPU, memory, and timeout caps.
- **Reset Mechanism:** `POST /reset/12` with bearer `RESET_TOKEN`.
- **Health Check:** `GET /healthz` returning HTTP 200.
