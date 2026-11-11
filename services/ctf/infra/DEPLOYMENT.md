# Production Deployment Architecture & Specification (/infra/DEPLOYMENT.md)

This document details the production deployment strategy for the **ROOT CTF: Veyra Cloud Solutions** platform on serverless container infrastructure (Google Cloud Run / Knative), explaining each configuration choice, autoscaling parameter, and connection pooling guard.

---

## 1. Compute Platform: Why Google Cloud Run?
- **Serverless & Stateless:** Cloud Run matches the platform's stateless design. Container instances scale from zero to tens of replicas in seconds, and unhealthy instances are automatically killed and replaced.
- **Cost Efficiency:** Off-event cost is $0. During the 3-day event, pay-per-use billing ensures budget is consumed only when active participants are submitting flags or querying scores.
- **Generous Free/Low-Cost Tier:** 180,000 vCPU-seconds and 360,000 GiB-seconds monthly absorb substantial development and staging testing.

---

## 2. Key Configuration Parameters Explained

### 2.1 Instance Scaling (`minScale` vs. `maxScale`)
- **`autoscaling.knative.dev/minScale: '1'` (During Competition)**
  - *Why:* Cold starts on Node.js containers can introduce a 1.5–3 second latency penalty while Docker pulls and boots the runtime. During the 3-day competition, keeping **at least 1 warm instance** guarantees that incoming requests (especially critical flag submissions and real-time dashboard refreshes) never hit a cold-start freeze.
  - *Cost optimization:* Before and after the competition window, change `minScale: '0'` so the service idles at $0 cost.
- **`autoscaling.knative.dev/maxScale: '25'`**
  - *Why:* A hard ceiling prevents infinite horizontal scaling in the event of an unexpected traffic surge, scraper, or DDoS. Sized with `containerConcurrency: 80`, 25 instances support up to **2,000 concurrent in-flight HTTP requests**, easily satisfying a peak active load of 5,000–10,000 concurrent participant sessions (where participants make requests every few seconds rather than continuously streaming).

### 2.2 Container Concurrency (`containerConcurrency: 80`)
- Defines how many simultaneous requests Cloud Run routes to a single container instance before spawning an additional replica.
- Node.js is single-threaded and non-blocking I/O. For I/O-bound workloads (Redis cached queries, PostgreSQL transactions), 80 concurrent connections per container maintains high throughput and sub-10ms response latencies without saturating the Node.js event loop.

### 2.3 CPU Throttling (`run.googleapis.com/cpu-throttling: 'false'`)
- By default, Cloud Run throttles container CPU to 0% when no HTTP requests are being processed.
- Setting `cpu-throttling: 'false'` ensures that the CPU remains allocated for background operations, specifically:
  - Maintaining persistent TCP keepalives to the PostgreSQL connection pool.
  - Maintaining persistent ping/reconnect sockets to Redis.
  - Preventing connection drops between intermittent requests.

### 2.4 Resource Limits (`1000m` CPU / `1024Mi` RAM)
- **1 vCPU (1000m):** Provides sufficient processing power for JSON parsing, JWT cryptographic signature verification, and bcrypt hashing without bottlenecking.
- **1 GiB RAM (1024Mi):** The Alpine Node.js runtime consumes ~60–100 MiB idle and ~200–300 MiB under moderate load. 1 GiB provides a comfortable buffer preventing Out-Of-Memory (OOM) crashes under burst conditions.

### 2.5 Secret Management (`valueFrom.secretKeyRef`)
- **Zero Secrets in Code or Manifests:** Secret keys (`JWT_SECRET`, `ADMIN_JWT_SECRET`, `RESET_TOKEN`, database passwords) must **never** be hardcoded in environment variables or YAML files.
- Cloud Run integrates directly with Google Cloud Secret Manager. Secrets are fetched at container startup and injected into process environment variables without ever writing them to disk or source control.

---

## 3. Database Connection Pooling Under Concurrency

```
┌────────────────────────────────────────────────────────┐
│ Cloud Run Instances (Up to 25 containers)             │
│ [ Instance 1 (max:20) ] ... [ Instance 25 (max:20) ]  │
└───────────────────────────┬────────────────────────────┘
                            │ (Up to 500 connections!)
                            ▼
           ┌─────────────────────────────────┐
           │ Connection Pooler (PgBouncer)   │
           │ (Neon / Supabase Built-in Pool) │
           └────────────────┬────────────────┘
                            │ (Pooled to ~20-50 physical connections)
                            ▼
           ┌─────────────────────────────────┐
           │ PostgreSQL Primary Server       │
           └─────────────────────────────────┘
```

- **The Problem:** If 25 container instances each open a direct pool of 20 connections, the database faces up to **500 direct PostgreSQL client connections**. Hosted free/entry-tier databases crash when connection limits (typically 20–100) are exceeded.
- **The Solution:**
  1. Application queries connect strictly to `DATABASE_POOLED_URL` (PgBouncer transaction-mode pooler).
  2. The pooler multiplexes hundreds of application queries through a small, fixed set of physical Postgres connections (e.g. 20–30).
  3. Direct `DATABASE_URL` is used strictly for offline schema migrations, never for application runtime traffic.

---

## 4. Honest Health Checking & Self-Healing Probes

- Cloud Run executes `startupProbe` and `livenessProbe` against `/healthz`.
- **Startup Probe (`initialDelaySeconds: 2`, `failureThreshold: 10`):** Gives the container up to 30 seconds to establish DB and Redis connections before declaring the deployment failed.
- **Liveness Probe (`periodSeconds: 10`, `failureThreshold: 3`):** If Postgres or Redis connectivity fails in production, `/healthz` returns HTTP 503. Cloud Run automatically stops routing traffic to that instance and restarts a fresh container.
