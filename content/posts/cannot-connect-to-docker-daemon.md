---
title: "Fix Docker 'Cannot Connect to the Docker Daemon' and 'Permission Denied' Errors"
excerpt: "Fix 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock', permission denied on the Docker socket and on volumes, and 'denied: requested access to the resource is denied' on docker push. Learn why the docker group equals root, and how to harden a Docker host."
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-12-28'
publishedAt: '2024-12-28T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Troubleshooting
  - Permissions
  - Security
  - Linux
  - DevOps
---

You run a `docker` command and get `Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?`, or a `permission denied` that mentions the same socket. Both errors mean the `docker` client could not talk to the daemon. The daemon may be stopped, the client may look in the wrong place, or your user may not have access to the socket.

This post shows how to find which one it is and fix it on Linux, Docker Desktop and rootless Docker. It also covers `permission denied` on files and volumes, `denied: requested access to the resource is denied` on `docker push`, and the security cost of the usual fix.

## TLDR

| Error                                                                   | Usual cause                                 | Fix                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| `Cannot connect to the Docker daemon ... Is the docker daemon running?` | The daemon is stopped                       | `sudo systemctl start docker`, or start Docker Desktop                           |
| The same, but the daemon runs                                           | The client uses the wrong socket or context | `docker context ls`, `unset DOCKER_HOST`                                         |
| `dial unix /var/run/docker.sock: connect: permission denied`            | Your user is not in the `docker` group      | `sudo usermod -aG docker $USER`, then log in again                               |
| `Mounts denied` or `Permission denied` in a container                   | File sharing, UIDs or SELinux               | See [files and volumes](#h2-how-do-i-fix-permission-denied-on-files-and-volumes) |
| `denied: requested access to the resource is denied`                    | Wrong image name or not logged in           | Tag as `user/repo:tag`, then `docker login`                                      |

## Prerequisites

- Docker Engine on Linux, Docker Desktop, or rootless Docker.
- `sudo` access on Linux for the daemon checks.

## What Does "Cannot Connect to the Docker Daemon" Mean?

The `docker` command is only a client. It sends API requests to the daemon, `dockerd`, through a socket. On Linux that is `/var/run/docker.sock` by default:

```text
docker CLI  ──API request──>  /var/run/docker.sock  ──>  dockerd
```

`docker version` shows both sides. If it prints the `Client` section and then the error, the client works and the daemon is not reachable. Check the three causes in this order: is the daemon running, is the client looking at the right socket, and may your user open it.

## How Do I Check That the Docker Daemon Is Running?

On Linux with systemd:

```bash
sudo systemctl status docker     # "active (running)" or "inactive (dead)"
sudo systemctl start docker      # start it now
sudo systemctl enable docker     # start it at boot
```

If it does not start, the log says why:

```bash
sudo journalctl -u docker.service -n 50 --no-pager
```

Common reasons:

- **A syntax error in `/etc/docker/daemon.json`.** Check the file with `sudo dockerd --validate --config-file /etc/docker/daemon.json`.
- **A full disk.** `df -h /var/lib/docker`, then see [free disk space](/posts/docker-list-containers#h2-how-do-i-fix-no-space-left-on-device-in-docker).
- **No systemd.** In WSL 2 without systemd, or in some containers, run `sudo service docker start`, or turn on systemd in `/etc/wsl.conf`.
- **Docker is not installed.** `docker: command not found` means the client is missing too. Install Docker Engine from Docker's own repository, as in [Introduction to Docker: Installation](/guides/introduction-to-docker/02-docker-installation). The `docker.io` package in Debian and Ubuntu is often older, and `yum install docker` on RHEL installs Podman's Docker-compatible wrapper (`podman-docker`), not Docker.

On **Docker Desktop** (macOS, Windows, Linux), the daemon runs inside the Docker Desktop VM. Start the Docker Desktop app and wait until it says that the engine is running. If it does not start, use **Troubleshoot > Restart Docker Desktop**, check free disk space, and on Windows check that WSL 2 is installed and up to date (`wsl --update`).

## How Do I Fix the Wrong Docker Host or Context?

If the daemon runs and you still get the error, the client probably talks to another socket. The `DOCKER_HOST` variable and the active **context** decide where it connects:

```bash
echo "$DOCKER_HOST"     # if set, it overrides the context
docker context ls       # the active context has a *
```

```text
NAME              DESCRIPTION                               DOCKER ENDPOINT
default *         Current DOCKER_HOST based configuration   unix:///var/run/docker.sock
desktop-linux     Docker Desktop                            unix:///home/me/.docker/desktop/docker.sock
rootless          Rootless mode                             unix:///run/user/1000/docker.sock
```

- **Docker Desktop for Linux** uses the `desktop-linux` context and its own socket under `~/.docker/desktop/`. On shutdown it resets the context to `default`, which points to `/var/run/docker.sock`, where no daemon may run. Use `docker context use desktop-linux`. Tools that ignore contexts, such as some SDKs, need `export DOCKER_HOST=unix://$HOME/.docker/desktop/docker.sock`.
- **Rootless Docker** listens on `$XDG_RUNTIME_DIR/docker.sock`. Since Engine 23, the setup tool switches the CLI to the `rootless` context for you. On older setups, run `docker context use rootless`.
- **A leftover `DOCKER_HOST`** from a tutorial, a remote host or `minikube docker-env` points the client elsewhere. Run `unset DOCKER_HOST`, and `eval "$(minikube docker-env -u)"` for minikube, then remove the line from your shell profile.

## How Do I Fix "Permission Denied" on the Docker Socket?

The error ends with `dial unix /var/run/docker.sock: connect: permission denied`. The daemon runs, but your user may not open the socket. The socket belongs to `root` and the `docker` group:

```bash
ls -l /var/run/docker.sock
# srw-rw---- 1 root docker 0 Nov 13 09:00 /var/run/docker.sock
```

Add your user to the `docker` group, then start a new login session so the group applies:

```bash
sudo groupadd docker 2>/dev/null   # usually exists already
sudo usermod -aG docker "$USER"    # -a appends, without it you lose your other groups
newgrp docker                      # this shell only; log out and in for all sessions
docker run --rm hello-world        # works without sudo now
```

`groups` must list `docker`. If it does not, the session is still the old one: log out completely, or reboot a desktop session.

Do not fix this with `sudo chmod 666 /var/run/docker.sock`. It gives every user and every process on the host root access through Docker, and the daemon resets the mode on the next start anyway. `sudo docker ...` is a fine temporary workaround.

## Why Is the docker Group the Same as Root?

Anyone who can use the Docker socket can start a container that mounts the host's root file system and get a root shell on the host:

```bash
# A user in the docker group, without sudo:
docker run --rm -it -v /:/host alpine:3.24 chroot /host sh
# You are now root on the host
```

So only add users to the `docker` group whom you would give `sudo`. Never mount `/var/run/docker.sock` into a container that you do not trust, and never expose the daemon on TCP port 2375 without TLS: that gives root on the host to the network. The [container escape simulator](/games/docker-escape) walks through this and other flags that hand over the host.

**Rootless Docker** removes the problem. The daemon and the containers run as your user, so a container escape only gets your user's rights:

```bash
dockerd-rootless-setuptool.sh install     # from the docker-ce-rootless-extras package
systemctl --user start docker
docker context use rootless               # done for you since Engine 23
```

Rootless mode has limits: ports below 1024 need extra setup (`sudo setcap cap_net_bind_service=ep $(which rootlesskit)` or the `net.ipv4.ip_unprivileged_port_start` sysctl), and some storage and network features differ. For a shared server, it is often the best default.

## How Do I Fix Permission Denied on Files and Volumes?

**`Mounts denied` on Docker Desktop.** The host path is not shared with the Docker Desktop VM. Add it under **Settings > Resources > File sharing**, or move the project into your home directory, which is shared by default.

**`Permission denied` when the container writes to a bind mount on Linux.** The container uses the host's numeric UIDs. If the app runs as UID 1000 and the directory belongs to another UID, writes fail:

```bash
docker run --rm myimage id                     # which UID the app runs as
ls -ln ./data                                  # which UID owns the directory
sudo chown -R 1000:1000 ./data                 # make them match, or:
docker run -u "$(id -u):$(id -g)" -v "$(pwd)/data":/app/data myimage
```

**SELinux** (Fedora, RHEL, CentOS Stream) blocks bind mounts without a label. Add `:z` for a directory that several containers share, or `:Z` for one container: `-v "$(pwd)/data":/app/data:Z`. Do not use `:Z` on system directories such as your home directory.

**`Permission denied` on a file inside the image.** Set the owner and mode when you copy it, instead of a later `chmod -R` that doubles the layer size:

```dockerfile
COPY --chown=app:app --chmod=755 entrypoint.sh /usr/local/bin/
COPY --chown=app:app src/ /app/
USER app
```

[How to keep data when a container exits](/posts/docker-data-loss-when-container-exits#h2-how-do-i-mount-a-host-directory-in-a-container) covers more bind-mount details.

## How Do I Fix "denied: requested access to the resource is denied" on docker push?

The registry refused the push. The image name does not point to a repository you may write to, or you are not logged in to that registry:

```bash
# 1. The name must start with your Docker Hub username (not your email) or organization
docker tag my-app:1.0 myuser/my-app:1.0

# 2. For other registries, the name starts with the registry host
docker tag my-app:1.0 ghcr.io/myorg/my-app:1.0

# 3. Log in to the same registry that the name points to
docker login                 # Docker Hub
docker login ghcr.io         # GitHub Container Registry

# 4. Push
docker push myuser/my-app:1.0
```

Check these when it still fails:

- **The namespace.** `docker push my-app:1.0` without a namespace goes to `docker.io/library/my-app`, which only Docker can write to.
- **The account.** `docker login` stores one login per registry. If you logged in as another user, run `docker logout` and log in again.
- **The token.** A personal access token with a read-only scope cannot push. Docker Hub tokens have Read-only, Read & Write, and Read, Write, Delete scopes. GitHub needs `write:packages`.
- **Organization repositories.** Your user needs write permission on the repository, usually through a team.
- **The repository.** Docker Hub creates a repository in your own namespace on the first push, with your default privacy setting. Other registries, such as Amazon ECR, usually need the repository to exist first.

The [image chapter of the Docker guide](/guides/introduction-to-docker/03-working-with-docker-images#h3-push-to-a-private-registry) covers private registries, and [rename an image](/posts/docker-rename-image-repository) shows `docker tag` in detail.

## How Do I Harden a Docker Host and Its Containers?

The steps above make Docker work. These make it safer. On the host:

- Keep the socket private: no `chmod 666`, no `docker.sock` mounts into untrusted containers, no TCP socket without TLS.
- Use rootless Docker, or user namespace remapping (`"userns-remap": "default"` in `daemon.json`), so root in a container is not root on the host.
- Keep Docker Engine and the kernel updated. Container escapes usually come from kernel bugs.

In the image:

- Start from a small, maintained base image, and pin the tag (or the digest for production).
- Run as a non-root user with `USER`.
- Keep secrets out of layers: use [build secrets](/posts/force-docker-clean-build#h2-how-do-i-use-ssh-keys-or-secrets-in-a-docker-build), not `COPY`, `ARG` or `ENV`.
- Scan for known vulnerabilities, for example with `docker scout cves myimage:1.0`. To sign images, use cosign or Notation: Docker Content Trust is gone from the CLI since Engine 29.

When you run the container, give it only what it needs:

```bash
docker run -d --name api \
  --read-only --tmpfs /tmp \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --memory 512m --pids-limit 200 \
  -u 10001:10001 \
  -p 127.0.0.1:8080:8080 \
  myorg/api:1.4
```

| Option                             | Effect                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `--read-only --tmpfs /tmp`         | The app cannot change its own files, only `/tmp` in memory               |
| `--cap-drop ALL`                   | No Linux capabilities. Add back only what the app needs with `--cap-add` |
| `--security-opt no-new-privileges` | `setuid` binaries cannot raise privileges                                |
| `--memory`, `--pids-limit`         | A leak or fork bomb cannot take the whole host                           |
| `-u 10001:10001`                   | Not root inside the container                                            |
| `-p 127.0.0.1:...`                 | Not reachable from other machines                                        |

Never use `--privileged`, `--pid host` or `--cap-add SYS_ADMIN` for an app container. The [Docker security checklist](/checklists/docker-security) has the full list, and [Your container is not a security boundary](/posts/ghostlock-cve-2026-43499-container-boundary) shows why the kernel is the weak point.

## Troubleshooting Checklist

1. `docker version`: does the `Server` section appear?
2. `sudo systemctl status docker`, or is Docker Desktop running?
3. `sudo journalctl -u docker -n 50`: why did the daemon stop?
4. `docker context ls` and `echo "$DOCKER_HOST"`: does the client look at the right socket?
5. `ls -l /var/run/docker.sock` and `groups`: may your user open it?
6. After `usermod`, did you start a new login session?

## Related Resources

- [Introduction to Docker: Installation](/guides/introduction-to-docker/02-docker-installation): install Docker Engine and run it without sudo
- [Container escape simulator](/games/docker-escape): spot the `docker run` flag that owns the host
- [Docker security checklist](/checklists/docker-security): harden containers, images and the daemon
- [Seccomp profiles with the Security Profiles Operator](/posts/security-profiles-operator-seccomp-boundary): a tighter boundary in Kubernetes
- [Docker flashcards](/flashcards/docker-essentials): review core Docker concepts
