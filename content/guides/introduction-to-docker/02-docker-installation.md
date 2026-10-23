---
title: 'How to Install Docker on Ubuntu, Debian, Fedora, macOS and Windows'
description: 'Install Docker Engine 29 on Ubuntu, Debian, Fedora or RHEL from the official repository, or Docker Desktop on macOS and Windows, then test and fix errors.'
order: 2
---

**TLDR**: On Linux, add Docker's apt or dnf repository and install `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin` and `docker-compose-plugin`. On macOS and Windows, install Docker Desktop. Then run `docker version` and `docker run hello-world`. Add your user to the `docker` group only if you accept that it gives root access to the host, or use rootless mode.

This part installs Docker on your platform, explains the difference between Docker's packages and the ones your Linux distribution ships, and fixes the errors that most people hit on day one.

## Prerequisites

- A 64-bit Linux, macOS or Windows machine where you can run `sudo` or an administrator shell.
- About 2 GB of free disk space for Docker and a few images.
- [Part 1](/guides/introduction-to-docker/01-docker-basics) explains the terms used here: daemon, CLI, image and container.

## Docker Engine or Docker Desktop?

|              | Docker Engine                                   | Docker Desktop                                                                                                                                           |
| ------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platforms    | Linux                                           | macOS, Windows, Linux                                                                                                                                    |
| What you get | `dockerd`, the CLI, containerd, Buildx, Compose | Engine in a VM, plus a GUI, Kubernetes, Scout and other extras                                                                                           |
| License      | Open source (Apache 2.0), free everywhere       | Free for personal use, education, non-commercial open source and companies under 250 employees **and** under $10M revenue; otherwise a paid subscription |
| Best for     | Servers, CI runners, Linux workstations         | Laptops and desktops, especially macOS and Windows                                                                                                       |

On a Linux server, install Docker Engine. On macOS and Windows, Docker Desktop is the official option. Colima, OrbStack, Rancher Desktop and Podman Desktop are alternatives that run the same images.

## Which Version to Install

This guide uses **Docker Engine 29.9.2** (released 20 October 2026), **Docker Compose v5.6.1**, **Buildx 0.38.1** and **Docker Desktop 4.96.3**. Docker ships a new minor release of Engine about every month, and only the newest release line gets fixes, so install from Docker's repository and keep it updated.

Engine 29 changed a few defaults that older tutorials do not mention:

- Fresh installs store images in **containerd's image store**, so `docker image ls` shows a different layout ([Part 3](/guides/introduction-to-docker/03-working-with-docker-images)).
- **Docker Content Trust** (`DOCKER_CONTENT_TRUST=1`) is no longer part of the CLI ([Part 9](/guides/introduction-to-docker/09-docker-best-practices)).
- **cgroup v1 is deprecated** (support continues until at least May 2029). Current Ubuntu, Debian, Fedora and RHEL 9 and 10 boot with cgroup v2; RHEL 8 still defaults to v1. `docker info --format '{{.CgroupVersion}}'` shows which one Docker uses.
- Docker no longer publishes 32-bit Raspbian packages. On a Raspberry Pi, install a 64-bit OS and use the Debian `arm64` packages.

## Install Docker Engine on Linux

Docker's repository always has the current release. First remove packages that conflict with it (they are harmless to remove if they are not installed), then add the repository and install. Pick your distribution:

```tabs
{
  "title": "Install Docker Engine 29",
  "tabs": [
    {
      "label": "Ubuntu",
      "lang": "bash",
      "code": "# Supported: Ubuntu 26.10, 26.04 LTS, 24.04 LTS and 22.04 LTS (64-bit)\n# 1. Remove unofficial packages that conflict with Docker's\nsudo apt remove $(dpkg --get-selections docker.io docker-compose docker-compose-v2 \\\n  docker-doc docker-buildx podman-docker containerd runc | cut -f1)\n\n# 2. Add Docker's signing key to its own keyring file\nsudo apt update\nsudo apt install ca-certificates curl\nsudo install -m 0755 -d /etc/apt/keyrings\nsudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc\nsudo chmod a+r /etc/apt/keyrings/docker.asc\n\n# 3. Add the repository, trusted only for this key (deb822 format)\nsudo tee /etc/apt/sources.list.d/docker.sources <<EOF\nTypes: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: $(. /etc/os-release && echo \"${UBUNTU_CODENAME:-$VERSION_CODENAME}\")\nComponents: stable\nArchitectures: $(dpkg --print-architecture)\nSigned-By: /etc/apt/keyrings/docker.asc\nEOF\n\n# 4. Install Docker Engine, the CLI, containerd, Buildx and Compose\nsudo apt update\nsudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"
    },
    {
      "label": "Debian",
      "lang": "bash",
      "code": "# Supported: Debian 13 (trixie) and Debian 12 (bookworm)\nsudo apt remove $(dpkg --get-selections docker.io docker-compose docker-doc \\\n  podman-docker containerd runc | cut -f1)\n\nsudo apt update\nsudo apt install ca-certificates curl\nsudo install -m 0755 -d /etc/apt/keyrings\nsudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc\nsudo chmod a+r /etc/apt/keyrings/docker.asc\n\nsudo tee /etc/apt/sources.list.d/docker.sources <<EOF\nTypes: deb\nURIs: https://download.docker.com/linux/debian\nSuites: $(. /etc/os-release && echo \"$VERSION_CODENAME\")\nComponents: stable\nArchitectures: $(dpkg --print-architecture)\nSigned-By: /etc/apt/keyrings/docker.asc\nEOF\n\nsudo apt update\nsudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"
    },
    {
      "label": "Fedora",
      "lang": "bash",
      "code": "# Supported: Fedora 45, 44 and 43\n# Remove old or unofficial Docker packages first\nsudo dnf remove docker docker-client docker-client-latest docker-common docker-latest \\\n  docker-latest-logrotate docker-logrotate docker-selinux docker-engine-selinux docker-engine\n\nsudo dnf config-manager addrepo --from-repofile https://download.docker.com/linux/fedora/docker-ce.repo\nsudo dnf install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin\n# If dnf asks you to accept the GPG key, check that the fingerprint is\n# 060A 61C5 1B55 8A7F 742B 77AA C52F EB6B 621E 9F35\n\nsudo systemctl enable --now docker"
    },
    {
      "label": "RHEL",
      "lang": "bash",
      "code": "# Supported: RHEL 8, 9 and 10\nsudo dnf remove docker docker-client docker-client-latest docker-common docker-latest \\\n  docker-latest-logrotate docker-logrotate docker-engine podman runc\nsudo dnf -y install dnf-plugins-core\nsudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo\nsudo dnf install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin\n# Check the GPG fingerprint if asked: 060A 61C5 1B55 8A7F 742B 77AA C52F EB6B 621E 9F35\n\nsudo systemctl enable --now docker"
    }
  ]
}
```

On Ubuntu and Debian, the service starts automatically after the install. On Fedora and RHEL, `systemctl enable --now docker` starts it now and at every boot.

**Why a separate keyring file?** The `Signed-By` line tells apt to trust Docker's key for Docker's repository only. Older tutorials use `apt-key add`, which trusted a key for every repository on the system. `apt-key` is deprecated, and Debian 13 and Ubuntu 25.04 and later no longer ship it. Docker's instructions now also write the repository in the newer deb822 format (`docker.sources`) instead of a one-line `docker.list`. Both formats work.

### Docker's Packages vs Your Distribution's Packages

Ubuntu and Debian also ship Docker in their own repositories, as `docker.io`. These packages are built by the distribution, so their versions lag behind Docker's own release:

| Package source                       | Docker Engine | Compose                      | Checked         |
| ------------------------------------ | ------------- | ---------------------------- | --------------- |
| Docker's repository (`docker-ce`)    | 29.9.2        | v5.6.1                       | 23 October 2026 |
| Ubuntu 26.04 and 24.04 (`docker.io`) | 29.1.3        | 2.40.3 (`docker-compose-v2`) | 23 October 2026 |
| Debian 13 trixie (`docker.io`)       | 26.1.5        | packaged separately          | 23 October 2026 |
| Debian 12 bookworm (`docker.io`)     | 20.10.24      | packaged separately          | 23 October 2026 |

Use one source, not both: the packages conflict, which is why step 1 removes the distribution's packages. Pick Docker's repository unless your company only allows packages from the distribution, and check what version you actually got with `docker version`.

### The Convenience Script

Docker also publishes a script at `https://get.docker.com` that detects your distribution and installs everything in one command. It is handy for a throwaway test VM, but it installs the latest version unless you pass `--version`, runs as root, and gives you no chance to review what it changes. Read it before you run it, and do not use it to build production servers.

:::warning
**Docker and your firewall.** When you publish a port with `-p 8080:80`, Docker adds its own iptables rules, and those rules are evaluated before the rules that `ufw` or `firewalld` manage. A port you publish is reachable from the network even if your firewall says it is closed. Publish ports on `127.0.0.1` when only the host needs them, as shown in [Part 7](/guides/introduction-to-docker/07-networking-in-docker).
:::

## Install Docker Desktop on macOS

Docker Desktop supports the current macOS release and the two before it, on Apple silicon and Intel Macs, with at least 4 GB of RAM.

1. Download `Docker.dmg` for your chip from the [Docker Desktop page](https://docs.docker.com/desktop/setup/install/mac-install/), or install it with Homebrew: `brew install --cask docker-desktop`.
2. Open the image and drag **Docker** to **Applications**.
3. Start Docker from Applications and accept the subscription terms.

The `docker` command works in your terminal as soon as the whale icon in the menu bar says Docker is running. Docker Desktop runs a small Linux VM, so containers use the memory and CPUs you give that VM in **Settings > Resources**.

## Install Docker Desktop on Windows

Docker Desktop needs 64-bit Windows 11 (23H2 or later) or Windows 10 22H2, and WSL 2.1.5 or later for the recommended WSL 2 backend.

1. Install or update WSL from an administrator PowerShell: `wsl --install`, or `wsl --update` if you already have it. Restart if asked.
2. Install Docker Desktop with `winget install -e --id Docker.DockerDesktop`, or download the installer from the [Docker Desktop page](https://docs.docker.com/desktop/setup/install/windows-install/).
3. Start Docker Desktop and keep **Use the WSL 2 based engine** turned on.

You can then use `docker` from PowerShell, Command Prompt or any WSL distribution where you enable **WSL integration** in **Settings > Resources**. Keep project files inside the WSL filesystem (for example `~/projects` in Ubuntu on WSL) rather than under `C:\`: bind mounts from the Windows drive are much slower.

## Verify the Installation

On Linux, the daemon listens on `/var/run/docker.sock`, which only root and members of the `docker` group can open. Use `sudo` for these first checks, or see the next section. Start with the versions of the client tools. This output comes from the Docker 29.9.2 static binaries with the Compose and Buildx plugins:

```terminal
{
  "title": "client versions (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker --version",
      "output": "Docker version 29.9.2, build a82e528"
    },
    {
      "cmd": "docker compose version",
      "output": "Docker Compose version v5.6.1"
    },
    {
      "cmd": "docker buildx version",
      "output": "github.com/docker/buildx v0.38.1 0dbe87f36ed472fe36b6796c3f70b4210a731fc5"
    }
  ]
}
```

`docker version` shows the client and the server (the daemon). If both halves print, the CLI can reach the daemon. The output below is an example for an x86_64 Linux host. Its version numbers and commits come from the Docker 29.9.2 release bundle; the containerd and runc lines depend on the `containerd.io` package you installed:

```text
Client: Docker Engine - Community
 Version:           29.9.2
 API version:       1.56
 Go version:        go1.26.10
 Git commit:        a82e528
 Built:             Tue Oct 20 18:43:37 2026
 OS/Arch:           linux/amd64
 Context:           default

Server: Docker Engine - Community
 Engine:
  Version:          29.9.2
  API version:      1.56 (minimum version 1.44)
  Go version:       go1.26.10
  Git commit:       0367cbe
  Built:            Tue Oct 20 18:43:37 2026
  OS/Arch:          linux/amd64
  Experimental:     false
 containerd:
  Version:          v2.4.2
  GitCommit:        b7a25261e029d68978bbf290df0a62fc819b3c51
 runc:
  Version:          1.5.2
  GitCommit:        v1.5.2-0-g29dd3dc
 docker-init:
  Version:          0.19.0
  GitCommit:        de40ad0
```

Now run a container end to end. `hello-world` pulls a tiny image from Docker Hub, runs it and prints a message. Example output; the layer ID, the digest (both for `linux/amd64` on 23 October 2026) and the message text come from the real image:

```bash
sudo docker run hello-world
```

```text
Unable to find image 'hello-world:latest' locally
latest: Pulling from library/hello-world
4f55086f7dd0: Pull complete
Digest: sha256:11a3eb1597e864c51b3f56733cb2e8a90bf0c284bfc05f9444d81c558bc848aa
Status: Downloaded newer image for hello-world:latest

Hello from Docker!
This message shows that your installation appears to be working correctly.

To generate this message, Docker took the following steps:
 1. The Docker client contacted the Docker daemon.
 2. The Docker daemon pulled the "hello-world" image from the Docker Hub.
    (amd64)
 3. The Docker daemon created a new container from that image which runs the
    executable that produces the output you are currently reading.
 4. The Docker daemon streamed that output to the Docker client, which sent it
    to your terminal.
...
```

The four numbered steps are the path from [Part 1](/guides/introduction-to-docker/01-docker-basics): client, daemon, registry, container.

## Run Docker Without sudo

You have two options on Linux. Choose deliberately, because they have different security properties.

### Option 1: The docker Group

```bash
sudo usermod -aG docker "$USER"
newgrp docker        # or log out and back in
docker run --rm hello-world   # --rm: do not keep a second hello-world container
```

:::warning
**The `docker` group is root.** Anyone in it can run `docker run -v /:/host --privileged ...` and read or change any file on the host. Add only users who would get `sudo` anyway, and never add service accounts that run untrusted code.
:::

### Option 2: Rootless Mode

In **rootless mode**, the daemon and the containers run as your user, so a container escape lands in an unprivileged account. The `docker-ce-rootless-extras` package (installed with `docker-ce`) provides the setup tool:

```bash
# Prerequisites: newuidmap/newgidmap (the uidmap package on Debian and Ubuntu),
# and at least 65,536 subordinate IDs for your user in /etc/subuid and /etc/subgid
sudo apt install uidmap

# Stop the system-wide daemon if you only want rootless Docker, and remove its socket
sudo systemctl disable --now docker.service docker.socket
sudo rm -f /var/run/docker.sock

# Set up and start the daemon for your user
dockerd-rootless-setuptool.sh install
systemctl --user enable --now docker
sudo loginctl enable-linger "$USER"   # keep it running after you log out

# Point the CLI at your user's socket (the setup tool also creates a "rootless" context)
export DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock
docker info --format '{{.SecurityOptions}}'   # the list includes name=rootless
```

Rootless mode has limits. Containers cannot publish ports below 1024 unless you lower `net.ipv4.ip_unprivileged_port_start`; `--cpus`, `--memory` and `--pids-limit` work only with cgroup v2 and systemd; published ports do not show the client's source IP by default; and Ubuntu 24.04 and later restrict unprivileged user namespaces with AppArmor, which the Ubuntu package handles but a manual install does not. For a developer workstation or a single-tenant server, the trade-off is usually worth it.

## Docker Hub Pull Limits

Pulls from Docker Hub are rate limited. Docker's documentation (checked on 23 October 2026) lists these limits:

| Account                           | Pulls                                                |
| --------------------------------- | ---------------------------------------------------- |
| Not signed in                     | 100 per 6 hours, per IPv4 address or IPv6 /64 subnet |
| Docker Personal (free, signed in) | 200 per 6 hours                                      |
| Pro, Team, Business               | Unlimited, subject to fair use                       |

A pull of a multi-platform image counts once per platform you download, and a check that only asks whether a tag changed does not count. The registry tells you the limit that applies to you in its response headers, and a `HEAD` request reads them without using up a pull. This is a real run without signing in:

```terminal
{
  "title": "check your Docker Hub pull limit (real run, 23 October 2026)",
  "prompt": "$",
  "steps": [
    {
      "comment": "an anonymous token for Docker's test repository, then a HEAD request",
      "cmd": "TOKEN=$(curl -s \"https://auth.docker.io/token?service=registry.docker.io&scope=repository:ratelimitpreview/test:pull\" | jq -r .token)\ncurl -s --head -H \"Authorization: Bearer $TOKEN\" https://registry-1.docker.io/v2/ratelimitpreview/test/manifests/latest | grep -i '^ratelimit'",
      "output": "ratelimit-limit: 100;w=3600\nratelimit-remaining: 99;w=3600"
    }
  ]
}
```

`100;w=3600` means 100 pulls in a window of 3,600 seconds. When you go over the limit, Docker Hub answers with HTTP 429. This is the real message it returned to the machine that prepared this guide, after an hour of image lookups used up the anonymous quota:

```text
toomanyrequests: You have reached your unauthenticated pull rate limit. https://www.docker.com/increase-rate-limit
```

On the day of this run, the registry announced a one-hour window for anonymous pulls, while the documentation said six hours. Trust the header, and sign in with `docker login` on every machine that pulls often, especially CI runners and servers behind a shared IP address. A pull-through cache in front of Docker Hub (Harbor, or the `registry:3` image with a `proxy` section in its configuration) also helps when many machines pull the same images.

## Troubleshooting

### "failed to connect to the docker API"

The CLI could not reach the daemon. This is the real message from Docker CLI 29.9.2 on a machine where the daemon is not running (older versions said "Cannot connect to the Docker daemon"):

```terminal
{
  "title": "the daemon is not running (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker ps",
      "output": "failed to connect to the docker API at unix:///var/run/docker.sock; check if the path is correct and if the daemon is running: dial unix /var/run/docker.sock: connect: no such file or directory"
    }
  ]
}
```

Check the service and start it:

```bash
sudo systemctl status docker
sudo systemctl start docker
sudo journalctl -u docker --since "10 min ago"   # why it failed to start
```

On macOS and Windows, start Docker Desktop and wait until it reports that the engine is running. If the service runs but the CLI still fails, the CLI may be pointed elsewhere: check the `DOCKER_HOST` variable and run `docker context ls`. The context marked with `*` is the one in use. Docker Desktop on Linux, for example, uses a `desktop-linux` context with its own socket.

### "permission denied while trying to connect"

The daemon runs, but your user may not open its socket. This is the real message from Docker CLI 29.9.2 when the socket refuses the current user:

```terminal
{
  "title": "the socket refuses your user (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker ps",
      "output": "permission denied while trying to connect to the docker API at unix:///var/run/docker.sock"
    }
  ]
}
```

Use `sudo`, add yourself to the `docker` group and log in again (`id -nG` must list `docker`), or switch to rootless mode.

### Other Common Problems

- **`docker: 'compose' is not a docker command`**: the Compose plugin is missing. Install `docker-compose-plugin` from Docker's repository.
- **`exec format error` when a container starts**: the image was built for another CPU architecture, for example an `amd64`-only image on an ARM machine. Use an image that supports your architecture (most official images are multi-platform). Running another architecture needs emulation: Docker Desktop includes it, and on Linux you register QEMU handlers first, for example with `docker run --privileged --rm tonistiigi/binfmt --install all` ([Part 3](/guides/introduction-to-docker/03-working-with-docker-images)).
- **`toomanyrequests: You have reached your ... pull rate limit`**: sign in with `docker login`; see the limits above.
- **Docker Desktop does not start on Windows**: run `wsl --status` and `wsl --update`, and check that virtualization is turned on in the firmware settings.

## Update and Uninstall

**Update.** On Linux, Docker updates with the rest of your packages (`sudo apt upgrade` or `sudo dnf upgrade`). Updating the Engine restarts the daemon, which stops running containers. [Live restore](https://docs.docker.com/engine/daemon/live-restore/) keeps them running across patch updates (29.9.1 to 29.9.2), but not across a new minor version (29.8 to 29.9) or changed daemon settings; plan a short maintenance window for those. Docker Desktop updates itself and asks before it installs.

**Uninstall.** Remove the packages, then decide whether to keep your data. Images, containers and volumes live in `/var/lib/docker` and `/var/lib/containerd`:

```bash
sudo apt purge docker-ce docker-ce-cli containerd.io docker-buildx-plugin \
  docker-compose-plugin docker-ce-rootless-extras
# Deletes ALL images, containers and volumes on this host:
sudo rm -rf /var/lib/docker /var/lib/containerd
sudo rm /etc/apt/sources.list.d/docker.sources /etc/apt/keyrings/docker.asc
```

## Running Docker on a Cloud Server

If you do not want Docker on your own machine, a small Linux VM in the cloud works the same way: create an Ubuntu 24.04 or 26.04 server and follow the Ubuntu steps above. On DigitalOcean, [create a Droplet](https://m.do.co/c/2a9bba940f39) with Ubuntu 24.04, or start from its Docker 1-Click image, which has Docker preinstalled on Ubuntu 22.04 (update it with `apt` to get the current release). This is a referral link: if you later spend $25 on DigitalOcean, this site gets $25 in credit. New accounts that sign up through it get DigitalOcean's standard signup credit, which its [documentation](https://docs.digitalocean.com/platform/billing/signup-credit/) lists as $5, valid for 90 days (checked in October 2026), and you need a valid payment method before you can create a Droplet.

## Summary

- On Linux, install `docker-ce` and the plugins from Docker's repository with a `signed-by` keyring; the distribution's `docker.io` package is older.
- On macOS and Windows, install Docker Desktop and check whether your company needs a paid subscription.
- Verify with `docker version` and `docker run hello-world`.
- The `docker` group equals root access; rootless mode is the safer way to skip `sudo`.
- Sign in to Docker Hub on machines that pull often.

Next, learn how to [find, pull and manage images](/guides/introduction-to-docker/03-working-with-docker-images).

## Keep Learning

- [Cannot Connect to the Docker Daemon: Is the Docker Daemon Running?](/posts/cannot-connect-to-docker-daemon)
- [How to Fix Docker: Permission Denied](/posts/fix-docker-permission-denied-error)
- Exercise: [Running Docker Containers on Your Linux Server](/exercises/docker-server-deployment)
- Practice in the browser: [Docker Terminal simulator](/games/docker-terminal-simulator)
