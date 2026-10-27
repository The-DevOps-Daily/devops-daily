---
title: 'Practical FinOps: Tags, Budgets and Alerts as Code'
description: 'Terraform for FinOps: a validated tag schema, the gaps in default_tags, environment sizes, office hours, budgets and an anomaly alert per service.'
order: 4
---

**TLDR**: Put cost controls in the same Terraform that creates the resources. Validate the tag values as variables, so a plan fails when the owner is missing. Apply them with the provider's `default_tags`, and add them by hand where `default_tags` does not reach: Auto Scaling groups and the instances and volumes they launch. Keep every environment's size in one map, run `dev` only in office hours, and give each environment a budget that alerts its team. In the management account, activate the tags for cost allocation, add an anomaly monitor per service, and enforce the tags across accounts with a tag policy and an SCP.

This part builds the `infra/` directory of the companion repository: the `checkout` service of the `payments` team, with an Auto Scaling group, a PostgreSQL database and a budget, applied once per environment. The organization-wide pieces live in `management/`. Every plan below ran with Terraform 1.17.0 and the AWS provider 6.70.0.

## Prerequisites

- Terraform 1.10 or later, and `jq`.
- The companion repository from [Part 1](/guides/finops-for-devops-engineers/01-principles), with the repository root as your working directory.
- To apply the code for real: an AWS account, and in the `env/*.tfvars` files your own AMI, subnets and DB subnet group instead of the placeholders.

The runs in this part used mock credentials. The configuration reads nothing from AWS, so `terraform plan` needs no API calls, and a provider override with fake keys is enough. To follow along without an AWS account, copy it into both Terraform directories:

```bash
cp ci/mock_provider_override.tf infra/
cp ci/mock_provider_override.tf management/
```

:::warning
Delete both copies (`rm infra/mock_provider_override.tf management/mock_provider_override.tf`) before you run Terraform with real credentials. With the override in place, Terraform uses the fake keys and skips the credential checks.
:::

## The Tag Schema

The schema follows the [cost allocation tags post](/posts/cloud-cost-allocation-tags-aws-gcp-azure): lowercase keys with hyphens, and values from a short list where possible.

| Key           | Example                       | Used for                                       |
| ------------- | ----------------------------- | ---------------------------------------------- |
| `team`        | `payments`                    | Showback, budgets, who gets the alert          |
| `service`     | `checkout`                    | Cost per service, budgets and anomaly monitors |
| `environment` | `dev`, `staging`, `prod`      | Separating production from everything else     |
| `cost-center` | `cc-1042`                     | Finance's chargeback                           |
| `owner`       | `payments-oncall@example.com` | Who to ask before deleting something           |
| `managed-by`  | `terraform`                   | Telling managed resources from hand-made ones  |

Two rules matter more than the exact keys: everyone uses the same spelling, and Terraform refuses values outside the rules.

## Validate the Tags in Terraform

Each tag value is a variable with a `validation` block. The `environment` must come from the list, and the `owner` must be an email address:

```hcl
variable "environment" {
  description = "Deployment environment."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}
```

```hcl
variable "owner" {
  description = "Email address of the person or group to ask about these resources."
  type        = string

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$", var.owner))
    error_message = "owner must be an email address, for example payments-oncall@example.com."
  }
}
```

Each environment keeps its own state in a Terraform workspace of the same name. Create `dev`, then try a plan with a bad value; it stops before Terraform creates anything (the `init` output is cut to its first lines):

```terminal
{
  "title": "A missing owner fails the plan",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd infra"
    },
    {
      "cmd": "terraform init",
      "output": "Initializing the backend...\n\nInitializing provider plugins...\n- Finding hashicorp/aws versions matching \"~> 6.70\"...\n- Installing hashicorp/aws v6.70.0...\n- Installed hashicorp/aws v6.70.0 (signed by HashiCorp)"
    },
    {
      "cmd": "terraform workspace select -or-create dev",
      "output": "Created and switched to workspace \"dev\"!\n\nYou're now on a new, empty workspace. Workspaces isolate their state,\nso if you run \"terraform plan\" Terraform will not see any existing state\nfor this configuration."
    },
    {
      "cmd": "terraform plan -var-file=env/dev.tfvars -var owner=payments",
      "output": "Planning failed. Terraform encountered an error while generating this plan.\n\n╷\n│ Error: Invalid value for variable\n│\n│   on variables.tf line 47:\n│   47: variable \"owner\" {\n│     ├────────────────\n│     │ var.owner is \"payments\"\n│\n│ owner must be an email address, for example payments-oncall@example.com.\n│\n│ This was checked by the validation rule at variables.tf:51,3-13.\n╵"
    }
  ]
}
```

## Default Tags, and Where They Stop

The provider's `default_tags` block puts the tags on every resource that supports tags, so nobody has to remember them:

```hcl
provider "aws" {
  region = var.region

  # Every resource that supports tags gets the cost allocation tags.
  default_tags {
    tags = local.cost_tags
  }
}
```

The values come from one local map, so the schema lives in one place:

```hcl
locals {
  # The tag schema. Keys are lowercase with hyphens; activate them as cost allocation tags.
  cost_tags = {
    team          = var.team
    service       = var.service
    environment   = var.environment
    "cost-center" = var.cost_center
    owner         = var.owner
    "managed-by"  = "terraform"
  }
```

`default_tags` has two gaps that matter for cost:

- The provider documentation says `default_tags` works on all resources that implement `tags`, [with the exception of `aws_autoscaling_group`](https://registry.terraform.io/providers/hashicorp/aws/latest/docs#default_tags-configuration-block).
- Terraform tags what it creates. Instances and volumes that an Auto Scaling group launches are created by AWS, not by Terraform, so they only get the tags in the launch template's `tag_specifications`. Without them, the biggest cost of the service shows up untagged.

The launch template and the Auto Scaling group close both gaps. The launch template also carries a precondition that ties the workspace to `var.environment`, so a plan with the `prod` variables cannot run against another environment's state:

```hcl
resource "aws_launch_template" "app" {
  name_prefix   = "${local.name}-"
  image_id      = var.ami_id
  instance_type = local.instance_type

  metadata_options {
    http_tokens = "required"
  }

  block_device_mappings {
    device_name = "/dev/xvda"

    ebs {
      volume_size           = 20
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  # default_tags tag the launch template itself, not the instances and
  # volumes that the Auto Scaling group launches from it.
  tag_specifications {
    resource_type = "instance"
    tags          = local.cost_tags
  }

  tag_specifications {
    resource_type = "volume"
    tags          = local.cost_tags
  }

  lifecycle {
    # Plans for prod must run in the prod workspace, against prod's state.
    # Preview workspaces (pr-<number>) use the dev settings.
    precondition {
      condition     = terraform.workspace == var.environment || (var.environment == "dev" && startswith(terraform.workspace, "pr-"))
      error_message = "The workspace must match var.environment: run terraform workspace select ${var.environment}."
    }
  }
}

resource "aws_autoscaling_group" "app" {
  name                = local.name
  vpc_zone_identifier = var.subnet_ids
  min_size            = local.size.min_size
  max_size            = local.size.max_size

  launch_template {
    id      = aws_launch_template.app.id
    version = aws_launch_template.app.latest_version
  }

  # A new launch template version (for example, a new instance type)
  # replaces the running instances, starting the new ones before it
  # stops the old ones.
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 100
      max_healthy_percentage = 200
    }
  }

  # The provider's default_tags skip aws_autoscaling_group, so tag it here.
  dynamic "tag" {
    for_each = local.cost_tags
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = false
    }
  }

  lifecycle {
    # Scaling policies and schedules change the desired capacity.
    ignore_changes = [desired_capacity]
  }
}
```

Plan `dev`, save the plan, and check the tags that every launched instance and volume will carry (the plan's end is shown):

```terminal
{
  "title": "Plan dev and check the launch tags",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform plan -var-file=env/dev.tfvars -out=dev.tfplan",
      "output": "\nPlan: 9 to add, 0 to change, 0 to destroy.\n\n─────────────────────────────────────────────────────────────────────────────\n\nSaved the plan to: dev.tfplan\n\nTo perform exactly these actions, run the following command to apply:\n    terraform apply \"dev.tfplan\""
    },
    {
      "cmd": "terraform show -json dev.tfplan | jq '.resource_changes[] | select(.address == \"aws_launch_template.app\") | .change.after.tag_specifications'",
      "output": "[\n  {\n    \"resource_type\": \"instance\",\n    \"tags\": {\n      \"cost-center\": \"cc-1042\",\n      \"environment\": \"dev\",\n      \"managed-by\": \"terraform\",\n      \"owner\": \"payments-oncall@example.com\",\n      \"service\": \"checkout\",\n      \"team\": \"payments\"\n    }\n  },\n  {\n    \"resource_type\": \"volume\",\n    \"tags\": {\n      \"cost-center\": \"cc-1042\",\n      \"environment\": \"dev\",\n      \"managed-by\": \"terraform\",\n      \"owner\": \"payments-oncall@example.com\",\n      \"service\": \"checkout\",\n      \"team\": \"payments\"\n    }\n  }\n]"
    }
  ]
}
```

## Activate the Tags for Cost Allocation

AWS does not use resource tags in billing until you activate them as **cost allocation tags**. With AWS Organizations, that happens in the management account, which is also the only account that can create tag-based anomaly monitors. The `management/` directory of the companion repository holds those organization-wide pieces. Its first resource activates the schema's keys:

```hcl
# Billing ignores resource tags until they are activated for cost allocation.
resource "aws_ce_cost_allocation_tag" "cost_tags" {
  for_each = toset(["team", "service", "environment", "cost-center", "owner"])

  tag_key = each.value
  status  = "Active"
}
```

A tag key can only be activated after billing has seen it on a resource, and activation can take up to 24 hours to show in Cost Explorer. Without Terraform, the AWS CLI does the same:

```bash
aws ce update-cost-allocation-tags-status --cost-allocation-tags-status \
  TagKey=team,Status=Active TagKey=service,Status=Active TagKey=environment,Status=Active \
  TagKey=cost-center,Status=Active TagKey=owner,Status=Active
```

Activation applies to costs from then on. To fill in earlier months, request a backfill; it starts on the first day of a month, at most 12 months back, and only helps for resources that already carried the tags then:

```bash
aws ce start-cost-allocation-tag-backfill --backfill-from 2026-01-01T00:00:00Z
```

## Enforce the Schema Across Accounts

Terraform validation protects this module. To protect every account, add organization-wide controls:

**Tag policies with required tags.** Since November 2025, an AWS Organizations tag policy can list required tag keys per resource type (`report_required_tag_for`), and the Terraform AWS provider 6.22 and later can check every plan against it. A policy for the `checkout` resources, attached in the management account:

```json
{
  "tags": {
    "owner": {
      "tag_key": { "@@assign": "owner" },
      "report_required_tag_for": {
        "@@assign": ["ec2:instance", "ec2:volume", "ec2:launch-template", "rds:db"]
      }
    }
  }
}
```

Then turn the check on in the provider. With `"error"`, a plan that creates an `owner`-less resource of those types fails; `"warning"` only reports it. The check runs when Terraform creates a resource or changes its tags, so in this module it covers the launch template and the database; the `ec2:instance` and `ec2:volume` entries cover direct launches and AWS's compliance reports. The identity that runs Terraform needs the `tag:ListRequiredTags` permission:

```hcl
provider "aws" {
  tag_policy_compliance = "error"
}
```

See the provider's [tag policy compliance guide](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/guides/tag-policy-compliance) for the resource types it covers, and AWS's [IaC enforcement page](https://docs.aws.amazon.com/organizations/latest/userguide/enforce-required-tag-keys-iac.html) for the CloudFormation and Pulumi equivalents.

**A service control policy (SCP)** blocks untagged launches from anything, including the console and scripts. One statement per required key matters: several keys in one `Null` condition must all be missing before the statement denies.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyRunInstancesWithoutTeam",
      "Effect": "Deny",
      "Action": "ec2:RunInstances",
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": { "Null": { "aws:RequestTag/team": "true" } }
    },
    {
      "Sid": "DenyRunInstancesWithoutOwner",
      "Effect": "Deny",
      "Action": "ec2:RunInstances",
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": { "Null": { "aws:RequestTag/owner": "true" } }
    }
  ]
}
```

SCPs do not apply to service-linked roles, so they do not stop an Auto Scaling group from launching instances; the launch template's tags handle those. Test an SCP on a sandbox organizational unit first: a deny that is too broad breaks deployments.

**Detection** catches what slips through: the AWS Config managed rule `required-tags`, or the Cloud Custodian policies from [Part 3](/guides/finops-for-devops-engineers/03-tools). AWS Config bills per configuration item recorded and per rule evaluation, so record only the resource types you need.

## Size Each Environment Once

Every size-related setting lives in one map, keyed by environment:

```hcl
  # Production capacity only where production needs it.
  sizes = {
    dev = {
      instance_type     = "t4g.small"
      min_size          = 0 # the office-hours schedule below sets the capacity
      max_size          = 2
      db_instance_class = "db.t4g.micro"
      db_storage_gb     = 20
      db_multi_az       = false
      db_backup_days    = 1
      office_hours_only = true
    }
    staging = {
      instance_type     = "t4g.medium"
      min_size          = 1
      max_size          = 2
      db_instance_class = "db.t4g.small"
      db_storage_gb     = 20
      db_multi_az       = false
      db_backup_days    = 3
      office_hours_only = false
    }
    prod = {
      instance_type     = "m8g.large"
      min_size          = 2
      max_size          = 6
      db_instance_class = "db.m8g.large"
      db_storage_gb     = 100
      db_multi_az       = true
      db_backup_days    = 14
      office_hours_only = false
    }
  }

  size          = local.sizes[var.environment]
  instance_type = coalesce(var.instance_type, local.size.instance_type)
  name          = "${var.service}-${var.environment}"
}
```

`terraform console` shows what each environment gets:

```terminal
{
  "title": "dev and prod sizes",
  "prompt": "$",
  "steps": [
    {
      "cmd": "echo 'local.size' | terraform console -var-file=env/dev.tfvars",
      "output": "{\n  \"db_backup_days\" = 1\n  \"db_instance_class\" = \"db.t4g.micro\"\n  \"db_multi_az\" = false\n  \"db_storage_gb\" = 20\n  \"instance_type\" = \"t4g.small\"\n  \"max_size\" = 2\n  \"min_size\" = 0\n  \"office_hours_only\" = true\n}"
    },
    {
      "cmd": "echo 'local.size' | terraform console -var-file=env/prod.tfvars",
      "output": "{\n  \"db_backup_days\" = 14\n  \"db_instance_class\" = \"db.m8g.large\"\n  \"db_multi_az\" = true\n  \"db_storage_gb\" = 100\n  \"instance_type\" = \"m8g.large\"\n  \"max_size\" = 6\n  \"min_size\" = 2\n  \"office_hours_only\" = false\n}"
    }
  ]
}
```

With US East (N. Virginia) on-demand prices from the AWS Price List (October 2026), the difference is clear. Production's two `m8g.large` instances cost USD 131.05 a month; development's one `t4g.small`, running 55 hours a week, uses about 238 hours a month and costs about USD 4. Production's Multi-AZ `db.m8g.large` costs USD 245.28 a month; development's single-AZ `db.t4g.micro` costs USD 11.68. Storage, backups and data transfer come on top of both.

A right-sizing change is now a one-line diff in this map, reviewed like any other change. When it changes the instance type, Terraform writes a new launch template version, and the Auto Scaling group's `instance_refresh` block (in the excerpt above) replaces the running instances: it starts the new ones before it stops the old ones, so capacity never drops below 100 percent. Without that block, running instances keep their old size until something replaces them.

## Run Development Only in Office Hours

The `dev` Auto Scaling group has `min_size = 0`, and two scheduled actions set the desired capacity:

```hcl
# Development runs on weekdays from 08:00 to 19:00 New York time.
resource "aws_autoscaling_schedule" "office_hours_start" {
  count = local.size.office_hours_only ? 1 : 0

  autoscaling_group_name = aws_autoscaling_group.app.name
  scheduled_action_name  = "office-hours-start"
  recurrence             = "0 8 * * MON-FRI"
  time_zone              = "America/New_York"
  min_size               = -1
  max_size               = -1
  desired_capacity       = 1
}

resource "aws_autoscaling_schedule" "office_hours_stop" {
  count = local.size.office_hours_only ? 1 : 0

  autoscaling_group_name = aws_autoscaling_group.app.name
  scheduled_action_name  = "office-hours-stop"
  recurrence             = "0 19 * * MON-FRI"
  time_zone              = "America/New_York"
  min_size               = -1
  max_size               = -1
  desired_capacity       = 0
}
```

- `min_size` and `max_size` of `-1` leave those limits alone; only the desired capacity changes.
- `time_zone` makes the cron expression follow New York time, including daylight saving changes.
- The group ignores `desired_capacity` in Terraform (`ignore_changes` above), so an `apply` at 21:00 does not start the instances again.
- A new `dev` group starts with zero instances until the next 08:00 action. To work late, set the desired capacity by hand; the 19:00 action stops the instances again the next evening.

The database keeps running in this example. A stopped RDS instance starts again by itself after seven days, so for development databases that sit idle most of the time, a smaller instance class is the simpler saving. For EC2 instances outside Auto Scaling groups, the [Instance Scheduler on AWS](https://aws.amazon.com/solutions/implementations/instance-scheduler-on-aws/) solution or EventBridge Scheduler does the same job.

## A Budget per Environment

Budgets catch slow growth: the month is on track to end over the limit. Each `checkout` environment gets one, sent to an SNS topic:

```hcl
resource "aws_sns_topic" "cost_alerts" {
  name = "${local.name}-cost-alerts"
}

# AWS Budgets publishes to the topic, for this account only.
data "aws_iam_policy_document" "cost_alerts" {
  statement {
    sid       = "AllowBudgetsToPublish"
    actions   = ["SNS:Publish"]
    resources = [aws_sns_topic.cost_alerts.arn]

    principals {
      type        = "Service"
      identifiers = ["budgets.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [split(":", aws_sns_topic.cost_alerts.arn)[4]]
    }
  }
}

resource "aws_sns_topic_policy" "cost_alerts" {
  arn    = aws_sns_topic.cost_alerts.arn
  policy = data.aws_iam_policy_document.cost_alerts.json
}

resource "aws_sns_topic_subscription" "cost_alerts_email" {
  topic_arn = aws_sns_topic.cost_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_budgets_budget" "service" {
  name         = "${local.name}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  metrics      = ["AmortizedCost"]

  filter_expression {
    and {
      tags {
        key    = "service"
        values = [var.service]
      }
    }
    and {
      tags {
        key    = "environment"
        values = [var.environment]
      }
    }
  }

  # Early warning: the month is on track to end over budget.
  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "FORECASTED"
    subscriber_sns_topic_arns = [aws_sns_topic.cost_alerts.arn]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.cost_alerts.arn]
  }

  # Budgets must be allowed to publish before it sends to the topic.
  depends_on = [aws_sns_topic_policy.cost_alerts]
}
```

The details that matter:

- **The SNS topic policy** lets AWS Budgets (`budgets.amazonaws.com`) publish, but only for this account (`aws:SourceAccount`, taken from the topic's ARN).
- **The budget** filters on the `service` and `environment` tags, so it only works once those tags are activated for cost allocation. It uses amortized cost, so a Savings Plan purchase does not show up as a spike in one team's budget.
- **Two notifications**: a forecast over 100 percent warns early in the month; actual spend over 80 percent confirms it.
- **The `depends_on`** makes Terraform create the topic policy before the budget, so AWS Budgets is allowed to publish when the budget starts sending.
- **The email subscription** sends a confirmation message; nothing arrives until someone confirms it. To post alerts to Slack or Microsoft Teams, add the topic in Amazon Q Developer in chat applications (formerly AWS Chatbot).

The saved `dev` plan lists the service's resources and its budget:

```bash
terraform show -no-color dev.tfplan | grep -E '^  # |^Plan:'
```

```text
  # data.aws_iam_policy_document.cost_alerts will be read during apply
  # (config refers to values not yet known)
  # aws_autoscaling_group.app will be created
  # aws_autoscaling_schedule.office_hours_start[0] will be created
  # aws_autoscaling_schedule.office_hours_stop[0] will be created
  # aws_budgets_budget.service will be created
  # aws_db_instance.app will be created
  # aws_launch_template.app will be created
  # aws_sns_topic.cost_alerts will be created
  # aws_sns_topic_policy.cost_alerts will be created
  # aws_sns_topic_subscription.cost_alerts_email will be created
Plan: 9 to add, 0 to change, 0 to destroy.
```

## An Anomaly Alert per Service

Anomaly detection catches sudden changes: a service's daily spend jumps above its usual pattern. Tag-based monitors can only be created in the management account, so this one lives in `management/` and watches `checkout` in every account and environment:

```hcl
resource "aws_sns_topic" "checkout_anomalies" {
  name = "checkout-cost-anomalies"
}

# Cost Anomaly Detection publishes to the topic, for this account only.
data "aws_iam_policy_document" "checkout_anomalies" {
  statement {
    sid       = "AllowAnomalyDetectionToPublish"
    actions   = ["SNS:Publish"]
    resources = [aws_sns_topic.checkout_anomalies.arn]

    principals {
      type        = "Service"
      identifiers = ["costalerts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [split(":", aws_sns_topic.checkout_anomalies.arn)[4]]
    }
  }
}

resource "aws_sns_topic_policy" "checkout_anomalies" {
  arn    = aws_sns_topic.checkout_anomalies.arn
  policy = data.aws_iam_policy_document.checkout_anomalies.json
}

resource "aws_sns_topic_subscription" "checkout_anomalies_email" {
  topic_arn = aws_sns_topic.checkout_anomalies.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# A customer managed monitor for the costs tagged service=checkout, in
# every account and environment. The null keys follow the provider's
# documented example for custom monitors.
resource "aws_ce_anomaly_monitor" "checkout" {
  name         = "checkout"
  monitor_type = "CUSTOM"

  depends_on = [aws_ce_cost_allocation_tag.cost_tags]

  monitor_specification = jsonencode({
    And            = null
    CostCategories = null
    Dimensions     = null
    Not            = null
    Or             = null
    Tags = {
      Key          = "service"
      MatchOptions = null
      Values       = ["checkout"]
    }
  })
}

resource "aws_ce_anomaly_subscription" "checkout" {
  name             = "checkout"
  frequency        = "IMMEDIATE"
  monitor_arn_list = [aws_ce_anomaly_monitor.checkout.arn]

  subscriber {
    type    = "SNS"
    address = aws_sns_topic.checkout_anomalies.arn
  }

  # Alert when an anomaly's total impact reaches 50 USD.
  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      match_options = ["GREATER_THAN_OR_EQUAL"]
      values        = ["50"]
    }
  }

  depends_on = [aws_sns_topic_policy.checkout_anomalies]
}
```

- **A customer managed monitor** (`CUSTOM`) adds up the costs of the tag values you list, up to 10, as one series. One monitor per team, listing its services, is a common pattern.
- **The subscription** sends each anomaly with a total impact of USD 50 or more as soon as it is detected. `IMMEDIATE` needs an SNS topic; daily and weekly summaries go to email.
- **The topic policy** names Cost Anomaly Detection's service principal, `costalerts.amazonaws.com`.
- **On a new setup, apply in two steps.** A monitor can only use a tag that is already active for cost allocation, and activation only works once billing has seen the tag on a resource, which can take a day. Apply the tag activation first (`terraform -chdir=management apply -target=aws_ce_cost_allocation_tag.cost_tags`), and the rest once the tags show as active in the Billing console. The `depends_on` keeps the order within one apply, but it cannot wait for AWS to finish the activation.

Plan it from the repository root (the plan is reduced to its resource list):

```terminal
{
  "title": "Plan the management account resources",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd .."
    },
    {
      "cmd": "terraform -chdir=management init",
      "output": "Initializing the backend...\n\nInitializing provider plugins...\n- Finding hashicorp/aws versions matching \"~> 6.70\"...\n- Installing hashicorp/aws v6.70.0...\n- Installed hashicorp/aws v6.70.0 (signed by HashiCorp)"
    },
    {
      "cmd": "terraform -chdir=management plan -no-color | grep -E '^  # |^Plan:'",
      "output": "  # data.aws_iam_policy_document.checkout_anomalies will be read during apply\n  # (config refers to values not yet known)\n  # aws_ce_anomaly_monitor.checkout will be created\n  # aws_ce_anomaly_subscription.checkout will be created\n  # aws_ce_cost_allocation_tag.cost_tags[\"cost-center\"] will be created\n  # aws_ce_cost_allocation_tag.cost_tags[\"environment\"] will be created\n  # aws_ce_cost_allocation_tag.cost_tags[\"owner\"] will be created\n  # aws_ce_cost_allocation_tag.cost_tags[\"service\"] will be created\n  # aws_ce_cost_allocation_tag.cost_tags[\"team\"] will be created\n  # aws_sns_topic.checkout_anomalies will be created\n  # aws_sns_topic_policy.checkout_anomalies will be created\n  # aws_sns_topic_subscription.checkout_anomalies_email will be created\nPlan: 10 to add, 0 to change, 0 to destroy."
    }
  ]
}
```

AWS can also manage the monitor for you: an AWS managed monitor on the `service` tag key tracks every value separately, including services that appear later. The AWS provider 6.70 cannot express it (`monitor_dimension` conflicts with `monitor_specification`, which a tag monitor needs), so create it with the AWS CLI in the management account:

```bash
aws ce create-anomaly-monitor --anomaly-monitor \
  '{"MonitorName": "by-service", "MonitorType": "DIMENSIONAL", "MonitorDimension": "TAG", "MonitorSpecification": {"Tags": {"Key": "service"}}}'
```

A subscription on that monitor uses one threshold for every service; to route each service's anomalies to its own team, AWS points to AWS User Notifications with filters on the alert's fields.

## The Same Budget on Azure and Google Cloud

The pattern carries over: a budget per scope, a forecast alert, an actual alert, sent to the owning team. The Azure and Google Cloud versions are in `multicloud/` in the companion repository:

```tabs
{
  "title": "Budget for checkout in dev",
  "tabs": [
    {
      "label": "AWS",
      "lang": "hcl",
      "code": "resource \"aws_budgets_budget\" \"service\" {\n  name         = \"${local.name}-monthly\"\n  budget_type  = \"COST\"\n  limit_amount = tostring(var.monthly_budget_usd)\n  limit_unit   = \"USD\"\n  time_unit    = \"MONTHLY\"\n  metrics      = [\"AmortizedCost\"]\n\n  filter_expression {\n    and {\n      tags {\n        key    = \"service\"\n        values = [var.service]\n      }\n    }\n    and {\n      tags {\n        key    = \"environment\"\n        values = [var.environment]\n      }\n    }\n  }\n\n  # Early warning: the month is on track to end over budget.\n  notification {\n    comparison_operator       = \"GREATER_THAN\"\n    threshold                 = 100\n    threshold_type            = \"PERCENTAGE\"\n    notification_type         = \"FORECASTED\"\n    subscriber_sns_topic_arns = [aws_sns_topic.cost_alerts.arn]\n  }\n\n  notification {\n    comparison_operator       = \"GREATER_THAN\"\n    threshold                 = 80\n    threshold_type            = \"PERCENTAGE\"\n    notification_type         = \"ACTUAL\"\n    subscriber_sns_topic_arns = [aws_sns_topic.cost_alerts.arn]\n  }\n\n  # Budgets must be allowed to publish before it sends to the topic.\n  depends_on = [aws_sns_topic_policy.cost_alerts]\n}"
    },
    {
      "label": "Azure",
      "lang": "hcl",
      "code": "resource \"azurerm_consumption_budget_subscription\" \"checkout_dev\" {\n  name            = \"checkout-dev-monthly\"\n  subscription_id = \"/subscriptions/${var.subscription_id}\"\n  amount          = 150\n  time_grain      = \"Monthly\"\n\n  time_period {\n    start_date = \"2026-11-01T00:00:00Z\"\n  }\n\n  filter {\n    tag {\n      name   = \"service\"\n      values = [\"checkout\"]\n    }\n    tag {\n      name   = \"environment\"\n      values = [\"dev\"]\n    }\n  }\n\n  notification {\n    enabled        = true\n    threshold      = 100\n    threshold_type = \"Forecasted\"\n    operator       = \"GreaterThan\"\n    contact_emails = [\"payments-oncall@example.com\"]\n  }\n\n  notification {\n    enabled        = true\n    threshold      = 80\n    threshold_type = \"Actual\"\n    operator       = \"GreaterThan\"\n    contact_emails = [\"payments-oncall@example.com\"]\n  }\n}"
    },
    {
      "label": "Google Cloud",
      "lang": "hcl",
      "code": "resource \"google_billing_budget\" \"checkout_dev\" {\n  billing_account = var.billing_account\n  display_name    = \"checkout-dev-monthly\"\n\n  budget_filter {\n    projects        = [\"projects/${var.project_number}\"]\n    labels          = { service = \"checkout\" }\n    calendar_period = \"MONTH\"\n  }\n\n  amount {\n    specified_amount {\n      currency_code = \"USD\"\n      units         = \"150\"\n    }\n  }\n\n  threshold_rules {\n    threshold_percent = 0.8\n  }\n\n  threshold_rules {\n    threshold_percent = 1.0\n    spend_basis       = \"FORECASTED_SPEND\"\n  }\n\n  all_updates_rule {\n    monitoring_notification_channels = var.notification_channels\n  }\n}"
    }
  ]
}
```

Differences to know:

- **Azure** filters a subscription budget by tags and sends email directly, or calls an action group. The start date must be the first day of a month.
- **Google Cloud** budgets accept only one label in the filter, so separate environments by project and filter on the `service` label. Thresholds are fractions (`0.8`), and alerts go to Cloud Monitoring notification channels or Pub/Sub.

Both configurations pass `terraform validate` with the current providers (azurerm 5.11, google 8.8; the `init` output is cut to its first lines):

```terminal
{
  "title": "Validate the Azure and Google Cloud budgets",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform -chdir=multicloud/azure init",
      "output": "Initializing the backend...\n\nInitializing provider plugins...\n- Finding hashicorp/azurerm versions matching \"~> 5.11\"...\n- Installing hashicorp/azurerm v5.11.0...\n- Installed hashicorp/azurerm v5.11.0 (signed by HashiCorp)"
    },
    {
      "cmd": "terraform -chdir=multicloud/azure validate",
      "output": "Success! The configuration is valid."
    },
    {
      "cmd": "terraform -chdir=multicloud/google init",
      "output": "Initializing the backend...\n\nInitializing provider plugins...\n- Finding hashicorp/google versions matching \"~> 8.8\"...\n- Installing hashicorp/google v8.8.1...\n- Installed hashicorp/google v8.8.1 (signed by HashiCorp)"
    },
    {
      "cmd": "terraform -chdir=multicloud/google validate",
      "output": "Success! The configuration is valid."
    }
  ]
}
```

## Quick Reports Without an Export

Until the FOCUS export from [Part 3](/guides/finops-for-devops-engineers/03-tools) is in place, the Cost Explorer API answers simple questions. This prints the amortized cost of `checkout` per environment for the month so far:

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-10-01,End=2026-10-27 \
  --granularity MONTHLY \
  --metrics AmortizedCost \
  --filter '{"Tags": {"Key": "service", "Values": ["checkout"]}}' \
  --group-by Type=TAG,Key=environment \
  --query 'ResultsByTime[].Groups[].[Keys[0],Metrics.AmortizedCost.Amount]' \
  --output text
```

Each line pairs a tag value with its cost. Cost Explorer prints the key as `environment$dev`, and costs without the tag appear as `environment$`, which tells you how much is still untagged. The end date is exclusive, and each call costs USD 0.01.

## Common Mistakes

- **Tagging late.** Tags only attribute costs from the day they are activated (a backfill covers at most 12 months, and only resources that were already tagged).
- **Trusting `default_tags` everywhere.** Check the Auto Scaling groups and the instances and volumes they launch.
- **Budgets on the wrong cost type.** Unblended budgets jump when a commitment is bought; use amortized cost for team budgets.
- **Alerts to a shared inbox.** Send them where the owning team already works, and treat an alert like an incident: find the cause the same day.
- **Schedules nobody knows about.** Document the office hours and how to override them, or developers will work around them.

## Summary

- Validate tag values as Terraform variables, so missing or malformed tags fail the plan.
- `default_tags` covers most resources, but not Auto Scaling groups or what they launch; use `tag_specifications` and `tag` blocks there.
- Activate the tags for cost allocation in the management account, and enforce them across accounts with tag policies, the provider's `tag_policy_compliance` and SCPs.
- Size environments in one map and schedule `dev` to office hours.
- Give each environment a budget (forecast and actual) and each service an anomaly monitor in the management account, routed to its team.

Next, [Part 5](/guides/finops-for-devops-engineers/05-cicd-integration) checks every plan of this module in CI before it merges.

## Keep Learning

- [Managing Your AWS Costs](/guides/introduction-to-aws/10-cost-management) in the Introduction to AWS guide
- [Cloud Cost Allocation Tags Checklist](/checklists/cloud-cost-allocation-tags)
- [Cloud Cost Allocation Tags Flashcards](/flashcards/cloud-cost-allocation-tags)
- [Interview questions: Enforcing Tagging Policies Across Clouds](/interview-questions/mid/enforcing-tagging-policies-multi-cloud)
- [Interview questions: Activating Tags in Billing Reports](/interview-questions/mid/activating-cost-allocation-tags)
