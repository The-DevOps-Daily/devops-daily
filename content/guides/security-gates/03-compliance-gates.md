---
title: 'Compliance Gates for Terraform: CIS, PCI DSS and SOC 2'
description: 'Check Terraform against CIS, PCI DSS and SOC 2 controls with Checkov in CI: map checks to controls, write custom checks, handle skips, keep evidence.'
order: 3
---

A **compliance gate** checks infrastructure code against the controls your organization has promised to keep, before `terraform apply` runs. "Databases are not reachable from the internet" and "data at rest is encrypted" are controls; Checkov rules such as `CKV_AWS_17` are the automated tests behind them. The gate blocks a change that breaks a control, and every run leaves evidence that an auditor can read.

No scanner makes you PCI DSS or SOC 2 compliant. Those frameworks cover people, processes and contracts as well as configuration. What a gate can do is prove, for every change, that the technical controls you can test in code still hold.

## Prerequisites

- The `orders-api` repository from the earlier parts, or any Terraform project.
- [Checkov](https://www.checkov.io/) 3.3 (`pip install checkov`) and [Conftest](https://www.conftest.dev/) 0.71.
- No AWS account: Checkov reads the Terraform files directly, without `terraform plan`.

## Frameworks and What You Can Test in Code

| Framework              | What it is                                                                                                                                                                                 | Examples you can check in infrastructure code                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CIS Benchmarks**     | Configuration baselines for clouds, operating systems, Kubernetes and Docker                                                                                                               | No public database endpoints, encrypted volumes, logging turned on                                                                                                   |
| **PCI DSS v4.0.1**     | Required for anyone who stores, processes or transmits card data. The only active version since the end of 2024; the requirements that were future-dated became mandatory on 31 March 2025 | Restrict inbound traffic to the cardholder data environment (1.3.1), least privilege (7.2.1), audit logs (10.2.1), install critical patches within one month (6.3.3) |
| **SOC 2**              | An audit report against the AICPA Trust Services Criteria. You define your own controls                                                                                                    | Logical access (CC6.1, CC6.3), boundary protection (CC6.6), monitoring (CC7.2), change management (CC8.1)                                                            |
| **ISO/IEC 27001:2022** | A certifiable management system with Annex A controls                                                                                                                                      | Configuration management (8.9), vulnerability management (8.8), change management (8.32)                                                                             |

Checkov's open source version has more than a thousand checks, but no built-in mapping to these frameworks; the severity and compliance metadata come from the Prisma Cloud platform and need an API key. You keep the mapping yourself, which is also what an auditor asks for: which control, which test, which evidence.

## Run Checkov on the Example Terraform

`orders-api` stores invoices in S3 and its data in RDS PostgreSQL. Here is the first version of its Terraform:

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.70"
    }
  }
}

variable "vpc_id" {
  type = string
}

resource "aws_s3_bucket" "invoices" {
  bucket = "orders-api-invoices"
}

resource "aws_security_group" "db" {
  name        = "orders-db"
  description = "PostgreSQL for orders-api"
  vpc_id      = var.vpc_id

  ingress {
    description = "PostgreSQL"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "orders" {
  identifier                  = "orders"
  engine                      = "postgres"
  engine_version              = "17"
  instance_class              = "db.t4g.medium"
  allocated_storage           = 50
  username                    = "orders"
  manage_master_user_password = true
  publicly_accessible         = true
  storage_encrypted           = false
  skip_final_snapshot         = true
  vpc_security_group_ids      = [aws_security_group.db.id]
}

resource "aws_iam_policy" "orders_api" {
  name = "orders-api"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "s3:*"
      Resource = "*"
    }]
  })
}
```

```terminal
{
  "title": "checkov",
  "prompt": "$",
  "steps": [
    {
      "cmd": "checkov --directory terraform --framework terraform --output json > checkov.json"
    },
    {
      "cmd": "jq '.summary' checkov.json",
      "output": "{\n  \"passed\": 21,\n  \"failed\": 22,\n  \"skipped\": 0,\n  \"parsing_errors\": 0,\n  \"resource_count\": 4,\n  \"checkov_version\": \"3.3.30\"\n}"
    },
    {
      "cmd": "jq -r '.results.failed_checks[] | [.check_id, .resource] | @tsv' checkov.json | sort",
      "output": "CKV2_AWS_30\taws_db_instance.orders\nCKV2_AWS_6\taws_s3_bucket.invoices\nCKV2_AWS_60\taws_db_instance.orders\nCKV2_AWS_61\taws_s3_bucket.invoices\nCKV2_AWS_62\taws_s3_bucket.invoices\nCKV_AWS_118\taws_db_instance.orders\nCKV_AWS_129\taws_db_instance.orders\nCKV_AWS_144\taws_s3_bucket.invoices\nCKV_AWS_145\taws_s3_bucket.invoices\nCKV_AWS_157\taws_db_instance.orders\nCKV_AWS_16\taws_db_instance.orders\nCKV_AWS_161\taws_db_instance.orders\nCKV_AWS_17\taws_db_instance.orders\nCKV_AWS_18\taws_s3_bucket.invoices\nCKV_AWS_21\taws_s3_bucket.invoices\nCKV_AWS_226\taws_db_instance.orders\nCKV_AWS_288\taws_iam_policy.orders_api\nCKV_AWS_289\taws_iam_policy.orders_api\nCKV_AWS_290\taws_iam_policy.orders_api\nCKV_AWS_293\taws_db_instance.orders\nCKV_AWS_353\taws_db_instance.orders\nCKV_AWS_355\taws_iam_policy.orders_api"
    }
  ]
}
```

22 failed checks on four resources. Some are serious: the database is publicly accessible and unencrypted, and the IAM policy allows every S3 action on every bucket. Others are good practice that may not apply to this service, such as cross-region replication, Multi-AZ or S3 event notifications. Failing the build on all 22 makes the gate noise.

There is also a gap. The security group allows PostgreSQL from `0.0.0.0/0`, and **none of the 22 checks says so**. Checkov's built-in security group checks cover ports 22, 3389 and 80 and rules that open every port, not database ports. A clean Checkov run does not mean "no open database".

## Write a Custom Check

Checkov reads custom checks written in YAML from a directory you pass with `--external-checks-dir`. This one fails any security group with an inline ingress rule from the whole internet, over IPv4 or IPv6:

```yaml
metadata:
  id: CKV2_ORD_1
  name: Security groups must not allow ingress from the internet
  category: NETWORKING
definition:
  and:
    - cond_type: attribute
      resource_types:
        - aws_security_group
      attribute: ingress.*.cidr_blocks
      operator: not_contains
      value: 0.0.0.0/0
    - cond_type: attribute
      resource_types:
        - aws_security_group
      attribute: ingress.*.ipv6_cidr_blocks
      operator: not_contains
      value: '::/0'
```

```terminal
{
  "title": "custom check",
  "prompt": "$",
  "steps": [
    {
      "cmd": "checkov --directory terraform --external-checks-dir checks --check CKV2_ORD_1 --compact --quiet",
      "output": "terraform scan results:\n\nPassed checks: 0, Failed checks: 1, Skipped checks: 0\n\nCheck: CKV2_ORD_1: \"Security groups must not allow ingress from the internet\"\n\tFAILED for resource: aws_security_group.db\n\tFile: /main.tf:18-30"
    }
  ]
}
```

Give custom checks an ID prefix that cannot clash with Checkov's own (here `ORD`), and add a test fixture for each one: a Terraform file that must fail and one that must pass. If you define rules with the newer `aws_vpc_security_group_ingress_rule` resource, add conditions on its `cidr_ipv4` and `cidr_ipv6` attributes. If your load balancers need public ingress on 443, scope the rule with another condition (for example on a tag that only the platform team's modules set) rather than skipping it: the gate below rejects inline skips of mapped checks.

## Map Checks to Controls

The control map is a short YAML file that says which checks implement which control, and where each control comes from. It is the single place where you decide what blocks:

```yaml
controls:
  - id: NET-01
    title: Data stores are not reachable from the internet
    checks: [CKV_AWS_17, CKV2_AWS_6, CKV2_ORD_1]
    frameworks: { 'PCI DSS': '1.3.1', 'SOC 2': CC6.6 }
  - id: ENC-01
    title: Data at rest is encrypted with KMS keys
    checks: [CKV_AWS_16, CKV_AWS_145]
    frameworks: { 'SOC 2': CC6.1 }
  - id: IAM-01
    title: IAM policies grant least privilege
    checks: [CKV_AWS_288, CKV_AWS_289, CKV_AWS_290, CKV_AWS_355]
    frameworks: { 'PCI DSS': '7.2.1', 'SOC 2': CC6.3 }
  - id: LOG-01
    title: Data store logs are collected
    checks: [CKV_AWS_18, CKV_AWS_129]
    frameworks: { 'PCI DSS': '10.2.1', 'SOC 2': CC7.2 }
```

The framework references are an example of how one team maps its controls. Agree on the mapping with your auditor; for instance, PCI DSS has specific rules about when storage-level encryption counts as protecting card data, and exporting database logs (LOG-01) is only part of an audit trail: recording who read which data needs database-side settings such as the `pgaudit` extension in an RDS parameter group, which you can check with another custom check.

The gate is a Rego policy over Checkov's JSON output, the same pattern as the vulnerability gate in [part 2](/guides/security-gates/02-vulnerability-gates): the scanner finds, the policy decides. It also fails when a mapped check is skipped with an inline comment, when Checkov could not parse a file, and when it found no resources at all, because each of these would otherwise pass the control without anyone reviewing it. Run Checkov without `--quiet` for this: with `--quiet`, the JSON report leaves out the skipped checks.

```rego
package compliance

frameworks(control) := concat(", ", [sprintf("%s %s", [name, ref]) | some name, ref in control.frameworks])

deny contains msg if {
	some control in data.controls
	some result in input.results.failed_checks
	result.check_id in control.checks
	msg := sprintf("%s %s: %s failed for %s [%s]", [control.id, control.title, result.check_id, result.resource, frameworks(control)])
}

# Mapped controls cannot be skipped with an inline comment; change the control
# or its check in a reviewed pull request instead.
deny contains msg if {
	some control in data.controls
	some result in input.results.skipped_checks
	result.check_id in control.checks
	msg := sprintf("%s %s: %s is skipped inline for %s, which is not allowed for a mapped control", [control.id, control.title, result.check_id, result.resource])
}

# A scan that could not read the code proves nothing. With nothing to scan,
# Checkov prints only the summary object instead of a full report.
summary := object.get(input, "summary", input)

deny contains msg if {
	summary.parsing_errors > 0
	msg := sprintf("Checkov could not parse %d file(s): the scan is incomplete", [summary.parsing_errors])
}

deny contains msg if {
	not summary.resource_count > 0
	msg := "Checkov found no resources: check the directory and the framework"
}
```

```terminal
{
  "title": "compliance gate",
  "prompt": "$",
  "steps": [
    {
      "cmd": "checkov --directory terraform --external-checks-dir checks --framework terraform --output json > checkov.json"
    },
    {
      "cmd": "conftest test checkov.json --namespace compliance --data compliance/controls.yaml",
      "output": "FAIL - checkov.json - compliance - ENC-01 Data at rest is encrypted with KMS keys: CKV_AWS_145 failed for aws_s3_bucket.invoices [SOC 2 CC6.1]\nFAIL - checkov.json - compliance - ENC-01 Data at rest is encrypted with KMS keys: CKV_AWS_16 failed for aws_db_instance.orders [SOC 2 CC6.1]\nFAIL - checkov.json - compliance - IAM-01 IAM policies grant least privilege: CKV_AWS_288 failed for aws_iam_policy.orders_api [PCI DSS 7.2.1, SOC 2 CC6.3]\nFAIL - checkov.json - compliance - IAM-01 IAM policies grant least privilege: CKV_AWS_289 failed for aws_iam_policy.orders_api [PCI DSS 7.2.1, SOC 2 CC6.3]\nFAIL - checkov.json - compliance - IAM-01 IAM policies grant least privilege: CKV_AWS_290 failed for aws_iam_policy.orders_api [PCI DSS 7.2.1, SOC 2 CC6.3]\nFAIL - checkov.json - compliance - IAM-01 IAM policies grant least privilege: CKV_AWS_355 failed for aws_iam_policy.orders_api [PCI DSS 7.2.1, SOC 2 CC6.3]\nFAIL - checkov.json - compliance - LOG-01 Data store logs are collected: CKV_AWS_129 failed for aws_db_instance.orders [PCI DSS 10.2.1, SOC 2 CC7.2]\nFAIL - checkov.json - compliance - LOG-01 Data store logs are collected: CKV_AWS_18 failed for aws_s3_bucket.invoices [PCI DSS 10.2.1, SOC 2 CC7.2]\nFAIL - checkov.json - compliance - NET-01 Data stores are not reachable from the internet: CKV2_AWS_6 failed for aws_s3_bucket.invoices [PCI DSS 1.3.1, SOC 2 CC6.6]\nFAIL - checkov.json - compliance - NET-01 Data stores are not reachable from the internet: CKV2_ORD_1 failed for aws_security_group.db [PCI DSS 1.3.1, SOC 2 CC6.6]\nFAIL - checkov.json - compliance - NET-01 Data stores are not reachable from the internet: CKV_AWS_17 failed for aws_db_instance.orders [PCI DSS 1.3.1, SOC 2 CC6.6]\n\n11 tests, 0 passed, 0 warnings, 11 failures, 0 exceptions"
    }
  ]
}
```

Eleven failures, each tied to a control and a framework reference. The 12 other failed checks (23 in total, with the custom one) still appear in the Checkov report and the code scanning dashboard, but they do not block.

The two extra rules matter more than they look. Point Checkov at the wrong directory and it reports nothing, which would pass every control:

```terminal
{
  "title": "an empty scan",
  "prompt": "$",
  "steps": [
    {
      "cmd": "checkov --directory no-terraform-here --framework terraform --output json > empty.json"
    },
    {
      "cmd": "cat empty.json",
      "output": "{\n    \"passed\": 0,\n    \"failed\": 0,\n    \"skipped\": 0,\n    \"parsing_errors\": 0,\n    \"resource_count\": 0,\n    \"checkov_version\": \"3.3.30\"\n}"
    },
    {
      "cmd": "conftest test empty.json --namespace compliance --data compliance/controls.yaml",
      "output": "FAIL - empty.json - compliance - Checkov found no resources: check the directory and the framework\n\n4 tests, 3 passed, 0 warnings, 1 failure, 0 exceptions"
    }
  ]
}
```

:::tip
Checkov has a built-in way to do part of this: `--hard-fail-on CKV_AWS_17,CKV_AWS_16` exits with code 1 only when one of the listed checks fails and treats every other failure as soft. That works for a short list. The control map adds the names and framework references that make the failure message and the audit report useful.
:::

## Fix the Terraform

The fixed version keeps the database private, in a subnet group of private subnets in the same VPC as its security group, and reachable only from the application's security group, encrypts the database and the bucket with a KMS key, turns on logging, blocks public access to the bucket and scopes the IAM policy to two S3 actions on one bucket, plus the two KMS actions that SSE-KMS needs on that key:

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.70"
    }
  }
}

variable "vpc_id" {
  type = string
}

variable "app_security_group_id" {
  description = "Security group of the orders-api tasks"
  type        = string
}

variable "db_subnet_group_name" {
  description = "DB subnet group with private subnets in var.vpc_id"
  type        = string
}

variable "kms_key_arn" {
  type = string
}

variable "access_log_bucket" {
  description = "Central bucket for S3 server access logs"
  type        = string
}

resource "aws_s3_bucket" "invoices" {
  bucket = "orders-api-invoices"
}

resource "aws_s3_bucket_public_access_block" "invoices" {
  bucket                  = aws_s3_bucket.invoices.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "invoices" {
  bucket = aws_s3_bucket.invoices.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_logging" "invoices" {
  bucket        = aws_s3_bucket.invoices.id
  target_bucket = var.access_log_bucket
  target_prefix = "orders-api-invoices/"
}

resource "aws_security_group" "db" {
  name        = "orders-db"
  description = "PostgreSQL for orders-api"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from the orders-api tasks only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
  }
}

resource "aws_db_instance" "orders" {
  identifier                      = "orders"
  engine                          = "postgres"
  engine_version                  = "17"
  instance_class                  = "db.t4g.medium"
  allocated_storage               = 50
  username                        = "orders"
  manage_master_user_password     = true
  publicly_accessible             = false
  storage_encrypted               = true
  kms_key_id                      = var.kms_key_arn
  enabled_cloudwatch_logs_exports = ["postgresql"]
  deletion_protection             = true
  backup_retention_period         = 14
  db_subnet_group_name            = var.db_subnet_group_name
  vpc_security_group_ids          = [aws_security_group.db.id]
}

resource "aws_iam_policy" "orders_api" {
  name = "orders-api"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "${aws_s3_bucket.invoices.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt", "kms:GenerateDataKey"]
        Resource = var.kms_key_arn
      }
    ]
  })
}
```

```terminal
{
  "title": "after the fix",
  "prompt": "$",
  "steps": [
    {
      "cmd": "checkov --directory terraform --external-checks-dir checks --framework terraform --output json > checkov.json"
    },
    {
      "cmd": "jq '.summary | {passed, failed, resource_count}' checkov.json",
      "output": "{\n  \"passed\": 37,\n  \"failed\": 11,\n  \"resource_count\": 7\n}"
    },
    {
      "cmd": "conftest test checkov.json --namespace compliance --data compliance/controls.yaml",
      "output": "4 tests, 4 passed, 0 warnings, 0 failures, 0 exceptions"
    }
  ]
}
```

Every mapped control passes. Eleven advisory checks still fail (Multi-AZ, Performance Insights, enhanced monitoring, IAM database authentication, versioning and a few more). Decide on each one: fix it, add it to a control, or skip it with a reason.

## Skip Checks With a Reason

Checkov supports two kinds of skips, and both should carry a reason:

- **For one resource**, a comment inside the resource block: `#checkov:skip=CKV_AWS_144:Invoices are backed up by AWS Backup (ORD-388)`. This works only for advisory checks; the compliance policy fails inline skips of mapped checks.
- **For the whole repository**, a `skip-check` list in `.checkov.yaml`, for checks that do not apply to your environment at all.

```yaml
# Repository-wide Checkov settings. Every skipped check needs a reason.
framework:
  - terraform
external-checks-dir:
  - checks
skip-check:
  # Invoices are copied to another Region by AWS Backup (ORD-388)
  - CKV_AWS_144
  # orders-api does not consume S3 events
  - CKV2_AWS_62
# Checkov reports; the control map in policy/compliance.rego decides
soft-fail: true
```

```terminal
{
  "title": "checkov with .checkov.yaml",
  "prompt": "$",
  "steps": [
    {
      "cmd": "checkov --directory terraform --config-file .checkov.yaml --output json > checkov.json"
    },
    {
      "cmd": "jq '.summary | {passed, failed, skipped}' checkov.json",
      "output": "{\n  \"passed\": 37,\n  \"failed\": 9,\n  \"skipped\": 0\n}"
    }
  ]
}
```

Two fewer failures, and `skipped` is still 0: checks listed under `skip-check` do not run at all, so they disappear from the report. An inline `checkov:skip` comment works differently: the check is counted as skipped and its reason is kept in the output, which is better for a decision about one resource.

Checkov skips do not expire, unlike the exceptions in part 2. Put the ticket in the reason, make the security team a [code owner](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) of `.checkov.yaml`, `checks/` and `compliance/` with "Require review from Code Owners" turned on in the branch ruleset, and review the skips together with the control map. For mapped checks (the ones in `controls.yaml`) the policy enforces this: an inline skip fails the gate, so the only way around a control is a reviewed change to the control map or to the check.

## Kubernetes and Hosts: kube-bench

Infrastructure code is one half. The CIS Kubernetes Benchmark also covers the control plane and node configuration, which you check in the running cluster with [kube-bench](https://github.com/aquasecurity/kube-bench). It runs as a Job on a node and compares the files and flags it finds with the benchmark:

```bash
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/v0.16.0/job.yaml
kubectl logs job/kube-bench
```

kube-bench 0.16 selects the benchmark from the Kubernetes version: `cis-1.12` for Kubernetes 1.32 to 1.34. It has no profile for 1.35 or later yet, so on newer clusters pass `--benchmark cis-1.12` and expect some checks not to match. On managed clusters (EKS, AKS, GKE) the provider runs the control plane; use the managed profiles such as `eks-1.8.0` or `gke-1.9.0`, which check only the nodes. Run it on a schedule and after node image upgrades rather than in every pipeline.

## Keep the Evidence

An auditor asks two questions: does the control exist, and did it work for the whole period? The gate answers the second one if you keep its output:

- Upload Checkov's SARIF output to code scanning (part 4) so findings have history, owners and states.
- Store the Checkov JSON and the Conftest result of every run on the main branch as build artifacts with a retention period that covers your audit window (often 12 months), or copy them to an evidence bucket with S3 Object Lock.
- Keep `controls.yaml`, `.checkov.yaml` and `checks/` in Git. The pull request history shows who changed a control or a skip, who approved it and when.

The pull request that adds or skips a control is itself evidence of change management (SOC 2 CC8.1), as long as the branch protection requires a review.

## Common Mistakes

- **Treating a green scan as compliance.** Default checks miss things (here, the open database port), and frameworks cover far more than configuration.
- **Blocking on every default check.** The gate gets ignored. Block on mapped controls and report the rest.
- **Filtering by severity without an API key.** In open source Checkov, severity filters in `--check`, `--skip-check`, `--soft-fail-on` and `--hard-fail-on` need the Prisma Cloud API key. Use check IDs.
- **Skips without reasons or owners.** Every skip needs a ticket and a reviewer.
- **Scanning only at pull request time.** Run the gate again before `terraform apply` on the plan you apply (Checkov reads plan JSON with `-f tfplan.json`), and check the running environment for drift.

## Summary

- Checkov finds misconfigurations in Terraform without cloud credentials. Custom YAML checks cover what the defaults miss.
- Keep a control map that links each control to its checks and framework references, and gate on that map with a Rego policy.
- Skip checks with a reason and a ticket, and protect the configuration with code owners.
- Keep the outputs of every run as audit evidence, and check clusters against the CIS benchmark with kube-bench.

Next, [CI/CD Integration](/guides/security-gates/04-cicd-integration) puts the policy, vulnerability and compliance gates from parts 1 to 3 into one GitHub Actions pipeline.

## Keep Learning

- [SOC 2 Evidence From GitHub and Terraform, and the Part That Still Needs a Person](/posts/soc2-evidence-from-github-and-terraform)
- [AWS Security Checklist](/checklists/aws-security)
- [Interview question: compliance and governance in the cloud](/interview-questions/senior/compliance-governance)
- [Terraform Infrastructure as Code Best Practices](/posts/terraform-best-practices)
