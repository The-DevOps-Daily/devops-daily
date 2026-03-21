---
title: "How to Include Files Outside of Docker's Build Context"
excerpt: 'Learn why Docker restricts file access during builds, and how to work around this limitation to include files outside the build context.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-02-14'
publishedAt: '2024-02-14T09:00:00Z'
updatedAt: '2024-02-14T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Build
  - Context
  - DevOps
---

## TLDR

Docker only allows files inside the build context (the directory you specify with `docker build`) to be included in the image. To include files outside, copy or symlink them into the build context before building, or use multi-stage builds and bind mounts for advanced workflows.

---

When building Docker images, you might run into a common frustration: Docker cannot access files outside the build context. This is by design, for security and reproducibility. The build context is the directory you specify when running `docker build`, and Docker will only send files from this directory (and its subdirectories) to the Docker daemon.

### Why Does Docker Restrict the Build Context?

- **Security**: Prevents accidental inclusion of sensitive files.
- **Performance**: Limits the amount of data sent to the Docker daemon.
- **Reproducibility**: Keeps builds consistent across environments.

### Example: The Problem

Suppose you have this structure:

```
project-root/
  Dockerfile
  app/
  config/
other-stuff/
  secrets.env
```

If you try to add `../other-stuff/secrets.env` in your Dockerfile, you'll get an error:

```Dockerfile
ADD ../other-stuff/secrets.env /app/
```

This fails because `../other-stuff/secrets.env` is outside the build context.

### Solution 1: Copy Files Into the Build Context

Before building, copy the needed file into your build context. For example:

```bash
cp ../other-stuff/secrets.env ./config/
docker build -t my-app .
```

Then in your Dockerfile:

```Dockerfile
COPY config/secrets.env /app/
```

This approach is simple and works well for CI/CD pipelines.

### Solution 2: Use Symlinks (With Caution)

You can create a symlink inside your build context pointing to the file outside. However, Docker will only include the file if it is within the build context at build time. If the symlink points outside, Docker will ignore it.

```bash
ln -s ../../other-stuff/secrets.env ./config/secrets.env
```

But when you run `docker build`, Docker will not follow symlinks outside the context. So this is not a reliable workaround.

### Solution 3: Use Multi-Stage Builds and Bind Mounts

For advanced workflows, you can use multi-stage builds or bind mounts at runtime. For example, you can mount a file at runtime instead of baking it into the image:

```bash
docker run -v /absolute/path/to/secrets.env:/app/secrets.env my-app
```

This keeps sensitive files out of your image and source control.

### Best Practices

- Keep your build context as small as possible.
- Never try to include sensitive files in your image unless absolutely necessary.
- Use environment variables or runtime mounts for secrets.

By understanding Docker's build context, you can design more secure and maintainable images.

Good luck with your project!

## Related Resources

- [COPY with Docker Exclusion](/posts/copy-with-docker-exclusion) — .dockerignore patterns
- [COPY vs ADD in Dockerfiles](/posts/dockerfile-copy-vs-add-commands) — choose the right instruction
- [Advanced Docker Features](/posts/advanced-docker-features) — BuildKit and multi-stage builds
- [Introduction to Docker: Building Custom Images](/guides/introduction-to-docker) — Dockerfile guide
