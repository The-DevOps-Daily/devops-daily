---
title: 'Advanced Helm Techniques and CI/CD Integration'
description: 'Explore Helm hooks, chart dependencies, library charts, OCI registries, plugins, and strategies for integrating Helm into CI/CD pipelines.'
order: 6
---

Once you are comfortable with the fundamentals, Helm offers a rich set of advanced features that unlock more sophisticated workflows. This final part covers hooks for lifecycle management, dependencies for composing complex stacks, library charts for code reuse, OCI-based distribution, plugins, and CI/CD integration patterns.

## Helm Hooks

**Hooks** let you run specific actions at certain points in the release lifecycle. They are regular Kubernetes resources with a special annotation.

### Hook Types

| Hook | Fires |
|------|-------|
| `pre-install` | Before any release resources are created |
| `post-install` | After all resources are created |
| `pre-upgrade` | Before an upgrade begins |
| `post-upgrade` | After an upgrade completes |
| `pre-delete` | Before a release is deleted |
| `post-delete` | After a release is deleted |
| `pre-rollback` | Before a rollback begins |
| `post-rollback` | After a rollback completes |

### Database Migration Hook Example

A common use case is running database migrations before deploying new application code:

```yaml
# templates/migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "myapp.fullname" . }}-migrate
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
  annotations:
    "helm.sh/hook": pre-upgrade,pre-install
    "helm.sh/hook-weight": "0"
    "helm.sh/hook-delete-policy": before-hook-creation
spec:
  backoffLimit: 3
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          command: ["./migrate", "--direction", "up"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: {{ include "myapp.fullname" . }}-db
                  key: url
```

Key annotations:

- `helm.sh/hook` -- specifies when the hook fires. You can list multiple hooks separated by commas.
- `helm.sh/hook-weight` -- controls ordering when multiple hooks fire at the same point. Lower weights run first.
- `helm.sh/hook-delete-policy` -- controls cleanup. Options are `before-hook-creation` (delete previous hook resource before creating a new one), `hook-succeeded` (delete after success), and `hook-failed` (delete after failure).

### Hook Ordering

When multiple hooks share the same lifecycle point, they run in weight order:

```yaml
# Run first (weight -5)
annotations:
  "helm.sh/hook": pre-upgrade
  "helm.sh/hook-weight": "-5"

# Run second (weight 0)
annotations:
  "helm.sh/hook": pre-upgrade
  "helm.sh/hook-weight": "0"

# Run third (weight 5)
annotations:
  "helm.sh/hook": pre-upgrade
  "helm.sh/hook-weight": "5"
```

## Chart Dependencies

Charts can depend on other charts. This lets you compose complex applications from reusable building blocks.

### Declaring Dependencies

Add dependencies in `Chart.yaml`:

```yaml
# Chart.yaml
apiVersion: v2
name: myapp
version: 0.1.0
dependencies:
  - name: postgresql
    version: "15.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: "19.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

The `condition` field lets users enable or disable the dependency via values:

```yaml
# values.yaml
postgresql:
  enabled: true
  auth:
    postgresPassword: secret
    database: myapp

redis:
  enabled: false
```

### Building Dependencies

After declaring dependencies, download them:

```bash
helm dependency update myapp/
```

This downloads the dependency charts into `myapp/charts/` and generates a `Chart.lock` file (similar to package-lock.json).

```bash
helm dependency list myapp/
```

```text
NAME        VERSION   REPOSITORY                              STATUS
postgresql  15.5.38   https://charts.bitnami.com/bitnami      ok
redis       19.1.0    https://charts.bitnami.com/bitnami      ok
```

### Passing Values to Dependencies

Values for sub-charts are nested under the dependency name:

```yaml
# values.yaml
postgresql:
  primary:
    persistence:
      size: 20Gi
  auth:
    postgresPassword: secret
```

You can also use `global` values that are accessible to all charts in the dependency tree:

```yaml
global:
  storageClass: gp3
  imageRegistry: myregistry.example.com
```

## Library Charts

**Library charts** provide reusable template definitions without producing any Kubernetes resources on their own. They are declared with `type: library` in their `Chart.yaml`.

```yaml
# Chart.yaml of the library chart
apiVersion: v2
name: common-templates
type: library
version: 1.0.0
```

Define shared helpers in the library:

```yaml
# templates/_labels.tpl
{{- define "common.labels" -}}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: {{ .Values.global.platform | default "myplatform" }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end }}
```

Consume the library as a dependency:

```yaml
# Chart.yaml of the consuming chart
dependencies:
  - name: common-templates
    version: "1.x.x"
    repository: "oci://ghcr.io/myorg/charts"
```

Then use its templates:

```yaml
# templates/deployment.yaml
metadata:
  labels:
    {{- include "common.labels" . | nindent 4 }}
```

Library charts are ideal for organizations that want consistent labeling, annotations, and patterns across many charts.

## OCI Registry Support

Helm 3 supports storing charts in **OCI-compliant registries** -- the same registries you use for container images.

### Pushing Charts to OCI

```bash
# Login to the registry
helm registry login ghcr.io --username myuser

# Package the chart
helm package myapp/

# Push to the registry
helm push myapp-0.1.0.tgz oci://ghcr.io/myorg/charts
```

### Pulling and Installing from OCI

```bash
# Pull a chart
helm pull oci://ghcr.io/myorg/charts/myapp --version 0.1.0

# Install directly from OCI
helm install myrelease oci://ghcr.io/myorg/charts/myapp --version 0.1.0
```

OCI support eliminates the need to maintain a separate chart repository server. You get versioning, authentication, and access control from your existing container registry infrastructure.

## Helm Plugins

Helm has a plugin system that extends its functionality. Some popular plugins include:

### helm-diff

Shows a diff of what would change during an upgrade:

```bash
helm plugin install https://github.com/databus23/helm-diff

helm diff upgrade my-redis bitnami/redis -f redis-values.yaml
```

```text
default, my-redis-master, StatefulSet (apps) has changed:
  spec:
    template:
      spec:
        containers:
-         cpu: 250m
+         cpu: 500m
```

### helm-secrets

Encrypts sensitive values using SOPS, Mozilla's secrets management tool:

```bash
helm plugin install https://github.com/jkroepke/helm-secrets

# Encrypt a values file
helm secrets encrypt values-secret.yaml

# Install with encrypted values
helm secrets install my-redis bitnami/redis -f values-secret.yaml
```

### helm-unittest

Write unit tests for your chart templates:

```bash
helm plugin install https://github.com/helm-unittest/helm-unittest

helm unittest myapp/
```

Test files live in `myapp/tests/`:

```yaml
# tests/deployment_test.yaml
suite: deployment tests
templates:
  - deployment.yaml
tests:
  - it: should set correct replica count
    set:
      replicaCount: 3
    asserts:
      - equal:
          path: spec.replicas
          value: 3
  - it: should use the correct image
    set:
      image.repository: myorg/myapp
      image.tag: "2.0.0"
    asserts:
      - equal:
          path: spec.template.spec.containers[0].image
          value: "myorg/myapp:2.0.0"
```

## CI/CD Integration

Helm fits naturally into CI/CD pipelines. Here are proven patterns.

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yaml
name: Deploy with Helm
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/deployer
          aws-region: us-east-1

      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name my-cluster

      - name: Install Helm
        uses: azure/setup-helm@v4

      - name: Deploy
        run: |
          helm upgrade --install myapp ./charts/myapp \
            -f charts/myapp/values-production.yaml \
            --namespace production \
            --create-namespace \
            --atomic \
            --timeout 10m \
            --set image.tag=${{ github.sha }}
```

### GitOps with Helm

For GitOps workflows, tools like **ArgoCD** and **Flux** natively understand Helm charts:

```yaml
# ArgoCD Application manifest
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/myorg/myapp.git
    targetRevision: main
    path: charts/myapp
    helm:
      valueFiles:
        - values-production.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

ArgoCD monitors your Git repository and automatically syncs the Helm release when changes are detected. This gives you declarative, auditable deployments without running `helm upgrade` manually.

### Best Practices for Production Helm Usage

1. **Pin chart versions** -- always specify `--version` in scripts and CI/CD pipelines.
2. **Use values files, not --set** -- values files are version-controlled, reviewable, and less error-prone.
3. **Enable --atomic for production** -- automatic rollback on failure prevents broken deployments.
4. **Use namespaces for isolation** -- separate your monitoring, ingress, and application workloads.
5. **Lint and template in CI** -- catch errors before they reach the cluster.
6. **Use helm-diff before upgrading** -- review changes before applying them.
7. **Store charts in OCI registries** -- leverage your existing registry infrastructure.
8. **Write chart tests** -- validate templates with helm-unittest and run integration tests with `helm test`.
9. **Keep release history manageable** -- set `--history-max` to avoid bloating etcd.
10. **Document your values** -- add comments to `values.yaml` explaining each parameter.

## Where to Go from Here

You now have a comprehensive foundation in Helm. From core concepts to chart creation, release management, and CI/CD integration, you can confidently manage Kubernetes applications at any scale. Continue your journey by exploring the official Helm documentation at [helm.sh](https://helm.sh), contributing to public charts, and building an internal chart library for your organization.

Remember to generate the OG image for this guide:

```bash
npm run generate:images:parallel
npm run convert:svg-to-png:parallel
```
