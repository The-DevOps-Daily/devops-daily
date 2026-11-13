---
title: 'Forward Host Port to Docker Container'
excerpt: 'Publish container ports with -p, bind them to localhost, add a port to a container that already runs, understand ports vs expose in Compose, connect to Postgres in a container, find a container IP, and connect containers from different Compose projects.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-06-24'
publishedAt: '2025-06-24T14:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '18 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Networking
  - Containers
  - Port Mapping
  - Docker Compose
  - DevOps
---

Docker containers run in isolated network environments by default, which means services running inside containers aren't accessible from your host machine or the outside world without explicit port forwarding. Understanding how to map ports between your host and containers is essential for accessing web applications, databases, APIs, and other containerized services.

This guide covers port publishing from the basic `-p` flag to the cases that cause the most questions: adding a port to a container that already runs, `ports` vs `expose` in Compose, connecting to a database in a container, finding a container's IP address, and letting containers from two Compose projects talk to each other.

## TLDR

- `docker run -p 8080:80 nginx` publishes container port 80 on host port 8080, on every host interface.
- `-p 127.0.0.1:8080:80` publishes it on the host's loopback address only. Use it for databases and admin tools.
- You cannot add or change a published port on an existing container. Create a new container with the port, or edit `ports:` in Compose and run `docker compose up -d`.
- In Compose, `ports:` opens a port on the host. `expose:` (and `EXPOSE` in a Dockerfile) only documents a port: containers on the same network can always reach each other.
- Containers on the same user-defined network reach each other by name. Use a shared external network for two Compose projects.

## Prerequisites

You need Docker installed and basic familiarity with running containers. Understanding of network ports and how services listen on ports will help.

## Basic Port Forwarding

The `-p` flag maps a host port to a container port.

### Syntax

```bash
docker run -p <host-port>:<container-port> <image>
```

Example - running Nginx:

```bash
# Map host port 8080 to container port 80
docker run -p 8080:80 nginx
```

Now access Nginx at `http://localhost:8080` on your host machine. Inside the container, Nginx listens on port 80, but you access it via 8080 on your host.

The app inside the container must listen on `0.0.0.0` (all interfaces), not on `127.0.0.1`. A server bound to the container's loopback address accepts no connections through the published port, and you get "connection reset" or an empty reply. Many development servers default to `127.0.0.1`: start them with `--host 0.0.0.0` or the equivalent.

### Multiple Port Mappings

Map multiple ports with multiple `-p` flags:

```bash
# Map both HTTP and HTTPS
docker run -p 8080:80 -p 8443:443 nginx
```

Or forward a range of ports:

```bash
# Map ports 8080-8090 to 80-90
docker run -p 8080-8090:80-90 myapp
```

Both ranges must have the same length. A host range with a single container port works differently: Docker takes the first free host port in the range, so you can start several copies with the same command. Each mapping gets an IPv4 and an IPv6 entry:

```terminal
{
  "title": "port ranges",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker run -d --name multi -p 8080-8082:80-82 nginx:1.30 && docker port multi",
      "output": "fe1cd3a23ddf497824ed6979a532356c103d9c3b194630502a5f408eb6fdecfb\n80/tcp -> 0.0.0.0:8080\n80/tcp -> [::]:8080\n81/tcp -> 0.0.0.0:8081\n81/tcp -> [::]:8081\n82/tcp -> 0.0.0.0:8082\n82/tcp -> [::]:8082"
    },
    {
      "cmd": "docker run -d --name bad -p 8090-8092:80-81 nginx:1.30",
      "output": "docker: invalid ranges specified for container and host Ports: 80-81 and 8090-8092\n\nRun 'docker run --help' for more information"
    },
    {
      "comment": "one container port, a host range: each copy gets the next free port",
      "cmd": "docker run -d --name pick1 -p 9000-9005:80 nginx:1.30 && docker run -d --name pick2 -p 9000-9005:80 nginx:1.30 && docker port pick1 && docker port pick2",
      "output": "b613895d866b821066f6b10e5e18d6b36c94cffc15ed91d9521eadd9dd83839d\n0d95da3d09065b1a66bc2df8f436582755431d92cfdfbc9a80a012a2994acb83\n80/tcp -> 0.0.0.0:9000\n80/tcp -> [::]:9000\n80/tcp -> 0.0.0.0:9001\n80/tcp -> [::]:9001"
    },
    {
      "cmd": "docker run -d --name same -p 8080:80 nginx:1.30",
      "output": "3b128230f7ecf06c84fbab1c35a295eeb1554e06eaead755daf6dc7754ee60ce\ndocker: Error response from daemon: failed to set up container networking: driver failed programming external connectivity on endpoint same (bd922ad55b18428d862300f3f651d706803d6fc2bfbc1f9095d9687c204edf79): Bind for 0.0.0.0:8080 failed: port is already allocated\n\nRun 'docker run --help' for more information"
    }
  ]
}
```

The last command prints a container ID before the error: Docker created the container and then failed to start it, so `docker ps -a` still lists it. Remove it with `docker rm same` before you reuse the name.

In a Dockerfile, one `EXPOSE` line can list several ports, with `/udp` where needed. `-P` then publishes every exposed port, the ones from the base image included:

```dockerfile
FROM nginx:1.30
EXPOSE 8443 9229/tcp 5353/udp
```

```terminal
{
  "title": "EXPOSE several ports, publish them all with -P",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker build -q -t multi-expose .",
      "output": "sha256:a5311be4152a33d8511dd673d1f0c683434e245c909d5c2e24310a5d2b855edb"
    },
    {
      "cmd": "docker image inspect -f '{{json .Config.ExposedPorts}}' multi-expose",
      "output": "{\"5353/udp\":{},\"80/tcp\":{},\"8443/tcp\":{},\"9229/tcp\":{}}"
    },
    {
      "cmd": "docker run -d --name allports -P multi-expose && docker port allports",
      "output": "23a76b5c5fa729b9816344e5c73fb73911c9dbc6e3e7c0af48bb520882bbc322\n80/tcp -> 0.0.0.0:32768\n80/tcp -> [::]:32768\n5353/udp -> 0.0.0.0:32768\n5353/udp -> [::]:32768\n8443/tcp -> 0.0.0.0:32769\n8443/tcp -> [::]:32769\n9229/tcp -> 0.0.0.0:32770\n9229/tcp -> [::]:32770"
    }
  ]
}
```

`80/tcp` comes from the `nginx` base image. TCP and UDP have separate port spaces, so `80/tcp` and `5353/udp` can both get host port 32768. These outputs are from Docker Engine 28.0.4.

## Publishing All Exposed Ports

Images can declare ports with `EXPOSE` in their Dockerfile. Use `-P` (capital P) to automatically map all exposed ports to random high ports on the host:

```bash
docker run -P nginx
```

Check which ports were assigned:

```bash
docker port <container-name>
```

Output:

```
80/tcp -> 0.0.0.0:32768
80/tcp -> [::]:32768
```

Nginx's port 80 is mapped to host port 32768. `docker port <container-name> 80` prints the mapping for one port, and `docker ps` shows the same in its `PORTS` column.

## Binding to Specific Interfaces

By default, `-p 8080:80` binds to all network interfaces (`0.0.0.0` and `::`), making the service accessible from other machines. Bind to specific interfaces for security:

### Localhost Only

```bash
# Only accessible from the host machine
docker run -p 127.0.0.1:8080:80 nginx
```

Now `http://localhost:8080` works, but external machines can't connect.

### Specific IP Address

```bash
# Bind to specific network interface
docker run -p 192.168.1.100:8080:80 nginx
```

The service is only accessible via the specified IP address.

### Published Ports and the Host Firewall

On Linux, Docker writes its own `iptables` rules for published ports. Those rules see the traffic before `ufw` or `firewalld` rules for the host, so a port published on `0.0.0.0` can be reachable from the internet even when `ufw` blocks it. Two fixes:

- Publish only on `127.0.0.1` (or a private address) when the port is not for the public.
- Add filter rules to the `DOCKER-USER` chain, which Docker evaluates before its own rules. The [Docker packet filtering docs](https://docs.docker.com/engine/network/packet-filtering-firewalls/) show examples.

## UDP Port Forwarding

Specify the protocol for UDP services:

```bash
# Forward UDP port
docker run -p 5353:53/udp dns-server

# Forward both TCP and UDP
docker run -p 8080:80/tcp -p 5353:53/udp myapp
```

## Docker Compose Port Mapping

In `compose.yaml`, use the `ports` section:

```yaml
services:
  web:
    image: nginx:1.30
    ports:
      - '8080:80'
      - '8443:443'

  database:
    image: postgres:18
    ports:
      - '127.0.0.1:5432:5432'

  app:
    image: myapp
    ports:
      - '3000-3005:3000-3005'
```

Start services:

```bash
docker compose up -d
```

All port mappings are applied automatically. `docker compose ps` and `docker compose port web 80` show what was published. Quote the mappings: YAML reads some unquoted values such as `22:22` as numbers in base 60.

### Short vs Long Syntax

Docker Compose supports both syntaxes:

**Short syntax:**

```yaml
ports:
  - '8080:80'
  - '127.0.0.1:5432:5432'
```

**Long syntax (more explicit):**

```yaml
ports:
  - target: 80 # Container port
    published: '8080' # Host port
    protocol: tcp

  - target: 5432
    published: '5432'
    host_ip: 127.0.0.1
```

## What Is the Difference Between ports and expose in Docker Compose?

`ports:` publishes a container port on the host, so your browser, `psql` or another machine can reach it. `expose:` does not publish anything. It records which ports the service listens on, for people and for tools. Containers on the same Compose network reach each other on **any** port, with or without `expose:`.

```yaml
services:
  proxy:
    image: nginx:1.30
    ports:
      - '80:80' # reachable from the host and the network
      - '443:443'

  api:
    image: myorg/api:1.4
    expose:
      - '8000' # documentation only: proxy reaches api:8000 anyway

  db:
    image: postgres:18
    environment:
      POSTGRES_PASSWORD: change-me
    # no ports: other hosts cannot reach the database, containers on this network can
```

With an nginx config that sends requests to `http://api:8000` (a `location` block with `proxy_pass`, mounted into the proxy), the proxy reaches the API and the API connects to `db:5432`, both by service name. Nothing except the proxy is reachable from other machines. On a Linux host, the host itself can still reach container addresses directly. That is the layout to aim for: publish the entry point, keep the rest internal.

### What Is the Difference Between EXPOSE and --publish?

The same split exists outside Compose. `EXPOSE` in a Dockerfile, like `expose:` in a Compose file, only records which ports the app listens on. `docker run --publish` (`-p`), like `ports:`, is what opens a port on the host:

```bash
# Host port 8080 to container port 80
docker run -d -p 8080:80 nginx:1.30

# Only on the host's loopback address, not on every interface
docker run -d -p 127.0.0.1:8080:80 nginx:1.30
```

`EXPOSE` changes one thing at run time: `docker run -P` (`--publish-all`) publishes every exposed port to a random free host port. The nginx image exposes port 80:

```terminal
{
  "title": "EXPOSE plus -P",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker image inspect -f '{{json .Config.ExposedPorts}}' nginx:1.30",
      "output": "{\"80/tcp\":{}}"
    },
    {
      "cmd": "docker run -d --name web -P nginx:1.30",
      "output": "2c8353cf76fed2dbbf4aedec77bbec2de2476c3d3b187c08ffc0c462816bb93b"
    },
    {
      "cmd": "docker port web",
      "output": "80/tcp -> 0.0.0.0:32768\n80/tcp -> [::]:32768"
    }
  ]
}
```

Leaving `EXPOSE` out does not block anything. We started `python -m http.server 9000` from the `python:3.13-alpine` image, which exposes no ports (`ExposedPorts` is `null`), and another container on the same network still got `200` from `http://api:9000/`. Publish only the ports that people outside the host need. On Linux, Docker writes its own firewall rules for published ports, so a port published on `0.0.0.0` can be reachable even when `ufw` blocks it; bind it to `127.0.0.1` when only the host should reach it.

### Different Ports for Development and Production

Keep the production file minimal, and publish extra ports for debugging in an override file that only developers use:

```yaml
# compose.override.yaml: merged automatically by "docker compose up"
services:
  db:
    ports:
      - '127.0.0.1:5432:5432' # local psql and GUI tools
```

`docker compose up` reads `compose.yaml` and `compose.override.yaml` together. In production, run `docker compose -f compose.yaml up -d` to leave the override out, or keep a separate `compose.prod.yaml` and pass both files with `-f`.

## How Do I Add a Port to a Running Container?

You cannot. Docker sets up port publishing when it creates the container, and there is no command to add or change a mapping later. `docker update` does not change ports either. The fix is to create a new container with the port:

```bash
# 1. Look up the current settings, so the new container matches
docker inspect -f '{{.Config.Image}} {{json .HostConfig.PortBindings}} {{json .Mounts}}' web

# 2. Replace the container. Data in volumes stays; data in the writable layer does not.
docker stop web
docker rename web web-old
docker run -d --name web -p 8080:80 -v site-data:/usr/share/nginx/html nginx:1.30

# 3. When the new one works, remove the old one
docker rm web-old
```

With Compose, add the mapping under `ports:` and run `docker compose up -d`. Compose notices the changed config and recreates that one service.

If the old container holds data in its writable layer that you need, copy it out before you remove it ([add a volume to an existing container](/posts/docker-data-loss-when-container-exits#h2-how-do-i-add-a-volume-to-an-existing-docker-container) shows how). `docker commit web web-snapshot` also keeps the files and the container's config, but not the contents of its volumes, and the result is an image nobody can rebuild. Use it only as a last resort.

**A temporary forward without recreating anything.** Run a small proxy container on the same network as the target and publish the port on the proxy:

```bash
# Find the target's network (the default bridge is called "bridge")
docker inspect -f '{{range $name, $net := .NetworkSettings.Networks}}{{$name}} {{end}}' web

# On a user-defined network, forward host port 8080 to web:80 by name
docker run -d --name web-forward --network mynet -p 8080:8080 \
  alpine/socat TCP-LISTEN:8080,fork,reuseaddr TCP:web:80
```

Containers on the default `bridge` network have no DNS names. Use the target's IP there (see [find a container's IP](#h2-how-do-i-get-a-docker-containers-ip-address-from-the-host)), or connect the target to a user-defined network first with `docker network connect mynet web`. You cannot publish a port on a container that uses `--network container:web`: Docker rejects port publishing in that network mode, so the proxy needs its own network namespace as above. Remove the proxy when you have recreated the container properly.

A reverse proxy such as nginx, Caddy or Traefik in front of your containers is the long-term version of this idea: one published port, and routes to containers on internal networks.

## How Do I Connect to PostgreSQL in a Docker Container From the Host?

Publish port 5432 when you start the container, then connect to `localhost`:

```bash
docker run -d --name pg \
  -e POSTGRES_PASSWORD=change-me \
  -e POSTGRES_DB=appdb \
  -p 127.0.0.1:5432:5432 \
  -v pgdata:/var/lib/postgresql \
  postgres:18

psql "postgresql://postgres:change-me@localhost:5432/appdb" -c 'select version();'
```

The same in Compose:

```yaml
services:
  db:
    image: postgres:18
    environment:
      POSTGRES_PASSWORD: change-me
      POSTGRES_DB: appdb
    ports:
      - '127.0.0.1:5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      retries: 5

volumes:
  pgdata:
```

You do not need to change `listen_addresses` or `pg_hba.conf` for this. The official image already listens on all addresses inside the container and accepts password logins from other hosts, which is why `-p` alone is enough. It is also why a port published on `0.0.0.0` is a risk: anyone who can reach the host can try passwords. Keep `127.0.0.1` unless another machine must connect.

When another machine must connect:

1. Publish on an address that machine can reach: `-p 5432:5432`, or `-p 10.0.0.5:5432:5432` for one private interface.
2. Allow only the client's network. Remember that `ufw` rules do not filter published ports (see [the firewall section](#h3-published-ports-and-the-host-firewall)), so filter in `DOCKER-USER` or in your cloud firewall.
3. To limit logins inside Postgres too, mount your own `pg_hba.conf` outside the data directory and point the server at it:

```bash
cat > pg_hba.conf <<'EOF'
# TYPE  DATABASE  USER  ADDRESS          METHOD
local   all       all                    trust
host    all       all   127.0.0.1/32     scram-sha-256
host    all       all   10.0.0.0/24      scram-sha-256
EOF

docker run -d --name pg -e POSTGRES_PASSWORD=change-me -p 10.0.0.5:5432:5432 \
  -v pgdata:/var/lib/postgresql \
  -v "$(pwd)/pg_hba.conf":/etc/postgresql/pg_hba.conf:ro \
  postgres:18 -c hba_file=/etc/postgresql/pg_hba.conf
```

Do not bind-mount the file into the data directory: on the first start the image must create the database cluster in an empty directory.

Common problems:

- **`password authentication failed` after you changed `POSTGRES_PASSWORD`.** The variable only applies when the image creates a new cluster. With an existing volume, the old password stays. Change it with `ALTER USER postgres PASSWORD '...'`, or remove the volume if the data does not matter.
- **Port 5432 is already in use.** A Postgres on the host often has it. Publish another host port, `-p 127.0.0.1:15432:5432`, and connect to port 15432.
- **Connection refused right after start.** The first start initializes the cluster, which takes a few seconds. Wait for `database system is ready to accept connections` in `docker logs pg`, or for the health check.
- **From another container**, do not publish at all. Put both on one user-defined network and connect to `pg:5432` by name.

## How Do I Get a Docker Container's IP Address From the Host?

Ask `docker inspect` for the address on each network the container is attached to:

```bash
docker inspect -f '{{range $name, $net := .NetworkSettings.Networks}}{{$name}}: {{$net.IPAddress}}{{"\n"}}{{end}}' web
# bridge: 172.17.0.2
```

Things to know before you use that address:

- **It works from a Linux Docker host.** On Docker Desktop (macOS and Windows), the containers run inside a VM, and their IPs are not reachable from your Mac or PC. Publish a port instead.
- **It changes.** A container gets a new address when it is recreated, and often after a restart. Do not put it in config files.
- **Other machines cannot use it.** The address belongs to a bridge network on the host, and by default Docker does not let other hosts reach container addresses directly. They can only reach ports published on the host's addresses.
- **Other containers on the same network can use it**, but a name is better: on a user-defined network, Docker's DNS resolves container names and Compose service names.

```bash
docker network create mynet
docker run -d --name api --network mynet myorg/api:1.4
docker run --rm --network mynet alpine:3.24 wget -qO- http://api:8000/health
```

For the reverse direction, from a container to a service on the host, see [connect to the host's localhost from a container](/posts/connect-to-host-localhost-from-docker) and [get the host's IP from inside a container](/posts/how-to-get-docker-host-ip-from-container).

## How Do Containers in Different Compose Projects Talk to Each Other?

Each Compose project gets its own default network, so the services of project A cannot resolve the services of project B. Attach both to one shared network. Create it once:

```bash
docker network create shared
```

Then declare it as external in both Compose files, and attach the services that must talk:

```yaml
# project-a/compose.yaml
services:
  app:
    image: myorg/app:2.0
    networks:
      - default # keep the project's own network too
      - shared
    environment:
      DB_HOST: db # the service name in project B

networks:
  shared:
    external: true
```

```yaml
# project-b/compose.yaml
services:
  db:
    image: postgres:18
    environment:
      POSTGRES_PASSWORD: change-me
    networks:
      - default
      - shared

networks:
  shared:
    external: true
```

Run `docker compose up -d` in each directory. `app` now reaches `db:5432` by its service name. Check it with `docker compose exec app getent hosts db`, or with `ping`/`nslookup` if the image has them.

- **`external: true` means Compose does not create or delete the network.** `docker compose up` fails with `network shared declared as external, but could not be found` until you create it, and `docker compose down` leaves it in place.
- **Service names can collide.** If both projects have a service called `db` on the shared network, the name resolves to both. Give one a unique alias on the shared network:

```yaml
services:
  db:
    networks:
      shared:
        aliases:
          - billing-db
```

- **An existing container** joins with `docker network connect shared <container>`, without a restart.

## Checking Port Mappings

View port mappings for a running container:

```bash
# Using docker ps
docker ps

# Using docker port
docker port <container-name>

# Using docker inspect
docker inspect -f '{{json .NetworkSettings.Ports}}' <container-name>
```

Example output:

```json
{ "80/tcp": [{ "HostIp": "0.0.0.0", "HostPort": "8080" }] }
```

## Troubleshooting Port Conflicts

### Port Already in Use

Docker reports a busy port in one of two ways:

```text
Bind for 0.0.0.0:8080 failed: port is already allocated
failed to bind host port for 0.0.0.0:8080:172.17.0.2:80/tcp: address already in use
```

The first means another container publishes that port: `docker ps --filter publish=8080` finds it. The second means a process on the host uses it. Find what's using the port:

```bash
# Linux
sudo ss -tlnp | grep :8080

# Linux and macOS
sudo lsof -i :8080
```

Solutions:

1. **Use a different host port:**

   ```bash
   docker run -p 8081:80 nginx
   ```

2. **Stop the conflicting service:**

   ```bash
   sudo systemctl stop apache2
   docker run -p 80:80 nginx
   ```

### Container Port Not Responding

Check that the service inside the container listens on the port you published, and on `0.0.0.0`:

```bash
# Many slim images have no ss or netstat: borrow them from a debug container
docker run --rm --network container:mycontainer nicolaka/netshoot ss -tlnp

# Send a request from inside the container's network namespace
docker run --rm --network container:mycontainer nicolaka/netshoot curl -sI http://localhost:80
```

If the process listens on `127.0.0.1:80` only, change its bind address. If it does not listen at all, read `docker logs mycontainer`. [Missing tools in a container](/posts/how-to-access-docker-container-shell#h2-what-if-ps-ping-or-other-tools-are-missing-in-a-container) explains the debug-container trick.

### Reachable Locally but Not From Other Machines

Check the address in `docker port`: `127.0.0.1:8080` is local by design. For `0.0.0.0`, check the cloud firewall or security group and the `DOCKER-USER` chain. Opening the port in `ufw` has no effect on published ports, as explained [above](#h3-published-ports-and-the-host-firewall).

## Docker Networks and Port Forwarding

Containers on the same Docker network can communicate without port forwarding:

```bash
# Create a network
docker network create mynetwork

# Run database (no port forwarding needed)
docker run -d --network mynetwork --name db -e POSTGRES_PASSWORD=change-me postgres:18

# Run app (connects to 'db' by name)
docker run -d --network mynetwork --name app -p 8080:80 myapp
```

Inside `myapp`, connect to the database at `postgresql://db:5432` - no port forwarding needed because they're on the same network. This name resolution only works on user-defined networks, not on the default `bridge` network.

## Host Network Mode

Skip Docker networking entirely and use the host's network:

```bash
docker run --network host nginx
```

In host mode:

- No port mapping needed, and `-p` is ignored
- Container uses host ports directly
- Service on container port 80 is accessible at host port 80
- Less isolation but simpler networking

Use case: tools that must see the host's interfaces, or when the NAT step for published ports costs too much. Host networking is a Linux feature. On Docker Desktop it is limited, so check the Docker Desktop docs before you rely on it.

## Best Practices

**Don't expose databases publicly**: Always bind database ports to localhost:

```bash
docker run -p 127.0.0.1:5432:5432 -e POSTGRES_PASSWORD=change-me postgres:18
```

**Ports below 1024**: the normal Docker daemon runs as root, so `docker run -p 80:80 nginx` works without `sudo` for any user who may use Docker. Rootless Docker cannot publish ports below 1024 unless you change the `net.ipv4.ip_unprivileged_port_start` sysctl.

**Document your port mappings**: In your README or Compose file comments:

```yaml
services:
  app:
    ports:
      - '3000:3000' # Web UI
      - '127.0.0.1:9229:9229' # Node.js debugger, local only
```

**Publish one entry point**: put a reverse proxy on 80 and 443, and keep the other services on internal networks.

**Plan your port allocation**: Maintain a list of ports used by different containers to avoid conflicts.

Port forwarding is fundamental to using Docker effectively. Use `-p` for basic mapping, bind sensitive services like databases to localhost only, use networks and service names between containers, and remember that a new port means a new container.

## Related Resources

- [Docker: connect to the host's localhost from a container](/posts/connect-to-host-localhost-from-docker): the reverse direction
- [How to access a host port from a container](/posts/docker-access-host-port): host access patterns
- [Introduction to Docker: Networking](/guides/introduction-to-docker/07-networking-in-docker): drivers, DNS and internal networks
- [Packet journey simulator](/games/packet-journey): follow a request through NAT and routing
- [Docker terminal simulator](/games/docker-terminal-simulator): practice `-p`, `docker port` and networks
- [Docker security checklist](/checklists/docker-security): what to check before you publish a port
