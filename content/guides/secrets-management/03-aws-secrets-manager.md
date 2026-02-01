---
title: 'AWS Secrets Manager'
description: 'Use AWS Secrets Manager for cloud-native secrets management'
---

# AWS Secrets Manager

AWS Secrets Manager is a fully managed service for storing, rotating, and retrieving secrets in AWS. It integrates natively with AWS services and provides automatic rotation capabilities.

## Core Concepts

```
+-----------------+     +-----------------+     +-----------------+
|  Application    |     |    Secrets      |     |    Backend      |
|                 | --> |    Manager      | --> |    (RDS/etc)    |
+-----------------+     +-----------------+     +-----------------+
        |                       |
        |                       v
        |               +-----------------+
        |               |    Lambda       |
        +-------------->|   (Rotation)    |
                        +-----------------+
```

- **Secrets** - Key-value pairs or JSON documents stored encrypted
- **Versions** - Each secret can have multiple versions with staging labels
- **Rotation** - Automated credential rotation via Lambda functions
- **Resource policies** - Cross-account access control

## Creating and Managing Secrets

### Using AWS CLI

```bash
# Create a simple secret
aws secretsmanager create-secret \
    --name myapp/database \
    --description "Database credentials for MyApp" \
    --secret-string '{"username":"admin","password":"s3cr3t","host":"db.example.com"}'

# Create secret from file
aws secretsmanager create-secret \
    --name myapp/api-key \
    --secret-string file://secret.json

# Retrieve a secret
aws secretsmanager get-secret-value \
    --secret-id myapp/database

# Update a secret
aws secretsmanager update-secret \
    --secret-id myapp/database \
    --secret-string '{"username":"admin","password":"newpassword","host":"db.example.com"}'

# List all secrets
aws secretsmanager list-secrets

# Delete a secret (with recovery window)
aws secretsmanager delete-secret \
    --secret-id myapp/database \
    --recovery-window-in-days 7

# Force delete immediately (no recovery)
aws secretsmanager delete-secret \
    --secret-id myapp/database \
    --force-delete-without-recovery
```

### Using Terraform

```hcl
# Create a secret
resource "aws_secretsmanager_secret" "database" {
  name        = "myapp/database"
  description = "Database credentials"
  
  tags = {
    Environment = "production"
    Application = "myapp"
  }
}

# Set secret value
resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    username = "admin"
    password = random_password.db.result
    host     = aws_db_instance.main.address
    port     = 5432
  })
}

# Generate random password
resource "random_password" "db" {
  length  = 32
  special = true
}

# Output secret ARN
output "database_secret_arn" {
  value = aws_secretsmanager_secret.database.arn
}
```

## Automatic Rotation

### RDS Rotation Setup

```hcl
# Enable rotation for RDS credentials
resource "aws_secretsmanager_secret_rotation" "database" {
  secret_id           = aws_secretsmanager_secret.database.id
  rotation_lambda_arn = aws_lambda_function.rotation.arn
  
  rotation_rules {
    automatically_after_days = 30
  }
}

# Create rotation Lambda
resource "aws_lambda_function" "rotation" {
  filename         = "rotation_lambda.zip"
  function_name    = "SecretsManagerRotation"
  role             = aws_iam_role.rotation.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.11"
  timeout          = 30
  
  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.rotation.id]
  }
  
  environment {
    variables = {
      SECRETS_MANAGER_ENDPOINT = "https://secretsmanager.${var.region}.amazonaws.com"
    }
  }
}

# Allow Secrets Manager to invoke Lambda
resource "aws_lambda_permission" "rotation" {
  statement_id  = "AllowSecretsManager"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.rotation.function_name
  principal     = "secretsmanager.amazonaws.com"
}
```

### Rotation Lambda Function

```python
import boto3
import json
import logging
import psycopg2

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    arn = event['SecretId']
    token = event['ClientRequestToken']
    step = event['Step']
    
    client = boto3.client('secretsmanager')
    
    if step == "createSecret":
        create_secret(client, arn, token)
    elif step == "setSecret":
        set_secret(client, arn, token)
    elif step == "testSecret":
        test_secret(client, arn, token)
    elif step == "finishSecret":
        finish_secret(client, arn, token)
    else:
        raise ValueError(f"Invalid step: {step}")

def create_secret(client, arn, token):
    # Get current secret
    current = client.get_secret_value(
        SecretId=arn,
        VersionStage="AWSCURRENT"
    )
    secret = json.loads(current['SecretString'])
    
    # Generate new password
    new_password = client.get_random_password(
        PasswordLength=32,
        ExcludeCharacters='/@"\'\\'  # Exclude problematic chars
    )['RandomPassword']
    
    secret['password'] = new_password
    
    # Store as pending
    client.put_secret_value(
        SecretId=arn,
        ClientRequestToken=token,
        SecretString=json.dumps(secret),
        VersionStages=['AWSPENDING']
    )

def set_secret(client, arn, token):
    # Get pending secret
    pending = client.get_secret_value(
        SecretId=arn,
        VersionId=token,
        VersionStage="AWSPENDING"
    )
    secret = json.loads(pending['SecretString'])
    
    # Update database password
    conn = get_connection(client, arn, "AWSCURRENT")
    with conn.cursor() as cur:
        cur.execute(
            "ALTER USER %s WITH PASSWORD %s",
            (secret['username'], secret['password'])
        )
    conn.commit()
    conn.close()

def test_secret(client, arn, token):
    # Verify new credentials work
    conn = get_connection(client, arn, "AWSPENDING", token)
    conn.close()
    logger.info("Successfully tested new credentials")

def finish_secret(client, arn, token):
    # Move AWSCURRENT label to new version
    metadata = client.describe_secret(SecretId=arn)
    
    for version, stages in metadata['VersionIdsToStages'].items():
        if 'AWSCURRENT' in stages and version != token:
            # Move current to previous
            client.update_secret_version_stage(
                SecretId=arn,
                VersionStage='AWSCURRENT',
                MoveToVersionId=token,
                RemoveFromVersionId=version
            )
            break

def get_connection(client, arn, stage, version=None):
    kwargs = {'SecretId': arn, 'VersionStage': stage}
    if version:
        kwargs['VersionId'] = version
    
    response = client.get_secret_value(**kwargs)
    secret = json.loads(response['SecretString'])
    
    return psycopg2.connect(
        host=secret['host'],
        database=secret.get('dbname', 'postgres'),
        user=secret['username'],
        password=secret['password']
    )
```

## Application Integration

### Python SDK

```python
import boto3
import json
from functools import lru_cache
from botocore.exceptions import ClientError

class SecretsManager:
    def __init__(self, region='us-east-1'):
        self.client = boto3.client(
            'secretsmanager',
            region_name=region
        )
    
    @lru_cache(maxsize=100)
    def get_secret(self, secret_name):
        try:
            response = self.client.get_secret_value(
                SecretId=secret_name
            )
            if 'SecretString' in response:
                return json.loads(response['SecretString'])
            return response['SecretBinary']
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                raise ValueError(f"Secret {secret_name} not found")
            raise
    
    def get_database_url(self, secret_name):
        secret = self.get_secret(secret_name)
        return (
            f"postgresql://{secret['username']}:{secret['password']}"
            f"@{secret['host']}:{secret.get('port', 5432)}/{secret.get('dbname', 'postgres')}"
        )

# Usage
secrets = SecretsManager()
db_creds = secrets.get_secret('myapp/database')
database_url = secrets.get_database_url('myapp/database')
```

### Using with ECS

```json
{
  "family": "myapp",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "myapp:latest",
      "secrets": [
        {
          "name": "DB_USERNAME",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:myapp/database:username::"
        },
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:myapp/database:password::"
        }
      ]
    }
  ],
  "executionRoleArn": "arn:aws:iam::123456789:role/ecsTaskExecutionRole"
}
```

### Using with Lambda

```python
import json
import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities import parameters

logger = Logger()

# Using Lambda Powertools (recommended)
@logger.inject_lambda_context
def handler(event, context):
    # Automatic caching and refresh
    db_secret = parameters.get_secret(
        "myapp/database",
        transform='json',
        max_age=300  # Cache for 5 minutes
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps({'status': 'connected'})
    }
```

## Cross-Account Access

### Resource Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCrossAccountAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::999888777666:role/CrossAccountRole"
      },
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "secretsmanager:VersionStage": "AWSCURRENT"
        }
      }
    }
  ]
}
```

```bash
# Attach resource policy
aws secretsmanager put-resource-policy \
    --secret-id myapp/database \
    --resource-policy file://policy.json
```

## Pricing

As of 2024:
- **Storage**: $0.40 per secret per month
- **API calls**: $0.05 per 10,000 API calls
- **Rotation**: No additional cost (Lambda execution costs apply)

## Best Practices

1. **Use IAM policies** - Restrict access using least privilege
2. **Enable rotation** - Automate credential rotation where possible
3. **Use resource policies** - For cross-account access instead of sharing credentials
4. **Cache secrets** - Reduce API calls and costs
5. **Tag secrets** - For cost allocation and access control
6. **Monitor with CloudTrail** - Track all secret access
7. **Use VPC endpoints** - Keep traffic within AWS network
