---
title: 'How to Set Up Cloud Cost Allocation Tags Across AWS, GCP, and Azure'
excerpt: 'A working playbook for tagging resources across AWS, GCP, and Azure so finance can finally answer which team spent what, and engineers can prove their workload is not the expensive one.'
category:
  name: 'FinOps'
  slug: 'finops'
date: '2026-04-20'
publishedAt: '2026-04-20T09:00:00Z'
updatedAt: '2026-04-20T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - finops
  - cloud-costs
  - tagging
  - multi-cloud
  - aws
  - gcp
  - azure
---

Last quarter, finance walked into the platform standup with a printed spreadsheet and one question: "Which team owns the $84,000 line item called `Untagged`?"

Nobody knew. The bill spanned AWS, GCP, and Azure. Each cloud had its own tag schema, half the resources were created before anyone cared about tags, and the cost reports grouped everything that did not match a known key into a single bucket. The CFO wanted chargeback by team starting next month. The platform team had two weeks.

If you have ever lived through this conversation, this guide is for you. We will set up consistent cost allocation tags across all three clouds, enforce them at provisioning time, and make sure the data actually shows up in your billing exports.

## TLDR

Pick a small set of mandatory tag keys (`team`, `environment`, `cost-center`, `service`), apply them the same way in every cloud, enforce them with Terraform `default_tags` plus a policy engine (AWS Tag Policies, Azure Policy, GCP Org Policy), and activate them in each provider's billing console. Untagged resources should fail at apply time, not show up in next month's invoice.

## Prerequisites

- Admin access to your AWS organization, GCP organization, and Azure tenant root
- Terraform 1.6+ for the enforcement examples
- Access to the billing console in each cloud (AWS Billing, GCP Cloud Billing, Azure Cost Management)
- A short list of cost dimensions your finance team actually wants to slice by

## Step 1: Agree on a tag schema before touching any cloud

The mistake almost everyone makes is starting in the AWS console. You end up with `Team`, `team`, `TeamName`, and `owner` all meaning the same thing, and Cost Explorer treats them as four different dimensions.

Pick the keys once. Write them down. Commit the document to a repo before anyone provisions another resource.

A schema that works in practice:

```text
team          required   lowercase, no spaces      payments, growth, platform
environment   required   one of: prod, staging, dev, sandbox
cost-center   required   finance code              cc-1042, cc-2008
service       required   logical app or service    checkout-api, ml-training
managed-by    optional   provisioning system       terraform, manual, helm
data-class    optional   one of: public, internal, confidential, restricted
```

Two rules that save pain later:

1. **All keys lowercase, hyphen separated.** GCP labels reject uppercase outright. Azure tags are case-insensitive on lookup but case-sensitive when displayed. AWS preserves whatever you give it. Pick lowercase and stop arguing.
2. **All values from a controlled vocabulary where possible.** "Payments" and "payments-team" and "Payments Team" will fragment your cost reports the same way uppercase keys do.

## Step 2: AWS - tag, then activate

AWS has a quirk that surprises new users: applying a tag to a resource does not automatically make it show up in cost reports. You have to **activate** it as a cost allocation tag in the billing console first, and only then will it appear in Cost Explorer and the Cost and Usage Report (CUR).

Set up Terraform with `default_tags` so every resource in a provider block inherits your schema:

```hcl
provider "aws" {
  region = "eu-west-1"

  default_tags {
    tags = {
      team         = var.team
      environment  = var.environment
      cost-center  = var.cost_center
      service      = var.service
      managed-by   = "terraform"
    }
  }
}

resource "aws_instance" "api" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.medium"
  # No tags block needed. Default tags are applied automatically.
}
```

Activate the tags so AWS bills against them:

```bash
aws ce update-cost-allocation-tags-status \
  --cost-allocation-tags-status \
    'TagKey=team,Status=Active' \
    'TagKey=environment,Status=Active' \
    'TagKey=cost-center,Status=Active' \
    'TagKey=service,Status=Active'
```

Expected output:

```text
{
    "Errors": []
}
```

Heads up: activated tags only apply to **new** usage. Costs from before activation stay untagged forever. Activate early.

To enforce that nothing untagged gets created, attach an AWS Organizations Tag Policy:

```json
{
  "tags": {
    "team": {
      "tag_key": { "@@assign": "team" },
      "tag_value": {
        "@@assign": ["payments", "growth", "platform", "data", "ml"]
      },
      "enforced_for": {
        "@@assign": ["ec2:instance", "ec2:volume", "rds:db", "s3:bucket"]
      }
    },
    "environment": {
      "tag_key": { "@@assign": "environment" },
      "tag_value": {
        "@@assign": ["prod", "staging", "dev", "sandbox"]
      },
      "enforced_for": {
        "@@assign": ["ec2:instance", "ec2:volume", "rds:db", "s3:bucket"]
      }
    }
  }
}
```

When someone tries to create an EC2 instance without those tags, you get a clear failure:

```text
An error occurred (TagPolicyViolation) when calling the RunInstances operation:
The request was rejected because tag policy compliance check failed.
Missing required tag keys: team, environment.
```

That is the error message you want. Loud, early, and specific.

## Step 3: GCP - labels, not tags

GCP confuses people because it has both **labels** (key-value pairs for billing and grouping) and **tags** (a separate IAM thing for conditional policies). For cost allocation you want labels.

Label keys must be lowercase, must start with a letter, and can contain letters, digits, hyphens, and underscores. No dots, no uppercase, no spaces. Pick `cost-center` not `CostCenter`.

Add labels via Terraform:

```hcl
resource "google_compute_instance" "api" {
  name         = "api-prod-eu-1"
  machine_type = "e2-standard-4"
  zone         = "europe-west1-b"

  labels = {
    team        = "payments"
    environment = "prod"
    cost-center = "cc-1042"
    service     = "checkout-api"
    managed-by  = "terraform"
  }

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
    }
  }

  network_interface {
    network = "default"
  }
}
```

Unlike AWS, GCP does not require activation. Labels show up automatically in the billing export once you turn it on. If you have not enabled the BigQuery billing export yet, do that now:

```bash
gcloud billing accounts list

gcloud beta billing accounts describe BILLING_ACCOUNT_ID
```

Then in the console: **Billing > Billing export > BigQuery export**, point it at a dataset, and within a few hours you can query labeled cost like this:

```sql
SELECT
  (SELECT value FROM UNNEST(labels) WHERE key = 'team')        AS team,
  (SELECT value FROM UNNEST(labels) WHERE key = 'environment') AS environment,
  service.description                                           AS service,
  SUM(cost)                                                     AS cost_usd
FROM `my-project.billing_export.gcp_billing_export_v1_*`
WHERE _PARTITIONDATE BETWEEN '2026-04-01' AND '2026-04-30'
GROUP BY team, environment, service
ORDER BY cost_usd DESC
LIMIT 50;
```

Sample output:

```text
team       environment  service                      cost_usd
payments   prod         Compute Engine               18420.55
growth     prod         BigQuery                     12005.10
ml         prod         Vertex AI                     9870.22
platform   prod         Cloud Logging                 4012.98
NULL       NULL         Compute Engine                3211.40   <-- still untagged
```

That last row is the one to chase. To prevent more of it, add an Organization Policy that requires labels on resource creation:

```bash
gcloud resource-manager org-policies set-policy required_labels.yaml \
  --organization=ORG_ID
```

Where `required_labels.yaml` contains:

```yaml
constraint: constraints/gcp.requireLabelsOnResourceCreation
listPolicy:
  allowedValues:
    - team
    - environment
    - cost-center
    - service
```

## Step 4: Azure - tags plus policies

Azure tags are key-value pairs you attach to resources, resource groups, or subscriptions. Two gotchas worth knowing:

- Tags on a resource group do **not** propagate to resources inside it by default. You either set tags directly on each resource or use Azure Policy with the `inherit-tag` effect.
- The portal may show tag keys with their original casing, but lookups are case-insensitive. Stick to lowercase to match AWS and GCP.

In Terraform:

```hcl
resource "azurerm_resource_group" "payments" {
  name     = "rg-payments-prod-weu"
  location = "westeurope"

  tags = {
    team        = "payments"
    environment = "prod"
    cost-center = "cc-1042"
    service     = "checkout-api"
    managed-by  = "terraform"
  }
}

resource "azurerm_linux_virtual_machine" "api" {
  name                = "vm-api-prod-01"
  resource_group_name = azurerm_resource_group.payments.name
  location            = azurerm_resource_group.payments.location
  size                = "Standard_D4s_v5"
  admin_username      = "azureuser"

  tags = azurerm_resource_group.payments.tags

  # ... network_interface_ids, os_disk, source_image_reference, etc.
}
```

For enforcement, assign a built-in Azure Policy that denies any resource missing required tags:

```bash
az policy assignment create \
  --name 'require-team-tag' \
  --scope "/subscriptions/$SUBSCRIPTION_ID" \
  --policy '871b6d14-10aa-478d-b590-94f262ecfa99' \
  --params '{"tagName": {"value": "team"}}'
```

Policy ID `871b6d14-10aa-478d-b590-94f262ecfa99` is the built-in "Require a tag on resources" policy. Assign it once per required key (`team`, `environment`, `cost-center`, `service`).

Now a missing tag fails at deployment:

```text
{
  "error": {
    "code": "RequestDisallowedByPolicy",
    "message": "Resource 'vm-api-prod-01' was disallowed by policy.
                Reasons: 'The given resource does not have the required tag 'team''."
  }
}
```

To see costs broken down by tag, open **Cost Management + Billing > Cost analysis**, group by tag, and pick `team`. Or query via CLI:

```bash
az consumption usage list \
  --start-date 2026-04-01 --end-date 2026-04-30 \
  --query "[?tags.team=='payments'].{resource:instanceName, cost:pretaxCost}" \
  --output table
```

## Step 5: Backfill the legacy stuff

Enforcement only fixes new resources. The pile of untagged stuff from before still shows up in your reports. Tag it in bulk.

For AWS, use the Resource Groups Tagging API:

```bash
aws resourcegroupstaggingapi tag-resources \
  --resource-arn-list \
    "arn:aws:ec2:eu-west-1:123456789012:instance/i-0abc123" \
    "arn:aws:ec2:eu-west-1:123456789012:instance/i-0def456" \
  --tags team=platform,environment=prod,cost-center=cc-9001,service=legacy-jobs
```

For GCP, label updates can be batched with `gcloud`:

```bash
for instance in $(gcloud compute instances list --format="value(name,zone)" | grep legacy); do
  name=$(echo $instance | awk '{print $1}')
  zone=$(echo $instance | awk '{print $2}')
  gcloud compute instances update "$name" --zone "$zone" \
    --update-labels=team=platform,environment=prod,cost-center=cc-9001
done
```

For Azure, the same pattern with `az tag update`:

```bash
az resource list --query "[?tags.team==null].id" -o tsv | while read id; do
  az tag update --resource-id "$id" --operation merge \
    --tags team=platform environment=prod cost-center=cc-9001
done
```

Run a dry-run first by listing what would be touched, especially in production.

## Common pitfalls that bite

- **AWS tag activation is retroactive only for new usage.** If you activate `team` today, last month's costs stay grouped as `(not activated)`. There is no fix. Activate early in the lifecycle.
- **GCP labels reject uppercase, dots, and starting with a digit.** A schema that works in AWS may fail at apply time in GCP with `Invalid value for field 'resource.labels'`. Validate keys against the strictest cloud first.
- **Azure resource group tags do not propagate.** A resource group tagged `team=payments` does not pass that to the VM inside it. Use the `inherit-tag` Azure Policy effect or set tags directly on resources.
- **Some AWS services do not support tags on every sub-resource.** CloudFront, Route 53 hosted zones, and a handful of others have spotty support. Check the docs before you assume coverage.
- **Tag keys count toward limits.** AWS allows 50 tags per resource. Azure allows 50. GCP allows 64 labels. Sounds like a lot until your platform team adds 30 of their own.

## Next steps

You now have a tag schema, enforcement at apply time, and visibility in each cloud's billing tooling. Pick one of these as the next move:

1. **Wire the cost data into one place.** Pull AWS CUR, GCP BigQuery export, and Azure exports into a single warehouse (BigQuery, Snowflake, or even Postgres if your bill is small). Build one chargeback report instead of three.
2. **Add a CI check that fails PRs missing tags.** Run `terraform plan` and pipe through `conftest` or `checkov` to reject any resource block without the required keys. Catch it before it hits the cloud at all.
3. **Set up an "untagged resources" alert.** A weekly job that counts resources without `team` and posts to Slack. The number should trend toward zero. If it does not, your enforcement has a hole.
4. **Run a tagging coverage report monthly.** AWS calls this the "Cost Allocation Tag" coverage view. GCP and Azure require a quick SQL query or KQL query against the billing export. Track it like an SLO.

The day finance asks "who spent the $84,000?" again, you want the answer to be a single SQL query, not a two-week archaeology project.
