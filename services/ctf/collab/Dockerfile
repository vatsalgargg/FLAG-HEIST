# ==============================================================================
# Collab Service — Multi-Stage Production Dockerfile
# ==============================================================================

FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV COLLAB_PORT=8082

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY package*.json ./
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

USER nodejs
EXPOSE 8082

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${COLLAB_PORT:-8082}/healthz || exit 1

CMD ["node", "dist/index.js"]
