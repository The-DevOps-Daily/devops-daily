---
title: 'How to Load Input Data from a File in Terraform'
excerpt: 'Learn how to load input data from a file in Terraform using the `file` function and external data sources.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-01-10'
publishedAt: '2025-01-10T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Input Data
  - Configuration Management
  - DevOps
---

## TLDR

To load input data from a file in Terraform, use the `file` function for plain text files or the `jsondecode` function for JSON files. For more complex scenarios, use the `external` data source.

---

Terraform allows you to load input data from external files, making it easier to manage configurations and reuse data. This guide will show you how to load input data from files in different formats.

### Why Load Input Data from Files?

- **Reusability**: Share data across multiple configurations.
- **Separation of Concerns**: Keep data separate from Terraform code.
- **Dynamic Configurations**: Load data that changes frequently without modifying the code.

### Loading Plain Text Files

Use the `file` function to load the contents of a plain text file.

#### Example: Loading a Plain Text File

This example demonstrates how to read a configuration file and output its contents.

```hcl
variable "config_file" {
  default = "path/to/config.txt"
}

output "file_contents" {
  value = file(var.config_file)
}
```

In this example, the `file` function reads the contents of `config.txt` and outputs it.

### Loading JSON Files

Use the `file` and `jsondecode` functions to load and parse JSON files.

#### Example: Loading a JSON File

```hcl
variable "config_file" {
  default = "path/to/config.json"
}

output "json_data" {
  value = jsondecode(file(var.config_file))
}
```

If `config.json` contains:

```json
{
  "region": "us-east-1",
  "instance_type": "t2.micro"
}
```

The output will be a map:

```hcl
{
  "region" = "us-east-1"
  "instance_type" = "t2.micro"
}
```

### Using the `external` Data Source

For more complex scenarios, use the `external` data source to load data from a script or external system.

#### Example: Using the `external` Data Source

Here's how to use the `external` data source to run a script that returns data in JSON format.

```hcl
data "external" "example" {
  program = ["python3", "path/to/script.py"]
}

output "external_data" {
  value = data.external.example.result
}
```

The script should return data in JSON format:

```json
{
  "key": "value"
}
```

### Best Practices

- **Validate Data**: Use `validation` blocks to enforce constraints on input data.
- **Secure Sensitive Data**: Avoid storing sensitive data in plain text files.
- **Document File Formats**: Clearly document the expected format of input files.

By loading input data from files, you can create more dynamic and reusable Terraform configurations, simplifying your infrastructure management.
