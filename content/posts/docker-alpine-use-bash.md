---
title: 'Docker: How to Use Bash with an Alpine Based Docker Image'
excerpt: 'Want to use bash in your Alpine-based Docker container? Learn why Alpine uses sh by default, how to install bash, and best practices for interactive shells and scripts.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-05-03'
publishedAt: '2025-05-03T09:00:00Z'
updatedAt: '2025-05-03T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Alpine
  - Bash
  - Containers
---

## TLDR

Alpine Linux images use `sh` (BusyBox shell) by default, not bash. To use bash, install it with `apk add --no-cache bash` in your Dockerfile or at runtime. Then you can run scripts or open an interactive bash shell as needed.

## Why Alpine Uses sh Instead of bash

Alpine is designed to be lightweight and secure, so it ships with BusyBox's `sh` shell by default. This keeps images small, but means bash isn't available unless you add it yourself.

## How to Install bash in an Alpine Container

Add this line to your Dockerfile:

```dockerfile
RUN apk add --no-cache bash
```

**Example Dockerfile:**

```dockerfile
FROM alpine:3.20
RUN apk add --no-cache bash
CMD ["bash"]
```

Or, for a one-off interactive session:

```zsh
docker run -it alpine:3.20 sh
# Inside the container:
apk add --no-cache bash
bash
```

## Running Scripts with bash

If your script uses bash features (like arrays or advanced syntax), make sure to:

- Install bash as above
- Use `#!/bin/bash` as the shebang in your script
- Run the script with `bash script.sh` or make it executable

## Best Practices

- Only install bash if you need it—stick with sh for simple scripts to keep images small
- For multi-stage builds, install bash only in build stages if possible
- Document the shell requirements for your scripts

## Troubleshooting

- If you see `bash: not found`, install it with `apk add --no-cache bash`
- If your script fails with syntax errors, check the shebang and shell compatibility

## Conclusion

To use bash in Alpine-based Docker images, just install it with apk and use it as needed. This gives you access to familiar bash features while keeping your images lean and efficient.

## Related Resources

- [Docker Image Optimization](/posts/docker-image-optimization-best-practices) — keep Alpine images small
- [Docker Security Best Practices](/posts/docker-security-best-practices) — minimal base images for security
- [Difference Between RUN and CMD in a Dockerfile](/posts/difference-run-cmd-dockerfile) — Dockerfile instructions
- [Introduction to Docker Guide](/guides/introduction-to-docker) — learn Docker from scratch
- [Docker Flashcards](/flashcards/docker-essentials) — review core Docker concepts
