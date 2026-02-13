---
title: Persistent Storage in Kubernetes
description: Learn how to manage persistent data for stateful applications using Kubernetes storage options
order: 7
---

Containers are ephemeral by design, when a pod is deleted or rescheduled, its internal data is lost. However, most applications need to persist data beyond the container lifecycle. Kubernetes provides several abstractions to manage persistent storage for your applications. In this section, we'll explore how to use volumes, persistent volumes, and storage classes to manage stateful data.

## Understanding Kubernetes Storage Architecture

Kubernetes has a layered storage architecture with several key components:

1. **Volumes**: The most basic storage abstraction, tied to the pod lifecycle
2. **Persistent Volumes (PV)**: Cluster-wide storage resources that exist independently of pods
3. **Persistent Volume Claims (PVC)**: Requests for storage by users that are bound to Persistent Volumes
4. **Storage Classes**: Define types of storage with different characteristics

Let's explore each of these components in detail.

## Basic Volume Types

Kubernetes supports many volume types that mount directly into pods. Here are some commonly used types:

### emptyDir

An `emptyDir` volume is created when a pod is assigned to a node and exists as long as the pod runs on that node. When the pod is removed, the data in the `emptyDir` is deleted.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-pd
spec:
  containers:
    - name: test-container
      image: nginx
      volumeMounts:
        - mountPath: /cache
          name: cache-volume
  volumes:
    - name: cache-volume
      emptyDir: {}
```

Use cases for `emptyDir`:

- Scratch space for temporary files
- Checkpoint storage for long computations
- Shared storage for containers in the same pod

### hostPath

A `hostPath` volume mounts a file or directory from the host node's filesystem into your pod.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-hostpath
spec:
  containers:
    - name: test-container
      image: nginx
      volumeMounts:
        - mountPath: /test-data
          name: test-volume
  volumes:
    - name: test-volume
      hostPath:
        path: /data
        type: Directory
```

The `type` field can be:

- `DirectoryOrCreate`: Creates the directory if it doesn't exist
- `Directory`: Directory must exist
- `FileOrCreate`: Creates an empty file if it doesn't exist
- `File`: File must exist
- `Socket`: UNIX socket must exist
- `CharDevice`: Character device must exist
- `BlockDevice`: Block device must exist

> ⚠️ **Warning**: `hostPath` volumes pose security risks because they allow pods to access the host filesystem. Use with caution in production environments.

### configMap and secret

As we covered in the previous section, ConfigMaps and Secrets can be mounted as volumes to provide configuration data and sensitive information to pods.

### Other Basic Volume Types

Kubernetes supports many other volume types for various use cases:

- `downwardAPI`: Exposes pod and container data to applications
- `projected`: Maps several volume sources into the same directory
- `csi`: Container Storage Interface for third-party storage plugins
- Cloud provider-specific volumes: `awsElasticBlockStore`, `azureDisk`, `gcePersistentDisk`

## Persistent Volumes and Claims

For data that needs to survive pod restarts and reschedules, Kubernetes provides Persistent Volumes (PVs) and Persistent Volume Claims (PVCs).

### Persistent Volumes (PV)

A PersistentVolume is a piece of storage provisioned by an administrator or dynamically provisioned using Storage Classes. It exists independently of any pod.

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-example
spec:
  capacity:
    storage: 10Gi
  volumeMode: Filesystem
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: standard
  hostPath:
    path: /data/pv-example
```

Key fields in a PersistentVolume:

- **capacity**: How much storage is available
- **volumeMode**: Filesystem (default) or Block
- **accessModes**: How the volume can be mounted
  - `ReadWriteOnce` (RWO): Volume can be mounted as read-write by a single node
  - `ReadOnlyMany` (ROX): Volume can be mounted read-only by many nodes
  - `ReadWriteMany` (RWX): Volume can be mounted as read-write by many nodes
- **persistentVolumeReclaimPolicy**: What happens when a claim is released
  - `Retain`: Manual reclamation (default)
  - `Delete`: Automatically delete PV and storage
  - `Recycle`: Basic scrub (deprecated)
- **storageClassName**: Name of StorageClass for dynamic provisioning
- Volume-specific parameters (e.g., `hostPath`, `nfs`, etc.)

### Persistent Volume Claims (PVC)

A PersistentVolumeClaim is a request for storage by a user. It's similar to a pod in that pods consume node resources and PVCs consume PV resources.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-example
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: standard
```

When you create a PVC, Kubernetes finds a matching PV based on:

- Access modes
- Size
- Storage class
- Volume mode
- Selector

### Using PVCs in Pods

Once you have a PVC, you can use it in a pod:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pvc-pod-example
spec:
  containers:
    - name: app
      image: nginx
      volumeMounts:
        - mountPath: '/usr/share/nginx/html'
          name: mypd
  volumes:
    - name: mypd
      persistentVolumeClaim:
        claimName: pvc-example
```

## Storage Classes

StorageClasses enable dynamic provisioning of Persistent Volumes. Instead of pre-provisioning PVs, administrators can define storage classes and let Kubernetes create PVs on demand.

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp2
  fsType: ext4
reclaimPolicy: Delete
allowVolumeExpansion: true
volumeBindingMode: Immediate
```

Key fields in a StorageClass:

- **provisioner**: The volume plugin to use
- **parameters**: Specific to the provisioner
- **reclaimPolicy**: What happens to PVs when PVCs are deleted
- **allowVolumeExpansion**: Whether PVCs can be expanded
- **volumeBindingMode**:
  - `Immediate`: Binding occurs immediately (default)
  - `WaitForFirstConsumer`: Binding delayed until pod using PVC is created

### Using Storage Classes

To use a StorageClass, reference it in your PVC:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: fast-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: fast
```

If you don't specify a StorageClass, the default StorageClass is used (if available).

## Dynamic Provisioning

With StorageClasses, you can dynamically provision Persistent Volumes. This means:

1. You create a StorageClass defining the type of storage
2. A user creates a PVC requesting storage from that class
3. Kubernetes automatically provisions a matching PV

This workflow is much more convenient than manually creating PVs, especially in cloud environments.

## Common Storage Solutions

Let's explore some common storage solutions used with Kubernetes:

### Local Storage

Local storage refers to disks or directories mounted on specific nodes. While this provides high performance, it lacks portability because pods can only run on nodes with the attached storage.

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-storage
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: local-pv
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Delete
  storageClassName: local-storage
  local:
    path: /mnt/disks/ssd1
  nodeAffinity:
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: kubernetes.io/hostname
              operator: In
              values:
                - worker-node-1
```

### NFS Storage

Network File System (NFS) provides shared storage that can be mounted by multiple nodes.

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: nfs-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: nfs-server.example.com
    path: '/exports'
```

### Cloud Providers

Each cloud provider offers native storage options:

#### AWS EBS

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ebs-sc
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  fsType: ext4
  encrypted: 'true'
```

#### Azure Disk

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: azure-disk
provisioner: kubernetes.io/azure-disk
parameters:
  storageaccounttype: Premium_LRS
  kind: Managed
```

#### Google Persistent Disk

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gce-pd
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-standard
  fstype: ext4
```

#### DigitalOcean Block Storage

DigitalOcean Kubernetes includes a StorageClass that automatically provisions DigitalOcean Block Storage volumes:

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: do-block-storage
  annotations:
    storageclass.kubernetes.io/is-default-class: 'true'
provisioner: dobs.csi.digitalocean.com
parameters:
  fstype: ext4
```

To use this StorageClass, simply create a PVC without specifying a StorageClass name:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: do-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
```

[Sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) to get $200 in free credits and try this Block Storage integration with Kubernetes.

## StatefulSets with Persistent Storage

StatefulSets are ideal for applications that require stable, unique network identifiers, stable persistent storage, and ordered deployment and scaling. When used with PVCs, they provide a complete solution for stateful applications.

```yaml
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
          image: postgres:13
          ports:
            - containerPort: 5432
              name: postgres
          volumeMounts:
            - name: pgdata
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: pgdata
      spec:
        accessModes: ['ReadWriteOnce']
        storageClassName: 'standard'
        resources:
          requests:
            storage: 10Gi
```

The `volumeClaimTemplates` field automatically creates a PVC for each pod in the StatefulSet. When pods are rescheduled, they reattach to the same PVC and thus the same data.

## Volume Snapshots

Kubernetes allows you to create snapshots of volumes for backup or migration purposes.

```yaml
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: data-snapshot
spec:
  volumeSnapshotClassName: csi-hostpath-snapclass
  source:
    persistentVolumeClaimName: pvc-example
```

To restore from a snapshot:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-from-snapshot
spec:
  dataSource:
    name: data-snapshot
    kind: VolumeSnapshot
    apiGroup: snapshot.storage.k8s.io
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

## Expanding Persistent Volumes

Some storage providers allow you to expand PVCs without interrupting applications:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: expandable-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi # Initial size
  storageClassName: expandable-storage
```

To expand it:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: expandable-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi # Increased size
  storageClassName: expandable-storage
```

The StorageClass must have `allowVolumeExpansion: true` for this to work.

## Volume Topology

In multi-zone clusters, you may want to constrain volumes to specific zones. Volume Topology enables this:

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: topology-aware-storage
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-standard
volumeBindingMode: WaitForFirstConsumer
allowedTopologies:
  - matchLabelExpressions:
      - key: failure-domain.beta.kubernetes.io/zone
        values:
          - us-central1-a
          - us-central1-b
```

## Advanced Storage Patterns

### ReadWriteMany (RWX) Volumes

For applications that need shared access to the same volume from multiple pods, use storage solutions that support ReadWriteMany access mode:

- **NFS**: Network File System
- **CephFS**: Distributed filesystem by Ceph
- **GlusterFS**: Scalable network filesystem
- **Azure File**: SMB file shares
- **AWS EFS**: Elastic File System

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shared-pvc
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 10Gi
  storageClassName: nfs-storage
```

### Ephemeral Volumes

For storage that's tied to a pod's lifecycle but more flexible than `emptyDir`, use ephemeral volumes:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-ephemeral
spec:
  containers:
    - name: test-container
      image: nginx
      volumeMounts:
        - mountPath: /test
          name: ephemeral-volume
  volumes:
    - name: ephemeral-volume
      ephemeral:
        volumeClaimTemplate:
          metadata:
            labels:
              type: ephemeral
          spec:
            accessModes: ['ReadWriteOnce']
            storageClassName: 'fast-storage'
            resources:
              requests:
                storage: 1Gi
```

### Data Migration

To migrate data between clusters or storage classes:

1. Create a VolumeSnapshot of the original PVC
2. Create a new PVC in the target environment, referencing the snapshot
3. Create a migration pod that copies data

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: data-migration
spec:
  containers:
    - name: migrator
      image: alpine
      command: ['sh', '-c', 'cp -rv /source/* /destination/']
      volumeMounts:
        - name: source-volume
          mountPath: /source
        - name: destination-volume
          mountPath: /destination
  volumes:
    - name: source-volume
      persistentVolumeClaim:
        claimName: source-pvc
    - name: destination-volume
      persistentVolumeClaim:
        claimName: destination-pvc
  restartPolicy: Never
```

## Backup and Restore Strategies

Kubernetes doesn't provide built-in backup solutions, but you can implement several approaches:

### 1. Volume Snapshots

As covered earlier, use the Volume Snapshot API to create point-in-time snapshots of volumes.

### 2. Application-Level Backups

For databases and other stateful applications, use application-specific backup tools:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
spec:
  schedule: '0 1 * * *' # Daily at 1:00 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: postgres:13
              command:
                - /bin/sh
                - -c
                - pg_dump -h postgres -U postgres -d mydb | gzip > /backup/mydb-$(date +%Y%m%d).sql.gz
              env:
                - name: PGPASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: postgres-credentials
                      key: password
              volumeMounts:
                - name: backup-volume
                  mountPath: /backup
          volumes:
            - name: backup-volume
              persistentVolumeClaim:
                claimName: backup-pvc
          restartPolicy: OnFailure
```

### 3. External Backup Solutions

Several tools specifically designed for Kubernetes backup:

- **Velero**: Backup and migrate Kubernetes resources and volumes
- **Kasten K10**: Purpose-built for Kubernetes backup and disaster recovery
- **Trilios**: Data protection for Kubernetes applications

## Performance Considerations

When designing for storage performance in Kubernetes:

1. **Choose the right storage type**: SSD for high IOPS, HDD for high throughput
2. **Consider local storage** for latency-sensitive applications
3. **Use volume caching** for frequently accessed data
4. **Set appropriate resource requests and limits** for storage-related pods
5. **Use appropriate QoS** for storage traffic
6. **Monitor storage metrics** to identify bottlenecks

## Best Practices for Kubernetes Storage

1. **Plan for data persistence**: Decide which data needs to survive pod restarts

2. **Use the right storage for the job**: Match storage characteristics to application requirements

3. **Define resource requests accurately**: Request what you need to avoid overprovisioning

4. **Implement proactive monitoring**: Watch for storage capacity and performance issues

5. **Plan for backup and recovery**: Implement and test backup procedures

6. **Consider a multi-zone approach**: Distribute storage across availability zones

7. **Use labels and annotations**: Organize and describe your storage resources

8. **Test failure scenarios**: Verify that your applications can recover from storage failures

9. **Document storage architecture**: Maintain clear documentation of your storage setup

10. **Implement proper security**: Use encryption for sensitive data

## DigitalOcean Volumes for Kubernetes

DigitalOcean makes it easy to provision and manage persistent storage for your Kubernetes clusters. DigitalOcean Volumes provide:

- SSD-based block storage
- Automatic encryption at rest
- Automated volume snapshots
- Seamless Kubernetes integration through CSI driver

[Sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) to get $200 in free credits and try their storage solutions with your Kubernetes applications.

In the next section, we'll explore Kubernetes resource management, covering how to optimize your cluster's compute resources and implement effective scaling strategies.
