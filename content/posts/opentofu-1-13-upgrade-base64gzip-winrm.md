---
title: 'OpenTofu 1.13 Re-Encodes base64gzip and Drops WinRM. We Upgraded the Same State to See What Breaks'
excerpt: 'OpenTofu 1.13 shipped on September 30. We applied configs with 1.12.7 and planned them with 1.13.1 against the same state. Gzipped user data planned an update and a replacement with no config change. A WinRM provisioner passed validate and plan, then failed at apply. The new assume functions turned an Invalid count argument error into a clean plan. Here is what to check before you bump the version.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2026-10-07'
publishedAt: '2026-10-07T09:00:00Z'
updatedAt: '2026-10-07T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Terraform
  - OpenTofu
  - Infrastructure as Code
  - Cloud-Init
  - Upgrades
  - DevOps
---

OpenTofu 1.13.0 was published on September 30 (the [release announcement](https://opentofu.org/blog/opentofu-1-13-0/) is dated September 29), and [1.13.1](https://github.com/opentofu/opentofu/releases/tag/v1.13.1) followed on October 1 with two fixes for ephemeral values. The headline features are new functions that let module authors describe values OpenTofu cannot know until apply, plus two experiments: built-in linting and symbol libraries. The upgrade notes are what you will notice first. `base64gzip` now returns different bytes for the same input, WinRM provisioners are gone, and 1.13 is the last series with official 32-bit builds.

Upgrade notes tell you what changed. They do not show you your next plan, or the step at which a removed feature fails. So we tested it. We applied configurations with OpenTofu 1.12.7, ran 1.13.1 against the same state, and recorded what each command printed. This post goes through the results and ends with a checklist you can run before you change the version in CI.

## TLDR

- `base64gzip` in 1.13.1 returns a different string for the same input. OpenTofu moved to Go 1.27, and Go changed its DEFLATE encoder. Both outputs decompress to identical bytes, but providers compare the string. With no config change, our plan was `1 to add, 1 to change, 1 to destroy`.
- On `aws_instance`, a changed `user_data_base64` means a stop/start, or a replacement if you set `user_data_replace_on_change`. On `azurerm_linux_virtual_machine`, a changed `custom_data` forces a new VM.
- `ignore_changes` hides the diff. In our test it also hid a real edit to the cloud-init file. Gzip done inside the `cloudinit` provider did not change at all.
- A `winrm` provisioner passes `tofu validate` and `tofu plan` on 1.13.1, with the old "will be removed in a future version" warning. It fails at apply, after the resource exists, and leaves the resource tainted.
- `assumenotnull` fixed a classic `Invalid count argument` error. `assumestringprefix` moved a mis-wired module input from a mid-apply failure to a plan error. Older versions reject these functions, and since 1.12 a `required_version` in a `.tf` file does not stop them.
- `-lint=all` is a useful experiment, but it only adds warnings. The exit code stays 0.

## Prerequisites

- An OpenTofu 1.12.x codebase, or a Terraform codebase that you plan to move to OpenTofu
- A CI job or shell that can run `tofu plan` with read access to your real state
- `jq`, for the plan JSON recipe
- The 1.13.1 zip for your platform from the [GitHub release page](https://github.com/opentofu/opentofu/releases/tag/v1.13.1), checked against its `SHA256SUMS` file

## How we tested

We ran everything on a Raspberry Pi with a 64-bit (arm64) OS: OpenTofu 1.12.7 and 1.13.1 for `linux_arm64`, the 1.13.1 `linux_arm` (32-bit) build, and Terraform 1.16.5 for comparison. Every zip matched its published SHA256 sum. In the outputs below, `tofu-1.12.7` and `tofu-1.13.1` are the two release binaries side by side.

We did not use a cloud account. The built-in `terraform_data` resource stands in for provider attributes. Its `input` argument updates in place when the value changes, and its `triggers_replace` argument forces a replacement. Those are the two ways real providers treat user data, which we checked in the provider docs. Every output in this post comes from these runs. Where we cut lines from an output, the block shows `...` or the `grep`/`tail` we used, and long base64 strings are shortened with `...`.

## base64gzip: same input, different string

`base64gzip` compresses a string with gzip and base64-encodes the result. Its most common job is cloud-init user data, because EC2 limits user data to 16 KB and compression gives you more room. Here is the same call on both versions, plus Terraform 1.16.5, and then a check of what a real payload (a 1,208-byte cloud-init file that installs nginx and writes a systemd unit) decompresses to:

```terminal
{
  "title": "base64gzip across versions",
  "prompt": "$",
  "steps": [
    { "comment": "same input, three binaries" },
    { "cmd": "echo 'base64gzip(\"hello\")' | ./tofu-1.12.7 console", "output": "\"H4sIAAAAAAAA/8pIzcnJBwAAAP//AQAA//+GphA2BQAAAA==\"" },
    { "cmd": "echo 'base64gzip(\"hello\")' | ./tofu-1.13.1 console", "output": "\"H4sIAAAAAAAA/wAFAPr/aGVsbG8AAAD//wMAhqYQNgUAAAA=\"" },
    { "cmd": "echo 'base64gzip(\"hello\")' | ./terraform-1.16.5 console", "output": "\"H4sIAAAAAAAA/8pIzcnJBwAAAP//AQAA//+GphA2BQAAAA==\"" },
    { "comment": "decompress the cloud-init payload from each version" },
    { "cmd": "echo 'base64gzip(file(\"cloud-init.yaml\"))' | ./tofu-1.12.7 console | tr -d '\"' | base64 -d | gunzip | sha256sum", "output": "3a62ee85006428492dc1aeccc789867735496026ada3bfaef3d0cf00dcc1bcd1  -" },
    { "cmd": "echo 'base64gzip(file(\"cloud-init.yaml\"))' | ./tofu-1.13.1 console | tr -d '\"' | base64 -d | gunzip | sha256sum", "output": "3a62ee85006428492dc1aeccc789867735496026ada3bfaef3d0cf00dcc1bcd1  -" },
    { "cmd": "sha256sum < cloud-init.yaml", "output": "3a62ee85006428492dc1aeccc789867735496026ada3bfaef3d0cf00dcc1bcd1  -" }
  ]
}
```

The encoded strings differ. The content does not: both outputs decompress to the exact bytes of the source file.

The cause is upstream. OpenTofu 1.12.7 is built with Go 1.26.6 and 1.13.1 with Go 1.27.1 (each binary records its Go version). The [Go 1.27 release notes](https://go.dev/doc/go1.27) say that "the exact encoded output from Writer may be different from Go 1.26 as a result of the encoder implementation change", and that this carries through to `compress/gzip`. The [OpenTofu 1.13 changelog](https://github.com/opentofu/opentofu/blob/v1.13/CHANGELOG.md) calls the new output "equivalent to _but not equal to_" the output of earlier releases. The new output is stable: three runs of 1.13.1 gave the same string.

Terraform 1.16.5 is built with Go 1.26.8 and produced the same bytes as OpenTofu 1.12.7. So you also get this diff when you move from Terraform 1.16 to OpenTofu 1.13, not only when you upgrade OpenTofu.

### What the plan shows

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "cloud-init.yaml", "sub": "unchanged", "icon": "box", "tone": "slate" },
    { "label": "base64gzip()", "sub": "Go 1.27 DEFLATE", "icon": "gear", "tone": "amber" },
    { "label": "New string", "sub": "same bytes after gunzip", "icon": "activity", "tone": "violet" },
    { "label": "Provider diff", "sub": "string != state", "icon": "server", "tone": "blue" },
    { "label": "Plan", "sub": "update or replace", "icon": "rocket", "tone": "red", "status": "warn" }
  ]
}
```

This is the config we applied with 1.12.7:

```hcl
locals {
  user_data = base64gzip(file("${path.module}/cloud-init.yaml"))
}

# Stands in for an attribute that a provider updates in place,
# such as user_data_base64 on aws_instance.
resource "terraform_data" "web_in_place" {
  input = local.user_data
}

# Stands in for an attribute that forces replacement,
# such as custom_data on azurerm_linux_virtual_machine.
resource "terraform_data" "web_replace" {
  triggers_replace = local.user_data
}
```

After `tofu-1.12.7 apply`, a 1.12.7 plan reported no changes. Then we planned with 1.13.1 against the same state and the same config:

```text
$ tofu-1.13.1 plan
terraform_data.web_replace: Refreshing state... [id=4437d213-ef2e-bd8b-9c81-b5831d1b46c8]
terraform_data.web_in_place: Refreshing state... [id=b0ec5936-31c0-4653-0fb6-e353122675fa]

OpenTofu used the selected providers to generate the following execution
plan. Resource actions are indicated with the following symbols:
  ~ update in-place (current -> planned)
-/+ destroy and then create replacement

OpenTofu will perform the following actions:

  # terraform_data.web_in_place will be updated in-place
  ~ resource "terraform_data" "web_in_place" {
        id     = "b0ec5936-31c0-4653-0fb6-e353122675fa"
      ~ input  = "H4sIAAAAAAAA/5RU3U7zRhC9z..." -> "H4sIAAAAAAAA/5RTXW/jNhB89..."
      ~ output = "H4sIAAAAAAAA/5RU3U7zRhC9z..." -> (known after apply)
    }

  # terraform_data.web_replace must be replaced
-/+ resource "terraform_data" "web_replace" {
      ~ id               = "4437d213-ef2e-bd8b-9c81-b5831d1b46c8" -> (known after apply)
      ~ triggers_replace = "H4sIAAAAAAAA/5RU3U7zRhC9z..." -> "H4sIAAAAAAAA/5RTXW/jNhB89..."
    }

Plan: 1 to add, 1 to change, 1 to destroy.
```

Two resources, no edits, one update and one replacement. On real resources, the result depends on the provider:

- [`aws_instance`](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/instance): for `user_data_base64`, where gzip output belongs, "Updates to this field will trigger a stop/start of the EC2 instance by default. If the `user_data_replace_on_change` is set then updates to this field will trigger a destroy and recreate of the EC2 instance."
- [`azurerm_linux_virtual_machine`](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/linux_virtual_machine): for `custom_data`, "Changing this forces a new resource to be created."
- [`aws_launch_template`](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/launch_template): a changed `user_data` creates a new template version. Instances get it the next time your Auto Scaling group launches or refreshes from that version.

None of this is a disaster if you plan for it. But a stop/start of a single production box at 2 p.m. is the kind of surprise you want to catch in plan review, not after someone approves an apply because "it is only a version bump".

### Find it before the upgrade

Start with a search. Run it after `tofu init`, so that it also covers registry and git modules in `.terraform/modules`:

```bash
grep -rnE --include='*.tf' --include='*.tofu' 'base64gzip\(|"winrm"' .
```

On our test folder it found both problems this post covers:

```text
main.tf:2:  user_data = base64gzip(file("${path.module}/cloud-init.yaml"))
winrm/main.tf:6:      type     = "winrm"
```

A search only finds literal calls. A plan is the reliable check. Run a 1.13.1 plan in a throwaway job, save it, and list each changed attribute with this `jq` filter (save it as `changed-attrs.jq`):

```text
.resource_changes[]
| select(.change.actions != ["no-op"])
| . as $r
| [ ($r.change.before // {}) | keys[]
    | select($r.change.before[.] != $r.change.after[.]
             and ($r.change.after_unknown[.] | not)) ]
| "\($r.change.actions | join("+"))  \($r.address)  changed: \(join(", "))"
```

```text
$ tofu-1.13.1 plan -lock=false -out=upgrade.tfplan > /dev/null
$ tofu-1.13.1 show -json upgrade.tfplan | jq -r -f changed-attrs.jq
update  terraform_data.web_in_place  changed: input
delete+create  terraform_data.web_replace  changed: triggers_replace
```

A plan does not write state, and `-lock=false` stops a dry-run job from blocking a real apply. Remove the flag if you prefer to wait for the lock. You want a list in which every changed attribute is user data. Anything else in the list is real drift or a different upgrade change, so examine it separately.

### Three ways to handle it

```tabs
{
  "title": "Handling the base64gzip diff",
  "tabs": [
    {
      "label": "Accept it",
      "lang": "bash",
      "code": "# Plan with 1.13.1, review, and apply in a window you choose.\n# The content is identical, so the only effect is the\n# stop/start or replacement itself.\ntofu plan -out=upgrade.tfplan\ntofu show -json upgrade.tfplan | jq -r -f changed-attrs.jq\ntofu apply upgrade.tfplan"
    },
    {
      "label": "Hide it (temporary)",
      "lang": "hcl",
      "code": "resource \"aws_instance\" \"web\" {\n  # ...\n  user_data_base64 = base64gzip(file(\"${path.module}/cloud-init.yaml\"))\n\n  lifecycle {\n    # TEMPORARY: OpenTofu 1.13 re-encodes base64gzip output.\n    # This also hides real cloud-init edits. Remove it on the next change.\n    ignore_changes = [user_data_base64]\n  }\n}"
    },
    {
      "label": "Gzip in the provider",
      "lang": "hcl",
      "code": "data \"cloudinit_config\" \"web\" {\n  gzip          = true\n  base64_encode = true\n\n  part {\n    content_type = \"text/cloud-config\"\n    content      = file(\"${path.module}/cloud-init.yaml\")\n  }\n}\n\nresource \"aws_instance\" \"web\" {\n  # ...\n  user_data_base64 = data.cloudinit_config.web.rendered\n}"
    }
  ]
}
```

**Accept it.** This is usually the correct choice. Do the upgrade apply in a maintenance window, one environment at a time, and use the `jq` list as the change record.

**Hide it.** The release notes suggest `ignore_changes` as a temporary fix, and it works: with `ignore_changes` on both test resources, the 1.13.1 plan said `No changes`. Then we added a line to `cloud-init.yaml` and planned again. It still said `No changes`.

:::warning
`ignore_changes` cannot tell the encoder change from a real edit. While it is in place, changes to your cloud-init file do not reach your instances, and the plan does not tell you. If you use it, open a ticket to remove it, and remove it on the next intentional user data change.
:::

**Move the gzip into the provider.** With `cloudinit_config` and `gzip = true`, the compression runs in the provider binary, not in OpenTofu. We rendered the same file with `hashicorp/cloudinit` v2.4.1 under both 1.12.7 and 1.13.1, and the SHA256 of `rendered` was identical. This does not make you immune. It moves the dependency: v2.4.1 is built with Go 1.26.8, and a future provider release built with Go 1.27 can cause the same one-time diff. So pin the provider version and read its changelog. The switch itself also changes your user data once, because `cloudinit_config` wraps parts in a MIME multi-part document. Do it in the same window as the upgrade.

## WinRM: passes validate and plan, fails at apply

[OpenTofu 1.12](/posts/opentofu-1-12-destroy-false-state-surgery) deprecated the `winrm` connection type, and 1.13 removed it ([#4012](https://github.com/opentofu/opentofu/pull/4012)) because "some of the upstream libraries OpenTofu was using to implement these features are no longer maintained". We expected `tofu validate` to report it. It does not. This is the test config (the host is a closed local port with a short timeout, so that the run fails fast):

```hcl
resource "terraform_data" "bootstrap" {
  provisioner "remote-exec" {
    inline = ["powershell -Command Install-WindowsFeature Web-Server"]

    connection {
      type     = "winrm"
      host     = "127.0.0.1"
      user     = "Administrator"
      password = "example-only"
      https    = true
      timeout  = "10s"
    }
  }
}
```

```text
$ tofu-1.13.1 validate
Warning: WinRM connection type is deprecated

  on main.tf line 6, in resource "terraform_data" "bootstrap":
   5:     connection {
   6:       type     = "winrm"

The winrm connection type is deprecated and will be removed in a future
version of OpenTofu.
...
Success! The configuration is valid, but there were some validation warnings
as shown above.

$ tofu-1.13.1 plan | grep 'Plan:'
Plan: 1 to add, 0 to change, 0 to destroy.

$ time tofu-1.13.1 apply -auto-approve
...
Error: remote-exec provisioner error

  with terraform_data.bootstrap,
  on main.tf line 2, in resource "terraform_data" "bootstrap":
   2:   provisioner "remote-exec" {

'winrm' connections are not supported in OpenTofu v1.13 or later

Error: Provisioners no longer support WinRM
...
real    0m0.153s

$ tofu-1.13.1 show | head -2
# terraform_data.bootstrap: (tainted)
resource "terraform_data" "bootstrap" {
```

1.13.1 still prints the 1.12 deprecation warning at validate and plan. It says the feature "will be removed in a future version", but the feature is already gone in this version. The error comes in under a second at apply. For comparison, 1.12.7 tried to connect to port 5986 and failed at the 10-second timeout, as it should.

The order matters. Provisioners run after the resource is created, and the [OpenTofu docs](https://opentofu.org/docs/language/resources/provisioners/syntax/) say "if a creation-time provisioner fails, the resource is marked as **tainted**" and "will be planned for destruction and recreation upon the next `tofu apply`". With a real Windows VM, the VM is created and billed, then marked for replacement, and each apply after that recreates it and fails again until you remove the provisioner. Existing VMs whose provisioners ran long ago are not affected until something replaces them. Be careful with that last point: if a Windows VM uses gzipped `custom_data`, the base64gzip change above is exactly the kind of thing that replaces it, and then its WinRM provisioner runs again and fails.

To fix it, move to SSH or remove the provisioner:

- Windows Server 2019 and later can run [OpenSSH Server](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse). Set `type = "ssh"` and `target_platform = "windows"` in the `connection` block. If the SSH default shell is PowerShell, the [connection docs](https://opentofu.org/docs/language/resources/provisioners/connection/) also tell you to set `script_path` to a `.ps1` path.
- Better, if you can: bake the configuration into the image, or run it from `custom_data` or `user_data`, so that no provisioner has to connect at all.

The grep above finds literal `"winrm"` strings. It does not find `type = var.connection_type`, so also search for `connection` blocks whose type comes from a variable.

## 32-bit builds: last series

The 1.13 changelog says this is "the final release series that will include official builds for 32-bit CPU architectures" (`*_386` and `*_arm`). The Pi's 64-bit kernel can run 32-bit ARM binaries, so we ran the `linux_arm` build:

```text
$ uname -m
aarch64
$ tofu-1.13.1-linux-arm version
OpenTofu v1.13.1
on linux_arm
$ tofu-1.13.1-linux-arm init

Warning: Support for 32-bit CPU architectures is ending soon

OpenTofu v1.13 is the last release series that will include official release
packages for 32-bit CPU architectures.

We recommend planning to migrate to a 64-bit CPU architecture instead.
Alternatively, you could build OpenTofu for linux_arm from source code
yourself, ...
```

Look at the second line of `tofu version` on each runner. If it says `on linux_arm` or `on linux_386`, that runner has to move. Common cases are 32-bit Raspberry Pi OS runners, old ARMv7 boards, and `i386` container images. As the test shows, a 64-bit kernel does not help if the image or the binary you install is 32-bit. You have time: per the changelogs, the 1.13 series is supported until August 1, 2027, and 1.12 until February 1, 2027. The 1.11 series lost support on August 1, 2026.

## The new functions: hints for unknown values

This is the main feature of the release. During a plan, any value that an API assigns at creation time is unknown, and OpenTofu cannot use an unknown value to decide how many instances to create. Here is the classic case: a network module creates a VPC, and a second module creates flow logs only when it gets a VPC ID.

```hcl
# modules/network/main.tf
# terraform_data stands in for aws_vpc: its output is unknown until apply,
# the same way a VPC id is decided by the AWS API at creation time.
resource "terraform_data" "vpc" {
  input = "vpc-0a1b2c3d4e5f60718"
}

output "vpc_id" {
  value = terraform_data.vpc.output
}

# modules/flow_logs/main.tf
variable "vpc_id" {
  type    = string
  default = null
}

resource "terraform_data" "flow_log" {
  count = var.vpc_id != null ? 1 : 0
  input = var.vpc_id
}
```

On a first plan, 1.12.7 and 1.13.1 fail the same way:

```text
Error: Invalid count argument

  on modules/flow_logs/main.tf line 7, in resource "terraform_data" "flow_log":
   7:   count = var.vpc_id != null ? 1 : 0

The "count" value depends on resource attributes that cannot be determined
until apply, so OpenTofu cannot predict how many instances will be created.
...
```

The [`assume...` functions](https://opentofu.org/docs/language/functions/assume_family/) let the module author state what is true about the value even before it exists. Our first attempt failed:

```text
Error: Invalid function argument

  on modules/network/main.tf line 8, in output "vpc_id":
   8:   value = assumenotnull(terraform_data.vpc.output)

Invalid value for "value" parameter: given value must have a known type;
consider using the \"convert\" function to specify a type to assume.
```

`terraform_data.output` takes on the type of `input`, so its type is also unknown during the plan. Most provider attributes, such as `aws_vpc.id`, are typed strings and do not have this problem. For a value like this, the docs tell you to combine the hint with the new [`convert`](https://opentofu.org/docs/language/functions/convert/) function:

```hcl
output "vpc_id" {
  value = assumenotnull(convert(terraform_data.vpc.output, string))
}
```

```text
$ tofu-1.13.1 plan | grep -E 'will be created|Plan:'
  # module.flow_logs.terraform_data.flow_log[0] will be created
  # module.network.terraform_data.vpc will be created
Plan: 2 to add, 0 to change, 0 to destroy.

$ tofu-1.13.1 apply -auto-approve | tail -1
Apply complete! Resources: 2 added, 0 changed, 0 destroyed.
```

The usual workaround for this error is a two-step apply with `-exclude` (the error message itself suggests it). Here, one plan is enough.

A hint is a promise, and OpenTofu checks it. The docs say that if the value turns out to be null, "the function raises an error", so the apply fails. Use a hint only where the provider really guarantees it, for example that an ID is never null after create.

### Catch wiring mistakes at plan time

`assumestringprefix` is useful together with variable validation. Here the caller connects the subnet output to an input that expects a VPC ID, a mistake that is easy to miss in review:

```hcl
# main.tf
module "flow_logs" {
  source = "./modules/flow_logs"
  vpc_id = module.network.subnet_id # wrong output wired in
}

# modules/flow_logs/main.tf
variable "vpc_id" {
  type = string

  validation {
    condition     = startswith(var.vpc_id, "vpc-")
    error_message = "vpc_id must be a VPC id (vpc-...)."
  }
}
```

Without hints, the plan passes because the value is unknown, and validation waits for apply. The apply created the VPC and the subnet, and then failed. Both outputs are filtered to the key lines, and the IDs are shortened:

```text
$ tofu-1.13.1 plan
Plan: 3 to add, 0 to change, 0 to destroy.
$ tofu-1.13.1 apply -auto-approve
module.network.terraform_data.subnet: Creation complete after 0s [id=...]
module.network.terraform_data.vpc: Creation complete after 0s [id=...]
Error: Invalid value for variable
vpc_id must be a VPC id (vpc-...).
$ tofu-1.13.1 state list
module.network.terraform_data.subnet
module.network.terraform_data.vpc
```

Then we added prefix hints to the network module outputs:

```hcl
output "vpc_id" {
  value = assumenotnull(assumestringprefix(convert(terraform_data.vpc.output, string), "vpc-"))
}

output "subnet_id" {
  value = assumenotnull(assumestringprefix(convert(terraform_data.subnet.output, string), "subnet-"))
}
```

Now the same mistake fails the plan, before anything is created:

```text
$ tofu-1.13.1 plan
Error: Invalid value for variable

  on main.tf line 7, in module "flow_logs":
   7:   vpc_id = module.network.subnet_id # wrong output wired in
    ├────────────────
    │ var.vpc_id is a string

vpc_id must be a VPC id (vpc-...).

This was checked by the validation rule at modules/flow_logs/main.tf:4,3-13.
```

If you maintain shared modules, the outputs of your network, IAM and DNS modules are the best places for these hints. Callers get the benefit without changing their own code. `assumeequal` goes further: the docs show it with the AWS provider's `arn_build` function to make an IAM role ARN fully known at plan time, so that policy checks can see the real policy document.

### Guard the module version correctly

A module that uses these functions does not work on older versions, and the errors are not clear. On 1.12.7, `assumenotnull(...)` alone gives `Call to unknown function`. With `convert(..., string)`, the error is `Invalid reference`, because 1.12 reads `string` as a resource address. Terraform 1.16.5 also gives `Call to unknown function`.

You would usually add `required_version = ">= 1.13.0"` to a `terraform` block. That does not work here. Since 1.12, OpenTofu ignores `required_version` in `.tf` files and honors it only in `.tofu` files (see the [RFC tracking issue](https://github.com/opentofu/opentofu/issues/3300) and the [settings docs](https://opentofu.org/docs/language/settings/)). We tested this with a constraint that no version can meet:

| Constraint and file                                                        | 1.12.7                   | 1.13.1                   |
| -------------------------------------------------------------------------- | ------------------------ | ------------------------ |
| `required_version = ">= 99.0"` in `main.tf`                                | ignored, validate passes | ignored, validate passes |
| `required_version = ">= 99.0"` in `versions.tofu`                          | `Incompatible module`    | `Incompatible module`    |
| `language { compatible_with { opentofu = ">= 1.13" } }` in `versions.tofu` | `Incompatible module`    | plan passes              |

So put the guard in a `.tofu` file:

```hcl
# versions.tofu (the language block needs OpenTofu 1.12 or later)
language {
  compatible_with {
    opentofu = ">= 1.13"
  }
}
```

On 1.12.7 this gives `This module is not compatible with OpenTofu v1.12.7`, which is the clear message you want. If a module must also work with Terraform, use the `.tofu` precedence rule: when `outputs.tf` and `outputs.tofu` are both present, OpenTofu loads only the `.tofu` file. We put a hinted output in `outputs.tofu` and a plain one in `outputs.tf`. `tofu validate` (1.13.1) and `terraform validate` (1.16.5) both passed.

## The lint experiment

`validate`, `plan`, `apply` and `refresh` accept a new `-lint` flag. 1.13 has four rules, all for the root module only: `core:no-type-variable`, `core:unused-variable`, `core:unused-local`, and `core:count-instead-enabled`. The last one suggests the `enabled` lifecycle argument instead of `count = cond ? 1 : 0`. We ran the experiment on a small file that breaks all four rules:

```text
$ tofu-1.13.1 validate -lint=all -json | jq -r '.diagnostics[] | select(.severity == "warning") | .summary'
Experimental linting enabled
Input variable not used (core:unused-variable)
Local value not used (core:unused-local)
Could use enabled instead of count (core:count-instead-enabled)
Variable with no type (core:no-type-variable)
```

The exit code was 0. Lint results are warnings, and OpenTofu always adds an "Experimental linting enabled" warning. You can turn off one rule with `!`, for example `-lint='all,!core:unused-variable'`. The [linting docs](https://opentofu.org/docs/language/linting/) say that rules can change even in minor releases. For now, make it a non-blocking CI step and read the output. Do not gate merges on it yet.

## Smaller changes worth a line

- **Plan text.** After `No changes. Your infrastructure matches the configuration.`, 1.12.7 printed one more paragraph ("OpenTofu has compared your real infrastructure ... no changes are needed."). 1.13.1 does not. If a script greps for that paragraph, change it to use `tofu plan -detailed-exitcode`, which returns 0 for no changes, 1 for errors, and 2 for changes. Our upgrade plan returned 2.
- **Platforms.** Windows on ARM64 is now an official platform, and macOS builds require macOS 13 Ventura or later.
- **State encryption.** The `aws_kms` key provider accepts an `encryption_context`. `gcp_kms` accepts `additional_authenticated_data`, and `openbao` accepts `associated_data`.
- **Crash recovery.** A Go panic now writes a partial `errored.tfstate` to help you recover.
- **Saved plans** include the provider schemas, so `tofu show` on a plan file usually does not need to start providers.
- **If you stay on 1.12 for now**, take [1.12.7](https://github.com/opentofu/opentofu/releases/tag/v1.12.7). It fixes a deadlock that an attacker-controlled SSH server could cause in `remote-exec` and `file` provisioners (CVE-2026-78662).

## Upgrade checklist

1. After `tofu init`, search your code and `.terraform/modules` for `base64gzip(` and `"winrm"`, and look for `connection` blocks whose type comes from a variable.
2. Remove WinRM provisioners **before** you upgrade. Validate and plan will not stop you, and a failure at apply taints the resource.
3. Run a 1.13.1 plan against real state in a throwaway job, save it, and run the `jq` filter. Every changed attribute should be user data.
4. For each user data change, decide: accept the stop/start or replacement in a window, or use a temporary `ignore_changes` with a ticket to remove it.
5. Check `tofu version` on every runner and workstation image, and move anything on `linux_arm` or `linux_386` to 64-bit before August 1, 2027.
6. Change scripts that read plan text to use `-detailed-exitcode`.
7. In shared modules, add `assume...` hints to outputs whose IDs callers use in `count`, `for_each` or validation. Put a `language` block in a `.tofu` file to guard them.
8. Add `-lint=all` to CI as a non-blocking step and see what it finds.

The upgrade is not hard, but two of these changes are not visible until a specific step: the base64gzip diff shows only in a plan against real state, and the WinRM removal shows only at apply. If you run steps 1 to 3 first, you see both before they affect a real server.
