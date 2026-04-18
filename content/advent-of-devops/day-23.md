---
title: 'Day 23 - Container Networking Puzzle'
day: 23
excerpt: 'Solve complex container networking challenges involving multi-container apps, custom networks, and service discovery.'
description: 'Master Docker networking by solving real-world challenges with custom networks, DNS, port mapping, and container communication.'
publishedAt: '2026-12-23T00:00:00Z'
updatedAt: '2026-12-23T00:00:00Z'
difficulty: 'Advanced'
category: 'Docker'
tags:
  - Docker
  - Networking
  - Containers
  - Troubleshooting
---

## Description

Your multi-container application has networking issues: containers can't communicate, DNS isn't resolving, and port conflicts are causing failures. Time to master Docker networking through hands-on problem-solving.

## Task

Solve container networking challenges.

**Requirements:**
- Create custom Docker networks
- Enable container-to-container communication
- Configure service discovery
- Troubleshoot networking issues
- Implement network isolation

## Target

- ✅ All containers can communicate
- ✅ DNS resolution working
- ✅ Port mapping configured correctly
- ✅ Network isolation implemented
- ✅ No port conflicts

## Sample App

### Multi-Container Application

#### docker-compose.yml (Broken)

```yaml
version: '3.8'

services:
  # Frontend - web server
  frontend:
    image: nginx:alpine
    ports:
      - "80:80"  # Port conflict!
    volumes:
      - ./frontend:/usr/share/nginx/html

  # Backend API
  backend:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://db:5432/mydb  # Wrong hostname!
      - REDIS_URL=redis://cache:6379

  # Database
  database:  # Service name doesn't match!
    image: postgres:15
    environment:
      - POSTGRES_DB=mydb
      - POSTGRES_PASSWORD=secret

  # Cache
  redis:  # Service name doesn't match!
    image: redis:alpine

  # Worker
  worker:
    build: ./backend
    command: python worker.py
    depends_on:
      - backend  # Wrong dependency!
```

## Solution

### 1. Fixed docker-compose.yml

```yaml
version: '3.8'

networks:
  frontend-net:
    driver: bridge
  backend-net:
    driver: bridge
  database-net:
    driver: bridge
    internal: true  # No external access

services:
  # Frontend - web server
  frontend:
    image: nginx:alpine
    container_name: frontend
    ports:
      - "8080:80"  # Changed to avoid conflict
    volumes:
      - ./frontend:/usr/share/nginx/html
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    networks:
      - frontend-net
      - backend-net
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 3s
      retries: 3

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: backend-api
    expose:
      - "3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://db:5432/mydb  # Correct service name
      - REDIS_URL=redis://cache:6379
      - PORT=3000
    networks:
      - backend-net
      - database-net
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_started
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3

  # Database
  db:
    image: postgres:15-alpine
    container_name: database
    environment:
      - POSTGRES_DB=mydb
      - POSTGRES_USER=dbuser
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - database-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dbuser"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Cache
  cache:
    image: redis:7-alpine
    container_name: redis-cache
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - database-net
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  # Worker
  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: background-worker
    command: python worker.py
    environment:
      - DATABASE_URL=postgresql://db:5432/mydb
      - REDIS_URL=redis://cache:6379
    networks:
      - database-net
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_healthy

volumes:
  postgres-data:
  redis-data:
```

### 2. Custom Networks

```bash
# Create networks manually
docker network create \
  --driver bridge \
  --subnet=172.20.0.0/16 \
  --gateway=172.20.0.1 \
  frontend-net

docker network create \
  --driver bridge \
  --subnet=172.21.0.0/16 \
  --ip-range=172.21.5.0/24 \
  --gateway=172.21.0.1 \
  backend-net

docker network create \
  --driver bridge \
  --internal \
  --subnet=172.22.0.0/16 \
  database-net

# Inspect networks
docker network inspect frontend-net

# List networks
docker network ls
```

### 3. Network Troubleshooting

#### Debug Container

```bash
# Run debug container with network tools
docker run -it --rm \
  --network backend-net \
  --name netdebug \
  nicolaka/netshoot
```

#### Inside debug container:

```bash
# Test DNS resolution
nslookup backend-api
dig backend-api

# Test connectivity
ping backend-api
curl http://backend-api:3000/health

# Check network interfaces
ip addr show

# Test TCP connection
nc -zv backend-api 3000
telnet backend-api 3000

# Trace route
traceroute backend-api

# Check ports
nmap backend-api

# Monitor traffic
tcpdump -i eth0 port 3000
```

### 4. Network Isolation Example

```yaml
# isolated-services.yml
version: '3.8'

networks:
  public:
    driver: bridge
  private:
    driver: bridge
    internal: true  # No internet access
  admin:
    driver: bridge
    internal: true

services:
  # Public facing service
  web:
    image: nginx:alpine
    networks:
      - public
      - private
    ports:
      - "80:80"

  # Internal API (no public access)
  api:
    build: ./api
    networks:
      - private
      - admin
    expose:
      - "3000"

  # Database (most restricted)
  database:
    image: postgres:15
    networks:
      - admin
    volumes:
      - db-data:/var/lib/postgresql/data

  # Admin tool (can access database)
  adminer:
    image: adminer
    networks:
      - admin
      - public
    ports:
      - "8080:8080"

volumes:
  db-data:
```

### 5. Advanced Networking Scenarios

#### Host Network Mode

```yaml
services:
  monitoring:
    image: prom/prometheus
    network_mode: "host"  # Use host's network stack
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
```

#### Container Network Mode

```yaml
services:
  app:
    image: myapp
    container_name: main-app

  sidecar:
    image: logging-agent
    network_mode: "container:main-app"  # Share app's network
```

#### Static IP Assignment

```yaml
services:
  backend:
    image: myapp
    networks:
      backend-net:
        ipv4_address: 172.20.0.10

networks:
  backend-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### 6. nginx Configuration for Frontend

#### nginx.conf

```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend-api:3000;
        server backend-api:3000;  # Load balance if scaled
    }

    server {
        listen 80;
        server_name localhost;

        location / {
            root /usr/share/nginx/html;
            index index.html;
            try_files $uri $uri/ /index.html;
        }

        location /api {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Health check endpoint
            proxy_next_upstream error timeout http_500 http_502 http_503 http_504;
            proxy_connect_timeout 5s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        location /health {
            access_log off;
            return 200 "healthy\n";
        }
    }
}
```

### 7. Network Testing Script

```bash
#!/bin/bash

set -euo pipefail

echo "=== Docker Network Troubleshooting ==="

# Start services
echo "Starting services..."
docker-compose up -d

# Wait for services to be healthy
echo "Waiting for services..."
sleep 10

# Test frontend
echo ""
echo "Testing frontend..."
curl -f http://localhost:8080/health || echo "❌ Frontend not accessible"

# Test backend via frontend
echo ""
echo "Testing backend via frontend proxy..."
curl -f http://localhost:8080/api/health || echo "❌ Backend not accessible via proxy"

# Test container-to-container communication
echo ""
echo "Testing container communication..."
docker-compose exec -T frontend sh -c "wget -q -O- http://backend-api:3000/health" || echo "❌ Frontend cannot reach backend"

# Test database connection
echo ""
echo "Testing database connection..."
docker-compose exec -T backend sh -c "nc -zv db 5432" || echo "❌ Backend cannot reach database"

# Test Redis connection
echo ""
echo "Testing Redis connection..."
docker-compose exec -T backend sh -c "nc -zv cache 6379" || echo "❌ Backend cannot reach Redis"

# DNS resolution tests
echo ""
echo "Testing DNS resolution..."
docker-compose exec -T frontend nslookup backend-api || echo "❌ DNS resolution failed"

# Network inspection
echo ""
echo "Network information:"
docker network ls
docker network inspect $(docker network ls -q) | jq -r '.[].Name, .[].Containers' | head -20

echo ""
echo "=== Tests complete ==="
```

## Explanation

### Docker Network Types

#### 1. Bridge (Default)

```
Container → Virtual Bridge → Host → External Network
```

- Isolated network
- Containers on same bridge can communicate
- NAT for external access

#### 2. Host

```
Container → Host Network Stack (no isolation)
```

- No network isolation
- Best performance
- Port conflicts possible

#### 3. None

```
Container → No network
```

- Completely isolated
- Loopback only

#### 4. Overlay (Swarm)

```
Container → Encrypted overlay → Other nodes
```

- Multi-host networking
- Swarm mode only

### DNS Resolution in Docker

```
Container lookup: backend-api
    ↓
Docker DNS Server (127.0.0.11)
    ↓
Resolves to container IP
    ↓
Connection established
```

### Network Debugging Flow

```
1. Can I resolve the name? → nslookup
2. Can I reach the IP? → ping
3. Is the port open? → nc -zv
4. Can I connect? → curl/telnet
5. What's the route? → traceroute
6. Any firewall rules? → iptables -L
```

## Result

### Deploy and Test

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f

# Test connectivity
./test-network.sh

# Output:
# === Docker Network Troubleshooting ===
# Starting services...
# Waiting for services...
#
# Testing frontend...
# healthy
#
# Testing backend via frontend proxy...
# {"status":"healthy"}
#
# Testing container communication...
# {"status":"healthy"}
#
# Testing database connection...
# Connection to db 5432 port [tcp/postgresql] succeeded!
#
# Testing Redis connection...
# Connection to cache 6379 port [tcp/redis] succeeded!
#
# === Tests complete ===
```

### Monitor Traffic

```bash
# Watch network traffic
docker run --rm --net=host \
  nicolaka/netshoot \
  tcpdump -i any port 3000

# Monitor connections
docker stats --format "table {{.Container}}\t{{.NetIO}}"

# Inspect specific container network
docker inspect backend-api | jq '.[0].NetworkSettings'
```

## Validation

### Network Health Checklist

```bash
# 1. All containers running
docker-compose ps
# All should be "Up (healthy)"

# 2. Networks created
docker network ls | grep -E "frontend-net|backend-net|database-net"
# Should show 3 networks

# 3. Containers on correct networks
docker network inspect backend-net | jq '.[0].Containers'
# Should list expected containers

# 4. DNS resolution works
docker-compose exec frontend nslookup backend-api
# Should resolve

# 5. Port mapping correct
docker-compose port frontend 80
# Should show host port mapping

# 6. Inter-container communication works
docker-compose exec frontend wget -q -O- http://backend-api:3000/health
# Should succeed
```

## Best Practices

### ✅ Do's

1. **Use custom networks**: Better isolation
2. **Name your containers**: Easier DNS
3. **Health checks**: Verify services ready
4. **Network isolation**: Separate concerns
5. **Avoid host network**: Unless necessary
6. **Document ports**: Clear port usage

### ❌ Don'ts

1. **Don't use default bridge**: Create custom
2. **Don't expose unnecessary ports**: Security risk
3. **Don't hardcode IPs**: Use DNS
4. **Don't skip health checks**: Know when ready
5. **Don't ignore logs**: Network errors logged

## Links

- [Docker Networking](https://docs.docker.com/network/)
- [Compose Networking](https://docs.docker.com/compose/networking/)
- [Network Drivers](https://docs.docker.com/network/drivers/)
- [netshoot](https://github.com/nicolaka/netshoot)

## Share Your Success

Solved networking puzzles? Share it!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Problem you solved
- Network topology
- Debugging approach
- Solution implemented

Use hashtags: **#AdventOfDevOps #Docker #Networking #Day23**
