---
title: 'How to Execute Multiple Commands in Docker Compose'
excerpt: 'Learn different techniques for running multiple commands in Docker Compose services, from simple command chaining to advanced multi-stage initialization scripts.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-12-10'
publishedAt: '2024-12-10T16:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Docker Compose
  - Commands
  - Scripting
  - Automation
  - Configuration
---

Running multiple commands in a Docker Compose service is a common requirement, especially when you need to set up environments, install dependencies, or perform initialization tasks before starting your main application. Docker Compose provides several approaches to handle this, each with its own advantages and use cases.

The method you choose depends on whether you need commands to run sequentially, in parallel, or conditionally. You might also need different approaches for one-time setup tasks versus ongoing processes that should restart if they fail.

## Basic Command Chaining with Shell Operators

The simplest way to run multiple commands is using shell operators to chain them together. This approach works well for straightforward sequences where each command should run after the previous one completes.

```yaml
# docker-compose.yml
version: '3.8'
services:
  web-app:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - .:/app
    command: >
      sh -c "npm install &&
             npm run build &&
             npm start"
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
```

The `>` operator in YAML creates a single line from multiple lines, while `sh -c` executes the entire string as a shell command. The `&&` operator makes sure each command runs only if the previous one succeeds, stopping execution if any command fails.

For commands that should run regardless of previous failures, use the `;` operator instead:

```yaml
services:
  database-setup:
    image: postgres:15
    command: >
      sh -c "createdb myapp;
             psql -d myapp -c 'CREATE EXTENSION IF EXISTS postgis';
             pg_restore backup.sql"
    environment:
      - POSTGRES_PASSWORD=secretpassword
```

This approach runs all commands in sequence, even if some fail, which can be useful for setup scripts where some operations might be idempotent.

## Using Multi-Line Commands with Proper Formatting

For better readability, especially with longer command sequences, you can use YAML's literal block style with the `|` operator. This preserves line breaks and makes complex command sequences easier to understand and maintain.

```yaml
version: '3.8'
services:
  python-app:
    image: python:3.9-slim
    working_dir: /app
    volumes:
      - .:/app
    command: |
      sh -c "
        echo 'Installing dependencies...' &&
        pip install --no-cache-dir -r requirements.txt &&
        echo 'Running database migrations...' &&
        python manage.py migrate &&
        echo 'Collecting static files...' &&
        python manage.py collectstatic --noinput &&
        echo 'Starting Django server...' &&
        python manage.py runserver 0.0.0.0:8000
      "
    ports:
      - '8000:8000'
    depends_on:
      - database

  database:
    image: postgres:15
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=secretpassword
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

This format makes it easy to see each step in the process and add comments or modify individual commands without affecting the entire sequence.

## Creating Custom Initialization Scripts

For complex setups, creating dedicated shell scripts provides better maintainability and reusability. You can mount these scripts into the container and execute them as part of your service startup.

Create an initialization script (`scripts/init.sh`):

```bash
#!/bin/bash
set -e  # Exit on any error

echo "Starting application initialization..."

# Install additional packages if needed
if [ "$NODE_ENV" = "development" ]; then
    echo "Installing development dependencies..."
    npm install --include=dev
else
    echo "Installing production dependencies..."
    npm install --production
fi

# Wait for database to be ready
echo "Waiting for database connection..."
while ! nc -z database 5432; do
    echo "Database not ready, waiting..."
    sleep 2
done
echo "Database is ready!"

# Run migrations
echo "Running database migrations..."
npm run migrate

# Seed database in development
if [ "$NODE_ENV" = "development" ]; then
    echo "Seeding development data..."
    npm run seed
fi

# Start the application
echo "Starting application..."
exec npm start
```

Then reference this script in your Docker Compose file:

```yaml
version: '3.8'
services:
  web-app:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - .:/app
      - ./scripts/init.sh:/usr/local/bin/init.sh:ro
    command: sh /usr/local/bin/init.sh
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
    depends_on:
      - database

  database:
    image: postgres:15
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=secretpassword
```

Make sure the script is executable:

```bash
chmod +x scripts/init.sh
```

This approach separates complex logic from your Docker Compose file and makes it easier to test and modify initialization procedures.

## Running Background Processes with supervisord

When you need to run multiple long-running processes within a single container, supervisord provides a robust solution for process management. This is useful for services that need multiple daemons or background tasks.

Create a supervisord configuration (`config/supervisord.conf`):

```ini
[supervisord]
nodaemon=true
logfile=/dev/stdout
logfile_maxbytes=0
pidfile=/var/run/supervisord.pid

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0

[program:php-fpm]
command=php-fpm --nodaemonize
autostart=true
autorestart=true
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0

[program:worker]
command=php artisan queue:work --sleep=3 --tries=3
autostart=true
autorestart=true
numprocs=2
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
```

Use this configuration in your Docker Compose service:

```yaml
version: '3.8'
services:
  web-server:
    image: php:8.1-fpm-alpine
    volumes:
      - .:/var/www/html
      - ./config/supervisord.conf:/etc/supervisor/conf.d/supervisord.conf
    command: >
      sh -c "
        apk add --no-cache supervisor nginx &&
        supervisord -c /etc/supervisor/conf.d/supervisord.conf
      "
    ports:
      - '80:80'
    depends_on:
      - database

  database:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=laravel
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

This setup runs nginx, PHP-FPM, and queue workers simultaneously, with supervisord managing all processes and restarting them if they fail.

## Using Health Checks and Dependency Management

For services that depend on other services being ready, combine multiple commands with health checks to create robust startup sequences. This approach is particularly useful for database-dependent applications.

```yaml
version: '3.8'
services:
  api-server:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - .:/app
    command: >
      sh -c "
        echo 'Installing dependencies...' &&
        npm ci &&
        echo 'Waiting for database...' &&
        npx wait-for-it database:5432 --timeout=60 --strict &&
        echo 'Running migrations...' &&
        npm run migrate &&
        echo 'Starting server...' &&
        npm start
      "
    ports:
      - '3000:3000'
    depends_on:
      database:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgresql://postgres:secretpass@database:5432/myapp

  database:
    image: postgres:15
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=secretpass
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

The `wait-for-it` utility (you'll need to install it in your image or container) provides a more reliable way to wait for services than simple sleep commands. The health check makes sure the database is not just running, but actually ready to accept connections.

## Advanced Pattern: Multi-Stage Initialization

For complex applications, you might need different initialization steps that run at different times or under different conditions. This pattern uses multiple services to handle different phases of application setup.

```yaml
version: '3.8'
services:
  # Database migration service - runs once and exits
  migrate:
    image: myapp:latest
    working_dir: /app
    command: >
      sh -c "
        echo 'Waiting for database...' &&
        npx wait-for-it database:5432 --timeout=60 &&
        echo 'Running migrations...' &&
        npm run migrate &&
        echo 'Migration completed successfully'
      "
    depends_on:
      database:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgresql://postgres:secretpass@database:5432/myapp
    restart: 'no' # Don't restart this service

  # Seed data service - runs in development only
  seed:
    image: myapp:latest
    working_dir: /app
    command: >
      sh -c "
        echo 'Waiting for migrations...' &&
        sleep 10 &&
        echo 'Seeding database...' &&
        npm run seed &&
        echo 'Seeding completed'
      "
    depends_on:
      - migrate
    environment:
      - DATABASE_URL=postgresql://postgres:secretpass@database:5432/myapp
      - NODE_ENV=development
    restart: 'no'
    profiles:
      - development # Only run with --profile development

  # Main application service
  app:
    image: myapp:latest
    working_dir: /app
    command: npm start
    ports:
      - '3000:3000'
    depends_on:
      - migrate
    environment:
      - DATABASE_URL=postgresql://postgres:secretpass@database:5432/myapp
    restart: unless-stopped

  database:
    image: postgres:15
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=secretpass
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Run this setup differently for development and production:

```bash
# Production: run migrations and start app
docker-compose up -d

# Development: run migrations, seed data, and start app
docker-compose --profile development up -d
```

This pattern separates concerns clearly and allows for different behaviors in different environments while maintaining a clean, understandable configuration.

## Debugging Multi-Command Services

When working with multiple commands, debugging becomes more important. Add logging and error handling to make troubleshooting easier:

```yaml
services:
  app:
    image: node:18-alpine
    command: |
      sh -c "
        set -e
        echo '[$(date)] Starting initialization...'
        
        echo '[$(date)] Installing dependencies...'
        npm ci 2>&1 | sed 's/^/[npm] /'
        
        echo '[$(date)] Waiting for database...'
        timeout 60 sh -c 'until nc -z database 5432; do echo \"[$(date)] Waiting for DB...\"; sleep 2; done'
        
        echo '[$(date)] Running migrations...'
        npm run migrate 2>&1 | sed 's/^/[migrate] /' || {
          echo '[$(date)] Migration failed, exiting...'
          exit 1
        }
        
        echo '[$(date)] Starting application...'
        exec npm start
      "
```

This adds timestamps and prefixes to make it easier to follow the initialization process in the logs.

You now have multiple approaches for executing multiple commands in Docker Compose, from simple command chaining to complex multi-service initialization patterns. Choose the approach that best fits your application's complexity and requirements, starting simple and adding sophistication as needed.

## Related Resources

- [Docker Compose: Ports vs Expose](/posts/docker-compose-ports-vs-expose) — understand container networking
- [Docker Compose Environment Variables](/posts/docker-compose-environment-variables) — configure services without hardcoding
- [Difference Between RUN and CMD in a Dockerfile](/posts/difference-run-cmd-dockerfile) — choose the right Dockerfile instruction
- [Introduction to Docker Guide](/guides/introduction-to-docker) — learn Docker from the ground up
- [Docker Quiz](/quizzes/docker-quiz) — test your Docker knowledge
