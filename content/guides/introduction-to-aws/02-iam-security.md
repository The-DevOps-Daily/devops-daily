---
title: 'IAM: Users, Roles and Policies'
description: 'Learn AWS IAM: how policies are evaluated, how to sign in without long-lived access keys (aws login, IAM Identity Center), and how to use roles.'
order: 2
---

**TLDR**: Lock the root user away. Sign in as an IAM user with MFA (one account, learning) or through IAM Identity Center (a team or several accounts). Use `aws login` or `aws sso login` for the CLI instead of access keys. Give servers and functions **roles**, never keys. Every request is denied unless a policy allows it, and an explicit deny always wins.

AWS Identity and Access Management (IAM) decides who can do what in your account. Every API call from the console, the CLI or your code goes through it. If you get IAM right early, the rest of the guide is safer: a leaked password or a buggy script can only do what its permissions allow.

This part explains how IAM evaluates a request, how to read a policy, how humans and applications should sign in in 2026, and how to debug "access denied" errors.

## Prerequisites

- The AWS account and the AWS CLI from [Part 1](/guides/introduction-to-aws/01-account-setup), with MFA on the root user.
- About 30 minutes. IAM is free; nothing in this part costs money.

## The Building Blocks

**Principals** are the identities that make requests:

- **Root user**: the email address you signed up with. It can do everything, including closing the account, and you cannot attach IAM policies to it to restrict it.
- **IAM users**: long-term identities with a password and, optionally, access keys. AWS now recommends them only where nothing better is available.
- **IAM roles**: identities with no password or keys of their own. A person, an EC2 instance, a Lambda function or another account **assumes** a role and receives **temporary credentials** that expire, usually after one hour.
- **IAM Identity Center users**: people managed in one place (or in your company's identity provider) who sign in to a portal and get roles in one or more accounts.

**Policies** are JSON documents that allow or deny actions:

- **Identity-based policies** attach to a user, group or role and say what that identity may do.
- **Resource-based policies** attach to a resource, such as an S3 bucket policy or a role's trust policy, and say who may use that resource.
- **AWS managed policies** (for example `ReadOnlyAccess`) are written and updated by AWS. **Customer managed policies** are your own, reusable ones. **Inline policies** belong to exactly one identity.

**Groups** collect IAM users so you attach a policy once instead of to every user.

## How IAM Decides

IAM evaluates every request with the same simple logic:

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "Request", "sub": "principal, action, resource", "icon": "activity", "tone": "slate" },
    { "label": "Explicit Deny?", "sub": "in any policy", "icon": "shield", "tone": "red" },
    { "label": "Explicit Allow?", "sub": "in an applicable policy", "icon": "check", "tone": "amber" }
  ],
  "branch": [
    { "label": "Denied (explicit deny or no allow)", "variant": "bad" },
    { "label": "Allowed", "variant": "good" }
  ]
}
```

1. By default, everything is **denied**.
2. If any applicable policy has an explicit `"Effect": "Deny"` that matches, the request is denied. Nothing can override it.
3. Otherwise, if a policy has an `"Effect": "Allow"` that matches, the request is allowed.
4. If nothing matches, the request stays denied (an **implicit deny**).

In an organization, guardrails such as service control policies (SCPs) and permission boundaries can only take permissions away: an action must be allowed by every layer that applies.

## Read a Policy

This customer managed policy lets an application list one bucket and read and write the objects under the `uploads/` prefix:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListUploadsPrefix",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::photo-app-uploads-example",
      "Condition": {
        "StringLike": { "s3:prefix": ["uploads/*"] }
      }
    },
    {
      "Sid": "ReadWriteUploads",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::photo-app-uploads-example/uploads/*"
    }
  ]
}
```

- `Version` is always `2012-10-17`, the current policy language version (it is not a date you update).
- `Action` names an API action as `service:Operation`.
- `Resource` is an **ARN** (Amazon Resource Name). Listing applies to the bucket ARN; reading and writing apply to object ARNs, which end in `/key`. Mixing these two up is the most common S3 policy mistake.
- `Condition` narrows the statement further, here to keys that start with `uploads/`.

When you write a policy in the IAM console, the editor runs **IAM Access Analyzer policy validation** and flags errors, security warnings and suggestions before you save.

## How People Should Sign In

Long-lived access keys (`AKIA...`) are the credentials that leak most often: pasted into code, committed to Git, left on a laptop. In 2026 you rarely need them, because both ways for people to sign in also work for the CLI with short-lived credentials:

| Situation                           | Sign in to the console           | Use the CLI                               |
| ----------------------------------- | -------------------------------- | ----------------------------------------- |
| You alone, one account (this guide) | IAM user with a password and MFA | `aws login` (AWS CLI 2.32.0 or later)     |
| A team, or several accounts         | IAM Identity Center user         | `aws configure sso`, then `aws sso login` |

IAM Identity Center is AWS's recommended approach for people, but to give access to AWS accounts it needs AWS Organizations. When an account creates or joins an organization, its Free Tier credits expire immediately, and a free plan account is upgraded to the paid plan. For a single learning account, an IAM user with MFA and `aws login` is a sound, simple choice.

### Create Your Admin User

Sign in as the root user one last time for this task:

1. Open the account menu, choose **Account**, find **IAM user and role access to Billing information**, choose **Edit** and select **Activate IAM Access**. Without this, IAM users cannot open the Billing pages (Budgets, Credits, Cost Explorer), even with `AdministratorAccess`.
2. Open **IAM**, choose **User groups**, then **Create group**. Name it `Admins` and attach the AWS managed policy `AdministratorAccess`.
3. Choose **Users**, then **Create user**. Enter a name such as `alex-admin`, select **Provide user access to the AWS Management Console**, choose **I want to create an IAM user**, and set a strong password.
4. Add the user to the `Admins` group and create it. Do not create access keys.
5. Note the account sign-in URL on the IAM dashboard (`https://<account-id>.signin.aws.amazon.com/console`). You can create an account alias to make it readable.
6. Sign out, sign in with the new user, open **Security credentials** for your user, and assign an MFA device: a passkey or security key, or an authenticator app.

From now on you use `alex-admin` for daily work and the root user only for the few [tasks that need it](https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-tasks.html).

`AdministratorAccess` is broad. That is acceptable for the one person who owns a learning account. Everyone and everything else should get narrower permissions.

### Connect the CLI

Both options write a profile to `~/.aws/config` and keep short-lived credentials in a cache. Pick the tab that matches how you sign in:

```tabs
{
  "title": "Configure the AWS CLI without access keys",
  "tabs": [
    {
      "label": "aws login (IAM user)",
      "lang": "bash",
      "code": "# Opens your browser; pick the console session to use\naws login --profile learn\n\n# On a machine without a browser (for example over SSH)\naws login --profile learn --remote\n\n# Test it, then sign out when you are done\naws sts get-caller-identity --profile learn\naws logout --profile learn"
    },
    {
      "label": "IAM Identity Center",
      "lang": "bash",
      "code": "# One-time setup: asks for the start URL, Region, account and role\naws configure sso --profile learn-admin\n\n# Each day (sessions last up to the duration your admin set)\naws sso login --profile learn-admin\n\n# Test it\naws sts get-caller-identity --profile learn-admin"
    }
  ]
}
```

`aws login` needs the `SignInLocalDevelopmentAccess` permission, which `AdministratorAccess` already includes. The CLI refreshes the credentials for up to 12 hours, then you run `aws login` again.

For Identity Center, `aws configure sso` writes an `sso-session` section and a profile that points to it, and signs you in once. When the cached token is missing or has expired, the CLI tells you so, and `aws sso login` signs you in again. This run uses a config file written by hand with example values, so there is no cached token yet:

```terminal
{
  "title": "AWS CLI 2.38.5, before aws sso login",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cat ~/.aws/config",
      "output": "[profile learn-admin]\nsso_session = my-sso\nsso_account_id = 111122223333\nsso_role_name = AdministratorAccess\nregion = us-east-1\noutput = json\n\n[sso-session my-sso]\nsso_start_url = https://d-1234567890.awsapps.com/start\nsso_region = us-east-1\nsso_registration_scopes = sso:account:access"
    },
    {
      "cmd": "aws configure list-profiles",
      "output": "learn-admin"
    },
    {
      "cmd": "aws sts get-caller-identity --profile learn-admin",
      "output": "aws: [ERROR]: Error loading SSO Token: Token for my-sso does not exist"
    }
  ]
}
```

After `aws sso login`, the same `get-caller-identity` call prints your account and the role you assumed (example output):

```text
{
    "UserId": "AROAEXAMPLEID1234567:alex",
    "Account": "111122223333",
    "Arn": "arn:aws:sts::111122223333:assumed-role/AWSReservedSSO_AdministratorAccess_0123456789abcdef/alex"
}
```

Set `AWS_PROFILE=learn-admin` (or `learn`) in your shell so you do not have to type `--profile` on every command.

## Roles for Applications

Applications should never carry a password or an access key. They assume a role and the SDK picks up temporary credentials automatically.

A role has two policies:

- a **trust policy** (who may assume the role), and
- one or more **permissions policies** (what the role may do).

This trust policy lets EC2 instances assume the role. You attach the role to an instance through an **instance profile**, which the console creates for you:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ec2.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

Attach the bucket policy from [Read a Policy](#h2-read-a-policy) as the permissions policy, and code on the instance can read and write `uploads/` with no credentials in the code or on disk. [What Does AssumeRole With Service: ec2.amazonaws.com Do?](#h3-what-does-assumerole-with-service-ec2amazonawscom-do) below shows the pieces in detail, with the same setup in Terraform.

The SDKs find role credentials through the **default credential provider chain**: environment variables, the shared config files (including `aws login` and SSO profiles), then container and instance metadata. Write your code without credentials and it works on your laptop and on AWS. To use an `aws login` profile from Python, you need boto3 1.41.0 or later with the AWS Common Runtime (`pip install 'boto3[crt]'`):

```tabs
{
  "title": "No credentials in code",
  "tabs": [
    {
      "label": "Python (boto3)",
      "lang": "python",
      "code": "import boto3\n\n# No keys here: boto3 uses your profile locally and the\n# instance role on EC2 or the execution role on Lambda.\ns3 = boto3.client(\"s3\")\ns3.put_object(\n    Bucket=\"photo-app-uploads-example\",\n    Key=\"uploads/hello.txt\",\n    Body=b\"hello\",\n)"
    },
    {
      "label": "JavaScript (SDK v3)",
      "lang": "javascript",
      "code": "import { S3Client, PutObjectCommand } from \"@aws-sdk/client-s3\";\n\n// No keys here: the default provider chain finds them.\nconst s3 = new S3Client({});\nawait s3.send(new PutObjectCommand({\n  Bucket: \"photo-app-uploads-example\",\n  Key: \"uploads/hello.txt\",\n  Body: \"hello\",\n}));"
    }
  ]
}
```

The old JavaScript SDK v2 (the `aws-sdk` package) has reached end of support. Use the modular v3 clients such as `@aws-sdk/client-s3` in new code.

Other places roles replace keys:

- **Lambda**: every function has an **execution role** ([Part 9](/guides/introduction-to-aws/09-lambda-serverless)).
- **CI/CD**: GitHub Actions, GitLab and others can assume a role through **OIDC federation**, so no AWS keys are stored in the CI system.
- **Servers outside AWS**: **IAM Roles Anywhere** issues temporary credentials to machines that have an X.509 certificate.

If a third-party tool truly needs an access key, create a dedicated IAM user with the narrowest policy, store the key in a secrets manager, rotate it, and delete it when the tool goes away.

### What Does AssumeRole With Service: ec2.amazonaws.com Do?

It lets the EC2 service assume the role for your instances, and nothing more. The statement is a **trust policy**: `ec2.amazonaws.com` may call `sts:AssumeRole` on this role. When an instance starts with the role's instance profile, EC2 assumes the role and puts temporary credentials into the instance metadata. The SDKs and the CLI on the instance find them there. What the instance may then do comes from the role's **permissions policies**, plus resource policies (such as a bucket policy) that name the role, and any explicit deny or organization guardrail still wins. A role with this trust policy and no permissions policy can be assumed, but almost every call it makes is denied (`aws sts get-caller-identity` works for every identity).

Three resources work together:

| Resource                   | What it answers                  | Created by the console for you?                                                  |
| -------------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| Role with the trust policy | Who may assume the role          | Yes, when you choose the **EC2** use case                                        |
| Permissions policies       | What the role may do             | You attach them                                                                  |
| Instance profile           | Which role an instance runs with | Yes, with the same name as the role; not by the CLI, CloudFormation or Terraform |

An instance profile holds exactly one role. To give an instance more permissions, attach more policies to that role. The person or pipeline that launches the instance needs `iam:PassRole` for the role. That check decides which roles each developer may hand to an instance; without it, anyone who can launch instances could run code with any role in the account.

The same setup in Terraform, for the `photo-app-web` role from [Part 3](/guides/introduction-to-aws/03-ec2-servers#h2-create-a-role-for-session-manager), with the uploads policy from [Read a Policy](#h2-read-a-policy) saved as `uploads-policy.json`:

```hcl
data "aws_iam_policy_document" "ec2_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "web" {
  name               = "photo-app-web"
  assume_role_policy = data.aws_iam_policy_document.ec2_trust.json
}

# Permissions: Session Manager (AWS managed) and the uploads prefix (your own)
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.web.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "uploads" {
  name   = "uploads"
  role   = aws_iam_role.web.id
  policy = file("${path.module}/uploads-policy.json")
}

resource "aws_iam_instance_profile" "web" {
  name = "photo-app-web"
  role = aws_iam_role.web.name
}

data "aws_ami" "al2023_arm64" {
  owners      = ["amazon"]
  most_recent = true
  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-kernel-*-arm64"]
  }
}

resource "aws_instance" "web" {
  ami                  = data.aws_ami.al2023_arm64.id
  instance_type        = "t4g.micro"
  iam_instance_profile = aws_iam_instance_profile.web.name

  metadata_options {
    http_tokens = "required" # IMDSv2 only
  }
}
```

On the instance, check which identity the CLI uses. The role session is named after the instance ID (example output):

```bash
aws sts get-caller-identity --query Arn --output text
```

```text
arn:aws:sts::111122223333:assumed-role/photo-app-web/i-0123456789abcdef0
```

EC2 renews the credentials before they expire, and the SDKs read the new ones without a restart. Do not copy them out of the metadata service into files or environment variables, where they stop being renewed and can leak. To change the role of a running instance, use `aws ec2 replace-iam-instance-profile-association`, or attach more policies to the current role.

## Managed Policies Worth Knowing

| Policy                | What it allows                                   | Typical use                          |
| --------------------- | ------------------------------------------------ | ------------------------------------ |
| `AdministratorAccess` | Everything                                       | The account owner, break-glass roles |
| `PowerUserAccess`     | Everything except managing IAM and Organizations | Developers in a sandbox account      |
| `ReadOnlyAccess`      | Read and list in almost every service            | Auditors, on-call dashboards         |
| `ViewOnlyAccess`      | List and describe, without reading data          | Inventory tools                      |

Service-wide policies such as `AmazonS3FullAccess` allow every action on every bucket in the account. Start from one of them while you explore, then replace it with a customer managed policy scoped to your resources.

### What Is the Correct Way to Attach an AWS Managed Policy to a Role?

Attach it by its ARN, as a separate attachment, and do not copy its JSON into an inline policy. An attached managed policy stays linked to AWS's version, so you get AWS's updates, and one policy can serve many roles. In the console, open the role and choose **Add permissions**, **Attach policies**. With the CLI:

```bash
aws iam attach-role-policy \
  --role-name photo-app-web \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

aws iam list-attached-role-policies --role-name photo-app-web
```

AWS managed policies have `aws` where an account ID would be, and some have a path. The Lambda VPC policy, for example, is `arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole`. Without the path, the call fails with `NoSuchEntity`. In AWS GovCloud (US) and the China Regions, the ARN starts with `arn:aws-us-gov` or `arn:aws-cn`.

In Terraform, use one `aws_iam_role_policy_attachment` per policy, as in the example above. Avoid two other ways that look similar:

- **`aws_iam_policy_attachment`** (without `role_`) manages every attachment of the policy in the whole account. Roles, users and groups that it does not list lose the policy at the next apply.
- **The `managed_policy_arns` argument of `aws_iam_role`** is deprecated since AWS provider 5.72. To make Terraform remove attachments that someone added by hand, add `aws_iam_role_policy_attachments_exclusive` next to the attachments.

Use AWS managed policies where AWS knows best what a service needs: `AmazonSSMManagedInstanceCore` for Session Manager, the Lambda execution role policies, and the job function policies above. AWS changes their permissions from time to time, and every role that has one attached gets the change. For access to your own buckets, tables and queues, write a customer managed policy with your resource ARNs, as in [Read a Policy](#h2-read-a-policy). A role can have up to 20 managed policies attached by default (25 with a quota increase); if you get close, merge your own policies instead of attaching more. To see what an AWS managed policy allows before you attach it, read its default version:

```bash
arn=arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
version=$(aws iam get-policy --policy-arn "$arn" --query Policy.DefaultVersionId --output text)
aws iam get-policy-version --policy-arn "$arn" --version-id "$version" \
  --query PolicyVersion.Document
```

For more than one policy, `for_each` over a set of ARNs, and for policies that Terraform itself needs, see [How Do I Attach Multiple IAM Policies to an IAM Role?](/posts/terraform-fargate-task-definition-execution-role#h2-how-do-i-attach-multiple-iam-policies-to-an-iam-role).

## Find Out What Is Used

IAM gives you the data to remove permissions safely:

- **Last accessed information** (on each user, role and policy) shows which services and actions were used and when.
- **IAM Access Analyzer** finds resources shared outside your account or organization, validates policies, and can generate a policy from the actions a role used in CloudTrail.
- The **credential report** is a CSV of every user with password age, MFA status and access key age.
- **CloudTrail event history** shows the management API calls of the last 90 days in each Region, with who made them.

## Debug "Access Denied"

Read the whole error message. AWS now tells you which kind of policy blocked the request (example output):

```text
An error occurred (AccessDenied) when calling the ListBuckets operation: User: arn:aws:iam::111122223333:user/dev-ci is not authorized to perform: s3:ListAllMyBuckets because no identity-based policy allows the s3:ListAllMyBuckets action
```

Then check, in order:

1. **Who am I?** Run `aws sts get-caller-identity`. Many "access denied" errors come from the wrong profile or an expired session.
2. **Is the action allowed?** Look for the exact action name (`s3:ListAllMyBuckets`, not `s3:ListBuckets`) in the identity's policies.
3. **Is it denied anywhere?** An explicit deny in an SCP, a permission boundary, a bucket policy or a session policy wins.
4. **Is the resource ARN right?** Bucket ARN versus object ARN, the right Region and account in the ARN.
5. **Does the resource policy agree?** For cross-account access, both the identity policy and the resource policy must allow it.

Some EC2 errors return an encoded message. Decode it with `aws sts decode-authorization-message --encoded-message <message>` (the caller needs `sts:DecodeAuthorizationMessage`).

## Common Mistakes

- **Using the root user for daily work.** Keep it for root-only tasks, with MFA.
- **Creating access keys "just for the CLI".** Use `aws login` or `aws sso login` instead.
- **Sharing one user between people.** CloudTrail can no longer tell who did what.
- **Attaching policies to individual users.** Use groups or roles, so permissions stay consistent.
- **Granting `*` on actions or resources "for now".** Use last accessed information or Access Analyzer to narrow it once the app works.
- **Embedding credentials in code, images or user data.** Use roles; anything in user data is readable by anyone who can describe the instance.

## Summary

- Every request is denied by default, allowed only by a matching `Allow`, and an explicit `Deny` always wins.
- People sign in with MFA and get short-lived CLI credentials through `aws login` or IAM Identity Center.
- Applications use roles: instance profiles on EC2, execution roles on Lambda, OIDC federation in CI.
- Start broad while you learn, then narrow permissions with last accessed data and Access Analyzer.

Next, you use a role for real: [launch your first EC2 server](/guides/introduction-to-aws/03-ec2-servers).

## Keep Learning

- [Cloud IAM Basics interview questions](/interview-questions/topic/cloud#cloud-iam-basics)
- [How to Attach Multiple IAM Policies to IAM Roles Using Terraform](/posts/terraform-fargate-task-definition-execution-role#h2-how-do-i-attach-multiple-iam-policies-to-an-iam-role)
- [Determining Minimum AWS Permissions for Terraform Configurations](/posts/terraform-fargate-task-definition-execution-role#h2-what-are-the-minimum-aws-permissions-for-terraform)
- [AWS Security Checklist](/checklists/aws-security)
