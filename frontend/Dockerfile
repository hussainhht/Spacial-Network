FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
# Build tooling is needed even when the caller uses a production environment.
# Fail in this stage if an unhealthy builder reports success without installing.
RUN npm ci --include=dev && test -d /app/node_modules/next

FROM node:22-bookworm-slim AS builder

WORKDIR /app

ARG NEXT_PUBLIC_BACKEND_ORIGIN=
ARG NEXT_PUBLIC_BACKEND_WS_ORIGIN=
ARG SITE_URL=https://social.example.com
ENV SITE_URL=$SITE_URL
ARG NEXT_IMAGE_UNOPTIMIZED=true

ENV NEXT_PUBLIC_BACKEND_ORIGIN=$NEXT_PUBLIC_BACKEND_ORIGIN
ENV NEXT_PUBLIC_BACKEND_WS_ORIGIN=$NEXT_PUBLIC_BACKEND_WS_ORIGIN
ENV NEXT_IMAGE_UNOPTIMIZED=$NEXT_IMAGE_UNOPTIMIZED
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build -- --webpack

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ARG NEXT_PUBLIC_BACKEND_ORIGIN=
ARG NEXT_PUBLIC_BACKEND_WS_ORIGIN=

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_PUBLIC_BACKEND_ORIGIN=$NEXT_PUBLIC_BACKEND_ORIGIN
ENV NEXT_PUBLIC_BACKEND_WS_ORIGIN=$NEXT_PUBLIC_BACKEND_WS_ORIGIN

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
