---
title: 'Right-Sizing Kubernetes Resources with VPA and Karpenter'
excerpt: 'Overprovisioned CPU and memory in Kubernetes increases costs and reduces efficiency. Learn how to use Vertical Pod Autoscaler, Karpenter, and monitoring tools to balance performance and resource usage.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2025-08-10'
publishedAt: '2025-08-10T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Autoscaling
  - Karpenter
  - DevOps
---

## TLDR

Setting CPU and memory requests too high in Kubernetes wastes money and reduces cluster efficiency. This guide shows you how to identify overprovisioned workloads, use Vertical Pod Autoscaler (VPA) to right-size your pods, and implement Karpenter for smarter node scaling. You'll also learn to monitor costs and validate your improvements with real metrics.

When you set resource requests too conservatively in Kubernetes, your cluster reserves more capacity than workloads actually need. This leads to underutilized nodes and higher cloud bills. The problem gets worse at scale - imagine 200 pods each requesting 2 CPU cores but only using 200m. That's 400 reserved cores when actual demand is closer to 40 cores.

The solution involves right-sizing both your pods and nodes. You'll use monitoring data to understand actual usage, apply VPA to adjust pod requests automatically, and leverage Karpenter to provision nodes that match your workload requirements.

## Prerequisites

Before you start, make sure you have:

- A Kubernetes cluster (version 1.20 or higher) with metrics-server installed
- kubectl configured with admin access to your cluster
- Prometheus and Grafana deployed for monitoring (or similar observability stack)
- Basic understanding of Kubernetes resource requests and limits

You'll also need the ability to install cluster-wide components like VPA and Karpenter.

## Identifying Overprovisioned Workloads

The first step is understanding how your current workloads use resources compared to what they request. You can start with kubectl to get a quick snapshot of resource usage across your cluster.

```bash
# Check current resource usage for all nodes
kubectl top nodes

# View pod resource usage across all namespaces
kubectl top pods --all-namespaces --sort-by=cpu

# Get detailed resource requests vs usage for a specific namespace
kubectl describe nodes | grep -A 15 "Allocated resources"
```

These commands show you the gap between requested and actual resource usage. If you see pods consistently using 50Mi of memory while requesting 1Gi, or using 100m CPU while requesting 1000m, those are prime candidates for right-sizing.

For deeper analysis, you'll want historical data from Prometheus. Here are some key queries to run in your Grafana dashboard:

```promql
# CPU utilization percentage (actual usage vs requests)
(rate(container_cpu_usage_seconds_total{container!=""}[5m]) * 100) /
(container_spec_cpu_quota{container!=""} / container_spec_cpu_period{container!=""})

# Memory utilization percentage
(container_memory_working_set_bytes{container!=""} * 100) /
container_spec_memory_limit_bytes{container!=""}

# Top 10 pods with the highest request-to-usage ratio (biggest waste)
topk(10,
  (container_spec_cpu_quota{container!=""} / container_spec_cpu_period{container!=""}) /
  rate(container_cpu_usage_seconds_total{container!=""}[5m])
)
```

Run these queries over a 2-week period to account for traffic variations and identify consistent patterns. Workloads running at 10-20% utilization with stable traffic are good candidates for optimization.

## Installing and Configuring VPA

Vertical Pod Autoscaler analyzes your workloads and recommends optimal CPU and memory values. Start by installing VPA in your cluster.

```bash
# Clone the VPA repository
git clone https://github.com/kubernetes/autoscaler.git
cd autoscaler/vertical-pod-autoscaler

# Deploy VPA components
./hack/vpa-up.sh
```

This script installs three main components: the VPA recommender (analyzes usage), the updater (applies changes), and the admission controller (validates recommendations).

Next, create a VPA configuration for a workload you want to optimize. Start with recommendation mode to see suggested values before making changes.

```yaml
# vpa-web-service.yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: web-service-vpa
  namespace: production
spec:
  targetRef:
    apiVersion: 'apps/v1'
    kind: Deployment
    name: web-service
  updatePolicy:
    updateMode: 'Off' # Only provide recommendations, don't auto-update
  resourcePolicy:
    containerPolicies:
      - containerName: web-app
        # Set boundaries to prevent extreme recommendations
        maxAllowed:
          cpu: '2'
          memory: '4Gi'
        minAllowed:
          cpu: '100m'
          memory: '128Mi'
        controlledResources: ['cpu', 'memory']
```

Apply the VPA configuration and wait for recommendations to generate:

```bash
kubectl apply -f vpa-web-service.yaml

# Wait a few minutes, then check recommendations
kubectl describe vpa web-service-vpa -n production
```

The output shows recommended values for CPU and memory under the `Status` section. VPA typically suggests values based on the 90th percentile of usage over the past 8 days, which provides a safety buffer while eliminating waste.

## Applying VPA Recommendations Safely

Once you have solid recommendations, you can apply them gradually. Start with non-critical workloads and monitor for any issues.

```yaml
# Update your deployment with VPA recommendations
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-service
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-service
  template:
    metadata:
      labels:
        app: web-service
    spec:
      containers:
        - name: web-app
          image: nginx:1.21
          resources:
            requests:
              cpu: '250m' # Reduced from 1000m based on VPA recommendation
              memory: '512Mi' # Reduced from 2Gi based on VPA recommendation
            limits:
              cpu: '500m' # Set limits 2x requests for burst capacity
              memory: '1Gi'
```

After updating requests, monitor your workloads for at least a week. Watch for:

- Increased pod restarts or OOMKilled events
- Higher response times or error rates
- Pods getting evicted under memory pressure

If everything runs smoothly, you can switch VPA to automatic mode:

```bash
# Update VPA to automatically apply changes
kubectl patch vpa web-service-vpa -n production --type='merge' -p='{"spec":{"updatePolicy":{"updateMode":"Auto"}}}'
```

In Auto mode, VPA will restart pods when it detects they need different resource allocations. Make sure you have proper PodDisruptionBudgets in place to maintain availability during updates.

## Setting Up Karpenter for Node Optimization

While VPA optimizes individual pods, Karpenter optimizes your entire node infrastructure. Instead of fixed node groups, Karpenter provisions nodes dynamically based on your workload requirements.

First, install Karpenter in your cluster. The exact steps depend on your cloud provider, but here's the process for AWS EKS:

```bash
# Install Karpenter using Helm
helm upgrade --install karpenter oci://public.ecr.aws/karpenter/karpenter \
  --version "0.32.0" \
  --namespace "karpenter" \
  --create-namespace \
  --set "settings.clusterName=${CLUSTER_NAME}" \
  --set "settings.interruptionQueueName=${CLUSTER_NAME}" \
  --wait
```

Next, create a NodePool that defines what types of nodes Karpenter can provision:

```yaml
# karpenter-nodepool.yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: general-purpose
spec:
  # Template for nodes Karpenter will create
  template:
    metadata:
      labels:
        node-type: general-purpose
    spec:
      # Instance requirements - Karpenter will pick the best fit
      requirements:
        - key: kubernetes.io/arch
          operator: In
          values: ['amd64']
        - key: karpenter.sh/capacity-type
          operator: In
          values: ['spot', 'on-demand'] # Allow both for cost optimization
        - key: node.kubernetes.io/instance-type
          operator: In
          values: ['m6i.large', 'm6i.xlarge', 'm6i.2xlarge', 'r6i.large', 'r6i.xlarge']

      # Node configuration
      nodeClassRef:
        apiVersion: karpenter.k8s.aws/v1beta1
        kind: EC2NodeClass
        name: general-purpose

      # Taints to control which pods can schedule here
      taints:
        - key: karpenter.sh/unschedulable
          value: 'true'
          effect: NoSchedule

  # Scaling and disruption policies
  limits:
    cpu: 1000 # Maximum CPU across all nodes in this pool
  disruption:
    consolidationPolicy: WhenUnderutilized
    consolidateAfter: 30s
```

Create the corresponding EC2NodeClass for AWS-specific configuration:

```yaml
# karpenter-nodeclass.yaml
apiVersion: karpenter.k8s.aws/v1beta1
kind: EC2NodeClass
metadata:
  name: general-purpose
spec:
  # AMI and instance configuration
  amiFamily: AL2
  subnetSelectorTerms:
    - tags:
        karpenter.sh/discovery: '${CLUSTER_NAME}'
  securityGroupSelectorTerms:
    - tags:
        karpenter.sh/discovery: '${CLUSTER_NAME}'

  # Instance store configuration
  userData: |
    #!/bin/bash
    /etc/eks/bootstrap.sh ${CLUSTER_NAME}

  # Tags for cost tracking
  tags:
    Team: platform
    Environment: production
```

Apply both configurations:

```bash
kubectl apply -f karpenter-nodepool.yaml
kubectl apply -f karpenter-nodeclass.yaml
```

Karpenter will now monitor unschedulable pods and provision appropriately-sized nodes. When you deploy workloads with right-sized resource requests (thanks to VPA), Karpenter will select smaller, more cost-effective instances.

## Monitoring Cost Impact

To validate your optimizations, you need visibility into resource costs. Kubecost provides detailed insights into how much each workload costs and how much capacity you're wasting.

Install Kubecost in your cluster:

```bash
# Add the Kubecost Helm repository
helm repo add kubecost https://kubecost.github.io/cost-analyzer/

# Install Kubecost with Prometheus integration
helm install kubecost kubecost/cost-analyzer \
  --namespace kubecost \
  --create-namespace \
  --set kubecostToken="your-token-here" \
  --set prometheus.server.global.external_labels.cluster_id="${CLUSTER_NAME}"
```

Access the Kubecost UI by port-forwarding:

```bash
kubectl port-forward -n kubecost deployment/kubecost-cost-analyzer 9090:9090
```

In the Kubecost dashboard, focus on these key metrics:

- **Efficiency scores**: Shows the percentage of requested resources actually being used
- **Idle costs**: Money spent on provisioned but unused resources
- **Right-sizing recommendations**: Suggestions for adjusting requests and limits
- **Namespace costs**: Helps identify which teams or applications drive costs

Track these metrics before and after implementing VPA and Karpenter to quantify your savings.

## Real-World Optimization Example

Let's walk through optimizing a typical microservice deployment. You start with a Node.js API that was conservatively configured:

```yaml
# Before optimization
resources:
  requests:
    cpu: '1000m'
    memory: '2Gi'
  limits:
    cpu: '2000m'
    memory: '4Gi'
```

After running this workload for two weeks, your monitoring shows:

- Average CPU usage: 150m (15% of requests)
- Average memory usage: 400Mi (20% of requests)
- Peak CPU usage: 300m
- Peak memory usage: 800Mi

Based on this data, VPA recommends:

```yaml
# VPA recommendations (with safety buffer)
resources:
  requests:
    cpu: '200m' # Covers 99th percentile usage
    memory: '512Mi' # Accounts for memory spikes
  limits:
    cpu: '400m' # 2x requests for burst capacity
    memory: '1Gi' # Prevents OOM while allowing growth
```

The cost impact for 20 replicas of this service:

- **Before**: 20 CPU cores, 40Gi memory requested
- **After**: 4 CPU cores, 10Gi memory requested
- **Savings**: 80% reduction in resource allocation

With Karpenter managing nodes, this workload now runs on smaller instances, further reducing costs by eliminating the need for oversized nodes.

## Setting Resource Quotas and Guardrails

As you roll out right-sizing across your organization, implement quotas to prevent teams from reverting to oversized requests:

```yaml
# namespace-quota.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: backend-team-quota
  namespace: backend
spec:
  hard:
    requests.cpu: '50' # Total CPU requests across all pods
    requests.memory: '100Gi' # Total memory requests
    limits.cpu: '100' # Total CPU limits
    limits.memory: '200Gi' # Total memory limits
    pods: '100' # Maximum number of pods
```

You can also create LimitRanges to enforce reasonable defaults:

```yaml
# limit-range.yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: pod-limits
  namespace: backend
spec:
  limits:
    - type: Container
      default: # Default limits if not specified
        cpu: '500m'
        memory: '1Gi'
      defaultRequest: # Default requests if not specified
        cpu: '100m'
        memory: '256Mi'
      max: # Maximum allowed values
        cpu: '4'
        memory: '8Gi'
      min: # Minimum required values
        cpu: '50m'
        memory: '64Mi'
```

These guardrails help maintain optimization gains while giving teams flexibility within reasonable bounds.

## Troubleshooting Common Issues

When implementing VPA and Karpenter, you might encounter some challenges. Here are solutions to the most common problems:

**VPA recommendations seem too aggressive**: VPA sometimes suggests very low values during low-traffic periods. Check that your monitoring data covers representative traffic patterns. You can also adjust the VPA algorithm:

```yaml
spec:
  resourcePolicy:
    containerPolicies:
      - containerName: web-app
        controlledValues: RequestsOnly # Only adjust requests, leave limits alone
        mode: Auto
```

**Karpenter nodes aren't scaling down**: This usually happens when pods can't be evicted. Check for:

```bash
# Look for pods without PodDisruptionBudgets
kubectl get pods --all-namespaces -o wide | grep -v Terminating

# Check for pods using local storage or host networking
kubectl get pods --all-namespaces -o yaml | grep -A 5 hostNetwork

# Verify PodDisruptionBudgets allow eviction
kubectl get pdb --all-namespaces
```

**Pods getting OOMKilled after VPA optimization**: This indicates VPA recommendations were too low. Temporarily increase memory requests and check for memory leaks in your application:

```bash
# Check recent OOM events
kubectl get events --sort-by=.metadata.creationTimestamp | grep OOMKilled

# Monitor memory usage patterns
kubectl top pods --sort-by=memory --all-namespaces
```

You can make VPA more conservative by setting higher safety margins:

```yaml
spec:
  resourcePolicy:
    containerPolicies:
      - containerName: web-app
        maxAllowed:
          memory: '2Gi' # Set a reasonable upper bound
```

## Next Steps

Now that you have VPA and Karpenter working together, consider these additional optimizations:

- **Horizontal Pod Autoscaling**: Combine with VPA to handle both vertical and horizontal scaling
- **Cluster Autoscaler tuning**: If using multiple node provisioners, configure them to work together
- **Cost alerts**: Set up notifications when resource costs exceed thresholds
- **Regular reviews**: Schedule monthly reviews of VPA recommendations and cost reports

You can also explore more advanced Karpenter features like multiple NodePools for different workload types (CPU-intensive, memory-intensive, GPU workloads) and spot instance strategies for non-critical workloads.

The key is to treat right-sizing as an ongoing process. As your applications evolve and traffic patterns change, continue monitoring and adjusting to maintain optimal resource utilization.


## Related Resources

- [Checking Pod CPU and Memory](/posts/checking-kubernetes-pod-cpu-and-memory-utilization)
- [Kubernetes HPA Lab Exercise](/exercises/kubernetes-hpa-lab)
- [Introduction to Kubernetes: Resource Management](/guides/introduction-to-kubernetes)
- [DevOps Roadmap](/roadmap)
- [DevOps Survival Guide](/books/devops-survival-guide)
