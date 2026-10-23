---
title: 'Docker in Production: Deploy, Update and Monitor Containers'
description: 'Run Docker in production: build and push images in CI, deploy with Compose behind a TLS proxy, roll back, tune the daemon, and know when to use Kubernetes.'
order: 10
---

Running containers in production is mostly about what happens around them: how an image gets from a commit to a server, how you update it without surprises, how you roll back, and how you find out that something is wrong. This part takes hello-api from your laptop to a Linux server with a pipeline that lints, builds, pushes and signs the image, a Compose deployment behind an HTTPS reverse proxy, a configured Docker daemon, and the monitoring and backup basics. It ends with the signs that you have outgrown one server.

## Prerequisites

- The hello-api project from Parts 5 to 9, in a Git repository on GitHub.
- A Linux server with Docker Engine ([Part 2](/guides/introduction-to-docker/02-docker-installation)), a DNS name pointing to it, and ports 80 and 443 open.

The workflow, Compose files, daemon configuration, Caddyfile and Kubernetes manifest in this part were validated with real runs of actionlint, `docker compose config`, `dockerd --validate`, `caddy validate` and kubeconform. Deployment output needs a real server and is described rather than shown.

## Choose How to Run Containers

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "Your image", "sub": "built in CI, pushed to a registry", "icon": "box", "tone": "accent" },
    { "label": "How many hosts?", "sub": "and how much downtime is OK?", "icon": "branch", "tone": "slate" }
  ],
  "branch": [
    { "label": "One server: Docker Compose", "variant": "good" },
    { "label": "A few servers, simple needs: Docker Swarm", "variant": "good" },
    { "label": "Many services or teams: Kubernetes", "variant": "good" },
    { "label": "No servers to manage: ECS, Cloud Run, App Platform", "variant": "good" }
  ]
}
```

| Option                    | Good for                                                | You give up                                                                           |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Compose on one server** | Small apps, internal tools, side projects, staging      | High availability: the server is a single point of failure; updates cause a short gap |
| **Docker Swarm**          | A few hosts, Compose-style files, built into Docker     | A large ecosystem; Swarm gets fixes but few new features                              |
| **Kubernetes**            | Many services, autoscaling, rolling updates, many teams | Simplicity: it is a platform you must learn and operate (or pay for)                  |
| **Managed containers**    | Teams that want to ship images, not run servers         | Control and portability; pricing per resource                                         |

All four run the same OCI image. Start with the simplest one that meets your needs; the image and most of what you learned carry over.

## The Delivery Pipeline

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "git push", "sub": "pull request or tag", "icon": "branch", "tone": "slate" },
    { "label": "Lint + validate", "sub": "hadolint, compose config", "icon": "check", "tone": "blue" },
    { "label": "Build", "sub": "amd64 + arm64, SBOM, provenance", "icon": "gear", "tone": "accent" },
    { "label": "Push", "sub": "ghcr.io, tag + digest", "icon": "cloud", "tone": "violet" },
    { "label": "Deploy", "sub": "pull, up --wait", "icon": "rocket", "tone": "green" }
  ]
}
```

This GitHub Actions workflow lints on every pull request and builds and pushes a multi-platform image on pushes to `main` and on version tags. Save it as `.github/workflows/docker.yml`:

```yaml
name: docker

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:

permissions:
  contents: read

jobs:
  lint:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - name: Lint the Dockerfile
        run: docker run --rm -i hadolint/hadolint:v2.15.1 < Dockerfile
      - name: Validate compose.yaml
        run: |
          mkdir -p secrets
          echo "ci-only" > secrets/db_password.txt
          echo "ci-only" > secrets/postgres_password.txt
          docker compose config --quiet

  build:
    needs: lint
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      packages: write # push to ghcr.io
      id-token: write # keyless signing with cosign
    steps:
      - uses: actions/checkout@v7
      - name: Image name in lowercase, as registries require
        run: echo "IMAGE=ghcr.io/${GITHUB_REPOSITORY,,}" >> "$GITHUB_ENV"
      - uses: docker/setup-qemu-action@v4
      - uses: docker/setup-buildx-action@v4
      - uses: docker/login-action@v4
        if: github.event_name != 'pull_request'
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Image names and tags
        id: meta
        uses: docker/metadata-action@v6
        with:
          images: ${{ env.IMAGE }}
          tags: |
            type=sha
            type=semver,pattern={{version}}
            type=ref,event=pr
      - name: Build, and push outside pull requests
        id: build
        uses: docker/build-push-action@v7
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          sbom: true
          provenance: mode=max
      - uses: sigstore/cosign-installer@v4
        if: github.event_name != 'pull_request'
      - name: Sign the image by digest
        if: github.event_name != 'pull_request'
        env:
          DIGEST: ${{ steps.build.outputs.digest }}
        run: cosign sign --yes "${IMAGE}@${DIGEST}"
```

```terminal
{
  "title": "actionlint 1.7.12 (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "actionlint .github/workflows/docker.yml && echo \"no findings\"",
      "output": "no findings"
    }
  ]
}
```

What the workflow does:

- **Lint first**: hadolint and `docker compose config --quiet` fail fast, before the slow build. The compose check needs the secret file to exist, so it creates a dummy one.
- **`metadata-action`** turns the Git ref into tags: `sha-3f9c2ab` for every commit, `1.0.3` for a tag `v1.0.3`, `pr-42` for pull requests. Every image gets a unique, traceable tag.
- **`build-push-action`** builds for `amd64` and `arm64` (QEMU emulates the other architecture), pushes only outside pull requests, attaches an SBOM and provenance, and stores the layer cache in GitHub's cache (`type=gha`), so unchanged layers are not rebuilt on the next run. The pip cache mount from Part 5 lives in the runner and starts empty on each run; the layer cache is what makes CI builds fast.
- **One image name for every step**: registry paths must be lowercase, and `github.repository` keeps the owner's capitals, so the workflow lowercases it once into `IMAGE` and uses it for the tags and the signature.
- **cosign** signs the pushed digest with the workflow's identity ([Part 9](/guides/introduction-to-docker/09-docker-best-practices) shows how to verify it).

The `GITHUB_TOKEN` is enough to push to the repository's own package on ghcr.io; no personal token is needed. One catch: if you already pushed `hello-api` to ghcr.io by hand in Part 5, that package is not connected to the repository, and the workflow's push fails with a permission error. Open the package's settings on GitHub and give the repository write access under **Manage Actions access** (or delete the manual package) before the first run. For production pipelines, pin each action to a full commit SHA instead of a tag such as `@v7`, so a moved tag cannot change what runs. Add a scanner step (Trivy or Docker Scout) before the push if you want CI to block on vulnerabilities.

## Deploy with Compose on One Server

The base `compose.yaml` builds the image locally and is meant for development. Production needs a few changes: use the image from the registry, put a reverse proxy with TLS in front of the API, and remove the development port. An override file does that without copying the whole file:

```yaml
# Production: docker compose -f compose.yaml -f compose.prod.yaml up -d --wait
services:
  api:
    image: ghcr.io/my-org/hello-api:${HELLO_API_TAG:?set HELLO_API_TAG to the version to deploy}
    build: !reset null
    ports: !reset []

  proxy:
    image: caddy:2.11
    ports:
      - '80:80'
      - '443:443'
      - '443:443/udp'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      api:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - frontend

volumes:
  caddy-data:
  caddy-config:
```

`!reset` removes a value that the base file sets: the API no longer builds anything and no longer publishes port 8000. The `:?` syntax makes the image tag mandatory, so nobody deploys "whatever was there". [Caddy](https://caddyserver.com/) gets a certificate from Let's Encrypt automatically and forwards requests to the API over the `frontend` network:

```text
api.example.com {
	reverse_proxy api:8000
}
```

```terminal
{
  "title": "validate the production configuration (real run)",
  "prompt": "$",
  "steps": [
    {
      "comment": "without a tag, Compose refuses to render the file",
      "cmd": "docker compose -f compose.yaml -f compose.prod.yaml config --quiet",
      "output": "error while interpolating services.api.image: required variable HELLO_API_TAG is missing a value: set HELLO_API_TAG to the version to deploy"
    },
    {
      "cmd": "HELLO_API_TAG=1.0.3 docker compose -f compose.yaml -f compose.prod.yaml config --images",
      "output": "postgres:18\ncaddy:2.11\nghcr.io/my-org/hello-api:1.0.3"
    },
    {
      "cmd": "HELLO_API_TAG=1.0.3 docker compose -f compose.yaml -f compose.prod.yaml config --format json api | jq -c '.services.api | {image, build, ports}'",
      "output": "{\"image\":\"ghcr.io/my-org/hello-api:1.0.3\",\"build\":null,\"ports\":null}"
    },
    {
      "cmd": "caddy validate --config Caddyfile --adapter caddyfile 2>&1 | tail -1",
      "output": "Valid configuration"
    }
  ]
}
```

The merged `api` service has the registry image and neither `build` nor `ports`. The output above lists the images of the default services; `adminer` stays off because its profile is not active.

### Create the Server

A Linux VM with 1 to 2 GB of memory runs hello-api, Postgres and Caddy. Create one with Ubuntu 24.04 LTS at your cloud provider, install Docker Engine as in [Part 2](/guides/introduction-to-docker/02-docker-installation), point a DNS name such as `api.example.com` at its public IP address, and allow ports 80 and 443 (and 22 from your own IP address only) in the provider's firewall, which Docker's published ports cannot bypass. On DigitalOcean, this is a [Droplet](https://m.do.co/c/2a9bba940f39) with a Cloud Firewall. This is a referral link: if you later spend $25 on DigitalOcean, this site gets $25 in credit. New accounts that sign up through it get DigitalOcean's standard signup credit, which its [documentation](https://docs.digitalocean.com/platform/billing/signup-credit/) lists as $5, valid for 90 days (checked in October 2026), and you need a valid payment method before you can create a Droplet.

### First Deployment

On the server, in a directory with `compose.yaml`, `compose.prod.yaml`, `Caddyfile`, the `db/init/` script and both secret files in `secrets/` (created on the server with `openssl rand`, never copied from your laptop's repository):

```bash
# Use both files without typing -f every time
cat > .env <<'EOF'
COMPOSE_FILE=compose.yaml:compose.prod.yaml
HELLO_API_TAG=1.0.3
EOF

echo "$GHCR_READ_TOKEN" | docker login ghcr.io -u my-user --password-stdin
docker compose pull
docker compose up -d --wait
```

`--wait` returns when every container is running and, where it has a health check, healthy, and it fails otherwise. Those are startup checks: Caddy has no health check, and the API's `/health` does not touch the database. End a deployment script with a check of what users see, which retries every second, including while Caddy is still getting its certificate, and fails if the API is not ready within a minute:

```bash
timeout 60s curl -fsS --max-time 10 --retry 60 --retry-delay 1 --retry-all-errors https://api.example.com/ready
```

### Updates and Rollbacks

To deploy a new version, change the tag and run the same two commands:

```bash
sed -i 's/^HELLO_API_TAG=.*/HELLO_API_TAG=1.0.4/' .env
docker compose pull api
docker compose up -d --wait
```

Compose recreates only `api`, because only its image changed. To roll back, set the previous tag and run `up -d --wait` again: the old image is still on the server (unless you pruned it) and in the registry.

Be honest about the gap: Compose stops the old container before it starts the new one, so requests fail for a few seconds while gunicorn starts and the health check passes. For many internal apps that is fine. If it is not, you need several replicas behind the proxy and a rolling update, which is what Swarm and Kubernetes do for you.

Record what you deploy. `docker compose images` and `docker image inspect --format '{{index .RepoDigests 0}}' ghcr.io/my-org/hello-api:1.0.4` show the digest that is running, which you can match to the CI run that built it.

## Configure the Docker Daemon

The daemon's defaults suit a laptop. A server needs a few settings in `/etc/docker/daemon.json`:

```json
{
  "log-driver": "local",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5"
  },
  "live-restore": true,
  "metrics-addr": "127.0.0.1:9323",
  "default-address-pools": [{ "base": "172.30.0.0/16", "size": 24 }]
}
```

```terminal
{
  "title": "dockerd 29.9.2 --validate (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "dockerd --validate --config-file ./daemon.json",
      "output": "configuration OK"
    }
  ]
}
```

- **`log-driver: local`** with rotation, so no container fills the disk ([Part 9](/guides/introduction-to-docker/09-docker-best-practices)). It applies to containers created after the change.
- **`live-restore`** keeps containers running while the daemon restarts, for example during a patch update of Docker Engine (29.9.1 to 29.9.2). It does not cover a move to a new minor version (29.8 to 29.9) or changed daemon settings, so plan a maintenance window for those.
- **`metrics-addr`** exposes the daemon's Prometheus metrics on the loopback address.
- **`default-address-pools`** chooses the subnets Docker uses for new networks. Set it when Docker's default `172.17.0.0/16` to `172.31.0.0/16` ranges overlap with your company network or VPN, a common cause of "the server cannot reach the database after Docker started".

Run `sudo dockerd --validate --config-file /etc/docker/daemon.json` before `sudo systemctl restart docker`: a daemon with a broken config file does not start, and neither does any container.

## Secure the Host

- **Patch Docker Engine.** Only the newest release line gets fixes, and Docker publishes security fixes as patch releases ([The Docker AuthZ Bypass Is Back](/posts/docker-authz-bypass-cve-2026-34040) is a recent example). Update with the rest of your packages.
- **Protect the Docker socket.** Access to `/var/run/docker.sock` is root on the host. Never mount it into an application container, and never expose the daemon on TCP without mutual TLS. To manage a server remotely, use SSH: `docker context create prod --docker host=ssh://deploy@server` and then `docker --context prod ps`.
- **Consider rootless mode or user namespace remapping** ([Part 2](/guides/introduction-to-docker/02-docker-installation)) so that root in a container is not root on the host.
- **Mind the firewall.** Published ports bypass `ufw` ([Part 7](/guides/introduction-to-docker/07-networking-in-docker)). In the setup above, only Caddy publishes ports.
- **Limit who can pull and push.** Use read-only registry tokens on servers and push only from CI.

## Monitor and Log

You need to know three things: is the service up, is it healthy, and is the host running out of something.

- **Health**: `docker compose ps` shows health status; an external uptime check against `https://api.example.com/ready` tells you what users see.
- **Resource use**: `docker stats` for a quick look. For history and alerts, run [cAdvisor](https://github.com/google/cadvisor) (per-container metrics) and node-exporter (host metrics), scraped by Prometheus, together with the daemon metrics on `127.0.0.1:9323`.
- **Logs**: `docker compose logs -f`. To keep logs beyond the local rotation, ship them to a central system (Loki, Elasticsearch, a cloud logging service) with a collector such as Fluent Bit or Grafana Alloy. Collectors that tail Docker's log files expect the `json-file` format; check that yours supports the `local` driver or reads from the Docker API before you switch ([measured here](/posts/docker-desktop-local-log-driver)).
- **Disk**: images, build cache and logs grow. Alert on disk usage and prune old images regularly (`docker image prune -a --filter "until=168h"`).

## Back Up the Data

The containers are disposable; the `hello-api_db-data` volume and the secrets are not. Schedule a database dump with cron or a systemd timer, and copy it off the server:

```text
# crontab entry: nightly at 02:30, a consistent dump through pg_dump inside the db container
30 2 * * * cd /srv/hello-api && docker compose exec -T db pg_dump -U hello -d hello --format=custom > /var/backups/hello-$(date +\%F).dump
```

`-T` disables the pseudo-terminal, which binary output and cron need. Test a restore into a fresh volume regularly ([Part 6](/guides/introduction-to-docker/06-working-with-docker-volumes)). For serious production databases, consider a managed Postgres service and run only the stateless API in containers.

## When One Server Is Not Enough

### Docker Swarm

Swarm mode is built into Docker Engine. `docker swarm init` turns a host into a manager, other hosts join with `docker swarm join`, and `docker stack deploy` runs a Compose-format file across the cluster with replicas, rolling updates, secrets and overlay networks. Swarm refuses to start when `live-restore` (or the nftables firewall backend) is enabled, so remove that setting from the `daemon.json` above on Swarm nodes. The file format is close to Compose, but not the same. `docker stack config` checks a file the way `stack deploy` reads it, without a cluster. A real run on hello-api's `compose.yaml`:

```terminal
{
  "title": "a Compose file is not a stack file (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker stack config -c compose.yaml",
      "output": "services.api.depends_on: must be a list"
    }
  ]
}
```

Stack files use the older Compose file format 3 schema, which knows only the short list form of `depends_on`, and Swarm ignores `depends_on`, `build` and `restart` anyway. A stack file for hello-api uses the registry image, replicas and a rolling update policy instead:

```yaml
services:
  api:
    image: ghcr.io/my-org/hello-api:1.0.4
    environment:
      DB_HOST: db
      DB_USER: hello
      DB_NAME: hello
      DB_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    networks:
      - frontend
      - backend
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        order: start-first # start the new task before stopping the old one
        failure_action: rollback
      restart_policy:
        condition: on-failure
      resources:
        limits:
          cpus: '1'
          memory: 256M

  db:
    image: postgres:18
    environment:
      POSTGRES_DB: hello
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
    secrets:
      - postgres_password
      - db_password
    configs:
      - source: app_role
        target: /docker-entrypoint-initdb.d/10-app-role.sh
        mode: 0555
    volumes:
      - db-data:/var/lib/postgresql
    networks:
      - backend
    deploy:
      placement:
        constraints:
          - node.labels.db == true # the volume lives on one node

  proxy:
    image: caddy:2.11
    ports:
      - '80:80'
      - '443:443'
    configs:
      - source: caddyfile
        target: /etc/caddy/Caddyfile
    volumes:
      - caddy-data:/data
    networks:
      - frontend

configs:
  caddyfile:
    file: ./Caddyfile
  app_role:
    file: ./db/init/10-app-role.sh

secrets:
  db_password:
    external: true # created once with: docker secret create db_password -
  postgres_password:
    external: true

networks:
  frontend:
    driver: overlay
  backend:
    driver: overlay
    internal: true

volumes:
  db-data:
  caddy-data:
```

```terminal
{
  "title": "validate the stack file (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker stack config -c stack.yaml > /dev/null && echo \"stack.yaml is valid\"",
      "output": "stack.yaml is valid"
    }
  ]
}
```

Before the first deploy, label the node that keeps the database volume, create the two secrets in the cluster from the files, and deploy with your registry login forwarded to the nodes:

```bash
DB_NODE=node-1   # the node that keeps the database volume (see docker node ls)
docker node update --label-add db=true "$DB_NODE"
docker secret create db_password secrets/db_password.txt
docker secret create postgres_password secrets/postgres_password.txt
docker stack deploy --with-registry-auth -c stack.yaml hello
```

Swarm prefixes names with the stack name, so the database volume is `hello_db-data`, separate from Compose's `hello-api_db-data`. If the Compose project from earlier runs on the same host, stop it first with `docker compose down` (without `-v`, so its data stays): both publish ports 80 and 443. With `order: start-first`, Swarm starts a new `api` task, waits for its health check, and only then stops an old one, so an update has no gap. Two Swarm traps: its routing mesh publishes ports on every node and every interface (a `127.0.0.1:` host address in `ports` is ignored with a warning), and a volume belongs to one node, which is why the database is pinned to a labeled node.

### Kubernetes

Kubernetes runs the same image. hello-api's `/health` and `/ready` routes map directly to its liveness and readiness probes: a container that fails readiness gets no traffic until the database is back, and only a container that fails liveness is restarted. `runAsNonRoot: true` works because the image sets a numeric `USER 10001` ([Part 5](/guides/introduction-to-docker/05-building-custom-docker-images)); with a user name, Kubernetes refuses to start the container because it cannot verify the user. A minimal Deployment with the hardening from Part 9:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: hello-api
  template:
    metadata:
      labels:
        app: hello-api
    spec:
      securityContext:
        runAsNonRoot: true
      imagePullSecrets:
        - name: ghcr # ghcr.io packages are private by default
      containers:
        - name: api
          image: ghcr.io/my-org/hello-api:1.0.4
          ports:
            - containerPort: 8000
          env:
            - name: DB_HOST
              value: hello-db
            - name: DB_PASSWORD_FILE
              value: /run/secrets/db/password
          volumeMounts:
            - name: db-password
              mountPath: /run/secrets/db
              readOnly: true
            - name: tmp
              mountPath: /tmp
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
          readinessProbe:
            httpGet:
              path: /ready
              port: 8000
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              memory: 256Mi
          securityContext:
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            capabilities:
              drop: ['ALL']
      volumes:
        - name: db-password
          secret:
            secretName: hello-db
            items:
              - key: password
                path: password
        - name: tmp
          emptyDir:
            medium: Memory # tmpfs, like the Compose setup in Part 9
            sizeLimit: 16Mi
---
apiVersion: v1
kind: Service
metadata:
  name: hello-api
spec:
  selector:
    app: hello-api
  ports:
    - port: 80
      targetPort: 8000
```

```terminal
{
  "title": "kubeconform 0.8.0 (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubeconform -strict -summary k8s/deployment.yaml",
      "output": "Summary: 2 resources found in 1 file - Valid: 2, Invalid: 0, Errors: 0, Skipped: 0"
    }
  ]
}
```

The Deployment expects three things to exist in its namespace:

- a registry Secret named `ghcr`, so the nodes can pull the private image: `kubectl create secret docker-registry ghcr --docker-server=ghcr.io --docker-username=my-user --docker-password="$GHCR_READ_TOKEN"`, with a token that has the `read:packages` scope (or make the package public);
- a Secret named `hello-db` with a `password` key: `kubectl create secret generic hello-db --from-file=password=secrets/db_password.txt`;
- a database reachable as `hello-db` where the `hello` role exists, for example a managed Postgres behind an `ExternalName` Service of that name.

Without the registry Secret, the Pods stay in `ImagePullBackOff`; without the database Secret, they do not start; without the database, they start but never become ready.

The mapping from Compose is direct: `image`, `environment` and `secrets` become `image`, `env` and a secret volume; the health check becomes probes; `deploy.resources` becomes `resources`; `read_only` and `cap_drop` become the container `securityContext`. Kubernetes has run containers through containerd and other CRI runtimes since it removed dockershim in version 1.24, and images built with Docker run there unchanged. The [Introduction to Kubernetes](/guides/introduction-to-kubernetes) guide continues from here.

### Managed Container Services

Amazon ECS (with Fargate), Google Cloud Run, Azure Container Apps and DigitalOcean App Platform run your image without servers to manage: you give them the image reference, environment and secrets, and they handle scaling, TLS and restarts. They are often the fastest path to production for a stateless API like hello-api, paired with a managed database.

## Production Checklist

- [ ] Images built in CI from a clean checkout, never on a laptop; tagged with a unique version or commit
- [ ] Dockerfile linted, Compose files validated, image signed in CI, and scanned before release (a scanner step in the workflow or a registry scanner)
- [ ] Deploys reference a version tag or digest, never `latest`; the running digest is recorded
- [ ] Secrets from files or a secret store, not from the image or committed files
- [ ] The app connects to the database as its own role, not as a superuser
- [ ] Only the reverse proxy publishes ports; databases on internal networks
- [ ] Health checks, restart policies and resource limits on every service
- [ ] Log rotation in `daemon.json`; logs and metrics shipped off the host
- [ ] Database backups scheduled, copied off the server and test-restored
- [ ] Docker Engine and base images updated regularly; old images pruned
- [ ] A written rollback procedure that you have tried once

## Summary

- Lint, build, push and sign images in CI, with unique tags and multi-platform support; add a scanner gate when you need one.
- On one server, Compose with a production override file and a TLS reverse proxy is a solid setup; `up -d --wait` deploys, and the previous tag rolls back.
- Configure the daemon for production: log rotation, live restore, address pools; validate it before restarting.
- Protect the Docker socket, keep the engine patched, and back up volumes with the database's tools.
- Move to Swarm, Kubernetes or a managed service when you need several hosts, zero-downtime updates or autoscaling. The image stays the same.

You have taken one application from a Dockerfile to production. Go back to the [guide overview](/guides/introduction-to-docker) for a summary of every part, or test yourself with the [Docker quiz](/quizzes/docker-quiz).

## Keep Learning

- [Docker Compose vs Kubernetes: Understanding the Key Differences](/posts/docker-compose-vs-kubernetes-differences)
- [Docker Swarm vs Kubernetes](/comparisons/docker-swarm-vs-kubernetes)
- [GitOps: Deploy Docker Containers with GitHub Actions and ArgoCD](/posts/gitops-deploy-docker-containers-github-actions-argocd)
- [containerd 1.7 Reaches End of Life: What Breaks on 2.x](/posts/containerd-1-7-end-of-life-what-breaks-on-2x)
- Guide: [Introduction to Kubernetes](/guides/introduction-to-kubernetes)
- Interview question: [Container orchestration basics](/interview-questions/junior/container-orchestration-basics)
