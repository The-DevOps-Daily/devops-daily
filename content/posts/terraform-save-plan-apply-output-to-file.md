---
title: 'How to Save Terraform Plan and Apply Output to a File'
excerpt: "Learn how to save Terraform plan output for review, share readable apply logs, and use the -out flag for safe two-step deployments."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-03-12'
publishedAt: '2025-03-12T11:30:00Z'
updatedAt: '2025-03-12T11:30:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - CICD
  - Best Practices
  - DevOps
---

When working with Terraform, you often need to save the output from `terraform plan` or `terraform apply` for review, documentation, or CI/CD pipelines. Terraform provides several ways to capture this output depending on your use case - whether you need a human-readable log, a binary plan file for safe execution, or formatted output for automated processing.

Understanding these different output formats and when to use each one helps you build better workflows around infrastructure changes.

**TLDR:** Use `terraform plan -out=planfile` to save a binary plan that can be applied later with `terraform apply planfile`. For human-readable output, redirect to a file with `terraform plan > plan.txt` or `terraform plan | tee plan.txt` (to see and save output). For JSON output suitable for automation, use `terraform show -json planfile > plan.json`. The binary plan file ensures the exact changes you reviewed are applied without re-evaluating configuration.

## Saving Plan Output for Review

The simplest way to save plan output is redirecting it to a text file:

```bash
# Save plan output to a file
terraform plan > plan-output.txt
```

This captures the human-readable plan output that shows what resources will be created, modified, or destroyed. You can then review the file or share it with team members:

```bash
# Review the saved plan
less plan-output.txt

# Search for specific changes
grep "will be created" plan-output.txt
```

The downside is that this only saves the text output - it doesn't create an executable plan file.

## Using tee to See and Save Output

If you want to see the output on screen while also saving it to a file, use `tee`:

```bash
# Display output and save to file simultaneously
terraform plan | tee plan-output.txt
```

This shows the plan in your terminal and writes it to `plan-output.txt` at the same time. It's useful for interactive workflows where you want to review changes immediately but also keep a record.

For color output in the terminal with plain text in the file:

```bash
# Preserve colors in terminal
terraform plan -no-color | tee plan-output.txt
```

Actually, that removes colors from both. To keep colors in the terminal:

```bash
# Keep colors in terminal, plain text in file
terraform plan 2>&1 | tee plan-output.txt
```

The `2>&1` redirects stderr to stdout so all output is captured.

## Creating a Binary Plan File

For production workflows, you should use the `-out` flag to create a binary plan file:

```bash
# Create a binary plan file
terraform plan -out=tfplan
```

This creates a file called `tfplan` that contains:
- The exact state of your configuration at plan time
- The specific changes that will be made
- The current Terraform state snapshot

You can then apply this exact plan later:

```bash
# Apply the saved plan
terraform apply tfplan
```

When you apply a saved plan file, Terraform doesn't re-evaluate your configuration or check for drift. It executes exactly what was in the plan, which prevents race conditions and ensures you're applying what you reviewed.

```
Without -out flag:                With -out flag:
  terraform plan                    terraform plan -out=tfplan
        ↓                                 ↓
  [Review output]                   [Review output]
        ↓                                 ↓
  terraform apply                   terraform apply tfplan
        ↓                                 ↓
  Re-evaluates config!              Executes saved plan exactly
  (might differ from plan)          (matches what was reviewed)
```

This is especially important in CI/CD pipelines where time passes between plan and apply.

## Saving Both Binary Plan and Readable Output

For the best of both worlds, create a binary plan and save readable output:

```bash
# Create binary plan and save readable output
terraform plan -out=tfplan | tee plan.txt

# Later, apply the binary plan
terraform apply tfplan
```

Or save them in separate commands:

```bash
# Create the binary plan
terraform plan -out=tfplan

# Convert the binary plan to readable text
terraform show tfplan > plan.txt
```

The `terraform show` command reads the binary plan file and outputs it in human-readable format.

## Saving Apply Output

To save the output from `terraform apply`:

```bash
# Save apply output
terraform apply -auto-approve | tee apply-output.txt
```

The `-auto-approve` flag skips the confirmation prompt, making this suitable for automated pipelines. For interactive use without auto-approve:

```bash
# Apply with confirmation, save output
terraform apply | tee apply-output.txt
```

You can also apply a saved plan file and capture the output:

```bash
# Apply saved plan and save output
terraform apply tfplan | tee apply-output.txt
```

## JSON Output for Automation

For scripts and automation that need to parse Terraform output, use JSON format:

```bash
# Create a plan file
terraform plan -out=tfplan

# Convert to JSON
terraform show -json tfplan > plan.json
```

The JSON output includes detailed information about resources, changes, and configuration:

```json
{
  "format_version": "1.2",
  "terraform_version": "1.6.0",
  "planned_values": {
    "root_module": {
      "resources": [
        {
          "address": "aws_instance.web",
          "mode": "managed",
          "type": "aws_instance",
          "name": "web",
          "values": {
            "ami": "ami-12345678",
            "instance_type": "t3.medium"
          }
        }
      ]
    }
  },
  "resource_changes": [
    {
      "address": "aws_instance.web",
      "change": {
        "actions": ["create"],
        "before": null,
        "after": {
          "ami": "ami-12345678",
          "instance_type": "t3.medium"
        }
      }
    }
  ]
}
```

You can parse this with `jq` for automated checks:

```bash
# Check if any resources will be destroyed
terraform show -json tfplan | jq '.resource_changes[] | select(.change.actions[] == "delete")'

# Count how many resources will be created
terraform show -json tfplan | jq '[.resource_changes[] | select(.change.actions[] == "create")] | length'

# List all resources being modified
terraform show -json tfplan | jq -r '.resource_changes[] | select(.change.actions[] == "update") | .address'
```

## CI/CD Pipeline Pattern

Here's a typical CI/CD workflow using saved plans:

```bash
#!/bin/bash
# ci-terraform-plan.sh

set -e

# Initialize Terraform
terraform init

# Create plan with machine-readable name
PLAN_FILE="tfplan-$(date +%Y%m%d-%H%M%S)"
terraform plan -out="${PLAN_FILE}" | tee plan-output.txt

# Save JSON version for analysis
terraform show -json "${PLAN_FILE}" > plan.json

# Upload artifacts for later use
aws s3 cp "${PLAN_FILE}" "s3://my-bucket/terraform-plans/${PLAN_FILE}"
aws s3 cp plan-output.txt "s3://my-bucket/terraform-plans/${PLAN_FILE}.txt"
aws s3 cp plan.json "s3://my-bucket/terraform-plans/${PLAN_FILE}.json"

echo "Plan saved: ${PLAN_FILE}"
```

Then the apply stage:

```bash
#!/bin/bash
# ci-terraform-apply.sh

set -e

PLAN_FILE=$1

if [ -z "${PLAN_FILE}" ]; then
  echo "Usage: $0 <plan-file>"
  exit 1
fi

# Download the saved plan
aws s3 cp "s3://my-bucket/terraform-plans/${PLAN_FILE}" ./

# Apply the exact plan that was reviewed
terraform apply "${PLAN_FILE}" | tee apply-output.txt

# Save the apply output
aws s3 cp apply-output.txt "s3://my-bucket/terraform-plans/${PLAN_FILE}-apply.txt"
```

## Removing Sensitive Information

Plan files can contain sensitive data like passwords and secrets. Use the `-compact-warnings` flag to reduce noise, but be aware that sensitive values may still appear:

```bash
# Plan with less verbose warnings
terraform plan -compact-warnings -out=tfplan
```

For truly sensitive information, Terraform marks outputs and attributes as sensitive:

```hcl
output "database_password" {
  value     = random_password.db.result
  sensitive = true
}
```

Sensitive values appear as `(sensitive value)` in plan output, but they're still stored in the binary plan file. Make sure to:
- Store plan files securely
- Set appropriate file permissions: `chmod 600 tfplan`
- Delete plan files after applying
- Don't commit plan files to Git (add `*.tfplan` to `.gitignore`)

## Comparing Plans Over Time

Save plans with timestamps to track changes:

```bash
# Create timestamped plan
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
terraform plan -out="plans/tfplan-${TIMESTAMP}" | tee "plans/plan-${TIMESTAMP}.txt"
```

This lets you compare how your infrastructure changes over time:

```bash
# Compare two plan outputs
diff plans/plan-20250301-120000.txt plans/plan-20250315-120000.txt
```

## Filtering Plan Output

Use grep to focus on specific parts of the plan:

```bash
# Show only resources that will be created
terraform plan | grep "will be created"

# Show only resources that will be destroyed
terraform plan | grep "will be destroyed"

# Show only resources that will be modified
terraform plan | grep "will be updated"

# Count changes by type
terraform plan | grep -c "will be created"
```

For more sophisticated filtering, use the JSON output:

```bash
# Create plan and convert to JSON
terraform plan -out=tfplan
terraform show -json tfplan > plan.json

# Extract specific resource types being created
jq -r '.resource_changes[] | select(.change.actions[] == "create") | select(.type == "aws_instance") | .address' plan.json

# Show all attributes being changed
jq -r '.resource_changes[] | select(.change.actions[] == "update") | {address: .address, changes: .change.after_unknown}' plan.json
```

## Plan File Security Best Practices

Plan files contain your infrastructure state and configuration. Protect them:

```bash
# Set restrictive permissions
terraform plan -out=tfplan
chmod 600 tfplan

# Encrypt when storing remotely
terraform plan -out=tfplan
gpg --encrypt --recipient devops@company.com tfplan
aws s3 cp tfplan.gpg s3://secure-bucket/plans/

# Always clean up after apply
terraform apply tfplan
rm tfplan
```

In CI/CD, use your platform's secret management:

```yaml
# GitHub Actions example
- name: Terraform Plan
  run: terraform plan -out=tfplan

- name: Upload Plan
  uses: actions/upload-artifact@v3
  with:
    name: tfplan
    path: tfplan
    retention-days: 5  # Auto-delete after 5 days
```

## Debugging Failed Plans

When a plan fails, you might not get output saved. Use command substitution to capture output even on failure:

```bash
# Capture output regardless of exit status
terraform plan -out=tfplan 2>&1 | tee plan-output.txt
EXIT_CODE=${PIPESTATUS[0]}

if [ ${EXIT_CODE} -ne 0 ]; then
  echo "Plan failed with exit code ${EXIT_CODE}"
  echo "Output saved to plan-output.txt"
  exit ${EXIT_CODE}
fi
```

The `${PIPESTATUS[0]}` captures the exit code from `terraform plan` before it goes through `tee`.

## Using Plan Files in Approval Workflows

Plan files enable human approval workflows:

```bash
# Developer runs plan
terraform plan -out=tfplan
terraform show tfplan > plan.txt

# Share plan.txt with team for review

# After approval, developer applies
terraform apply tfplan
```

For formal approval processes, integrate with your ticketing system:

```bash
#!/bin/bash
# create-approval-request.sh

PLAN_FILE="tfplan-$(date +%Y%m%d-%H%M%S)"

terraform plan -out="${PLAN_FILE}"
terraform show "${PLAN_FILE}" > plan.txt

# Create ticket with plan attached
create-jira-ticket \
  --project INFRA \
  --summary "Terraform Apply Request" \
  --description "$(cat plan.txt)" \
  --attachment "${PLAN_FILE}"

echo "Approval request created with plan: ${PLAN_FILE}"
```

Saving Terraform plan output serves different purposes depending on your workflow. Use binary plan files with `-out` for safe, consistent deployments, redirect to text files for documentation and review, and convert to JSON for automated analysis. Always handle plan files securely since they contain state information and potentially sensitive data.
