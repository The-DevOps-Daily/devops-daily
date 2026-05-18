---
title: 'Istio Traffic Management: Routing, Retries, and Circuit Breaking'
excerpt: "Configure weighted routing, automatic retries, and circuit breakers in Istio with copy-paste YAML examples and real kubectl output you can verify on your own cluster."
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-05-04'
publishedAt: '2026-05-04T09:00:00Z'
updatedAt: '2026-05-04T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Istio
  - service-mesh
  - traffic-management
  - Kubernetes
  - Networking
  - DevOps
---

## TLDR

Istio gives you three traffic controls every production service needs: weighted routing for safe rollouts, retries for handling flaky downstream calls, and circuit breakers to stop cascading failures. You configure them with `VirtualService` and `DestinationRule` objects. This post walks through each one with working YAML, real terminal output, and the gotchas that bite people in production.

You shipped a new version of your `payments` service. Half the traffic now hits v2, and v2 is timing out against a slow downstream API. Within ninety seconds your `checkout` service is also degraded because every request is waiting on payments. By the time you roll back, three more services are slow and your error budget is gone for the quarter.

This is the failure pattern Istio is built to prevent. Not the deploy itself, but the blast radius. With a few lines of YAML you can shift traffic gradually, retry transient failures without writing retry code in every service, and trip a circuit breaker so a sick instance gets isolated instead of dragging down its callers.

## Prerequisites

- A Kubernetes cluster with Istio 1.20+ installed (`istioctl version` should return both client and control plane versions)
- The `istio-injection=enabled` label on the namespace you are working in
- `kubectl` access and basic familiarity with `apply`, `get`, and `describe`
- Two or more versions of a sample service deployed (this post uses the standard `httpbin` and a custom `reviews` example)

You can check injection is on with:

```bash
kubectl get namespace default --show-labels
```

Output should include `istio-injection=enabled`. If it doesn't, label it:

```bash
kubectl label namespace default istio-injection=enabled
```

## The Two Objects You Need to Know

Istio's traffic policies live in two CRDs:

- **VirtualService** — defines *how* requests are routed. Match on host, path, header, weight.
- **DestinationRule** — defines *what happens after* the route is picked. Subsets, load balancing, connection pools, outlier detection.

A common mistake is putting circuit breaker settings in a VirtualService. They don't belong there. Circuit breakers are a property of the destination, not the route.

```text
Client → VirtualService (routing decision) → DestinationRule (subset + policy) → Pod
```

Keep this mental model. It saves a lot of debugging.

## Weighted Routing for Canary Deploys

Say you have two deployments of `reviews`: v1 (stable) and v2 (new). You want 90% of traffic on v1 and 10% on v2 to start.

First, define the subsets in a DestinationRule. Subsets are how Istio knows what "v1" and "v2" mean.

```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
  subsets:
    - name: v1
      labels:
        version: v1
    - name: v2
      labels:
        version: v2
```

The `labels` field matches pod labels. So your `reviews-v1` deployment needs `version: v1` on its pod template, and `reviews-v2` needs `version: v2`. If the labels don't match, the subset routes to zero pods and you get 503s.

Now the VirtualService that splits traffic:

```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - route:
        - destination:
            host: reviews
            subset: v1
          weight: 90
        - destination:
            host: reviews
            subset: v2
          weight: 10
```

Apply both, then verify the routing:

```bash
kubectl apply -f reviews-destinationrule.yaml
kubectl apply -f reviews-virtualservice.yaml

for i in {1..20}; do
  kubectl exec deploy/curl -- curl -s reviews:9080/version
done | sort | uniq -c
```

Expected output for a 90/10 split over 20 requests:

```text
     18 v1
      2 v2
```

The split is statistical, not exact. Don't expect 9 out of 10 every single time. Over a few thousand requests it converges.

To shift to 50/50, just edit the weights and re-apply. No pod restarts. No DNS changes. The Envoy sidecars pick up the new config in a few seconds.

### Routing by Header

Weighted splits are great for percentage rollouts. But sometimes you want only specific users (your QA team, your own account) to hit v2. Match on a header:

```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - match:
        - headers:
            x-user-tier:
              exact: internal
      route:
        - destination:
            host: reviews
            subset: v2
    - route:
        - destination:
            host: reviews
            subset: v1
```

The order matters. Istio evaluates rules top to bottom and uses the first match. Put the specific header rule first; the catch-all default goes last.

## Retries: Stop Writing Retry Code in Every Service

Every team writes the same broken retry loop. Three retries, fixed backoff, no jitter, retries on POST, retries on 4xx errors. Then the downstream service has a brief blip and gets hit with a thundering herd.

Push retries into Istio. One config, applied to every call out of the mesh, with backoff and proper status code matching.

```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - route:
        - destination:
            host: reviews
            subset: v1
      retries:
        attempts: 3
        perTryTimeout: 2s
        retryOn: gateway-error,connect-failure,refused-stream
```

Some details that matter:

- `attempts: 3` is the number of *retries*, not total tries. So up to 4 requests in the worst case.
- `perTryTimeout` is per attempt. Total time can be `attempts * perTryTimeout` plus backoff.
- `retryOn` controls which failures trigger a retry. The default includes some surprises. Be explicit.

The values you almost always want in `retryOn`:

- `gateway-error` — 502, 503, 504
- `connect-failure` — TCP connect failed
- `refused-stream` — HTTP/2 stream was refused (usually from overload)

Things you almost never want to retry:

- 4xx client errors (except 429)
- POST/PUT/DELETE without idempotency keys

To test retries are firing, point your VirtualService at `httpbin` and force a 503:

```bash
kubectl exec deploy/curl -- curl -s -o /dev/null -w "%{http_code}\n" \
  httpbin:8000/status/503
```

Then check the upstream stats from the sidecar:

```bash
kubectl exec deploy/curl -c istio-proxy -- \
  pilot-agent request GET stats | grep retry
```

You should see counters like:

```text
cluster.outbound|8000||httpbin.default.svc.cluster.local.upstream_rq_retry: 3
cluster.outbound|8000||httpbin.default.svc.cluster.local.upstream_rq_retry_success: 0
```

Three retries fired, zero succeeded. That tells you retries are configured correctly even though the test endpoint always fails.

### A Word on Retry Budgets

Retries multiply load. If your service does 1000 RPS and every call retries 3 times on failure, a 50% failure rate means 2500 RPS hitting the downstream. That's how outages get worse instead of better.

Istio doesn't have a global retry budget like Linkerd does. The mitigation is: keep `attempts` low (2 or 3, not 10), use `perTryTimeout` aggressively, and pair retries with circuit breaking so a sick host gets ejected before retries hammer it.

## Circuit Breaking with Outlier Detection

Circuit breaking in Istio is two things working together: connection pool limits and outlier detection. The pool limits cap how many requests you'll send. Outlier detection ejects misbehaving hosts.

Here's a realistic config for a backend service:

```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: payments
spec:
  host: payments
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http2MaxRequests: 1000
        maxRequestsPerConnection: 10
        maxRetries: 3
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
```

What this does:

- **maxConnections / http2MaxRequests** — caps the in-flight request count. Once exceeded, new requests fail fast with a 503. This is the actual "circuit" being broken.
- **consecutive5xxErrors: 5** — a host that returns five 5xx responses in a row gets ejected.
- **interval: 30s** — how often Istio scans for unhealthy hosts.
- **baseEjectionTime: 30s** — how long the host stays ejected. Doubles on repeat offenses.
- **maxEjectionPercent: 50** — never eject more than half the hosts. Otherwise you can take the whole pool offline and have nothing left to serve traffic.

That last one is the safety valve. Without it, a regional outage of a downstream dependency can cause Istio to eject every backend pod, leaving you with zero capacity even when the dependency recovers.

To see ejections happening, watch the sidecar stats:

```bash
kubectl exec deploy/curl -c istio-proxy -- \
  pilot-agent request GET clusters | grep payments | grep ejected
```

When a pod gets ejected you'll see something like:

```text
outbound|8080||payments.default.svc.cluster.local::10.244.1.42:8080::cx_active::0
outbound|8080||payments.default.svc.cluster.local::10.244.1.42:8080::ejected::true
```

That `ejected::true` line is what you want to see when a backend is misbehaving. Traffic stops going to it. Other healthy pods absorb the load. The pod gets re-checked after `baseEjectionTime`.

## Combining Them: A Realistic Production Config

Here's what the full setup looks like for a service that does canary deploys, retries on transient errors, and trips a breaker on bad hosts.

```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: payments
spec:
  host: payments
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http2MaxRequests: 500
        maxRequestsPerConnection: 10
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
  subsets:
    - name: v1
      labels:
        version: v1
    - name: v2
      labels:
        version: v2
---
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: payments
spec:
  hosts:
    - payments
  http:
    - route:
        - destination:
            host: payments
            subset: v1
          weight: 95
        - destination:
            host: payments
            subset: v2
          weight: 5
      retries:
        attempts: 2
        perTryTimeout: 3s
        retryOn: gateway-error,connect-failure,refused-stream
      timeout: 10s
```

Note the top-level `timeout: 10s`. That's the total timeout for the whole request including all retries. Without it, a service hitting `perTryTimeout` and retrying twice could hold a connection open for 9+ seconds, which is usually worse than just failing fast.

## Debugging When Things Don't Work

The single most useful command when an Istio policy isn't behaving:

```bash
istioctl proxy-config route deploy/curl -o json | less
```

This shows you the actual route config Envoy is using, not what you think it is. If your VirtualService isn't taking effect, the route here will not match what you wrote.

Other commands worth knowing:

```bash
istioctl analyze
istioctl proxy-config cluster deploy/curl
istioctl proxy-config endpoints deploy/curl
```

`istioctl analyze` catches the obvious mistakes: subset references with no matching pods, conflicting VirtualServices, missing namespaces. Run it before you `kubectl apply`.

If a VirtualService just won't apply, check for naming conflicts. Two VirtualServices targeting the same host in the same namespace will fight, and Istio picks one in an order you cannot predict.

## Next Steps

- Add `istioctl analyze` to your CI pipeline so bad mesh configs fail before merge
- Set up a Grafana dashboard with the standard Istio mesh dashboard JSON to see retry and ejection rates per service
- Pick one production service this week and add a DestinationRule with `outlierDetection`. Even without changing routes, this alone catches a class of failures you currently miss
- For canary work, look at Flagger or Argo Rollouts. They drive Istio VirtualService weights automatically based on metrics, so you don't shift traffic by hand
- If you find yourself writing the same DestinationRule for every service, move the defaults into a `mesh-wide` config under `meshConfig.defaultConfig` and only override per-service when needed
