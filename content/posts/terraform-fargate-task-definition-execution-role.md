---
title: 'How to Set Up Fargate Execution Roles and IAM Policies in Terraform'
excerpt: 'Create the ECS Fargate task execution role and task role with Terraform, attach several IAM policies to one role, fix "MalformedPolicyDocument: Has prohibited field Resource", and find the minimum AWS permissions that Terraform itself needs.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-01-28'
publishedAt: '2025-01-28T09:30:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - AWS
  - ECS
  - Fargate
  - IAM
  - Security
---

Terraform needs AWS permissions to run, and many services that Terraform creates, such as ECS, Lambda and EC2, need IAM roles of their own. Most IAM errors come from the same few mistakes: the wrong role for the job, a permissions policy pasted where a trust policy belongs, or a policy that is much wider than it needs to be. ECS on Fargate is a good example, because a task uses two roles that look alike and do different things.

This post starts with the Fargate execution role and task role, then answers the general IAM questions that come with them: how to attach several policies to one role, how to fix `MalformedPolicyDocument: Has prohibited field Resource`, and how to find the minimum permissions for the role that runs Terraform.

## TLDR

| Question                                      | Short answer                                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| What is the execution role for?               | ECS uses it to start the task: pull the image, write logs, read secrets for the container                       |
| What is the task role for?                    | Your application code uses it to call AWS APIs                                                                  |
| How do I attach several policies to one role? | One `aws_iam_role_policy_attachment` per policy, usually with `for_each`                                        |
| "Has prohibited field Resource"?              | A trust policy (`assume_role_policy`) must not contain `Resource`. Move the permissions to a separate policy    |
| Minimum permissions for Terraform?            | Start in a sandbox, generate a policy from CloudTrail with IAM Access Analyzer, and give plans a read-only role |

## Prerequisites

- Terraform 1.5 or later and the AWS provider 6.x.
- An AWS account where you can create IAM roles. Test IAM changes in a sandbox account first.

## How Do I Configure an ECS Fargate Task Execution Role With Terraform?

Create a role that `ecs-tasks.amazonaws.com` can assume, attach the AWS managed policy `AmazonECSTaskExecutionRolePolicy`, and set the role's ARN as `execution_role_arn` in the task definition. Create a second role for your application and set it as `task_role_arn`.

```text
Task start (ECS agent, execution role)     Task running (your code, task role)
  pull the image from ECR                    read and write S3 objects
  create log streams, send logs              query DynamoDB
  read secrets for the container's env       call any other AWS API
```

### The Execution Role

```hcl
data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "app-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
```

`AmazonECSTaskExecutionRolePolicy` allows four ECR actions (`GetAuthorizationToken`, `BatchCheckLayerAvailability`, `GetDownloadUrlForLayer`, `BatchGetImage`) and two CloudWatch Logs actions (`CreateLogStream`, `PutLogEvents`). It does not allow reading secrets, and it does not allow `logs:CreateLogGroup`, so create the log group with Terraform. For the task role, the ECS documentation also shows `aws:SourceAccount` and `aws:SourceArn` conditions in the trust policy, which stop other accounts' tasks from using the role.

### The Task Role and the Task Definition

```hcl
resource "aws_iam_role" "ecs_task" {
  name               = "app-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "app" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.app_data.arn}/*"]
  }
}

resource "aws_iam_role_policy" "app" {
  name   = "app-s3"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.app.json
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/app"
  retention_in_days = 30
}

resource "aws_ecs_task_definition" "app" {
  family                   = "app"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name         = "app"
    image        = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
    essential    = true
    portMappings = [{ containerPort = 8080, protocol = "tcp" }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.app.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "app"
      }
    }
  }])
}
```

The application never sees the execution role. If your code gets `AccessDenied` from S3, change the task role. If the task does not start, look at the execution role.

### Secrets From Secrets Manager or Parameter Store

The container definition's `secrets` list makes ECS read a value at task start and pass it as an environment variable. ECS reads it with the execution role, so that role needs access:

```hcl
data "aws_iam_policy_document" "execution_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.db.arn]
  }

  statement {
    actions   = ["ssm:GetParameters"]
    resources = ["arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/app/*"]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "read-app-secrets"
  role   = aws_iam_role.ecs_execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}
```

```hcl
# in the container definition
secrets = [
  { name = "DB_PASSWORD", valueFrom = "${aws_secretsmanager_secret.db.arn}:password::" },
  { name = "REDIS_URL", valueFrom = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/app/redis-url" },
]
```

The `:password::` suffix picks the `password` key from a JSON secret. Leave it out to pass the whole secret string. The execution role also needs `kms:Decrypt` on the key, but only when the secret or a `SecureString` parameter uses a customer managed KMS key. The default AWS managed keys need no extra statement.

### Images From ECR in Another Account

Two policies must agree. The repository policy in the account that owns the images allows your execution role:

```hcl
# in the account that owns the repository
data "aws_iam_policy_document" "cross_account_pull" {
  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.ecs_account_id}:role/app-ecs-execution"]
    }
  }
}

resource "aws_ecr_repository_policy" "cross_account_pull" {
  repository = aws_ecr_repository.app.name
  policy     = data.aws_iam_policy_document.cross_account_pull.json
}
```

In the ECS account, the managed policy already allows those actions on `*`, so the execution role needs nothing more. If the repository uses a customer managed KMS key, the key policy must also allow the role.

### Errors When a Task Does Not Start

The task's **Stopped reason** in the ECS console, or `aws ecs describe-tasks`, shows the error:

| Message starts with                                                    | Usual cause                                                                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ResourceInitializationError: unable to pull secrets or registry auth` | Execution role cannot read a secret or parameter, a KMS key denies it, or the task has no network path to the service (private subnet without NAT or VPC endpoints) |
| `CannotPullContainerError`                                             | Wrong image tag, missing ECR permissions, or no network path to ECR                                                                                                 |
| `ResourceInitializationError: failed to validate logger args`          | The log group does not exist, or the role cannot write to it                                                                                                        |

If you set `awslogs-create-group = "true"` in the log options instead of creating the group with Terraform, add `logs:CreateLogGroup` to the execution role.

## How Do I Attach Multiple IAM Policies to an IAM Role?

Use one `aws_iam_role_policy_attachment` per policy. With `for_each` over the policy ARNs, adding or removing a policy changes only that attachment:

```hcl
locals {
  ci_role_policies = {
    ecr_read = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
    ssm_read = "arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess"
    deploy   = aws_iam_policy.deploy.arn
  }
}

resource "aws_iam_role_policy_attachment" "ci" {
  for_each = local.ci_role_policies

  role       = aws_iam_role.ci.name
  policy_arn = each.value
}
```

Use static keys such as `ecr_read`, not the ARNs themselves. The ARN of a policy that Terraform creates in the same run is unknown at plan time, and `for_each` keys must be known.

Rules that prevent surprises:

- **Do not use `aws_iam_policy_attachment`** (without "role" in the name) for this. It manages every attachment of a policy exclusively and removes the policy from users, groups and roles that Terraform does not know about.
- **Do not combine the `managed_policy_arns` or `inline_policy` arguments of `aws_iam_role` with attachment resources.** Both arguments are deprecated, and the two ways fight each other on every apply.
- **Use `aws_iam_role_policy` for inline policies** that belong to one role only, such as the S3 policy above.
- **Use `aws_iam_role_policy_attachments_exclusive`** if Terraform should also remove policies that someone attached by hand.
- **A role can have 10 managed policies by default.** The quota can be raised to 20. If you need more, combine related statements into fewer customer managed policies.

## How Do I Fix "MalformedPolicyDocument: Has prohibited field Resource"?

The error comes from `CreateRole` or `UpdateAssumeRolePolicy` when the **trust policy** of a role has a `Resource` element. A trust policy (`assume_role_policy` in Terraform) says who may assume the role. It has a `Principal` and no `Resource`. The permissions that the role grants go in a separate policy.

This is the mistake, a permissions statement inside the trust policy:

```hcl
resource "aws_iam_role" "app" {
  name = "app"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = ["sts:AssumeRole", "s3:GetObject"]
      Principal = { Service = "ec2.amazonaws.com" }
      Resource  = "arn:aws:s3:::app-data/*" # not allowed in a trust policy
    }]
  })
}
```

Split it into a trust policy and a permissions policy:

```hcl
resource "aws_iam_role" "app" {
  name = "app"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "app_s3" {
  name = "read-app-data"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "s3:GetObject"
      Resource = "arn:aws:s3:::app-data/*"
    }]
  })
}
```

The opposite mistake, a `Principal` inside a permissions policy (`aws_iam_policy` or `aws_iam_role_policy`), fails with `MalformedPolicyDocument: Policy document should not specify a principal.` The rule for both: identity policies say what, trust and resource policies say who.

`terraform validate` cannot find these errors, because it checks HCL and does not call AWS. To check a policy before the apply, save the JSON to a file such as `trust.json` and run IAM Access Analyzer on it:

```bash
aws accessanalyzer validate-policy \
  --policy-type RESOURCE_POLICY \
  --validate-policy-resource-type AWS::IAM::AssumeRolePolicyDocument \
  --policy-document file://trust.json
```

The `aws_iam_policy_document` data source also helps: it has separate `principals` and `resources` blocks, so the structure is harder to get wrong than hand-written JSON.

## What Are the Minimum AWS Permissions for Terraform?

No command prints them, because they depend on what your configuration manages and on the provider version. A workable process:

1. **Run the configuration in a sandbox account with a broad role**, and let CloudTrail record the calls.
2. **Generate a policy from that activity** with IAM Access Analyzer's policy generation, which reads up to 90 days of CloudTrail events for a role and lists the actions it used.
3. **Replace the broad role with the generated policy**, narrow the resource ARNs, and run `plan`, `apply` and `destroy` again. Add what is still missing from the `AccessDenied` messages, which name the exact action.

Expect more actions than the resource names suggest. Terraform reads a resource back after it creates it, and at every plan. For one `aws_s3_bucket`, the AWS provider reads the bucket's ACL, CORS, website, versioning, logging, lifecycle, replication, encryption, object lock, tags and policy settings, so a policy with only `s3:CreateBucket` fails on the first refresh. The exact list changes between provider versions, which is one more reason to generate the policy from real activity and to test provider upgrades in the sandbox first.

Split the permissions by job:

- **A plan role** with read access only, plus read and lock access to the state. Pull request pipelines use this role, so code from a branch cannot change infrastructure.
- **An apply role** with write access to the services that this root folder manages, used only on the main branch after review.
- **State access** for both: `s3:GetObject` and `s3:PutObject` on the state key, `s3:GetObject`, `s3:PutObject` and `s3:DeleteObject` on the `.tflock` key next to it (with `use_lockfile`), and `s3:ListBucket` on the bucket.

A smaller blast radius helps more than a perfect policy: one role per environment and per root folder, so a mistake in `dev/app` cannot reach `prod/network`. [Write Narrow Policies, and Lint Them](/guides/security-principles/03-least-privilege#h3-write-narrow-policies-and-lint-them) in our Security Principles guide shows how to lint policies for actions that are wider than they need to be.

## Related Resources

- [IAM and security](/guides/introduction-to-aws/02-iam-security) in our AWS guide, including [how to find what is used](/guides/introduction-to-aws/02-iam-security#h2-find-out-what-is-used) and [how to debug Access Denied](/guides/introduction-to-aws/02-iam-security#h2-debug-access-denied).
- [AWS Security Checklist](/checklists/aws-security) to review an account.
- [How to Apply SQL Scripts to RDS With Terraform](/posts/terraform-apply-sql-scripts-rds) for secrets that a database needs.
- [Terraform Best Practices](/posts/terraform-best-practices) for separate plan and apply roles in CI.
