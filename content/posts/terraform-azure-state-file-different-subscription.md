---
title: 'How to Store Terraform Azure State File in a Different Subscription'
excerpt: "Learn how to configure Terraform to store its state file in an Azure Storage Account that exists in a different subscription from your infrastructure resources."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-03-05'
publishedAt: '2025-03-05T11:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Azure
  - State Management
  - Cross-Subscription
  - DevOps
---

In Azure, it's common to have a centralized subscription for shared services like Terraform state storage, while your actual infrastructure lives in separate subscriptions for different environments or teams. Configuring Terraform to store its state file in a different subscription requires setting up proper authentication and specifying the correct subscription ID in your backend configuration.

This setup centralizes state management and follows the principle of separation of concerns.

**TLDR:** To store Terraform state in a different Azure subscription, configure the AzureRM backend with `subscription_id` pointing to the subscription containing your storage account, and ensure your service principal or managed identity has appropriate access to both the state subscription and the target infrastructure subscription. Use `subscription_id` in the backend block for the state storage subscription, and configure the provider block for your infrastructure subscription.

## Understanding the Scenario

You typically have two subscriptions in play:

```
State Management Subscription (shared-services-sub)
└── Storage Account: terraformstates
    └── Container: tfstate
        └── prod-app.tfstate

Infrastructure Subscription (production-sub)
└── Resource Group: production-rg
    └── Virtual Machines, Networks, etc.
```

Terraform needs access to both subscriptions: one for storing state, another for managing resources.

## Basic Backend Configuration

Configure the backend to point to the storage account in the different subscription:

```hcl
# backend.tf

terraform {
  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "terraformstates"
    container_name       = "tfstate"
    key                  = "prod-app.tfstate"

    # Subscription ID where the storage account exists
    subscription_id      = "11111111-1111-1111-1111-111111111111"
  }
}
```

The `subscription_id` in the backend configuration must match the subscription containing your storage account, not the subscription where you're creating resources.

## Provider Configuration for Target Subscription

Configure the Azure provider to manage resources in the target subscription:

```hcl
# provider.tf

provider "azurerm" {
  features {}

  # Subscription where you're creating infrastructure
  subscription_id = "22222222-2222-2222-2222-222222222222"
}
```

Notice the provider has a different `subscription_id` than the backend - this is expected and correct.

## Complete Configuration Example

Here's a full example showing both subscriptions:

```hcl
# versions.tf
terraform {
  required_version = ">= 1.5"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }

  # Backend in shared services subscription
  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "companyterraformstate"
    container_name       = "tfstate"
    key                  = "production/infrastructure.tfstate"
    subscription_id      = "11111111-1111-1111-1111-111111111111"  # State subscription
  }
}

# provider.tf
provider "azurerm" {
  features {}

  # Infrastructure subscription
  subscription_id = "22222222-2222-2222-2222-222222222222"
}

# main.tf
resource "azurerm_resource_group" "app" {
  name     = "production-app-rg"
  location = "East US"
}

resource "azurerm_virtual_network" "app" {
  name                = "production-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.app.location
  resource_group_name = azurerm_resource_group.app.name
}
```

## Authentication Across Subscriptions

Your authentication method must have access to both subscriptions.

**Using Service Principal:**

```bash
# Set environment variables
export ARM_CLIENT_ID="00000000-0000-0000-0000-000000000000"
export ARM_CLIENT_SECRET="your-secret"
export ARM_TENANT_ID="10000000-0000-0000-0000-000000000000"

# The service principal must have:
# - Storage Blob Data Contributor on the state storage account
# - Contributor (or appropriate role) on the infrastructure subscription
```

Grant the service principal access to both subscriptions:

```bash
# Grant access to state storage subscription
az role assignment create \
  --assignee $ARM_CLIENT_ID \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/terraform-state-rg/providers/Microsoft.Storage/storageAccounts/terraformstates"

# Grant access to infrastructure subscription
az role assignment create \
  --assignee $ARM_CLIENT_ID \
  --role "Contributor" \
  --scope "/subscriptions/22222222-2222-2222-2222-222222222222"
```

**Using Managed Identity (for Azure VMs or Azure DevOps):**

```hcl
provider "azurerm" {
  features {}

  use_msi         = true
  subscription_id = "22222222-2222-2222-2222-222222222222"
}
```

The managed identity must have appropriate roles assigned in both subscriptions.

## Partial Backend Configuration

For better security, avoid hardcoding subscription IDs in your repository:

```hcl
# backend.tf - partial configuration
terraform {
  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "terraformstates"
    container_name       = "tfstate"
    key                  = "prod-app.tfstate"
    # subscription_id will be provided via -backend-config
  }
}
```

Provide the subscription ID during initialization:

```bash
terraform init \
  -backend-config="subscription_id=11111111-1111-1111-1111-111111111111"
```

Or use a backend configuration file:

```hcl
# backend-config.hcl
subscription_id = "11111111-1111-1111-1111-111111111111"
```

```bash
terraform init -backend-config=backend-config.hcl
```

## Environment-Specific Backend Configuration

For multiple environments, create separate backend config files:

```hcl
# backend-dev.hcl
subscription_id = "11111111-1111-1111-1111-111111111111"
key            = "dev/infrastructure.tfstate"

# backend-staging.hcl
subscription_id = "11111111-1111-1111-1111-111111111111"
key            = "staging/infrastructure.tfstate"

# backend-prod.hcl
subscription_id = "11111111-1111-1111-1111-111111111111"
key            = "prod/infrastructure.tfstate"
```

Initialize for each environment:

```bash
# Development
terraform init -backend-config=backend-dev.hcl

# Production
terraform init -backend-config=backend-prod.hcl
```

## Using Azure CLI Authentication

When using Azure CLI for local development:

```bash
# Login to Azure
az login

# Set the default subscription for infrastructure
az account set --subscription "22222222-2222-2222-2222-222222222222"

# Terraform backend will use CLI credentials to access state storage
terraform init
```

The Azure CLI credentials automatically work across subscriptions if you have the necessary permissions.

## Troubleshooting Access Issues

**Error: "Failed to get existing workspaces: storage: service returned error: StatusCode=403"**

This means your identity doesn't have access to the storage account. Grant appropriate permissions:

```bash
# Get your current user or service principal object ID
OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)

# Grant Storage Blob Data Contributor role
az role assignment create \
  --role "Storage Blob Data Contributor" \
  --assignee-object-id $OBJECT_ID \
  --assignee-principal-type User \
  --scope "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/terraform-state-rg/providers/Microsoft.Storage/storageAccounts/terraformstates"
```

**Error: "Error building AzureRM Client: obtain subscription() from Azure CLI: parsing json result from the Azure CLI"**

This usually means the subscription ID is incorrect or you don't have access. Verify:

```bash
# List subscriptions you have access to
az account list --query "[].{Name:name, ID:id}" -o table

# Verify you can access the state subscription
az account show --subscription 11111111-1111-1111-1111-111111111111
```

## Creating the State Storage Account

Set up the storage account in the shared services subscription:

```bash
# Set subscription for state storage
az account set --subscription 11111111-1111-1111-1111-111111111111

# Create resource group
az group create \
  --name terraform-state-rg \
  --location eastus

# Create storage account
az storage account create \
  --name terraformstates \
  --resource-group terraform-state-rg \
  --location eastus \
  --sku Standard_LRS \
  --encryption-services blob \
  --https-only true \
  --min-tls-version TLS1_2

# Create container
az storage container create \
  --name tfstate \
  --account-name terraformstates \
  --auth-mode login
```

## Using Different Storage Accounts Per Environment

You might want separate storage accounts for different environments:

```
Shared Services Subscription
├── terraformstates-dev
│   └── Container: tfstate
├── terraformstates-staging
│   └── Container: tfstate
└── terraformstates-prod
    └── Container: tfstate
```

Configure each environment:

```hcl
# backend-prod.hcl
subscription_id      = "11111111-1111-1111-1111-111111111111"
storage_account_name = "terraformstates-prod"
container_name       = "tfstate"
key                 = "infrastructure.tfstate"
```

## State Locking Across Subscriptions

Azure backend uses blob leases for state locking, which works across subscriptions automatically:

```hcl
terraform {
  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "terraformstates"
    container_name       = "tfstate"
    key                  = "prod.tfstate"
    subscription_id      = "11111111-1111-1111-1111-111111111111"

    # State locking is automatic with Azure backend
    # No additional configuration needed
  }
}
```

The locking mechanism works regardless of which subscription the storage account is in.

## Managing Multiple Infrastructure Subscriptions

If you manage resources across multiple subscriptions from one Terraform configuration:

```hcl
# Backend in shared services
terraform {
  backend "azurerm" {
    subscription_id      = "11111111-1111-1111-1111-111111111111"
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "terraformstates"
    container_name       = "tfstate"
    key                  = "multi-sub.tfstate"
  }
}

# Default provider for subscription A
provider "azurerm" {
  features {}
  subscription_id = "22222222-2222-2222-2222-222222222222"
}

# Aliased provider for subscription B
provider "azurerm" {
  alias = "sub_b"
  features {}
  subscription_id = "33333333-3333-3333-3333-333333333333"
}

# Resources in subscription A (uses default provider)
resource "azurerm_resource_group" "app_a" {
  name     = "app-a-rg"
  location = "East US"
}

# Resources in subscription B (uses aliased provider)
resource "azurerm_resource_group" "app_b" {
  provider = azurerm.sub_b

  name     = "app-b-rg"
  location = "West US"
}
```

State is stored in the shared services subscription while managing resources across multiple subscriptions.

## Security Best Practices

**Use separate service principals per environment:**

```bash
# Create service principal for dev
az ad sp create-for-rbac \
  --name "terraform-dev" \
  --role Contributor \
  --scopes /subscriptions/22222222-2222-2222-2222-222222222222

# Grant state storage access
az role assignment create \
  --assignee <sp-app-id> \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/11111111-1111-1111-1111-111111111111/.../terraformstates"
```

**Enable soft delete and versioning on the state storage account:**

```bash
az storage blob service-properties delete-policy update \
  --account-name terraformstates \
  --enable true \
  --days-retained 30

az storage account blob-service-properties update \
  --account-name terraformstates \
  --resource-group terraform-state-rg \
  --enable-versioning true
```

**Use private endpoints for state storage:**

```bash
az network private-endpoint create \
  --name terraform-state-pe \
  --resource-group terraform-state-rg \
  --vnet-name management-vnet \
  --subnet management-subnet \
  --private-connection-resource-id $(az storage account show --name terraformstates --resource-group terraform-state-rg --query id -o tsv) \
  --group-id blob \
  --connection-name terraform-state-connection
```

## Migrating Existing State to Different Subscription

If you need to move state from one subscription to another:

```bash
# Export current state
terraform state pull > terraform.tfstate.backup

# Reconfigure backend to new subscription
terraform init -migrate-state \
  -backend-config="subscription_id=11111111-1111-1111-1111-111111111111" \
  -backend-config="storage_account_name=newterraformstates"

# Verify state was migrated
terraform state list
```

Storing Terraform state in a centralized subscription helps with governance, auditing, and access control. Configure the backend with the state storage subscription ID while keeping your provider pointed at the infrastructure subscription, and make sure your authentication has appropriate permissions across both subscriptions.
