---
title: 'kubectl apply vs kubectl create, and How to Export Live YAML'
excerpt: 'Learn when to use kubectl apply, create, replace and server-side apply, how apply decides what to change, and how to get clean YAML from a resource that already runs.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-12-13'
publishedAt: '2024-12-13T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - kubectl
  - YAML
  - Server-Side Apply
  - GitOps
---

`kubectl create` and `kubectl apply` both turn a manifest into objects in the cluster, and the first time you run them on a new file they print almost the same thing. The difference shows on the second run. `create` fails because the object exists, and `apply` updates the object to match the file. That makes `apply` the command for files in Git, and `create` the command for one-time objects and for generating YAML. This post explains both, how `apply` works out what to change, the server-side form of `apply`, and how to get clean YAML back from an object that already runs in a cluster.

## TLDR

| Question                                    | Short answer                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| apply or create?                            | `apply` for manifests that you keep and change. `create` for one-time objects and to generate YAML |
| What does `apply` do on the second run?     | It compares the file, the live object and the last applied version, and patches the difference     |
| Should I use server-side apply?             | Yes, for CI and controllers: `kubectl apply --server-side`                                         |
| How do I see the change first?              | `kubectl diff -f deployment.yaml`                                                                  |
| How do I get the YAML of a running Service? | `kubectl get service web -o yaml`, then remove `status` and the server-set fields                  |
| What happened to `--export`?                | Deprecated, then removed in kubectl 1.19                                                           |

## Prerequisites

- `kubectl` and a cluster where you can create objects. A local kind or minikube cluster is enough.
- `yq` (version 4) for the YAML cleanup example. It is optional.

## What Is the Difference Between kubectl apply and kubectl create?

`kubectl create -f` is **imperative**: "make these objects". If an object with the same name exists, it fails:

```bash
kubectl create -f deployment.yaml
kubectl create -f deployment.yaml   # second time
```

```text
deployment.apps/web created
Error from server (AlreadyExists): error when creating "deployment.yaml": deployments.apps "web" already exists
```

`kubectl apply -f` is **declarative**: "make the cluster match this file". It creates objects that do not exist and patches the ones that do:

```bash
kubectl apply -f deployment.yaml   # deployment.apps/web created
kubectl apply -f deployment.yaml   # deployment.apps/web unchanged
# edit the file: replicas 3 -> 5
kubectl apply -f deployment.yaml   # deployment.apps/web configured
```

Both take a file, a directory (`-f k8s/`, add `-R` for subdirectories), a URL or standard input (`-f -`). `kubectl create` also has subcommands that build an object from flags, such as `kubectl create deployment`, `kubectl create secret generic` and `kubectl create job --from=cronjob/backup`. There is no `kubectl apply deployment`.

To update an object that you created with `create`, you do not have to delete it. `kubectl apply` works on it too, and prints a warning the first time:

```text
Warning: resource deployments/web is missing the kubectl.kubernetes.io/last-applied-configuration annotation which is required by kubectl apply. kubectl apply should only be used on resources created declaratively by either kubectl create --save-config or kubectl apply. The missing annotation will be patched automatically.
deployment.apps/web configured
```

## How Does kubectl apply Decide What to Change?

By default, `apply` runs on the client and uses a **three-way merge** of:

1. the file you apply now,
2. the live object in the cluster,
3. the file you applied last time, which kubectl stores in the `kubectl.kubernetes.io/last-applied-configuration` annotation.

The third part is why `apply` can delete a field. If `resources.limits` was in the last applied file and is not in the new one, `apply` removes it from the object. A field that your file leaves out, such as `replicas` when an autoscaler manages it, is not in the last applied file either, so `apply` leaves it alone. If your file sets `replicas`, every apply resets it to that value.

**Server-side apply** (`kubectl apply --server-side`, stable since Kubernetes 1.22) moves that logic into the API server. The server records which **field manager** owns each field in `metadata.managedFields`. If you apply a different value for a field that another manager owns, the API server returns a conflict instead of overwriting it in silence:

```bash
kubectl apply --server-side -f deployment.yaml
kubectl apply --server-side --force-conflicts -f deployment.yaml  # take ownership on purpose
```

Server-side apply works better when several tools change the same object: a CI job, an autoscaler, a GitOps controller and a human with kubectl. It does not need the large annotation, so it also handles big objects, such as CRDs, that hit the annotation size limit. Use it in pipelines. Argo CD and Flux can use it too.

## When Should You Use apply and When create?

| Situation                                                      | Command                                                                                                    |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Manifests in Git that you change over time                     | `kubectl apply -f` (or `--server-side`), or a GitOps tool                                                  |
| A one-time object, such as a Job from a CronJob                | `kubectl create job manual-1 --from=cronjob/backup`                                                        |
| A script that must fail if the object already exists           | `kubectl create -f`                                                                                        |
| A starting manifest that you then edit and commit              | `kubectl create deployment web --image=... --dry-run=client -o yaml > web.yaml`                            |
| A Secret or ConfigMap from files, created or updated each time | `kubectl create secret generic app --from-file=config.json --dry-run=client -o yaml \| kubectl apply -f -` |

The last two rows combine the commands: `create --dry-run=client -o yaml` prints an object without sending it, and `apply` creates or updates it. That is the usual way to update a Secret from a file, and it avoids the gap that `delete` plus `create` leaves.

## How Do I Check a Change Before I Apply It?

```bash
kubectl diff -f deployment.yaml                 # what would change, as a diff against the live object
kubectl apply -f deployment.yaml --dry-run=server  # full validation and admission, nothing saved
```

`kubectl diff` exits with code 1 when there are differences, which is useful in CI. `--dry-run=server` runs the request through validation and admission webhooks without saving it. `--dry-run=client` only prints the object. Validation is on by default (`--validate=strict`): kubectl rejects unknown or duplicate fields, such as `replica: 3` instead of `replicas: 3`. `--validate=warn` reports them and continues.

## kubectl replace and Force

`kubectl replace -f` swaps the whole object for the file. Fields that are not in the file are removed, and the object must already exist. `kubectl replace --force -f` deletes the object and creates it again. That gives it a new UID and restarts its pods, and a Service without a fixed `clusterIP` gets a new one. Use it only for fields that cannot be changed in place, such as the `selector` of a Deployment.

`kubectl create` has no `--force` flag, despite what some older guides show. To delete and create again, run `kubectl delete -f` and `kubectl create -f`, or `kubectl replace --force -f`.

## How Do I Delete What I Removed From the Folder?

`kubectl apply -f k8s/` never deletes an object whose file you removed. `--prune` does, but the flag is still marked alpha, and it needs `-l` or `--all` to know which objects belong to this set of files:

```bash
kubectl apply -f k8s/ --prune -l app=web   # deletes applied objects with app=web that are no longer in k8s/
```

It only considers objects that an earlier `apply` created, and only a default list of common types such as Deployments, Services, ConfigMaps and Secrets. A label selector that is too wide deletes objects that you did not mean to touch. Run it with `--dry-run=server` first. For anything beyond one small app, a GitOps tool such as Argo CD or Flux tracks what it created and prunes it for you.

## How Do I Get the YAML of a Deployed Resource?

Use `-o yaml` on `kubectl get`:

```bash
kubectl get service web -n shop -o yaml
kubectl get deployment,service,configmap -l app=web -n shop -o yaml > web-live.yaml
```

The output is the live object, not the file that created it. It contains fields that the cluster added:

- `status`, which the controllers write.
- `metadata.uid`, `resourceVersion`, `generation` and `creationTimestamp`.
- `metadata.managedFields`. kubectl hides it since 1.21. Add `--show-managed-fields` to see it.
- Defaults that the API server filled in, such as `strategy` and `revisionHistoryLimit` on a Deployment.
- For a Service, `spec.clusterIP` and `spec.clusterIPs`. These addresses come from this cluster's Service range. In another cluster they can fail, or take an address that another Service needs.
- The `last-applied-configuration` annotation, if the object came from `kubectl apply`.

Old guides use `kubectl get --export` to strip these fields. That flag was deprecated for several releases and removed in kubectl 1.19. Remove them with `yq`, or with the `kubectl neat` plugin from krew:

```bash
kubectl get service web -n shop -o yaml | yq 'del(
  .status,
  .metadata.uid, .metadata.resourceVersion, .metadata.generation,
  .metadata.creationTimestamp, .metadata.managedFields,
  .metadata.annotations["kubectl.kubernetes.io/last-applied-configuration"],
  .spec.clusterIP, .spec.clusterIPs
)' > web-service.yaml
```

This is for a normal Service. For a headless Service, keep `clusterIP: None`, which is part of its design and not an allocated address: remove `.spec.clusterIP` from the list.

If the object was created with `kubectl apply`, you can also print exactly what was applied last: `kubectl apply view-last-applied service/web -n shop`.

Treat exported YAML as a starting point, not as a backup. The source of truth should be the manifests in Git, and a cluster backup is a job for a tool such as Velero. Be careful with Secrets: `-o yaml` prints their data in base64, which anyone can decode.

## Related Resources

- [Introduction to Kubernetes: Declarative and Imperative Commands](/guides/introduction-to-kubernetes/01-kubernetes-architecture-and-components#h2-declarative-and-imperative-commands)
- [Roll out config changes with Kustomize](/guides/introduction-to-kubernetes/06-configmaps-and-secrets#h2-roll-out-config-changes-with-kustomize)
- [How to manage namespaces, contexts and environments](/posts/how-to-manage-multiple-environments-in-kubernetes)
- [Introduction to Argo CD](/posts/introduction-to-argocd): GitOps that applies and prunes for you
- [YAML parsing simulator](/games/yaml-parsing-simulator): see how YAML turns into data, and where indentation goes wrong
- [Kubernetes terminal simulator](/games/kubernetes-terminal-simulator)
- [Helm vs Kustomize](/comparisons/helm-vs-kustomize) and the [GitOps implementation checklist](/checklists/gitops-implementation)
