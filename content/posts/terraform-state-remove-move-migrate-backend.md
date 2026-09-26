---
title: 'Terraform State: Remove, Move and Migrate Resources, and Set Up a Remote Backend'
excerpt: 'The state questions every Terraform team hits: how to stop managing a resource without deleting it, rename one without a rebuild, move it to another project, bootstrap a remote backend, and why the DynamoDB lock table is on its way out. Every command here was run on Terraform 1.15.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2026-09-26'
publishedAt: '2026-09-26T09:00:00Z'
updatedAt: '2026-09-26T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Terraform
  - Terraform State
  - Infrastructure as Code
  - S3
  - DigitalOcean
  - DevOps
---

Terraform state is the file that maps every resource in your configuration to a real object somewhere: an instance ID, a bucket name, a DNS record. Most days you never look at it. Then someone renames a resource, splits a repository, or needs Terraform to let go of a database without deleting it, and suddenly the state file is the only thing that matters.

This post covers the state operations that come up again and again: removing a resource from state, renaming or moving it, carrying it to another project, bootstrapping a remote backend, and the DynamoDB error people hit while building a lock table. Each one has an old way (a CLI command that edits state directly) and, in recent Terraform versions, a new way (a block in your configuration that goes through `plan` like any other change). The new way is almost always better, and the sections below show why.

All the terminal output in this post comes from real runs on Terraform 1.15.8, using the built-in `terraform_data` resource so the examples run anywhere without a cloud account.

## TLDR

- To stop managing a resource without destroying it, use a `removed` block with `destroy = false` (Terraform 1.7+). `terraform state rm` does the same thing but skips `plan`, and it will recreate the resource if you forget to delete it from the config.
- To rename a resource, use a `moved` block (Terraform 1.1+). It shows up in `plan` and gets code review. `terraform state mv` still works for one-off fixes.
- To move a resource to another project, remove it from the old one with a `removed` block and adopt it in the new one with an `import` block. Editing state files by hand is the fallback.
- To bootstrap a remote backend, create the bucket with local state first, then add the `backend` block and run `terraform init -migrate-state`.
- The S3 backend now locks with a lock file in the bucket (`use_lockfile = true`). Terraform 1.15 marks `dynamodb_table` as deprecated. That also works on S3-compatible storage like DigitalOcean Spaces.
- Never commit `.tfstate` to Git. Do commit `.terraform.lock.hcl`.

## Prerequisites

- Terraform 1.7 or later for `removed` blocks (1.11 or later for S3 lock files)
- A configuration with existing state to practice on, or the [Terraform terminal simulator](/games/terraform-terminal-simulator) if you want to try `terraform state list` in the browser first
- Access to an object storage bucket (AWS S3 or DigitalOcean Spaces) for the backend sections

## What state actually tracks

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Configuration", "sub": "what you want", "icon": "gear", "tone": "blue" },
    { "label": "State", "sub": "what Terraform thinks exists", "icon": "database", "tone": "amber" },
    { "label": "Real infrastructure", "sub": "what actually exists", "icon": "cloud", "tone": "green" }
  ]
}
```

Every `plan` compares three things: your configuration, the state file, and the real objects the provider can see. State is the link in the middle. It is keyed by **resource address** (`aws_instance.web`, `module.network.aws_vpc.main`), so almost every problem in this post comes down to one of two questions: which address points at which real object, and which state file holds that address.

You can see the addresses in your state at any time:

```terminal
{
  "title": "terraform state list",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "terraform state list", "output": "terraform_data.db\nterraform_data.web" }
  ]
}
```

## Stop managing a resource without deleting it

The situation: a database, a DNS zone or a bucket was created by Terraform, and now it should live outside this configuration. Maybe another team owns it, maybe you are splitting a repository. You want Terraform to forget it, not destroy it.

### The old way: terraform state rm

```terminal
{
  "title": "state rm, then plan",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "terraform state rm terraform_data.db", "output": "Removed terraform_data.db\nSuccessfully removed 1 resource instance(s)." },
    { "cmd": "terraform plan", "output": "...\nPlan: 1 to add, 0 to change, 0 to destroy." }
  ]
}
```

That second command is the trap. `state rm` removed the resource from state, but the `resource "terraform_data" "db"` block is still in the configuration, so the next plan wants to **create it again**. On a real database that means a second database, or a name collision. `state rm` only works safely when you delete the block from the configuration in the same change, and nothing in the workflow reminds you to do that.

It also skips `plan` entirely. The change happens the moment you press enter, it never shows up in a pull request, and in CI there is nothing to review.

### The new way: a removed block

Delete the resource block and put a `removed` block in its place:

```hcl
removed {
  from = terraform_data.db

  lifecycle {
    destroy = false # forget it, do not delete it
  }
}
```

Now the removal is a normal change that goes through `plan`:

```terminal
{
  "title": "plan with a removed block",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "terraform plan", "output": "Terraform will perform the following actions:\n  # terraform_data.db will no longer be managed by Terraform, but will not be destroyed\n  # (destroy = false is set in the configuration)\n  . resource \"terraform_data\" \"db\" {\n        id     = \"a38fe64a-ecd1-489f-f733-8048076db5f0\"\n        # (2 unchanged attributes hidden)\n    }\nPlan: 0 to add, 0 to change, 0 to destroy.\n\nWarning: Some objects will no longer be managed by Terraform" },
    { "cmd": "terraform apply -auto-approve", "output": "Apply complete! Resources: 0 added, 0 changed, 0 destroyed." },
    { "cmd": "terraform state list", "output": "terraform_data.web" }
  ]
}
```

The plan says exactly what will happen, your reviewer sees it, and there is no window where the configuration and the state disagree. Once the change is applied everywhere, you can delete the `removed` block. If you leave `destroy` out (it defaults to `true`), the block becomes a way to destroy a resource on purpose, which is also useful, just not here.

:::tip
Before any state change, take a copy: `terraform state pull > backup.tfstate`. It costs nothing and turns a bad afternoon into a two-minute restore. Plain `terraform state push backup.tfstate` refuses ("cannot import state with serial 3 over newer state with serial 4"), because the backup is older than the current state, so the restore is `terraform state push -force backup.tfstate`. Check twice before you use `-force`.
:::

## Rename or move a resource inside a project

Renaming `aws_instance.web` to `aws_instance.frontend` looks harmless in the code. Terraform sees it differently: one address disappeared and a new one appeared, so the plan destroys the old instance and creates a new one. For anything with data on it, that is an outage.

### The new way first: a moved block

```hcl
resource "terraform_data" "frontend" {
  input = "web-server"
}

moved {
  from = terraform_data.web
  to   = terraform_data.frontend
}
```

```terminal
{
  "title": "plan with a moved block",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "terraform plan", "output": "Terraform will perform the following actions:\n  # terraform_data.web has moved to terraform_data.frontend\n    resource \"terraform_data\" \"frontend\" {\n        id     = \"0f0915bf-cbea-ff5f-1129-a346d2268e84\"\n        # (2 unchanged attributes hidden)\n    }\nPlan: 0 to add, 0 to change, 0 to destroy." }
  ]
}
```

No destroy, no create, just a move that anyone can read in the pull request. `moved` blocks also handle the moves that are painful by hand: pulling resources into a module (`from = aws_s3_bucket.logs`, `to = module.logging.aws_s3_bucket.this`), or switching from `count` to `for_each` (`from = aws_instance.web[0]`, `to = aws_instance.web["primary"]`).

A `moved` block is cheap to keep. If other people or modules consume your code, leave it in for a release or two so their state catches up.

### The old way: terraform state mv

```terminal
{
  "title": "terraform state mv",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "terraform state mv terraform_data.frontend terraform_data.web", "output": "Move \"terraform_data.frontend\" to \"terraform_data.web\"\nSuccessfully moved 1 object(s)." },
    { "cmd": "terraform plan", "output": "No changes. Your infrastructure matches the configuration." }
  ]
}
```

It works, and for a quick fix on your own sandbox it is fine. The problem is the same as `state rm`: it changes shared state immediately, outside review, and the code change that goes with it has to land separately. In a team, prefer `moved`.

## Move resources to another project

Splitting a large configuration into smaller ones (network in one project, applications in another) means carrying resources from one state file to a different one. There are two ways to do it.

### The reviewable way: removed plus import

In the **source** project, delete the resource and let go of it:

```hcl
removed {
  from = aws_instance.web

  lifecycle {
    destroy = false
  }
}
```

In the **target** project, add the resource block and adopt the existing object with an `import` block (Terraform 1.5+):

```hcl
import {
  to = aws_instance.web
  id = "i-0a1b2c3d4e5f67890" # the real instance ID
}

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.small"
}
```

Apply the target first, then the source. The target's plan shows `1 to import`, and if your resource block does not match the real object, the plan shows the differences before anything changes. You can also run `terraform plan -generate-config-out=generated.tf` to have Terraform write a starting resource block from the real object. Both changes go through plan and review, and at no point does anyone edit a state file.

### The fallback: move between state files directly

Some resources cannot be imported, and sometimes you need to move dozens at once. `terraform state mv` can write to a different state file. With a remote backend, pull both states to local files, move the resource, and push them back:

```bash
# in the source project
terraform state pull > source.tfstate

# in the target project
terraform state pull > target.tfstate
terraform state mv -state=../source/source.tfstate -state-out=target.tfstate \
  aws_instance.web aws_instance.web
terraform state push target.tfstate

# back in the source project
terraform state push source.tfstate
```

Here is the core of it on two local projects:

```terminal
{
  "title": "move a resource to another project",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "terraform state mv -state=../source.tfstate -state-out=../network/terraform.tfstate terraform_data.web terraform_data.web", "output": "Move \"terraform_data.web\" to \"terraform_data.web\"\nSuccessfully moved 1 object(s)." },
    { "comment": "in the target project, which now holds the resource" },
    { "cmd": "terraform state list", "output": "terraform_data.web" },
    { "cmd": "terraform plan", "output": "No changes. Your infrastructure matches the configuration." }
  ]
}
```

Nobody else should run Terraform against either project while you do this, and you should keep the backups from the tip above. It works, but it is the one method in this post with no plan to check before the change happens.

## Set up a remote backend, with Terraform itself

State in a local `terraform.tfstate` file works for one person on one laptop. The moment a second person or a CI job runs Terraform, you need a **remote backend**: shared storage with locking, so two applies can never write the same state at once.

The classic chicken-and-egg problem: you want Terraform to create the bucket that will hold Terraform's state. The answer is two steps.

**Step 1: create the bucket with local state.** A small bootstrap configuration, applied once:

```tabs
{
  "title": "Bootstrap the state bucket",
  "tabs": [
    {
      "label": "AWS S3",
      "lang": "hcl",
      "code": "resource \"aws_s3_bucket\" \"state\" {\n  bucket = \"acme-terraform-state\"\n}\n\nresource \"aws_s3_bucket_versioning\" \"state\" {\n  bucket = aws_s3_bucket.state.id\n  versioning_configuration {\n    status = \"Enabled\" # every state write becomes a recoverable version\n  }\n}\n\nresource \"aws_s3_bucket_public_access_block\" \"state\" {\n  bucket                  = aws_s3_bucket.state.id\n  block_public_acls       = true\n  block_public_policy     = true\n  ignore_public_acls      = true\n  restrict_public_buckets = true\n}"
    },
    {
      "label": "DigitalOcean Spaces",
      "lang": "hcl",
      "code": "resource \"digitalocean_spaces_bucket\" \"state\" {\n  name   = \"acme-terraform-state\"\n  region = \"fra1\"\n  acl    = \"private\"\n}"
    }
  ]
}
```

**Step 2: point the configuration at the bucket and migrate.** Add a `backend` block:

```tabs
{
  "title": "Backend block",
  "tabs": [
    {
      "label": "AWS S3",
      "lang": "hcl",
      "code": "terraform {\n  required_version = \">= 1.11\"\n\n  backend \"s3\" {\n    bucket       = \"acme-terraform-state\"\n    key          = \"prod/network.tfstate\"\n    region       = \"us-east-1\"\n    encrypt      = true\n    use_lockfile = true # lock with a .tflock object in the bucket, no DynamoDB\n  }\n}"
    },
    {
      "label": "DigitalOcean Spaces",
      "lang": "hcl",
      "code": "terraform {\n  required_version = \">= 1.11\"\n\n  backend \"s3\" {\n    endpoints = {\n      s3 = \"https://fra1.digitaloceanspaces.com\"\n    }\n    bucket = \"acme-terraform-state\"\n    key    = \"prod/network.tfstate\"\n\n    # Spaces speaks the S3 API; these skip AWS-only checks\n    skip_credentials_validation = true\n    skip_requesting_account_id  = true\n    skip_metadata_api_check     = true\n    skip_region_validation      = true\n    skip_s3_checksum            = true\n    region                      = \"us-east-1\" # required by the backend, not used by Spaces\n\n    use_lockfile = true\n  }\n}"
    }
  ]
}
```

Then run `terraform init -migrate-state`. Terraform notices the backend changed, asks whether to copy the existing state to the new backend, and from then on reads and writes it remotely. The same command handles any backend change later: a new bucket, a new key, or moving from one provider to another. Here it is moving local state to a new location:

```terminal
{
  "title": "terraform init -migrate-state",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "terraform init -migrate-state -force-copy", "output": "Initializing the backend...\nSuccessfully configured the backend \"local\"! Terraform will automatically\nuse this backend unless the backend configuration changes.\n...\nTerraform has been successfully initialized!" }
  ]
}
```

`-force-copy` answers yes to the copy prompt, which is what you want in a script. Run it without the flag the first time so you see the question.

For Spaces, the credentials are a Spaces access key and secret, passed as `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in the environment, not written in the backend block. DigitalOcean documents the full setup in [Configure DigitalOcean Spaces as a Terraform Remote State Backend](https://docs.digitalocean.com/products/spaces/reference/terraform-backend/), including state locking with `use_lockfile` on Terraform 1.11 or later. If your state also holds secrets (it usually does), keep the bucket private and limit who has keys to it; that is the whole point of the next two sections.

For the errors people usually hit on this step, from the wrong region to missing permissions, see [common S3 backend configuration errors](/posts/terraform-s3-backend-configuration-errors), and if a lock gets stuck, [how to unlock a locked state file](/posts/terraform-statefile-locked).

## The DynamoDB lock table is on its way out

For years, locking on the S3 backend meant a separate DynamoDB table with a `LockID` key. Terraform 1.10 added locking through S3 itself: at the start of an operation Terraform writes a `.tflock` object next to the state with a conditional write that fails if the object already exists, so a second apply is blocked. With `use_lockfile = true` you no longer need the table, and Terraform now says so when it sees the old setting:

```terminal
{
  "title": "terraform init with dynamodb_table",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "terraform init", "output": "Initializing the backend...\nWarning: Deprecated Parameter\n  on main.tf line 6, in terraform:\n   6:     dynamodb_table = \"terraform-locks\"\nThe parameter \"dynamodb_table\" is deprecated. Use parameter \"use_lockfile\"\ninstead." }
  ]
}
```

If you are migrating an existing backend, you can set both `use_lockfile = true` and `dynamodb_table` for a while, so older Terraform versions and newer ones take locks the other respects. Once everyone runs 1.11 or later, drop the table.

### The "all attributes must be indexed" error

If you still build a DynamoDB table in Terraform, for locking or anything else, you will probably meet this error from the AWS provider sooner or later:

```text
Error: all attributes must be indexed. Unused attributes: ["category"]
```

The message sounds like a query rule, but it is about the `attribute` blocks. In `aws_dynamodb_table`, an `attribute` block does not describe the item's fields. It declares the type of a **key**: the table's `hash_key` or `range_key`, or a key of a global or local secondary index. DynamoDB is schemaless for every other field, so an `attribute` that no key uses is an error.

The wrong way, declaring fields as if it were a SQL table:

```hcl
resource "aws_dynamodb_table" "orders" {
  name         = "orders"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "category" # no key uses this: "all attributes must be indexed"
    type = "S"
  }
}
```

The right way: declare only key attributes. If you do need to query by `category`, make it a key of an index, and then its `attribute` block is valid:

```hcl
resource "aws_dynamodb_table" "orders" {
  name         = "orders"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "category"
    type = "S"
  }

  global_secondary_index {
    name            = "by-category"
    hash_key        = "category"
    projection_type = "ALL"
  }
}
```

For a lock table, the rule is short: one attribute, `LockID` of type `S`, as the hash key, and nothing else.

## Should .tfstate go in Git?

No, for three reasons that each matter on their own:

1. **State holds secrets in plain text.** Database passwords, generated keys, and anything marked `sensitive` are redacted in plan output but stored readable in state. A state file in Git is a credential in Git, forever, in every clone and every fork.
2. **Git cannot lock.** Two people who run `apply` from their own checkouts each write a different state. The next merge picks one, and Terraform loses track of whatever the other one created.
3. **State changes on every apply.** Committing it makes every infrastructure change a merge conflict waiting to happen.

What belongs where:

```text
# .gitignore
*.tfstate
*.tfstate.*
.terraform/
crash.log
# only if your .tfvars files hold secrets; commit a non-secret example instead
*.tfvars
```

Commit `.terraform.lock.hcl`, though. It pins the exact provider versions and checksums, so everyone and every CI run use the same provider build. And if state already made it into your history, rotating the secrets in it matters more than rewriting the history, because every existing clone still has the old file.

Where state should live is a bigger question than a backend block: who is allowed to run apply, and whose laptop has the keys. We wrote about that in [Who owns the state file](/posts/who-owns-the-terraform-state-file).

## Summary

| You want to | Use | Instead of |
|---|---|---|
| Stop managing a resource, keep it running | `removed` with `destroy = false` | `terraform state rm` |
| Rename a resource or move it into a module | `moved` block | `terraform state mv` |
| Move a resource to another project | `removed` in the source, `import` in the target | pulling, editing and pushing state files |
| Start using a remote backend | bootstrap the bucket, then `terraform init -migrate-state` | copying state files by hand |
| Lock state on S3 or Spaces | `use_lockfile = true` | a DynamoDB table |
| Keep state safe | a private, versioned bucket | committing `.tfstate` to Git |

The pattern behind all of it: prefer changes that go through `plan`. The config blocks (`removed`, `moved`, `import`) turn state surgery into reviewable code, and the CLI commands are there for the rare case where that is not possible. If you want to go further with the language itself, [Terraform variables, loops and outputs](/posts/terraform-variables-loops-and-outputs) covers the rest, and the [Terraform terminal simulator](/games/terraform-terminal-simulator) lets you practice `init`, `plan`, `apply` and `state list` in the browser.
