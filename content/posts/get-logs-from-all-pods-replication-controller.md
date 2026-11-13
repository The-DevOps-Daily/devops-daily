---
title: 'How to Get Logs From All Pods, Events and Files With kubectl'
excerpt: 'Read the logs of every pod of a Deployment or ReplicationController at once, follow them live, see the events of one pod, and copy files out of a pod with kubectl.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2025-03-01'
publishedAt: '2025-03-01T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - kubectl
  - Logging
  - Events
  - Troubleshooting
---

When something goes wrong in a Kubernetes app, you need three things from the cluster: the logs of every pod, not only one, the events that tell you what Kubernetes did to those pods, and sometimes a file that the app wrote inside its container. `kubectl` can get all three, but the defaults surprise many people. `kubectl logs deployment/web` reads one pod only, a label selector shows only 10 lines per pod, and a follow stops when the container restarts.

## TLDR

| Task                                 | Command                                                       |
| ------------------------------------ | ------------------------------------------------------------- |
| Logs of all pods of a Deployment     | `kubectl logs -l app=web --all-containers --prefix --tail=-1` |
| The same, by owner (current kubectl) | `kubectl logs deployment/web --all-pods`                      |
| Follow the logs of all pods          | `kubectl logs -f -l app=web --prefix --max-log-requests=20`   |
| Logs of a container that crashed     | `kubectl logs <pod> -c <container> --previous`                |
| Events of one pod, oldest first      | `kubectl events --for pod/<pod>`                              |
| Copy a file from a pod               | `kubectl cp shop/<pod>:/var/log/app.log ./app.log -c app`     |

## Prerequisites

- `kubectl` and read access to pods and their `pods/log` subresource in the namespace.
- The examples use a Deployment named `web` in the `shop` namespace, with the label `app=web`. Add `-n shop` to each command, or set it as your default namespace.

## How Do I Get Logs From All Pods of a Deployment or ReplicationController?

Select the pods by label. A label selector reads every matching pod:

```bash
kubectl logs -l app=web --all-containers --prefix --tail=-1
```

Each flag matters:

- `-l app=web` selects every pod with that label. Use the controller's selector, which you can read with `kubectl get deployment web -o jsonpath='{.spec.selector.matchLabels}'`. For a ReplicationController, read `.spec.selector`.
- `--prefix` adds `[pod/web-7d4b9c-x2kqz/app]` to each line, so you can see which pod wrote it.
- `--all-containers` includes sidecars and init containers. Without it, kubectl reads the default container of each pod.
- `--tail=-1` prints all lines. With a selector, the default is the last 10 lines of each pod.

Do not use `kubectl logs deployment/web` or `kubectl logs rc/web` for this. Both print the logs of one pod that kubectl picks. Current kubectl versions have `--all-pods` for the owner form, which reads every pod and turns on `--prefix`:

```bash
kubectl logs deployment/web --all-pods --all-containers
```

The output of several pods is not sorted by time. Add `--timestamps` and sort it if the order matters, or save one file for each pod:

```bash
for pod in $(kubectl get pods -l app=web -o name); do
  kubectl logs "$pod" --all-containers --timestamps > "${pod#pod/}.log"
done
```

A **ReplicationController** is the oldest way to run replicas. A Deployment, which manages ReplicaSets, does the same job and adds rolling updates and rollbacks. The log commands are the same for both. If you still have ReplicationControllers, plan to move them to Deployments.

## How Do I Stream kubectl Logs Continuously?

Add `-f` (`--follow`). kubectl keeps the connection open and prints new lines as the container writes them:

```bash
kubectl logs -f web-7d4b9c-x2kqz -c app --since=10m --timestamps
```

`--since=10m` starts with the last ten minutes instead of the whole log, and `--tail=50` starts with the last 50 lines. For all pods of the app, follow by label:

```bash
kubectl logs -f -l app=web --prefix --max-log-requests=20
```

kubectl follows at most 5 log streams at a time by default, one for each container, and stops with an error if the selector matches more. Raise `--max-log-requests` to the number of pods times the containers you follow.

A follow is not a permanent log stream:

- It ends when the container exits or restarts. Run the command again, and add `--previous` to read what the crashed container wrote last.
- A follow by label does not pick up pods that start later, for example during a rollout.
- kubectl reads the current log file on the node. The kubelet rotates the files (10 MiB and 5 files per container by default), and the logs go away with the pod.

For live logs across many pods that come and go, use a tool such as [stern](https://github.com/stern/stern), which follows new pods as they start. For history and search, ship the logs to a log store, as [Where Logs Live, and Shipping Them](/guides/introduction-to-kubernetes/09-monitoring-and-logging-in-kubernetes#h3-where-logs-live-and-shipping-them) shows.

## How Do I Get Events Only for a Pod?

Use `kubectl events` with `--for`:

```bash
kubectl events --for pod/web-7d4b9c-x2kqz
kubectl events --for pod/web-7d4b9c-x2kqz --watch   # and wait for new ones
kubectl events --types=Warning                       # only problems, in the namespace
```

`kubectl events` sorts the events by time, oldest first. The bottom of `kubectl describe pod web-7d4b9c-x2kqz` also shows the events of this pod.

With `kubectl get events`, filter with a field selector. Add the kind, because a Service or a ReplicaSet can have the same name as a pod:

```bash
kubectl get events \
  --field-selector involvedObject.kind=Pod,involvedObject.name=web-7d4b9c-x2kqz \
  --sort-by=.metadata.creationTimestamp
```

Sort by `.metadata.creationTimestamp`, not by `.lastTimestamp`. Events that components write through the newer `events.k8s.io` API, such as the scheduler's, can leave `lastTimestamp` empty, so they end up in the wrong place in the list.

Events are short-lived. The API server deletes them after one hour by default, so an event from yesterday's crash is gone. Look at them while the problem is fresh, or export them to your log store. [Fix the Deployment](/challenges/fix-the-deployment) is a good place to practice reading events: its pods fail for reasons that only the events show.

## How Do I Copy Files From a Kubernetes Pod to My Computer?

Use `kubectl cp` with `<namespace>/<pod>:<path>` as the source:

```bash
kubectl cp shop/web-7d4b9c-x2kqz:/var/log/app/app.log ./app.log -c app
kubectl cp shop/web-7d4b9c-x2kqz:/var/log/app ./app-logs -c app   # a directory
kubectl cp ./config.yaml shop/web-7d4b9c-x2kqz:/tmp/config.yaml -c app   # to the pod
```

Use `-c` for a pod with several containers. Without it, kubectl uses the container named in the `kubectl.kubernetes.io/default-container` annotation, or the first container.

`kubectl cp` runs `tar` inside the container, so it fails if the image has no `tar` binary. Many small images do not have it. The alternatives:

- **The image has a shell and `cat`.** Stream one file: `kubectl exec -n shop web-7d4b9c-x2kqz -c app -- cat /var/log/app/app.log > app.log`. Do not add `-t`, because a terminal can change the bytes.
- **The image has `tar` but you need symlinks or file modes.** Pipe `tar` yourself: `kubectl exec -n shop web-7d4b9c-x2kqz -- tar cf - -C /var/log app | tar xf -`.
- **A distroless image with no shell.** Start a debug container with `kubectl debug --target=<container>`, so it shares the app's process namespace. Find the app's process ID with `ps`, and read its files under `/proc/<pid>/root`. If the app runs as another user, the debug container needs the same user ID, or the `--profile=sysadmin` debug profile, to read them. [kubectl debug](/guides/introduction-to-kubernetes/09-monitoring-and-logging-in-kubernetes#h2-kubectl-debug) in the Kubernetes guide shows the debug container.

Files that you copy into a pod are lost when the pod is replaced. Use a ConfigMap, a Secret or a volume for anything the app needs after a restart. For a large copy from a pod over a slow connection, `--retries=5` tries again when the connection breaks.

## Related Resources

- [Introduction to Kubernetes: Monitoring and Logging](/guides/introduction-to-kubernetes/09-monitoring-and-logging-in-kubernetes): logs, events, `kubectl debug`, Prometheus and traces
- [The 5-Minute Kubernetes Cluster Health Check](/posts/5-minute-kubernetes-cluster-health-check)
- [How to restart, list and keep containers running in a pod](/posts/how-to-restart-container-within-pod)
- [Log aggregation pipeline simulator](/games/log-aggregation-pipeline-simulator): follow logs from agents to a store
- [Kubernetes terminal simulator](/games/kubernetes-terminal-simulator): practice `logs`, `describe` and `exec` in the browser
- [Kubernetes pod lifecycle interview questions](/interview-questions/topic/kubernetes#kubernetes-pod-lifecycle)
- [Kubernetes quiz](/quizzes/kubernetes-quiz)
