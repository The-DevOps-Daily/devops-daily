---
title: 'How to Restart a Single Container with Docker Compose'
excerpt: 'Learn how to restart a specific container in a Docker Compose setup without affecting other services.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-07-18'
publishedAt: '2024-07-18T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Docker Compose
  - Tutorials
---

## TLDR

To restart a single container in a Docker Compose setup, use the `docker compose restart <service_name>` command. This allows you to restart a specific service without disrupting others.

---

Docker Compose simplifies managing multi-container applications. However, there are times when you need to restart just one container without affecting the rest. Here's how to do it.

## Step 1: Identify the Service Name

The service name is defined in your `compose.yaml` file. Locate the service you want to restart. Originally, this file is named `docker compose.yml`, but it can also be named `compose.yaml` in newer versions which is the recommended format.

### Example `compose.yaml`

```yaml
services:
  web:
    image: nginx
    ports:
      - '80:80'
  db:
    image: postgres
    environment:
      POSTGRES_PASSWORD: example
```

In this example, the service names are `web` and `db`.

## Step 2: Restart the Service

Use the `docker compose restart` command followed by the service name.

### Command

```bash
docker compose restart web
```

### Explanation

- `docker compose restart web`: Restarts only the `web` service.
- Other services, like `db`, remain unaffected.

## Step 3: Verify the Restart

Check the status of your containers to ensure the service restarted successfully.

### Command

```bash
docker compose ps
```

### Example Output

```plaintext
   Name                  Command               State           Ports
----------------------------------------------------------------------------
project_web_1   nginx -g 'daemon off;'        Up      0.0.0.0:80->80/tcp
project_db_1    docker-entrypoint.sh postgres Up      5432/tcp
```

The `State` column should show `Up` for the restarted service.

## Best Practices

- **Use Descriptive Service Names**: Clearly name your services in `docker compose.yml`.
- **Monitor Logs**: Use `docker compose logs <service_name>` to debug issues after a restart.
- **Minimize Downtime**: Restart services during low-traffic periods if possible.

By following these steps, you can efficiently restart individual containers in a Docker Compose setup, ensuring minimal disruption to your application.


## Related Resources

- [Docker Compose: Up Only Certain Containers](/posts/docker-compose-up-only-certain-containers) — selective startup
- [Rebuild Docker Container in Compose](/posts/rebuild-docker-container-compose) — rebuild patterns
- [Upgrade Docker Container After Image Changed](/posts/upgrade-docker-container-image-changed) — update images
- [Introduction to Docker: Compose](/guides/introduction-to-docker) — Compose fundamentals
