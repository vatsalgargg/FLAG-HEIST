FROM docker:29-cli
RUN apk add --no-cache nodejs
WORKDIR /app
COPY gateway.mjs ./gateway.mjs
ENTRYPOINT []
CMD ["node", "gateway.mjs"]
