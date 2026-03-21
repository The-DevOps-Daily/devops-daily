---
title: 'How to Edit a File After You Shell to a Docker Container'
excerpt: 'Learn how to edit files inside a running Docker container using shell access, text editors, and best practices for persistent changes.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-04-18'
publishedAt: '2024-04-18T09:00:00Z'
updatedAt: '2024-04-18T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Containers
  - Editing
  - DevOps
---

## TLDR

To edit a file inside a running Docker container, shell in with `docker exec -it <container> sh` or `bash`, then use a text editor like `vi` or `nano`. For persistent changes, update your Docker image or use volumes.

---

Sometimes you need to make a quick change inside a running Docker container - maybe to debug, patch a config, or test a fix. Docker makes it easy to get a shell inside your container, but there are a few things to keep in mind.

### Getting a Shell Inside the Container

First, find your container's name or ID:

```bash
docker ps
```

Then shell in:

```bash
# Use sh (for Alpine or minimal images)
docker exec -it <container_name_or_id> sh

# Or bash (for Ubuntu/Debian-based images)
docker exec -it <container_name_or_id> bash
```

Now you're inside the container and can navigate the filesystem.

### Editing Files with Built-in Editors

Most containers include `vi` or `vim`. Some minimal images (like Alpine) may only have `vi` or no editor at all. Try:

```bash
vi /path/to/file
```

If you prefer `nano` and it's not installed, you can add it (if the container has a package manager):

```bash
# For Alpine
apk add nano

# For Debian/Ubuntu
apt-get update && apt-get install nano
```

Then edit your file:

```bash
nano /path/to/file
```

### Making Changes Persistent

Edits made inside a running container are lost if the container is deleted. For changes you want to keep:

- Update your Dockerfile and rebuild the image.
- Use Docker volumes to mount files from your host.
- Commit changes to a new image (not recommended for production):

```bash
docker commit <container_name_or_id> my-edited-image:latest
```

This creates a new image with your changes, but it's better to update the Dockerfile for reproducibility.

### Best Practices

- Use shell edits for debugging, not for production changes.
- Always document any manual changes.
- Prefer updating your Dockerfile for reproducibility.

With these steps, you can quickly edit files inside containers and understand how to make those changes stick.

## Related Resources

- [How to Access Docker Container Shell](/posts/how-to-access-docker-container-shell) — shell access methods
- [Copy Files from Docker Container to Host](/posts/copy-files-from-docker-container-to-host) — extract files
- [Exploring Docker Container File System](/posts/exploring-docker-container-file-system) — navigate containers
- [Introduction to Docker Guide](/guides/introduction-to-docker) — Docker fundamentals
- [Docker Flashcards](/flashcards/docker-essentials) — review Docker concepts
