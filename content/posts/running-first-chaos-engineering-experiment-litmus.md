---
title: 'Running Your First Chaos Engineering Experiment with Litmus'
excerpt: 'A hands-on walkthrough of installing LitmusChaos on Kubernetes, killing pods on purpose, and watching whether your app actually recovers. Real YAML, real output, no theory.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-05-18'
publishedAt: '2026-05-18T09:00:00Z'
updatedAt: '2026-05-18T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - chaos-engineering
  - litmus
  - kubernetes
  - resilience
  - sre
---

Your deployment has three replicas. Your readiness probe is set. Your HPA is configured. On paper, you can lose a pod and nothing should happen. But you have never actually tested it, because the only time pods die in production is at 3am, and by then it is too late to find out the readiness probe was checking the wrong port.

That is the gap chaos engineering fills. You break things on purpose during business hours, with a hypothesis and a stop button, and you learn what actually happens before a node failure or a kernel OOM teaches you the hard way.

This post walks through running your first experiment with LitmusChaos: install it, target a real deployment, kill a pod, and watch whether the system recovers like you expect.

## TL;DR

Install Litmus with Helm, label your target deployment, apply a `ChaosExperiment` and `ChaosEngine` for `pod-delete`, and watch the `ChaosResult` to see if your app passed. The whole loop takes about 20 minutes on a fresh cluster.

## Prerequisites

- A Kubernetes cluster you do not mind poking. A local `kind` or `minikube` cluster is fine for the first run.
- `kubectl` configured and pointing at that cluster.
- Helm 3.x installed.
- A workload to break. The post uses `nginx` with three replicas, but any Deployment will do.

If you do not have a cluster handy, spin one up with `kind`:

```bash
kind create cluster --name chaos-lab
kubectl cluster-info --context kind-chaos-lab
```

## What Litmus Actually Is

Litmus is a Kubernetes-native chaos platform. You write experiments as YAML, apply them with `kubectl`, and Litmus runs a chaos runner pod that injects the failure (kill a pod, hog CPU, drop network packets) against a target you select with labels.

Three resources matter:

- **ChaosExperiment**: the definition of the fault. What to inject, with what defaults. Think of it as a function.
- **ChaosEngine**: the invocation. Which experiment, against which target, with what arguments. This is the thing you apply when you want chaos to start.
- **ChaosResult**: the verdict. Pass or fail, written by Litmus after the experiment runs.

You install the platform once. You ship experiments per fault type. You apply engines per drill.

## Install Litmus

Add the Helm repo and install the control plane into its own namespace:

```bash
kubectl create namespace litmus

helm repo add litmuschaos https://litmuschaos.github.io/litmus-helm/
helm repo update

helm install chaos litmuschaos/litmus \
  --namespace=litmus \
  --set portal.frontend.service.type=ClusterIP
```

Wait for the pods to come up:

```bash
kubectl -n litmus get pods
```

You should see something like this:

```text
NAME                                     READY   STATUS    RESTARTS   AGE
chaos-litmus-frontend-7c8f6b9c4d-x2k8m   1/1     Running   0          2m
chaos-litmus-server-6b5d4f8c9-pq7nz      1/1     Running   0          2m
chaos-mongo-0                            1/1     Running   0          2m
```

The control plane is the optional ChaosCenter UI. The actual experiment runner is the chaos operator, which you install next.

## Install the Chaos Operator and Experiments

The operator watches for `ChaosEngine` resources and runs them. The experiment catalog ships separately so you can pick the faults you want.

```bash
kubectl apply -f https://litmuschaos.github.io/litmus/3.0.0/litmus-k8s-3.0.0.yaml
```

Check that the operator is healthy:

```bash
kubectl -n litmus get pods -l app.kubernetes.io/component=operator
```

Then load the generic experiment pack (pod-delete, container-kill, pod-cpu-hog, pod-memory-hog, and more) into the namespace where your target lives. For this walkthrough, that namespace is `default`:

```bash
kubectl apply -f https://hub.litmuschaos.io/api/chaos/3.0.0?file=charts/generic/experiments.yaml -n default
```

Verify the experiments are registered:

```bash
kubectl get chaosexperiments -n default
```

```text
NAME                AGE
pod-delete          12s
container-kill      12s
pod-cpu-hog         12s
pod-memory-hog      12s
pod-network-loss    12s
```

## Deploy Something to Break

If you do not already have a target, deploy a small nginx with three replicas:

```bash
kubectl create deployment web --image=nginx:1.27 --replicas=3
kubectl expose deployment web --port=80
kubectl label deployment web app=web
```

Confirm the pods are running:

```bash
kubectl get pods -l app=web
```

```text
NAME                   READY   STATUS    RESTARTS   AGE
web-6c8b9d7f4-2lhmn    1/1     Running   0          30s
web-6c8b9d7f4-7gxqp    1/1     Running   0          30s
web-6c8b9d7f4-rk9vx    1/1     Running   0          30s
```

## Give Litmus Permission to Cause Chaos

Litmus runs experiments under a ServiceAccount with a tightly scoped Role. Without it, the experiment pod cannot touch your workload. Apply this RBAC into the `default` namespace:

```yaml
# litmus-rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: pod-delete-sa
  namespace: default
  labels:
    name: pod-delete-sa
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-delete-sa
  namespace: default
  labels:
    name: pod-delete-sa
rules:
  - apiGroups: [""]
    resources: ["pods", "events"]
    verbs: ["create", "list", "get", "patch", "update", "delete", "deletecollection"]
  - apiGroups: [""]
    resources: ["pods/log", "replicationcontrollers", "configmaps", "services"]
    verbs: ["get", "list"]
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets", "daemonsets", "replicasets"]
    verbs: ["list", "get"]
  - apiGroups: ["litmuschaos.io"]
    resources: ["chaosengines", "chaosexperiments", "chaosresults"]
    verbs: ["create", "list", "get", "patch", "update", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pod-delete-sa
  namespace: default
  labels:
    name: pod-delete-sa
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: pod-delete-sa
subjects:
  - kind: ServiceAccount
    name: pod-delete-sa
    namespace: default
```

```bash
kubectl apply -f litmus-rbac.yaml
```

## Write the Experiment

Time for the actual fault. This `ChaosEngine` targets the `web` deployment, picks one pod at random every 10 seconds for 30 seconds total, and kills it. The deployment controller should immediately create replacements.

```yaml
# pod-delete-engine.yaml
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: web-pod-delete
  namespace: default
spec:
  appinfo:
    appns: default
    applabel: 'app=web'
    appkind: 'deployment'
  chaosServiceAccount: pod-delete-sa
  engineState: 'active'
  experiments:
    - name: pod-delete
      spec:
        components:
          env:
            - name: TOTAL_CHAOS_DURATION
              value: '30'
            - name: CHAOS_INTERVAL
              value: '10'
            - name: FORCE
              value: 'false'
            - name: PODS_AFFECTED_PERC
              value: '33'
```

A few things worth flagging:

- `applabel` is how Litmus picks targets. Anything matching `app=web` in the `default` namespace is fair game.
- `PODS_AFFECTED_PERC: '33'` means one pod out of three each round. Start small.
- `FORCE: 'false'` uses a graceful delete with the pod's terminationGracePeriod. Flip to `true` to simulate a kernel kill, which is the more honest test.
- `engineState: active` starts the experiment immediately on apply. Set it to `stop` to bail out.

Apply it:

```bash
kubectl apply -f pod-delete-engine.yaml
```

## Watch It Run

Open three terminals. In the first, watch your app:

```bash
kubectl get pods -l app=web -w
```

You should see pods being terminated and new ones starting:

```text
web-6c8b9d7f4-2lhmn    1/1     Terminating   0     2m
web-6c8b9d7f4-zk4tx    0/1     Pending       0     0s
web-6c8b9d7f4-zk4tx    0/1     ContainerCreating  0  1s
web-6c8b9d7f4-zk4tx    1/1     Running       0     3s
```

In the second, watch the Litmus runner pod:

```bash
kubectl -n default get pods -l name=web-pod-delete-runner -w
```

In the third, hammer the service so you can see if traffic ever fails:

```bash
kubectl run curl-loop --image=curlimages/curl --restart=Never -- \
  sh -c 'while true; do curl -s -o /dev/null -w "%{http_code}\n" http://web; sleep 0.5; done'

kubectl logs -f curl-loop
```

If your readiness probe and service are wired up correctly, you see a stream of `200`s. If you see `000` or `503` in there, that is a finding. Either readiness is lying about pod health, or your replica count is too low to absorb a single failure.

## Read the Verdict

When the runner pod finishes, look at the result:

```bash
kubectl get chaosresult web-pod-delete-pod-delete -n default -o yaml
```

The interesting bit:

```yaml
status:
  experimentStatus:
    phase: Completed
    verdict: Pass
    failStep: 'N/A'
  probeStatus: []
```

`Pass` means Litmus killed pods and the deployment kept the target replica count up through the run. `Fail` means a probe tripped (more on probes below) or the experiment could not target anything.

For the full story, check the events the runner emitted:

```bash
kubectl describe chaosresult web-pod-delete-pod-delete -n default
```

## Make It Real With Probes

A `Pass` from `pod-delete` alone just means pods came back. It does not mean your users got served. Probes turn the experiment into a real SLO check. Litmus runs them during the chaos window and fails the result if the probe fails.

Add an `httpProbe` to the engine that hits the service every two seconds and expects a 200:

```yaml
experiments:
  - name: pod-delete
    spec:
      probe:
        - name: web-availability
          type: httpProbe
          mode: Continuous
          runProperties:
            probeTimeout: 2
            interval: 2
            retry: 1
            stopOnFailure: false
          httpProbe/inputs:
            url: http://web.default.svc.cluster.local
            insecureSkipVerify: false
            method:
              get:
                criteria: ==
                responseCode: '200'
      components:
        env:
          - name: TOTAL_CHAOS_DURATION
            value: '30'
```

Re-apply. Now if even one HTTP check fails during the 30-second chaos window, the verdict flips to `Fail`. That is the signal you actually want: not "pods recovered" but "users were served the whole time."

## What To Try Next

Once `pod-delete` passes with a probe, you have a working chaos loop. Use it. A short menu to work through, in roughly increasing pain:

1. **container-kill**: kill only the app container without taking the pod down. Surfaces broken restart logic and exposes anything that initializes only on pod start.
2. **pod-cpu-hog** and **pod-memory-hog**: pin a pod's resources. Validates that HPA reacts and that your requests/limits are not lying.
3. **pod-network-loss**: drop a percentage of packets between the target and the world. Excellent for finding retry storms and absent timeouts.
4. **node-drain**: cordon and drain a node out from under the workload. The honest test of PodDisruptionBudgets.

Two operational habits to build alongside the experiments:

- **Always set `engineState`, not just delete-on-cleanup.** Patching the engine to `stop` is the kill switch. Keep that command in your runbook so the on-call can stop chaos in one line if something goes sideways: `kubectl patch chaosengine web-pod-delete -n default --type merge -p '{"spec":{"engineState":"stop"}}'`.
- **Start in a non-prod cluster, then move to prod with a `PODS_AFFECTED_PERC` of 10 and a probe**. Prod chaos without a probe is sabotage. Prod chaos with a probe is testing.

Chaos engineering stops being scary the moment you have run the loop once. Pick one deployment this week, run `pod-delete` against it with an `httpProbe`, and find out whether your readiness probe was lying to you.
