---
title: Installation and Setup
description: Install Packer and configure your environment for building machine images
order: 2
---

**TLDR**: Download the Packer binary for your OS, add it to your PATH, and verify with `packer version`. For cloud builders, configure credentials. For local builders like Docker, install the required software.

Packer is distributed as a single binary. No complex installation process, no dependencies to manage. Download, verify, and you're ready to build images.

## Installing Packer

### macOS

Using Homebrew (recommended):
```bash
brew tap hashicorp/tap
brew install hashicorp/tap/packer
```

Manual installation:
```bash
# Download the latest version
wget https://releases.hashicorp.com/packer/1.10.0/packer_1.10.0_darwin_amd64.zip

# Unzip
unzip packer_1.10.0_darwin_amd64.zip

# Move to /usr/local/bin
sudo mv packer /usr/local/bin/

# Verify
packer version
```

### Linux

Using the package manager (Ubuntu/Debian):
```bash
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt-get update && sudo apt-get install packer
```

Manual installation:
```bash
# Download
wget https://releases.hashicorp.com/packer/1.10.0/packer_1.10.0_linux_amd64.zip

# Unzip
unzip packer_1.10.0_linux_amd64.zip

# Move to PATH
sudo mv packer /usr/local/bin/

# Verify
packer version
```

### Windows

Using Chocolatey:
```powershell
choco install packer
```

Manual installation:
1. Download the Windows package from https://www.packer.io/downloads
2. Unzip to a directory (e.g., `C:\packer`)
3. Add that directory to your PATH environment variable
4. Open a new PowerShell window and verify: `packer version`

### Verify Installation

Regardless of your OS:
```bash
packer version
```

You should see output like:
```
Packer v1.10.0
```

## Setting Up Cloud Credentials

To build images on cloud platforms, Packer needs authentication credentials.

### AWS

Packer uses the standard AWS credentials chain. Set up credentials using:

**AWS CLI**:
```bash
aws configure
```

Or create `~/.aws/credentials`:
```ini
[default]
aws_access_key_id = YOUR_ACCESS_KEY
aws_secret_access_key = YOUR_SECRET_KEY
```

Or use environment variables:
```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
```

**IAM Permissions**: Your AWS user needs permissions to:
- Launch EC2 instances
- Create AMIs
- Create EBS volumes and snapshots
- Describe instances, AMIs, and subnets
- Create and attach security groups

### Google Cloud

Create a service account and download the JSON key:
```bash
# Set the service account key location
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"

# Or specify in your Packer template
source "googlecompute" "example" {
  account_file = "/path/to/key.json"
  project_id   = "your-project-id"
  # ...
}
```

### Azure

Create a service principal:
```bash
az ad sp create-for-rbac --name packer-sp
```

Set environment variables:
```bash
export ARM_CLIENT_ID="service-principal-app-id"
export ARM_CLIENT_SECRET="service-principal-password"
export ARM_SUBSCRIPTION_ID="your-subscription-id"
export ARM_TENANT_ID="your-tenant-id"
```

### DigitalOcean

Create an API token in your DigitalOcean account, then:
```bash
export DIGITALOCEAN_API_TOKEN="your-api-token"
```

## Setting Up Local Builders

### Docker

For building Docker images, install Docker:

**macOS/Windows**: Download Docker Desktop from docker.com

**Linux**:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to the docker group
sudo usermod -aG docker $USER
```

Verify Docker is running:
```bash
docker ps
```

### VirtualBox

For VirtualBox builders:

**macOS**: `brew install --cask virtualbox`

**Linux**: Download from virtualbox.org or use your package manager

**Windows**: Download from virtualbox.org

Packer will communicate with VirtualBox via its CLI tools.

## Creating Your First Template

Create a directory for your Packer templates:
```bash
mkdir ~/packer-templates
cd ~/packer-templates
```

Create a simple Docker example (`docker-test.pkr.hcl`):
```hcl
packer {
  required_plugins {
    docker = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/docker"
    }
  }
}

source "docker" "ubuntu" {
  image  = "ubuntu:22.04"
  commit = true
}

build {
  sources = ["source.docker.ubuntu"]

  provisioner "shell" {
    inline = [
      "apt-get update",
      "apt-get install -y curl"
    ]
  }

  post-processor "docker-tag" {
    repository = "my-ubuntu"
    tags       = ["latest"]
  }
}
```

Initialize Packer plugins:
```bash
packer init docker-test.pkr.hcl
```

This downloads the Docker plugin specified in the template.

## Validating Templates

Before building, validate your template syntax:
```bash
packer validate docker-test.pkr.hcl
```

Successful validation returns:
```
The configuration is valid.
```

If there are errors, Packer shows exactly what's wrong and where.

## Format Templates

Packer includes a formatter like `terraform fmt`:
```bash
packer fmt docker-test.pkr.hcl
```

This standardizes indentation, spacing, and ordering. Run it before committing templates to version control.

## Environment Setup Best Practices

**Use version control**: Keep templates in Git alongside your infrastructure code.

**Separate credentials**: Never hardcode credentials in templates. Use environment variables or credential files.

**Use .gitignore**: Exclude sensitive files:
```
# .gitignore
*.pem
*.key
credentials.json
*.box
*.ova
manifest.json
packer_cache/
```

**Pin plugin versions**: Specify exact plugin versions in templates to ensure consistency:
```hcl
required_plugins {
  amazon = {
    version = "= 1.2.8"
    source  = "github.com/hashicorp/amazon"
  }
}
```

**Use Makefile or scripts**: Wrap common commands:
```makefile
.PHONY: validate fmt build

validate:
	packer validate .

fmt:
	packer fmt -recursive .

build:
	packer build -force .
```

## Troubleshooting Installation

**"packer: command not found"**: The binary isn't in your PATH. Verify the location and add it to PATH.

**Permission denied**: On Linux/macOS, ensure the binary is executable: `chmod +x /path/to/packer`

**Name conflict with packer.io**: Some Linux distributions have a tool called `packer` for creating Zip files. HashiCorp's Packer binary should take precedence. Check: `which packer` and `packer version`.

**Plugin download failures**: Check your internet connection and firewall. Packer downloads plugins from GitHub releases.

## What's Next

Your environment is ready. The next chapter dives into writing your first real Packer template to build a web server image.
