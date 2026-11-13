---
title: 'Should .terraform.lock.hcl Be in .gitignore? Checksums and Versions'
excerpt: 'No: commit .terraform.lock.hcl. Learn what the lock file records, how version constraints work, how to fix checksum mismatch and "Invalid legacy provider address" errors, how to install a specific Terraform version, and which providers manage on-premises servers.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-01-23'
publishedAt: '2025-01-23T10:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: true
tags:
  - Terraform
  - Version Control
  - Git
  - Providers
  - Infrastructure as Code
  - Best Practices
---

Two things decide which code runs when you type `terraform apply`: the Terraform binary on your machine and the provider plugins that `terraform init` downloads. If those differ between your laptop, a colleague's laptop and CI, the same configuration can produce different plans. The `.terraform.lock.hcl` file and the `required_version` setting are how you keep them the same.

This post answers the questions around that: whether to commit the lock file, how version constraints work, what to do when `init` says a provider does not match the lock file's checksums, how to fix "Invalid legacy provider address", how to install a specific Terraform version, and whether Terraform can manage servers outside the cloud.

## TLDR

| Question                                         | Short answer                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Should `.terraform.lock.hcl` be in `.gitignore`? | No. Commit it in every root configuration. Ignore `.terraform/` instead                                |
| What does `~> 5.16` allow?                       | 5.16 and newer, below 6.0. `~> 5.16.0` allows only 5.16.x                                              |
| How do I update a provider?                      | `terraform init -upgrade`, review the lock file diff, commit it                                        |
| Checksum mismatch on `init`?                     | Usually missing hashes for another platform: `terraform providers lock -platform=...`                  |
| "Invalid legacy provider address"?               | `terraform state replace-provider registry.terraform.io/-/aws registry.terraform.io/hashicorp/aws`     |
| How do I run one exact Terraform version?        | Pin `required_version`, and install that version with a version manager or from releases.hashicorp.com |

## Prerequisites

- Terraform 1.x. The outputs in this post come from Terraform 1.15.8 on Linux arm64 with the `hashicorp/random` provider.
- A Git repository for your Terraform code.

## Should .terraform.lock.hcl Be in .gitignore?

No. Commit `.terraform.lock.hcl`. It records the exact provider versions that `terraform init` selected and their checksums, so every machine installs the same providers. Put the `.terraform/` folder in `.gitignore` instead: it holds the downloaded binaries, which are large and platform-specific.

Here is a lock file that `terraform init` wrote for a configuration that asks for `random` `~> 3.9`:

```hcl
# This file is maintained automatically by "terraform init".
# Manual edits may be lost in future updates.

provider "registry.terraform.io/hashicorp/random" {
  version     = "3.9.1"
  constraints = "~> 3.9"
  hashes = [
    "h1:nozfr4CZq73d4HjubKJundX/8A+Mj282oS/hyNfjUPU=",
    "zh:05f4734c1f0be840b711b3eff259ebc5fca436784c728955b1678078466f48d7",
    "zh:0b91bf19371d012434eba1deeb6aab77158def9b39601dcbd94450b3974a2a26",
    # ... one zh: hash per platform the provider is released for
  ]
}
```

- `version` is the version that was selected. Later runs of `terraform init` install this version again, even when a newer one matches the constraint.
- `constraints` is a copy of the constraint from your configuration.
- `zh:` hashes are SHA-256 sums of the release zip files, copied from the registry's signed checksum list, one for each platform.
- `h1:` hashes are hashes of the unpacked package. `init` records them only for the platform it ran on.

Without the committed lock file, each fresh checkout selects the newest version that matches the constraint on that day. Two runs of the same commit can then use different provider code, and a provider release can change a plan without any change in your repository.

A good `.gitignore` for a Terraform project:

```gitignore
.terraform/
*.tfstate
*.tfstate.*
*.tfplan
crash.log
crash.*.log
*_override.tf
.terraformrc
terraform.rc
*.secret.tfvars
```

`.terraform.lock.hcl` is not in the list on purpose. Per-environment `.tfvars` files without secrets usually belong in Git too, so reviewers can see them.

Lock files matter only in the root configuration where you run Terraform. The lock file belongs to the whole configuration, and Terraform reads only the one in the directory it runs in. In a reusable module repository you can commit one for the module's own tests, but it has no effect on the people who call the module.

### How Version Constraints and the Lock File Work Together

The constraint in `required_providers` says which versions are acceptable. The lock file says which one is in use.

| Constraint  | Allows                                      |
| ----------- | ------------------------------------------- |
| `= 5.16.2`  | exactly 5.16.2                              |
| `~> 5.16.0` | 5.16.0 and newer patch releases, below 5.17 |
| `~> 5.16`   | 5.16 and newer, below 6.0                   |
| `>= 5.16`   | 5.16 and every newer version, including 6.x |

The `~>` operator allows only the rightmost given part to grow. `~> 5.16` therefore allows 5.17 and 5.99, which surprises people who expect it to mean 5.16.x. Root configurations usually use `~> <major>.<minor>` for providers and let the lock file pin the exact version. Reusable modules use `>=` with the oldest version they work with, so they do not block the caller.

### Update Providers on Purpose

```bash
terraform init -upgrade            # pick the newest versions the constraints allow
git diff .terraform.lock.hcl       # see what changed
terraform plan                     # check that the new provider changes nothing unexpected
git commit -am "Update AWS provider to 6.12.0"
```

In CI, run `terraform init -lockfile=readonly`. Init then fails instead of changing the lock file, so a provider changes only through a reviewed pull request. Dependabot and Renovate can open those pull requests for you.

### Resolve Merge Conflicts in the Lock File

Do not delete the file and run `init` again. That selects the newest matching version of every provider, so a conflict fix can turn into an unreviewed upgrade. Instead:

1. Take one side of the conflict as a whole, usually the one from the main branch. During a rebase onto main, that is `git checkout --ours .terraform.lock.hcl` (in a rebase, "ours" is the branch you rebase onto). When you merge main into your branch, it is `git checkout --theirs .terraform.lock.hcl`.
2. Run `terraform init`. If the other branch needs a newer provider, run `terraform init -upgrade` and review the diff.
3. Run `terraform providers lock` with your team's platforms (see the next section) so no hashes are missing.

## How Do I Fix "Does Not Match Checksums From Dependency Lock File"?

The error means Terraform found a provider package whose checksum is not in the lock file. It shows up in two forms. During `terraform init`:

```text
Error: Failed to install provider

Error while installing hashicorp/random v3.9.1: the current package for
registry.terraform.io/hashicorp/random 3.9.1 doesn't match any of the
checksums previously recorded in the dependency lock file; for more
information:
https://developer.hashicorp.com/terraform/language/files/dependency-lock#checksum-verification
```

And during `plan` or `apply`, when the files in `.terraform/providers` do not match:

```text
Error: Required plugins are not installed

The installed provider plugins are not consistent with the packages selected
in the dependency lock file:
  - registry.terraform.io/hashicorp/random: the cached package for registry.terraform.io/hashicorp/random 3.9.1 (in .terraform/providers) does not match any of the checksums recorded in the dependency lock file
```

We produced the first one by replacing the hashes in a lock file, and the second one by changing one byte of the downloaded provider binary.

Find the cause before you change anything:

| Cause                                                                                                                         | Fix                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| The lock file was made from a provider mirror or plugin cache, so it has hashes for one platform only, and CI runs on another | `terraform providers lock -platform=...` for every platform you use, then commit                 |
| `.terraform/` was copied from another machine, for example a Docker volume or a CI cache shared between macOS and Linux       | `rm -rf .terraform/providers && terraform init`                                                  |
| A mirror or proxy serves a different build of the provider                                                                    | Make the mirror serve the official packages, or regenerate the hashes from the mirror on purpose |
| Someone edited the lock file by hand, or a merge mixed two versions                                                           | Restore the file from Git and run `terraform init`                                               |
| You changed the version constraint and the locked version no longer fits                                                      | `terraform init -upgrade`                                                                        |
| The package really was changed                                                                                                | Stop. Do not regenerate the hashes until you know where the package came from                    |

When `init` installs directly from the public registry, it accepts any package that matches one of the signed `zh:` hashes, which cover every platform. That is why a lock file made on a Mac usually works on a Linux runner. The error appears when an install path can check only `h1:` hashes, such as a filesystem mirror, a network mirror or the plugin cache.

The fix for most teams is to record hashes for every platform once:

```bash
terraform providers lock \
  -platform=linux_amd64 \
  -platform=linux_arm64 \
  -platform=darwin_arm64 \
  -platform=windows_amd64
```

The command downloads each provider for each platform, checks the signature, and adds the `h1:` and `zh:` hashes to the lock file. The [best practices chapter](/guides/introduction-to-terraform/10-best-practices-and-production-patterns#h2-pin-versions-and-commit-the-lock-file) of our Terraform guide shows the full output of this command.

If you use a plugin cache (`plugin_cache_dir` in the CLI configuration), note that since Terraform 1.4 Terraform uses a cached package only if the lock file already has a matching hash for it. That stops the cache from silently filling the lock file with one platform's hashes. `plugin_cache_may_break_dependency_lock_file = true` turns the old behavior back on. Keep it off for shared projects.

## How Do I Fix "Invalid Legacy Provider Address"?

The error means the state still refers to a provider by its Terraform 0.12 address, such as `registry.terraform.io/-/aws`. Since Terraform 0.13 every provider has a full source address with a namespace, such as `hashicorp/aws`. Declare the source in `required_providers`, then rewrite the address in the state:

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}
```

```bash
terraform state replace-provider registry.terraform.io/-/aws registry.terraform.io/hashicorp/aws
terraform init
terraform plan
```

Run `replace-provider` once for each legacy provider in the state (`-/random`, `-/null` and so on). For a provider that moved to another namespace, use its new address, for example `registry.terraform.io/vmware/vsphere`. The command asks for confirmation and writes a backup of the state first.

Check two more places if the error stays:

- **Modules.** A module that declares a provider without `source` makes Terraform assume `hashicorp/<name>`. Every module that uses a provider from another namespace must have its own `required_providers` entry with the correct `source`.
- **Very old state.** If the state was last written by Terraform 0.12 or earlier, upgrade in steps as HashiCorp's upgrade guides describe, with a plan and apply on each version, instead of jumping straight to 1.x.

## How Do I Install or Upgrade to a Specific Terraform Version?

Download that exact release, check its checksum, and put it on your `PATH`. Then pin the version in the code so an old or new binary fails early:

```bash
TF_VERSION=1.17.2
ARCH=amd64   # arm64 on Apple Silicon and ARM servers
OS=linux     # darwin on macOS

curl -fsSLO "https://releases.hashicorp.com/terraform/${TF_VERSION}/terraform_${TF_VERSION}_${OS}_${ARCH}.zip"
curl -fsSLO "https://releases.hashicorp.com/terraform/${TF_VERSION}/terraform_${TF_VERSION}_SHA256SUMS"
grep "_${OS}_${ARCH}.zip" "terraform_${TF_VERSION}_SHA256SUMS" | sha256sum -c -   # shasum -a 256 -c - on macOS
unzip -o "terraform_${TF_VERSION}_${OS}_${ARCH}.zip" terraform
mkdir -p ~/.local/bin && install -m 0755 terraform ~/.local/bin/terraform
export PATH="$HOME/.local/bin:$PATH"   # add this line to ~/.bashrc or ~/.zshrc too
terraform version
```

```hcl
terraform {
  required_version = "~> 1.17.0" # any 1.17.x
}
```

With a binary that is not a 1.17.x release, commands that load the configuration, such as `init`, `plan` and `apply`, stop with `Unsupported Terraform Core version` before they touch anything. Use `= 1.17.2` instead if every run must use exactly that release.

Other ways to get a specific version:

- **A version manager** such as `tenv` installs several versions side by side and picks the one that a `.terraform-version` file or `required_version` asks for. This is the easiest option when projects need different versions.
- **The HashiCorp apt repository** can install an exact package version: `sudo apt install terraform=1.17.2-1`, then `sudo apt-mark hold terraform` to stop upgrades.
- **CI** usually takes a version input, for example `terraform_version: 1.17.2` in `hashicorp/setup-terraform@v4`.

Upgrade deliberately. Read the upgrade notes of each minor release, upgrade CI and every laptop together, and run a plan first: after a Terraform upgrade, a plan should show no changes. Any newer Terraform 1.x reads state from an older 1.x, but the way back is not guaranteed, so keep the state backup or bucket versioning that lets you restore it. The [installation chapter](/guides/introduction-to-terraform/02-installation-and-setup#h2-install-terraform) of our guide covers every platform.

## Can Terraform Provision On-Premises Servers?

Yes, when the platform has an API and a Terraform provider for it. Terraform does not care where the servers are. It calls an API through a provider, and the state, plans and modules work the same as in the cloud. Common providers for on-premises infrastructure:

| Platform                | Provider source (registry)                             |
| ----------------------- | ------------------------------------------------------ |
| VMware vSphere          | `vmware/vsphere`                                       |
| Proxmox VE              | community providers such as `bpg/proxmox`              |
| KVM with libvirt        | `dmacvicar/libvirt`                                    |
| OpenStack               | `terraform-provider-openstack/openstack`               |
| Bare metal through MAAS | `canonical/maas`                                       |
| Network devices         | vendor providers, for example for Cisco, Juniper or F5 |

Older articles also name Packet, later Equinix Metal, for bare metal. Equinix shut Metal down on 30 June 2026, so that option no longer exists.

A vSphere VM cloned from a template looks like this. The data sources look up the existing datacenter, cluster, datastore, network and template by name:

```hcl
terraform {
  required_providers {
    vsphere = {
      source  = "vmware/vsphere"
      version = "~> 2.18"
    }
  }
}

# Credentials come from VSPHERE_USER, VSPHERE_PASSWORD and VSPHERE_SERVER
provider "vsphere" {}

data "vsphere_datacenter" "dc" {
  name = "dc-01"
}

data "vsphere_compute_cluster" "cluster" {
  name          = "cluster-01"
  datacenter_id = data.vsphere_datacenter.dc.id
}

data "vsphere_datastore" "ds" {
  name          = "datastore-01"
  datacenter_id = data.vsphere_datacenter.dc.id
}

data "vsphere_network" "net" {
  name          = "VM Network"
  datacenter_id = data.vsphere_datacenter.dc.id
}

data "vsphere_virtual_machine" "template" {
  name          = "ubuntu-24.04-template"
  datacenter_id = data.vsphere_datacenter.dc.id
}

resource "vsphere_virtual_machine" "app" {
  name             = "app-01"
  resource_pool_id = data.vsphere_compute_cluster.cluster.resource_pool_id
  datastore_id     = data.vsphere_datastore.ds.id
  num_cpus         = 2
  memory           = 4096
  guest_id         = data.vsphere_virtual_machine.template.guest_id

  network_interface {
    network_id   = data.vsphere_network.net.id
    adapter_type = data.vsphere_virtual_machine.template.network_interface_types[0]
  }

  disk {
    label            = "disk0"
    size             = data.vsphere_virtual_machine.template.disks[0].size
    thin_provisioned = data.vsphere_virtual_machine.template.disks[0].thin_provisioned
  }

  clone {
    template_uuid = data.vsphere_virtual_machine.template.id
  }
}
```

Keep credentials out of the code, and do not set `allow_unverified_ssl = true` outside a lab. Terraform creates the machine. For what runs inside it, use cloud-init in the template or a configuration tool such as Ansible. The [Ansible inventory chapter](/guides/introduction-to-ansible/04-working-with-inventory) shows how to feed Terraform-created hosts to Ansible.

## Related Resources

- [How to Install Terraform and Run Your First Apply](/guides/introduction-to-terraform/02-installation-and-setup), including common setup errors.
- [Upgrading Terraform and the state](/guides/introduction-to-terraform/05-state-management#h2-upgrading-terraform-and-the-state) in our Terraform guide.
- [OpenTofu in 2026](/posts/opentofu-2026-switch-from-terraform) if you are considering the open source fork, which uses its own registry and lock file entries.
- [Build a Terraform Provider for Your API](/posts/build-a-terraform-provider-plugin-framework) to see how providers work inside.
- [Terraform Fundamentals Quiz](/quizzes/terraform-quiz) to test what you know.
