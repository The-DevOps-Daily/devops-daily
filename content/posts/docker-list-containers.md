---
title: 'How to List and Remove Docker Containers and Images'
excerpt: 'List running and stopped containers, fix "name is already in use", remove old containers and images safely, delete every local image, find where Docker stores its data, and free disk space when Docker fills the disk.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-01-28'
publishedAt: '2024-01-28T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Containers
  - Images
  - Disk Space
  - Troubleshooting
  - DevOps
---

Every `docker run` leaves a container behind unless you remove it, and every pull and build adds image data. After a few weeks of development or CI, you have dozens of stopped containers, old images and gigabytes of build cache, and sooner or later a `name is already in use` error or a full disk.

This post shows how to list containers and images, fix name conflicts, remove what you no longer need from the safest command to the most aggressive, find where Docker keeps its data, and get out of a `no space left on device` situation.

## TLDR

| Task                             | Command                           |
| -------------------------------- | --------------------------------- |
| Running containers               | `docker ps`                       |
| All containers, stopped ones too | `docker ps -a`                    |
| Remove one container             | `docker rm web` (`-f` if it runs) |
| Remove all stopped containers    | `docker container prune`          |
| Remove one image                 | `docker image rm nginx:1.30`      |
| Remove images no container uses  | `docker image prune -a`           |
| Remove the build cache           | `docker builder prune`            |
| See what uses the disk           | `docker system df`                |

None of these commands remove named volumes. Your data in volumes stays until you run `docker volume rm` or `docker volume prune --all`.

## Prerequisites

- Docker Engine or Docker Desktop. The recorded output below comes from Docker Engine 28.0.4. Engine 29 shows a different default layout for `docker image ls`.
- Permission to run `docker`.

## How Do I List Docker Containers?

`docker ps` shows running containers. Add `-a` to include stopped and created ones:

```bash
docker ps        # running only
docker ps -a     # everything, with STATUS such as "Exited (0) 2 hours ago"
```

`docker container ls` is the same command with a longer name. The options you need most:

```bash
docker ps -a --filter status=exited                       # only stopped containers
docker ps -a --filter name=web                            # names that contain "web"
docker ps -a --filter ancestor=nginx:1.30                 # containers of one image
docker ps -q                                              # only the IDs, for scripts
docker ps -s                                              # with the size of each writable layer
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
```

In a Compose project, `docker compose ps` lists only that project's containers, and `docker compose ps -a` includes stopped ones.

## How Do I Fix "The Container Name Is Already in Use" Error?

```text
docker: Error response from daemon: Conflict. The container name "/web" is already in use by container "3aff97197020...". You have to remove (or rename) that container to be able to reuse that name.
```

Container names are unique, and a stopped container still owns its name. `docker ps` does not show it, so run `docker ps -a --filter name=web`, then pick one fix:

```bash
docker start web                 # you wanted the old container: start it again
docker rm web                    # you do not need it: remove it (add -f if it runs)
docker rename web web-old        # keep it, but free the name for a new container
```

To avoid the error in scripts, remove the old container first (`docker rm -f web 2>/dev/null; docker run --name web ...`) or let Docker remove containers on exit with `docker run --rm`. Compose avoids it by reusing or recreating its own containers, as long as you do not set `container_name:` to a name that another container already uses.

## How Do I Remove Old Docker Containers?

```bash
docker rm web                    # one stopped container
docker rm -f web                 # stop it first if it runs
docker container prune           # every stopped container, after a prompt
docker container prune -f --filter "until=24h"   # stopped ones created over 24 hours ago, no prompt
```

`docker rm` deletes the container's writable layer. Named volumes stay, and so do anonymous volumes unless you add `-v` (`docker rm -v web`). For one-off containers, `docker run --rm` removes the container as soon as it exits, so nothing piles up.

## How Do I Remove Docker Images?

Remove one image by name or ID with `docker image rm` (the short form is `docker rmi`):

```bash
docker image rm nginx:1.30
docker rmi 53d8f012a1a7
```

Removing a name with `docker image rm` only removes the image when no other tag points to it. If a container uses the image, even a stopped one, Docker refuses:

```bash
docker ps -a --filter ancestor=myapp:1.0 -q | xargs -r docker rm   # remove the containers first
docker image rm myapp:1.0
```

For bulk cleanup, `prune` is safer than a loop over `docker rmi`:

```bash
docker image ls --filter dangling=true      # untagged leftovers of rebuilds
docker image prune                          # remove those dangling images
docker image prune -a                       # every image that no container uses
docker image prune -a --filter "until=168h" # the same, but only images older than 7 days
```

`docker image prune -a` never removes an image that a container uses. The images come back with the next `docker pull` or `docker run`, so the cost of an aggressive prune is download time, not data. Images that you built locally and never pushed are the exception: push or `docker save` them first.

## Delete All Local Docker Images

To start from zero, remove the containers first, then every image:

```bash
docker ps -aq | xargs -r docker rm -f   # every container, running or stopped
docker image prune -a -f                 # every image that no container uses, which is now all of them
```

The one-liner you will find everywhere, `docker rmi $(docker images -q)`, fails in three ways at once. Here one container runs `nginx:1.30`, a stopped container still references `hello-world`, and `alpine:3.22` also has the tag `myapp:dev`:

```terminal
{
  "title": "why docker rmi $(docker images -q) fails",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker image ls",
      "output": "REPOSITORY    TAG       IMAGE ID       CREATED        SIZE\nnginx         1.30      53d8f012a1a7   9 hours ago    163MB\nalpine        3.22      24ab38714e94   2 weeks ago    8.3MB\nmyapp         dev       24ab38714e94   2 weeks ago    8.3MB\nhello-world   latest    e2ac70e7319a   7 months ago   10.1kB"
    },
    {
      "cmd": "docker rmi $(docker images -q)",
      "output": "Error response from daemon: conflict: unable to delete 53d8f012a1a7 (cannot be forced) - image is being used by running container 75c0a0426360\nError response from daemon: conflict: unable to delete 24ab38714e94 (must be forced) - image is referenced in multiple repositories\nError response from daemon: conflict: unable to delete 24ab38714e94 (must be forced) - image is referenced in multiple repositories\nError response from daemon: conflict: unable to delete e2ac70e7319a (must be forced) - image is being used by stopped container 3aff97197020"
    },
    {
      "cmd": "docker image prune -a -f",
      "output": "Deleted Images:\nuntagged: alpine:3.22\nuntagged: alpine@sha256:2e0b81d60597f449baa56dc25d355367869d2dca4cd57e866f1e2b52af3eb55f\nuntagged: myapp:dev\n\nTotal reclaimed space: 8.297MB"
    },
    {
      "cmd": "docker ps -aq | xargs -r docker rm -f",
      "output": "3aff97197020\n75c0a0426360"
    },
    {
      "cmd": "docker image prune -a -f | tail -1",
      "output": "Total reclaimed space: 162.6MB"
    },
    {
      "cmd": "docker rmi $(docker images -q)",
      "output": "docker: 'docker rmi' requires at least 1 argument\n\nUsage:  docker rmi [OPTIONS] IMAGE [IMAGE...]\n\nSee 'docker rmi --help' for more information"
    }
  ]
}
```

`docker images -q` prints an ID once per tag, so an image with two tags is listed twice and refused twice. A running container blocks its image even with `-f`; a stopped one blocks it unless you force. `docker image prune -a` skips images that any container uses, stopped containers included, which is why `nginx` and `hello-world` survived the first prune. When nothing is left, `$(docker images -q)` is empty and `docker rmi` gets no argument; `xargs -r` runs nothing in that case. The output above is from Docker Engine 28.0.4.

`docker system prune -a` removes stopped containers, unused networks, unused images and the build cache in one command, but it leaves running containers and their images alone. Add `--volumes` only if you mean to delete data as well.

## Where Does Docker Store Images and Containers?

`docker info -f '{{.DockerRootDir}}'` prints Docker's data directory. The defaults:

| Platform                  | Where the data is                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Linux, Docker Engine      | `/var/lib/docker` for containers, volumes and logs; `/var/lib/containerd` for images with the containerd image store |
| Docker Desktop on macOS   | Inside a Linux VM, in one disk image file under `~/Library/Containers/com.docker.docker/Data/vms/0/data/`            |
| Docker Desktop on Windows | Inside a WSL 2 virtual disk (a `.vhdx` file) under `%LOCALAPPDATA%\Docker\wsl`                                       |
| Windows containers        | `C:\ProgramData\Docker`                                                                                              |

Docker Engine 29 uses the **containerd image store** for new installs. Image layers are then kept by containerd under `/var/lib/containerd`, not in `/var/lib/docker/overlay2`. `docker info` shows which store you have: the `Storage Driver` line reads `overlayfs` with `driver-type: io.containerd.snapshotter.v1` for the containerd store, and `overlay2` for the classic one. Hosts that were upgraded from older versions keep the classic store until you switch.

Do not delete files in these directories by hand. Docker tracks every layer in its own database, and removing directories behind its back corrupts images and containers. Use the `prune` commands, or the steps below.

On Docker Desktop, the VM disk file only grows. After a big cleanup, the file can stay large on disk. Docker Desktop's **Troubleshoot** menu has options to clean up or reset the data, and **Settings > Resources** sets the disk size limit.

## How Do I Fix "No Space Left on Device" in Docker?

When a build or a container fails with `no space left on device`, the disk that holds Docker's data directory is full. Check that disk first, then see which kind of Docker object uses the space:

```bash
# Where Docker keeps its data, and how full that disk is
docker info -f '{{.DockerRootDir}}'
df -h "$(docker info -f '{{.DockerRootDir}}')"

# Images, containers, volumes and build cache, with what can be reclaimed
docker system df
```

Then free space from the safest step to the most aggressive:

1. `docker container prune` removes stopped containers.
2. `docker image prune` removes dangling images, the untagged leftovers of rebuilds. `docker image prune -a` removes every image that no container uses; they download again when needed.
3. `docker builder prune` removes the build cache, which grows fast on CI machines and build servers.
4. `docker system prune` does steps 1 to 3 (dangling images only) plus unused networks.

**Volumes are safer than the `--volumes` flag suggests.** Since Docker Engine 23, `docker system prune --volumes` and `docker volume prune` remove only anonymous volumes. In our test on Engine 28, a prune removed the anonymous volume of a deleted container and kept a named volume called `named-data`. Named volumes go only with `docker volume rm` or `docker volume prune --all`, so check `docker volume ls` before you use either one.

If `docker system df` shows little to reclaim but the disk is still full, look at two more places:

- **Container logs.** The default `json-file` driver never rotates, and `docker system df` does not count logs. `sudo du -sh /var/lib/docker/containers/*/*-json.log | sort -h | tail` finds the big ones. [Clear a log that already fills the disk](/posts/docker-desktop-local-log-driver#h3-clear-a-log-that-already-fills-the-disk) shows how to clear one and set a limit.
- **Inodes.** `df -i` shows whether the file system ran out of inodes rather than bytes, which happens with many small layer files. Pruning helps here too.

If Docker simply needs more room, move its data directory to a bigger disk, as below.

## How Do I Move Docker's Data to Another Disk?

On Linux, set `data-root` in `/etc/docker/daemon.json` and move the data while Docker is stopped:

```bash
sudo systemctl stop docker docker.socket
sudo rsync -aHAX /var/lib/docker/ /mnt/bigdisk/docker/
echo '{ "data-root": "/mnt/bigdisk/docker" }' | sudo tee /etc/docker/daemon.json   # merge by hand if the file has other settings
sudo systemctl start docker
docker info -f '{{.DockerRootDir}}'     # check the new path, then delete the old directory
```

With the containerd image store, images live in containerd's directory, which `data-root` does not move. Change `root` in `/etc/containerd/config.toml` too, stop `containerd` with Docker, and move `/var/lib/containerd` the same way. On Docker Desktop, change the disk image location in **Settings > Resources > Advanced**.

## How Do I Keep Docker From Filling the Disk Again?

- Run one-off containers with `--rm`.
- Limit container logs. The default `json-file` driver keeps logs forever. Set `"log-driver": "local"` or `"log-opts": {"max-size": "10m", "max-file": "3"}` in `daemon.json`.
- Prune on a schedule on build servers and CI runners, for example a weekly cron job: `docker system prune -af --filter "until=168h"`. On a server that runs production containers, prune only stopped containers and dangling images, so a rollback does not have to download the previous image.
- Watch `docker system df` and `df -h` in your monitoring, not only after the disk is full.

## Related Resources

- [Docker image vs container](/posts/how-docker-works-under-the-hood#h2-docker-image-vs-container-what-is-the-difference): why removing a container keeps the image
- [How to keep data when a container exits](/posts/docker-data-loss-when-container-exits#h2-how-do-i-remove-volumes-without-losing-data-by-accident): which commands remove volumes
- [Docker Desktop's local log driver](/posts/docker-desktop-local-log-driver): what changes for log disk use
- [Introduction to Docker: Free Disk Space](/guides/introduction-to-docker/03-working-with-docker-images)
- [Docker terminal simulator](/games/docker-terminal-simulator): practice `ps`, `rm` and `prune` without risk
- [Docker flashcards](/flashcards/docker-essentials): review the commands
