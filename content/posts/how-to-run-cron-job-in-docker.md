---
title: 'How to Run a Cron Job Inside a Docker Container'
excerpt: 'Learn how to schedule and run cron jobs inside Docker containers, with practical Dockerfile examples, troubleshooting tips, and best practices for reliable automation.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-04-21'
publishedAt: '2025-04-21T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Cron
  - Automation
  - DevOps
---

## TLDR

To run a cron job inside a Docker container, install cron, add your job to the crontab, and make sure the container's main process starts the cron daemon. Use a proper Dockerfile and entrypoint to keep cron running in the foreground. This guide shows you how, with working examples and troubleshooting tips.

## Why Run Cron in a Container?

Running cron jobs in containers is handy for scheduled tasks like backups, data syncs, or periodic scripts—especially when you want to package everything as a single deployable unit. But containers don't run background daemons by default, so you need to set things up carefully.

## Basic Example: Cron in a Dockerfile

Here's a simple way to run a cron job in a container based on Debian or Ubuntu:

```dockerfile
FROM ubuntu:22.04

# Install cron and any dependencies
RUN apt-get update && apt-get install -y cron curl

# Add your cron job (runs every minute as an example)
RUN echo "* * * * * root curl -fsS http://example.com/healthcheck >> /var/log/cron.log 2>&1" > /etc/cron.d/my-cron

# Give execution rights on the cron job
RUN chmod 0644 /etc/cron.d/my-cron

# Apply cron job and start cron in the foreground
CMD ["cron", "-f"]
```

**How it works:**

- Installs cron and your dependencies
- Adds a cron job to `/etc/cron.d/`
- Starts cron in the foreground (`-f`), so the container keeps running

## Building and Running the Container

Build your image:

```bash
docker build -t cron-demo .
```

Run the container:

```bash
docker run --name cron-demo cron-demo
```

Check the logs:

```bash
docker exec cron-demo tail -f /var/log/cron.log
```

## Custom Scripts as Cron Jobs

If you want to run your own script, copy it into the image and reference it in the cron job:

```dockerfile
COPY myscript.sh /usr/local/bin/myscript.sh
RUN chmod +x /usr/local/bin/myscript.sh
RUN echo "0 * * * * root /usr/local/bin/myscript.sh >> /var/log/cron.log 2>&1" > /etc/cron.d/my-cron
```

Make sure your script has a shebang (e.g., `#!/bin/bash`) at the top.

## Common Pitfalls and Troubleshooting

- **Container exits immediately:** Cron must run in the foreground (`cron -f` or `crond -f`). If you use `service cron start` or `systemctl`, the container will exit.
- **Cron job doesn't run:**
  - Check permissions on the cron file (should be 0644).
  - Make sure the cron file ends with a newline.
  - Check the cron log for errors.
- **Environment variables:** Cron jobs run with a minimal environment. Set variables explicitly in your script or in the cron file.
- **Timezone:** Set the timezone in the Dockerfile if needed (e.g., `ENV TZ=UTC`).

## Best Practices

- Use one process per container when possible. For complex setups, consider a process supervisor (like `supervisord`) to run multiple daemons.
- Log output to a file or stdout so you can inspect it with `docker logs` or `docker exec`.
- For production, consider using Kubernetes CronJobs or external schedulers for better reliability and observability.

## Conclusion

Running cron jobs in Docker is straightforward with the right setup. Keep cron in the foreground, check your logs, and use scripts with proper permissions. For more advanced scheduling, look into orchestrators like Kubernetes CronJobs or external tools.


## Related Resources

- [Docker Compose: Running Multiple Commands](/posts/docker-compose-multiple-commands) — multi-command patterns
- [How to Clear Docker Container Logs](/posts/how-to-clear-docker-container-logs-properly) — log management
- [Docker Security Best Practices](/posts/docker-security-best-practices) — secure containers
- [Introduction to Docker Guide](/guides/introduction-to-docker) — Docker fundamentals
