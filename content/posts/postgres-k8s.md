---
title: 'Why Running Postgres on Kubernetes Is Still a Bad Idea (And What to Do Instead)'
excerpt: 'Everyone wants to run databases on Kubernetes, but should you? We explore the real challenges of stateful workloads and better alternatives.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-11-15'
publishedAt: '2024-11-15T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - PostgreSQL
  - Databases
  - Cloud Native
featured: true
---

Let's address the elephant in the room: just because you _can_ run PostgreSQL on Kubernetes doesn't mean you _should_.

Kubernetes has revolutionized application deployment, but despite significant improvements in StatefulSets and storage management, running production Postgres databases on Kubernetes remains challenging. After helping dozens of organizations navigate these waters, we've compiled the real issues you'll face, and what you should consider instead.

## The Operational Reality of Postgres on Kubernetes

While many tutorials make it seem straightforward, production databases have requirements that clash with Kubernetes' design principles.

### Storage Performance and Reliability Concerns

Kubernetes abstracts away the underlying infrastructure, which is fantastic for stateless applications but problematic for databases. When you run Postgres on Kubernetes, you're adding layers between your database and its storage:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: 'standard'
```

This seemingly simple configuration hides complexity:

1. The Storage Class determines fundamental performance characteristics
2. Volume provisioners add their own latency and failure modes
3. Node failures require volume remounting, which can be slow
4. Storage performance varies significantly across cloud providers and configurations

A financial services client discovered their Postgres-on-Kubernetes deployment had 30% higher latency than the equivalent VM deployment, simply due to the additional abstraction layers.

### Unpredictable Neighbor Behavior

Kubernetes schedules workloads based on available resources, which can lead to noisy neighbor problems:

```yaml
# Most Postgres-on-K8s setups don't use this critical configuration
apiVersion: v1
kind: Pod
metadata:
  name: postgres
spec:
  containers:
    - name: postgres
      image: postgres:15
      resources:
        requests:
          memory: '2Gi'
          cpu: '2'
        limits:
          memory: '2Gi'
          cpu: '2'
      # Missing: CPU Quality of Service guarantees
```

On production clusters:

- Other pods may consume burst CPU, affecting Postgres performance
- Memory pressure on nodes can cause unexpected OOM kills
- Network contention isn't accounted for in standard configurations

To mitigate these issues, you need complex configurations with:

- Pod anti-affinity rules
- Dedicated node pools
- Taints and tolerations
- PriorityClasses

These workarounds essentially recreate dedicated VMs, negating much of Kubernetes' flexibility advantages.

### Complex Backup and Recovery Procedures

Databases require robust backup solutions. Here's the reality with Kubernetes:

1. Volume snapshots are provider-specific and may not be consistent
2. Logical backups require careful coordination with Postgres
3. Point-in-time recovery becomes significantly more complex

An e-commerce company lost four hours of critical data when a node failure occurred during a high-traffic period. Their backup strategy worked in testing but failed under real production conditions due to unexpected pod scheduling behavior.

### Upgrades and Maintenance Windows

Upgrading Postgres in Kubernetes involves several moving parts:

```yaml
# Simplified StatefulSet update
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  replicas: 1
  serviceName: postgres
  updateStrategy:
    type: RollingUpdate
  template:
    spec:
      containers:
        - name: postgres
          image: postgres:15.2 # Changing this triggers a pod restart
```

But wait:

1. How does the new pod get access to existing data?
2. How are schema migrations handled?
3. What happens to existing connections during failover?
4. How do you verify database integrity after version upgrades?

These questions are easily answered in traditional setups but become complex orchestration challenges in Kubernetes.

## Where Things Go Wrong: Real-World Scenarios

### Case Study: The 3AM Failover Problem

A healthcare tech company implemented Postgres on Kubernetes with the following setup:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-primary
spec:
  replicas: 1
  # Other configuration...
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-replica
spec:
  replicas: 2
  # Other configuration...
```

When a node failure occurred at 3AM, their configuration led to:

1. The primary pod being rescheduled to another node
2. Volume reattachment taking 45 seconds
3. Postgres taking 30 seconds to recover from improper shutdown
4. Replica pods attempting to reconnect prematurely
5. One replica corrupting its data state

The entire recovery took 15 minutes instead of the expected automatic failover, requiring manual intervention.

### Case Study: The Hidden Performance Cliff

A fintech startup ran into severe performance degradation when their dataset grew beyond a certain size:

1. Initial performance was excellent on small datasets
2. As data grew to 500GB, query performance degraded dramatically
3. Investigation revealed the storage class was optimized for throughput, not IOPS
4. Changing storage classes required database migration
5. The migration process required 8 hours of downtime

This wouldn't have been an issue on dedicated instances where storage could be expanded without migration.

## When Postgres on Kubernetes Actually Makes Sense

Despite the challenges, there are limited cases where Kubernetes-managed Postgres works well:

1. **Development and testing environments** where data durability isn't critical
2. **Specialized short-lived databases** that are regularly recreated
3. **Organizations with Kubernetes expertise** and dedicated database platform teams
4. **Small-scale, non-critical applications** where downtime is acceptable

If you must run Postgres on Kubernetes in production, consider using an operator-based approach:

```yaml
# Example using a Postgres Operator
apiVersion: postgres-operator.crunchydata.com/v1beta1
kind: PostgresCluster
metadata:
  name: hippo
spec:
  image: registry.developers.crunchydata.com/crunchydata/crunchy-postgres:ubi8-15.2-1
  postgresVersion: 15
  instances:
    - name: instance1
      dataVolumeClaimSpec:
        accessModes:
          - 'ReadWriteOnce'
        resources:
          requests:
            storage: 1Gi
  backups:
    pgbackrest:
      image: registry.developers.crunchydata.com/crunchydata/crunchy-pgbackrest:ubi8-2.41-1
      repos:
        - name: repo1
          volume:
            volumeClaimSpec:
              accessModes:
                - 'ReadWriteOnce'
              resources:
                requests:
                  storage: 1Gi
```

Operators handle many edge cases but still require careful planning and sophisticated operations knowledge.

## Better Alternatives for Production Postgres

Instead of wrestling with the complexities of Postgres on Kubernetes, consider these alternatives:

### 1. Cloud Provider Managed Database Services

All major cloud providers offer fully-managed Postgres services:

- **AWS RDS or Aurora PostgreSQL**: Handles backups, high availability, and scaling
- **Google Cloud SQL**: Offers point-in-time recovery and automated maintenance
- **Azure Database for PostgreSQL**: Provides threat protection and intelligent performance

Benefits:

- Significantly reduced operational overhead
- Built-in high availability and disaster recovery
- Automated backups and point-in-time recovery
- Performance optimized for database workloads
- Direct integration with other cloud services

Most managed services cost more than running your own instances, but the savings in engineering time and reduced risk typically outweigh the difference.

### 2. Dedicated Virtual Machines or Bare Metal

For organizations requiring more control or dealing with specific compliance requirements, dedicated VMs still make sense:

```terraform
# Example Terraform for a dedicated Postgres VM
resource "aws_instance" "postgres" {
  ami           = "ami-0123456789abcdef0"
  instance_type = "db.r5.xlarge"  # Instance optimized for database workloads

  root_block_device {
    volume_size = 100
    volume_type = "io1"
    iops        = 3000
  }

  # Other configuration...
}
```

Benefits:

- Predictable performance characteristics
- Simpler troubleshooting and observability
- Direct control over storage configuration
- Easier integration with traditional backup solutions
- Zero abstraction layers between Postgres and storage

### 3. Database-as-a-Service Providers

Specialized DBaaS providers focus exclusively on database management:

- **Aiven for PostgreSQL**: Offers fully managed Postgres on multiple clouds
- **Crunchy Bridge**: Built by PostgreSQL experts with specialized management tools
- **ElephantSQL**: Simple, cost-effective hosted PostgreSQL

Benefits:

- Deep PostgreSQL expertise from the provider
- Cross-cloud portability
- Purpose-built monitoring and management tools
- Often more cost-effective than hyperscaler offerings for specific use cases

### 4. Kubernetes-External Database with Service Connection

Keep your applications in Kubernetes while your database stays outside:

```yaml
# Kubernetes External Service connecting to external Postgres
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  type: ExternalName
  externalName: postgres.your-db-provider.com
---
# Secret for connection credentials
apiVersion: v1
kind: Secret
metadata:
  name: postgres-credentials
type: Opaque
data:
  username: cG9zdGdyZXM= # base64 encoded
  password: c2VjcmV0 # base64 encoded
```

Your applications connect to the Service as if Postgres were running in the cluster, but the database actually runs elsewhere.

Benefits:

- Keep application deployment model consistent
- Get the database reliability you need
- Simplify your Kubernetes environment
- Avoid complex StatefulSet configurations

## The Path Forward: Hybrid Approaches

Many organizations find success with a hybrid approach:

1. **Run stateless workloads on Kubernetes**: APIs, web servers, processing jobs
2. **Keep stateful services external**: Databases, message queues, caches
3. **Use Kubernetes-native connection methods**: ExternalName Services and Secrets

This approach leverages Kubernetes' strengths while acknowledging its limitations.

## Conclusion: Make the Right Trade-offs

Kubernetes excels at managing stateless services but adds complexity for databases. When deciding where to run Postgres, consider:

1. Your team's expertise in both Kubernetes and Postgres
2. Your application's performance and reliability requirements
3. Your tolerance for operational complexity
4. Your budget for both infrastructure and engineering time

For most organizations, the simplest path to a reliable, performant Postgres database isn't through Kubernetes. Focus your Kubernetes efforts on the workloads it manages best, and let purpose-built solutions handle your critical data.

**Bottom line**: Instead of asking "How do we run Postgres on Kubernetes?", ask "What's the most reliable, maintainable way to provide database services to our applications?" The answer will rarely involve StatefulSets.
