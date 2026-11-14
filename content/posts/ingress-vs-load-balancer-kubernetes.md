---
title: 'Ingress vs Load Balancer in Kubernetes, Pending IPs and port-forward'
excerpt: 'When to expose a Service with a LoadBalancer, an Ingress or Gateway API, why EXTERNAL-IP stays pending, and how kubectl port-forward reaches a pod without exposing it.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-12-23'
publishedAt: '2024-12-23T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Ingress
  - LoadBalancer
  - Gateway API
  - Networking
  - kubectl
---

A Service of type `LoadBalancer` and an Ingress both bring traffic from outside into the cluster, so they are easy to confuse. They work at different layers. A LoadBalancer Service gives one Service its own external address for any TCP or UDP port. An Ingress, or its successor Gateway API, puts many HTTP services behind one address and routes by host name and path. This post explains when to use which, why a LoadBalancer Service can show `<pending>` forever, and how `kubectl port-forward` lets you reach a pod without exposing it at all.

## TLDR

| Question                                  | Short answer                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| LoadBalancer or Ingress?                  | LoadBalancer for one service or for non-HTTP traffic. Ingress or Gateway API for many HTTP services             |
| Ingress or Gateway API?                   | Gateway API for new setups. The Ingress API is frozen, and ingress-nginx was retired in March 2026              |
| Does a LoadBalancer keep the client IP?   | Only with `externalTrafficPolicy: Local` (or the provider's own setting)                                        |
| Why is `EXTERNAL-IP` `<pending>`?         | Nothing in the cluster creates load balancers: no cloud controller, no MetalLB, a quota or a permission problem |
| How do I reach a pod without exposing it? | `kubectl port-forward svc/web 8080:80`                                                                          |

## Prerequisites

- A Kubernetes cluster and `kubectl`. A cloud cluster for real load balancers, or kind with cloud-provider-kind for local tests.
- The Service types `ClusterIP`, `NodePort` and `LoadBalancer`. [Services and Networking](/guides/introduction-to-kubernetes/05-services-and-networking#h2-service-types) in the Kubernetes guide explains them.

## What Is the Difference Between Ingress and a LoadBalancer Service?

A **LoadBalancer Service** asks a load balancer controller, usually the cloud provider's cloud controller manager, for an external load balancer. The load balancer sends traffic to the Service's node ports, or with some providers directly to the pods. It works at layer 4: it forwards TCP or UDP connections and does not read HTTP. On cloud providers, each Service of this type usually gets its own load balancer and address:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: shop
spec:
  type: LoadBalancer
  selector:
    app: web
  ports:
    - port: 80 # the port on the load balancer
      targetPort: 9898 # the port the container listens on
```

An **Ingress** is a set of HTTP routing rules: this host and this path go to that Service. It does nothing by itself. An **Ingress controller** reads the rules and serves them. Most controllers are a proxy that runs in the cluster behind one LoadBalancer Service, so many apps share one external address. Some, such as the AWS Load Balancer Controller, configure a cloud load balancer to do the routing instead:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
  namespace: shop
spec:
  ingressClassName: traefik # which installed controller serves this Ingress
  tls:
    - hosts: [shop.example.com]
      secretName: shop-tls # a kubernetes.io/tls Secret, for example from cert-manager
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
```

The two traffic paths, with an in-cluster Ingress controller:

```text
LoadBalancer Service:  client -> cloud load balancer -> node port -> pod
Ingress:               client -> cloud load balancer -> Ingress controller pods -> pod
```

Without `ingressClassName`, the Ingress is usually served only if the cluster has a default IngressClass. Old examples use the `kubernetes.io/ingress.class` annotation instead, which is deprecated.

## When Should You Use Each?

| Need                              | LoadBalancer Service                      | Ingress or Gateway API                                                                 |
| --------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Protocol                          | Any TCP or UDP: Postgres, MQTT, DNS, gRPC | HTTP and HTTPS (Gateway API also has TCP, UDP and TLS routes, some still experimental) |
| Many services on one address      | Usually no, one per Service               | Yes, by host name and path                                                             |
| TLS termination                   | Only with provider annotations            | Yes, with a certificate Secret                                                         |
| Redirects, rewrites, header rules | No                                        | Yes                                                                                    |
| Cost                              | One cloud load balancer for each Service  | One load balancer for the controller                                                   |
| Extra moving part                 | None                                      | The controller, which you install and upgrade                                          |

The cost difference is real. Each cloud load balancer has a monthly price, so ten public HTTP services cost ten load balancers as LoadBalancer Services, and one as Ingress or Gateway routes.

Neither type keeps the client's source IP by default. With the default `externalTrafficPolicy: Cluster`, a node can forward a connection to a pod on another node and replace the source address. Set `externalTrafficPolicy: Local` on the Service to keep it. Then only nodes that run a ready pod get traffic, and the load balancer must health-check the nodes. Behind an Ingress controller, the app sees the controller's address and reads the client IP from `X-Forwarded-For`, which the controller sets.

### What Replaces ingress-nginx?

Kubernetes SIG Network retired **ingress-nginx**, the most used Ingress controller, on 24 March 2026. Existing installations keep running, but they get no more releases or security fixes. Many old examples, including earlier versions of this post, use its `nginx.ingress.kubernetes.io/*` annotations for rewrites, rate limits and authentication. Those annotations work only with that controller.

The Ingress API itself is still served, but it is frozen and gets no new features. For new setups, use **Gateway API**. Its routing rules, such as header matches, rewrites and weighted backends, are part of the standard API and not annotations. The same routing as the Ingress above, as an HTTPRoute:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: shop
  namespace: shop
spec:
  parentRefs:
    - name: public # a Gateway that the platform team owns
      namespace: gateway-infra
  hostnames:
    - shop.example.com
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api
      backendRefs:
        - name: api
          port: 80
    - backendRefs: # no match: everything else
        - name: web
          port: 80
```

The route attaches only if the Gateway's listener allows routes from the `shop` namespace with `allowedRoutes`. By default, a listener accepts routes only from its own namespace. [Gateway API](/guides/introduction-to-kubernetes/05-services-and-networking#h2-gateway-api) in the Kubernetes guide sets up a Gateway and routes on kind, and [Ingress-NGINX Is Retired](/posts/ingress-nginx-eol-gateway-api-migration) walks through a migration with ingress2gateway.

## Why Does My LoadBalancer Service Show EXTERNAL-IP Pending?

`<pending>` means that no controller has given the Service an address yet. A LoadBalancer Service does not create anything by itself. A cloud controller manager, or a load balancer implementation such as MetalLB, must watch for the Service, create the load balancer and write its address into `status.loadBalancer`. Start with the events:

```bash
kubectl get service web -n shop
kubectl describe service web -n shop   # Events: EnsuringLoadBalancer, SyncLoadBalancerFailed and the error
```

If there are no events at all, usually no controller handles the Service (events also expire after one hour). If there is a `SyncLoadBalancerFailed` event, its message is the error from the cloud API.

| Where the cluster runs                    | Usual cause and fix                                                                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| kind                                      | Nothing creates load balancers. Run [cloud-provider-kind](/guides/introduction-to-kubernetes/05-services-and-networking#h3-loadbalancer) |
| minikube                                  | Run `minikube tunnel` in a second terminal while you need the address                                                                    |
| k3s                                       | Its built-in ServiceLB gives node IPs, unless you started k3s with `--disable=servicelb`                                                 |
| Bare metal or VMs                         | Install a load balancer implementation such as MetalLB and give it a pool of addresses                                                   |
| Cloud, quota reached                      | The event shows a quota error. Raise the quota or delete unused load balancers                                                           |
| Cloud, permissions                        | The cloud controller or load balancer controller cannot create resources. Check its IAM role                                             |
| EKS with the AWS Load Balancer Controller | It finds subnets by tags: `kubernetes.io/role/elb` for public and `kubernetes.io/role/internal-elb` for internal ones                    |
| `spec.loadBalancerClass` is set           | Only the controller for that class handles the Service. If it is not installed, nothing happens                                          |

Two old fixes make things worse:

- **`spec.externalIPs`** does not create a load balancer. It only tells kube-proxy to accept traffic for an address that you route to a node yourself. It lets anyone who can create a Service take over traffic to any IP, so it is deprecated since Kubernetes 1.36 and many clusters block it.
- **`spec.loadBalancerIP`** is deprecated since 1.24. Providers that support a fixed address now use their own annotation for it.

While you wait, the Service usually already works as a NodePort, unless it sets `allocateLoadBalancerNodePorts: false`. The `PORT(S)` column shows it, for example `80:31544/TCP`: connect to any node's IP on port 31544. For your own access, `kubectl port-forward` is simpler still.

## How Does kubectl port-forward Create a Connection?

`kubectl port-forward` opens a tunnel through the Kubernetes API. Nothing is exposed to the network, and no Service, Ingress or NodePort is involved:

1. kubectl listens on the local port you name, on `localhost` (`127.0.0.1` and `::1`) by default.
2. For each connection, kubectl sends the bytes to the API server over its normal HTTPS connection. Since Kubernetes 1.31, kubectl and the API server use WebSockets for this stream by default. Older versions use SPDY.
3. The API server passes the stream to the kubelet on the pod's node.
4. The kubelet asks the container runtime to connect to the port inside the pod's network namespace, on `localhost`.

```text
your app -> localhost:8080 -> kubectl -> API server -> kubelet -> container runtime -> pod localhost:9898
```

You can name a pod, a Deployment or a Service:

```bash
kubectl port-forward pod/web-7d4b9c-x2kqz 8080:9898 -n shop
kubectl port-forward deployment/web 8080:9898 -n shop
kubectl port-forward service/web 8080:80 -n shop
```

```text
Forwarding from 127.0.0.1:8080 -> 9898
Forwarding from [::1]:8080 -> 9898
```

With a Service, kubectl picks one pod behind it and translates the Service port to the container port, as the output shows. The traffic does not go through the Service's cluster IP, so it is not load balanced. Other useful forms are `8080:80 9443:443` for several ports, and `:80` for a free local port that kubectl chooses.

Know the limits:

- **One pod.** If that pod is deleted or replaced, the forward stops with an error and you must start it again. If its container restarts, open connections break.
- **TCP only.** UDP is not supported.
- **localhost inside the pod.** The runtime connects to `localhost`, so an app that listens only on the pod IP does not answer.
- **Not a network path.** NetworkPolicies do not apply, and the speed is limited by the API server and kubelet.
- **RBAC.** You need permission on the `pods/portforward` subresource. That is as powerful as network access to the pod, so do not give it widely.

`--address 0.0.0.0` makes kubectl listen on all your machine's interfaces, so other computers on your network can use the tunnel. Use it only on a trusted network.

## Related Resources

- [Introduction to Kubernetes: Services and Networking](/guides/introduction-to-kubernetes/05-services-and-networking): ClusterIP, NodePort, LoadBalancer and Gateway API, tested on kind
- [Ingress-NGINX Is Retired: a migration to Gateway API](/posts/ingress-nginx-eol-gateway-api-migration)
- [Kubernetes networking and CNI simulator](/games/kubernetes-networking-cni-simulator): follow a packet from pod to pod and through a Service
- [Load balancer simulator](/games/load-balancer-simulator): compare balancing algorithms
- [CKNE exam guide](/posts/ckne-kubernetes-network-engineer-exam-guide): what the Kubernetes network engineer exam tests
- [Kubernetes Services and networking interview questions](/interview-questions/topic/kubernetes#kubernetes-services-networking)
- [Kubernetes quiz](/quizzes/kubernetes-quiz)
