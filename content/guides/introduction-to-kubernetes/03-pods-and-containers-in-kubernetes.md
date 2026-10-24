---
title: 'Kubernetes Pods: Create, Inspect, Debug and Add Sidecars'
description: 'Run a Kubernetes pod, inspect it with describe, events and logs, reach it with port-forward and exec, and add probes, an init container and a sidecar.'
order: 3
---

**TLDR**: A **pod** is one or more containers that share an IP address, a hostname and volumes, and always run together on the same node. You create one from a YAML file with `kubectl apply -f`, check it with `kubectl get`, `describe`, `events` and `logs`, and reach it with `kubectl port-forward` or `kubectl exec`. In real apps you rarely create pods yourself; a Deployment creates them for you ([Part 4](/guides/introduction-to-kubernetes/04-deployments-and-replicasets)).

In this part you run podinfo as a single pod, learn the commands you will use every day to inspect and debug pods, add health probes, and build a pod with an init container and a native sidecar.

## Prerequisites

- The kind cluster from [Part 2](/guides/introduction-to-kubernetes/02-setting-up-a-kubernetes-cluster), with `demo` as the current namespace.
- A terminal in the root of the [companion repository](https://github.com/The-DevOps-Daily/guide-kubernetes-demo-2026-10-24).

## What a Pod Is

The containers in a pod share one network namespace, so they have the same IP address and reach each other on `localhost`. They can also mount the same volumes. A pod is the smallest thing Kubernetes schedules: all its containers start on the same node, and the pod lives and dies as a unit.

```diagram
{
  "type": "infra",
  "groups": [
    {
      "label": "Pod podinfo-sidecar",
      "sub": "one IP: 10.244.x.y",
      "icon": "pod",
      "tone": "blue",
      "nodes": [
        { "label": "write-config", "sub": "init container, runs first", "icon": "gear", "tone": "slate" },
        { "label": "health-reporter", "sub": "native sidecar", "icon": "activity", "tone": "violet" },
        { "label": "podinfo", "sub": "the app, port 9898", "icon": "box", "tone": "green" },
        { "label": "config volume", "sub": "emptyDir, shared", "icon": "database", "tone": "amber" }
      ]
    }
  ]
}
```

Pods are disposable. When a pod is deleted, or its node fails, the pod is gone with its IP address and everything written inside its containers. Something else (a Deployment, a Job) creates a new pod with a new name and a new IP. Data that must survive goes into a volume ([Part 7](/guides/introduction-to-kubernetes/07-persistent-storage-in-kubernetes)), and clients reach pods through a Service ([Part 5](/guides/introduction-to-kubernetes/05-services-and-networking)).

## Your First Pod

The pod runs podinfo 6.15.0 and names its port `http`, so other settings can refer to the name instead of the number:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: podinfo
  labels:
    app: podinfo
spec:
  containers:
    - name: podinfo
      image: ghcr.io/stefanprodan/podinfo:6.15.0
      ports:
        - name: http
          containerPort: 9898
      # Send traffic only when the app says it is ready
      readinessProbe:
        httpGet:
          path: /readyz
          port: http
        periodSeconds: 5
      # Restart the container if the app stops answering
      livenessProbe:
        httpGet:
          path: /healthz
          port: http
        periodSeconds: 10
        failureThreshold: 3
```

The two probes tell the kubelet how to check the app. The **readiness probe** decides whether the pod gets traffic from Services: while `/readyz` fails, the pod is running but not `Ready`. The **liveness probe** decides whether the container needs a restart: after three failed checks of `/healthz` in a row, the kubelet kills and restarts it. A third kind, the **startup probe**, holds both off until a slow app has started.

Apply it and watch it start:

```terminal
{
  "title": "run a pod",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 03-pods/pod.yaml",
      "output": "pod/podinfo created"
    },
    {
      "cmd": "kubectl get pods",
      "output": "NAME      READY   STATUS              RESTARTS   AGE\npodinfo   0/1     ContainerCreating   0          0s"
    },
    {
      "cmd": "kubectl wait --for=condition=Ready pod/podinfo --timeout=120s",
      "output": "pod/podinfo condition met"
    },
    {
      "cmd": "kubectl get pods -o wide",
      "output": "NAME      READY   STATUS    RESTARTS   AGE   IP           NODE                NOMINATED NODE   READINESS GATES\npodinfo   1/1     Running   0          3s    10.244.2.2   k8s-guide-worker2   <none>           <none>"
    }
  ]
}
```

Right after `apply`, the pod is not ready yet: `STATUS` shows `Pending` while the scheduler picks a node, then `ContainerCreating` while the kubelet pulls the image and starts the container. `kubectl wait` blocks until a condition is true, which beats running `kubectl get` again and again in scripts. `-o wide` adds the pod's IP and node.

`kubectl apply` creates the pod or updates it to match the file. `kubectl create` only creates, and fails if the object exists:

```bash
kubectl create -f 03-pods/pod.yaml
```

```text
Error from server (AlreadyExists): error when creating "03-pods/pod.yaml": pods "podinfo" already exists
```

## Inspect a Pod

`kubectl describe` is the first command to run when something is wrong. It shows the pod's node, IP, containers with their image digest, state and restart count, probes, mounts and conditions, followed by its recent events:

```bash
kubectl describe pod podinfo
```

```text
Name:             podinfo
Namespace:        demo
Priority:         0
Service Account:  default
Node:             k8s-guide-worker2/172.18.0.4
Start Time:       Sat, 24 Oct 2026 10:15:43 +0000
Labels:           app=podinfo
Annotations:      <none>
Status:           Running
IP:               10.244.2.2
IPs:
  IP:  10.244.2.2
Containers:
  podinfo:
    Container ID:   containerd://9b5f72cbcf689f06d5f6a1405b0883f93b066edea91c205949c71aa598791694
    Image:          ghcr.io/stefanprodan/podinfo:6.15.0
    Image ID:       ghcr.io/stefanprodan/podinfo@sha256:ec73780a8425f59ea49f5bc8cdff0d598805a224fbaa1f86c67a244f250fa9da
    Port:           9898/TCP (http)
    Host Port:      0/TCP (http)
    State:          Running
      Started:      Sat, 24 Oct 2026 10:15:45 +0000
    Ready:          True
    Restart Count:  0
    Liveness:       http-get http://:http/healthz delay=0s timeout=1s period=10s successThreshold=1 failureThreshold=3
    Readiness:      http-get http://:http/readyz delay=0s timeout=1s period=5s successThreshold=1 failureThreshold=3
    Environment:    <none>
    Mounts:
      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-8hzv6 (ro)
Conditions:
  Type                        Status
  PodReadyToStartContainers   True
  Initialized                 True
  Ready                       True
  ContainersReady             True
  PodScheduled                True
Volumes:
  kube-api-access-8hzv6:
    Type:                    Projected (a volume that contains injected data from multiple sources)
    TokenExpirationSeconds:  3607
    ConfigMapName:           kube-root-ca.crt
    Optional:                false
    DownwardAPI:             true
QoS Class:                   BestEffort
Node-Selectors:              <none>
Tolerations:                 node.kubernetes.io/not-ready:NoExecute op=Exists for 300s
                             node.kubernetes.io/unreachable:NoExecute op=Exists for 300s
Events:
  Type     Reason     Age   From               Message
  ----     ------     ----  ----               -------
  Normal   Scheduled  4s    default-scheduler  Successfully assigned demo/podinfo to k8s-guide-worker2
  Normal   Pulling    3s    kubelet            spec.containers{podinfo}: Pulling image "ghcr.io/stefanprodan/podinfo:6.15.0"
  Normal   Pulled     2s    kubelet            spec.containers{podinfo}: Successfully pulled image "ghcr.io/stefanprodan/podinfo:6.15.0" in 1.683s (1.683s including waiting). Image size: 34763248 bytes.
  Normal   Created    2s    kubelet            spec.containers{podinfo}: Container created
  Normal   Started    2s    kubelet            spec.containers{podinfo}: Container started
  Warning  Unhealthy  2s    kubelet            spec.containers{podinfo}: Readiness probe failed: Get "http://10.244.2.2:9898/readyz": dial tcp 10.244.2.2:9898: connect: connection refused
```

Two details are worth knowing. `Image ID` is the digest of the image the node actually pulled, which tells you exactly what runs even when a tag moves. The `kube-api-access` volume is a short-lived token for the pod's ServiceAccount that Kubernetes mounts into every pod unless you turn it off ([Part 10](/guides/introduction-to-kubernetes/10-best-practices-in-kubernetes)).

The pod's conditions show each step it passed. For a script, ask for exactly the fields you need with `-o jsonpath`:

```bash
kubectl get pod podinfo -o jsonpath='{range .status.conditions[*]}{.type}={.status}{"\n"}{end}'
```

```text
PodReadyToStartContainers=True
Initialized=True
Ready=True
ContainersReady=True
PodScheduled=True
```

`kubectl events --for` lists the events of one object, oldest first. Here you see the scheduler, the image pull, the container start, and one failed readiness check from the moment before podinfo started listening:

```bash
kubectl events --for pod/podinfo
```

```text
LAST SEEN   TYPE      REASON      OBJECT        MESSAGE
4s          Normal    Scheduled   Pod/podinfo   Successfully assigned demo/podinfo to k8s-guide-worker2
3s          Normal    Pulling     Pod/podinfo   Pulling image "ghcr.io/stefanprodan/podinfo:6.15.0"
2s          Normal    Pulled      Pod/podinfo   Successfully pulled image "ghcr.io/stefanprodan/podinfo:6.15.0" in 1.683s (1.683s including waiting). Image size: 34763248 bytes.
2s          Normal    Created     Pod/podinfo   Container created
2s          Normal    Started     Pod/podinfo   Container started
2s          Warning   Unhealthy   Pod/podinfo   Readiness probe failed: Get "http://10.244.2.2:9898/readyz": dial tcp 10.244.2.2:9898: connect: connection refused
```

A failed readiness probe during startup is normal; the pod becomes `Ready` with the next check. A readiness probe that keeps failing means the app never gets traffic, and a liveness probe that keeps failing means it restarts in a loop ([Part 9](/guides/introduction-to-kubernetes/09-monitoring-and-logging-in-kubernetes)). See also [how to get events for a single pod](/posts/kubectl-get-events-only-for-pod).

Containers should log to standard output. The kubelet stores those logs on the node, and `kubectl logs` reads them. podinfo logs JSON:

```bash
kubectl logs podinfo
```

```text
{"level":"info","ts":"2026-10-24T10:15:45.931Z","caller":"podinfo/main.go:170","msg":"Starting podinfo","version":"6.15.0","revision":"dd507173b7b75b2312a36cabe0de5f09c1ce69c8","port":"9898"}
{"level":"info","ts":"2026-10-24T10:15:45.931Z","caller":"http/server.go:273","msg":"Starting HTTP Server.","addr":":9898"}
```

Add `-f` to follow the log, `--tail=20` for the last lines and `--previous` for the container that ran before the last restart.

## Reach a Pod

`kubectl port-forward` tunnels a local port to a port of the pod through the API server. It runs until you stop it, so start it in the background and keep its process ID in `PF`. It needs a moment to start, so let curl retry until the port accepts connections:

```terminal
{
  "title": "port-forward",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl port-forward pod/podinfo 9898:9898 > /dev/null 2>&1 & PF=$!"
    },
    {
      "cmd": "curl -s --retry 5 --retry-connrefused --retry-delay 1 localhost:9898",
      "output": "{\n  \"hostname\": \"podinfo\",\n  \"version\": \"6.15.0\",\n  \"revision\": \"dd507173b7b75b2312a36cabe0de5f09c1ce69c8\",\n  \"color\": \"#34577c\",\n  \"logo\": \"https://raw.githubusercontent.com/stefanprodan/podinfo/gh-pages/cuddle_clap.gif\",\n  \"message\": \"greetings from podinfo v6.15.0\",\n  \"goos\": \"linux\",\n  \"goarch\": \"amd64\",\n  \"runtime\": \"go1.27.0\",\n  \"num_goroutine\": \"6\",\n  \"num_cpu\": \"4\"\n}"
    },
    {
      "cmd": "kill $PF"
    }
  ]
}
```

`kubectl exec` runs a command inside a running container. The podinfo image runs as a user called `app` with the ID 100 (you will need that number in Part 10), and the app is process 1:

```terminal
{
  "title": "exec",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl exec podinfo -- id",
      "output": "uid=100(app) gid=101(app) groups=101(app)"
    },
    {
      "cmd": "kubectl exec podinfo -- ps",
      "output": "PID   USER     TIME  COMMAND\n    1 app       0:00 ./podinfo\n   27 app       0:00 ps"
    }
  ]
}
```

For an interactive shell, use `kubectl exec -it podinfo -- sh`. Many production images have no shell at all; [Part 9](/guides/introduction-to-kubernetes/09-monitoring-and-logging-in-kubernetes) shows `kubectl debug` for those.

Every pod can reach every other pod's IP address directly, across nodes. Start a small client pod with curl and call podinfo by its pod IP:

```terminal
{
  "title": "pod to pod",
  "prompt": "$",
  "steps": [
    {
      "cmd": "POD_IP=$(kubectl get pod podinfo -o jsonpath='{.status.podIP}')"
    },
    {
      "cmd": "echo $POD_IP",
      "output": "10.244.2.2"
    },
    {
      "cmd": "kubectl run client --image=curlimages/curl:8.23.0 --command -- sleep infinity",
      "output": "pod/client created"
    },
    {
      "cmd": "kubectl wait --for=condition=Ready pod/client",
      "output": "pod/client condition met"
    },
    {
      "cmd": "kubectl exec client -- curl -s http://$POD_IP:9898/version",
      "output": "{\n  \"commit\": \"dd507173b7b75b2312a36cabe0de5f09c1ce69c8\",\n  \"version\": \"6.15.0\"\n}"
    }
  ]
}
```

`kubectl run` is a quick way to start a single pod without a YAML file. Pod IPs change every time a pod is replaced, which is why real clients use a Service name instead.

## Init Containers and Native Sidecars

A pod can have two more kinds of containers besides the app:

- **Init containers** run one after another before the app starts, and each must exit successfully first. Use them for setup: wait for a dependency, run a migration, render a config file.
- **Sidecar containers** run next to the app for the pod's whole life: log shippers, proxies, certificate agents. Since Kubernetes 1.33 they are a stable feature: you declare them as init containers with `restartPolicy: Always`. Kubernetes then starts them before the app, keeps them running, restarts them when they crash, and stops them after the app, so they never block a Job from finishing ([Part 4](/guides/introduction-to-kubernetes/04-deployments-and-replicasets) shows that).

This pod has both. The init container writes a config file into a shared `emptyDir` volume, and podinfo reads it at startup. The sidecar stands in for a real agent: it calls podinfo's health endpoint over `localhost` every 10 seconds, which works because the containers share a network namespace.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: podinfo-sidecar
  labels:
    app: podinfo-sidecar
spec:
  volumes:
    - name: config
      emptyDir: {}
  initContainers:
    # 1. An init container: runs to completion before the next container starts
    - name: write-config
      image: busybox:1.38.0
      command:
        - sh
        - -c
        - 'echo "ui-message: configured by an init container" > /config/config.yaml'
      volumeMounts:
        - name: config
          mountPath: /config
    # 2. A native sidecar: restartPolicy Always keeps it running next to the app
    - name: health-reporter
      image: busybox:1.38.0
      restartPolicy: Always
      command:
        - sh
        - -c
        - while true; do wget -qO- http://localhost:9898/healthz; echo; sleep 10; done
  containers:
    - name: podinfo
      image: ghcr.io/stefanprodan/podinfo:6.15.0
      command: ['./podinfo']
      args: ['--config-path=/config']
      ports:
        - name: http
          containerPort: 9898
      volumeMounts:
        - name: config
          mountPath: /config
```

```terminal
{
  "title": "init container and sidecar",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 03-pods/pod-sidecar.yaml",
      "output": "pod/podinfo-sidecar created"
    },
    {
      "cmd": "kubectl get pod podinfo-sidecar",
      "output": "NAME              READY   STATUS     RESTARTS   AGE\npodinfo-sidecar   0/2     Init:0/2   0          0s"
    },
    {
      "cmd": "kubectl wait --for=condition=Ready pod/podinfo-sidecar --timeout=120s",
      "output": "pod/podinfo-sidecar condition met"
    },
    {
      "cmd": "kubectl get pod podinfo-sidecar",
      "output": "NAME              READY   STATUS    RESTARTS   AGE\npodinfo-sidecar   2/2     Running   0          4s"
    },
    {
      "cmd": "sleep 10"
    },
    {
      "cmd": "kubectl logs podinfo-sidecar -c health-reporter",
      "output": "wget: can't connect to remote host (127.0.0.1): Connection refused\n\n{\n  \"status\": \"OK\"\n}"
    },
    {
      "cmd": "kubectl exec podinfo-sidecar -c podinfo -- curl -s localhost:9898",
      "output": "{\n  \"hostname\": \"podinfo-sidecar\",\n  \"version\": \"6.15.0\",\n  \"revision\": \"dd507173b7b75b2312a36cabe0de5f09c1ce69c8\",\n  \"color\": \"#34577c\",\n  \"logo\": \"https://raw.githubusercontent.com/stefanprodan/podinfo/gh-pages/cuddle_clap.gif\",\n  \"message\": \"configured by an init container\",\n  \"goos\": \"linux\",\n  \"goarch\": \"amd64\",\n  \"runtime\": \"go1.27.0\",\n  \"num_goroutine\": \"8\",\n  \"num_cpu\": \"4\"\n}"
    }
  ]
}
```

`Init:0/2` means neither init container has finished yet. Once the pod runs, `READY 2/2` counts the app and the sidecar. The `sleep` gives the sidecar time for its second check. The sidecar's first call failed because it started before podinfo was listening; the next one succeeded. Sidecars start before the app, so a real sidecar must retry until the app is up, as this loop does. The `message` field shows the text the init container wrote. With several containers in a pod, `-c` picks one for `logs` and `exec`.

## Pod Lifecycle and Restart Policy

A pod moves through these **phases**:

| Phase       | Meaning                                                             |
| ----------- | ------------------------------------------------------------------- |
| `Pending`   | Accepted, but not running yet: waiting for a node or pulling images |
| `Running`   | Bound to a node, and at least one container is running              |
| `Succeeded` | All containers exited with code 0 and will not restart              |
| `Failed`    | All containers have stopped, and at least one exited with an error  |
| `Unknown`   | The node stopped reporting                                          |

The `STATUS` column of `kubectl get pods` shows more detail than the phase, for example `ContainerCreating`, `CrashLoopBackOff` or `Completed`.

`restartPolicy` decides what the kubelet does when a container exits: `Always` (the default, for long-running apps), `OnFailure` (retry failed tasks) or `Never`. Here is a pod that fails on purpose and is not restarted:

```terminal
{
  "title": "a failing pod",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl run fail --image=busybox:1.38.0 --restart=Never -- sh -c 'echo starting; exit 3'",
      "output": "pod/fail created"
    },
    {
      "cmd": "kubectl wait --for=jsonpath='{.status.phase}'=Failed pod/fail --timeout=60s",
      "output": "pod/fail condition met"
    },
    {
      "cmd": "kubectl get pod fail",
      "output": "NAME   READY   STATUS   RESTARTS   AGE\nfail   0/1     Error    0          3s"
    },
    {
      "cmd": "kubectl get pod fail -o jsonpath='{.status.containerStatuses[0].state.terminated.exitCode}{\"\\n\"}'",
      "output": "3"
    },
    {
      "cmd": "kubectl logs fail",
      "output": "starting"
    }
  ]
}
```

The exit code and the logs survive after the container stops, until the pod is deleted. Clean up the pods of this part:

```bash
kubectl delete pod podinfo podinfo-sidecar fail client
```

```text
pod "podinfo" deleted from demo namespace
pod "podinfo-sidecar" deleted from demo namespace
pod "fail" deleted from demo namespace
pod "client" deleted from demo namespace
```

## Common Mistakes

- **Running bare pods in production.** A pod you create yourself is not recreated when its node dies. Use a Deployment, StatefulSet, DaemonSet or Job.
- **Using the `latest` tag.** You cannot tell which version runs, and nodes may cache different images. Use a version tag, or a digest ([Part 10](/guides/introduction-to-kubernetes/10-best-practices-in-kubernetes)).
- **A liveness probe that checks dependencies.** If `/healthz` fails when the database is down, every pod restarts at once and makes the outage worse. Liveness checks the process itself; readiness can check dependencies.
- **Putting several apps in one pod.** Containers in a pod are scheduled, scaled and replaced together. Use separate pods unless one container only exists to support the other.
- **Storing data inside the container.** It is gone when the pod is replaced. Use a volume.

## Summary

- A pod is a group of containers that share an IP address and volumes and run on one node.
- `kubectl get`, `describe`, `events --for`, `logs` and `exec` are the everyday commands to inspect and debug pods.
- Readiness probes control traffic, liveness probes control restarts, startup probes protect slow starts.
- Init containers prepare the pod; native sidecars (init containers with `restartPolicy: Always`) run beside the app.

## Keep Learning

- [Kubernetes pod lifecycle interview questions](/interview-questions/mid/kubernetes-pod-lifecycle)
- [How to list all containers in a pod](/posts/how-to-list-all-containers-in-kubernetes-pod)
- [How to keep a container running on Kubernetes](/posts/how-can-i-keep-a-container-running-on-kubernetes)
- [Difference between a pod and a Deployment](/posts/difference-between-pod-and-deployment)

Next, in [Part 4](/guides/introduction-to-kubernetes/04-deployments-and-replicasets), a Deployment runs three copies of podinfo and replaces them safely during updates.
