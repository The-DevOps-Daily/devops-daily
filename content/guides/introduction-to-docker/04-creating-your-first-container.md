---
title: Creating Your First Container
description: Learn how to run, manage, and interact with Docker containers
order: 4
---

Now that you understand Docker images, it's time to use them to run containers. A container is a runnable instance of an image, it's what you actually deploy and use in your applications. In this section, you'll learn how to run, manage, and work with Docker containers.

## Running Your First Container

Let's start with a simple container using the nginx web server image you pulled in the previous section:

```bash
docker run nginx:latest
```

Running this command:

1. Creates a new container from the nginx:latest image
2. Starts the container
3. Attaches your terminal to the container's stdout/stderr

You'll see the nginx logs in your terminal:

```
/docker-entrypoint.sh: /docker-entrypoint.d/ is not empty, will attempt to perform configuration
/docker-entrypoint.sh: Looking for shell scripts in /docker-entrypoint.d/
...
```

This container is running in the foreground. To stop it, press `Ctrl+C`.

## Running Containers in Detached Mode

For most scenarios, you'll want to run containers in the background (detached mode):

```bash
docker run -d nginx:latest
```

The `-d` flag tells Docker to run the container in the background. Docker responds with a container ID:

```
7d14a361fe7c3a2ad868184c0ac7a112bc2eb2ee424fa6c8a3a52c6c8afb2dfe
```

## Naming Containers

By default, Docker assigns random names to containers. You can specify a name with the `--name` flag:

```bash
docker run -d --name my-nginx nginx:latest
```

Using a meaningful name makes it easier to reference the container in other commands.

## Listing Running Containers

To see all running containers:

```bash
docker ps
```

Example output:

```
CONTAINER ID   IMAGE          COMMAND                  CREATED         STATUS         PORTS     NAMES
d292c4f70394   nginx:latest   "/docker-entrypoint.…"   9 seconds ago   Up 8 seconds   80/tcp    my-nginx
```

To see all containers, including stopped ones:

```bash
docker ps -a
```

## Exposing Container Ports

Containers have their own isolated network. To access a container's services from your host, you need to publish ports using the `-p` flag:

```bash
docker run -d --name web-server -p 8080:80 nginx:latest
```

This maps port 80 inside the container to port 8080 on your host. You can now access nginx by visiting `http://localhost:8080` in your browser.

The format for port mapping is `-p host_port:container_port`.

You can map multiple ports:

```bash
docker run -d --name web-app -p 8080:80 -p 8443:443 nginx:latest
```

## Viewing Container Logs

To view the logs from a container:

```bash
docker logs my-nginx
```

For continuous monitoring, add the `-f` (follow) flag:

```bash
docker logs -f my-nginx
```

This streams new logs as they are generated. Press `Ctrl+C` to stop following.

## Executing Commands in Running Containers

Sometimes you need to run commands inside a running container. Use the `exec` command for this:

```bash
docker exec -it my-nginx bash
```

The flags `-it` mean:

- `-i`: Keep STDIN open (interactive)
- `-t`: Allocate a pseudo-TTY

This gives you a bash shell inside the container where you can run commands:

```
root@d292c4f70394:/# ls
bin   dev                  docker-entrypoint.sh  home  lib64  mnt  proc  run   srv  tmp  var
boot  docker-entrypoint.d  etc                   lib   media  opt  root  sbin  sys  usr
```

Type `exit` to leave the container shell.

## Stopping and Starting Containers

To stop a running container:

```bash
docker stop my-nginx
```

This sends a SIGTERM signal to the main process, giving it time to shut down gracefully.

To force an immediate stop:

```bash
docker kill my-nginx
```

To restart a stopped container:

```bash
docker start my-nginx
```

## Restarting Containers

Docker containers can be configured to automatically restart when they exit or when Docker restarts. Use the `--restart` flag when creating a container:

```bash
docker run -d --restart always --name always-up nginx:latest
```

Restart policies:

- `no`: Do not restart (default)
- `on-failure[:max-retries]`: Restart only if the container exits with a non-zero status
- `always`: Always restart regardless of exit status
- `unless-stopped`: Always restart unless explicitly stopped

## Environment Variables

Many containers can be configured using environment variables:

```bash
docker run -d --name custom-nginx -e NGINX_HOST=example.com -e NGINX_PORT=80 nginx:latest
```

The `-e` flag sets an environment variable inside the container.

## Cleaning Up Containers

To remove a stopped container:

```bash
docker rm my-nginx
```

To force remove a running container:

```bash
docker rm -f my-nginx
```

To remove all stopped containers:

```bash
docker container prune
```

## Using Volumes with Containers

Containers are ephemeral, when they're removed, any data written inside the container is lost. For persistent data, use volumes:

```bash
docker run -d --name nginx-with-data -v nginx-data:/usr/share/nginx/html nginx:latest
```

This creates a volume named `nginx-data` and mounts it at `/usr/share/nginx/html` inside the container.

We'll cover volumes in more detail in a later section.

## Container Resource Limits

You can limit the resources a container can use:

```bash
docker run -d --name limited-nginx --cpus 0.5 --memory 512m nginx:latest
```

This limits the container to using 50% of one CPU core and 512MB of memory.

## Container Health Checks

Health checks help Docker determine if a container is functioning properly:

```bash
docker run -d --name healthy-nginx --health-cmd="curl -f http://localhost/ || exit 1" --health-interval=5s nginx:latest
```

This runs the specified command every 5 seconds to check if the container is healthy.

## Container Networking

Containers can communicate with each other through Docker networks. The simplest way is to use the default bridge network:

```bash
docker run -d --name db postgres:13
docker run -d --name web --link db:database -p 8080:80 mywebapp:latest
```

The `--link` flag creates a link from the web container to the db container, allowing them to communicate. The web container can reach the database using the hostname `database`.

We'll cover networking in more detail in a later section.

## Monitoring Container Resource Usage

To see the resource usage of your containers:

```bash
docker stats
```

This shows a live stream of CPU, memory, network, and disk usage for each container.

## Practical Example: Running a WordPress Site

Let's put it all together with a practical example. This command runs a WordPress container linked to a MySQL database:

```bash
# First, create a network
docker network create wordpress-net

# Run MySQL container
docker run -d --name wordpress-db \
  --network wordpress-net \
  -e MYSQL_ROOT_PASSWORD=my-secret-pw \
  -e MYSQL_DATABASE=wordpress \
  -e MYSQL_USER=wordpress \
  -e MYSQL_PASSWORD=wordpress \
  mysql:5.7

# Run WordPress container
docker run -d --name wordpress-site \
  --network wordpress-net \
  -e WORDPRESS_DB_HOST=wordpress-db \
  -e WORDPRESS_DB_USER=wordpress \
  -e WORDPRESS_DB_PASSWORD=wordpress \
  -e WORDPRESS_DB_NAME=wordpress \
  -p 8080:80 \
  wordpress:latest
```

After running these commands, you can access your WordPress site at http://localhost:8080.

## Development Environments in the Cloud

For development teams, running Docker containers in the cloud provides a consistent environment accessible to everyone. DigitalOcean offers an excellent platform for this with fast SSD-based Droplets optimized for container workloads.

[Sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) to get $200 in free credits and deploy your containerized applications to the cloud.

In the next section, we'll learn how to build your own custom Docker images with Dockerfiles.
