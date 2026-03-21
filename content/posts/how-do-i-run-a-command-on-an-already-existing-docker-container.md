---
title: 'How do I Run a Command on an Already Existing Docker Container?'
excerpt: "Need to run commands inside a Docker container that's already running? Here's how to use docker exec to debug, inspect, and interact with your containers."
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-11-17'
publishedAt: '2024-11-17T10:00:00Z'
updatedAt: '2024-11-17T10:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Containers
  - Debugging
  - DevOps
  - Troubleshooting
---

## TLDR

Use `docker exec` to run commands in running containers. For interactive shells, use `docker exec -it container_name /bin/bash` or `/bin/sh`. For one-off commands, use `docker exec container_name command`. This works only on running containers - for stopped containers, you need to start them first or use `docker run` with the same image.

You've got a container running and you need to peek inside to check logs, test something, or debug an issue. Maybe you want to verify a file exists, check environment variables, or run a diagnostic command. This is where `docker exec` comes in.

## Prerequisites

Before starting, you'll need:

- Docker installed and running
- At least one running container
- Basic command line knowledge
- Appropriate permissions to run Docker commands (or sudo access)

## Finding Your Container

First, you need to know which container you want to interact with. List all running containers:

```bash
docker ps
```

This shows containers that are currently running. You'll see output like:

```
CONTAINER ID   IMAGE          COMMAND                  CREATED         STATUS         PORTS                    NAMES
a8f3d2c1b9e4   nginx:latest   "nginx -g 'daemon of…"   10 minutes ago  Up 10 minutes  0.0.0.0:8080->80/tcp    web-server
7b2e9f8a3c1d   redis:alpine   "docker-entrypoint.s…"   2 hours ago     Up 2 hours     6379/tcp                cache
```

You can reference containers by either their ID (`a8f3d2c1b9e4`) or name (`web-server`). The name is usually easier to remember. If you don't see your container, it might be stopped. Use `docker ps -a` to see all containers, including stopped ones.

## Running a Single Command

To run one command and see its output, use `docker exec` with the container name and the command:

```bash
docker exec web-server ls /etc/nginx
```

This runs `ls /etc/nginx` inside the `web-server` container and prints the result to your terminal. The command executes in the container's environment with all its files, environment variables, and network configuration.

Here's a practical example - checking if a configuration file exists:

```bash
docker exec web-server cat /etc/nginx/nginx.conf
```

This displays the nginx configuration file from inside the container. You can use any command that's available in the container's image. If the container is based on Alpine Linux, you'll have minimal tools. If it's based on Ubuntu, you'll have more commands available.

## Opening an Interactive Shell

For debugging or exploration, you often want an interactive shell session. Use the `-it` flags:

```bash
docker exec -it web-server /bin/bash
```

The `-i` flag keeps STDIN open, and `-t` allocates a pseudo-TTY. Together, they give you an interactive terminal session. You'll see a prompt from inside the container:

```
root@a8f3d2c1b9e4:/#
```

Now you can run multiple commands, explore directories, edit files (if you have the tools), and debug issues. When you're done, type `exit` or press `Ctrl+D` to leave the container. The container continues running - you've only exited your shell session.

If your container doesn't have `/bin/bash` (common with minimal images like Alpine), use `/bin/sh` instead:

```bash
docker exec -it cache /bin/sh
```

This works because `sh` is available in almost all Linux containers, even minimal ones.

## Running Commands as a Different User

By default, `docker exec` runs commands as the user defined in the container's Dockerfile (often root). Sometimes you need to run commands as a specific user. Use the `--user` flag:

```bash
docker exec --user nginx web-server whoami
```

This runs `whoami` as the nginx user instead of root. You can specify users by name or by numeric UID:

```bash
docker exec --user 1000 web-server id
```

This is helpful when debugging permission issues or testing how your application behaves under different user contexts.

## Setting Environment Variables

If your command needs specific environment variables, you can set them with the `-e` flag:

```bash
docker exec -e DEBUG=true web-server node debug-script.js
```

This runs the Node.js script with the `DEBUG` environment variable set to `true`, separate from the container's default environment variables. You can set multiple variables:

```bash
docker exec -e VAR1=value1 -e VAR2=value2 web-server env | grep VAR
```

## Changing the Working Directory

Commands run in the working directory specified in the Dockerfile (set by `WORKDIR`). To run a command in a different directory, use the `--workdir` flag:

```bash
docker exec --workdir /app/logs web-server ls -la
```

This changes to `/app/logs` before running `ls -la`, which is cleaner than running `docker exec web-server sh -c 'cd /app/logs && ls -la'`.

## Common Use Cases

Here are practical scenarios where `docker exec` is essential:

Checking application logs when they're written to a file inside the container:

```bash
docker exec web-server tail -f /var/log/nginx/access.log
```

The `-f` flag follows the log file, showing new entries as they appear. Press `Ctrl+C` to stop following.

Verifying environment variables your application sees:

```bash
docker exec web-server env
```

This lists all environment variables in the container, helping you debug configuration issues.

Testing network connectivity from inside the container:

```bash
docker exec web-server ping -c 4 database-server
```

This pings another container or service using the container's network configuration, useful for diagnosing network issues.

Checking disk usage inside the container:

```bash
docker exec web-server df -h
```

This shows disk space from the container's perspective, including mounted volumes.

## What About Stopped Containers?

The `docker exec` command only works on running containers. If your container is stopped, you have two options.

First, you can start the container and then exec into it:

```bash
docker start web-server
docker exec -it web-server /bin/bash
```

If starting the container causes issues (maybe it immediately crashes), you can create a new container from the same image with a different command:

```bash
docker run -it --entrypoint /bin/bash nginx:latest
```

This creates a new container from the nginx image but overrides the entrypoint to run a shell instead of nginx. You won't have the exact state of your stopped container, but you'll have the same base image and can investigate issues.

For accessing files from a stopped container without starting it, use `docker cp`:

```bash
docker cp web-server:/etc/nginx/nginx.conf ./nginx.conf
```

This copies the file from the stopped container to your local machine.

## Running Commands in Privileged Mode

Sometimes you need to run commands that require elevated privileges beyond what the container normally has. Use the `--privileged` flag:

```bash
docker exec --privileged web-server strace -p 1
```

This gives the exec session extended privileges, allowing system calls like `strace` to work. Use this carefully - it reduces container isolation.

## Executing Scripts from Your Host Machine

You can pipe scripts into containers:

```bash
cat script.sh | docker exec -i web-server /bin/bash
```

The `-i` flag keeps STDIN open, allowing the container to read the script from the pipe. This is useful for running complex operations without copying files into the container first.

Or you can execute a single command that runs a script already inside the container:

```bash
docker exec web-server /app/scripts/maintenance.sh
```

## Debugging with Exec

When your application misbehaves, `docker exec` is your first debugging tool. Here's a systematic approach:

Check if the process is running:

```bash
docker exec web-server ps aux
```

This shows all processes in the container. If your main application isn't listed, it crashed.

Inspect configuration files:

```bash
docker exec web-server cat /app/config.json
```

Verify the configuration matches what you expect. Environment variables might have substituted unexpected values.

Test internal connections:

```bash
docker exec web-server curl http://localhost:8080/health
```

This tests HTTP endpoints from inside the container's network, helping isolate whether issues are with the application or external networking.

Check file permissions:

```bash
docker exec web-server ls -la /app/data
```

Permission issues often cause mysterious failures, especially when applications run as non-root users.

## Differences from Docker Run

It's important to understand how `docker exec` differs from `docker run`:

```
docker run     → Creates a NEW container from an image
docker exec    → Runs command in EXISTING container

docker run nginx:latest ls      → Creates container, runs ls, exits
docker exec web-server ls       → Runs ls in running web-server
```

When you `docker run`, you start fresh from the image. When you `docker exec`, you interact with a container's current state, seeing whatever changes happened since it started.

## Security Considerations

Running commands in containers can expose security risks. Keep these in mind:

Running as root (which `docker exec` often does by default) gives full control over the container. An attacker who compromises your exec session has complete container access.

Commands you run are logged in Docker's event stream. Avoid passing sensitive data as command arguments:

```bash
# Bad - password visible in logs
docker exec web-server mysql -pMyPassword123

# Better - password from environment or file
docker exec -e MYSQL_PASSWORD=$(cat secret.txt) web-server mysql
```

The `--privileged` flag breaks container isolation. Use it only when absolutely necessary and never in production without careful consideration.

## Practical Workflow Example

Here's how you might debug a web application that's returning errors:

```bash
# See if the container is running
docker ps | grep my-app

# Check application logs
docker exec my-app tail -100 /var/log/app/error.log

# Open an interactive shell for deeper investigation
docker exec -it my-app /bin/bash

# Inside the container, check if database is reachable
curl http://database:5432

# Check environment variables
env | grep DATABASE

# Test the application endpoint locally
curl http://localhost:3000/api/health

# Exit the shell
exit
```

This workflow moves from quick checks to interactive debugging, using `docker exec` to gather information without restarting the container.

## When Exec Isn't Enough

Sometimes `docker exec` won't solve your problem. If the container keeps crashing immediately, you can't exec into it because it's not running long enough. In these cases:

Check container logs without exec:

```bash
docker logs web-server
```

Start a new container with a shell instead of your application:

```bash
docker run -it --entrypoint /bin/bash my-image:latest
```

Inspect the container's filesystem by copying it out:

```bash
docker cp crashed-container:/app/logs ./investigation/
```

Or attach to a running container's output (though this doesn't let you run commands):

```bash
docker attach web-server
```

## Alternatives for Specific Tasks

For some common tasks, Docker provides specialized commands:

To view logs, use `docker logs` instead of execing and tailing files:

```bash
docker logs -f web-server
```

To copy files, use `docker cp` instead of execing cat and redirecting:

```bash
docker cp web-server:/app/config.json ./config.json
```

To inspect container configuration, use `docker inspect`:

```bash
docker inspect web-server
```

These specialized commands often work better than equivalent exec commands because they're designed for specific purposes.

The `docker exec` command is your primary tool for interacting with running containers. It's not just for debugging - you'll use it for routine maintenance, testing, and exploration. The key is understanding when to use a quick one-off command versus an interactive shell, and knowing the limitations when containers aren't running.

Once you're comfortable with `docker exec`, you'll find debugging containers much more straightforward. Combined with logs and inspect commands, you have everything you need to understand what's happening inside your containers.


## Related Resources

- [How to Access Docker Container Shell](/posts/how-to-access-docker-container-shell) — more shell methods
- [Enter Docker Container with New TTY](/posts/enter-docker-container-new-tty) — TTY sessions
- [Docker Edit File in Container](/posts/docker-edit-file-in-container) — modify files in-place
- [Introduction to Docker Guide](/guides/introduction-to-docker) — Docker fundamentals
