---
title: Builders and Platforms
description: Learn about different Packer builders and how to create images for multiple platforms
order: 4
---

**TLDR**: Packer supports 30+ builders for different platforms. Common ones are AWS EBS, Docker, Google Compute, Azure, and VirtualBox. You can use multiple builders in one template to create the same image for different platforms.

Builders are plugins that know how to create machine images for specific platforms. Each builder handles the platform-specific details of launching instances, connecting to them, and creating images.

## Amazon EBS Builder

The `amazon-ebs` builder creates EBS-backed AMIs:

```hcl
source "amazon-ebs" "example" {
  ami_name      = "my-app-{{timestamp}}"
  instance_type = "t3.micro"
  region        = "us-east-1"
  source_ami_filter {
    filters = {
      name                = "ubuntu/images/*ubuntu-jammy-22.04-amd64-server-*"
      root-device-type    = "ebs"
      virtualization-type = "hvm"
    }
    most_recent = true
    owners      = ["099720109477"]
  }
  ssh_username = "ubuntu"
  
  # Optional: use specific VPC/subnet
  vpc_id    = "vpc-12345678"
  subnet_id = "subnet-87654321"
  
  # Optional: enable EBS encryption
  encrypt_boot = true
  kms_key_id   = "arn:aws:kms:us-east-1:123456789:key/abc-123"
}
```

**Key options**:
- `source_ami` or `source_ami_filter`: Base AMI to start from
- `instance_type`: EC2 instance type for building
- `ssh_username`: User for SSH connection (ubuntu, ec2-user, admin)
- `iam_instance_profile`: IAM role for the build instance
- `security_group_ids`: Security groups for the build instance

## Docker Builder

The `docker` builder creates Docker images:

```hcl
source "docker" "nginx" {
  image  = "nginx:alpine"
  commit = true
  
  # Optional: export to tar
  export_path = "nginx-custom.tar"
}

build {
  sources = ["source.docker.nginx"]
  
  provisioner "shell" {
    inline = [
      "apk add --no-cache curl jq"
    ]
  }
  
  post-processor "docker-tag" {
    repository = "mycompany/nginx-custom"
    tags       = ["1.0.0", "latest"]
  }
  
  post-processor "docker-push" {
    login          = true
    login_username = var.docker_username
    login_password = var.docker_password
  }
}
```

**When to use Docker builder**:
- You need complex build steps (compiling, multi-stage provisioning)
- You want to share provisioning logic with VM builds
- You're integrating with existing config management tools

For simple cases, Dockerfiles are usually better.

## Google Compute Builder

The `googlecompute` builder creates GCE images:

```hcl
source "googlecompute" "example" {
  project_id          = "my-project"
  source_image_family = "ubuntu-2204-lts"
  ssh_username        = "packer"
  zone                = "us-central1-a"
  image_name          = "my-app-{{timestamp}}"
  image_family        = "my-app"
  
  # Use preemptible instance for cost savings
  preemptible = true
  
  # Machine type
  machine_type = "n1-standard-1"
}
```

**Authentication**: Use service account JSON key or Application Default Credentials.

## Azure ARM Builder

The `azure-arm` builder creates Azure Managed Images:

```hcl
source "azure-arm" "example" {
  # Authentication
  client_id       = var.azure_client_id
  client_secret   = var.azure_client_secret
  subscription_id = var.azure_subscription_id
  tenant_id       = var.azure_tenant_id
  
  # Image details
  managed_image_name                = "my-app-{{timestamp}}"
  managed_image_resource_group_name = "packer-images"
  
  # Build configuration
  os_type         = "Linux"
  image_publisher = "Canonical"
  image_offer     = "0001-com-ubuntu-server-jammy"
  image_sku       = "22_04-lts"
  
  # VM size
  vm_size = "Standard_B2s"
  
  # Location
  location = "eastus"
}
```

## DigitalOcean Builder

The `digitalocean` builder creates Droplet snapshots:

```hcl
source "digitalocean" "example" {
  api_token    = var.do_api_token
  image        = "ubuntu-22-04-x64"
  region       = "nyc3"
  size         = "s-1vcpu-1gb"
  snapshot_name = "my-app-{{timestamp}}"
  ssh_username = "root"
}
```

## VirtualBox Builder

The `virtualbox-iso` builder creates VirtualBox machines from ISO:

```hcl
source "virtualbox-iso" "example" {
  guest_os_type = "Ubuntu_64"
  iso_url       = "https://releases.ubuntu.com/22.04/ubuntu-22.04-live-server-amd64.iso"
  iso_checksum  = "sha256:84aeaf7823c8c61baa0ae862d0a06b03409394800000b3235854a6b38eb4856f"
  
  ssh_username = "packer"
  ssh_password = "packer"
  ssh_timeout  = "30m"
  
  shutdown_command = "echo 'packer' | sudo -S shutdown -P now"
  
  vboxmanage = [
    ["modifyvm", "{{.Name}}", "--memory", "2048"],
    ["modifyvm", "{{.Name}}", "--cpus", "2"]
  ]
}
```

## Multi-Platform Builds

Build the same image for multiple platforms:

```hcl
variable "version" {
  type = string
}

source "amazon-ebs" "app" {
  ami_name      = "myapp-${var.version}-{{timestamp}}"
  instance_type = "t3.micro"
  region        = "us-east-1"
  source_ami_filter {
    filters = {
      name = "ubuntu/images/*ubuntu-jammy-22.04-amd64-server-*"
    }
    most_recent = true
    owners      = ["099720109477"]
  }
  ssh_username = "ubuntu"
}

source "googlecompute" "app" {
  project_id          = "my-project"
  source_image_family = "ubuntu-2204-lts"
  zone                = "us-central1-a"
  image_name          = "myapp-${var.version}-{{timestamp}}"
  ssh_username        = "packer"
}

source "digitalocean" "app" {
  api_token     = var.do_api_token
  image         = "ubuntu-22-04-x64"
  region        = "nyc3"
  size          = "s-1vcpu-1gb"
  snapshot_name = "myapp-${var.version}-{{timestamp}}"
  ssh_username  = "root"
}

build {
  # Build all three platforms
  sources = [
    "source.amazon-ebs.app",
    "source.googlecompute.app",
    "source.digitalocean.app"
  ]
  
  # Shared provisioning for all platforms
  provisioner "shell" {
    inline = [
      "sudo apt-get update",
      "sudo apt-get install -y nginx"
    ]
  }
  
  # Platform-specific provisioning
  provisioner "shell" {
    only   = ["amazon-ebs.app"]
    inline = ["echo 'Running on AWS' > /tmp/platform.txt"]
  }
  
  provisioner "shell" {
    only   = ["googlecompute.app"]
    inline = ["echo 'Running on GCP' > /tmp/platform.txt"]
  }
}
```

Run with:
```bash
packer build -var="version=1.0.0" template.pkr.hcl
```

Packer builds all platforms in parallel by default.

## Selecting Specific Builders

Build only specific platforms:

```bash
# Build only AWS
packer build -only='amazon-ebs.app' template.pkr.hcl

# Build AWS and GCP
packer build -only='amazon-ebs.app,googlecompute.app' template.pkr.hcl
```

## Builder Communication

Builders need to communicate with instances:

**SSH (Linux)**:
- Most builders use SSH
- Packer generates temporary keys
- Default timeout: 5 minutes

**WinRM (Windows)**:
- Windows AMIs use WinRM
- Configure in user data or via source AMI

```hcl
source "amazon-ebs" "windows" {
  ami_name      = "windows-{{timestamp}}"
  instance_type = "t3.medium"
  region        = "us-east-1"
  source_ami_filter {
    filters = {
      name = "Windows_Server-2022-English-Full-Base-*"
    }
    most_recent = true
    owners      = ["amazon"]
  }
  communicator = "winrm"
  winrm_username = "Administrator"
  winrm_use_ssl  = true
  user_data_file = "bootstrap-winrm.ps1"
}
```

## Best Practices

**Use the right builder**: EBS for AWS, docker for containers, ISO builders for bare metal.

**Start from official images**: Use vendor images (Canonical, AWS, etc.) as base images.

**Test locally first**: Use Docker or VirtualBox builder to test provisioning before cloud builds.

**Parallelize builds**: Let Packer build multiple platforms simultaneously (default behavior).

**Tag images properly**: Include version, git commit, build date in image metadata.

**Clean up failures**: Use `packer build -force` to replace existing images during development.

## What's Next

Now that you understand builders, the next chapter covers provisioners in depth - the tools that customize your images.
