---
title: 'How to Mount a Single File in a Volume'
excerpt: 'Learn practical ways to mount exactly one file into a container using Docker bind mounts, Docker Compose, and Kubernetes with subPath. Includes real examples, caveats, and troubleshooting tips.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-03-22'
publishedAt: '2025-03-22T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Volumes
  - Bind Mounts
  - Kubernetes
  - ConfigMap
---

Mounting a single file into a running container is a common need. Maybe you want to inject one config file, a CA certificate, or a feature flag without replacing an entire directory. This guide shows you how to mount exactly one file using Docker and Kubernetes in a safe, repeatable way.

## TLDR

- Use Docker CLI bind mounts to map one host file to one container path: set `:ro` when possible.
- In Docker Compose, use long syntax `type: bind` with `source` and `target` pointing to files.
- In Kubernetes, mount a single file from a ConfigMap or Secret with `subPath` mapped to a file path.
- Watch out for SELinux labels on Linux hosts `:z` or `:Z`, and file permission differences across macOS, Linux, and WSL2.

Small mental model for what happens at runtime:

```
Host FS                 Container FS
---------               -------------
/srv/app/config.yaml -> /app/config/config.yaml  (mounted file)
         ^ bind mount replaces only this file at target path
```

## Prerequisites

- Docker Desktop 4.x or Docker Engine 24.x+
- kubectl 1.27+ and a cluster for the Kubernetes examples (kind or Minikube works)

## Docker CLI: mount one file with a bind mount

You can bind mount a single file by mapping a host file to a container file path. Use read-only whenever the container does not need to write to it.

```bash
# Example: run NGINX with a custom top-level nginx.conf from the host
mkdir -p /tmp/nginx
cat > /tmp/nginx/nginx.conf <<'CONF'
events {}
http {
  server {
    listen 8080;
    location / {
      return 200 'ok from custom config';
    }
  }
}
CONF

# Map exactly one file into the container
docker run --rm -p 8080:8080 \
  -v /tmp/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
  nginx:1.27-alpine

# In another terminal, verify the config is active
curl -fsS http://localhost:8080
```

Why this works:

- When the source is a file and the target is a file path, Docker mounts only that file.
- If the target directory exists, Docker overlays the file at the target path without replacing the rest of the directory.
- `:ro` keeps the container from mutating the host file.

Common variations:

```bash
# Inject an application env file
docker run --rm \
  -v $(pwd)/deploy/app.env:/app/config/app.env:ro \
  ghcr.io/examplecorp/invoice-service:1.9.3

# Trust a custom root CA
docker run --rm \
  -v /etc/ssl/mycompany.pem:/usr/local/share/ca-certificates/mycompany.pem:ro \
  alpine:3.20 sh -c "update-ca-certificates && wget https://internal.api"
```

### Notes for Linux hosts with SELinux

On SELinux-enabled hosts, containers may be blocked from reading host files. Add a label option to the bind mount.

```bash
# :z for shared content, :Z for private content
docker run --rm \
  -v /secure/config.yaml:/app/config/config.yaml:ro,Z \
  ghcr.io/examplecorp/invoice-service:1.9.3
```

## Docker Compose: mount one file with long syntax

Compose supports single-file binds with the long volume syntax. This is easier to read and less error prone than short `source:target` strings.

```yaml
version: '3.9'
services:
  nginx:
    image: nginx:1.27-alpine
    ports:
      - '8080:8080'
    volumes:
      - type: bind
        source: ./ops/nginx/nginx.conf # host file
        target: /etc/nginx/nginx.conf # container file
        read_only: true
```

Why this is useful:

- You only replace one file inside the container while keeping the image defaults for the rest.
- `read_only: true` matches production expectations for config.

## Kubernetes: mount one file with subPath from a ConfigMap

In Kubernetes you typically do not mount host files directly. Instead you mount files from a volume source like a ConfigMap or Secret. To map exactly one entry to a specific path, use `subPath`.

First, create a ConfigMap with multiple keys. Each key becomes a file in the volume.

```bash
kubectl create configmap web-config \
  --from-literal=nginx.conf='events {}\nhttp { server { listen 8080; location / { return 200 "ok from cm"; } } }' \
  --from-literal=extra.conf='# extra directives here'
```

Then mount only `nginx.conf` to the desired path using `subPath`.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  selector:
    matchLabels: { app: web }
  template:
    metadata:
      labels: { app: web }
    spec:
      containers:
        - name: nginx
          image: nginx:1.27-alpine
          ports:
            - containerPort: 8080
          volumeMounts:
            - name: web-config
              mountPath: /etc/nginx/nginx.conf # mount a single file
              subPath: nginx.conf # choose the key to project
              readOnly: true
      volumes:
        - name: web-config
          configMap:
            name: web-config
```

This maps only one file, not the whole directory. The rest of `/etc/nginx` stays from the image.

### Mount a single Secret file

You can repeat the same pattern with a Secret.

```bash
kubectl create secret generic tls-root-ca \
  --from-file=mycompany.pem=/etc/ssl/mycompany.pem
```

```yaml
volumeMounts:
  - name: ca
    mountPath: /usr/local/share/ca-certificates/mycompany.pem
    subPath: mycompany.pem
    readOnly: true
volumes:
  - name: ca
    secret:
      secretName: tls-root-ca
```

## Read-only, ownership, and permissions

- Prefer read-only mounts for configuration. In Docker, use `:ro`. In Kubernetes, use `readOnly: true`.
- Container users may differ from the file owner on the host. For Docker on Linux, you might need `chown` on the host or run the container with a matching UID.
- In Kubernetes, use `securityContext` to run as a non-root user if the application can handle it.

```yaml
securityContext:
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
```

## Verifying your mount

These quick checks save time when debugging.

```bash
# Inside a Docker container
docker exec -it $(docker ps --filter name=nginx -q) sh -lc \
  'ls -l /etc/nginx/nginx.conf && head -n5 /etc/nginx/nginx.conf'

# Inside a Kubernetes Pod
kubectl exec -it deploy/web -- sh -lc \
  'ls -l /etc/nginx/nginx.conf && head -n5 /etc/nginx/nginx.conf'
```

## Troubleshooting

- Target path is a directory: Docker may error or behave unexpectedly. Point the target to a file path, not a directory.
- Host path does not exist: Docker will create a directory if you accidentally give a directory-like path. Double check the source points to a file.
- SELinux denied access: use `:Z` or `:z` on Linux hosts.
- Docker Desktop file sharing: on macOS and Windows, the source path must be under a shared location.
- File not updating in Kubernetes: ConfigMap updates do not automatically refresh when using `subPath`. Roll the Pod or use a different pattern if you need live reloads.

With these patterns you can cleanly inject one file into a container for configuration, certificates, or feature flags. Start with Docker bind mounts for local development, and use Kubernetes `subPath` with ConfigMaps or Secrets in clusters.
