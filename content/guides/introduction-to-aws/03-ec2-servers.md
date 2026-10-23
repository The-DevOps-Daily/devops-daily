---
title: 'EC2: Launch Your First Virtual Server'
description: 'Launch an Amazon EC2 instance step by step: pick an instance type (Graviton or x86) and AMI, use user data, connect without SSH keys, and require IMDSv2.'
order: 3
---

**TLDR**: An EC2 instance is a virtual server you rent by the second. Pick a free-tier eligible type such as `t4g.micro` (Graviton, ARM) or `t3.micro` (x86), the Amazon Linux 2023 AMI, a security group that allows HTTP, and an IAM role for Session Manager. Put your setup commands in **user data**. Connect with Session Manager or EC2 Instance Connect instead of opening SSH to the world. Every public IPv4 address costs money by the hour, and a stopped instance still pays for its disk.

Amazon Elastic Compute Cloud (EC2) gives you virtual machines in AWS data centers. You choose how much CPU and memory, which operating system, and which network it sits in, and you can have it running in under a minute. When you no longer need it, you terminate it and stop paying for it.

In this part you launch the first piece of the photo-sharing app: a web server that answers on port 80.

## Prerequisites

- Your admin user and a working CLI profile from [Part 2](/guides/introduction-to-aws/02-iam-security).
- The Region you chose in [Part 1](/guides/introduction-to-aws/01-account-setup). The examples use `us-east-1`.
- A budget alert, because an instance can cost money once your credits or the free tier run out.

## Why Virtual Servers

With your own hardware, you guess capacity months ahead, pay for it while it idles, and fix it when a disk dies. With EC2:

- you start small and change the instance type later with a stop and start;
- you pay per second for Linux instances (with a one-minute minimum) while they run;
- AWS replaces failed hardware, and with the right setup (Part 7) a new instance replaces a failed one automatically;
- you can create ten identical servers as easily as one.

## Choose an Instance Type

An instance type sets the CPU, memory, network and storage options. The name tells you what you get:

```text
  m   8   g   .  large
  |   |   |       |
  |   |   |       +-- size: nano, micro, small, medium, large, xlarge, 2xlarge ...
  |   |   +---------- processor and options: g = AWS Graviton (ARM), i = Intel, a = AMD,
  |   |               d = local NVMe disk, n = more network bandwidth
  |   +-------------- generation: higher is newer
  +------------------ family: t = burstable, m = general purpose, c = compute, r = memory
```

| Family                | Good for                                          | Current examples (October 2026)                    |
| --------------------- | ------------------------------------------------- | -------------------------------------------------- |
| `t` burstable         | Small websites, dev servers, anything mostly idle | `t4g` (Graviton2), `t3`, `t8i` (Intel)             |
| `m` general purpose   | Application servers with steady load              | `m8g` (Graviton4), `m9g` (Graviton5), `m8i`, `m8a` |
| `c` compute optimized | CPU-heavy work: builds, encoding, APIs            | `c8g`, `c9g`, `c8i`                                |
| `r` memory optimized  | Databases, caches, in-memory analytics            | `r8g`, `r9g`, `r8i`                                |

**Graviton** instances use AWS's own ARM64 processors and usually give the best price for performance. Most Linux software runs on them, but you need an ARM64 (`arm64`) AMI and ARM64 builds of your binaries and container images. The x86 families (`i` for Intel, `a` for AMD) run anything built for `x86_64`.

**Burstable** (`t`) instances earn CPU credits while idle and spend them when busy. `t3` and `t4g` launch in **unlimited** mode by default: if the CPU stays high for long periods, you pay for the extra credits. For steady CPU load, an `m` or `c` instance is cheaper.

### What is free

For accounts created on or after 15 July 2025, the instance types marked **Free tier eligible** are `t3.micro`, `t3.small`, `t4g.micro`, `t4g.small`, `c7i-flex.large` and `m7i-flex.large`, and since September 2026 also `t8i.micro` and `t8i.small`. Accounts created before that date had 750 hours a month of `t2.micro` or `t3.micro` for their first 12 months, an offer that has now ended for all of them. The list changes, so ask the API for your account:

```bash
aws ec2 describe-instance-types \
  --filters Name=free-tier-eligible,Values=true \
  --query "InstanceTypes[*].InstanceType" --output text
```

This guide uses **`t4g.micro`**. If you need x86, use `t3.micro` and the `x86_64` AMI instead.

## Choose an AMI

An **Amazon Machine Image (AMI)** is the disk image the instance boots from: the operating system plus anything preinstalled.

- **Amazon Linux 2023** (AL2023) is AWS's own distribution, tuned for EC2, with the SSM Agent and EC2 Instance Connect preinstalled and IMDSv2 required by default. It uses `dnf`. This guide uses it.
- **Ubuntu Server LTS**, **Debian**, **Red Hat Enterprise Linux** and **Windows Server** are available as official AMIs too.

:::warning
**Amazon Linux 2 reached end of support on 30 June 2026.** It no longer gets security updates. Tutorials that use `yum` and Amazon Linux 2 are out of date: use AL2023 and `dnf`.
:::

AMI IDs differ per Region and change with every release. Instead of copying an ID, refer to the public SSM parameter that always points to the latest AL2023 image:

```text
/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64
/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64
```

## Create a Role for Session Manager

**Session Manager** (part of AWS Systems Manager) opens a shell on the instance through the SSM Agent, over HTTPS. You need no SSH key and no open inbound port, and every session can be logged.

The instance needs permission to talk to Systems Manager:

1. In **IAM**, choose **Roles**, then **Create role**.
2. Trusted entity: **AWS service**, use case **EC2**.
3. Attach the AWS managed policy `AmazonSSMManagedInstanceCore`.
4. Name it `photo-app-web` and create it. The console also creates an **instance profile** with the same name.

In [Part 4](/guides/introduction-to-aws/04-s3-storage) you add S3 permissions to this same role.

## Launch the Instance

In the EC2 console, choose **Launch instance** and fill in the form:

1. **Name and tags**: `photo-app-dev-web`. Add the `Project`, `Environment` and `Owner` tags from Part 1.
2. **Application and OS Images**: **Amazon Linux 2023**, architecture **64-bit (Arm)**.
3. **Instance type**: `t4g.micro`.
4. **Key pair**: choose **Proceed without a key pair** if you will use Session Manager or EC2 Instance Connect. Create or import one only if you need plain SSH (see below).
5. **Network settings**: keep the default VPC and a public subnet with **Auto-assign public IP** enabled. Create a security group named `photo-app-web` that allows **HTTP (80) from anywhere**. Do not add SSH unless you need it, and then only from **My IP**.
6. **Configure storage**: the default 8 GiB `gp3` root volume is enough.
7. **Advanced details**: set **IAM instance profile** to `photo-app-web`, check that **Metadata version** is **V2 only (token required)**, and paste the script below into **User data**.

```bash
#!/bin/bash
# Runs once, as root, on the first boot (cloud-init).
dnf install -y httpd
systemctl enable --now httpd

# Read the instance ID from the metadata service with IMDSv2.
TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-id)

echo "<h1>Hello from photo-app on $INSTANCE_ID</h1>" > /var/www/html/index.html
```

**User data** runs only on the first boot, as root, through cloud-init. If the page does not appear, read `/var/log/cloud-init-output.log` on the instance: it shows every command's output and errors.

Choose **Launch instance**. The same launch from the CLI looks like this (the security group ID is an example):

```bash
aws ec2 run-instances \
  --image-id resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 \
  --instance-type t4g.micro \
  --security-group-ids sg-0123456789abcdef0 \
  --iam-instance-profile Name=photo-app-web \
  --metadata-options HttpTokens=required,HttpEndpoint=enabled \
  --user-data file://user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=photo-app-dev-web},{Key=Project,Value=photo-app}]'
```

`resolve:ssm:` tells EC2 to look up the current AMI ID from the SSM parameter at launch time.

## Test the Web Server

After a minute or two, the **Instance state** is **Running** and all **status checks** pass. Copy the **Public IPv4 address** and open `http://<public-ip>` in a browser, or use `curl` (example output):

```text
$ curl http://203.0.113.25
<h1>Hello from photo-app on i-0abc123def4567890</h1>
```

Your browser may try `https://` first. There is no certificate yet, so use `http://` explicitly; Part 7 adds HTTPS on the load balancer.

## Connect to the Instance

```tabs
{
  "title": "Four ways to get a shell",
  "tabs": [
    {
      "label": "Session Manager",
      "lang": "bash",
      "code": "# Console: select the instance, Connect, Session Manager tab, Connect.\n\n# CLI: needs the Session Manager plugin installed locally.\naws ssm start-session --target i-0abc123def4567890\n\n# No key pair, no inbound port 22, sessions can be logged."
    },
    {
      "label": "EC2 Instance Connect",
      "lang": "bash",
      "code": "# Console: Connect, EC2 Instance Connect tab, Connect.\n# The browser-based client needs inbound 22 from the\n# EC2 Instance Connect IP range of your Region.\n\n# CLI: pushes a temporary key (valid 60 seconds) and runs ssh.\naws ec2-instance-connect ssh --instance-id i-0abc123def4567890"
    },
    {
      "label": "SSH (macOS, Linux)",
      "lang": "bash",
      "code": "# Only if you launched with a key pair and allowed port 22 from your IP.\nchmod 400 ~/.ssh/aws-learn\nssh -i ~/.ssh/aws-learn ec2-user@203.0.113.25"
    },
    {
      "label": "SSH (Windows)",
      "lang": "powershell",
      "code": "# Windows 10 and 11 include the OpenSSH client.\nssh -i $env:USERPROFILE\\.ssh\\aws-learn ec2-user@203.0.113.25\n\n# PuTTY needs the key in .ppk format (convert it with PuTTYgen)."
    }
  ]
}
```

The default user on Amazon Linux is `ec2-user`; on Ubuntu AMIs it is `ubuntu`.

If you do want plain SSH, create the key on your own machine and import only the public half, so the private key never leaves your computer. EC2 supports ED25519 and RSA keys for Linux:

```terminal
{
  "title": "create a key pair locally",
  "prompt": "$",
  "steps": [
    {
      "cmd": "ssh-keygen -t ed25519 -f aws-learn -N '' -C 'alex@laptop'",
      "output": "Generating public/private ed25519 key pair.\nYour identification has been saved in aws-learn\nYour public key has been saved in aws-learn.pub\nThe key fingerprint is:\nSHA256:BT4msI43i28k4pTzgPtnKH+A3Bvhpml4PVhrY5vC1C0 alex@laptop\nThe key's randomart image is:\n+--[ED25519 256]--+\n|    .   .        |\n|     o . .       |\n|    . . + .      |\n|   +   o o       |\n|o.=.=.  S        |\n|+*+BEo.          |\n|+=OO+o           |\n|+=*+%.           |\n|.=oO++           |\n+----[SHA256]-----+"
    }
  ]
}
```

```bash
# Upload the public key as an EC2 key pair (example; needs your account)
aws ec2 import-key-pair --key-name aws-learn \
  --public-key-material fileb://aws-learn.pub
```

In real use, protect the private key with a passphrase (drop `-N ''`) and keep it in `~/.ssh`. If you lose it, you cannot download it again; use Session Manager to get in and add a new public key.

## The Instance Metadata Service and IMDSv2

Code on an instance can ask the **Instance Metadata Service** (IMDS) at `169.254.169.254` about itself: the instance ID, Region, network details, and the temporary credentials of its IAM role. That last part is why it matters for security.

**IMDSv2** requires a session token that the caller gets with an HTTP `PUT`. This blocks most server-side request forgery (SSRF) attacks, where an attacker tricks your web app into fetching a URL for them and reads your role's credentials. AL2023 AMIs require IMDSv2, and you can make it the default for the whole account and Region:

```bash
aws ec2 modify-instance-metadata-defaults \
  --region us-east-1 \
  --http-tokens required \
  --http-put-response-hop-limit 2
```

On the instance, a metadata request looks like this (example output):

```text
[ec2-user@ip-172-31-20-15 ~]$ TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
[ec2-user@ip-172-31-20-15 ~]$ curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/availability-zone
us-east-1a
[ec2-user@ip-172-31-20-15 ~]$ curl -s http://169.254.169.254/latest/meta-data/instance-id
[ec2-user@ip-172-31-20-15 ~]$
```

The last request has no token, so IMDS answers `401 Unauthorized` and `curl -s` prints nothing. The SDKs and the AWS CLI handle the token for you.

## Stop, Start, Terminate

```diagram
{
  "type": "flow",
  "trace": false,
  "nodes": [
    { "label": "pending", "sub": "booting", "icon": "rocket", "tone": "slate" },
    { "label": "running", "sub": "billed per second", "icon": "check", "tone": "green" },
    { "label": "stopped", "sub": "disk still billed", "icon": "server", "tone": "amber" },
    { "label": "terminated", "sub": "gone for good", "icon": "box", "tone": "red" }
  ]
}
```

- **Stop**: the instance shuts down. You stop paying for compute, but you still pay for its EBS volumes and any Elastic IP. On start, it usually moves to new hardware and gets a **new public IPv4 address**, unless it has an Elastic IP.
- **Reboot**: same hardware, same addresses.
- **Terminate**: the instance is deleted. Its root volume is deleted too by default. Turn on **termination protection** for anything you cannot lose.
- **Change type**: stop, choose **Instance settings**, **Change instance type**, start. An ARM instance can only change to another ARM type.
- **Create image**: saves the volumes as an AMI so you can launch copies. Part 7 uses a launch template instead.

## What It Costs

- **The instance**: per second while it runs. Prices differ by type and Region; check the [EC2 On-Demand pricing page](https://aws.amazon.com/ec2/pricing/on-demand/) or the [AWS Pricing Calculator](https://calculator.aws/).
- **EBS volumes**: per GB-month, whether the instance runs or not, plus snapshots.
- **Public IPv4 addresses**: since February 2024, every public IPv4 address costs money, whether it is attached to a running instance or idle. The [VPC pricing page](https://aws.amazon.com/vpc/pricing/) lists USD 0.005 per hour per address (checked 23 October 2026), about USD 3.65 for a 730-hour month. That applies to auto-assigned public IPs and to Elastic IPs alike. IPv6 addresses are free.
- **Data transfer out** to the internet, beyond the free monthly allowance.

On the free plan, credits pay for all of this. On the paid plan, these small hourly charges add up across forgotten resources: Part 10 shows how to find them.

## Elastic IP Addresses

An **Elastic IP** is a static public IPv4 address that stays yours until you release it. Use one if something must reach the instance at a fixed address and you cannot use DNS or a load balancer. It costs the same as any public IPv4 address, attached or not. In Part 7, users reach the app through a load balancer's DNS name instead, and the web servers need no public addresses at all.

## Common Mistakes

- **SSH open to `0.0.0.0/0`.** Bots scan for port 22 within minutes. Use Session Manager, or allow only your IP.
- **Wrong architecture.** An `arm64` AMI does not boot on `t3.micro`, and an `x86_64` AMI does not boot on `t4g.micro`. The launch fails with an architecture mismatch.
- **Expecting user data to run again.** It runs on the first boot only. Change it, then launch a new instance.
- **Stopping instead of terminating test instances.** A stopped instance still pays for its volumes.
- **Storing important data only on the instance.** Instances are replaceable. Keep data in S3 (Part 4) or a database (Part 6).
- **Forgetting other Regions.** Use **EC2 Global View** to list instances in every Region.

## Clean Up

If you continue to Part 4 today, keep the instance: you give it S3 access next. Otherwise, terminate it (**Instance state**, **Terminate instance**) and check that no Elastic IP or unattached volume is left behind.

## Summary

- Instance type names encode family, generation, processor and size. `t4g.micro` is a free-tier eligible Graviton instance.
- Use Amazon Linux 2023 (`dnf`); Amazon Linux 2 is end of life.
- User data configures the instance on first boot; its log is in `/var/log/cloud-init-output.log`.
- Session Manager gives you a shell with no inbound port at all; EC2 Instance Connect needs port 22 open only to AWS's address range or your own IP.
- IMDSv2 protects your role credentials; make it the account default.
- Public IPv4 addresses and stopped instances' disks cost money.

Next: [S3: Cloud Object Storage](/guides/introduction-to-aws/04-s3-storage), where the server gets somewhere durable to keep uploaded photos.

## Keep Learning

- Exercise: [Creating and Connecting to Your First Linux Server](/exercises/cloud-server-setup)
- [What Does AssumeRole: Service: ec2 Do?](/posts/assumerole-service-ec2)
- [SSH basics interview questions](/interview-questions/junior/ssh-basics)
