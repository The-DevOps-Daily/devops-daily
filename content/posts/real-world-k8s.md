---
title: 'Real-World Kubernetes Deployments'
excerpt: 'Lessons learned from deploying Kubernetes in production environments.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-06-10'
publishedAt: '2024-06-10T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Production
  - DevOps
---

Kubernetes excels at managing containerized applications at scale, but transitioning from development to production involves numerous challenges not covered in most tutorials. After working with dozens of production Kubernetes deployments, we've compiled key lessons that will help you avoid common pitfalls and build more resilient systems.

## Resource Management Is Non-Negotiable

In production, proper resource configuration isn't optional, it's essential.

```yaml
# A properly configured deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: api
          image: company/api-service:v1.2.3
          resources:
            requests:
              memory: '256Mi'
              cpu: '100m'
            limits:
              memory: '512Mi'
              cpu: '500m'
```

Always set resource requests and limits for every container. Without them, you risk:

1. Resource starvation when pods compete for limited resources
2. Nodes becoming overcommitted, leading to instability
3. Unpredictable performance under load

We've seen production outages caused by a single pod without resource limits consuming all available CPU on a node, affecting dozens of other services.

For memory-intensive applications like Java services, be especially careful with limits. Set them based on actual observed usage patterns rather than guesswork. Too low, and your pods will face OOMKilled errors; too high, and you waste cluster resources.

## Implement Probes for Reliability

Kubernetes health probes determine when containers are ready and healthy. Skipping them has real consequences:

```yaml
# Proper implementation of probes
spec:
  containers:
    - name: payment-processor
      image: company/payment-processor:v2.1.0
      ports:
        - containerPort: 8080
      livenessProbe:
        httpGet:
          path: /health
          port: 8080
        initialDelaySeconds: 30
        periodSeconds: 10
        failureThreshold: 3
      readinessProbe:
        httpGet:
          path: /ready
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 5
```

Configure probes with appropriate timeouts based on your application's behavior. We've seen teams set extremely short timeouts for Java applications, causing unnecessary restarts during garbage collection pauses.

Differentiate between readiness and liveness:

- Readiness probes control traffic routing - use them to prevent traffic to pods that aren't ready
- Liveness probes trigger pod restarts - use them only for detecting states where a restart is the remedy

One retail client kept experiencing cascading failures during peak traffic until we fixed probe configurations. Their database connections took 8 seconds to establish, but the readiness probe had only a 1-second timeout, preventing successful deployment during busy periods.

## Network Policies Are Not Optional

By default, Kubernetes allows any pod to communicate with any other pod, a serious security concern in production.

```yaml
# Restrictive network policy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
  namespace: api
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: frontend
      ports:
        - protocol: TCP
          port: 8080
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: database
      ports:
        - protocol: TCP
          port: 5432
```

Start with a zero-trust approach and explicitly define which communications are permitted. This limits the blast radius of security breaches.

A financial services client discovered unauthorized data access between namespaces after implementing network policy monitoring, highlighting connections that had been occurring silently for months.

## Storage Requires Special Attention

Storage in Kubernetes introduces complexity, especially for stateful applications.

```yaml
# Production-grade PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  annotations:
    volume.beta.kubernetes.io/storage-class: 'managed-premium'
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
```

For production workloads:

1. Use storage classes appropriate for your applications' performance needs
2. Understand the backup mechanisms for your persistent volumes
3. Test storage failover scenarios before relying on them in production
4. Be aware of storage IOPS limits in cloud environments

One e-commerce company lost 4 hours of customer orders when they moved their database to a Kubernetes-managed volume without understanding the implications of node failure on their chosen storage class.

## Secrets Management Requires a Strategy

Kubernetes secrets are base64-encoded, not encrypted. Without additional measures, they're visible to anyone with API access.

```yaml
# Using external secrets operator with AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-credentials
spec:
  refreshInterval: '15m'
  secretStoreRef:
    name: aws-secretsmanager
    kind: ClusterSecretStore
  target:
    name: database-credentials
  data:
    - secretKey: username
      remoteRef:
        key: production/database
        property: username
    - secretKey: password
      remoteRef:
        key: production/database
        property: password
```

Consider these approaches for production:

- Utilize a secret management tool like HashiCorp Vault or cloud provider secret stores
- Use solutions like Sealed Secrets or External Secrets Operator to securely store secrets in Git
- Implement RBAC to restrict which pods can access which secrets

Never store unencrypted secrets in your Git repositories, even private ones.

## Implement Proper Pod Disruption Budgets

When Kubernetes needs to drain nodes for maintenance, Pod Disruption Budgets (PDBs) prevent too many replicas of a service from going down simultaneously.

```yaml
# Pod Disruption Budget for critical service
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: payment-api-pdb
spec:
  minAvailable: 2 # or use maxUnavailable
  selector:
    matchLabels:
      app: payment-api
```

Without PDBs, routine cluster upgrades can cause service outages. We've seen entire production services become unavailable during automated node upgrades simply because a team forgot to implement PDBs.

Define them for all critical services, especially stateful ones like databases or messaging systems.

## Node Affinity for Performance-Sensitive Workloads

Not all workloads have the same resource needs. Use node affinity to place pods on appropriate hardware.

```yaml
# Using node affinity for specialized workloads
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: node-type
                operator: In
                values:
                  - compute-optimized
```

For a media processing client, we created dedicated node pools with GPUs and used node affinity to ensure video processing jobs landed on these specialized nodes, while keeping their cost-sensitive workloads on standard instances.

Node anti-affinity is equally important for high-availability:

```yaml
# Ensuring pods spread across nodes
spec:
  affinity:
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchExpressions:
              - key: app
                operator: In
                values:
                  - database
          topologyKey: 'kubernetes.io/hostname'
```

This prevents multiple replicas of critical components from being scheduled on the same node, improving fault tolerance.

## Monitoring Beyond Basic Metrics

While CPU and memory usage are important, production monitoring needs to go deeper. Implement:

1. **Golden Signals monitoring**: Latency, traffic, errors, and saturation for all services
2. **Custom application metrics**: Business-specific metrics tied to user experience
3. **Distributed tracing**: For understanding service-to-service communication

```yaml
# Prometheus ServiceMonitor example
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: api-service-monitor
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: api-service
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
  namespaceSelector:
    matchNames:
      - production
```

A retail client was seeing timeouts during peak shopping hours. Standard monitoring showed normal CPU/memory usage, but custom metrics revealed database connection pool exhaustion, something not visible with default monitoring.

## Auto-scaling Requires Careful Configuration

Horizontal Pod Autoscaling (HPA) is powerful but requires proper configuration based on real-world load patterns.

```yaml
# Custom metric-based autoscaling
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-processor
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-processor
  minReplicas: 5
  maxReplicas: 50
  metrics:
    - type: Pods
      pods:
        metric:
          name: kafka_consumer_lag_sum
        target:
          type: AverageValue
          averageValue: 100
```

For reliable autoscaling:

- Choose metrics that truly represent load (sometimes it's not CPU)
- Set appropriate cooldown periods to prevent thrashing
- Test scaling behavior with realistic load patterns before production

A fintech company implemented CPU-based autoscaling but found their services scaling too late during traffic spikes. Switching to request rate-based autoscaling improved responsiveness dramatically.

## Upgrade Strategies Matter

Kubernetes upgrades are inevitable, and how you handle them impacts production availability.

```yaml
# Rolling update with zero downtime configuration
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
```

For critical services, consider these practices:

- Use rolling updates with low `maxUnavailable` values
- Implement readiness gates tied to application health
- For stateful services, plan for manual verification steps

We helped a healthcare client implement blue/green deployments for their patient-facing applications to ensure zero-downtime updates and easier rollbacks when needed.

## Resource Quotas Prevent Surprises

Namespace resource quotas protect your cluster from unexpected resource consumption.

```yaml
# Namespace resource quota
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-resources
  namespace: team-a
spec:
  hard:
    requests.cpu: '10'
    requests.memory: 20Gi
    limits.cpu: '20'
    limits.memory: 40Gi
    pods: '30'
```

Without quotas, a single team or application can accidentally consume all available cluster resources. This creates a "noisy neighbor" problem that affects other applications.

For large organizations, implement quotas as a standard practice when creating namespaces. Combined with LimitRanges, they enforce resource discipline across teams.

## Stateful Applications Require Extra Care

Running stateful services like databases in Kubernetes remains challenging.

```yaml
# StatefulSet with volume claim templates
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: 'postgres'
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:14
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ['ReadWriteOnce']
        storageClassName: 'premium-ssd'
        resources:
          requests:
            storage: 100Gi
```

For production stateful services:

- Use operators designed for that specific technology when available (e.g., the PostgreSQL Operator)
- Implement proper backup and restore procedures
- Test failure scenarios thoroughly before production

While running databases in Kubernetes is increasingly common, many organizations still find it beneficial to use managed database services from cloud providers for critical production workloads.

## Security Is a Continuous Process

Kubernetes security isn't a one-time setup; it requires ongoing attention.

1. **Scan container images**: Implement vulnerability scanning in your CI/CD pipeline
2. **Update base images**: Regularly rebuild containers with the latest base images
3. **Implement pod security standards**: Use Pod Security Admission or OPA/Gatekeeper

```yaml
# Pod Security Context
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 2000
  containers:
    - name: app
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
```

Always run containers as non-root users and apply the principle of least privilege. Containers should only have the permissions they actually need to function.

## Conclusion: Production Readiness Is a Journey

Moving to production Kubernetes is an ongoing process, not a destination. Even mature deployments require continuous refinement as applications evolve and usage patterns change.

Start with these production-focused practices:

1. Implement comprehensive resource management
2. Configure proper health probes
3. Secure your cluster with network policies
4. Plan your storage strategy carefully
5. Implement proper monitoring and alerting
6. Test failure modes before they happen in production

The most successful Kubernetes deployments we've seen share a common trait: they treat infrastructure as a product that evolves continuously rather than a project with a fixed endpoint.

By applying these production lessons, you'll avoid many of the painful experiences others have encountered on their Kubernetes journey.
