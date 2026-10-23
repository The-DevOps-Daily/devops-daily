---
title: 'What Is Docker? Containers, Images and How Docker Works'
description: 'Learn what Docker is and how it works: containers vs virtual machines, images, layers and registries, and the path from docker run to containerd and runc.'
order: 1
---

**Docker** packages an application with everything it needs to run (the runtime, libraries, system tools and configuration) into an **image**, and runs that image as an isolated process called a **container**. The same image runs the same way on your laptop, in CI and on a production server, which removes the classic "it works on my machine" problem.

This part explains the ideas you need before you type any commands: what a container is, how it differs from a virtual machine, what happens inside Docker when you run `docker run`, and how images are built from layers and stored in registries.

## Prerequisites

- Basic comfort with a terminal.
- No Docker installation yet. You install it in [Part 2](/guides/introduction-to-docker/02-docker-installation).

## What Is a Container?

A container is a normal Linux process with a restricted view of the system. The Linux kernel provides two features that make this possible:

- **Namespaces** decide what the process can see: its own process list (PID namespace), its own network interfaces and ports (network namespace), its own filesystem tree (mount namespace) and its own hostname (UTS namespace). A user namespace, which maps root in the container to an unprivileged user on the host, is used only in rootless mode or when you turn on user namespace remapping.
- **Control groups (cgroups)** decide how much the process can use: CPU time, memory, disk I/O and the number of processes.

Docker sets up these namespaces and cgroups for you, gives the process a filesystem that comes from an image, and connects it to a network. Inside the container, the application thinks it has a machine to itself. On the host, it is one more process that you can see with `ps`.

Because a container is only a process, it starts in about the time the application itself needs to start. There is no guest kernel to boot or keep in memory, so a container usually needs far less memory than a virtual machine; the overhead is small, but not zero.

## Containers vs Virtual Machines

A virtual machine emulates hardware. Each VM boots its own operating system kernel on top of a hypervisor. A container shares the host's kernel and isolates only the processes.

```diagram
{
  "type": "infra",
  "groups": [
    {
      "label": "Virtual machines",
      "sub": "one guest kernel per VM",
      "icon": "server",
      "tone": "slate",
      "nodes": [
        { "label": "App A + guest OS", "sub": "own kernel", "icon": "cpu", "tone": "slate" },
        { "label": "App B + guest OS", "sub": "own kernel", "icon": "cpu", "tone": "slate" },
        { "label": "Hypervisor", "sub": "KVM, Hyper-V, ESXi", "icon": "gear", "tone": "amber" }
      ]
    },
    {
      "label": "Containers",
      "sub": "one shared host kernel",
      "icon": "server",
      "tone": "blue",
      "nodes": [
        { "label": "App A", "sub": "image filesystem", "icon": "box", "tone": "blue" },
        { "label": "App B", "sub": "image filesystem", "icon": "box", "tone": "blue" },
        { "label": "Docker Engine", "sub": "namespaces + cgroups", "icon": "gear", "tone": "accent" }
      ]
    }
  ]
}
```

|                 | Virtual machine                     | Container                                |
| --------------- | ----------------------------------- | ---------------------------------------- |
| Kernel          | Its own guest kernel                | Shares the host kernel                   |
| Start time      | Seconds to minutes (boots an OS)    | About as long as the application takes   |
| Size on disk    | Gigabytes (a full OS image)         | Megabytes to a few hundred megabytes     |
| Isolation       | Strong: a hardware boundary         | Process-level: a kernel bug can break it |
| Runs other OSes | Yes, Windows on Linux and so on     | No: Linux containers need a Linux kernel |
| Typical use     | Separate tenants, different kernels | Packaging and running applications       |

The two are not rivals. Most containers in production run inside VMs: a cloud server is a VM, and Docker runs on it. Docker Desktop on macOS and Windows also starts a small Linux VM in the background, because Linux containers need a Linux kernel.

The shared kernel is also the main security trade-off. A process that escapes its namespaces lands on the host. That is why later parts of this guide run containers as non-root users and drop privileges they do not need ([Part 9](/guides/introduction-to-docker/09-docker-best-practices)).

## How Docker Works

Docker is a set of programs that talk to each other. When you type `docker run`, the command passes through four of them:

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "cli", "label": "docker CLI", "sub": "docker run ...", "icon": "gear", "tone": "slate", "detail": "The client. It turns your command into REST API calls. Compose and Buildx are plugins of the CLI." }
    ],
    [
      { "id": "dockerd", "label": "dockerd", "sub": "Docker Engine API", "icon": "server", "tone": "accent", "detail": "The daemon. It manages images, containers, networks and volumes, and runs BuildKit for image builds." }
    ],
    [
      { "id": "containerd", "label": "containerd", "sub": "images + lifecycle", "icon": "box", "tone": "blue", "detail": "Pulls and stores images, unpacks layers into snapshots and supervises containers. On fresh installs of Docker Engine 29, it also stores the images." },
      { "id": "registry", "label": "Registry", "sub": "Docker Hub, GHCR, ECR", "icon": "cloud", "tone": "violet", "detail": "Stores images. dockerd pulls from it when the image is not on your machine." }
    ],
    [
      { "id": "runc", "label": "runc", "sub": "OCI runtime", "icon": "cpu", "tone": "green", "detail": "Creates the namespaces and cgroups, then starts your process as PID 1 of the container and exits." }
    ],
    [
      { "id": "proc", "label": "Your process", "sub": "PID 1 in the container", "icon": "rocket", "tone": "green" }
    ]
  ],
  "edges": [["cli", "dockerd", "API"], ["dockerd", "containerd", "gRPC"], ["dockerd", "registry", "pull"], ["containerd", "runc"], ["runc", "proc", "start"]]
}
```

1. **The Docker CLI** (`docker`) is the client. It sends REST API calls to the daemon, by default over the Unix socket `/var/run/docker.sock`. Docker Compose (`docker compose`) and Buildx (`docker buildx`) are plugins of the CLI.
2. **The Docker daemon** (`dockerd`) is Docker Engine. It owns your images, containers, networks and volumes, and it runs **BuildKit**, the engine that builds images.
3. **containerd** pulls images, unpacks their layers and supervises running containers. It is a separate project that Kubernetes also uses directly.
4. **runc** is a small tool that creates the namespaces and cgroups and starts your process. It follows the **OCI runtime specification**.

Images and runtimes follow the standards of the **Open Container Initiative (OCI)**. An image you build with Docker runs on Kubernetes, Podman or a cloud container service without changes, because none of them depend on Docker itself.

When you run `docker run nginx:1.30`, the CLI asks dockerd to create a container. If the image is not on your machine, dockerd pulls it from the registry first. containerd prepares the filesystem from the image layers, and runc starts the nginx process inside new namespaces. The process writes its logs to stdout, and dockerd stores them so `docker logs` can show them.

## Images, Layers and Registries

An **image** is a read-only template for containers. It has three parts:

- **Layers**: compressed archives of files. Each layer adds, changes or deletes files compared to the layers below it. A container sees all layers merged into one filesystem, plus a thin writable layer on top that disappears when you remove the container.
- **A config**: the default command, environment variables, working directory, user and exposed ports.
- **A manifest**: the list of layers and the config, each identified by its SHA-256 **digest**.

Layers are shared. If ten images use the same base image, your machine stores its layers once, and pulls download only the layers you do not have yet.

Most popular images are **multi-platform**: one name points to an **index** with a separate image per CPU architecture, and Docker picks the one that matches your machine. You can see this without running anything, because Docker reads the index straight from the registry. This is a real run against Docker Hub:

```terminal
{
  "title": "one image name, many platforms (real run)",
  "prompt": "$",
  "steps": [
    {
      "comment": "read the image index from Docker Hub; no daemon needed",
      "cmd": "docker buildx imagetools inspect nginx:1.30-alpine | grep -E '^(Name|MediaType|Digest):|Platform:'",
      "output": "Name:      docker.io/library/nginx:1.30-alpine\nMediaType: application/vnd.oci.image.index.v1+json\nDigest:    sha256:47928bf67eb62a1863cb08d9ecb52d3e704304ba614eaee17884204677702951\n  Platform:    linux/amd64\n  Platform:    unknown/unknown\n  Platform:    linux/arm/v6\n  Platform:    unknown/unknown\n  Platform:    linux/arm/v7\n  Platform:    unknown/unknown\n  Platform:    linux/arm64/v8\n  Platform:    unknown/unknown\n  Platform:    linux/386\n  Platform:    unknown/unknown\n  Platform:    linux/ppc64le\n  Platform:    unknown/unknown\n  Platform:    linux/riscv64\n  Platform:    unknown/unknown\n  Platform:    linux/s390x\n  Platform:    unknown/unknown"
    }
  ]
}
```

The `linux/...` entries are the images for each architecture. The `unknown/unknown` entries are **attestations**: a software bill of materials (SBOM) and build provenance attached to each image, which security scanners read ([Part 9](/guides/introduction-to-docker/09-docker-best-practices)).

The config of the `linux/amd64` image shows what a container from it runs by default. This real run uses `crane`, a small registry client from Google's go-containerregistry project, which reads one platform's config without downloading any layers (install it with `brew install crane`, `go install github.com/google/go-containerregistry/cmd/crane@latest` or a release binary):

```terminal
{
  "title": "the image config (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "crane config --platform linux/amd64 nginx:1.30-alpine | jq '.config | {Entrypoint, Cmd, ExposedPorts, StopSignal, Env}'",
      "output": "{\n  \"Entrypoint\": [\n    \"/docker-entrypoint.sh\"\n  ],\n  \"Cmd\": [\n    \"nginx\",\n    \"-g\",\n    \"daemon off;\"\n  ],\n  \"ExposedPorts\": {\n    \"80/tcp\": {}\n  },\n  \"StopSignal\": \"SIGQUIT\",\n  \"Env\": [\n    \"PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\",\n    \"NGINX_VERSION=1.30.6\",\n    \"PKG_RELEASE=1\",\n    \"DYNPKG_RELEASE=1\",\n    \"NJS_VERSION=1.0.2\",\n    \"NJS_RELEASE=1\",\n    \"ACME_VERSION=0.4.1\"\n  ]\n}"
    }
  ]
}
```

A **registry** stores and serves images. **Docker Hub** is the default: when you type `nginx:1.30-alpine`, Docker reads it as `docker.io/library/nginx:1.30-alpine`. Other common registries are GitHub Container Registry (`ghcr.io`), Amazon ECR, Google Artifact Registry and Azure Container Registry. You can also run your own, for example with Harbor. [Part 3](/guides/introduction-to-docker/03-working-with-docker-images) covers names, tags and digests in detail.

## The Docker Objects You Use Every Day

| Object              | What it is                                                               | Covered in                                                                |
| ------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| **Image**           | Read-only template: layers plus a config                                 | [Part 3](/guides/introduction-to-docker/03-working-with-docker-images)    |
| **Container**       | A running (or stopped) instance of an image, with its own writable layer | [Part 4](/guides/introduction-to-docker/04-creating-your-first-container) |
| **Dockerfile**      | The recipe that builds an image                                          | [Part 5](/guides/introduction-to-docker/05-building-custom-docker-images) |
| **Volume**          | Storage that lives outside the container and survives its removal        | [Part 6](/guides/introduction-to-docker/06-working-with-docker-volumes)   |
| **Network**         | A virtual network that containers join to reach each other by name       | [Part 7](/guides/introduction-to-docker/07-networking-in-docker)          |
| **Compose project** | Several containers, networks and volumes defined in one `compose.yaml`   | [Part 8](/guides/introduction-to-docker/08-docker-compose)                |

## Docker Engine, Docker Desktop and the Alternatives

- **Docker Engine** is the open source daemon and CLI for Linux. It is free to use anywhere, including in companies of any size.
- **Docker Desktop** is an application for macOS, Windows and Linux that bundles Docker Engine in a VM with a GUI, Compose, Buildx, Kubernetes and other tools. It is free for personal use, education, non-commercial open source projects and companies with fewer than 250 employees **and** less than $10 million in annual revenue. Larger companies need a paid subscription.
- **Alternatives**: Podman runs containers without a central daemon and can run rootless by default; containerd with `nerdctl` gives a Docker-like CLI on top of containerd; Colima, OrbStack and Rancher Desktop are other ways to run containers on a Mac. They all run the same OCI images. See [Podman vs Docker](/comparisons/podman-vs-docker) for a side-by-side comparison.

## Common Misconceptions

- **"A container is a lightweight VM."** It is a process. There is no guest kernel and no boot. If the main process exits, the container stops.
- **"Data in a container is safe."** Files written to the container's writable layer are deleted with the container. Use volumes for anything you want to keep ([Part 6](/guides/introduction-to-docker/06-working-with-docker-volumes)).
- **"`latest` means newest."** `latest` is only a tag name that the publisher chooses to move. It can be old, and it changes without warning. Use explicit versions ([Part 3](/guides/introduction-to-docker/03-working-with-docker-images)).
- **"Containers are secure by default."** They are isolated, but a container that runs as root with extra privileges can harm the host. Isolation is something you configure ([Part 9](/guides/introduction-to-docker/09-docker-best-practices)).

## Summary

- A container is an isolated Linux process: namespaces limit what it sees, cgroups limit what it uses.
- Containers share the host kernel, so they start fast and are small, but they isolate less than VMs.
- The `docker` CLI talks to `dockerd`, which uses containerd and runc to run containers and BuildKit to build images.
- An image is layers plus a config, addressed by digests. Multi-platform images hold one image per CPU architecture.

Next, [install Docker](/guides/introduction-to-docker/02-docker-installation) on Linux, macOS or Windows.

## Keep Learning

- [How Docker Really Works, From docker run to the Kernel](/posts/how-docker-works-under-the-hood)
- [How Docker Differs from a Virtual Machine](/posts/how-docker-differs-from-a-virtual-machine)
- [Docker Image vs Container: Key Differences](/posts/docker-image-vs-container)
- Simulator: [Docker under the hood](/games/docker-under-the-hood-simulator)
- Interview question: [Docker container basics](/interview-questions/junior/docker-basics)
- Flashcards: [Docker Essentials](/flashcards/docker-essentials)
