---
title: 'Who Owns the State File, and Other Questions That Decide Your Week'
excerpt: 'Most Terraform pain is not HCL. It is state: who is allowed to write it, how it is split, how you find out it no longer matches reality, and how a plan gets reviewed before it applies. Here are the four decisions, with a real drift run and the tooling that exists for each.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2026-09-03'
publishedAt: '2026-09-03T09:00:00Z'
updatedAt: '2026-09-03T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Terraform
  - Infrastructure as Code
  - CI/CD
  - AWS
  - GitOps
  - Drift Detection
---

The Terraform incidents that eat a week rarely start with a bad resource block. They start with a question nobody answered early: two people ran `apply` against the same state at the same time; the production state lives in the same file as a sandbox someone `destroy`ed; a security group was edited in the console in March and nobody noticed until a plan in June wanted to "fix" it; a plan with 40 destroys got applied because the PR review looked at the HCL diff and not at the plan.

Each of those is a state question, not a syntax question. This post walks through the four that matter: who owns the state file, how it is split, how you detect drift, and how a plan gets reviewed. For the drift part you get a real run, not a described one. Along the way it names the tools built for each problem, because this is the layer where teams usually stop hand-rolling scripts and buy or adopt something.

## TL;DR

- **One writer per state file.** A remote backend with locking is the floor, not a nice-to-have. On S3 that now means `use_lockfile = true`; the DynamoDB table is legacy.
- **Split state by blast radius**, not by convenience. Per environment at minimum, per component once a plan takes more than a minute or touches more than one team.
- **Drift is normal.** Run `terraform plan -detailed-exitcode` on a schedule and treat exit code 2 as a signal. Use `-refresh-only` to accept reality when reality is right.
- **Review the plan, not the diff.** The plan output is the artifact that changes infrastructure. Post it on the pull request, apply only what was reviewed.
- **State is sensitive.** It contains attribute values, including things you did not think of as secrets. Encrypt it, restrict who can read it, and use ephemeral values and write-only arguments to keep secrets out entirely.

## Prerequisites

- Terraform 1.10 or newer (the examples use 1.15; `use_lockfile` needs 1.10+, write-only arguments need 1.11+)
- An AWS account if you want to reproduce the S3 backend section; the drift demo runs locally with the `local` provider
- A CI system that can run on pull requests (GitHub Actions is assumed for the examples, any works)

## Question 1: who is allowed to write the state file?

State is the map between your HCL and real resource IDs. Lose it and Terraform believes nothing exists. Corrupt it with two concurrent writes and Terraform believes the wrong things exist, which is worse. So the first decision is ownership: exactly one process may write a given state file at a time, and every human and pipeline goes through the same lock.

The local backend fails this by design. It is a file on whoever's laptop ran `apply` last. The moment a second person or a CI job touches the same resources, you have two states and no lock.

A remote backend fixes the "where" and locking fixes the "one at a time". On AWS the modern setup is S3 with native locking:

```hcl
terraform {
  backend "s3" {
    bucket       = "acme-terraform-state"
    key          = "platform/network/terraform.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true # S3-native lock, Terraform 1.10+
  }
}
```

`use_lockfile` writes a `.tflock` object next to the state with a conditional PUT, so a second writer fails fast instead of racing. Before 1.10 the same job needed a DynamoDB table (`dynamodb_table = "terraform-locks"`); that option still works but is deprecated, and new projects should not add the table.

:::warning
Locking protects against concurrent writes. It does not protect against a stale read followed by a write, which is what happens when someone runs `apply` from a laptop with an old plan file while CI applied something else in between. The fix for that is the workflow in question 4, not a stronger lock.
:::

What the bucket itself needs:

- **Versioning on.** Every `apply` writes a new object version. When state is damaged, the previous version is your recovery, and it costs nothing until you need it.
- **Bucket policy scoped per state key.** The network team's role can read and write `platform/network/*`, the app team's role can read it and write only `apps/checkout/*`. State files are the place where over-broad IAM shows up as an outage.
- **Encryption with a customer-managed key** if compliance asks who can decrypt state. Default SSE-S3 is fine for most teams; the point is that state is not a public artifact.

The same shape exists on every cloud (Azure Blob with lease-based locking, GCS with native locking) and in every hosted Terraform platform. HCP Terraform, Spacelift, env0 and Digger all hold the state for you and put the lock behind their own run queue, which is the main practical thing you are buying: a single serialized writer per stack, enforced by the system rather than by convention.

## Question 2: how is state split?

One state file for everything is the second most common mistake, and it is invisible until the day a plan runs for eleven minutes and a typo in a tag change proposes destroying a database.

The unit of state is the unit of blast radius. Two rules of thumb:

1. **Never share state across environments.** `prod` and `staging` in one file means every staging experiment refreshes and plans production, and a `destroy` targeted at the wrong workspace takes both.
2. **Split by rate of change and by owner.** Networking and IAM change monthly and are owned by a platform team. Application infrastructure changes daily and is owned by product teams. Keep them in separate state files and connect them with data sources or `terraform_remote_state`, so a checkout deploy never has to refresh 400 network resources.

A layout that holds up:

```text
infra/
  platform/
    network/        # VPCs, subnets, peering. Own state.
    iam/            # Roles and policies. Own state.
    clusters/       # EKS, node groups. Own state, reads network outputs.
  apps/
    checkout/       # Per-app resources: queues, buckets, RDS. Own state per env.
      prod/
      staging/
    search/
      prod/
      staging/
```

Each leaf directory has its own backend key. `apps/checkout/prod` reads the cluster's OIDC provider ARN from `platform/clusters` outputs rather than owning it.

```hcl
data "terraform_remote_state" "clusters" {
  backend = "s3"
  config = {
    bucket = "acme-terraform-state"
    key    = "platform/clusters/terraform.tfstate"
    region = "eu-west-1"
  }
}

resource "aws_iam_role" "checkout" {
  name = "checkout-prod"
  assume_role_policy = data.aws_iam_policy_document.oidc.json
}
```

:::note
Workspaces are not environment isolation. `terraform workspace` switches between state files under the same backend prefix with the same credentials and the same code. That is fine for short-lived per-branch copies of a stack. It is not fine as the boundary between staging and production, because nothing stops a `-destroy` in the wrong workspace except attention.
:::

The cost of splitting is orchestration: when the network changes, dependents need a plan too. That is exactly the problem the hosted platforms solve with stack dependencies (Spacelift and env0 both model "run B after A succeeds and pass outputs"), and what Terragrunt does with `dependency` blocks if you stay on plain CLI. Pick one; hand-written Makefiles that run directories in the right order are where teams stall.

## Question 3: how do you find out state no longer matches reality?

Drift is the gap between what state says and what the provider API returns. It happens for good reasons (an on-call engineer widened a security group at 3 a.m. and was right to) and bad ones (someone clicked around the console for an hour). Terraform does not tell you about drift until the next plan, and the next plan may be weeks away.

Here is what drift looks like from Terraform's side, run for real with the `local` provider so you can reproduce it without an account. Two managed files, one edited outside Terraform and one deleted:

```terminal
{
  "title": "drift demo (Terraform 1.15.8)",
  "prompt": "$",
  "steps": [
    { "cmd": "terraform apply -auto-approve", "output": "local_file.feature_flags: Creation complete after 0s [id=497bf222e1c3c415669ba709d62873551fd34315]\n\nApply complete! Resources: 2 added, 0 changed, 0 destroyed." },
    { "comment": "someone edits one file by hand and deletes the other" },
    { "cmd": "printf 'LOG_LEVEL=debug\\nWORKERS=4\\n' > out/app.env && rm out/flags.json" },
    { "cmd": "terraform plan -detailed-exitcode", "output": "local_file.app_config: Refreshing state... [id=7a5c3ff122fe7ec3ef80d88617b257d9a79ed359]\nlocal_file.feature_flags: Refreshing state... [id=497bf222e1c3c415669ba709d62873551fd34315]\n\nTerraform will perform the following actions:\n\n  # local_file.app_config will be created\n  + resource \"local_file\" \"app_config\" {\n      + content  = <<-EOT\n            LOG_LEVEL=info\n            WORKERS=4\n        EOT\n      + filename = \"./out/app.env\"\n    }\n\n  # local_file.feature_flags will be created\n  + resource \"local_file\" \"feature_flags\" {\n      + filename = \"./out/flags.json\"\n    }\n\nPlan: 2 to add, 0 to change, 0 to destroy." },
    { "cmd": "echo $?", "output": "2" }
  ]
}
```

Two things worth reading closely in that output.

First, the exit code. `-detailed-exitcode` returns 0 for no changes, 1 for an error and 2 for "there is a plan". That single bit is your drift detector. A scheduled job that runs `plan -detailed-exitcode` against every state file and alerts on 2 is the cheapest drift detection you will ever build, and it is what the hosted platforms do under the "drift detection" checkbox.

Second, what the plan wants to do. The hand-edited file shows up as "will be created" with the original `LOG_LEVEL=info`, because the `local` provider treats a content mismatch as the resource being gone. A cloud provider would usually show it as an in-place update (`~ ingress { ... }`). Either way the plan is proposing to **undo** the manual change. Whether that is right depends on why the change was made, which is a human decision, not a Terraform one.

You have two honest ways to resolve drift:

**Reality was wrong, code is right.** Apply the plan. The on-call widening gets closed again, and if it was needed, it gets re-added in code where it will survive the next apply.

**Reality is right, code is stale.** Update the code to match, then confirm with a plan that shows no changes. If the drift is only in attributes Terraform tracks but you do not set (a tag added by a cost tool, a replica count changed by an autoscaler), a refresh-only apply accepts the new values into state without touching the resource:

```terminal
{
  "title": "accepting drift into state",
  "prompt": "$",
  "steps": [
    { "cmd": "terraform apply -refresh-only -auto-approve", "output": "Note: Objects have changed outside of Terraform\n\nTerraform detected the following changes made outside of Terraform since the\nlast \"terraform apply\" which may have affected this plan:\n\n  # local_file.app_config has been deleted\n  - resource \"local_file\" \"app_config\" {\n      - content  = <<-EOT\n            LOG_LEVEL=info\n            WORKERS=4\n        EOT -> null\n      - filename = \"./out/app.env\" -> null\n    }\n\n  # local_file.feature_flags has been deleted\n  - resource \"local_file\" \"feature_flags\" {\n      - filename = \"./out/flags.json\" -> null\n    }" },
    { "cmd": "terraform state list", "output": "" },
    { "comment": "state now agrees with reality: nothing is managed. The next plan recreates both from code." }
  ]
}
```

That last step is the trap with refresh-only: it makes state agree with the world, which in this case means forgetting both files. The next normal plan will recreate them. Refresh-only is for accepting attribute changes you intend to keep, not for resources that went missing.

For attributes that are supposed to change outside Terraform, stop tracking them instead of fighting them:

```hcl
resource "aws_autoscaling_group" "web" {
  # ...
  desired_capacity = 3

  lifecycle {
    ignore_changes = [desired_capacity] # the autoscaler owns this now
  }
}
```

A drift detection schedule that works in practice:

```yaml
# .github/workflows/drift.yml
name: drift
on:
  schedule:
    - cron: "17 6 * * 1-5" # weekday mornings, before people start applying
jobs:
  plan:
    strategy:
      fail-fast: false
      matrix:
        stack: [platform/network, platform/clusters, apps/checkout/prod]
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-plan-readonly
          aws-region: eu-west-1
      - run: terraform -chdir=infra/${{ matrix.stack }} init -input=false
      - name: plan
        id: plan
        run: |
          set +e
          terraform -chdir=infra/${{ matrix.stack }} plan -detailed-exitcode -input=false -lock=false -no-color > plan.txt
          echo "code=$?" >> "$GITHUB_OUTPUT"
      - if: steps.plan.outputs.code == '2'
        run: |
          # open or update an issue per stack; the plan text is the body
          gh issue create --title "Drift: ${{ matrix.stack }}" --body-file plan.txt --label drift
        env:
          GH_TOKEN: ${{ github.token }}
```

Note `-lock=false` on the scheduled plan. It reads state without taking the lock, so a 6 a.m. drift check never blocks a real apply. Plans on pull requests should still lock.

## Question 4: how does a plan get reviewed?

Code review on Terraform has a specific failure mode: reviewers read the HCL diff, which looks small, and approve. Then `apply` runs and the plan they never saw replaces a subnet, which replaces the NAT gateway, which replaces every route. The HCL diff was three lines. The plan was 40 destroys.

The plan is the artifact that changes infrastructure, so the plan is what needs review. The workflow that follows from that:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Pull request", "sub": "HCL change", "icon": "branch", "tone": "slate" },
    { "label": "terraform plan", "sub": "locked, saved to file", "icon": "gear", "tone": "blue" },
    { "label": "Plan on the PR", "sub": "comment + summary", "icon": "check", "tone": "amber" },
    { "label": "Review", "sub": "approve the plan", "icon": "shield", "tone": "violet" },
    { "label": "Merge", "sub": "apply the saved plan", "icon": "rocket", "tone": "green" }
  ]
}
```

The detail that makes it safe is **apply the saved plan**, not a fresh one. `terraform plan -out=tfplan` produces a binary plan bound to the state serial it was computed against. `terraform apply tfplan` refuses to run if state moved in between. That closes the stale-read gap from question 1: what was reviewed is what applies, or nothing applies.

A minimal version in GitHub Actions:

```yaml
# .github/workflows/terraform.yml (plan on PR, apply on merge)
on:
  pull_request:
    paths: ["infra/apps/checkout/prod/**"]
  push:
    branches: [main]
    paths: ["infra/apps/checkout/prod/**"]

concurrency: tf-checkout-prod # one run at a time per stack, on top of the state lock

jobs:
  plan:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform -chdir=infra/apps/checkout/prod init -input=false
      - run: terraform -chdir=infra/apps/checkout/prod plan -input=false -no-color -out=tfplan | tee plan.txt
      - uses: actions/upload-artifact@v4
        with: { name: tfplan-${{ github.sha }}, path: infra/apps/checkout/prod/tfplan }
      - name: summarize on the PR
        run: |
          {
            echo "### Plan for apps/checkout/prod"
            grep -E "^Plan:|No changes" plan.txt
            echo
            echo "<details><summary>Full plan</summary>"
            echo
            echo '```'
            cat plan.txt
            echo '```'
            echo "</details>"
          } > comment.md
          gh pr comment ${{ github.event.pull_request.number }} --body-file comment.md
        env:
          GH_TOKEN: ${{ github.token }}

  apply:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production # required reviewers live here
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform -chdir=infra/apps/checkout/prod init -input=false
      - uses: actions/download-artifact@v4
        with: { name: tfplan-${{ github.event.before }}, path: infra/apps/checkout/prod }
      - run: terraform -chdir=infra/apps/checkout/prod apply -input=false tfplan
```

Three things this gets right and one it gets wrong.

Right: the plan is on the PR where the reviewer is; the summary line (`Plan: 1 to add, 0 to change, 3 to destroy`) is visible without expanding anything; the apply uses the saved plan; concurrency serializes runs per stack.

Wrong: artifact lookup by `github.event.before` breaks on squash merges and on PRs with multiple commits, and the plan can be days old by the time it merges. Teams patch this with plan re-generation on merge plus a diff check, or with a `terraform show -json` comparison, and at that point they have rebuilt a third of Atlantis.

This is the layer where the tooling earns its keep. In rough order of how much they take over:

- **Atlantis** (open source, self-hosted) does exactly the loop above as a PR bot: `atlantis plan` and `atlantis apply` as comments, locks per directory per PR, plan output posted back. It is the reference implementation of "review the plan on the PR".
- **Digger** runs the same loop inside your existing CI (GitHub Actions, GitLab CI), so plans run on your runners with your credentials and Digger only orchestrates and comments. Attractive if the objection to Atlantis is "another server with cloud credentials".
- **Spacelift** and **env0** are hosted platforms: run queues, stack dependencies, policy as code (both run OPA/Rego on plans, so "no plan with more than 5 destroys applies without a second approver" is a policy, not a code review habit), drift detection on a schedule with auto-remediation runs, and RBAC over who can trigger what. HCP Terraform sits in the same category with Sentinel policies.

The buy-versus-build question is honest here. The GitHub Actions version above is 60 lines and works for one team with five stacks. The failure modes show up at 30 stacks and three teams: plan artifacts that do not match, applies that ran out of order, nobody sure which PR changed the VPC. That is when a run queue with dependencies stops being a luxury.

## The question under all four: what is in the state file?

Everything Terraform knows about a resource is in state, in plain JSON, including attribute values. That means:

- RDS master passwords set through `password = var.db_password` are in state.
- The private key from `tls_private_key` is in state, in full.
- Every `random_password` result is in state.
- Attributes you never set but the provider returns (connection strings, generated tokens) are in state.

`sensitive = true` hides values from plan output. It does nothing to the state file. So the last decision is treating state access as secret access: the bucket policy from question 1, encryption at rest, and no `terraform.tfstate` in a repo, ever, even for a sandbox.

Recent Terraform versions let you keep some secrets out of state entirely:

```hcl
# Terraform 1.11+: write-only argument, never stored in state or plan
ephemeral "aws_secretsmanager_secret_version" "db" {
  secret_id = "prod/checkout/db"
}

resource "aws_db_instance" "checkout" {
  # ...
  password_wo         = ephemeral.aws_secretsmanager_secret_version.db.secret_string
  password_wo_version = 1 # bump to rotate
}
```

Ephemeral resources (1.10) are read during the run and discarded; write-only arguments (1.11) accept a value that the provider sends to the API but Terraform never persists. Not every provider resource has a `_wo` variant yet, so check before assuming, but for database passwords and API tokens on the major providers this is the path off "secrets in state".

## A short checklist

Run through these for each state file you own. Any "no" is a week waiting to happen.

1. Remote backend with locking, versioning on, encryption on.
2. IAM scoped so a team can write only its own state keys.
3. No environment shares a state file with another environment.
4. Components split so a routine plan finishes in under a minute or two.
5. A scheduled `plan -detailed-exitcode` per stack, with someone who looks at exit code 2.
6. Plans posted on pull requests, applies from saved plans, one run at a time per stack.
7. A policy (tooling or habit) that a plan with destroys needs a second look.
8. Secrets moved to ephemeral values and write-only arguments where the provider supports them; state treated as secret material where it does not.

None of these is clever. All of them are the difference between Terraform being the boring part of the week and the reason for it.
