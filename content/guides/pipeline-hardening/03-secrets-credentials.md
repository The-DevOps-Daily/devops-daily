---
title: "Secrets and Credentials Management"
description: "Secure secrets management in CI/CD pipelines including vault integration, rotation, and best practices"
---

# Secrets and Credentials Management

Secrets in CI/CD pipelines are prime targets for attackers. A single exposed API key or database password can compromise your entire infrastructure.

## The Secrets Problem

Common secrets in pipelines:
- API keys and tokens
- Database credentials
- Cloud provider access keys
- Container registry passwords
- Signing keys
- SSH keys
- Webhook secrets

## Never Hardcode Secrets

**Bad - Hardcoded secrets:**

```yaml
# NEVER do this!
env:
  DATABASE_URL: "postgres://user:password123@db.example.com/prod"
  AWS_SECRET_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```

**Good - Using secret references:**

```yaml
# GitHub Actions
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_KEY }}
```

## Platform-Specific Secrets Management

### GitHub Actions Secrets

```yaml
name: Deploy with Secrets

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # Requires approval
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          echo "Deploying to production..."
          # Secrets are masked in logs
```

**Secret scopes:**
- Organization secrets - Shared across repos
- Repository secrets - Specific to one repo
- Environment secrets - Protected by approval rules

### GitLab CI/CD Variables

```yaml
# .gitlab-ci.yml
deploy_production:
  stage: deploy
  environment:
    name: production
  script:
    - echo "$KUBE_CONFIG" | base64 -d > kubeconfig
    - kubectl --kubeconfig=kubeconfig apply -f k8s/
  variables:
    # Protected variables only available on protected branches
    DEPLOY_TOKEN: $CI_DEPLOY_TOKEN
```

**Variable protection levels:**
- Protected - Only on protected branches/tags
- Masked - Hidden in job logs
- File - Written to temporary file path

### Jenkins Credentials

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        AWS_CREDENTIALS = credentials('aws-prod-credentials')
        DATABASE_CREDS = credentials('postgres-prod')
    }
    
    stages {
        stage('Deploy') {
            steps {
                withCredentials([
                    string(credentialsId: 'api-key', variable: 'API_KEY'),
                    usernamePassword(
                        credentialsId: 'docker-registry',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )
                ]) {
                    sh '''
                        docker login -u $DOCKER_USER -p $DOCKER_PASS
                        ./deploy.sh
                    '''
                }
            }
        }
    }
}
```

## HashiCorp Vault Integration

Vault provides centralized secrets management with:
- Dynamic secret generation
- Automatic rotation
- Audit logging
- Fine-grained access control

### GitHub Actions with Vault

```yaml
name: Deploy with Vault

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write  # Required for OIDC
      contents: read
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Import Secrets from Vault
        uses: hashicorp/vault-action@v2
        with:
          url: https://vault.example.com
          method: jwt
          role: github-actions
          secrets: |
            secret/data/prod/database url | DATABASE_URL ;
            secret/data/prod/api key | API_KEY
      
      - name: Deploy
        run: ./deploy.sh
        env:
          DATABASE_URL: ${{ env.DATABASE_URL }}
```

### Vault Policy Example

```hcl
# vault-policy.hcl
path "secret/data/prod/*" {
  capabilities = ["read"]
}

path "secret/data/staging/*" {
  capabilities = ["read", "list"]
}

# Deny access to admin secrets
path "secret/data/admin/*" {
  capabilities = ["deny"]
}
```

## Secrets Rotation

Regular rotation limits exposure window if secrets are compromised.

### Automated Rotation with Vault

```hcl
# Database secrets engine - auto-generates credentials
resource "vault_database_secret_backend_role" "app" {
  backend     = vault_mount.db.path
  name        = "app-role"
  db_name     = vault_database_secret_backend_connection.postgres.name
  
  # Credentials valid for 1 hour, renewable up to 24 hours
  default_ttl = 3600
  max_ttl     = 86400
  
  creation_statements = [
    "CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';",
    "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";"
  ]
  
  revocation_statements = [
    "DROP ROLE IF EXISTS \"{{name}}\";"
  ]
}
```

### GitHub Actions Secret Rotation

```python
# rotate_secrets.py
import requests
from nacl import public, encoding
import base64
import secrets

def encrypt_secret(public_key: str, secret_value: str) -> str:
    """Encrypt secret using repository's public key."""
    public_key_bytes = base64.b64decode(public_key)
    sealed_box = public.SealedBox(public.PublicKey(public_key_bytes))
    encrypted = sealed_box.encrypt(secret_value.encode())
    return base64.b64encode(encrypted).decode()

def rotate_api_key(repo: str, token: str):
    """Rotate an API key and update GitHub secret."""
    headers = {"Authorization": f"token {token}"}
    
    # Get repository public key
    key_response = requests.get(
        f"https://api.github.com/repos/{repo}/actions/secrets/public-key",
        headers=headers
    )
    key_data = key_response.json()
    
    # Generate new API key
    new_key = secrets.token_urlsafe(32)
    
    # Encrypt and update
    encrypted = encrypt_secret(key_data["key"], new_key)
    
    requests.put(
        f"https://api.github.com/repos/{repo}/actions/secrets/API_KEY",
        headers=headers,
        json={
            "encrypted_value": encrypted,
            "key_id": key_data["key_id"]
        }
    )
    
    return new_key
```

## Preventing Secrets Leakage

### Log Masking

Most CI platforms automatically mask secrets in logs, but be careful:

```yaml
# GitHub Actions - Manual masking
- name: Process data
  run: |
    # Add custom value to mask list
    echo "::add-mask::$COMPUTED_SECRET"
    echo "Processing with secret: $COMPUTED_SECRET"
```

### Preventing Exfiltration

```yaml
# Block outbound network from untrusted code
- name: Run untrusted tests
  run: |
    # Use network namespace to block egress
    unshare --net ./run-tests.sh
```

### Environment Isolation

```yaml
# Use separate environments with approval gates
jobs:
  deploy-staging:
    environment: staging
    # Staging secrets only
    
  deploy-production:
    needs: deploy-staging
    environment: production  # Requires manual approval
    # Production secrets only
```

## OIDC - Avoiding Long-Lived Credentials

OpenID Connect allows pipelines to authenticate without storing cloud credentials.

### AWS OIDC with GitHub Actions

```yaml
name: Deploy with OIDC

on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/github-actions
          aws-region: us-east-1
          # No static credentials needed!
      
      - name: Deploy to S3
        run: aws s3 sync ./dist s3://my-bucket
```

**AWS IAM Trust Policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:myorg/myrepo:*"
        }
      }
    }
  ]
}
```

## Secrets Security Checklist

- [ ] No secrets in source code or git history
- [ ] All secrets encrypted at rest
- [ ] Secrets masked in pipeline logs
- [ ] Least privilege access to secrets
- [ ] Regular secret rotation (90 days max)
- [ ] OIDC instead of long-lived credentials
- [ ] Environment separation (dev/staging/prod)
- [ ] Approval gates for production secrets
- [ ] Audit logging for secret access
- [ ] Emergency rotation procedures documented

## Key Takeaways

1. **Never hardcode secrets** - Use platform secret stores or Vault
2. **Use OIDC where possible** - Eliminates credential storage
3. **Rotate regularly** - Automated rotation with Vault or scripts
4. **Separate environments** - Different secrets for dev/staging/prod
5. **Audit everything** - Know who accessed what and when
