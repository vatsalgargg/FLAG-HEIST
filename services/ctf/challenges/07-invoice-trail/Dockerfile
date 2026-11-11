FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN apk add --no-cache python3 make g++ && npm ci
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --omit=dev
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs public/ ./public/
RUN mkdir -p /app/data && chown nodejs:nodejs /app/data
USER nodejs
EXPOSE 8007
CMD ["node", "dist/index.js"]
