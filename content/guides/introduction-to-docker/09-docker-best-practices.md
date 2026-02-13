---
title: Docker Best Practices
description: Learn essential practices for security, efficiency, and maintainability of your Docker deployments
order: 9
---

As Docker becomes a critical part of your development and deployment workflow, implementing best practices ensures your containers are secure, efficient, and maintainable. This section covers essential practices that will help you avoid common pitfalls and optimize your Docker usage.

## Security Best Practices

### Use Official and Verified Images

Always prefer official images from Docker Hub or verified publisher images. These undergo security scans and follow best practices:

```bash
docker pull python:3.11-slim
```

Instead of:

```bash
docker pull random-user/python
```

### Scan Images for Vulnerabilities

Regularly scan your images for security vulnerabilities:

```bash
# Using Docker Scout (integrated into Docker Desktop)
docker scout cves myapp:latest

# Or using third-party tools like Trivy
trivy image myapp:latest
```

### Run Containers with Limited Privileges

By default, containers run as root, which poses security risks. Use non-root users in your Dockerfiles:

```dockerfile
FROM node:18-alpine

# Create app directory and a non-root user
WORKDIR /app
RUN addgroup -g 1001 appuser && \
    adduser -u 1001 -G appuser -D appuser

COPY --chown=appuser:appuser . .
RUN npm install

# Switch to non-root user
USER appuser

CMD ["node", "server.js"]
```

### Use `--security-opt` Flags

Apply security options when running containers:

```bash
docker run --security-opt no-new-privileges --cap-drop=ALL --cap-add=NET_BIND_SERVICE myapp
```

This prevents privilege escalation and drops all capabilities except the ability to bind to privileged ports.

### Enable Content Trust

Sign and verify images with Docker Content Trust:

```bash
# Enable content trust
export DOCKER_CONTENT_TRUST=1

# Now docker pull/push will verify signatures
docker pull nginx:latest
```

### Use Secrets Management

Never hardcode sensitive data in Dockerfiles or images. Use environment variables, Docker secrets, or dedicated secret management tools:

```dockerfile
# BAD: Hardcoded credentials
RUN echo "password123" > /app/password.txt

# GOOD: Use build args, environment variables, or mount secrets at runtime
```

### Minimize the Attack Surface

Keep your images minimal to reduce the attack surface:

- Use slim or alpine base images
- Only install necessary packages
- Remove build tools after compilation
- Use multi-stage builds to reduce final image size

### Apply Resource Limits

Prevent denial-of-service attacks by limiting container resources:

```bash
docker run -d --name myapp \
  --memory="500m" --memory-swap="1g" \
  --cpus="0.5" \
  myapp:latest
```

## Image Building Best Practices

### Use Multi-Stage Builds

Multi-stage builds keep your final images small and free of build dependencies:

```dockerfile
# Build stage
FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
RUN npm install --production
EXPOSE 3000
CMD ["npm", "start"]
```

### Optimize Layer Caching

Order Dockerfile instructions from least to most frequently changing to take advantage of layer caching:

```dockerfile
FROM node:18-alpine

# These layers change less frequently
WORKDIR /app
COPY package*.json ./
RUN npm install

# These layers change more frequently
COPY . .
RUN npm run build

CMD ["npm", "start"]
```

### Use .dockerignore Files

Create a `.dockerignore` file to prevent unnecessary files from being added to the build context:

```
node_modules
npm-debug.log
Dockerfile
.git
.github
.dockerignore
.env*
*.md
```

This speeds up builds and prevents sensitive files from being included.

### Minimize Layer Count

Combine related commands to reduce the number of layers:

```dockerfile
# BAD: Each RUN creates a new layer
RUN apt-get update
RUN apt-get install -y package1
RUN apt-get install -y package2
RUN apt-get clean

# GOOD: One layer for all related operations
RUN apt-get update && \
    apt-get install -y package1 package2 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
```

### Pin Specific Versions

Use specific versions for base images and dependencies:

```dockerfile
# BAD: No specific version
FROM node
RUN npm install express

# GOOD: Pinned versions
FROM node:18.17.1-alpine3.18
RUN npm install express@4.18.2
```

This ensures reproducible builds and prevents unexpected changes.

### Use Small Base Images

Choose the smallest appropriate base image:

```dockerfile
# Large base image (~940MB)
FROM node:18

# Smaller base image (~180MB)
FROM node:18-alpine
```

Alpine and slim variants often provide significant size reductions.

## Runtime Best Practices

### Set Appropriate Restart Policies

Configure containers to restart automatically as needed:

```bash
docker run -d --restart=unless-stopped myapp
```

Restart policies:

- `no`: Default, container won't restart automatically
- `on-failure[:max-retries]`: Restart if the container exits with non-zero code
- `always`: Always restart regardless of exit status
- `unless-stopped`: Always restart unless explicitly stopped

### Use Health Checks

Add health checks to monitor container health:

```dockerfile
FROM nginx:alpine
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -f http://localhost/ || exit 1
```

Or when running a container:

```bash
docker run -d --health-cmd="curl -f http://localhost/ || exit 1" \
  --health-interval=30s nginx:alpine
```

### Set Container Names

Name your containers for easier identification and reference:

```bash
docker run -d --name backend-api myapp:latest
```

### Use Volumes for Persistent Data

Store data that should persist in volumes:

```bash
docker run -d --name db \
  -v postgres-data:/var/lib/postgresql/data \
  postgres:13
```

### Set Resource Limits in Production

Always set memory and CPU limits in production:

```bash
docker run -d --name production-app \
  --memory="2g" --memory-reservation="1.5g" \
  --cpus="1.5" \
  myapp:latest
```

### Use Log Rotation

Prevent containers from filling disk space with logs:

```bash
docker run -d --name app \
  --log-driver=json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  myapp:latest
```

## Container Orchestration Best Practices

### Use Docker Compose for Multi-Container Applications

Docker Compose simplifies management of multi-container applications:

```yaml
version: '3.8'
services:
  web:
    build: .
    ports:
      - '8000:8000'
    depends_on:
      - db
    restart: always
  db:
    image: postgres:13
    volumes:
      - db-data:/var/lib/postgresql/data
volumes:
  db-data:
```

### Consider Orchestration Tools for Production

For production environments, consider orchestration platforms that provide advanced features:

- Docker Swarm (simpler, integrated with Docker)
- Kubernetes (more powerful, industry standard)
- Amazon ECS (fully managed for AWS)
- DigitalOcean Kubernetes (simplified Kubernetes)

### Implement Service Discovery

Use service discovery mechanisms to allow containers to find each other:

```yaml
version: '3.8'
services:
  web:
    image: myapp:latest
    environment:
      - DB_HOST=db # Uses the service name for discovery
    depends_on:
      - db
  db:
    image: postgres:13
```

## Monitoring and Logging Best Practices

### Implement Container Monitoring

Monitor your containers' health and performance with tools like:

- Prometheus and Grafana
- Datadog
- New Relic
- cAdvisor

### Centralize Logs

Send container logs to a centralized logging system:

```bash
docker run -d --name app \
  --log-driver=fluentd \
  --log-opt fluentd-address=localhost:24224 \
  myapp:latest
```

Popular logging stacks include:

- ELK Stack (Elasticsearch, Logstash, Kibana)
- Graylog
- Loki with Grafana

### Add Meaningful Labels

Use labels to organize and filter your containers:

```dockerfile
LABEL maintainer="team@example.com" \
      app="backend-api" \
      version="1.2.3" \
      environment="production"
```

Or when running containers:

```bash
docker run -d --name app \
  --label environment=production \
  --label team=backend \
  myapp:latest
```

## CI/CD Best Practices

### Automate Image Building

Implement CI/CD pipelines for automated image building:

```yaml
# GitHub Actions example
name: Build and Push Docker Image
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Image
        run: docker build -t myapp:${{ github.sha }} .
      - name: Run Tests
        run: docker run --rm myapp:${{ github.sha }} npm test
      - name: Push to Registry
        run: |
          docker tag myapp:${{ github.sha }} registry.example.com/myapp:${{ github.sha }}
          docker tag myapp:${{ github.sha }} registry.example.com/myapp:latest
          docker push registry.example.com/myapp:${{ github.sha }}
          docker push registry.example.com/myapp:latest
```

### Implement Automated Testing

Test your images as part of your CI/CD pipeline:

- Unit tests inside the container
- Integration tests with Docker Compose
- Security scans
- Compliance checks

### Version Your Images Properly

Use a consistent versioning strategy:

```bash
# Tag with semantic version and Git hash
docker build -t myapp:1.2.3 -t myapp:1.2.3-abcd123 .
```

## Documentation Best Practices

### Document Build and Run Requirements

Create a comprehensive README with build and run instructions:

```markdown
# MyApp Container

## Build

    docker build -t myapp .
```

## Run

```bash
docker run -d -p 8000:8000 -e DB_HOST=localhost myapp
```

## Environment Variables

- `DB_HOST`: Database hostname (required)
- `PORT`: Application port (default: 8000)
- `LOG_LEVEL`: Logging level (default: info)

### Document Image Versions

Maintain a changelog for your images:

```
# Changelog

## 1.2.0 (2023-05-15)
- Added feature X
- Updated base image to Node.js 18

## 1.1.0 (2023-04-10)
- Fixed security vulnerability in dependency Y
- Optimized build process
```

## Development Workflow Best Practices

### Use Docker for Development Environments

Create consistent development environments with Docker:

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
```

### Use Bind Mounts for Development

Mount your source code for live updates during development:

```bash
docker run -d --name dev-env \
  -v $(pwd):/app \
  -p 3000:3000 \
  myapp:dev
```

### Debug Inside Containers

Set up debugging capabilities in your development containers:

```dockerfile
# Dockerfile.dev
FROM node:18

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Expose debug port
EXPOSE 3000 9229

# Command with debugging enabled
CMD ["node", "--inspect=0.0.0.0:9229", "index.js"]
```

Then connect your IDE to the debug port.

## Cloud Deployment Best Practices

Deploying Docker applications to the cloud requires additional considerations:

### Choose the Right Deployment Model

Consider your needs when choosing a deployment model:

- Self-managed containers on VMs
- Managed container services (AWS ECS, DigitalOcean App Platform)
- Kubernetes (managed or self-hosted)

### Optimize for Cloud Storage

Use object storage services instead of container storage for static assets:

```dockerfile
FROM nginx:alpine
# Instead of copying static assets into the image
RUN apk add --no-cache aws-cli
CMD aws s3 sync s3://mybucket/assets /usr/share/nginx/html/assets && nginx -g 'daemon off;'
```

### Consider Managed Services

For common components like databases, message queues, and caches, consider using managed services instead of containers in production.

### Use DigitalOcean for Simplified Container Deployment

DigitalOcean provides simplified container deployment options that implement many of these best practices automatically. [Sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) to get $200 in free credits and deploy your containerized applications following best practices.

## Performance and Efficiency Best Practices

### Use BuildKit for Faster Builds

Enable BuildKit for faster, more efficient builds:

```bash
export DOCKER_BUILDKIT=1
docker build -t myapp .
```

Or in Docker Compose:

```yaml
version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        BUILDKIT_INLINE_CACHE: 1
```

### Optimize Container Startup Time

Minimize container startup time for better scaling:

- Use smaller base images
- Optimize dependencies
- Compile code ahead of time when possible
- Use init systems with fast startup

### Implement Proper Shutdown Handling

Ensure your application properly handles SIGTERM signals for graceful shutdowns:

```javascript
// Node.js example
process.on('SIGTERM', () => {
  console.log('Graceful shutdown');
  server.close(() => {
    db.disconnect();
    process.exit(0);
  });
});
```

## Keeping Up with Docker Best Practices

Docker and container technologies evolve rapidly. Stay current by:

1. Following Docker's official blog and documentation
2. Subscribing to container security advisories
3. Participating in Docker and Kubernetes communities
4. Keeping your Docker engine and tools updated
5. Regularly reviewing and updating your Dockerfiles and practices

In the next section, we'll explore how to prepare your Docker environment for production use, including scaling, load balancing, and monitoring considerations.
