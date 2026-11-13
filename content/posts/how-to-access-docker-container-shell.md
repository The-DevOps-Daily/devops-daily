---
title: "How to Access a Docker Container's Shell, Run Commands and Copy Files"
excerpt: 'Open a shell with docker exec, run one-off commands, get root without sudo, add bash or ps to a slim image, edit and copy files with docker cp, look inside an image that has no shell, and debug a stopped container.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-05-03'
publishedAt: '2025-05-03T10:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Containers
  - docker exec
  - docker cp
  - Debugging
  - DevOps
---

Sooner or later you need to look inside a container: read a config file, check what the app sees, copy a log out, or find out why it will not start. Docker gives you a small set of commands for this, `docker exec`, `docker cp`, `docker run --entrypoint` and `docker export`, and most problems come from using the wrong one or from a slim image that lacks the tool you want.

This post covers getting a shell, running single commands, working as root, adding missing tools such as `bash`, `ps` and `ping`, editing and copying files, exploring a container's file system, and debugging containers that are stopped or will not start.

## TLDR

| Task                                       | Command                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| Shell in a running container               | `docker exec -it web sh` (or `bash` if the image has it)                 |
| One command, no shell                      | `docker exec web cat /etc/nginx/nginx.conf`                              |
| A command with a pipe inside the container | `docker exec web sh -c 'ls /app \| wc -l'`                               |
| Root shell in a non-root container         | `docker exec -it -u 0 web sh`                                            |
| Shell in an image, not a container         | `docker run --rm -it --entrypoint sh myimage`                            |
| Copy a file out or in                      | `docker cp web:/app/config.json .` and `docker cp config.json web:/app/` |
| What changed in a container                | `docker diff web`                                                        |
| List the files of an image with no shell   | `docker export "$(docker create myimage)" \| tar -t`                     |

`docker exec` only works on running containers. `docker cp`, `docker diff` and `docker export` also work on stopped ones.

## Prerequisites

- Docker Engine or Docker Desktop, and permission to run `docker` (see [permission denied](/posts/cannot-connect-to-docker-daemon#h2-how-do-i-fix-permission-denied-on-the-docker-socket) if you need `sudo`).
- A running container to practice on, for example `docker run -d --name web nginx:1.30`.

## How Do I Get a Shell in a Running Container?

Use `docker exec` with `-it` and the name of a shell that exists in the image:

```bash
docker exec -it web bash    # Debian, Ubuntu and most "full" images
docker exec -it web sh      # Alpine, BusyBox and most slim images
```

- `-i` keeps STDIN open, so the shell can read what you type.
- `-t` gives the shell a terminal, so you get a prompt and line editing.

Type `exit` or press `Ctrl+D` to leave. The container keeps running, because you only ended the extra shell process, not the main process.

If the image has no `bash`, Docker prints an error like this one, and `sh` usually works:

```text
OCI runtime exec failed: exec failed: unable to start container process: exec: "bash": executable file not found in $PATH: unknown
```

In a Compose project, use the service name: `docker compose exec web sh`. In scripts and CI jobs there is no terminal, so drop `-t` (and use `-T` with Compose), or you get [the input device is not a TTY](/posts/docker-tty-error-fix).

## How Do I Run a Command in an Existing Container?

Give `docker exec` the command instead of a shell. It runs in the container's file system, network and environment, and prints the output in your terminal:

```bash
docker exec web ls -la /etc/nginx
docker exec web env                          # the environment the app sees
docker exec -u nginx web id                  # as another user, by name or UID
docker exec -w /usr/share/nginx/html web ls  # in another working directory
docker exec -e DEBUG=1 web printenv DEBUG    # with an extra variable, only for this command
```

Your host shell processes pipes, redirects and wildcards before Docker sees them. To run them inside the container, wrap the command in `sh -c`:

```bash
docker exec web ls /var/log/nginx | wc -l         # wc runs on the host
docker exec web sh -c 'ls /var/log/nginx | wc -l' # everything runs in the container
docker exec web sh -c 'echo "$HOSTNAME"'          # the container's variable, not the host's
```

To run a script from the host without copying it in, pipe it to a shell with `-i`:

```bash
docker exec -i web sh < ./check.sh
```

`docker exec --privileged` gives the command extra privileges, for example for `strace`. It weakens the isolation, so keep it for debugging.

## docker exec vs docker attach

`docker exec` starts a **new** process next to the container's main process. `docker attach` connects your terminal to the **main** process itself, PID 1. Whatever you type or send after `attach` goes to that process, so leaving it can stop the container:

```text
$ docker run -dit --name shell alpine:3.22 sh
0b204499206cdf33f7da0e6abbd374640a695ab578c73842ac7c48ff8cb75e5c
$ docker exec shell sh -c 'exit 3'; echo "exec exit $?"; docker inspect -f '{{.State.Status}}' shell
exec exit 3
running

$ docker attach shell        # then press Ctrl+P, Ctrl+Q
/ # read escape sequence
$ docker inspect -f '{{.State.Status}}' shell
running

$ docker attach shell        # then type exit and press Enter
exit
$ docker inspect -f '{{.State.Status}} exit={{.State.ExitCode}}' shell
exited exit=0
```

The `exec` shell can exit with any code; the container does not notice. Typing `exit` after `attach` ends PID 1, and the container with it. `Ctrl+P Ctrl+Q` is the detach sequence (change it with `--detach-keys`, for example `--detach-keys=ctrl-x`), but it only works when the container was started with `-i` and `-t`. For a container started without them, such as a plain `docker run -d nginx`, we recorded this on Docker Engine 28.0.4:

| What you do after `docker attach web`                   | Result                                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Press Ctrl+P Ctrl+Q                                     | Nothing: without a TTY there is no detach sequence                                                     |
| Press Ctrl+C                                            | `docker attach` forwards SIGINT, nginx logs `signal 2 (SIGINT) received, exiting`, the container stops |
| Kill the client with SIGTERM (as `timeout` does)        | The signal is forwarded too: nginx exits on SIGTERM, the container stops                               |
| Attach with `--sig-proxy=false`, then Ctrl+C or SIGTERM | The container keeps running, but the client ignores both signals; only `kill -9` ends it               |

To watch the output of a running container, use `docker logs -f web` instead: Ctrl+C stops only the `logs` command, and the container keeps running. For a shell, use `docker exec -it`. Keep `attach` for containers whose main process is an interactive program you started with `-it`. We recorded these results on a GitHub Actions runner, sending the keys through a pseudo-terminal.

## How Do I Use Bash in an Alpine Container?

Alpine images have BusyBox `sh`, not `bash`. Use `sh`, or install `bash` with `apk`:

```dockerfile
FROM alpine:3.24
RUN apk add --no-cache bash
CMD ["bash"]
```

For a one-off session in a running container, install it there. The change is lost when the container is removed:

```bash
docker exec -it -u 0 my-alpine-app sh -c 'apk add --no-cache bash && exec bash'
```

Scripts that use bash features, such as arrays or `[[ ]]`, need `#!/bin/bash` as the first line and `bash` in the image. Plain POSIX scripts with `#!/bin/sh` run on BusyBox `sh` as they are, which keeps the image small.

## How Do I Run Commands as Root, or With sudo, in a Container?

You do not need `sudo`. Pass the user to `docker exec`:

```bash
docker exec -it -u 0 web sh         # root, by UID
docker exec -it -u root web sh      # root, by name
docker run --rm -u 0 myimage whoami # the same for a new container
```

Most base images (Debian, Ubuntu, Alpine) do not include `sudo`, and many official images run as root by default. Images that set `USER` in the Dockerfile run their processes as that user, and `-u 0` is the way to get root for maintenance.

If a development image must have `sudo`, for example to test scripts that call it, install it and add a rule in `/etc/sudoers.d`:

```dockerfile
FROM ubuntu:24.04
RUN apt-get update \
    && apt-get install -y --no-install-recommends sudo \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m dev \
    && echo 'dev ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/dev \
    && chmod 0440 /etc/sudoers.d/dev
USER dev
```

Two notes:

- `ubuntu:24.04` already has a user `ubuntu` with UID 1000, so the new user gets UID 1001. That matters for files on bind mounts.
- Password-free `sudo` gives root back to any process in the container. Do not use it in production images. A non-root `USER` only protects you if nothing can become root again. The [container escape simulator](/games/docker-escape) shows what an attacker does with root and one bad `docker run` flag.

## What If ps, ping or Other Tools Are Missing in a Container?

Slim images leave out everything that the app does not need. `bash: ps: command not found` and `bash: ping: command not found` mean the package is not installed, not that something is broken. You have three options.

**Install the tool for this session.** The change is lost when the container is removed:

| Tool              | Debian and Ubuntu                 | Alpine                                        |
| ----------------- | --------------------------------- | --------------------------------------------- |
| `ps`, `top`       | `apt-get install -y procps`       | built in (BusyBox), `procps` for more options |
| `ping`            | `apt-get install -y iputils-ping` | built in (BusyBox)                            |
| `ip`, `ss`        | `apt-get install -y iproute2`     | built in (BusyBox `ip`), `iproute2` for `ss`  |
| `curl`            | `apt-get install -y curl`         | `apk add curl`                                |
| `nslookup`, `dig` | `apt-get install -y dnsutils`     | `apk add bind-tools`                          |

On Debian and Ubuntu, run `apt-get update` first: the images ship without package lists. Use `-u 0` if the container does not run as root.

**Look without the tool.** `docker top web` lists the processes from the host, with the columns `UID PID PPID C STIME TTY TIME CMD`. Inside the container, `/proc` has the same data: `cat /proc/1/cmdline | tr '\0' ' '` shows the main process, and `ls /proc` lists the PIDs.

**Bring the tools in a second container.** A debug container can join the network and process namespaces of the target, so you get a full toolbox without changing the target at all:

```bash
# netshoot is a public image with ping, curl, dig, tcpdump, ss and more
docker run --rm -it --network container:web --pid container:web nicolaka/netshoot
# Inside: ping, ss -tlnp and ps aux all see the "web" container's network and processes
```

This also works for images with no shell at all, such as distroless images. Docker Desktop has `docker debug`, which does the same with one command (`docker debug web`) and is free for all users since Docker Desktop 4.49. If you need a tool every time, add it in the Dockerfile, but keep debugging tools out of production images.

## How Do I Edit a File Inside a Container?

Most slim images have no editor. Debian and Ubuntu images do not include `vi` or `nano`, and Alpine has only BusyBox `vi`. The simplest way is to edit the file on the host:

```bash
docker cp web:/etc/nginx/conf.d/default.conf ./default.conf   # copy it out
vi ./default.conf                                              # edit with your own editor
docker cp ./default.conf web:/etc/nginx/conf.d/default.conf   # copy it back
docker exec web nginx -s reload                                # make the app read it again
```

Or install an editor for this session: `docker exec -it -u 0 web sh -c 'apt-get update && apt-get install -y nano'`, then `docker exec -it web nano /path/to/file`.

Edits inside a container are for debugging. They are gone when the container is recreated, and `docker compose up --force-recreate` or a redeploy recreates it. For changes that must stay:

- Change the Dockerfile and rebuild the image.
- Mount the file from the host with a bind mount, as in [mount a host directory](/posts/docker-data-loss-when-container-exits#h2-how-do-i-mount-a-host-directory-in-a-container).
- `docker commit web web:patched` saves the current file system as an image. It is a last resort: nobody can rebuild that image from source.

## How Do I Copy Files Between a Container and the Host?

Use `docker cp`. It works in both directions and on stopped containers too:

```bash
docker cp web:/etc/nginx/nginx.conf ./nginx.conf       # container to host
docker cp ./index.html web:/usr/share/nginx/html/     # host to container
docker cp crashed-app:/app/logs ./crash-logs          # from a stopped container
```

Some files are not what they seem. In the `nginx` image, `/var/log/nginx/access.log` and `error.log` are symlinks to stdout and stderr, so `docker cp` gets a link, not the log. Save what the container printed with `docker logs web > web.log 2>&1` instead.

For directories, the path you give decides what you get:

| Command                                                  | Result                                         |
| -------------------------------------------------------- | ---------------------------------------------- |
| `docker cp web:/app/logs ./out` (`./out` does not exist) | `./out` is created with the contents of `logs` |
| `docker cp web:/app/logs ./out` (`./out` exists)         | You get `./out/logs`                           |
| `docker cp web:/app/logs/. ./out`                        | The contents of `logs` go into `./out`         |

Other useful forms:

- **Stream a `tar` archive.** `docker cp web:/app/data - > data.tar` writes a tar archive to stdout, and `docker cp - web:/app/ < data.tar` extracts one inside the container.
- **Run the app's own export.** For a database, a dump is safer than copying its files while it runs: `docker exec db pg_dump -U postgres appdb > appdb.sql`.
- **Keep owners and permissions.** `docker cp -a` copies the UID and GID information. Without it, files copied to the host belong to your user, and files copied into the container belong to root.
- **Compose.** `docker compose cp web:/app/config.json .` works with the service name.

For files that you need often or all the time, such as logs during development, a bind mount is better than repeated copies.

## How Do I Explore a Container's File System?

For a running container, open a shell and use the normal tools, or run `find` and `du` through `docker exec`:

```bash
docker exec web find / -name "*.conf" -not -path "/proc/*" 2>/dev/null
docker exec web du -sh /var/log /tmp
docker exec web df -h                 # the container's view, mounts included
```

To see what the container changed compared to its image, use `docker diff`. `A` is added, `C` is changed and `D` is deleted:

```bash
docker diff web
# Example output for an nginx container:
# C /var/cache/nginx
# A /var/cache/nginx/client_temp
# C /run
# A /run/nginx.pid
```

To get every file of a container, including a stopped one, export it as a `tar` archive and unpack it on the host:

```bash
docker export web > web-fs.tar
mkdir web-fs && tar -xf web-fs.tar -C web-fs
```

`docker export` does not include the contents of volumes, only the container's own file system. Read volumes through a helper container instead, as shown in [back up a volume](/posts/docker-data-loss-when-container-exits#h2-how-do-i-back-up-and-restore-a-docker-volume).

Older tutorials browse the container's directory on the host with `docker inspect -f '{{.GraphDriver.Data.MergedDir}}'`. That path only exists with the classic `overlay2` storage driver. New Docker Engine installs use the containerd image store, and on Docker Desktop the files are inside a VM, so use the commands above instead.

## How Do I See What Is Inside an Image Without Running It?

Start a temporary container with a shell. `--rm` removes it when you exit:

```bash
docker run --rm -it --entrypoint sh nginx:1.30
```

Images built `FROM scratch` or on distroless bases have no shell, so this fails. You do not need to run the image at all: `docker create` makes a container without starting it, and from there `docker export` lists or extracts every file and `docker cp` copies single files. When the image has the tool you want but a different entrypoint, override the entrypoint for one command:

```terminal
{
  "title": "look inside an image without a shell",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker run --rm hello-world sh",
      "output": "docker: Error response from daemon: failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: error during container init: exec: \"sh\": executable file not found in $PATH\n\nRun 'docker run --help' for more information"
    },
    {
      "cmd": "cid=$(docker create hello-world) && docker export $cid | tar -t; docker rm $cid",
      "output": ".dockerenv\ndev/\ndev/console\ndev/pts/\ndev/shm/\netc/\netc/hostname\netc/hosts\netc/mtab\netc/resolv.conf\nhello\nproc/\nsys/\n5bdf86f18c81dfc4ebfec7ed6c8e6f441d6b3ee12d351c0d4146d7c44270b72a"
    },
    {
      "cmd": "cid=$(docker create nginx:1.30) && docker cp $cid:/etc/nginx/conf.d/default.conf . && head -4 default.conf; docker rm $cid",
      "output": "server {\n    listen       80;\n    server_name  localhost;\n\ne79a60887702ef8f9419874e524b09ab4e9b86c73ccd35214431275399d15e50"
    },
    {
      "cmd": "docker run --rm --entrypoint ls nginx:1.30 -la /etc/nginx",
      "output": "total 36\ndrwxr-xr-x 3 root root 4096 Nov  5 07:18 .\ndrwxr-xr-x 1 root root 4096 Nov  5 16:37 ..\ndrwxr-xr-x 2 root root 4096 Nov  5 07:18 conf.d\n-rw-r--r-- 1 root root 1007 Oct  2 14:33 fastcgi_params\n-rw-r--r-- 1 root root 5349 Oct  2 14:33 mime.types\nlrwxrwxrwx 1 root root   22 Oct  2 16:57 modules -> /usr/lib/nginx/modules\n-rw-r--r-- 1 root root  644 Oct  2 16:57 nginx.conf\n-rw-r--r-- 1 root root  636 Oct  2 14:33 scgi_params\n-rw-r--r-- 1 root root  664 Oct  2 14:33 uwsgi_params"
    }
  ]
}
```

The `hello-world` image holds one file, `hello`; the rest of the list is what Docker adds to every container (`/etc/hosts`, `/etc/resolv.conf`, mount points for `/proc`, `/sys` and `/dev`). The long hex strings are the container IDs that `docker rm` prints. To see the command an image runs before you start it, read its config with `docker image inspect -f '{{json .Config.Cmd}}'` and `.Config.Entrypoint`. For `nginx:1.30` they are `["nginx","-g","daemon off;"]` and `["/docker-entrypoint.sh"]`.

`docker history nginx:1.30` lists the layers and the instruction that made each one, which tells you where a file came from.

## How Do I Start a Stopped Container With a Different Command?

You cannot. `docker start` always runs the command the container was created with, and there is no option to change it. Pick one of these instead:

- **A fresh container from the same image**, with a shell as the entrypoint. You get the image, not the stopped container's changes:

  ```bash
  docker run --rm -it --entrypoint sh myimage
  ```

- **The stopped container's files, in a new container.** `docker commit` saves its file system as a temporary image. Volumes are not part of the commit, so add them with `--volumes-from`:

  ```bash
  docker commit crashed-app crashed-app-debug
  docker run --rm -it --volumes-from crashed-app --entrypoint sh crashed-app-debug
  docker image rm crashed-app-debug    # when you are done
  ```

- **Just read the files.** `docker cp crashed-app:/app/logs ./logs` and `docker logs crashed-app` work without starting anything.

If the container starts but crashes at once, read why with `docker logs` and the exit code first: [why a container exits immediately](/posts/difference-run-cmd-dockerfile#h2-why-does-my-docker-container-exit-immediately) lists the usual causes.

## Security Notes

- `docker exec` runs as the container's default user, which is often root. Anyone who can run `docker exec` controls the container, and anyone who can use the Docker socket controls the host.
- Command lines show up in your shell history and in the host's process list. Do not pass passwords as arguments, for example `mysql -pSecret`. Let the client ask for the password, or read it from a file inside the container.
- Tools you install in a running container for debugging disappear on the next deploy. That is a good thing: production images should not ship debuggers and editors.

## Related Resources

- [How to fix "the input device is not a TTY"](/posts/docker-tty-error-fix): `-it` in scripts and CI
- [Get a shell in a Compose service](/posts/rebuild-docker-container-compose#h2-how-do-i-open-an-interactive-shell-in-a-compose-service), including one that crashes on start
- [Introduction to Docker: Run Commands Inside a Container](/guides/introduction-to-docker/04-creating-your-first-container)
- [Docker terminal simulator](/games/docker-terminal-simulator): practice `exec`, `logs` and `cp` in the browser
- [Learn Linux interactive tutorial](/games/linux-terminal): the shell commands you use once you are inside
- [Docker flashcards](/flashcards/docker-essentials): review the commands
