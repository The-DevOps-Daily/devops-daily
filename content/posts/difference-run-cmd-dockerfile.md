---
title: 'Difference Between RUN and CMD in a Dockerfile'
excerpt: 'Understand the key differences between RUN and CMD in a Dockerfile, and learn when to use each for building and running Docker containers.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-11-25'
publishedAt: '2024-11-25T09:00:00Z'
updatedAt: '2026-11-05T09:00:00Z'
readingTime: '8 min read'
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

When writing a Dockerfile, understanding the difference between `RUN` and `CMD` matters for building efficient and functional Docker images. While both are used to execute commands, they serve different purposes. This guide will explain the differences and provide examples to help you use them effectively.

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

## How Do You Run More Than One Command When a Container Starts?

`CMD` starts one process. To run a setup step first, wrap the commands in a shell, and start the long-running process with `exec`:

```dockerfile
FROM nginx:1.30
# exec replaces the shell, so nginx becomes PID 1 and gets the stop signal
CMD ["sh", "-c", "echo setup done && exec nginx -g 'daemon off;'"]
```

Without `exec`, the shell stays PID 1 and nginx runs as its child. `docker stop` sends SIGTERM to PID 1, the shell does not pass it on, and after 10 seconds Docker kills everything with SIGKILL. We built the image twice, as `sh-exec` with `exec` and `sh-plain` without it, and looked at PID 1 in each container:

```terminal
{
  "title": "the same CMD, with and without exec",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker exec sh-plain cat /proc/1/cmdline | tr '\\0' ' '",
      "output": "sh -c echo setup done && nginx -g 'daemon off;'"
    },
    {
      "cmd": "docker exec sh-exec cat /proc/1/cmdline | tr '\\0' ' '",
      "output": "nginx: master process nginx -g daemon off;"
    }
  ]
}
```

Then we timed `docker stop` on each one. `sh-plain` took 10 seconds and exited with code 137, which means it was killed and nginx never shut down cleanly. `sh-exec` stopped at once with exit code 0. In Compose, `command:` replaces the image's `CMD` and follows the same rule: `command: sh -c "echo warming cache && exec python -m http.server 8000"`.

Two cases need more than a shell line:

- **One-off steps, such as database migrations.** Put them in a separate service that runs and exits, and make the app wait for it with `depends_on: { migrate: { condition: service_completed_successfully } }`. The app then starts only if the migration exited with code 0. [Dockerfile vs Compose file](/posts/docker-image-vs-container#h2-dockerfile-vs-compose-file-which-does-what) shows the full file.
- **Two long-running processes**, such as a web server and a queue worker. Run them as two containers from the same image with different commands. A process manager such as supervisord inside one container works, but then Docker sees one process and cannot restart or scale the two parts on their own.

For longer setup logic, copy a script into the image and use it as the `ENTRYPOINT`, ending with `exec "$@"` so the `CMD` still runs as PID 1. [CMD and ENTRYPOINT](/posts/difference-between-cmd-and-entrypoint-in-dockerfiles) explains how the two instructions combine.

## Best Practices

- **Minimize Layers**: Combine multiple commands in a single `RUN` instruction to reduce the number of layers.
- **Use CMD for Defaults**: Use `CMD` to define the default behavior of the container, but allow it to be overridden if needed.
- **Avoid Hardcoding**: Avoid hardcoding sensitive information like credentials in `RUN` or `CMD` instructions.

By understanding the differences between `RUN` and `CMD`, you can write more efficient and functional Dockerfiles, ensuring your containers behave as expected.

## Related Resources

- [How Do I Make a Comment in a Dockerfile?](/posts/comment-in-dockerfile): write clearer Dockerfiles
- [Advanced Docker Features](/posts/advanced-docker-features): multi-stage builds, BuildKit, and more
- [Docker Security Best Practices](/posts/docker-security-best-practices): harden your containers
- [Docker Image Optimization](/posts/docker-image-optimization-best-practices): build smaller, faster images
- [Introduction to Docker: Building Custom Images](/guides/introduction-to-docker): full guide to Dockerfiles
- [Docker Flashcards](/flashcards/docker-essentials): review Docker concepts
