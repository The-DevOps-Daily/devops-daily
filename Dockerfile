# =============================================================================
# Dockerfile for DevOps Daily
# Multi-stage build for optimized image size
# =============================================================================

# Build arguments for version pinning and configurability
ARG NODE_VERSION=20.18.1
ARG PNPM_VERSION=10.11.1
ARG NGINX_VERSION=1.27-alpine

# =============================================================================
# Stage 1: Dependencies
# Install production dependencies in a separate stage for better caching
# =============================================================================
FROM node:${NODE_VERSION}-bullseye-slim AS deps

ARG PNPM_VERSION

# Install security updates and pnpm with specific version
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    corepack enable && \
    corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# =============================================================================
# Stage 2: Builder
# Build the Next.js application
# =============================================================================
FROM node:${NODE_VERSION}-bullseye-slim AS builder

ARG PNPM_VERSION

# Install security updates and pnpm with specific version
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    corepack enable && \
    corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY . .

# Set environment to production for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build arguments for optional cache mount
ARG BUILDKIT_CACHE_MOUNT_NS=devops-daily

# Build the application
# Using build:cf for faster builds (skips image generation)
# For full build with image generation, use: RUN pnpm run build
RUN --mount=type=cache,target=/app/.next/cache,id=${BUILDKIT_CACHE_MOUNT_NS} \
    pnpm run build:cf

# =============================================================================
# Stage 3: Production Runner
# Minimal image to serve the static export
# =============================================================================
FROM nginx:${NGINX_VERSION} AS runner

# Add labels for better container management
LABEL org.opencontainers.image.title="DevOps Daily"
LABEL org.opencontainers.image.description="A modern content platform for DevOps professionals"
LABEL org.opencontainers.image.source="https://github.com/The-DevOps-Daily/devops-daily"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.vendor="DevOps Daily"
LABEL org.opencontainers.image.authors="DevOps Daily Team"

# Install security updates
RUN apk update && \
    apk upgrade && \
    rm -rf /var/cache/apk/*

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy custom nginx configuration for SPA routing
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    listen [::]:80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;
    gzip_comp_level 6;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Main location block
    location / {
        try_files \$uri \$uri.html /index.html;
    }

    # Error page handling
    error_page 404 /404.html;
    location = /404.html {
        internal;
    }
}
EOF

# Copy the static export from builder stage
COPY --from=builder /app/out /usr/share/nginx/html

# Adjust permissions for non-root user
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chmod -R 755 /usr/share/nginx/html && \
    touch /run/nginx.pid && \
    chown -R nginx:nginx /run/nginx.pid

# Switch to non-root user
USER nginx

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
