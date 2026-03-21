---
title: 'How to Fix "Error acquiring the state lock: ConditionalCheckFailedException"'
excerpt: 'Learn how to diagnose and fix Terraform state lock errors that prevent your infrastructure deployments from running.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-01-13'
publishedAt: '2025-01-13T12:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - State Management
  - DynamoDB
  - Troubleshooting
  - Infrastructure as Code
featured: true
---

Nothing stops a deployment faster than seeing this error message when you run `terraform plan` or `terraform apply`:

```
Error: Error acquiring the state lock

Error message: ConditionalCheckFailedException: The conditional request failed
Lock Info:
  ID:        a1b2c3d4-5678-90ab-cdef-123456789012
  Path:      terraform-state-bucket/production/terraform.tfstate
  Operation: OperationTypePlan
  Who:       user@company.com
  Version:   1.5.0
  Created:   2025-05-23 10:30:15.123456789 +0000 UTC
  Info:

Terraform acquires a state lock to protect the state from being written
by multiple users at the same time. Please resolve the issue above and try
again. For most commands, you can disable locking with the "-lock=false"
flag, but this is not recommended.
```

This error occurs when Terraform can't acquire a lock on your state file, typically because another process is already holding it or a previous operation didn't clean up properly. While the error message suggests using `-lock=false`, that's rarely the right solution.

Let's explore how to diagnose and fix this issue safely without risking your infrastructure state.

## Prerequisites

Before troubleshooting, you should have:

- Access to your Terraform state backend (S3 bucket and DynamoDB table)
- AWS CLI configured with appropriate permissions
- Basic understanding of Terraform state management
- Knowledge of your team's deployment processes

## Understanding the State Lock Mechanism

Terraform uses state locking to prevent multiple processes from modifying infrastructure simultaneously. When using an S3 backend with DynamoDB for locking, here's what happens:

```terraform
terraform {
  backend "s3" {
    bucket         = "your-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "terraform-state-locks"
    encrypt        = true
  }
}
```

When you run `terraform plan` or `terraform apply`:

1. Terraform attempts to create a lock record in DynamoDB
2. If successful, it proceeds with the operation
3. When finished, it removes the lock record
4. If another process tries to acquire the lock, it gets the `ConditionalCheckFailedException`

## Diagnosing the Lock Issue

### Step 1: Check Who Has the Lock

The error message provides crucial information:

```
Lock Info:
  ID:        a1b2c3d4-5678-90ab-cdef-123456789012
  Path:      terraform-state-bucket/production/terraform.tfstate
  Operation: OperationTypePlan
  Who:       user@company.com
  Version:   1.5.0
  Created:   2025-05-23 10:30:15.123456789 +0000 UTC
```

This tells you:

- **Who**: Which user or system has the lock
- **When**: When the lock was created
- **Operation**: What Terraform operation is holding the lock
- **Path**: Which state file is locked

### Step 2: Verify the Lock in DynamoDB

Check if the lock actually exists in your DynamoDB table:

```bash
aws dynamodb get-item \
  --table-name terraform-state-locks \
  --key '{"LockID":{"S":"terraform-state-bucket/production/terraform.tfstate-md5"}}' \
  --region us-west-2
```

If the lock exists, you'll see output like:

```json
{
  "Item": {
    "LockID": {
      "S": "terraform-state-bucket/production/terraform.tfstate-md5"
    },
    "Info": {
      "S": "{\"ID\":\"a1b2c3d4-5678-90ab-cdef-123456789012\",\"Operation\":\"OperationTypePlan\",\"Info\":\"\",\"Who\":\"user@company.com\",\"Version\":\"1.5.0\",\"Created\":\"2025-05-23T10:30:15.123456789Z\",\"Path\":\"terraform-state-bucket/production/terraform.tfstate\"}"
    }
  }
}
```

### Step 3: Check for Running Processes

Before taking any action, verify whether a legitimate Terraform process is actually running:

1. **Check with your team**: Ask if anyone is currently running Terraform
2. **Check CI/CD systems**: Look for running pipelines or scheduled jobs
3. **Check process lists**: On systems where Terraform might be running:

```bash
# Check for running terraform processes
ps aux | grep terraform

# Check for terraform lock files
find /tmp -name ".terraform.lock.*" 2>/dev/null
```

## Safe Resolution Methods

### Method 1: Wait for the Lock to Expire (Safest)

If you've confirmed no legitimate process is running, the safest approach is to wait. Most locks are released automatically when:

- The process completes normally
- The process crashes (though this might leave a stale lock)
- Network connectivity is restored

### Method 2: Use Terraform's Force Unlock

If you're certain no other Terraform process is running, use Terraform's built-in force unlock:

```bash
terraform force-unlock a1b2c3d4-5678-90ab-cdef-123456789012
```

Use the Lock ID from the error message. Terraform will prompt for confirmation:

```
Do you really want to force-unlock?
  Terraform will remove the lock on the remote state.
  This will allow local Terraform commands to modify this state, even though it
  may be still be in use. Only 'yes' will be accepted to confirm.

  Enter a value: yes
```

This method is safer than manual deletion because Terraform validates the lock before removing it.

### Method 3: Manual DynamoDB Lock Removal

If `terraform force-unlock` doesn't work, you can manually delete the lock record:

```bash
aws dynamodb delete-item \
  --table-name terraform-state-locks \
  --key '{"LockID":{"S":"terraform-state-bucket/production/terraform.tfstate-md5"}}' \
  --region us-west-2
```

**Warning**: Only do this if you're absolutely certain no Terraform process is running, as it could lead to state corruption.

## Common Causes and Solutions

### Cause 1: Crashed or Interrupted Terraform Process

**Scenario**: A team member's laptop crashed while running `terraform apply`, leaving a stale lock.

**Solution**:

1. Confirm the process is no longer running
2. Use `terraform force-unlock` with the Lock ID

### Cause 2: CI/CD Pipeline Issues

**Scenario**: A CI/CD pipeline was cancelled or failed unexpectedly, leaving the lock in place.

**Solution**:

```bash
# Check if the CI/CD job is still running
# If not, force unlock
terraform force-unlock <lock-id>

# Consider adding cleanup steps to your CI/CD pipeline
```

**Prevention**: Add lock cleanup to your CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Cleanup on failure
  if: failure()
  run: |
    # Only run if we know our job held the lock
    if [ -f .terraform.lock.info ]; then
      terraform force-unlock $(cat .terraform.lock.info) || true
    fi
```

### Cause 3: Network Connectivity Issues

**Scenario**: Network issues prevented the lock from being released properly.

**Solution**:

1. Verify connectivity to your AWS region
2. Check if the process that held the lock completed
3. Use force-unlock if the process is confirmed finished

### Cause 4: DynamoDB Table Configuration Issues

**Scenario**: Your DynamoDB table doesn't have the correct configuration for locking.

**Verification**:

```bash
aws dynamodb describe-table \
  --table-name terraform-state-locks \
  --region us-west-2
```

**Required configuration**:

- **Partition Key**: `LockID` (String)
- **No Sort Key**
- **Billing Mode**: Pay-per-request or Provisioned (with adequate capacity)

**Solution**: Recreate the table with correct configuration:

```terraform
resource "aws_dynamodb_table" "terraform_locks" {
  name           = "terraform-state-locks"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name = "Terraform State Locks"
  }
}
```

## Advanced Troubleshooting

### Debugging Lock Information

Extract detailed lock information from DynamoDB:

```bash
# Get the lock info and format it nicely
aws dynamodb get-item \
  --table-name terraform-state-locks \
  --key '{"LockID":{"S":"terraform-state-bucket/production/terraform.tfstate-md5"}}' \
  --query 'Item.Info.S' \
  --output text | jq '.'
```

This shows you the complete lock details in JSON format:

```json
{
  "ID": "a1b2c3d4-5678-90ab-cdef-123456789012",
  "Operation": "OperationTypePlan",
  "Info": "",
  "Who": "user@company.com",
  "Version": "1.5.0",
  "Created": "2025-05-23T10:30:15.123456789Z",
  "Path": "terraform-state-bucket/production/terraform.tfstate"
}
```

### Monitoring Lock Duration

Create a script to monitor how long locks have been held:

```bash
#!/bin/bash
# check-lock-age.sh

LOCK_ID="terraform-state-bucket/production/terraform.tfstate-md5"
TABLE_NAME="terraform-state-locks"

LOCK_INFO=$(aws dynamodb get-item \
  --table-name "$TABLE_NAME" \
  --key "{\"LockID\":{\"S\":\"$LOCK_ID\"}}" \
  --query 'Item.Info.S' \
  --output text 2>/dev/null)

if [ "$LOCK_INFO" != "None" ] && [ "$LOCK_INFO" != "" ]; then
  CREATED=$(echo "$LOCK_INFO" | jq -r '.Created')
  WHO=$(echo "$LOCK_INFO" | jq -r '.Who')
  OPERATION=$(echo "$LOCK_INFO" | jq -r '.Operation')

  CREATED_TIMESTAMP=$(date -d "$CREATED" +%s)
  CURRENT_TIMESTAMP=$(date +%s)
  AGE_SECONDS=$((CURRENT_TIMESTAMP - CREATED_TIMESTAMP))
  AGE_MINUTES=$((AGE_SECONDS / 60))

  echo "Lock held by: $WHO"
  echo "Operation: $OPERATION"
  echo "Age: $AGE_MINUTES minutes"

  if [ $AGE_MINUTES -gt 30 ]; then
    echo "WARNING: Lock is older than 30 minutes"
  fi
else
  echo "No lock found"
fi
```

## Prevention Strategies

### 1. Use Consistent Terraform Versions

Version mismatches can sometimes cause locking issues:

```bash
# Pin Terraform version in your CI/CD
terraform version
# Terraform v1.5.0

# Use .terraform-version file
echo "1.5.0" > .terraform-version
```

### 2. Implement Proper CI/CD Cleanup

Add cleanup steps to your pipelines:

```yaml
# .github/workflows/terraform.yml
- name: Terraform Apply
  id: apply
  run: terraform apply -auto-approve
  continue-on-error: true

- name: Cleanup on Failure
  if: steps.apply.outcome == 'failure'
  run: |
    # Force unlock if our job failed
    terraform force-unlock $(terraform show -json | jq -r '.lock_id // empty') || true
```

### 3. Use Workspace-Specific State Files

Separate state files reduce lock contention:

```terraform
# Different state files for different environments
terraform {
  backend "s3" {
    bucket = "terraform-state-bucket"
    key    = "${terraform.workspace}/terraform.tfstate"
    region = "us-west-2"
    dynamodb_table = "terraform-state-locks"
  }
}
```

### 4. Implement Team Communication

- **Slack/Teams notifications**: Alert when long-running operations start
- **Shared calendar**: Block time for major infrastructure changes
- **Documentation**: Keep a log of who's working on what

### 5. Set Up Monitoring

Monitor your DynamoDB table for stuck locks:

```python
import boto3
import json
from datetime import datetime, timezone

def check_stale_locks():
    dynamodb = boto3.client('dynamodb')
    table_name = 'terraform-state-locks'

    try:
        response = dynamodb.scan(TableName=table_name)

        for item in response.get('Items', []):
            lock_info = json.loads(item['Info']['S'])
            created = datetime.fromisoformat(lock_info['Created'].replace('Z', '+00:00'))
            age = datetime.now(timezone.utc) - created

            if age.total_seconds() > 1800:  # 30 minutes
                print(f"Stale lock detected:")
                print(f"  Path: {lock_info['Path']}")
                print(f"  Who: {lock_info['Who']}")
                print(f"  Age: {age}")
                print(f"  ID: {lock_info['ID']}")

    except Exception as e:
        print(f"Error checking locks: {e}")

if __name__ == "__main__":
    check_stale_locks()
```

## When to Use -lock=false (Rarely)

The `-lock=false` flag should only be used in very specific scenarios:

### Read-only Operations

```bash
# Safe for read-only operations when you're certain no changes will be made
terraform plan -lock=false
terraform show -lock=false
terraform output -lock=false
```

### Emergency Situations

```bash
# Only in genuine emergencies where you need to bypass locking
terraform apply -lock=false -auto-approve
```

**Never use `-lock=false` for**:

- Regular deployments
- Collaborative environments
- Production infrastructure
- Any operation that modifies state

## Real-World Example: Resolving a Team Lock Conflict

Here's how we helped a development team resolve a persistent locking issue:

**The Problem**: A team was getting `ConditionalCheckFailedException` errors every time they tried to deploy, even though no one was running Terraform.

**Investigation**:

1. Checked DynamoDB and found a lock from a CI/CD job
2. The CI/CD job had been cancelled 2 hours earlier
3. The job's cleanup step failed to run

**Resolution**:

```bash
# 1. Confirmed no active Terraform processes
ps aux | grep terraform

# 2. Checked the lock age
aws dynamodb get-item \
  --table-name terraform-state-locks \
  --key '{"LockID":{"S":"company-terraform-state/production/terraform.tfstate-md5"}}' \
  --query 'Item.Info.S' --output text | jq '.Created'

# 3. Used force-unlock with the ID from the error
terraform force-unlock f47ac10b-58cc-4372-a567-0e02b2c3d479

# 4. Successfully ran the deployment
terraform apply
```

**Prevention**: Added better cleanup to their CI/CD pipeline and implemented lock monitoring.

State lock errors are frustrating but usually straightforward to resolve once you understand the underlying cause. The key is to diagnose the situation properly before taking action – never blindly force-unlock or disable locking without understanding why the lock exists.

Remember these principles:

1. **Always check if a legitimate process is running** before removing locks
2. **Use `terraform force-unlock` instead of manual DynamoDB deletion** when possible
3. **Implement proper CI/CD cleanup** to prevent stale locks
4. **Monitor your locks** to catch issues early
5. **Never use `-lock=false` in production** except in genuine emergencies

With proper understanding and the right tools, state lock errors become a minor inconvenience rather than a deployment blocker.
