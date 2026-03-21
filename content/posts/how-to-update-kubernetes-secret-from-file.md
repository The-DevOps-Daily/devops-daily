---
title: 'How to Update a Kubernetes Secret Generated from a File'
excerpt: 'Learn how to update an existing Kubernetes secret when its data comes from a file, with practical kubectl commands and tips for safe secret management.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-10-12'
publishedAt: '2024-10-12T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Secrets
  - kubectl
  - DevOps
  - Security
---

Kubernetes secrets are often created from files, such as certificates, keys, or configuration files. When the underlying file changes, you'll need to update the secret in your cluster to keep your workloads running smoothly.

In this guide, you'll learn how to safely update a secret generated from a file using `kubectl`.

## Prerequisites

You'll need:

- Access to a Kubernetes cluster
- `kubectl` installed and configured
- The updated file you want to use for the secret

## Why Update a Secret from a File?

Secrets like TLS certificates, API keys, or config files change over time. Updating the secret ensures your applications use the latest data without manual pod restarts or risky workarounds.

## Step 1: Recreate the Secret with the New File

Kubernetes does not support in-place editing of secret data from a file. The standard approach is to delete and recreate the secret. For example, if your secret is named `my-secret` and you want to update it with a new `config.json`:

```bash
kubectl delete secret my-secret -n <namespace>
kubectl create secret generic my-secret --from-file=config.json -n <namespace>
```

This deletes the old secret and creates a new one with the updated file. Any pods mounting this secret as an environment variable or volume will see the new data after a restart.

## Step 2: Rolling Restart Your Pods (if needed)

If your pods mount the secret as a volume, you'll need to restart them to pick up the changes. For deployments, trigger a rolling restart:

```bash
kubectl rollout restart deployment <deployment-name> -n <namespace>
```

This ensures your application uses the updated secret.

## Alternative: Use kubectl apply with a YAML Manifest

If you manage secrets as YAML files (for example, in GitOps workflows), you can update the secret by editing the manifest and applying it:

```bash
kubectl apply -f my-secret.yaml
```

Make sure to base64-encode the new file content before updating the YAML.

## Security Tips

- Never commit unencrypted secrets to version control.
- Use RBAC to restrict who can update secrets.
- Rotate secrets regularly and automate updates where possible.

## Next Steps

Explore tools like Sealed Secrets or external secret managers for more advanced workflows. Automate secret updates as part of your CI/CD pipeline to keep your cluster secure and up to date.


## Related Resources

- [How to Decode a Kubernetes Secret](/posts/how-to-decode-a-kubernetes-secret)
- [Restart Pods When ConfigMap Updates](/posts/restart-pods-when-configmap-updates-in-kubernetes)
- [Introduction to Kubernetes: ConfigMaps and Secrets](/guides/introduction-to-kubernetes)
- [Kubernetes Security Checklist](/checklists/kubernetes-security)
