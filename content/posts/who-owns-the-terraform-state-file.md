---
title: 'Who Owns the State File, and Other Questions That Decide Your Week'
excerpt: 'Most Terraform pain is not HCL. It is state: who is allowed to write it, how it is split, how you find out it no longer matches reality, and how a plan gets reviewed before it applies. Four decisions, a real drift run, and the tooling that exists for each.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2026-09-03'
publishedAt: '2026-09-03T09:00:00Z'
updatedAt: '2026-09-03T09:00:00Z'
readingTime: '14 min read'
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

The Terraform incidents that eat a week rarely start with a bad resource block. They start with a question nobody answered early: two people ran `apply` against the same state at the same time; production and a sandbox share one state file and someone ran `destroy` in the wrong directory; a security group was edited in the console in March and nobody noticed until a plan in June wanted to "fix" it; a plan with 40 destroys got applied because the review looked at the HCL diff and not at the plan.

Each of those is a state question, not a syntax question. This post walks through the four that matter: who owns the state file, how it is split, how you detect drift, and how a plan gets reviewed. For the drift part you get a real run with the configuration to reproduce it. Along the way it names the tools built for each problem, because this is the layer where teams usually stop hand-rolling scripts and adopt something.

## TL;DR

- **One writer per state file.** A remote backend with locking is the floor. On S3 that now means `use_lockfile = true`; the DynamoDB lock table is legacy.
- **Split state by ownership and failure domain**, not by convenience. Per environment always; per component when different teams or different lifecycles share a file.
- **Drift is normal.** Run `terraform plan -detailed-exitcode` on a schedule and treat exit code 2 as "something changed, go look". Use `-refresh-only` to record what you observed, then fix code or lifecycle rules so the next plan agrees.
- **Review the plan, not the diff.** The plan output is the artifact that changes infrastructure. Put it on the pull request, and make the apply run against a plan someone approved.
- **State is sensitive.** It contains attribute values, including things you did not think of as secrets. Encrypt it, restrict who can read it, and use ephemeral values and write-only arguments to keep secrets out entirely.

## Prerequisites

- Terraform 1.10 or newer. The examples were run with 1.15.8; `use_lockfile` needs 1.10+, write-only arguments need 1.11+.
- An AWS account if you want to reproduce the S3 backend section. The drift demo runs locally with the `hashicorp/local` provider, version 2.9.0.
- A CI system that can run on pull requests. The examples use GitHub Actions.

## Question 1: who is allowed to write the state file?

State is the map between your HCL and real resource IDs. Lose it and Terraform believes nothing exists. Corrupt it with two concurrent writes and Terraform believes the wrong things exist, which is worse. So the first decision is ownership: exactly one process may write a given state file at a time, and every human and pipeline goes through the same lock.

The local backend does lock. It takes an OS-level lock on `terraform.tfstate` while a command runs, so two commands in the same directory on the same machine cannot collide. What it cannot do is coordinate independent copies: your laptop, a colleague's laptop and a CI runner each have their own file and their own lock. The moment a second person or a pipeline touches the same resources, you have two states and no shared lock.

A remote backend fixes the "where" and shared locking fixes the "one at a time". On AWS the current setup is S3 with native locking:

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

`use_lockfile` writes a `.tflock` object next to the state with a conditional PUT (the write succeeds only if the object does not exist yet), so a second writer gets a lock error right away by default. Pass `-lock-timeout=5m` and Terraform retries for that long instead. Before 1.10 the S3 backend worked without any lock; if you wanted one you added a DynamoDB table (`dynamodb_table = "terraform-locks"`). That option still works but is deprecated, and new projects should not add the table.

What the bucket and the IAM role need:

- **Versioning on.** Every apply that changes state writes a new object version, and the previous version is your recovery when state is damaged. Each version is a full copy and is billed as one, so add a lifecycle rule that expires noncurrent versions after a period you are comfortable with (30 to 90 days is common) rather than keeping every version forever.
- **Permissions for the lock file.** The role needs `s3:GetObject`, `s3:PutObject` and `s3:DeleteObject` on `<state key>.tflock`. The state object itself needs `GetObject` and `PutObject` only; Terraform never deletes it.
- **Bucket policy scoped per state key.** The network team's role can read and write `platform/network/*`; the app team's role can write only `apps/checkout/*`. State files are where over-broad IAM turns into an outage.
- **Encryption with a customer-managed key** if compliance asks who can decrypt state. Default SSE-S3 is fine for most teams; the point is that state is not a public artifact.

:::note
Three different things protect you here, and it helps to keep them apart. The **lock** stops two writers running at once. A **saved plan** (question 4) stops a stale plan from applying: `terraform apply tfplan` refuses if the state changed after the plan was made, whoever changed it. Neither one notices a change made **outside Terraform** that never touched state; that is what drift detection (question 3) is for.
:::

The same shape exists on every cloud (Azure Blob with lease-based locking, GCS with native locking). The hosted platforms take the decision away from you: HCP Terraform, Spacelift and env0 hold the state and put every run behind their own queue, so there is one serialized writer per stack by construction. Digger is different in kind: it runs Terraform inside your existing CI with your backend, and coordinates pull request locks and plan caching from its own component. More on that split in question 4.

## Question 2: how is state split?

One state file for everything works until the day a plan runs for eleven minutes and a three-line change proposes destroying something you did not touch. That happens because of dependencies, not bad luck: change an attribute that forces replacement on a subnet, and every resource that references the subnet follows.

The unit of state is the unit of blast radius. Two rules of thumb:

1. **Never share state across environments.** `prod` and `staging` in one file means every staging experiment refreshes and plans production, and a `destroy` in the wrong place takes both.
2. **Split by owner and by lifecycle.** Networking and IAM change monthly and belong to a platform team. Application infrastructure changes daily and belongs to product teams. Different owners, different permissions, different rate of change: different state files. Plan duration is a symptom of getting this wrong, not the rule for splitting.

A layout that holds up:

```text
infra/
  platform/
    network/        # VPCs, subnets, peering. Own state.
    iam/            # Roles and policies. Own state.
    clusters/       # EKS, node groups. Own state, reads network values.
  apps/
    checkout/       # Per-app resources: queues, buckets, RDS. Own state per env.
      prod/
      staging/
    search/
      prod/
      staging/
```

Each leaf directory has its own backend key. How the leaves share values is a security decision in itself. The `terraform_remote_state` data source is the obvious tool, but to read one output it downloads the **whole** source state, so the consumer role needs read access to everything in that file, including attribute values you would rather not hand to every app team. Two safer patterns:

- **Provider data sources.** Look the value up from the cloud API by name or tag (`data "aws_vpc"`, `data "aws_iam_openid_connect_provider"`). The consumer needs read permission on that resource, not on the platform team's state.
- **Publish selected outputs** to a store built for sharing: SSM Parameter Store, a DNS record, a small "exports" configuration. The producer writes exactly what it wants to share; consumers read that.

```hcl
# platform/clusters: publish what apps are allowed to know
resource "aws_ssm_parameter" "oidc_provider_arn" {
  name  = "/platform/clusters/prod/oidc_provider_arn"
  type  = "String"
  value = aws_iam_openid_connect_provider.eks.arn
}

# apps/checkout/prod: read it without touching platform state
data "aws_ssm_parameter" "oidc_provider_arn" {
  name = "/platform/clusters/prod/oidc_provider_arn"
}
```

`terraform_remote_state` is still fine between stacks owned by the same team with the same trust level. Use it knowingly.

:::note
Workspaces are not environment isolation. `terraform workspace` switches between state files under the same backend prefix with the same credentials and the same code. That is fine for short-lived per-branch copies of a stack. It is not fine as the boundary between staging and production, because nothing stops a `-destroy` in the wrong workspace except attention.
:::

The cost of splitting is orchestration: when the network stack changes, dependents need a plan too. You need three things whatever you build it with: an order to run stacks in, a way to pass values between them, and a way to see that a downstream stack has not been planned since its upstream changed. Terragrunt models this with `dependency` blocks on the plain CLI; a CI pipeline with explicit job dependencies does it for small graphs; Spacelift stack dependencies and env0 workflows do it as a hosted feature with output passing built in.

## Question 3: how do you find out state no longer matches reality?

Two things get called drift, and they need different responses.

**Configuration drift** is the gap between what your code declares and what actually exists. Someone widened a security group in the console at 3 a.m.; the code still says the old range. The next plan will propose to close it again.

**State drift** is the gap between what the state file recorded and what the provider API now returns. The resource is fine and matches the code, but state has old attribute values because they changed outside Terraform. A refresh fixes state without touching the resource.

Terraform surfaces both at the same moment: when it refreshes during a plan. Which means you only find out when someone runs a plan, and for a quiet stack that can be weeks.

Here is what it looks like from Terraform's side, run for real with the `local` provider so you can reproduce it without a cloud account. The full configuration:

```hcl
# main.tf
terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "2.9.0" }
  }
}

resource "local_file" "app_config" {
  filename        = "${path.module}/out/app.env"
  content         = "LOG_LEVEL=info\nWORKERS=4\n"
  file_permission = "0644"
}

resource "local_file" "feature_flags" {
  filename        = "${path.module}/out/flags.json"
  content         = jsonencode({ new_checkout = false, dark_mode = true })
  file_permission = "0644"
}
```

Apply it, then edit one file by hand and delete the other, then plan again. The transcript below is abridged (the provider prints six hash attributes per resource that add nothing here); the commands, messages and exit code are as they ran with Terraform 1.15.8:

```terminal
{
  "title": "drift demo",
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

Two things worth reading closely.

First, the exit code. `-detailed-exitcode` returns 0 for an empty plan, 1 for an error and 2 for a successful plan with changes. Exit code 2 is a **change signal**, not a drift verdict: it also fires for code that was merged and never applied, for a variable that changed, or for a provider upgrade that added a default. It becomes a drift detector only when you run it against a stack whose code was fully applied and whose inputs are pinned, so that the only remaining cause of a non-empty plan is the world moving. On a stack that meets those conditions, a scheduled plan that alerts on 2 is a small, honest first version of drift detection, and it is what the hosted platforms run under their drift detection setting.

Second, what the plan wants to do. The hand-edited file shows up as "will be created" with the original `LOG_LEVEL=info`. That is a quirk of this provider: `local_file` identifies a resource by the hash of its content, so a changed file looks like a missing one. A cloud provider would show the same situation as an in-place update (`~ ingress { ... }`). Either way the plan is proposing to **undo** the manual change, and whether that is right depends on why the change was made. Terraform cannot know.

You have two honest ways to resolve it:

**Reality was wrong, code is right.** Apply the plan. The on-call widening gets closed again, and if it was needed, it gets re-added in code where it survives the next apply.

**Reality is right, code is stale.** Change the code to match, then confirm with a plan that shows no changes. Along the way, a refresh-only apply records what Terraform observed into state without touching any resource:

```terminal
{
  "title": "recording what changed (abridged)",
  "prompt": "$",
  "steps": [
    { "cmd": "terraform apply -refresh-only -auto-approve", "output": "Note: Objects have changed outside of Terraform\n\nTerraform detected the following changes made outside of Terraform since the\nlast \"terraform apply\" which may have affected this plan:\n\n  # local_file.app_config has been deleted\n  - resource \"local_file\" \"app_config\" {\n      - content  = <<-EOT\n            LOG_LEVEL=info\n            WORKERS=4\n        EOT -> null\n      - filename = \"./out/app.env\" -> null\n    }\n\n  # local_file.feature_flags has been deleted\n  - resource \"local_file\" \"feature_flags\" {\n      - filename = \"./out/flags.json\" -> null\n    }" },
    { "cmd": "terraform state list", "output": "" },
    { "comment": "state holds no bindings now. out/app.env still exists on disk with the hand edit; the code still declares both files, so the next plan creates flags.json and overwrites app.env." }
  ]
}
```

That last line is the point about refresh-only: it makes state describe what Terraform saw, and nothing else. If the code still demands the old value, the next normal plan will bring it back. Refresh-only is the first half of accepting a change; editing the code, or telling Terraform to stop reconciling that attribute, is the second half:

```hcl
resource "aws_autoscaling_group" "web" {
  # ...
  desired_capacity = 3

  lifecycle {
    ignore_changes = [desired_capacity] # the autoscaler owns this now
  }
}
```

`ignore_changes` does not stop Terraform from refreshing and recording the attribute. It stops Terraform from planning an update when that attribute differs from the code, which is what you want for values another system legitimately controls.

A drift check that runs on a schedule:

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
      id-token: write   # OIDC to AWS
      contents: read
      issues: write     # to open or update the drift issue
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v4
        with:
          terraform_version: 1.15.8
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-plan-readonly
          aws-region: eu-west-1
      - run: terraform -chdir=infra/${{ matrix.stack }} init -input=false
      - name: plan
        id: plan
        run: |
          set +e
          terraform -chdir=infra/${{ matrix.stack }} plan -detailed-exitcode -input=false -lock-timeout=2m -no-color > plan.txt
          code=$?
          set -e
          echo "code=$code" >> "$GITHUB_OUTPUT"
          # 0 and 2 are answers; anything else is a broken check and must fail loudly
          if [ "$code" != "0" ] && [ "$code" != "2" ]; then cat plan.txt; exit "$code"; fi
      - if: steps.plan.outputs.code == '2'
        name: open or update the drift issue for this stack
        env:
          GH_TOKEN: ${{ github.token }}
          STACK: ${{ matrix.stack }}
        run: |
          existing=$(gh issue list --label drift --state open --search "in:title \"Drift: $STACK\"" --json number -q '.[0].number')
          if [ -n "$existing" ]; then
            gh issue comment "$existing" --body-file plan.txt
          else
            gh issue create --title "Drift: $STACK" --body-file plan.txt --label drift
          fi
```

Two details in there are deliberate. The step fails on any exit code other than 0 or 2, so expired credentials or a broken backend cannot produce a green run that quietly stops checking. And the plan takes the lock with a short timeout rather than running with `-lock=false`; skipping the lock would let the check read state while an apply is halfway through writing it, and a drift report against a half-applied state is noise. If the morning window collides with real applies, move the schedule or accept the two-minute wait.

## Question 4: how does a plan get reviewed?

Code review on Terraform has a specific failure mode: reviewers read the HCL diff, which looks small, and approve. Then `apply` runs and the plan they never saw replaces a subnet, which replaces the NAT gateway, which replaces every route. The HCL diff was three lines. The plan was 40 destroys.

The plan is the artifact that changes infrastructure, so the plan is what needs review. The workflow that follows:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Pull request", "sub": "HCL change", "icon": "branch", "tone": "slate" },
    { "label": "terraform plan", "sub": "locked, saved to a file", "icon": "gear", "tone": "blue" },
    { "label": "Plan on the PR", "sub": "summary + full output", "icon": "check", "tone": "amber" },
    { "label": "Approval", "sub": "of the plan, not the diff", "icon": "shield", "tone": "violet" },
    { "label": "Apply", "sub": "the approved plan file", "icon": "rocket", "tone": "green" }
  ]
}
```

The detail that makes it safe is **apply the saved plan**. `terraform plan -out=tfplan` writes a plan file that records the planned actions together with the state it was computed from, the configuration, the provider versions and the input values. `terraform apply tfplan` refuses to run if the state has moved since. So what was approved is what applies, or nothing applies. Two limits to keep in mind: values that were unknown at plan time are still resolved at apply time, and the plan file does not know about a change made outside Terraform after the plan ran. It also contains sensitive values in clear text, so a stored plan needs the same access controls as state.

Doing this well with plain GitHub Actions is harder than it looks, and the hard part is exactly "apply the plan that was reviewed". A plan produced on the pull request lives in the pull request's workflow run; the merge to `main` is a different run, with a different commit (the PR ran against a synthetic merge commit, `main` now has a squash or merge commit), and `download-artifact` only sees artifacts from its own run unless you hand it a token and the originating run ID. Teams that push through this end up storing the plan somewhere addressable (S3 keyed by PR number and head SHA), verifying at apply time that the merged tree matches the tree that was planned, and re-planning as a fallback. That is a project, not a snippet.

The version below is honest about that: it reviews the plan on the pull request, and on merge it plans again and applies **that** plan behind an approval gate. The reviewed plan and the applied plan are two runs; the gate shows the second one to a human before it applies.

```yaml
# .github/workflows/terraform.yml
on:
  pull_request:
    paths: ["infra/apps/checkout/prod/**"]
  push:
    branches: [main]
    paths: ["infra/apps/checkout/prod/**"]

# One running and at most one waiting run per stack; a newer waiting run replaces an older one.
concurrency: tf-checkout-prod

env:
  TF_VERSION: 1.15.8
  STACK: infra/apps/checkout/prod

jobs:
  plan:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
      pull-requests: write # to post the plan comment
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v4
        with: { terraform_version: "${{ env.TF_VERSION }}" }
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-plan
          aws-region: eu-west-1
      - run: terraform -chdir=$STACK init -input=false
      - name: plan
        run: |
          set -o pipefail
          terraform -chdir=$STACK plan -input=false -lock-timeout=2m -no-color | tee plan.txt
      - name: post the plan on the pull request
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          {
            echo "### Plan for apps/checkout/prod"
            grep -E "^Plan:|^No changes" plan.txt || true
            echo
            echo "<details><summary>Full plan</summary>"
            echo
            echo '```'
            cat plan.txt
            echo '```'
            echo "</details>"
          } > comment.md
          gh pr comment ${{ github.event.pull_request.number }} --body-file comment.md

  apply:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    # The environment's protection rules (required reviewers, prevent self-review,
    # deployment branch = main) are configured in the repository settings; naming
    # it here only opts the job in.
    environment: production
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v4
        with: { terraform_version: "${{ env.TF_VERSION }}" }
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-apply
          aws-region: eu-west-1
      - run: terraform -chdir=$STACK init -input=false
      - name: plan for apply
        run: |
          set -o pipefail
          terraform -chdir=$STACK plan -input=false -lock-timeout=5m -no-color -out=tfplan | tee plan.txt
          grep -E "^Plan:|^No changes" plan.txt >> "$GITHUB_STEP_SUMMARY" || true
      - name: apply the saved plan
        run: terraform -chdir=$STACK apply -input=false tfplan
```

What this buys you: the plan is on the pull request where the reviewer is, the summary line (`Plan: 1 to add, 0 to change, 3 to destroy`) is visible without expanding anything, the apply job applies exactly the plan it made, the same Terraform version runs in both jobs, and the environment gate puts a human in front of the apply plan. What it does not buy you: a guarantee that the plan on the pull request and the plan at apply are the same. If someone merged another change to the same stack in between, the apply plan will differ, and the environment approver is the only one who sees it.

Note the `permissions` blocks: once you set any permission on a job, everything you did not list is off, so the plan job needs `pull-requests: write` for the comment and both jobs need `id-token: write` for OIDC. Pull requests from forks get a read-only token and cannot post comments; keep infrastructure repos to branches in the same repository.

Where the tools come in, each with a different answer to "which plan applies":

- **Atlantis** (open source, self-hosted) runs as a pull request bot. `atlantis plan` posts the plan on the PR, `atlantis apply` applies **that saved plan** while the PR is still open, and the PR is merged after the apply succeeded. It holds a lock per directory and workspace for the life of the PR so two PRs cannot plan the same stack against each other. Apply-before-merge is the whole idea, and it is the cleanest answer to the reviewed-plan problem on plain CI infrastructure.
- **Digger** runs the plan and apply steps inside your existing CI (GitHub Actions, GitLab CI), with your runners and your credentials, and adds an orchestrator component that owns the pull request locks and caches plans between the plan and apply steps. State stays in your own backend. It is the option for teams that want the Atlantis workflow without operating an extra server that holds cloud credentials.
- **HCP Terraform, Spacelift and env0** are hosted run platforms. Each run plans, waits for approval, then applies from that run's plan, so the reviewed plan and the applied plan are one object. On top of that: run queues per stack, dependencies between stacks with output passing (Spacelift stack dependencies, env0 workflows, HCP Terraform run triggers), policy checks against the plan (Sentinel or OPA in HCP Terraform, OPA in Spacelift and env0; "a plan with more than five destroys needs a second approver" becomes a rule rather than a habit), scheduled drift detection with optional remediation runs, and access control over who may trigger what. Which of those are included depends on the plan or edition you are on, so check before assuming.

The decision between the GitHub Actions version and one of these is not about team size. It is about whether you need any of: a guarantee that the approved plan is the applied plan, more than one PR open against the same stack at a time, dependencies between stacks, or policy that is enforced rather than reviewed. The first of those alone is a good reason.

## The question under all four: what is in the state file?

Everything Terraform knows about a resource is in state, in plain JSON, including attribute values. That means:

- RDS master passwords set through `password = var.db_password` are in state.
- The private key from `tls_private_key` is in state, in full.
- Every `random_password` result is in state.
- Attributes you never set but the provider returns (connection strings, generated tokens) are in state.

`sensitive = true` hides values from plan output. It does nothing to the state file. So the last decision is treating state access as secret access: the bucket policy from question 1, encryption at rest, no `terraform.tfstate` in a repository, ever, and the same care for saved plan files.

Recent Terraform versions let you keep some secrets out of state entirely. This needs both a Terraform version and a provider version that support it; for the AWS provider the Secrets Manager ephemeral resource and `password_wo` on `aws_db_instance` arrived in the 5.87 release, so pin at least that:

```hcl
terraform {
  required_version = ">= 1.11"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.87" }
  }
}

# Read during the run, never written to state or plan
ephemeral "aws_secretsmanager_secret_version" "db" {
  secret_id = "prod/checkout/db"
}

resource "aws_db_instance" "checkout" {
  # ...
  password_wo         = ephemeral.aws_secretsmanager_secret_version.db.secret_string
  password_wo_version = 1 # bump to rotate
}
```

Ephemeral resources (Terraform 1.10) are read during the run and discarded. Write-only arguments (Terraform 1.11) accept a value that the provider sends to the API but Terraform never persists; the `_wo_version` companion is how you tell Terraform the value changed, since it cannot compare something it does not store. Not every resource has a write-only variant yet, so check the provider documentation for the ones you care about.

## A short checklist

Run through these for each state file you own.

1. Remote backend with locking, versioning on with a lifecycle rule for old versions, encryption on.
2. IAM scoped so a team can write only its own state keys, including the `.tflock` objects.
3. No environment shares a state file with another environment.
4. Components split by owner and lifecycle, with values shared through provider data sources or a parameter store rather than whole-state reads.
5. A scheduled `plan -detailed-exitcode` per stack that fails on errors, alerts on exit code 2, and lands with someone who classifies the cause.
6. Plans posted on pull requests; applies from a saved plan; one run at a time per stack.
7. A rule, enforced by tooling or by an approval gate, that a plan with destroys gets a second look.
8. Secrets moved to ephemeral values and write-only arguments where the provider supports them; state and plan files treated as secret material where it does not.
