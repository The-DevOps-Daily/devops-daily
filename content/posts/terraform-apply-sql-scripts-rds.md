---
title: 'How to Apply SQL Scripts to RDS and Read Secrets With Terraform'
excerpt: 'Terraform has no SQL resource. Compare the three ways to run SQL against RDS (local-exec, a database provider, a migration tool), and learn how to read secrets from AWS Secrets Manager without storing them in the Terraform state.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-01-05'
publishedAt: '2025-01-05T13:30:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - AWS
  - RDS
  - Database
  - Secrets Management
  - DevOps
---

Terraform creates the RDS instance, but a new database is empty. It still needs schemas, users and grants, and somebody has to decide where the passwords for all of that come from. Terraform has no resource that runs SQL, and the obvious ways to read a password from Secrets Manager put it in the state file in plain text.

This post compares the three practical ways to run SQL against RDS from a Terraform workflow, and then shows how to read a secret from AWS Secrets Manager, including the newer ephemeral resources that keep the value out of the state.

## TLDR

| Question                                    | Short answer                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Can Terraform run a SQL script?             | Not by itself. Use `terraform_data` with `local-exec`, a database provider, or a migration tool           |
| Which option should I use?                  | A database provider for users and grants, a migration tool for schema changes                             |
| How do I read a secret?                     | `data "aws_secretsmanager_secret_version"`, plus `jsondecode()` for JSON secrets                          |
| Is the secret stored in state?              | Yes with the data source. No with the `ephemeral` resource of the same name (Terraform 1.10 and later)    |
| How do I give RDS a password without state? | `manage_master_user_password = true`, or `password_wo` from an ephemeral value (Terraform 1.11 and later) |

## Prerequisites

- Terraform 1.4 or later for `terraform_data`, 1.10 or later for ephemeral resources, and 1.11 or later for write-only arguments.
- The AWS provider 6.x.
- For `local-exec`, the `psql` or `mysql` client on the machine that runs Terraform, and a network path from that machine to the database.

## How Do I Apply SQL Scripts to an RDS Database With Terraform?

Terraform manages infrastructure through provider APIs, and the RDS API cannot run SQL. You have three options:

| Option                             | Good for                                 | Watch out for                                                   |
| ---------------------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| `terraform_data` with `local-exec` | A one-time bootstrap script              | Needs network access to the database from the Terraform machine |
| A database provider                | Databases, roles and grants as resources | The provider needs the database to exist before it can plan     |
| A migration tool after the apply   | Schema changes over time                 | One more step in the pipeline                                   |

### Option 1: Run psql From terraform_data

`terraform_data` (built into Terraform 1.4 and later, and the replacement for `null_resource`) runs a provisioner after the database exists. `triggers_replace` makes it run again when the script changes:

```hcl
variable "db_admin_password" {
  type      = string
  sensitive = true
  ephemeral = true # Terraform 1.10+: never written to the plan or state
}

resource "aws_db_instance" "main" {
  identifier          = "app-db"
  engine              = "postgres"
  engine_version      = "17" # a major version; RDS picks the default minor version
  instance_class      = "db.t4g.micro"
  allocated_storage   = 20
  db_name             = "app"
  username            = "dbadmin"
  password_wo         = var.db_admin_password
  password_wo_version = 1
  publicly_accessible = false
  skip_final_snapshot = true
  # db_subnet_group_name and vpc_security_group_ids omitted here
}

resource "terraform_data" "db_bootstrap" {
  triggers_replace = filesha256("${path.module}/sql/bootstrap.sql")

  provisioner "local-exec" {
    command = "psql -v ON_ERROR_STOP=1 -f ${path.module}/sql/bootstrap.sql"

    environment = {
      PGHOST     = aws_db_instance.main.address
      PGPORT     = aws_db_instance.main.port
      PGDATABASE = aws_db_instance.main.db_name
      PGUSER     = aws_db_instance.main.username
      PGPASSWORD = var.db_admin_password
      PGSSLMODE  = "require"
    }
  }
}
```

Details that matter:

- **Pass the password in `environment`, not in `command`.** A password in the command line shows up in the process list. Because the variable is sensitive, Terraform also hides the provisioner output: `(output suppressed due to sensitive, ephemeral value in config)`. Set the value from your CI secret store as `TF_VAR_db_admin_password`.
- **Use `address` and `port` separately.** `endpoint` is `address:port`, which is not a valid host name.
- **`ON_ERROR_STOP=1` makes psql exit with an error** when a statement fails. Without it, psql runs the rest of the file and reports success, and Terraform marks the bootstrap as done.
- **No sleep is needed.** `aws_db_instance` finishes only when the instance is available.
- **The script must be safe to run twice,** because a change to the file runs it again:

```sql
-- sql/bootstrap.sql
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.users (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_readonly') THEN
    CREATE ROLE app_readonly NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA app TO app_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO app_readonly;
```

Keep passwords out of SQL files in Git. The script creates a role without a login, and the login users get their passwords from a separate step.

The provisioner runs on the machine that runs Terraform. For a private database, that is a CI runner inside the VPC, or a port forward through a bastion or AWS Systems Manager. If neither is possible, run the SQL from a Lambda function inside the VPC and call it with the `aws_lambda_invocation` resource, which invokes the function during the apply and again when its `triggers` change.

### Option 2: Manage Roles and Grants With a Database Provider

For users, databases and grants, a provider is better than a script: each object is a resource in the state, Terraform shows changes in the plan, and removing a block removes the object. For PostgreSQL, the common one is `cyrilgdn/postgresql`:

```hcl
terraform {
  required_providers {
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "~> 1.25"
    }
  }
}

provider "postgresql" {
  host      = var.db_host
  port      = 5432
  database  = "app"
  username  = "dbadmin"
  password  = var.db_admin_password
  sslmode   = "require"
  superuser = false # the RDS master user is not a PostgreSQL superuser
}

resource "postgresql_role" "app" {
  name     = "app_user"
  login    = true
  password = var.app_db_password
}

resource "postgresql_grant" "app_tables" {
  database    = "app"
  role        = postgresql_role.app.name
  schema      = "app"
  object_type = "table"
  privileges  = ["SELECT", "INSERT", "UPDATE", "DELETE"]
}
```

Two things to know:

- **Put this in a separate root folder**, applied after the folder that creates the RDS instance. A provider that is configured with attributes of a resource from the same configuration cannot connect at plan time when that resource does not exist yet, and Terraform's documentation advises against that pattern.
- **Set `superuser = false` on RDS.** The provider otherwise uses commands that only a real superuser may run.

`password` on `postgresql_role` is stored in the state. Mark the variable `sensitive`, and restrict who can read the state. For MySQL and MariaDB, the `petoju/mysql` provider has the same kind of resources (`mysql_user`, `mysql_grant`, `mysql_database`).

### Option 3: Run Migrations After the Apply

Schema changes that happen with application releases belong to a migration tool such as Flyway, Liquibase, sqitch or the migrations of your framework. Those tools record which migrations ran, so each one runs once. Let Terraform output the connection details and let the pipeline run the tool after `terraform apply`:

```bash
terraform apply -input=false tfplan

export FLYWAY_URL="jdbc:postgresql://$(terraform output -raw db_address):5432/app?sslmode=require"
export FLYWAY_USER=dbadmin
export FLYWAY_PASSWORD="$DB_ADMIN_PASSWORD"   # from the CI secret store
flyway -locations=filesystem:./migrations migrate
```

This keeps Terraform about infrastructure, and a failed migration does not leave a half-applied Terraform run.

Avoid two older patterns: `time_sleep` before the SQL step (the RDS resource already waits for the instance), and `publicly_accessible = true` "only for the setup", which is easy to forget and exposes the database.

## How Do I Retrieve a Secret From AWS Secrets Manager in Terraform?

Use the `aws_secretsmanager_secret_version` data source and read `secret_string`. For a JSON secret, decode it with `jsondecode()`:

```hcl
data "aws_secretsmanager_secret_version" "api" {
  secret_id = "prod/app/api" # the name or the ARN
}

locals {
  api = jsondecode(data.aws_secretsmanager_secret_version.api.secret_string)
}

resource "aws_ssm_parameter" "api_user" {
  name  = "/app/api-user"
  type  = "String"
  value = local.api.username
}
```

You do not need the separate `aws_secretsmanager_secret` data source just to find the ID: `secret_id` accepts the name. Do not put the decoded secret in an `output` without `sensitive = true`, and do not print it in a `local-exec` command.

The catch: Terraform stores everything a data source returns in the state file. Anyone who can read the state can read the secret, `sensitive` only hides it in plan output.

### Keep the Secret Out of the State With an Ephemeral Resource

Terraform 1.10 added ephemeral resources. The AWS provider has an ephemeral version of `aws_secretsmanager_secret_version`. Terraform reads it during the run and never writes it to the plan or the state:

```hcl
ephemeral "aws_secretsmanager_secret_version" "db_admin" {
  secret_id = "prod/app/db-admin"
}

resource "aws_db_instance" "main" {
  # ...
  username            = "dbadmin"
  password_wo         = jsondecode(ephemeral.aws_secretsmanager_secret_version.db_admin.secret_string).password
  password_wo_version = 1 # increase this number to send a new password
}
```

`password_wo` is a write-only argument (Terraform 1.11 and later). Terraform sends it to AWS and does not keep it. Because Terraform cannot compare a value it does not store, it sends the password again only when `password_wo_version` changes.

You can use an ephemeral value in write-only arguments, in provider configuration (for example the `password` of the PostgreSQL provider above), in provisioner and connection blocks, and in ephemeral variables and outputs. Terraform rejects it in a normal resource argument, because that would put it in the state:

```text
Error: Invalid use of ephemeral value

Ephemeral values are not valid for "input", because it is not a write-only
attribute and must be persisted to state.
```

To create a password without storing it, the `random` provider has an ephemeral `random_password` (version 3.7 and later). It makes a new value on every run, so write it to the database and to a secret in the same run, and bump both version numbers together:

```hcl
ephemeral "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db" {
  name = "prod/app/db-admin"
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id                = aws_secretsmanager_secret.db.id
  secret_string_wo         = ephemeral.random_password.db.result
  secret_string_wo_version = 1
}

resource "aws_db_instance" "main" {
  # ...
  password_wo         = ephemeral.random_password.db.result
  password_wo_version = 1
}
```

When you change both versions to 2, the same apply sends one new password to RDS and to Secrets Manager. If only one of them changes, the two copies no longer match.

### Let RDS Manage the Master Password

The simplest option for the master user is to not handle the password at all:

```hcl
resource "aws_db_instance" "main" {
  # ...
  username                    = "dbadmin"
  manage_master_user_password = true
}

output "db_master_secret_arn" {
  value = aws_db_instance.main.master_user_secret[0].secret_arn
}
```

RDS creates the password, stores it in Secrets Manager and rotates it (every 7 days by default). Applications and migration tools read it from the secret ARN at runtime. You cannot combine this with `password` or `password_wo`.

The [keep secrets out of state section](/guides/introduction-to-terraform/10-best-practices-and-production-patterns#h2-keep-secrets-out-of-state) of our Terraform guide compares these options in more detail.

## Related Resources

- [RDS databases](/guides/introduction-to-aws/06-rds-databases) in our AWS guide, including [how to create an application user](/guides/introduction-to-aws/06-rds-databases#h2-create-an-application-user).
- [HashiCorp Vault Secrets Management Checklist](/checklists/hashicorp-vault-secrets-management) if you keep secrets in Vault instead.
- [Ephemeral variables](/guides/introduction-to-terraform/06-variables-and-outputs#h2-ephemeral-variables) in our Terraform guide.
- [How to Set Up Fargate Execution Roles and IAM Policies](/posts/terraform-fargate-task-definition-execution-role) for passing secrets to containers.
- [SQL terminal simulator](/games/sql-terminal-simulator) to practice the SQL side.
