---
title: 'How to Display Sensitive Data Output Variables in Terraform'
excerpt: 'Learn how to handle and display sensitive data output variables in Terraform safely and effectively.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-10-29'
publishedAt: '2024-10-29T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Security
  - Output Variables
  - DevOps
---

## TLDR

Terraform allows you to mark output variables as sensitive to prevent them from being displayed in the CLI. However, you can override this behavior if you need to display sensitive data for debugging or other purposes. Use caution when handling sensitive outputs.

---

Terraform's `sensitive` attribute for output variables is a useful feature for hiding sensitive data, such as passwords or API keys, from being displayed in the CLI. However, there are scenarios where you might need to display this data, such as debugging or testing. This guide will show you how to handle sensitive output variables safely.

### Why Mark Outputs as Sensitive?

- **Security**: Prevents sensitive data from being exposed in logs or shared environments.
- **Compliance**: Helps meet security and compliance requirements by limiting data exposure.

### Defining Sensitive Output Variables

You can mark an output variable as sensitive by setting the `sensitive` attribute to `true`.

```hcl
output "db_password" {
  value     = aws_secretsmanager_secret.example.secret_string
  sensitive = true
}
```

When you run `terraform apply`, the sensitive output will not be displayed in the CLI.

### Displaying Sensitive Outputs

If you need to display sensitive outputs, you can use the `terraform output` command with the `-json` flag and process the output programmatically.

#### Example: Displaying Sensitive Outputs

```bash
terraform output -json | jq '.db_password.value'
```

This command extracts the sensitive value using `jq`, a lightweight JSON processor.

### Overriding Sensitivity

You can temporarily override the sensitivity of an output variable by removing the `sensitive` attribute. However, this should only be done in non-production environments.

#### Example: Removing Sensitivity

```hcl
output "db_password" {
  value = aws_secretsmanager_secret.example.secret_string
}
```

### Best Practices

- **Limit Exposure**: Only display sensitive outputs when absolutely necessary.
- **Use Secure Tools**: Use tools like `jq` to process sensitive outputs securely.
- **Audit Logs**: Monitor logs to ensure sensitive data is not exposed.
- **Environment-Specific Configurations**: Use different configurations for production and non-production environments.

By understanding how to handle sensitive output variables in Terraform, you can balance the need for visibility with the importance of security.
