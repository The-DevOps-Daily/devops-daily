---
title: 'Packer Builders: AWS, Azure, Google Cloud, Docker and More'
description: 'Configure the Packer amazon-ebs, azure-arm, googlecompute, docker, digitalocean and virtualbox-iso builders, and build one image for several platforms.'
order: 4
---

**TLDR**: A builder is the plugin that creates images on one platform. `amazon-ebs` makes AMIs, `azure-arm` makes Azure images, `googlecompute` makes Compute Engine images, `docker` makes container images, and the ISO builders (`virtualbox-iso`, `qemu`, `vmware-iso`) install an operating system from scratch. List several sources in one `build` block to build the same image for several platforms in parallel, and use `only` and `-only` to target one of them.

Each builder hides the platform's details: how to authenticate, how to start a temporary machine, how to connect to it and how to save an image. The settings differ per builder, but the pattern is always the same `source` block. This part shows a working configuration for the common builders, the settings that matter for each, and how to combine them in one template.

## Prerequisites

- Packer 1.14 or newer and a first template ([Part 3](/guides/introduction-to-packer/03-writing-your-first-template)).
- An account on the platforms you want to build for, with the credentials from [Part 2](/guides/introduction-to-packer/02-installation-and-setup#h2-set-up-cloud-credentials).

Every configuration in this part passed `packer validate` with Packer 1.16.2 and the current plugin versions: Amazon 1.8.3, Azure 2.6.4, Google Compute 1.2.8, Docker 1.1.4, DigitalOcean 1.4.2 and VirtualBox 1.1.5. Validation does not create cloud resources, so it proves the settings are accepted, not that your account allows them.

## How the Builders Compare

| Builder                                | Plugin                                                    | Produces                                 | Connects with     |
| -------------------------------------- | --------------------------------------------------------- | ---------------------------------------- | ----------------- |
| `amazon-ebs`                           | `github.com/hashicorp/amazon`                             | EBS-backed AMI                           | SSH, WinRM or SSM |
| `azure-arm`                            | `github.com/hashicorp/azure`                              | Managed image or Compute Gallery version | SSH or WinRM      |
| `googlecompute`                        | `github.com/hashicorp/googlecompute`                      | Compute Engine image                     | SSH, WinRM or IAP |
| `digitalocean`                         | `github.com/digitalocean/digitalocean`                    | Droplet snapshot                         | SSH               |
| `docker`                               | `github.com/hashicorp/docker`                             | Docker image (one new layer)             | `docker exec`     |
| `virtualbox-iso`, `qemu`, `vmware-iso` | `hashicorp/virtualbox`, `hashicorp/qemu`, `vmware/vmware` | VM disk images (OVF, qcow2, VMX)         | SSH or WinRM      |

The cloud builders start from an existing image. The ISO builders boot an installer ISO in a local hypervisor and install the operating system first, which is slower and needs more configuration, but gives you full control over the base system.

## Amazon EBS Builder

`amazon-ebs` launches an EC2 instance from a source AMI, provisions it, and creates an AMI from its EBS volumes. It is the builder you will use most on AWS. [Part 3](/guides/introduction-to-packer/03-writing-your-first-template) used it with the basic settings. A production configuration usually adds a few more:

```hcl
source "amazon-ebs" "app" {
  region       = "us-east-1"
  ssh_username = "ubuntu"

  # Find the base image inside the source block instead of a data source
  source_ami_filter {
    filters = {
      name                = "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"
      root-device-type    = "ebs"
      virtualization-type = "hvm"
    }
    most_recent = true
    owners      = ["099720109477"]
  }

  # Build on a cheaper spot instance, from whichever type is available
  # (replaces instance_type; you cannot set both)
  spot_instance_types = ["t3.small", "t3a.small"]
  spot_price          = "auto"

  # 20 GB gp3 root volume instead of the base image's 8 GB
  launch_block_device_mappings {
    device_name           = "/dev/sda1"
    volume_size           = 20
    volume_type           = "gp3"
    delete_on_termination = true
  }

  ami_name     = "app-${local.timestamp}"
  encrypt_boot = true          # encrypt the AMI's snapshots (default key: aws/ebs)
  ami_regions  = ["eu-west-1"] # copy the finished AMI to another region
  imds_support = "v2.0"

  temporary_security_group_source_public_ip = true

  tags = {
    Name        = "app"
    Base_AMI_ID = "{{ .SourceAMI }}"
  }
  run_tags = {
    Name = "packer-build-app" # tag the temporary instance too
  }
}
```

What these settings do:

- **`source_ami_filter`** does the same as the `amazon-ami` data source from Part 3. The data source is more flexible (you can reuse its result in several sources and in locals); the filter is shorter for a single source.
- **`spot_instance_types` and `spot_price = "auto"`** request a spot instance of one of the listed types, usually much cheaper than on-demand. They replace `instance_type`; `packer validate` rejects a source that sets both. A build can fail if AWS reclaims the instance, so use spot for builds you can rerun without harm. Spot needs the extra IAM permissions listed in [Part 2](/guides/introduction-to-packer/02-installation-and-setup#h3-aws).
- **`launch_block_device_mappings`** changes the volumes of the build instance, and therefore of the AMI. Ubuntu images use `/dev/sda1` as the root device; Amazon Linux uses `/dev/xvda`.
- **`encrypt_boot = true`** encrypts the AMI's snapshots, with the AWS managed key unless you set `kms_key_id`. If you share encrypted AMIs with other accounts, use a customer managed KMS key and grant those accounts access to it.
- **`ami_regions`** copies the finished AMI to more regions, so you build once and launch everywhere. With a custom KMS key, set `region_kms_key_ids` for each region.
- **`run_tags`** tag the temporary instance, which helps you find and clean up instances left behind by an aborted build.

Other settings you will meet: `ami_users` and `ami_org_arns` share the AMI with other accounts or your whole AWS Organization, `iam_instance_profile` gives the build instance a role (for example to read from S3 during provisioning), `deprecate_at` marks old images as deprecated, and `vpc_filter` and `subnet_filter` pick the network by tag.

### Build Without Opening SSH

In a private subnet, or when security policy forbids inbound SSH, connect through AWS Systems Manager. Packer opens an SSM session and tunnels SSH through it, so the security group needs no inbound rule:

```hcl
source "amazon-ebs" "private" {
  # ...
  subnet_id            = "subnet-0123456789abcdef0" # private subnet with a route to SSM
  iam_instance_profile = "packer-ssm"               # role with AmazonSSMManagedInstanceCore
  ssh_interface        = "session_manager"
  ssh_username         = "ubuntu"
}
```

The machine that runs Packer needs the AWS CLI's Session Manager plugin, and the identity needs `ssm:StartSession` and `ssm:TerminateSession`.

### Other Amazon Builders

- **`amazon-ebssurrogate`** builds an AMI from a separate volume that you prepare from scratch, for custom root file systems.
- **`amazon-ebsvolume`** creates EBS volumes (for example data volumes) instead of an AMI.
- **`amazon-instance`** creates instance-store AMIs, a legacy format you rarely need.
- **`amazon-chroot`** runs on an existing EC2 instance and builds the image in a chroot on an attached volume, without launching a new instance. It is the fastest Amazon builder, but more complex to set up.

## Docker Builder

The `docker` builder starts a container from an image, runs provisioners inside it with `docker exec`, then commits the container as a new image. The machine that runs Packer needs Docker.

```hcl
packer {
  required_plugins {
    docker = {
      version = "~> 1.1"
      source  = "github.com/hashicorp/docker"
    }
  }
}

source "docker" "nginx" {
  image    = "ubuntu:24.04"
  platform = "linux/amd64"
  commit   = true

  # Image metadata that a Dockerfile would set with EXPOSE, ENTRYPOINT and CMD
  changes = [
    "EXPOSE 80",
    "ENTRYPOINT [\"nginx\"]",
    "CMD [\"-g\", \"daemon off;\"]",
  ]
}

build {
  sources = ["source.docker.nginx"]

  provisioner "shell" {
    inline = [
      "apt-get update",
      "DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nginx",
      "rm -rf /var/lib/apt/lists/*",
    ]
  }

  # Tag the image, then push the tagged image (a chain, so the push gets the tag)
  post-processors {
    post-processor "docker-tag" {
      repository = "123456789012.dkr.ecr.us-east-1.amazonaws.com/nginx"
      tags       = ["1.0.0"]
    }
    post-processor "docker-push" {
      ecr_login    = true
      login_server = "https://123456789012.dkr.ecr.us-east-1.amazonaws.com/"
    }
  }
}
```

Key settings:

- **`commit = true`** saves the container as an image in the local Docker daemon. The alternatives are `export_path` (write a tar file of the file system) and `discard = true` (throw it away, useful for testing provisioners).
- **`changes`** applies Dockerfile instructions such as `ENTRYPOINT`, `CMD`, `EXPOSE`, `ENV`, `USER` and `WORKDIR` to the committed image. When `changes` sets no `ENTRYPOINT` or no `CMD`, the plugin copies that value from the base image into the new image. Ubuntu's image has `CMD ["/bin/bash"]`, so if you set only an `ENTRYPOINT`, Docker would pass `/bin/bash` to it as an argument. Set both, as above: `ENTRYPOINT` for the program and `CMD` for its default arguments.
- **`platform`** picks the image architecture, which matters when you build on an Apple silicon Mac for x86 servers.
- **`post-processors`** runs `docker-tag` and then `docker-push` as a chain. With two separate `post-processor` blocks, `docker-push` would get the untagged image. The ECR repository (`nginx` here) must already exist, and the credentials need `ecr:GetAuthorizationToken` plus the push permissions on that repository (`ecr:BatchCheckLayerAvailability`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload` and `ecr:PutImage`). For Docker Hub or another registry, set `login = true` with `login_username` and `login_password` (from a sensitive variable) instead of `ecr_login`.

The shell provisioner runs as root inside the container, so the commands need no `sudo`, and `sudo` is not installed in most base images anyway.

On a machine with Docker, `packer build .` prints output like this **example**, which follows the Docker plugin's real messages with placeholder IDs and the package output cut:

```text
docker.nginx: output will be in this color.

==> docker.nginx: Creating a temporary directory for sharing data...
==> docker.nginx: Pulling Docker image: ubuntu:24.04
    docker.nginx: 24.04: Pulling from library/ubuntu
    docker.nginx: Status: Downloaded newer image for ubuntu:24.04
    docker.nginx: docker.io/library/ubuntu:24.04
==> docker.nginx: Starting docker container...
    docker.nginx: Run command: docker run --platform linux/amd64 -v /home/you/.config/packer/tmp2735418846:/packer-files -d -i -t --entrypoint=/bin/sh -- ubuntu:24.04
    docker.nginx: Container ID: 4c1f0e5d9b2a7c3e8f6d0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d
==> docker.nginx: Using docker communicator to connect: 172.17.0.2
==> docker.nginx: Provisioning with shell script: /tmp/packer-shell1234567890
    docker.nginx: Get:1 http://archive.ubuntu.com/ubuntu noble InRelease [256 kB]
    ... (apt-get output cut) ...
==> docker.nginx: Committing the container
    docker.nginx: Image ID: sha256:9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b
==> docker.nginx: Killing the container: 4c1f0e5d9b2a7c3e8f6d0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d
==> docker.nginx: Running post-processor:  (type docker-tag)
    docker.nginx (docker-tag): Tagging image: sha256:9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b
    docker.nginx (docker-tag): Repository: 123456789012.dkr.ecr.us-east-1.amazonaws.com/nginx:1.0.0
==> docker.nginx: Running post-processor:  (type docker-push)
    ... (push output cut) ...
Build 'docker.nginx' finished after 1 minute 12 seconds.
```

### Start From a Dockerfile

The Docker plugin can also run `docker build` first and provision the result. Put a `build` block with the Dockerfile path inside the source, instead of `image`:

```hcl
source "docker" "app" {
  build {
    path = "Dockerfile"
  }
  commit = true
}
```

This is handy when a team already has a Dockerfile for the base layers and wants to reuse Packer provisioners (or Ansible roles) for the rest. For plain application containers, a Dockerfile alone is still simpler and faster thanks to layer caching.

## Google Compute Builder

`googlecompute` creates a Compute Engine image from a temporary VM:

```hcl
source "googlecompute" "app" {
  project_id              = var.gcp_project
  zone                    = "us-central1-a"
  source_image_family     = "ubuntu-2404-lts-amd64"
  source_image_project_id = ["ubuntu-os-cloud"]
  machine_type            = "e2-medium"
  disk_size               = 20
  ssh_username            = "packer"

  image_name        = "app-${local.timestamp}"
  image_family      = "app"
  image_description = "App image built by Packer"
  image_labels = {
    built_by = "packer"
  }
}
```

- **`source_image_family`** picks the newest image in a family, the Google equivalent of the AMI lookup. Ubuntu families live in the public `ubuntu-os-cloud` project, so set `source_image_project_id`.
- **`ssh_username`** can be any name: the plugin adds a temporary SSH key for that user to the instance metadata.
- **`image_family`** groups your images. Instance templates that reference `family/app` always get your newest image, which makes rollouts and rollbacks a matter of creating or deprecating an image.
- Image names must be lowercase letters, digits and hyphens, so keep variable values in names lowercase.

Other useful settings: `preemptible = true` for a cheaper VM that Google may stop at any time, `network` and `subnetwork` for a specific VPC, `omit_external_ip` with `use_internal_ip` (or `use_iap`) for builds without a public IP, and `image_storage_locations` to keep images in a region.

## Azure ARM Builder

`azure-arm` builds a VM in Azure and captures it as a **managed image**, or publishes it as a version in an **Azure Compute Gallery** (formerly Shared Image Gallery). Use the gallery for anything beyond experiments: it versions images and replicates them to other regions.

```hcl
variable "subscription_id" {
  type    = string
  default = env("ARM_SUBSCRIPTION_ID")
}

variable "image_version" {
  type    = string
  default = "1.0.0" # set a new version per build, for example from CI
}

source "azure-arm" "app" {
  use_azure_cli_auth = true
  subscription_id    = var.subscription_id

  os_type         = "Linux"
  image_publisher = "Canonical"
  image_offer     = "ubuntu-24_04-lts"
  image_sku       = "server"
  location        = "eastus"
  vm_size         = "Standard_B2s"

  # Publish a new version to an existing Azure Compute Gallery image
  shared_image_gallery_destination {
    resource_group       = "rg-images"
    gallery_name         = "gal_images"
    image_name           = "app"
    image_version        = var.image_version
    replication_regions  = ["eastus", "westeurope"]
    storage_account_type = "Standard_LRS"
  }

  azure_tags = {
    built_by = "packer"
  }
}

build {
  sources = ["source.azure-arm.app"]

  # ... your provisioners ...

  # Last step: deprovision the Azure Linux agent so the image can be generalized
  provisioner "shell" {
    execute_command = "chmod +x {{ .Path }}; {{ .Vars }} sudo -E sh '{{ .Path }}'"
    inline          = ["/usr/sbin/waagent -force -deprovision+user && export HISTSIZE=0 && sync"]
    inline_shebang  = "/bin/sh -x"
  }
}
```

- **Authentication**: `use_azure_cli_auth = true` uses your `az login` session. In CI, use a service principal or OpenID Connect. The plugin does not read `ARM_*` variables on its own, which is why `subscription_id` reads `ARM_SUBSCRIPTION_ID` with the `env()` function in a variable default.
- **Base image**: Azure Marketplace images are named by publisher, offer and SKU. `Canonical:ubuntu-24_04-lts:server` is Ubuntu 24.04. List others with `az vm image list --publisher Canonical --all --output table`.
- **Destination**: for a managed image, set `managed_image_name` and `managed_image_resource_group_name` instead of the gallery block. Gallery image versions use `major.minor.patch` numbers and must be unique per gallery image, so pass a new `image_version` for every build, for example `1.4.${{ github.run_number }}` in GitHub Actions.
- **Deprovisioning**: Azure Linux images must end with `waagent -deprovision+user`, which removes the build user, SSH host keys and agent state so new VMs start clean. Windows images end with sysprep instead. Run this as the very last provisioner.

## DigitalOcean Builder

The `digitalocean` builder is maintained by DigitalOcean. It creates a Droplet, provisions it and saves a snapshot:

```hcl
packer {
  required_plugins {
    digitalocean = {
      version = "~> 1.4"
      source  = "github.com/digitalocean/digitalocean"
    }
  }
}

source "digitalocean" "app" {
  # api_token is read from DIGITALOCEAN_TOKEN when not set here
  image            = "ubuntu-24-04-x64"
  region           = "nyc3"
  size             = "s-1vcpu-1gb"
  ssh_username     = "root"
  snapshot_name    = "app-${formatdate("YYYYMMDDhhmmss", timestamp())}"
  snapshot_regions = ["nyc3", "ams3"]
  tags             = ["packer-build"]
}

build {
  sources = ["source.digitalocean.app"]
}
```

DigitalOcean images use `root` as the SSH user. `snapshot_regions` copies the snapshot to more regions, and `tags` mark the temporary Droplet so you can find it if a build is interrupted.

## VirtualBox ISO Builder

The ISO builders install an operating system from an installer ISO inside a local hypervisor. You need them for on-premises images, Vagrant boxes, or a base image you fully control. The hard part is the unattended install: Packer serves an answer file over HTTP and types a `boot_command` into the VM's console to start the installer with it.

```hcl
packer {
  required_plugins {
    virtualbox = {
      version = "~> 1.1"
      source  = "github.com/hashicorp/virtualbox"
    }
  }
}

source "virtualbox-iso" "ubuntu" {
  guest_os_type = "Ubuntu_64"
  iso_url       = "https://releases.ubuntu.com/24.04/ubuntu-24.04.5-live-server-amd64.iso"
  iso_checksum  = "file:https://releases.ubuntu.com/24.04/SHA256SUMS"

  cpus      = 2
  memory    = 4096
  disk_size = 20480
  headless  = true

  # Serve user-data and meta-data for Ubuntu's autoinstall
  http_directory = "http"
  boot_wait      = "5s"
  boot_command = [
    "c<wait>",
    "linux /casper/vmlinuz --- autoinstall ds=\"nocloud;s=http://{{ .HTTPIP }}:{{ .HTTPPort }}/\"<enter><wait>",
    "initrd /casper/initrd<enter><wait>",
    "boot<enter>",
  ]

  ssh_username     = "packer"
  ssh_password     = "packer"
  ssh_timeout      = "30m"
  shutdown_command = "echo 'packer' | sudo -S shutdown -P now"
}

build {
  sources = ["source.virtualbox-iso.ubuntu"]
}
```

- **`iso_checksum = "file:..."`** reads the checksum from Ubuntu's `SHA256SUMS` file, so you do not copy hashes by hand. Ubuntu only keeps the current point release under `releases.ubuntu.com/24.04/`, so update the file name when a new point release comes out.
- **`http_directory`** holds the autoinstall `user-data` (which creates the `packer` user, matching `ssh_username` and `ssh_password`) and an empty `meta-data` file.
- **`boot_command`** is typed into the GRUB console. `{{ .HTTPIP }}` and `{{ .HTTPPort }}` are filled in by the builder. The exact keystrokes depend on the installer version; when a build hangs at boot, watch the VM console with `headless = false`.
- **`ssh_timeout = "30m"`** gives the installer time to finish before Packer gives up on SSH.

This example installs the amd64 ISO, so it needs an x86 host: on Apple silicon Macs, VirtualBox runs only ARM64 guests. The `qemu` builder and the `vmware-iso` builder (from the `github.com/vmware/vmware` plugin, maintained by VMware) work the same way with their own hypervisor settings.

## Building for Several Platforms

List several sources in one `build` block. Packer builds them in parallel and runs the same provisioners on each:

```hcl
packer {
  required_plugins {
    amazon = {
      version = "~> 1.8"
      source  = "github.com/hashicorp/amazon"
    }
    googlecompute = {
      version = "~> 1.2"
      source  = "github.com/hashicorp/googlecompute"
    }
    docker = {
      version = "~> 1.1"
      source  = "github.com/hashicorp/docker"
    }
  }
}

variable "app_version" {
  type = string
}

locals {
  timestamp = formatdate("YYYYMMDDhhmmss", timestamp())
  name      = "app-${replace(var.app_version, ".", "-")}-${local.timestamp}"
}

source "amazon-ebs" "app" {
  region        = "us-east-1"
  instance_type = "t3.small"
  ssh_username  = "ubuntu"
  ami_name      = local.name
  source_ami_filter {
    filters = {
      name = "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"
    }
    most_recent = true
    owners      = ["099720109477"]
  }
}

source "googlecompute" "app" {
  project_id              = "my-project"
  zone                    = "us-central1-a"
  source_image_family     = "ubuntu-2404-lts-amd64"
  source_image_project_id = ["ubuntu-os-cloud"]
  ssh_username            = "packer"
  image_name              = local.name
}

# A local container with the same provisioning, for fast tests
source "docker" "test" {
  image   = "ubuntu:24.04"
  discard = true
}

build {
  sources = [
    "source.amazon-ebs.app",
    "source.googlecompute.app",
    "source.docker.test",
  ]

  # Shared steps for every platform
  provisioner "shell" {
    script = "scripts/install-app.sh"
  }

  # Platform-specific step
  provisioner "shell" {
    only   = ["amazon-ebs.app"]
    inline = ["echo aws | sudo tee /etc/image-platform"]
  }

  post-processor "manifest" {
    output = "manifest.json"
  }
}
```

`packer validate` checks all three builds at once, and `-only` (or `-except`) limits any command to some of them. Build names are `<builder type>.<source name>`, and glob patterns work:

```terminal
{
  "title": "validate and select builds",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer validate .",
      "output": "Error: Unset variable \"app_version\"\n\nA used variable must be set or have a default value; see\nhttps://packer.io/docs/templates/hcl_templates/syntax for details."
    },
    {
      "cmd": "packer validate -var app_version=1.4.0 .",
      "output": "The configuration is valid."
    },
    {
      "cmd": "packer validate -var app_version=1.4.0 -only='amazon-ebs.*' .",
      "output": "The configuration is valid."
    }
  ]
}
```

The first run fails because `app_version` has no default; [Part 6](/guides/introduction-to-packer/06-variables-and-best-practices#h2-providing-variable-values) covers the ways to set it. To build a subset:

```bash
packer build -var app_version=1.4.0 -only='docker.test' .                      # local test only
packer build -var app_version=1.4.0 -except='docker.test' .                    # all clouds
packer build -var app_version=1.4.0 -only='amazon-ebs.app,googlecompute.app' .  # two clouds
packer build -var app_version=1.4.0 -parallel-builds=1 .                       # one at a time
```

A few things to know about parallel builds:

- **Each build runs on its own**. If the Google build fails, the AWS build still finishes, and Packer lists which builds failed at the end.
- **`only` and `except` work on provisioners and post-processors too**, as in the `amazon-ebs.app` step above.
- **Base images differ per platform.** Ubuntu 24.04 on AWS and on Google Cloud are close but not identical (kernels, agents, default users), so keep platform-specific steps small and explicit.
- **`-parallel-builds=1`** runs builds one after the other, useful when a CI runner has little memory or a provider limits API calls.

## Communicators

The **communicator** is how Packer reaches the temporary machine to run provisioners:

- **`ssh`** (default for Linux): the builder creates a temporary key pair, or you set `ssh_username` with `ssh_password` or `ssh_private_key_file`. `ssh_timeout` (default `5m`) is how long Packer waits for SSH after boot. Use `ssh_bastion_host` to jump through a bastion.
- **`winrm`** (Windows): set `communicator = "winrm"`, `winrm_username`, and usually `winrm_use_ssl = true` with `winrm_insecure = true` for the self-signed certificate. On AWS, a `user_data_file` script must enable WinRM at boot, because Windows images do not listen for WinRM by default.
- **`none`**: no connection, as in the `null` builder examples of this guide.
- **`docker`**: set automatically by the `docker` builder.

A Windows build on AWS looks like this:

```hcl
source "amazon-ebs" "windows" {
  region        = "us-east-1"
  instance_type = "t3.medium"
  ami_name      = "windows-2025-${local.timestamp}"

  source_ami_filter {
    filters = {
      name = "Windows_Server-2025-English-Full-Base-*"
    }
    most_recent = true
    owners      = ["amazon"]
  }

  communicator   = "winrm"
  winrm_username = "Administrator"
  winrm_use_ssl  = true
  winrm_insecure = true
  winrm_timeout  = "15m"
  user_data_file = "scripts/bootstrap-winrm.ps1" # enables WinRM over HTTPS at first boot
}

build {
  sources = ["source.amazon-ebs.windows"]

  provisioner "powershell" {
    inline = ["Install-WindowsFeature -Name Web-Server -IncludeManagementTools"]
  }

  provisioner "windows-restart" {}
}
```

The Amazon plugin fetches the generated Administrator password for WinRM automatically. The `windows-restart` provisioner reboots the machine and waits for it to come back, which you need after installing features or updates. Finish Windows images with a sysprep step (on AWS, through EC2Launch v2) so every instance gets a unique identity.

## Best Practices

- **Start from official images**, selected by owner ID or publisher, and look them up at build time instead of pinning IDs.
- **Test provisioning locally first.** A `docker` source with `discard = true` next to the cloud sources runs the same scripts in seconds.
- **Keep secrets out of source blocks.** Use the provider's credential chain or variables marked `sensitive`.
- **Tag both the image and the temporary resources** (`tags` and `run_tags` on AWS, `azure_tags`, `image_labels`), so you can trace images and clean up leftovers.
- **Restrict network access to the build machine**: `temporary_security_group_source_public_ip`, private subnets with SSM, or IAP on Google Cloud.
- **Use `-force` only in development.** In production, a unique name per build avoids collisions without deleting anything.

## Summary

- Each builder is a plugin for one platform; the `source` block configures it, and the settings follow the same pattern everywhere.
- Look up base images by family or filter, set the network and access rules on purpose, and tag everything.
- Use Azure Compute Gallery and Google image families to version images; copy AMIs with `ami_regions`.
- One `build` block with several sources builds the same image for several platforms in parallel; `only`, `except` and `-only` select what runs where.

In [Part 5](/guides/introduction-to-packer/05-provisioners-in-depth), you go deeper into provisioners: scripts, files, Ansible, retries and image cleanup.

## Keep Learning

- [Introduction to AWS: EC2 servers](/guides/introduction-to-aws/03-ec2-servers)
- [Docker Security Hardening Checklist](/checklists/docker-security), for images you build with the Docker builder
- [Interview question: multi-cloud architecture](/interview-questions/senior/multi-cloud-architecture)
