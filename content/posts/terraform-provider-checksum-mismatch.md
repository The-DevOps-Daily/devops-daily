---
title: 'Terraform: Failed to install provider, does not match checksums from dependency lock file'
excerpt: 'Troubleshoot the Terraform error about provider checksums not matching the dependency lock file and learn safe fixes and best practices.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-05-01'
publishedAt: '2025-05-01T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Troubleshooting
  - Providers
  - Security
  - DevOps
---

## TLDR

The error "Failed to install provider, does not match checksums from dependency lock file" means Terraform downloaded a provider binary whose checksum did not match what's recorded in `.terraform.lock.hcl`. Common causes are an outdated lock file, platform differences, corrupted downloads, or using a provider mirror with different checksums. The safe fixes are: inspect and refresh the lock file, clear local caches, regenerate platform-specific checksums, or use short-lived remote sandboxes when testing. Follow the step-by-step checklist below to resolve the issue without weakening supply-chain protections.

---

When Terraform complains that a provider's checksum does not match the dependency lock file, it is protecting you from a potentially tampered or unexpected provider binary. That protection is useful, but it can also block legitimate changes like a provider upgrade or when you switch platforms. Use the following steps to diagnose and fix the problem.

## Quick checklist (start here)

1. Confirm which provider and platform Terraform reports in the error message.
2. Run `terraform init -upgrade` to refresh provider versions and update the lock file if you intend to accept newer checksums.
3. If you must reproduce a specific lock state, restore the original `.terraform.lock.hcl` from version control or recreate it with `terraform providers lock` for the target platforms.
4. Clear local plugin caches and re-run `terraform init`.

Work through those in order - the first two items resolve most cases.

## Why this happens

- The `.terraform.lock.hcl` file pins provider download checksums for specific platforms. If the provider binary downloaded during `terraform init` has a different checksum, Terraform aborts to prevent unexpected code from executing.
- Common legitimate causes:
  - The lock file is stale and a provider was released or patched upstream.
  - You switched OS or architecture (for example, from macOS to Linux) and the lock file does not contain checksums for the new platform.
  - A download was corrupted or a proxy / mirror returned a different binary.
  - A private provider mirror or alternate registry with different signed binaries.

## Step-by-step fixes

1. Inspect the error and .terraform.lock.hcl

Before the code: check the exact provider and platform referenced in the error and open your lock file to compare.

```bash
# show the last init error output (run this in the root where terraform init failed)
terraform init
```

- What this does: repeats init and prints the failing provider and platform details.
- Why it matters: you need the provider name, version, and platform that triggered the checksum mismatch.

Open `.terraform.lock.hcl` and find the provider block for the provider name and version reported in the error. That block contains checksums keyed by platform.

2. Refresh the lock file when you want the latest provider

Before the code: if you are intentionally updating providers or accepting the registry's latest artifacts, run init with upgrade to refresh the lock file.

```bash
# refresh provider constraints and update lock file
terraform init -upgrade
```

- What this does: asks Terraform to check for newer provider versions and update `.terraform.lock.hcl` with new checksums.
- Why it matters: this is the correct action when you intend to move to a newer provider release.

3. Regenerate lock checksums for specific platforms

Before the code: when developing on one platform but CI or other machines use different OS/arch combinations, generate a lock file that includes checksums for all target platforms.

```bash
# generate lock entries for linux_amd64 and darwin_amd64
terraform providers lock -platform=linux_amd64 -platform=darwin_amd64
```

- What this does: creates or updates `.terraform.lock.hcl` to include checksums for the requested platforms.
- Why it matters: Terraform needs matching checksums for every platform that will download the provider. This prevents mismatches in CI or teammates' machines.

4. Clear corrupted local downloads and re-init

Before the code: if a download was corrupted or a proxy returned a bad file, remove the local plugin cache and re-run init.

```bash
# remove the working terraform directory and provider cache
rm -rf .terraform
rm -rf ~/.terraform.d/plugin-cache
# then re-init
terraform init
```

- What this does: forces Terraform to re-download providers from the registry or mirror.
- Why it matters: corrupted cached files can trigger checksum mismatches even when the lock file is correct.

5. If you use a provider mirror or private registry

- Verify the mirror's integrity: the mirror must publish the same signed artifacts and checksums as the public registry, otherwise checksums will differ.
- If the mirror alters binaries, coordinate with the mirror owner to publish matching checksums or pin the mirror in your CLI config using `provider_installation` in `~/.terraformrc` or `terraform.rc`.

Example `provider_installation` that uses a filesystem mirror:

```hcl
# ~/.terraformrc
provider_installation {
  filesystem_mirror {
    path    = "/opt/terraform-providers"
  }
  direct {
    exclude = ["registry.terraform.io/*/*"]
  }
}
```

- What this does: tells Terraform to prefer providers from the local filesystem mirror.
- Why it matters: a mirror with different binaries will cause checksum mismatches unless the lock file has matching entries.

6. When it is OK to remove the lock file

If you are experimenting locally and understand the risk, you can regenerate the lock file. Prefer `terraform init -upgrade` or `terraform providers lock` instead of just deleting the lock file. If you do remove it, commit the regenerated `.terraform.lock.hcl` to version control so other users have the same checksums.

```bash
# risky: remove the lock file and re-init (only for experiments)
rm .terraform.lock.hcl
terraform init
```

- What this does: removes protection and allows Terraform to create a fresh lock file based on whatever it downloads.
- Why it matters: avoid this on shared branches unless you coordinate the provider change.

## Best practices to avoid this in the future

- Commit `.terraform.lock.hcl` to version control for all Terraform roots. That keeps everyone using the same provider checksums.
- Use `terraform providers lock -platform=` to include CI and local platforms in the lock file.
- Pin provider versions in your configuration to avoid surprise upgrades: `version = "~> 4.0"`.
- Use short-lived sandbox backends for testing provider upgrades before changing main state.
- If you operate a provider mirror, keep it synchronized with the upstream registry and publish matching checksums.

## Troubleshooting flow (ASCII)

The steps below show a simple flow to resolve checksum issues.

```
Error: checksum mismatch
    |
    v
Inspect error -> check .terraform.lock.hcl ->
  if outdated -> terraform init -upgrade -> done
  else if missing platforms -> terraform providers lock -platform=... -> done
  else -> clear cache (rm -rf .terraform) -> terraform init
```

## Short practical conclusion

When Terraform blocks provider installation with a checksum mismatch, treat it as a safety signal. Start by refreshing the lock file with `terraform init -upgrade` if you expect newer providers, or generate platform checksums with `terraform providers lock` when CI and local machines differ. Only clear caches or remove the lock file when you understand the risk and have a plan to commit and distribute the updated lock file.

Next steps you can explore: automate lockfile generation for CI platforms, add pre-commit checks that validate `.terraform.lock.hcl`, and use provider mirrors carefully with matching checksum publication.
