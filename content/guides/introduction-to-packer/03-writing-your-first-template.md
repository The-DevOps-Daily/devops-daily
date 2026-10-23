---
title: Writing Your First Packer Template
description: 'Write a Packer HCL2 template that builds an Nginx web server AMI on Ubuntu 24.04, then validate it, build it, test the image and clean up after yourself.'
order: 3
---

**TLDR**: A template has a `packer` block (versions and plugins), variables and locals, a data source that finds the base image, a `source` block that configures the builder, and a `build` block with provisioners and post-processors. Run `packer init`, `packer fmt`, `packer validate` and `packer build` on the directory. Test the new AMI by launching an instance, and delete old AMIs and their snapshots when you no longer need them.

In this part you build something real: an Amazon Machine Image (AMI) with Nginx installed and a custom page, ready to serve traffic the moment an instance boots. Along the way you learn what each block of a template does and which settings matter in production.

## Prerequisites

- Packer 1.14 or newer ([Part 2](/guides/introduction-to-packer/02-installation-and-setup)).
- AWS credentials with the permissions listed in [Part 2](/guides/introduction-to-packer/02-installation-and-setup#h3-aws), and the AWS CLI to test the image.
- A region with a default VPC (every account has one per region unless someone deleted it). Without one, set `subnet_id` as described in [Common Issues](#h2-common-issues).
- About 10 minutes and a few cents of EC2 and EBS usage.

## The Goal

The AMI is based on **Ubuntu 24.04 LTS** and has:

- all package updates applied at build time;
- Nginx installed and enabled at boot;
- a custom `index.html` page;
- **IMDSv2** as the default for new instances, so they accept only token-based metadata requests unless their launch settings say otherwise;
- tags that record the base image and the tool that built it.

Ubuntu 24.04 is supported until 2029. Ubuntu 26.04 LTS is also available; to build on it, change the name filter in the data source.

## Project Layout

Create a directory for the project:

```text
nginx-ami/
├── web-server.pkr.hcl   # the template
└── files/
    └── index.html       # uploaded into the image
```

## The Template

Create `web-server.pkr.hcl`:

```hcl
packer {
  required_version = ">= 1.14.0"
  required_plugins {
    amazon = {
      version = "~> 1.8"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

locals {
  # UTC build time, for example 20261023143012
  timestamp = formatdate("YYYYMMDDhhmmss", timestamp())
}

# Find the newest official Ubuntu 24.04 AMI in the region
data "amazon-ami" "ubuntu" {
  filters = {
    name                = "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"
    root-device-type    = "ebs"
    virtualization-type = "hvm"
  }
  most_recent = true
  owners      = ["099720109477"] # Canonical
  region      = var.region
}

source "amazon-ebs" "nginx" {
  region          = var.region
  instance_type   = var.instance_type
  source_ami      = data.amazon-ami.ubuntu.id
  ssh_username    = "ubuntu"
  ami_name        = "nginx-web-${local.timestamp}"
  ami_description = "Nginx web server on Ubuntu 24.04"

  # Allow SSH to the build instance only from the machine that runs Packer
  temporary_security_group_source_public_ip = true

  # Remove Packer's temporary public key from authorized_keys before the AMI is created
  ssh_clear_authorized_keys = true

  # Require IMDSv2 on the build instance and on instances from the new AMI
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }
  imds_support = "v2.0"

  tags = {
    Name          = "nginx-web"
    OS_Version    = "Ubuntu 24.04"
    Base_AMI_Name = "{{ .SourceAMIName }}"
    Builder       = "packer"
  }
}

build {
  sources = ["source.amazon-ebs.nginx"]

  # 1. Wait until cloud-init has finished configuring the instance
  provisioner "shell" {
    inline           = ["cloud-init status --wait"]
    valid_exit_codes = [0, 2]
  }

  # 2. Apply updates and install Nginx without interactive prompts
  provisioner "shell" {
    inline = [
      "sudo apt-get update",
      "sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y",
      "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx",
      "sudo systemctl enable nginx",
    ]
  }

  # 3. Upload the page to a directory the ubuntu user can write to
  provisioner "file" {
    source      = "files/index.html"
    destination = "/tmp/index.html"
  }

  # 4. Move it into place as root
  provisioner "shell" {
    inline = [
      "sudo install -m 0644 -o root -g root /tmp/index.html /var/www/html/index.html",
      "rm -f /tmp/index.html",
    ]
  }

  # 5. Remove package caches to keep the image small
  provisioner "shell" {
    inline = [
      "sudo apt-get clean",
      "sudo rm -rf /var/lib/apt/lists/*",
    ]
  }

  # Write the AMI ID to manifest.json
  post-processor "manifest" {
    output     = "manifest.json"
    strip_path = true
  }
}
```

And the page, `files/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Built with Packer</title>
  </head>
  <body>
    <h1>Hello from Packer</h1>
    <p>This server was built from an image. Nothing was installed at boot.</p>
  </body>
</html>
```

## Understanding Each Section

### The `packer` Block

`required_version` stops older Packer releases from running the template, and `required_plugins` says which plugins `packer init` installs. `~> 1.8` accepts any 1.x release from 1.8 on, so you get fixes without a surprise 2.0.

### Variables and Locals

`region` and `instance_type` are **input variables** with defaults. Override them for one run without editing the file:

```bash
packer build -var "region=eu-west-1" -var "instance_type=t3.small" .
```

`local.timestamp` is a **local value**: computed once per run from the `timestamp()` function (the current UTC time) and formatted with `formatdate()`. It makes every AMI name unique, which AWS requires per account and region. [Part 6](/guides/introduction-to-packer/06-variables-and-best-practices) covers variables in depth.

### The Data Source

`data "amazon-ami" "ubuntu"` runs before the build and returns the newest AMI that matches the filters. Two settings make it safe:

- **`owners = ["099720109477"]`** is Canonical's AWS account. Anybody can publish an AMI called `ubuntu/images/...`; only the owner ID guarantees that you get the official image.
- **`most_recent = true`** picks the newest match, so each build starts from the latest Ubuntu image with its security updates. The name pattern contains `hvm-ssd-gp3`, the naming Canonical uses for Ubuntu 24.04 images, whose root volume is gp3.

The result is available as `data.amazon-ami.ubuntu.id`. Because the lookup runs per region, the same template works in every region without a list of AMI IDs.

### The Source Block

`source "amazon-ebs" "nginx"` configures the `amazon-ebs` builder, which launches an EC2 instance backed by EBS and turns its root volume into an AMI.

- **`region`, `instance_type`, `source_ami`**: where and on what to build. The build instance only has to be big enough to run the provisioners quickly; instances you launch later from the AMI can use any compatible type.
- **`ssh_username`**: the default user of the base image. Ubuntu images use `ubuntu`, Amazon Linux uses `ec2-user`, Debian uses `admin`.
- **`ami_name`**: must be unique, hence the timestamp. `ami_description` shows in the console.
- **`temporary_security_group_source_public_ip = true`**: Packer creates a temporary security group for SSH. By default it allows port 22 from `0.0.0.0/0`, the whole internet, for the few minutes of the build. This setting looks up the public IP of the machine that runs Packer and allows only that address.
- **`ssh_clear_authorized_keys = true`**: Packer connects with a temporary key pair and deletes it after the build, but by default the public key stays in `~/.ssh/authorized_keys` inside the image. This setting removes it before the AMI is created.
- **`metadata_options`** applies to the build instance and requires IMDSv2 tokens. **`imds_support = "v2.0"`** marks the AMI so that instances launched from it require IMDSv2 by default. Launch templates and account-level settings can still override that default, so enforce `HttpTokens=required` there too if your security policy demands it.
- **`tags`** go on the AMI and its snapshot. `{{ .SourceAMIName }}` is one of the few double-brace variables that still work in HCL2 templates: the builder fills in the name of the base AMI at build time, so you can always trace an image back to its base.

### The Build Block

The `build` block lists the sources and runs the provisioners **in order**, each over SSH:

1. **`cloud-init status --wait`** blocks until cloud-init has finished. Without it, your `apt-get` can collide with cloud-init's own package run and fail with `Could not get lock /var/lib/dpkg/lock-frontend`. The command exits with code 2 when cloud-init finished with recoverable errors, which is common on cloud images and harmless here, so `valid_exit_codes` accepts 0 and 2.
2. **Updates and Nginx.** `DEBIAN_FRONTEND=noninteractive` stops `apt-get` from waiting for an answer to a configuration prompt, which would hang the build until it times out.
3. **The `file` provisioner** uploads as the SSH user (`ubuntu`), who cannot write to `/var/www/html`. Upload to `/tmp` first.
4. **`install`** copies the file to its final place with the right owner and mode in one command.
5. **Cleanup** removes the package cache so it does not take up space in every instance.

Shell provisioners run their inline commands with `/bin/sh -e`, so the first failing command stops the build. [Part 5](/guides/introduction-to-packer/05-provisioners-in-depth) shows what that looks like and how to handle it.

### The Post-Processor

The `manifest` post-processor writes the build results to `manifest.json`. `strip_path = true` keeps only file names in the file list. Scripts and CI jobs read the AMI ID from this file instead of parsing the build log.

## Initialize, Format and Validate

Run these three commands in the project directory:

```terminal
{
  "title": "prepare the template",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer init .",
      "output": "Installed plugin github.com/hashicorp/amazon v1.8.3 in \"/home/dev/.config/packer/plugins/github.com/hashicorp/amazon/packer-plugin-amazon_v1.8.3_x5.0_linux_arm64\""
    },
    {
      "cmd": "packer fmt -check ."
    },
    {
      "cmd": "packer validate .",
      "output": "The configuration is valid."
    }
  ]
}
```

`packer init` installed the Amazon plugin, `packer fmt -check` printed nothing because the file is already formatted, and `packer validate` checked every setting against the plugin. None of them needed AWS credentials.

## Build the Image

Now run the build. It creates real resources in your AWS account:

```bash
packer build .
```

Packer prints each step as it happens. The output below is an **example** that follows the Amazon plugin's real messages; IDs, addresses and times are placeholders, and the long `apt-get` output is cut:

```text
amazon-ebs.nginx: output will be in this color.

==> amazon-ebs.nginx: Prevalidating any provided VPC information
==> amazon-ebs.nginx: Prevalidating AMI Name: nginx-web-20261023143012
    amazon-ebs.nginx: Found Image ID: ami-0123456789abcdef0
==> amazon-ebs.nginx: Creating temporary keypair: packer_6718f0a2-5c1e-4b0f-9d1e-3a2b4c5d6e7f
==> amazon-ebs.nginx: Creating temporary security group for this instance: packer_6718f0a5-8e2d-4c3b-a1f0-7b6c5d4e3f2a
==> amazon-ebs.nginx: Checking current host's public IP...
==> amazon-ebs.nginx: Current host's public IP: 203.0.113.25
==> amazon-ebs.nginx: Authorizing access to port 22 from [203.0.113.25/32] in the temporary security groups...
==> amazon-ebs.nginx: Launching a source AWS instance...
    amazon-ebs.nginx: Instance ID: i-0abc123def4567890
==> amazon-ebs.nginx: Waiting for instance (i-0abc123def4567890) to become ready...
==> amazon-ebs.nginx: Using SSH communicator to connect: 198.51.100.17
==> amazon-ebs.nginx: Waiting for SSH to become available...
==> amazon-ebs.nginx: Connected to SSH!
==> amazon-ebs.nginx: Provisioning with shell script: /tmp/packer-shell1938475610
    amazon-ebs.nginx: status: done
==> amazon-ebs.nginx: Provisioning with shell script: /tmp/packer-shell2847561930
    amazon-ebs.nginx: Hit:1 http://us-east-1.ec2.archive.ubuntu.com/ubuntu noble InRelease
    ... (apt-get output cut) ...
==> amazon-ebs.nginx: Uploading files/index.html => /tmp/index.html
==> amazon-ebs.nginx: Provisioning with shell script: /tmp/packer-shell3756194028
==> amazon-ebs.nginx: Provisioning with shell script: /tmp/packer-shell4659382017
==> amazon-ebs.nginx: Trying to remove ephemeral keys from authorized_keys files
==> amazon-ebs.nginx: Stopping the source instance...
    amazon-ebs.nginx: Stopping instance
==> amazon-ebs.nginx: Waiting for the instance to stop...
==> amazon-ebs.nginx: Creating AMI nginx-web-20261023143012 from instance i-0abc123def4567890
    amazon-ebs.nginx: AMI: ami-0fedcba9876543210
==> amazon-ebs.nginx: Waiting for AMI to become ready...
==> amazon-ebs.nginx: Skipping Enable AMI deprecation...
==> amazon-ebs.nginx: Skipping Enable AMI deregistration protection...
==> amazon-ebs.nginx: Adding tags to AMI (ami-0fedcba9876543210)...
==> amazon-ebs.nginx: Tagging snapshot: snap-0123abcd4567ef890
==> amazon-ebs.nginx: Creating AMI tags
    amazon-ebs.nginx: Adding tag: "Name": "nginx-web"
    amazon-ebs.nginx: Adding tag: "OS_Version": "Ubuntu 24.04"
    amazon-ebs.nginx: Adding tag: "Base_AMI_Name": "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-20261008"
    amazon-ebs.nginx: Adding tag: "Builder": "packer"
==> amazon-ebs.nginx: Creating snapshot tags
==> amazon-ebs.nginx: Terminating the source AWS instance...
==> amazon-ebs.nginx: Cleaning up any extra volumes...
==> amazon-ebs.nginx: No volumes to clean up, skipping
==> amazon-ebs.nginx: Deleting temporary security group...
==> amazon-ebs.nginx: Deleting temporary keypair...
==> amazon-ebs.nginx: Running post-processor:  (type manifest)
Build 'amazon-ebs.nginx' finished after 6 minutes 41 seconds.

==> Wait completed after 6 minutes 41 seconds

==> Builds finished. The artifacts of successful builds are:
--> amazon-ebs.nginx: AMIs were created:
us-east-1: ami-0fedcba9876543210

--> amazon-ebs.nginx: AMIs were created:
us-east-1: ami-0fedcba9876543210
```

Read it from top to bottom and you can follow the workflow from [Part 1](/guides/introduction-to-packer/01-packer-fundamentals#h2-what-happens-during-packer-build): find the base image, create a temporary key pair and security group, launch, connect, provision, stop, create the AMI, tag it, then delete everything temporary. The artifact list at the end holds your new AMI ID. It appears twice because the `manifest` post-processor passes the AMI on and Packer lists both, as explained in [Part 2](/guides/introduction-to-packer/02-installation-and-setup#h2-run-your-first-build). The ID is also in `manifest.json`:

```bash
jq -r '.builds[-1].artifact_id' manifest.json   # us-east-1:ami-0fedcba9876543210
```

## Test the Image

Launch an instance from the new AMI in a security group that allows HTTP from your IP address, and check the page:

```bash
# The artifact ID has the form region:ami-id
ARTIFACT=$(jq -r '.builds[-1].artifact_id' manifest.json)
REGION=${ARTIFACT%%:*}
AMI_ID=${ARTIFACT#*:}

INSTANCE_ID=$(aws ec2 run-instances --region "$REGION" \
  --image-id "$AMI_ID" \
  --instance-type t3.micro \
  --security-group-ids sg-0123456789abcdef0 \
  --query 'Instances[0].InstanceId' --output text)

aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"

IP=$(aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

curl -s "http://$IP/" | grep '<h1>'
```

Nginx needs a few seconds after the instance reaches `running`; if `curl` fails, wait and try again. You should see `<h1>Hello from Packer</h1>` without having installed anything at boot. No key pair is needed for this test; add `--key-name` if you want to SSH in. Terminate the instance when you are done:

```bash
aws ec2 terminate-instances --region "$REGION" --instance-ids "$INSTANCE_ID"
```

## Clean Up Old Images

An AMI is a pointer to one or more **EBS snapshots**, and you pay for snapshot storage until you delete the snapshots. Deregistering an AMI does not delete its snapshots. To remove an image completely:

```bash
# Find the snapshot behind the AMI
SNAP_ID=$(aws ec2 describe-images --region "$REGION" --image-ids "$AMI_ID" \
  --query 'Images[0].BlockDeviceMappings[0].Ebs.SnapshotId' --output text)

aws ec2 deregister-image --region "$REGION" --image-id "$AMI_ID"
aws ec2 delete-snapshot --region "$REGION" --snapshot-id "$SNAP_ID"
```

In production, automate this: keep the last few images per application, and use Amazon Data Lifecycle Manager or a scheduled job to delete the rest. Packer can also mark images as deprecated from a given date with the `deprecate_at` setting. Deprecated AMIs no longer show up when other accounts search for images, which steers users to newer ones; you, as the owner, still see them.

## Common Issues

**The build hangs at `Waiting for SSH to become available...` and times out.** Packer cannot reach port 22. Usual causes: the subnet does not assign public IP addresses (set `subnet_id` to a public subnet, or add `associate_public_ip_address = true`, which needs the extra permission listed in [Part 2](/guides/introduction-to-packer/02-installation-and-setup#h3-aws)), there is no default VPC in the region (set `vpc_id` and `subnet_id`), or a firewall blocks outbound SSH from your network. In private networks, set `ssh_interface = "private_ip"` when Packer runs inside the VPC, or `ssh_interface = "session_manager"` to connect through AWS Systems Manager without opening port 22 at all (this needs an instance profile with SSM permissions). The default `ssh_timeout` is 5 minutes.

**`AMI Name: 'nginx-web-...' is used by an existing AMI`**: AMI names are unique per account and region. Keep the timestamp in the name. `packer build -force` deregisters the old AMI first; use it in development only.

**`Could not get lock /var/lib/dpkg/lock-frontend`**: another apt process is running, usually cloud-init or unattended upgrades on first boot. Keep the `cloud-init status --wait` step first.

**The build hangs during `apt-get`**: a package asked a question. Set `DEBIAN_FRONTEND=noninteractive` for every `apt-get install` and `upgrade`.

**`UnauthorizedOperation` or `AccessDenied`**: the credentials lack a permission from the [policy in Part 2](/guides/introduction-to-packer/02-installation-and-setup#h3-aws). Packer prints the API call that failed.

**A provisioner fails**: the first command that exits non-zero stops the build and Packer cleans up. Read the output just above the error. To keep the instance for debugging, run `packer build -on-error=ask .` and choose to abort, then SSH in with the key Packer saves when you run in `-debug` mode.

## Try the Workflow Without AWS

If you do not have an AWS account at hand, practice the workflow with the local examples instead. The [first build in Part 2](/guides/introduction-to-packer/02-installation-and-setup#h2-run-your-first-build) and the provisioner runs in [Part 5](/guides/introduction-to-packer/05-provisioners-in-depth) use the built-in `null` builder with `shell-local`, which runs commands on your own machine, so those examples only print text. Do not convert this template to `shell-local`: it would run the package upgrade and the Nginx install on your computer.

## Summary

- A template combines a `packer` block, variables and locals, a data source for the base image, a `source` block for the builder and a `build` block with provisioners and post-processors.
- Look up base images by name pattern and owner ID, and give every AMI a unique, time-based name.
- Wait for cloud-init, install non-interactively, upload files to `/tmp` and move them with `sudo`.
- Restrict the temporary SSH rule, require IMDSv2, and read the AMI ID from `manifest.json`.
- Test each image before you use it, and delete old AMIs together with their snapshots.

In [Part 4](/guides/introduction-to-packer/04-builders-and-platforms), you configure builders for other platforms and build one image for several clouds from one template.

## Keep Learning

- [Introduction to AWS: EC2 servers](/guides/introduction-to-aws/03-ec2-servers), for instances, AMIs and security groups
- [AWS ASG Launch Templates vs Launch Configurations](/posts/aws-asg-launch-templates-vs-configurations), to use your AMI in an autoscaling group
- [AWS Security Checklist](/checklists/aws-security)
- [AWS Cloud Services Quiz](/quizzes/aws-quiz)
