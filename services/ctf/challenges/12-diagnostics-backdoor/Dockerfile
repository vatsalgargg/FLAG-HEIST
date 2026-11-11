FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs data/ ./data/
RUN apk add --no-cache curl && mkdir -p /app/data/scratch && chown nodejs:nodejs /app/data/scratch
USER nodejs
EXPOSE 8012
CMD ["node", "dist/index.js"]
