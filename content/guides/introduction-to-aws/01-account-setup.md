---
title: 'Getting Started with Your AWS Account'
description: 'Create an AWS account, choose the free or paid plan, secure the root user with MFA, set a budget alert, pick a Region and install the AWS CLI v2.'
order: 1
---

**TLDR**: Sign up at aws.amazon.com, choose the free or paid plan, and add MFA to the root user straight away. Create a budget with an email alert before you build anything. Pick one Region and stay in it. Install AWS CLI v2 and check it with `aws --version`. In [Part 2](/guides/introduction-to-aws/02-iam-security) you create the user you work with every day, so you can stop using the root user.

The first hour in a new AWS account decides a lot: whether a leaked password can take over everything, and whether a forgotten server shows up as a surprise on your card. This part sets up the account safely and gets you comfortable in the console and on the command line.

## Prerequisites

- An email address that you check and that you will keep. It becomes the root user's login.
- A phone number for verification and a credit or debit card. On the free plan, the card is not charged.
- A computer where you can install software, for the AWS CLI.

## Create Your Account

1. Go to [aws.amazon.com](https://aws.amazon.com/) and choose **Create an AWS account**.
2. Enter the root user email address and an **account name**. Use something that tells you what the account is for, such as `alex-learning`. You can change it later.
3. Verify the email address, then set a long, unique root user password in your password manager.
4. Choose your **account plan**:
   - **Free plan**: no charges for up to six months, paid for with USD 100 in sign-up credits (plus up to USD 100 more for completing activities). Some services are not available, and the account closes at the end unless you upgrade.
   - **Paid plan**: every service, the same credits, then normal prices.

   The free plan is the safer choice for this guide: you cannot be charged, and you can upgrade at any time from the Billing console.

5. Enter your contact details, the card and the phone verification code.
6. Choose **Basic support**. It is free and covers account and billing questions, which is all you need while learning. The paid plans (Business Support+ and above) add technical support cases with AWS engineers.

When the sign-up finishes, sign in to the [AWS Management Console](https://console.aws.amazon.com/) as the root user.

:::note
AWS is rolling out a new sign-up flow, [Sign up for AWS (new)](https://docs.aws.amazon.com/accounts/latest/reference/sign-in-new.html), to a limited number of customers. It signs you in with Google, GitHub, Apple or Amazon, organizes resources in **projects**, and adds people as team members instead of IAM users. This guide follows the standard sign-up. If you landed in the new experience, the console steps for services are the same, but follow the AWS documentation for users and access instead of the IAM user steps in Part 2.
:::

## Secure the Root User First

The root user can do anything, including closing the account and changing the payment method, and you cannot attach IAM policies to it to limit what it does. Protect it before you do anything else:

1. Open the account menu (your account name, top right) and choose **Security credentials**.
2. Under **Multi-factor authentication (MFA)**, choose **Assign MFA device**. A passkey or a hardware security key is the strongest option; an authenticator app also works. AWS requires MFA on root users, so you are prompted to register a device anyway. Do it now rather than later.
3. Check that there are no **access keys** for the root user. Never create them.
4. Store the password and your MFA recovery details somewhere safe, not only on your phone.

After [Part 2](/guides/introduction-to-aws/02-iam-security), you sign in as root only for the handful of [tasks that require it](https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-tasks.html), such as changing the account's contact email or closing the account.

## Set a Budget Before You Build

Create a budget now, while the account is empty:

1. Open **Billing and Cost Management** and choose **Budgets**, then **Create budget**.
2. Choose **Use a template (simplified)** and pick **Zero spend budget** (alerts you as soon as anything costs money) or **Monthly cost budget** (alerts you at a dollar amount you choose, for example USD 10).
3. Enter the email addresses that should get the alerts and create the budget.

On the free plan, your credits pay for usage, so the **Credits** and **Free Tier** pages in the Billing console are where you watch how much is left. On the paid plan, the budget is your early warning. [Part 10](/guides/introduction-to-aws/10-cost-management) adds forecasts, Cost Explorer and anomaly detection.

:::warning
Budgets alert you; they do not stop resources. A budget email that arrives at 2 a.m. still needs you to delete what is running.
:::

## Choose a Region

A **Region** is a geographic location with its own copy of most AWS services. Resources you create in one Region do not appear in another, so pick one and stick with it while you learn.

| Region code      | Name                      | Location      |
| ---------------- | ------------------------- | ------------- |
| `us-east-1`      | US East (N. Virginia)     | United States |
| `us-east-2`      | US East (Ohio)            | United States |
| `us-west-2`      | US West (Oregon)          | United States |
| `eu-west-1`      | Europe (Ireland)          | Ireland       |
| `eu-central-1`   | Europe (Frankfurt)        | Germany       |
| `ap-southeast-1` | Asia Pacific (Singapore)  | Singapore     |
| `ap-south-1`     | Asia Pacific (Mumbai)     | India         |
| `sa-east-1`      | South America (São Paulo) | Brazil        |

For real projects, choose by:

- **Latency**: close to your users.
- **Data rules**: some data must stay in a country or region.
- **Service availability**: new services and instance types often launch in a few large Regions first.
- **Price**: the same resource costs different amounts in different Regions.

This guide uses **`us-east-1`** in its examples. If you live far from it, use a closer Region and change the Region in the commands. Regions that AWS launched after March 2019 are **opt-in**: you enable them under **Account**, **AWS Regions** before you can use them.

## Find Your Way Around the Console

- **Search** (top bar, or Alt+S on Windows and Linux, Option+S on macOS) finds services, features and documentation. It is faster than the services menu.
- The **Region selector** (top right) shows where you are working. When a resource seems to have vanished, check this first.
- **Favorites** (the star next to a service) pins services to the top bar.
- The **Console Home** page shows recently visited services, cost and usage, and the health of AWS services in your account.
- **CloudShell** (the terminal icon in the top bar) opens a browser shell with the AWS CLI already signed in as your console user. It is free and handy when you are not on your own computer.

## Install the AWS CLI

The AWS CLI lets you script everything you can click. Install **version 2**; version 1 is only kept for old scripts.

```tabs
{
  "title": "Install AWS CLI v2",
  "tabs": [
    {
      "label": "Linux (x86_64)",
      "lang": "bash",
      "code": "curl \"https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip\" -o awscliv2.zip\nunzip awscliv2.zip\nsudo ./aws/install\n\n# Later, to update in place:\n# sudo ./aws/install --update"
    },
    {
      "label": "Linux (ARM)",
      "lang": "bash",
      "code": "curl \"https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip\" -o awscliv2.zip\nunzip awscliv2.zip\nsudo ./aws/install\n\n# Without sudo, install into your home directory:\n# ./aws/install -i ~/.local/aws-cli -b ~/.local/bin"
    },
    {
      "label": "macOS",
      "lang": "bash",
      "code": "# Official installer package\ncurl \"https://awscli.amazonaws.com/AWSCLIV2.pkg\" -o AWSCLIV2.pkg\nsudo installer -pkg AWSCLIV2.pkg -target /\n\n# Or with Homebrew\nbrew install awscli"
    },
    {
      "label": "Windows",
      "lang": "powershell",
      "code": "# Official MSI installer\nmsiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi\n\n# Or with winget\nwinget install -e --id Amazon.AWSCLI"
    }
  ]
}
```

Open a new terminal and check the version. The run below is on a Linux ARM machine with no AWS credentials yet, which is also what you see right after installing:

```terminal
{
  "title": "fresh install, no credentials",
  "prompt": "$",
  "steps": [
    {
      "comment": "the CLI is installed",
      "cmd": "aws --version",
      "output": "aws-cli/2.38.5 Python/3.14.8 Linux/6.12.62+rpt-rpi-v8 exe/aarch64.debian.12"
    },
    {
      "comment": "no profile, keys or Region yet",
      "cmd": "aws configure list",
      "output": "NAME       : VALUE                    : TYPE             : LOCATION\nprofile    : <not set>                : None             : None\naccess_key : <not set>                : None             : None\nsecret_key : <not set>                : None             : None\nregion     : <not set>                : None             : None"
    },
    {
      "comment": "any call that needs credentials fails",
      "cmd": "aws sts get-caller-identity",
      "output": "aws: [ERROR]: An error occurred (NoCredentials): Unable to locate credentials. You can configure credentials by running \"aws login\"."
    }
  ]
}
```

`aws sts get-caller-identity` is the "who am I?" command. It works for any signed-in identity, needs no permissions, and is the first thing to run when something behaves strangely. The CLI even suggests `aws login`: that is how you connect it to your account in [Part 2](/guides/introduction-to-aws/02-iam-security), without creating access keys.

:::note
Many older tutorials start with `aws configure` and an access key ID and secret. Skip that. Long-lived access keys are the credentials that leak most often, and you do not need them for anything in this guide.
:::

Two settings save typing later:

```bash
# Default Region and output format for the default profile
aws configure set region us-east-1
aws configure set output json
```

## Name and Tag Everything

Pick a naming pattern now and use it everywhere, for example `<project>-<environment>-<role>`: `photo-app-dev-web`, `photo-app-dev-db`.

**Tags** are key and value labels on resources. They help you find things, and once you activate them as **cost allocation tags** in the Billing console, Cost Explorer can split your bill by them. Start with three:

| Tag key       | Example value | Why                                       |
| ------------- | ------------- | ----------------------------------------- |
| `Project`     | `photo-app`   | Which application the resource belongs to |
| `Environment` | `dev`         | Separates experiments from anything real  |
| `Owner`       | `alex`        | Who to ask before deleting it             |

## Common Mistakes

- **Working as the root user.** Create your admin user in Part 2 and stop using root.
- **No budget.** Create it before the first resource, not after the first bill.
- **Resources in several Regions.** A forgotten instance in another Region keeps running. Check the Region selector, and use **EC2 Global View** or **Resource Explorer** to see resources across Regions.
- **Creating access keys for the CLI.** Use `aws login` or IAM Identity Center instead (Part 2).
- **Using a personal email that you might lose.** The root email is how you recover the account.

## Summary

- The account plan decides whether you can be charged: the free plan cannot, the paid plan can.
- The root user gets MFA, no access keys, and almost no use.
- A budget alerts you to spending; it does not stop it.
- One Region, consistent names and three tags keep a learning account easy to clean up.
- AWS CLI v2 is installed; `aws sts get-caller-identity` tells you who you are.

Next: [IAM: Users, Roles and Policies](/guides/introduction-to-aws/02-iam-security), where you create your everyday admin user and connect the CLI.

## Keep Learning

- [Cloud Regions and Availability Zones interview questions](/interview-questions/junior/cloud-regions-availability-zones)
- [How to Set Up Cloud Cost Allocation Tags Across AWS, GCP, and Azure](/posts/cloud-cost-allocation-tags-aws-gcp-azure)
- [AWS Essentials flashcards](/flashcards/aws-essentials)
