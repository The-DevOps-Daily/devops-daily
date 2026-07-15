---
title: 'How Docker Really Works, From docker run to the Kernel'
excerpt: 'You type docker run and a container appears. Between those two moments the CLI, dockerd, containerd, and runc hand work down a chain until the Linux kernel puts your process in its own namespaces and cgroups. Here is the whole path, with the real commands to watch it happen.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2026-07-14'
publishedAt: '2026-07-14T09:00:00Z'
updatedAt: '2026-07-14T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Docker
  - Containers
  - containerd
  - runc
  - Linux
  - Namespaces
  - cgroups
---

You run `docker run -p 8080:80 nginx`, wait a second, and a web server is serving on port 8080. It feels like one action. It is not. Behind that single command, four separate programs hand work down a chain, an image gets pulled apart into layers, a bundle of files gets written to disk, and finally the Linux kernel is asked to put one process into its own little world. Nothing here is magic, and every step is something you can watch on a real machine.

This post walks the whole path, top to bottom, and shows the command that lets you see each layer for yourself. By the end, the sentence "a container is just a process" will stop being a slogan and start being something you can prove.

:::tip
Prefer to click through it? The [How Docker Works Under the Hood simulator](https://devops-daily.com/games/docker-under-the-hood-simulator) plays this exact flow one layer at a time, with the same commands. Read here, then go press play.
:::

## TLDR

- The `docker` command is a thin REST client. It sends your request to a long-running daemon and does nothing else.
- `dockerd` prepares config and pulls the image, then hands the actual container work to `containerd`.
- `containerd` unpacks the image into a filesystem and builds an OCI **bundle**: a `config.json` plus a `rootfs`.
- `runc` reads that bundle, creates Linux **namespaces** and a **cgroup**, switches into the rootfs, and `exec`s your process. Then it exits.
- The running container is a normal host process. Its isolation is entirely kernel features: namespaces decide what it can see, cgroups decide what it can use.

## Prerequisites

- Docker installed on a Linux host. The kernel-level commands below are Linux-only; on macOS and Windows, Docker runs inside a Linux VM, so run these from inside that VM or on a cloud box.
- Comfort with a terminal and `sudo`.
- Optional but ideal: a throwaway Linux server so you can break things freely. More on that near the end.

## The 30,000-foot view

Here is the chain a single `docker run` travels before your process exists:

```diagram
{
  "type": "flow",
  "title": "docker run -p 8080:80 nginx",
  "nodes": [
    { "label": "docker CLI", "sub": "REST client", "icon": "box" },
    { "label": "dockerd", "sub": "the daemon", "icon": "gear" },
    { "label": "containerd", "sub": "supervisor", "icon": "server" },
    { "label": "runc", "sub": "OCI runtime", "icon": "cpu" },
    { "label": "your process", "sub": "in the kernel", "icon": "activity" }
  ]
}
```

Four programs, not one. That split looks like over-engineering until you see what each part is for, so let us take them in order.

## Step 1: the CLI is just a REST client

The `docker` binary does not create containers. It turns your command into an HTTP request and sends it to the Docker daemon over a local Unix socket at `/var/run/docker.sock`. You can make the exact same call by hand:

```bash
# What `docker` does under the hood: talk to the daemon over its socket
curl --unix-socket /var/run/docker.sock http://localhost/v1.45/info | jq .ServerVersion
```

That is the whole job of the CLI: serialize your intent and POST it. Everything real happens on the other side of that socket.

## Step 2: dockerd prepares the work and pulls the image

`dockerd` is the long-running engine. It receives the request, parses your flags (the `-p 8080:80` port map, env vars, mounts), and checks whether the `nginx` image is already on disk:

```bash
docker image inspect nginx >/dev/null 2>&1 && echo "local" || echo "need to pull"
```

If the image is missing, the daemon pulls it. An image is not one file. It is a **manifest** plus a stack of read-only **layers**, each identified by a digest. The daemon downloads only the layers it does not already have, which is why the second image that shares a base layer pulls almost instantly.

```text
nginx:latest
 ├─ sha256:9b1c…  debian base        (shared with many images)
 ├─ sha256:4f2d…  apt install nginx
 └─ sha256:7a80…  config + entrypoint
```

## Step 3: dockerd hands off to containerd

Here is the part that surprises people: `dockerd` does not start your process either. It delegates to **containerd**, a separate daemon that owns the container lifecycle. containerd unpacks the image layers into a **snapshot** (a stack of directories unioned together with `overlayfs`), tracks container state, and prepares everything the runtime needs.

Your Docker containers live under containerd's `moby` namespace, and you can list them with containerd's own CLI:

```bash
sudo ctr -n moby containers ls
```

Why the split? Because "manage the API, auth, builds, and networking" and "reliably supervise running containers" are different jobs. Kubernetes, for example, skips `dockerd` entirely and talks straight to `containerd`. Pulling the two apart is what made that possible.

## Step 4: the OCI runtime bundle

containerd now assembles an **OCI bundle**, the standard, tool-agnostic description of a container. It is two things:

1. **`config.json`** — the OCI runtime spec: which process to run, which namespaces and cgroups to create, which mounts to set up, which capabilities to keep.
2. **`rootfs`** — the container's root filesystem: the image's read-only layers plus a fresh writable layer on top, unioned together.

You can generate a sample `config.json` yourself to see its shape:

```bash
runc spec   # writes a config.json in the current directory
```

The interesting part is the `linux.namespaces` block. This is the container's isolation, declared before the container exists:

```json
{
  "process": {
    "args": ["nginx", "-g", "daemon off;"]
  },
  "linux": {
    "namespaces": [
      { "type": "pid" },
      { "type": "network" },
      { "type": "mount" },
      { "type": "uts" },
      { "type": "ipc" }
    ]
  }
}
```

## Step 5: runc creates the container, then gets out of the way

containerd calls **runc**, the low-level OCI runtime and the piece that actually talks to the kernel. runc reads `config.json` and, in order:

1. Creates the **namespaces** listed in the spec (a new PID namespace, network namespace, mount namespace, and so on).
2. Sets up the **cgroup** that will cap the container's CPU and memory.
3. `pivot_root`s into the `rootfs` so the process sees the container's filesystem as `/`.
4. Drops Linux capabilities it should not have.
5. `execve`s your process, `nginx`, which becomes **PID 1** inside its new PID namespace.

Then runc **exits**. It is not a supervisor. A small `containerd-shim` process stays behind to keep the container attached to containerd and to reap it when it ends, which is why your container keeps running even if you restart the Docker daemon.

```bash
# The containers runc is currently managing, by ID
sudo runc --root /run/containerd/runc/moby list
```

## Step 6: it is a normal process on the shared kernel

This is the whole point. There is no guest operating system and no virtual hardware. `nginx` is a regular process on your host. Find its real PID:

```bash
id=$(docker run -d -p 8080:80 nginx)
pid=$(docker inspect --format '{{.State.Pid}}' "$id")
ps -o pid,ppid,cmd -p "$pid"     # there it is, in the host's process table
```

What makes it a "container" is only the kernel features wrapped around that process. Look at the namespaces it lives in:

```bash
sudo lsns -p "$pid"
# NS         TYPE   NPROCS   PID  COMMAND
# 4026531840 pid         1   ...  nginx
# 4026532210 net         1   ...  nginx   <- its own network stack
# 4026532208 mnt         1   ...  nginx   <- its own filesystem view
```

And the cgroup that caps what it can use (cgroup v2):

```bash
cat /sys/fs/cgroup/system.slice/docker-"$id".scope/memory.max
```

Your `-p 8080:80` is not magic either. Docker wires it up with an `iptables` DNAT rule (and a small `docker-proxy` helper) so traffic to host port 8080 is redirected to the container's port 80:

```bash
sudo iptables -t nat -L DOCKER -n | grep 8080
```

Two ideas fall out of this once you have seen it:

- **A container is not a small VM.** A VM boots a whole kernel on virtual hardware. A container shares the host kernel and is isolated only by namespaces and cgroups. That is why it starts in milliseconds.
- **The kernel is the real security boundary.** Because everything shares one kernel, a kernel vulnerability is a container-escape risk in a way it never is for a VM. That tradeoff, speed for a thinner boundary, is the whole deal you are signing when you choose containers.

## See the whole thing yourself

Reading about namespaces is fine. Watching them appear is better, and you do not want to experiment on your laptop. The clean way is a throwaway Linux box you can wreck and delete.

Spin up the smallest [DigitalOcean droplet](https://m.do.co/c/2a9bba940f39), install Docker, and run the sequence end to end:

```bash
# On a fresh Ubuntu droplet
curl -fsSL https://get.docker.com | sh

id=$(docker run -d -p 8080:80 nginx)
pid=$(docker inspect --format '{{.State.Pid}}' "$id")

sudo lsns -p "$pid"                       # the namespaces
sudo ls -l /proc/"$pid"/ns/               # the namespace file descriptors
sudo runc --root /run/containerd/runc/moby list   # runc's view
sudo nsenter -t "$pid" -n ip addr         # step into the container's network namespace
```

That last command drops you into the container's network stack from the host, without Docker involved at all. It is the clearest way to feel that "the container" is just a label for a process the kernel is keeping in a box. Destroy the droplet when you are done and you have paid for a few minutes of compute.

:::tip
Want it as an animation first? The [interactive simulator](https://devops-daily.com/games/docker-under-the-hood-simulator) steps down this exact stack, highlights the active layer, and shows the command at each stop. Great for building the mental model before you run the commands.
:::

## Summary

`docker run` is a relay race, not a sprint:

- The **CLI** turns your command into an API call and hands it to the daemon.
- **dockerd** prepares config and pulls the image's missing layers.
- **containerd** unpacks the image and builds an OCI bundle: `config.json` plus a `rootfs`.
- **runc** creates the namespaces and cgroup, enters the rootfs, execs your process, and exits.
- The **kernel** does the actual isolation, and your container is a normal host process the whole time.

Once you have run `lsns` against a real container PID, containers stop being a black box. They are a process, plus a few kernel features, described by a JSON file. Everything above that is just tooling that writes the file and presses go.
