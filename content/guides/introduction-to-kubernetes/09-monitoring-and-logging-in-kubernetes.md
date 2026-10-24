---
title: 'Kubernetes Monitoring, Logging and Troubleshooting'
description: 'Debug Kubernetes with logs, events and kubectl debug, fix ImagePullBackOff, CrashLoopBackOff and Pending pods, and add Prometheus alerts with Helm 4.'
order: 9
---

**TLDR**: When a pod misbehaves, run `kubectl get pods`, then `kubectl describe pod` (its events), then `kubectl logs` (add `--previous` after a crash). The pod's status tells you which of a handful of problems you have: `ImagePullBackOff`, `CrashLoopBackOff`, `Pending`, or `Running` but not ready. `kubectl debug` adds a temporary container with tools to a running pod. For history and alerts, install Prometheus with the kube-prometheus-stack Helm chart and describe what to scrape with a ServiceMonitor.

In this part you crash podinfo on purpose and read the logs of the dead container, diagnose three broken Deployments, take a pod out of rotation through its readiness probe, debug a pod and a node with `kubectl debug`, then install Prometheus with Helm 4, scrape podinfo, and watch an alert fire.

## Prerequisites

- The app after [Part 8](/guides/introduction-to-kubernetes/08-resource-management-and-scaling), with metrics-server installed.
- Helm 4 (installed in [Part 2](/guides/introduction-to-kubernetes/02-setting-up-a-kubernetes-cluster)) and `jq`.

## Four Kinds of Signals

| Signal      | Answers                                   | Where it comes from                                         |
| ----------- | ----------------------------------------- | ----------------------------------------------------------- |
| **Events**  | What did Kubernetes do, and what failed?  | Controllers, the scheduler and kubelets; kept about an hour |
| **Logs**    | What did the app say?                     | Each container's standard output and error                  |
| **Metrics** | How much, how fast, how often, over time? | metrics-server for now, Prometheus for history              |
| **Traces**  | Where did one request spend its time?     | The app, instrumented with OpenTelemetry                    |

Events and logs are enough to fix most problems in front of you. Metrics and alerts tell you about the problems you are not looking at yet.

## Logs

The kubelet captures what each container writes to standard output and standard error and stores it on the node. `kubectl logs` reads it through the API server:

```terminal
{
  "title": "read logs",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl logs deployment/podinfo --tail=3",
      "output": "Found 3 pods, using pod/podinfo-75bb4bb8cc-cjtwp\n{\"level\":\"info\",\"ts\":\"2026-10-24T10:16:56.022Z\",\"caller\":\"fscache/fscache.go:38\",\"msg\":\"fscache start watcher for /podinfo/config\"}\n{\"level\":\"info\",\"ts\":\"2026-10-24T10:16:56.022Z\",\"caller\":\"http/server.go:273\",\"msg\":\"Starting HTTP Server.\",\"addr\":\":9898\"}\n{\"level\":\"info\",\"ts\":\"2026-10-24T10:16:56.022Z\",\"caller\":\"http/server.go:305\",\"msg\":\"Starting HTTPS Server.\",\"addr\":\":8443\"}"
    },
    {
      "cmd": "kubectl logs -l app=podinfo --prefix --tail=1",
      "output": "[pod/podinfo-75bb4bb8cc-zjlzn/podinfo] {\"level\":\"info\",\"ts\":\"2026-10-24T10:17:06.531Z\",\"caller\":\"http/server.go:305\",\"msg\":\"Starting HTTPS Server.\",\"addr\":\":8443\"}\n[pod/podinfo-75bb4bb8cc-6h7vc/podinfo] {\"level\":\"info\",\"ts\":\"2026-10-24T10:17:01.473Z\",\"caller\":\"http/server.go:305\",\"msg\":\"Starting HTTPS Server.\",\"addr\":\":8443\"}\n[pod/podinfo-75bb4bb8cc-cjtwp/podinfo] {\"level\":\"info\",\"ts\":\"2026-10-24T10:16:56.022Z\",\"caller\":\"http/server.go:305\",\"msg\":\"Starting HTTPS Server.\",\"addr\":\":8443\"}"
    }
  ]
}
```

`kubectl logs deployment/podinfo` picks one pod of the Deployment. To read all of them, select by label and add `--prefix` to see which line came from which pod. Other useful flags: `-f` to follow, `--since=10m`, `--timestamps`, `-c <container>` for multi-container pods, and `--all-containers`.

### Logs of a Crashed Container

podinfo's `/panic` endpoint makes the process exit with code 255. Call it inside one pod, and the container dies, taking the `curl` that called it along:

```terminal
{
  "title": "crash a container",
  "prompt": "$",
  "steps": [
    {
      "cmd": "POD=$(kubectl get pods -l app=podinfo -o jsonpath='{.items[0].metadata.name}')"
    },
    {
      "cmd": "kubectl exec $POD -- curl -s localhost:9898/panic",
      "output": "command terminated with exit code 52"
    },
    {
      "cmd": "kubectl get pod $POD",
      "output": "NAME                       READY   STATUS    RESTARTS      AGE\npodinfo-75bb4bb8cc-6h7vc   1/1     Running   1 (15s ago)   30s"
    },
    {
      "cmd": "kubectl logs $POD --previous --tail=2",
      "output": "{\"level\":\"info\",\"ts\":\"2026-10-24T10:17:01.473Z\",\"caller\":\"http/server.go:305\",\"msg\":\"Starting HTTPS Server.\",\"addr\":\":8443\"}\n{\"level\":\"info\",\"ts\":\"2026-10-24T10:17:16.360Z\",\"caller\":\"http/panic.go:14\",\"msg\":\"Panic command received\"}"
    },
    {
      "cmd": "kubectl get pod $POD -o jsonpath='{.status.containerStatuses[0].lastState.terminated.exitCode}{\"\\n\"}'",
      "output": "255"
    }
  ]
}
```

The kubelet restarted the container, so plain `kubectl logs` shows the new one. `--previous` shows the logs of the container that died, and its last line says why. The kubelet keeps only the current and the previous container's logs, and only while the pod exists.

### Where Logs Live, and Shipping Them

On the node, container logs are files under `/var/log/pods/<namespace>_<pod>_<uid>/`. The kubelet rotates them (10 MiB and 5 files per container by default), and they disappear with the pod. For history and search across pods, run a log agent as a DaemonSet that reads those files and ships them to a store:

- Agents: **Fluent Bit**, the **OpenTelemetry Collector**, Grafana **Alloy** or Vector. Promtail, which many Loki tutorials still use, reached its end of life on 2 March 2026; Grafana replaced it with Alloy.
- Stores: **Grafana Loki**, **Elasticsearch** or **OpenSearch**, or your cloud provider's logging service.

Log in JSON, as podinfo does, so the agent can parse fields such as level and request ID without regular expressions.

## Events

Events are the cluster's own log. They expire after about an hour, so look at them while the problem is fresh:

```bash
kubectl events --for pod/POD_NAME  # one object, oldest first
kubectl events --types=Warning    # only problems, in the current namespace
kubectl events -A --watch         # everything, as it happens
```

## A Troubleshooting Playbook

Most pod problems fall into one of four shapes. The `STATUS` column of `kubectl get pods` tells you which:

```diagram
{
  "type": "graph",
  "columns": [
    [{ "id": "get", "label": "kubectl get pods", "sub": "read STATUS", "icon": "cpu", "tone": "slate" }],
    [
      { "id": "pull", "label": "ImagePullBackOff", "sub": "ErrImagePull", "icon": "box", "tone": "red", "detail": "The node cannot pull the image: wrong name or tag, private registry without imagePullSecrets, or rate limits. Check describe events." },
      { "id": "crash", "label": "CrashLoopBackOff", "sub": "Error, OOMKilled", "icon": "activity", "tone": "red", "detail": "The container starts and exits. Check logs --previous and the last state: reason OOMKilled points at memory (the limit or the node); exit codes 1 or 2 usually come from the app." },
      { "id": "pending", "label": "Pending", "sub": "no node", "icon": "server", "tone": "amber", "detail": "The scheduler found no node: not enough requested CPU or memory, a selector or affinity no node matches, a taint, or an unbound volume." },
      { "id": "notready", "label": "Running, 0/1", "sub": "not ready", "icon": "net", "tone": "amber", "detail": "The readiness probe fails, so the pod gets no traffic. Check the probe in describe and the app's health endpoint." }
    ],
    [
      { "id": "f1", "label": "describe: events", "sub": "the pull error", "icon": "check", "tone": "green" },
      { "id": "f2", "label": "logs --previous", "sub": "the crash", "icon": "check", "tone": "green" },
      { "id": "f3", "label": "describe: events", "sub": "the scheduler's reason", "icon": "check", "tone": "green" },
      { "id": "f4", "label": "describe: probe", "sub": "and EndpointSlices", "icon": "check", "tone": "green" }
    ]
  ],
  "edges": [["get", "pull"], ["get", "crash"], ["get", "pending"], ["get", "notready"], ["pull", "f1"], ["crash", "f2"], ["pending", "f3"], ["notready", "f4"]]
}
```

These three Deployments are each broken in one of the first three ways:

```yaml
# Three Deployments that fail in three common ways
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bad-image
  labels:
    lab: broken
spec:
  replicas: 1
  selector:
    matchLabels:
      app: bad-image
  template:
    metadata:
      labels:
        app: bad-image
        lab: broken
    spec:
      containers:
        - name: podinfo
          image: ghcr.io/stefanprodan/podinfo:6.150.0 # a typo in the tag
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bad-config
  labels:
    lab: broken
spec:
  replicas: 1
  selector:
    matchLabels:
      app: bad-config
  template:
    metadata:
      labels:
        app: bad-config
        lab: broken
    spec:
      containers:
        - name: podinfo
          image: ghcr.io/stefanprodan/podinfo:6.15.0
          command: ['./podinfo']
          args: ['--random-delay-min=5', '--random-delay-max=1'] # an invalid combination
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: no-node
  labels:
    lab: broken
spec:
  replicas: 1
  selector:
    matchLabels:
      app: no-node
  template:
    metadata:
      labels:
        app: no-node
        lab: broken
    spec:
      nodeSelector:
        disktype: ssd # no node has this label
      containers:
        - name: podinfo
          image: ghcr.io/stefanprodan/podinfo:6.15.0
```

```terminal
{
  "title": "three broken Deployments",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 09-observability/broken.yaml",
      "output": "deployment.apps/bad-image created\ndeployment.apps/bad-config created\ndeployment.apps/no-node created"
    },
    {
      "cmd": "kubectl get pods -l lab=broken",
      "output": "NAME                          READY   STATUS         RESTARTS      AGE\nbad-config-74b5489975-dlkjw   0/1     Error          3 (45s ago)   60s\nbad-image-76c5699b4d-vvz77    0/1     ErrImagePull   0             60s\nno-node-f744f9db9-rwxcn       0/1     Pending        0             60s"
    }
  ]
}
```

**ImagePullBackOff.** The events of the pod name the image and the registry's answer, `not found`:

```bash
kubectl describe pod -l app=bad-image | sed -n '/^Events:/,$p'
```

```text
Events:
  Type     Reason     Age                From               Message
  ----     ------     ----               ----               -------
  Normal   Scheduled  60s                default-scheduler  Successfully assigned demo/bad-image-76c5699b4d-vvz77 to k8s-guide-worker
  Normal   Pulling    22s (x3 over 60s)  kubelet            spec.containers{podinfo}: Pulling image "ghcr.io/stefanprodan/podinfo:6.150.0"
  Warning  Failed     22s (x3 over 59s)  kubelet            spec.containers{podinfo}: Failed to pull image "ghcr.io/stefanprodan/podinfo:6.150.0": rpc error: code = NotFound desc = failed to pull and unpack image "ghcr.io/stefanprodan/podinfo:6.150.0": failed to resolve reference "ghcr.io/stefanprodan/podinfo:6.150.0": ghcr.io/stefanprodan/podinfo:6.150.0: not found
  Warning  Failed     22s (x3 over 59s)  kubelet            spec.containers{podinfo}: Error: ErrImagePull
  Normal   BackOff    8s (x3 over 59s)   kubelet            spec.containers{podinfo}: Back-off pulling image "ghcr.io/stefanprodan/podinfo:6.150.0"
  Warning  Failed     8s (x3 over 59s)   kubelet            spec.containers{podinfo}: Error: ImagePullBackOff
```

Check the tag for typos, check that the registry is reachable from the nodes, and for private registries add `imagePullSecrets` to the pod or its ServiceAccount. Kubernetes retries with growing delays, which is the "back-off".

**CrashLoopBackOff.** The container starts and exits; here `STATUS` shows `Error` between restarts. The logs say why, and the exit code (2 for a Go panic) says how:

```terminal
{
  "title": "a crash loop",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl logs deployment/bad-config",
      "output": "{\"level\":\"panic\",\"ts\":\"2026-10-24T10:18:08.414Z\",\"caller\":\"podinfo/main.go:136\",\"msg\":\"`--random-delay-max` should be greater than `--random-delay-min`\",\"stacktrace\":\"main.main\\n\\t/podinfo/cmd/podinfo/main.go:136\\nruntime.main\\n\\t/usr/local/go/src/runtime/proc.go:302\"}\npanic: `--random-delay-max` should be greater than `--random-delay-min`"
    },
    {
      "cmd": "kubectl describe pod -l app=bad-config | grep -A 5 'Last State'",
      "output": "    Last State:     Terminated\n      Reason:       Error\n      Exit Code:    2\n      Started:      Sat, 24 Oct 2026 10:17:46 +0000\n      Finished:     Sat, 24 Oct 2026 10:17:46 +0000\n    Ready:          False"
    }
  ]
}
```

The first two lines of the log are enough: two options contradict each other. If a crashing container prints nothing at all, check its last state: `Reason: OOMKilled` means the kernel's out-of-memory killer ended it, usually at its memory limit, sometimes because the node ran out ([Part 8](/guides/introduction-to-kubernetes/08-resource-management-and-scaling)); exit code 137 without that reason means something else sent SIGKILL. Exit codes 127 and 126 mean the command in the pod spec does not exist or is not executable. [CrashLoopBackOff with no logs](/posts/kubernetes-pods-crashloopbackoff-no-logs) covers more cases.

**Pending.** No node fits. The scheduler's event lists, per node, why not:

```bash
kubectl describe pod -l app=no-node | sed -n '/^Events:/,$p'
```

```text
Events:
  Type     Reason            Age   From               Message
  ----     ------            ----  ----               -------
  Warning  FailedScheduling  60s   default-scheduler  0/3 nodes are available: 1 node(s) had untolerated taint(s), 2 node(s) didn't match Pod's node affinity/selector. preemption: 0/3 nodes are available: 3 Preemption is not helpful for scheduling.
```

One node is the tainted control plane, and the two workers lack the `disktype=ssd` label. Other common reasons are `Insufficient cpu` or `Insufficient memory` (requests larger than any node's free capacity), a PVC that cannot bind, and a quota (in which case the pod is never created, and the event is on the ReplicaSet). Clean up:

```bash
kubectl delete -f 09-observability/broken.yaml
```

```text
deployment.apps "bad-image" deleted from demo namespace
deployment.apps "bad-config" deleted from demo namespace
deployment.apps "no-node" deleted from demo namespace
```

**Running but not ready.** podinfo can switch its own readiness off. Do that in one pod and watch it leave the Service:

```terminal
{
  "title": "a pod out of rotation",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl exec $POD -- curl -s -X POST localhost:9898/readyz/disable"
    },
    {
      "cmd": "kubectl get pods -l app=podinfo",
      "output": "NAME                       READY   STATUS    RESTARTS      AGE\npodinfo-75bb4bb8cc-6h7vc   0/1     Running   1 (90s ago)   105s\npodinfo-75bb4bb8cc-cjtwp   1/1     Running   0             111s\npodinfo-75bb4bb8cc-zjlzn   1/1     Running   0             100s"
    },
    {
      "cmd": "kubectl get endpointslices -l kubernetes.io/service-name=podinfo -o jsonpath='{range .items[*].endpoints[*]}{.targetRef.name}{\"\\t\"}ready={.conditions.ready}{\"\\n\"}{end}'",
      "output": "podinfo-75bb4bb8cc-cjtwp\tready=true\npodinfo-75bb4bb8cc-6h7vc\tready=false\npodinfo-75bb4bb8cc-zjlzn\tready=true"
    },
    {
      "cmd": "kubectl exec $POD -- curl -s -X POST localhost:9898/readyz/enable"
    }
  ]
}
```

The pod keeps running (readiness failures never restart a container; liveness failures do), but its endpoint is marked `ready=false`, so the Service sends it no new connections. That is how a pod that is overloaded or warming up steps aside without being killed.

## kubectl debug

Many production images contain only the app: no shell, no `ps`, no network tools. `kubectl debug` adds an **ephemeral container** with an image of your choice to a running pod. With `--target`, it shares the process namespace of the app's container, so you can see its processes:

```terminal
{
  "title": "an ephemeral debug container",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl debug $POD --image=busybox:1.38.0 --target=podinfo --container=debugger -- sh -c \"ps; netstat -tln\"",
      "output": "Targeting container \"podinfo\". If you don't see processes from this container it may be because the container runtime doesn't support this feature."
    },
    {
      "cmd": "kubectl logs $POD -c debugger",
      "output": "PID   USER     TIME  COMMAND\n    1 100       0:00 ./podinfo --config-path=/podinfo/config --secure-port=8443 --cert-path=/podinfo/tls --cache-server=tcp://cache:6379\n   34 root      0:00 sh -c ps; netstat -tln\n   47 root      0:00 ps\nActive Internet connections (only servers)\nProto Recv-Q Send-Q Local Address           Foreign Address         State\ntcp        0      0 :::9898                 :::*                    LISTEN\ntcp        0      0 :::8443                 :::*                    LISTEN"
    }
  ]
}
```

The debug container sees podinfo as process 1, running as user 100 (busybox has no name for that ID), listening on ports 9898 and 8443. Add `-it` instead of a command to get an interactive shell. Ephemeral containers cannot be removed; they stay in the pod's spec until the pod is replaced. Two other modes are useful: `kubectl debug $POD -it --copy-to=debug-copy --container=podinfo -- sh` starts a copy of the pod with a different command, and `kubectl debug node/<name>` starts a pod on a node with the node's filesystem mounted at `/host`:

```terminal
{
  "title": "debug a node",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl debug node/k8s-guide-worker --image=busybox:1.38.0 --profile=general -- ls /host/var/log/pods",
      "output": "Creating debugging pod node-debugger-k8s-guide-worker-d6ffl with container debugger on node k8s-guide-worker."
    },
    {
      "cmd": "kubectl logs $(kubectl get pods -o name | grep node-debugger)",
      "output": "demo_bad-config-74b5489975-dlkjw_97409a9f-6a9d-49e4-a5c3-d0f3430be3c2\ndemo_bad-image-76c5699b4d-vvz77_39f812e5-618d-42e5-ac7c-1541b5a4cf02\ndemo_node-debugger-k8s-guide-worker-d6ffl_8b756d65-1743-4484-b692-1f028bae2f29\ndemo_podinfo-75bb4bb8cc-zjlzn_c6de5c55-a930-427d-835d-cca4e034ad0f\nkube-system_kindnet-sn2zm_09465231-6d19-4924-9d29-abb727c39e6f\nkube-system_kube-proxy-c52d7_2db178ce-f53c-4f6a-a31d-73d700b96608\nkube-system_metrics-server-84c99cb944-s62vc_ba69e415-3ad5-4e15-9c95-096a0f4a71b7"
    },
    {
      "cmd": "kubectl delete $(kubectl get pods -o name | grep node-debugger)",
      "output": "pod \"node-debugger-k8s-guide-worker-d6ffl\" deleted from demo namespace"
    }
  ]
}
```

There are the log directories from above, one per pod on that node. `--profile` sets the debug container's privileges: `general` for most work, `netadmin` for network tools, `sysadmin` for full access.

## Metrics with metrics-server

metrics-server keeps only the latest values, which is enough for `kubectl top` and the HPA:

```bash
kubectl top pods --containers
```

```text
POD                        NAME      CPU(cores)   MEMORY(bytes)
cache-0                    valkey    1m           8Mi
podinfo-75bb4bb8cc-6h7vc   podinfo   1m           18Mi
podinfo-75bb4bb8cc-cjtwp   podinfo   1m           16Mi
podinfo-75bb4bb8cc-zjlzn   podinfo   1m           18Mi
```

For history, rates, percentiles and alerts, you need Prometheus.

## Prometheus with the kube-prometheus-stack Chart

The [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack) Helm chart installs the Prometheus Operator, Prometheus, Alertmanager, Grafana, kube-state-metrics (metrics about Kubernetes objects) and node-exporter (metrics about nodes), with dashboards and alert rules for the cluster. Helm installs charts straight from OCI registries such as GitHub's. On kind, a few control plane components only listen on `127.0.0.1`, so this values file turns off scraping them:

```yaml
# Values for the kube-prometheus-stack chart on a kind cluster.
# kind binds these control plane components to 127.0.0.1, so Prometheus cannot scrape them.
kubeControllerManager:
  enabled: false
kubeScheduler:
  enabled: false
kubeEtcd:
  enabled: false
kubeProxy:
  enabled: false
```

```terminal
{
  "title": "install the monitoring stack",
  "prompt": "$",
  "steps": [
    {
      "cmd": "helm install monitoring oci://ghcr.io/prometheus-community/charts/kube-prometheus-stack --version 92.11.0 --namespace monitoring --create-namespace --values 09-observability/monitoring-values.yaml --wait --timeout 10m",
      "output": "Pulled: ghcr.io/prometheus-community/charts/kube-prometheus-stack:92.11.0\nDigest: sha256:5b9b0215085f00f61c0fb2aa01ec402609d91c0a6a91bc84ca85cce2ed69e635\nNAME: monitoring\nLAST DEPLOYED: Sat Oct 24 10:19:09 2026\nNAMESPACE: monitoring\nSTATUS: deployed\nREVISION: 1\nDESCRIPTION: Install complete\nNOTES:\nkube-prometheus-stack has been installed. Check its status by running:\n  kubectl --namespace monitoring get pods -l \"release=monitoring\""
    },
    {
      "cmd": "kubectl get pods -n monitoring",
      "output": "NAME                                                     READY   STATUS    RESTARTS   AGE\nalertmanager-monitoring-kube-prometheus-alertmanager-0   2/2     Running   0          36s\nmonitoring-grafana-5f9554bfb8-k7hzv                      3/3     Running   0          39s\nmonitoring-kube-prometheus-operator-74b7478f6d-f2k2h     1/1     Running   0          39s\nmonitoring-kube-state-metrics-78fd56fc4b-2d5fn           1/1     Running   0          39s\nmonitoring-prometheus-node-exporter-bwvhb                1/1     Running   0          39s\nmonitoring-prometheus-node-exporter-kwhfh                1/1     Running   0          39s\nmonitoring-prometheus-node-exporter-tv4rq                1/1     Running   0          39s\nprometheus-monitoring-kube-prometheus-prometheus-0       2/2     Running   0          35s"
    }
  ]
}
```

(The chart's notes go on with Grafana instructions, cut here.) Pin the chart version, as here, so an upgrade is a decision rather than an accident.

### Scrape podinfo with a ServiceMonitor

The Prometheus Operator adds CRDs: a **ServiceMonitor** tells Prometheus to scrape the endpoints of matching Services, and a **PrometheusRule** holds alert and recording rules. This chart's Prometheus picks up objects labeled `release: monitoring`:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: podinfo
  labels:
    release: monitoring # the chart's Prometheus selects ServiceMonitors with this label
spec:
  selector:
    matchLabels:
      app: podinfo # scrape the endpoints of Services with this label
  endpoints:
    - port: http # the named Service port
      path: /metrics
      interval: 15s
```

The alert fires when more than 5 percent of podinfo's requests fail for a minute. podinfo counts its requests in `http_requests_total` with a `status` label:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: podinfo
  labels:
    release: monitoring
spec:
  groups:
    - name: podinfo
      rules:
        - alert: PodinfoHighErrorRate
          expr: |
            sum(rate(http_requests_total{job="podinfo", status=~"5.."}[2m]))
              / sum(rate(http_requests_total{job="podinfo"}[2m])) > 0.05
          for: 1m
          labels:
            severity: warning
          annotations:
            summary: More than 5 percent of podinfo requests fail
            description: '{{ $value | humanizePercentage }} of podinfo requests returned a 5xx status over the last 2 minutes.'
```

```terminal
{
  "title": "scrape podinfo",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 09-observability/servicemonitor.yaml -f 09-observability/prometheusrule.yaml",
      "output": "servicemonitor.monitoring.coreos.com/podinfo created\nprometheusrule.monitoring.coreos.com/podinfo created"
    },
    {
      "cmd": "kubectl port-forward -n monitoring service/monitoring-kube-prometheus-prometheus 9090:9090 > /dev/null 2>&1 & PF=$!"
    },
    {
      "cmd": "curl -s localhost:9090/api/v1/query --data-urlencode 'query=up{job=\"podinfo\"}' | jq -r '.data.result[] | \"\\(.metric.pod) up=\\(.value[1])\"'",
      "output": "podinfo-75bb4bb8cc-6h7vc up=1\npodinfo-75bb4bb8cc-cjtwp up=1\npodinfo-75bb4bb8cc-zjlzn up=1"
    }
  ]
}
```

Prometheus needs a minute or so to discover the new targets. Then all three pods are scraped (`up=1`). You can also open `http://localhost:9090` in a browser and use the Prometheus UI.

### Make an Alert Fire

podinfo's `/status/500` endpoint answers with a 500 error. A small pod sends one failing and one good request every half second:

```bash
kubectl run errors --image=curlimages/curl:8.23.0 --restart=Never -- sh -c 'for i in $(seq 1 400); do curl -s -o /dev/null http://podinfo/status/500; curl -s -o /dev/null http://podinfo/; sleep 0.5; done'
```

```text
pod/errors created
```

A few minutes later, the request rate by status and the alert:

```terminal
{
  "title": "PromQL and alerts",
  "prompt": "$",
  "steps": [
    {
      "cmd": "curl -s localhost:9090/api/v1/query --data-urlencode 'query=sum by (status) (rate(http_requests_total{job=\"podinfo\"}[2m]))' | jq -r '.data.result[] | \"\\(.metric.status) \\(.value[1])\"'",
      "output": "200 3.0095238095238095\n202 0\n503 0\n500 1.952380952380952"
    },
    {
      "cmd": "curl -s localhost:9090/api/v1/alerts | jq -r '.data.alerts[] | select(.labels.alertname==\"PodinfoHighErrorRate\") | \"\\(.state) \\(.annotations.description)\"'",
      "output": "firing 39.66% of podinfo requests returned a 5xx status over the last 2 minutes."
    }
  ]
}
```

About two requests per second fail and three succeed. The 3 per second of status 200 include the kubelets' liveness and readiness probes, which call podinfo too; the 503 and 202 series are left over from the readiness switch earlier. The alert moved from `pending` to `firing` after its `for: 1m`, and Prometheus sent it to Alertmanager, which routes alerts to Slack, email, PagerDuty and others once you configure a receiver. Clean up the error generator and the port-forward:

```terminal
{
  "title": "clean up",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl delete pod errors",
      "output": "pod \"errors\" deleted from demo namespace"
    },
    {
      "cmd": "kill $PF"
    }
  ]
}
```

### What to Watch

- **For each app**, the RED signals: request **r**ate, **e**rrors and **d**uration (latency percentiles from a histogram such as podinfo's `http_request_duration_seconds`).
- **From kube-state-metrics**: `kube_pod_container_status_restarts_total` (crash loops), `kube_deployment_status_replicas_available` against the desired count, and pods stuck in `Pending`.
- **From the nodes**: CPU, memory, disk space and the kubelet's pressure conditions.
- **For the cluster**: API server latency and errors, etcd health (on self-managed clusters), and certificate expiry.

Grafana comes with the chart and has dashboards for most of these. Its admin password is in the `monitoring-grafana` Secret; port-forward `service/monitoring-grafana` to port 3000 to open it. Alert on symptoms users feel (errors, latency, availability), not on every high CPU reading.

## Traces with OpenTelemetry

Metrics tell you that requests are slow; a trace tells you where one request spent its time across services. Instrument apps with the OpenTelemetry SDK for their language and send traces with the OTLP protocol to an OpenTelemetry Collector, which forwards them to Jaeger, Grafana Tempo or a commercial backend. podinfo has OpenTelemetry built in: setting the `PODINFO_OTEL_SERVICE_NAME` and the standard `OTEL_EXPORTER_OTLP_ENDPOINT` environment variables turns it on. The Collector can also receive logs and metrics, so many teams run one Collector DaemonSet for all three signals.

## Common Mistakes

- **Reading only `kubectl logs` after a crash.** You see the new container. Use `--previous`.
- **Not looking at events.** Image pulls, scheduling, probes and quotas all report there, not in the app's logs.
- **Logs only on the nodes.** They vanish with the pod and rotate quickly; ship them somewhere.
- **No resource requests, then wondering why the HPA or the dashboards show nothing useful.** Percentages are relative to requests.
- **Alerting on causes instead of symptoms.** Page on errors and latency users see; keep CPU and memory alerts for tickets.
- **Unpinned charts.** `helm install` without `--version` installs whatever is newest today.

## Summary

- `get`, `describe` and `logs --previous` find most problems; the pod's status names the kind of problem.
- `kubectl debug` adds a tool container to a running pod or a node without changing the image.
- Logs belong in a central store, shipped by a DaemonSet agent such as Fluent Bit, the OpenTelemetry Collector or Alloy.
- kube-prometheus-stack gives you Prometheus, Alertmanager and Grafana; ServiceMonitors and PrometheusRules are how apps plug in.

## Keep Learning

- [How to follow logs continuously](/posts/kubectl-logs-continuously)
- [Fix pods stuck in Terminating](/posts/fix-pods-stuck-terminating-kubernetes)
- [Prometheus and Grafana monitoring exercise](/exercises/prometheus-grafana-monitoring)
- [Prometheus vs Datadog](/comparisons/prometheus-vs-datadog) and the [monitoring and observability quiz](/quizzes/monitoring-observability-quiz)

Next, in [Part 10](/guides/introduction-to-kubernetes/10-best-practices-in-kubernetes), you lock the app and the cluster down.
