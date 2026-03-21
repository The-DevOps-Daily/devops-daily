---
title: 'Connecting to PostgreSQL in a Docker Container from Outside'
excerpt: 'Expose PostgreSQL safely and connect from your host or another machine using Docker and Docker Compose. Covers port publishing, listen addresses, pg_hba.conf basics, and common troubleshooting.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-04-25'
publishedAt: '2025-04-25T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - PostgreSQL
  - Networking
  - Docker Compose
  - Security
---

You have PostgreSQL running in a container and you want to connect from outside the container - from your laptop, a CI job, or another machine. This guide shows practical ways to expose the database for local development while keeping security in mind.

## TLDR

- Publish the container port to your host with `-p 5432:5432`, then connect to `localhost:5432`.
- In Docker Compose, set `ports: ["5432:5432"]` on the `db` service.
- For remote machines, bind to all addresses and open the host firewall carefully. Limit access with `pg_hba.conf` CIDR rules.
- If connection fails, check container logs, port conflicts, `listen_addresses`, and `pg_hba.conf`.

Quick mental model:

```
Client        Host               Docker NAT           Container
------        ----               ----------           ---------
psql -> 127.0.0.1:5432  ->  host:5432  ->  container:5432 (PostgreSQL)
```

## Prerequisites

- Docker Desktop 4.x or Docker Engine 24.x+
- psql 14+ (install with your package manager if you do not have it)

## Option 1: Docker CLI - publish port 5432 and connect from host

Start PostgreSQL with a password and publish the port. Then connect using `psql` from your machine.

```bash
# Start a local Postgres with a persistent volume and a strong password
docker run --name pg-local --rm \
  -e POSTGRES_PASSWORD='P@ssw0rd-Dev' \
  -e POSTGRES_DB='appdb' \
  -p 5432:5432 \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16
```

Connect from your host:

```bash
psql "postgresql://postgres:P@ssw0rd-Dev@localhost:5432/appdb"
```

Why this works:

- `-p 5432:5432` publishes the container's 5432 on your host. On macOS and Windows, Docker Desktop publishes to `localhost`. On Linux, it binds to the host interface.
- PostgreSQL listens on the container's 0.0.0.0 by default in this image, and with a password set you can authenticate.

If you cannot connect:

- Check the container logs for startup errors:

```bash
docker logs pg-local | tail -n 50
```

- Check that 5432 is actually published and free on the host:

```bash
docker ps | grep pg-local
lsof -i :5432 | cat
```

## Option 2: Docker Compose - declarative setup with `ports`

Compose makes the setup repeatable for your team.

```yaml
version: '3.9'
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: P@ssw0rd-Dev
      POSTGRES_DB: appdb
    ports:
      - '5432:5432' # host:container
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 3s
      retries: 5
volumes:
  pgdata:
```

Connect from your host the same way:

```bash
psql "postgresql://postgres:P@ssw0rd-Dev@localhost:5432/appdb"
```

### Binding to all interfaces for remote clients

If another machine on your network needs access, publish the port and make sure the Postgres server is reachable through the host's IP address.

```yaml
services:
  db:
    image: postgres:16
    command: ['postgres', '-c', 'listen_addresses=*']
    environment:
      POSTGRES_PASSWORD: P@ssw0rd-Dev
      POSTGRES_DB: appdb
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
```

Then:

1. Make sure your host firewall allows TCP 5432 from the specific source network.

2. Limit which clients can authenticate by adjusting `pg_hba.conf` entries. You can inject a minimal file with a bind mount for local dev:

```bash
cat > /tmp/pg_hba.conf <<'HBA'
# TYPE  DATABASE  USER      ADDRESS        METHOD
host    all       all       192.168.1.0/24 scram-sha-256
HBA

docker run --name pg-remote --rm \
  -e POSTGRES_PASSWORD='P@ssw0rd-Dev' \
  -p 5432:5432 \
  -v /tmp/pg_hba.conf:/var/lib/postgresql/data/pg_hba.conf \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16 -c listen_addresses='*'
```

Note: on first initialization, the database populates default config files under `/var/lib/postgresql/data`. Mounting `pg_hba.conf` like this will override it for development. In production, use baked images or config management instead of ad-hoc binds.

## Verifying from the container side

Run a quick query to confirm the server is listening and accepting connections.

```bash
docker exec -it pg-local psql -U postgres -d appdb -c "show listen_addresses;"
docker exec -it pg-local psql -U postgres -d appdb -c "select 1;"
```

You can also inspect the active `pg_hba.conf` location and reload configuration:

```bash
docker exec -it pg-local psql -U postgres -d appdb -c "show hba_file;"
docker exec -it pg-local psql -U postgres -d appdb -c "select pg_reload_conf();"
```

## Connecting from another container

If your app runs in another container, connect over a user-defined network rather than publishing 5432.

```bash
docker network create devnet || true
docker run -d --name db --network devnet \
  -e POSTGRES_PASSWORD='P@ssw0rd-Dev' -e POSTGRES_DB='appdb' \
  postgres:16

# Use the service name as the host inside the same network
docker run --rm --network devnet \
  --entrypoint psql \
  postgres:16 \
  "postgresql://postgres:P@ssw0rd-Dev@db:5432/appdb" -c 'select 1;'
```

This keeps the database private to the network while still reachable by your application container.

## Common pitfalls and fixes

- Port already in use: pick another host port with `-p 15432:5432` and connect to `localhost:15432`.
- Wrong hostname: use `localhost` from your machine, or the host IP for remote clients. Do not use `0.0.0.0` as a client target.
- Firewalls: on Linux servers, open 5432 with ufw or iptables only for the subnets you trust.
- Password errors: confirm the username, database name, and password. The default admin user is `postgres`.
- Config not reloading: use `select pg_reload_conf();` or restart the container after changing config files.

### Quick connectivity checklist

```bash
# 1) Is the container healthy and listening?
docker ps | grep postgres
docker logs pg-local | tail -n 50

# 2) Is the host port published and free?
docker port pg-local 5432 | cat
lsof -i :5432 | cat

# 3) Can psql connect locally?
psql "postgresql://postgres:P@ssw0rd-Dev@localhost:5432/appdb" -c 'select version();'
```

With these patterns you can safely expose Postgres for local development, connect from your host, and optionally allow remote clients when needed. Prefer private Docker networks for app-to-DB traffic, and only publish 5432 when you must, with limited CIDRs and a firewall in front.

## Related Resources

- [Docker Compose: Ports vs Expose](/posts/docker-compose-ports-vs-expose) — when to publish ports vs keep them internal
- [Docker Security Best Practices](/posts/docker-security-best-practices) — secure your containers
- [Docker Compose Environment Variables](/posts/docker-compose-environment-variables) — manage database credentials safely
- [Introduction to Docker: Volumes](/guides/introduction-to-docker) — persist database data
- [DevOps Survival Guide](/books/devops-survival-guide) — broader DevOps learning
