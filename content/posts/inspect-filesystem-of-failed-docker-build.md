---
title: 'How Can I Inspect the File System of a Failed Docker Build?'
excerpt: "Want to debug a failed Docker build? Learn practical ways to inspect the build's file system, including interactive debugging with buildkit, temporary containers, and troubleshooting tips."
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-04-29'
publishedAt: '2025-04-29T09:00:00Z'
updatedAt: '2025-04-29T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Troubleshooting
  - Containers
  - DevOps
---

## TLDR

To inspect the file system of a failed Docker build, use multi-stage builds to save intermediate images, add debug steps (like `sleep` or `tail`), or leverage BuildKit's `--target` and `--output` features. This lets you start a shell in the failed state and debug interactively.

## Why Is This Useful?

When a Docker build fails, you often want to see what files, environment variables, or installed packages are present at the failure point. This helps you debug missing files, permissions, or unexpected build behavior.

## Method 1: Add a Debug Step (sleep or tail)

Temporarily add a line to your Dockerfile before the failing step:

```dockerfile
RUN sleep infinity
```

or

```dockerfile
RUN tail -f /dev/null
```

Build the image:

```bash
docker build -t debug-image .
```

In another terminal, find the running container:

```bash
docker ps
```

Start a shell in the container:

```bash
docker exec -it <container_id> /bin/bash
```

Now you can inspect the file system, check logs, and debug interactively. When done, remove the debug line from your Dockerfile.

## Method 2: Use Multi-Stage Builds to Save Intermediate State

If your build uses multi-stage builds, you can tag an intermediate stage and run a container from it:

```dockerfile
FROM ubuntu:22.04 as builder
# ... build steps ...

FROM builder as debug-stage
# Add a debug step if needed
```

Build up to the debug stage:

```bash
docker build --target debug-stage -t debug-image .
docker run -it debug-image /bin/bash
```

## Method 3: Use BuildKit's --output=type=local

With BuildKit enabled, you can export the build's file system to a local directory:

```bash
docker build --output type=local,dest=./output .
```

This writes the final build context to `./output`, so you can inspect files directly on your host.

## Method 4: Commit a Stopped Container (if build got far enough)

If your build ran a container that exited, you can commit it to an image:

```bash
docker ps -a  # Find the exited container
# Then:
docker commit <container_id> debug-image
docker run -it debug-image /bin/bash
```

## Best Practices

- Remove debug steps after you're done to keep images clean.
- Use multi-stage builds to avoid leaking secrets or build tools into final images.
- For complex builds, consider using BuildKit for advanced debugging features.

## Conclusion

Inspecting the file system of a failed Docker build is easy with debug steps, multi-stage builds, or BuildKit's output features. Use these techniques to troubleshoot and fix build issues faster.


## Related Resources

- [Exploring Docker Container File System](/posts/exploring-docker-container-file-system) — browse container files
- [Advanced Docker Features](/posts/advanced-docker-features) — BuildKit debugging
- [Force Docker Clean Build](/posts/force-docker-clean-build) — rebuild from scratch
- [Introduction to Docker: Building Images](/guides/introduction-to-docker) — Dockerfile guide
