---
title: 'GitOps with Argo CD: Structuring Your Repository for Multi-Environment Deployments'
excerpt: 'A practical guide to laying out your Git repository for Argo CD across dev, staging, and production. See real folder structures, Kustomize and Helm patterns, and the pitfalls that bite teams in production.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-04-27'
publishedAt: '2026-04-27T09:00:00Z'
updatedAt: '2026-04-27T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - gitops
  - argocd
  - deployments
  - repository-structure
  - kubernetes
  - kustomize
  - helm
---

You promoted a small Helm value change from staging to production. The diff looked harmless. Two minutes later, prod started serving 502s because the same chart version was used everywhere and a default replica count from a shared file leaked into the production overlay. Rolling back took longer than it should have because dev, staging, and prod all sat in the same folder under the same `values.yaml`.

If that sounds familiar, the problem is rarely Argo CD itself. It is how the repository is laid out.

This post walks through the repository patterns that actually hold up in production: where to put environment overlays, how to handle promotion between dev, staging, and prod, when to split the app code from the config, and what the Argo CD `Application` resources should look like for each pattern. Code is copy-pasteable.

## TLDR

Use two repos: one for application source code, one for Kubernetes manifests. In the manifests repo, give each environment its own folder and its own Argo CD `Application`. Pin every environment to a different Git path or branch so a change in dev cannot accidentally hit prod. Use Kustomize overlays or Helm value files per environment, not conditionals based on namespace or labels. Promote by opening a pull request that bumps an image tag in the next environment's folder, never by editing a shared file.

## Prerequisites

- A Kubernetes cluster (kind, k3s, or any managed offering works)
- Argo CD installed (`kubectl create namespace argocd && kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml`)
- `kubectl`, `argocd` CLI, and either `kustomize` or `helm` installed locally
- A Git provider (GitHub, GitLab, Gitea) where Argo CD can read your config repo

## Why repository layout decides your blast radius

Argo CD reconciles whatever Git tells it to reconcile. If two environments read from the same path, they share the same fate. Your repo layout is the actual blast radius boundary, not the namespace or the cluster.

Three rules to keep in mind:

1. Every environment maps to its own path or branch.
2. Promotion between environments is a Git operation (commit or merge), nothing else.
3. Shared bases are fine. Shared overrides are not.

Break any of these and you end up debugging Argo CD when the real bug is a YAML file that someone edited at the wrong level.

## Pattern 1: One repo per app vs the monorepo

You have two choices for how many repos to use.

**App + config split (recommended):**

```text
my-app/                  # source code repo
  src/
  Dockerfile
  .github/workflows/

my-app-config/           # GitOps repo, watched by Argo CD
  base/
  envs/
    dev/
    staging/
    prod/
```

CI builds the image from `my-app`, pushes to a registry, then opens a PR in `my-app-config` that bumps the image tag. Argo CD picks up the change.

**Why split:** developers can iterate on application code without triggering deploys. Argo CD does not need read access to your source code. You can grant tight permissions on the config repo (only release engineers can merge to `prod` paths).

**Single monorepo:** keep `src/` and `k8s/` in the same repo. Simpler for tiny teams. The downside is every code commit triggers a manifest reconciliation check, and PR reviews mix code changes with deploy changes. Pick the split as soon as you have more than one or two services.

## Pattern 2: Folder-per-environment with Kustomize

This is the workhorse pattern. It is what most teams land on after a year or two of running Argo CD.

```text
my-app-config/
  base/
    deployment.yaml
    service.yaml
    kustomization.yaml
  envs/
    dev/
      kustomization.yaml
      patch-replicas.yaml
      values.env
    staging/
      kustomization.yaml
      patch-replicas.yaml
      values.env
    prod/
      kustomization.yaml
      patch-replicas.yaml
      patch-resources.yaml
      values.env
```

The `base/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml

commonLabels:
  app: my-app
```

A production overlay at `envs/prod/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: my-app-prod

resources:
  - ../../base

images:
  - name: ghcr.io/acme/my-app
    newTag: v1.42.0

patches:
  - path: patch-replicas.yaml
  - path: patch-resources.yaml
```

The replicas patch:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 6
```

Render it locally before you commit anything. This is the single most useful habit when working with Kustomize:

```bash
kubectl kustomize envs/prod
```

Expected output (truncated):

```text
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: my-app
  name: my-app
  namespace: my-app-prod
spec:
  replicas: 6
  template:
    spec:
      containers:
        - image: ghcr.io/acme/my-app:v1.42.0
          name: my-app
          resources:
            limits:
              cpu: "2"
              memory: 2Gi
```

If something looks wrong here, it is wrong. Argo CD will render the same output.

The matching Argo CD `Application` for prod:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app-prod
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/acme/my-app-config.git
    targetRevision: main
    path: envs/prod
  destination:
    server: https://kubernetes.default.svc
    namespace: my-app-prod
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

Notice the `path: envs/prod`. Dev and staging get their own `Application` resources pointing at `envs/dev` and `envs/staging`. There is no shared file that can break two environments at once.

## Pattern 3: Helm with one values file per environment

If you already publish a Helm chart, use it. Do not rewrite it as Kustomize for the sake of it.

```text
my-app-config/
  chart/
    Chart.yaml
    templates/
    values.yaml
  envs/
    dev/values.yaml
    staging/values.yaml
    prod/values.yaml
```

The Argo CD `Application` for staging:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app-staging
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/acme/my-app-config.git
    targetRevision: main
    path: chart
    helm:
      valueFiles:
        - ../envs/staging/values.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: my-app-staging
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

A real `envs/prod/values.yaml`:

```yaml
image:
  repository: ghcr.io/acme/my-app
  tag: v1.42.0

replicaCount: 6

resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: "2"
    memory: 2Gi

ingress:
  enabled: true
  hosts:
    - host: my-app.example.com

autoscaling:
  enabled: true
  minReplicas: 6
  maxReplicas: 20
```

Render locally before you push:

```bash
helm template my-app ./chart -f envs/prod/values.yaml
```

If this fails or outputs the wrong thing, do not commit. Argo CD will fail the same way, but in front of your team.

## Pattern 4: App of Apps for fleet-wide changes

Once you pass a handful of services, you do not want to write thirty `Application` YAMLs by hand. Use the **App of Apps** pattern: one parent `Application` that points to a folder full of child `Application` manifests.

```text
my-platform-config/
  apps/
    dev/
      my-app.yaml
      my-other-app.yaml
    staging/
      my-app.yaml
    prod/
      my-app.yaml
```

The parent for the dev environment:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: dev-apps
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/acme/my-platform-config.git
    targetRevision: main
    path: apps/dev
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

Adding a new service to dev is now one PR that drops a single YAML file into `apps/dev/`. No clicking around in the UI, no `argocd app create` commands.

For larger setups, look at `ApplicationSet`, which generates `Application` resources from a list, a Git directory, or a cluster generator. It is the right tool when you have ten environments times five clusters, not three environments times one cluster.

## Promoting between environments

The whole point of GitOps is that promotion is a commit. Here is the flow that works:

1. CI builds image `ghcr.io/acme/my-app:v1.42.0` and pushes it.
2. CI opens a PR in `my-app-config` that updates `envs/dev/kustomization.yaml` to set `newTag: v1.42.0`.
3. PR auto-merges if checks pass. Argo CD syncs dev within a minute or two.
4. After dev runs the new tag for some agreed time, a human (or an automated job) opens a PR that bumps `envs/staging/kustomization.yaml` to the same tag.
5. Same again for `envs/prod`, this time gated on a manual review.

A typical CI step that opens the dev PR:

```yaml
- name: Bump dev image tag
  run: |
    git clone https://x-access-token:${{ secrets.GH_PAT }}@github.com/acme/my-app-config.git
    cd my-app-config
    yq -i '(.images[] | select(.name=="ghcr.io/acme/my-app")).newTag = "${{ github.sha }}"' envs/dev/kustomization.yaml
    git checkout -b bump-dev-${{ github.sha }}
    git commit -am "dev: bump my-app to ${{ github.sha }}"
    git push origin bump-dev-${{ github.sha }}
    gh pr create --fill --base main
```

Use `argocd-image-updater` if you do not want to wire this in CI yourself. It watches the registry and writes the tag bump back to Git. The end result is the same: tags change in Git, never in the cluster.

## Common mistakes that break things in production

**Sharing a single values file across environments.** A `values.yaml` that uses `if eq .Values.env "prod"` blocks is a footgun. Separate files, separate paths.

**Letting Argo CD watch one path for all environments.** If `envs/` is a single Argo CD `Application`, a typo in dev rolls into prod the moment you merge. One `Application` per environment, always.

**Auto-sync without `selfHeal: false` on prod.** During an incident you sometimes need to `kubectl edit` a deployment to test a fix. With `selfHeal: true`, Argo CD will revert it within seconds. Either disable self-heal on prod or accept that hotfixes go through Git only.

**Storing secrets in the config repo as plain YAML.** Use `sealed-secrets`, `external-secrets`, or `sops` with `helm-secrets`. Plain secrets in Git are a one-way trip you cannot undo.

**Using `targetRevision: HEAD` everywhere.** Pin prod to a tag or a commit SHA when you want stricter promotion gates. `HEAD` is fine for dev.

## Concrete next steps

1. Pick one service and split it into `<service>` and `<service>-config` repos this week. Do not boil the ocean.
2. Create the `base/` and `envs/{dev,staging,prod}/` layout in the config repo. Run `kubectl kustomize envs/dev` locally and confirm the output looks right.
3. Write three `Application` manifests, one per environment, and apply them to the `argocd` namespace with `kubectl apply -f`.
4. Wire up your CI to open a PR against `envs/dev/kustomization.yaml` on every successful build. Leave staging and prod as manual PRs for the first two weeks.
5. Once you have two or three services on this pattern, introduce App of Apps so onboarding the next service is one YAML file, not ten.

The structure you pick on day one is what your team will fight against on day three hundred. Spend the afternoon getting the folders right and the rest of GitOps becomes boring, which is exactly what you want.
