---
title: Understanding Packer Fundamentals
description: Learn the core concepts behind Packer and how it automates machine image creation
order: 1
---

**TLDR**: Packer uses templates to automate building machine images. You define a source image, specify how to customize it with provisioners, and Packer produces configured images for one or more platforms. It's like a build system for infrastructure.

Before writing Packer templates, you need to understand how Packer thinks about images and the workflow it uses to build them.

## The Image Building Workflow

When you build an image manually, you typically:

1. Launch a base instance (Ubuntu, CentOS, etc.)
2. Connect to it and install software
3. Configure services and copy files
4. Clean up temporary files and history
5. Shut down and create an image snapshot
6. Test the image by launching a new instance

Packer automates this exact workflow. The template defines what to build, the builder launches a temporary instance, provisioners customize it, and post-processors handle the final artifacts.

The key difference: Packer does this repeatably and consistently. Run the same template twice, get identical images.

## Core Components

### Builders

Builders are responsible for creating machines and generating images from them. Each builder is specific to a platform:

- `amazon-ebs`: Creates AMIs for AWS EC2
- `docker`: Creates Docker images
- `googlecompute`: Creates images for Google Cloud
- `azure-arm`: Creates images for Azure
- `virtualbox-iso`: Creates VirtualBox machines from ISO
- `vmware-iso`: Creates VMware images from ISO

A builder knows how to:
- Authenticate with the platform
- Launch a temporary build instance
- Connect to that instance (SSH or WinRM)
- Create an image from the instance
- Clean up temporary resources

You can use multiple builders in one template to create the same image for different platforms.

### Provisioners

Provisioners customize the image after the builder creates the base instance. Common provisioners include:

**Shell**: Run shell commands or scripts
```hcl
provisioner "shell" {
  inline = [
    "sudo apt-get update",
    "sudo apt-get install -y nginx",
    "sudo systemctl enable nginx"
  ]
}
```

**File**: Copy files from your machine to the image
```hcl
provisioner "file" {
  source      = "configs/nginx.conf"
  destination = "/tmp/nginx.conf"
}
```

**Ansible**: Run Ansible playbooks
```hcl
provisioner "ansible" {
  playbook_file = "./playbook.yml"
}
```

Provisioners run in order. You typically:
1. Update package lists
2. Install software
3. Copy configuration files
4. Configure services
5. Clean up package caches and logs

### Post-Processors

Post-processors run after the image is created. They can:
- Compress images
- Upload to artifact repositories
- Tag images
- Create manifests with build metadata
- Push Docker images to registries

```hcl
post-processor "docker-tag" {
  repository = "mycompany/webapp"
  tags       = ["1.0.0", "latest"]
}
```

Post-processors are optional but useful for integrating Packer into your deployment pipeline.

## HCL2 Template Structure

Modern Packer templates use HCL2 (HashiCorp Configuration Language), the same language as Terraform:

```hcl
# Variables for reusability
variable "region" {
  type    = string
  default = "us-east-1"
}

# Data sources for dynamic values
data "amazon-ami" "ubuntu" {
  filters = {
    name = "ubuntu/images/hvm-ssd/ubuntu-22.04-*"
  }
  most_recent = true
  owners      = ["099720109477"]
}

# Source defines reusable builder configuration
source "amazon-ebs" "web" {
  ami_name      = "web-server-{{timestamp}}"
  instance_type = "t3.micro"
  region        = var.region
  source_ami    = data.amazon-ami.ubuntu.id

  ssh_username = "ubuntu"
}

# Build brings it all together
build {
  sources = ["source.amazon-ebs.web"]

  provisioner "shell" {
    inline = [
      "sudo apt-get update",
      "sudo apt-get install -y nginx"
    ]
  }

  post-processor "manifest" {
    output = "manifest.json"
  }
}
```

This template:
1. Finds the latest Ubuntu 22.04 AMI
2. Launches a t3.micro instance in us-east-1
3. Installs Nginx
4. Creates an AMI from the instance
5. Saves build metadata to manifest.json

## The Build Process

When you run `packer build template.pkr.hcl`, Packer:

1. **Validates** the template syntax and configuration
2. **Prepares** builders (e.g., finds the source AMI)
3. **Launches** temporary build instances
4. **Waits** for instances to be reachable (SSH/WinRM)
5. **Runs** provisioners in order
6. **Stops** instances
7. **Creates** images from stopped instances
8. **Runs** post-processors
9. **Terminates** temporary instances
10. **Outputs** image IDs and artifacts

If anything fails, Packer cleans up temporary resources automatically.

## Packer vs Docker

Packer can build Docker images, but it's not a replacement for Dockerfiles:

**Dockerfile**: Purpose-built for containers. Fast, layered, optimized for containerized applications.

**Packer with Docker builder**: Useful when you need the same provisioning logic for both VMs and containers. Also useful for complex multi-stage builds or integrating with existing config management.

Most teams use Dockerfiles for containers and Packer for VMs/cloud images.

## When to Use Packer

Packer makes sense when:

**You need fast instance launches**: Pre-configured images boot in seconds vs minutes of configuration.

**You deploy to multiple clouds**: One template builds AWS AMIs, GCP images, and Azure images.

**You want immutable infrastructure**: Instead of updating running servers, deploy new images.

**You have complex build processes**: Installing multiple languages, compiling software, or running extensive tests.

**Compliance requires audit trails**: Packer templates in version control document exactly what's in each image.

Packer might be overkill if you're deploying containers exclusively or your infrastructure changes frequently (configuration management might be better).

## What's Next

Now that you understand Packer's architecture and workflow, the next chapter covers installing Packer and setting up your environment for building your first image.
