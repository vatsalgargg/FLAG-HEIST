# Platform Middleware Layer (/src/middleware)

## Purpose & Scope
This directory contains reusable Express middleware for security, cross-cutting concerns, rate limiting, and observability.

## Middleware Registry

| File | Purpose | Status |
| :--- | :--- | :--- |
| `logger.ts` | Emits structured JSON logs for requests/responses (skips noise on healthy /healthz). | **Active** |
| `error.ts` | Centralized JSON error serialization; hides sensitive stack traces in production. | **Active** |
| `auth.ts` | Stateless JWT validation for participant teams (`requireTeamAuth`) and organisers (`requireAdminAuth`). | Staged for Prompt 3 & 7 |
| `rateLimit.ts` | Redis-backed token-bucket rate limiter to prevent brute-forcing and API denial of service. | Staged for Prompt 8 |
