---
title: Networking in Docker
description: Learn how to configure communication between containers and external networks
order: 7
---

Docker networking enables containers to communicate with each other and with the outside world. Understanding Docker's networking capabilities is essential for building multi-container applications. In this section, we'll explore Docker's network types, how to configure them, and best practices for container communication.

## Docker Network Basics

Docker provides several network drivers, each with different capabilities:

1. **bridge**: The default network driver. Containers can communicate with each other on the same bridge network.
2. **host**: Removes network isolation between the container and the host. The container uses the host's networking directly.
3. **none**: Disables all networking for a container.
4. **overlay**: Connects multiple Docker daemons across hosts, enabling Swarm services to communicate.
5. **macvlan**: Assigns a MAC address to a container, making it appear as a physical device on your network.
6. **ipvlan**: Similar to macvlan but uses IP addresses instead of MAC addresses.
7. **custom network plugins**: Allows you to use third-party network plugins.

## Listing Docker Networks

To see all networks on your system:

```bash
docker network ls
```

Example output:

```
NETWORK ID     NAME      DRIVER    SCOPE
7ddf8d0d099a   bridge    bridge    local
69f9f6aa8de7   host      host      local
aabb90487e7c   none      null      local
```

## The Default Bridge Network

When you install Docker, it creates a default bridge network named `bridge`. Unless you specify otherwise, new containers connect to this network.

To inspect the bridge network:

```bash
docker network inspect bridge
```

This returns a JSON object with details about the network, including subnet information and connected containers.

## Creating a Custom Bridge Network

The default bridge network is fine for simple setups, but custom bridge networks offer several advantages:

- Automatic DNS resolution between containers
- Better isolation
- Containers can be connected and disconnected from networks on the fly

To create a custom bridge network:

```bash
docker network create my-network
```

You can specify additional options:

```bash
docker network create --driver bridge \
  --subnet 172.18.0.0/16 \
  --gateway 172.18.0.1 \
  my-custom-network
```

## Connecting Containers to Networks

### At Container Creation

To start a container connected to a specific network:

```bash
docker run -d --name web --network my-network nginx:latest
```

### Adding Running Containers to Networks

To connect an existing container to a network:

```bash
docker network connect my-network db
```

### Removing a Container from a Network

To disconnect a container from a network:

```bash
docker network disconnect my-network db
```

## Container Name Resolution

One of the most powerful features of custom bridge networks is automatic DNS resolution. Containers on the same custom network can reach each other using their container names.

Let's demonstrate with a simple example:

```bash
# Create a network
docker network create app-network

# Start a container
docker run -d --name db --network app-network postgres:13

# Start another container and connect to the first one using its name
docker run -d --name web --network app-network -p 8080:80 nginx:latest
```

Now, inside the `web` container, you can connect to the `db` container using the hostname `db`:

```bash
docker exec -it web bash
ping db
```

The ping should succeed, showing that the containers can resolve each other by name.

## Using the Host Network

Sometimes, you want a container to share the host's network stack, completely removing network isolation:

```bash
docker run -d --name host-nginx --network host nginx:latest
```

In this case, the container uses the host's IP address and ports directly. If nginx listens on port 80 inside the container, it will be available on the host's port 80. This means you don't need to use port mapping.

The host network is useful for:

- Maximum performance (no network overhead)
- When a container needs to handle a large range of ports
- When the container needs access to local network services

**Note**: The host network driver only works on Linux hosts.

## Using the None Network

For maximum isolation, you can disable networking for a container:

```bash
docker run -d --name isolated --network none alpine sleep infinity
```

This container has only a loopback interface and cannot communicate with the outside world or other containers.

## Port Mapping

For containers on bridge networks, port mapping is needed to make services accessible from outside Docker:

```bash
docker run -d --name web -p 8080:80 nginx:latest
```

This maps port 80 in the container to port 8080 on the host.

You can also specify the host IP to bind to:

```bash
docker run -d --name web -p 127.0.0.1:8080:80 nginx:latest
```

This only exposes the port on localhost, not on all host interfaces.

For a random host port, use:

```bash
docker run -d --name web -p 127.0.0.1::80 nginx:latest
```

Docker assigns a random available port. To see which port was assigned:

```bash
docker port web
```

## Network Inspection and Troubleshooting

To see which containers are connected to a network:

```bash
docker network inspect my-network
```

For containers with connectivity issues, you can look at their network settings:

```bash
docker inspect --format='{{json .NetworkSettings}}' web | jq
```

This uses `jq` to format the JSON output (install it if you don't have it).

## Container-to-Container Communication Example

Let's build a practical example with a web application that connects to a database:

```bash
# Create a network
docker network create webapp-network

# Start a MongoDB container
docker run -d \
  --name mongo \
  --network webapp-network \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:latest

# Start a Node.js application that connects to MongoDB
docker run -d \
  --name nodeapp \
  --network webapp-network \
  -p 3000:3000 \
  -e MONGO_URL=mongodb://admin:password@mongo:27017/myapp \
  myapp:latest
```

In this example:

1. Both containers join the `webapp-network`
2. The Node.js application uses `mongo` as the hostname to connect to MongoDB
3. Only the Node.js application exposes a port to the host

## Docker Networking with Compose

Docker Compose simplifies networking for multi-container applications. We'll cover this in depth in the next section, but here's a preview of how networking works in Compose:

```yaml
version: '3'
services:
  web:
    image: nginx:latest
    ports:
      - '8080:80'
  db:
    image: postgres:13
    environment:
      POSTGRES_PASSWORD: example
```

When you run `docker-compose up`, Compose automatically:

1. Creates a default network for the composition
2. Connects all services to this network
3. Sets up name resolution between services

## Overlay Networks for Multi-Host Communication

If you're running Docker in Swarm mode (a cluster of Docker hosts), overlay networks allow containers on different hosts to communicate as if they were on the same host:

```bash
# Initialize a swarm
docker swarm init

# Create an overlay network
docker network create --driver overlay my-overlay-network

# Create a service using this network
docker service create \
  --name my-service \
  --network my-overlay-network \
  --replicas 2 \
  nginx:latest
```

## Exposing Container Services to the Outside World

For production applications, you often need to expose services to external clients. Here are common patterns:

### Direct Port Mapping

The simplest approach is port mapping, as we've seen:

```bash
docker run -d -p 80:80 -p 443:443 --name web nginx:latest
```

### Using a Reverse Proxy

For more sophisticated setups, a reverse proxy like Nginx or Traefik can route traffic to different containers:

```bash
# Create a network
docker network create proxy-network

# Run backend services
docker run -d --name api1 --network proxy-network myapi:latest
docker run -d --name api2 --network proxy-network myotherapi:latest

# Run the reverse proxy
docker run -d \
  --name nginx-proxy \
  --network proxy-network \
  -p 80:80 \
  -v $(pwd)/nginx.conf:/etc/nginx/conf.d/default.conf \
  nginx:latest
```

With a configuration like:

```nginx
server {
    listen 80;

    location /api1 {
        proxy_pass http://api1:8000;
    }

    location /api2 {
        proxy_pass http://api2:8000;
    }
}
```

## Network Security Considerations

When designing Docker networks, consider these security best practices:

1. **Use custom bridge networks** for better isolation between container groups.

2. **Limit exposed ports** to only what's necessary.

3. **Use host-private interfaces** when possible:

   ```bash
   docker run -d -p 127.0.0.1:8080:80 --name web nginx:latest
   ```

4. **Remove the default bridge network** from containers that don't need external access.

5. **Implement network policies** if using Kubernetes or Docker Enterprise.

## Network Performance Considerations

For applications where network performance is critical:

1. **Use the host network** when maximum performance is required:

   ```bash
   docker run -d --network host --name fast-app my-performance-app
   ```

2. **Consider non-bridge drivers** like macvlan for near-native performance.

3. **Enable IPv6** if your environment supports it:

   ```bash
   docker network create --ipv6 --subnet fd00::/80 ipv6-network
   ```

4. **Tune MTU settings** for your containers if working in environments with non-standard MTU:
   ```bash
   docker network create --opt com.docker.network.driver.mtu=1400 lowmtu-network
   ```

## Running Containers in the Cloud

When deploying containerized applications to the cloud, networking is a crucial consideration. DigitalOcean provides robust networking features for container-based applications, including private networks between Droplets.

[Sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) to get $200 in free credits and deploy your networked container applications in a production-ready environment.

## Network Troubleshooting Tools

When debugging network issues, these commands are helpful:

```bash
# Check network connectivity from inside a container
docker exec -it container-name ping other-container

# Examine container network interfaces
docker exec -it container-name ip addr show

# Trace network path
docker exec -it container-name traceroute other-container

# Analyze network traffic
docker exec -it container-name tcpdump -i eth0
```

For containers without these tools installed, you can use a network troubleshooting container:

```bash
docker run --rm -it --network container:target-container nicolaka/netshoot
```

This gives you a container with networking tools that shares the target container's network namespace.

## Clean Up Networks

To remove an unused network:

```bash
docker network rm my-network
```

To remove all unused networks:

```bash
docker network prune
```

In the next section, we'll explore Docker Compose, which simplifies the management of multi-container applications including their networking configuration.
