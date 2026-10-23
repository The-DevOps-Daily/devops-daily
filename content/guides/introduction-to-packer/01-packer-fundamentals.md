---
title: 'What Is Packer? Core Concepts and Workflow'
description: 'What HashiCorp Packer is and how it builds images: sources, builders, provisioners, post-processors, plugins and data sources, and what packer build does.'
order: 1
---

**TLDR**: Packer builds machine images from a template. A `source` block configures a **builder** (for example `amazon-ebs` or `docker`), **provisioners** install and configure software on a temporary machine, and **post-processors** handle the finished image. Since Packer 1.10, builders and most provisioners live in **plugins** that `packer init` installs. Packer builds images; it does not deploy them or manage running servers.

Before you write templates, you need a clear picture of what Packer does with them. This part explains the workflow Packer automates, the parts of a template, what happens during `packer build`, and where Packer fits next to Docker, Terraform and Ansible.

## Prerequisites

- Basic knowledge of virtual machines or cloud instances (what an instance and a disk image are).
- No installation yet. [Part 2](/guides/introduction-to-packer/02-installation-and-setup) installs Packer.

## The Image Building Workflow

When you build an image by hand, you usually:

1. Launch an instance from a base image, for example Ubuntu 24.04.
2. Connect to it over SSH and install software.
3. Copy configuration files and enable services.
4. Remove temporary files, logs and shell history.
5. Shut it down and create an image from its disk.
6. Launch a new instance from the image to test it.

Packer automates steps 1 to 5. The template says what to build, the **builder** starts a temporary machine, **provisioners** customize it, the builder saves the image, and **post-processors** handle the result. At the end, Packer deletes the temporary machine and every other temporary resource it created, such as a key pair or a security group.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Base image", "sub": "Ubuntu 24.04 AMI", "icon": "cloud", "tone": "slate" },
    { "label": "Temporary machine", "sub": "started by the builder", "icon": "server", "tone": "blue" },
    { "label": "Provisioners", "sub": "shell, file, ansible", "icon": "gear", "tone": "violet" },
    { "label": "New image", "sub": "AMI, snapshot, Docker image", "icon": "box", "tone": "green" },
    { "label": "Post-processors", "sub": "manifest, tag, push", "icon": "check", "tone": "amber" }
  ]
}
```

The main gain is repeatability. The same template runs the same steps every time, on every engineer's laptop and in CI. The images are identical only when the inputs are pinned, though: if a provisioner runs `apt-get upgrade`, two builds a week apart install different package versions. That is usually what you want for security updates, and it is why you name and tag every image with its build time ([Part 6](/guides/introduction-to-packer/06-variables-and-best-practices)).

## Core Components

### Plugins

Packer itself is a small core that reads templates and runs builds. Since **Packer 1.10.0**, almost everything that talks to a platform is a separate **plugin**: you declare the plugins a template needs in a `required_plugins` block, and `packer init` downloads them ([Part 2](/guides/introduction-to-packer/02-installation-and-setup)).

A few components are built into the core and need no plugin:

- **Builders**: `null` (runs provisioners against an existing machine, or with no machine at all, and creates no image) and `file` (turns a file into an artifact, mostly to test post-processors).
- **Provisioners**: `shell`, `shell-local`, `file`, `powershell`, `windows-shell`, `windows-restart`, `breakpoint` and `sleep`.
- **Post-processors**: `manifest`, `checksum`, `compress`, `artifice`, `shell-local` and `provenance`.
- **Data sources**: `http`, `null` and the HCP Packer data sources.

The plugins you will meet most often:

| Plugin source                                                  | Builders                                                                                    | Also provides                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `github.com/hashicorp/amazon`                                  | `amazon-ebs`, `amazon-ebssurrogate`, `amazon-ebsvolume`, `amazon-instance`, `amazon-chroot` | data sources `amazon-ami`, `amazon-secretsmanager`, `amazon-parameterstore` |
| `github.com/hashicorp/azure`                                   | `azure-arm`, `azure-chroot`, `azure-dtl`                                                    | data source `azure-keyvaultsecret`                                          |
| `github.com/hashicorp/googlecompute`                           | `googlecompute`                                                                             | `googlecompute-export` and `googlecompute-import` post-processors           |
| `github.com/hashicorp/docker`                                  | `docker`                                                                                    | `docker-tag`, `docker-push`, `docker-save`, `docker-import` post-processors |
| `github.com/hashicorp/ansible`                                 | none                                                                                        | `ansible` and `ansible-local` provisioners                                  |
| `github.com/hashicorp/qemu`, `github.com/hashicorp/virtualbox` | `qemu`, `virtualbox-iso`, `virtualbox-ovf`, `virtualbox-vm`                                 | local virtual machines                                                      |
| `github.com/vmware/vmware`, `github.com/vmware/vsphere`        | `vmware-iso`, `vmware-vmx`, `vsphere-iso`, `vsphere-clone`                                  | maintained by VMware (Broadcom)                                             |
| `github.com/digitalocean/digitalocean`                         | `digitalocean`                                                                              | maintained by DigitalOcean                                                  |

The source address tells you who maintains a plugin. HashiCorp maintains the `hashicorp/` plugins; vendors and the community maintain others, such as `vmware/vsphere`, `digitalocean/digitalocean` and `hetznercloud/hcloud`.

### Builders and Sources

A **builder** knows how to create images on one platform. It knows how to:

- authenticate with the platform API;
- launch a temporary machine from a base image;
- connect to that machine with a **communicator** (SSH for Linux, WinRM for Windows, `docker exec` for containers);
- stop the machine and save its disk as an image;
- delete the temporary resources, even when the build fails.

In an HCL2 template you configure a builder in a **`source`** block. The first label is the builder type, the second is a name you choose:

```hcl
source "amazon-ebs" "web" {
  region        = "us-east-1"
  instance_type = "t3.micro"
  # ...
}
```

A `build` block then refers to it as `source.amazon-ebs.web`. One `build` block can list several sources (for example AWS and Azure), and Packer builds them in parallel with the same provisioners. That is how one template produces images for several platforms ([Part 4](/guides/introduction-to-packer/04-builders-and-platforms)).

### Provisioners

**Provisioners** run on the temporary machine, in the order you write them, after it boots. The common ones:

```hcl
# Run commands or scripts over SSH
provisioner "shell" {
  inline = [
    "sudo apt-get update",
    "sudo apt-get install -y nginx",
  ]
}

# Upload a file from your machine
provisioner "file" {
  source      = "files/nginx.conf"
  destination = "/tmp/nginx.conf"
}

# Run an Ansible playbook against the machine
provisioner "ansible" {
  playbook_file = "./playbook.yml"
}
```

If a provisioner fails, the build stops and Packer cleans up. [Part 5](/guides/introduction-to-packer/05-provisioners-in-depth) covers provisioners in detail, including retries and error handling.

### Post-Processors

**Post-processors** run after the builder has created the image. They can write a manifest with the image IDs, tag and push a Docker image, compress a disk image, or create checksums:

```hcl
post-processor "manifest" {
  output     = "manifest.json"
  strip_path = true
}
```

Each `post-processor` block receives the builder's artifact on its own. To pass the output of one post-processor to the next (for example, tag a Docker image and then push the tagged image), put them in a `post-processors` block, which runs them as a chain:

```hcl
post-processors {
  post-processor "docker-tag" {
    repository = "registry.example.com/web"
    tags       = ["1.4.0"]
  }
  post-processor "docker-push" {}
}
```

### Data Sources

**Data sources** fetch information before any build starts. The most common one looks up the newest official base image, so you never hard-code an image ID that goes stale:

```hcl
data "amazon-ami" "ubuntu" {
  filters = {
    name                = "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"
    root-device-type    = "ebs"
    virtualization-type = "hvm"
  }
  most_recent = true
  owners      = ["099720109477"] # Canonical
}
```

Other data sources read secrets (`amazon-secretsmanager`, `azure-keyvaultsecret`) or call an HTTP endpoint (`http`).

## HCL2 Template Structure

Templates use HCL2, the same configuration language as Terraform, in files that end in `.pkr.hcl`. When you pass a directory to Packer (`packer build .`), it reads every `.pkr.hcl` file in it as one configuration, so you can split variables, sources and builds into separate files. Here is a complete template with every block type:

```hcl
# Packer settings: required Packer version and plugins
packer {
  required_version = ">= 1.14.0"
  required_plugins {
    amazon = {
      version = "~> 1.8"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

# Input variable: can be set on the command line or in a var file
variable "region" {
  type    = string
  default = "us-east-1"
}

# Local value: computed once per run
locals {
  timestamp = formatdate("YYYYMMDDhhmmss", timestamp())
}

# Data source: look up the newest official Ubuntu 24.04 AMI
data "amazon-ami" "ubuntu" {
  filters = {
    name                = "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"
    root-device-type    = "ebs"
    virtualization-type = "hvm"
  }
  most_recent = true
  owners      = ["099720109477"]
  region      = var.region
}

# Source: builder settings for the temporary EC2 instance and the AMI
source "amazon-ebs" "web" {
  ami_name      = "web-${local.timestamp}"
  instance_type = "t3.micro"
  region        = var.region
  source_ami    = data.amazon-ami.ubuntu.id
  ssh_username  = "ubuntu"
}

# Build: which sources to build and what to run on them
build {
  sources = ["source.amazon-ebs.web"]

  provisioner "shell" {
    inline = [
      "sudo apt-get update",
      "sudo apt-get install -y nginx",
    ]
  }

  post-processor "manifest" {
    output = "manifest.json"
  }
}
```

`packer inspect` lists what a template defines without building anything:

```terminal
{
  "title": "packer inspect",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer inspect .",
      "output": "Packer Inspect: HCL2 mode\n\n> input-variables:\n\nvar.region: \"us-east-1\"\n\n> local-variables:\n\nlocal.timestamp: \"20261023153407\"\n\n> builds:\n\n  > <unnamed build 0>:\n\n    sources:\n\n      amazon-ebs.web\n\n    provisioners:\n\n      shell\n\n    post-processors:\n\n      0:\n        manifest"
    }
  ]
}
```

This template:

1. requires Packer 1.14 or newer and version 1.x of the Amazon plugin (1.8 or later);
2. looks up the newest Ubuntu 24.04 AMI published by Canonical's AWS account;
3. starts a `t3.micro` instance from it in `us-east-1`;
4. installs Nginx over SSH;
5. creates an AMI called `web-` plus a timestamp;
6. writes the AMI ID to `manifest.json`.

You will build a fuller version of it in [Part 3](/guides/introduction-to-packer/03-writing-your-first-template).

| Block                 | Purpose                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `packer`              | Required Packer version and plugins                                                                                    |
| `variable`            | Inputs you can set per run                                                                                             |
| `locals`              | Values computed from variables and functions                                                                           |
| `data`                | Lookups that run before the build                                                                                      |
| `source`              | Builder configuration: where and how to start the temporary machine                                                    |
| `build`               | Which sources to build, plus `provisioner`, `post-processor`, `post-processors` and `error-cleanup-provisioner` blocks |
| `hcp_packer_registry` | Optional: send build metadata to HCP Packer                                                                            |

:::note
You will still see `{{timestamp}}` and other double-brace expressions in older templates. They come from the legacy JSON template engine. In HCL2, use functions such as `timestamp()` and `formatdate()` in a `locals` block, as above. A few builder fields, such as `boot_command`, still use double-brace variables like `{{ .HTTPIP }}` that the builder fills in at run time.
:::

## What Happens During `packer build`

When you run `packer build .`, Packer:

1. **Reads** every `.pkr.hcl` file in the directory and the variable values you passed.
2. **Evaluates** locals and data sources (for example, finds the newest Ubuntu AMI).
3. **Starts** one build per source, in parallel by default.
4. **Prepares** the platform: checks that the image name is free, creates a temporary key pair and security group.
5. **Launches** the temporary machine and **waits** until the communicator (SSH or WinRM) can connect.
6. **Runs** the provisioners in the order they appear.
7. **Stops** the machine and **creates** the image from its disk.
8. **Deletes** the temporary machine, key pair and security group.
9. **Runs** the post-processors on the finished image.
10. **Prints** the artifacts, such as `us-east-1: ami-...`.

If any step fails, Packer runs the cleanup by default, so a failed build does not leave instances running. For debugging, `packer build -on-error=ask` lets you choose whether to clean up, and `-on-error=abort` leaves everything running so you can SSH in and look around. Resources left behind by `abort` keep costing money until you delete them.

The Docker and cloud builders need a Docker daemon or a cloud account. To see a real build end to end without either, [Part 2](/guides/introduction-to-packer/02-installation-and-setup#h2-run-your-first-build) runs one with the built-in `null` builder.

## Packer Compared With Docker, Terraform and Ansible

| Tool                        | Produces                        | Runs                        | Use it for                                                        |
| --------------------------- | ------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| Packer                      | Machine images (and containers) | When you build an image     | Golden images for VMs and cloud instances                         |
| Dockerfile (`docker build`) | Container images, in layers     | When you build an image     | Application containers                                            |
| Terraform or OpenTofu       | Infrastructure                  | When you deploy             | Launching instances, networks and load balancers from your images |
| Ansible, Chef, Puppet       | Configured servers              | At any time, also in Packer | Configuring servers, or provisioning inside a Packer build        |

### Packer vs Docker

Packer can build Docker images, but it does not replace a Dockerfile. A Dockerfile build caches each instruction as a layer, so rebuilds only redo what changed. The Packer `docker` builder starts a container, runs your provisioners in it and commits the result as one new layer, with no layer cache.

Use the Packer `docker` builder when you want the same provisioning scripts or Ansible roles for a VM image and a container image, or to test provisioning locally before a slow cloud build. The builder can even start from a Dockerfile: a `build` block inside the `docker` source runs `docker build` first and provisions the result. For ordinary application containers, a Dockerfile is the better tool.

### Packer vs Terraform

They do different jobs and work well together. Packer builds the image once; Terraform (or OpenTofu) launches instances, autoscaling groups and load balancers from it, and finds the newest image with a data source. A new application release then means: build an image with Packer, change the image ID in Terraform, apply.

### Packer vs Configuration Management

Ansible, Chef and Puppet configure servers that already run, and can keep doing it. Packer runs once per image. They are not either-or: Packer can run an Ansible playbook as a provisioner, so you reuse your roles to bake images. Many teams bake everything that is the same on every instance into the image and inject the rest (environment, endpoints, secrets) at boot with cloud-init or a secrets manager.

## When to Use Packer

Packer is a good fit when:

- **instances must start fast**, for example in autoscaling groups, where a baked image serves traffic seconds after boot;
- **you run on several platforms** and want one definition for AWS, Azure, Google Cloud or on-premises VMs;
- **you want immutable servers** that you replace instead of patch;
- **builds are heavy**: compiling software, installing large SDKs or drivers that you do not want to repeat on every boot;
- **auditors ask what is on a server**: the template in Git and the image tags answer that.

Packer is less useful when everything you run is containers on Kubernetes or a managed container service (you build container images with Dockerfiles, and the nodes come from the provider), or when your servers are long-lived pets that a configuration management tool already keeps in shape.

## Common Mistakes

- **Hard-coding a base image ID.** It goes stale and differs per region. Use a data source with a name filter and the vendor's owner ID.
- **Expecting identical images from an unpinned build.** `apt-get upgrade` today and next week install different versions. Pin what must not change, and name images with the build time.
- **Baking secrets into the image.** Anything on the disk is in every instance and every copy of the image. Inject secrets at boot.
- **Never deleting old images.** Each AMI keeps its EBS snapshots, and you pay for them. Plan retention from the start.
- **One huge image for everything.** A common pattern is a hardened base image built weekly, plus thin application images built on top of it.

## Summary

- Packer turns a template into machine images by running a temporary machine, provisioning it and saving its disk.
- A `source` block configures a builder; a `build` block lists sources and the provisioners and post-processors to run.
- Builders, most provisioners and data sources come from plugins that `packer init` installs.
- Packer builds images; Terraform deploys them and configuration management tools configure running servers.

In [Part 2](/guides/introduction-to-packer/02-installation-and-setup), you install Packer and its plugins, set up credentials and run your first build.

## Keep Learning

- [Infrastructure as Code: A Beginner's Guide to IaC Fundamentals](/posts/infrastructure-as-code-fundamentals)
- [Interview question: immutable infrastructure](/interview-questions/mid/immutable-infrastructure)
- [Interview question: infrastructure as code patterns](/interview-questions/mid/infrastructure-as-code-patterns)
- [Introduction to Docker](/guides/introduction-to-docker), if you build containers with Dockerfiles
