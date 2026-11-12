---
title: 'We Tested AWS Emulator: It Blocks More Than Its Docs Say, and Less Than AWS Does'
excerpt: 'AWS Emulator passed all 40 of our workflow checks and caught two IAM mistakes in our own test code. It also let a user with no policies assume an admin role, ignored permissions boundaries and session policies, and its JavaScript SQS defaults sent a request to real AWS. Here is what we measured on a throwaway droplet.'
category:
  name: 'AWS'
  slug: 'aws'
date: '2026-11-12'
publishedAt: '2026-11-12T12:00:00Z'
updatedAt: '2026-11-12T12:00:00Z'
readingTime: '22 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - AWS
  - IAM
  - Testing
  - Terraform
  - Local Development
  - AI Agents
  - CI/CD
---

AWS released AWS Emulator on 2026-11-11: a free local copy of the AWS APIs that runs on your laptop or in CI, with no AWS account. We installed v1.0.322 on a throwaway droplet and ran it through 40 workflow checks across 9 services, 32 permission cases, the AWS CLI, the JavaScript SDK and Terraform. **All 40 workflow checks passed, and the emulator refused two calls our own test code made with roles that had no permissions, as AWS would.** That is more permission checking than AWS's own security page describes. It is also less than AWS does: a user with no policies at all assumed an admin role and created an IAM user with it, and permissions boundaries and session policies changed nothing.

Three other things would bite a real test suite: the JavaScript SDK's SQS client sent a request to the real `sqs.us-east-1.amazonaws.com` by default, Terraform AWS provider 6.73.0 could not read back an S3 bucket, and the emulator refuses to hold more than 64 MiB in one bucket or 1,000 messages in one queue.

## TLDR

- Install is one signed `.deb` (163.0 MiB) that unpacks to one 925.7 MiB Rust binary. It answered its health check in a median 383.5 ms on repeated starts and 1,325 ms with the page cache dropped, using 172.5 MiB of anonymous memory at idle.
- Our scenario suite passed 40 of 40 checks: S3 presigned URLs, multipart and versioning; SQS visibility timeout, DLQ and redrive; DynamoDB conditional writes, transactions and streams; Lambda; EventBridge to SQS; SNS fan-out with a filter policy; KMS; Secrets Manager; Step Functions.
- The emulator enforces identity policies, bucket policies, KMS key policies and secret policies for the users and roles you create in it. That caught a missing `s3:PutObject` and a missing `lambda:InvokeFunction` in our own test code.
- It matched AWS's documented result in 27 of 32 permission cases. All 5 misses let through a request that AWS refuses, and they come from 4 causes: permissions boundaries, session policies, the caller's own `sts:AssumeRole` check (a user with no policies assumed an admin role and used it), and `ListBuckets` with no policy.
- The JS SDK v3 SQS client follows the AWS-style queue URL the emulator returns and calls real AWS. Set `useQueueUrlAsEndpoint: false`.
- Terraform AWS provider 6.73.0 fails on `aws_s3_bucket` because it reads tags through S3 Control. Provider 5.100.0 applied and destroyed the same 25-resource stack, with one plan diff left.
- The repo has 29,684 commits, all by agent identities, and about 16.1 million lines of Rust. AWS's own fidelity scores for this release pass 56.5% of 42,937 scored checks.

## Prerequisites

- A Linux x86_64 machine you can throw away. We used a 4 vCPU / 8 GB DigitalOcean droplet with Ubuntu 24.04.
- AWS CLI v2 and an SDK (we used boto3 1.44.1 and the JavaScript SDK v3).
- Terraform if you want to test infrastructure code.
- No AWS account, and no real AWS credentials anywhere on the machine. The emulator writes its own keys per run.

Every script and raw result is in the companion repo:

```github
https://github.com/The-DevOps-Daily/aws-emulator-field-test
```

## What AWS Emulator is, from the primary sources

The [launch post](https://aboutamazon.com/news/aws/how-autonomous-ai-agents-built-aws-emulator) gives 438 AWS API models. Werner Vogels' [post](https://www.allthingsdistributed.com/2026/11/aws-emulator-and-the-engineers-job-when-agents-write-the-code.html) says "more than 400 API models covering more than 200 AWS services" and that "all of AWS Emulator's code was written and tested by agents." The method in both posts: agents write fidelity tests from the public Smithy models, fix each test until it passes against real AWS, then build the emulator until it passes the same test. Every change goes through a merge gate that includes several security agents doing adversarial reviews.

The [user guide](https://docs.aws.amazon.com/emulator/latest/userguide/what-is-service.html) adds the parts that matter in practice:

- It is for building and testing, not production. It "doesn't evaluate AWS Identity and Access Management (IAM) policies and resource-based policies the way AWS does."
- Behaviour is checked against AWS in `us-west-2` only, and global services in `us-east-1`.
- One account (`000000000000`) and, in practice, one Region per emulator.
- It serves HTTPS on `127.0.0.1:9297` with a new self-signed certificate and new access keys on every start.
- Telemetry is on by default. The [README](https://github.com/aws/aws-emulator) explains how to turn it off. We ran every test with `--telemetry off`.

The code is CC0, except the `vendor/` directory, which is Apache 2.0. The repository does not take pull requests.

## Install and start

On Linux it is a native package. The Debian package was 163.0 MiB and passed the GPG check from the install guide (`Good signature from "SSM Publishing <ssm-publishing@amazon.com>"`). It installs two files: a license file and one stripped Rust binary of 970,692,256 bytes.

```bash
curl -fsSLo aws-emulator.deb \
  https://downloads.aws.com/aws-emulator/packages/aws-emulator/LTS/latest/aws-emulator_amd64.deb
sudo apt-get install -y ./aws-emulator.deb
aws-emulator --telemetry off
```

We timed 10 repeated starts from `exec` to the first HTTP 200 on `/__admin/health`, each with a fresh home directory, then 5 more with the page cache dropped so the binary had to come off disk.

| Measure                                     | Result                             |
| ------------------------------------------- | ---------------------------------- |
| `.deb` download                             | 163.0 MiB                          |
| Installed binary                            | 925.7 MiB                          |
| Start to healthy, repeated starts (10 runs) | 338 to 470 ms, median 383.5 ms     |
| Start to healthy, cold page cache (5 runs)  | 1,260 to 1,399 ms, median 1,325 ms |
| RSS at ready                                | about 282 MiB, flat over 60 s idle |
| Anonymous memory at ready                   | 172.5 MiB                          |

The guide says the emulator "uses about 160 MiB when idle." Plain RSS reads higher because it counts pages of the memory-mapped binary. The anonymous part, 172.5 MiB, is close to the documented figure.

A clean `SIGTERM` deleted the credentials, config and certificate files from `~/.aws/emulator/9297/`, as the guide says, and left the empty directory.

## The AWS CLI session

The setup is eight environment variables from the [SDK guide](https://docs.aws.amazon.com/emulator/latest/userguide/point-sdk-to-emulator.html): the endpoint, the per-run credentials and config files, the CA bundle, two Region variables, and two switches that stop the SDK from asking the instance metadata service for credentials or adding prefixes to host names. Here is part of our recorded CLI session against a fresh emulator:

```terminal
{
  "title": "aws cli against AWS Emulator v1.0.322",
  "prompt": "$",
  "steps": [
    { "cmd": "aws sts get-caller-identity --output text", "output": "000000000000\tarn:aws:iam::000000000000:user/emulator\tAIDAH5I7GEMO7ADXNFAZU" },
    { "cmd": "aws s3 mb s3://cli-demo", "output": "make_bucket: cli-demo" },
    { "cmd": "aws s3 cp /tmp/notes.txt s3://cli-demo/notes.txt", "output": "upload: ../tmp/notes.txt to s3://cli-demo/notes.txt" },
    { "cmd": "curl --cacert $AWS_CA_BUNDLE \"$(aws s3 presign s3://cli-demo/notes.txt --expires-in 60)\"", "output": "release notes" },
    { "cmd": "aws sqs create-queue --queue-name cli-demo --query QueueUrl --output text", "output": "https://sqs.us-east-1.amazonaws.com/000000000000/cli-demo" },
    { "comment": "the same validation error as AWS" },
    { "cmd": "aws dynamodb create-table --table-name ab ...", "output": "aws: [ERROR]: An error occurred (ValidationException) when calling the CreateTable operation: 1 validation error detected: Value 'ab' at 'tableName' failed to satisfy constraint: Member must have length greater than or equal to 3" },
    { "comment": "S3 Control puts the account ID in the host name, so it never arrives" },
    { "cmd": "aws s3control list-access-points --account-id 000000000000", "output": "aws: [ERROR]: Could not connect to the endpoint URL: \"https://000000000000.127.0.0.1:9297/v20180820/accesspoint\"" }
  ]
}
```

Note the queue URL. It looks exactly like a real one. That detail comes back later.

## 40 workflow checks, 40 passes

We did not want to test single API calls. We wrote 9 workflows of the kind that integration tests use, with 40 checks between them. Each check records the exact error text when it fails. Many checks test the error path, because a fake that accepts everything passes the happy path too.

| Workflow        | Checks | Result | What it covered                                                                                                                                                        |
| --------------- | ------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S3              | 9      | 9/9    | presigned GET and PUT, an expired URL refused with 403, 3-part multipart, completing with a 1 MiB first part refused with `EntityTooSmall`, versioning, delete markers |
| SQS             | 5      | 5/5    | visibility timeout, the third receive moving a message to the DLQ, `StartMessageMoveTask` back, FIFO deduplication                                                     |
| DynamoDB        | 6      | 6/6    | insert-if-absent, a stale optimistic-lock update, a cancelled transaction with per-item reasons, streams                                                               |
| Lambda          | 4      | 4/4    | create and invoke a python3.12 zip, handler exception as `FunctionError`, boto3 called from inside the function                                                        |
| EventBridge     | 2      | 2/2    | a numeric pattern (`total > 100`) delivering only the matching event to SQS                                                                                            |
| SNS             | 2      | 2/2    | fan-out to two queues, one with raw delivery and one with a filter policy                                                                                              |
| KMS             | 6      | 6/6    | round trip by alias, wrong encryption context, tampered ciphertext, data keys, a disabled key                                                                          |
| Secrets Manager | 3      | 3/3    | `AWSCURRENT` and `AWSPREVIOUS`, scheduled deletion blocking reads, restore                                                                                             |
| Step Functions  | 3      | 3/3    | Choice, Wait, a Lambda task, a Fail state                                                                                                                              |

The whole suite ran in 38.0 s against a fresh emulator. The emulator answered small calls fast: under load, a 100 KiB `PutObject` took a median 14.66 ms and a 25-item `BatchWriteItem` 13.64 ms.

Getting to 40 of 40 took four runs. Every failure in between was a mistake in our test, and the repo keeps each of those runs. That story is the most useful part of this test.

### The emulator caught our missing permissions

On the third run, the Lambda function's call to S3 failed. We reproduced that run on purpose as a named variant (`FT_NO_ROLE_POLICIES=1`), and this is its recorded error:

```text
AccessDenied: User: arn:aws:sts::000000000000:assumed-role/ft-fn-8820f7df/ft-fn-8820f7df is not authorized
to perform: s3:PutObject on resource: "arn:aws:s3:::ft-lambda-8820f7df/from-lambda.txt" because no
identity-based policy allows the s3:PutObject action
```

Our test created the Lambda execution role with a trust policy and nothing else. On AWS that function fails the same way. The Step Functions test failed for the same reason: `ft-sfn-8820f7df is not authorized to perform: lambda:InvokeFunction`. We added the two missing policies and both checks passed. That variant is the best argument for the emulator we found.

### The Lambda sandbox

The first two runs failed for a different reason: our handler probed the machine it ran on. The emulator refused every probe that reached for the host:

| Probe from inside the function | Result                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `sys.version`                  | `3.14.0.alpha`, for a `python3.12` function                                              |
| `open("/etc/hostname")`        | `OSError: a Lambda function in this emulator cannot open a file of the host`             |
| `os.getuid()`                  | `OSError: a Lambda function in this emulator has no host filesystem or process to reach` |
| `socket.gethostname()`         | `OSError: a Lambda function in this emulator has no host network to reach`               |
| `import subprocess`            | `ModuleNotFoundError: No module named '_signal'`                                         |

That is good isolation for zip-packaged Python, and better than the security page suggests ("it doesn't isolate that code from your machine"). We only tested Python zip functions, so do not assume the same for other runtimes. Two practical effects: a handler that imports `subprocess` at module level fails to load with `Runtime.ImportModuleError`, and your code runs on a different Python than the one you deploy to. Four invokes in a row took 369, 335, 354 and 355 ms, with no consistent warm-start speedup.

## The permission test: 27 of 32

The security page is direct about permissions:

> Some services in the emulator evaluate IAM policies for IAM users and roles that you create in the emulator, but not the same way as AWS. The emulator never denies a request signed with its own key. It doesn't check AWS KMS key policies or Amazon S3 bucket policies.

The Lambda result suggested more checking than that, so we wrote 32 cases. For each one we wrote down what AWS documents. **These cases were not run on real AWS**: the expected column comes from the AWS documentation for policy evaluation, bucket policies, KMS key policies, role trust policies and SQS queue policies. Then we ran them against the emulator, and against Moto and Floci for context.

Bold marks a result that differs from what AWS documents.

| Case                                                                                                          | AWS documents | AWS Emulator  | Floci         | Moto          |
| ------------------------------------------------------------------------------------------------------------- | ------------- | ------------- | ------------- | ------------- |
| user with no policies: sts:GetCallerIdentity                                                                  | allow         | allow         | allow         | allow         |
| user with no policies: s3:ListAllMyBuckets                                                                    | deny          | **allow**     | **allow**     | **allow**     |
| user with no policies: s3:PutObject                                                                           | deny          | deny          | **allow**     | **allow**     |
| user with no policies: sqs:SendMessage                                                                        | deny          | deny          | **allow**     | **allow**     |
| user with no policies: dynamodb:PutItem                                                                       | deny          | deny          | **allow**     | **allow**     |
| user with no policies: kms:Encrypt                                                                            | deny          | deny          | **allow**     | **allow**     |
| user with no policies: secretsmanager:GetSecretValue                                                          | deny          | deny          | **allow**     | **allow**     |
| user with no policies: sns:Publish                                                                            | deny          | deny          | **allow**     | **allow**     |
| user with no policies: events:PutEvents                                                                       | deny          | deny          | **allow**     | **allow**     |
| user with no policies: iam:CreateUser                                                                         | deny          | deny          | **allow**     | **allow**     |
| identity policies: admin user: s3:PutObject (baseline)                                                        | allow         | allow         | allow         | allow         |
| identity policies: Allow * plus explicit Deny s3:PutObject                                                    | deny          | deny          | **allow**     | **allow**     |
| identity policies: Allow * but permissions boundary allows only reads: s3:PutObject                           | deny          | **allow**     | **allow**     | **allow**     |
| identity policies: Allow PutObject only with SSE-KMS: put without SSE                                         | deny          | deny          | **allow**     | **allow**     |
| identity policies: Allow PutObject only with SSE-KMS: put with SSE-KMS                                        | allow         | allow         | allow         | allow         |
| resource policies: bucket policy denies this admin user: s3:PutObject                                         | deny          | deny          | **allow**     | deny          |
| resource policies: bucket policy denies everyone over HTTPS: emulator's own key PutObject                     | deny          | deny          | **allow**     | deny          |
| resource policies: KMS key policy denies this admin user: kms:Encrypt                                         | deny          | deny          | **allow**     | **allow**     |
| resource policies: secret resource policy denies this admin user: GetSecretValue                              | deny          | deny          | **allow**     | **allow**     |
| resource policies: no identity policy, bucket policy allows this user: s3:PutObject                           | allow         | allow         | allow         | allow         |
| identity policies: PutObject allowed on bucket A only: put to bucket A                                        | allow         | allow         | allow         | allow         |
| identity policies: PutObject allowed on bucket A only: put to bucket B                                        | deny          | deny          | **allow**     | **allow**     |
| identity policies: Allow NotAction s3:*: sqs:SendMessage                                                      | allow         | allow         | allow         | allow         |
| identity policies: Allow NotAction s3:*: s3:PutObject                                                         | deny          | deny          | **allow**     | **allow**     |
| user with no policies: s3:ListBucket (ListObjectsV2)                                                          | deny          | deny          | **allow**     | **allow**     |
| user with no policies: s3:GetObject                                                                           | deny          | deny          | **allow**     | **allow**     |
| roles and sessions: admin user assumes a role that trusts only lambda.amazonaws.com                           | deny          | deny          | **allow**     | **allow**     |
| roles and sessions: no-policy user assumes a role that trusts the account (needs sts:AssumeRole itself)       | deny          | **allow**     | **allow**     | **allow**     |
| roles and sessions: no-policy user: assume the account-trusted admin role, then s3:PutObject + iam:CreateUser | deny          | **allow**     | **allow**     | **allow**     |
| roles and sessions: admin role assumed with a GetObject-only session policy: s3:PutObject                     | deny          | **allow**     | **allow**     | **allow**     |
| service-to-service: EventBridge rule -> SQS queue with no queue policy                                        | not delivered | not delivered | **delivered** | **delivered** |
| service-to-service: SNS topic -> SQS queue with no queue policy                                               | not delivered | not delivered | **delivered** | **delivered** |

On v1.0.322, the "never denies its own key" sentence is out of date. A bucket policy that denies `s3:PutObject` to everyone over HTTPS stopped the emulator's own key. A KMS key policy deny, a secret resource policy deny and a bucket policy deny all stopped an admin user. Explicit denies, resource scoping, `NotAction` and condition keys such as `s3:x-amz-server-side-encryption` all worked. EventBridge and SNS did not deliver to a queue without a queue policy, which is what AWS does.

The 5 misses come from 4 causes, and they have one thing in common. Each is a control that **narrows** access, and the emulator skipped it and let the request through:

1. **Permissions boundaries.** A user with `Allow *` and a read-only boundary could still `PutObject`.
2. **Session policies.** An admin role assumed with a `GetObject`-only session policy could still `PutObject`.
3. **The caller's own `sts:AssumeRole` permission.** A role that trusts the account (`arn:aws:iam::000000000000:root`) means "any principal in this account that IAM allows to assume it." Our user had no policies at all, so AWS refuses. The emulator returned credentials, and with them the user wrote to S3 and created a new IAM user.
4. **`ListBuckets` with no policy** returned the bucket list.

The repo's `issues/things-that-do-not-work/` folder has open files about session-policy scoping and permissions boundaries, so the agents know about at least some of this. We did not match each of our 4 causes to one issue.

One fix to our own harness changed the comparison numbers. Moto refuses a bucket-policy deny with a bare `403: Forbidden` where AWS returns `AccessDenied`, and our first classifier counted that as an error, not a refusal. We now count every HTTP 403 as a refusal, which adds those two cases to Moto's total (8 of 32). The saved results still show the bare `403` code. The fix did not change the AWS Emulator or Floci results.

### Why this matters for your tests

Boundaries and session policies are the controls teams use for least privilege: a CI role that may create roles only inside a boundary, a broker that hands out narrowed credentials, a platform team that delegates IAM. Locally, both directions go wrong. A job whose boundary blocks a write it needs passes against the emulator and fails on AWS. A test that asserts "the boundary stops this write" fails against the emulator even when the boundary on AWS is correct.

What to do about it:

- **Create the real roles in the emulator.** Do not run everything with the emulator's admin key. Create the roles and policies you deploy, and run each component with its own role. That is how the emulator caught our two missing permissions.
- **Keep negative permission tests for real AWS.** Run a small set against a sandbox account in CI, with short-lived credentials. Boundaries, session policies and role trust belong there.
- **Check policies without calling the emulator.** IAM Access Analyzer policy validation and custom policy checks catch many mistakes before anything runs.
- **Treat a local `AccessDenied` as a bug, and a local success as unproven.** The emulator's denies matched AWS in every case we tried. Its allows did not.

## Three more ways a green local run can lie

### The JavaScript SDK sent SQS calls to real AWS

Our JS SDK v3 smoke test passed for S3 and DynamoDB. SQS failed with `InvalidClientTokenId: The security token included in the request is invalid.` The emulator would not say that about its own key. The SDK printed the reason:

```text
QueueUrl=https://sqs.us-east-1.amazonaws.com/000000000000/js-demo differs from SQSClient resolved
endpoint=https://127.0.0.1:9297/, using QueueUrl host as endpoint.
Set [endpoint=string] or [useQueueUrlAsEndpoint=false] on the SQSClient.
```

The emulator returns queue URLs in the AWS format. `@aws-sdk/client-sqs` 3.1167.0 uses the queue URL's host by default, so the request went to `sqs.us-east-1.amazonaws.com`, and AWS rejected the emulator's key. To prove it, we pointed that host name at `0.0.0.0` in `/etc/hosts`. The error changed to `connect ECONNREFUSED 0.0.0.0:443`.

```javascript
// Keep SQS calls on the emulator
const sqs = new SQSClient({ useQueueUrlAsEndpoint: false });
```

With that option, the same test passed. The SDK guide lists host names that SDKs change (host prefixes, S3, S3 Control) but not this case. Our machine had no real credentials, so AWS rejected the emulator's key and nothing else happened. But environment variables take precedence over the emulator's credentials file. In a CI job with real `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` set, the same test would have sent a request to AWS signed with real keys. The guide's advice to unset real credentials in the shell that runs your tests is not optional.

### Terraform: provider 6.73.0 could not read back an S3 bucket

We applied a small stack with 25 resources: a versioned bucket with a lifecycle rule, queues with a DLQ, a DynamoDB table with a stream, a GSI and TTL, SNS, KMS, Secrets Manager, SSM, IAM roles, a Lambda function with an SQS event source, an EventBridge rule and a Step Functions state machine.

|                     | AWS provider 6.73.0                                                               | AWS provider 5.100.0                                   |
| ------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `terraform apply`   | failed, 23 entries in state                                                       | passed, 26 entries in state                            |
| Error               | `S3 Control: ListTagsForResource ... lookup 000000000000.127.0.0.1: no such host` | none                                                   |
| Second `plan`       | failed on the same S3 call                                                        | 1 change: DynamoDB `on_demand_throughput` (-1 to null) |
| `terraform destroy` | failed on the same S3 call                                                        | passed in 39.3 s                                       |

In our test, provider 6.73.0 read bucket tags through S3 Control, and S3 Control puts the account ID in the host name. The SDK guide says S3 Control requests cannot reach the emulator. We tried a hosts-file entry for `000000000000.127.0.0.1`, but `getent` did not resolve it. When we forced the address with `curl --resolve`, the TLS handshake failed (curl exit code 35) even with certificate checks off. In this test, provider 5.100.0 worked where 6.73.0 failed, with one plan diff left. Until that changes, stacks with S3 buckets need an older provider or a separate test for the bucket.

Apply took about 85 s with both providers. The three SQS resources took 25 s each. In our load test the emulator answered SQS batch sends in a median 13.08 ms, so slow SQS responses do not explain those 25 s. We did not trace what the provider waits for.

### Caps that AWS does not have

Our first memory test tried to put 1,000 objects of 100 KiB in one bucket and 10,000 messages in one queue. Both stopped early, so we wrote a probe that fills one bucket and one queue until the emulator refuses. The bucket took 654 objects and the queue took 1,000 messages:

```text
ValidationException: storing "obj-00654" would leave the bucket "cap-probe" holding 67131605 bytes of
objects, past the 67108864 bytes this emulator keeps per bucket

OverLimit: This emulator holds at most 1000 messages per queue; queue cap-probe cannot take 1 more.
Delete messages from it first.
```

That is 64 MiB per bucket and 1,000 messages per queue. Real S3 buckets and SQS queues have no such limits on stored data or backlog. The errors are clear, and the source has more caps of the same kind, with messages such as "this emulator holds at most {} files per repository tree" and "this emulator holds tables for at most {}". A test that uploads a large fixture or builds a queue backlog has to stay under them.

With 58.6 MiB in S3, 20,000 DynamoDB items and 900 queued messages, anonymous memory grew from 172.5 MiB to 277.2 MiB. Deleting everything and waiting 15 s did not give memory back (278.8 MiB). Per the docs, restart the emulator between suites, which also gives you clean state.

```chart
{
  "type": "line",
  "title": "AWS Emulator memory while a test suite fills it",
  "unit": " MiB",
  "caption": "v1.0.322, one fresh process, 4 vCPU / 8 GB droplet. Source: results/loaded-memory.json in the companion repo.",
  "x": ["idle", "+58.6 MiB in S3", "+20,000 DynamoDB items", "+900 SQS messages", "all deleted, +15 s"],
  "series": [
    { "name": "RSS", "data": [281.7, 367.2, 411.5, 415.4, 418.9], "color": "#94a3b8" },
    { "name": "Anonymous memory", "data": [172.5, 236.6, 276.4, 277.2, 278.8], "color": "#f59e0b" }
  ]
}
```

## How it compares to Moto and Floci

LocalStack was the usual choice for this. Since March 2026, `localstack/localstack` is a single image that needs an auth token, and the free plan is meant for non-commercial use ([LocalStack's announcement](https://blog.localstack.cloud/the-road-ahead-for-localstack/)). We did not test it, because that needs an account. Moto (Apache 2.0) and Floci (MIT) run with no account, so we ran the same two suites against both, **in their default configurations**. Both have opt-in authorization checks that we did not turn on, so their permission rows show the defaults, not their best case. Start times are not measured the same way: AWS Emulator is timed to its health check, Moto to its first HTTP response, and Floci from `docker run`.

|                                    | AWS Emulator 1.0.322                   | Floci 2.4.0                             | Moto 5.2.5 (server mode)         |
| ---------------------------------- | -------------------------------------- | --------------------------------------- | -------------------------------- |
| License                            | CC0 (`vendor/` is Apache 2.0)          | MIT                                     | Apache 2.0                       |
| Account or token needed            | no                                     | no                                      | no                               |
| Install                            | 163.0 MiB `.deb`, 925.7 MiB binary     | 90.2 MiB image (`docker image inspect`) | Python package                   |
| Start to first response            | median 383.5 ms (10 runs)              | 992 ms including `docker run` (1 run)   | 1,174 ms (1 run)                 |
| Idle memory                        | 172.5 MiB anonymous, about 282 MiB RSS | 25.4 MiB (`docker stats`)               | 51.1 MiB RSS                     |
| Workflow checks passed             | 40 of 40                               | 38 of 40                                | 32 of 40 (1 miss is our harness) |
| Permission cases matching AWS docs | 27 of 32                               | 6 of 32                                 | 8 of 32                          |

```chart
{
  "type": "bar",
  "title": "Share of checks that matched AWS, default configurations",
  "unit": "%",
  "caption": "Workflow checks: 40 per target; one of Moto's misses is a networking problem in our harness. Permission cases: 32 per target, expected results from AWS documentation, not run on real AWS. Source: results/*-scenarios.json and results/*-iam-gap.json in the companion repo.",
  "rows": [
    { "label": "AWS Emulator, workflows", "value": 100, "series": "Workflow checks" },
    { "label": "Floci, workflows", "value": 95, "series": "Workflow checks" },
    { "label": "Moto, workflows", "value": 80, "series": "Workflow checks" },
    { "label": "AWS Emulator, permissions", "value": 84.4, "series": "Permission cases" },
    { "label": "Moto, permissions", "value": 25, "series": "Permission cases" },
    { "label": "Floci, permissions", "value": 18.8, "series": "Permission cases" }
  ],
  "series": [
    { "name": "Workflow checks", "color": "#f59e0b" },
    { "name": "Permission cases", "color": "#0080ff" }
  ]
}
```

Some notes so the table is fair:

- Moto's Lambda-to-S3 check failed because of our setup: Moto listened on `127.0.0.1`, and its Lambda container could not reach `host.docker.internal:5000`. We count it as a fail, but it is a network problem in our harness, not proof that Moto cannot do it.
- Moto's other misses: an expired presigned URL still worked, a presigned PUT stored an empty body, `StartMessageMoveTask` returned HTTP 500, a handler exception came back as `Handled` instead of `Unhandled`, a disabled KMS key still encrypted, and both Step Functions executions were still `RUNNING` after 30 s.
- Floci's misses: an expired presigned URL still worked, and the EventBridge rule with a numeric pattern delivered nothing.
- In the permission matrix, both alternatives allowed every request in their default modes, with one exception: Moto refused both bucket-policy denies.
- On size and memory, the others are much smaller. Floci's image is 90.2 MiB and used 25.4 MiB idle. Moto used 51.1 MiB idle. AWS Emulator is a 925.7 MiB binary.

On these suites, AWS Emulator matched AWS more often than either alternative, and by a wide margin on permissions.

## What the repo shows about "built by agents"

We cloned [aws/aws-emulator](https://github.com/aws/aws-emulator) and the [evaluation suite](https://github.com/aws/aws-emulator-evaluation-suite) and counted.

```diagram
{
  "type": "loop",
  "nodes": [
    { "label": "Fidelity tests", "sub": "29,676 boto3 checks", "variant": "soft" },
    { "label": "IssueFinderAgent", "sub": "16,664 commits", "variant": "soft" },
    { "label": "issues/ folder", "sub": "6,544 open, 12,708 fixed", "variant": "solid" },
    { "label": "IssueFixerAgent", "sub": "12,981 commits", "variant": "soft" },
    { "label": "Release", "sub": "with scores.json", "variant": "accent" }
  ],
  "loopTop": "every change passes a merge gate (not visible in the repo)",
  "loopBack": "failing fidelity tests become new issues",
  "goal": "Each release publishes its own pass rate: 56.5% for v1.0.322"
}
```

- **Every commit is by an agent identity.** 29,684 commits: IssueFinderAgent 16,664, IssueFixerAgent 12,981, Scaffolder 29, TraceIdMigration 6, ReleaseManagerAgent 4. No commit carries a person's name. The launch post says: "Our team hasn't written or reviewed any of the code."
- **The public history is three weeks long.** It starts on 2026-10-21 with a commit called "Initial emulator scaffold", and 3,734 commits landed that first day. All of it falls between 2026-10-21 and 2026-11-10.
- **It is big.** 436 service crates, 437 Smithy model files, 40,130 operation files, 14,099 test files, and 16,142,920 lines of Rust outside `vendor/`. The EC2 crate alone is 709,186 lines.
- **The work is issue-driven, in the open.** Commits are "file issues" and "Fix issue" with `Producer:` trailers, and each issue is a Markdown file with a severity, the failing fidelity test and the commit it was found against. 6,544 are open and 12,708 are fixed.
- **The merge gate cannot be audited from the repo.** There are no CI workflows in `.github/`, and commits carry no review trailers. The adversarial security review may well happen, but you cannot see it here.
- **The fidelity tests are public, their history is not.** The evaluation suite has 29,676 tests in `manifest.jsonl`, covering 1,206 service directories (859 of them cross-service), in a repository with 2 commits.
- **AWS publishes its own score, and it is honest.** The `scores.json.gz` asset on the v1.0.322 release has 42,937 scored checks: 24,243 pass, 18,614 fail, 80 skipped. That is 56.5%.

```chart
{
  "type": "bar",
  "title": "AWS's own fidelity pass rate for v1.0.322, by service",
  "unit": "%",
  "caption": "From scores.json.gz on the v1.0.322 release (42,937 scored checks, 56.5% overall). Our own 40 workflow checks passed 100% on these services. Source: results/scores-summary.json.",
  "rows": [
    { "label": "EventBridge", "value": 71.4 },
    { "label": "KMS", "value": 71.3 },
    { "label": "SNS", "value": 69.3 },
    { "label": "DynamoDB", "value": 68.1 },
    { "label": "Secrets Manager", "value": 68.0 },
    { "label": "SQS", "value": 67.8 },
    { "label": "S3", "value": 62.7 },
    { "label": "IAM", "value": 58.0 },
    { "label": "Lambda", "value": 51.9 },
    { "label": "STS", "value": 47.8 }
  ]
}
```

Those numbers do not contradict our 40 of 40. The evaluation suite is written to find gaps, and the issue-finder agents keep adding tests where the emulator fails. Our suite tests the common paths that a typical app uses. Both are true: the common paths work, and the edges are still moving. The releases page listed 12 releases between 2026-11-07 and 2026-11-11, so pin a version in CI.

## What we could not conclude

- **We did not run the permission cases on real AWS.** The expected results come from AWS documentation. We are confident about each of them, but "AWS documents X" is not the same as "we saw AWS do X."
- **One machine, one version.** Everything ran on v1.0.322 on one 4 vCPU droplet. With 12 releases in 5 days, some of these results may already be different.
- **Default configurations only** for Moto and Floci. Both can do more permission checking if you turn it on.
- **Python zip functions only** for the Lambda sandbox. Container images and other runtimes may behave differently.
- **We did not verify the "200+ services" claim** one by one. We counted 436 service crates and 437 model files, and we exercised 11 services.
- **We could not observe the merge gate** or the security agents. We can only say that their output is not in the public repo.

## Using it safely

If you adopt it for local tests or CI, this is the checklist we would use:

1. Start it with `--telemetry off` if your policy needs that, and pin the version.
2. Unset `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` and `AWS_PROFILE` in the same script that runs the tests, and set `AWS_EC2_METADATA_DISABLED=true`.
3. In the JS SDK, create SQS clients with `useQueueUrlAsEndpoint: false`.
4. Test your Terraform provider version first. In our run, 6.73.0 failed on S3 buckets and 5.100.0 worked; otherwise keep buckets out of the emulated stack.
5. Keep fixtures under 64 MiB per bucket and backlogs under 1,000 messages per queue.
6. Create real roles with real policies and run each component as its role. Let the emulator's `AccessDenied` catch missing permissions.
7. Test boundaries, session policies and role trust on a real sandbox account.
8. Restart the emulator between suites for clean state and memory.

If you still run LocalStack from an old pinned image, our [local Terraform experiments post](/posts/experimenting-locally-with-terraform) shows the older setup.

## Summary

Of the three local emulators we ran, AWS Emulator matched AWS most often. Our everyday workflows passed, the error codes matched, and it found real permission bugs in our test code. The part to watch is not the warning AWS gives: it checks more policies than its docs say. The risk is the controls it skips. A green run against the emulator proves that your code works with the permissions it has. It does not prove that your permission limits hold. Keep that small set of tests on real AWS, and use the emulator for everything else.
