---
title: 'How Can I Use Environment Variables in docker-compose?'
excerpt: 'Learn the best ways to manage and use environment variables in docker-compose files, including .env files, variable substitution, and secure practices for real-world projects.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-04-23'
publishedAt: '2025-04-23T09:00:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - docker-compose
  - Environment Variables
  - DevOps
---

## TLDR

You can use environment variables in docker-compose to configure your containers, pass secrets, and customize builds. Use the `environment` key, `.env` files, and variable substitution to keep your configs clean and flexible. This guide shows practical examples and best practices.

## Why Use Environment Variables in docker-compose?

Environment variables let you:

- Avoid hardcoding secrets or config values
- Reuse the same compose file for different environments (dev, staging, prod)
- Pass settings to containers at runtime
- Keep sensitive data out of version control

## Setting Environment Variables in docker-compose.yml

You can define environment variables directly in your compose file:

```yaml
services:
  web:
    image: nginx
    environment:
      - NGINX_PORT=8080
      - APP_ENV=production
```

Or use a mapping for more control:

```yaml
services:
  app:
    image: node:20
    environment:
      NODE_ENV: development
      API_URL: http://api:3000
```

## Using a .env File

By default, docker-compose loads variables from a file named `.env` in the same directory as your compose file. This is great for secrets and environment-specific values.

Example `.env` file:

```
POSTGRES_USER=devuser
POSTGRES_PASSWORD=supersecret
```

Reference these in your compose file:

```yaml
services:
  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
```

## Variable Substitution in Compose Files

You can use `${VAR_NAME}` anywhere in your compose file (not just in `environment`). For example:

```yaml
services:
  web:
    image: myapp:${TAG}
```

If `TAG` is set in your `.env` file or your shell, it will be substituted at runtime.

## Passing Environment Variables from the Shell

You can override variables by setting them in your shell before running docker-compose:

```bash
export API_URL=https://api.example.com
docker-compose up
```

Shell variables take precedence over `.env` file values.

## Using env_file for Large Sets of Variables

If you have many variables, you can use the `env_file` key to load them from a file:

```yaml
services:
  app:
    image: myapp
    env_file:
      - ./app.env
```

The `app.env` file should use `KEY=VALUE` format, one per line.

## Best Practices

- Never commit secrets or sensitive `.env` files to version control.
- Use different `.env` files for each environment (e.g., `.env.dev`, `.env.prod`).
- Document required variables in a sample file like `.env.example`.
- For production, consider using Docker secrets or an external secrets manager for sensitive data.
- Use variable substitution to keep your compose files DRY and flexible.

## Conclusion

Environment variables in docker-compose make your setups more secure, portable, and maintainable. Use `.env` files, variable substitution, and the `environment` key to manage configs cleanly. Always keep secrets safe and document your variables for your team.

## Related Resources

- [Docker Compose: Ports vs Expose](/posts/docker-compose-ports-vs-expose) — understand container networking and port publishing
- [Docker Security Best Practices](/posts/docker-security-best-practices) — keep secrets out of images and more
- [Docker Compose: Running Multiple Commands](/posts/docker-compose-multiple-commands) — chain commands in Compose services
- [Introduction to Docker Guide](/guides/introduction-to-docker) — learn Docker from the ground up
- [Docker Quiz](/quizzes/docker-quiz) — test your Docker knowledge
- [DevOps Roadmap](/roadmap) — see where Docker fits in the bigger picture
