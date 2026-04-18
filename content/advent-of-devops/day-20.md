---
title: 'Day 20 - Secrets Management'
day: 20
excerpt: 'Securely manage application secrets and credentials using AWS Secrets Manager, Kubernetes Secrets, and best practices.'
description: 'Learn proper secrets management with AWS Secrets Manager, Kubernetes Secrets, and External Secrets Operator for secure credential handling.'
publishedAt: '2026-12-20T00:00:00Z'
updatedAt: '2026-12-20T00:00:00Z'
difficulty: 'Intermediate'
category: 'Security'
tags:
  - Security
  - Secrets Management
  - Kubernetes
  - AWS
---

## Description

Your application has hardcoded passwords and API keys scattered throughout config files and code. This is a security nightmare. Implement proper secrets management to protect sensitive credentials.

## Task

Set up secrets management for applications using Kubernetes and AWS.

**Requirements:**
- Store secrets in AWS Secrets Manager
- Use Kubernetes Secrets for container apps
- Integrate External Secrets Operator
- Rotate secrets automatically
- Remove hardcoded credentials

## Target

- ✅ No hardcoded secrets in code/configs
- ✅ Secrets stored securely
- ✅ Automatic secret rotation configured
- ✅ Applications read secrets at runtime
- ✅ Audit logging enabled

## Sample App

### Application with Hardcoded Secrets (Bad)

```javascript
// BAD: Hardcoded secrets
const config = {
  database: {
    host: 'db.example.com',
    username: 'admin',
    password: 'SuperSecret123!',  // ❌ Hardcoded!
  },
  api: {
    key: 'sk-1234567890abcdef',   // ❌ Hardcoded!
    secret: 'my-api-secret'        // ❌ Hardcoded!
  }
};
```

## Solution

### 1. AWS Secrets Manager

#### Create Secrets with Terraform

```hcl
# secrets.tf
resource "aws_secretsmanager_secret" "database" {
  name        = "prod/database/credentials"
  description = "Database credentials for production"

  rotation_rules {
    automatically_after_days = 30
  }

  tags = {
    Environment = "production"
    ManagedBy   = "Terraform"
  }
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    username = "dbadmin"
    password = random_password.database.result
    host     = aws_db_instance.main.endpoint
    database = "myapp"
  })
}

resource "random_password" "database" {
  length  = 32
  special = true
}

# API Key secret
resource "aws_secretsmanager_secret" "api_key" {
  name        = "prod/api/key"
  description = "External API key"
}

resource "aws_secretsmanager_secret_version" "api_key" {
  secret_id = aws_secretsmanager_secret.api_key.id
  secret_string = jsonencode({
    api_key    = var.api_key
    api_secret = var.api_secret
  })
}

# IAM policy for Lambda/ECS to read secrets
resource "aws_iam_policy" "read_secrets" {
  name        = "read-secrets-policy"
  description = "Allow reading secrets from Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.database.arn,
          aws_secretsmanager_secret.api_key.arn
        ]
      }
    ]
  })
}
```

#### Application Reading from AWS Secrets Manager

```javascript
// app-with-secrets.js
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const client = new SecretsManagerClient({ region: 'us-east-1' });

async function getSecret(secretName) {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      })
    );

    return JSON.parse(response.SecretString);
  } catch (error) {
    console.error('Error retrieving secret:', error);
    throw error;
  }
}

// Load secrets at startup
async function loadConfig() {
  const dbCredentials = await getSecret('prod/database/credentials');
  const apiCredentials = await getSecret('prod/api/key');

  return {
    database: {
      host: dbCredentials.host,
      username: dbCredentials.username,
      password: dbCredentials.password,
      database: dbCredentials.database,
    },
    api: {
      key: apiCredentials.api_key,
      secret: apiCredentials.api_secret,
    }
  };
}

// Use in application
async function main() {
  const config = await loadConfig();

  // Connect to database with loaded credentials
  const db = await connectToDatabase(config.database);

  // Use API credentials
  const apiClient = new APIClient(config.api);
}

main().catch(console.error);
```

### 2. Kubernetes Secrets

#### Creating Secrets

```bash
# Create secret from literal values
kubectl create secret generic database-credentials \
  --from-literal=username=dbadmin \
  --from-literal=password=SuperSecret123 \
  --namespace=production

# Create secret from file
echo -n 'myapikey' > ./api-key.txt
kubectl create secret generic api-credentials \
  --from-file=api-key=./api-key.txt \
  --namespace=production

# Create from YAML (base64 encoded)
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: database-credentials
  namespace: production
type: Opaque
data:
  username: ZGJhZG1pbg==  # base64 encoded
  password: U3VwZXJTZWNyZXQxMjM=
EOF
```

#### Using Secrets in Pods

```yaml
# deployment-with-secrets.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: myapp:latest
        env:
        # Environment variables from secret
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: database-credentials
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: database-credentials
              key: password
        - name: API_KEY
          valueFrom:
            secretKeyRef:
              name: api-credentials
              key: api-key

        # Mount secret as files
        volumeMounts:
        - name: secret-files
          mountPath: /etc/secrets
          readOnly: true

      volumes:
      - name: secret-files
        secret:
          secretName: app-secrets
          items:
          - key: config.json
            path: config.json
          - key: tls.crt
            path: tls.crt
          - key: tls.key
            path: tls.key
```

### 3. External Secrets Operator

#### Install External Secrets Operator

```bash
# Add Helm repository
helm repo add external-secrets https://charts.external-secrets.io

# Install operator
helm install external-secrets \
  external-secrets/external-secrets \
  -n external-secrets-system \
  --create-namespace
```

#### Configure SecretStore

```yaml
# secret-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secretsmanager
  namespace: production
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
```

#### Create ExternalSecret

```yaml
# external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-credentials
  namespace: production
spec:
  refreshInterval: 1h  # Sync every hour
  secretStoreRef:
    name: aws-secretsmanager
    kind: SecretStore

  target:
    name: database-credentials  # K8s secret name
    creationPolicy: Owner

  data:
  - secretKey: username  # K8s secret key
    remoteRef:
      key: prod/database/credentials  # AWS secret name
      property: username  # JSON property

  - secretKey: password
    remoteRef:
      key: prod/database/credentials
      property: password

  - secretKey: host
    remoteRef:
      key: prod/database/credentials
      property: host
```

### 4. HashiCorp Vault Integration

#### Vault Kubernetes Auth

```yaml
# vault-auth.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: vault-auth
  namespace: production
---
apiVersion: v1
kind: Secret
metadata:
  name: vault-token
  namespace: production
  annotations:
    kubernetes.io/service-account.name: vault-auth
type: kubernetes.io/service-account-token
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: vault-auth-delegator
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: system:auth-delegator
subjects:
- kind: ServiceAccount
  name: vault-auth
  namespace: production
```

#### Pod with Vault Agent Injector

```yaml
# pod-with-vault.yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
  namespace: production
  annotations:
    vault.hashicorp.com/agent-inject: "true"
    vault.hashicorp.com/role: "myapp"
    vault.hashicorp.com/agent-inject-secret-database: "secret/data/database"
    vault.hashicorp.com/agent-inject-template-database: |
      {{- with secret "secret/data/database" -}}
      export DB_USERNAME="{{ .Data.data.username }}"
      export DB_PASSWORD="{{ .Data.data.password }}"
      {{- end -}}
spec:
  serviceAccountName: myapp
  containers:
  - name: app
    image: myapp:latest
    command: ["/bin/sh"]
    args: ["-c", "source /vault/secrets/database && /app/start.sh"]
```

### 5. Secret Rotation

#### AWS Lambda for Secret Rotation

```python
# rotation_lambda.py
import boto3
import json
import os

def lambda_handler(event, context):
    secretsmanager = boto3.client('secretsmanager')
    rds = boto3.client('rds')

    secret_arn = event['SecretId']
    token = event['ClientRequestToken']
    step = event['Step']

    if step == "createSecret":
        # Generate new password
        new_password = generate_random_password()

        # Store new version
        secretsmanager.put_secret_value(
            SecretId=secret_arn,
            ClientRequestToken=token,
            SecretString=json.dumps({
                'username': 'dbadmin',
                'password': new_password
            }),
            VersionStages=['AWSPENDING']
        )

    elif step == "setSecret":
        # Update database password
        pending_secret = secretsmanager.get_secret_value(
            SecretId=secret_arn,
            VersionStage='AWSPENDING'
        )

        new_creds = json.loads(pending_secret['SecretString'])

        # Execute password change in database
        execute_password_change(new_creds)

    elif step == "testSecret":
        # Test new credentials
        pending_secret = secretsmanager.get_secret_value(
            SecretId=secret_arn,
            VersionStage='AWSPENDING'
        )

        test_connection(json.loads(pending_secret['SecretString']))

    elif step == "finishSecret":
        # Promote AWSPENDING to AWSCURRENT
        secretsmanager.update_secret_version_stage(
            SecretId=secret_arn,
            VersionStage='AWSCURRENT',
            MoveToVersionId=token,
            RemoveFromVersionId=secretsmanager.describe_secret(
                SecretId=secret_arn
            )['VersionIdsToStages'].get('AWSCURRENT', [None])[0]
        )

    return {
        'statusCode': 200,
        'body': json.dumps('Rotation step completed')
    }
```

### 6. Best Practices Implementation

#### .gitignore

```
# Never commit secrets
.env
.env.*
*secret*
*credentials*
*.key
*.pem
config/secrets.yaml
```

#### Environment Variables (12-Factor App)

```javascript
// config.js - Good practice
const config = {
  database: {
    host: process.env.DB_HOST,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  api: {
    key: process.env.API_KEY,
    secret: process.env.API_SECRET,
  },
  app: {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development',
  }
};

// Validate required secrets
const requiredEnvVars = [
  'DB_HOST', 'DB_USERNAME', 'DB_PASSWORD',
  'API_KEY', 'API_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

module.exports = config;
```

## Explanation

### Secrets Management Hierarchy

```
Production Secrets
├─ AWS Secrets Manager (Source of Truth)
│  ├─ Encrypted at rest (KMS)
│  ├─ Automatic rotation
│  └─ Audit logging
│
├─ External Secrets Operator (Sync to K8s)
│  ├─ Watches AWS Secrets Manager
│  ├─ Creates Kubernetes Secrets
│  └─ Auto-updates on change
│
└─ Application (Consumes)
   ├─ Environment variables
   ├─ Mounted files
   └─ Runtime API calls
```

### Secret Rotation Flow

```
1. Create new secret version
2. Update application to use new version
3. Test new credentials
4. Promote new version to current
5. Deprecate old version
6. Delete old version (after grace period)
```

## Result

### Deploy Secrets Infrastructure

```bash
# Deploy AWS Secrets Manager
cd terraform
terraform apply

# Install External Secrets Operator
helm install external-secrets \
  external-secrets/external-secrets \
  -n external-secrets-system \
  --create-namespace

# Create SecretStore
kubectl apply -f secret-store.yaml

# Create ExternalSecret
kubectl apply -f external-secret.yaml

# Verify secret synced
kubectl get secret database-credentials -n production -o yaml
```

### Verify Secrets

```bash
# Check AWS secret
aws secretsmanager get-secret-value \
  --secret-id prod/database/credentials \
  --query SecretString \
  --output text | jq .

# Check Kubernetes secret
kubectl get secret database-credentials -n production -o jsonpath='{.data.username}' | base64 -d
echo

# Verify ExternalSecret status
kubectl describe externalsecret database-credentials -n production
```

## Validation

### Security Checklist

```bash
# 1. No secrets in code
git grep -i "password\|secret\|api.key" -- '*.js' '*.py' '*.go' | grep -v "process.env"
# Should be empty

# 2. Secrets stored securely
aws secretsmanager list-secrets
# Should list secrets

# 3. K8s secrets exist
kubectl get secrets -A
# Should show synced secrets

# 4. External Secrets syncing
kubectl get externalsecrets -A
# Should show "SecretSynced"

# 5. Audit logging enabled
aws secretsmanager describe-secret --secret-id prod/database/credentials
# Should show LastAccessedDate

# 6. Rotation configured
aws secretsmanager describe-secret --secret-id prod/database/credentials | jq '.RotationRules'
# Should show rotation schedule
```

## Best Practices

### ✅ Do's

1. **Use managed services**: AWS Secrets Manager, HashiCorp Vault
2. **Rotate regularly**: Automate rotation
3. **Least privilege**: Grant minimal access
4. **Audit access**: Log who accesses what
5. **Encrypt in transit**: TLS for secret retrieval
6. **Version secrets**: Keep history

### ❌ Don'ts

1. **Don't commit secrets**: Ever
2. **Don't log secrets**: Mask in logs
3. **Don't share secrets**: One secret per service
4. **Don't hardcode**: Use environment variables
5. **Don't email secrets**: Use secure channels

## Links

- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [External Secrets Operator](https://external-secrets.io/)
- [HashiCorp Vault](https://www.vaultproject.io/)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

## Share Your Success

Secured your secrets? Share how!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Number of secrets migrated
- Tools you used
- Security improvements
- What you learned

Use hashtags: **#AdventOfDevOps #Security #SecretsManagement #Day20**
