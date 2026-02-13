---
title: Resource Management and Scaling
description: Learn how to optimize resource allocation and implement efficient scaling strategies in Kubernetes
order: 8
---

Effective resource management is crucial for running efficient, cost-effective, and reliable Kubernetes clusters. In this section, we'll explore how to allocate compute resources to your workloads, implement various scaling strategies, and optimize your cluster's overall performance.

## Understanding Kubernetes Resource Management

Kubernetes schedules pods based on available resources. When you specify resource requirements for your containers, the scheduler can make better decisions about which nodes to place your pods on.

### Resource Requests and Limits

The two primary resource controls in Kubernetes are requests and limits:

- **Requests**: The minimum amount of resources a container needs
- **Limits**: The maximum amount of resources a container can use

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: resource-demo
spec:
  containers:
    - name: app
      image: nginx
      resources:
        requests:
          memory: '64Mi'
          cpu: '250m'
        limits:
          memory: '128Mi'
          cpu: '500m'
```

In this example:

- The container requests 64MiB of memory and 0.25 CPU cores
- The container is limited to 128MiB of memory and 0.5 CPU cores

### CPU Resources

CPU resources are measured in CPU units:

- 1 CPU unit = 1 physical or virtual core
- Can be expressed as decimal values
- Commonly specified in millicores (m), where 1000m = 1 CPU

Examples:

- `100m` = 0.1 CPU (10% of a core)
- `500m` = 0.5 CPU (50% of a core)
- `2` = 2 CPUs (2 full cores)

### Memory Resources

Memory is measured in bytes, and you can use the following suffixes:

- `Ki` or `K`: Kibibytes (1024 bytes)
- `Mi` or `M`: Mebibytes (1024 Ki)
- `Gi` or `G`: Gibibytes (1024 Mi)
- `Ti` or `T`: Tebibytes (1024 Gi)

Examples:

- `256Mi` = 256 Mebibytes
- `1Gi` = 1 Gibibyte

### Resource Behavior

How Kubernetes handles resource requests and limits:

1. **CPU (Compressible Resource)**:
   - If a container exceeds its CPU limit, it's throttled but not terminated
   - CPU requests guarantee a minimum amount of CPU time
2. **Memory (Incompressible Resource)**:
   - If a container exceeds its memory limit, it may be terminated (OOMKilled)
   - Memory requests are used for scheduling decisions

## Quality of Service (QoS) Classes

Kubernetes assigns a QoS class to each pod based on its resource specifications:

### Guaranteed

Pods receive the Guaranteed QoS class when:

- Every container has both memory and CPU limits and requests set
- The limits equal the requests

```yaml
resources:
  requests:
    memory: '128Mi'
    cpu: '500m'
  limits:
    memory: '128Mi'
    cpu: '500m'
```

These pods are least likely to be evicted under resource pressure.

### Burstable

Pods receive the Burstable QoS class when:

- At least one container has a memory or CPU request set
- The pod doesn't qualify as Guaranteed

```yaml
resources:
  requests:
    memory: '64Mi'
    cpu: '250m'
  limits:
    memory: '128Mi'
    cpu: '500m'
```

These pods may be evicted if the system is under memory pressure and there are no lower-priority pods.

### BestEffort

Pods receive the BestEffort QoS class when:

- No container has any memory or CPU requests or limits set

```yaml
resources: {}
```

These pods are the first to be evicted under resource pressure.

## Resource Quotas

Resource Quotas restrict the total resource consumption within a namespace:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: team-a
spec:
  hard:
    requests.cpu: '10'
    requests.memory: 20Gi
    limits.cpu: '20'
    limits.memory: 40Gi
    pods: '10'
```

This quota limits the namespace to:

- 10 CPU cores in total requests
- 20 GiB of memory in total requests
- 20 CPU cores in total limits
- 40 GiB of memory in total limits
- 10 pods maximum

You can also set quotas for object counts:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: object-quota
  namespace: team-a
spec:
  hard:
    configmaps: '10'
    persistentvolumeclaims: '5'
    services: '5'
    secrets: '10'
    services.loadbalancers: '1'
```

## Limit Ranges

Limit Ranges set default resource limits and enforce minimum and maximum constraints on resources:

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: team-a
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 256Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      max:
        cpu: 2
        memory: 2Gi
      min:
        cpu: 50m
        memory: 64Mi
```

This LimitRange:

- Sets default limits for containers that don't specify them
- Sets default requests for containers that don't specify them
- Enforces maximum and minimum resource boundaries

## Horizontal Pod Autoscaling

Horizontal Pod Autoscaler (HPA) automatically scales the number of pods based on observed CPU utilization or other metrics.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nginx-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nginx
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

This HPA:

- Targets the `nginx` deployment
- Maintains between 2 and 10 replicas
- Aims to keep CPU utilization at 70%

### Custom Metrics

You can scale based on custom metrics by installing a metrics adapter:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: queue-processor
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: queue-processor
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Pods
      pods:
        metric:
          name: messages_in_queue
        target:
          type: AverageValue
          averageValue: 100
```

This HPA scales based on a custom metric `messages_in_queue`, aiming for an average of 100 messages per pod.

### External Metrics

You can also scale based on metrics from external systems:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: sqs-processor
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: sqs-processor
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: External
      external:
        metric:
          name: sqs_messages
          selector:
            matchLabels:
              queue: my-queue
        target:
          type: AverageValue
          averageValue: 30
```

This HPA scales based on the number of messages in an SQS queue.

## Vertical Pod Autoscaling

Vertical Pod Autoscaler (VPA) adjusts the CPU and memory requests and limits for pods:

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: nginx-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nginx
  updatePolicy:
    updateMode: Auto
  resourcePolicy:
    containerPolicies:
      - containerName: '*'
        minAllowed:
          cpu: 50m
          memory: 64Mi
        maxAllowed:
          cpu: 1
          memory: 1Gi
        controlledResources: ['cpu', 'memory']
```

This VPA:

- Targets the `nginx` deployment
- Automatically updates the pods' resource requests
- Sets minimum and maximum resource boundaries

VPA update modes:

- `Auto`: Automatically updates pod resources, may require pod restarts
- `Recreate`: Similar to Auto but requires pod restarts
- `Initial`: Only applies to new pods
- `Off`: Only provides recommendations without making changes

> **Note:** VPA is not part of standard Kubernetes and requires additional setup.

## Cluster Autoscaling

Cluster Autoscaler adjusts the size of the Kubernetes cluster based on pod resource requests:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-autoscaler-status
  namespace: kube-system
data:
  status: |
    Cluster-autoscaler status at 2023-05-17 12:00:00.
    Cluster is balanced.
    No scale-up required.
    No scale-down candidates.
```

Cluster Autoscaler works with many cloud providers:

- AWS EKS
- GKE
- Azure AKS
- DigitalOcean DOKS

On DigitalOcean, you can enable autoscaling when creating a cluster or by modifying existing node pools. Specify the minimum and maximum node count, and the cluster will automatically scale based on resource demands.

[Sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) to get $200 in free credits and try out their autoscaling features for Kubernetes clusters.

## Analyzing Resource Usage

To optimize resource allocation, you need to understand how your applications use resources:

### Viewing Current Resource Allocation

Check resource requests and limits for pods:

```bash
kubectl get pods -o custom-columns=NAME:.metadata.name,REQUESTS:.spec.containers[0].resources.requests,LIMITS:.spec.containers[0].resources.limits
```

Get resource allocation per node:

```bash
kubectl describe nodes | grep -A 5 "Allocated resources"
```

### Monitoring Resource Usage

Use kubectl to check current resource usage:

```bash
kubectl top nodes
kubectl top pods
```

For more comprehensive monitoring, deploy tools like:

- Prometheus + Grafana
- Datadog
- New Relic
- Dynatrace

## Advanced Scheduling

### Node Affinity

Node Affinity controls which nodes your pods can run on based on node labels:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-node-affinity
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: disktype
                operator: In
                values:
                  - ssd
  containers:
    - name: nginx
      image: nginx
```

This pod will only run on nodes with the label `disktype=ssd`.

Types of node affinity:

- `requiredDuringSchedulingIgnoredDuringExecution`: Hard requirement
- `preferredDuringSchedulingIgnoredDuringExecution`: Soft preference

### Pod Affinity and Anti-Affinity

Pod Affinity and Anti-Affinity control how pods are scheduled relative to other pods:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-pod
spec:
  affinity:
    podAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchExpressions:
              - key: app
                operator: In
                values:
                  - cache
          topologyKey: 'kubernetes.io/hostname'
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          podAffinityTerm:
            labelSelector:
              matchExpressions:
                - key: app
                  operator: In
                  values:
                    - web
            topologyKey: 'kubernetes.io/hostname'
  containers:
    - name: web
      image: nginx
```

This pod:

- Must run on the same node as pods with the label `app=cache`
- Prefers to avoid nodes that already have pods with the label `app=web`

### Taints and Tolerations

Taints mark nodes as unsuitable for certain pods, while tolerations allow pods to run on tainted nodes:

```yaml
# Taint a node
kubectl taint nodes node1 key=value:NoSchedule

# Pod with toleration
apiVersion: v1
kind: Pod
metadata:
  name: nginx-toleration
spec:
  tolerations:
  - key: "key"
    operator: "Equal"
    value: "value"
    effect: "NoSchedule"
  containers:
  - name: nginx
    image: nginx
```

Taint effects:

- `NoSchedule`: Pods won't be scheduled on the node unless they have a matching toleration
- `PreferNoSchedule`: Kubernetes tries to avoid scheduling pods without matching tolerations
- `NoExecute`: Pods without matching tolerations will be evicted if already running

### Pod Topology Spread Constraints

Topology Spread Constraints control how pods are distributed across nodes:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: topology-spread-pod
  labels:
    app: web
spec:
  topologySpreadConstraints:
    - maxSkew: 1
      topologyKey: topology.kubernetes.io/zone
      whenUnsatisfiable: DoNotSchedule
      labelSelector:
        matchLabels:
          app: web
    - maxSkew: 1
      topologyKey: kubernetes.io/hostname
      whenUnsatisfiable: ScheduleAnyway
      labelSelector:
        matchLabels:
          app: web
  containers:
    - name: nginx
      image: nginx
```

This ensures pods with the label `app=web` are distributed evenly across availability zones and nodes.

## Resource Optimization Strategies

### Right-sizing Containers

Follow these steps to properly size your containers:

1. Start with educated guesses based on application requirements

2. Monitor actual usage:

   ```bash
   kubectl top pods
   ```

3. Analyze historical metrics using Prometheus or other monitoring tools

4. Adjust based on observed usage patterns

### Request vs. Limit Ratio

A common practice is to set limits higher than requests to allow for bursting:

- CPU: Limit = 2 × Request (e.g., request: 250m, limit: 500m)
- Memory: Limit = 1.5 × Request (e.g., request: 256Mi, limit: 384Mi)

This approach:

- Guarantees minimum resources
- Allows bursting when resources are available
- Prevents a single pod from consuming all resources

### Using Pod Disruption Budgets

Pod Disruption Budgets (PDBs) ensure high availability during voluntary disruptions:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: nginx-pdb
spec:
  minAvailable: 2 # or maxUnavailable: 1
  selector:
    matchLabels:
      app: nginx
```

This PDB ensures at least 2 pods with the label `app=nginx` are available during disruptions like node drains.

### CPU Throttling Detection

Detect CPU throttling by monitoring the container CPU throttled metric:

- In Prometheus: `container_cpu_cfs_throttled_seconds_total`
- If a container is throttled frequently, consider increasing its CPU limit

### Memory Optimization

Memory optimization techniques:

- Set appropriate JVM heap sizes for Java applications (e.g., `-Xms256m -Xmx512m`)
- Use memory-efficient containers (Alpine-based images)
- Monitor for Out-Of-Memory (OOM) events
- Use initContainers for memory-intensive setup tasks

### Implementing Resource Policies

Create comprehensive resource policies:

1. Define namespace quotas for teams:

   ```yaml
   apiVersion: v1
   kind: ResourceQuota
   metadata:
     name: team-quota
   spec:
     hard:
       requests.cpu: '10'
       requests.memory: 20Gi
       limits.cpu: '20'
       limits.memory: 40Gi
   ```

2. Set default limits with LimitRanges:

   ```yaml
   apiVersion: v1
   kind: LimitRange
   metadata:
     name: default-limits
   spec:
     limits:
       - default:
           cpu: 500m
           memory: 256Mi
         defaultRequest:
           cpu: 100m
           memory: 64Mi
         type: Container
   ```

3. Establish clear naming conventions and tagging strategies

4. Create documentation and training for teams

## Cost Optimization

### Resource Efficiency

Implement these strategies to optimize costs:

1. **Utilize node auto-scaling**: Automatically adjust cluster size based on demand

2. **Use spot/preemptible instances**: For non-critical or batch workloads

3. **Implement cluster hibernation**: Scale down during off-hours

4. **Consolidate underutilized pods**: Use affinity rules to pack pods efficiently

### Resource Monitoring and Reporting

Set up comprehensive monitoring:

1. Monitor resource usage with Prometheus and Grafana

2. Create dashboards showing:

   - Cluster utilization
   - Cost per namespace/team
   - Request vs. usage ratio

3. Set up alerts for:
   - Low resource efficiency
   - Quota approaching limits
   - Cost anomalies

### Cost Allocation

Implement cost allocation strategies:

1. Use namespaces for team or project separation

2. Label resources with cost centers:

   ```yaml
   metadata:
     labels:
       cost-center: team-a
       environment: production
       project: website
   ```

3. Use tools like Kubecost or CloudHealth for detailed cost analysis

## Advanced Scaling Patterns

### Predictive Scaling

Set up scheduled scaling for predictable workloads:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: predictive-scaler
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: website
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30
    scaleDown:
      stabilizationWindowSeconds: 300
```

For more advanced predictive scaling, use external scaling solutions like KEDA (Kubernetes Event-driven Autoscaling).

### Event-Driven Scaling

KEDA enables scaling based on event sources like queues, stream processing, and scheduled times:

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: rabbitmq-scaler
spec:
  scaleTargetRef:
    name: consumer
    kind: Deployment
  pollingInterval: 15
  cooldownPeriod: 30
  minReplicaCount: 1
  maxReplicaCount: 30
  triggers:
    - type: rabbitmq
      metadata:
        queueName: taskQueue
        host: amqp://user:password@rabbitmq:5672/vhost
        queueLength: '50'
```

This scales the consumer deployment based on RabbitMQ queue length.

### Multi-Dimensional Scaling

Use multiple HPAs for different metrics:

```yaml
# CPU-based HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-cpu-scaler
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

```yaml
# Custom metric HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-requests-scaler
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: 1000
```

The deployment will scale based on whichever HPA requires more replicas.

## Best Practices for Resource Management

1. **Always set resource requests and limits**: Prevents resource starvation and noisy neighbor issues

2. **Analyze actual usage**: Monitor resource usage and adjust requests and limits accordingly

3. **Implement namespace quotas**: Control resource consumption by teams

4. **Set default limits with LimitRanges**: Ensure all containers have reasonable defaults

5. **Use appropriate QoS classes**: Match QoS to application importance

6. **Implement Pod Disruption Budgets**: Ensure high availability during disruptions

7. **Configure HPA with appropriate metrics**: Choose metrics that accurately reflect application load

8. **Set up proper alert thresholds**: Be notified before resource issues become critical

9. **Document resource decisions**: Maintain documentation explaining resource choices

10. **Regularly review and optimize**: Resource management is an ongoing process

## Using DigitalOcean for Kubernetes Resource Management

DigitalOcean Kubernetes provides a cost-effective platform with built-in autoscaling capabilities:

- Node auto-scaling based on pod resource requests
- Simple, transparent pricing model
- Prometheus-compatible metrics API
- Integration with DOKS metrics to Datadog, Prometheus, and other monitoring tools

[Sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) to get $200 in free credits and efficiently manage resources on your Kubernetes clusters.

In the next section, we'll explore monitoring and logging in Kubernetes, which are essential for maintaining visibility into your applications and infrastructure.
