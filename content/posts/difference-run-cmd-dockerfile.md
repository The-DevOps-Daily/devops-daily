---
title: 'Difference Between RUN and CMD in a Dockerfile'
excerpt: 'Understand the key differences between RUN and CMD in a Dockerfile, and learn when to use each for building and running Docker containers.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-11-25'
publishedAt: '2024-11-25T09:00:00Z'
updatedAt: '2024-11-25T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Dockerfile
  - Containers
  - DevOps
  - Tutorials
---

## TLDR

In a Dockerfile, `RUN` is used to execute commands during the image build process, creating layers in the final image. `CMD` specifies the default command to run when a container starts. Use `RUN` for building the image and `CMD` for defining the container's runtime behavior.

---

When writing a Dockerfile, understanding the difference between `RUN` and `CMD` is crucial for building efficient and functional Docker images. While both are used to execute commands, they serve different purposes. This guide will explain the differences and provide examples to help you use them effectively.

## What is `RUN`?

The `RUN` instruction is used to execute commands during the image build process. Each `RUN` command creates a new layer in the Docker image. It is typically used for installing software, setting up the environment, or performing other tasks required to build the image.

### Example

Here is an example of using `RUN` in a Dockerfile:

```dockerfile
# Dockerfile
FROM ubuntu:20.04

# Install curl
RUN apt-get update && apt-get install -y curl
```

In this example:

- The `RUN` instruction updates the package list and installs `curl`.
- The resulting image includes `curl` as part of its filesystem.

### Why It Matters

- **Build-Time Execution**: Commands in `RUN` are executed during the build process, not when the container starts.
- **Layer Creation**: Each `RUN` instruction creates a new layer, which can be cached to speed up subsequent builds.

## What is `CMD`?

The `CMD` instruction specifies the default command to run when a container starts. Unlike `RUN`, it does not execute during the build process. Instead, it defines the container's runtime behavior.

### Example

Here is an example of using `CMD` in a Dockerfile:

```dockerfile
# Dockerfile
FROM node:16

# Set the default command to run the application
CMD ["node", "app.js"]
```

In this example:

- The `CMD` instruction specifies that the container should run `node app.js` when it starts.
- If a different command is provided at runtime, it will override the `CMD` instruction.

### Why It Matters

- **Runtime Execution**: `CMD` defines what the container does when it starts.
- **Overridable**: The `CMD` instruction can be overridden by specifying a command when running the container.

## Key Differences Between `RUN` and `CMD`

| Feature        | `RUN`                          | `CMD`                             |
| -------------- | ------------------------------ | --------------------------------- |
| Purpose        | Executes commands during build | Specifies default runtime command |
| Execution Time | Build time                     | Runtime                           |
| Layer Creation | Creates a new image layer      | Does not create a new layer       |
| Overridable    | No                             | Yes                               |

## Combining `RUN` and `CMD`

You can use both `RUN` and `CMD` in the same Dockerfile to build the image and define its runtime behavior.

### Example

```dockerfile
# Dockerfile
FROM python:3.9

# Install dependencies
RUN pip install flask

# Set the default command
CMD ["python", "app.py"]
```

In this example:

- The `RUN` instruction installs Flask during the build process.
- The `CMD` instruction specifies that the container should run `python app.py` when it starts.

## Best Practices

- **Minimize Layers**: Combine multiple commands in a single `RUN` instruction to reduce the number of layers.
- **Use CMD for Defaults**: Use `CMD` to define the default behavior of the container, but allow it to be overridden if needed.
- **Avoid Hardcoding**: Avoid hardcoding sensitive information like credentials in `RUN` or `CMD` instructions.

By understanding the differences between `RUN` and `CMD`, you can write more efficient and functional Dockerfiles, ensuring your containers behave as expected.

## Related Resources

- [How Do I Make a Comment in a Dockerfile?](/posts/comment-in-dockerfile) — write clearer Dockerfiles
- [Advanced Docker Features](/posts/advanced-docker-features) — multi-stage builds, BuildKit, and more
- [Docker Security Best Practices](/posts/docker-security-best-practices) — harden your containers
- [Docker Image Optimization](/posts/docker-image-optimization-best-practices) — build smaller, faster images
- [Introduction to Docker: Building Custom Images](/guides/introduction-to-docker) — full guide to Dockerfiles
- [Docker Flashcards](/flashcards/docker-essentials) — review Docker concepts
