---
title: 'Run Your First Docker Container: docker run, ps, logs and exec'
description: 'Run your first Docker container with docker run: publish ports, run in the background, read logs, open a shell with exec, set restart policies and limits.'
order: 4
---

A container is a running instance of an image. In this part you start an nginx web server in a container, reach it from your browser, read its logs, open a shell inside it, and then stop and remove it. Along the way you learn the `docker run` flags you will use every day and the container lifecycle that every later part builds on.

## Prerequisites

- Docker installed and working ([Part 2](/guides/introduction-to-docker/02-docker-installation)).
- Port 8080 free on your machine.

:::note
The commands in this part need a running Docker daemon, so their output is shown as **examples** in the format Docker prints. The nginx messages, the welcome page and the version strings come from the real `nginx:1.30` image; container IDs, times and addresses differ on your machine.
:::

## Run a Container

```bash
docker run nginx:1.30
```

Docker pulls the image if needed, creates a container, starts it and attaches your terminal to its output. Example output:

```text
/docker-entrypoint.sh: /docker-entrypoint.d/ is not empty, will attempt to perform configuration
/docker-entrypoint.sh: Looking for shell scripts in /docker-entrypoint.d/
/docker-entrypoint.sh: Launching /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh
10-listen-on-ipv6-by-default.sh: info: Getting the checksum of /etc/nginx/conf.d/default.conf
10-listen-on-ipv6-by-default.sh: info: Enabled listen on IPv6 in /etc/nginx/conf.d/default.conf
/docker-entrypoint.sh: Sourcing /docker-entrypoint.d/15-local-resolvers.envsh
/docker-entrypoint.sh: Launching /docker-entrypoint.d/20-envsubst-on-templates.sh
/docker-entrypoint.sh: Launching /docker-entrypoint.d/30-tune-worker-processes.sh
/docker-entrypoint.sh: Configuration complete; ready for start up
2026/10/23 20:40:01 [notice] 1#1: using the "epoll" event method
2026/10/23 20:40:01 [notice] 1#1: nginx/1.30.6
2026/10/23 20:40:01 [notice] 1#1: built by gcc 14.2.0 (Debian 14.2.0-19)
2026/10/23 20:40:01 [notice] 1#1: OS: Linux 6.8.0-87-generic
2026/10/23 20:40:01 [notice] 1#1: getrlimit(RLIMIT_NOFILE): 1048576:1048576
2026/10/23 20:40:01 [notice] 1#1: start worker processes
2026/10/23 20:40:01 [notice] 1#1: start worker process 29
...
```

The first lines come from the image's entrypoint script, which prepares the configuration; then nginx starts as process 1 (`1#1`) inside the container. The container runs in the foreground, so press `Ctrl+C` to stop it. The container still exists after it stops; you remove it later in this part.

You cannot reach this container at `localhost:8080` yet: it has its own network namespace, and you did not publish a port. (With rootful Docker Engine on Linux, the host itself can reach the container's own IP address directly, as [Part 7](/guides/introduction-to-docker/07-networking-in-docker) explains; other machines cannot, and in rootless mode the host cannot either.)

## Run in the Background and Publish a Port

```bash
docker run -d --name web -p 8080:80 nginx:1.30
```

- `-d` (detached) runs the container in the background and prints its full ID.
- `--name web` gives it a name you can use instead of the ID. Without it, Docker invents one like `eager_hopper`.
- `-p 8080:80` publishes container port 80 on host port 8080. The order is always **host:container**.

Open `http://localhost:8080` in a browser, or use curl (example output; the HTML is the real welcome page from the image):

```bash
curl -s http://localhost:8080 | head -4
```

```text
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
```

The `-p` flag has a few forms:

| Flag                   | Meaning                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `-p 8080:80`           | Host port 8080 on every interface (IPv4 and IPv6) to container port 80   |
| `-p 127.0.0.1:8080:80` | Only on the host's loopback address: not reachable from the network      |
| `-p 8080:80/udp`       | UDP instead of TCP                                                       |
| `-p 80`                | Container port 80 on a random free host port; `docker port web` shows it |
| `-P`                   | Every port the image declares with `EXPOSE`, each on a random host port  |

`EXPOSE` in an image is documentation: it publishes nothing by itself. [Part 7](/guides/introduction-to-docker/07-networking-in-docker) explains what happens to the traffic and why published ports bypass `ufw`.

## List Containers

```bash
docker ps
```

Example output:

```text
CONTAINER ID   IMAGE        COMMAND                  CREATED          STATUS          PORTS                                     NAMES
3c1f8e6a9b2d   nginx:1.30   "/docker-entrypoint.…"   12 seconds ago   Up 11 seconds   0.0.0.0:8080->80/tcp, [::]:8080->80/tcp   web
```

`docker ps` lists running containers. Add `-a` to include stopped ones, `-q` to print only IDs (useful in scripts), and `--format` to pick columns, for example `docker ps --format '{{.Names}}\t{{.Status}}'`. `docker container ls` is the same command under its newer name.

## The Container Lifecycle

```diagram
{
  "type": "loop",
  "nodes": [
    { "label": "Created", "sub": "docker create", "variant": "soft" },
    { "label": "Running", "sub": "docker start / run", "variant": "accent" },
    { "label": "Exited", "sub": "docker stop, or the process ends", "variant": "soft" },
    { "label": "Removed", "sub": "docker rm", "variant": "solid" }
  ],
  "loopBack": "docker start: same container, same writable layer"
}
```

`docker run` is `docker create` plus `docker start`. A stopped container keeps its writable layer, its configuration and its logs, so `docker start web` brings back the same container. `docker rm` deletes it, including every file the process wrote inside it.

## Read the Logs

Docker captures everything the main process writes to stdout and stderr:

```bash
docker logs web
docker logs -f web            # follow new lines, Ctrl+C to stop
docker logs --tail 20 web     # the last 20 lines
docker logs --since 10m -t web   # the last 10 minutes, with timestamps
```

After the curl request above, the end of the log shows one access log line (example output in nginx's `main` log format; the 896 bytes are the size of the real welcome page):

```text
172.17.0.1 - - [23/Oct/2026:20:41:12 +0000] "GET / HTTP/1.1" 200 896 "-" "curl/8.5.0" "-"
```

The client address is the Docker bridge gateway, because the request came in through the published port. This only works because the official nginx image sends its log files to stdout and stderr. Applications that write logs to files inside the container need to log to stdout instead, or `docker logs` shows nothing.

## Run Commands Inside a Container

`docker exec` starts an extra process in a running container. For a one-off command:

```bash
docker exec web nginx -v
```

```text
nginx version: nginx/1.30.6
```

For an interactive shell, add `-i` (keep stdin open) and `-t` (allocate a terminal):

```bash
docker exec -it web bash
root@3c1f8e6a9b2d:/# grep PRETTY_NAME /etc/os-release
PRETTY_NAME="Debian GNU/Linux 13 (trixie)"
root@3c1f8e6a9b2d:/# exit
```

The prompt shows the container ID as the hostname. Not every image has `bash`. Many images are trimmed to keep them small, and you can check which tools an image contains without running it. This real run uses `crane`, a registry client from Google's go-containerregistry project, to list the files in three images:

```terminal
{
  "title": "which tools does each image ship? (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "for i in nginx:1.30 nginx:1.30-alpine python:3.14-slim; do\n  echo \"$i: $(crane export --platform linux/amd64 $i - | tar -t | grep -E '^(usr/)?bin/(bash|curl|ping|ps)$' | tr '\\n' ' ')\"\ndone",
      "output": "nginx:1.30: usr/bin/curl usr/bin/bash\nnginx:1.30-alpine: usr/bin/curl bin/ping bin/ps\npython:3.14-slim: usr/bin/bash"
    }
  ]
}
```

So `docker exec -it web bash` works on `nginx:1.30`, the Alpine variant needs `sh` (`docker exec -it web sh`), and a `python:3.14-slim` container has no `curl` or `ping` at all. Install debugging tools at debug time, not in the image: Docker Desktop's `docker debug` attaches a toolbox to any container, and on any host you can run a tools container in the same network namespace ([Part 7](/guides/introduction-to-docker/07-networking-in-docker)).

`docker cp` copies files between the host and a container in both directions:

```bash
docker cp web:/etc/nginx/conf.d/default.conf ./default.conf
echo '<h1>Hello from docker cp</h1>' > index.html
docker cp ./index.html web:/usr/share/nginx/html/index.html
```

Changes you make inside a container are lost when you remove it. Use `exec` and `cp` to investigate, and put permanent changes into the image ([Part 5](/guides/introduction-to-docker/05-building-custom-docker-images)) or a volume ([Part 6](/guides/introduction-to-docker/06-working-with-docker-volumes)).

## Stop, Start and Remove

```bash
docker stop web      # graceful stop
docker start web     # start the same container again
docker restart web   # stop, then start
```

`docker rm web` removes a stopped container, and `docker rm -f web` stops and removes it in one step.

`docker stop` sends the image's stop signal, waits 10 seconds by default (`-t` changes it), then sends `SIGKILL`. Most images use `SIGTERM`; the nginx image sets `STOPSIGNAL SIGQUIT`, which tells nginx to finish open requests before it exits. A process that ignores its stop signal is killed after the timeout, which is how requests get cut off during deploys. [Part 9](/guides/introduction-to-docker/09-docker-best-practices) shows how to make your own app shut down cleanly.

Stop it with `docker stop web`. `docker ps -a` now shows the containers you have created so far: `web`, the foreground nginx container from the start of this part (Docker named it), and `hello-world` from Part 2 unless you pruned it in Part 3. Example output:

```text
CONTAINER ID   IMAGE         COMMAND                  CREATED         STATUS                     PORTS     NAMES
3c1f8e6a9b2d   nginx:1.30    "/docker-entrypoint.…"   5 minutes ago   Exited (0) 3 seconds ago             web
9f4e2a7b1c3d   nginx:1.30    "/docker-entrypoint.…"   8 minutes ago   Exited (0) 7 minutes ago             vigilant_morse
8d2b4f71c0e5   hello-world   "/hello"                 2 hours ago     Exited (0) 2 hours ago               eager_hopper
```

Stopped containers pile up. Remove one-off containers automatically with `--rm`:

```bash
docker run --rm alpine:3.24 echo "gone after this line"
```

and clean up the rest with `docker container prune`, which removes every stopped container.

## Restart Policies

A restart policy tells the daemon what to do when the container's process exits or the daemon restarts:

| Policy           | Restarts when                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `no` (default)   | Never                                                                                                     |
| `on-failure[:N]` | The process exits with a non-zero code, at most N times                                                   |
| `always`         | The process exits for any reason; also after a daemon restart, even if you stopped the container yourself |
| `unless-stopped` | Like `always`, except after a daemon restart when you had stopped it on purpose                           |

```bash
docker rm -f web
docker run -d --name web --restart unless-stopped -p 8080:80 nginx:1.30
```

`unless-stopped` is the usual choice for services on a single host. Docker doubles the pause between restarts each time (from 100 ms up to one minute) and resets it once a container has run for 10 seconds, so a container that crashes at startup restarts with growing pauses instead of in a tight loop.

## Environment Variables

Images read their configuration from environment variables. Set them with `-e`, or load many from a file with `--env-file`:

```bash
docker run --rm -e GREETING=hello alpine:3.24 sh -c 'echo "$GREETING from $(hostname)"'

printf 'GREETING=hello\nLOG_LEVEL=debug\n' > app.env
docker run --rm --env-file ./app.env alpine:3.24 env
```

Each image documents the variables it reads, for example `POSTGRES_PASSWORD` for `postgres` ([Part 6](/guides/introduction-to-docker/06-working-with-docker-volumes)). Anyone who can run `docker inspect` on the host can read these values, so treat environment variables as configuration, not as a safe place for secrets ([Part 8](/guides/introduction-to-docker/08-docker-compose) shows secrets).

## Limit Resources

By default a container can use all the CPU and memory of the host. Set limits on anything long-running:

```bash
docker rm -f web
docker run -d --name web -p 8080:80 \
  --memory 256m --cpus 0.5 --pids-limit 200 \
  nginx:1.30
docker stats --no-stream web
```

Example output:

```text
CONTAINER ID   NAME      CPU %     MEM USAGE / LIMIT   MEM %     NET I/O         BLOCK I/O     PIDS
5a9e0c3d7f11   web       0.00%     9.8MiB / 256MiB     3.83%     2.1kB / 1.6kB   0B / 12.3kB   5
```

- `--memory 256m`: if the processes use more, the kernel's OOM killer stops one of them, usually the main process, and the container exits with code 137.
- `--cpus 0.5`: at most half of one CPU core, measured over time.
- `--pids-limit 200`: at most 200 processes, which stops a fork bomb.

`docker update --memory 512m web` changes limits on a running container.

## Health Checks

A running process is not always a working service. A health check runs a command inside the container at an interval, and Docker marks the container `healthy` or `unhealthy`:

```bash
docker rm -f web
docker run -d --name web -p 8080:80 \
  --health-cmd 'curl -fsS http://localhost/ || exit 1' \
  --health-interval 10s --health-retries 3 \
  nginx:1.30
docker ps
```

Example output:

```text
CONTAINER ID   IMAGE        COMMAND                  CREATED          STATUS                    PORTS                                     NAMES
7b3d91e4a2c6   nginx:1.30   "/docker-entrypoint.…"   40 seconds ago   Up 39 seconds (healthy)   0.0.0.0:8080->80/tcp, [::]:8080->80/tcp   web
```

The command must exist in the image: `curl` works here because `nginx:1.30` ships it, as the listing above showed. Docker does not restart unhealthy containers on its own; Compose waits for them ([Part 8](/guides/introduction-to-docker/08-docker-compose)) and orchestrators replace them ([Part 10](/guides/introduction-to-docker/10-docker-in-production)). Usually you define the check in the Dockerfile instead ([Part 5](/guides/introduction-to-docker/05-building-custom-docker-images)).

## Inspect a Container

`docker inspect web` prints everything Docker knows about the container as JSON. Use `--format` with a Go template to pick fields:

```bash
docker inspect --format '{{.State.Status}} {{.State.Health.Status}}' web
docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' web
docker port web
docker top web
```

`docker port` lists the published ports (`80/tcp -> 0.0.0.0:8080` and `80/tcp -> [::]:8080`), and `docker top` lists the processes in the container, as the host sees them.

## Common Mistakes

- **The container exits right away.** A container lives as long as its main process. `docker run ubuntu` starts `bash`, finds no terminal and exits. Pass `-it` for an interactive shell, or run a long-running command. Check `docker logs` and the exit code in `docker ps -a`.
- **"port is already allocated".** Another container or program uses the host port. Find it with `docker ps` (or `sudo ss -ltnp`) and pick another host port, such as `-p 8081:80`.
- **"The container name "/web" is already in use".** A stopped container still has that name. Remove it with `docker rm web`, or use `--rm` for throwaway containers.
- **Expecting changes to survive `docker rm`.** Files written inside a container live in its writable layer and are deleted with it. Use volumes ([Part 6](/guides/introduction-to-docker/06-working-with-docker-volumes)).
- **Using `--link`.** It is a legacy feature, and since Engine 29 it no longer sets the environment variables older tutorials rely on. Put containers on a user-defined network instead ([Part 7](/guides/introduction-to-docker/07-networking-in-docker)).

Clean up before the next part:

```bash
docker rm -f web
docker container prune
```

## Summary

- `docker run -d --name web -p 8080:80 nginx:1.30` is the core pattern: background, named, published on a host port.
- `docker ps`, `logs`, `exec`, `cp`, `inspect` and `stats` let you see what a container does.
- `docker stop` sends the stop signal and kills after 10 seconds; `docker rm` deletes the container and its writable layer.
- Use `--restart unless-stopped`, resource limits and a health check for anything long-running.

Next, build your own image for a small web API in [How to Write a Dockerfile](/guides/introduction-to-docker/05-building-custom-docker-images).

## Keep Learning

- [Why Your Docker Container Exits Immediately](/posts/why-docker-container-exits-immediately)
- [Difference Between Running and Starting a Docker Container](/posts/docker-run-vs-docker-start)
- [How to Access a Docker Container's Shell](/posts/how-to-access-docker-container-shell)
- [Docker: Name is Already in Use by Container](/posts/docker-name-already-in-use)
- Practice in the browser: [Docker Terminal simulator](/games/docker-terminal-simulator)
