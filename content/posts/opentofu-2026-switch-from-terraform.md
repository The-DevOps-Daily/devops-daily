---
title: 'OpenTofu in 2026: Should You Switch from Terraform (and What It Actually Costs You)'
excerpt: 'OpenTofu has matured into a real Terraform alternative in 2026. Here is what the fork gives you, why the migration is easier than you think, and where the actual lock-in hides.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2026-06-02'
publishedAt: '2026-06-02T09:00:00Z'
updatedAt: '2026-06-02T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Terraform
  - OpenTofu
  - Infrastructure as Code
  - Migration
  - State Management
  - DevOps
---

If you manage infrastructure with Terraform, one question has been sitting in your backlog since 2023: do you stay on Terraform, or move to OpenTofu? For a long time the honest answer was "wait and see." The fork was young, the feature gap was small, and nobody wanted to bet production state files on a project that might fade.

In 2026 the picture is clearer. HashiCorp is now part of IBM, Terraform stayed on a source-available license, and OpenTofu has shipped real features that Terraform's open-source CLI does not have. The fork is no longer a protest vote. It is a working tool with its own roadmap.

This post answers the practical question directly. What changed, what OpenTofu gives you that Terraform does not, how the migration actually works (it is easier than most people expect), where the real lock-in hides, and a simple framework for deciding whether to switch now, run both, or stay put.

## TLDR

- Terraform is now an IBM product under the BSL 1.1 source-available license. OpenTofu is MPL 2.0, sits in the CNCF, and is governed so no single company controls it.
- OpenTofu v1.12 (May 2026) ships features Terraform's open-source CLI lacks: native state encryption, the `-exclude` flag, provider `for_each`, and early variable evaluation.
- Migrating from Terraform to OpenTofu is the easy part. The state format is the same, you swap the `terraform` binary for `tofu`, run `tofu init`, and validate with `tofu plan`. It is reversible.
- The real lock-in starts later, once you adopt OpenTofu-only features like encrypted state. After that, going back to Terraform is no longer clean.
- Switch now if you want the new features or open governance. Run both if you have a large estate tied to HashiCorp Cloud. Stay if you are happy on Terraform Cloud and licensing does not affect you.

## Prerequisites

- A working Terraform setup (CLI 1.5 or later) with at least one project and a state file
- Access to your state backend (S3, GCS, Azure Blob, Terraform Cloud, or local)
- Permission to change your CI/CD pipeline definitions
- A test or staging workspace you can migrate before touching production

## The 2026 reality: who owns what

Two things drive the decision in 2026, and neither is about syntax.

First, ownership. IBM completed its acquisition of HashiCorp, a 6.4 billion dollar deal, in early 2025. Terraform is now an IBM product. IBM has a long history of keeping acquisitions open, with Red Hat the obvious example, but the Terraform license has not moved.

Second, licensing. In August 2023 HashiCorp moved Terraform from the Mozilla Public License (MPL) 2.0 to the Business Source License (BSL) 1.1. The BSL is source-available, not open source. It restricts using Terraform to build a competing product, and each release converts back to MPL only four years after it ships. For most teams that run Terraform internally, the BSL changes nothing day to day. For anyone building tooling around Terraform, or who cares about vendor-neutral governance, it matters.

OpenTofu sits on the other side of that line. It was forked from the last MPL-licensed Terraform release, so the BSL never applied to its code. The CNCF accepted OpenTofu in April 2025, and a Technical Steering Committee under the Linux Foundation sets the roadmap. No single company has the votes to change the license or the direction.

```text
                 Terraform                  OpenTofu
License          BSL 1.1 (source-available) MPL 2.0 (open source)
Owner            IBM (HashiCorp)            CNCF / Linux Foundation
Governance       Single vendor              Multi-company TSC
State format     .tfstate (JSON)            .tfstate (JSON, same)
```

## What OpenTofu has that Terraform does not

By 2026 OpenTofu is past parity in several areas. These are the features that actually pull teams across.

### Native state encryption

Terraform's state file holds everything, including resource attributes that are often sensitive. By default it sits in plaintext in your backend. If someone reads your S3 bucket, they read your state.

OpenTofu encrypts state at rest, including remote state, with no external wrapper. You configure a key provider (AWS KMS, GCP KMS, Vault, or a passphrase) and a method, and OpenTofu handles the rest.

```hcl
terraform {
  encryption {
    key_provider "aws_kms" "main" {
      kms_key_id = "arn:aws:kms:us-east-1:111122223333:key/abcd-1234"
      region     = "us-east-1"
      key_spec   = "AES_256"
    }

    method "aes_gcm" "main" {
      keys = key_provider.aws_kms.main
    }

    state {
      method = method.aes_gcm.main
    }

    plan {
      method = method.aes_gcm.main
    }
  }
}
```

Now, even if the backend is exposed, the state and plan files are unreadable without the key. Terraform's open-source CLI has no equivalent.

### Provider for_each

You can define multiple instances of a provider and iterate over them. This is the clean answer to the old problem of managing one provider configuration per region or per account without copy-pasting blocks for each one.

### The -exclude flag

`-target` lets you act on a specific resource. OpenTofu adds the inverse, `-exclude`, so you can plan or apply everything except a resource you want to leave alone.

```bash
# Apply everything except the database, which you are handling separately
tofu apply -exclude=aws_db_instance.primary
```

### Early variable evaluation

OpenTofu can evaluate variables early, which means you can use them in places Terraform rejects, such as module `source` and `backend` configuration. That removes a class of workarounds teams have carried for years.

### What v1.12 added (May 2026)

The 1.12 release kept the gap open. Two changes that matter in daily use:

- `destroy = false` in a resource lifecycle lets OpenTofu remove an object from state without destroying the real resource, a declarative version of `state rm`.
- `prevent_destroy` can now reference variables and other symbols in the module, instead of only a literal `true` or `false`.

None of these is a reason to switch on its own. Together they show the fork is shipping, not coasting.

## The migration is the easy part

Here is the part most teams get backwards. They treat the migration as the risk. It is not. Terraform and OpenTofu share the same state format. OpenTofu reads and writes the same `.tfstate` JSON that Terraform produces. For most projects, moving over is a binary swap and a pipeline change.

### Step 1: back up your state

Always start here, no matter how confident you are.

```bash
# Pull the current state to a local file before touching anything
terraform state pull > terraform.tfstate.backup
```

If you use a remote backend, also confirm you have versioning enabled (S3 versioning, for example) so you can roll back.

### Step 2: install the tofu binary

```bash
# macOS
brew install opentofu

# Linux, via the official install script
curl -fsSL https://get.opentofu.org/install-opentofu.sh -o install-opentofu.sh
chmod +x install-opentofu.sh
./install-opentofu.sh --install-method deb

tofu version
# OpenTofu v1.12.0
```

### Step 3: initialize with OpenTofu

Run `tofu init` in the project. This re-initializes the working directory and pulls providers from the OpenTofu registry instead of the Terraform registry.

```bash
tofu init
# Initializing the backend...
# Initializing provider plugins...
# - Finding hashicorp/aws versions matching ">= 5.0"...
# - Installing hashicorp/aws v5.x...
# OpenTofu has been successfully initialized!
```

### Step 4: plan before you apply

This is the rule that keeps you safe. Your first OpenTofu command against existing state is always `tofu plan`, never `tofu apply`. A clean migration shows no changes.

```bash
tofu plan
# No changes. Your infrastructure matches the configuration.
```

If you see unexpected changes, stop and investigate before applying. Common causes are provider version drift or a Terraform version that wrote state OpenTofu does not recognize. The version-skew note below covers the second case.

### Step 5: update CI/CD

Find every place your pipelines call `terraform` and swap it for `tofu`. The subcommands and flags are the same.

```yaml
# Before (GitHub Actions)
- run: terraform init
- run: terraform plan -out=tfplan
- run: terraform apply tfplan

# After
- run: tofu init
- run: tofu plan -out=tfplan
- run: tofu apply tfplan
```

For most teams, that is the whole migration. No state surgery, no rewrite.

## Where the real lock-in hides

If the migration is reversible, why does anyone hesitate? Because reversibility has a shelf life.

The moment you adopt an OpenTofu-only feature, the door starts closing. Encrypted state is the clearest example. Once OpenTofu writes an encrypted state file, Terraform cannot read it. The same applies to configuration that uses provider `for_each` or early evaluation in ways Terraform's parser rejects. Your code and state quietly become OpenTofu-shaped.

That is not a trap, it is a choice. Just make it on purpose. As long as you stay on shared features, you can move back to Terraform by swapping the binary the other way. Once you use the features that pulled you over, plan to stay.

### The version-skew gotcha

There is one real failure mode during migration. OpenTofu tracks the Terraform state format up to the version it forked from, and forward on its own line after that. If your team upgraded Terraform past the point OpenTofu supports, `tofu plan` may fail to read the state or report a format error.

The fix is ordered:

1. Downgrade Terraform to a version OpenTofu supports.
2. Run `terraform apply` once to rewrite the state in the older format.
3. Migrate to OpenTofu and run `tofu plan` to confirm a clean result.

This is why you test on a staging workspace first and never run `tofu apply` blind.

## Migration strategies

Pick the rollout that matches your size and risk tolerance.

**Big bang.** Replace every `terraform` reference with `tofu` in one maintenance window. This suits small teams with a handful of configurations. It is fast and there is no period of running two tools side by side.

**Parallel run (dual-engine).** Keep Terraform on legacy stacks, especially anything tied to Terraform Cloud or HashiCorp-specific features, and use OpenTofu for new, greenfield work. Migrate older modules when you have a reason to touch them anyway. Large organizations use this as a hedge. It avoids a risky all-at-once cutover and lets you adopt OpenTofu features only where you are ready to commit.

## Should you switch? A decision framework

```text
Do you build products or tooling on top of Terraform,
or need vendor-neutral governance?
        |
        +-- Yes --> Switch to OpenTofu now.
        |
        No
        |
Do you want native state encryption, provider for_each,
or the other OpenTofu-only features?
        |
        +-- Yes --> Switch to OpenTofu now.
        |
        No
        |
Do you have a large estate tied to Terraform Cloud / HCP?
        |
        +-- Yes --> Dual-engine: OpenTofu for new work,
        |            Terraform for the locked-in stacks.
        |
        No
        |
Are you happy on Terraform Cloud, with no licensing concern?
        |
        +-- Yes --> Staying is fine. Revisit yearly.
```

**Switch now** if you build tooling on Terraform, care about open governance, or want the features Terraform's open-source CLI will not get. State encryption alone justifies it for many security-conscious teams.

**Run both** if you have a large estate, especially one tied to Terraform Cloud or HCP-specific workflows. Move greenfield work to OpenTofu and migrate the rest over time.

**Stay** if Terraform Cloud serves you well and the license does not touch your use case. There is no penalty for waiting, and the migration will be just as easy next year.

## Summary

The OpenTofu question is settled enough to act on in 2026. The fork is in the CNCF, it ships features Terraform's open-source CLI does not have, and Terraform itself is now an IBM product on a source-available license.

The mental model to keep:

- The migration is easy and reversible. Same state format, swap the binary, plan before apply.
- The lock-in is a later, deliberate choice. It starts when you adopt OpenTofu-only features, not when you switch.
- Match the rollout to your estate. Big bang for small teams, dual-engine for large ones.

Back up your state, test on staging, run `tofu plan`, and decide based on the features you actually want rather than the fear of the move. The move is the easy part.
