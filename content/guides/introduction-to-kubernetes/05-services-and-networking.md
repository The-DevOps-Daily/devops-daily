---
title: 'Kubernetes Services, DNS and Gateway API Explained'
description: 'Give pods a stable address with Kubernetes Services and DNS, compare ClusterIP, NodePort and LoadBalancer, and route HTTP with Gateway API, not Ingress.'
order: 5
---

**TLDR**: A **Service** gives a changing set of pods one stable virtual IP and DNS name (`podinfo.demo.svc.cluster.local`) and spreads connections over the pods that are ready. `ClusterIP` Services are reachable inside the cluster, `NodePort` and `LoadBalancer` Services from outside. For HTTP from outside, use **Gateway API**: a `Gateway` owned by the platform team and `HTTPRoute`s owned by app teams. The Ingress API still works, but the most popular controller for it, ingress-nginx, was retired in March 2026.

In this part you put a Service in front of the podinfo Deployment, look at the EndpointSlices and DNS records behind it, expose it as a NodePort and a LoadBalancer, then route it through a Gateway and split traffic between a stable version and a canary.

## Prerequisites

- The podinfo Deployment from [Part 4](/guides/introduction-to-kubernetes/04-deployments-and-replicasets), running 6.15.0 with three replicas.
- If you start here on a new cluster, run `kubectl apply -f 04-deployments/deployment.yaml` and then `kubectl set image deployment/podinfo podinfo=ghcr.io/stefanprodan/podinfo:6.15.0`.

## The Kubernetes Network Model

Kubernetes requires a flat network: every pod gets its own IP address, and every pod can reach every other pod on any node without NAT. The network plugin (kindnet on kind; Cilium, Calico or the cloud provider's plugin elsewhere) builds that network. By default nothing is blocked; NetworkPolicies ([Part 10](/guides/introduction-to-kubernetes/10-best-practices-in-kubernetes)) restrict it.

Pod IPs change whenever pods are replaced, so clients should never use them. A Service solves that:

```diagram
{
  "type": "graph",
  "columns": [
    [{ "id": "client", "label": "client pod", "sub": "curl http://podinfo", "icon": "cpu", "tone": "slate", "detail": "Resolves podinfo through cluster DNS and connects to the Service's virtual IP." }],
    [{ "id": "dns", "label": "CoreDNS", "sub": "podinfo.demo.svc", "icon": "globe", "tone": "violet", "detail": "Returns the Service's ClusterIP, which never changes while the Service exists." }],
    [{ "id": "svc", "label": "Service podinfo", "sub": "ClusterIP :80", "icon": "net", "tone": "accent", "detail": "A virtual IP. kube-proxy's rules on every node rewrite connections to it to a pod IP on port 9898." }],
    [{ "id": "es", "label": "EndpointSlice", "sub": "pod IPs + ready", "icon": "gear", "tone": "slate", "detail": "Kept up to date by a controller from the pods that match the selector app=podinfo, with a ready condition for each; only ready endpoints get new connections." }],
    [
      { "id": "p1", "label": "pod 1", "sub": ":9898", "icon": "pod", "tone": "green" },
      { "id": "p2", "label": "pod 2", "sub": ":9898", "icon": "pod", "tone": "green" },
      { "id": "p3", "label": "pod 3", "sub": ":9898", "icon": "pod", "tone": "green" }
    ]
  ],
  "edges": [["client", "dns", "lookup"], ["dns", "svc", "ClusterIP"], ["svc", "es"], ["es", "p1"], ["es", "p2"], ["es", "p3"]]
}
```

## A ClusterIP Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: podinfo
  labels:
    app: podinfo
spec:
  type: ClusterIP # the default: a stable virtual IP inside the cluster
  selector:
    app: podinfo # send traffic to ready pods with this label
  ports:
    - name: http
      port: 80 # the port clients connect to
      targetPort: http # the named container port (9898)
```

`port` is what clients connect to, and `targetPort` is where the pods listen. Here `targetPort` names the container port `http` from the Deployment, so the Service keeps working if the port number in the pods changes. ([More on port and targetPort](/posts/difference-between-targetport-and-port-in-kubernetes-service-definition).)

```terminal
{
  "title": "create the Service",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 05-networking/service.yaml",
      "output": "service/podinfo created"
    },
    {
      "cmd": "kubectl get service podinfo",
      "output": "NAME      TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE\npodinfo   ClusterIP   10.96.57.250   <none>        80/TCP    0s"
    },
    {
      "cmd": "kubectl get endpointslices -l kubernetes.io/service-name=podinfo",
      "output": "NAME            ADDRESSTYPE   PORTS   ENDPOINTS                          AGE\npodinfo-5gmh2   IPv4          9898    10.244.2.4,10.244.2.3,10.244.1.4   0s"
    }
  ]
}
```

The **EndpointSlice** lists the IPs of the pods that match the selector, with a `ready` condition for each. Services send new connections only to ready endpoints, so a pod that fails its readiness probe stays in the slice, marked not ready, and gets no new traffic, which you will see happen in [Part 9](/guides/introduction-to-kubernetes/09-monitoring-and-logging-in-kubernetes). The older `Endpoints` object still exists, but it is deprecated since Kubernetes 1.33, and kubectl says so:

```bash
kubectl get endpoints podinfo
```

```text
Warning: v1 Endpoints is deprecated in v1.33+; use discovery.k8s.io/v1 EndpointSlice
NAME      ENDPOINTS                                         AGE
podinfo   10.244.1.4:9898,10.244.2.3:9898,10.244.2.4:9898   0s
```

Call the Service from a client pod inside the cluster. Each new connection can go to a different pod:

```terminal
{
  "title": "reach the Service",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl run client --image=curlimages/curl:8.23.0 --command -- sleep infinity",
      "output": "pod/client created"
    },
    {
      "cmd": "kubectl wait --for=condition=Ready pod/client",
      "output": "pod/client condition met"
    },
    {
      "cmd": "kubectl exec client -- curl -s http://podinfo/version",
      "output": "{\n  \"commit\": \"dd507173b7b75b2312a36cabe0de5f09c1ce69c8\",\n  \"version\": \"6.15.0\"\n}"
    },
    {
      "cmd": "kubectl exec client -- sh -c 'for i in $(seq 1 30); do curl -s http://podinfo | grep hostname; done' | sort | uniq -c",
      "output": "      6   \"hostname\": \"podinfo-69c9f58845-26bjp\",\n     14   \"hostname\": \"podinfo-69c9f58845-87k8t\",\n     10   \"hostname\": \"podinfo-69c9f58845-zmr2f\","
    }
  ]
}
```

The spread is random per connection, not a strict round robin. Services balance connections, not requests: a client that keeps one long-lived connection (HTTP/2, gRPC, a database pool) stays on one pod.

## Service DNS

CoreDNS gives every Service a name of the form `<service>.<namespace>.svc.cluster.local`. Inside the same namespace the short name `podinfo` works, and from another namespace `podinfo.demo`:

```terminal
{
  "title": "DNS",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl exec client -- nslookup podinfo.demo.svc.cluster.local",
      "output": "Server:\t\t10.96.0.10\nAddress:\t10.96.0.10:53\n\n\nName:\tpodinfo.demo.svc.cluster.local\nAddress: 10.96.57.250"
    },
    {
      "cmd": "kubectl exec client -- curl -s http://podinfo.demo/version",
      "output": "{\n  \"commit\": \"dd507173b7b75b2312a36cabe0de5f09c1ce69c8\",\n  \"version\": \"6.15.0\"\n}"
    },
    {
      "cmd": "kubectl exec client -- cat /etc/resolv.conf",
      "output": "search demo.svc.cluster.local svc.cluster.local cluster.local zmyzvxavmmhuxfwfjw5bpftufc.bx.internal.cloudapp.net\nnameserver 10.96.0.10\noptions ndots:5"
    }
  ]
}
```

The search list in `/etc/resolv.conf` is what makes short names work, and `ndots:5` means that any name with fewer than five dots is tried with each search suffix first. A lookup for an external name such as `api.example.com` therefore asks CoreDNS several questions before the real one. If DNS load matters, use fully qualified names with a trailing dot (`api.example.com.`) or lower `ndots` in the pod's `dnsConfig`. The last search domain comes from the node; here it is the GitHub-hosted runner's domain.

Kubernetes also injects `PODINFO_SERVICE_HOST`-style environment variables for Services that existed before a pod started. Use DNS instead; the variables do not update and leak details between apps.

## Service Types

| Type                         | Reachable from                           | Typical use                                                                                                                 |
| ---------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `ClusterIP`                  | Inside the cluster                       | Everything internal; the default                                                                                            |
| `NodePort`                   | Every node's IP on a port 30000 to 32767 | Testing, or behind your own load balancer                                                                                   |
| `LoadBalancer`               | A load balancer the cloud creates        | Exposing one service to the internet or a private network                                                                   |
| `ExternalName`               | Inside the cluster, as a DNS alias       | Giving an external host a name inside the cluster                                                                           |
| Headless (`clusterIP: None`) | DNS only, one record per pod             | StatefulSets, client-side load balancing ([Part 7](/guides/introduction-to-kubernetes/07-persistent-storage-in-kubernetes)) |

:::warning
A NodePort or LoadBalancer Service exposes every path the app serves. podinfo has debug endpoints such as `/env`, `/panic` and `/cache` that anyone who reaches it can call. On a cloud cluster a LoadBalancer is usually on the internet, so expose apps through a Gateway that routes only the paths clients need (below), and delete the test Services at the end of this part.
:::

### NodePort

```yaml
apiVersion: v1
kind: Service
metadata:
  name: podinfo-nodeport
spec:
  type: NodePort
  selector:
    app: podinfo
  ports:
    - name: http
      port: 80
      targetPort: http
      nodePort: 30080 # must be in 30000-32767; kind-config.yaml maps it to localhost
```

kind's config from Part 2 maps port 30080 of the control plane container to your machine, so you can reach the NodePort on `localhost`:

```terminal
{
  "title": "NodePort",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 05-networking/service-nodeport.yaml",
      "output": "service/podinfo-nodeport created"
    },
    {
      "cmd": "kubectl get service podinfo-nodeport",
      "output": "NAME               TYPE       CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE\npodinfo-nodeport   NodePort   10.96.250.157   <none>        80:30080/TCP   0s"
    },
    {
      "cmd": "curl -sf --retry 10 --retry-all-errors --retry-delay 1 localhost:30080/version",
      "output": "{\n  \"commit\": \"dd507173b7b75b2312a36cabe0de5f09c1ce69c8\",\n  \"version\": \"6.15.0\"\n}"
    }
  ]
}
```

`80:30080/TCP` means Service port 80 is also open on port 30080 of every node. curl retries because kube-proxy needs a moment to program the new port; `-f` turns HTTP errors into failures so they are retried too. kube-proxy on the control plane node forwards the connection to a podinfo pod on one of the workers.

### LoadBalancer

On a cloud cluster, a `LoadBalancer` Service makes the cloud controller manager create a load balancer and write its address into the Service. On DigitalOcean Kubernetes that is a DigitalOcean Load Balancer, configured with `service.beta.kubernetes.io/do-loadbalancer-*` annotations and billed while it exists. On kind nothing creates one, so the address stays `<pending>` ([why a LoadBalancer stays pending](/posts/kubernetes-service-external-ip-pending)):

```yaml
apiVersion: v1
kind: Service
metadata:
  name: podinfo-lb
spec:
  type: LoadBalancer
  selector:
    app: podinfo
  ports:
    - name: http
      port: 80
      targetPort: http
```

```terminal
{
  "title": "a LoadBalancer without a cloud",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 05-networking/service-lb.yaml",
      "output": "service/podinfo-lb created"
    },
    {
      "cmd": "kubectl get service podinfo-lb",
      "output": "NAME         TYPE           CLUSTER-IP     EXTERNAL-IP   PORT(S)        AGE\npodinfo-lb   LoadBalancer   10.96.91.185   <pending>     80:30638/TCP   0s"
    }
  ]
}
```

[cloud-provider-kind](https://github.com/kubernetes-sigs/cloud-provider-kind) fills that gap for local clusters. It runs as a Docker container next to the cluster, gives `LoadBalancer` Services an address on the kind Docker network, and also implements Gateway API. Start it (on Linux it may need `sudo` for the Docker socket):

```terminal
{
  "title": "cloud-provider-kind",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker run -d --name cloud-provider-kind --rm --network host -v /var/run/docker.sock:/var/run/docker.sock registry.k8s.io/cloud-provider-kind/cloud-controller-manager:v0.12.0",
      "output": "66d438ef52a9279ebcb5ccda73882d04c8289a9c9ee02d1dfa701a76e977685c"
    },
    {
      "cmd": "kubectl wait --for=jsonpath='{.status.loadBalancer.ingress}' service/podinfo-lb --timeout=120s",
      "output": "service/podinfo-lb condition met"
    },
    {
      "cmd": "kubectl get service podinfo-lb",
      "output": "NAME         TYPE           CLUSTER-IP     EXTERNAL-IP   PORT(S)        AGE\npodinfo-lb   LoadBalancer   10.96.91.185   172.18.0.5    80:30638/TCP   6s"
    },
    {
      "cmd": "LB_IP=$(kubectl get service podinfo-lb -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
    },
    {
      "cmd": "curl -sf --retry 10 --retry-all-errors --retry-delay 1 http://$LB_IP/version",
      "output": "{\n  \"commit\": \"dd507173b7b75b2312a36cabe0de5f09c1ce69c8\",\n  \"version\": \"6.15.0\"\n}"
    }
  ]
}
```

On Linux you can reach the `172.18.0.x` address directly, and from WSL 2 on Windows too. On macOS, Docker runs in a VM and that address is not reachable from your computer; cloud-provider-kind then maps each load balancer to a port on `localhost` (`docker ps` shows it on a container named `kindccm-...`). The simpler way on macOS is to run curl itself in a container on the kind network, as shown for the Gateway below.

## Gateway API

A LoadBalancer per Service gets expensive and gives you no HTTP routing: no host names, no paths, no TLS in one place. That is what **Gateway API** is for. It is a set of Kubernetes APIs (CRDs maintained by the Kubernetes networking SIG) with three main resources, split by who owns them:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "GatewayClass", "sub": "which controller; infra provider", "icon": "gear", "tone": "slate" },
    { "label": "Gateway", "sub": "listeners, ports, TLS; platform team", "icon": "shield", "tone": "accent" },
    { "label": "HTTPRoute", "sub": "hosts, paths, backends; app team", "icon": "branch", "tone": "blue" },
    { "label": "Service", "sub": "podinfo", "icon": "net", "tone": "green" }
  ]
}
```

A Gateway controller turns these objects into a real proxy. Production clusters use Envoy Gateway, Cilium, Istio, NGINX Gateway Fabric, Traefik, kgateway or the cloud provider's own controller; cloud-provider-kind includes a small one and installs the Gateway API CRDs for you:

```terminal
{
  "title": "Gateway API on kind",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl wait --for=create --for=condition=Accepted gatewayclass/cloud-provider-kind --timeout=120s",
      "output": "gatewayclass.gateway.networking.k8s.io/cloud-provider-kind condition met\ngatewayclass.gateway.networking.k8s.io/cloud-provider-kind condition met"
    },
    {
      "cmd": "kubectl get gatewayclass",
      "output": "NAME                  CONTROLLER                            ACCEPTED   AGE\ncloud-provider-kind   kind.sigs.k8s.io/gateway-controller   True       2s"
    },
    {
      "cmd": "kubectl api-resources --api-group=gateway.networking.k8s.io",
      "output": "NAME                 SHORTNAMES   APIVERSION                     NAMESPACED   KIND\nbackendtlspolicies   btlspolicy   gateway.networking.k8s.io/v1   true         BackendTLSPolicy\ngatewayclasses       gc           gateway.networking.k8s.io/v1   false        GatewayClass\ngateways             gtw          gateway.networking.k8s.io/v1   true         Gateway\ngrpcroutes                        gateway.networking.k8s.io/v1   true         GRPCRoute\nhttproutes                        gateway.networking.k8s.io/v1   true         HTTPRoute\nlistenersets         lset         gateway.networking.k8s.io/v1   true         ListenerSet\nreferencegrants      refgrant     gateway.networking.k8s.io/v1   true         ReferenceGrant\ntcproutes                         gateway.networking.k8s.io/v1   true         TCPRoute\ntlsroutes                         gateway.networking.k8s.io/v1   true         TLSRoute\nudproutes                         gateway.networking.k8s.io/v1   true         UDPRoute"
    }
  ]
}
```

### The Gateway

The platform team owns the entry point. This Gateway listens for HTTP on port 80 for any host under `k8s-guide.example`, and only namespaces with the label `gateway-access: "true"` may attach routes to it:

```yaml
# Owned by the platform team: one shared entry point for the cluster
apiVersion: v1
kind: Namespace
metadata:
  name: gateway-infra
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: public
  namespace: gateway-infra
spec:
  gatewayClassName: cloud-provider-kind
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      hostname: '*.k8s-guide.example'
      allowedRoutes:
        namespaces:
          from: Selector # only namespaces with this label may attach routes
          selector:
            matchLabels:
              gateway-access: 'true'
```

### The HTTPRoute

The app team owns the route. It attaches to the Gateway and sends requests for `podinfo.k8s-guide.example` to the podinfo Service. It matches only `/` and `/version`, the two paths clients need; requests for podinfo's debug endpoints never reach the pods.

```yaml
# Owned by the app team: how requests for podinfo reach its Service
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: podinfo
spec:
  parentRefs:
    - name: public
      namespace: gateway-infra
  hostnames:
    - podinfo.k8s-guide.example
  rules:
    # Only the paths clients need. podinfo also has debug endpoints, such as
    # /env, /configs and /panic, that must never be reachable from outside.
    - matches:
        - path:
            type: Exact
            value: /
        - path:
            type: Exact
            value: /version
      backendRefs:
        - name: podinfo
          port: 80
```

```terminal
{
  "title": "route traffic through the Gateway",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 05-networking/gateway.yaml",
      "output": "namespace/gateway-infra created\ngateway.gateway.networking.k8s.io/public created"
    },
    {
      "cmd": "kubectl label namespace demo gateway-access=true",
      "output": "namespace/demo labeled"
    },
    {
      "cmd": "kubectl apply -f 05-networking/httproute.yaml",
      "output": "httproute.gateway.networking.k8s.io/podinfo created"
    },
    {
      "cmd": "kubectl wait --for=condition=Programmed gateway/public -n gateway-infra --timeout=120s",
      "output": "gateway.gateway.networking.k8s.io/public condition met"
    },
    {
      "cmd": "kubectl get gateway -n gateway-infra",
      "output": "NAME     CLASS                 ADDRESS      PROGRAMMED   AGE\npublic   cloud-provider-kind   172.18.0.6   True         1s"
    },
    {
      "cmd": "kubectl get httproute",
      "output": "NAME      HOSTNAMES                       AGE\npodinfo   [\"podinfo.k8s-guide.example\"]   1s"
    },
    {
      "cmd": "kubectl get httproute podinfo -o jsonpath='{range .status.parents[0].conditions[*]}{.type}={.status} ({.reason}){\"\\n\"}{end}'",
      "output": "Accepted=True (Accepted)\nResolvedRefs=True (ResolvedRefs)"
    }
  ]
}
```

`Accepted=True` means the Gateway allowed the route to attach, and `ResolvedRefs=True` means its backend Service exists. When a route does not work, these two conditions are the first place to look: a namespace without the label gives `Accepted=False` with the reason `NotAllowedByListeners`.

There is no DNS record for `podinfo.k8s-guide.example`, so tell curl which address to use for it:

```terminal
{
  "title": "call podinfo through the Gateway",
  "prompt": "$",
  "steps": [
    {
      "cmd": "GW_IP=$(kubectl get gateway public -n gateway-infra -o jsonpath='{.status.addresses[0].value}')"
    },
    {
      "cmd": "curl -sf --retry 10 --retry-all-errors --retry-delay 1 --resolve podinfo.k8s-guide.example:80:$GW_IP http://podinfo.k8s-guide.example/version",
      "output": "{\n  \"commit\": \"dd507173b7b75b2312a36cabe0de5f09c1ce69c8\",\n  \"version\": \"6.15.0\"\n}"
    },
    {
      "cmd": "curl -s -o /dev/null -w \"%{http_code}\\n\" --resolve podinfo.k8s-guide.example:80:$GW_IP http://podinfo.k8s-guide.example/env",
      "output": "404"
    },
    {
      "cmd": "curl -s -o /dev/null -w \"%{http_code}\\n\" --resolve other.k8s-guide.example:80:$GW_IP http://other.k8s-guide.example/",
      "output": "404"
    }
  ]
}
```

`/version` reaches podinfo, `/env` does not match the route, and a host without a route gets a 404 from the Gateway itself.

:::tip
On macOS, the Gateway's `172.18.0.x` address is inside Docker's VM. Run curl from a container attached to the `kind` Docker network instead; it reaches the same address, so you can use it for every `curl ... $GW_IP` command in this part and in Part 10:

```bash
alias kcurl='docker run --rm --network kind curlimages/curl:8.23.0'
kcurl -s --resolve podinfo.k8s-guide.example:80:$GW_IP http://podinfo.k8s-guide.example/version
```

:::

This run used the same container approach once, from Linux, to check that it works (Docker pulls the curl image first):

```bash
docker run --rm --network kind curlimages/curl:8.23.0 -s --resolve podinfo.k8s-guide.example:80:$GW_IP http://podinfo.k8s-guide.example/version
```

```text
Unable to find image 'curlimages/curl:8.23.0' locally
8.23.0: Pulling from curlimages/curl
3f72b3b77eb8: Pulling fs layer
3f72b3b77eb8: Verifying Checksum
3f72b3b77eb8: Download complete
3f72b3b77eb8: Pull complete
Digest: sha256:11e64e28c5f58c8d93ee95fcf22ac055f48b0bc440e0ce7d8013bbb5ad6aa8ac
Status: Downloaded newer image for curlimages/curl:8.23.0
{
  "commit": "dd507173b7b75b2312a36cabe0de5f09c1ce69c8",
  "version": "6.15.0"
}
```

In production you add an HTTPS listener with a certificate from a Secret (cert-manager can issue and renew it) and point a DNS record at the Gateway's address.

### A Canary Release with Weights

An HTTPRoute can split traffic between backends by weight. Deploy a canary of podinfo with its own Service and a different message, then send 10 percent of requests to it:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: podinfo-canary
  labels:
    app: podinfo-canary
spec:
  replicas: 1
  selector:
    matchLabels:
      app: podinfo-canary
  template:
    metadata:
      labels:
        app: podinfo-canary
    spec:
      containers:
        - name: podinfo
          image: ghcr.io/stefanprodan/podinfo:6.15.0
          env:
            - name: PODINFO_UI_MESSAGE
              value: canary
          ports:
            - name: http
              containerPort: 9898
          readinessProbe:
            httpGet:
              path: /readyz
              port: http
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              memory: 128Mi
---
apiVersion: v1
kind: Service
metadata:
  name: podinfo-canary
spec:
  selector:
    app: podinfo-canary
  ports:
    - name: http
      port: 80
      targetPort: http
```

```yaml
# The same route, now splitting traffic 90/10 between stable and canary
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: podinfo
spec:
  parentRefs:
    - name: public
      namespace: gateway-infra
  hostnames:
    - podinfo.k8s-guide.example
  rules:
    # Only the paths clients need. podinfo also has debug endpoints, such as
    # /env, /configs and /panic, that must never be reachable from outside.
    - matches:
        - path:
            type: Exact
            value: /
        - path:
            type: Exact
            value: /version
      backendRefs:
        - name: podinfo
          port: 80
          weight: 90
        - name: podinfo-canary
          port: 80
          weight: 10
```

```terminal
{
  "title": "90/10 traffic split",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 05-networking/canary.yaml",
      "output": "deployment.apps/podinfo-canary created\nservice/podinfo-canary created"
    },
    {
      "cmd": "kubectl rollout status deployment/podinfo-canary",
      "output": "Waiting for deployment \"podinfo-canary\" rollout to finish: 0 of 1 updated replicas are available...\ndeployment \"podinfo-canary\" successfully rolled out"
    },
    {
      "cmd": "kubectl apply -f 05-networking/httproute-canary.yaml",
      "output": "httproute.gateway.networking.k8s.io/podinfo configured"
    },
    {
      "cmd": "sleep 10"
    },
    {
      "cmd": "for i in $(seq 1 200); do curl -s --resolve podinfo.k8s-guide.example:80:$GW_IP http://podinfo.k8s-guide.example/ | jq -r .message; done | sort | uniq -c",
      "output": "     19 canary\n    181 greetings from podinfo v6.15.0"
    }
  ]
}
```

The `sleep` gives the Gateway a few seconds to load the changed route. The split is per request and random, so 200 requests only approximate 180 and 20; this run got 181 and 19. Unlike splitting traffic by putting both versions behind one Service, where the share follows the number of pods, the weight does not depend on how many pods each version runs. If the canary looks healthy, raise its weight step by step; if not, set it to 0. Argo Rollouts and Flagger can drive these weights from metrics.

## Ingress and the ingress-nginx Retirement

Before Gateway API, HTTP routing used the **Ingress** API. It is still part of Kubernetes and still served, but it is frozen: it gets no new features, and everything beyond host and path routing lives in controller-specific annotations that do not move between controllers.

```yaml
# The older Ingress API: still served, but needs an Ingress controller
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: podinfo
spec:
  ingressClassName: example # the IngressClass of the controller you install
  rules:
    - host: podinfo.k8s-guide.example
      http:
        paths:
          # Only the public paths, as in the HTTPRoute
          - path: /
            pathType: Exact
            backend:
              service:
                name: podinfo
                port:
                  number: 80
          - path: /version
            pathType: Exact
            backend:
              service:
                name: podinfo
                port:
                  number: 80
```

```bash
kubectl apply -f 05-networking/ingress.yaml --dry-run=server
```

```text
ingress.networking.k8s.io/podinfo created (server dry run)
```

An Ingress does nothing without an Ingress controller. The most widely used one, **ingress-nginx**, was retired by Kubernetes SIG Network and the Security Response Committee on 24 March 2026 after years without enough maintainers. Existing installations keep working, but there are no more releases, bug fixes or security patches ([announcement](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/)). Check whether you run it:

```bash
kubectl get pods --all-namespaces --selector app.kubernetes.io/name=ingress-nginx
```

If you do, plan a migration. [ingress2gateway](https://github.com/kubernetes-sigs/ingress2gateway) (1.0 since March 2026) converts Ingress resources, including over 30 common ingress-nginx annotations, into Gateway API resources and warns about what it cannot translate. If you must stay on Ingress for now, move to a maintained controller such as Traefik, HAProxy, Kong or your cloud provider's controller. Our post on [the ingress-nginx end of life](/posts/ingress-nginx-eol-gateway-api-migration) walks through a migration.

## Traffic Policies Worth Knowing

- `externalTrafficPolicy: Local` on a NodePort or LoadBalancer Service keeps the client's source IP and avoids a second hop, but nodes without a ready pod then drop the traffic, so the load balancer must health-check nodes.
- `internalTrafficPolicy: Local` sends in-cluster traffic only to pods on the same node, which suits node-local agents.
- `trafficDistribution: PreferSameZone` (or `PreferSameNode`, stable since 1.35) keeps traffic in the client's zone or node when possible, which cuts cross-zone costs. The older value `PreferClose` is deprecated in favor of `PreferSameZone`.
- `spec.externalIPs` is deprecated since 1.36 and scheduled for removal in 1.43, because it lets anyone who can create a Service intercept traffic to any IP. Use a LoadBalancer or a Gateway instead.

## Clean Up

Remove the test Services, the canary and the client, and put the route back to 100 percent stable. Keep the `podinfo` Service, the Gateway and the route; Part 10 uses them again:

```terminal
{
  "title": "clean up",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 05-networking/httproute.yaml",
      "output": "httproute.gateway.networking.k8s.io/podinfo configured"
    },
    {
      "cmd": "kubectl delete -f 05-networking/canary.yaml -f 05-networking/service-nodeport.yaml -f 05-networking/service-lb.yaml",
      "output": "deployment.apps \"podinfo-canary\" deleted from demo namespace\nservice \"podinfo-canary\" deleted from demo namespace\nservice \"podinfo-nodeport\" deleted from demo namespace\nservice \"podinfo-lb\" deleted from demo namespace"
    },
    {
      "cmd": "kubectl delete pod client",
      "output": "pod \"client\" deleted from demo namespace"
    }
  ]
}
```

## Common Mistakes

- **A selector that matches no pods.** The Service exists, but its EndpointSlice is empty and connections fail. Compare `kubectl get endpointslices` with the pod labels.
- **Calling pods by IP.** Pod IPs change on every restart; use the Service name.
- **One LoadBalancer per app.** Each one costs money and an IP address. Share one Gateway and use routes.
- **Exposing every path.** Route only the paths clients need, and keep admin and debug endpoints internal.
- **Staying on ingress-nginx.** It no longer gets security fixes. Move to Gateway API or a maintained controller.

## Summary

- A Service gives ready pods a stable IP and DNS name; EndpointSlices track which pods are behind it.
- `ClusterIP` is internal, `NodePort` opens a port on every node, `LoadBalancer` asks the cloud for a load balancer.
- Gateway API splits ownership: the platform team runs the Gateway, app teams attach HTTPRoutes with hosts, paths and weights.
- ingress-nginx was retired on 24 March 2026; ingress2gateway helps you move to Gateway API.

## Keep Learning

- [Kubernetes Service types: ClusterIP, NodePort and LoadBalancer](/posts/kubernetes-service-types-clusterip-nodeport-loadbalancer)
- [Ingress vs LoadBalancer in Kubernetes](/posts/ingress-vs-load-balancer-kubernetes)
- [Kubernetes services and networking interview questions](/interview-questions/mid/kubernetes-services-networking)
- [Kubernetes networking simulator](/games/kubernetes-networking-cni-simulator) and [DNS simulator](/games/dns-simulator)

Next, in [Part 6](/guides/introduction-to-kubernetes/06-configmaps-and-secrets), you configure podinfo without rebuilding its image and give it a TLS certificate.
