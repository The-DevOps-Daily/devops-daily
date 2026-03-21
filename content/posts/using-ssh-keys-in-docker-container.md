---
title: 'Using SSH Keys Inside a Docker Container'
excerpt: 'Need to use SSH keys in your Docker container for git, automation, or remote access? Learn secure ways to provide SSH keys, best practices for builds, and how to avoid common pitfalls.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-04-26'
publishedAt: '2025-04-26T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - SSH
  - Security
  - DevOps
---

## TLDR

To use SSH keys inside a Docker container, mount your key at runtime or use Docker's SSH agent forwarding. Never bake private keys into images. This guide covers secure patterns for development, CI, and production, with practical examples and troubleshooting tips.

## Why Use SSH Keys in a Container?

You might need SSH keys in a container to:

- Clone private git repositories
- Connect to remote servers for automation
- Use tools like Ansible or rsync over SSH

## The Wrong Way: Copying Keys into Images

**Never copy your private SSH keys into a Docker image.** This exposes secrets to anyone with access to the image and risks leaking credentials if the image is pushed to a registry.

## The Right Way: Mounting SSH Keys at Runtime

The safest approach is to mount your SSH key into the container at runtime:

```bash
docker run -v $HOME/.ssh/id_rsa:/root/.ssh/id_rsa:ro -it my-image
```

- This makes your private key available only while the container runs.
- Use `:ro` to mount read-only.
- Set permissions inside the container if needed:

```bash
chmod 600 /root/.ssh/id_rsa
```

You can also mount your entire `.ssh` directory:

```bash
docker run -v $HOME/.ssh:/root/.ssh:ro -it my-image
```

## Using SSH Agent Forwarding (Recommended for CI and Builds)

For build-time access (e.g., cloning private repos in a Dockerfile), use Docker's SSH agent forwarding (Docker 18.09+):

1. Start your SSH agent and add your key:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_rsa
```

2. Build with SSH forwarding:

```bash
docker build --ssh default .
```

3. In your Dockerfile, use:

```dockerfile
# syntax=docker/dockerfile:1.2
FROM alpine
RUN apk add --no-cache openssh git
RUN --mount=type=ssh git clone git@github.com:yourorg/private-repo.git
```

- The key is never copied into the image.
- Works for multi-stage builds and CI pipelines.

## Using SSH Keys for Remote Access

If you need to SSH from inside a running container:

1. Mount your key as above.
2. Make sure the container has an SSH client installed (e.g., `apt-get install -y openssh-client`).
3. Use `ssh` as usual:

```bash
ssh -i /root/.ssh/id_rsa user@remote-host
```

## Best Practices

- Never commit or bake private keys into images or version control.
- Use agent forwarding for build-time access.
- Mount keys at runtime for interactive or automation use.
- Set correct permissions (`chmod 600`) on private keys.
- Use separate deploy keys or service accounts for automation.
- Clean up keys and known_hosts after use in CI/CD jobs.

## Troubleshooting

- If you see `Permission denied (publickey)`, check key permissions and SSH config.
- If mounting doesn't work, check your Docker version and volume syntax.
- For multi-user containers, mount keys to the correct user's home directory.

## Conclusion

Using SSH keys in Docker containers is safe and flexible when you mount them at runtime or use agent forwarding. Avoid copying secrets into images, and follow best practices to keep your credentials secure in every environment.


## Related Resources

- [Docker Security Best Practices](/posts/docker-security-best-practices) — keep secrets out of images
- [Advanced Docker Features](/posts/advanced-docker-features) — BuildKit secrets
- [Docker Compose Environment Variables](/posts/docker-compose-environment-variables) — pass config securely
- [Docker Security Checklist](/checklists/docker-security) — verify your setup
