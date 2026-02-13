---
title: Docker Compose
description: Orchestrate multi-container applications with Docker Compose
order: 8
---

Managing multiple containers manually can quickly become complex. Docker Compose solves this problem by allowing you to define and run multi-container applications using a single YAML file. This simplifies the process of building, running, and connecting services while maintaining their configurations in version control.

## Understanding Docker Compose

Docker Compose is a tool for defining and running multi-container Docker applications. With Compose, you use a YAML file to configure your application's services, networks, and volumes. Then, with a single command, you create and start all the services from your configuration.

## Installing Docker Compose

Docker Desktop for Mac and Windows includes Docker Compose by default. For Linux, you may need to install it separately:

```bash
# For the latest standalone Compose binary
sudo curl -L "https://github.com/docker/compose/releases/download/v2.18.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

Docker now also offers Compose as a plugin for the Docker CLI (newer versions):

```bash
docker compose version
```

vs.

```bash
docker-compose version
```

Both work, but we'll use `docker-compose` in this guide for compatibility.

## Creating a Compose File

Let's create a simple web application with a frontend, backend, and database using Docker Compose.

Create a file named `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # Frontend service
  frontend:
    image: nginx:alpine
    ports:
      - '8080:80'
    volumes:
      - ./frontend:/usr/share/nginx/html
    depends_on:
      - backend

  # Backend API service
  backend:
    build: ./backend
    ports:
      - '5000:5000'
    environment:
      - DATABASE_URL=postgres://postgres:password@db:5432/app
    depends_on:
      - db

  # Database service
  db:
    image: postgres:13
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=app

volumes:
  postgres_data:
```

This configuration:

1. Creates three services: `frontend`, `backend`, and `db`
2. Specifies container images, port mappings, volumes, and environment variables
3. Defines dependencies between services
4. Creates a persistent volume for the database

## Core Compose Concepts

### Services

Each service in a Compose file represents a container. Services are defined with configurations similar to `docker run` command parameters.

Key service options include:

- `image`: Specifies the image to use
- `build`: Builds a custom image from a Dockerfile
- `ports`: Maps container ports to host ports
- `volumes`: Mounts host directories or named volumes
- `environment`: Sets environment variables
- `depends_on`: Establishes service dependencies
- `restart`: Sets the restart policy

### Volumes

Volumes in Compose work the same as Docker volumes, allowing data to persist beyond the life of a container:

```yaml
volumes:
  postgres_data: # Named volume definition
```

Services can then use these volumes:

```yaml
services:
  db:
    volumes:
      - postgres_data:/var/lib/postgresql/data # Mount the named volume
      - ./init-scripts:/docker-entrypoint-initdb.d # Bind mount from host
```

### Networks

Compose automatically creates a default network for your application, but you can define custom networks:

```yaml
services:
  backend:
    networks:
      - backend-network
      - db-network

  db:
    networks:
      - db-network

networks:
  backend-network:
  db-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24
```

## Basic Docker Compose Commands

### Starting Your Application

To start all services defined in your Compose file:

```bash
docker-compose up
```

To run in detached mode (background):

```bash
docker-compose up -d
```

### Stopping Services

To stop your running services:

```bash
docker-compose down
```

To stop services and remove volumes:

```bash
docker-compose down -v
```

### Viewing Service Logs

To see logs from all services:

```bash
docker-compose logs
```

To follow logs from specific services:

```bash
docker-compose logs -f backend db
```

### Listing Services

To see the status of your services:

```bash
docker-compose ps
```

### Executing Commands in Services

To run a one-off command in a service container:

```bash
docker-compose exec backend python manage.py migrate
```

Or for a new container instance:

```bash
docker-compose run --rm backend python manage.py createsuperuser
```

## Real-World Compose Example

Let's look at a more detailed example for a full-stack web application:

```yaml
version: '3.8'

services:
  # Reverse proxy
  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx/conf:/etc/nginx/conf.d
      - ./nginx/certs:/etc/nginx/certs
      - ./frontend/build:/usr/share/nginx/html
    depends_on:
      - api
    restart: always

  # React frontend build process
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - REACT_APP_API_URL=http://localhost/api
    ports:
      - '3000:3000'
    command: npm start

  # Node.js API server
  api:
    build: ./backend
    volumes:
      - ./backend:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://postgres:password@db:5432/app
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=your_jwt_secret
    depends_on:
      - db
      - redis
    restart: always

  # PostgreSQL database
  db:
    image: postgres:13
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d
    environment:
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=app
    ports:
      - '5432:5432'
    restart: always

  # Redis for caching
  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data
    ports:
      - '6379:6379'
    restart: always

volumes:
  postgres_data:
  redis_data:
```

This setup includes:

- Nginx as a reverse proxy serving a frontend build
- A development frontend container with hot reloading
- An API container connected to Postgres and Redis
- Persistent volumes for database and cache data
- Appropriate restart policies for services

## Environment Variables in Compose

You can pass environment variables to containers in several ways:

### Inline Environment Variables

```yaml
services:
  web:
    environment:
      - DEBUG=true
      - API_KEY=myapikey
```

### Using an Environment File

```yaml
services:
  web:
    env_file:
      - .env.web
```

Where `.env.web` contains:

```
DEBUG=true
API_KEY=myapikey
```

### Using Host Environment Variables

You can also use variables from your host:

```yaml
services:
  web:
    environment:
      - API_KEY=${HOST_API_KEY}
```

Then run with:

```bash
HOST_API_KEY=myapikey docker-compose up
```

## Scaling Services

Docker Compose allows you to run multiple instances of a service:

```bash
docker-compose up -d --scale worker=3
```

This would start three instances of a service named `worker`.

In your Compose file, make sure to use non-conflicting port bindings for scalable services:

```yaml
services:
  worker:
    image: my-worker-image
    # Don't bind to a fixed host port if you want to scale
    # ports:
    #   - "8080"  # Only exposes the container port without binding to host
```

## Extending Compose Files

For different environments, you can extend your main Compose file with overrides:

**docker-compose.yml** (Base configuration):

```yaml
version: '3.8'

services:
  web:
    image: myapp:latest
    build: .
    ports:
      - '8000:8000'
```

**docker-compose.prod.yml** (Production overrides):

```yaml
version: '3.8'

services:
  web:
    restart: always
    environment:
      - NODE_ENV=production
    ports:
      - '80:8000'
```

Run with:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Compose for Development Workflows

Docker Compose is excellent for development environments:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app # Mount current directory to /app in the container
      - /app/node_modules # Volume for node_modules to prevent overwriting
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
    command: npm run dev # Use development command
```

Key development features:

- Mount code directories for live updates
- Override production commands with development alternatives
- Create development-specific environment variables

## Compose for Production

While Docker Compose is primarily a development tool, it can be used in production for simple deployments:

```yaml
version: '3.8'

services:
  app:
    image: mycompany/myapp:${TAG:-latest}
    restart: always
    ports:
      - '80:8000'
    environment:
      - NODE_ENV=production
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
```

Note: For more complex production deployments, consider Docker Swarm or Kubernetes.

## Health Checks in Compose

Health checks ensure your services are running correctly:

```yaml
services:
  web:
    image: nginx
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Other services can depend on this health check:

```yaml
services:
  backend:
    depends_on:
      web:
        condition: service_healthy
```

## Secrets Management in Compose

For non-sensitive configurations, environment variables work well. For secrets, consider these approaches:

1. **Local development**: Use `.env` files (but don't commit them to version control)

2. **Production**: Use external secret management tools and inject values at runtime

For Docker Swarm, you can use Docker secrets:

```yaml
version: '3.8'

services:
  web:
    image: myapp
    secrets:
      - db_password

secrets:
  db_password:
    file: ./db_password.txt
```

## Deploying with Compose to DigitalOcean

Docker Compose files work excellently when deploying to cloud providers like DigitalOcean. You can set up a Droplet with Docker installed and use your Compose file to deploy your application.

[Sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) and get $200 in free credits to deploy your Compose-based applications.

Steps to deploy:

1. Create a Droplet with Docker pre-installed (One-click Docker application)
2. Copy your project files and Compose file to the Droplet
3. Run `docker-compose up -d` on the Droplet

## Compose Specification and Versions

Docker Compose files have evolved through several versions. As of 2023, version 3.x is the most common, with the latest being the Compose Specification:

```yaml
# Modern Compose Specification format
name: myapp
services:
  web:
    image: nginx
```

The main versions:

- **Version 1**: Legacy format, no longer recommended
- **Version 2**: Added named networks and depends_on
- **Version 3**: Designed for both Compose and Swarm, with some limitations
- **Compose Spec**: The newest format that unifies syntax across platforms

## Best Practices for Docker Compose

1. **Use version control** for your Compose files

2. **Follow a consistent project structure**:

   ```
   myapp/
   ├── docker-compose.yml
   ├── docker-compose.override.yml
   ├── .env
   ├── service1/
   │   ├── Dockerfile
   │   └── ...
   └── service2/
       ├── Dockerfile
       └── ...
   ```

3. **Create separate Compose files** for different environments

4. **Use the `.env` file** for environment-specific variables

5. **Set restart policies** for services that should be resilient

6. **Leverage healthchecks** for critical services

7. **Always specify versions** for images (never use `latest` in production)

8. **Document service dependencies** using `depends_on`

9. **Limit container privileges** following the principle of least privilege

10. **Keep your Compose files DRY** using YAML anchors and extensions (for complex setups)

In the next section, we'll cover Docker best practices for security, performance, and resource optimization.
