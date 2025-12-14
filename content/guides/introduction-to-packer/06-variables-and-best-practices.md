---
title: Variables and Best Practices
description: Learn how to use variables effectively and structure Packer projects for production
order: 6
---

**TLDR**: Variables make templates reusable. Define them with types and defaults, override them at runtime or with variable files. Structure projects with clear directories, use version control, and implement proper testing before deploying images.

Variables let you write templates once and use them in multiple contexts - different regions, environments, versions, or cloud providers.

## Defining Variables

```hcl
variable "region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region to build in"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "app_version" {
  type = string
  # No default - must be provided
}

variable "enable_monitoring" {
  type    = bool
  default = true
}

variable "tags" {
  type = map(string)
  default = {
    Environment = "production"
    ManagedBy   = "packer"
  }
}
```

## Using Variables

Reference variables with `var.name`:

```hcl
source "amazon-ebs" "app" {
  region        = var.region
  instance_type = var.instance_type
  ami_name      = "myapp-${var.app_version}-{{timestamp}}"
  
  tags = var.tags
}

provisioner "shell" {
  environment_vars = [
    "APP_VERSION=${var.app_version}",
    "MONITORING=${var.enable_monitoring}"
  ]
  script = "scripts/install.sh"
}
```

## Providing Variable Values

**Command line**:
```bash
packer build -var="region=us-west-2" -var="app_version=1.2.3" template.pkr.hcl
```

**Environment variables**:
```bash
export PKR_VAR_region="us-west-2"
export PKR_VAR_app_version="1.2.3"
packer build template.pkr.hcl
```

**Variable files** (`production.pkrvars.hcl`):
```hcl
region       = "us-east-1"
app_version  = "2.0.0"
instance_type = "t3.small"

tags = {
  Environment = "production"
  Project     = "myapp"
  CostCenter  = "engineering"
}
```

Use with:
```bash
packer build -var-file="production.pkrvars.hcl" template.pkr.hcl
```

## Sensitive Variables

Mark variables as sensitive to hide them from output:

```hcl
variable "api_token" {
  type      = string
  sensitive = true
}
```

Values are hidden in Packer output:
```
==> amazon-ebs.app: Setting API token to <sensitive>
```

## Variable Validation

Add validation rules:

```hcl
variable "region" {
  type = string
  validation {
    condition     = contains(["us-east-1", "us-west-2", "eu-west-1"], var.region)
    error_message = "Region must be us-east-1, us-west-2, or eu-west-1."
  }
}

variable "app_version" {
  type = string
  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+\\.[0-9]+$", var.app_version))
    error_message = "Version must be in semantic versioning format (e.g., 1.2.3)."
  }
}
```

## Local Variables

Compute values from other variables:

```hcl
locals {
  timestamp = formatdate("YYYY-MM-DD-hhmm", timestamp())
  ami_name  = "${var.app_name}-${var.app_version}-${local.timestamp}"
  
  common_tags = merge(
    var.tags,
    {
      BuildDate = local.timestamp
      GitCommit = var.git_commit
    }
  )
}

source "amazon-ebs" "app" {
  ami_name = local.ami_name
  tags     = local.common_tags
}
```

## Project Structure

Organize Packer projects for maintainability:

```
packer-templates/
├── builds/
│   ├── web-server/
│   │   ├── template.pkr.hcl
│   │   ├── variables.pkr.hcl
│   │   ├── production.pkrvars.hcl
│   │   ├── staging.pkrvars.hcl
│   │   └── README.md
│   └── database/
│       ├── template.pkr.hcl
│       └── variables.pkr.hcl
├── scripts/
│   ├── install-nginx.sh
│   ├── configure-monitoring.sh
│   └── cleanup.sh
├── files/
│   ├── nginx.conf
│   ├── app.service
│   └── motd
├── ansible/
│   ├── playbook.yml
│   └── roles/
├── Makefile
└── README.md
```

## Makefile for Common Tasks

```makefile
.PHONY: init validate fmt build-staging build-prod

init:
	packer init builds/

validate:
	packer validate builds/

fmt:
	packer fmt -recursive .

build-staging:
	packer build \
	  -var-file="builds/web-server/staging.pkrvars.hcl" \
	  builds/web-server/

build-prod:
	packer build \
	  -var-file="builds/web-server/production.pkrvars.hcl" \
	  builds/web-server/

test:
	packer build -only="docker.*" builds/web-server/
```

## Version Control

`.gitignore`:
```
# Packer cache
packer_cache/
*.box
*.ova
*.tar.gz

# Build artifacts
manifest.json
output-*/

# Credentials
*.pem
*.key
credentials.json
*.pkrvars.hcl
!example.pkrvars.hcl

# Terraform
.terraform/
*.tfstate
*.tfstate.backup
```

## Testing Images

### Pre-Build Validation

```bash
# Validate syntax
packer validate template.pkr.hcl

# Format check
packer fmt -check template.pkr.hcl
```

### Test Build with Docker

Test provisioning locally before cloud builds:

```hcl
source "docker" "test" {
  image  = "ubuntu:22.04"
  commit = true
}

source "amazon-ebs" "prod" {
  # ... AWS configuration
}

build {
  sources = [
    "source.docker.test",
    "source.amazon-ebs.prod"
  ]
  
  # Same provisioners for both
  provisioner "shell" {
    script = "install.sh"
  }
}
```

Test with Docker only:
```bash
packer build -only="docker.test" template.pkr.hcl
```

### Post-Build Testing

Launch an instance and run tests:

```bash
#!/bin/bash
# test-image.sh

AMI_ID=$(jq -r '.builds[0].artifact_id' manifest.json | cut -d: -f2)

# Launch instance
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t3.micro \
  --query 'Instances[0].InstanceId' \
  --output text)

# Wait for instance
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Get IP
IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

# Run tests
curl -f http://$IP/ || exit 1
ssh ubuntu@$IP 'systemctl is-active nginx' || exit 1

# Cleanup
aws ec2 terminate-instances --instance-ids $INSTANCE_ID

echo "Tests passed!"
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Build AMI

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Packer
        uses: hashicorp/setup-packer@main
      
      - name: Initialize Packer
        run: packer init builds/
      
      - name: Validate templates
        run: packer validate builds/
      
      - name: Build AMI
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          packer build \
            -var="app_version=${GITHUB_REF#refs/tags/v}" \
            -var-file="production.pkrvars.hcl" \
            builds/web-server/
      
      - name: Upload manifest
        uses: actions/upload-artifact@v3
        with:
          name: manifest
          path: manifest.json
```

### GitLab CI

```yaml
variables:
  PACKER_VERSION: "1.10.0"

stages:
  - validate
  - build

validate:
  stage: validate
  image: hashicorp/packer:${PACKER_VERSION}
  script:
    - packer init builds/
    - packer validate builds/
    - packer fmt -check -recursive .

build-ami:
  stage: build
  image: hashicorp/packer:${PACKER_VERSION}
  only:
    - tags
  script:
    - packer build -var="app_version=$CI_COMMIT_TAG" builds/
  artifacts:
    paths:
      - manifest.json
```

## Security Best Practices

**Never commit credentials**: Use environment variables or secret management.

**Use IAM roles**: For AWS builds, use IAM instance profiles instead of access keys when possible.

**Encrypt images**: Enable encryption for AMIs and disk images:
```hcl
source "amazon-ebs" "encrypted" {
  encrypt_boot = true
  kms_key_id   = var.kms_key_id
}
```

**Scan images**: Run security scanners on built images before deployment.

**Minimal permissions**: Build instances only need permissions they actually use.

**Secure build instances**: Use private subnets and security groups that restrict access.

## Performance Optimization

**Use faster instance types**: Build time is money. Use larger instances for faster builds.

**Parallelize builds**: Build multiple platforms simultaneously (default).

**Cache dependencies**: Download large files once, reuse across builds.

**Clean up efficiently**: Use `find` with `-delete` instead of `rm -rf` for large directories.

## What's Next

You now know how to create production-ready Packer templates with variables, testing, and CI/CD integration. Use these patterns to build reliable, versioned infrastructure images that deploy consistently across your environments.
