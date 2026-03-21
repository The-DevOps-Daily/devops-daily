---
title: 'Terraform + DynamoDB: All Attributes Must Be Indexed'
excerpt: "Learn how to handle the 'all attributes must be indexed' requirement in DynamoDB when using Terraform."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-10-20'
publishedAt: '2024-10-20T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - DynamoDB
  - AWS
  - DevOps
---

## TLDR

When using DynamoDB with Terraform, you must index all attributes that you plan to query. This can be done by defining Global Secondary Indexes (GSIs) or Local Secondary Indexes (LSIs) in your Terraform configuration.

---

DynamoDB is a fully managed NoSQL database service provided by AWS. One of its key features is the ability to query data efficiently using indexes. However, DynamoDB requires that all attributes you want to query must be indexed. This guide will show you how to handle this requirement using Terraform.

### Why Index Attributes?

- **Query Efficiency**: Indexes allow DynamoDB to retrieve data quickly without scanning the entire table.
- **Cost Optimization**: Queries on indexed attributes are more cost-effective than full table scans.

### Defining Indexes in Terraform

To ensure that all attributes you plan to query in DynamoDB are indexed, you can use Global Secondary Indexes (GSIs) and Local Secondary Indexes (LSIs) in your Terraform configuration. This allows you to efficiently query data based on different attributes.

#### Step 1: Define the DynamoDB Table

Start by creating a DynamoDB table with a primary key.

```hcl
resource "aws_dynamodb_table" "example" {
  name           = "example-table"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "category"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }
}
```

#### Step 2: Add a Global Secondary Index (GSI)

A GSI allows you to query attributes other than the primary key. Define a GSI for the `category` attribute.

```hcl
resource "aws_dynamodb_table" "example" {
  # ...existing table definition...

  global_secondary_index {
    name            = "category-index"
    hash_key        = "category"
    projection_type = "ALL"
  }
}
```

#### Step 3: Add a Local Secondary Index (LSI)

An LSI allows you to query attributes in combination with the primary key. Define an LSI for the `timestamp` attribute.

```hcl
resource "aws_dynamodb_table" "example" {
  # ...existing table definition...

  local_secondary_index {
    name            = "timestamp-index"
    range_key       = "timestamp"
    projection_type = "ALL"
  }
}
```

### Best Practices

- **Plan Indexes Carefully**: Indexes cannot be modified after table creation. Plan your schema and queries in advance.
- **Use GSIs for Flexibility**: GSIs are more flexible than LSIs but come with additional costs.
- **Monitor Costs**: Indexes increase storage and query costs. Use AWS Cost Explorer to monitor expenses.
- **Test Queries**: Use the AWS CLI or SDK to test your queries and ensure they are efficient.

By indexing all attributes you plan to query, you can make the most of DynamoDB's capabilities while keeping your Terraform configurations clean and efficient.
