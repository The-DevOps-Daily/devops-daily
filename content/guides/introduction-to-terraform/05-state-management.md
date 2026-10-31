---
title: 'Terraform State Management: Commands, Drift and Locking'
description: 'Inspect and change Terraform state safely: state list, show, mv and rm, moved, removed and import blocks, refresh-only plans for drift, and state locks.'
order: 5
---

**TLDR**: Terraform records every object it manages in the **state** (`terraform.tfstate` by default). Read it with `terraform state list`, `terraform state show` and `terraform show`, never by editing the JSON. Rename resources with `moved` blocks, adopt existing objects with `import` blocks, stop managing objects with `removed` blocks, and accept changes made outside Terraform with `terraform apply -refresh-only` (the old `terraform refresh` is deprecated). A **state lock** stops two runs from writing at the same time; `force-unlock` is for locks left behind by a crashed run. State holds secrets in plain text, so protect it like a secret.

Most Terraform problems that keep people up at night are state problems: a resource Terraform "forgot", a rename that destroyed a database, a lock nobody can release. This part shows what the state contains and walks through every common state operation on a real project, with the output each command prints in Terraform 1.17.

## Prerequisites

- Terraform installed ([Part 2](/guides/introduction-to-terraform/02-installation-and-setup)) and the resources from [Part 4](/guides/introduction-to-terraform/04-resources-and-data-sources).
- No cloud account: the examples use the `local` and `random` providers.

## What State Is and Why Terraform Needs It

Your configuration says what should exist; it does not say which real object is which. The state is the mapping between the two: for each resource address it stores the object's ID and the attributes the provider returned. Terraform uses it to:

- **Map code to real objects.** `aws_instance.web` in your code is `i-0b5c...` in AWS only because the state says so.
- **Plan updates and deletions.** Without a record, Terraform could not know that it created something you have since removed from the code.
- **Order deletions.** The state stores each object's dependencies, so Terraform can destroy objects in the right order even after you deleted their blocks.
- **Plan faster.** Large configurations can skip some API reads with `-refresh=false` because the last known values are in the state.

Create a small project to look at:

```hcl
terraform {
  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.9"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
  }
}

resource "random_pet" "server" {
  length = 2
}

resource "random_password" "db" {
  length  = 20
  special = false
}

resource "local_file" "config" {
  filename = "${path.module}/app.conf"
  content  = "server=${random_pet.server.id}\n"
}
```

```terminal
{
  "title": "create the project",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform init"
    },
    {
      "cmd": "terraform apply -auto-approve",
      "output": "Apply complete! Resources: 3 added, 0 changed, 0 destroyed."
    }
  ]
}
```

## Inspect the State

Use Terraform's commands to read state. They work the same for a local file and for state in S3 or HCP Terraform:

```terminal
{
  "title": "read the state",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform state list",
      "output": "local_file.config\nrandom_password.db\nrandom_pet.server"
    },
    {
      "cmd": "terraform state show random_pet.server",
      "output": "# random_pet.server:\nresource \"random_pet\" \"server\" {\n    id        = \"decent-lemming\"\n    length    = 2\n    separator = \"-\"\n}"
    },
    {
      "cmd": "terraform state show random_password.db",
      "output": "# random_password.db:\nresource \"random_password\" \"db\" {\n    bcrypt_hash = (sensitive value)\n    id          = \"none\"\n    length      = 20\n    lower       = true\n    min_lower   = 0\n    min_numeric = 0\n    min_special = 0\n    min_upper   = 0\n    number      = true\n    numeric     = true\n    result      = (sensitive value)\n    special     = false\n    upper       = true\n}"
    }
  ]
}
```

- `terraform state list` prints every resource address. Add an address prefix to filter: `terraform state list module.network` or `terraform state list 'local_file.by_key'`.
- `terraform state show ADDRESS` prints one object. It is the quickest way to find an ID or attribute you need. Sensitive attributes, such as the generated password, show as `(sensitive value)`.
- `terraform show` prints every object in the same format, followed by the outputs.

For scripts, use JSON. `terraform show -json` prints the whole state; since Terraform 1.16, `terraform state show -json` also works for one object:

```terminal
{
  "title": "state as JSON",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform state show -json random_pet.server | jq .resource.values",
      "output": "{\n  \"id\": \"decent-lemming\",\n  \"keepers\": null,\n  \"length\": 2,\n  \"prefix\": null,\n  \"separator\": \"-\"\n}"
    }
  ]
}
```

### Inside terraform.tfstate

The file itself is JSON. Its top level looks like this:

```terminal
{
  "title": "the raw state file",
  "prompt": "$",
  "steps": [
    {
      "cmd": "jq '{version, terraform_version, serial, lineage, resources: [.resources[] | .type + \".\" + .name]}' terraform.tfstate",
      "output": "{\n  \"version\": 4,\n  \"terraform_version\": \"1.17.0\",\n  \"serial\": 4,\n  \"lineage\": \"55754427-5feb-acb7-14bc-39497fff5d74\",\n  \"resources\": [\n    \"local_file.config\",\n    \"random_password.db\",\n    \"random_pet.server\"\n  ]\n}"
    }
  ]
}
```

- `version` is the format of the file (4 since Terraform 0.12). `terraform_version` is the version that last wrote it.
- `serial` goes up by one on every write. `lineage` is a random ID set when the state was first created. Together they stop Terraform from overwriting a newer state with an older copy, or with the state of a different project.
- `resources` holds each object with its attributes and dependencies.

Now the part that surprises people:

```terminal
{
  "title": "secrets are stored in plain text",
  "prompt": "$",
  "steps": [
    {
      "cmd": "jq -r '.resources[] | select(.type == \"random_password\") | .instances[0].attributes.result' terraform.tfstate",
      "output": "kIEmDHkuKdedLVKC1dLI"
    }
  ]
}
```

`terraform show` hid the password, but the state file stores it in plain text. The same happens with database passwords, private keys and access tokens that resources return. `sensitive = true` only hides values in CLI output. So:

- Never commit state to Git, and keep it in a backend with encryption at rest and tight access control ([Part 9](/guides/introduction-to-terraform/09-remote-backends-and-collaboration)).
- Prefer ephemeral resources and write-only arguments, which keep secrets out of state entirely ([Part 10](/guides/introduction-to-terraform/10-best-practices-and-production-patterns#h2-keep-secrets-out-of-state)).
- Treat anyone who can read the state as someone who can read every secret in it.

Do not edit the file by hand. If you must repair state, pull it (`terraform state pull > backup.tfstate`), use the commands below, and push a fixed copy only as a last resort (`terraform state push`), because a mistake there corrupts the record of everything you manage.

## Drift: Changes Made Outside Terraform

Drift is the difference between the state and the real object, usually because someone changed it in a console or another tool. Simulate it by editing the managed file by hand:

```terminal
{
  "title": "a change outside Terraform",
  "prompt": "$",
  "steps": [
    {
      "cmd": "echo \"server=edited-by-hand\" > app.conf"
    },
    {
      "cmd": "terraform plan",
      "output": "random_pet.server: Refreshing state... [id=decent-lemming]\nrandom_password.db: Refreshing state... [id=none]\nlocal_file.config: Refreshing state... [id=fc35ab0a2b0d1f66962c2d9d2d25f977d889bdd3]\n\nTerraform used the selected providers to generate the following execution\nplan. Resource actions are indicated with the following symbols:\n  + create\n\nTerraform will perform the following actions:\n\n  # local_file.config will be created\n  + resource \"local_file\" \"config\" {\n      + content              = <<-EOT\n            server=decent-lemming\n        EOT\n      + content_base64sha256 = (known after apply)\n      + content_base64sha512 = (known after apply)\n      + content_md5          = (known after apply)\n      + content_sha1         = (known after apply)\n      + content_sha256       = (known after apply)\n      + content_sha512       = (known after apply)\n      + directory_permission = \"0777\"\n      + file_permission      = \"0777\"\n      + filename             = \"./app.conf\"\n      + id                   = (known after apply)\n    }\n\nPlan: 1 to add, 0 to change, 0 to destroy.\n\n─────────────────────────────────────────────────────────────────────────────\n\nNote: You didn't use the -out option to save this plan, so Terraform can't\nguarantee to take exactly these actions if you run \"terraform apply\" now."
    }
  ]
}
```

On every plan, Terraform first **refreshes**: it asks the provider to read each object again. The `local` provider reports a file whose content no longer matches as gone, so the plan writes it again with the content from the code. A cloud provider usually reports the changed attributes instead, and the plan shows an update (`~`) that sets them back. Either way, the code is the source of truth, and `apply` undoes the manual change. That is what you want most of the time.

Sometimes the manual change is correct (an emergency fix in the console, a size someone raised during an incident). Then you update the code to match and, if the provider cannot express the change as a plan, record the new reality in the state without touching any object:

```terminal
{
  "title": "terraform apply -refresh-only",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform apply -refresh-only -auto-approve",
      "output": "random_pet.server: Refreshing state... [id=decent-lemming]\nrandom_password.db: Refreshing state... [id=none]\nlocal_file.config: Refreshing state... [id=fc35ab0a2b0d1f66962c2d9d2d25f977d889bdd3]\n\nNote: Objects have changed outside of Terraform\n\nTerraform detected the following changes made outside of Terraform since the\nlast \"terraform apply\" which may have affected this plan:\n\n  # local_file.config has been deleted\n  - resource \"local_file\" \"config\" {\n      - content              = <<-EOT\n            server=decent-lemming\n        EOT -> null\n      - content_base64sha256 = \"9AKAhJOfKcA6e4WN7e+nAV28nDeT0Dk+bGthc7igkxw=\" -> null\n      - content_base64sha512 = \"rMNc23HGcmcakVjTubRrbo9/gay07uuYmWdzaKiZmMzGvAIADlfVgleBzf1hHQL31GcKMCtc0BvrtbAQXl1TBg==\" -> null\n      - content_md5          = \"a59157892c67a56a714d341ba19720e7\" -> null\n      - content_sha1         = \"fc35ab0a2b0d1f66962c2d9d2d25f977d889bdd3\" -> null\n      - content_sha256       = \"f4028084939f29c03a7b858dedefa7015dbc9c3793d0393e6c6b6173b8a0931c\" -> null\n      - content_sha512       = \"acc35cdb71c672671a9158d3b9b46b6e8f7f81acb4eeeb9899677368a89998ccc6bc02000e57d5825781cdfd611d02f7d4670a302b5cd01bebb5b0105e5d5306\" -> null\n      - directory_permission = \"0777\" -> null\n      - file_permission      = \"0777\" -> null\n      - filename             = \"./app.conf\" -> null\n      - id                   = \"fc35ab0a2b0d1f66962c2d9d2d25f977d889bdd3\" -> null\n    }\n\n\nThis is a refresh-only plan, so Terraform will not take any actions to undo\nthese. If you were expecting these changes then you can apply this plan to\nrecord the updated values in the Terraform state without changing any remote\nobjects.\n\nApply complete! Resources: 0 added, 0 changed, 0 destroyed."
    }
  ]
}
```

`apply -refresh-only` lists everything that changed outside Terraform (here, the file counts as deleted) and updates only the state. It replaces the old `terraform refresh` command, which still exists but is deprecated because it writes the state without showing you anything first. A plain `terraform plan -refresh-only` shows the drift without saving it, which makes it a good scheduled drift check. Here, the provider reported the edited file as gone, so the refresh removed it from the state, and the next plan creates it again:

```terminal
{
  "title": "the next plan recreates the file",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform plan -no-color | grep -E '^  #|^Plan'",
      "output": "  # local_file.config will be created\nPlan: 1 to add, 0 to change, 0 to destroy."
    },
    {
      "cmd": "terraform apply -auto-approve"
    }
  ]
}
```

Two flags change how much Terraform refreshes. `-refresh=false` skips the refresh entirely (faster, but blind to drift), and `-minimal-refresh`, new in Terraform 1.17, only refreshes resources that have changes in your configuration, which speeds up plans of large configurations. The post [What Does Terraform Refresh Really Do?](/posts/terraform-refresh-explained) goes deeper, and [-minimal-refresh, measured](/posts/terraform-1-17-minimal-refresh-measured) shows what the flag saves on 202 resources and which drift it misses.

## Refactor Without Destroying Anything

When you rename a resource in code, Terraform sees one address disappear and a new one appear: by default it destroys the old object and creates a new one. For a server or a database, that is an outage. Tell Terraform about the rename instead.

### Rename With a moved Block

Rename `random_pet.server` to `random_pet.web`, update the reference, and add a `moved` block. This version also splits the code into files: `main.tf` keeps only the `terraform` block, and the resources move to `pet.tf` and `app.tf`:

```hcl
resource "random_pet" "web" {
  length = 2
}

moved {
  from = random_pet.server
  to   = random_pet.web
}
```

```hcl
resource "random_password" "db" {
  length  = 20
  special = false
}

resource "local_file" "config" {
  filename = "${path.module}/app.conf"
  content  = "server=${random_pet.web.id}\n"
}
```

```terminal
{
  "title": "a moved block in a plan",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform plan",
      "output": "random_pet.web: Refreshing state... [id=decent-lemming]\nrandom_password.db: Refreshing state... [id=none]\nlocal_file.config: Refreshing state... [id=fc35ab0a2b0d1f66962c2d9d2d25f977d889bdd3]\n\nTerraform will perform the following actions:\n\n  # random_pet.server has moved to random_pet.web\n    resource \"random_pet\" \"web\" {\n        id        = \"decent-lemming\"\n        # (2 unchanged attributes hidden)\n    }\n\nPlan: 0 to add, 0 to change, 0 to destroy.\n\n─────────────────────────────────────────────────────────────────────────────\n\nNote: You didn't use the -out option to save this plan, so Terraform can't\nguarantee to take exactly these actions if you run \"terraform apply\" now."
    }
  ]
}
```

The plan moves the object in the state and changes nothing else. `moved` blocks live in code, so they go through code review, they work in CI where nobody runs `state` commands by hand, and they apply for everyone who uses the module. Keep them for a while (until every copy of the state has been applied), then delete them. They also handle moves into and out of modules (`from = aws_instance.web`, `to = module.web.aws_instance.this`) and from `count` to `for_each` (`from = aws_instance.web[0]`, `to = aws_instance.web["blog"]`).

Apply it to record the move in the state:

```terminal
{
  "title": "apply the move",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform apply -auto-approve",
      "output": "Apply complete! Resources: 0 added, 0 changed, 0 destroyed."
    }
  ]
}
```

The older command-line way is `terraform state mv`. It changes the state immediately, without a plan, so use it for one-off fixes on your own state:

```terminal
{
  "title": "terraform state mv after renaming local_file.config in the code",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform state mv local_file.config local_file.app_config",
      "output": "Move \"local_file.config\" to \"local_file.app_config\"\nSuccessfully moved 1 object(s)."
    },
    {
      "cmd": "terraform plan",
      "output": "Terraform has compared your real infrastructure against your configuration\nand found no differences, so no changes are needed."
    }
  ]
}
```

### Stop Managing an Object Without Deleting It

To hand an object over to another configuration, or to leave it alone for good, delete its resource block and add a `removed` block with `destroy = false`:

```hcl
removed {
  from = random_password.db

  lifecycle {
    destroy = false
  }
}
```

```terminal
{
  "title": "a removed block",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform apply -auto-approve",
      "output": "random_pet.web: Refreshing state... [id=decent-lemming]\nlocal_file.app_config: Refreshing state... [id=fc35ab0a2b0d1f66962c2d9d2d25f977d889bdd3]\n\nTerraform used the selected providers to generate the following execution\nplan. Resource actions are indicated with the following symbols:\n\nTerraform will perform the following actions:\n\n # random_password.db will no longer be managed by Terraform, but will not be destroyed\n # (destroy = false is set in the configuration)\n . resource \"random_password\" \"db\" {\n        id          = \"none\"\n        # (12 unchanged attributes hidden)\n    }\n\nPlan: 0 to add, 0 to change, 0 to destroy.\n╷\n│ Warning: Some objects will no longer be managed by Terraform\n│\n│ If you apply this plan, Terraform will discard its tracking information for\n│ the following objects, but it will not delete them:\n│  - random_password.db\n│\n│ After applying this plan, Terraform will no longer manage these objects.\n│ You will need to import them into Terraform to manage them again.\n╵\n\nApply complete! Resources: 0 added, 0 changed, 0 destroyed."
    },
    {
      "cmd": "terraform state list",
      "output": "local_file.app_config\nrandom_pet.web"
    }
  ]
}
```

Terraform no longer tracks the object. For a resource that stands for something real, such as a server, a bucket or a file, that object stays where it is. (A `random_password` exists only in the state, so here the generated value is simply dropped.) Without the `removed` block, deleting the resource block would destroy the object. Once the change is applied everywhere, you can delete the `removed` block too. The command-line equivalent is `terraform state rm ADDRESS`; try it safely with `-dry-run` first:

```terminal
{
  "title": "terraform state rm -dry-run",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform state rm -dry-run local_file.app_config",
      "output": "Would remove local_file.app_config"
    }
  ]
}
```

Since Terraform 1.16, you can also put `destroy = false` in a resource's own `lifecycle` block. Then a replacement, a `terraform destroy`, or an instance that drops out of `count` or `for_each` forgets the old object instead of deleting it; the plan marks those objects with `.` and `./+` and warns that they will no longer be managed. It does not help when you delete the whole resource block, because the setting goes with it: that case needs the `removed` block above.

## Import Existing Objects

The opposite problem: the object exists (someone created it by hand, or you are moving it from another configuration), and you want Terraform to manage it. An `import` block names the address and the object's ID. This example imports a random number; for a real resource the ID is what the provider's documentation says, such as an instance ID or a bucket name.

```hcl
import {
  to = random_integer.port
  id = "8443,1024,65535" # result,min,max for this resource type
}
```

You do not even have to write the resource block. `-generate-config-out` writes it for you from the real object:

```terminal
{
  "title": "generate configuration for an import",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform plan -generate-config-out=generated.tf",
      "output": "random_integer.port: Preparing import... [id=8443,1024,65535]\nrandom_pet.web: Refreshing state... [id=decent-lemming]\nrandom_integer.port: Refreshing state... [id=8443]\nlocal_file.app_config: Refreshing state... [id=fc35ab0a2b0d1f66962c2d9d2d25f977d889bdd3]\n\nTerraform will perform the following actions:\n\n  # random_integer.port will be imported\n  # (config will be generated)\n    resource \"random_integer\" \"port\" {\n        id     = \"8443\"\n        max    = 65535\n        min    = 1024\n        result = 8443\n    }\n\nPlan: 1 to import, 0 to add, 0 to change, 0 to destroy.\n\n─────────────────────────────────────────────────────────────────────────────\n\nNote: You didn't use the -out option to save this plan, so Terraform can't\nguarantee to take exactly these actions if you run \"terraform apply\" now."
    },
    {
      "cmd": "cat generated.tf",
      "output": "# __generated__ by Terraform\n# Please review these resources and move them into your main configuration files.\n\n# __generated__ by Terraform from \"8443,1024,65535\"\nresource \"random_integer\" \"port\" {\n  keepers = null\n  max     = 65535\n  min     = 1024\n  seed    = null\n}"
    }
  ]
}
```

Review the generated code, move it where it belongs, then apply. The plan and apply summaries count imports separately:

```terminal
{
  "title": "apply the import",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform apply -auto-approve",
      "output": "random_integer.port: Preparing import... [id=8443,1024,65535]\nrandom_pet.web: Refreshing state... [id=decent-lemming]\nrandom_integer.port: Refreshing state... [id=8443]\nlocal_file.app_config: Refreshing state... [id=fc35ab0a2b0d1f66962c2d9d2d25f977d889bdd3]\n\nTerraform will perform the following actions:\n\n  # random_integer.port will be imported\n    resource \"random_integer\" \"port\" {\n        id     = \"8443\"\n        max    = 65535\n        min    = 1024\n        result = 8443\n    }\n\nPlan: 1 to import, 0 to add, 0 to change, 0 to destroy.\nrandom_integer.port: Importing... [id=8443,1024,65535]\nrandom_integer.port: Import complete [id=8443,1024,65535]\n\nApply complete! Resources: 1 imported, 0 added, 0 changed, 0 destroyed."
    }
  ]
}
```

For real cloud resources, the generated code often needs cleanup (computed values written as literals, defaults spelled out), so read it before you commit it. Import blocks accept `for_each` since Terraform 1.7, and work inside modules since 1.16:

```hcl
variable "bucket_names" {
  type    = set(string)
  default = ["acme-logs", "acme-assets"]
}

import {
  for_each = var.bucket_names
  to       = aws_s3_bucket.this[each.key]
  id       = each.key # the S3 import ID is the bucket name
}

resource "aws_s3_bucket" "this" {
  for_each = var.bucket_names
  bucket   = each.key
}
```

The older `terraform import ADDRESS ID` command still works, but it changes the state immediately and needs the resource block to exist first. Import blocks are planned, reviewed and repeatable, so prefer them. Since Terraform 1.14, some providers also support `terraform query` with `list` blocks in `.tfquery.hcl` files, which finds existing objects in an account and can generate import blocks for all of them.

## State Locking

Two `apply` runs writing the same state at the same time would corrupt it, so Terraform **locks** the state for every operation that may write it. The local backend uses a file lock; S3 uses a lock file next to the state, other backends use their own mechanism ([Part 9](/guides/introduction-to-terraform/09-remote-backends-and-collaboration)). Here is what a second run sees while a slow apply holds the lock, in a new directory called `locking` with this `main.tf` (run `terraform init` first):

```hcl
# Takes about 10 seconds to "create", so there is time to start a second run
resource "terraform_data" "slow" {
  provisioner "local-exec" {
    command = "sleep 10"
  }
}
```

```terminal
{
  "title": "a second run while the state is locked",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform apply -auto-approve > apply.log &"
    },
    {
      "cmd": "terraform plan",
      "output": "╷\n│ Error: Error acquiring the state lock\n│\n│ Error message: resource temporarily unavailable\n│ Lock Info:\n│   ID:        2ab78a17-06fc-83e4-d6e7-d8968e9c6f46\n│   Path:      terraform.tfstate\n│   Operation: OperationTypeApply\n│   Who:       dev@devbox\n│   Version:   1.17.0\n│   Created:   2026-10-23 23:08:28.990847457 +0000 UTC\n│   Info:\n│\n│\n│ Terraform acquires a state lock to protect the state from being written\n│ by multiple users at the same time. Please resolve the issue above and try\n│ again. For most commands, you can disable locking with the \"-lock=false\"\n│ flag, but this is not recommended.\n╵"
    },
    {
      "cmd": "terraform plan -lock-timeout=60s | tail -3",
      "output": "Terraform has compared your real infrastructure against your configuration\nand found no differences, so no changes are needed."
    }
  ]
}
```

The error names who holds the lock (user and host), the operation, and when it started. With `-lock-timeout=60s`, the second run waits for the lock instead of failing, and goes ahead once the first apply finishes. Use a timeout like that in CI, where two pipelines can overlap.

If a run crashed or was killed and left a lock behind on a remote backend, release it with the lock ID from the error message:

```bash
terraform force-unlock 3b6a1f8c-2c9e-4b8a-9d55-0f1e2a3b4c5d
```

Only do this after you have checked that the run that owns the lock is really gone (the CI job is finished, the colleague's laptop is not mid-apply). Unlocking a live run is how state gets corrupted. The posts [Terraform Statefile is Locked: How to Unlock It](/posts/terraform-statefile-locked) and [Fix Error Acquiring the State Lock: ConditionalCheckFailedException](/posts/fix-error-acquiring-the-state-lock-conditionalcheckfailedexception) cover backend-specific cases.

## Backups and Recovery

The local backend writes `terraform.tfstate.backup` (the previous version) on every change. With a remote backend, plan and apply do not write local backups; recovery relies on versioning in the storage (S3 object versions, Azure blob versions, GCS object versions), on the state history in HCP Terraform, or on database backups for `pg`. Turn that on before you need it. The `terraform state` subcommands that change state, such as `mv` and `rm`, are the exception: they always write a local backup file, also for remote state, and you cannot turn that off. Those files contain the full state, secrets included, so delete them or store them as carefully as the state itself (`-backup=PATH` chooses where they go).

| Problem                                                 | What to do                                                                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A resource was deleted outside Terraform                | Run a plan: the refresh notices it's gone and plans to create it again. If it should stay gone, delete the block or add a `removed` block |
| Terraform wants to create something that already exists | `import` it instead of creating a duplicate                                                                                               |
| You renamed a resource and the plan wants to destroy it | Add a `moved` block                                                                                                                       |
| The state file is corrupted or was overwritten          | Restore the previous version from backend versioning (or `terraform.tfstate.backup` locally), then run a plan to see the difference       |
| The state is lost completely                            | Recreate it with `import` blocks for every object, then plan until there are no changes                                                   |

## Upgrading Terraform and the State

Any newer Terraform 1.x can read and upgrade state written by an older 1.x. Going back to an older version is not guaranteed, because a newer release may store things an older one does not understand. In a team, upgrade CI and every laptop together, and pin the version in code so a forgotten old binary fails early:

```hcl
terraform {
  required_version = "~> 1.17.0" # 1.17.x only
}
```

Use `">= 1.17"` instead if you are happy for newer minor versions to run the code. [Part 10](/guides/introduction-to-terraform/10-best-practices-and-production-patterns#h2-pin-versions-and-commit-the-lock-file) covers version pinning in more detail.

## Common Mistakes

- **Renaming resources without `moved` blocks.** The plan shows a destroy and a create. Read it before you approve.
- **Running `state` commands against shared state casually.** `state mv`, `state rm` and `state push` take effect immediately and have no plan. Pull a backup first.
- **Using `terraform refresh`.** Use `terraform apply -refresh-only`, which shows the changes before it saves them.
- **Force-unlocking a lock that is still in use.** Find the owner first.
- **Committing state or saved plan files to Git.** Both contain secrets.
- **One huge state for everything.** Every plan reads every object, and every mistake can touch everything. Split state by environment and by component ([Part 8](/guides/introduction-to-terraform/08-working-with-multiple-environments)).

## Summary

- State maps your code to real objects and stores their attributes, including secrets in plain text.
- Read it with `state list`, `state show` and `show`; script against `-json` output.
- Refactor with `moved`, adopt with `import`, let go with `removed`: all planned and reviewed.
- `apply -refresh-only` accepts drift; a normal apply undoes it.
- Locks protect against concurrent writes; use `-lock-timeout` in CI and `force-unlock` only for dead runs.

In [Part 6](/guides/introduction-to-terraform/06-variables-and-outputs) you make configurations reusable with variables and outputs.

## Keep Learning

- [Terraform State: Remove, Move and Migrate Resources, and Set Up a Remote Backend](/posts/terraform-state-remove-move-migrate-backend)
- [Who Owns the State File, and Other Questions That Decide Your Week](/posts/who-owns-the-terraform-state-file)
- [How to Fix Terraform Import "Index Value Required" Error for String Keys](/posts/terraform-import-index-value-required-error)
- [Interview question: Terraform state management](/interview-questions/mid/terraform-state-management)
- [Terraform puzzle game](/games/terraform-puzzle)
