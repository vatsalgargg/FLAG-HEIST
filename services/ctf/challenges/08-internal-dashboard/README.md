# Challenge 08 — Internal Dashboard

## Overview
- **Category:** Web / Broken Access Control
- **Target:** Veyra Operations & Reporting Dashboard
- **Phase:** Phase E (Shared-state app — Prompt 15)
- **Vulnerability Concept:** Application enforces permission checks across standard routes (billing, reporting), but leaves an unlinked secondary route unprotected, exposing the administrative flag.

## Backend Service Requirements
- **Hosting Pattern:** Shared backend service (co-located or paired with Challenge 07).
- **Frontend Distribution:** The minified frontend bundle is hosted on Cloudflare CDN to avoid bandwidth strain on origin compute.
- **Reset Mechanism:** `POST /reset/08` with bearer `RESET_TOKEN`.
- **Health Check:** `GET /healthz` returning HTTP 200.
