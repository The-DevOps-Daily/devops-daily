---
title: 'Difference Between targetPort and port in Kubernetes Service Definition'
excerpt: "Understand the distinction between targetPort and port in Kubernetes Service definitions, and learn how they impact your application's networking."
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-04-25'
publishedAt: '2024-04-25T09:00:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Networking
  - Services
  - DevOps
---

## Introduction

When defining a Service in Kubernetes, you often encounter two key properties: `port` and `targetPort`. These properties play a crucial role in how traffic is routed to your application, but their differences can sometimes be confusing. In this guide, you'll learn what each property does, how they interact, and when to use them.

## Prerequisites

Before diving in, make sure:

- You have a basic understanding of Kubernetes Services and Pods.
- You have access to a Kubernetes cluster and `kubectl` installed.

## Understanding `port` and `targetPort`

A Kubernetes Service acts as a bridge between external traffic and your application running inside Pods. The `port` and `targetPort` properties define how this traffic is handled.

### `port`

The `port` property specifies the port number on the Service itself. This is the port that external clients will use to communicate with your application.

For example, if you define a Service with `port: 80`, clients will send requests to port 80 of the Service.

### `targetPort`

The `targetPort` property specifies the port number on the Pod where your application is running. This is the port that the Service forwards traffic to.

For example, if your application listens on port 8080 inside the Pod, you would set `targetPort: 8080`.

### Example Service Definition

Here's a simple Service definition:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: example-service
spec:
  selector:
    app: example-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
```

In this example:

- `port: 80` means external clients will connect to port 80 of the Service.
- `targetPort: 8080` means the Service will forward traffic to port 8080 on the Pods.

## How `port` and `targetPort` Work Together

The `port` and `targetPort` properties work together to route traffic:

1. A client sends a request to the Service's `port`.
2. The Service forwards the request to the `targetPort` on the selected Pods.

This allows you to decouple the external port from the internal port, which can be useful in scenarios like load balancing or when your application uses non-standard ports internally.

This can be visualized as follows:

```
Client ---> Service (port: 80) ---> Pod (targetPort: 8080)
```

## Common Use Cases

### Matching `port` and `targetPort`

In some cases, `port` and `targetPort` are the same. For example, if your application listens on port 80 inside the Pod and you want clients to connect to port 80 externally, you would set both properties to 80.

### Using Different `port` and `targetPort`

In other cases, you might use different values for `port` and `targetPort`. For example:

- Your application listens on port 8080 inside the Pod.
- You want clients to connect to port 80 externally.

This setup is common when you want to expose a standard port externally while using a different port internally.

## Best Practices

- **Use Descriptive Names**: Name your Services and ports clearly to avoid confusion.
- **Monitor Traffic**: Use tools like `kubectl logs` and `kubectl describe` to debug traffic routing issues.
- **Test Connectivity**: Verify that your Service is routing traffic correctly using `kubectl port-forward` or external tools.

## Conclusion

Understanding the difference between `port` and `targetPort` is essential for configuring Kubernetes Services effectively. By knowing how these properties work together, you can make sure that your application is accessible and performs as expected.


## Related Resources

- [Kubernetes Service Types: ClusterIP, NodePort, LoadBalancer](/posts/kubernetes-service-types-clusterip-nodeport-loadbalancer)
- [Ingress vs Load Balancer](/posts/ingress-vs-load-balancer-kubernetes)
- [Introduction to Kubernetes: Services and Networking](/guides/introduction-to-kubernetes)
- [Kubernetes Flashcards](/flashcards/kubernetes-basics)
