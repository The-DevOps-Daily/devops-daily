---
title: 'How to Deploy Docker Containers with GitHub Actions CI/CD'
excerpt: 'Learn how to set up a complete CI/CD pipeline using GitHub Actions to build, push, and deploy Docker containers to EC2 or DigitalOcean servers.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-01-24'
publishedAt: '2025-01-24T10:00:00Z'
updatedAt: '2025-01-24T10:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - GitHub Actions
  - CI/CD
  - DevOps
  - Deployment
  - EC2
  - DigitalOcean
---

Automating Docker deployments eliminates manual steps and reduces deployment errors. GitHub Actions provides a powerful, free CI/CD platform that integrates directly with your repository. In this guide, you'll build a complete pipeline that builds your Docker image, pushes it to a registry, and deploys it to a remote server—all triggered by a simple git push.

## Prerequisites

Before starting, you'll need:

- A GitHub repository with a Dockerized application
- An EC2 instance or DigitalOcean Droplet with Docker installed
- SSH access to your server
- A Docker Hub account (or other container registry)
- Basic familiarity with Docker and GitHub

## Architecture Overview

Here's what our CI/CD pipeline will do:

```
CI/CD Pipeline Flow:
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Push to main  │────▶│  Build & Test   │────▶│  Push to        │
│   branch        │     │  Docker image   │     │  Docker Hub     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │  Application    │◀────│  SSH & Deploy   │
                        │  Running        │     │  to Server      │
                        └─────────────────┘     └─────────────────┘
```

## Step 1: Prepare Your Dockerfile

Start with a production-ready Dockerfile. Here's an example for a Node.js application:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
USER nodejs
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Key points for CI/CD:
- Multi-stage builds reduce image size
- Non-root user improves security
- Explicit `EXPOSE` documents the port

## Step 2: Set Up Server Access

### Generate SSH Keys

Create a dedicated SSH key pair for deployments:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key -N ""
```

### Add Public Key to Server

Copy the public key to your EC2 or DigitalOcean server:

```bash
# For EC2
ssh-copy-id -i ~/.ssh/deploy_key.pub ec2-user@your-server-ip

# For DigitalOcean
ssh-copy-id -i ~/.ssh/deploy_key.pub root@your-server-ip
```

Or manually add it to `~/.ssh/authorized_keys` on the server.

### Configure GitHub Secrets

In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add:

| Secret Name | Value |
|-------------|-------|
| `SSH_PRIVATE_KEY` | Contents of `~/.ssh/deploy_key` (private key) |
| `SSH_HOST` | Your server IP address |
| `SSH_USER` | `ec2-user` or `root` |
| `DOCKER_USERNAME` | Your Docker Hub username |
| `DOCKER_PASSWORD` | Your Docker Hub password or access token |

## Step 3: Create the GitHub Actions Workflow

Create `.github/workflows/deploy.yml` in your repository:

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:  # Allow manual triggers

env:
  IMAGE_NAME: yourusername/yourapp
  CONTAINER_NAME: yourapp

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    outputs:
      image_tag: ${{ steps.meta.outputs.tags }}
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=
            type=raw,value=latest

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            # Pull the latest image
            docker pull ${{ env.IMAGE_NAME }}:latest
            
            # Stop and remove existing container
            docker stop ${{ env.CONTAINER_NAME }} || true
            docker rm ${{ env.CONTAINER_NAME }} || true
            
            # Run the new container
            docker run -d \
              --name ${{ env.CONTAINER_NAME }} \
              --restart unless-stopped \
              -p 80:3000 \
              ${{ env.IMAGE_NAME }}:latest
            
            # Clean up old images
            docker image prune -f
```

## Step 4: Prepare Your Server

SSH into your server and ensure Docker is installed and running:

### For EC2 (Amazon Linux 2)

```bash
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user
```

### For DigitalOcean (Ubuntu)

```bash
sudo apt update
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

Log out and back in for group changes to take effect.

### Configure Firewall

Allow HTTP traffic:

```bash
# EC2: Configure Security Group in AWS Console
# Allow inbound TCP port 80 from 0.0.0.0/0

# DigitalOcean with UFW
sudo ufw allow 80/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

## Step 5: Test the Pipeline

Push a change to your main branch:

```bash
git add .
git commit -m "Add CI/CD pipeline"
git push origin main
```

Monitor the workflow in the **Actions** tab of your GitHub repository. You should see:

1. Build job starts, builds Docker image
2. Image is pushed to Docker Hub
3. Deploy job connects via SSH
4. New container starts on your server

## Advanced: Zero-Downtime Deployments

The basic workflow has brief downtime during container replacement. For zero-downtime deployments, use a blue-green approach:

```yaml
- name: Deploy with zero downtime
  uses: appleboy/ssh-action@v1.0.3
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USER }}
    key: ${{ secrets.SSH_PRIVATE_KEY }}
    script: |
      # Pull new image
      docker pull ${{ env.IMAGE_NAME }}:latest
      
      # Start new container on different port
      docker run -d \
        --name ${{ env.CONTAINER_NAME }}-new \
        -p 3001:3000 \
        ${{ env.IMAGE_NAME }}:latest
      
      # Wait for health check
      sleep 10
      curl -f http://localhost:3001/health || exit 1
      
      # Swap containers
      docker stop ${{ env.CONTAINER_NAME }} || true
      docker rm ${{ env.CONTAINER_NAME }} || true
      docker rename ${{ env.CONTAINER_NAME }}-new ${{ env.CONTAINER_NAME }}
      
      # Update port mapping (requires nginx or similar)
      docker stop ${{ env.CONTAINER_NAME }}
      docker run -d \
        --name ${{ env.CONTAINER_NAME }} \
        --restart unless-stopped \
        -p 80:3000 \
        ${{ env.IMAGE_NAME }}:latest
```

For production, consider using a reverse proxy like Nginx or Traefik for smoother transitions.

## Advanced: Using Docker Compose

For multi-container applications, deploy with Docker Compose:

```yaml
- name: Deploy with Docker Compose
  uses: appleboy/ssh-action@v1.0.3
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USER }}
    key: ${{ secrets.SSH_PRIVATE_KEY }}
    script: |
      cd /opt/myapp
      
      # Pull latest images
      docker compose pull
      
      # Deploy with zero downtime
      docker compose up -d --remove-orphans
      
      # Clean up
      docker image prune -f
```

Your `docker-compose.yml` on the server:

```yaml
services:
  app:
    image: yourusername/yourapp:latest
    restart: unless-stopped
    ports:
      - "80:3000"
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Advanced: Environment-Specific Deployments

Deploy to different environments based on the branch:

```yaml
name: Deploy to Environment

on:
  push:
    branches:
      - main
      - staging

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.ref_name == 'main' && 'production' || 'staging' }}
    
    steps:
      - name: Set environment variables
        run: |
          if [ "${{ github.ref_name }}" == "main" ]; then
            echo "DEPLOY_HOST=${{ secrets.PROD_HOST }}" >> $GITHUB_ENV
            echo "IMAGE_TAG=latest" >> $GITHUB_ENV
          else
            echo "DEPLOY_HOST=${{ secrets.STAGING_HOST }}" >> $GITHUB_ENV
            echo "IMAGE_TAG=staging" >> $GITHUB_ENV
          fi
```

## Troubleshooting

### SSH Connection Fails

```bash
# Test SSH manually
ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no user@host

# Check key permissions
chmod 600 ~/.ssh/deploy_key
```

Ensure the private key in GitHub Secrets includes the full key, including `-----BEGIN` and `-----END` lines.

### Container Fails to Start

```bash
# Check container logs
docker logs yourapp

# Check if port is already in use
sudo lsof -i :80
```

### Image Pull Rate Limits

Docker Hub has pull rate limits. For high-traffic deployments, authenticate or use GitHub Container Registry:

```yaml
- name: Log in to GitHub Container Registry
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
```

## Security Best Practices

1. **Use access tokens** instead of passwords for Docker Hub
2. **Rotate SSH keys** periodically
3. **Limit SSH access** to GitHub Actions IP ranges if possible
4. **Use environment protection rules** for production deployments
5. **Never commit secrets** to your repository
6. **Scan images** for vulnerabilities before deployment:

```yaml
- name: Scan for vulnerabilities
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_NAME }}:latest
    exit-code: '1'
    severity: 'CRITICAL,HIGH'
```

## Conclusion

You now have a complete CI/CD pipeline that automatically builds, tests, and deploys your Docker containers whenever you push to main. This setup works equally well for EC2, DigitalOcean, or any server with SSH access and Docker installed.

For production workloads, consider adding:
- Automated testing before deployment
- Slack or email notifications
- Rollback capabilities
- Health check monitoring

The investment in CI/CD automation pays off quickly—every deployment becomes a simple git push, and your team can ship with confidence.
