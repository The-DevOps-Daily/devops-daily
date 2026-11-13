---
title: 'Why Does a Deleted Kubernetes Pod Get Recreated? Deployments, Images'
excerpt: 'A deleted pod comes back because a controller owns it. Find and stop that controller, compare pods, Deployments and StatefulSets, update or re-pull an image, and debug ImagePullBackOff.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-06-20'
publishedAt: '2024-06-20T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Pods
  - Deployments
  - StatefulSets
  - ReplicaSets
  - kubectl
---

You delete a pod, and a few seconds later a pod with a new name is running in its place. Kubernetes did not ignore your command. The pod was deleted, and the controller that owns it created a replacement, because that is its job. Once you know which controller owns a pod, most questions about pods and Deployments have short answers: how to make a pod stay deleted, when to use a StatefulSet, how to roll out a new image, and why a pod keeps running an old image.

## TLDR

| Question                                  | Short answer                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Why does a deleted pod come back?         | A controller (ReplicaSet, StatefulSet, DaemonSet, Job) owns it and restores the replica count                   |
| How do I find the owner?                  | `kubectl get pod <pod> -o jsonpath='{.metadata.ownerReferences[*].kind}'`                                       |
| How do I stop the pods for good?          | `kubectl scale deployment/web --replicas=0`, or delete the Deployment                                           |
| Pod or Deployment?                        | A Deployment for anything that must keep running. A bare pod only for a quick test                              |
| Deployment or StatefulSet?                | A StatefulSet when each replica needs its own name and its own volume                                           |
| How do I change the image?                | `kubectl set image deployment/web app=<image>`, or change the manifest and apply it                             |
| How do I force a re-pull of the same tag? | `imagePullPolicy: Always` plus `kubectl rollout restart`. Better: a new tag or a digest for each build          |
| Why is my pod in `ImagePullBackOff`?      | Read the pull error in `kubectl describe pod`: a wrong name or tag, no credentials, or no route to the registry |
| How do I remove old ReplicaSets?          | Set `revisionHistoryLimit` on the Deployment (default 10)                                                       |

## Prerequisites

- A Kubernetes cluster and `kubectl`. A local kind or minikube cluster is enough for every example.
- The examples use the `shop` namespace. Create it with `kubectl create namespace shop`, or change `-n shop` to your namespace.

## Why Does a Kubernetes Pod Get Recreated When Deleted?

Because a controller owns the pod. A Deployment does not manage pods directly: it creates a **ReplicaSet**, and the ReplicaSet keeps the number of pods equal to `replicas`. When you delete one pod, the ReplicaSet sees two pods where it wants three, and it creates a new one. This loop of "compare the actual state with the desired state, then fix the difference" is how every Kubernetes controller works.

Each pod records its owner in `metadata.ownerReferences`. Check it before you delete anything:

```bash
kubectl get pod web-7d4b9c-x2kqz -n shop \
  -o jsonpath='{range .metadata.ownerReferences[*]}{.kind}/{.name}{"\n"}{end}'
```

```text
ReplicaSet/web-7d4b9c
```

A ReplicaSet in turn belongs to a Deployment. Run the same command on `replicaset/web-7d4b9c` to see `Deployment/web`. The owner tells you what brings the pod back:

| Owner                     | What happens when you delete the pod                                                   |
| ------------------------- | -------------------------------------------------------------------------------------- |
| ReplicaSet (a Deployment) | A new pod with a new random name, on any node that fits                                |
| StatefulSet               | A new pod with the same name (`db-0`) and the same PersistentVolumeClaim               |
| DaemonSet                 | A new pod on the same node, because a DaemonSet runs one pod on each matching node     |
| Job                       | A new pod, until the Job has the number of successful completions it needs             |
| Node (a static pod)       | The kubelet creates the mirror pod again at once. The pod runs from a file on the node |
| None (a bare pod)         | Nothing. The pod is gone                                                               |

Static pods are the control plane components of kubeadm clusters, such as `kube-apiserver-<node>`. Their manifests are files in `/etc/kubernetes/manifests` on the node. `kubectl delete` removes only the mirror object in the API, and the kubelet adds it back.

### How Do I Delete a Pod So It Stays Deleted?

Change the owner, not the pod.

```bash
# Keep the Deployment, run no pods
kubectl scale deployment/web -n shop --replicas=0

# Remove the Deployment, its ReplicaSets and its pods
kubectl delete deployment/web -n shop
```

Two things can undo a scale to zero:

- A **GitOps tool** such as Argo CD or Flux with self-heal on puts `replicas` back to the value in Git. Change it in Git instead.
- A **Helm upgrade** applies the chart's `replicas` again.

A HorizontalPodAutoscaler does not undo it. It stops scaling a workload that has 0 replicas, and continues when you set 1 or more again.

To remove a Deployment but keep its pods running, use `kubectl delete deployment/web --cascade=orphan`. Its ReplicaSets stay and keep their pods, and a new Deployment with the same selector adopts those ReplicaSets. For a static pod, move its manifest file out of `/etc/kubernetes/manifests` on the node.

## What Is the Difference Between a Pod and a Deployment?

A **pod** is one or more containers that run together on one node and share a network namespace and volumes. A **Deployment** is a controller that keeps a number of identical pods running, and replaces them in a controlled way when you change the pod template.

A bare pod is not as fragile as many guides say. If a container in it exits, the kubelet restarts that container in the same pod, according to `restartPolicy` (default `Always`). What a bare pod cannot survive is the loss of the pod itself: a deleted pod, an eviction, or a node failure. Nothing creates it again. A bare pod also cannot change its image with a rolling update or roll back.

| Feature                           | Bare pod              | Deployment                                     |
| --------------------------------- | --------------------- | ---------------------------------------------- |
| Restarts a crashed container      | Yes, on the same node | Yes, on the same node                          |
| Replaces a deleted or evicted pod | No                    | Yes, through its ReplicaSet                    |
| Runs several replicas             | No                    | Yes (`replicas`)                               |
| Rolling update of the image       | No                    | Yes, with `maxSurge` and `maxUnavailable`      |
| Rollback                          | No                    | Yes (`kubectl rollout undo`)                   |
| Good for                          | A quick test or debug | Every stateless service that must keep running |

The pod template inside a Deployment is a normal pod spec. This Deployment runs three replicas of a small web app:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: shop
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template: # the pod spec that the ReplicaSet copies
    metadata:
      labels:
        app: web # must match the selector
    spec:
      containers:
        - name: app
          image: ghcr.io/stefanprodan/podinfo:6.15.0
          ports:
            - containerPort: 9898
```

For a one-off pod, `kubectl run tmp --rm -it --image=busybox:1.37 --restart=Never -- sh` is quicker than a manifest. Old guides add `--generator=run-pod/v1` to that command. That flag was deprecated in kubectl 1.18 and later removed. `kubectl run` now always creates a pod, and `kubectl create deployment` creates a Deployment.

## Deployments vs StatefulSets: Which One Do You Need?

Use a **Deployment** when the replicas are interchangeable: a web server, an API, a queue worker. Use a **StatefulSet** when each replica needs a stable identity: its own name, its own DNS record and its own volume, which the replacement pod gets back. A zonal or local disk limits where that replacement can run. Databases, Kafka brokers and etcd are the usual examples.

| Behavior              | Deployment                                 | StatefulSet                                                             |
| --------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| Pod names             | Random suffix: `web-7d4b9c-x2kqz`          | Ordinal: `db-0`, `db-1`, `db-2`                                         |
| Replacement pod       | New name, may go to any node               | Same name, same PersistentVolumeClaim                                   |
| Storage               | One PVC shared by all pods, or none        | `volumeClaimTemplates`: one PVC for each pod (`data-db-0`, `data-db-1`) |
| DNS                   | One name for the Service                   | A name for each pod through a headless Service                          |
| Start and scale order | All at once                                | One at a time, in order (`OrderedReady`), unless `Parallel`             |
| Rolling update        | `maxSurge` and `maxUnavailable` (25% each) | Highest ordinal first, one pod at a time                                |

A StatefulSet needs a **headless Service** (`clusterIP: None`) that you create yourself. It gives each pod a DNS name such as `db-0.db.shop.svc.cluster.local`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: db
  namespace: shop
spec:
  clusterIP: None # headless: DNS returns the pod IPs, no virtual IP
  selector:
    app: db
  ports:
    - port: 5432
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: db
  namespace: shop
spec:
  serviceName: db # the headless Service above
  replicas: 1
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
        - name: postgres
          image: postgres:18
          env:
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-credentials # create it first, for example with kubectl create secret generic
                  key: password
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql # postgres:18 keeps its data in a versioned folder below this path
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ['ReadWriteOnce']
        resources:
          requests:
            storage: 10Gi
```

When you scale down or delete a StatefulSet, its PVCs stay, so the data is still there when you scale up again. `persistentVolumeClaimRetentionPolicy` (stable since Kubernetes 1.32) changes that with `whenDeleted` and `whenScaled`, each `Retain` (the default) or `Delete`.

A StatefulSet gives a database a stable name and disk. It does not give it replication, failover or backups. [Should you run Postgres on Kubernetes?](/posts/when-kubernetes-is-wrong-default#h2-should-you-run-postgres-on-kubernetes) covers what else you need, and [The Anatomy of Kubernetes Persistent Storage](/posts/anatomy-of-kubernetes-persistent-storage) explains what happens to the volume when a node fails.

## How Do I Update the Image of a Deployment?

Change the image in the pod template. The Deployment then creates a new ReplicaSet and moves pods to it with its update strategy. From the command line:

```bash
kubectl set image deployment/web -n shop app=ghcr.io/stefanprodan/podinfo:6.16.0
kubectl rollout status deployment/web -n shop
```

`app` is the container name, not the image name. `kubectl get deployment web -n shop -o jsonpath='{.spec.template.spec.containers[*].name}'` lists the names.

If you keep your manifests in Git, change the tag in the file and run `kubectl apply -f`, or let your GitOps tool do it. A `kubectl set image` on a cluster that Argo CD or Flux manages is reverted at the next sync.

To record why a revision exists, set the `kubernetes.io/change-cause` annotation. The old `--record` flag that did this is deprecated:

```bash
kubectl annotate deployment/web -n shop kubernetes.io/change-cause="podinfo 6.16.0"
kubectl rollout history deployment/web -n shop
```

```text
deployment.apps/web
REVISION  CHANGE-CAUSE
1         <none>
2         podinfo 6.16.0
```

If the new version fails, go back to the previous ReplicaSet, or to a specific revision:

```bash
kubectl rollout undo deployment/web -n shop
kubectl rollout undo deployment/web -n shop --to-revision=1
```

A rollout that never finishes, for example because the new image does not exist, does not roll back by itself. If it makes no progress for `progressDeadlineSeconds` (default 600), the Deployment marks it as failed, and `kubectl rollout status` exits with an error. [A Broken Rollout](/guides/introduction-to-kubernetes/04-deployments-and-replicasets#h2-a-broken-rollout) in the Kubernetes guide shows it step by step.

## How Do I Force Kubernetes to Re-Pull an Image?

Make sure that new pods resolve the tag again: set `imagePullPolicy: Always` and restart the workload.

```bash
kubectl patch deployment/web -n shop --type=json \
  -p '[{"op":"replace","path":"/spec/template/spec/containers/0/imagePullPolicy","value":"Always"}]'
kubectl rollout restart deployment/web -n shop
```

The patch changes the pod template, so it starts a rollout by itself. Later, `kubectl rollout restart` alone is enough. With `Always`, the kubelet asks the registry which digest the tag points to each time it starts a container. If the node already has that digest, it uses its cache and downloads nothing.

Deleting a pod is not a reliable way to get a new image. The replacement pod uses the same `imagePullPolicy` as the old one. If you leave the field out, Kubernetes sets a default when the object is created, for a Deployment in its pod template. A later change of the tag does not change that value:

| Image reference in the spec    | Default `imagePullPolicy` |
| ------------------------------ | ------------------------- |
| `app:latest` or `app` (no tag) | `Always`                  |
| `app:1.4.2`                    | `IfNotPresent`            |
| `app@sha256:...` (a digest)    | `IfNotPresent`            |

With `IfNotPresent`, a node that already has `app:1.4.2` starts the old cached image, even if you pushed a new image under the same tag. Different nodes can then run different code under the same tag.

The reliable fix is to never reuse a tag. Give each build a unique tag, such as the Git commit, or deploy by digest. Then a new image is a change to the pod template, and the Deployment rolls it out like any other change:

```bash
# <digest> is the sha256 value that your CI printed after the push
kubectl set image deployment/web -n shop app=ghcr.io/example/web@sha256:<digest>
```

## How Do I Debug ImagePullBackOff?

Read the events of the pod. The kubelet records the error that the registry or the network returned, and that text names the cause:

```bash
kubectl describe pod <pod> -n shop | sed -n '/^Events:/,$p'
kubectl get events -n shop --field-selector involvedObject.name=<pod>
```

`ErrImagePull` is a failed pull. `ImagePullBackOff` means that the kubelet now waits before the next attempt, and the wait gets longer each time, up to 5 minutes. You do not have to delete the pod: when you fix a cause outside the pod spec, such as a missing secret, the next attempt starts the container. When you fix the image name in the Deployment, the Deployment creates a new pod.

| Text in the event                                            | Cause                                                                       | Fix                                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `not found`                                                  | The repository or the tag does not exist                                    | Check the registry host, the path and the tag                                            |
| `pull access denied`, `unauthorized`, `authorization failed` | A private image and no credentials, or wrong ones                           | Add an image pull secret (below)                                                         |
| `toomanyrequests`                                            | The registry's rate limit; Docker Hub counts anonymous pulls per IP address | Pull with credentials, which have a higher limit, or copy the image to your own registry |
| `no match for platform in manifest`                          | The image has no build for the node's CPU, for example amd64 only on arm64  | Build a multi-platform image                                                             |
| `x509: certificate signed by unknown authority`              | A private registry with a certificate that the node does not trust          | Add the CA to the nodes and the container runtime                                        |
| `i/o timeout`, `no such host`                                | The node cannot resolve or reach the registry                               | Check DNS, the proxy settings and the egress firewall of the node                        |

A name without a registry is a Docker Hub name: `nginx:1.29` becomes `docker.io/library/nginx:1.29`, and `myteam/web:1.4.2` becomes `docker.io/myteam/web:1.4.2`. A typo in the host of a private registry therefore often shows up as a Docker Hub error.

For a private registry, create a secret in the **same namespace** as the pod, then reference it in the pod template. Use a read-only token, not your password:

```bash
kubectl create secret docker-registry regcred -n shop \
  --docker-server=ghcr.io \
  --docker-username=<user> \
  --docker-password=<read-only-token>
```

```yaml
spec:
  imagePullSecrets:
    - name: regcred
  containers:
    - name: app
      image: ghcr.io/example/web:1.4.2
```

To give a workload the secret without changing its pod spec, add it to the ServiceAccount that its pods use, which is `default` unless the spec names another one. Kubernetes copies it into new pods that have no `imagePullSecrets` of their own, so restart the workload afterwards:

```bash
kubectl patch serviceaccount default -n shop -p '{"imagePullSecrets":[{"name":"regcred"}]}'
kubectl rollout restart deployment/web -n shop
```

If the events do not make the cause clear, pull the image on the node itself. On a node where you can log in, `sudo crictl pull <image>` shows the error without Kubernetes in between. It does not use the pod's pull secret, so pass the same credentials for a private image (`--creds <user>:<token>`). If a DNS, proxy or certificate error appears there too, the problem is the node, not the pod spec. One related status is `ErrImageNeverPull`: the pod has `imagePullPolicy: Never` and the image is not on the node, which happens with local images on minikube or kind ([use local images with minikube](/posts/how-to-restart-container-within-pod#h2-how-do-i-use-local-docker-images-with-minikube)).

## How Do I Clean Up Old ReplicaSets?

You usually do not need to. Each rollout leaves the old ReplicaSet in place, scaled to 0 replicas. It holds no pods and uses no resources apart from a small object in etcd. It is what `kubectl rollout undo` goes back to.

To keep fewer of them, set `revisionHistoryLimit` on the Deployment. The default is 10. The Deployment controller then deletes the oldest unused ReplicaSets:

```yaml
spec:
  revisionHistoryLimit: 3 # keep the last 3 old ReplicaSets for rollbacks
```

```bash
kubectl get rs -n shop -l app=web   # DESIRED 0: an old revision, or the current one if the Deployment is scaled to 0
```

Do not set `revisionHistoryLimit: 0`. Then no old ReplicaSet stays, and `kubectl rollout undo` has nothing to roll back to. You can also delete one old ReplicaSet with `kubectl delete rs <name> -n shop`, which removes that revision from the history. Do not delete ReplicaSets by a filter on 0 replicas: the current ReplicaSet of a Deployment that you scaled to zero also has 0 replicas.

## Related Resources

- [Introduction to Kubernetes: Deployments and ReplicaSets](/guides/introduction-to-kubernetes/04-deployments-and-replicasets): self-healing, rollouts and rollbacks with real output
- [How to restart, list and keep containers running in a pod](/posts/how-to-restart-container-within-pod)
- [How to fix pods stuck in Terminating](/posts/fix-pods-stuck-terminating-kubernetes)
- [A troubleshooting playbook for pods](/guides/introduction-to-kubernetes/09-monitoring-and-logging-in-kubernetes#h2-a-troubleshooting-playbook) in the Kubernetes guide
- [How to fix "denied" on docker push](/posts/cannot-connect-to-docker-daemon#h2-how-do-i-fix-denied-requested-access-to-the-resource-is-denied-on-docker-push): registry logins and tokens on the push side
- [Kubernetes terminal simulator](/games/kubernetes-terminal-simulator): practice `scale`, `set image` and `rollout undo` in the browser
- [Fix the Deployment](/challenges/fix-the-deployment): a broken Deployment, Service and ConfigMap to repair
- [Kubernetes pod lifecycle interview questions](/interview-questions/topic/kubernetes#kubernetes-pod-lifecycle)
- [Kubernetes quiz](/quizzes/kubernetes-quiz) and [Kubernetes basics flashcards](/flashcards/kubernetes-basics)
