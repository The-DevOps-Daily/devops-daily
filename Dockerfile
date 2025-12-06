# Universal Dockerfile for DevOps Daily
# Switch environments with: BUILD_ENV=development or BUILD_ENV=production

ARG NODE_VERSION=20.18.1
ARG PNPM_VERSION=10.11.1
ARG BUILD_ENV=production

FROM node:${NODE_VERSION}-bullseye-slim

ARG BUILD_ENV
ARG PNPM_VERSION

# Install system packages based on environment
RUN apt-get update && \
    apt-get upgrade -y && \
    if [ "$BUILD_ENV" = "production" ]; then \
        apt-get install -y nginx curl; \
    else \
        apt-get install -y curl; \
    fi && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && \
    corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies based on environment
RUN if [ "$BUILD_ENV" = "production" ]; then \
        pnpm install --frozen-lockfile --prod; \
    else \
        pnpm install --frozen-lockfile; \
    fi

# Copy source code
COPY . .

# Build for production if needed
RUN if [ "$BUILD_ENV" = "production" ]; then \
        NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 pnpm run build:cf && \
        rm -rf /var/www/html/* && \
        mkdir -p /var/www/html && \
        cp -r /app/out/* /var/www/html/ && \
        echo 'server {' > /etc/nginx/sites-available/default && \
        echo '    listen 80;' >> /etc/nginx/sites-available/default && \
        echo '    listen [::]:80;' >> /etc/nginx/sites-available/default && \
        echo '    server_name localhost;' >> /etc/nginx/sites-available/default && \
        echo '    root /var/www/html;' >> /etc/nginx/sites-available/default && \
        echo '    index index.html;' >> /etc/nginx/sites-available/default && \
        echo '' >> /etc/nginx/sites-available/default && \
        echo '    gzip on;' >> /etc/nginx/sites-available/default && \
        echo '    gzip_vary on;' >> /etc/nginx/sites-available/default && \
        echo '    gzip_min_length 1024;' >> /etc/nginx/sites-available/default && \
        echo '    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;' >> /etc/nginx/sites-available/default && \
        echo '' >> /etc/nginx/sites-available/default && \
        echo '    add_header X-Frame-Options "SAMEORIGIN" always;' >> /etc/nginx/sites-available/default && \
        echo '    add_header X-Content-Type-Options "nosniff" always;' >> /etc/nginx/sites-available/default && \
        echo '    add_header X-XSS-Protection "1; mode=block" always;' >> /etc/nginx/sites-available/default && \
        echo '    add_header Referrer-Policy "strict-origin-when-cross-origin" always;' >> /etc/nginx/sites-available/default && \
        echo '    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;' >> /etc/nginx/sites-available/default && \
        echo '' >> /etc/nginx/sites-available/default && \
        echo '    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {' >> /etc/nginx/sites-available/default && \
        echo '        expires 1y;' >> /etc/nginx/sites-available/default && \
        echo '        add_header Cache-Control "public, immutable";' >> /etc/nginx/sites-available/default && \
        echo '    }' >> /etc/nginx/sites-available/default && \
        echo '' >> /etc/nginx/sites-available/default && \
        echo '    location / {' >> /etc/nginx/sites-available/default && \
        echo '        try_files $uri $uri.html /index.html;' >> /etc/nginx/sites-available/default && \
        echo '    }' >> /etc/nginx/sites-available/default && \
        echo '' >> /etc/nginx/sites-available/default && \
        echo '    error_page 404 /404.html;' >> /etc/nginx/sites-available/default && \
        echo '}' >> /etc/nginx/sites-available/default; \
    fi

# Environment variables
ENV NODE_ENV=${BUILD_ENV:-production}
ENV NEXT_TELEMETRY_DISABLED=1
ENV WATCHPACK_POLLING=true

# Metadata labels
LABEL org.opencontainers.image.title="DevOps Daily"
LABEL org.opencontainers.image.description="A modern content platform for DevOps professionals"
LABEL org.opencontainers.image.source="https://github.com/The-DevOps-Daily/devops-daily"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.vendor="DevOps Daily"
LABEL org.opencontainers.image.authors="DevOps Daily Team"

# Expose ports (both for flexibility)
EXPOSE 3000 80

# Health check that adapts to environment
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD if [ "$NODE_ENV" = "production" ]; then \
            curl -f http://localhost:80/ || exit 1; \
        else \
            curl -f http://localhost:3000/ || exit 1; \
        fi

# Start command based on environment
CMD if [ "$NODE_ENV" = "production" ]; then \
        nginx -g "daemon off;"; \
    else \
        pnpm run dev; \
    fi
