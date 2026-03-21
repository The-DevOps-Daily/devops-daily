---
title: 'Docker Compose: Wait for Container X Before Starting Y'
excerpt: 'Learn how to configure Docker Compose to ensure one container starts only after another is ready.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-12-25'
publishedAt: '2024-12-25T09:00:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Docker Compose
  - Containers
  - Dependencies
  - Tutorials
---

## TLDR

To make one container wait for another in Docker Compose, use health checks and the `depends_on` option. Health checks ensure the dependent container is ready before the next container starts.

---

When working with Docker Compose, you may need to ensure that one container starts only after another is fully ready. For example, a web application container might depend on a database container. This guide will show you how to configure Docker Compose to handle such dependencies.

## Step 1: Add Health Checks

Health checks allow Docker to verify that a container is ready. Add a health check to the container that needs to be ready first. For example, in the `docker-compose.yml` file:

```yaml
version: '3.8'
services:
  db:
    image: postgres:latest
    healthcheck:
      test: ['CMD', 'pg_isready', '-U', 'postgres']
      interval: 10s
      timeout: 5s
      retries: 5
```

### Explanation

- **`test`**: Specifies the command to check the container's health.
- **`interval`**: How often the health check runs.
- **`timeout`**: Maximum time allowed for the health check.
- **`retries`**: Number of retries before marking the container as unhealthy.

## Step 2: Use `depends_on`

The `depends_on` option specifies the order in which containers start. For example:

```yaml
version: '3.8'
services:
  app:
    image: my-app:latest
    depends_on:
      db:
        condition: service_healthy
```

### Explanation

- **`depends_on`**: Ensures the `app` service waits for the `db` service.
- **`condition: service_healthy`**: Waits for the `db` container to pass its health check.

## Step 3: Start the Services

Run the following command to start the services:

```bash
docker-compose up
```

Docker Compose will ensure the `db` container is healthy before starting the `app` container.

## Step 4: Verify the Configuration

Check the logs to verify that the containers started in the correct order:

```bash
docker-compose logs
```

Look for messages indicating that the `app` container waited for the `db` container.

## Additional Options

If you need more control over the startup process, consider the following options:

### Use a Custom Script

If health checks are not sufficient, you can use a custom script to wait for the dependent container. For example:

```yaml
version: '3.8'
services:
  app:
    image: my-app:latest
    entrypoint: ['sh', '-c', 'until nc -z db 5432; do sleep 1; done; exec my-app']
```

### Explanation

- **`entrypoint`**: Overrides the default entrypoint to include a wait command.
- **`nc -z db 5432`**: Checks if the `db` container is listening on port 5432.

## Best Practices

- **Use Health Checks**: Always prefer health checks for dependency management.
- **Minimize Dependencies**: Keep dependencies simple to avoid complex configurations.
- **Monitor Logs**: Use logs to debug and verify container startup order.

By following these steps, you can ensure that Docker Compose starts containers in the correct order, making your applications more reliable and easier to manage.

## Related Resources

- [Docker Compose: Up Only Certain Containers](/posts/docker-compose-up-only-certain-containers) — selective service startup
- [Docker Compose: Ports vs Expose](/posts/docker-compose-ports-vs-expose) — service networking
- [Connecting to PostgreSQL in Docker from Outside](/posts/connecting-to-postgresql-in-a-docker-container-from-outside) — database readiness patterns
- [Introduction to Docker: Compose](/guides/introduction-to-docker) — Docker Compose fundamentals
