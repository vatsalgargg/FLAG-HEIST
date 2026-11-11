# Challenge 04 — Employee Portal

## Overview
- **Category:** Web / Broken Authentication
- **Target:** Veyra Internal Staff Login Portal
- **Phase:** Phase D (Stateless backend challenges — Prompt 10)
- **Vulnerability Concept:** Portal login located at a wordlist-guessable hidden path, protected by hardcoded default credentials. Login endpoint protected by rate limiting.

## Backend Service Requirements
- **Hosting Pattern:** Small stateless serverless service (Cloud Run).
- **Concurrency & Scaling:** Same behavior for every team; scales out automatically under load. Rate-limited at the login route using Redis token-bucket.
- **Reset Mechanism:** `POST /reset/04` with bearer `RESET_TOKEN` to clear in-memory/cache rate-limit lockout.
- **Health Check:** `GET /healthz` returning HTTP 200.
