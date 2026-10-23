---
title: How to Install Packer on Linux, macOS and Windows
description: 'Install HashiCorp Packer 1.16 on Ubuntu, RHEL, macOS or Windows, check it with packer version, add plugins with packer init, and set up cloud credentials.'
order: 2
---

**TLDR**: On Ubuntu or Debian, add HashiCorp's apt repository and run `sudo apt install packer`. On macOS, run `brew install hashicorp/tap/packer` (the formula in Homebrew's main repository is gone). On Windows, run `winget install --id Hashicorp.Packer -e`. Or download the zip from releases.hashicorp.com, check its SHA-256 sum and put the `packer` binary on your `PATH`. Check the install with `packer version`, then run `packer init` in each project to install the plugins it needs.

Packer is a single binary with no runtime dependencies. This part installs it on your platform, explains how plugins are installed and where they live, sets up credentials for the cloud builders, and runs a first build on your own machine with no cloud account.

## Prerequisites

- A Linux, macOS or Windows machine where you can install software (`sudo` or an administrator PowerShell).
- A terminal. [Part 1](/guides/introduction-to-packer/01-packer-fundamentals) explains the concepts used here.

## Which Version to Install

Install the current release, **Packer 1.16.2** (October 2026). HashiCorp ships a minor release every few months and patch releases in between; there is no long-term support line, so stay on a recent version. Two version floors matter:

- **1.10.0 or newer**: plugins are no longer bundled, so templates need a `required_plugins` block and `packer init`.
- **1.14.0 or newer**: official HashiCorp plugins (Amazon, Azure, Docker, Google Cloud, Ansible, QEMU, VirtualBox, Vagrant) are downloaded from releases.hashicorp.com. Older versions do not install new plugin releases automatically.

## Install Packer

Pick your platform. Every option installs the same `packer` binary.

```tabs
{
  "title": "Install Packer 1.16",
  "tabs": [
    {
      "label": "Ubuntu / Debian",
      "lang": "bash",
      "code": "# Add HashiCorp's signing key and apt repository\nwget -O - https://apt.releases.hashicorp.com/gpg | \\\n  sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg\n\necho \"deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(grep -oP '(?<=UBUNTU_CODENAME=).*' /etc/os-release || lsb_release -cs) main\" | \\\n  sudo tee /etc/apt/sources.list.d/hashicorp.list\n\nsudo apt update && sudo apt install packer"
    },
    {
      "label": "RHEL / Rocky / Alma",
      "lang": "bash",
      "code": "sudo yum install -y yum-utils\nsudo yum-config-manager --add-repo https://rpm.releases.hashicorp.com/RHEL/hashicorp.repo\nsudo yum -y install packer\n\n# Amazon Linux uses its own repository file:\n# sudo yum-config-manager --add-repo https://rpm.releases.hashicorp.com/AmazonLinux/hashicorp.repo"
    },
    {
      "label": "Fedora",
      "lang": "bash",
      "code": "wget -O- https://rpm.releases.hashicorp.com/fedora/hashicorp.repo | \\\n  sudo tee /etc/yum.repos.d/hashicorp.repo\nsudo dnf -y install packer"
    },
    {
      "label": "macOS",
      "lang": "bash",
      "code": "# Homebrew's main repository no longer has Packer; use HashiCorp's tap\nbrew tap hashicorp/tap\nbrew install hashicorp/tap/packer\n\n# Upgrade later with\nbrew upgrade hashicorp/tap/packer"
    },
    {
      "label": "Windows",
      "lang": "powershell",
      "code": "# Option 1: winget\nwinget install --id Hashicorp.Packer -e\n\n# Option 2: Chocolatey (community package, can lag behind the release)\nchoco install packer\n\n# Option 3: download packer_1.16.2_windows_amd64.zip from\n# https://releases.hashicorp.com/packer/1.16.2/ and see the manual steps below"
    }
  ]
}
```

### Notes per Platform

**Ubuntu and Debian.** The commands store HashiCorp's key in its own keyring file and reference it with `signed-by`, so the key is trusted for this repository only. Older tutorials use `apt-key add` and `apt-add-repository`. `apt-key` is deprecated and newer Debian and Ubuntu releases no longer ship it, so use the commands above. The same repository also provides `terraform`, `vault` and the other HashiCorp tools.

**RHEL, Rocky Linux, AlmaLinux and Fedora.** These systems can have a different program called `packer` from the cracklib password library: `/usr/sbin/packer`, a link to `cracklib-packer`, which builds password dictionaries. HashiCorp's package installs to `/usr/bin/packer`. If `packer version` prints an error or nothing useful, run `which -a packer` and call `/usr/bin/packer` directly, or put `/usr/bin` before `/usr/sbin` in your `PATH`.

**macOS.** After the license change, Homebrew's main repository kept Packer at 1.9.4, disabled the formula in 2024 and removed it in 2025. Install from HashiCorp's tap with the full `hashicorp/tap/packer` name, which always has the current release.

**Windows.** `winget` and Chocolatey add Packer to your `PATH`. Open a new terminal afterwards so the change takes effect. For a manual install, extract `packer.exe` to a folder such as `C:\Tools\packer` and add that folder to your user `PATH`:

```powershell
# Extract the zip you downloaded
Expand-Archive .\packer_1.16.2_windows_amd64.zip -DestinationPath C:\Tools\packer

# Append the folder to your user PATH (not the machine PATH)
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", "$userPath;C:\Tools\packer", "User")

# Open a NEW PowerShell window, then check
packer version
```

## Manual Install on Linux With Checksum Verification

The release page has a zip file per platform and a `SHA256SUMS` file. Check the sum before you run a binary you downloaded. This run is on an arm64 Linux machine; on most x86 servers, use `linux_amd64` instead:

```terminal
{
  "title": "download, verify and install Packer",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "PACKER_VERSION=1.16.2; ARCH=arm64\ncurl -fsSLO \"https://releases.hashicorp.com/packer/${PACKER_VERSION}/packer_${PACKER_VERSION}_linux_${ARCH}.zip\"\ncurl -fsSLO \"https://releases.hashicorp.com/packer/${PACKER_VERSION}/packer_${PACKER_VERSION}_SHA256SUMS\""
    },
    {
      "cmd": "grep \"linux_arm64\" packer_1.16.2_SHA256SUMS | sha256sum -c -",
      "output": "packer_1.16.2_linux_arm64.zip: OK"
    },
    {
      "cmd": "unzip -q packer_1.16.2_linux_arm64.zip && ls",
      "output": "LICENSE.txt\npacker\npacker_1.16.2_linux_arm64.zip\npacker_1.16.2_SHA256SUMS"
    },
    {
      "comment": "install for your user only; use sudo install ... /usr/local/bin/ for all users",
      "cmd": "install -D -m 0755 packer ~/.local/bin/packer"
    },
    {
      "cmd": "~/.local/bin/packer version",
      "output": "Packer v1.16.2"
    }
  ]
}
```

`sha256sum -c` must print `OK`. For a stronger check, also verify the `SHA256SUMS.sig` signature with HashiCorp's PGP key, as described on the [HashiCorp security page](https://www.hashicorp.com/en/trust/security). If `~/.local/bin` is not on your `PATH` yet, add `export PATH="$HOME/.local/bin:$PATH"` to your `~/.bashrc` or `~/.zshrc`.

## Verify the Installation

Whichever method you used, check the version and the list of commands:

```terminal
{
  "title": "check the install",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer version",
      "output": "Packer v1.16.2"
    },
    {
      "cmd": "packer --help",
      "output": "Usage: packer [--version] [--help] <command> [<args>]\n\nAvailable commands are:\n    build                 build image(s) from template\n    console               creates a console for testing variable interpolation\n    fix                   fixes templates from old versions of packer\n    fmt                   Rewrites HCL2 config files to canonical format\n    hcl2_upgrade          transform a JSON template into an HCL2 configuration\n    init                  Install missing plugins or upgrade plugins\n    inspect               see components of a template\n    plugins               Interact with Packer plugins and catalog\n    validate              check that a template is valid\n    verify-attestation    verify a signed attestation against policy\n    version               Prints the Packer version"
    }
  ]
}
```

When a newer release exists, `packer version` adds a line that says your version is out of date. Packer learns that from HashiCorp's checkpoint service; set `CHECKPOINT_DISABLE=1` to turn the check off, for example on build servers without internet access.

To get tab completion for commands and flags in Bash or Zsh, run `packer -autocomplete-install` once and open a new shell.

## Install Plugins With `packer init`

Since Packer 1.10, plugins are not bundled. Each template lists the plugins it needs in a `required_plugins` block inside the `packer` block:

```hcl
packer {
  required_version = ">= 1.14.0"
  required_plugins {
    docker = {
      version = "~> 1.1"
      source  = "github.com/hashicorp/docker"
    }
  }
}

source "docker" "ubuntu" {
  image  = "ubuntu:24.04"
  commit = true
}

build {
  sources = ["source.docker.ubuntu"]

  provisioner "shell" {
    inline = [
      "apt-get update",
      "apt-get install -y --no-install-recommends curl ca-certificates",
      "rm -rf /var/lib/apt/lists/*",
    ]
  }

  post-processor "docker-tag" {
    repository = "my-ubuntu"
    tags       = ["latest"]
  }
}
```

`source` is where the plugin comes from and `version` is a constraint. `~> 1.1` means "1.1 or newer, but below 2.0", so you get fixes and features without a breaking major upgrade. Use `= 1.1.4` to pin an exact version.

Until you run `packer init`, other commands refuse to work:

```terminal
{
  "title": "before and after packer init",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer validate .",
      "output": "Error: Missing plugins\n\nThe following plugins are required, but not installed:\n\n* github.com/hashicorp/docker ~> 1.1\n\nDid you run packer init for this project ?"
    },
    {
      "cmd": "packer init .",
      "output": "Installed plugin github.com/hashicorp/docker v1.1.4 in \"/home/dev/.config/packer/plugins/github.com/hashicorp/docker/packer-plugin-docker_v1.1.4_x5.0_linux_arm64\""
    },
    {
      "cmd": "packer validate .",
      "output": "The configuration is valid."
    },
    {
      "cmd": "packer plugins installed",
      "output": "/home/dev/.config/packer/plugins/github.com/hashicorp/amazon/packer-plugin-amazon_v1.8.3_x5.0_linux_arm64\n/home/dev/.config/packer/plugins/github.com/hashicorp/ansible/packer-plugin-ansible_v1.1.6_x5.0_linux_arm64\n/home/dev/.config/packer/plugins/github.com/hashicorp/azure/packer-plugin-azure_v2.6.4_x5.0_linux_arm64\n/home/dev/.config/packer/plugins/github.com/digitalocean/digitalocean/packer-plugin-digitalocean_v1.4.2_x5.0_linux_arm64\n/home/dev/.config/packer/plugins/github.com/hashicorp/docker/packer-plugin-docker_v1.1.4_x5.0_linux_arm64\n/home/dev/.config/packer/plugins/github.com/hashicorp/googlecompute/packer-plugin-googlecompute_v1.2.8_x5.0_linux_arm64\n/home/dev/.config/packer/plugins/github.com/hashicorp/virtualbox/packer-plugin-virtualbox_v1.1.5_x5.0_linux_arm64"
    }
  ]
}
```

Plugins go to `$HOME/.config/packer/plugins` on Linux and macOS and to `%APPDATA%\packer.d\plugins` on Windows, in a folder per source address, next to a `SHA256SUM` file that Packer checks before it loads the binary. Set `PACKER_PLUGIN_PATH` to use another directory, for example a cache directory in CI.

Other plugin commands you will use:

```bash
packer init -upgrade .                                    # update to the newest version the constraint allows
packer plugins required .                                 # show what the template needs
packer plugins install github.com/hashicorp/amazon v1.8.3 # install one plugin without a template
packer plugins remove github.com/hashicorp/docker         # remove a plugin
```

:::tip
HashiCorp's own plugins download from releases.hashicorp.com. Plugins from other publishers download from GitHub releases, and the anonymous GitHub API limit is low on shared CI runners. Set `PACKER_GITHUB_API_TOKEN` to a GitHub token to raise it. Without internet access, download the plugin binary yourself and install it with `packer plugins install --path ./packer-plugin-name github.com/<org>/<name>`.
:::

## Run Your First Build

You can see a complete build without a cloud account or Docker. The built-in `null` builder creates no machine and no image; with `communicator = "none"` it only runs the steps you give it. The `shell-local` provisioner runs commands on your own machine, so this build is safe to run anywhere. The examples use a Unix shell; on Windows, `shell-local` runs commands with `cmd.exe`, so run them in WSL or replace `uname -sm` with `ver`:

```hcl
source "null" "hello" {
  communicator = "none"
}

build {
  sources = ["source.null.hello"]

  provisioner "shell-local" {
    inline = [
      "echo Hello from Packer",
      "uname -sm",
    ]
  }

  post-processor "manifest" {
    output = "manifest.json"
  }
}
```

```terminal
{
  "title": "a first build with the null builder",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer build .",
      "output": "null.hello: output will be in this color.\n\n==> null.hello: Running local shell script: /tmp/packer-shell2937998298\n==> null.hello: Hello from Packer\n==> null.hello: Linux aarch64\n==> null.hello: Running post-processor:  (type manifest)\nBuild 'null.hello' finished after 43 milliseconds 54 microseconds.\n\n==> Wait completed after 43 milliseconds 473 microseconds\n\n==> Builds finished. The artifacts of successful builds are:\n--> null.hello: Did not export anything. This is the null builder\n--> null.hello: Did not export anything. This is the null builder"
    },
    {
      "cmd": "cat manifest.json",
      "output": "{\n  \"builds\": [\n    {\n      \"name\": \"hello\",\n      \"builder_type\": \"null\",\n      \"build_time\": 1792771473,\n      \"files\": null,\n      \"artifact_id\": \"Null\",\n      \"packer_run_uuid\": \"9da50b06-9ce1-9b5c-de61-42bd315124c4\",\n      \"custom_data\": null\n    }\n  ],\n  \"last_run_uuid\": \"9da50b06-9ce1-9b5c-de61-42bd315124c4\"\n}"
    }
  ]
}
```

The output has the same shape as every Packer build:

- Lines that start with `==> null.hello:` come from the build named `null.hello` (builder type and source name). With several sources, each build gets its own color and prefix, and you can tell parallel builds apart.
- `Build 'null.hello' finished` ends each build, and the artifact list at the bottom says what was produced. The `null` builder produces nothing, so it says so. The line appears twice because the `manifest` post-processor passes the builder's artifact on unchanged, and Packer lists both the original and the post-processor's result. A cloud build lists the image IDs here.
- The `manifest` post-processor wrote `manifest.json` with the build name, builder type, time and artifact ID. CI pipelines read the image ID from this file ([Part 6](/guides/introduction-to-packer/06-variables-and-best-practices)). Packer adds an entry on every run instead of replacing the file, so scripts read the last one (`.builds[-1]`).

## Format and Validate Templates

Run two commands before every build and in CI. `packer fmt` rewrites `.pkr.hcl` and `.pkrvars.hcl` files in the canonical style (the same style as `terraform fmt`). With `-check`, it changes nothing and exits with a non-zero code if a file needs formatting:

```terminal
{
  "title": "packer fmt",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer fmt -check .; echo \"exit code: $?\"",
      "output": "messy.pkr.hcl\nexit code: 3"
    },
    {
      "cmd": "packer fmt -diff .",
      "output": "messy.pkr.hcl\n--- old/messy.pkr.hcl\n+++ new/messy.pkr.hcl\n@@ -1,7 +1,7 @@\n source \"null\" \"x\" {\n-communicator=\"none\"\n-  }\n+  communicator = \"none\"\n+}\n\n build {\n-    sources=[\"source.null.x\"]\n+  sources = [\"source.null.x\"]\n }"
    },
    {
      "cmd": "packer fmt -check . && echo \"formatted\"",
      "output": "formatted"
    }
  ]
}
```

`-diff` prints the changes and also writes them to the file, which is why the last check passes. Add `-write=false` if you only want to see the diff.

`packer validate` checks the syntax, the variables and each builder's and provisioner's settings. It catches typos before Packer creates any cloud resources:

```terminal
{
  "title": "a typo caught by packer validate",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer validate .",
      "output": "Error: Unsupported argument\n\n  on typo.pkr.hcl line 11:\n  (source code not available)\n\nAn argument named \"imgae\" is not expected here. Did you mean \"image\"?"
    }
  ]
}
```

`packer validate` does not run data sources by default, so the examples in this guide validate without cloud credentials. Functions that fetch secrets, such as `vault()` in a local, still need access to their service ([Part 6](/guides/introduction-to-packer/06-variables-and-best-practices#h2-secrets-env-vault-and-aws-secrets-manager)). Add `-evaluate-datasources` if you want it to run the lookups too (they call the cloud API). Use `-syntax-only` to check only the HCL syntax.

## Set Up Cloud Credentials

Cloud builders call the provider's API with your credentials. Never write keys into a template: anything in a template ends up in Git.

### AWS

The Amazon plugin uses the standard AWS credential chain, in this order: settings in the template, environment variables, the shared credentials and config files (`~/.aws/credentials`, `~/.aws/config`), and finally the IAM role of the EC2 instance, ECS task or CI runner that Packer runs on.

```bash
# IAM Identity Center (SSO) profile: short-lived credentials, the best option on a laptop
aws configure sso --profile packer
aws sso login --profile packer
export AWS_PROFILE=packer

# Or plain environment variables (avoid long-lived keys where you can)
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_DEFAULT_REGION="us-east-1"
```

In CI, use OpenID Connect so the pipeline gets temporary credentials instead of stored keys ([Part 6](/guides/introduction-to-packer/06-variables-and-best-practices#h2-cicd-integration)). The identity that runs Packer needs these permissions, the minimal set from the Amazon plugin documentation:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:AttachVolume",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:CopyImage",
        "ec2:CreateImage",
        "ec2:CreateKeyPair",
        "ec2:CreateSecurityGroup",
        "ec2:CreateSnapshot",
        "ec2:CreateTags",
        "ec2:CreateVolume",
        "ec2:DeleteKeyPair",
        "ec2:DeleteSecurityGroup",
        "ec2:DeleteSnapshot",
        "ec2:DeleteVolume",
        "ec2:DeregisterImage",
        "ec2:DescribeImageAttribute",
        "ec2:DescribeImages",
        "ec2:DescribeInstances",
        "ec2:DescribeInstanceStatus",
        "ec2:DescribeRegions",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeSnapshots",
        "ec2:DescribeSubnets",
        "ec2:DescribeTags",
        "ec2:DescribeVolumes",
        "ec2:DetachVolume",
        "ec2:GetPasswordData",
        "ec2:ModifyImageAttribute",
        "ec2:ModifyInstanceAttribute",
        "ec2:ModifySnapshotAttribute",
        "ec2:RegisterImage",
        "ec2:RunInstances",
        "ec2:StopInstances",
        "ec2:TerminateInstances"
      ],
      "Resource": "*"
    }
  ]
}
```

Some optional settings need more permissions:

- spot instances: `ec2:CreateLaunchTemplate`, `ec2:DeleteLaunchTemplate` and `ec2:CreateFleet`;
- an instance profile for the build instance (`iam_instance_profile`): `iam:GetInstanceProfile` on the profile and `iam:PassRole` on its role;
- `vpc_filter`, a `vpc_id` without a `subnet_id`, or `associate_public_ip_address` without a `subnet_id`: `ec2:DescribeVpcs`.

### Google Cloud

On your workstation, log in once with Application Default Credentials; the plugin picks them up without any setting in the template:

```bash
gcloud auth application-default login
```

On a Compute Engine VM or in GKE, attach a service account and Packer uses it automatically. Elsewhere (for example in CI without workload identity federation), point `credentials_file` at a service account key, or set `GOOGLE_APPLICATION_CREDENTIALS`. The account needs the **Compute Instance Admin (v1)** and **Service Account User** roles.

### Azure

The simplest option on a workstation is the Azure CLI login:

```bash
az login
```

```hcl
source "azure-arm" "ubuntu" {
  use_azure_cli_auth = true
  subscription_id    = var.subscription_id
  # ...
}
```

For automation, use a service principal (`client_id`, `client_secret`, `tenant_id`, `subscription_id`), OpenID Connect from GitHub Actions, or a managed identity when Packer runs on an Azure VM. The Azure plugin does not read the `ARM_*` environment variables on its own. To use them, read them in variable defaults with the `env()` function, as shown in [Part 4](/guides/introduction-to-packer/04-builders-and-platforms#h2-azure-arm-builder).

### DigitalOcean

Create an API token in the control panel and export it. The plugin reads `DIGITALOCEAN_TOKEN` or `DIGITALOCEAN_ACCESS_TOKEN`; the older `DIGITALOCEAN_API_TOKEN` still works but is planned for deprecation.

```bash
export DIGITALOCEAN_TOKEN="dop_v1_..."
```

## Set Up Local Builders

### Docker

The `docker` builder runs the `docker` command line, so you need Docker on the machine that runs Packer: Docker Engine on Linux (install it from Docker's apt or dnf repository, as in the [Docker install docs](https://docs.docker.com/engine/install/)) or Docker Desktop on macOS and Windows. On Linux, add yourself to the `docker` group (`sudo usermod -aG docker $USER`, then log out and back in) or run Packer with `sudo`.

Check with `docker version` before you build. Without Docker, the build fails at the first step:

```terminal
{
  "title": "a Docker build on a machine without Docker",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer build .",
      "output": "docker.ubuntu: output will be in this color.\n\nBuild 'docker.ubuntu' errored after 1 millisecond 851 microseconds: exec: \"docker\": executable file not found in $PATH\n\n==> Wait completed after 2 milliseconds 34 microseconds\n\n==> Some builds didn't complete successfully and had errors:\n--> docker.ubuntu: exec: \"docker\": executable file not found in $PATH\n\n==> Builds finished but no artifacts were created."
    }
  ]
}
```

On a machine with Docker, the same command pulls `ubuntu:24.04`, runs the provisioner in a container, commits it and tags the result `my-ubuntu:latest`. [Part 4](/guides/introduction-to-packer/04-builders-and-platforms#h2-docker-builder) shows a fuller Docker example, with the output of a build that tags and pushes an Nginx image.

### VirtualBox, QEMU and VMware

The ISO builders (`virtualbox-iso`, `qemu`, `vmware-iso`) drive a hypervisor on your machine, so install the hypervisor first and make sure its command line tools (`VBoxManage`, `qemu-system-x86_64`, `vmrun`) are on your `PATH`. On Apple silicon Macs, VirtualBox and VMware Fusion run only ARM64 guests. QEMU can emulate an x86 machine there, but emulated builds are very slow, so build x86 images on an x86 host or in the cloud.

## Set Up a Project

A few habits from day one save trouble later:

- **Keep templates in Git**, one directory per image, and run Packer on the directory (`packer build .`).
- **Pin versions**: `required_version` for Packer and a `~>` constraint for each plugin.
- **Ignore build output and secrets** in `.gitignore`:

```text
# Build output
manifest.json
output-*/
packer_cache/
crash.log

# Variable files that hold secrets (commit only non-secret ones such as dev.pkrvars.hcl)
secrets.pkrvars.hcl
*.auto.pkrvars.hcl

# Keys and credentials
*.pem
*.key
```

- **Wrap the common commands** in a Makefile or script so everybody runs them the same way:

```makefile
.PHONY: init fmt validate build

init:
	packer init .

fmt:
	packer fmt -recursive .

validate: init
	packer fmt -check -recursive .
	packer validate .

build: validate
	packer build .
```

Do not put `-force` in the default build target. On AWS, `-force` deregisters an existing AMI with the same name before it builds the new one.

## Troubleshooting the Installation

**`packer: command not found`**: the directory with the binary is not on your `PATH`. Run `echo $PATH` (or `$env:Path` in PowerShell), fix it, and open a new terminal.

**`packer` runs, but prints a usage text about dictionaries**: on RHEL-family systems you are running cracklib's `packer`. Use `/usr/bin/packer` or fix the `PATH` order (see the [notes per platform](#h3-notes-per-platform)).

**`Error: Missing plugins`**: run `packer init .` in the template directory.

**Plugin downloads fail**: check proxy settings (`HTTPS_PROXY`), firewall rules for releases.hashicorp.com and github.com, and the GitHub API limit (`PACKER_GITHUB_API_TOKEN`).

**Anything else**: run the command with `PACKER_LOG=1` to see debug logs, and `PACKER_LOG_PATH=packer.log` to write them to a file.

## Summary

- Install Packer from HashiCorp's apt or yum repository, the `hashicorp/tap` Homebrew tap, winget, or the release zip, and check the SHA-256 sum of manual downloads.
- Declare plugins in `required_plugins`, pin them with `~>`, and run `packer init` in every project.
- Use short-lived cloud credentials from the provider's standard chain, never keys in templates.
- Run `packer fmt -check` and `packer validate` before every build.

In [Part 3](/guides/introduction-to-packer/03-writing-your-first-template), you write a complete template and build a web server AMI on AWS.

## Keep Learning

- [Introduction to AWS: IAM and security](/guides/introduction-to-aws/02-iam-security), for the IAM users, roles and policies Packer needs
- [Interview question: cloud IAM basics](/interview-questions/junior/cloud-iam-basics)
- [Introduction to Docker](/guides/introduction-to-docker), if you plan to use the Docker builder
