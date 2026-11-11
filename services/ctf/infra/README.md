# ROOT CTF — Infrastructure Guide (/infra)

Welcome to the ROOT CTF infrastructure directory! This guide explains how to spin up the local development environment on your laptop from scratch in under two minutes.

---

## Quickstart: How to Run on Your Laptop

Follow these exact steps from a fresh clone of the repository:

### Step 1: Ensure Docker is Running
Verify that Docker and Docker Compose are installed on your machine:
```bash
docker --version
docker compose version
```
*(Make sure Docker Desktop or your Docker daemon is started).*

### Step 2: Prepare Your Environment File
From the repository root, copy the environment template:
```bash
cp .env.example .env
```
> [!NOTE]
> **No edits needed for local development!** You do **not** need to fill in any database passwords or API keys to run locally. When running under `docker compose`, the configuration automatically wires the platform API to the local PostgreSQL and Redis containers.

### Step 3: Start the System
Run the following command from the repository root:
```bash
docker compose up
```
*(Or if you prefer running it in the background: `docker compose up -d`)*

Docker will:
1. Start the PostgreSQL 16 container and wait until its health check passes.
2. Start the Redis 7 container and wait until its health check passes.
3. Build the Platform API container using its multi-stage Dockerfile.
4. Launch the Platform API service and connect it to Postgres and Redis.

### Step 4: Verify the Honest Health Check
Once the containers are running, test the health check in your browser or terminal:
```bash
curl http://localhost:8080/healthz
```

**Expected JSON response (HTTP 200):**
```json
{
  "status": "ok",
  "service": "platform",
  "time": "2026-11-07T02:00:00.000Z",
  "dependencies": {
    "database": "connected",
    "redis": "connected"
  },
  "latency": {
    "databaseMs": 1,
    "redisMs": 0
  }
}
```

If you see `"status": "ok"`, congratulations! The entire local stack is running, and the platform has verified live query connectivity to both Postgres and Redis.

### Step 5: Stopping the Containers
To stop the services and retain data volumes:
```bash
docker compose down
```

To stop and wipe local database/cache data for a clean slate:
```bash
docker compose down -v
```

---

## Directory Layout
- `Dockerfile.platform`: Multi-stage Alpine container definition for the Platform service.
- `docker-compose.yml`: Local dev compose configuration (Postgres, Redis, Platform API).
- `deployment/cloudrun-platform.service.yaml`: Production deployment template for Google Cloud Run.
- `DEPLOYMENT.md`: Comprehensive explanation of production autoscaling, memory/CPU parameters, and connection pooling.
