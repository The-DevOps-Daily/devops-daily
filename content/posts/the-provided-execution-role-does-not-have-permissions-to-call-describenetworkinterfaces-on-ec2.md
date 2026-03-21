---
title: 'The provided execution role does not have permissions to call DescribeNetworkInterfaces on EC2'
excerpt: "Learn how to resolve the 'execution role does not have permissions to call DescribeNetworkInterfaces' error in AWS EC2."
category:
  name: 'AWS'
  slug: 'aws'
date: '2024-07-15'
publishedAt: '2024-07-15T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - AWS
  - EC2
  - IAM
  - Permissions
  - Troubleshooting
---

When working with AWS EC2, you might encounter the error: `The provided execution role does not have permissions to call DescribeNetworkInterfaces`. This error typically occurs when the IAM role associated with your EC2 instance or Lambda function lacks the necessary permissions to perform the `DescribeNetworkInterfaces` API call.

## Why This Happens

AWS uses IAM roles to grant permissions to services. If the role attached to your EC2 instance or Lambda function does not include the required permissions, AWS will block the operation, resulting in this error.

## How to Fix It

To resolve this issue, you need to update the IAM role's policy to include the `ec2:DescribeNetworkInterfaces` action. Here's how you can do it:

### Step 1: Identify the Role

Determine which IAM role is associated with your EC2 instance or Lambda function. You can find this information in the AWS Management Console:

- For EC2: Navigate to the **Instances** section, select your instance, and check the **IAM Role** under the **Description** tab.
- For Lambda: Go to the **Configuration** tab of your function and look for the **Execution Role**.

### Step 2: Update the IAM Policy

Edit the IAM policy attached to the role to include the necessary permissions. Below is an example policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ec2:DescribeNetworkInterfaces",
      "Resource": "*"
    }
  ]
}
```

This policy grants permission to call `DescribeNetworkInterfaces` on all resources. If you want to restrict access, replace `"Resource": "*"` with specific ARNs.

### Step 3: Attach the Policy

1. Open the IAM Console.
2. Navigate to **Roles** and select the role identified in Step 1.
3. Click **Add permissions** and choose **Attach policies**.
4. Select the policy you just created or updated and click **Attach policy**.

### Step 4: Test the Changes

After updating the policy, test your EC2 instance or Lambda function to ensure the error is resolved. If the issue persists, double-check the policy and ensure it is attached to the correct role.

## Best Practices

- Use the principle of least privilege: Grant only the permissions necessary for your application to function.
- Regularly review and audit IAM policies to ensure they meet your security requirements.
- Use AWS CloudTrail to monitor API calls and identify missing permissions.

By following these steps, you can resolve the `DescribeNetworkInterfaces` permission error and ensure your AWS resources function as expected.
