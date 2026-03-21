---
title: 'Get YAML for Deployed Kubernetes Services'
excerpt: 'Learn how to retrieve the YAML configuration for deployed Kubernetes Services using kubectl commands.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-06-01'
publishedAt: '2024-06-01T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - YAML
  - Services
  - DevOps
---

## Introduction

When working with Kubernetes, you might need to retrieve the YAML configuration for a deployed Service. This is useful for debugging, documentation, or replicating configurations. In this guide, you'll learn how to use `kubectl` commands to get the YAML for deployed Services.

## Prerequisites

Before proceeding, make sure:

- You have `kubectl` installed and configured to access your Kubernetes cluster.
- You have permissions to view the Services in your cluster.

## Retrieving YAML for a Service

### Using `kubectl get` Command

The `kubectl get` command allows you to retrieve the YAML configuration for a specific Service. Use the `-o yaml` flag to output the configuration in YAML format.

Here's an example:

```bash
kubectl get service <service-name> -n <namespace> -o yaml
```

In this command:

- Replace `<service-name>` with the name of the Service.
- Replace `<namespace>` with the namespace where the Service is located.

### Example

Suppose you have a Service named `example-service` in the `default` namespace. Run the following command:

```bash
kubectl get service example-service -n default -o yaml
```

This will output the YAML configuration for the `example-service`.

### Output Explanation

The output will include details like:

- `metadata`: Information about the Service, such as name and labels.
- `spec`: Configuration details, including ports and selectors.
- `status`: Current status of the Service.

### Save YAML to a File

To save the YAML configuration to a file, use the `>` operator:

```bash
kubectl get service example-service -n default -o yaml > example-service.yaml
```

This command saves the YAML to a file named `example-service.yaml`.

## Best Practices

- **Use Namespaces**: Always specify the namespace to avoid conflicts.
- **Backup Configurations**: Save YAML files for critical Services as part of your backup strategy.
- **Validate YAML**: Use tools like `kubectl apply --dry-run=client` to validate YAML files before applying them.

## Conclusion

Retrieving the YAML configuration for Kubernetes Services is a straightforward process that can help with debugging and replication. By using the `kubectl get` command, you can easily access and save these configurations for future use.


## Related Resources

- [Kubernetes Service Types](/posts/kubernetes-service-types-clusterip-nodeport-loadbalancer)
- [Kubernetes List All Pods and Nodes](/posts/kubernetes-list-all-pods-and-nodes)
- [Set Multiple Commands in One YAML](/posts/how-to-set-multiple-commands-in-one-yaml-file-with-kubernetes)
- [Introduction to Kubernetes Guide](/guides/introduction-to-kubernetes)
