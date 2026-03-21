---
title: 'How to Apply SQL Scripts to RDS Databases With Terraform'
excerpt: "Learn different approaches for running SQL scripts and migrations against RDS databases during Terraform deployment, including provisioners, external tools, and dedicated migration resources."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-01-05'
publishedAt: '2025-01-05T13:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - AWS
  - RDS
  - Database
  - SQL
  - DevOps
---

Terraform creates and manages RDS instances, but it doesn't have built-in resources for running SQL scripts inside those databases. You need to use external tools or provisioners to execute SQL statements, create tables, set up users, or run migrations after the database is created.

The challenge is orchestrating the SQL execution at the right time in the Terraform lifecycle, handling credentials securely, and ensuring idempotency so scripts don't fail on repeated runs.

**TLDR:** Terraform doesn't natively run SQL scripts against databases. Use the `null_resource` with a `local-exec` provisioner to run SQL via command-line tools like `psql` or `mysql`. For better idempotency and state management, use the community `postgresql` or `mysql` Terraform providers which can create databases, users, and execute SQL. Alternatively, use database migration tools like Flyway or Liquibase triggered by Terraform, or Lambda functions that run migrations as part of deployment.

## Understanding the Problem

Terraform is great at creating infrastructure but isn't designed for application-level configuration. An RDS instance needs more than just to exist - it often needs:

- Initial database schemas
- Tables and indexes
- Database users and permissions
- Seed data or migrations
- Stored procedures and functions

While Terraform can create the RDS instance, you need additional tooling to populate it.

## Method 1: Using null_resource With local-exec

The simplest approach uses a `null_resource` with a `local-exec` provisioner to run SQL scripts:

```hcl
resource "aws_db_instance" "main" {
  identifier        = "myapp-db"
  engine            = "postgres"
  engine_version    = "15.3"
  instance_class    = "db.t3.micro"
  allocated_storage = 20

  db_name  = "appdb"
  username = "dbadmin"
  password = var.db_password

  publicly_accessible = false
  skip_final_snapshot = true
}

# Wait for database to be ready and run SQL
resource "null_resource" "db_setup" {
  depends_on = [aws_db_instance.main]

  triggers = {
    # Re-run if the SQL file changes
    sql_hash = filemd5("${path.module}/init.sql")
  }

  provisioner "local-exec" {
    command = <<-EOT
      psql "postgresql://${aws_db_instance.main.username}:${var.db_password}@${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}" \
        -f ${path.module}/init.sql
    EOT
  }
}
```

The SQL file might contain:

```sql
-- init.sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create a read-only user
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'readonly') THEN
    CREATE USER readonly WITH PASSWORD 'changeme';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE appdb TO readonly;
GRANT USAGE ON SCHEMA public TO readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
```

The `CREATE TABLE IF NOT EXISTS` and conditional user creation make the script idempotent.

## Method 2: Using the PostgreSQL Provider

The community PostgreSQL provider offers Terraform-native database management:

```hcl
terraform {
  required_providers {
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "~> 1.21"
    }
  }
}

resource "aws_db_instance" "main" {
  identifier        = "myapp-db"
  engine            = "postgres"
  engine_version    = "15.3"
  instance_class    = "db.t3.micro"
  allocated_storage = 20

  db_name  = "appdb"
  username = "dbadmin"
  password = var.db_password

  publicly_accessible = false
  skip_final_snapshot = true
}

# Configure the PostgreSQL provider
provider "postgresql" {
  host     = aws_db_instance.main.address
  port     = aws_db_instance.main.port
  username = aws_db_instance.main.username
  password = var.db_password
  database = aws_db_instance.main.db_name

  sslmode = "require"
}

# Create additional database
resource "postgresql_database" "app_reporting" {
  name = "app_reporting"
}

# Create users
resource "postgresql_role" "readonly" {
  name     = "readonly"
  login    = true
  password = var.readonly_password
}

resource "postgresql_role" "app_user" {
  name     = "app_user"
  login    = true
  password = var.app_password
}

# Grant permissions
resource "postgresql_grant" "readonly_tables" {
  database    = aws_db_instance.main.db_name
  role        = postgresql_role.readonly.name
  schema      = "public"
  object_type = "table"
  privileges  = ["SELECT"]
}

# Execute arbitrary SQL
resource "postgresql_schema" "app" {
  name = "app"
}

# For complex schema, use postgresql_database or create via script
resource "null_resource" "schema_setup" {
  depends_on = [postgresql_database.app_reporting]

  triggers = {
    schema_version = filemd5("${path.module}/schema.sql")
  }

  provisioner "local-exec" {
    command = <<-EOT
      psql "postgresql://${aws_db_instance.main.username}:${var.db_password}@${aws_db_instance.main.endpoint}/${postgresql_database.app_reporting.name}" \
        -f ${path.module}/schema.sql
    EOT
  }
}
```

This provider is more idempotent than raw SQL execution and tracks state properly.

## Method 3: Using MySQL Provider

For MySQL/MariaDB RDS instances:

```hcl
terraform {
  required_providers {
    mysql = {
      source  = "petoju/mysql"
      version = "~> 3.0"
    }
  }
}

resource "aws_db_instance" "main" {
  identifier        = "myapp-mysql"
  engine            = "mysql"
  engine_version    = "8.0"
  instance_class    = "db.t3.micro"
  allocated_storage = 20

  db_name  = "appdb"
  username = "admin"
  password = var.db_password

  publicly_accessible = false
  skip_final_snapshot = true
}

provider "mysql" {
  endpoint = aws_db_instance.main.endpoint
  username = aws_db_instance.main.username
  password = var.db_password
}

# Create database
resource "mysql_database" "app" {
  name = "application"
}

# Create users
resource "mysql_user" "app_user" {
  user               = "appuser"
  host               = "%"
  plaintext_password = var.app_password
}

# Grant privileges
resource "mysql_grant" "app_user" {
  user       = mysql_user.app_user.user
  host       = mysql_user.app_user.host
  database   = mysql_database.app.name
  privileges = ["SELECT", "INSERT", "UPDATE", "DELETE"]
}

# Run initialization SQL
resource "null_resource" "init_schema" {
  depends_on = [mysql_database.app]

  triggers = {
    schema_version = filemd5("${path.module}/init.sql")
  }

  provisioner "local-exec" {
    command = <<-EOT
      mysql -h${aws_db_instance.main.address} \
        -u${aws_db_instance.main.username} \
        -p${var.db_password} \
        ${mysql_database.app.name} < ${path.module}/init.sql
    EOT
  }
}
```

## Method 4: Using a Bastion Host

When RDS isn't publicly accessible, run SQL through a bastion:

```hcl
resource "aws_instance" "bastion" {
  ami           = var.bastion_ami
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public.id

  vpc_security_group_ids = [aws_security_group.bastion.id]

  # Install PostgreSQL client
  user_data = <<-EOF
    #!/bin/bash
    yum install -y postgresql15
  EOF

  tags = {
    Name = "bastion"
  }
}

resource "aws_db_instance" "main" {
  identifier             = "myapp-db"
  engine                 = "postgres"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  db_name                = "appdb"
  username               = "dbadmin"
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  skip_final_snapshot    = true
}

# Run SQL via bastion
resource "null_resource" "db_setup" {
  depends_on = [aws_db_instance.main, aws_instance.bastion]

  connection {
    type        = "ssh"
    host        = aws_instance.bastion.public_ip
    user        = "ec2-user"
    private_key = file(var.ssh_private_key_path)
  }

  provisioner "file" {
    source      = "${path.module}/init.sql"
    destination = "/tmp/init.sql"
  }

  provisioner "remote-exec" {
    inline = [
      "PGPASSWORD=${var.db_password} psql -h ${aws_db_instance.main.address} -U ${aws_db_instance.main.username} -d ${aws_db_instance.main.db_name} -f /tmp/init.sql"
    ]
  }
}
```

This connects to the bastion, copies the SQL file, and executes it against the private RDS instance.

## Method 5: Using Lambda for Database Initialization

Deploy a Lambda function that runs migrations:

```hcl
# Lambda function for database initialization
resource "aws_lambda_function" "db_init" {
  filename         = "lambda_function.zip"
  function_name    = "db-init"
  role            = aws_iam_role.lambda.arn
  handler         = "index.handler"
  runtime         = "python3.11"
  timeout         = 300
  source_code_hash = filebase64sha256("lambda_function.zip")

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DB_HOST     = aws_db_instance.main.address
      DB_PORT     = aws_db_instance.main.port
      DB_NAME     = aws_db_instance.main.db_name
      DB_USER     = aws_db_instance.main.username
      DB_PASSWORD = var.db_password
    }
  }
}

# Trigger the Lambda after RDS is created
resource "null_resource" "invoke_db_init" {
  depends_on = [aws_lambda_function.db_init, aws_db_instance.main]

  triggers = {
    lambda_version = aws_lambda_function.db_init.version
    sql_hash       = filemd5("${path.module}/migrations/init.sql")
  }

  provisioner "local-exec" {
    command = <<-EOT
      aws lambda invoke \
        --function-name ${aws_lambda_function.db_init.function_name} \
        --payload '{"action": "initialize"}' \
        response.json
    EOT
  }
}
```

The Lambda function code:

```python
# lambda_function.py
import os
import psycopg2

def handler(event, context):
    conn = psycopg2.connect(
        host=os.environ['DB_HOST'],
        port=os.environ['DB_PORT'],
        database=os.environ['DB_NAME'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD']
    )

    cursor = conn.cursor()

    # Read and execute SQL
    with open('init.sql', 'r') as f:
        sql = f.read()
        cursor.execute(sql)

    conn.commit()
    cursor.close()
    conn.close()

    return {'statusCode': 200, 'body': 'Database initialized'}
```

## Method 6: Using Flyway for Migrations

Integrate Flyway for versioned migrations:

```hcl
resource "aws_db_instance" "main" {
  identifier        = "myapp-db"
  engine            = "postgres"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  db_name           = "appdb"
  username          = "dbadmin"
  password          = var.db_password
  skip_final_snapshot = true
}

# Run Flyway migrations
resource "null_resource" "flyway_migrate" {
  depends_on = [aws_db_instance.main]

  triggers = {
    # Re-run when any migration file changes
    migrations_hash = sha256(join("", [
      for f in fileset("${path.module}/migrations", "*.sql") :
      filemd5("${path.module}/migrations/${f}")
    ]))
  }

  provisioner "local-exec" {
    command = <<-EOT
      flyway \
        -url=jdbc:postgresql://${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name} \
        -user=${aws_db_instance.main.username} \
        -password=${var.db_password} \
        -locations=filesystem:${path.module}/migrations \
        migrate
    EOT
  }
}
```

Your migrations directory:

```
migrations/
├── V1__initial_schema.sql
├── V2__add_users_table.sql
└── V3__add_indexes.sql
```

Flyway tracks which migrations have run and only applies new ones.

## Method 7: Using Terraform's file Provisioner With Remote Connection

For cases where you need more control:

```hcl
resource "aws_db_instance" "main" {
  identifier        = "myapp-db"
  engine            = "postgres"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  db_name           = "appdb"
  username          = "dbadmin"
  password          = var.db_password
  publicly_accessible = true  # Only for initial setup
  skip_final_snapshot = true
}

# Wait for database to be available
resource "time_sleep" "wait_for_db" {
  depends_on = [aws_db_instance.main]
  create_duration = "60s"
}

resource "null_resource" "db_migration" {
  depends_on = [time_sleep.wait_for_db]

  triggers = {
    migration_version = var.migration_version
    sql_files = join(",", [
      for f in fileset("${path.module}/sql", "*.sql") :
      filemd5("${path.module}/sql/${f}")
    ])
  }

  provisioner "local-exec" {
    command = "${path.module}/scripts/run-migrations.sh"

    environment = {
      DB_HOST     = aws_db_instance.main.address
      DB_PORT     = aws_db_instance.main.port
      DB_NAME     = aws_db_instance.main.db_name
      DB_USER     = aws_db_instance.main.username
      DB_PASSWORD = var.db_password
      SQL_DIR     = "${path.module}/sql"
    }
  }
}
```

The migration script:

```bash
#!/bin/bash
# scripts/run-migrations.sh

set -e

echo "Running database migrations..."

for sql_file in "$SQL_DIR"/*.sql; do
  echo "Executing: $sql_file"
  psql "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" \
    -f "$sql_file"
done

echo "Migrations complete!"
```

## Handling Secrets Securely

Never hardcode database passwords. Use AWS Secrets Manager:

```hcl
# Store the password in Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name = "rds-db-password"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password
}

resource "aws_db_instance" "main" {
  identifier        = "myapp-db"
  engine            = "postgres"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  db_name           = "appdb"
  username          = "dbadmin"
  password          = var.db_password
  skip_final_snapshot = true
}

# Lambda function retrieves password from Secrets Manager
resource "aws_lambda_function" "db_init" {
  # ... configuration ...

  environment {
    variables = {
      DB_HOST        = aws_db_instance.main.address
      DB_SECRET_ARN  = aws_secretsmanager_secret.db_password.arn
    }
  }
}
```

The Lambda code retrieves the password at runtime:

```python
import boto3
import json

def get_db_password():
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(SecretId=os.environ['DB_SECRET_ARN'])
    return json.loads(response['SecretString'])
```

## Idempotency Best Practices

Make SQL scripts idempotent so they can run multiple times safely:

```sql
-- Use IF NOT EXISTS
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL
);

-- Conditional user creation
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'appuser') THEN
        CREATE USER appuser WITH PASSWORD 'changeme';
    END IF;
END
$$;

-- Safe index creation
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Safe column addition
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='users' AND column_name='email'
    ) THEN
        ALTER TABLE users ADD COLUMN email VARCHAR(255);
    END IF;
END
$$;
```

## When to Avoid SQL in Terraform

Terraform isn't always the right tool for database changes:

- **Application migrations**: Use application deployment tools (Liquibase, Flyway, Rails migrations)
- **Frequent schema changes**: Use dedicated migration tools
- **Production databases**: Prefer manual approval processes
- **Large data imports**: Use dedicated ETL tools

Terraform works best for:
- Initial database setup
- Creating databases and users
- Setting up replication
- Infrastructure-level configuration

While Terraform can execute SQL against RDS, combining it with database-specific providers or migration tools provides better idempotency and state management. Choose the approach that fits your deployment model - simple `local-exec` for basic setup, dedicated providers for user and database management, or external migration tools for complex schema evolution.
