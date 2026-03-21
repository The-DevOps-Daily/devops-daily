---
title: 'Docker Push Error: denied: requested access to the resource is denied'
excerpt: 'Troubleshoot and resolve the common Docker push error about denied access to a resource. Learn about authentication, repository naming, and permissions.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-05-01'
publishedAt: '2024-05-01T09:00:00Z'
updatedAt: '2024-05-01T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Push
  - Registry
  - DevOps
---

## TLDR

If you see `denied: requested access to the resource is denied` when pushing a Docker image, check your authentication, repository name, and permissions. Log in with `docker login` and make sure your image is tagged for the correct registry.

---

Pushing Docker images to a registry is a key part of most CI/CD workflows. Sometimes, you hit a frustrating error: `denied: requested access to the resource is denied`. This usually means there's a problem with authentication, repository naming, or permissions.

### Why Does This Error Happen?

- **Not Logged In**: You haven't authenticated with the registry.
- **Wrong Repository Name**: The image isn't tagged for the right registry or namespace.
- **Insufficient Permissions**: Your user doesn't have push access.

### Step 1: Check Your Image Tag

Your image must be tagged with the full registry path. For Docker Hub, this usually means `username/repo:tag`.

```bash
# Tag your image for Docker Hub
docker tag my-app:latest username/my-app:latest
```

For private registries, include the registry URL:

```bash
docker tag my-app:latest registry.example.com/my-app:latest
```

### Step 2: Log In to the Registry

Authenticate with the registry using:

```bash
docker login
```

You'll be prompted for your username and password (or token).

### Step 3: Push the Image

Now push the image:

```bash
docker push username/my-app:latest
```

If you still get the error, double-check your permissions on the registry. For Docker Hub, make sure the repository exists and your user has write access.

### Troubleshooting Tips

- Double-check the image tag and registry path.
- Make sure you're logged in to the correct registry.
- Check your user permissions on the registry.
- For private registries, verify SSL certificates and network access.

By following these steps, you can resolve most Docker push errors and keep your CI/CD pipeline running smoothly.

Good luck with your project!

## Related Resources

- [Push Docker Image to Private Repo](/posts/push-docker-image-private-repo) — private registry workflow
- [Docker Rename Image Repository](/posts/docker-rename-image-repository) — fix image naming
- [Copy Docker Images Between Hosts](/posts/copy-docker-images-between-hosts-withouta-repository) — transfer without a registry
- [Introduction to Docker: Working with Images](/guides/introduction-to-docker) — image management guide
