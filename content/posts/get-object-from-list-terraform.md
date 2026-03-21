---
title: 'How to Get an Object from a List of Objects in Terraform?'
excerpt: 'Learn how to retrieve a specific object from a list of objects in Terraform using filters and expressions.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-02-25'
publishedAt: '2025-02-25T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Lists
  - Objects
  - Tutorials
---

## TLDR

To retrieve an object from a list of objects in Terraform, use the `for` expression with filtering or the `lookup` function for direct access. This approach allows you to dynamically extract specific objects based on conditions.

---

Terraform provides powerful tools for working with lists and objects. Retrieving a specific object from a list of objects is a common task in dynamic configurations. This guide explains how to achieve this with practical examples.

## Step 1: Define a List of Objects

Start by defining a list of objects in your Terraform configuration.

### Example

```hcl
variable "instances" {
  default = [
    {
      name = "app-server"
      type = "t2.micro"
    },
    {
      name = "db-server"
      type = "t2.large"
    }
  ]
}
```

### Explanation

- `variable "instances"`: Declares a variable containing a list of objects.
- Each object has `name` and `type` attributes.

## Step 2: Use a `for` Expression with Filtering

Use a `for` expression to filter the list and retrieve the desired object.

### Example

```hcl
locals {
  db_server = [for instance in var.instances : instance if instance.name == "db-server"]
}
```

### Explanation

- `for instance in var.instances`: Iterates over the list of objects.
- `if instance.name == "db-server"`: Filters objects based on the `name` attribute.
- `db_server`: Contains the filtered object(s).

## Step 3: Extract a Single Object

If you expect only one object, use the `tolist` function to extract it.

### Example

```hcl
locals {
  db_server = tolist([for instance in var.instances : instance if instance.name == "db-server"])[0]
}
```

### Explanation

- `tolist`: Converts the filtered result to a list.
- `[0]`: Extracts the first (and only) object from the list.

## Step 4: Use the `lookup` Function

For direct access, use the `lookup` function if the list is indexed by a key.

### Example

```hcl
locals {
  instance_map = { for instance in var.instances : instance.name => instance }
  db_server    = lookup(local.instance_map, "db-server")
}
```

### Explanation

- `{ for instance in var.instances : instance.name => instance }`: Converts the list to a map indexed by `name`.
- `lookup`: Retrieves the object with the key `db-server`.

## Best Practices

- **Validate Inputs**: Ensure the list contains the expected objects.
- **Handle Missing Keys**: Use the `default` argument in `lookup` to handle missing keys.
- **Document Attributes**: Clearly document the attributes of objects in the list.

By following these steps, you can efficiently retrieve objects from a list in Terraform, enabling dynamic and flexible configurations.
