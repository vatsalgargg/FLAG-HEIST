# ==============================================================================
# Platform Service — Multi-Stage Production Dockerfile
#
# WHY MULTI-STAGE?
# 1. Faster Cold Starts: In high-concurrency CTF traffic spikes, serverless
#    platforms (Google Cloud Run, Fly.io) spin up new container instances.
#    A slim Alpine runtime image (dropping TypeScript, linters, devDependencies)
#    is 70-80% smaller, resulting in dramatically faster image pulls and cold starts.
# 2. Minimal Attack Surface: Build tools, compilers, and dev dependencies are
#    excluded from the final container layer, reducing vulnerability footprint.
# 3. Security Hardening: Runs under a non-root unprivileged `nodejs` user.
# ==============================================================================

# ── Stage 1: Build & TypeScript Compilation ───────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY package*.json tsconfig*.json ./
RUN apk add --no-cache python3 make g++ && npm ci

# Copy source code and build JavaScript to /app/dist
COPY src/ ./src/
COPY drizzle/ ./drizzle/
RUN npm run build

# ── Stage 2: Clean Production Dependencies ────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./
# Install only production runtime dependencies
RUN apk add --no-cache python3 make g++ && npm ci --omit=dev

# ── Stage 3: Minimal Runtime Container ────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app
RUN apk add --no-cache sqlite

# Set default container environment
ENV NODE_ENV=production
ENV PORT=8080

# Create unprivileged system user for security compliance
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 \
  && mkdir -p /app/data && chown nodejs:nodejs /app/data

# Copy dependency manifests, production node_modules, compiled output, and static frontend
COPY package*.json ./
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs drizzle/ ./drizzle/

# Drop root privileges
USER nodejs

# Document expected port
EXPOSE 8080

# Standard container healthcheck probe against the honest /healthz endpoint
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-8080}/healthz || exit 1

# Launch the compiled Node.js service
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/db/seed.js && exec node dist/index.js"]
