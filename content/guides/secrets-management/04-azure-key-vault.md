---
title: 'Azure Key Vault'
description: 'Implement secrets management with Azure Key Vault'
---

# Azure Key Vault

Azure Key Vault provides secure storage for secrets, keys, and certificates in Azure. It integrates with Azure Active Directory for authentication and supports managed identities for seamless application access.

## Core Concepts

```
+-----------------+     +-----------------+     +-----------------+
|  Application    |     |   Azure AD      |     |   Key Vault     |
|  (with MI)      | --> |   (AuthN)       | --> |   (Secrets)     |
+-----------------+     +-----------------+     +-----------------+
        |                                               |
        v                                               v
+-----------------+                             +-----------------+
|   Managed       |                             |   Access        |
|   Identity      |                             |   Policies      |
+-----------------+                             +-----------------+
```

- **Secrets** - API keys, passwords, connection strings
- **Keys** - Cryptographic keys for encryption
- **Certificates** - SSL/TLS certificates with auto-renewal
- **Managed Identity** - Azure-managed service principal

## Creating a Key Vault

### Using Azure CLI

```bash
# Create resource group
az group create \
    --name myapp-rg \
    --location eastus

# Create Key Vault
az keyvault create \
    --name myapp-vault \
    --resource-group myapp-rg \
    --location eastus \
    --enable-rbac-authorization true

# Set a secret
az keyvault secret set \
    --vault-name myapp-vault \
    --name database-password \
    --value "s3cr3t"

# Get a secret
az keyvault secret show \
    --vault-name myapp-vault \
    --name database-password

# List all secrets
az keyvault secret list \
    --vault-name myapp-vault

# Delete a secret (soft delete)
az keyvault secret delete \
    --vault-name myapp-vault \
    --name database-password

# Purge a deleted secret (permanent)
az keyvault secret purge \
    --vault-name myapp-vault \
    --name database-password
```

### Using Terraform

```hcl
data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "main" {
  name                = "myapp-vault"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"
  
  # Enable RBAC (recommended over access policies)
  enable_rbac_authorization = true
  
  # Soft delete settings
  soft_delete_retention_days = 90
  purge_protection_enabled   = true
  
  # Network rules
  network_acls {
    bypass         = "AzureServices"
    default_action = "Deny"
    ip_rules       = ["10.0.0.0/24"]
    virtual_network_subnet_ids = [
      azurerm_subnet.app.id
    ]
  }

  tags = {
    Environment = "production"
  }
}

# Create a secret
resource "azurerm_key_vault_secret" "database_password" {
  name         = "database-password"
  value        = random_password.db.result
  key_vault_id = azurerm_key_vault.main.id
  
  content_type = "text/plain"
  
  tags = {
    Application = "myapp"
  }
}

# Grant access to an application
resource "azurerm_role_assignment" "app_secrets_reader" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}
```

## Authentication with Managed Identity

### System-Assigned Managed Identity

```hcl
# Azure App Service with system-assigned identity
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
  
  site_config {
    application_stack {
      python_version = "3.11"
    }
  }
}

# Grant the app access to secrets
resource "azurerm_role_assignment" "app_secrets" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_web_app.main.identity[0].principal_id
}
```

### User-Assigned Managed Identity

```hcl
resource "azurerm_user_assigned_identity" "app" {
  name                = "myapp-identity"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
}

# Use with AKS
resource "azurerm_kubernetes_cluster" "main" {
  # ... other config ...
  
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }
}
```

## Application Integration

### Python SDK

```python
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient
from functools import lru_cache

class AzureKeyVault:
    def __init__(self, vault_url):
        credential = DefaultAzureCredential()
        self.client = SecretClient(
            vault_url=vault_url,
            credential=credential
        )
    
    @lru_cache(maxsize=100)
    def get_secret(self, name, version=None):
        secret = self.client.get_secret(name, version=version)
        return secret.value
    
    def set_secret(self, name, value, content_type=None, tags=None):
        return self.client.set_secret(
            name,
            value,
            content_type=content_type,
            tags=tags
        )
    
    def list_secrets(self):
        return [
            {'name': s.name, 'enabled': s.enabled}
            for s in self.client.list_properties_of_secrets()
        ]

# Usage
vault = AzureKeyVault('https://myapp-vault.vault.azure.net/')
db_password = vault.get_secret('database-password')
```

### .NET SDK

```csharp
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;

public class KeyVaultService
{
    private readonly SecretClient _client;
    
    public KeyVaultService(string vaultUrl)
    {
        _client = new SecretClient(
            new Uri(vaultUrl),
            new DefaultAzureCredential()
        );
    }
    
    public async Task<string> GetSecretAsync(string name)
    {
        KeyVaultSecret secret = await _client.GetSecretAsync(name);
        return secret.Value;
    }
    
    public async Task SetSecretAsync(string name, string value)
    {
        await _client.SetSecretAsync(name, value);
    }
}

// In Program.cs with configuration
builder.Configuration.AddAzureKeyVault(
    new Uri("https://myapp-vault.vault.azure.net/"),
    new DefaultAzureCredential()
);

// Access as configuration
var dbPassword = builder.Configuration["database-password"];
```

### Using with AKS (CSI Driver)

```yaml
# SecretProviderClass for Azure Key Vault
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: azure-kv-secrets
spec:
  provider: azure
  parameters:
    usePodIdentity: "false"
    useVMManagedIdentity: "true"
    userAssignedIdentityID: "<client-id-of-managed-identity>"
    keyvaultName: "myapp-vault"
    objects: |
      array:
        - |
          objectName: database-password
          objectType: secret
        - |
          objectName: api-key
          objectType: secret
    tenantId: "<tenant-id>"
  secretObjects:
    - secretName: app-secrets
      type: Opaque
      data:
        - objectName: database-password
          key: DB_PASSWORD
        - objectName: api-key
          key: API_KEY
---
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
    - name: app
      image: myapp:latest
      volumeMounts:
        - name: secrets
          mountPath: "/mnt/secrets"
          readOnly: true
      env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
  volumes:
    - name: secrets
      csi:
        driver: secrets-store.csi.k8s.io
        readOnly: true
        volumeAttributes:
          secretProviderClass: azure-kv-secrets
```

## Certificate Management

```bash
# Create a certificate (self-signed for testing)
az keyvault certificate create \
    --vault-name myapp-vault \
    --name myapp-cert \
    --policy "$(az keyvault certificate get-default-policy)"

# Import existing certificate
az keyvault certificate import \
    --vault-name myapp-vault \
    --name myapp-cert \
    --file certificate.pfx \
    --password "pfx-password"

# Download certificate
az keyvault certificate download \
    --vault-name myapp-vault \
    --name myapp-cert \
    --file cert.pem
```

## Access Policies vs RBAC

### Access Policies (Legacy)

```bash
# Grant access via access policy
az keyvault set-policy \
    --name myapp-vault \
    --object-id "<principal-id>" \
    --secret-permissions get list
```

### RBAC (Recommended)

```bash
# Built-in roles for Key Vault:
# - Key Vault Administrator
# - Key Vault Secrets User
# - Key Vault Secrets Officer
# - Key Vault Certificates Officer
# - Key Vault Crypto Officer

# Grant secrets read access
az role assignment create \
    --role "Key Vault Secrets User" \
    --assignee "<principal-id>" \
    --scope "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.KeyVault/vaults/myapp-vault"
```

## Monitoring and Auditing

```bash
# Enable diagnostic logging
az monitor diagnostic-settings create \
    --name kv-diagnostics \
    --resource "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.KeyVault/vaults/myapp-vault" \
    --logs '[{"category": "AuditEvent", "enabled": true}]' \
    --workspace "<log-analytics-workspace-id>"
```

```kusto
// Log Analytics query for secret access
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.KEYVAULT"
| where OperationName == "SecretGet"
| project TimeGenerated, CallerIPAddress, identity_claim_upn_s, id_s
| order by TimeGenerated desc
```

## Pricing

As of 2024:
- **Standard tier**: $0.03 per 10,000 operations
- **Premium tier**: $1 per key per month (HSM-backed)
- **Secrets**: No storage cost, only operations
- **Certificates**: $3 per renewal

## Best Practices

1. **Use RBAC over access policies** - More granular control
2. **Enable managed identity** - No credentials to manage
3. **Enable soft delete and purge protection** - Prevent accidental loss
4. **Use private endpoints** - Keep traffic on Azure backbone
5. **Enable diagnostic logging** - Track all access
6. **Rotate secrets regularly** - Use automation where possible
7. **Tag resources** - For cost tracking and management
