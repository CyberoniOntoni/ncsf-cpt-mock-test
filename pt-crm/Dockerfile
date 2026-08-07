# Multi-stage production image for FloorScribe (Next.js standalone + PGlite)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PGLITE_DATA_DIR=/data/pglite
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN mkdir -p /data/pglite /backups \
  && chown -R node:node /data /backups /app

# Standalone output (next.config: output: "standalone")
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Backup helper inside image (also available on host under scripts/)
COPY --chown=node:node scripts/docker-backup.sh /usr/local/bin/floorscribe-backup
RUN chmod +x /usr/local/bin/floorscribe-backup \
  && ln -sf /usr/local/bin/floorscribe-backup /usr/local/bin/ptcrm-backup

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
