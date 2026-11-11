# Challenge 09 — Session Bug

## Overview
- **Category:** Web / Cryptographic Flaws / Cookie Tampering
- **Target:** Veyra Session Management Engine
- **Phase:** Phase D (Stateless backend challenges — Prompt 12)
- **Vulnerability Concept:** Application sets a session cookie containing an encoded role and custom checksum algorithm. The server checks the checksum but neglects to verify role assignment against the persistent user record.

## Backend Service Requirements
- **Hosting Pattern:** Stateless serverless service (Cloud Run).
- **Concurrency & Scaling:** Pure CPU cookie calculation; trivially scalable horizontally.
- **Reset Mechanism:** `POST /reset/09` with bearer `RESET_TOKEN`.
- **Health Check:** `GET /healthz` returning HTTP 200.
