---
title: 'Kubernetes Requests, Limits, Autoscaling and Scheduling'
description: 'Set CPU and memory requests and limits, resize pods in place, add LimitRanges and quotas, autoscale with HPA, and drain nodes safely with taints and PDBs.'
order: 8
---

**TLDR**: **Requests** are what the scheduler reserves for a container; **limits** are the most it may use. A container over its memory limit is killed (`OOMKilled`); one over its CPU limit is slowed down. Set requests on everything, a memory limit on everything, and think twice about CPU limits. **LimitRanges** fill in defaults and **ResourceQuotas** cap a namespace. The **HorizontalPodAutoscaler** adds pods when they get busy, and since Kubernetes 1.35 you can change a running pod's CPU and memory **in place**. Labels, taints, affinity, topology spread and PodDisruptionBudgets decide where pods run and how safely nodes can be drained.

In this part you install metrics-server, give podinfo a resource budget, watch a container get OOMKilled, resize a pod without restarting it, add a quota and see what happens when a Deployment hits it, load-test podinfo until the autoscaler adds pods, and drain a node.

## Prerequisites

- The app as it stands after [Part 7](/guides/introduction-to-kubernetes/07-persistent-storage-in-kubernetes): podinfo, its Service and the cache StatefulSet.
- `kubectl top` needs metrics-server, which you install first.

## Install metrics-server

[metrics-server](https://github.com/kubernetes-sigs/metrics-server) collects CPU and memory usage from every kubelet and serves it through the `metrics.k8s.io` API, which `kubectl top` and the HorizontalPodAutoscaler read. That API became stable (`v1`) in Kubernetes 1.37. Most managed services install metrics-server for you. On kind, the kubelets use self-signed certificates, so metrics-server needs `--kubelet-insecure-tls` there (and only there):

```terminal
{
  "title": "metrics-server",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.9.0/components.yaml",
      "output": "serviceaccount/metrics-server created\nclusterrole.rbac.authorization.k8s.io/system:aggregated-metrics-reader created\nclusterrole.rbac.authorization.k8s.io/system:metrics-server created\nrolebinding.rbac.authorization.k8s.io/metrics-server-auth-reader created\nclusterrolebinding.rbac.authorization.k8s.io/metrics-server:system:auth-delegator created\nclusterrolebinding.rbac.authorization.k8s.io/system:metrics-server created\nservice/metrics-server created\ndeployment.apps/metrics-server created\napiservice.apiregistration.k8s.io/v1beta1.metrics.k8s.io created"
    },
    {
      "cmd": "kubectl -n kube-system patch deployment metrics-server --type=json -p '[{\"op\":\"add\",\"path\":\"/spec/template/spec/containers/0/args/-\",\"value\":\"--kubelet-insecure-tls\"}]'",
      "output": "deployment.apps/metrics-server patched"
    },
    {
      "cmd": "kubectl -n kube-system rollout status deployment/metrics-server",
      "output": "Waiting for deployment \"metrics-server\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"metrics-server\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"metrics-server\" rollout to finish: 1 old replicas are pending termination...\ndeployment \"metrics-server\" successfully rolled out"
    }
  ]
}
```

After about a minute, the first numbers arrive:

```terminal
{
  "title": "kubectl top",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl top nodes",
      "output": "NAME                      CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)\nk8s-guide-control-plane   143m         3%       678Mi           4%\nk8s-guide-worker          186m         4%       269Mi           1%\nk8s-guide-worker2         187m         4%       252Mi           1%"
    },
    {
      "cmd": "kubectl top pods",
      "output": "NAME                      CPU(cores)   MEMORY(bytes)\ncache-0                   4m           8Mi\npodinfo-bffd5866f-2szmw   1m           18Mi\npodinfo-bffd5866f-d5264   1m           16Mi\npodinfo-bffd5866f-s65dl   1m           18Mi"
    }
  ]
}
```

podinfo uses about a millicore of CPU and under 20 MiB of memory while idle. These numbers are the starting point for sizing it.

## Requests and Limits

```yaml
resources:
  requests: # reserved on the node; used for scheduling
    cpu: 100m # 100 millicores = 0.1 of a CPU core
    memory: 64Mi # 64 mebibytes
  limits: # the ceiling at run time
    memory: 128Mi # exceed it and the container is killed
```

- **CPU** is measured in cores: `1` is a full core, `100m` a tenth of one. CPU is compressible: a container that wants more than its limit is throttled, not killed.
- **Memory** is measured in bytes with binary suffixes (`Ki`, `Mi`, `Gi`). `128M` (decimal) and `128Mi` (binary) are different numbers. Memory is not compressible: a container that goes over its limit is killed by the kernel's out-of-memory killer and restarted.
- **The scheduler only looks at requests.** It places a pod on a node whose free allocatable resources cover the pod's requests, whatever the pod really uses.

A common, defensible policy: set CPU and memory requests close to what the app uses under normal load, set a memory limit (often equal to the request, so the pod cannot use memory it did not reserve), and leave the CPU limit off, so the app can use idle CPU on the node instead of being throttled. If you share nodes with teams you do not trust, add CPU limits or quotas. The Part 8 Deployment follows that policy, and spreads its pods over nodes:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: podinfo
  labels:
    app: podinfo
spec:
  replicas: 3
  revisionHistoryLimit: 5
  progressDeadlineSeconds: 120
  minReadySeconds: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: podinfo
  template:
    metadata:
      labels:
        app: podinfo
    spec:
      containers:
        - name: podinfo
          image: ghcr.io/stefanprodan/podinfo:6.15.0
          command: ['./podinfo']
          args:
            - --config-path=/podinfo/config # the ConfigMap file
            - --secure-port=8443 # HTTPS, with the key pair from the Secret
            - --cert-path=/podinfo/tls
            - --cache-server=tcp://cache:6379
          env:
            # Non-secret settings, one key from the ConfigMap each
            - name: PODINFO_UI_MESSAGE
              valueFrom:
                configMapKeyRef:
                  name: podinfo-config
                  key: PODINFO_UI_MESSAGE
            - name: PODINFO_LEVEL
              valueFrom:
                configMapKeyRef:
                  name: podinfo-config
                  key: PODINFO_LEVEL
          ports:
            - name: http
              containerPort: 9898
            - name: https
              containerPort: 8443
          volumeMounts:
            - name: config
              mountPath: /podinfo/config
              readOnly: true
            - name: tls # the Secret, as files: tls.crt and tls.key
              mountPath: /podinfo/tls
              readOnly: true
          readinessProbe:
            httpGet:
              path: /readyz
              port: http
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            periodSeconds: 10
          resources:
            requests:
              cpu: 100m # used for scheduling and as the HPA's 100 percent
              memory: 64Mi
            limits:
              memory: 128Mi # no CPU limit: the container may use idle CPU on the node
      # Prefer to put the replicas on different nodes
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app: podinfo
      volumes:
        - name: config
          configMap:
            name: podinfo-config
            items: # only this key becomes a file
              - key: features.yaml
                path: features.yaml
        - name: tls
          secret:
            secretName: podinfo-tls
```

```terminal
{
  "title": "apply the resource budget",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 08-resources/deployment.yaml",
      "output": "deployment.apps/podinfo configured"
    },
    {
      "cmd": "kubectl rollout status deployment/podinfo",
      "output": "Waiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 2 out of 3 new replicas have been updated...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"podinfo\" rollout to finish: 1 old replicas are pending termination...\ndeployment \"podinfo\" successfully rolled out"
    },
    {
      "cmd": "kubectl get pods -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass",
      "output": "NAME                       QOS\ncache-0                    Burstable\npodinfo-75bb4bb8cc-2g8fz   Burstable\npodinfo-75bb4bb8cc-j54kd   Burstable\npodinfo-75bb4bb8cc-kpvnd   Burstable"
    },
    {
      "cmd": "kubectl describe node k8s-guide-worker | grep -A 9 'Allocated resources'",
      "output": "Allocated resources:\n  (Total limits may be over 100 percent, i.e., overcommitted.)\n  Resource           Requests    Limits\n  --------           --------    ------\n  cpu                300m (7%)   0 (0%)\n  memory             178Mi (1%)  256Mi (1%)\n  ephemeral-storage  0 (0%)      0 (0%)\n  hugepages-1Gi      0 (0%)      0 (0%)\n  hugepages-2Mi      0 (0%)      0 (0%)\nEvents:"
    }
  ]
}
```

### Quality of Service Classes

Kubernetes puts every pod into a **QoS class** from its requests and limits:

| Class        | When                                                            |
| ------------ | --------------------------------------------------------------- |
| `Guaranteed` | Every container has CPU and memory requests equal to its limits |
| `Burstable`  | At least one request or limit is set, but not `Guaranteed`      |
| `BestEffort` | No requests or limits at all                                    |

When a node runs low on memory, the kubelet evicts pods to protect itself. It goes first for pods that use more memory than they requested, then considers pod priority, then how far over their requests they are. `BestEffort` pods request nothing, so any memory they use counts as over their requests; `Guaranteed` pods cannot use more than they request, so they usually come last, but they are not immune when the node itself runs out. Priority can still move a pod ahead of another within the same group. The class also tunes the kernel's out-of-memory killer in the same order. podinfo and the cache are `Burstable`: they have requests, a memory limit and no CPU limit, the right class for most apps. Use `Guaranteed` for the workloads you most want to keep under memory pressure, and avoid `BestEffort` outside experiments.

### OOMKilled

This pod asks podinfo to load 300 MB into memory with a limit of 128 MiB:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: memory-hog
spec:
  containers:
    - name: podinfo
      image: ghcr.io/stefanprodan/podinfo:6.15.0
      command: ['./podinfo']
      args: ['--stress-memory=300'] # load 300 MB into memory at startup
      resources:
        requests:
          cpu: 50m
          memory: 64Mi
        limits:
          memory: 128Mi
```

```terminal
{
  "title": "over the memory limit",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 08-resources/oom-pod.yaml",
      "output": "pod/memory-hog created"
    },
    {
      "cmd": "kubectl get pod memory-hog",
      "output": "NAME         READY   STATUS      RESTARTS     AGE\nmemory-hog   0/1     OOMKilled   1 (2s ago)   3s"
    },
    {
      "cmd": "kubectl get pod memory-hog -o jsonpath='{.status.containerStatuses[0].lastState.terminated}' | jq",
      "output": "{\n  \"containerID\": \"containerd://1a1c0c1f987b409026005a7a62f83001bbfda2d0827ca6672460e29977674c41\",\n  \"exitCode\": 137,\n  \"finishedAt\": \"2026-10-24T10:17:36Z\",\n  \"reason\": \"OOMKilled\",\n  \"startedAt\": \"2026-10-24T10:17:35Z\"\n}"
    },
    {
      "cmd": "kubectl delete pod memory-hog",
      "output": "pod \"memory-hog\" deleted from demo namespace"
    }
  ]
}
```

Here the container went over its own 128 MiB limit. In general, `reason: OOMKilled` means the kernel's out-of-memory killer ended the process, either because the container hit its limit or because the whole node ran out of memory; compare the container's usage with its limit, and check the node for memory pressure, before you raise anything. Exit code 137 (128 plus signal 9) alone only says the process got SIGKILL, which also happens when a container ignores SIGTERM until its grace period runs out. The kubelet restarts the container and backs off a little longer each time, so the pod soon shows `CrashLoopBackOff`. When the limit is the cause, the fix is a higher limit or an app that uses less memory, for example a JVM or Node.js heap size that fits inside the limit.

### Resize a Running Pod

Changing the resources in a Deployment's template replaces its pods. Since Kubernetes 1.35, **in-place pod resize** is stable: you change a running pod's requests and limits through its `resize` subresource, and the kubelet applies the change without recreating the pod. `resizePolicy` decides per resource whether the container must restart:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: resize-demo
spec:
  containers:
    - name: podinfo
      image: ghcr.io/stefanprodan/podinfo:6.15.0
      resizePolicy:
        - resourceName: cpu
          restartPolicy: NotRequired # the default: apply a new CPU size without a restart
        - resourceName: memory
          restartPolicy: RestartContainer # restart the container to apply a new memory size
      resources:
        requests:
          cpu: 100m
          memory: 64Mi
        limits:
          cpu: 200m
          memory: 128Mi
```

```terminal
{
  "title": "in-place resize",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 08-resources/resize-pod.yaml",
      "output": "pod/resize-demo created"
    },
    {
      "cmd": "kubectl wait --for=condition=Ready pod/resize-demo --timeout=120s",
      "output": "pod/resize-demo condition met"
    },
    {
      "cmd": "kubectl patch pod resize-demo --subresource resize --patch '{\"spec\":{\"containers\":[{\"name\":\"podinfo\",\"resources\":{\"requests\":{\"cpu\":\"300m\"},\"limits\":{\"cpu\":\"500m\"}}}]}}'",
      "output": "pod/resize-demo patched"
    },
    {
      "cmd": "kubectl wait --for=jsonpath='{.status.containerStatuses[0].resources.requests.cpu}'=300m pod/resize-demo --timeout=60s",
      "output": "pod/resize-demo condition met"
    },
    {
      "cmd": "kubectl get pod resize-demo -o jsonpath='{.status.containerStatuses[0].resources}{\"\\n\"}restarts: {.status.containerStatuses[0].restartCount}{\"\\n\"}'",
      "output": "{\"limits\":{\"cpu\":\"500m\",\"memory\":\"128Mi\"},\"requests\":{\"cpu\":\"300m\",\"memory\":\"64Mi\"}}\nrestarts: 0"
    },
    {
      "cmd": "kubectl patch pod resize-demo --subresource resize --patch '{\"spec\":{\"containers\":[{\"name\":\"podinfo\",\"resources\":{\"requests\":{\"memory\":\"128Mi\"},\"limits\":{\"memory\":\"256Mi\"}}}]}}'",
      "output": "pod/resize-demo patched"
    },
    {
      "cmd": "kubectl wait --for=jsonpath='{.status.containerStatuses[0].resources.requests.memory}'=128Mi pod/resize-demo --timeout=60s",
      "output": "pod/resize-demo condition met"
    },
    {
      "cmd": "kubectl get pod resize-demo -o jsonpath='{.status.containerStatuses[0].resources}{\"\\n\"}restarts: {.status.containerStatuses[0].restartCount}{\"\\n\"}'",
      "output": "{\"limits\":{\"cpu\":\"500m\",\"memory\":\"256Mi\"},\"requests\":{\"cpu\":\"300m\",\"memory\":\"128Mi\"}}\nrestarts: 1"
    }
  ]
}
```

The patch only changes the spec; the `kubectl wait` steps wait until the kubelet reports the new values in the pod's status. The CPU change applied with 0 restarts. The memory change restarted the container once, as its `RestartContainer` policy asked. A resize that no node could ever satisfy is rejected right away:

```terminal
{
  "title": "an impossible resize",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl patch pod resize-demo --subresource resize --patch '{\"spec\":{\"containers\":[{\"name\":\"podinfo\",\"resources\":{\"requests\":{\"cpu\":\"64\"},\"limits\":{\"cpu\":\"64\"}}}]}}'",
      "output": "Error from server (Forbidden): pods \"resize-demo\" is forbidden: node didn't have enough allocatable resources: cpu, requested: 64000, allocatable: 4000"
    },
    {
      "cmd": "kubectl delete pod resize-demo",
      "output": "pod \"resize-demo\" deleted from demo namespace"
    }
  ]
}
```

A resize that does fit the node but not its current free capacity stays pending, with a `PodResizePending` condition on the pod, until room frees up. Resizing pods that a Deployment owns works too, but the next rollout creates pods from the template again, so the Vertical Pod Autoscaler (below) is the usual way to use this for Deployments.

## LimitRanges and ResourceQuotas

A **LimitRange** sets per-container defaults and bounds in a namespace. A **ResourceQuota** caps the total of the whole namespace. Together they keep one team or one bad manifest from using a shared cluster up:

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: defaults
spec:
  limits:
    - type: Container
      defaultRequest: # used when a container sets no request
        cpu: 50m
        memory: 64Mi
      default: # used when a container sets no limit
        memory: 256Mi
      max: # reject containers that ask for more
        memory: 1Gi
```

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: demo-quota
spec:
  hard:
    requests.cpu: '2' # sum of all CPU requests in the namespace
    requests.memory: 2Gi
    limits.memory: 4Gi
    pods: '20'
    persistentvolumeclaims: '5'
    services.loadbalancers: '1'
```

The LimitRange has no CPU limit default and no CPU maximum on purpose: a `max` for a resource forces every container to set a limit for it, which would contradict the no-CPU-limit policy above.

```terminal
{
  "title": "defaults and quota",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 08-resources/limitrange.yaml -f 08-resources/resourcequota.yaml",
      "output": "limitrange/defaults created\nresourcequota/demo-quota created"
    },
    {
      "cmd": "kubectl run defaults --image=busybox:1.38.0 --restart=Never -- sleep 3600",
      "output": "pod/defaults created"
    },
    {
      "cmd": "kubectl get pod defaults -o jsonpath='{.spec.containers[0].resources}{\"\\n\"}'",
      "output": "{\"limits\":{\"memory\":\"256Mi\"},\"requests\":{\"cpu\":\"50m\",\"memory\":\"64Mi\"}}"
    },
    {
      "cmd": "kubectl describe resourcequota demo-quota",
      "output": "Name:                   demo-quota\nNamespace:              demo\nResource                Used   Hard\n--------                ----   ----\nlimits.memory           896Mi  4Gi\npersistentvolumeclaims  1      5\npods                    5      20\nrequests.cpu            400m   2\nrequests.memory         320Mi  2Gi\nservices.loadbalancers  0      1"
    }
  ]
}
```

The `defaults` pod set no resources, and the LimitRange filled them in. Because the quota limits `requests.cpu` and `limits.memory`, every new pod in the namespace must have those values, which the LimitRange guarantees.

Now ask for more replicas than the quota allows:

```terminal
{
  "title": "hitting the quota",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl scale deployment podinfo --replicas=25",
      "output": "deployment.apps/podinfo scaled"
    },
    {
      "cmd": "kubectl get deployment podinfo",
      "output": "NAME      READY   UP-TO-DATE   AVAILABLE   AGE\npodinfo   18/25   18           18          2m22s"
    },
    {
      "cmd": "kubectl get events --field-selector reason=FailedCreate | tail -n 2",
      "output": "19s         Warning   FailedCreate   replicaset/podinfo-75bb4bb8cc   Error creating: pods \"podinfo-75bb4bb8cc-btlh8\" is forbidden: exceeded quota: demo-quota, requested: pods=1, used: pods=20, limited: pods=20\n17s         Warning   FailedCreate   replicaset/podinfo-75bb4bb8cc   (combined from similar events): Error creating: pods \"podinfo-75bb4bb8cc-67pfm\" is forbidden: exceeded quota: demo-quota, requested: pods=1, used: pods=20, limited: pods=20"
    },
    {
      "cmd": "kubectl scale deployment podinfo --replicas=3",
      "output": "deployment.apps/podinfo scaled"
    },
    {
      "cmd": "kubectl delete pod defaults",
      "output": "pod \"defaults\" deleted from demo namespace"
    }
  ]
}
```

The Deployment stopped short of 25, and nothing failed loudly: `kubectl scale` succeeded, and the reason only shows up in the ReplicaSet's `FailedCreate` events. When pods are missing in a namespace with a quota, look there first.

## Horizontal Pod Autoscaling

The **HorizontalPodAutoscaler** (HPA, API `autoscaling/v2`) changes a workload's replica count to keep a metric near a target. With CPU, the target is a percentage of the pods' CPU **requests**, which is one more reason to set requests that reflect real use:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: podinfo
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: podinfo
  minReplicas: 3
  maxReplicas: 8
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60 # percent of the CPU request
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0
      tolerance: 0.05 # react to a 5 percent difference (the default is 10 percent)
    scaleDown:
      stabilizationWindowSeconds: 60 # the default is 300 seconds
      policies:
        - type: Pods
          value: 2 # remove at most two pods
          periodSeconds: 30 # every 30 seconds
```

`behavior` controls how fast it reacts. Scaling up right away and scaling down slowly, at most two pods every 30 seconds after a minute of low load, avoids flapping. `tolerance` per HPA has been on by default since Kubernetes 1.35 (beta) and is stable in 1.37; without it, the HPA uses the cluster-wide 10 percent dead band.

```terminal
{
  "title": "create the autoscaler",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 08-resources/hpa.yaml",
      "output": "horizontalpodautoscaler.autoscaling/podinfo created"
    },
    {
      "cmd": "kubectl get hpa podinfo",
      "output": "NAME      REFERENCE            TARGETS       MINPODS   MAXPODS   REPLICAS   AGE\npodinfo   Deployment/podinfo   cpu: 1%/60%   3         8         3          0s"
    }
  ]
}
```

For a one-off you can also run `kubectl autoscale deployment podinfo --min=3 --max=8 --cpu=60%`; the older `--cpu-percent` flag is deprecated.

Start a load generator. [fortio](https://github.com/fortio/fortio) sends requests from 16 connections as fast as it can for three minutes:

```bash
kubectl run loadgen --image=fortio/fortio:1.76.0 --restart=Never -- load -qps 0 -c 16 -t 3m -nocatchup http://podinfo/
```

```text
pod/loadgen created
```

Then watch the autoscaler. This run was stopped after seven minutes, enough for the load to end and the HPA to scale back down:

```bash
kubectl get hpa podinfo --watch
```

```text
NAME      REFERENCE            TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
podinfo   Deployment/podinfo   cpu: 1%/60%   3         8         3          0s
podinfo   Deployment/podinfo   cpu: 121%/60%   3         8         3          15s
podinfo   Deployment/podinfo   cpu: 810%/60%   3         8         7          30s
podinfo   Deployment/podinfo   cpu: 406%/60%   3         8         8          45s
podinfo   Deployment/podinfo   cpu: 368%/60%   3         8         8          60s
podinfo   Deployment/podinfo   cpu: 328%/60%   3         8         8          75s
podinfo   Deployment/podinfo   cpu: 332%/60%   3         8         8          90s
podinfo   Deployment/podinfo   cpu: 326%/60%   3         8         8          105s
podinfo   Deployment/podinfo   cpu: 329%/60%   3         8         8          2m
podinfo   Deployment/podinfo   cpu: 331%/60%   3         8         8          2m15s
podinfo   Deployment/podinfo   cpu: 333%/60%   3         8         8          2m30s
podinfo   Deployment/podinfo   cpu: 332%/60%   3         8         8          2m45s
podinfo   Deployment/podinfo   cpu: 293%/60%   3         8         8          3m15s
podinfo   Deployment/podinfo   cpu: 148%/60%   3         8         8          3m30s
podinfo   Deployment/podinfo   cpu: 1%/60%     3         8         8          3m45s
podinfo   Deployment/podinfo   cpu: 1%/60%     3         8         8          4m30s
podinfo   Deployment/podinfo   cpu: 1%/60%     3         8         6          4m45s
podinfo   Deployment/podinfo   cpu: 1%/60%     3         8         6          5m
podinfo   Deployment/podinfo   cpu: 1%/60%     3         8         4          5m15s
podinfo   Deployment/podinfo   cpu: 1%/60%     3         8         4          5m30s
podinfo   Deployment/podinfo   cpu: 1%/60%     3         8         3          5m45s
```

Within a minute of the load starting, CPU use passed 600 percent of the requests, and the HPA went from 3 to 7 replicas and then to its maximum of 8. When fortio stopped after three minutes, CPU dropped to 1 percent, and about a minute later the HPA started removing pods, never more than two in 30 seconds, until it was back at 3. The HPA's events record each decision:

```terminal
{
  "title": "what the HPA did",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl describe hpa podinfo | sed -n '/^Events:/,$p'",
      "output": "Events:\n  Type    Reason             Age    From                       Message\n  ----    ------             ----   ----                       -------\n  Normal  SuccessfulRescale  6m45s  horizontal-pod-autoscaler  New size: 7; reason: cpu resource utilization (percentage of request) above target\n  Normal  SuccessfulRescale  6m30s  horizontal-pod-autoscaler  New size: 8; reason: cpu resource utilization (percentage of request) above target\n  Normal  SuccessfulRescale  2m30s  horizontal-pod-autoscaler  New size: 6; reason: All metrics below target\n  Normal  SuccessfulRescale  2m     horizontal-pod-autoscaler  New size: 4; reason: All metrics below target\n  Normal  SuccessfulRescale  90s    horizontal-pod-autoscaler  New size: 3; reason: All metrics below target"
    },
    {
      "cmd": "kubectl logs loadgen | tail -n 4",
      "output": "Code 200 : 7508559 (100.0 %)\nResponse Header Sizes : count 7508559 avg 157 +/- 0 min 157 max 157 sum 1.17884376e+09\nResponse Body/Total Sizes : count 7508559 avg 544 +/- 0 min 544 max 544 sum 4.0846561e+09\nAll done 7508559 calls (plus 16 warmup) 0.383 ms avg, 41714.0 qps"
    },
    {
      "cmd": "kubectl delete pod loadgen",
      "output": "pod \"loadgen\" deleted from demo namespace"
    }
  ]
}
```

fortio's summary shows the load the HPA reacted to: every request succeeded, at an average of under a millisecond. CPU is a good first metric. Queue workers scale better on queue length, and HTTP services on requests per second; those need a custom or external metrics adapter, such as the Prometheus Adapter or [KEDA](https://keda.sh/). Since Kubernetes 1.37, an HPA with object or external metrics can also scale a workload to zero (beta, on by default).

## Vertical and Cluster Autoscaling

- The **Vertical Pod Autoscaler** (VPA, a separate project) recommends requests from real usage and can apply them. VPA 1.8 supports `Off` (recommendations only), `Initial`, `Recreate` and `InPlaceOrRecreate`, which uses in-place resize; `Auto` is deprecated. Do not let the VPA and an HPA act on the same metric. An example that only manages memory, leaving CPU to the HPA:

```yaml
# Needs the Vertical Pod Autoscaler (kubernetes/autoscaler, vertical-pod-autoscaler 1.8)
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: podinfo
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: podinfo
  updatePolicy:
    updateMode: 'Off' # recommendations only; InPlaceOrRecreate applies them
  resourcePolicy:
    containerPolicies:
      - containerName: podinfo
        controlledResources: ['memory'] # leave CPU to the HPA
        minAllowed:
          memory: 64Mi
        maxAllowed:
          memory: 512Mi
```

- The **Cluster Autoscaler** or **Karpenter** add nodes when pods cannot be scheduled for lack of capacity, and remove nodes that stay underused. They react to pending pods and requests, not to CPU usage, so again: set requests. On managed services you turn this on per node pool. On DigitalOcean Kubernetes, for example, this lets the node pool from Part 2 grow to five nodes (the new nodes are billed Droplets; if you sign up through our [referral link](https://m.do.co/c/2a9bba940f39), see [Part 2](/guides/introduction-to-kubernetes/02-setting-up-a-kubernetes-cluster#h2-managed-kubernetes) for the credit terms):

```bash
doctl kubernetes cluster node-pool update k8s-guide workers --auto-scale --min-nodes 2 --max-nodes 5
```

## Scheduling: Where Pods Run

The scheduler places a pod on a node that has room for its requests and meets its constraints. You influence it with:

- **`nodeSelector` and node affinity**: run only on nodes with certain labels (`disktype=ssd`, a zone, an instance type). `required...` rules are hard, `preferred...` rules are hints.
- **Taints and tolerations**: a taint on a node keeps away every pod that does not tolerate it. Use it to reserve nodes for special work such as GPUs or batch jobs. Control plane nodes carry a taint, which is why your pods never run there.
- **Pod affinity and anti-affinity**: run near, or away from, pods with certain labels.
- **Topology spread constraints**: spread replicas evenly over nodes or zones. The Part 8 Deployment uses one with `whenUnsatisfiable: ScheduleAnyway`, a preference rather than a hard rule.
- **PriorityClasses**: let important pods preempt less important ones when the cluster is full.

### Taints and Tolerations

Reserve one worker for batch work. To set up the drain at the end of this part, pick the worker that does **not** hold the cache's volume from Part 7 as the batch node:

```bash
NODE=$(kubectl get pod cache-0 -o jsonpath='{.spec.nodeName}')
if [ "$NODE" = k8s-guide-worker ]; then OTHER=k8s-guide-worker2; else OTHER=k8s-guide-worker; fi
echo "cache-0 runs on $NODE, the batch node is $OTHER"
```

```text
cache-0 runs on k8s-guide-worker2, the batch node is k8s-guide-worker
```

Taint and label the batch node, and restart podinfo so the scheduler places its pods again:

```terminal
{
  "title": "a dedicated node",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl taint nodes $OTHER dedicated=batch:NoSchedule",
      "output": "node/k8s-guide-worker tainted"
    },
    {
      "cmd": "kubectl label nodes $OTHER workload=batch",
      "output": "node/k8s-guide-worker labeled"
    },
    {
      "cmd": "kubectl rollout restart deployment/podinfo",
      "output": "deployment.apps/podinfo restarted"
    },
    {
      "cmd": "kubectl rollout status deployment/podinfo"
    },
    {
      "cmd": "kubectl get pods -o wide",
      "output": "NAME                      READY   STATUS    RESTARTS   AGE     IP            NODE                NOMINATED NODE   READINESS GATES\ncache-0                   1/1     Running   0          9m31s   10.244.1.7    k8s-guide-worker2   <none>           <none>\npodinfo-b5cb996d5-jgrsp   1/1     Running   0          9s      10.244.1.23   k8s-guide-worker2   <none>           <none>\npodinfo-b5cb996d5-p5v4x   1/1     Running   0          14s     10.244.1.22   k8s-guide-worker2   <none>           <none>\npodinfo-b5cb996d5-zdlwx   1/1     Running   0          20s     10.244.1.21   k8s-guide-worker2   <none>           <none>"
    }
  ]
}
```

All podinfo pods now run on `$NODE`, next to `cache-0`, even though the spread constraint prefers two nodes: a taint is a hard rule, a `ScheduleAnyway` spread only a preference. Pods that were already running on a node when it was tainted stay there, because `NoSchedule` only affects new placements (`NoExecute` would evict them). A pod that tolerates the taint and requires the label lands on the batch node:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: batch-task
spec:
  # Allowed onto nodes with the dedicated=batch:NoSchedule taint ...
  tolerations:
    - key: dedicated
      operator: Equal
      value: batch
      effect: NoSchedule
  # ... and required to run on a node labeled workload=batch
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: workload
                operator: In
                values: ['batch']
  containers:
    - name: task
      image: busybox:1.38.0
      command: ['sleep', '3600']
```

```terminal
{
  "title": "a batch pod on the batch node",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 08-resources/batch-pod.yaml",
      "output": "pod/batch-task created"
    },
    {
      "cmd": "kubectl get pod batch-task -o jsonpath='{.spec.nodeName}{\"\\n\"}'",
      "output": "k8s-guide-worker"
    },
    {
      "cmd": "kubectl taint nodes $OTHER dedicated=batch:NoSchedule-",
      "output": "node/k8s-guide-worker untainted"
    },
    {
      "cmd": "kubectl delete pod batch-task",
      "output": "pod \"batch-task\" deleted from demo namespace"
    }
  ]
}
```

The toleration alone only allows the pod onto the tainted node; the node affinity is what sends it there. You need both to dedicate nodes. The trailing `-` removes the taint again. The podinfo pods stay where they are until something moves them, which is what the next step does.

### Drain a Node Safely

Before node maintenance or an upgrade, you **drain** the node: kubectl cordons it (no new pods) and evicts its pods, which their controllers recreate elsewhere. A **PodDisruptionBudget** (PDB) limits how many pods of an app such voluntary evictions may take down at once:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: podinfo
spec:
  minAvailable: 2 # voluntary evictions must leave at least two ready pods
  selector:
    matchLabels:
      app: podinfo
  # Pods that are not ready can be evicted anyway, so they cannot block a drain
  unhealthyPodEvictionPolicy: AlwaysAllow
```

`$NODE` now runs all three podinfo pods and the cache. Drain it:

```terminal
{
  "title": "drain a node",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 08-resources/pdb.yaml",
      "output": "poddisruptionbudget.policy/podinfo created"
    },
    {
      "cmd": "kubectl get pdb podinfo",
      "output": "NAME      MIN AVAILABLE   MAX UNAVAILABLE   ALLOWED DISRUPTIONS   AGE\npodinfo   2               N/A               1                     0s"
    },
    {
      "cmd": "kubectl drain $NODE --ignore-daemonsets --delete-emptydir-data --timeout=180s",
      "output": "node/k8s-guide-worker2 cordoned\nWarning: ignoring DaemonSet-managed Pods: kube-system/kindnet-kqpzs, kube-system/kube-proxy-hkcv2\nevicting pod kube-system/metrics-server-84c99cb944-2sxnt\nevicting pod demo/podinfo-b5cb996d5-jgrsp\nevicting pod demo/cache-0\nevicting pod demo/podinfo-b5cb996d5-p5v4x\nevicting pod demo/podinfo-b5cb996d5-zdlwx\nerror when evicting pods/\"podinfo-b5cb996d5-p5v4x\" -n \"demo\" (will retry after 5s): Cannot evict pod as it would violate the pod's disruption budget.\nerror when evicting pods/\"podinfo-b5cb996d5-zdlwx\" -n \"demo\" (will retry after 5s): Cannot evict pod as it would violate the pod's disruption budget.\npod/cache-0 evicted\npod/metrics-server-84c99cb944-2sxnt evicted\npod/podinfo-b5cb996d5-jgrsp evicted\nevicting pod demo/podinfo-b5cb996d5-p5v4x\nevicting pod demo/podinfo-b5cb996d5-zdlwx\nerror when evicting pods/\"podinfo-b5cb996d5-zdlwx\" -n \"demo\" (will retry after 5s): Cannot evict pod as it would violate the pod's disruption budget.\npod/podinfo-b5cb996d5-p5v4x evicted\nevicting pod demo/podinfo-b5cb996d5-zdlwx\npod/podinfo-b5cb996d5-zdlwx evicted\nnode/k8s-guide-worker2 drained"
    },
    {
      "cmd": "kubectl get pods -o wide",
      "output": "NAME                      READY   STATUS    RESTARTS   AGE   IP            NODE               NOMINATED NODE   READINESS GATES\ncache-0                   0/1     Pending   0          24s   <none>        <none>             <none>           <none>\npodinfo-b5cb996d5-d2pv6   1/1     Running   0          19s   10.244.2.27   k8s-guide-worker   <none>           <none>\npodinfo-b5cb996d5-qgssd   1/1     Running   0          14s   10.244.2.28   k8s-guide-worker   <none>           <none>\npodinfo-b5cb996d5-qnsp8   1/1     Running   0          24s   10.244.2.26   k8s-guide-worker   <none>           <none>"
    }
  ]
}
```

Read the drain output. The PDB allowed one podinfo eviction at a time and refused the others ("Cannot evict pod as it would violate the pod's disruption budget") until each replacement was ready on the other node. kubectl retried every 5 seconds, and the app never dropped below two ready pods.

The cache did not come back, though. `cache-0` is `Pending`:

```terminal
{
  "title": "a pod bound to its node",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl events --for pod/cache-0 --types=Warning",
      "output": "LAST SEEN           TYPE      REASON             OBJECT        MESSAGE\n24s (x2 over 24s)   Warning   FailedScheduling   Pod/cache-0   0/3 nodes are available: 1 node(s) didn't match PersistentVolume's node affinity, 1 node(s) had untolerated taint(s), 1 node(s) were unschedulable. preemption: 0/3 nodes are available: 3 Preemption is not helpful for scheduling."
    },
    {
      "cmd": "kubectl uncordon $NODE",
      "output": "node/k8s-guide-worker2 uncordoned"
    },
    {
      "cmd": "kubectl wait --for=condition=Ready pod/cache-0 --timeout=180s",
      "output": "pod/cache-0 condition met"
    }
  ]
}
```

Its PersistentVolume is a directory on the drained node (`didn't match PersistentVolume's node affinity`), and that node is cordoned (`were unschedulable`), so there is nowhere it may run. After `kubectl uncordon`, it starts again with its data. With network storage such as a cloud disk, the volume would follow the pod to another node in the same zone. This is the real cost of node-local storage, and the reason stateful apps need replicas, PDBs and storage that can move.

## Common Mistakes

- **No requests.** The scheduler then packs pods onto nodes as if they used nothing, and the HPA cannot compute a CPU percentage at all.
- **Memory limits far above requests.** Many pods can then burst at once and push the node into memory pressure; keep them close, or equal.
- **Tight CPU limits on latency-sensitive apps.** The CPU throttling shows up as slow responses, not errors.
- **Requests from guesses.** Measure with `kubectl top`, Prometheus or the VPA's recommendations, and adjust.
- **No PDB on apps with several replicas.** A node drain can then take all of them down at once. And no PDB with `minAvailable` equal to the replica count: that blocks drains forever.

## Summary

- Requests drive scheduling and HPA percentages; memory limits cause OOMKills, CPU limits cause throttling.
- Under memory pressure the kubelet evicts pods that use more than they requested first, then weighs priority; QoS classes follow from requests and limits, and `Burstable` with a memory limit fits most apps.
- In-place resize (stable since 1.35) changes a running pod's resources, with or without a restart per `resizePolicy`.
- LimitRanges fill in defaults, ResourceQuotas cap namespaces, and quota failures show up as `FailedCreate` events.
- The HPA scales replicas on metrics; the VPA sizes requests; the Cluster Autoscaler or Karpenter adds nodes.
- Taints, affinity and spread constraints steer the scheduler; PDBs keep drains safe; node-local volumes pin pods to nodes.

## Keep Learning

- [Right-sizing Kubernetes resources with VPA and Karpenter](/posts/right-sizing-kubernetes-resources-vpa-karpenter)
- [Checking pod CPU and memory utilization](/posts/checking-kubernetes-pod-cpu-and-memory-utilization)
- [Kubernetes HPA lab](/exercises/kubernetes-hpa-lab)
- [Kubernetes scheduler simulator](/games/k8s-scheduler)

Next, in [Part 9](/guides/introduction-to-kubernetes/09-monitoring-and-logging-in-kubernetes), you debug broken workloads and set up metrics and alerts.
