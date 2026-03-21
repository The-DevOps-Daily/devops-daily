---
title: 'Understanding the Difference Between CMD and ENTRYPOINT in Dockerfiles'
excerpt: 'Learn how CMD and ENTRYPOINT instructions work, how they interact with each other, and when to use each one for more flexible Docker containers.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-05-02'
publishedAt: '2025-05-02T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Dockerfile
  - Containers
  - Best Practices
---

Understanding the difference between `CMD` and `ENTRYPOINT` instructions in a Dockerfile is crucial for creating flexible, usable Docker images. These instructions determine what process runs inside your container and how users can interact with it. This guide explains their differences, how they work together, and when to use each one.

## Prerequisites

Before we begin, make sure you have:

- Docker installed on your system
- Basic familiarity with Dockerfile syntax
- Some experience running Docker containers

## Basic Definitions

First, let's clarify what each instruction does:

- **CMD**: Specifies the default command to run when starting a container
- **ENTRYPOINT**: Configures the container to run as an executable

While they might seem to serve similar purposes, they behave quite differently and are often used together.

## CMD: Providing Default Commands

The `CMD` instruction defines the default command and/or parameters that will be executed when the container runs without specifying a command.

### CMD Syntax

Docker supports three forms of CMD syntax:

```dockerfile
# Exec form (preferred)
CMD ["executable", "param1", "param2"]

# As default parameters to ENTRYPOINT
CMD ["param1", "param2"]

# Shell form
CMD command param1 param2
```

The exec form is preferred because it starts the specified command directly, not wrapped in a shell, which allows for proper signal handling and process ID tracking.

### Basic CMD Example

```dockerfile
FROM ubuntu:22.04

# Set a default command to run
CMD ["echo", "Hello from the container!"]
```

When you run this container without specifying a command, it will output "Hello from the container!":

```bash
docker run my-image
# Output: Hello from the container!
```

### Overriding CMD

The main characteristic of `CMD` is that it can be easily overridden. Any arguments you provide when running the container replace the `CMD` instruction entirely:

```bash
docker run my-image echo "Different message"
# Output: Different message
```

In this example, the original `CMD` is completely ignored and replaced with `echo "Different message"`.

## ENTRYPOINT: Making Containers Behave Like Executables

The `ENTRYPOINT` instruction configures a container to run as an executable. It's used when you want your container to behave like a command-line tool.

### ENTRYPOINT Syntax

Like `CMD`, ENTRYPOINT has two forms:

```dockerfile
# Exec form (preferred)
ENTRYPOINT ["executable", "param1", "param2"]

# Shell form
ENTRYPOINT command param1 param2
```

Again, the exec form is recommended for most use cases.

### Basic ENTRYPOINT Example

```dockerfile
FROM ubuntu:22.04

# Set the container's main executable
ENTRYPOINT ["echo", "Hello from"]
```

When you run this container, the `ENTRYPOINT` command runs:

```bash
docker run my-image
# Output: Hello from
```

### Appending Commands to ENTRYPOINT

Unlike `CMD`, arguments passed when running the container are appended to the `ENTRYPOINT` command:

```bash
docker run my-image Docker World
# Output: Hello from Docker World
```

The words "Docker World" are added as arguments to the `echo` command defined in the `ENTRYPOINT`.

### Overriding ENTRYPOINT

If you need to override the `ENTRYPOINT` defined in the Dockerfile, you can use the `--entrypoint` flag:

```bash
docker run --entrypoint ls my-image -la
# Output: (directory listing)
```

This completely replaces the `ENTRYPOINT` with the `ls` command and passes `-la` as its arguments.

## Combining CMD and ENTRYPOINT

The real power comes when you use `CMD` and `ENTRYPOINT` together. The general pattern is:

- `ENTRYPOINT`: defines the command that always runs
- `CMD`: provides default arguments that can be overridden

### How They Work Together

```dockerfile
FROM ubuntu:22.04

ENTRYPOINT ["echo", "Hello"]
CMD ["World"]
```

When you run this container:

```bash
docker run my-image
# Output: Hello World
```

If you provide command-line arguments, they replace only the `CMD` part:

```bash
docker run my-image Docker Universe
# Output: Hello Docker Universe
```

This makes your containers more flexible while maintaining their core behavior.

## Practical Use Cases

### Use Case 1: CLI Tools

If you're containerizing a command-line tool, use `ENTRYPOINT` to make the container behave like that tool:

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

ENTRYPOINT ["python", "my-cli-tool.py"]
CMD ["--help"]
```

Users can run this container as if it were the CLI tool itself:

```bash
docker run my-cli-tool --input file.txt --output results.txt
```

### Use Case 2: Configurable Services

When building service containers that need configuration options:

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

ENTRYPOINT ["node", "server.js"]
CMD ["--port", "8080"]
```

Users can run the service with default settings or override them:

```bash
# Run with default port
docker run my-service

# Run with custom port
docker run my-service --port 3000
```

### Use Case 3: Initialization Scripts

For containers that need initialization logic:

```dockerfile
FROM postgres:14

COPY ./init-db.sh /docker-entrypoint-initdb.d/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["postgres"]
```

The initialization script will always run because it's part of the image's entrypoint logic, but users can change how the database runs.

## Shell Form vs. Exec Form: Important Differences

When using the shell form (`CMD command param1 param2`), Docker wraps your command in `/bin/sh -c`, which has several implications:

1. **Process Handling**: Your application runs as a subprocess of `/bin/sh`, not as PID 1
2. **Signal Handling**: SIGTERM and other signals go to the shell, not your application
3. **Environment Variables**: Shell form allows for environment variable expansion

```dockerfile
# Shell form with variable expansion
CMD echo "Hello, $NAME"

# Exec form doesn't expand variables the same way
CMD ["echo", "Hello, $NAME"]  # $NAME will be treated literally
```

For proper signal handling and to avoid unnecessary processes, the exec form is generally recommended.

## Best Practices

### 1. Use ENTRYPOINT for the Main Command

```dockerfile
# Good: Fixed entrypoint with configurable parameters
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
```

### 2. Make Images Work Out of the Box

```dockerfile
# Default command makes container usable immediately
FROM python:3.11
COPY app.py /app/
WORKDIR /app
ENTRYPOINT ["python"]
CMD ["app.py"]
```

### 3. Prefer Exec Form Over Shell Form

```dockerfile
# Preferred: Exec form
ENTRYPOINT ["node", "server.js"]

# Avoid: Shell form
ENTRYPOINT node server.js
```

### 4. Include Health Checks for Services

```dockerfile
FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost/ || exit 1
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
```

## Troubleshooting Common Issues

### Problem: Container Exits Immediately

This often happens with the shell form of `ENTRYPOINT` or `CMD` when the specified command completes quickly:

```dockerfile
# This will exit immediately
CMD echo "Hello World"
```

**Solution**: For long-running services, ensure they stay in the foreground:

```dockerfile
# This will keep the container running
CMD ["nginx", "-g", "daemon off;"]
```

### Problem: Commands Not Found

```bash
docker run my-image
# /bin/sh: 1: my-command: not found
```

**Solution**: Check paths and ensure commands are available in the container:

```dockerfile
# Use absolute paths when necessary
ENTRYPOINT ["/usr/local/bin/my-command"]

# Or ensure your PATH is set properly
ENV PATH="/app/bin:${PATH}"
```

### Problem: Arguments Not Working as Expected

```bash
docker run my-image --config=/etc/myapp.conf
# Error: Unknown option: --config=/etc/myapp.conf
```

**Solution**: Ensure your `ENTRYPOINT` script properly handles arguments:

```dockerfile
ENTRYPOINT ["./entrypoint.sh"]
```

With `entrypoint.sh`:

```bash
#!/bin/bash
set -e

# Handle specific arguments or pass them through
exec myapp "$@"
```

## Next Steps

Now that you understand how `CMD` and `ENTRYPOINT` work, you might want to:

- Review your existing Dockerfiles to apply these best practices
- Create more user-friendly container interfaces
- Explore Docker's init systems for better process management
- Learn about multi-stage builds to optimize your Docker images

Happy containerizing!
