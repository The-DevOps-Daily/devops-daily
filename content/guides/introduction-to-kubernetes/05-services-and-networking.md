---
title: Services and Networking
description: Learn how to expose applications and enable communication within and outside your Kubernetes cluster
order: 5
---

Now that you understand how to deploy and manage applications in Kubernetes using Deployments, let's explore how to enable network communication to and between those applications. Kubernetes Services provide stable endpoints for pods, while other networking features manage traffic routing, load balancing, and external access.

## Understanding Kubernetes Networking

Kubernetes implements a flat network model where all pods can communicate with each other without NAT. This network must satisfy the following requirements:

- All containers can communicate with all other containers without NAT
- All nodes can communicate with all containers without NAT
- A container's IP address is the same regardless of which node it's viewed from

The specific implementation of this network model depends on the network plugin your cluster uses.

## Service Basics

A Service is an abstraction that defines a logical set of Pods and a policy to access them. Since pods are ephemeral (they can be created and destroyed at any time), their IP addresses change. Services provide a stable endpoint to connect to these ever-changing pods.

```
┌─────────────────────────────────────┐
│           Service (ClusterIP)       │
│              10.96.0.10             │
└───────────────┬─────────────────────┘
                │
                │ load balances to
                │
      ┌─────────┼─────────┬───────────────┐
      │         │         │               │
┌─────▼─────┐ ┌─▼───────┐ ┌─▼────────┐    │
│    Pod    │ │   Pod   │ │   Pod    │    │
│  10.1.0.4 │ │ 10.1.0.5│ │ 10.1.0.6 │    │
└───────────┘ └─────────┘ └──────────┘    │
      ▲         ▲            ▲            │
      └─────────┴────────────┴────────────┘
                Selected by
             app=myapp labels
```

## Creating Your First Service

Let's create a service to expose the NGINX deployment from the previous section. Create a file named `nginx-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  selector:
    app: nginx
  ports:
    - port: 80 # Port exposed by the service
      targetPort: 80 # Port the container accepts traffic on
  type: ClusterIP # Default service type
```

Apply this configuration:

```bash
kubectl apply -f nginx-service.yaml
```

## Service Types

Kubernetes offers several service types for different exposure requirements:

1. **ClusterIP (default)**: Exposes the service on an internal IP in the cluster. Only reachable from within the cluster.

2. **NodePort**: Exposes the service on each node's IP at a static port. Accessible from outside the cluster using `<NodeIP>:<NodePort>`.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-nodeport
spec:
  selector:
    app: nginx
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30080 # Optional: specify port (default: 30000-32767)
  type: NodePort
```

3. **LoadBalancer**: Exposes the service externally using a cloud provider's load balancer.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-lb
spec:
  selector:
    app: nginx
  ports:
    - port: 80
      targetPort: 80
  type: LoadBalancer
```

4. **ExternalName**: Maps the service to the contents of the `externalName` field (e.g., `foo.bar.example.com`) by returning a CNAME record.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-service
spec:
  type: ExternalName
  externalName: api.example.com
```

## Managing Services

### Viewing Services

List all services in your cluster:

```bash
kubectl get services
```

You'll see output like:

```
NAME            TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE
kubernetes      ClusterIP   10.96.0.1       <none>        443/TCP   22h
nginx-service   ClusterIP   10.96.145.78    <none>        80/TCP    10m
```

For more details:

```bash
kubectl describe service nginx-service
```

### Testing Services

You can test your service from within the cluster by creating a temporary pod:

```bash
kubectl run test-nginx --image=alpine --rm -it -- sh
```

Once inside the container:

```bash
# Install curl
apk add --no-cache curl

# Test the service by name
curl nginx-service

# Test the service by cluster IP
curl 10.96.145.78
```

## Service Discovery

Kubernetes provides two primary ways for pods to discover services:

### Environment Variables

Kubernetes injects environment variables for active services into new pods. For a service named `nginx-service`, these variables include:

```
NGINX_SERVICE_SERVICE_HOST=10.96.145.78
NGINX_SERVICE_SERVICE_PORT=80
```

### DNS

Kubernetes has a built-in DNS server that provides records for services and pods. Services are accessible via their names within the same namespace:

```
nginx-service.default.svc.cluster.local
```

Where:

- `nginx-service` is the service name
- `default` is the namespace
- `svc.cluster.local` is the cluster domain

Within the same namespace, you can simply use `nginx-service`.

## Port Configurations

Services can expose multiple ports:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: multi-port-service
spec:
  selector:
    app: my-app
  ports:
    - name: http
      port: 80
      targetPort: 8080
    - name: https
      port: 443
      targetPort: 8443
```

When using multiple ports, naming them becomes important for clarity, especially in Ingress configurations.

## Service Endpoints

Endpoints are automatically created and updated by Kubernetes to track which pod IPs a service should direct traffic to:

```bash
kubectl get endpoints nginx-service
```

Output:

```
NAME            ENDPOINTS                                   AGE
nginx-service   10.244.0.12:80,10.244.0.13:80,10.244.0.14:80   15m
```

You can also create services without selectors by manually defining endpoints. This is useful for directing traffic to external services or specific IPs:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-db
spec:
  ports:
    - port: 5432
---
apiVersion: v1
kind: Endpoints
metadata:
  name: external-db # Must match service name
subsets:
  - addresses:
      - ip: 192.168.1.1
    ports:
      - port: 5432
```

## Session Affinity

By default, services route each connection to a random backend pod. If you need connection stickiness (sending the same client to the same pod), use session affinity:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-sticky
spec:
  selector:
    app: nginx
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800 # 3 hours
  ports:
    - port: 80
      targetPort: 80
```

## Headless Services

If you need direct DNS access to individual pods (e.g., for StatefulSets), create a headless service by setting `clusterIP: None`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-headless
spec:
  clusterIP: None
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
```

With a headless service, DNS queries return the IP addresses of all pods directly, instead of the service's cluster IP.

## ExternalTrafficPolicy

Control how external traffic is routed to nodes and pods:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  selector:
    app: nginx
  ports:
    - port: 80
  type: LoadBalancer
  externalTrafficPolicy: Local
```

Two options are available:

- **Cluster** (default): Traffic can be routed to pods on any node
- **Local**: Traffic only goes to pods on the node that received the request, preserving client source IP address

## Ingress Resources

While Services expose applications within the cluster or using cloud load balancers, Ingress resources provide more sophisticated HTTP and HTTPS routing:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nginx-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
    - host: myapp.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nginx-service
                port:
                  number: 80
```

To use Ingress resources, you need an Ingress controller running in your cluster. Popular options include:

- NGINX Ingress Controller
- Traefik
- HAProxy
- Kong
- Istio

## Ingress Features

Ingress resources support various features through controller-specific annotations:

### TLS Termination

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: secure-ingress
spec:
  tls:
    - hosts:
        - myapp.example.com
      secretName: myapp-tls
  rules:
    - host: myapp.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nginx-service
                port:
                  number: 80
```

The TLS secret must contain `tls.crt` and `tls.key` data:

```bash
kubectl create secret tls myapp-tls --cert=path/to/cert.crt --key=path/to/key.key
```

### Path-Based Routing

Route different paths to different services:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: path-ingress
spec:
  rules:
    - host: example.com
      http:
        paths:
          - path: /app
            pathType: Prefix
            backend:
              service:
                name: app-service
                port:
                  number: 80
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 8080
```

### Name-Based Virtual Hosting

Host multiple domains on the same IP:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: name-based-ingress
spec:
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app-service
                port:
                  number: 80
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 8080
```

## Network Policies

By default, all pods in a Kubernetes cluster can communicate with any other pod. Network Policies restrict this communication, similar to a firewall:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-network-policy
spec:
  podSelector:
    matchLabels:
      app: database
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: backend
      ports:
        - protocol: TCP
          port: 5432
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: monitoring
      ports:
        - protocol: TCP
          port: 5000
```

This policy:

- Applies to pods with the label `app: database`
- Allows incoming traffic only from pods with the label `app: backend` on port 5432
- Allows outgoing traffic only to the monitoring namespace on port 5000

Note that Network Policies are only enforced if your cluster uses a network plugin that supports them (like Calico, Cilium, etc.).

## DNS in Kubernetes

Kubernetes includes a DNS server (CoreDNS) that all pods can use for service discovery.

### DNS Records for Services

For a service named `nginx-service` in the `default` namespace:

- **A/AAAA record**: `nginx-service.default.svc.cluster.local` resolves to the service's cluster IP
- **SRV records**: `_http._tcp.nginx-service.default.svc.cluster.local` for named ports

### DNS for Pods

Pods get A/AAAA records in the format:
`pod-ip-address.namespace.pod.cluster.local`

For example: `10-244-1-10.default.pod.cluster.local`

### Customizing DNS

You can customize a pod's DNS settings:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: custom-dns-pod
spec:
  containers:
    - name: app
      image: nginx
  dnsPolicy: 'None'
  dnsConfig:
    nameservers:
      - 8.8.8.8
    searches:
      - example.com
    options:
      - name: ndots
        value: '5'
```

DNS policies:

- **ClusterFirst** (default): Forward to the cluster DNS server, falling back to the node's DNS settings
- **Default**: Use the node's DNS settings
- **None**: Use custom DNS settings specified in `dnsConfig`
- **ClusterFirstWithHostNet**: For pods using host network

## Service Mesh Integration

For more advanced networking features, consider using a service mesh like Istio, Linkerd, or Consul:

- **Fine-grained traffic control**: Canary deployments, A/B testing
- **Mutual TLS**: Automatic encryption between services
- **Observability**: Detailed metrics, logs, and traces
- **Authentication and authorization**: Service-to-service security

## LoadBalancer Services on DigitalOcean

When you deploy a LoadBalancer service on DigitalOcean Kubernetes, it automatically provisions a DigitalOcean Load Balancer:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-service
  annotations:
    service.beta.kubernetes.io/do-loadbalancer-protocol: 'http'
    service.beta.kubernetes.io/do-loadbalancer-algorithm: 'round_robin'
    service.beta.kubernetes.io/do-loadbalancer-redirect-http-to-https: 'true'
spec:
  type: LoadBalancer
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 8080
```

[Sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) to get $200 in free credits and easily provision load balancers for your Kubernetes services.

## Best Practices for Services and Networking

1. **Use meaningful service names**: Choose descriptive names that reflect the service's purpose.

2. **Leverage label selectors effectively**: Ensure service selectors match your pod labels exactly.

3. **Choose the right service type**: Use ClusterIP for internal services, NodePort for development, and LoadBalancer for production external services.

4. **Implement network policies**: Follow the principle of least privilege for pod communication.

5. **Use Ingress for HTTP traffic**: When exposing multiple services externally, Ingress provides more efficient resource usage than multiple LoadBalancer services.

6. **Consider service affinity needs**: Use session affinity when clients need consistent connections to the same pod.

7. **Monitor service endpoints**: Check that the expected number of pods appear as endpoints.

8. **Document service discovery methods**: Ensure your team knows how to discover and use services.

9. **Be mindful of load balancer costs**: In cloud environments, LoadBalancer services typically incur charges.

10. **Avoid creating services prematurely**: Wait until your pods are stable before exposing them.

In the next section, we'll explore ConfigMaps and Secrets, which help you manage configuration data and sensitive information for your applications.
