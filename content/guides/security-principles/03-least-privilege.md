---
title: 'Principle of Least Privilege'
description: 'Learn how to implement minimal access controls to reduce your attack surface and limit potential damage.'
order: 3
---

The Principle of Least Privilege (PoLP) states that every user, process, or system should have only the minimum permissions necessary to perform their function. This simple concept is one of the most powerful security controls you can implement.

## Why Least Privilege Matters

When permissions are overly broad:

- **Larger attack surface**: More paths for attackers to exploit
- **Greater blast radius**: Compromised accounts can do more damage
- **Harder to audit**: Too many permissions to track effectively
- **Compliance issues**: Violates regulatory requirements

## Implementing Least Privilege

### IAM Policies: Start with Deny

AWS IAM follows an implicit deny model: users have no permissions until explicitly granted. The key is to resist the temptation to grant broad permissions "just in case."

**Good practice:** Be specific about actions and resources. This policy allows reading from one specific S3 bucket only:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3ReadSpecificBucket",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",    // Read individual objects
        "s3:ListBucket"    // List bucket contents
        // Note: No write, delete, or admin permissions
      ],
      "Resource": [
        "arn:aws:s3:::my-app-assets",     // Bucket itself (for ListBucket)
        "arn:aws:s3:::my-app-assets/*"    // Objects in bucket (for GetObject)
      ]
    }
  ]
}
```

**Bad practice** - this grants full S3 admin access to every bucket in the account:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:*",     // Every S3 action including DeleteBucket!
      "Resource": "*"       // Every bucket in the account
      // An attacker with this access could delete all your data
    }
  ]
}
```

**Real impact:** In 2019, Capital One's breach exposed 100+ million records partly due to overly permissive IAM roles on EC2 instances.

### Kubernetes RBAC

Kubernetes Role-Based Access Control (RBAC) lets you define precisely what actions each service account can perform. The principle is the same: start with nothing, add only what's needed.

**Key concepts:**
- **Role**: Defines permissions (what actions on what resources)
- **RoleBinding**: Grants a Role to a user/service account
- **ClusterRole/ClusterRoleBinding**: Same, but cluster-wide instead of namespace-scoped

```yaml
# Role with minimal permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: production  # Role only applies in this namespace
rules:
- apiGroups: [""]         # Core API group
  resources: ["pods"]     # Only pods, not secrets, configmaps, etc.
  verbs: ["get", "list", "watch"]  # Read-only, no create/delete
- apiGroups: [""]         
  resources: ["pods/log"] # Allow reading pod logs
  verbs: ["get"]          # But not streaming (no watch)

---
# Bind role to specific service account
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: production
subjects:
- kind: ServiceAccount
  name: monitoring-sa
  namespace: production
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

### Database Permissions

Database credentials are a prime target for attackers. If your application uses a database account with full admin rights, a SQL injection vulnerability becomes catastrophic. Instead, create purpose-specific users with minimal permissions.

**The principle:** Your application probably only needs SELECT, INSERT, and UPDATE on specific tables. It almost never needs DROP, ALTER, or access to admin tables.

```sql
-- Create a read-only user for reporting
-- This user can only read data, never modify it
CREATE USER reporting_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE myapp TO reporting_user;  -- Can connect
GRANT USAGE ON SCHEMA public TO reporting_user;      -- Can see schema
GRANT SELECT ON ALL TABLES IN SCHEMA public TO reporting_user;  -- Read-only

-- Create an app user with limited write access
-- Only the specific tables and operations the app needs
CREATE USER app_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE myapp TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE ON users, orders, products TO app_user;
-- Note: No DELETE permission (use soft deletes in app logic)
-- Note: No access to audit_logs, admin_settings tables
-- Note: No TRUNCATE, DROP, or ALTER permissions
```

**Separate users for different functions:** Reporting dashboards, background jobs, and the main application should each have their own database user with appropriate permissions.

### Linux File Permissions

Linux file permissions are your first defense against privilege escalation. An attacker who compromises your application should not be able to read sensitive configuration files or modify executables.

**Permission numbers explained:**
- First digit: Owner permissions
- Second digit: Group permissions
- Third digit: Others permissions
- Values: 4=read, 2=write, 1=execute (add together)

```bash
# Application files - read/execute only
# 555 = r-xr-xr-x (everyone can read/execute, nobody can modify)
chmod 555 /opt/myapp/bin/*

# Configuration files - read only by app user
# 400 = r-------- (only owner can read, nobody else)
chmod 400 /opt/myapp/config/secrets.yml
chown appuser:appgroup /opt/myapp/config/secrets.yml

# Log directory - write only where needed
# 755 = rwxr-xr-x (owner full access, others can read/traverse)
chmod 755 /var/log/myapp
# 644 = rw-r--r-- (owner can write, others can only read)
chmod 644 /var/log/myapp/*.log
```

**Common mistakes:** Setting 777 on directories for "convenience", leaving secrets world-readable, or running applications as root.

### Container Security Context

Containers inherit many default privileges that most applications don't need. A security context explicitly restricts what the container can do, limiting the damage if it's compromised.

**Key settings explained:**

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:          # Pod-level settings apply to all containers
    runAsNonRoot: true      # Kubernetes will reject containers trying to run as root
    runAsUser: 1000         # Run as specific non-root UID
    runAsGroup: 1000        # Run as specific GID
    fsGroup: 1000           # Group for volume ownership
  containers:
  - name: app
    image: myapp:latest
    securityContext:                   # Container-specific settings
      allowPrivilegeEscalation: false  # Prevent sudo, setuid, etc.
      readOnlyRootFilesystem: true     # Can't write to container filesystem
      capabilities:
        drop:                          # Remove Linux capabilities
          - ALL                        # Drop everything, then add back only what's needed
    volumeMounts:
    - name: tmp               # Writable volume for temp files
      mountPath: /tmp
    - name: cache             # Writable volume for cache
      mountPath: /app/cache
  volumes:
  - name: tmp
    emptyDir: {}
  - name: cache
    emptyDir: {}
```

## Just-In-Time (JIT) Access

Instead of permanent permissions, grant temporary access when needed:

```bash
# Example: Temporary AWS credentials
aws sts assume-role \
  --role-arn arn:aws:iam::123456789012:role/AdminRole \
  --role-session-name "emergency-access" \
  --duration-seconds 3600

# Access expires after 1 hour
```

### Implementing JIT with Teleport

```yaml
# Teleport role with access requests
kind: role
version: v5
metadata:
  name: developer
spec:
  allow:
    logins: ["{{internal.logins}}"]
    node_labels:
      env: ["dev", "staging"]
    request:
      roles: ["production-access"]
      thresholds:
        - approve: 1
          deny: 1
```

## Service Accounts and Workload Identity

Each application should have its own identity:

```yaml
# Kubernetes: Dedicated service account per app
apiVersion: v1
kind: ServiceAccount
metadata:
  name: payment-service
  namespace: production
  annotations:
    # AWS IAM role for service account
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/PaymentServiceRole

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-service
spec:
  template:
    spec:
      serviceAccountName: payment-service
      automountServiceAccountToken: true
      containers:
      - name: payment
        image: payment-service:latest
```

## Auditing Permissions

Regularly review and revoke unnecessary permissions:

```bash
# AWS: Find unused IAM credentials
aws iam generate-credential-report
aws iam get-credential-report --output text --query Content | base64 -d

# AWS: Analyze IAM policies
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:user/developer \
  --action-names s3:DeleteBucket
```

### Kubernetes RBAC Audit

```bash
# List all cluster role bindings
kubectl get clusterrolebindings -o wide

# Find overly permissive bindings
kubectl get clusterrolebindings -o json | jq '
  .items[] | 
  select(.roleRef.name == "cluster-admin") | 
  {name: .metadata.name, subjects: .subjects}
'

# Check what a service account can do
kubectl auth can-i --list --as=system:serviceaccount:default:my-sa
```

## Common Least Privilege Mistakes

### Mistake 1: Shared Service Accounts

```yaml
# Bad: Multiple apps sharing one service account
serviceAccountName: shared-sa

# Good: Dedicated service account per app
serviceAccountName: order-service-sa
```

### Mistake 2: Wildcard Permissions

```json
// Bad: Wildcard actions
"Action": "ec2:*"

// Good: Specific actions
"Action": [
  "ec2:DescribeInstances",
  "ec2:StartInstances",
  "ec2:StopInstances"
]
```

### Mistake 3: Not Scoping Resources

```json
// Bad: All resources
"Resource": "*"

// Good: Specific resources
"Resource": [
  "arn:aws:s3:::my-bucket",
  "arn:aws:s3:::my-bucket/*"
]
```

### Mistake 4: Permanent Admin Access

```bash
# Bad: Developer has permanent admin
aws iam attach-user-policy \
  --user-name developer \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# Good: Require role assumption with MFA
aws sts assume-role \
  --role-arn arn:aws:iam::123456789012:role/AdminRole \
  --serial-number arn:aws:iam::123456789012:mfa/developer \
  --token-code 123456
```

## Key Takeaways

- Start with zero permissions and add only what's needed
- Create dedicated identities for each application/service
- Use temporary credentials instead of permanent access
- Regularly audit and revoke unused permissions
- Scope permissions to specific resources, not wildcards
- Implement separation of duties for sensitive operations

## Practice Exercise

Review permissions in your environment:

1. List all IAM users/roles with admin-level access
2. Identify service accounts shared between applications
3. Find policies using wildcard (*) permissions
4. Create a plan to reduce permissions without breaking functionality
