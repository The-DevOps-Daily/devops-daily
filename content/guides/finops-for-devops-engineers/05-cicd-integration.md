---
title: 'Integrating FinOps into CI/CD Pipelines'
description: 'Add cost checks to pull requests: Infracost estimates, OPA policies on Terraform plans, reviews for size changes, and cleanup of preview environments.'
order: 5
---

**TLDR**: Every infrastructure change passes through a pull request, so that is where cost feedback works best. Post an Infracost estimate on each pull request so reviewers see the monthly change. Check every Terraform plan against a short cost policy with Conftest, and make the check required. Route changes to sizes and policies to the people who own them with CODEOWNERS instead of a blanket approval gate. Destroy preview environments when their pull request closes, and keep the pipeline's own bill in view.

[Part 4](/guides/finops-for-devops-engineers/04-practical-examples) put the cost controls into the `checkout` Terraform. This part runs checks on every change to that code, before it merges.

## Prerequisites

- The `infra/` module from Part 4 in a GitHub repository, with a remote state backend (an S3 bucket) and one workspace per environment, so that plans show only the change.
- Read-only IAM roles that GitHub Actions can assume through OIDC: read access to the resources and to the state, and nothing else. One role for development and staging, one for production, each stored in a GitHub environment (`plan-nonprod` and `plan-prod`) as described in [The Workflow](#h2-the-workflow).
- To run the policy locally: [Conftest](https://www.conftest.dev/install/) 0.71.1 (the workflow below installs the same version).
- For cost estimates: an Infracost account.

## Where Cost Checks Fit

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Pull request", "sub": "infra/ changed", "icon": "branch", "tone": "slate" },
    { "label": "terraform plan", "sub": "per environment", "icon": "gear", "tone": "blue" },
    { "label": "Checks", "sub": "Infracost estimate, Conftest policy", "icon": "shield", "tone": "amber" },
    { "label": "Review", "sub": "CODEOWNERS for sizes", "icon": "check", "tone": "violet" },
    { "label": "Apply", "sub": "then budgets and anomalies watch", "icon": "rocket", "tone": "green" }
  ]
}
```

Use three kinds of check, and keep them separate:

- **Information**: the cost estimate. It never blocks; it makes the cost visible to the author and the reviewer.
- **Rules**: a short policy that everyone agreed on, such as allowed instance types per environment and required tags. A violation fails the check.
- **Review**: changes to the things that drive cost (the sizes map, the policy itself) need a review from the people who own them.

Avoid a manual "cost approval" step on every change. It turns into a queue, and teams learn to work around it. [Why Most FinOps Initiatives Fail](/posts/why-finops-initiatives-fail) describes that approval trap.

## Cost Estimates on Every Pull Request

Infracost's GitHub App is the simplest setup. If your organization does not allow GitHub Apps, use the `diff` action. This workflow is in the companion repository (switched off there, because it needs an Infracost token):

```yaml
name: Infracost

# Posts the monthly cost change of each pull request as a comment.
# Needs an Infracost CLI token in the INFRACOST_API_KEY secret, and the
# repository variable INFRACOST_ENABLED set to true.

on:
  pull_request:
    types: [opened, synchronize, closed, reopened]
    paths:
      - 'infra/**'

permissions:
  contents: read
  pull-requests: write

jobs:
  infracost:
    if: vars.INFRACOST_ENABLED == 'true'
    runs-on: ubuntu-24.04
    steps:
      # A closed pull request needs no checkout: the action only marks it
      # as merged or closed in the Infracost dashboard.
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        if: github.event.action != 'closed'
        with:
          path: head
          persist-credentials: false

      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        if: github.event.action != 'closed'
        with:
          ref: ${{ github.event.pull_request.base.ref }}
          path: base
          persist-credentials: false

      - uses: infracost/actions/diff@a5783eb98adc93aa7a0049fce0abb06fdd30770a # v5.0.1
        with:
          api-key: ${{ secrets.INFRACOST_API_KEY }}
          base-path: base
          head-path: head
```

- It checks out the base branch and the pull request side by side; the action prices both and posts the difference as a comment, updated on each push.
- On `closed`, it skips the checkouts and only marks the pull request as merged or closed in the Infracost dashboard. Set `INFRACOST_CI_DISABLE_DASHBOARD: "true"` on the step if you do not use the dashboard.
- The `api-key` must be a CLI v2 token, created in the Infracost dashboard under the organization's CLI tokens. The v5 action does not accept older `ico-` API keys.
- The action runs the `ghcr.io/infracost/ci` image, so it needs a Linux runner with Docker.

Remember what the estimate covers (Part 3): fixed prices that Terraform can see. Reviewers should still ask about traffic-driven costs, such as a new NAT gateway path or a chatty cross-zone call.

## Cost Rules on the Plan

A policy check reads the plan as JSON and fails on clear rules. [Conftest](https://www.conftest.dev/) runs Open Policy Agent policies written in Rego. This one, from `policy/cost.rego`:

- takes the environment from the plan's `environment` variable, which Terraform validated, rather than from a tag that a resource could override, and rejects environments it has no rules for;
- requires non-empty cost tags with the right environment on every taggable resource, on the instances and volumes a launch template launches and on Auto Scaling groups (the gaps from Part 4);
- limits instance types per environment for launch templates and EC2 instances, which must set an explicit `instance_type` (extend it if you use mixed instances policies), forbids gp2 EBS volumes (also inside launch templates and in an instance's root and EBS block devices) and warns about Multi-AZ databases outside production;
- fails tags and instance types that are only known after apply, because a value the policy cannot see cannot pass it.

```rego
package main

import rego.v1

# Instance types each environment may use. A bigger size is a policy change,
# reviewed like any other code change.
allowed_instance_types := {
	"dev": {"t4g.small", "t4g.medium"},
	"staging": {"t4g.medium", "m8g.large"},
	"prod": {"m8g.large", "m8g.xlarge", "m8g.2xlarge"},
}

required_tags := {"team", "service", "environment", "cost-center", "owner"}

# The environment comes from the plan's input variable, not from a tag that
# a resource could override.
environment := input.variables.environment.value

deny contains "the plan has no environment variable" if {
	not input.variables.environment.value
}

deny contains msg if {
	not allowed_instance_types[environment]
	msg := sprintf("environment %q has no list of allowed instance types", [environment])
}

# Resources that this plan creates or updates.
changed contains rc if {
	some rc in input.resource_changes
	some action in rc.change.actions
	action in {"create", "update"}
}

# Every set of tags that ends up on billed resources: the tags of each
# resource, the tags a launch template gives to the instances and volumes
# it launches, and the tags of an Auto Scaling group.
tag_sets contains [rc.address, as_tags(rc.change.after.tags_all)] if {
	some rc in changed
	"tags_all" in object.keys(rc.change.after)
}

as_tags(x) := x if is_object(x)

as_tags(x) := {} if x == null

# Values that are only known after apply cannot be checked, so they fail:
# resource tags, launch template and Auto Scaling group tags, and instance types.
deny contains msg if {
	some rc in changed
	some attribute in ["tags_all", "tag_specifications", "tag", "instance_type"]
	unknown := object.get(rc.change.after_unknown, attribute, false)
	some path
	walk(unknown, [path, true])
	msg := sprintf("%s: %s is unknown until apply; build it from known values", [rc.address, attribute])
}

deny contains msg if {
	some rc in changed
	rc.type in {"aws_launch_template", "aws_instance"}
	not rc.change.after.instance_type
	not rc.change.after_unknown.instance_type
	msg := sprintf("%s: set an explicit instance_type, so the policy can check it", [rc.address])
}

tag_sets contains [sprintf("%s (%s)", [rc.address, spec.resource_type]), spec.tags] if {
	some rc in changed
	rc.type == "aws_launch_template"
	some spec in rc.change.after.tag_specifications
}

tag_sets contains [rc.address, {t.key: t.value | some t in rc.change.after.tag}] if {
	some rc in changed
	rc.type == "aws_autoscaling_group"
}

deny contains msg if {
	some [address, tags] in tag_sets
	tags.environment != environment
	msg := sprintf("%s: environment tag %q does not match the environment %q", [address, tags.environment, environment])
}

deny contains msg if {
	some [address, tags] in tag_sets
	present := {key | some key, value in tags; trim_space(value) != ""}
	missing := required_tags - present
	count(missing) > 0
	msg := sprintf("%s: missing cost tags: %s", [address, concat(", ", sort(missing))])
}

deny contains msg if {
	some rc in changed
	rc.type == "aws_launch_template"
	tagged := {spec.resource_type | some spec in rc.change.after.tag_specifications}
	missing := {"instance", "volume"} - tagged
	count(missing) > 0
	msg := sprintf("%s: no tag_specifications for: %s", [rc.address, concat(", ", sort(missing))])
}

# Covers launch templates and EC2 instances. Extend it if you use
# mixed instances policies in Auto Scaling groups.
deny contains msg if {
	some rc in changed
	rc.type in {"aws_launch_template", "aws_instance"}
	itype := rc.change.after.instance_type
	not itype in allowed_instance_types[environment]
	allowed := concat(", ", sort(allowed_instance_types[environment]))
	msg := sprintf("%s: %s is not allowed in %s (allowed: %s)", [rc.address, itype, environment, allowed])
}

# gp3 costs less per GB than gp2 for EBS volumes.
deny contains msg if {
	some rc in changed
	rc.type == "aws_ebs_volume"
	rc.change.after.type == "gp2"
	msg := sprintf("%s: use gp3 instead of gp2", [rc.address])
}

deny contains msg if {
	some rc in changed
	rc.type == "aws_launch_template"
	some mapping in rc.change.after.block_device_mappings
	some ebs in mapping.ebs
	ebs.volume_type == "gp2"
	msg := sprintf("%s: %s uses gp2; use gp3 instead", [rc.address, mapping.device_name])
}

deny contains msg if {
	some rc in changed
	rc.type == "aws_instance"
	some block in ["root_block_device", "ebs_block_device"]
	some device in object.get(rc.change.after, block, [])
	device.volume_type == "gp2"
	msg := sprintf("%s: %s uses gp2; use gp3 instead", [rc.address, block])
}

warn contains msg if {
	some rc in changed
	rc.type == "aws_db_instance"
	rc.change.after.multi_az == true
	environment != "prod"
	msg := sprintf("%s: Multi-AZ doubles the instance cost; is it needed outside prod?", [rc.address])
}
```

Run it against the `dev` plan, the same way the workflow below does. Start from the repository root, where Part 4 ended; the `dev` workspace from Part 4 is still selected. First the plan as it is:

```terminal
{
  "title": "The dev plan passes",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd infra"
    },
    {
      "cmd": "terraform plan -var-file=env/dev.tfvars -out=tfplan > /dev/null && terraform show -json tfplan > plan.json"
    },
    {
      "cmd": "conftest test plan.json --policy ../policy",
      "output": "12 tests, 12 passed, 0 warnings, 0 failures, 0 exceptions"
    }
  ]
}
```

Now someone sets the `dev` instance type to `m7i.2xlarge`, a size that costs USD 294.34 a month per instance around the clock, 24 times the price of the `t4g.small` it replaces (US East on-demand prices, October 2026):

```terminal
{
  "title": "An oversized dev instance fails",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform plan -var-file=env/dev.tfvars -var instance_type=m7i.2xlarge -out=tfplan > /dev/null && terraform show -json tfplan > plan.json"
    },
    {
      "cmd": "conftest test plan.json --policy ../policy",
      "output": "FAIL - plan.json - main - aws_launch_template.app: m7i.2xlarge is not allowed in dev (allowed: t4g.medium, t4g.small)\n\n12 tests, 11 passed, 0 warnings, 1 failure, 0 exceptions"
    },
    {
      "cmd": "cd .."
    }
  ]
}
```

The failure names the resource, the value and what is allowed, so the author can fix it or argue for a policy change in the same pull request. Keep rules like these few and unambiguous: an allowed list per environment is easy to agree on, while a rule such as "no change above USD 500" needs context that a reviewer has and a policy does not.

## The Workflow

This workflow plans each environment and runs the policy when a pull request touches `infra/` or `policy/`. It is also in the companion repository, switched off until you set the repository variable `COST_CHECKS_ENABLED` to `true`:

```yaml
name: Cost checks

# Plans each environment and checks the plan against policy/cost.rego.
#
# A plan runs code from the pull request (providers, data sources), so the
# AWS roles it uses are read-only: read access to the resources and to the
# state, nothing else. Plans run with -lock=false, so they need no write
# access to the state lock. Each GitHub environment below holds its own
# AWS_PLAN_ROLE_ARN variable, and each role trusts only its environment
# through the OIDC subject (repo:<org>/<repo>:environment:plan-nonprod or
# :plan-prod). Give plan-prod required reviewers. A pull request can edit
# this file, so the read-only permissions are the boundary for these roles.
#
# Turn it on with the repository variable COST_CHECKS_ENABLED=true, and make
# "Cost checks result" a required check.

on:
  pull_request:

permissions:
  contents: read

jobs:
  # Runs on every pull request, so that the result job below always reports.
  changes:
    if: vars.COST_CHECKS_ENABLED == 'true'
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      pull-requests: read
    outputs:
      infra: ${{ steps.diff.outputs.infra }}
    steps:
      - id: diff
        env:
          GH_TOKEN: ${{ github.token }}
          PR: ${{ github.event.pull_request.number }}
          REPO: ${{ github.repository }}
        run: |
          set -euo pipefail
          files=$(gh pr diff "$PR" --repo "$REPO" --name-only)
          if grep -Eq '^(infra|policy)/' <<< "$files"; then
            echo "infra=true" >> "$GITHUB_OUTPUT"
          else
            echo "infra=false" >> "$GITHUB_OUTPUT"
          fi

  plan:
    needs: changes
    # Only for branches of this repository; pull requests from forks get no
    # cloud credentials.
    if: >-
      needs.changes.outputs.infra == 'true' &&
      github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-24.04
    environment: ${{ matrix.github_environment }}
    permissions:
      contents: read
      id-token: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - environment: dev
            github_environment: plan-nonprod
          - environment: staging
            github_environment: plan-nonprod
          - environment: prod
            github_environment: plan-prod
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - uses: aws-actions/configure-aws-credentials@e1253824e5c10ff9df46874f81ed3ec929e19cfd # v6.3.0
        with:
          role-to-assume: ${{ vars.AWS_PLAN_ROLE_ARN }}
          aws-region: us-east-1

      - uses: hashicorp/setup-terraform@dfe3c3f87815947d99a8997f908cb6525fc44e9e # v4.0.1
        with:
          terraform_version: 1.17.0
          terraform_wrapper: false

      - name: Install conftest
        run: |
          set -euo pipefail
          cd "$(mktemp -d)"
          curl -fsSLO https://github.com/open-policy-agent/conftest/releases/download/v0.71.1/conftest_0.71.1_Linux_x86_64.tar.gz
          curl -fsSLO https://github.com/open-policy-agent/conftest/releases/download/v0.71.1/checksums.txt
          grep ' conftest_0.71.1_Linux_x86_64.tar.gz$' checksums.txt | sha256sum -c
          tar -xzf conftest_0.71.1_Linux_x86_64.tar.gz conftest
          sudo install -m 0755 conftest /usr/local/bin/conftest

      - name: Plan ${{ matrix.environment }}
        working-directory: infra
        env:
          ENVIRONMENT: ${{ matrix.environment }}
        run: |
          set -euo pipefail
          terraform init -input=false
          terraform workspace select "$ENVIRONMENT"
          terraform plan -input=false -lock=false \
            -var-file="env/$ENVIRONMENT.tfvars" -var="environment=$ENVIRONMENT" -out=tfplan
          terraform show -json tfplan > plan.json

      - name: Check the plan against the cost policy
        working-directory: infra
        run: conftest test plan.json --policy ../policy

  # One check with a fixed name: it passes when nothing in infra/ or policy/
  # changed, and otherwise only when every environment's plan passed.
  result:
    name: Cost checks result
    if: always() && vars.COST_CHECKS_ENABLED == 'true'
    needs: [changes, plan]
    runs-on: ubuntu-24.04
    steps:
      - env:
          CHANGES: ${{ needs.changes.result }}
          INFRA: ${{ needs.changes.outputs.infra }}
          PLAN: ${{ needs.plan.result }}
          FORK: ${{ github.event.pull_request.head.repo.full_name != github.repository }}
        run: |
          echo "change detection: $CHANGES, infra or policy changed: $INFRA, plans: $PLAN"
          if [ "$CHANGES" != success ]; then exit 1; fi
          if [ "$INFRA" = true ] && [ "$PLAN" != success ]; then
            if [ "$FORK" = true ]; then
              echo "::error::Infrastructure changes from a fork are not planned with cloud credentials. A maintainer must push the branch to this repository."
            fi
            exit 1
          fi
```

- **A `changes` job instead of a `paths` filter, and one result job**: a workflow skipped by `paths` never reports its checks, and a required check that never reports blocks the pull request. The matrix has the same problem in a different form: the check names (`plan (dev)` and so on) only exist when the matrix runs. So the workflow runs on every pull request, skips the plans when `infra/` and `policy/` did not change, and reports one check with a fixed name, `Cost checks result`, which fails if change detection failed or if any plan did not pass. Make that one the required check.
- **Read-only credentials, because a plan runs pull request code.** `terraform plan` runs the providers and data sources in the pull request's configuration, so anyone who can open a pull request can run code with the plan's credentials. Keep the plan roles read-only. Speculative plans do not need the state lock, so the job plans with `-lock=false` and the role needs no write access to the state bucket at all. (A plan that reads the state while an apply writes it can fail; run it again.)
- **Each role trusts one GitHub environment.** The matrix runs `dev` and `staging` in the GitHub environment `plan-nonprod` and `prod` in `plan-prod`, and each environment holds its own `AWS_PLAN_ROLE_ARN` variable. The role's trust policy accepts only that environment's OIDC subject, for example `repo:example-org/checkout:environment:plan-prod`, and `plan-prod` has required reviewers, so production credentials are used only after someone approves the run. Pinning these roles to the workflow file would not add much: a pull request can edit `cost-checks.yml` itself, so the read-only permissions are the real boundary.
- **No credentials for forks.** The `plan` job only runs for branches of this repository; GitHub also does not issue OIDC tokens to workflows from fork pull requests by default. When a fork changes `infra/`, the result check fails with a message, and a maintainer pushes the branch to the repository after reading the change.
- **One state per environment**: each matrix job selects the workspace named after its environment and passes the same name as `-var="environment=..."`, and the precondition from Part 4 rejects a plan whose workspace and environment disagree. The policy's environment therefore always matches the state being planned.
- **Pinned and verified tools**: actions are pinned to commit SHAs, and Conftest is downloaded with its checksum checked.
- **`terraform_wrapper: false`** keeps `terraform show -json` output clean for the next step.
- **Make it required**: add `Cost checks result` to the branch's required status checks (a ruleset or branch protection), or a failing policy is only advice.

All three workflows in this part pass actionlint 1.7.12.

## Reviews for Cost-Driving Changes

Instead of a cost approval step, send the changes that drive cost to their owners with a `CODEOWNERS` file:

```text
# .github/CODEOWNERS
/infra/locals.tf                    @example-org/payments-leads
/policy/                            @example-org/platform-finops
/.github/workflows/cost-checks.yml  @example-org/platform-finops
/.github/CODEOWNERS                 @example-org/platform-finops
```

With "Require review from Code Owners" turned on, a change to the sizes map needs a payments lead, and a change to the policy needs the platform or FinOps owners. The workflow and the CODEOWNERS file need the same owners: otherwise a pull request could switch the check off (a `result` job with `if: false` is skipped, and a skipped required check counts as passing) or remove itself from review. Everything else merges with the normal review. Infracost's paid plans add guardrails that require approval when a pull request raises costs past a threshold, if you want a number-based rule.

## Clean Up Preview Environments

Preview environments per pull request are useful and easy to forget. Destroy them when the pull request closes. If your previews run as one Terraform workspace per pull request, a workflow like this one does it (the `infra/` module in the companion repository uses fixed names, so it is switched off there):

```yaml
name: Preview cleanup

# Destroys the Terraform workspace of a pull request's preview environment
# (pr-<number>) when the pull request is closed or merged. The infra/ module
# in this repository uses fixed names, so this is switched off here; turn it
# on with the repository variable PREVIEW_CLEANUP_ENABLED=true. The GitHub
# environment preview-cleanup holds PREVIEW_ROLE_ARN: an IAM role that can
# only delete preview resources and that trusts only that environment
# through the OIDC subject (repo:<org>/<repo>:environment:preview-cleanup).
# Any workflow on any branch that names the environment gets that subject,
# so give the environment a deployment branch policy that allows only the
# default branch (pull_request_target jobs run on the base branch), and
# required reviewers if you want a person to approve each cleanup.
#
# pull_request_target runs this file as it is on the base branch, and the
# checkout below is the base branch too, so no code from the pull request
# runs with the role.

on:
  pull_request_target:
    types: [closed]

permissions:
  contents: read
  id-token: write

concurrency:
  group: preview-${{ github.event.pull_request.number }}

jobs:
  destroy:
    if: vars.PREVIEW_CLEANUP_ENABLED == 'true'
    runs-on: ubuntu-24.04
    environment: preview-cleanup
    env:
      WORKSPACE: pr-${{ github.event.pull_request.number }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ github.event.pull_request.base.sha }}
          persist-credentials: false

      - uses: aws-actions/configure-aws-credentials@e1253824e5c10ff9df46874f81ed3ec929e19cfd # v6.3.0
        with:
          role-to-assume: ${{ vars.PREVIEW_ROLE_ARN }}
          aws-region: us-east-1

      - uses: hashicorp/setup-terraform@dfe3c3f87815947d99a8997f908cb6525fc44e9e # v4.0.1
        with:
          terraform_version: 1.17.0
          terraform_wrapper: false

      - name: Destroy the preview environment
        working-directory: infra
        run: |
          set -euo pipefail
          terraform init -input=false
          # A failed listing stops the job here instead of looking like
          # "nothing to destroy".
          workspaces=$(terraform workspace list)
          if ! grep -Eq "^[* ] $WORKSPACE\$" <<< "$workspaces"; then
            echo "No workspace $WORKSPACE, nothing to destroy."
            exit 0
          fi
          terraform workspace select "$WORKSPACE"
          terraform destroy -input=false -auto-approve -var-file=env/dev.tfvars
          terraform workspace select default
          terraform workspace delete "$WORKSPACE"
```

- **It runs no code from the pull request.** A destroy job needs a role that can delete things, so it must not run Terraform code that a pull request can change (a provider, a backend or a provisioner runs with the role). `pull_request_target` takes the workflow file from the base branch, and the checkout is the base branch too. Scope the role to preview resources, for example with a condition on their tags.
- **Only this workflow gets the delete role.** The role trusts the OIDC subject of the `preview-cleanup` GitHub environment, but any workflow on any branch that names that environment gets the same subject. Give the environment a deployment branch policy that allows only the default branch (a `pull_request_target` job runs on the base branch, so cleanup still works), and required reviewers if you want a person to approve each cleanup. To pin the role to this workflow file as well, add `job_workflow_ref` to the repository's OIDC subject with GitHub's subject customization and match it in the trust policy.
- **It destroys before it deletes the workspace**, for the reason Part 2 gave: deleting a workspace that still tracks resources leaves them running. If listing the workspaces fails, the job fails, rather than reporting that there was nothing to destroy.
- **The base branch must be able to destroy what the preview created.** If a pull request adds a provider, the base branch configuration cannot destroy those resources; clean up such previews by hand.

As a safety net, give preview resources an expiry date tag and have a scheduled [Cloud Custodian](/guides/finops-for-devops-engineers/03-tools) policy report anything past its date.

## After the Deploy

The checks above work on estimates. After a release, check the real numbers:

- Cost data arrives with a delay: Cost Explorer refreshes at least once a day, and a newly activated tag needs up to 24 hours. Look at a change's cost a few days after it ships, grouped by the `service` tag, and compare it with the estimate.
- The anomaly monitor and budget from Part 4 watch each service continuously and alert its team.
- Do not build per-deployment alarms on the CloudWatch `EstimatedCharges` metric. It is the whole account's month-to-date total, published only in us-east-1 and only after you enable billing alerts, so it cannot tell one deployment from another.
- Mark deployments on your cost dashboards (for example, as Grafana annotations), so a cost step lines up with the release that caused it.

## The Pipeline's Own Bill

CI is infrastructure too, and it grows with every workflow. The expensive jobs in this part only run when `infra/` or `policy/` changes: Infracost through a `paths` filter (its check is informational, so it does not need to be required), and the plans through the `changes` job. Add `concurrency` with `cancel-in-progress: true` to workflows that run on every push, cache dependencies, and use larger runners only where they finish enough faster to pay for themselves. [Why Your GitHub Actions Bill Keeps Growing](/posts/github-actions-bill-keeps-growing) and [What Does One Merge Actually Cost You in CI?](/posts/what-does-one-merge-cost-in-ci) measure these effects.

## Common Mistakes

- **Blocking on estimates.** Estimates miss traffic-driven costs; use them to inform, and block only on agreed rules.
- **A policy nobody can change.** Keep the policy in the repository, reviewed by its owners, so a valid exception is a pull request, not a ticket.
- **Plans without state.** Without the real state, every plan shows every resource as new, and estimates and policies see the whole stack instead of the change.
- **Optional checks.** A check that is not required is ignored the first time it is inconvenient.
- **Forgetting the delete path.** Every workflow that creates an environment needs one that destroys it.

## Summary

- Pull requests are the cheapest place to see and stop a cost mistake.
- Infracost shows the monthly change; current setups use its GitHub App or the v5 `diff` action with a CLI v2 token.
- Conftest checks the plan JSON against a few clear rules; make the check required.
- CODEOWNERS routes cost-driving changes to their owners without a central approval queue.
- Destroy preview environments on close, and check the real cost a few days after each release.

Next, [Part 6](/guides/finops-for-devops-engineers/06-cultural-shift) turns these tools into team habits: showback, unit costs and regular reviews.

## Keep Learning

- [Introduction to CI/CD with GitHub Actions](/guides/introduction-to-cicd)
- [Why Your GitHub Actions Bill Keeps Growing, and What Each Fix Saves](/posts/github-actions-bill-keeps-growing)
- [What Does One Merge Actually Cost You in CI?](/posts/what-does-one-merge-cost-in-ci)
- [Interview questions: Cloud Cost Optimization](/interview-questions/senior/cloud-cost-optimization)
