---
title: 'Docker Networking: Bridge Networks, Port Publishing and DNS'
description: 'Connect containers with Docker networks: user-defined bridges with DNS, port publishing and its firewall trap, host and none networks, and debugging.'
order: 7
---

hello-api needs to reach its Postgres database, and your browser needs to reach hello-api. Both are networking problems, and Docker solves them with two different tools: **networks** connect containers to each other, and **published ports** connect the outside world to a container. In this part you put hello-api and its database on a user-defined network, reach them by name, publish only what must be public, and learn how to debug a container that cannot connect.

## Prerequisites

- The `hello-db` container from [Part 6](/guides/introduction-to-docker/06-working-with-docker-volumes), still running, and the `hello-api:1.0` image from [Part 5](/guides/introduction-to-docker/05-building-custom-docker-images).
- Port 8000 free on your machine.

The commands in this part need a running daemon, so their output is shown as examples; IDs and addresses differ on your machine.

## Network Drivers

Every container joins one or more networks. A **driver** decides what kind of network it is:

| Driver              | What it does                                                                       |
| ------------------- | ---------------------------------------------------------------------------------- |
| `bridge`            | A private virtual network on one host, with NAT to the outside. The default.       |
| `host`              | No network isolation: the container uses the host's interfaces and ports directly. |
| `none`              | Only a loopback interface.                                                         |
| `overlay`           | A network that spans several Docker hosts in a Swarm cluster.                      |
| `macvlan`, `ipvlan` | The container gets its own address on your physical LAN, like another machine.     |

A fresh installation has three networks:

```bash
docker network ls
```

```text
NETWORK ID     NAME      DRIVER    SCOPE
1d3f0a6c2b8e   bridge    bridge    local
7a2c94e1f05d   host      host      local
c4b8e2d19a70   none      null      local
```

## The Default Bridge vs a User-Defined Bridge

Containers you start without `--network` join the network called `bridge` (the `docker0` interface on the host, usually `172.17.0.0/16`). It works, but it is the legacy option:

- **No DNS for container names.** Containers on the default bridge can reach each other only by IP address, and addresses change when containers restart.
- **No isolation between unrelated apps.** Everything you start without `--network` shares it.

A **user-defined bridge network** fixes both. Docker runs an embedded DNS server (at `127.0.0.11` inside each container) that resolves container names and network aliases to their current addresses, and only containers you attach to the network can reach each other. Always create your own network for an application.

## Connect hello-api to Postgres

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "curl / browser", "icon": "globe", "tone": "slate" },
    { "label": "127.0.0.1:8000", "sub": "published port", "icon": "net", "tone": "amber" },
    { "label": "hello-api :8000", "icon": "box", "tone": "blue" },
    { "label": "hello-db :5432", "icon": "database", "tone": "violet" }
  ],
  "groups": [
    {
      "label": "Docker host",
      "icon": "server",
      "tone": "slate",
      "groups": [
        {
          "label": "hello-net",
          "sub": "user-defined bridge, DNS by container name",
          "icon": "net",
          "tone": "accent",
          "nodes": [
            { "label": "hello-api", "sub": "DB_HOST=hello-db", "icon": "box", "tone": "blue" },
            { "label": "hello-db", "sub": "postgres:18, no published port", "icon": "database", "tone": "violet" }
          ]
        }
      ]
    }
  ]
}
```

Create the network and attach the running database to it. `docker network connect` works on running containers, so the database keeps running:

```bash
docker network create hello-net
docker network connect hello-net hello-db
```

Start hello-api on the same network. It finds the database by its container name, `hello-db`, which is why the app reads `DB_HOST` from the environment:

```bash
docker run -d --name hello-api \
  --network hello-net \
  -p 127.0.0.1:8000:8000 \
  -e DB_HOST=hello-db \
  -e DB_USER=hello -e DB_NAME=hello -e DB_PASSWORD=change-me \
  hello-api:1.0
```

Try it (example output):

```bash
curl -s localhost:8000/ready
curl -s localhost:8000/visits
curl -s localhost:8000/visits
```

```text
{"status":"ready"}
{"visits":1}
{"visits":2}
```

The database has no published port, so nothing outside the host can reach it, and hello-api still can, over `hello-net`. Check name resolution from inside the app container. The slim image has no `ping` or `dig`, but `getent` (part of the C library tools) is always there:

```bash
docker exec hello-api getent hosts hello-db
docker network inspect hello-net \
  --format '{{range .Containers}}{{.Name}} {{.IPv4Address}}{{"\n"}}{{end}}'
```

Example output:

```text
172.18.0.2      hello-db
hello-db 172.18.0.2/16
hello-api 172.18.0.3/16
```

hello-db is still on the default `bridge` network too, from when you started it in Part 6. Disconnect it to keep it off the shared network: `docker network disconnect bridge hello-db`.

**Aliases.** A container can have extra DNS names on a network. Set them when you connect the container, for example `docker network connect --alias db hello-net hello-db` instead of the plain `connect` above, or with `--network-alias db` on `docker run`. A second `connect` to a network the container is already on fails, so to add an alias later, disconnect and connect again. Compose gives every service its service name as an alias, which is why the app's default `DB_HOST` is `db` ([Part 8](/guides/introduction-to-docker/08-docker-compose)).

## Publishing Ports

A published port forwards traffic from a host address to a container port. `-p 127.0.0.1:8000:8000` above publishes on the loopback address only: you can reach hello-api from the host, but not from other machines. Compare the forms:

| Flag                        | Reachable from                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `-p 8000:8000`              | Every interface of the host, IPv4 and IPv6: the whole network                                                              |
| `-p 127.0.0.1:8000:8000`    | Only the host itself                                                                                                       |
| `-p 192.168.1.20:8000:8000` | Only that host address                                                                                                     |
| no `-p`                     | Containers on the same Docker network, and with rootful Docker on Linux the host itself through the container's IP address |

Publish the minimum. A database almost never needs a published port in production: the app reaches it over the Docker network, and you can use `docker exec hello-db psql ...` for admin work.

:::warning
**Published ports bypass `ufw` and `firewalld`.** Docker writes iptables rules that send traffic for published ports to containers before the host firewall's rules see it. `ufw deny 8000` does not block `-p 8000:8000`. Publish on `127.0.0.1` when only the host needs the port, put a reverse proxy in front of the services that must be public, or, with Docker's default iptables backend, add your own rules to the `DOCKER-USER` chain, which Docker evaluates first. With that backend Docker supports `iptables-nft` and `iptables-legacy`, and rules you write with `nft` directly are not supported. The experimental nftables backend in Engine 29 has no `DOCKER-USER` chain; there you put your rules in your own nftables tables.
:::

Docker Engine 28 tightened the defaults: other hosts can no longer reach a container's unpublished ports by routing to its IP address, and ports published on `127.0.0.1` are no longer reachable from neighboring machines on the LAN. If an old setup relied on either behavior, it stops working after the upgrade, which is the safer outcome. Docker Engine 29 adds an experimental `nftables` firewall backend (`"firewall-backend": "nftables"` in `daemon.json`).

## Reach the Host from a Container

`localhost` inside a container is the container itself. To reach a service on the host, such as a database you run outside Docker:

- **Docker Desktop**: use the name `host.docker.internal`, which always points to the host.
- **Linux**: add it yourself with `--add-host=host.docker.internal:host-gateway`, and make sure the host service listens on an address the container can reach (the bridge gateway, or `0.0.0.0` with a firewall), not only on `127.0.0.1`.

## Host and None Networks

```bash
docker run --rm --network host nginx:1.30      # nginx listens on the host's port 80 directly
docker run --rm --network none alpine:3.24 ip addr   # only "lo"
```

**Host networking** removes the network namespace: no NAT, no port mapping (`-p` is ignored with a warning), and the container's ports are the host's ports. Use it for tools that need to see the host's interfaces, or for rare cases where NAT overhead matters. On Docker Desktop it works from version 4.34 when you turn it on in **Settings > Resources > Network**, with limits (TCP and UDP only, Linux containers only). **None** gives a container no network at all, which suits batch jobs that process local files and must not reach anything.

## Isolate Backends with Internal Networks

An `--internal` network has no route to the outside world. Put a database on an internal network and the app on both, and the database cannot reach the internet even if it is compromised:

```bash
docker network create --internal hello-backend
docker network connect hello-backend hello-db
docker network connect hello-backend hello-api
docker network disconnect hello-net hello-db
```

hello-api now reaches `hello-db` over `hello-backend`, and the outside world over `hello-net`. [Part 8](/guides/introduction-to-docker/08-docker-compose) declares the same split in a Compose file.

## Networks Across Hosts

A bridge network exists on one host. To connect containers on several hosts, you need an orchestrator: Docker Swarm's `overlay` driver or a Kubernetes network plugin ([Part 10](/guides/introduction-to-docker/10-docker-in-production)). `macvlan` and `ipvlan` are different: they put containers directly on your LAN with their own IP addresses, for appliances that must look like separate machines. They need cooperation from your network: `macvlan` gives each container its own MAC address, which some switches and most cloud networks refuse on one port, while `ipvlan` shares the host's MAC address but still needs addresses and routes that fit your network. Since Engine 29, `macvlan` and L2 `ipvlan` networks get no default gateway unless you set `--gateway`.

## Debug Network Problems

Slim images contain almost no network tools. Instead of installing tools into the app's image, run a toolbox container **in the app container's network namespace**:

```bash
docker run --rm -it --network container:hello-api nicolaka/netshoot:v0.16
# inside: dig hello-db, nc -zv hello-db 5432, curl localhost:8000/health, ss -ltnp, tcpdump -i eth0
```

The netshoot container shares hello-api's interfaces, DNS settings and `localhost`, so you test exactly what the app sees. A checklist for "the app cannot connect":

1. **Same network?** `docker inspect hello-api --format '{{json .NetworkSettings.Networks}}'` must list a network that the database is on too.
2. **Right name?** Use the container name or alias, never `localhost` (that is the app container itself).
3. **Right port?** Use the **container** port (`5432`), not a published host port.
4. **Listening on all interfaces?** A service inside a container that listens on `127.0.0.1` cannot be reached from other containers. It must listen on `0.0.0.0`, which is why hello-api's gunicorn binds `0.0.0.0:8000`.
5. **Started yet?** The database may still be initializing. Compose health checks handle this ([Part 8](/guides/introduction-to-docker/08-docker-compose)).

## Clean Up

```bash
docker rm -f hello-api hello-db
docker network rm hello-net hello-backend
docker network prune        # removes every network no container uses
```

The `hello-db-data` volume survives the cleanup. Part 8 starts a separate database with Compose, so you can remove the old volume there.

## Common Mistakes

- **`localhost` in a connection string.** Inside a container it means the container. Use the service or container name.
- **Relying on the default bridge network.** No DNS by name. Create a network.
- **Publishing database ports to the world.** `-p 5432:5432` on a server with a public IP is reachable from the internet, regardless of `ufw`.
- **Assuming `EXPOSE` publishes anything.** It documents the port; `-p` publishes it.
- **Using `--link`.** Legacy, and it no longer injects environment variables since Engine 29. Use user-defined networks.

## Summary

- Create a user-defined bridge network per application: containers on it reach each other by name through Docker's DNS.
- Publish only the ports clients need, on `127.0.0.1` when the host is the only client; published ports bypass host firewalls.
- `host` and `none` networks remove or disable isolation; `--internal` networks block outbound traffic.
- Debug with a toolbox container in the app's network namespace.

Next, replace all of these commands with one file in [Docker Compose](/guides/introduction-to-docker/08-docker-compose).

## Keep Learning

- [Docker: Connect to the Host's localhost from a Container](/posts/connect-to-host-localhost-from-docker)
- [What is the Difference Between "Expose" and "Publish" in Docker?](/posts/expose-vs-publish-docker)
- [How to Get a Docker Container's IP Address from the Host](/posts/how-to-get-docker-container-ip-from-host)
- [Docker - Ubuntu - bash: ping: command not found](/posts/docker-ubuntu-ping-not-found)
- Guide: [Networking Fundamentals](/guides/networking-fundamentals)
