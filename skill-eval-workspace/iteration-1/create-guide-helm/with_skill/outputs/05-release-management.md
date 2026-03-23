---
title: 'Release Management and Debugging'
description: 'Master Helm release lifecycle management including upgrade strategies, debugging failed deployments, and working with namespaces and RBAC.'
order: 5
---

In production environments, installing a chart is just the beginning. You need to manage the full lifecycle of your releases -- handling upgrades safely, debugging failures, controlling access with RBAC, and keeping your cluster organized. This part covers the day-to-day operational skills that make Helm reliable at scale.

## Understanding Release State

Every Helm release has a status that reflects its current condition:

- **deployed** -- the release is active and running.
- **pending-install** -- the release is being installed.
- **pending-upgrade** -- the release is being upgraded.
- **pending-rollback** -- the release is being rolled back.
- **superseded** -- a previous revision replaced by a newer one.
- **failed** -- the release operation did not complete successfully.
- **uninstalled** -- the release was removed (visible only with `--keep-history`).

Check release status at any time:

```bash
helm status my-redis --namespace redis
```

```text
NAME: my-redis
LAST DEPLOYED: Fri Mar 20 14:00:00 2026
NAMESPACE: redis
STATUS: deployed
REVISION: 3
TEST SUITE: None
NOTES:
  Redis is now running...
```

## Safe Upgrade Strategies

### Atomic Upgrades

The `--atomic` flag tells Helm to automatically roll back if the upgrade fails:

```bash
helm upgrade my-redis bitnami/redis \
  -f redis-values.yaml \
  --namespace redis \
  --atomic \
  --timeout 5m
```

With `--atomic`, if any resource fails to reach a ready state within the timeout period, Helm automatically rolls back to the previous revision. This is essential for production deployments.

### Wait for Resources

Even without `--atomic`, you should use `--wait` to ensure Helm does not mark the upgrade as successful until all resources are ready:

```bash
helm upgrade my-redis bitnami/redis \
  -f redis-values.yaml \
  --wait \
  --timeout 10m
```

The `--wait` flag watches for Deployments, StatefulSets, and other resources to reach their ready state. The `--timeout` flag sets the maximum time to wait.

### Cleanup on Failure

The `--cleanup-on-fail` flag removes any new resources that were created during a failed upgrade:

```bash
helm upgrade my-redis bitnami/redis \
  -f redis-values.yaml \
  --cleanup-on-fail
```

This prevents orphaned resources from accumulating after failed upgrades.

## Debugging Failed Releases

When a release fails, you need to diagnose what went wrong. Helm provides several tools for this.

### Examining Release History

Start by looking at the release history to see what changed:

```bash
helm history my-redis --namespace redis
```

```text
REVISION  UPDATED                   STATUS    CHART            APP VERSION  DESCRIPTION
1         2026-03-20 11:00:00 UTC   deployed  redis-19.0.0     7.2.4        Install complete
2         2026-03-20 14:00:00 UTC   failed    redis-19.1.0     7.4.0        Upgrade "my-redis" failed
```

### Comparing Revisions

See what values changed between revisions:

```bash
# Get values from a specific revision
helm get values my-redis --namespace redis --revision 1
helm get values my-redis --namespace redis --revision 2
```

### Inspecting Rendered Manifests

View the manifests that were generated for a specific revision:

```bash
helm get manifest my-redis --namespace redis --revision 2
```

Compare this with what Kubernetes reports:

```bash
kubectl get pods --namespace redis
kubectl describe pod my-redis-master-0 --namespace redis
kubectl logs my-redis-master-0 --namespace redis
```

### Using --debug for Verbose Output

When running install or upgrade, add `--debug` for detailed output:

```bash
helm upgrade my-redis bitnami/redis \
  -f redis-values.yaml \
  --namespace redis \
  --debug --dry-run 2>&1 | head -100
```

The debug output shows the computed values, each rendered template, and any errors encountered during rendering.

### Common Failure Scenarios

**Template rendering errors:**

```text
Error: template: mychart/templates/deployment.yaml:15:20: executing "mychart/templates/deployment.yaml"
at <.Values.image.repository>: nil pointer evaluating interface {}.repository
```

This means a required value is missing. Check your values file and ensure all referenced values exist.

**Resource validation errors:**

```text
Error: UPGRADE FAILED: cannot patch "my-redis-master" with kind StatefulSet:
StatefulSet.apps "my-redis-master" is invalid: spec: Forbidden: updates to
statefulset spec for fields other than 'replicas', 'ordinals', 'template',
'updateStrategy', 'persistentVolumeClaimRetentionPolicy' and 'minReadySeconds'
are forbidden
```

This happens when you try to change an immutable field on a StatefulSet. You may need to uninstall and reinstall, or manually delete the StatefulSet first.

**Timeout errors:**

```text
Error: UPGRADE FAILED: timed out waiting for the condition
```

The resources were created but did not reach a ready state in time. Check pod status, events, and logs to understand why.

## Namespace Management

Organizing releases by namespace is a best practice. It provides resource isolation, makes RBAC easier, and keeps `helm list` output manageable.

```bash
# List releases in a specific namespace
helm list --namespace monitoring

# List releases across all namespaces
helm list --all-namespaces
```

A typical namespace organization might look like:

```text
monitoring/    -> prometheus-stack, grafana, alertmanager
ingress/       -> ingress-nginx, cert-manager
database/      -> postgresql, redis
application/   -> frontend, backend, worker
```

Install each component in its namespace:

```bash
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  -f prometheus-values.yaml \
  --namespace monitoring \
  --create-namespace

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  -f ingress-values.yaml \
  --namespace ingress \
  --create-namespace
```

## RBAC Considerations

Since Helm 3 uses your kubeconfig credentials, you can control what users and service accounts can do with standard Kubernetes RBAC.

Create a Role that allows Helm operations in a specific namespace:

```yaml
# helm-deployer-role.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: helm-deployer
  namespace: application
rules:
  # Helm needs to manage secrets for release storage
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list", "create", "update", "patch", "delete"]
  # Helm needs to create and manage application resources
  - apiGroups: ["", "apps", "networking.k8s.io"]
    resources: ["deployments", "services", "configmaps", "ingresses", "pods"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
```

Bind it to a service account used in CI/CD:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: helm-deployer-binding
  namespace: application
subjects:
  - kind: ServiceAccount
    name: ci-deployer
    namespace: application
roleRef:
  kind: Role
  name: helm-deployer
  apiGroup: rbac.authorization.k8s.io
```

## Managing Release History

By default, Helm keeps the last 10 revisions per release. In long-running environments, you may want to adjust this:

```bash
# Set max history during upgrade
helm upgrade my-redis bitnami/redis \
  --history-max 5 \
  --namespace redis

# Set globally via environment variable
export HELM_MAX_HISTORY=20
```

Keeping too many revisions consumes Secret storage in etcd. For high-frequency deployments, consider lowering the history limit and relying on your CI/CD system for audit trails.

## Monitoring Release Health

Combine Helm with kubectl to build a quick health check:

```bash
#!/bin/bash
# check-releases.sh
for ns in monitoring ingress database application; do
  echo "=== Namespace: $ns ==="
  helm list --namespace "$ns" --output table
  echo ""
  kubectl get pods --namespace "$ns" --no-headers | \
    awk '{if ($3 != "Running" && $3 != "Completed") print "  WARNING: " $1 " is " $3}'
  echo ""
done
```

This script iterates through your namespaces, lists releases, and flags any pods that are not in a healthy state.

In the next part, we will explore advanced Helm features including hooks, dependencies, library charts, and integrating Helm into CI/CD pipelines.
