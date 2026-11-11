# Challenge 07 — Invoice Trail

## Overview
- **Category:** Web / IDOR (Insecure Direct Object Reference)
- **Target:** Veyra Customer Invoicing Service
- **Phase:** Phase E (Shared-state app — Prompts 13 & 14)
- **Vulnerability Concept:** Application checks user session validity but fails to verify ownership of the requested `invoice_id`. Participants deduce the deterministic relationship between `customer_id` and `invoice_id` to retrieve another customer's invoice containing the flag.

## Backend Service Requirements
- **Hosting Pattern:** Shared stateless backend application (shares data model with Challenge 08).
- **Concurrency & Scaling:** Read-mostly seeded data; identical business logic for all teams.
- **Reset Mechanism:** `POST /reset/07` with bearer `RESET_TOKEN`.
- **Health Check:** `GET /healthz` returning HTTP 200.
