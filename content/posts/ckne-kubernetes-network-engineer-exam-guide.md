---
title: 'CKNE Is Live: What the Kubernetes Network Engineer Exam Tests and How to Practice'
excerpt: 'CKNE is a new hands-on Kubernetes networking exam. Use its published domains to build a lab, rehearse packet-level debugging, and turn DNS, traffic, policy, encryption, and observability into timed terminal drills.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-11-13'
publishedAt: '2026-11-13T07:00:00Z'
updatedAt: '2026-11-13T07:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Kubernetes
  - Networking
  - Certification
  - CKNE
  - Gateway API
  - Network Policy
  - CNCF
---

Kubernetes networking failures rarely announce which layer is wrong. A Service can have no ready endpoints, a policy can block DNS, a route can point at the wrong interface, or a Gateway can accept a listener but reject the route. The new **Certified Kubernetes Network Engineer (CKNE)** asks you to find and fix problems like these from a terminal under time pressure. This guide turns the published curriculum into drills you can repeat in a disposable cluster.

This is not an account of taking the exam. It is a study guide built from the [published CKNE curriculum](https://training.linuxfoundation.org/certification/certified-kubernetes-network-engineer-ckne/) and the [CNCF launch announcement](https://www.cncf.io/announcements/2026/11/10/cncf-launches-certified-kubernetes-network-engineer-certification-ckne-to-advance-production-ready-networking-skills-for-ai-era/). Treat every lab as a loop: break one thing deliberately, prove where the packet stops, repair it, then retest from the client.

## TLDR

- CKNE is a performance-based, two-hour exam in a Linux remote desktop. Its largest domains are Service Networking and DNS, and Network Security and Policy, at 25% each.
- Start with CKA-level cluster administration. There are no formal prerequisites, but both CNCF and Linux Foundation Education say the exam assumes that baseline.
- Build one lab with a real policy-enforcing CNI. Then practice resolving a name, examining EndpointSlices, reading node routes, applying a policy, and observing the resulting flow without reaching for a GUI first.
- As of 2026-11-11, the official exam page does not publish a passing score, Kubernetes version, or number of tasks. Check the [candidate handbook and FAQ](https://training.linuxfoundation.org/certification/certified-kubernetes-network-engineer-ckne/) before booking.

## Prerequisites

- CKA-level comfort with `kubectl`: contexts, namespaces, Deployments, Services, logs, and `describe`.
- A workstation that can run a three-node [kind](https://kind.sigs.k8s.io/) cluster in Docker or Podman.
- `kubectl`, `kind`, and the [Cilium CLI](https://docs.cilium.io/en/stable/gettingstarted/k8s-install-default/) installed.
- Basic Linux networking: `ip`, `ss`, `tcpdump`, and reading a route table.

## What CKNE tests, and whether it fits you

CKNE is for an administrator who already knows how to inspect workloads and cluster resources, and now needs to reason about the data path between them. It has no prerequisite certification, but doing CKA first is a sensible order because a networking drill should not also be a `kubectl` syntax drill.

The Linux Foundation lists the exam-only price as $445, the exam plus THRIVE-ONE annual subscription as $625, and the exam plus Certification Pathway as $645. Eligibility lasts 12 months, one retake is included, and the certification is valid for two years. Those are purchase decisions, not study requirements. The useful practice resource bundled with the exam is the Killer.sh simulator: it provides two sessions, each with 17 questions and 36 hours of access. Use those sessions late in preparation to test navigation, pacing, and recovery after a bad assumption, not as your first exposure to a CNI or Gateway API.

```chart
{
  "type": "bar",
  "title": "CKNE published domain weights",
  "unit": "%",
  "caption": "Published by Linux Foundation Education and CNCF. Checked 2026-11-11.",
  "rows": [
    { "label": "Core Infrastructure and CNI", "value": 15 },
    { "label": "Service Networking and DNS", "value": 25 },
    { "label": "Advanced Traffic Management", "value": 20 },
    { "label": "Network Security and Policy", "value": 25 },
    { "label": "Observability", "value": 15 }
  ]
}
```

Warm up concepts in the browser before you open the terminal. The [Kubernetes networking and CNI simulator](/games/kubernetes-networking-cni-simulator) traces pod, Service, policy, egress, and ingress paths across overlay, routed, and eBPF dataplanes. Use the [DNS simulator](/games/dns-simulator) for resolver and cache order, [Packet Journey](/games/packet-journey) for packet headers and hops, and [TCP vs UDP](/games/tcp-vs-udp) when you need to refresh transport behavior. The [load balancer simulator](/games/load-balancer-simulator) is useful for endpoint-selection intuition. For mTLS and policy, use the [service mesh simulator](/games/service-mesh-simulator) and [SSL/TLS handshake simulator](/games/ssl-tls-handshake). They are warm-ups, not substitutes for command-line verification.

## Build a practice cluster that can fail interestingly

You need a cluster where NetworkPolicy and encryption actually have an effect. `kind` can start without its default CNI, and Cilium can then supply policy enforcement and WireGuard encryption. The [kind configuration reference](https://kind.sigs.k8s.io/docs/user/configuration/) documents both `disableDefaultCNI` and `podSubnet`; Cilium documents the encryption settings below.

```yaml
# ckne-kind.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  disableDefaultCNI: true
  podSubnet: '10.244.0.0/16'
nodes:
  - role: control-plane
  - role: worker
  - role: worker
```

```bash
kind create cluster --name ckne --config ckne-kind.yaml

# Installs Cilium, turns on policy enforcement, and encrypts eligible
# cross-node Cilium endpoint traffic with WireGuard.
cilium install \
  --set encryption.enabled=true \
  --set encryption.type=wireguard
cilium status --wait
```

WireGuard encrypts Cilium-managed traffic between nodes, not traffic on the same node. Confirm the control plane before trusting the lab:

```bash
kubectl -n kube-system exec ds/cilium -- cilium-dbg status | grep Encryption
kubectl get nodes -o wide
kubectl get pods -A
```

For a second interface exercise, install Multus and create a `NetworkAttachmentDefinition`, whose API version is `k8s.cni.cncf.io/v1`. A pod requests it with the `k8s.v1.cni.cncf.io/networks` annotation. The [Multus quickstart](https://k8snetworkplumbingwg.github.io/multus-cni/docs/quickstart.html) shows this attachment model and verifies the additional `net1` interface. Do not memorize the YAML in isolation: check `ip addr` and `ip route` in the pod and ask which interface owns the default route.

```yaml
apiVersion: k8s.cni.cncf.io/v1
kind: NetworkAttachmentDefinition
metadata:
  name: lab-net
spec:
  config: '{"cniVersion":"1.0.0","type":"macvlan","master":"eth1","mode":"bridge","ipam":{"type":"host-local","subnet":"192.0.2.0/24"}}'
---
apiVersion: v1
kind: Pod
metadata:
  name: dual-homed
  annotations:
    k8s.v1.cni.cncf.io/networks: lab-net
spec:
  containers:
    - name: shell
      image: busybox
      command: ['sh', '-c', 'sleep 3600']
```

The NAD is only a definition. The secondary CNI and its node-level prerequisites must exist first, so use the Multus documentation for the plugin you choose. That distinction is a good troubleshooting habit.

## Practice every published domain as a terminal drill

### Core Infrastructure and CNI: trace before changing

Know how pod CIDRs are allocated by your lab CNI, which node owns a destination CIDR, and whether traffic is routed or encapsulated. Under a clock, start with `kubectl get nodes -o wide`, pod IPs, and routes before changing any YAML.

Use an ephemeral node debug container to inspect the host network namespace. `ip route` and `ip addr` tell you what the node believes. A capture on port 53 separates a DNS transport problem from a bad record or bad search path.

```bash
# Open a shell in the node's network namespace (pick an image that ships tcpdump)
kubectl debug node/<node> -it --image=nicolaka/netshoot --profile=sysadmin

# What does the node believe about addresses and routes?
ip addr
ip route

# Watch DNS on every interface while a pod resolves a name
tcpdump -ni any port 53
```

Be able to distinguish kube-proxy modes from CNI service replacements. Inspect the actual cluster configuration before assuming `iptables` rules explain a Service. Kubernetes supports `iptables` and `nftables` modes, while the [Kubernetes 1.37 release guide](/posts/kubernetes-1-37-garhwal-what-shipped) covers why `ipvs` is deprecated and should not be the new thing you learn for this exam.

### Service Networking and DNS: prove the backend set

For every Service type, state what it exposes and how a client reaches it: `ClusterIP` is cluster-internal virtual addressing, `NodePort` exposes a port on node addresses, `LoadBalancer` relies on an implementation to expose it externally, and a headless Service has no cluster IP for virtual-IP proxying. Then inspect the real backend set:

```bash
kubectl get svc payments -o yaml
kubectl get endpointslices \
  -l kubernetes.io/service-name=payments \
  -o yaml
kubectl get pods -l app=payments
```

EndpointSlices are the source of Service backends that a proxy watches, and a Pod's readiness maps to the endpoint's readiness condition. Make one backend unready and watch the slice change. For external traffic, set `externalTrafficPolicy: Local` on a NodePort or LoadBalancer test Service, send traffic to a node without a local endpoint, and explain the drop. `Local` preserves source IP by forwarding only to node-local endpoints, so it exchanges reachability on every node for that property. The [Kubernetes Service documentation](https://kubernetes.io/docs/concepts/services-networking/service/) and [EndpointSlice documentation](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/) define those behaviors.

DNS should be its own timed drill. From a pod, resolve a full Service name, inspect `/etc/resolv.conf`, then try the short name. Kubernetes commonly configures search domains and `options ndots:5`; read the file in the workload instead of assuming a particular setting.

```bash
# The dnsutils pod from the Kubernetes DNS debugging guide
kubectl apply -f https://k8s.io/examples/admin/dns/dnsutils.yaml
kubectl exec -it dnsutils -- cat /etc/resolv.conf
kubectl exec -it dnsutils -- nslookup kubernetes.default.svc.cluster.local
kubectl exec -it dnsutils -- nslookup kubernetes.default

kubectl -n kube-system get configmap coredns -o yaml
kubectl -n kube-system logs -l k8s-app=kube-dns
```

For a configuration drill, edit the CoreDNS ConfigMap in a disposable cluster and add a name rewrite inside the existing server block, before the `kubernetes` plugin. The [CoreDNS rewrite plugin](https://coredns.io/plugins/rewrite/) documents the syntax.

```text
rewrite name suffix example.internal default.svc.cluster.local
```

That maps `payments.example.internal` to `payments.default.svc.cluster.local`. Restart the CoreDNS deployment if your distribution does not reload the Corefile, then test both names. Also find its metrics endpoint in the installed Corefile before deciding that a dashboard is a DNS diagnosis. Kubernetes has a useful [DNS debugging sequence](https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/) for this exact progression.

### Advanced Traffic Management: make the controller part explicit

Install the Gateway API Standard channel from its current release URL, then use the `GatewayClass` supplied by the controller you installed. CRDs alone do not route traffic. The [Gateway API installation guide](https://gateway-api.sigs.k8s.io/guides/getting-started/introduction/) publishes this current Standard-channel command:

```bash
kubectl apply --server-side -f \
  https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.7.0/standard-install.yaml
```

Next, create a path match and a weighted split. Replace `<gateway-class>` with an installed class and create `api-tls` as a TLS Secret before applying the Gateway. The listener's Secret reference is the important TLS troubleshooting surface.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: public
spec:
  gatewayClassName: <gateway-class>
  listeners:
    - name: https
      protocol: HTTPS
      port: 443
      hostname: api.example.com
      tls:
        mode: Terminate
        certificateRefs:
          - kind: Secret
            name: api-tls
      allowedRoutes:
        namespaces:
          from: Same
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api
spec:
  parentRefs:
    - name: public
  hostnames: ['api.example.com']
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /v1
      backendRefs:
        - name: api-v1
          port: 8080
          weight: 90
        - name: api-v2
          port: 8080
          weight: 10
```

Check `kubectl describe gateway public` and `kubectl describe httproute api`; accepted objects and programmed addresses are separate questions. If you are migrating from Ingress, see [our Gateway API migration guide](/posts/ingress-nginx-eol-gateway-api-migration) for a controller-aware cutover.

LLM traffic belongs here, but do not reduce it to weighted HTTP backends. The [Gateway API Inference Extension](https://gateway-api-inference-extension.sigs.k8s.io/) currently documents the `InferencePool` API (v1) and an alpha `InferencePoolImport` and describes endpoint selection using model-serving metrics and capabilities. Practice explaining why model-aware selection can consider a model name, cache state, or adapter availability. Treat its APIs as extension APIs and verify your controller's support and release status before using them in an answer.

For cluster exit traffic, Cilium's implementation is `CiliumEgressGatewayPolicy`: select source pods and external destination CIDRs, then select a gateway node and egress IP or interface. It needs BPF masquerading and kube-proxy replacement, and is not compatible with Cilium ClusterMesh. For cross-cluster service discovery, the [Multi-Cluster Services API](https://multicluster.sigs.k8s.io/concepts/multicluster-services-api/) uses `ServiceExport` to mark a Service for export and creates `ServiceImport` plus EndpointSlices in consuming clusters. Cilium ClusterMesh is another implementation path; before working through it, read [the policy-default change that can block cross-cluster traffic](/posts/cilium-1-19-clustermesh-policy-flip).

### Network Security and Policy: deny, restore DNS, then prove it

Start a namespace with both ingress and egress default-deny. Then permit only what the workload needs. The classic failure is to allow application traffic while forgetting DNS egress.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: lab
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: lab
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
```

The label and namespace are cluster conventions, so inspect your DNS Service and Pods before applying this unchanged. Test from a labeled client pod, first expecting a timeout, then allowing the target Service on its actual port and running `curl -sv http://<service>.<namespace>.svc.cluster.local:<port>/`. Kubernetes defines NetworkPolicy as an API, but the chosen network plugin must enforce it. The [NetworkPolicy documentation](https://kubernetes.io/docs/concepts/services-networking/network-policies/) is the baseline for the API semantics.

Encryption is not proof of authorization. In this Cilium lab, confirm WireGuard with `cilium-dbg status | grep Encryption`, and capture on `cilium_wg0` from a Cilium pod if you need to see the tunnel. Cilium documents the status check, tunnel device, and the fact that same-node traffic is not encrypted in its [WireGuard guide](https://docs.cilium.io/en/stable/security/network/encryption-wireguard/).

For pod-level identity, use a service mesh. An Istio `AuthorizationPolicy` can allow only a workload identity after mTLS identifies the caller. This is a compact policy drill, not a complete mesh install:

```yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: allow-frontend
  namespace: lab
spec:
  selector:
    matchLabels:
      app: payments
  action: ALLOW
  rules:
    - from:
        - source:
            principals:
              - cluster.local/ns/lab/sa/frontend
```

Verify the calling ServiceAccount and the mesh's mTLS mode before deciding a denial is an authorization error. Istio documents this defense-in-depth mTLS pattern in its [security policy examples](https://istio.io/latest/docs/ops/configuration/security/security-policy-examples/). For route behavior, retries, and traffic splits in a mesh, revisit [our Istio traffic-management guide](/posts/istio-traffic-management-routing-retries-circuit-breaking).

### Observability: observe the flow that proves the fix

Your final action should produce evidence. For DNS, inspect CoreDNS logs and the Prometheus metrics configured by its `prometheus` plugin. For Services, inspect EndpointSlices and, where relevant, kube-proxy metrics from the endpoint that your cluster exposes. For policy enforcement in Cilium, use Hubble to request the flows you care about:

```bash
hubble observe --pod client --verdict DROPPED
hubble observe --namespace lab --protocol http
kubectl -n kube-system exec ds/cilium -- cilium-dbg status
```

The [Hubble CLI documentation](https://docs.cilium.io/en/latest/observability/hubble/hubble-cli/) verifies the `--pod` and `--verdict DROPPED` form. Trace a request through a Gateway by sending a request ID such as `X-Request-ID` from the client, then find that header in the gateway and application telemetry only if those components are configured to record it. A header alone does not create distributed tracing.

## A six-week plan and exam-day routine

Use the weights to bias your time, while returning to old drills often enough that command recall becomes automatic.

| Week | Focus                         | Deliverable                                                                                                         |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1    | Core Infrastructure and CNI   | Explain one same-node and one cross-node packet path with routes and captures.                                      |
| 2    | Service Networking and DNS    | Repair an empty EndpointSlice, a readiness issue, and a broken DNS lookup.                                          |
| 3    | Network Security and Policy   | Build default-deny, restore DNS, allow one application path, and prove both allowed and denied flows.               |
| 4    | Advanced Traffic Management   | Configure Gateway plus HTTPRoute, TLS Secret reference, weighted backends, and one egress or multi-cluster concept. |
| 5    | Observability plus weak spots | Correlate CoreDNS, Service, Hubble, and Gateway evidence for one injected fault.                                    |
| 6    | Timed mixed drills            | Use the two Killer.sh sessions as realistic pacing checks and catalogue every command you had to look up.           |

On exam day, the published format gives you 120 minutes in a Linux remote desktop with terminal and web interfaces. Spend the opening minutes inventorying contexts, namespaces, nodes, and the resources named by the task. Read status conditions before edits. Use a short loop for each task: observe, form one hypothesis, make the smallest change, and prove the result from the client side. Do not invent browser-tab or reference-material rules from hearsay. The official policies and candidate materials, not a study blog, decide those details.

The goal is not to memorize every CNI's settings. It is to see a network problem as a chain of claims you can test: name resolves, Service has ready endpoints, dataplane has a route, policy permits it, encryption is configured where expected, and logs or flows show the result.
