# Challenge 05 — Who Is Ethan Cole

## Overview
- **Category:** Web / Query Injection
- **Target:** Veyra Personnel Search Service
- **Phase:** Phase D (Stateless backend challenges — Prompt 11)
- **Vulnerability Concept:** Dangling double-quote injection in search query string allows escaping string filter and surfacing hidden records containing an MD5-hashed secret.

## Backend Service Requirements
- **Hosting Pattern:** Stateless serverless service (Cloud Run) with seeded in-memory / JSON dataset.
- **Concurrency & Scaling:** Dataset is static; results are identical across all teams, making queries cacheable.
- **Reset Mechanism:** `POST /reset/05` with bearer `RESET_TOKEN`.
- **Health Check:** `GET /healthz` returning HTTP 200.
