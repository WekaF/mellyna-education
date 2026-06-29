FROM node:20-alpine AS base
RUN npm install -g npm@latest

# Stage 1: Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm install

# Stage 2: Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1

# WhatDesks env vars must be available at build time so Next.js SSG
# can call the API during page pre-rendering, and webpack bakes them
# into the server bundle (process.env.WHATDESKS_* access pattern)
ARG WHATDESKS_BASE_URL=https://whatdesks.mellyna-education.my.id
ARG WHATDESKS_EMAIL=""
ARG WHATDESKS_PASSWORD=""
ARG WHATDESKS_DEVICE_ID="3"
ARG WHATDESKS_DEVICE_UUID=""
ENV WHATDESKS_BASE_URL=$WHATDESKS_BASE_URL
ENV WHATDESKS_EMAIL=$WHATDESKS_EMAIL
ENV WHATDESKS_PASSWORD=$WHATDESKS_PASSWORD
ENV WHATDESKS_DEVICE_ID=$WHATDESKS_DEVICE_ID
ENV WHATDESKS_DEVICE_UUID=$WHATDESKS_DEVICE_UUID

RUN npm run build

# Stage 3: Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Re-declare ARGs so build-args are available in this stage too
# (ARG values don't carry across stages — must be re-declared)
ARG WHATDESKS_BASE_URL=https://whatdesks.mellyna-education.my.id
ARG WHATDESKS_EMAIL=""
ARG WHATDESKS_PASSWORD=""
ARG WHATDESKS_DEVICE_ID="3"
ARG WHATDESKS_DEVICE_UUID=""
ENV WHATDESKS_BASE_URL=$WHATDESKS_BASE_URL
ENV WHATDESKS_EMAIL=$WHATDESKS_EMAIL
ENV WHATDESKS_PASSWORD=$WHATDESKS_PASSWORD
ENV WHATDESKS_DEVICE_ID=$WHATDESKS_DEVICE_ID
ENV WHATDESKS_DEVICE_UUID=$WHATDESKS_DEVICE_UUID

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
