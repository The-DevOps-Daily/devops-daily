---
title: 'In a Dockerfile, How to Update the PATH Environment Variable?'
excerpt: 'Learn how to modify the PATH environment variable in a Dockerfile to include custom directories for executables.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-10-05'
publishedAt: '2024-10-05T09:00:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Dockerfile
  - PATH
  - DevOps
---

## TLDR

To update the PATH environment variable in a Dockerfile, use the `ENV` instruction to append or prepend directories. This ensures your custom executables are accessible during container runtime.

---

The PATH environment variable determines where the shell looks for executables. Modifying it in a Dockerfile is useful when you install custom tools or scripts in non-standard locations.

### Why Update the PATH?

- **Custom Tools**: Add directories where your custom scripts or binaries are stored.
- **Non-Standard Installs**: Include directories not covered by default PATH values.
- **Simplify Commands**: Avoid specifying full paths for executables.

### Updating PATH in a Dockerfile

Use the `ENV` instruction to modify the PATH. For example, to add `/custom/bin`:

```Dockerfile
FROM ubuntu:latest

# Install custom tools
RUN mkdir -p /custom/bin && echo "echo Hello, World!" > /custom/bin/hello && chmod +x /custom/bin/hello

# Update PATH
ENV PATH="/custom/bin:$PATH"

# Default command
CMD ["hello"]
```

This Dockerfile does the following:

1. Creates a custom directory `/custom/bin`.
2. Adds a simple script `hello` that prints "Hello, World!".
3. Updates the PATH to include `/custom/bin` at the beginning.
4. Sets the default command to run the `hello` script.

### Explanation

1. **Create a Custom Directory**: The `RUN` instruction creates `/custom/bin` and adds a simple script.
2. **Modify PATH**: The `ENV` instruction prepends `/custom/bin` to the existing PATH.
3. **Test the PATH**: The `CMD` instruction runs the `hello` script without specifying its full path.

### Building and Running the Image

Build the Docker image:

```bash
docker build -t custom-path-example .
```

Run the container:

```bash
docker run --rm custom-path-example
```

You should see:

```
Hello, World!
```

The script executed successfully, demonstrating that the custom directory was added to the PATH.

### Best Practices

- Always append or prepend to the existing PATH to avoid overwriting default values.
- Use absolute paths for custom directories.
- Document PATH changes in your Dockerfile for clarity.

By updating the PATH in your Dockerfile, you can streamline container workflows and make custom tools easily accessible.

## Related Resources

- [Difference Between RUN and CMD](/posts/difference-run-cmd-dockerfile) — Dockerfile instruction fundamentals
- [Docker Compose Environment Variables](/posts/docker-compose-environment-variables) — environment config
- [Docker Alpine: How to Use Bash](/posts/docker-alpine-use-bash) — shell configuration in containers
- [Introduction to Docker: Building Custom Images](/guides/introduction-to-docker) — Dockerfile guide
