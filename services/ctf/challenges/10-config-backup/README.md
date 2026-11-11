# Challenge 10 — Config Backup

## Overview
- **Category:** Web / Path Traversal & Sandboxing
- **Target:** Veyra Configuration Archive Exporter
- **Phase:** Phase F (Isolation challenges — Prompt 16)
- **Vulnerability Concept:** Application sanitizes input with a naïve literal `"../"` blacklist prior to path canonicalization, allowing double-encoding / alternate normalization bypasses to read sensitive configuration artifacts.

## Backend Service Requirements
- **Hosting Pattern:** Short-lived sandboxed container per request.
- **Sandboxing & Isolation:**
  - Read-only filesystem except a temporary scratch directory wiped between executions.
  - No outbound network access.
  - Strict CPU, memory, and timeout caps (3–5 seconds) to prevent resource starvation.
- **Reset Mechanism:** `POST /reset/10` with bearer `RESET_TOKEN`.
- **Health Check:** `GET /healthz` returning HTTP 200.
