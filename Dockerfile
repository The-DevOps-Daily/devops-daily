# Universal Dockerfile for DevOps Daily
# Multi-stage build for optimized development and production images

ARG NODE_VERSION=22.13.1
ARG PNPM_VERSION=10.28.1

# ===========================================================================
# Stage 1: Base image with common dependencies
# ===========================================================================
FROM node:${NODE_VERSION}-bookworm-slim AS base

ARG PNPM_VERSION

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable && \
    corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# ===========================================================================
# Stage 2: Development image
# Hot-reload enabled for local development
# ===========================================================================
FROM base AS development

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV WATCHPACK_POLLING=true

LABEL org.opencontainers.image.title="DevOps Daily"
LABEL org.opencontainers.image.description="A modern content platform for DevOps professionals"
LABEL org.opencontainers.image.source="https://github.com/The-DevOps-Daily/devops-daily"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.vendor="DevOps Daily"
LABEL org.opencontainers.image.authors="DevOps Daily Team"

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

CMD ["pnpm", "run", "dev"]

# ===========================================================================
# Stage 3: Production builder
# Builds the static site for production
# ===========================================================================
FROM base AS builder

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm run build:cf

# ===========================================================================
# Stage 4: Production runtime
# Minimal nginx image serving static files
# ===========================================================================
FROM nginx:1.27-alpine AS production

RUN rm /etc/nginx/conf.d/default.conf

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/out /usr/share/nginx/html

RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

LABEL org.opencontainers.image.title="DevOps Daily"
LABEL org.opencontainers.image.description="A modern content platform for DevOps professionals"
LABEL org.opencontainers.image.source="https://github.com/The-DevOps-Daily/devops-daily"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.vendor="DevOps Daily"
LABEL org.opencontainers.image.authors="DevOps Daily Team"

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
