---
title: "GitHub's 2.9B Monthly Commits: Anatomy of an Outage"
excerpt: "GitHub's August 17 outage began with a missed sidecar limit and escalated through retry storms. Learn which reliability controls your platform needs next."
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-08-21'
publishedAt: '2026-08-21T09:00:00Z'
updatedAt: '2026-08-21T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - GitHub
  - Reliability
  - Capacity Planning
  - Incident Response
  - Service Mesh
---

The startling number in [The New Stack's report](https://thenewstack.io/github-2-9b-monthly-commits/) is 2.9 billion commits per month. The more useful number for a DevOps team is 10x: during GitHub's August 17, 2026 outage, one Copilot authentication path jumped from its normal 7,000-9,000 requests per second to 70,000-100,000 while the platform was trying to recover.

This was not simply a case of GitHub needing more servers. A traffic peak exposed an autoscaling blind spot, saturated load balancers, degraded a shared authentication path, and triggered retries that added more traffic to an already constrained system. Understanding that chain gives you a practical checklist for your own platform: scale on the real bottleneck, constrain retries, shed load deliberately, and test recovery under pressure.

## TLDR

- GitHub says monthly commits grew from **1.4 billion in April to 2.9 billion in August 2026**, an increase of roughly 107% in four months.
- The August 17 incident lasted **7 hours and 47 minutes**. Peak web and API error rates were about 20%; archive and raw-content download errors reached about 50%.
- The first bottleneck was an Istio sidecar that reached its concurrency limit. Its autoscaling policy watched the host service, not the sidecar constraint.
- Saturation spread to four HAProxy nodes and GitHub's gateway authentication path. Optimistic retries then amplified load.
- A latent VS Code retry bug drove Copilot Token Service traffic to roughly 10x normal and delayed full recovery.
- The lesson is not "avoid retries" or "add more CPU." It is to treat autoscaling signals, retry budgets, load shedding, and recovery testing as one reliability system.

## Prerequisites

- Familiarity with HTTP requests, timeouts, and retries
- Basic knowledge of Kubernetes autoscaling or service meshes
- Access to service, proxy, and load-balancer metrics if you want to apply the examples
- No GitHub or Azure access is required; this is an incident analysis, not a lab

## The Numbers Behind the Headline

[GitHub's own update](https://github.blog/news-insights/company-news/the-august-17-outage-and-the-work-ahead/) says monthly commits more than doubled between April and August:

```chart
{
  "type": "bar",
  "title": "GitHub monthly commits more than doubled in four months",
  "unit": "B commits",
  "caption": "Platform-wide monthly commits reported by GitHub on August 20, 2026.",
  "rows": [
    { "label": "April 2026", "value": 1.4, "series": "Monthly commits" },
    { "label": "August 2026", "value": 2.9, "series": "Monthly commits" }
  ],
  "series": [
    { "name": "Monthly commits", "color": "#f59e0b" }
  ]
}
```

GitHub had not been standing still. By August, it had added more than 3 million CPU cores, 120 petabytes of high-speed storage, and substantial network capacity. Azure was serving about 58% of platform load and half of Git operations, up from 12% of platform load in May.

Those additions still did not protect one constrained request path. That is the central reliability lesson: **fleet capacity and critical-path capacity are different numbers**.

The incident's customer impact, documented in the [GitHub Status root cause analysis](https://www.githubstatus.com/incidents/zkxwbgr0cnmx), was broad:

| Signal                                        | Reported value |
| --------------------------------------------- | -------------: |
| Incident duration                             |         7h 47m |
| Peak web/API error rate                       |           ~20% |
| Peak archive/raw download error rate          |           ~50% |
| Normal Copilot Token Service traffic          |      7K-9K RPS |
| Retry-amplified Copilot Token Service traffic |   70K-100K RPS |
| HAProxy nodes that exhausted flow limits      |              4 |

[GitHub has said](https://github.blog/news-insights/company-news/github-availability-report-may-2026/) that its broader traffic growth is driven in large part by AI-assisted and agentic development. That does not mean every one of the 2.9 billion commits was created by an agent, and the metric is not a measure of useful code. It does mean that machine-driven workflows are changing both the volume and shape of platform traffic.

## How the Outage Cascaded

The simplified failure chain looks like this:

```diagram
{
  "type": "loop",
  "title": "The August 17 capacity and retry feedback loop",
  "loopTop": "each failed call creates more retry traffic",
  "loopBack": "retries increase pressure on the constrained path",
  "nodes": [
    { "label": "New traffic peak", "sub": "Central US", "variant": "soft" },
    { "label": "Sidecar limit", "sub": "autoscaler misses it", "variant": "solid" },
    { "label": "Load balancers saturate", "sub": "HAProxy flow limits", "variant": "solid" },
    { "label": "Authentication slows", "sub": "shared gateway path", "variant": "accent" },
    { "label": "Clients retry", "sub": "up to 10x traffic", "variant": "accent" }
  ],
  "goal": "Break the loop with correct scaling signals, bounded retries, and load shedding"
}
```

Here is what happened in order:

1. Traffic reached a new peak in GitHub's Central US data center.
2. An Istio sidecar reached its concurrency limit. The autoscaling policy watched the host service but did not account for the sidecar's own limit, so the constrained component did not scale correctly.
3. That failure spread until four HAProxy nodes exhausted their flow limits. The gateway authentication path slowed down, and authentication failures affected GitHub.com, APIs, Actions, pull requests, issues, Git operations, and Copilot.
4. Optimistic retries placed more traffic on internal load balancers. GitHub rerouted some traffic to Northern Virginia, where it was initially served successfully.
5. Delayed responses exposed a client-side retry loop in VS Code. Copilot Token Service traffic climbed from 7K-9K RPS to 70K-100K RPS, so part of the system remained degraded after most services had recovered.
6. GitHub reduced gateway retries and temporarily returned a non-retry-triggering response for Copilot token requests, then gradually restored traffic by site.

Scraping attacks against code-download endpoints added pressure during the same window, but GitHub identifies capacity saturation, incorrect autoscaling, and retry amplification as the incident's core mechanics.

## Why Three Million More CPU Cores Were Not Enough

For a synchronous request path, effective capacity is approximately the capacity of its narrowest required component:

```text
request-path capacity = min(
  sidecar concurrency,
  load-balancer flows,
  authentication throughput,
  network capacity,
  backend throughput
)
```

Adding compute to the backend does not increase throughput if a proxy in front of it is already full. Adding a second region does not guarantee recovery if clients send ten retries for every delayed response. A healthy average CPU graph can coexist with a saturated connection table, queue, sidecar worker pool, or authentication dependency.

This is why capacity planning based only on CPU and memory fails. Resource metrics tell you what a process consumes. **Work metrics** tell you whether the component can accept another request: active connections, in-flight requests, pending requests, queue depth, flow-table utilization, rejection count, and retry ratio.

If you want a refresher on the user-facing side of this, [P99 latency](/posts/what-is-p99-latency) is often the first signal that a queue is growing while averages still look normal.

## 1. Scale on the Component That Saturates

The common Kubernetes pattern is to scale an application Deployment from application CPU alone:

```yaml
# Incomplete: the application can look healthy while its proxy is saturated.
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

With `autoscaling/v2`, an HPA can evaluate several metrics and use the largest replica recommendation. The example below watches sidecar CPU plus a custom per-pod concurrency metric:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: gateway
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: gateway
  minReplicas: 6
  maxReplicas: 100
  metrics:
    # Scale if the service-mesh proxy itself is busy.
    - type: ContainerResource
      containerResource:
        name: cpu
        container: istio-proxy
        target:
          type: Utilization
          averageUtilization: 65
    # Assumes your metrics adapter exposes this Envoy metric per pod.
    - type: Pods
      pods:
        metric:
          name: envoy_http_downstream_rq_active
        target:
          type: AverageValue
          averageValue: '200'
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 30
        - type: Pods
          value: 10
          periodSeconds: 30
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300
```

The value `200` is not a universal safe limit. Find the knee of your own latency curve with a load test, then keep operating headroom below it. Kubernetes documents [custom and multiple-metric autoscaling](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/) for this exact class of problem.

Also alert on saturation directly. For Envoy-backed paths, useful signals include active and pending requests, request overflow, remaining circuit-breaker capacity, retries, and timeouts. CPU should remain on the dashboard, but it should not be the only trigger.

## 2. Give Retries a Budget

Retries spend extra capacity to hide transient failures. During an overload, the system has no extra capacity to spend.

This policy is dangerous when copied to every hop:

```yaml
# Risky: broad failures, four total attempts, and a long time budget.
retries:
  attempts: 3
  perTryTimeout: 2s
  retryOn: 5xx
```

In Istio, `attempts: 3` means three retries after the initial request. If five services are connected by four retrying hops and every layer does the same thing, the theoretical worst case at the deepest service is `4 x 4 x 4 x 4 = 256` requests for one original call.

A safer starting point for an idempotent route is one narrowly targeted retry inside a short outer timeout:

```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: catalog
spec:
  hosts:
    - catalog
  http:
    - timeout: 1200ms # Includes the initial call, backoff, and retry.
      retries:
        attempts: 1
        perTryTimeout: 500ms
        retryOn: connect-failure,refused-stream,reset
      route:
        - destination:
            host: catalog
```

Use `attempts: 0` for non-idempotent operations unless the request carries an idempotency key. Decide which layer owns the retry instead of enabling retries independently at the client library, sidecar, gateway, and job runner.

Then define a platform-wide **retry budget**, such as no more than 10 retry requests per 100 original requests in a rolling window. When the budget is exhausted, fail fast and allow the dependency to recover. Envoy exposes `upstream_rq_retry`, `upstream_rq_retry_overflow`, and total request counters for enforcing and observing that boundary. Its [router documentation](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/router_filter.html) also explains its jittered exponential backoff and outer timeout behavior.

A Prometheus alert can make retry amplification visible before it becomes the incident:

```promql
100 *
sum(rate(envoy_cluster_upstream_rq_retry{cluster_name="catalog"}[5m]))
/
clamp_min(
  sum(rate(envoy_cluster_upstream_rq_total{cluster_name="catalog"}[5m])),
  1
)
> 10
```

Adapt the label names to your telemetry pipeline. The important output is retry traffic as a percentage of total upstream traffic, broken down by caller and destination. Our guide to [Istio retries and circuit breaking](/posts/istio-traffic-management-routing-retries-circuit-breaking) goes deeper into the mesh configuration.

## 3. Make Overload an Explicit Operating Mode

GitHub's recovery shows why the response to failure matters. A delayed or retryable response can ask clients to send more work. A fast, explicit rejection can protect the service that is trying to recover.

Design an overload mode before the incident:

- Shed low-priority work before authentication, deploys, or other critical paths.
- Bound queues by size and age. An unbounded queue converts overload into a delayed outage.
- Rate-limit by tenant or workload so one machine-driven client cannot consume all capacity.
- Return a documented response that clients handle without an immediate retry. Where retry is appropriate, include `Retry-After` and require exponential backoff with jitter.
- Keep an emergency control that can reduce or disable retries without waiting for a full application rollout.
- Degrade optional features independently instead of making them share a failure domain with core operations.

Do not blindly copy GitHub's temporary use of `403` during recovery; that was a targeted mitigation for a known client behavior. Define the overload contract between your own clients and servers, then test that contract.

## 4. Test the Recovery, Not Just the Failover

Many game days stop after traffic reaches the second region. The August 17 incident demonstrates why that is too early. The system is not recovered until the extra retries drain, queues return to normal, error rates stay down, and removing the mitigation does not restart the loop.

A useful resilience test injects latency, not only hard failures, because slow responses are more likely to hold connections and trigger overlapping retries. During the test, verify that:

1. Autoscaling reacts to the constrained component before it reaches its hard limit.
2. Retry volume stays below its budget at every hop.
3. Load shedding protects critical requests.
4. Regional failover has enough independent authentication, network, and data capacity.
5. Recovery controls can be applied without a normal deployment path.
6. The system remains stable when traffic is gradually restored.

Tie those observations to an SLO and an error-budget policy. The practical implementation is covered in [our SLO, SLI, and error budget guide](/posts/slos-slis-error-budgets-practical-guide).

## GitHub Is Part of Your Control Plane

GitHub's incident also exposes a dependency most teams under-model. Source, pull requests, identity, Actions, packages, releases, and incident runbooks often sit behind one provider. A local clone keeps code available, but it does not preserve repository settings, issues, pull-request context, Actions control, or organization identity.

You do not need to build a second GitHub. You do need to decide how your team operates while GitHub is unavailable:

- Keep incident runbooks and emergency contacts somewhere the GitHub incident cannot block.
- Avoid downloading code or release assets from GitHub on every production startup. Promote immutable artifacts into a registry you operate as part of the deploy path.
- Back up critical repositories and the metadata you actually need, then test restoration.
- Know which deploys can safely continue and which should freeze when checks, approvals, or provenance are unavailable.
- Make the GitHub status page part of the incident triage runbook, but do not make it the only signal.
- If self-hosted runners are part of your continuity plan, test them during a simulated GitHub API and Actions control-plane outage. Owning the runner does not remove every hosted dependency.

## A Checklist for the Next Traffic Spike

- [ ] Identify the hard limit for every proxy, load balancer, queue, database pool, and shared auth path.
- [ ] Put those limits on dashboards as ratios, not only raw counts.
- [ ] Autoscale on concurrency, queueing, and saturation signals as well as CPU.
- [ ] Reserve enough headroom to absorb the load while new capacity becomes ready.
- [ ] Count retries by caller, destination, reason, and attempt number.
- [ ] Set an outer request deadline and a retry budget across the whole call chain.
- [ ] Test slow dependencies, retry storms, and gradual recovery in game days.
- [ ] Document what happens when GitHub or another delivery control plane is unavailable.
- [ ] Track postmortem actions to completion instead of closing them with the incident.

## The Bottom Line

The 2.9 billion-commit headline explains the pressure, not the failure. GitHub's outage emerged from a narrower chain: a limit the autoscaler did not see, load balancers that saturated, a shared authentication path, and retries that turned partial failure into more demand.

That pattern is not unique to GitHub, and it does not require GitHub scale. Any service mesh, gateway, or client library can create the same feedback loop. Build around the bottleneck you actually have, give resilience mechanisms explicit budgets, and rehearse the path back to normal. More capacity helps, but only after the system knows where to put it.
