FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder

WORKDIR /app

ARG NEXT_PUBLIC_BACKEND_ORIGIN=http://localhost:8080
ARG NEXT_PUBLIC_BACKEND_WS_ORIGIN=ws://localhost:8080
ARG NEXT_IMAGE_UNOPTIMIZED=true

ENV NEXT_PUBLIC_BACKEND_ORIGIN=$NEXT_PUBLIC_BACKEND_ORIGIN
ENV NEXT_PUBLIC_BACKEND_WS_ORIGIN=$NEXT_PUBLIC_BACKEND_WS_ORIGIN
ENV NEXT_IMAGE_UNOPTIMIZED=$NEXT_IMAGE_UNOPTIMIZED
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build -- --webpack

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ARG NEXT_PUBLIC_BACKEND_ORIGIN=http://localhost:8080
ARG NEXT_PUBLIC_BACKEND_WS_ORIGIN=ws://localhost:8080

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_PUBLIC_BACKEND_ORIGIN=$NEXT_PUBLIC_BACKEND_ORIGIN
ENV NEXT_PUBLIC_BACKEND_WS_ORIGIN=$NEXT_PUBLIC_BACKEND_WS_ORIGIN

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "run", "start"]
