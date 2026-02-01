---
title: 'HashiCorp Vault'
description: 'Deploy and operate HashiCorp Vault for centralized secrets management'
---

# HashiCorp Vault

HashiCorp Vault is the industry standard for secrets management. It provides a unified interface to any secret while providing tight access control and recording a detailed audit log.

## Architecture Overview

Vault uses a client-server architecture with pluggable backends:

```
                     +------------------+
                     |     Clients      |
                     |  (CLI/API/UI)    |
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     |   Vault Server   |
                     |   (API Layer)    |
                     +--------+---------+
                              |
          +-------------------+-------------------+
          |                   |                   |
          v                   v                   v
    +-----+-----+       +-----+-----+       +-----+-----+
    |  Secrets  |       |   Auth    |       |   Audit   |
    |  Engines  |       |  Methods  |       |  Devices  |
    +-----------+       +-----------+       +-----------+
          |                   |                   |
          v                   v                   v
    +-----+-----+       +-----+-----+       +-----+-----+
    |  Storage  |       |   LDAP/   |       |   File/   |
    |  Backend  |       | OIDC/etc  |       |  Syslog   |
    +-----------+       +-----------+       +-----------+
```

## Installation and Setup

### Development Mode

For learning and testing (never use in production):

```bash
# Start Vault in dev mode
vault server -dev

# Dev mode automatically:
# - Unseals the vault
# - Sets root token to 'root'
# - Enables in-memory storage
# - Listens on localhost:8200
```

### Production Deployment with Docker

```yaml
# docker-compose.yml
version: '3.8'

services:
  vault:
    image: hashicorp/vault:1.15
    container_name: vault
    ports:
      - "8200:8200"
    environment:
      VAULT_ADDR: 'http://127.0.0.1:8200'
    cap_add:
      - IPC_LOCK
    volumes:
      - ./vault/config:/vault/config
      - ./vault/data:/vault/data
      - ./vault/logs:/vault/logs
    command: vault server -config=/vault/config/config.hcl
```

```hcl
# vault/config/config.hcl
storage "raft" {
  path    = "/vault/data"
  node_id = "vault-1"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = false
  tls_cert_file = "/vault/config/tls/vault.crt"
  tls_key_file  = "/vault/config/tls/vault.key"
}

api_addr = "https://vault.example.com:8200"
cluster_addr = "https://vault.example.com:8201"
ui = true

# Telemetry for monitoring
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname = true
}
```

### Initialization and Unsealing

```bash
# Initialize Vault (only once, on first setup)
vault operator init -key-shares=5 -key-threshold=3

# Output:
# Unseal Key 1: abc123...
# Unseal Key 2: def456...
# Unseal Key 3: ghi789...
# Unseal Key 4: jkl012...
# Unseal Key 5: mno345...
# Initial Root Token: hvs.xxxxx

# CRITICAL: Store these keys securely and separately!
# Use Shamir's Secret Sharing - no single person should have all keys

# Unseal Vault (requires threshold number of keys)
vault operator unseal  # Enter key 1
vault operator unseal  # Enter key 2
vault operator unseal  # Enter key 3

# Login with root token
vault login hvs.xxxxx
```

## Secrets Engines

### KV (Key-Value) Secrets Engine

The most common secrets engine for storing arbitrary secrets:

```bash
# Enable KV v2 (versioned)
vault secrets enable -path=secret kv-v2

# Store a secret
vault kv put secret/myapp/database \
    username="dbuser" \
    password="s3cr3t" \
    host="db.example.com"

# Read a secret
vault kv get secret/myapp/database

# Read specific field
vault kv get -field=password secret/myapp/database

# Read specific version
vault kv get -version=1 secret/myapp/database

# Delete a secret (soft delete, can be recovered)
vault kv delete secret/myapp/database

# Permanently destroy
vault kv destroy -versions=1,2 secret/myapp/database
```

### Database Secrets Engine (Dynamic Secrets)

Generate on-demand, short-lived database credentials:

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

# Generate credentials
vault read database/creds/readonly

# Output:
# Key                Value
# lease_id           database/creds/readonly/abc123
# lease_duration     1h
# username           v-root-readonly-xyz789
# password           A1B2C3D4E5...
```

### AWS Secrets Engine

Generate dynamic AWS IAM credentials:

```bash
# Enable AWS secrets engine
vault secrets enable aws

# Configure root credentials
vault write aws/config/root \
    access_key=AKIAIOSFODNN7EXAMPLE \
    secret_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY \
    region=us-east-1

# Create role for EC2 admin
vault write aws/roles/ec2-admin \
    credential_type=iam_user \
    policy_document=-<<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ec2:*",
      "Resource": "*"
    }
  ]
}
EOF

# Generate credentials
vault read aws/creds/ec2-admin
```

## Authentication Methods

### AppRole (for Applications)

Most common method for automated workloads:

```bash
# Enable AppRole auth
vault auth enable approle

# Create a role for your application
vault write auth/approle/role/myapp \
    token_policies="myapp-policy" \
    token_ttl=1h \
    token_max_ttl=4h \
    secret_id_ttl=10m \
    secret_id_num_uses=1

# Get role ID (can be embedded in app config)
vault read auth/approle/role/myapp/role-id

# Generate secret ID (should be delivered securely)
vault write -f auth/approle/role/myapp/secret-id

# Application authenticates with both
vault write auth/approle/login \
    role_id="abc123" \
    secret_id="def456"
```

### Kubernetes Authentication

For applications running in Kubernetes:

```bash
# Enable Kubernetes auth
vault auth enable kubernetes

# Configure with cluster info
vault write auth/kubernetes/config \
    kubernetes_host="https://kubernetes.default.svc:443" \
    kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

# Create a role bound to a service account
vault write auth/kubernetes/role/myapp \
    bound_service_account_names=myapp-sa \
    bound_service_account_namespaces=production \
    policies=myapp-policy \
    ttl=1h
```

```yaml
# Kubernetes pod spec using Vault Agent Injector
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

## Policies

Vault policies define what secrets a token can access:

```hcl
# myapp-policy.hcl

# Read application secrets
path "secret/data/myapp/*" {
  capabilities = ["read", "list"]
}

# Generate database credentials
path "database/creds/myapp-readonly" {
  capabilities = ["read"]
}

# No access to other apps
path "secret/data/otherapp/*" {
  capabilities = ["deny"]
}

# Allow token renewal
path "auth/token/renew-self" {
  capabilities = ["update"]
}
```

```bash
# Create policy
vault policy write myapp-policy myapp-policy.hcl

# List policies
vault policy list

# Read policy
vault policy read myapp-policy
```

## Audit Logging

Enable audit logging for compliance:

```bash
# Enable file audit device
vault audit enable file file_path=/vault/logs/audit.log

# Enable syslog audit
vault audit enable syslog tag="vault" facility="AUTH"

# Audit log entry (JSON)
# {
#   "time": "2024-01-15T10:30:00Z",
#   "type": "response",
#   "auth": {
#     "client_token": "hmac-sha256:abc123",
#     "policies": ["myapp-policy"]
#   },
#   "request": {
#     "operation": "read",
#     "path": "secret/data/myapp/database"
#   }
# }
```

## High Availability

### Raft Storage (Integrated)

```hcl
# vault-node-1.hcl
storage "raft" {
  path    = "/vault/data"
  node_id = "vault-1"
  
  retry_join {
    leader_api_addr = "https://vault-2.example.com:8200"
  }
  retry_join {
    leader_api_addr = "https://vault-3.example.com:8200"
  }
}
```

```bash
# Check raft peers
vault operator raft list-peers

# Add a new node
vault operator raft join https://vault-1.example.com:8200
```

## Application Integration Example

### Python Application

```python
import hvac
import os

class VaultClient:
    def __init__(self):
        self.client = hvac.Client(
            url=os.environ.get('VAULT_ADDR', 'http://localhost:8200')
        )
        self._authenticate()
    
    def _authenticate(self):
        # AppRole authentication
        role_id = os.environ['VAULT_ROLE_ID']
        secret_id = os.environ['VAULT_SECRET_ID']
        
        response = self.client.auth.approle.login(
            role_id=role_id,
            secret_id=secret_id
        )
        self.client.token = response['auth']['client_token']
    
    def get_secret(self, path, key=None):
        secret = self.client.secrets.kv.v2.read_secret_version(
            path=path
        )
        data = secret['data']['data']
        return data.get(key) if key else data
    
    def get_database_credentials(self, role='readonly'):
        creds = self.client.secrets.database.generate_credentials(
            name=role
        )
        return {
            'username': creds['data']['username'],
            'password': creds['data']['password'],
            'lease_id': creds['lease_id'],
            'lease_duration': creds['lease_duration']
        }

# Usage
vault = VaultClient()
db_config = vault.get_secret('myapp/database')
dynamic_creds = vault.get_database_credentials()
```

## Best Practices

1. **Never store root token** - Generate and revoke after initial setup
2. **Use short TTLs** - Minimize blast radius of compromised credentials
3. **Enable audit logging** - Required for compliance and forensics
4. **Rotate credentials regularly** - Use dynamic secrets where possible
5. **Principle of least privilege** - Grant minimum required permissions
6. **Encrypt in transit and at rest** - Always use TLS
7. **Separate unseal keys** - Use Shamir's Secret Sharing properly
