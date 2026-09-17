# Running DevOps Daily in Docker

A single multi-stage Dockerfile: `--target development` runs the Next.js dev
server on Node, `--target production` builds the static export and serves it
from nginx.

If you only want to work on the site, [`pnpm dev`](../README.md#getting-started)
is simpler and faster. This is here for people who want the container.

DevOps Daily can run in Docker for consistent environments. The project uses a **single multi-stage Dockerfile**; pick the mode with `--target`. Development runs the Next.js dev server on Node; production builds the static export and serves it from nginx.

### Building the Docker Image

```bash
# Build production image (static export served by nginx)
docker build --target production -t devops-daily:prod .

# Build development image (Next.js dev server with hot-reload)
docker build --target development -t devops-daily:dev .
```

### Running the Container

```bash
# Run production container
docker run -p 8080:80 devops-daily:prod

# Run in detached mode (background)
docker run -d -p 8080:80 --name devops-daily-app devops-daily:prod

# Run development container with hot-reload
docker run -p 3000:3000 -v $(pwd):/app devops-daily:dev
```

After starting the container, visit [http://localhost:8080](http://localhost:8080) for production or [http://localhost:3000](http://localhost:3000) for development.

### Container Management

```bash
# Stop the container
docker stop devops-daily-app

# Start the container
docker start devops-daily-app

# Remove the container
docker rm devops-daily-app

# View logs
docker logs devops-daily-app

# View logs in real-time
docker logs -f devops-daily-app
```

### Docker Image Details

- **Architecture**: Single multi-stage Dockerfile, selected with `--target`
- **Base Image**: Node.js 22.13.1 (Bookworm Slim) for the build and dev stages
- **Production Image**: `nginx:1.27-alpine` serving the static export, so it carries no Node runtime
- **Environments**: `--target development` or `--target production`
- **Security**: Runs as non-root user, includes OS security updates
- **Health Check**: Built-in health check endpoint
- **Version Pinning**: Node.js, pnpm, and nginx versions are pinned via build args for reproducible builds

#### Build Arguments

You can customize the versions used in the Docker build:

```bash
# Build production with custom versions
docker build \
  --target production \
  --build-arg NODE_VERSION=22.13.1 \
  --build-arg PNPM_VERSION=10.34.5 \
  -t devops-daily:custom .

# Build development with custom Node/pnpm versions
docker build \
  --target development \
  --build-arg NODE_VERSION=22.13.1 \
  --build-arg PNPM_VERSION=10.34.5 \
  -t devops-daily:dev .
```

### Docker Compose (Recommended)

Docker Compose is the easiest way to manage development and production environments. Each service already names the build stage it needs, so there is nothing to pass.

#### Quick Start

```bash
# Start development server with hot-reload
docker compose up dev

# Start in background
docker compose up -d dev

# View logs
docker compose logs -f dev

# Stop all services
docker compose down
```

#### Available Services

| Service | Port | Description                        |
| ------- | ---- | ---------------------------------- |
| `dev`   | 3000 | Development server with hot-reload |
| `prod`  | 8080 | Production build served via nginx  |

#### Development Mode

```bash
# Start development server (with hot-reload)
docker compose up dev

# Rebuild after dependency changes
docker compose up dev --build

# Run in background
docker compose up -d dev
```

The development server mounts your local files, so any changes you make will automatically trigger a reload.

#### Production Mode

```bash
# Build and run production version
docker compose up prod --build

# Run in background
docker compose up -d prod
```

#### Useful Commands

```bash
# Stop all services
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v

# View logs for a specific service
docker compose logs -f dev

# Rebuild a specific service
docker compose build dev

# Run a one-off command in the dev container
docker compose run --rm dev pnpm lint
```
