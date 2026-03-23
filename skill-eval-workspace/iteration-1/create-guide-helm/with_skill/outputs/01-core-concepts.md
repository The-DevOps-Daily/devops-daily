---
title: 'Helm Core Concepts and Architecture'
description: 'Understand the fundamental building blocks of Helm including charts, releases, repositories, and how Helm interacts with your Kubernetes cluster.'
order: 1
---

Before you start using Helm, you need a solid understanding of its core concepts. Helm is often described as "the package manager for Kubernetes," and that analogy holds up well. Just as `apt` manages packages on Debian or `brew` manages packages on macOS, Helm manages applications on Kubernetes. In this first part, we break down every key concept you need to know.

## What Is Helm?

**Helm** is a tool that streamlines the installation and management of Kubernetes applications. It was originally created by Deis (later acquired by Microsoft) and is now a graduated project under the Cloud Native Computing Foundation (CNCF). Helm provides three key capabilities:

1. **Packaging** -- bundling all the Kubernetes manifests an application needs into a single, versioned artifact called a chart.
2. **Templating** -- parameterizing your manifests so a single chart can be deployed with different configurations for dev, staging, and production.
3. **Release management** -- tracking every installation and upgrade as a named release with full revision history, enabling easy rollbacks.

## Charts

A **chart** is Helm's packaging format. It is a collection of files organized in a specific directory structure that describes a related set of Kubernetes resources. Think of a chart as the Helm equivalent of a Debian `.deb` package or an RPM `.rpm` file.

A minimal chart directory looks like this:

```text
mychart/
  Chart.yaml          # Metadata about the chart (name, version, description)
  values.yaml         # Default configuration values
  templates/          # Kubernetes manifest templates
    deployment.yaml
    service.yaml
    _helpers.tpl      # Template helper functions
```

The `Chart.yaml` file is the chart's identity card:

```yaml
apiVersion: v2
name: mychart
description: A Helm chart for my application
type: application
version: 0.1.0
appVersion: "1.0.0"
```

Key fields include:

- `apiVersion` -- always `v2` for Helm 3 charts.
- `name` -- the name of the chart.
- `version` -- the chart version, following Semantic Versioning.
- `appVersion` -- the version of the application the chart deploys. This is informational and does not affect chart behavior.
- `type` -- either `application` (default, deployable) or `library` (provides utilities to other charts but is not installable on its own).

## Releases

When you install a chart into a Kubernetes cluster, Helm creates a **release**. A release is a running instance of a chart with a specific configuration. You can install the same chart multiple times into the same cluster, and each installation creates a distinct release with its own name.

For example, if you install a PostgreSQL chart twice -- once for your application database and once for your analytics database -- you get two releases:

```bash
helm install app-db bitnami/postgresql --set auth.postgresPassword=secret1
helm install analytics-db bitnami/postgresql --set auth.postgresPassword=secret2
```

Each release tracks its own revision history. When you upgrade a release, Helm increments the revision number. When you roll back, Helm creates a new revision that matches the state of a previous one. This gives you a complete audit trail of every change.

You can list all releases in your cluster:

```bash
helm list
```

```text
NAME          NAMESPACE  REVISION  UPDATED                   STATUS    CHART               APP VERSION
app-db        default    1         2026-03-20 10:00:00 UTC   deployed  postgresql-14.0.0   16.2.0
analytics-db  default    1         2026-03-20 10:05:00 UTC   deployed  postgresql-14.0.0   16.2.0
```

## Repositories

A **chart repository** is an HTTP server that hosts packaged charts along with an `index.yaml` file that lists available charts and their versions. Repositories work similarly to Linux package repositories or Docker registries.

Some well-known public repositories include:

- **Bitnami** (`https://charts.bitnami.com/bitnami`) -- one of the largest collections of production-ready charts.
- **Artifact Hub** (`https://artifacthub.io`) -- a web-based catalog that aggregates charts from many repositories.

You add a repository to your local Helm client and then search or install charts from it:

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm search repo bitnami/nginx
```

Helm 3 also supports **OCI-based registries**, allowing you to push and pull charts using the same registries you use for container images (e.g., Amazon ECR, GitHub Container Registry, Docker Hub).

```bash
helm push mychart-0.1.0.tgz oci://ghcr.io/myorg/charts
helm install myrelease oci://ghcr.io/myorg/charts/mychart --version 0.1.0
```

## Helm 3 Architecture

Helm 3 introduced a significant architectural change compared to Helm 2: the removal of **Tiller**. In Helm 2, Tiller was a server-side component that ran inside the cluster and managed releases. This created security concerns because Tiller typically required cluster-admin privileges.

Helm 3 is a purely client-side tool. It communicates directly with the Kubernetes API server using your existing kubeconfig credentials. Release information is stored as Kubernetes Secrets (by default) in the namespace where the release is installed.

```text
+-------------------+          +-------------------+
|   Helm CLI        |  ------> |  Kubernetes API   |
|   (client-side)   |          |  Server           |
+-------------------+          +-------------------+
                                       |
                               +-------+-------+
                               |               |
                          Secrets          Resources
                        (release data)   (deployed objects)
```

This architecture means:

- **No cluster-side component** to install or maintain.
- **RBAC is respected** -- Helm can only do what your kubeconfig allows.
- **Release data is namespaced** -- each namespace holds its own release secrets, providing natural isolation.

## Values and Templating at a Glance

Helm templates use the **Go template language** augmented with the Sprig function library. Values defined in `values.yaml` are injected into templates at render time. You can override values at install or upgrade time via `--set` flags or `-f` (values files).

```yaml
# values.yaml
replicaCount: 2
image:
  repository: nginx
  tag: "1.25"
  pullPolicy: IfNotPresent
```

```yaml
# templates/deployment.yaml (simplified)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-nginx
spec:
  replicas: {{ .Values.replicaCount }}
  template:
    spec:
      containers:
        - name: nginx
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
```

We will explore templating in depth in Part 4.

## Summary

Understanding charts, releases, repositories, and Helm's client-side architecture gives you the vocabulary to work effectively with Helm. In the next part, we will get hands-on by installing Helm and configuring it for your environment.
