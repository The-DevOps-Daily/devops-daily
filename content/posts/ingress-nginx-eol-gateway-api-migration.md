---
title: 'Ingress-NGINX Is Retired: A Real Migration to Gateway API With ingress2gateway 1.0'
excerpt: 'In March 2026 the Kubernetes project retired ingress-nginx with no replacement waiting in the wings. Roughly half of all clusters still run it. This post is the migration that does not involve a flag day: how to inventory your annotations, what ingress2gateway 1.0 translates and what it silently drops, the side-by-side cutover pattern with the actual PromQL, and how to pick between Envoy Gateway, kgateway, Cilium Gateway, and Istio.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-05-14'
publishedAt: '2026-05-14T10:00:00Z'
updatedAt: '2026-05-14T10:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Kubernetes
  - Networking
  - Gateway API
  - Migration
  - Ingress
---

In November 2025 the Kubernetes project [announced](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/) that ingress-nginx would retire in March 2026. In January 2026 SIG Network and the Steering Committee [confirmed](https://kubernetes.io/blog/2026/01/29/ingress-nginx-statement/) the date and the rationale: only one or two unpaid contributors were left, the `snippets` annotations were an unmaintainable security surface, and the planned successor project (InGate) had not progressed far enough to be a credible replacement. The same statement cited Datadog telemetry showing that ingress-nginx still ran in roughly 50% of cloud-native clusters.

So you are one of those clusters. The repository is read-only. The container image still pulls, but the next CVE will not get a patch. You need a plan.

This post walks the migration that does not require a flag day. It covers what the EOL actually means, which Gateway API implementation is the right next step for your situation, what `ingress2gateway` 1.0 translates for you and what it silently drops, and a side-by-side cutover that lets you keep both controllers running until you are confident.

## TL;DR

- **EOL date**: March 2026 (the official posts give the month, not a specific day). After EOL there are no further releases, no bugfixes, and no security patches. Existing deployments keep running, the images keep pulling, but new CVEs sit unpatched.
- **InGate is also retired.** The successor project the maintainers had been building never reached production quality and was retired alongside ingress-nginx. The path forward is [Gateway API](https://gateway-api.sigs.k8s.io/), not InGate.
- **`ingress2gateway` 1.0** shipped on 2026-03-20. It translates the well-defined annotations cleanly. It silently drops the dangerous ones: `configuration-snippet`, `server-snippet`, `auth-snippet`, `auth-url`, session affinity, `load-balance`. Those need to be rewritten as vendor-specific Gateway API extensions, which differ per controller.
- **Controller choice**: Envoy Gateway, kgateway, Cilium Gateway, Istio Gateway are all conformant with Gateway API v1.4 and all behave close enough to ingress-nginx for a routine workload. The right pick depends on what you already run.
- **The cutover** is shadow Gateway, watch metrics, flip DNS, decommission. Both controllers can run side by side under different `ingressClassName` / `gatewayClassName` for as long as you need.

## Prerequisites

- A cluster currently running ingress-nginx with one or more Ingress resources.
- `kubectl`, `jq`, and the `ingress2gateway` CLI ([install instructions](https://github.com/kubernetes-sigs/ingress2gateway#install)).
- Permission to install a second ingress controller in the cluster (it does not have to be in the same namespace as ingress-nginx).
- A DNS provider that supports either weighted records or per-record updates (Route53, Cloudflare, GCP Cloud DNS, similar).

## Step 1: Take inventory

The migration plan you actually need is shaped by the annotations you actually use. Start there.

```bash
kubectl get ingress -A -o jsonpath='{range .items[*]}{.metadata.namespace}/{.metadata.name}: {.spec.rules[*].host}{"\n"}{end}'
```

That gives you a list of every Ingress with its hosts. Useful for scoping the migration into batches by team or by hostname. Then dig into the annotations:

```bash
kubectl get ingress -A -o json \
  | jq -r '.items[]
      | .metadata as $m
      | (.metadata.annotations // {})
      | to_entries[]
      | "\($m.namespace)/\($m.name)\t\(.key)\t\(.value)"' \
  | grep '^[^\t]*\tnginx.ingress.kubernetes.io/' \
  | sort -k2
```

This produces a tab-separated table of every nginx annotation in use, grouped by annotation name. The output tells you exactly which features your migration needs to preserve. Save it. You will check it again at the end to confirm nothing got lost.

Pay particular attention to these annotations, which are the ones `ingress2gateway` does not handle:

```text
nginx.ingress.kubernetes.io/configuration-snippet
nginx.ingress.kubernetes.io/server-snippet
nginx.ingress.kubernetes.io/auth-snippet
nginx.ingress.kubernetes.io/auth-url
nginx.ingress.kubernetes.io/auth-signin
nginx.ingress.kubernetes.io/auth-tls-secret
nginx.ingress.kubernetes.io/session-cookie-name
nginx.ingress.kubernetes.io/load-balance
nginx.ingress.kubernetes.io/upstream-hash-by
nginx.ingress.kubernetes.io/mirror-target
```

If your output contains any of these, the migration has manual work in it. We will get to what to do with each of them later.

## Step 2: Pick a Gateway API controller

There are four serious candidates today, all conformant with [Gateway API v1.4](https://kubernetes.io/blog/2025/11/06/gateway-api-v1-4/). The decision is less about features and more about what you already run.

```text
+---------------------+---------------------------------+-----------------------------+
| Controller          | Best fit when you already       | Watch out for               |
+---------------------+---------------------------------+-----------------------------+
| Envoy Gateway       | You want a clean, focused,      | Newer project, smaller      |
|                     | CNCF-governed Envoy frontend    | community than Istio        |
|                     | with no service mesh baggage    |                             |
| kgateway            | You run Solo.io's Gloo stack,   | License history; verify     |
|                     | want AI/MCP routing primitives  | the kgateway open-source    |
|                     | out of the box                  | story matches your needs    |
| Cilium Gateway      | You already use Cilium for CNI; | Couples L7 routing to your  |
|                     | unified control plane is the    | CNI choice                  |
|                     | win                             |                             |
| Istio Gateway       | You already run Istio for mesh; | Inheriting Istio's full     |
|                     | reuse the existing control      | control plane is a big lift |
|                     | plane                           | if you do not already       |
+---------------------+---------------------------------+-----------------------------+
```

If none of the "best fit" rows describe you, Envoy Gateway is the conservative default. It is Envoy-based, CNCF-governed, and ships with the lowest surprise count for an operator coming from ingress-nginx.

A note on InGate: it was the project the ingress-nginx maintainers had been positioning as the successor. The November 2025 retirement post explicitly stated InGate "never progressed far enough to create a mature replacement; it will also be retired." Do not migrate to InGate. The path forward is Gateway API with one of the controllers above.

## Step 3: Translate Ingress resources with ingress2gateway

`ingress2gateway` 1.0 shipped on 2026-03-20 with an Emitters framework that produces output tailored to a specific Gateway API controller. The basic invocation against your live cluster:

```bash
ingress2gateway print \
  --providers=ingress-nginx \
  -A \
  --emitter envoy-gateway \
  > gateway.yaml
```

Swap `--emitter envoy-gateway` for `kgateway` or `standard` depending on your target. The `standard` emitter produces vanilla Gateway API resources with no vendor-specific extensions, which is the right choice if you want to keep the option to switch controllers later.

Output is one or more `Gateway`, `HTTPRoute`, and `BackendTLSPolicy` resources, plus any vendor extensions the emitter knows about. Read the YAML carefully. The tool also emits warnings to stderr for annotations it recognises but cannot translate, and silently drops annotations it does not recognise.

Here is what 1.0 translates cleanly out of the box for the ingress-nginx provider (from [the provider README](https://github.com/kubernetes-sigs/ingress2gateway/blob/main/pkg/i2gw/providers/ingressnginx/README.md)):

```text
canary, canary-by-header, canary-by-header-value, canary-weight, canary-weight-total
rewrite-target (URLRewrite filter, ReplaceFullPath)
app-root, permanent-redirect, temporal-redirect, ssl-redirect
upstream-vhost, connection-proxy-header, x-forwarded-prefix
proxy-connect-timeout, proxy-send-timeout, proxy-read-timeout
proxy-body-size, client-body-buffer-size
backend-protocol (HTTP/HTTPS/GRPC/GRPCS, producing HTTPRoute or GRPCRoute + BackendTLSPolicy)
use-regex
enable-cors and the full CORS annotation set
whitelist-source-range, denylist-source-range
proxy-ssl-verify, proxy-ssl-secret, proxy-ssl-name, proxy-ssl-server-name
TLS via spec.tls[] (Listener with Terminate mode)
```

Here is what it warns on but does not translate (no Gateway API equivalent yet):

```text
canary-by-header-pattern   (regex header match is not in core Gateway API)
canary-by-cookie           (cookie-based canary not in core)
proxy-redirect-from/-to
custom-headers
proxy-ssl-verify-depth, proxy-ssl-protocols
```

And here is what it does not even acknowledge (no translation, no warning):

```text
configuration-snippet, server-snippet, auth-snippet
auth-url, auth-signin, auth-tls-secret, auth-response-headers
session-cookie-name and related sticky-session annotations
load-balance (round-robin/ewma/etc.)
upstream-hash-by
mirror-target
```

That third group is where the actual migration work hides. The first two groups translate or warn; you can review the output and move on. The third group needs case-by-case decisions.

## Step 4: Handle the annotations ingress2gateway drops

The Gateway API team did not standardise the snippet annotations on purpose. They were the architectural reason ingress-nginx became unmaintainable. The migration is the moment to write down what each snippet actually does and find a structured replacement.

**`configuration-snippet`, `server-snippet`, `auth-snippet`**. Each of these injects raw NGINX configuration into the generated config. There is no Gateway API equivalent because the design goal of Gateway API is "no untyped configuration". Identify what each snippet does (custom rate limiting, custom logging, request manipulation, ad-hoc auth) and pick a structured replacement. For Envoy Gateway, that means `SecurityPolicy`, `ClientTrafficPolicy`, `BackendTrafficPolicy`, and `EnvoyExtensionPolicy`. For kgateway it is `TrafficPolicy`. For Istio Gateway it is `EnvoyFilter` (which is itself escape-hatch shaped, but at least typed) plus `AuthorizationPolicy`.

If a snippet does something that has no clean replacement, this is the moment to ask whether the feature was really earning its keep.

**`auth-url`, `auth-signin`, `auth-tls-secret`, `auth-response-headers`**. External auth (the classic "redirect to your OIDC proxy" pattern). Envoy Gateway has [`SecurityPolicy.extAuth`](https://gateway.envoyproxy.io/docs/tasks/security/ext-auth/) which is the closest one-to-one mapping. kgateway has equivalent functionality in `TrafficPolicy`. Istio Gateway has `AuthorizationPolicy` with `CUSTOM` action. None of these are auto-translated; you have to write the new resource by hand. The good news is the replacement is typed and reviewable, unlike the original annotation.

**`session-cookie-name` and sticky sessions**. Gateway API core does not have a sticky-session knob. Every controller has its own vendor extension: Envoy Gateway's [`BackendTrafficPolicy.sessionPersistence`](https://gateway.envoyproxy.io/contributions/design/session-persistence/), kgateway's session affinity in `TrafficPolicy`, Istio's `DestinationRule` with `consistentHash`.

**`load-balance` and `upstream-hash-by`**. Same story. Core Gateway API picks a controller-defined algorithm by default (Envoy: weighted round-robin). To force a specific algorithm or consistent hash on a header, use the controller's `BackendTrafficPolicy` or equivalent.

**`mirror-target`**. Gateway API has a [`RequestMirror`](https://gateway-api.sigs.k8s.io/reference/spec/#httprequestmirrorfilter) filter type that does exactly this, but `ingress2gateway` does not auto-translate to it. Write it manually as an `HTTPRoute.filter` of type `RequestMirror`.

The pattern across all of these: figure out which Gateway API extension type the target controller uses, then write the resource alongside the auto-translated `HTTPRoute`. None of this is fast, but all of it is mechanical once you have the inventory from step 1.

## Step 5: Run both controllers side by side

Do not delete ingress-nginx. Install the new controller alongside it, with a separate `GatewayClass` and a separate Service `LoadBalancer`. Both controllers reconcile their own resources independently. There is no conflict as long as you keep the resource types separate (Ingress vs HTTPRoute) and the class names different.

A representative install of Envoy Gateway:

```bash
helm install eg oci://docker.io/envoyproxy/gateway-helm \
  --version v1.4.0 \
  -n envoy-gateway-system \
  --create-namespace

kubectl wait --timeout=5m -n envoy-gateway-system \
  deployment/envoy-gateway --for=condition=Available
```

Then a `GatewayClass` and a `Gateway` that gets its own external IP:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: eg
spec:
  controllerName: gateway.envoyproxy.io/gatewayclass-controller
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: production
  namespace: envoy-gateway-system
spec:
  gatewayClassName: eg
  listeners:
    - name: https
      protocol: HTTPS
      port: 443
      tls:
        mode: Terminate
        certificateRefs:
          - name: production-tls
      allowedRoutes:
        namespaces:
          from: All
```

Apply the `gateway.yaml` from `ingress2gateway` and set the `HTTPRoute.parentRefs` to this Gateway:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api
  namespace: production
spec:
  parentRefs:
    - name: production
      namespace: envoy-gateway-system
  hostnames:
    - api.example.com
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: api
          port: 8080
```

DNS still points at the ingress-nginx Service IP at this stage. The new Gateway has its own IP but no production traffic. You can test it directly with `curl --resolve api.example.com:443:<new-lb-ip> https://api.example.com/`, which is the cleanest way to validate behaviour before any user-visible change.

## Step 6: Validate with metrics, then flip DNS

The Gateway is running and answering synthetic requests. Before any DNS change, run the same Prometheus queries against the new controller that you already run against ingress-nginx, then compare.

The ingress-nginx baseline you already have:

```promql
# Request rate per Ingress
sum(rate(nginx_ingress_controller_requests[5m])) by (ingress)

# 5xx rate per Ingress
sum(rate(nginx_ingress_controller_requests{status=~"5.."}[5m])) by (ingress)
/
sum(rate(nginx_ingress_controller_requests[5m])) by (ingress)

# p99 latency per Ingress
histogram_quantile(0.99,
  sum(rate(nginx_ingress_controller_request_duration_seconds_bucket[5m])) by (le, ingress))
```

The Envoy Gateway equivalents pull from the standard Envoy cluster metrics:

```promql
# Request rate per upstream cluster
sum(rate(envoy_cluster_upstream_rq_total[5m])) by (envoy_cluster_name)

# 5xx rate per upstream cluster
sum(rate(envoy_cluster_upstream_rq_xx{envoy_response_code_class="5"}[5m]))
  by (envoy_cluster_name)
/
sum(rate(envoy_cluster_upstream_rq_total[5m])) by (envoy_cluster_name)

# p99 upstream RTT per cluster
histogram_quantile(0.99,
  sum(rate(envoy_cluster_upstream_rq_time_bucket[5m])) by (le, envoy_cluster_name))
```

For kgateway, Cilium Gateway, and Istio Gateway, the metric names differ; check the controller's metrics documentation. The shape of the queries (rate, by-label, histogram quantile) is the same.

The numbers from the synthetic traffic should match the ingress-nginx baseline within noise. If 5xx jumps on the new controller and not the old one, you have an HTTPRoute translation gap, almost always in the annotation handling. Fix it before flipping DNS.

When the numbers match, shift traffic. The simplest approach is weighted DNS records: 1%, then 5%, then 25%, 50%, 100%. Watch the same dashboards through each step. If you have a CDN or service mesh in front, you can shift by header instead, which is faster to roll back.

## Step 7: Decommission

Once DNS has fully cut over and the TTL window has elapsed (plus any CDN cache lifetime), drain ingress-nginx:

```bash
# Drop external connectivity first
kubectl -n ingress-nginx patch svc ingress-nginx-controller \
  -p '{"spec":{"type":"ClusterIP"}}'

# Then scale the controller to zero
kubectl -n ingress-nginx scale deploy ingress-nginx-controller --replicas=0
```

Leave the resources in place for a release cycle in case you need to roll back. The Service-type change costs nothing and removes the LoadBalancer charge while keeping the Ingress objects reachable internally. If everything looks healthy after a week, remove the Helm release.

## Rollback path

The reason for the side-by-side install is that rollback at any stage is a DNS change, not a redeploy. If the new controller misbehaves at 25% traffic, push DNS back to 100% ingress-nginx and the world recovers in one TTL cycle. The HTTPRoutes stay in the cluster. You can iterate on them while production is back on the old path.

This is the operational reason "flag day" migrations of ingress controllers are a bad idea. The control plane is two systems, the data plane is two systems, the DNS weight is a knob. Use the knob.

## Real-world references

Three migration write-ups worth reading alongside this one:

- [Pulumi engineering, "How to Move to the Gateway API after ingress-nginx Retirement"](https://www.pulumi.com/blog/ingress-nginx-to-gateway-api-kgateway/) (kgateway as the target, January 2026)
- [Datadog engineering, "Ingress NGINX is EOL: a practical guide for migrating to Kubernetes Gateway API"](https://www.datadoghq.com/blog/migrate-to-gateway-api/) (the seven-step framework, April 2026)
- [An engineering team's zero-downtime production write-up](https://engineering.01cloud.com/2026/03/26/migrating-from-kubernetes-ingress-to-gateway-api-a-zero-downtime-production-success-story/) (Envoy Gateway, separate LB IPs, WebSocket and gRPC gotchas, March 2026)

None of them publish exact latency numbers, so be wary of any claim that a specific controller is "30% faster" out of the box. The honest answer is "it depends on your routes and your traffic", and your own PromQL during canary is the data you actually want.

## Sources

- [kubernetes.io/blog/2025/11/11/ingress-nginx-retirement](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/)
- [kubernetes.io/blog/2026/01/29/ingress-nginx-statement](https://kubernetes.io/blog/2026/01/29/ingress-nginx-statement/)
- [github.com/kubernetes-sigs/ingress2gateway (README and releases)](https://github.com/kubernetes-sigs/ingress2gateway)
- [ingress2gateway 1.0.0 release notes](https://github.com/kubernetes-sigs/ingress2gateway/releases/tag/v1.0.0)
- [Provider README for ingress-nginx](https://github.com/kubernetes-sigs/ingress2gateway/blob/main/pkg/i2gw/providers/ingressnginx/README.md)
- [Gateway API v1.4 release](https://kubernetes.io/blog/2025/11/06/gateway-api-v1-4/)
- [Gateway API implementations matrix](https://gateway-api.sigs.k8s.io/implementations/)

Inventory, translate, run side-by-side, validate with metrics, flip DNS, decommission. The migration is mechanical. The annotation cleanup is where the engineering judgement lives.
