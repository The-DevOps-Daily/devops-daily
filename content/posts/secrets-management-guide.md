---
title: 'Secrets Management Guide: Vault, AWS Secrets Manager, and Azure Key Vault'
excerpt: 'Stop storing secrets in .env files and environment variables. This guide covers secrets management fundamentals, HashiCorp Vault dynamic secrets, AWS Secrets Manager rotation, and Azure Key Vault with practical code examples.'
category:
  name: 'Security'
  slug: 'security'
date: '2025-01-24'
publishedAt: '2025-01-24T09:00:00Z'
updatedAt: '2025-01-24T09:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
coverImage: '/images/posts/secrets-management-guide.png'
ogImage: '/images/posts/secrets-management-guide.svg'
tags:
  - Security
  - Secrets Management
  - HashiCorp Vault
  - AWS
---

Secrets are the keys to your kingdom: API tokens, database credentials, encryption keys, certificates. A single leaked secret can compromise your entire infrastructure. And yet, many organizations still store secrets in environment variables, config files, or hardcoded in source code.

If you have ever grepped a codebase for `password=` and found something real, you already know why dedicated secrets management matters.

## Why You Need a Secrets Manager

Consider these common anti-patterns that show up in almost every organization:

- Secrets in `.env` files committed to git
- Shared credentials across dev, staging, and production
- Static credentials that never rotate
- No audit trail of who accessed what secret
- Secrets printed in CI/CD logs

Each one of these creates real risk. The Uber breach in 2016 started with AWS credentials in a GitHub repo and led to 57 million user records exposed. CircleCI's 2023 compromise affected thousands of customers through leaked secrets.

A dedicated secrets manager solves all of these problems with centralized encrypted storage, per-environment credentials, dynamic secrets with short TTLs, comprehensive audit logging, and just-in-time retrieval.

## Core Principles

Before diving into tools, understand the principles that make secrets management work regardless of which platform you pick.

**Least privilege.** Every service, user, and process should only access the secrets it actually needs. Production database passwords should never be accessible to all developers.

**Short-lived credentials.** Static credentials are valid forever until someone remembers to rotate them. Dynamic credentials that expire in an hour limit the blast radius when something gets compromised.

**Pull, don't push.** Applications should fetch secrets from a vault at runtime. Injecting secrets as environment variables at build time is the wrong pattern because those values get baked into layers, logs, and process lists.

**Audit everything.** Every secret access should be logged with who accessed it, when, from where, and what they did with it. You cannot respond to what you cannot see.

**Rotate without downtime.** You should be able to rotate any secret without service interruption. Generate the new credential, update the secrets manager, let applications fetch the new value, then revoke the old one.

## Secret Types Need Different Strategies

Not every secret is the same. Here is how rotation frequency and storage should differ:

| Secret Type | Rotation | Storage | Notes |
|-------------|----------|---------|-------|
| API Keys | 90 days | Vault/Cloud SM | Keep multiple active keys for rotation |
| Database Creds | Dynamic | Vault | Generate per-session when possible |
| TLS Certificates | 90 days | Vault PKI | Automate with ACME or Vault |
| SSH Keys | 1 year | Vault SSH | Consider signed certificates instead |
| Encryption Keys | 1-2 years | HSM/KMS | Never export, rotate with re-encryption |
| OAuth Tokens | Per session | Memory only | Use refresh tokens, short-lived access |

## HashiCorp Vault

Vault is the industry standard for secrets management. It gives you a unified interface for any secret type with pluggable auth methods, secrets engines, and audit backends. If you need multi-cloud support, dynamic secrets, or full control over your secrets infrastructure, Vault is the right choice.

### Getting Started

For learning, dev mode gets you running in seconds:

```bash
vault server -dev
# Unseals automatically, root token set to 'root', in-memory storage
```

For production, use Raft storage with TLS:

```hcl
# vault/config/config.hcl
storage "raft" {
  path    = "/vault/data"
  node_id = "vault-1"
}

listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_disable   = false
  tls_cert_file = "/vault/config/tls/vault.crt"
  tls_key_file  = "/vault/config/tls/vault.key"
}

api_addr     = "https://vault.example.com:8200"
cluster_addr = "https://vault.example.com:8201"
ui           = true
```

Initialize with Shamir's Secret Sharing so no single person holds all unseal keys:

```bash
vault operator init -key-shares=5 -key-threshold=3
# Store these keys securely and separately
```

### Dynamic Database Secrets

This is where Vault really shines. Instead of storing static database passwords, Vault generates short-lived credentials on demand:

```bash
# Enable the database secrets engine
vault secrets enable database

# Configure PostgreSQL connection
vault write database/config/mydb \
    plugin_name=postgresql-database-plugin \
    connection_url="postgresql://{{username}}:{{password}}@localhost:5432/mydb" \
    allowed_roles="readonly,readwrite" \
    username="vault_admin" \
    password="vault_admin_password"

# Create a role that generates credentials
vault write database/roles/readonly \
    db_name=mydb \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="1h" \
    max_ttl="24h"

# Generate credentials on demand
vault read database/creds/readonly
# Returns: username=v-root-readonly-xyz789, password=A1B2C3D4E5, lease_duration=1h
```

Each set of credentials is unique and automatically revoked after the TTL expires. If one gets compromised, the blast radius is limited to that single session.

### Kubernetes Integration

For applications running in Kubernetes, the Vault Agent Injector is the cleanest integration path:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
  annotations:
    vault.hashicorp.com/agent-inject: 'true'
    vault.hashicorp.com/role: 'myapp'
    vault.hashicorp.com/agent-inject-secret-db-creds: 'secret/data/myapp/database'
    vault.hashicorp.com/agent-inject-template-db-creds: |
      {{- with secret "secret/data/myapp/database" -}}
      export DB_USER="{{ .Data.data.username }}"
      export DB_PASS="{{ .Data.data.password }}"
      {{- end -}}
spec:
  serviceAccountName: myapp-sa
  containers:
    - name: myapp
      image: myapp:latest
```

### Policies

Vault policies define exactly what a token can access. Here is a practical example:

```hcl
# myapp-policy.hcl
path "secret/data/myapp/*" {
  capabilities = ["read", "list"]
}

path "database/creds/myapp-readonly" {
  capabilities = ["read"]
}

path "secret/data/otherapp/*" {
  capabilities = ["deny"]
}
```

## AWS Secrets Manager

If your infrastructure lives entirely in AWS, Secrets Manager is the simpler option. It integrates natively with RDS, ECS, Lambda, and other AWS services. The learning curve is minimal compared to Vault, but you lose dynamic secret generation and multi-cloud support.

### Creating Secrets

```bash
# Create a secret
aws secretsmanager create-secret \
    --name myapp/database \
    --description "Database credentials for MyApp" \
    --secret-string '{"username":"admin","password":"s3cr3t","host":"db.example.com"}'

# Retrieve it
aws secretsmanager get-secret-value --secret-id myapp/database
```

With Terraform:

```hcl
resource "aws_secretsmanager_secret" "database" {
  name        = "myapp/database"
  description = "Database credentials"
  tags = {
    Environment = "production"
    Application = "myapp"
  }
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    username = "admin"
    password = random_password.db.result
    host     = aws_db_instance.main.address
    port     = 5432
  })
}
```

### Automatic Rotation

AWS Secrets Manager handles rotation through Lambda functions. For RDS credentials, the four-step rotation process (create, set, test, finish) ensures zero-downtime credential updates:

```hcl
resource "aws_secretsmanager_secret_rotation" "database" {
  secret_id           = aws_secretsmanager_secret.database.id
  rotation_lambda_arn = aws_lambda_function.rotation.arn

  rotation_rules {
    automatically_after_days = 30
  }
}
```

### ECS Integration

ECS pulls secrets directly from Secrets Manager without any application code changes:

```json
{
  "containerDefinitions": [
    {
      "name": "app",
      "image": "myapp:latest",
      "secrets": [
        {
          "name": "DB_USERNAME",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:myapp/database:username::"
        },
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:myapp/database:password::"
        }
      ]
    }
  ]
}
```

## Azure Key Vault

For teams in the Microsoft ecosystem, Azure Key Vault provides secrets, keys, and certificate management with tight Azure AD integration. Managed identities mean your applications authenticate without any stored credentials at all.

### Setup

```bash
az keyvault create \
    --name myapp-vault \
    --resource-group myapp-rg \
    --location eastus \
    --enable-rbac-authorization true

az keyvault secret set \
    --vault-name myapp-vault \
    --name database-password \
    --value "s3cr3t"
```

Use RBAC over legacy access policies for more granular control:

```bash
az role assignment create \
    --role "Key Vault Secrets User" \
    --assignee "<principal-id>" \
    --scope "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.KeyVault/vaults/myapp-vault"
```

### Managed Identity

The real power of Azure Key Vault is managed identity integration. Your application gets an identity that Azure manages entirely, so there are no credentials to store or rotate:

```hcl
resource "azurerm_linux_web_app" "main" {
  name                = "myapp-web"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.main.id

  identity {
    type = "SystemAssigned"
  }

  app_settings = {
    AZURE_KEY_VAULT_URL = azurerm_key_vault.main.vault_uri
  }
}

resource "azurerm_role_assignment" "app_secrets" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_web_app.main.identity[0].principal_id
}
```

## Secrets in CI/CD

CI/CD pipelines need special treatment. Use platform-native secrets (GitHub Secrets, GitLab CI Variables), fetch secrets at runtime rather than build time, and use OIDC for cloud authentication whenever possible:

```yaml
# GitHub Actions with OIDC - no stored credentials needed
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      - name: Configure AWS (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/deploy
          aws-region: us-east-1
```

Never echo secrets to verify they work. Never pass secrets as command-line arguments (they show up in `ps` output). Never use the same secrets for PR builds as production.

## Prevent Leaks with Automated Scanning

Add secret detection to your pre-commit hooks so leaked credentials never make it into git:

```bash
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

Tools like gitleaks, truffleHog, and GitHub's built-in Secret Scanning catch credentials before they become incidents.

## Which Tool Should You Choose?

| Factor | Vault | AWS Secrets Manager | Azure Key Vault |
|--------|-------|---------------------|-----------------|
| Dynamic secrets | Excellent | Limited | Limited |
| Multi-cloud | Yes | AWS only | Azure-focused |
| Self-hosted | Yes | No | No |
| PKI/Certificates | Built-in | Via ACM | Built-in |
| Learning curve | Steep | Low | Low |
| Cost | Free (OSS) | Per-secret/API call | Per-operation |

Pick Vault if you run multi-cloud or need dynamic secrets. Pick AWS Secrets Manager if you are all-in on AWS and want the simplest integration. Pick Azure Key Vault if you live in the Microsoft ecosystem.

Whichever tool you choose, the principles stay the same: least privilege, short-lived credentials, audit everything, and automate rotation. Start with one tool, get your most critical secrets managed properly, and expand from there. The worst secrets management strategy is no strategy at all.

---

## Related Security Posts

- [CI/CD Pipeline Hardening](/posts/cicd-pipeline-hardening-guide) - Use OIDC and ephemeral runners so your pipelines never store long-lived credentials in the first place
- [Pre-commit Hooks for Security](/posts/pre-commit-hooks-security-guide) - Catch AWS keys, database passwords, and API tokens before they get committed to Git history
- [Software Supply Chain Security: SBOMs, Sigstore, and SLSA in Practice](/posts/software-supply-chain-security) - Pair proper secrets management with artifact signing to secure every step from build to deploy

For foundational concepts like least privilege and defense in depth, see our guide on [security principles](/guides/security-principles).
