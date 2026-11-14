---
title: 'How Docker Really Works, From docker run to the Kernel'
excerpt: 'You type docker run and a container appears. Follow the CLI, dockerd, containerd and runc down to the kernel, with the commands to watch each step. Then get clear answers on image vs container, docker run vs start, containers vs VMs, the performance cost, and when Compose is enough.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2026-07-14'
publishedAt: '2026-07-14T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '19 min read'
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
  - Kubernetes
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
- An image is the read-only template. A container is one instance of it, with its own writable layer. `docker run` creates and starts a new container, and `docker start` starts an existing one again.
- Because the container shares the host kernel, it is not a small VM: CPU and memory run at close to native speed, and the isolation is thinner than a VM's.

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

The `docker` binary does not create containers. It turns your command into an HTTP request and sends it to the Docker daemon over a local Unix socket at `/var/run/docker.sock`. If nothing listens on that socket, the CLI prints ["Cannot connect to the Docker daemon"](/posts/cannot-connect-to-docker-daemon). You can make the exact same call by hand:

```bash
# What `docker` does under the hood: talk to the daemon over its socket
curl --unix-socket /var/run/docker.sock http://localhost/v1.45/info | jq .ServerVersion
```

That is the whole job of the CLI: serialize your intent and POST it. Everything real happens on the other side of that socket.

## Step 2: dockerd prepares the work and pulls the image

`dockerd` is the long-running engine. It receives the request, parses your flags (the [`-p 8080:80` port map](/posts/forward-host-port-to-docker-container), env vars, mounts), and checks whether the `nginx` image is already on disk:

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

1. **`config.json`**: the OCI runtime spec. It says which process to run, which namespaces and cgroups to create, which mounts to set up, which capabilities to keep.
2. **`rootfs`**: the container's root filesystem. It is the image's read-only layers plus a fresh writable layer on top, unioned together.

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

## Docker Image vs Container: What Is the Difference?

An **image** is a read-only template: a stack of layers plus a config that names the command, environment and ports. A **container** is one instance of an image: the image layers, a thin writable layer on top, a name, the settings of this run, and (while it runs) a process. You can start many containers from one image, and each one has its own writable layer.

| Question            | Image                           | Container                                        |
| ------------------- | ------------------------------- | ------------------------------------------------ |
| What is it?         | Layers plus config, read-only   | Image layers plus a writable layer and a process |
| How do you make it? | `docker build`, `docker pull`   | `docker run`, `docker create`                    |
| How do you list it? | `docker image ls`               | `docker ps -a`                                   |
| Can it change?      | No. A rebuild makes a new image | Yes, until you remove it                         |
| How do you share?   | `docker push` to a registry     | You do not. Share the image instead              |

Two containers from the same image share the image layers on disk. Only their writable layers differ:

```bash
docker run -d --name web1 nginx:1.30
docker run -d --name web2 nginx:1.30
docker exec web1 sh -c 'echo changed > /usr/share/nginx/html/index.html'
docker ps -s --format 'table {{.Names}}\t{{.Image}}\t{{.Size}}'   # SIZE is the writable layer
docker history nginx:1.30                                         # the image layers
```

This explains three common surprises:

- **"I removed the container, but the image is still there."** `docker rm` deletes the container and its writable layer, never the image. [Remove images](/posts/docker-list-containers#h2-how-do-i-remove-docker-images) is a separate step.
- **"I cannot remove this image."** A container, even a stopped one, still uses it. Remove the container first.
- **"My changes disappeared."** Files that the app wrote into the writable layer go away with the container. Put data that must stay in a [volume](/posts/docker-data-loss-when-container-exits).

## Dockerfile vs Compose File: Which Does What?

The same split explains the two files you see in most projects. A **Dockerfile** describes how to build one image. A **Compose file** (`compose.yaml`) describes how to run containers: which images, which ports, volumes, environment variables and networks, and in what order they start. Compose can also build images, by pointing a service at a directory with a Dockerfile:

```yaml
# compose.yaml
services:
  migrate:
    image: alpine:3.22
    command: sh -c "echo applying migrations && sleep 2 && echo migrations done"
  app:
    build: ./app # build the image from ./app/Dockerfile
    image: batch1-app:1.0 # and tag it with this name
    depends_on:
      migrate:
        condition: service_completed_successfully
    ports:
      - '127.0.0.1:8000:8000'
```

`docker compose build` builds the image from the Dockerfile, and `docker compose up -d` runs both containers (we named the project `batch1` with `-p`). The `migrate` container runs once and exits, and `app` starts only after it exits with code 0:

```terminal
{
  "title": "one Compose file, two containers (last lines of up)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker compose -p batch1 up -d",
      "output": " Container batch1-migrate-1  Started\n Container batch1-migrate-1  Exited\n Container batch1-app-1  Starting\n Container batch1-app-1  Started"
    },
    {
      "cmd": "docker compose -p batch1 ps -a --format 'table {{.Service}}\\t{{.Status}}'",
      "output": "SERVICE   STATUS\napp       Up Less than a second\nmigrate   Exited (0) Less than a second ago"
    }
  ]
}
```

| Question               | Dockerfile                  | Compose file                                |
| ---------------------- | --------------------------- | ------------------------------------------- |
| What does it describe? | One image                   | Containers, networks and volumes for an app |
| When does it act?      | At build time               | At run time (and build time with `build:`)  |
| Command                | `docker build`              | `docker compose up`                         |
| Where does it run?     | Anywhere that builds images | One Docker host                             |

You do not need a Compose file for a single container, and you do not need a Dockerfile if every service uses a ready-made image. Leave out the top-level `version:` key that older Compose files start with. Compose ignores it and prints a warning that the attribute `version` is obsolete.

## What Is the Difference Between docker run and docker start?

`docker run` makes a **new** container from an image and starts it. If the image is not on the host, it pulls it first. `docker start` starts an **existing**, stopped container with the settings it was created with.

```bash
docker run -d --name web -p 8080:80 nginx:1.30   # pull if needed, create, start
docker stop web                                  # the container and its files stay
docker start web                                 # same container, same port, same files
docker restart web                               # stop, then start
```

`docker run` is `docker create` plus `docker start` in one command. The options of a container, such as ports, volumes and environment variables, are fixed when it is created. `docker start` cannot change them, and it has no option to run a different command. To change a setting, remove the container and run a new one (see [add a port to an existing container](/posts/forward-host-port-to-docker-container#h2-how-do-i-add-a-port-to-a-running-container)). To run another command in a stopped container, see [start a stopped container with a different command](/posts/how-to-access-docker-container-shell#h2-how-do-i-start-a-stopped-container-with-a-different-command).

The `docker run` options you use most:

| Option                     | What it does                                             |
| -------------------------- | -------------------------------------------------------- |
| `-d`                       | Run in the background and print the container ID         |
| `-it`                      | Interactive, with a terminal, for shells                 |
| `--name web`               | A fixed name instead of a random one like `eager_turing` |
| `-p 8080:80`               | Publish container port 80 on host port 8080              |
| `-e KEY=value`             | Set an environment variable                              |
| `-v data:/path`            | Mount a volume or a host directory                       |
| `--rm`                     | Remove the container when it exits                       |
| `--restart unless-stopped` | Start it again after a crash or a reboot                 |

If you run `docker run --name web` a second time, the name is already taken and Docker refuses. [Name already in use](/posts/docker-list-containers#h2-how-do-i-fix-the-container-name-is-already-in-use-error) shows the fix.

## How Is a Container Different From a Virtual Machine?

A virtual machine boots its own kernel on virtual hardware, with a hypervisor such as KVM, Hyper-V or VirtualBox below it. A container is a process on the host's kernel, isolated with namespaces and cgroups, as the steps above show. There is no guest operating system in a container, only the files of one.

```text
Virtual machine                     Container
[ App + libraries ]                 [ App + libraries ]
[ Guest OS + kernel ]               [ namespaces + cgroups ]
[ Hypervisor ]                      [ Host kernel ]
[ Hardware ]                        [ Hardware ]
```

| Feature           | Virtual machine                       | Container                                  |
| ----------------- | ------------------------------------- | ------------------------------------------ |
| Kernel            | Its own                               | Shared with the host                       |
| Start time        | Seconds to minutes (a full OS boots)  | Milliseconds to seconds (a process starts) |
| Overhead          | A whole OS per VM, in memory and disk | The app and its libraries                  |
| Other OS kernels  | Yes: Windows, BSD, any Linux kernel   | Linux containers need a Linux kernel       |
| Security boundary | Strong: hardware virtualization       | Thinner: one kernel bug can affect all     |

The two often work together. Docker Desktop on macOS and Windows runs a small Linux VM, and your containers run inside it. In the cloud, most containers run on VMs. Sandboxed runtimes such as gVisor and Kata Containers add a VM-like boundary around a container when the shared kernel is too much risk, for example for code you do not trust.

### Vagrant or Docker for an Isolated Dev Environment?

**Vagrant** is the usual way to script VMs on a laptop. A `Vagrantfile` names a base box and the steps that set it up, and `vagrant up` creates the VM with a provider such as VirtualBox, libvirt, VMware or Hyper-V:

```ruby
# Vagrantfile
Vagrant.configure("2") do |config|
  config.vm.box = "bento/ubuntu-24.04"
  config.vm.network "forwarded_port", guest: 80, host: 8080
  config.vm.provision "shell", inline: <<-SHELL
    apt-get update
    apt-get install -y nginx
  SHELL
end
```

The choice follows the rule above:

- **Pick Docker** when the environment is your app and its services: a runtime, a database, a cache. Containers start in seconds, a Compose file describes the whole stack, and CI runs the same images.
- **Pick Vagrant** when you need a whole machine: a different kernel or OS (a Windows or BSD guest), systemd services and kernel modules, or a server you configure with Ansible the same way as production.
- **Use both** when you want a Linux VM that runs Docker inside, for example to test a provisioning script that installs Docker on a fresh server.

Vagrant is a HashiCorp tool under the Business Source License since 2023. For local use that changes nothing, but check it if you build a product on top of it.

## What Is the Runtime Performance Cost of a Docker Container?

For CPU and memory, close to zero. The process runs on the host kernel and the CPU executes it directly: there is no emulation and no second kernel. Namespaces cost nothing measurable at run time, and cgroups only count usage until you set a limit. IBM researchers measured this in 2014 (Felter et al., "An Updated Performance Comparison of Virtual Machines and Linux Containers") and found containers at or near native speed for CPU and memory. The costs are in the input and output paths:

- **Writes to the container filesystem.** The writable layer uses overlayfs copy-on-write: the first write to a file from the image copies the whole file up. Put databases and other write-heavy paths on a volume, which bypasses overlayfs.
- **Published ports.** Traffic to `-p 8080:80` goes through NAT rules and, for some paths, the `docker-proxy` process. On Linux, `--network host` removes that step when latency matters, at the cost of network isolation.
- **Docker Desktop.** On macOS and Windows the containers run in a Linux VM, and bind mounts of host folders go through a file-sharing layer. Large bind-mounted folders, such as `node_modules`, are often the slowest part. Named volumes stay inside the VM and are faster.
- **Limits you set.** `--cpus` and `--memory` throttle or kill a process on purpose. `docker stats` shows the live usage against the limit.

Measure your own workload instead of trusting a general number. Run the same benchmark on the host and in a container:

```bash
# On the host (install sysbench with your package manager first)
sysbench cpu --cpu-max-prime=20000 run

# In a container: the debian image does not include sysbench, so install it first
docker run --rm debian:13 sh -c \
  'apt-get update -qq && apt-get install -y -qq sysbench >/dev/null && sysbench cpu --cpu-max-prime=20000 run'
```

Compare the "events per second" lines. For disk, compare a write to a volume with a write to the container layer:

```bash
docker run --rm -v bench:/data debian:13 dd if=/dev/zero of=/data/test bs=1M count=1024 conv=fdatasync
docker run --rm debian:13 dd if=/dev/zero of=/test bs=1M count=1024 conv=fdatasync
docker volume rm bench
```

## Do You Need Kubernetes, or Is Docker Compose Enough?

For one server, Docker Compose is usually enough. You need Kubernetes when you run containers across several servers and want the platform to place them, replace them when a node fails, and roll out new versions without downtime.

The runtime is the same in both. On a Kubernetes node, the kubelet talks to containerd through the Container Runtime Interface, and containerd starts containers with runc, exactly as in [Step 3](#h2-step-3-dockerd-hands-off-to-containerd) above. Only `dockerd` is missing: Kubernetes removed its Docker integration (dockershim) in version 1.24. Images that you build with Docker run on Kubernetes without changes.

| Question                    | Docker Compose                       | Kubernetes                                        |
| --------------------------- | ------------------------------------ | ------------------------------------------------- |
| How many hosts?             | One                                  | A cluster of nodes                                |
| What happens if a host dies | Everything on it stops               | Pods are scheduled again on healthy nodes         |
| Scale a service             | `docker compose up -d --scale web=3` | `kubectl scale deployment web --replicas=3`       |
| Update without downtime     | Not built in                         | Rolling updates in a Deployment                   |
| Config                      | One `compose.yaml`                   | Many objects: Deployment, Service, ConfigMap, ... |
| Learning cost               | An afternoon                         | Weeks, plus a cluster to run                      |

Pick Kubernetes when you have these problems:

- Your services must run on more than one server, and survive the loss of one.
- You deploy often and need rolling updates, with `kubectl rollout undo` to go back (automatic rollback needs extra tooling such as Argo Rollouts or Flagger).
- Load changes a lot and you want autoscaling.
- Several teams share the same platform.

For a side project, a small company app or a single VM, Compose is simpler and cheaper to operate. [When Kubernetes is the wrong default](/posts/when-kubernetes-is-wrong-default) makes that case in detail, and the [Docker Swarm vs Kubernetes comparison](/comparisons/docker-swarm-vs-kubernetes) covers the middle ground. To try `kubectl` without a cluster, use the [Kubernetes terminal simulator](/games/kubernetes-terminal-simulator).

## Summary

`docker run` is a relay race, not a sprint:

- The **CLI** turns your command into an API call and hands it to the daemon.
- **dockerd** prepares config and pulls the image's missing layers.
- **containerd** unpacks the image and builds an OCI bundle: `config.json` plus a `rootfs`.
- **runc** creates the namespaces and cgroup, enters the rootfs, execs your process, and exits.
- The **kernel** does the actual isolation, and your container is a normal host process the whole time.

Once you have run `lsns` against a real container PID, containers stop being a black box. They are a process, plus a few kernel features, described by a JSON file. Everything above that is just tooling that writes the file and presses go.

## Related Resources

- [How Docker Works Under the Hood simulator](/games/docker-under-the-hood-simulator): the same path, one layer at a time
- [Container escape simulator](/games/docker-escape): which `docker run` flags break the isolation shown above
- [List and remove containers and images](/posts/docker-list-containers): clean up what `docker run` leaves behind
- [Introduction to Docker: Docker Basics](/guides/introduction-to-docker/01-docker-basics): containers, images and registries from the start
- [Introduction to Kubernetes](/guides/introduction-to-kubernetes): the next step after Compose
- [Docker quiz](/quizzes/docker-quiz): test the concepts
