---
title: 'How to Set Image Name in Dockerfile'
excerpt: 'Learn how to set and manage image names effectively in Dockerfiles for streamlined workflows. This guide covers the steps to build Docker images with specific names and tags.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-07-04'
publishedAt: '2025-07-04T10:00:00Z'
updatedAt: '2025-07-04T10:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Dockerfile
  - Image Name
  - Tutorials
---

## TLDR

To set an image name in Docker, you use the `docker build` command with the `-t` flag. The image name is not directly set in the Dockerfile but is specified during the build process.

---

Docker images are a fundamental part of containerized workflows. While the Dockerfile defines the instructions for building an image, the image name is set during the build process using the `docker build` command. This guide will show you how to set and manage image names effectively.

## Step 1: Create a Dockerfile

Start by creating a Dockerfile with the necessary instructions to build your image.

### Example Dockerfile

```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "app.js"]
```

### Explanation

- `FROM node:18`: Specifies the base image.
- `WORKDIR /app`: Sets the working directory inside the container.
- `COPY . .`: Copies files from the current directory into the container.
- `RUN npm install`: Installs dependencies.
- `CMD ["node", "app.js"]`: Starts the application.

## Step 2: Build the Image with a Name

Use the `docker build` command with the `-t` flag to set the image name.

### Command

```bash
docker build -t my-app:latest .
```

### Explanation

- `-t my-app:latest`: Sets the image name to `my-app` and the tag to `latest`.
- `.`: Specifies the build context (current directory).

## Step 3: Verify the Image Name

After building the image, verify its name using the `docker images` command.

### Command

To list all Docker images and confirm the name:

```bash
docker images
```

### Example Output

```plaintext
REPOSITORY   TAG       IMAGE ID       CREATED         SIZE
my-app       latest    abc123def456   5 minutes ago   123MB
```

## Best Practices

- **Use Descriptive Names**: Choose names that reflect the purpose of the image.
- **Tag Versions**: Use tags like `v1.0` or `latest` to manage versions.
- **Automate Naming**: Use CI/CD pipelines to automate image naming and tagging.

By following these steps, you can effectively set and manage image names in Dockerfiles, ensuring streamlined workflows and better organization of your Docker images.


## Related Resources

- [Docker Rename Image Repository](/posts/docker-rename-image-repository) — rename existing images
- [Push Docker Image to Private Repo](/posts/push-docker-image-private-repo) — push named images
- [Difference Between RUN and CMD](/posts/difference-run-cmd-dockerfile) — Dockerfile instructions
- [Introduction to Docker: Building Images](/guides/introduction-to-docker) — Dockerfile guide
