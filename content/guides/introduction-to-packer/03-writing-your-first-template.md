---
title: Writing Your First Template
description: Create a complete Packer template to build a web server AMI
order: 3
---

**TLDR**: A Packer template defines sources (base images), builds (what to create), provisioners (how to customize), and post-processors (what to do with results). We'll build an AWS AMI with Nginx installed.

Let's build something real: a web server AMI that's ready to serve traffic the moment it launches.

## The Goal

We'll create an Amazon Machine Image (AMI) based on Ubuntu 22.04 with:
- Updated system packages
- Nginx web server installed and configured
- A custom index.html page
- Nginx set to start on boot

This AMI can then launch EC2 instances that immediately serve web traffic without any additional configuration.

## Template Structure

Create a file called `web-server.pkr.hcl`:

```hcl
packer {
  required_version = ">= 1.8.0"
  required_plugins {
    amazon = {
      version = ">= 1.2.0"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

# Variables make the template reusable
variable "region" {
  type    = string
  default = "us-east-1"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

# Data source finds the latest Ubuntu AMI
data "amazon-ami" "ubuntu" {
  filters = {
    name                = "ubuntu/images/*ubuntu-jammy-22.04-amd64-server-*"
    root-device-type    = "ebs"
    virtualization-type = "hvm"
  }
  most_recent = true
  owners      = ["099720109477"] # Canonical
  region      = var.region
}

# Source defines the builder configuration
source "amazon-ebs" "nginx" {
  ami_name      = "nginx-web-server-{{timestamp}}"
  instance_type = var.instance_type
  region        = var.region
  source_ami    = data.amazon-ami.ubuntu.id
  ssh_username  = "ubuntu"

  tags = {
    Name        = "nginx-web-server"
    Environment = "production"
    CreatedBy   = "packer"
  }
}

# Build executes the image creation
build {
  sources = ["source.amazon-ebs.nginx"]

  # Update package lists
  provisioner "shell" {
    inline = [
      "sudo apt-get update",
      "sudo apt-get upgrade -y"
    ]
  }

  # Install Nginx
  provisioner "shell" {
    inline = [
      "sudo apt-get install -y nginx",
      "sudo systemctl enable nginx"
    ]
  }

  # Copy custom configuration
  provisioner "file" {
    source      = "files/index.html"
    destination = "/tmp/index.html"
  }

  # Move file to final location
  provisioner "shell" {
    inline = [
      "sudo mv /tmp/index.html /var/www/html/index.html",
      "sudo chown www-data:www-data /var/www/html/index.html"
    ]
  }

  # Clean up
  provisioner "shell" {
    inline = [
      "sudo apt-get clean",
      "sudo rm -rf /tmp/*",
      "sudo rm -rf /var/tmp/*"
    ]
  }

  # Save build metadata
  post-processor "manifest" {
    output = "manifest.json"
    strip_path = true
  }
}
```

## Understanding Each Section

### Packer Block

```hcl
packer {
  required_version = ">= 1.8.0"
  required_plugins {
    amazon = {
      version = ">= 1.2.0"
      source  = "github.com/hashicorp/amazon"
    }
  }
}
```

This specifies:
- Minimum Packer version required
- Plugins needed and their versions
- Where to download plugins from

Packer will automatically download plugins when you run `packer init`.

### Variables

```hcl
variable "region" {
  type    = string
  default = "us-east-1"
}
```

Variables make templates reusable. You can override defaults:
```bash
packer build -var="region=us-west-2" web-server.pkr.hcl
```

### Data Sources

```hcl
data "amazon-ami" "ubuntu" {
  filters = {
    name = "ubuntu/images/*ubuntu-jammy-22.04-amd64-server-*"
  }
  most_recent = true
  owners      = ["099720109477"]
}
```

Data sources fetch information at build time. This finds the latest Ubuntu 22.04 AMI so your base image is always current. No hardcoded AMI IDs that become outdated.

### Source Block

```hcl
source "amazon-ebs" "nginx" {
  ami_name      = "nginx-web-server-{{timestamp}}"
  instance_type = "t3.micro"
  region        = var.region
  source_ami    = data.amazon-ami.ubuntu.id
  ssh_username  = "ubuntu"
}
```

The source defines reusable builder configuration:
- `ami_name`: Name for the resulting AMI (timestamp ensures uniqueness)
- `instance_type`: Type of instance to use for building
- `source_ami`: Base AMI to start from
- `ssh_username`: How Packer connects to the instance

### Build Block

```hcl
build {
  sources = ["source.amazon-ebs.nginx"]
  # provisioners...
}
```

The build ties everything together. It references sources and defines provisioners.

### Provisioners

Provisioners run in order:

1. **Update system**:
```hcl
provisioner "shell" {
  inline = [
    "sudo apt-get update",
    "sudo apt-get upgrade -y"
  ]
}
```

2. **Install software**:
```hcl
provisioner "shell" {
  inline = [
    "sudo apt-get install -y nginx",
    "sudo systemctl enable nginx"
  ]
}
```

3. **Copy files**:
```hcl
provisioner "file" {
  source      = "files/index.html"
  destination = "/tmp/index.html"
}
```

4. **Configure**:
```hcl
provisioner "shell" {
  inline = [
    "sudo mv /tmp/index.html /var/www/html/index.html"
  ]
}
```

## Creating Supporting Files

Create the custom index page:

```bash
mkdir -p files
```

`files/index.html`:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Packer-Built Server</title>
    <style>
        body { font-family: Arial; text-align: center; padding: 50px; }
        h1 { color: #333; }
    </style>
</head>
<body>
    <h1>Hello from Packer!</h1>
    <p>This server was built automatically using Packer</p>
</body>
</html>
```

## Building the Image

Initialize plugins:
```bash
packer init web-server.pkr.hcl
```

Validate the template:
```bash
packer validate web-server.pkr.hcl
```

Format the template:
```bash
packer fmt web-server.pkr.hcl
```

Build the image:
```bash
packer build web-server.pkr.hcl
```

Packer will:
1. Find the latest Ubuntu AMI
2. Launch a t3.micro instance
3. Wait for it to be ready
4. Run all provisioners
5. Stop the instance
6. Create an AMI
7. Tag the AMI
8. Terminate the temporary instance
9. Output the new AMI ID

## Build Output

You'll see output like:
```
amazon-ebs.nginx: output will be in this color.

==> amazon-ebs.nginx: Prevalidating any provided VPC information
==> amazon-ebs.nginx: Prevalidating AMI Name: nginx-web-server-1702334567
==> amazon-ebs.nginx: Found Image ID: ami-0c7217cdde317cfec
==> amazon-ebs.nginx: Creating temporary keypair: packer_657a2f87
==> amazon-ebs.nginx: Creating temporary security group for this instance: packer_657a2f88
==> amazon-ebs.nginx: Launching a source AWS instance...
==> amazon-ebs.nginx: Waiting for instance to become ready...
==> amazon-ebs.nginx: Using SSH communicator to connect: 3.80.45.123
==> amazon-ebs.nginx: Waiting for SSH to become available...
==> amazon-ebs.nginx: Connected to SSH!
==> amazon-ebs.nginx: Provisioning with shell script: /tmp/packer-shell123456789
==> amazon-ebs.nginx: Stopping the source instance...
==> amazon-ebs.nginx: Waiting for the instance to stop...
==> amazon-ebs.nginx: Creating AMI nginx-web-server-1702334567 from instance i-0abc123def456
==> amazon-ebs.nginx: Waiting for AMI to become ready...
==> amazon-ebs.nginx: Terminating the source AWS instance...
==> amazon-ebs.nginx: Deleting temporary security group...
==> amazon-ebs.nginx: Deleting temporary keypair...
Build 'amazon-ebs.nginx' finished after 8 minutes 32 seconds.

==> Wait completed after 8 minutes 32 seconds

==> Builds finished. The artifacts of successful builds are:
--> amazon-ebs.nginx: AMIs were created:
us-east-1: ami-0abcdef123456789
```

The AMI ID at the end is your new image.

## Testing the Image

Launch an instance from your new AMI:
```bash
aws ec2 run-instances \
  --image-id ami-0abcdef123456789 \
  --instance-type t3.micro \
  --key-name your-key-pair \
  --security-groups your-security-group
```

Once running, visit the instance's public IP. You should see your custom "Hello from Packer!" page immediately - no configuration needed.

## Common Issues

**Build times out waiting for SSH**: Security groups must allow SSH (port 22) from Packer's IP.

**AMI name already exists**: AMI names must be unique. The `{{timestamp}}` template function helps ensure this.

**Provisioner fails**: Check provisioner output carefully. Shell provisioners fail if any command exits with non-zero status.

**Permission denied**: AWS credentials need proper IAM permissions for EC2 and AMI operations.

## What's Next

You've built your first AMI! The next chapter explores different builders and how to create images for multiple platforms from the same template.
