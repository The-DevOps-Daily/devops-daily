---
title: 'Working with Existing Charts'
description: 'Learn how to install, customize, upgrade, and roll back Helm charts from public repositories to deploy production-ready software on your cluster.'
order: 3
---

Now that Helm is installed and configured, it is time to put it to work. In this part, you will learn how to install charts, customize them with values, manage the release lifecycle, and perform upgrades and rollbacks. These are the operations you will use every day when managing applications with Helm.

## Installing a Chart

The basic install command follows this pattern:

```bash
helm install <release-name> <chart-reference> [flags]
```

Let us install Redis from the Bitnami repository:

```bash
helm install my-redis bitnami/redis
```

Helm renders the chart templates using the default values, submits the resulting manifests to the Kubernetes API server, and creates a release named `my-redis`. The output includes helpful notes about how to connect to your new Redis instance.

### Generating a Release Name

If you do not want to pick a name manually, Helm can generate one:

```bash
helm install bitnami/redis --generate-name
```

This produces a release name like `redis-1710936000`.

### Installing into a Specific Namespace

Always deploy applications into their own namespace for isolation:

```bash
helm install my-redis bitnami/redis \
  --namespace redis \
  --create-namespace
```

The `--create-namespace` flag tells Helm to create the namespace if it does not already exist.

### Dry Run and Template Rendering

Before installing, you can preview exactly what Kubernetes manifests Helm will produce:

```bash
# Dry run against the cluster (validates with API server)
helm install my-redis bitnami/redis --dry-run

# Render templates locally without contacting the cluster
helm template my-redis bitnami/redis
```

The `--dry-run` flag sends the rendered manifests to the API server for validation but does not actually create any resources. The `helm template` command renders locally without requiring cluster access at all -- useful in CI pipelines.

## Customizing Charts with Values

Charts expose a set of configurable values defined in their `values.yaml`. You override these defaults to tailor the deployment to your needs.

### Using --set Flags

For quick, one-off overrides:

```bash
helm install my-redis bitnami/redis \
  --set architecture=standalone \
  --set auth.password=mysecretpassword \
  --set master.persistence.size=10Gi
```

Nested values use dot notation. Arrays use curly braces:

```bash
--set master.nodeSelector.disktype=ssd
--set tolerations[0].key=dedicated,tolerations[0].value=redis,tolerations[0].effect=NoSchedule
```

### Using Values Files

For anything beyond a few overrides, create a values file. This approach is version-controllable and far more readable:

```yaml
# redis-values.yaml
architecture: standalone

auth:
  enabled: true
  password: mysecretpassword

master:
  persistence:
    enabled: true
    size: 10Gi
  resources:
    requests:
      cpu: 250m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi

metrics:
  enabled: true
  serviceMonitor:
    enabled: true
```

Install with the values file:

```bash
helm install my-redis bitnami/redis -f redis-values.yaml
```

### Merging Multiple Values Files

You can layer values files. Later files take precedence:

```bash
helm install my-redis bitnami/redis \
  -f values-base.yaml \
  -f values-production.yaml
```

This pattern works well for environment-specific configurations. You keep shared settings in `values-base.yaml` and environment overrides in `values-staging.yaml` or `values-production.yaml`.

You can also combine `--set` with `-f`. The `--set` flags take the highest precedence:

```bash
helm install my-redis bitnami/redis \
  -f redis-values.yaml \
  --set auth.password=override-password
```

## Inspecting a Release

After installation, use these commands to understand what Helm deployed:

```bash
# List all releases in the current namespace
helm list

# Get detailed status of a specific release
helm status my-redis

# Show the computed values for a release (merged defaults + overrides)
helm get values my-redis

# Show all values including defaults
helm get values my-redis --all

# Show the rendered manifests that were applied
helm get manifest my-redis

# Show release notes
helm get notes my-redis
```

The `helm get manifest` command is invaluable for debugging. It shows you exactly what Kubernetes resources were created, after all template rendering and value substitution.

## Upgrading a Release

When you need to change configuration or update to a newer chart version, use `helm upgrade`:

```bash
# Upgrade with new values
helm upgrade my-redis bitnami/redis -f redis-values-v2.yaml

# Upgrade to a specific chart version
helm upgrade my-redis bitnami/redis --version 19.0.0

# Upgrade and reuse the previous values (only change what you specify)
helm upgrade my-redis bitnami/redis --reuse-values --set master.persistence.size=20Gi
```

Each upgrade increments the release revision number. You can see the revision history:

```bash
helm history my-redis
```

```text
REVISION  UPDATED                   STATUS      CHART            APP VERSION  DESCRIPTION
1         2026-03-20 11:00:00 UTC   superseded  redis-19.0.0     7.2.4        Install complete
2         2026-03-20 12:00:00 UTC   superseded  redis-19.0.0     7.2.4        Upgrade complete
3         2026-03-20 13:00:00 UTC   deployed    redis-19.1.0     7.4.0        Upgrade complete
```

### Install or Upgrade in One Command

The `--install` flag (often shortened to `-i`) tells `helm upgrade` to install the release if it does not exist yet. This is the most common pattern in automation:

```bash
helm upgrade --install my-redis bitnami/redis -f redis-values.yaml
```

This is idempotent -- you can run it repeatedly without worrying about whether the release already exists.

## Rolling Back a Release

When an upgrade goes wrong, rollback to a previous revision:

```bash
# Roll back to the previous revision
helm rollback my-redis

# Roll back to a specific revision
helm rollback my-redis 2
```

Helm creates a new revision with the configuration from the target revision:

```bash
helm history my-redis
```

```text
REVISION  UPDATED                   STATUS      CHART            APP VERSION  DESCRIPTION
1         2026-03-20 11:00:00 UTC   superseded  redis-19.0.0     7.2.4        Install complete
2         2026-03-20 12:00:00 UTC   superseded  redis-19.0.0     7.2.4        Upgrade complete
3         2026-03-20 13:00:00 UTC   superseded  redis-19.1.0     7.4.0        Upgrade complete
4         2026-03-20 14:00:00 UTC   deployed    redis-19.0.0     7.2.4        Rollback to 2
```

Notice that rollback does not delete revision 3. It creates revision 4 as a copy of revision 2. This preserves the full history for auditing.

## Uninstalling a Release

Remove a release and all its Kubernetes resources:

```bash
helm uninstall my-redis
```

By default, Helm removes the release history as well. If you want to keep the history for auditing:

```bash
helm uninstall my-redis --keep-history
```

With `--keep-history`, the release shows as `uninstalled` in `helm list --all` and you could potentially roll it back.

## Working with Specific Chart Versions

Pinning chart versions is a best practice for reproducible deployments:

```bash
# List available versions of a chart
helm search repo bitnami/redis --versions

# Install a specific version
helm install my-redis bitnami/redis --version 19.0.0
```

In production, always pin your chart versions. An unexpected chart update could change default values or introduce breaking changes.

## Downloading Charts Locally

Sometimes you want to inspect a chart before installing it, or you need to modify it:

```bash
# Download and extract to the current directory
helm pull bitnami/redis --untar

# Download as a .tgz archive
helm pull bitnami/redis --version 19.0.0
```

After pulling, you can install from the local directory:

```bash
helm install my-redis ./redis -f redis-values.yaml
```

This is useful when you need to patch a chart or bundle it with your application code.

## Practical Example: Deploying a Full Stack

Let us put everything together by deploying a WordPress site with a MariaDB backend:

```bash
# Create a namespace
kubectl create namespace wordpress

# Create a values file
cat <<'EOF' > wordpress-values.yaml
wordpressUsername: admin
wordpressPassword: strongpassword
wordpressBlogName: "My DevOps Blog"

mariadb:
  auth:
    rootPassword: rootsecret
    password: dbpassword
  primary:
    persistence:
      size: 8Gi

persistence:
  size: 10Gi

service:
  type: ClusterIP

ingress:
  enabled: true
  hostname: blog.example.com
  ingressClassName: nginx
EOF

# Install
helm install my-blog bitnami/wordpress \
  -f wordpress-values.yaml \
  --namespace wordpress
```

With a single command and a values file, you get a fully configured WordPress deployment with a dedicated database, persistent storage, and ingress routing.

In the next part, we will learn how to create your own Helm charts from scratch, giving you full control over your application packaging.
