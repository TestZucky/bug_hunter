# syntax=docker/dockerfile:1

# ---- build ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
# `npm install` (not ci) tolerates cross-platform optional deps in the lockfile.
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime (minimal standalone server) ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=8080

# Run as a non-root user.
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
