---
title: 'Interactive Shell Using Docker Compose'
excerpt: 'Learn how to start an interactive shell in a Docker Compose service for debugging and development.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-06-02'
publishedAt: '2024-06-02T09:00:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Docker Compose
  - Interactive Shell
  - Tutorials
---

## TLDR

To start an interactive shell in a Docker Compose service, use the `docker-compose exec` command. This allows you to debug and interact with running containers.

---

Docker Compose simplifies the management of multi-container applications. Sometimes, you need to access a running container to debug or interact with it. This guide explains how to start an interactive shell in a Docker Compose service.

## Step 1: Define Your Services

Ensure your `docker-compose.yml` file defines the services you want to run.

### Example `docker-compose.yml`

```yaml
version: '3.8'
services:
  app:
    image: node:18
    working_dir: /app
    volumes:
      - .:/app
    command: npm start
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
```

### Explanation

- `app`: Defines a Node.js application service.
- `db`: Defines a PostgreSQL database service.
- `volumes`: Mounts the current directory into the container.
- `environment`: Sets environment variables for the database.

## Step 2: Start the Services

Start the services using the `docker-compose up` command.

### Command

```bash
docker-compose up -d
```

### Explanation

- `-d`: Runs the services in detached mode.

## Step 3: Access an Interactive Shell

Use the `docker-compose exec` command to start an interactive shell in a running service.

### Command

```bash
docker-compose exec app sh
```

### Explanation

- `exec`: Executes a command in a running container.
- `app`: Specifies the service name.
- `sh`: Starts a shell session.

## Step 4: Debug and Interact

Once inside the container, you can run commands, inspect files, and debug your application.

### Example

```bash
ls
cat app.js
npm install
```

### Explanation

- `ls`: Lists files in the current directory.
- `cat app.js`: Displays the contents of `app.js`.
- `npm install`: Installs dependencies.

## Best Practices

- **Use Descriptive Service Names**: Make it easy to identify services.
- **Limit Access**: Avoid running commands in production containers unless necessary.
- **Automate Debugging**: Use scripts to automate common debugging tasks.

By following these steps, you can effectively use Docker Compose to start an interactive shell, making debugging and development more efficient.


## Related Resources

- [How to Access Docker Container Shell](/posts/how-to-access-docker-container-shell) — more shell methods
- [Docker Compose: Running Multiple Commands](/posts/docker-compose-multiple-commands) — Compose commands
- [Enter Docker Container with New TTY](/posts/enter-docker-container-new-tty) — TTY sessions
- [Introduction to Docker: Compose](/guides/introduction-to-docker) — Compose guide
