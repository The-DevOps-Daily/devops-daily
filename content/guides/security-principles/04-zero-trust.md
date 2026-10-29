---
title: 'Zero Trust Architecture: Identity on Every Request'
description: 'Zero trust in practice: why labels and IPs are not identity, mTLS and identity policy with Istio ambient, JWTs at the edge, devices and OIDC for CI/CD.'
order: 4
---

**TLDR**: Zero trust means no request is trusted because of where it comes from. Every request carries an identity (a user, a device, a workload), and a policy decides per request, with the least privilege that works, while you assume an attacker is already inside. In this part you see why the ticket shop's network rules are not enough (a pod that copies a label walks past them), then replace that trust with cryptographic workload identity and mutual TLS in Istio's ambient mode, require a signed token for admin paths at the edge, and give the CI/CD pipeline short-lived OIDC credentials instead of stored cloud keys.

Zero trust is often sold as a product. It is a set of design rules, described in NIST SP 800-207 (2020), and you apply them one system at a time. The previous parts already did much of the work: Part 2's layers assume any layer can fail, and Part 3's narrow permissions limit what each identity can do. This part adds the missing piece: **proving identity on every request**, instead of inferring it from a network address or a label.

## Prerequisites

- The kind cluster from Parts [1](/guides/security-principles/01-cia-triad), [2](/guides/security-principles/02-defense-in-depth) and [3](/guides/security-principles/03-least-privilege), with the NetworkPolicies from Part 2 and the restricted Pod Security level from Part 3.
- About 2 GB of free memory for Istio, and Internet access for its images.
- For the CI/CD section: a GitHub repository where you can run Actions workflows. The token claims shown come from the [companion repository](https://github.com/The-DevOps-Daily/guide-security-principles-demo-2026-10-27)'s workflow.

## What Zero Trust Means

NIST SP 800-207 lists seven tenets. In short:

1. All data sources and computing services are **resources**, not just servers in the data center.
2. **All communication is secured regardless of network location.** Being on the internal network grants nothing.
3. Access is granted **per session**, with the least privilege needed.
4. Access is decided by **dynamic policy**: the identity of the user or workload, the state of the device, the requested resource, and other signals.
5. The organization **monitors the integrity and security posture** of all its assets.
6. Authentication and authorization are **strictly enforced before access** is allowed, and re-checked.
7. The organization **collects as much information as it can** about assets, traffic and requests, and uses it to improve policy.

Architecturally, a **policy decision point** (NIST calls its parts the policy engine and the policy administrator) decides, and a **policy enforcement point** sits in front of each resource and enforces the decision. The decision point does not have to sit in the request path: a service mesh's control plane pushes compiled policy to the proxies, which decide locally per request.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "signals", "label": "Signals", "sub": "logs, threat intel, posture", "icon": "activity", "tone": "amber", "detail": "Audit logs, device management, vulnerability data. They feed the policy and detect abuse." }
    ],
    [
      { "id": "user", "label": "User + device", "sub": "SSO, MFA, posture", "icon": "globe", "tone": "slate", "detail": "A person on a laptop, anywhere. Proves who they are (phishing-resistant MFA) and that the device is healthy." },
      { "id": "pdp", "label": "Decision point", "sub": "policy engine", "icon": "gear", "tone": "violet", "detail": "Turns policy, identity, device state and context into decisions. An identity provider's conditional access decides at sign-in; Istio's istiod compiles policies and pushes them to the proxies, which then decide each request locally." },
      { "id": "wl", "label": "Workload", "sub": "service identity", "icon": "box", "tone": "slate", "detail": "A pod or a CI job. Proves its identity with a certificate (mTLS) or a signed token (OIDC)." }
    ],
    [
      { "id": "pep", "label": "Enforcement point", "sub": "proxy, gateway, ztunnel", "icon": "shield", "tone": "red", "detail": "Sits in front of every resource. Allows or denies each request according to the policy it was given." }
    ],
    [
      { "id": "res", "label": "Resource", "sub": "API, database, bucket", "icon": "database", "tone": "green", "detail": "Never reachable directly: only through an enforcement point." }
    ]
  ],
  "edges": [
    ["signals", "pdp"],
    ["user", "pep", "request"],
    ["pdp", "pep", "policy"],
    ["wl", "pep", "request"],
    ["pep", "res", "allowed"]
  ]
}
```

CISA's [Zero Trust Maturity Model 2.0](https://www.cisa.gov/sites/default/files/2023-04/zero_trust_maturity_model_v2_508.pdf) groups the work into five pillars (identity, devices, networks, applications and workloads, data) with three capabilities across them (visibility and analytics, automation and orchestration, governance), and four stages for each: traditional, initial, advanced and optimal. NIST's [SP 1800-35](https://csrc.nist.gov/pubs/sp/1800/35/final) (June 2025) documents 19 working example implementations built with commercial products, which is useful when you need to see how the pieces fit.

## Why Network Location Is Not Identity

Part 2's NetworkPolicy lets pods labelled `app: worker` reach Postgres. A label is not proof of anything: anyone who can create a pod in the namespace chooses its labels. Here is a pod that copies the worker's label but runs under the namespace's default service account:

```yaml
# Claims to be the worker: same label, but the default service account.
apiVersion: v1
kind: Pod
metadata:
  name: impostor
  namespace: shop
  labels:
    app: worker
spec:
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 70
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: impostor
      image: postgres:18.6-alpine3.24@sha256:10a5c69a83035ab5239f5620d708520e8b28f5aa1f2b20143e6024532edadfb5
      command: ['sleep', 'infinity']
      securityContext:
        allowPrivilegeEscalation: false
        capabilities:
          drop: ['ALL']
```

```terminal
{
  "title": "a copied label passes the network policy",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd ~/security-principles-demo/part04"
    },
    {
      "cmd": "kubectl apply -f impostor.yaml && kubectl -n shop wait --for=condition=Ready pod/impostor --timeout=120s",
      "output": "pod/impostor created\npod/impostor condition met"
    },
    {
      "cmd": "kubectl -n shop exec impostor -- pg_isready -h postgres",
      "output": "postgres:5432 - accepting connections"
    }
  ]
}
```

The impostor reaches the database, because to the network it is the worker. IP addresses are no better: they are reused, shared behind NAT, and spoofable inside a compromised network. Zero trust replaces "where are you" with "prove who you are": a workload identity that is issued by the platform, bound to the service account, and proven with a private key the pod cannot hand to another pod.

## Workload Identity and Mutual TLS with Istio

A service mesh gives every workload a certificate for its identity and encrypts and authenticates every connection between workloads with mutual TLS (mTLS): both sides present certificates, so each side knows who the other is. In Istio the identity comes from the Kubernetes service account, written as a SPIFFE ID such as `spiffe://cluster.local/ns/shop/sa/worker`. Policies can then say "only the `worker` and `api` service accounts may connect to Postgres", which a copied label cannot satisfy.

Istio's **ambient mode** (generally available since Istio 1.24) does this without sidecar containers: a per-node proxy called ztunnel handles mTLS and layer 4 policy, and optional **waypoint** proxies add layer 7 (HTTP) policy where you need it. Because no extra container with network privileges is injected into your pods, ambient mode works in a namespace that enforces the restricted Pod Security level.

Install Istio 1.31 with the ambient profile. The `MERGE_SLASHES` setting matters later, for the path rules at the edge. The first command raises the host's inotify limits: with four kind nodes on one machine, the defaults run out, and ztunnel and the Istio CNI agent crash in a loop with `Too many open files (os error 24)` (a [known kind issue](https://kind.sigs.k8s.io/docs/user/known-issues/#pod-errors-due-to-too-many-open-files)). Real clusters with one node per machine do not need it.

```terminal
{
  "title": "install Istio in ambient mode",
  "prompt": "$",
  "steps": [
    {
      "cmd": "sudo sysctl -q fs.inotify.max_user_watches=524288 fs.inotify.max_user_instances=512"
    },
    {
      "cmd": "cd ~ && curl -sL https://istio.io/downloadIstio | ISTIO_VERSION=1.31.3 sh - >/dev/null"
    },
    {
      "cmd": "export PATH=\"$HOME/istio-1.31.3/bin:$PATH\" && cd ~/security-principles-demo/part04"
    },
    {
      "cmd": "istioctl install --set profile=ambient --set meshConfig.pathNormalization.normalization=MERGE_SLASHES --skip-confirmation >/dev/null"
    },
    {
      "cmd": "kubectl -n istio-system get pods",
      "output": "NAME                      READY   STATUS    RESTARTS   AGE\nistio-cni-node-4k4p8      1/1     Running   0          12s\nistio-cni-node-h29p2      1/1     Running   0          12s\nistio-cni-node-v9dxs      1/1     Running   0          12s\nistio-cni-node-vq5wk      1/1     Running   0          12s\nistiod-65b566bb96-t54nl   1/1     Running   0          12s\nztunnel-9d7fj             1/1     Running   0          4s\nztunnel-cfmsx             1/1     Running   0          4s\nztunnel-kbmf8             1/1     Running   0          4s\nztunnel-lc2bm             1/1     Running   0          4s"
    }
  ]
}
```

Ambient mode carries traffic between workloads in mutual TLS tunnels (HBONE) on port **15008**, so connections arrive at the destination pod on that port instead of the application's port. Part 2's NetworkPolicies allow only port 5432 to Postgres, so they need a matching rule for 15008 before you enroll the namespace. Keep the same label rules, so the network layer stays as narrow as before:

```yaml
# Ambient mode tunnels pod-to-pod traffic (mutual TLS, HBONE) through port 15008,
# so the paths from Part 2 must also be open on that port.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: hbone-to-postgres
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes: ['Ingress']
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api
        - podSelector:
            matchLabels:
              app: worker
      ports:
        - protocol: TCP
          port: 15008
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: hbone-from-clients
  namespace: shop
spec:
  podSelector:
    matchExpressions:
      - key: app
        operator: In
        values: ['api', 'worker']
  policyTypes: ['Egress']
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 15008
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: hbone-to-api
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes: ['Ingress']
  ingress:
    - ports:
        - protocol: TCP
          port: 15008
```

Then enroll the namespace with a label. Existing pods join the mesh without a restart:

```terminal
{
  "title": "enroll the shop namespace",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f netpol-hbone.yaml",
      "output": "networkpolicy.networking.k8s.io/hbone-to-postgres created\nnetworkpolicy.networking.k8s.io/hbone-from-clients created\nnetworkpolicy.networking.k8s.io/hbone-to-api created"
    },
    {
      "cmd": "kubectl label namespace shop istio.io/dataplane-mode=ambient",
      "output": "namespace/shop labeled"
    },
    {
      "cmd": "sleep 10; istioctl ztunnel-config workloads --workload-namespace shop",
      "output": "NAMESPACE POD NAME                  ADDRESS    NODE         WAYPOINT PROTOCOL\nshop      api-864c4bd569-9mxjb      10.244.3.3 shop-worker3 None     HBONE\nshop      api-864c4bd569-j8nhd      10.244.4.2 shop-worker2 None     HBONE\nshop      api-864c4bd569-xmvzs      10.244.1.3 shop-worker  None     HBONE\nshop      impostor                  10.244.1.6 shop-worker  None     HBONE\nshop      postgres-569c996f76-zpjn9 10.244.1.4 shop-worker  None     HBONE\nshop      worker-599588c9b7-688jz   10.244.3.4 shop-worker3 None     HBONE\nshop      worker-6864999749-ncmxq   10.244.3.2 shop-worker3 None     HBONE\nshop      worker-6864999749-r6n8k   10.244.3.5 shop-worker3 None     HBONE"
    },
    {
      "cmd": "kubectl -n shop exec deploy/worker -- pg_isready -h postgres",
      "output": "postgres:5432 - accepting connections"
    }
  ]
}
```

Every pod in `shop` now shows the `HBONE` protocol: their traffic is encrypted and authenticated with certificates that ztunnel obtains from istiod for each service account, and rotates automatically. Nothing changed for the applications.

### Require mTLS and Authorize by Identity

Two policies finish the job. `PeerAuthentication` in `STRICT` mode rejects any plaintext connection to a pod in the namespace, so nothing outside the mesh can talk to these pods unauthenticated. An `AuthorizationPolicy` on Postgres allows only the two service accounts that need it:

```yaml
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: default
  namespace: shop
spec:
  mtls:
    mode: STRICT
---
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: postgres
  namespace: shop
spec:
  selector:
    matchLabels:
      app: postgres
  action: ALLOW
  rules:
    - from:
        - source:
            principals:
              - cluster.local/ns/shop/sa/api
              - cluster.local/ns/shop/sa/worker
      to:
        - operation:
            ports: ['5432']
```

```terminal
{
  "title": "the label no longer works, the identity does",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f mesh-policy.yaml",
      "output": "peerauthentication.security.istio.io/default created\nauthorizationpolicy.security.istio.io/postgres created"
    },
    {
      "cmd": "sleep 15; kubectl -n shop exec deploy/worker -- pg_isready -h postgres",
      "output": "postgres:5432 - accepting connections"
    },
    {
      "cmd": "kubectl -n shop exec impostor -- pg_isready -h postgres",
      "output": "postgres:5432 - no response\ncommand terminated with exit code 2"
    },
    {
      "cmd": "kubectl -n istio-system logs -l app=ztunnel --since=5m --max-log-requests=8 | grep 'src.workload=\"impostor\"' | grep -m 1 -o -E '(src.identity|dst.identity|error)=\"[^\"]*\"'",
      "output": "src.identity=\"spiffe://cluster.local/ns/shop/sa/default\"\ndst.identity=\"spiffe://cluster.local/ns/shop/sa/postgres\"\nerror=\"connection closed due to policy rejection: allow policies exist, but none allowed\""
    }
  ]
}
```

The worker still connects; the impostor, with the same label and the same network path, is refused because its certificate says `sa/default`. ztunnel logs the denial with both identities, which is the audit trail tenet 7 asks for. The network policy and the mesh policy now check different things (labels and cryptographic identity), which is defense in depth from Part 2 again.

This narrows the hole; it does not close it. In Kubernetes, anyone who can create pods in a namespace can also choose any service account in that namespace, so an impostor that sets `serviceAccountName: worker` gets the worker's identity ([Part 3](/guides/security-principles/03-least-privilege#h2-kubernetes-rbac) showed the same problem with Secrets). Identity is only as strong as the control over who can run as it: keep pod creation rights in a namespace to the deploy pipeline, put workloads of different trust in different namespaces, and use an admission policy if some service accounts must only run specific images.

Two details from the Istio documentation that matter in practice: an ALLOW policy on a workload denies everything it does not match, so add rules for every legitimate client before you apply it; and in ambient mode ztunnel enforces only layer 4 rules (identities, namespaces, ports). If a policy enforced by ztunnel contains HTTP rules such as paths or methods, it fails closed and denies traffic. HTTP rules need a waypoint proxy or a gateway.

## End-User Identity at the Edge

Workload identity says which service is calling. Requests from people carry a different identity: a token from your identity provider, usually a JWT (a signed JSON document with claims such as the user, the groups and the expiry). The place to check it is the edge, before any service sees the request. Create an Istio gateway in an `edge` namespace that routes to the API:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: edge
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: edge
  namespace: edge
  annotations:
    networking.istio.io/service-type: ClusterIP
spec:
  gatewayClassName: istio
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: Same
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api
  namespace: edge
spec:
  parentRefs:
    - name: edge
  rules:
    - backendRefs:
        - name: api
          namespace: shop
          port: 80
---
# The shop namespace allows routes in edge to send traffic to its api Service.
apiVersion: gateway.networking.k8s.io/v1
kind: ReferenceGrant
metadata:
  name: edge-to-api
  namespace: shop
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      namespace: edge
  to:
    - group: ''
      kind: Service
      name: api
---
# Only the edge gateway's identity may call the API, so nobody can skip the JWT checks
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: api
  namespace: shop
spec:
  selector:
    matchLabels:
      app: api
  action: ALLOW
  rules:
    - from:
        - source:
            principals: ['cluster.local/ns/edge/sa/edge-istio']
      to:
        - operation:
            ports: ['8080']
---
# A client to test with, standing in for the Internet
apiVersion: v1
kind: Pod
metadata:
  name: client
  namespace: edge
spec:
  containers:
    - name: curl
      image: curlimages/curl:8.19.0@sha256:c03110c736db81bbe1be0296f1f1608c81b954b01626bdfb0a8f84e5bd00ff3c
      command: ['sleep', 'infinity']
```

Then the two policies. `RequestAuthentication` tells the gateway which issuer to trust and where its public keys are; this lab uses Istio's sample issuer and sample tokens, which stand in for your identity provider. **The sample issuer is for the lab only: its private key is published in the Istio repository, so anyone can sign tokens it accepts.** The `AuthorizationPolicy` allows every path except `/admin` and everything under it, and allows those only with a valid token whose `groups` claim contains `group1`. Both forms are listed because `/admin/*` does not match `/admin` itself:

```yaml
apiVersion: security.istio.io/v1
kind: RequestAuthentication
metadata:
  name: edge-jwt
  namespace: edge
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: edge
  jwtRules:
    # LAB ONLY: Istio's sample issuer. Its private key is public in the Istio repository,
    # so anyone can sign tokens that this rule accepts. Never use it outside a lab.
    - issuer: testing@secure.istio.io
      jwksUri: https://raw.githubusercontent.com/istio/istio/release-1.31/security/tools/jwt/samples/jwks.json
---
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: edge-admin
  namespace: edge
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: edge
  action: ALLOW
  rules:
    - to:
        - operation:
            notPaths: ['/admin', '/admin/*']
    - from:
        - source:
            requestPrincipals: ['testing@secure.istio.io/testing@secure.istio.io']
      to:
        - operation:
            paths: ['/admin', '/admin/*']
      when:
        - key: request.auth.claims[groups]
          values: ['group1']
```

In production, point the rule at your own identity provider and pin the audience, so that a token issued for another application of the same provider is rejected. The shape, with placeholder values (`issuer` must match the token's `iss` claim exactly):

```yaml
jwtRules:
  - issuer: https://login.example.com/
    jwksUri: https://login.example.com/.well-known/jwks.json
    audiences: ['ticket-shop-admin']
# and in the AuthorizationPolicy: requestPrincipals: ['https://login.example.com//*']
```

The tokens are passed on standard input with `curl -H @-`, so they never appear in a process list (Part 1):

```terminal
{
  "title": "JWT checks at the edge, and a direct call",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f edge.yaml -f edge-jwt.yaml >/dev/null && kubectl -n edge wait --for=condition=Programmed gateway/edge --timeout=180s && kubectl -n edge wait --for=condition=Ready pod/client --timeout=120s",
      "output": "gateway.gateway.networking.k8s.io/edge condition met\npod/client condition met"
    },
    {
      "cmd": "samples=https://raw.githubusercontent.com/istio/istio/release-1.31/security/tools/jwt/samples"
    },
    {
      "cmd": "user_token=$(curl -s $samples/demo.jwt) && admin_token=$(curl -s $samples/groups-scope.jwt)"
    },
    {
      "cmd": "sleep 5; kubectl -n edge exec client -- curl -s -w ' (%{http_code})\\n' http://edge-istio/events",
      "output": "api api-864c4bd569-9mxjb: GET /events\n (200)"
    },
    {
      "cmd": "kubectl -n edge exec client -- curl -s -w ' (%{http_code})\\n' http://edge-istio/admin/refunds",
      "output": "RBAC: access denied (403)"
    },
    {
      "cmd": "kubectl -n edge exec client -- curl -s -w ' (%{http_code})\\n' http://edge-istio/admin",
      "output": "RBAC: access denied (403)"
    },
    {
      "cmd": "kubectl -n edge exec client -- curl -s -w ' (%{http_code})\\n' http://edge-istio//admin/refunds",
      "output": "RBAC: access denied (403)"
    },
    {
      "cmd": "kubectl -n edge exec -i client -- curl -s -w ' (%{http_code})\\n' -H @- http://edge-istio/admin/refunds <<<\"Authorization: Bearer $user_token\"",
      "output": "RBAC: access denied (403)"
    },
    {
      "cmd": "kubectl -n edge exec -i client -- curl -s -w ' (%{http_code})\\n' -H @- http://edge-istio/admin/refunds <<<\"Authorization: Bearer $admin_token\"",
      "output": "api api-864c4bd569-xmvzs: GET /admin/refunds\n (200)"
    },
    {
      "cmd": "kubectl -n edge exec -i client -- curl -s -w ' (%{http_code})\\n' -H @- http://edge-istio/admin/refunds <<<\"Authorization: Bearer ${admin_token%.*}.${user_token##*.}\"",
      "output": "Jwt verification fails (401)"
    },
    {
      "cmd": "kubectl -n edge exec client -- curl -sS -m 5 http://api.shop/admin/refunds",
      "output": "curl: (56) Recv failure: Connection reset by peer\ncommand terminated with exit code 56"
    }
  ]
}
```

The results, in order: a public page works without a token; `/admin/refunds`, `/admin` and `//admin/refunds` without a token are denied (403); a valid token without the `group1` group is denied (403); the right token reaches the API (200); and a token whose signature does not match its claims is rejected before any policy runs (401). The last request skips the gateway and calls the API's service directly: the client is not in the mesh, so `STRICT` mTLS refuses its plain-text connection. A workload that is in the mesh would get as far as the API's `AuthorizationPolicy`, which allows only the gateway's service account, so the JWT check cannot be skipped from inside either.

The `//admin/refunds` request is why the install set `MERGE_SLASHES`. By default Istio keeps duplicate slashes, so that path would not match `/admin/*` and would pass the public rule, while Python's HTTP server collapses leading duplicate slashes (nginx and many frameworks also merge slashes) and serves `/admin/refunds`. A path rule protects only paths that the proxy and the application see the same way: check slashes, case, and encoded characters such as `%2F` against how your backend routes requests.

The second request is the trap in many copied examples: **`RequestAuthentication` alone does not require a token.** It rejects invalid tokens, but a request with no token at all passes as an anonymous request. Only the `AuthorizationPolicy` rule with `requestPrincipals` makes the token mandatory. Test the "no token" case for every protected path.

## Users and Devices

For people, zero trust starts with strong identity and adds the device:

- **Single sign-on for everything**, so one identity provider enforces policy and one switch removes access when someone leaves.
- **Phishing-resistant MFA**: passkeys or security keys (FIDO2/WebAuthn) instead of SMS codes or push approvals. NIST SP 800-63B-4 (July 2025) requires verifiers to offer at least one phishing-resistant option at AAL2, and allows synced passkeys at that level. Push-approval fatigue and SMS interception are how many "MFA-protected" accounts are taken over.
- **Device posture** as part of the decision: managed or not, disk encryption on, screen lock on, operating system still supported and patched, endpoint protection running.

| Signal                   | Example policy                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| Operating system support | Block Windows 10 (end of support October 14, 2025) and macOS versions Apple no longer patches |
| Disk encryption          | Require FileVault or BitLocker for any access to internal tools                               |
| Management               | Production consoles only from company-managed devices                                         |
| Location and risk        | Step-up MFA for unusual locations, block known-bad networks                                   |

The products that evaluate these signals include Microsoft Entra Conditional Access with Intune, Google's Chrome Enterprise Premium (formerly BeyondCorp Enterprise), Okta Device Assurance, and 1Password Device Trust (formerly Kolide). They differ in coverage and in how they handle unmanaged devices; the policy questions above are the same for all of them.

**Continuous verification** means the decision is not made once at login. Keep sessions and tokens short-lived (minutes for access tokens, not days), re-check device posture and risk during the session, ask for MFA again before sensitive actions (refunds and admin pages in the ticket shop), and revoke sessions when an account or device changes state. Your identity provider's session and token lifetimes are where most of this is configured.

## Zero Trust for CI/CD

A deploy pipeline holds the most powerful credentials in the company, and it traditionally kept them as long-lived secrets in the CI system. With OpenID Connect (OIDC), the CI platform signs a short-lived token for each job, and the cloud trusts that token instead:

1. The job requests an ID token from GitHub, with the cloud as the audience.
2. The cloud verifies GitHub's signature and the claims (repository, branch or environment), and returns temporary credentials for one role.
3. The credentials expire at the end of the role session (one hour by default; the example below asks for 15 minutes). Nothing long-lived is stored in the CI system.

This is what a real token from the companion repository's workflow contains. The job runs in a GitHub environment named `production`:

```python
"""Print the claims of a JWT. Only the payload is decoded; the signature is not checked."""

import base64
import json
import sys

payload = open(sys.argv[1]).read().strip().split('.')[1]
print(json.dumps(json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4))), indent=2))
```

```terminal
{
  "title": "the claims in a GitHub Actions OIDC token",
  "prompt": "$",
  "steps": [
    {
      "cmd": "umask 077; curl -sS -H @- \"$ACTIONS_ID_TOKEN_REQUEST_URL&audience=sts.amazonaws.com\" <<<\"Authorization: Bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN\" | jq -r .value > id-token.jwt"
    },
    {
      "cmd": "python3 part04/decode-jwt.py id-token.jwt | jq '{iss, aud, sub, repository, repository_id, repository_owner_id, environment, ref, job_workflow_ref, runner_environment}'",
      "output": "{\n  \"iss\": \"https://token.actions.githubusercontent.com\",\n  \"aud\": \"sts.amazonaws.com\",\n  \"sub\": \"repo:The-DevOps-Daily@212527617/guide-security-principles-demo-2026-10-27@1435986190:environment:production\",\n  \"repository\": \"The-DevOps-Daily/guide-security-principles-demo-2026-10-27\",\n  \"repository_id\": \"1435986190\",\n  \"repository_owner_id\": \"212527617\",\n  \"environment\": \"production\",\n  \"ref\": \"refs/heads/main\",\n  \"job_workflow_ref\": \"The-DevOps-Daily/guide-security-principles-demo-2026-10-27/.github/workflows/guide.yml@refs/heads/main\",\n  \"runner_environment\": \"github-hosted\"\n}"
    },
    {
      "cmd": "rm id-token.jwt"
    }
  ]
}
```

The `sub` (subject) claim is what the cloud's trust policy should match. For repositories created, renamed or transferred after July 15, 2026, GitHub includes the owner and repository IDs in the default subject (`The-DevOps-Daily@212527617/...@1435986190`), so a deleted and re-created repository with the same name cannot reuse the trust. Older repositories keep the name-only format unless their owner opts in. Copy the subject from a real token, as above, instead of writing it by hand.

The AWS role's trust policy accepts only this repository, only jobs in the `production` environment, and only tokens meant for AWS STS:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::111122223333:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:The-DevOps-Daily@212527617/guide-security-principles-demo-2026-10-27@1435986190:environment:production"
        }
      }
    }
  ]
}
```

The most common mistake is a wildcard subject such as `repo:my-org/*`, which lets every repository in the organization, and every branch and pull request workflow in it, assume the production role. Match the full subject with `StringEquals`, use GitHub environments with required reviewers for production, and give the role only what the deploy needs (Part 3).

The deploy workflow then has no stored cloud secret at all. This example is kept outside `.github/workflows` in the companion repository, so it never runs; the repository's own workflow checks it with actionlint:

```yaml
name: deploy

on:
  workflow_dispatch:
    inputs:
      image:
        description: 'Image to deploy, by digest (registry/shop-api@sha256:...)'
        required: true

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-26.04
    environment: production
    permissions:
      contents: read
      id-token: write # only this job can request an OIDC token
    env:
      IMAGE: ${{ inputs.image }}
    steps:
      - uses: sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6 # v4.1.2
        with:
          cosign-release: v3.1.4
      - name: Verify the image signature before deploying
        run: |
          cosign verify "$IMAGE" \
            --certificate-identity "https://github.com/${GITHUB_REPOSITORY}/.github/workflows/release.yml@refs/heads/main" \
            --certificate-oidc-issuer https://token.actions.githubusercontent.com > /dev/null
      - uses: aws-actions/configure-aws-credentials@e1253824e5c10ff9df46874f81ed3ec929e19cfd # v6.3.0
        with:
          role-to-assume: arn:aws:iam::111122223333:role/shop-deploy
          role-duration-seconds: 900
          aws-region: eu-west-1
      - name: Deploy the verified digest
        run: |
          case "$IMAGE" in *@sha256:*) ;; *) echo "deploy by digest only" >&2; exit 1 ;; esac
          aws eks update-kubeconfig --name shop --region eu-west-1
          kubectl -n shop set image deployment/api api="$IMAGE"
          kubectl -n shop rollout status deployment/api --timeout=300s
```

The workflow assumes a production Deployment that runs the code inside the image, like the image built in Part 2. The lab Deployment mounts its code from a ConfigMap only because the lab has no registry; in production such a mount would run code that the signature never covered. The zero trust details in that file: only the deploy job can request an OIDC token, actions are pinned to full commit SHAs, the image is accepted only by digest, and its signature is verified against the identity of the release workflow (signed keyless with Sigstore, using that workflow's own OIDC token) before the job even gets cloud credentials. The [hashing part of Cryptography Essentials](/guides/cryptography-essentials/02-hashing#h3-a-sigstore-signed-release) shows keyless verification with real output.

## A Practical Path

Do not try to "do zero trust" in one project. Pick a resource that matters and walk it through the stages:

| Stage       | Identity                          | Devices                      | Network and workloads                       | Data                                  |
| ----------- | --------------------------------- | ---------------------------- | ------------------------------------------- | ------------------------------------- |
| Traditional | Passwords, shared admin accounts  | Unmanaged                    | Flat network, VPN grants full access        | Unclassified                          |
| Initial     | SSO and MFA for most apps         | Inventory of company devices | Some segmentation, TLS at the edge          | Sensitive data identified             |
| Advanced    | Phishing-resistant MFA, JIT admin | Posture checked at sign-in   | Per-service identity, mTLS, deny by default | Encryption and access logs by class   |
| Optimal     | Continuous, risk-based decisions  | Posture checked continuously | Every request authorized by identity        | Automated classification and controls |

For the ticket shop, a reasonable order is: SSO with passkeys for staff and admin pages, then OIDC for the pipeline (removing the most valuable stored secret), then mTLS and identity-based policies for the database, then device posture for the admin tools. Each step is useful on its own.

## Checklist

- [ ] Staff sign in through SSO with phishing-resistant MFA; no shared accounts.
- [ ] Admin and production access is just-in-time and approved, not standing.
- [ ] Devices that reach internal tools are managed, encrypted and supported.
- [ ] Workloads have their own identities (service accounts, cloud roles), never shared.
- [ ] Service-to-service traffic uses mTLS, and policies name identities, not IPs or labels.
- [ ] Every protected path rejects requests without a token, and you test that case.
- [ ] CI/CD uses OIDC with exact subjects; no long-lived cloud keys in CI secrets.
- [ ] Access decisions and denials are logged centrally and alerted on.

## Common Mistakes

- **Buying a product and calling it zero trust.** A VPN replacement that still grants broad network access after login is a smaller perimeter, not zero trust.
- **Trusting labels, IPs or "internal" networks** as proof of identity.
- **`RequestAuthentication` without an authorization rule**, so requests without a token pass.
- **Wildcard OIDC subjects** that let any repository or branch assume a production role.
- **MFA that can be phished or fatigued** (SMS codes, push approvals) on admin accounts.
- **Breaking production with a big-bang rollout.** Start with permissive or audit modes (Istio's `PERMISSIVE` mTLS, policies in a dry-run mode where available), watch the logs, then enforce.
- **Ignoring user experience.** If the secure path is slower than the workaround, people use the workaround. SSO and passkeys are both more secure and faster.

## Summary

- Zero trust removes trust based on network location: every request proves an identity and is authorized by policy.
- **Labels and IPs are not identity.** A copied label passed the NetworkPolicy; a certificate bound to a service account did not.
- **Istio ambient mode** gives every workload an mTLS identity without sidecars; NetworkPolicies must allow its HBONE port 15008.
- **`STRICT` mTLS plus an `AuthorizationPolicy` by principal** lets only the right service accounts reach a service.
- **Check user tokens at the edge**, and remember that `RequestAuthentication` alone does not require one.
- **Devices and sessions**: phishing-resistant MFA, posture checks, short sessions and step-up for sensitive actions.
- **CI/CD**: OIDC with an exact subject replaces stored cloud keys.

## Keep Learning

- [Mutual TLS in the Cryptography Essentials guide](/guides/cryptography-essentials/03-tls-ssl#h2-mutual-tls-mtls)
- [Mutual TLS in the Networking Fundamentals guide](/guides/networking-fundamentals/04-network-security-and-firewalls-basics#h2-above-the-packets-mutual-tls)
- [Software integrity failures in the OWASP Top 10 guide](/guides/owasp-top-10/08-software-integrity-failures)
- [CI/CD Pipeline Hardening: A Practical Guide](/posts/cicd-pipeline-hardening-guide)
- [Istio Traffic Management: Routing, Retries and Circuit Breaking](/posts/istio-traffic-management-routing-retries-circuit-breaking)
- [We Took Down Our Mesh VPN Control Plane. Here Is What Kept Working](/posts/mesh-vpn-control-plane-outage-what-keeps-working)
- [Interview questions: zero trust architecture](/interview-questions/senior/zero-trust-architecture)
- Back to the [Security Principles overview](/guides/security-principles)
