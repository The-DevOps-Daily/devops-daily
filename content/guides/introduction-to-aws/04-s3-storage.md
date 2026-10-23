---
title: 'S3: Cloud Object Storage'
description: 'Learn Amazon S3: buckets and objects, the secure defaults for new buckets, storage classes, lifecycle rules, versioning and presigned URLs.'
order: 4
---

**TLDR**: S3 stores files ("objects") in buckets and keeps several copies across Availability Zones. New buckets are private: Block Public Access is on, ACLs are disabled and every object is encrypted with SSE-S3. Keep it that way. Give applications access through IAM roles, share single files with presigned URLs, and serve public content through CloudFront. Pick a storage class by how often you read the data, and let lifecycle rules move or delete old objects.

Amazon Simple Storage Service (S3) is object storage behind an HTTPS API. You do not manage disks or file systems: you put an object under a key, and you get it back with the same key. It is where most AWS applications keep user uploads, backups, logs, build artifacts and static website files.

In this part, the photo app gets a bucket for uploaded photos, and the web server from Part 3 gets permission to use it.

## Prerequisites

- The CLI profile from [Part 2](/guides/introduction-to-aws/02-iam-security) and the `photo-app-web` role and instance from [Part 3](/guides/introduction-to-aws/03-ec2-servers).
- A few files to upload, for example two or three photos.

## Buckets, Objects and Keys

- A **bucket** is a container in one Region. Its name is part of every object URL.
- An **object** is the data (up to 50 TB since December 2025) plus metadata such as its content type.
- A **key** is the object's full name, for example `uploads/2026/10/cat.jpg`.

S3 has no real folders. The console shows `uploads/` as a folder because keys share that **prefix**, and you can list or set permissions by prefix. A "folder" is gone the moment no key uses its prefix.

After a successful write, every read and list sees the new data (S3 has strong read-after-write consistency). S3 Standard stores data across at least three Availability Zones and is designed for 99.999999999% durability. Durability is not protection from your own mistakes, though: a `delete` is final unless you turn on versioning.

## Create a Bucket

Bucket names are lowercase letters, numbers, hyphens and dots, 3 to 63 characters long. You have two kinds of name:

- **Global namespace** (the classic kind): the name must be unique across all AWS accounts, so `photos` is long gone. Something like `photo-app-uploads-7f3k2` usually works.
- **Account regional namespace** (since March 2026): the name ends with your account ID, the Region and `-an`, for example `photo-app-111122223333-us-east-1-an`. Only your account can create buckets with that suffix, so nobody can take the name first. The console adds the suffix for you.

This guide uses `photo-app-uploads-example`; replace it with your own name in every command.

In the S3 console, choose **Create bucket**, keep **General purpose**, enter the name, and leave the security settings at their defaults. From the CLI:

```bash
# Global namespace
aws s3 mb s3://photo-app-uploads-example --region us-east-1

# Or the account regional namespace
aws s3api create-bucket \
  --bucket photo-app-111122223333-us-east-1-an \
  --bucket-namespace account-regional \
  --region us-east-1
```

Outside `us-east-1`, `s3api create-bucket` also needs `--create-bucket-configuration LocationConstraint=<region>`. The high-level `aws s3 mb` adds it for you.

## The Secure Defaults

Older tutorials tell you to "make the bucket public" or set ACLs. Since 2023, AWS sets new buckets up the other way round:

| Setting                                   | Default for new buckets                                                  | Since        |
| ----------------------------------------- | ------------------------------------------------------------------------ | ------------ |
| **Block Public Access**                   | All four settings on: no public bucket policies or ACLs                  | April 2023   |
| **Object Ownership**                      | Bucket owner enforced: ACLs disabled, the bucket owner owns every object | April 2023   |
| **Default encryption**                    | SSE-S3 (AES-256) on every new object, at no extra cost                   | January 2023 |
| **SSE-C** (encryption with keys you send) | Blocked unless you enable it                                             | April 2026   |

With ACLs disabled, all access is decided by IAM policies and the bucket policy. That is simpler to reason about and to audit. For data that needs its own key and an audit trail of key use, switch default encryption to **SSE-KMS** and enable an **S3 Bucket Key** to keep KMS request costs down.

You can read the settings back (example output for a new bucket):

```text
$ aws s3api get-public-access-block --bucket photo-app-uploads-example
{
    "PublicAccessBlockConfiguration": {
        "BlockPublicAcls": true,
        "IgnorePublicAcls": true,
        "BlockPublicPolicy": true,
        "RestrictPublicBuckets": true
    }
}
$ aws s3api get-bucket-ownership-controls --bucket photo-app-uploads-example
{
    "OwnershipControls": {
        "Rules": [
            {
                "ObjectOwnership": "BucketOwnerEnforced"
            }
        ]
    }
}
```

Turn on **Block Public Access** at the account level too (**S3**, **Block Public Access settings for this account**), so no bucket in the account can become public by accident. Turn it off for a bucket only when you deliberately host public files from it, and even then CloudFront is usually the better option (see below).

## Upload and Download

```bash
# Upload one file; S3 guesses the Content-Type from the extension
aws s3 cp cat.jpg s3://photo-app-uploads-example/uploads/cat.jpg

# Upload a folder, skipping files that did not change
aws s3 sync ./photos s3://photo-app-uploads-example/uploads/

# List, download, delete
aws s3 ls s3://photo-app-uploads-example/uploads/
aws s3 cp s3://photo-app-uploads-example/uploads/cat.jpg ./cat-copy.jpg
aws s3 rm s3://photo-app-uploads-example/uploads/cat.jpg
```

`aws s3 ls` prints the date, size in bytes and key of each object (example output):

```text
2026-10-23 10:14:02     184213 cat.jpg
2026-10-23 10:14:03     201877 dog.jpg
```

The CLI and SDKs switch to **multipart upload** for large files automatically: the file goes up in parts, in parallel, and a failed part is retried on its own.

## Give the Web Server Access

The server should not hold keys. Add a permissions policy to the `photo-app-web` role from Part 3 instead:

1. In **IAM**, open **Roles**, `photo-app-web`, **Add permissions**, **Create inline policy**.
2. Paste the policy from [Part 2](/guides/introduction-to-aws/02-iam-security#h2-read-a-policy), which allows listing `uploads/` and reading and writing objects under it, with your bucket name.
3. On the instance (Session Manager or Instance Connect), test it:

```bash
echo "hello from the web server" > hello.txt
aws s3 cp hello.txt s3://photo-app-uploads-example/uploads/hello.txt
aws s3 ls s3://photo-app-uploads-example/uploads/
```

The CLI on the instance finds the role's temporary credentials through IMDSv2. Try `aws s3 ls s3://photo-app-uploads-example/` (outside `uploads/`): it fails with `AccessDenied`, because the policy only allows the prefix.

## Share Files Without Making Them Public

A **presigned URL** is a link that carries a signature and an expiry time. Anyone with the link can download that one object until it expires, while the bucket stays private. The app's backend creates presigned URLs to show a user their own photos, or to let a browser upload directly to S3 without sending the file through your server.

Presigning happens locally: the CLI or SDK signs the URL with your credentials and makes no request to AWS. The run below signs with AWS's documented example key (`AKIAIOSFODNN7EXAMPLE`), so the URL has the real format but opens nothing:

```terminal
{
  "title": "aws s3 presign (signed with the AWS example key)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "aws s3 presign s3://photo-app-uploads-example/uploads/cat.jpg --expires-in 900",
      "output": "https://photo-app-uploads-example.s3.us-east-1.amazonaws.com/uploads/cat.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20261023%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261023T154537Z&X-Amz-Expires=900&X-Amz-SignedHeaders=host&X-Amz-Signature=1d5156846f4a4e9231ae9d50d2f383944df4f4a8e2634450d2f548b96093cd33"
    }
  ]
}
```

Read the query string: the signing algorithm, the access key and scope (date, Region, service), the time it was signed, `X-Amz-Expires=900` (15 minutes) and the signature. A URL signed with temporary credentials (a role or an `aws login` session) stops working when those credentials expire, even if `X-Amz-Expires` is longer.

## Serve Public Files with CloudFront

For images and assets that everyone may see, put **Amazon CloudFront** (AWS's CDN) in front of the private bucket:

- an **Origin Access Control** (OAC) lets only your CloudFront distribution read the bucket, so Block Public Access stays on;
- CloudFront serves HTTPS on your own domain and caches files close to your users;
- data transfer from S3 to CloudFront is free, and CloudFront has its own free monthly allowance.

S3's built-in **static website hosting** still exists, but its endpoint is HTTP only and needs a public bucket. Use CloudFront for anything real.

## Storage Classes

Every object has a storage class. You pay less per GB for data you read rarely, and more when you do read it:

| Class                         | Use it for                                      | Retrieval                             | Minimum storage duration |
| ----------------------------- | ----------------------------------------------- | ------------------------------------- | ------------------------ |
| S3 Standard                   | Active data: uploads, assets                    | Milliseconds                          | None                     |
| S3 Intelligent-Tiering        | Unknown or changing access patterns             | Milliseconds (archive tiers optional) | None                     |
| S3 Standard-IA                | Read less than about once a month, needed fast  | Milliseconds, per-GB retrieval fee    | 30 days                  |
| S3 One Zone-IA                | Re-creatable copies; stored in one AZ only      | Milliseconds, per-GB retrieval fee    | 30 days                  |
| S3 Glacier Instant Retrieval  | Archives read about once a quarter              | Milliseconds, higher retrieval fee    | 90 days                  |
| S3 Glacier Flexible Retrieval | Backups you rarely restore                      | Minutes to 12 hours                   | 90 days                  |
| S3 Glacier Deep Archive       | Compliance archives kept for years              | Within 12 hours (48 for bulk)         | 180 days                 |
| S3 Express One Zone           | Very low latency, in one AZ (directory buckets) | Single-digit milliseconds             | None                     |

If you are unsure, **Intelligent-Tiering** moves each object between tiers by its own access pattern for a small monitoring fee per object (objects under 128 KB are not monitored and stay in the frequent tier). Deleting or moving an object before its minimum duration is billed as if it stayed the full period.

## Lifecycle Rules

Lifecycle rules change the storage class of objects or delete them by age, so nobody has to remember. This configuration moves uploads to Standard-IA after 30 days and to Glacier Flexible Retrieval after a year, deletes temporary files after 7 days, and cleans up failed multipart uploads:

```json
{
  "Rules": [
    {
      "ID": "age-out-uploads",
      "Status": "Enabled",
      "Filter": { "Prefix": "uploads/" },
      "Transitions": [
        { "Days": 30, "StorageClass": "STANDARD_IA" },
        { "Days": 365, "StorageClass": "GLACIER" }
      ]
    },
    {
      "ID": "delete-tmp",
      "Status": "Enabled",
      "Filter": { "Prefix": "tmp/" },
      "Expiration": { "Days": 7 }
    },
    {
      "ID": "abort-incomplete-uploads",
      "Status": "Enabled",
      "Filter": {},
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
    }
  ]
}
```

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket photo-app-uploads-example \
  --lifecycle-configuration file://lifecycle.json
```

`GLACIER` is the API name of S3 Glacier Flexible Retrieval. Incomplete multipart uploads are invisible in `aws s3 ls` but still billed, so the last rule belongs in almost every bucket.

## Versioning

With **versioning** enabled, an overwrite keeps the old version and a delete only adds a **delete marker**, so you can restore either. Turn it on for buckets that hold anything you cannot re-create:

```bash
aws s3api put-bucket-versioning \
  --bucket photo-app-uploads-example \
  --versioning-configuration Status=Enabled
```

Old versions are billed like current ones. Add a lifecycle rule with `NoncurrentVersionExpiration` (for example after 30 days) so they do not pile up. For backups that must not be deleted even by an administrator, look at **S3 Object Lock**; for a copy in another Region, at **replication**.

## What It Costs

S3 charges for:

- **storage**, per GB-month, by storage class;
- **requests**, per 1,000 (`PUT`, `COPY`, `POST` and `LIST` cost more than `GET`);
- **retrieval**, per GB, for the IA and Glacier classes;
- **data transfer out** to the internet. The first 100 GB a month, aggregated across all AWS services, is free (per the [S3 pricing page](https://aws.amazon.com/s3/pricing/), checked 23 October 2026). Transfer into S3, and from S3 to CloudFront or to EC2 in the same Region, is free.

Use the [S3 pricing page](https://aws.amazon.com/s3/pricing/) or the [AWS Pricing Calculator](https://calculator.aws/) for the current rates in your Region. A learning bucket with a few hundred MB costs cents a month. Servers in a private subnet that reach S3 through a NAT gateway pay NAT data processing on every GB; Part 5 shows the free gateway endpoint that avoids it.

## Common Mistakes

- **Turning off Block Public Access to share one file.** Use a presigned URL or CloudFront.
- **Wrong ARN in a policy.** `s3:ListBucket` applies to `arn:aws:s3:::bucket`; object actions apply to `arn:aws:s3:::bucket/*`.
- **Dots in bucket names.** They break HTTPS with virtual-hosted URLs (the wildcard certificate does not match). Use hyphens.
- **Millions of tiny objects in Glacier classes.** Each archived object carries extra metadata overhead and per-request transition costs. Bundle small files first.
- **Forgetting old versions and incomplete uploads.** Both are billed and invisible in a plain `ls`.
- **A bucket in a different Region from the servers.** Cross-Region transfer costs money and adds latency.

## Clean Up

A bucket must be empty before you can delete it. `aws s3 rb s3://photo-app-uploads-example --force` deletes the current objects and then the bucket. If versioning is on, empty the bucket from the console (**Empty**), which also removes old versions and delete markers, then delete it.

## Summary

- Objects live in buckets under keys; prefixes only look like folders.
- New buckets are private, ACL-free and encrypted by default. Keep Block Public Access on.
- Applications use IAM roles; people get presigned URLs; public content goes through CloudFront with OAC.
- Storage classes trade storage price for retrieval price and speed; lifecycle rules apply them automatically.
- Versioning protects against overwrites and deletes, and needs a rule to expire old versions.

Next: [VPC: Build Your Private Network](/guides/introduction-to-aws/05-vpc-networking), where you move the servers off the public internet.

## Keep Learning

- [Free Egress Has Fine Print: S3 vs R2, B2, Wasabi and More](/posts/object-storage-free-egress-fine-print)
- [How to Create a Folder in an AWS S3 Bucket Using Terraform](/posts/create-folder-in-s3-bucket)
- [How to Fix Common Terraform S3 Backend Configuration Errors](/posts/terraform-s3-backend-configuration-errors)
- [AWS Cloud Services Quiz](/quizzes/aws-quiz)
