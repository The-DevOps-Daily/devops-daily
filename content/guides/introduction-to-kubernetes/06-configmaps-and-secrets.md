---
title: ConfigMaps and Secrets
description: Learn how to manage application configuration and sensitive data in Kubernetes
order: 6
---

Applications typically require configuration settings and sensitive information like credentials to function properly. Kubernetes provides two resources specifically designed for this purpose: ConfigMaps for general configuration data and Secrets for sensitive information. In this section, we'll explore how to create, manage, and use these resources effectively.

## Understanding ConfigMaps and Secrets

Before diving into the details, let's clarify the purpose of each resource:

- **ConfigMaps** store non-confidential data in key-value pairs. They're ideal for environment-specific settings, configuration files, command-line arguments, etc.

- **Secrets** store sensitive information like passwords, OAuth tokens, and SSH keys. They're similar to ConfigMaps but are specifically intended for confidential data.

Both resources separate configuration from application code, following the Twelve-Factor App methodology's principle of storing configuration in the environment.

## Working with ConfigMaps

Let's explore how to create and use ConfigMaps to provide configuration to your applications.

### Creating ConfigMaps

There are multiple ways to create ConfigMaps:

#### From Literal Values

```bash
kubectl create configmap app-config \
  --from-literal=APP_ENV=production \
  --from-literal=APP_DEBUG=false \
  --from-literal=APP_PORT=8080
```

#### From Files

```bash
# Create a properties file
echo "app.env=production" > app.properties
echo "app.debug=false" >> app.properties
echo "app.port=8080" >> app.properties

# Create ConfigMap from the file
kubectl create configmap app-config --from-file=app.properties
```

#### From a Directory

```bash
# Create a directory with configuration files
mkdir config
echo "This is a config file" > config/config.txt
echo "DB_HOST=localhost" > config/database.env

# Create ConfigMap from the directory
kubectl create configmap app-config --from-file=config/
```

#### Using YAML

For more control, you can define a ConfigMap in YAML:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  APP_ENV: production
  APP_DEBUG: 'false'
  APP_PORT: '8080'
  config.json: |
    {
      "database": {
        "host": "db.example.com",
        "port": 5432
      },
      "cache": {
        "enabled": true,
        "ttl": 300
      }
    }
  nginx.conf: |
    server {
      listen 80;
      server_name example.com;
      
      location / {
        proxy_pass http://backend;
      }
    }
```

Apply this configuration with:

```bash
kubectl apply -f app-config.yaml
```

### Viewing ConfigMaps

List all ConfigMaps in the current namespace:

```bash
kubectl get configmaps
```

View the details of a specific ConfigMap:

```bash
kubectl describe configmap app-config
```

To see the actual values:

```bash
kubectl get configmap app-config -o yaml
```

### Using ConfigMaps in Pods

ConfigMaps can be used in pods in several ways:

#### As Environment Variables

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: config-env-pod
spec:
  containers:
    - name: app
      image: busybox
      command: ['sh', '-c', 'echo $APP_ENV $APP_PORT && sleep 3600']
      env:
        - name: APP_ENV
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: APP_ENV
        - name: APP_PORT
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: APP_PORT
```

You can also load all keys from a ConfigMap as environment variables:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: config-env-all-pod
spec:
  containers:
    - name: app
      image: busybox
      command: ['sh', '-c', 'env | grep APP && sleep 3600']
      envFrom:
        - configMapRef:
            name: app-config
```

#### As Files in a Volume

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: config-vol-pod
spec:
  containers:
    - name: app
      image: busybox
      command: ['sh', '-c', 'cat /config/config.json && sleep 3600']
      volumeMounts:
        - name: config-volume
          mountPath: /config
  volumes:
    - name: config-volume
      configMap:
        name: app-config
```

You can also mount specific keys:

```yaml
volumes:
  - name: config-volume
    configMap:
      name: app-config
      items:
        - key: config.json
          path: app/config.json
        - key: nginx.conf
          path: nginx/nginx.conf
```

#### As Command-line Arguments

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: config-arg-pod
spec:
  containers:
    - name: app
      image: busybox
      command: ['echo']
      args: ['$(APP_PORT)']
      env:
        - name: APP_PORT
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: APP_PORT
```

## Working with Secrets

Secrets are similar to ConfigMaps but are designed for confidential data. Kubernetes provides some additional protection for Secrets:

- Secrets are stored in a temporary filesystem (tmpfs) in memory, not written to disk
- Etcd encrypts Secrets (if encryption is enabled)
- Access to Secrets can be restricted with RBAC

However, it's important to note that Secrets are encoded in base64, not encrypted by default. For true encryption at rest, you need to [configure encryption](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/).

### Creating Secrets

Like ConfigMaps, there are multiple ways to create Secrets:

#### From Literal Values

```bash
kubectl create secret generic db-credentials \
  --from-literal=username=admin \
  --from-literal=password=s3cr3t
```

#### From Files

```bash
# Create files with sensitive data
echo -n "admin" > username.txt
echo -n "s3cr3t" > password.txt

# Create Secret from files
kubectl create secret generic db-credentials \
  --from-file=username=username.txt \
  --from-file=password=password.txt
```

#### Using YAML

If you define Secrets in YAML, you need to encode values in base64:

```bash
echo -n "admin" | base64
# Output: YWRtaW4=

echo -n "s3cr3t" | base64
# Output: czNjcjN0
```

Then create the Secret definition:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
data:
  username: YWRtaW4=
  password: czNjcjN0
```

You can also use the `stringData` field, which accepts unencoded strings:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
stringData:
  username: admin
  password: s3cr3t
```

### Secret Types

Kubernetes provides built-in types for common Secret use cases:

- **Opaque** (default): Arbitrary user-defined data
- **kubernetes.io/tls**: TLS certificate and private key
- **kubernetes.io/dockerconfigjson**: Docker registry credentials
- **kubernetes.io/service-account-token**: Service account token
- **kubernetes.io/basic-auth**: Basic authentication credentials
- **kubernetes.io/ssh-auth**: SSH credentials

For example, to create a TLS Secret:

```bash
kubectl create secret tls tls-secret --cert=path/to/tls.cert --key=path/to/tls.key
```

For Docker registry credentials:

```bash
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=username \
  --docker-password=password \
  --docker-email=email@example.com
```

### Viewing Secrets

List all Secrets in the current namespace:

```bash
kubectl get secrets
```

View the details of a specific Secret:

```bash
kubectl describe secret db-credentials
```

To see the actual values (they'll be base64 encoded):

```bash
kubectl get secret db-credentials -o yaml
```

To decode a specific value:

```bash
kubectl get secret db-credentials -o jsonpath='{.data.password}' | base64 --decode
```

### Using Secrets in Pods

Secrets can be used in pods similarly to ConfigMaps:

#### As Environment Variables

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret-env-pod
spec:
  containers:
    - name: app
      image: postgres:13
      env:
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
```

You can also load all keys from a Secret:

```yaml
envFrom:
  - secretRef:
      name: db-credentials
```

#### As Files in a Volume

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret-vol-pod
spec:
  containers:
    - name: app
      image: busybox
      command: ['sh', '-c', 'cat /etc/credentials/username && sleep 3600']
      volumeMounts:
        - name: secret-volume
          mountPath: /etc/credentials
  volumes:
    - name: secret-volume
      secret:
        secretName: db-credentials
```

#### Using Docker Registry Secrets

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: private-image-pod
spec:
  containers:
    - name: app
      image: registry.example.com/private/app:1.0
  imagePullSecrets:
    - name: regcred
```

## Updating ConfigMaps and Secrets

When you update a ConfigMap or Secret, the changes are not automatically reflected in pods that already use them.

### Environment Variables

Environment variables set from ConfigMaps or Secrets are only evaluated once at pod creation time. To pick up changes, you need to restart the pods.

### Volume Mounts

For volume mounts, Kubernetes updates the mounted files within a few minutes. However, applications need to watch for changes or be restarted to detect them.

### Updating Strategies

To update your applications when configurations change:

1. **Use deployments with rolling updates**:

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
```

2. **Trigger updates by changing pod specifications**:

```bash
# Create a new version of the ConfigMap
kubectl create configmap app-config-v2 --from-literal=APP_VERSION=2.0

# Update the deployment to use the new ConfigMap
kubectl set env deployment/app-deployment --from=configmap/app-config-v2
```

3. **Use immutable ConfigMaps and version them**:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-v2
immutable: true
data:
  APP_VERSION: '2.0'
```

## Managing Secrets Securely

While Kubernetes Secrets provide basic functionality for handling sensitive data, production environments often require additional security measures:

### 1. Enable Encryption at Rest

Configure encryption for etcd storage:

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
    providers:
      - aescbc:
          keys:
            - name: key1
              secret: <base64-encoded-key>
      - identity: {}
```

### 2. Use External Secret Management Systems

Integration with external secret management tools provides enhanced security. Options include:

- **HashiCorp Vault**: Use the Vault Operator or CSI driver
- **AWS Secrets Manager**: Use External Secrets Operator or ASCP
- **Azure Key Vault**: Use AKV Provider for Secrets Store CSI Driver
- **Google Secret Manager**: Use Secret Manager Operator

Example with External Secrets Operator:

```yaml
apiVersion: external-secrets.io/v1alpha1
kind: ExternalSecret
metadata:
  name: database-credentials
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: db-credentials
  data:
    - secretKey: username
      remoteRef:
        key: database/credentials
        property: username
    - secretKey: password
      remoteRef:
        key: database/credentials
        property: password
```

### 3. Implement RBAC Controls

Restrict access to Secrets with Role-Based Access Control:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: secret-reader
  namespace: default
rules:
  - apiGroups: ['']
    resources: ['secrets']
    verbs: ['get', 'list']
    resourceNames: ['db-credentials']
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-secrets
  namespace: default
subjects:
  - kind: User
    name: jane
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: secret-reader
  apiGroup: rbac.authorization.k8s.io
```

### 4. Use Sealed Secrets

Sealed Secrets (by Bitnami) allows you to encrypt your secrets so they can be safely stored in git:

```bash
# Install kubeseal
brew install kubeseal  # For macOS

# Encrypt a secret
kubectl create secret generic db-credentials \
  --from-literal=username=admin \
  --from-literal=password=s3cr3t \
  --dry-run=client -o yaml | \
  kubeseal --format yaml > sealed-secret.yaml

# Apply the sealed secret
kubectl apply -f sealed-secret.yaml
```

## Common Patterns and Use Cases

### Configuration Files for Applications

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  application.yml: |
    server:
      port: 8080
    spring:
      datasource:
        url: jdbc:postgresql://db:5432/app
        username: ${DB_USER}
        password: ${DB_PASSWORD}
      jpa:
        hibernate:
          ddl-auto: update
---
apiVersion: v1
kind: Deployment
metadata:
  name: app-deployment
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: app
          image: myapp:1.0
          volumeMounts:
            - name: config-volume
              mountPath: /app/config
          env:
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: username
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: password
      volumes:
        - name: config-volume
          configMap:
            name: app-config
```

### Feature Flags

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: feature-flags
data:
  ENABLE_NEW_UI: 'true'
  ENABLE_BETA_FEATURES: 'false'
  MAINTENANCE_MODE: 'false'
---
apiVersion: v1
kind: Deployment
metadata:
  name: app-deployment
spec:
  template:
    spec:
      containers:
        - name: app
          image: myapp:1.0
          envFrom:
            - configMapRef:
                name: feature-flags
```

### Environment-Specific Configuration

Create a ConfigMap for each environment and select the appropriate one based on a label:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-dev
  labels:
    env: dev
data:
  APP_ENV: development
  API_URL: http://api-dev
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-prod
  labels:
    env: prod
data:
  APP_ENV: production
  API_URL: http://api
---
apiVersion: v1
kind: Deployment
metadata:
  name: app-deployment
spec:
  template:
    spec:
      containers:
        - name: app
          image: myapp:1.0
          envFrom:
            - configMapRef:
                name: app-config-prod # Change based on environment
```

## Best Practices for ConfigMaps and Secrets

1. **Separate configs by concern**: Create different ConfigMaps and Secrets for different aspects of your application.

2. **Version your configurations**: Use naming conventions that include versions or timestamps.

3. **Keep Secrets minimal**: Store only what needs to be kept secret in Secrets; use ConfigMaps for everything else.

4. **Consider the immutable flag**: For configs that shouldn't change without redeployment.

5. **Use projectioned volumes**: When you need to combine multiple ConfigMaps or Secrets:

```yaml
volumes:
  - name: all-config
    projected:
      sources:
        - configMap:
            name: app-config
        - secret:
            name: app-secrets
        - configMap:
            name: shared-config
```

6. **Set up default values**: Make your application resilient to missing configuration.

7. **Validate configurations**: Implement validation to catch misconfigurations early.

8. **Document your configuration options**: Create documentation for all available settings.

9. **Audit Secret access**: Monitor and log access to sensitive configuration.

10. **Consider GitOps workflows**: Use tools like Flux or ArgoCD with encrypted Secrets.

## Using DigitalOcean for Secure Configuration Management

When running Kubernetes in a production environment, properly managing configurations and secrets becomes even more important. DigitalOcean Kubernetes provides a reliable platform with features that help with secure configuration management:

- Integration with container registry for private images
- Support for external secret management systems
- Encrypted etcd for secure storage

[Sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) to get $200 in free credits and leverage these features for your applications.

In the next section, we'll explore persistent storage in Kubernetes, which allows your applications to store data beyond the container lifecycle.
