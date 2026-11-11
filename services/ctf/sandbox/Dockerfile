FROM node:22-alpine AS builder
ARG CHALLENGE_DIR
WORKDIR /build
COPY challenges/${CHALLENGE_DIR}/package*.json challenges/${CHALLENGE_DIR}/tsconfig.json ./
RUN npm ci
COPY challenges/${CHALLENGE_DIR}/src/ ./src/
RUN npm run build

FROM node:22-alpine
ARG CHALLENGE_DIR
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=builder /build/node_modules/ ./node_modules/
COPY --from=builder /build/dist/ ./dist/
COPY sandbox/request.mjs ./request.mjs
# Copy intended challenge artifacts; no platform credentials or instructor write-ups.
COPY challenges/${CHALLENGE_DIR}/data/ ./data/
ENV NODE_ENV=test
USER 65534:65534
ENTRYPOINT ["node", "/app/request.mjs"]
