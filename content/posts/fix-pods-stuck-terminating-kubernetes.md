---
title: 'How to Fix Pods Stuck in Terminating and Delete All Resources'
excerpt: 'Why a pod or namespace stays in Terminating, when a force delete is safe, how to handle finalizers, down nodes and volumes, and how to list or delete all resources and pods.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-12-19'
publishedAt: '2024-12-19T10:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Troubleshooting
  - kubectl
  - Finalizers
  - Namespaces
---

A pod in `Terminating` has a deletion request, but it is not gone yet. Two things can hold it: the kubelet has not confirmed that the containers stopped, or a finalizer is still on the object. A force delete hides both problems instead of fixing them, and it can leave a container running on a node that the API no longer knows about. This post shows how to find out which of the two you have, how to fix each cause, and how to clean up a whole namespace or cluster without missing objects.

## TLDR

| Situation                                      | What to do                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Pod in `Terminating` for a few seconds         | Nothing. It waits up to `terminationGracePeriodSeconds` (default 30) for the app to exit      |
| Pod in `Terminating` for minutes               | `kubectl describe pod`: check the node, the finalizers and the events                         |
| Its node is `NotReady` or gone                 | Bring the node back, or delete the Node object. Force delete only when the node is really off |
| A finalizer is left and its controller is gone | Fix the controller, or remove the finalizer with `kubectl patch` if no cleanup is needed      |
| A PVC in `Terminating`                         | A pod still uses it (`kubernetes.io/pvc-protection`). Delete the pod first                    |
| A namespace in `Terminating`                   | Its conditions show which object types and finalizers block it                                |
| List everything in a namespace                 | Loop over `kubectl api-resources --namespaced`. `get all` shows only some workload types      |
| Delete everything in a namespace               | `kubectl delete namespace <name>`. `delete all --all` misses most object types                |
| Restart all pods                               | `kubectl rollout restart` per namespace. Do not delete the pods in `kube-system`              |

## Prerequisites

- `kubectl` with permission to read and delete pods, and to patch them for the finalizer steps.
- `jq` for some of the commands that filter JSON.
- SSH access to the nodes only if you have to check the kubelet.

## Why Is My Pod Stuck in Terminating?

When you delete a pod, the API server sets `metadata.deletionTimestamp`. `kubectl get pods` then shows the pod as `Terminating`. That is not a pod phase: while the containers stop, the phase stays `Running` or `Pending`. The kubelet on the pod's node sees the deletion, sends `SIGTERM` to the containers, waits up to the grace period, and sends `SIGKILL`. When the containers have stopped, the kubelet sets the phase to `Succeeded` or `Failed` and confirms the deletion to the API server. The object goes away when that confirmation has arrived and no finalizers are left.

So a pod stays in `Terminating` when one of these steps does not finish:

| Cause                                                  | How you see it                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| The app ignores `SIGTERM` and the grace period is long | It goes away after `terminationGracePeriodSeconds`. Normal, but slow           |
| The node is `NotReady`, shut down or unreachable       | `kubectl get node <node>` is not `Ready`. Nobody confirms the deletion         |
| A finalizer is left on the pod                         | `.metadata.finalizers` is not empty                                            |
| A volume does not unmount or detach                    | Events about unmounting or detaching the volume in `kubectl describe pod`      |
| The container runtime or kubelet hangs                 | The node is `Ready`, but the kubelet log on the node shows errors for that pod |

### Find the Stuck Pods

`grep` works because the STATUS column shows `Terminating`:

```bash
kubectl get pods -A | grep Terminating
```

A field selector does not work: `--field-selector=status.phase=Terminating` matches nothing, because `Terminating` is not a phase. To see how long each pod has waited, on which node, and with which finalizers, filter on `deletionTimestamp`:

```bash
kubectl get pods -A -o json | jq -r '
  .items[]
  | select(.metadata.deletionTimestamp != null)
  | [.metadata.namespace, .metadata.name, .spec.nodeName,
     .metadata.deletionTimestamp, (.metadata.finalizers // [] | join(","))]
  | @tsv'
```

Then look at one pod and at its node:

```bash
kubectl describe pod <pod> -n <namespace>   # Events at the bottom, and the node name
kubectl get node <node>                     # Ready, NotReady or not found
```

## How Do I Force Delete a Pod Stuck in Terminating?

```bash
kubectl delete pod <pod> -n <namespace> --grace-period=0 --force
```

```text
Warning: Immediate deletion does not wait for confirmation that the running resource has been terminated. The resource may continue to run on the cluster indefinitely.
pod "<pod>" force deleted
```

The warning is exact. A force delete removes the object from the API server without waiting for the kubelet to confirm that the containers stopped. A healthy kubelet still stops them, but if the kubelet is slow or cut off from the network, the containers can keep running, keep their volume mounted and keep writing to it, while the controller starts a replacement pod somewhere else.

Use a force delete only when you know that the containers are not running, for example when the node is powered off or deleted. Be careful with StatefulSet pods: the StatefulSet creates a new `db-0` at once, and two pods with the same identity can then write to the same data. The Kubernetes docs about [force deleting StatefulSet pods](https://kubernetes.io/docs/tasks/run-application/force-delete-stateful-set-pod/) explain the risk.

A force delete does not remove finalizers. A pod with a finalizer stays in `Terminating` after `--force`.

## How Do I Remove a Finalizer From a Pod?

A finalizer is a key in `metadata.finalizers` that tells the API server: do not remove this object until a controller has finished its cleanup and removed the key. Pods rarely have one. Two common cases:

- `batch.kubernetes.io/job-tracking` on Job pods. The Job controller removes it when it has counted the pod. If it stays, check the kube-controller-manager.
- A finalizer from an operator or admission webhook, such as a service mesh or a backup tool. If that operator is broken or uninstalled, nothing removes the key.

Fix or reinstall the controller first, so that its cleanup runs. If you know that the cleanup is not needed, remove the finalizers yourself:

```bash
kubectl get pod <pod> -n <namespace> -o jsonpath='{.metadata.finalizers}{"\n"}'
kubectl patch pod <pod> -n <namespace> --type=merge -p '{"metadata":{"finalizers":null}}'
```

To remove only one finalizer from a list, use a JSON patch with its index: `--type=json -p '[{"op":"remove","path":"/metadata/finalizers/0"}]'`.

## What If the Node Is Down?

If the node's `Ready` condition is `Unknown`, the kubelet has stopped reporting to the API server (`kubectl get nodes` shows it as `NotReady`). It cannot confirm anything, so every pod on it that you delete stays in `Terminating`. After about five minutes, Kubernetes also marks the pods on an unreachable node for eviction, and you see them as `Terminating` without having deleted them. Pods of a Deployment get replacements on other nodes. A StatefulSet waits, because it must not run two pods with the same identity.

Pick the step that matches the node:

1. **The node can come back.** Restart the kubelet or the machine. The kubelet then finishes the deletions by itself. On the node: `sudo systemctl status kubelet` and `sudo journalctl -u kubelet --since "15 min ago"`.
2. **The node is gone for good.** Delete the Node object: `kubectl delete node <node>`. The garbage collector then removes the pods that were bound to it, and the controllers create replacements.
3. **The node is shut down but its volumes stay attached.** Add the `out-of-service` taint, which Kubernetes uses for a non-graceful node shutdown (stable since 1.28). Pods are deleted and their volumes are detached, so a StatefulSet pod can start on another node:

```bash
kubectl taint nodes <node> node.kubernetes.io/out-of-service=nodeshutdown:NoExecute
```

Add the taint only when the node is really powered off. Remove it with the same command and a `-` at the end when the node is back.

## Volumes That Do Not Unmount, and PVCs Stuck in Terminating

A pod can wait in `Terminating` while the kubelet unmounts its volumes. `kubectl describe pod` then shows events about the unmount. A disk that does not detach from the old node usually blocks the replacement pod instead, which waits in `ContainerCreating` with an attach error. `kubectl get volumeattachment` shows which node a disk is still attached to. The fix is usually in the CSI driver or the cloud volume, not in the pod.

A PersistentVolumeClaim in `Terminating` is usually not broken. The `kubernetes.io/pvc-protection` finalizer keeps a PVC while any pod uses it, so that you cannot delete a disk under a running database. Find the pods that use it, and delete them or their controller:

```bash
kubectl get pods -n <namespace> -o json | jq -r --arg pvc <pvc-name> '
  .items[] | select(any(.spec.volumes[]?; .persistentVolumeClaim.claimName == $pvc))
  | .metadata.name'
```

When no pod uses the claim, it goes away by itself. Do not remove `pvc-protection` from a PVC that a pod still uses, and know that `kubectl delete pvc --force` does not skip finalizers either. Whether the disk is deleted with the PVC depends on the reclaim policy of the PersistentVolume, as [The Anatomy of Kubernetes Persistent Storage](/posts/anatomy-of-kubernetes-persistent-storage) explains.

## A Namespace Stuck in Terminating

A namespace stays in `Terminating` until every object in it is gone. If one object has a finalizer that nothing removes, the namespace waits forever. The namespace's own conditions name the object types and finalizers that block it. We reproduced it on Kubernetes 1.37 with a ConfigMap that carries a made-up finalizer, `example.com/cleanup`:

```terminal
{
  "title": "why is the namespace stuck?",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "kubectl get namespace demo",
      "output": "NAME   STATUS        AGE\ndemo   Terminating   10s"
    },
    {
      "cmd": "kubectl get namespace demo -o jsonpath='{range .status.conditions[*]}{.type}={.status}: {.message}{\"\\n\"}{end}'",
      "output": "NamespaceDeletionDiscoveryFailure=False: All resources successfully discovered\nNamespaceDeletionGroupVersionParsingFailure=False: All legacy kube types successfully parsed\nNamespaceDeletionContentFailure=False: All content successfully deleted, may be waiting on finalization\nNamespaceContentRemaining=True: Some resources are remaining: configmaps. has 1 resource instances\nNamespaceFinalizersRemaining=True: Some content in the namespace has finalizers remaining: example.com/cleanup in 1 resource instances"
    },
    {
      "comment": "list everything that is left, across all namespaced types",
      "cmd": "kubectl api-resources --verbs=list --namespaced -o name | xargs -n 1 kubectl get --show-kind --ignore-not-found -n demo",
      "output": "NAME                   DATA   AGE\nconfigmap/app-config   1      11s\nWarning: v1 Endpoints is deprecated in v1.33+; use discovery.k8s.io/v1 EndpointSlice"
    }
  ]
}
```

Fix the cause, then the namespace finishes on its own:

1. **A finalizer that nothing removes.** A finalizer belongs to a controller, which removes it after its cleanup. If the controller (an operator, a CSI driver) is gone or broken, fix or reinstall it first, so the cleanup really happens. If you know the cleanup is not needed, remove the finalizer yourself: `kubectl -n demo patch configmap app-config --type=json -p '[{"op":"remove","path":"/metadata/finalizers"}]'`. In our test the namespace was gone right after that.
2. **An API that does not answer.** If `NamespaceDeletionDiscoveryFailure` is `True`, the namespace controller cannot list every type, often because an aggregated API such as metrics-server is down. `kubectl get apiservices` shows those with `False` in the `AVAILABLE` column; fix the service behind it or delete the unused `APIService`.

`kubectl delete namespace demo --force --grace-period=0` does not help. It prints `namespace "demo" force deleted`, the namespace stays `Terminating`, and without `--wait=false` the command waits for up to a week, kubectl's default; in our first test run it hung until the CI job timed out.

The last resort is to clear the namespace's own finalizer through the `finalize` subresource:

```bash
kubectl get namespace demo -o json | jq '.spec.finalizers = []' \
  | kubectl replace --raw /api/v1/namespaces/demo/finalize -f -
```

The namespace disappears, but the objects that blocked it do not. They stay in etcd. When we created a namespace with the same name again, the old ConfigMap was back in it, finalizer included. Use this only when you have removed the leftovers some other way. Otherwise they stay in etcd, and the cleanup that their finalizers stood for never happens.

## How Do I List All Resources in a Namespace?

Ask the API server for every namespaced type that supports `list`, and get each type in the namespace:

```bash
kubectl api-resources --verbs=list --namespaced -o name \
  | xargs -n 1 kubectl get --show-kind --ignore-not-found -n shop
```

`kubectl get all -n shop` looks like the answer, but `all` is a category with a fixed set of workload types: pods, Services, Deployments, ReplicaSets, StatefulSets, DaemonSets, Jobs, CronJobs, ReplicationControllers and HorizontalPodAutoscalers. ConfigMaps, Secrets, PVCs, Ingresses, NetworkPolicies, ServiceAccounts, Roles and most custom resources are not in it. `kubectl api-resources --categories=all` prints the types in the category.

Some details about the loop:

- It runs one request for each type, so it takes a few seconds. Add `-o name` to the `kubectl get` part for a short list of `kind/name` lines.
- It also lists objects that Kubernetes creates in every namespace: the `default` ServiceAccount, the `kube-root-ca.crt` ConfigMap, and events. Events expire after one hour by default.
- You need `list` permission for each type. Types that you cannot list print a `Forbidden` error, and the loop goes on with the next type. `kubectl auth can-i --list -n shop` shows what you may do.
- `kubectl api-resources --namespaced=false` shows the cluster-scoped types, such as Nodes, PersistentVolumes, ClusterRoles and CRDs, which do not belong to any namespace.

To list one type in all namespaces, add `-A`: `kubectl get pods -A`. To see what an app is made of, filter by its label: `kubectl get deployment,service,configmap,ingress -l app=web -n shop`.

## How Do I Delete All Resources in a Namespace or Cluster at One Time?

To remove everything in a namespace, delete the namespace:

```bash
kubectl delete namespace staging
```

The namespace controller deletes every namespaced object in it: workloads, Services, ConfigMaps, Secrets, PVCs, Roles, ServiceAccounts and custom resources. If it stays in `Terminating`, the section above shows why. You cannot delete the `default`, `kube-system` and `kube-public` namespaces.

The command that many guides give, `kubectl delete all --all`, does much less than its name says:

- `all` is a category, not all types. It covers pods, Services, Deployments, ReplicaSets, StatefulSets, DaemonSets, Jobs, CronJobs, ReplicationControllers and HorizontalPodAutoscalers. It does not cover ConfigMaps, Secrets, PVCs, Ingresses, NetworkPolicies, ServiceAccounts or Roles, and it covers custom resources only if their CRD adds them to the `all` category.
- Without `-n` it works on the namespace of your current context, not on the whole cluster.
- With `--all-namespaces` it also deletes CoreDNS, kube-proxy, the CNI and every other system workload in `kube-system`. Do not run that.

`kubectl api-resources --categories=all` lists the types in the category. To empty a namespace that you must keep, go through every namespaced type that supports delete. Look at the list before you delete it:

```bash
NS=staging
kubectl api-resources --namespaced --verbs=list,delete -o name \
  | grep -vE '^(events|events\.events\.k8s\.io)$' \
  | xargs -I{} kubectl get {} -n "$NS" --ignore-not-found -o name

# when the list is what you expect:
kubectl api-resources --namespaced --verbs=list,delete -o name \
  | grep -vE '^(events|events\.events\.k8s\.io)$' \
  | xargs -I{} kubectl delete {} --all -n "$NS" --ignore-not-found --wait=false
```

`--wait=false` sends every delete without waiting. Without it, the loop can stop at a PVC that waits for its pods, before it reaches the Deployments that own those pods. Run the first command again to see what is left.

The loop also deletes the `default` ServiceAccount and the `kube-root-ca.crt` ConfigMap, which Kubernetes creates again at once. In the `default` namespace it also deletes the `kubernetes` Service, which the API server also creates again.

Delete by label when you want to remove one app and keep the rest: `kubectl delete deployment,service,configmap,secret -l app=web -n shop`, or `kubectl delete -f k8s/` with the manifests that created it. For a local test cluster, deleting the whole cluster is faster than any cleanup: `kind delete cluster` or `minikube delete`.

### How Do I Delete All Pods in All Namespaces?

The command exists, but it is almost never what you want:

```bash
kubectl delete pods --all --all-namespaces   # -A is the short form of --all-namespaces
```

It deletes every pod in the cluster at the same time, including CoreDNS, the CNI plugin, kube-proxy and the ingress controller. Name resolution and networking can stop for every app until those pods are back. A `kubectl delete` also does not respect PodDisruptionBudgets: only evictions (a drain) do. Pods that a controller owns come back, static pods come back because the kubelet runs them from files on the node, and bare pods are gone for good.

The usual goal is to restart the apps. Use `kubectl rollout restart` for each namespace instead. It replaces the pods by the workload's own update strategy: a few at a time for a Deployment with the default `RollingUpdate` and enough replicas, but all at once with `Recreate`, not at all for a StatefulSet or DaemonSet with `OnDelete`, and with a short outage for anything that has a single replica:

```bash
kubectl rollout restart deployment -n shop    # every Deployment in the namespace
kubectl rollout restart statefulset -n shop   # the same for StatefulSets (and daemonset)
kubectl delete pods --all -n shop             # the blunt way: all pods of one namespace at once
```

To restart only pods in a bad state, select them by phase: `kubectl delete pods -A --field-selector=status.phase=Failed` removes pods that have stopped with an error, such as evicted pods.

## How Do I Make Pods Terminate Faster?

Most slow terminations come from an app that does not handle `SIGTERM`, so it waits the full grace period and then gets `SIGKILL`. Three settings fix most of them:

1. **Let the signal reach the app.** With the shell form of a command, such as `command: ["sh", "-c", "node server.js"]`, the shell is PID 1 and may not pass `SIGTERM` on. Use the exec form (`command: ["node", "server.js"]`), or start the app with `exec` in a script.
2. **Handle `SIGTERM` in the app.** Stop taking new work, finish the requests in progress, then exit:

```javascript
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing the server');
  server.close(() => process.exit(0)); // exits when open connections are done
});
```

3. **Set the grace period to what the app needs.** `terminationGracePeriodSeconds` (default 30) is the total time for the shutdown, including any `preStop` hook, before `SIGKILL`. A queue worker that finishes a 2-minute job needs more. A stateless web app needs less.

A `preStop` hook runs before `SIGTERM` and counts against the same grace period. Add a short one if the app gets new requests after it receives `SIGTERM`, because Services and load balancers remove the pod with a delay. [Rolling deploys drop requests unless you do two things](/posts/kubernetes-concepts-junior-to-mid-level#h2-4-rolling-deploys-drop-requests-unless-you-do-two-things) explains that delay.

To take a whole node out of service, drain it instead of deleting its pods by hand. The drain evicts the pods, respects PodDisruptionBudgets and waits for each pod's grace period:

```bash
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
kubectl uncordon <node>   # when the maintenance is done
```

## Related Resources

- [Why does a deleted pod come back?](/posts/why-does-kubernetes-pod-get-recreated-when-deleted): owners, controllers and how to stop them
- [Introduction to Kubernetes: Monitoring and Logging](/guides/introduction-to-kubernetes/09-monitoring-and-logging-in-kubernetes#h2-a-troubleshooting-playbook): a troubleshooting playbook for pod problems
- [Drain a node safely](/guides/introduction-to-kubernetes/08-resource-management-and-scaling#h3-drain-a-node-safely)
- [Kubernetes terminal simulator](/games/kubernetes-terminal-simulator): practice `delete`, `describe` and `drain` in the browser
- [Kubernetes kubelet interview questions](/interview-questions/topic/kubernetes#kubernetes-kubelet)
- [Kubernetes quiz](/quizzes/kubernetes-quiz)
