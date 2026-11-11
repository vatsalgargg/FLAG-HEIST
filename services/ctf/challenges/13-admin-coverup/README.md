# Challenge 13 — Admin Cover-up (Final Challenge)

## Overview
- **Category:** Web / Complex SSRF Chain & Microservices
- **Target:** Veyra Internal Administration Core
- **Phase:** Phase F (Isolation challenges — Prompt 19)
- **Vulnerability Concept:** Link-preview vulnerability with anti-SSRF IP filter bypass (open redirect / alternative IP notation) chains through three private internal services:
  1. Internal health directory (reveals Service 2)
  2. Token broker requiring out-of-band collaborator callback
  3. Administrative credential endpoint returning the final flag

## Backend Service Requirements
- **Hosting Pattern:** Chained microservices accessible only via the internal bridge.
- **Sandboxing & Isolation:** Network access strictly isolated; cannot reach platform scoring DB or the open public internet.
- **Reset Mechanism:** `POST /reset/13` with bearer `RESET_TOKEN`.
- **Health Check:** `GET /healthz` returning HTTP 200.
