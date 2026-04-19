---
title: 'Day 17 - Serverless Deploy'
day: 17
excerpt: 'Deploy a serverless function to AWS Lambda with API Gateway, learning modern serverless architecture patterns.'
description: 'Learn serverless deployment with AWS Lambda, API Gateway, and Infrastructure as Code using AWS SAM or Serverless Framework.'
publishedAt: '2025-12-17T00:00:00Z'
updatedAt: '2026-04-19T00:00:00Z'
difficulty: 'Intermediate'
category: 'Serverless'
tags:
  - AWS Lambda
  - Serverless
  - API Gateway
  - Cloud
---

## Description

You need to deploy an API that scales automatically, has zero idle costs, and requires minimal infrastructure management. Enter serverless with AWS Lambda. Today you'll deploy a function-based API.

## Task

Deploy a serverless API using AWS Lambda and API Gateway.

**Requirements:**
- Create a Lambda function
- Set up API Gateway endpoint
- Deploy using Infrastructure as Code
- Add environment variables
- Test the deployed API

## Target

- ✅ Lambda function deployed
- ✅ API Gateway endpoint working
- ✅ Function triggered via HTTP
- ✅ Logs visible in CloudWatch
- ✅ Deployed via IaC

## Sample App

### Serverless Function

#### handler.js

```javascript
'use strict';

module.exports.hello = async (event) => {
  const name = event.queryStringParameters?.name || 'World';

  console.log('Received request:', { name });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      message: `Hello, ${name}!`,
      timestamp: new Date().toISOString(),
      requestId: event.requestContext.requestId
    })
  };
};

module.exports.getUser = async (event) => {
  const userId = event.pathParameters?.id;

  // Simulate database lookup
  const user = {
    id: userId,
    name: 'John Doe',
    email: 'john@example.com'
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(user)
  };
};

module.exports.createUser = async (event) => {
  const data = JSON.parse(event.body);

  console.log('Creating user:', data);

  // Validate input
  if (!data.name || !data.email) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Name and email are required'
      })
    };
  }

  // Simulate user creation
  const user = {
    id: Date.now().toString(),
    ...data,
    createdAt: new Date().toISOString()
  };

  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(user)
  };
};
```

## Solution

### 1. Serverless Framework Approach

#### serverless.yml

```yaml
service: advent-serverless-api

frameworkVersion: '3'

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  stage: ${opt:stage, 'dev'}
  memorySize: 256
  timeout: 10

  environment:
    STAGE: ${self:provider.stage}
    TABLE_NAME: ${self:custom.tableName}

  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - dynamodb:Query
            - dynamodb:Scan
            - dynamodb:GetItem
            - dynamodb:PutItem
            - dynamodb:UpdateItem
            - dynamodb:DeleteItem
          Resource:
            - Fn::GetAtt: [UsersTable, Arn]

  logs:
    restApi: true

functions:
  hello:
    handler: handler.hello
    events:
      - httpApi:
          path: /hello
          method: get

  getUser:
    handler: handler.getUser
    events:
      - httpApi:
          path: /users/{id}
          method: get

  createUser:
    handler: handler.createUser
    events:
      - httpApi:
          path: /users
          method: post

  listUsers:
    handler: handler.listUsers
    events:
      - httpApi:
          path: /users
          method: get

resources:
  Resources:
    UsersTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ${self:custom.tableName}
        BillingMode: PAY_PER_REQUEST
        AttributeDefinitions:
          - AttributeName: id
            AttributeType: S
        KeySchema:
          - AttributeName: id
            KeyType: HASH

custom:
  tableName: users-${self:provider.stage}

plugins:
  - serverless-offline  # For local testing
```

#### package.json

```json
{
  "name": "advent-serverless-api",
  "version": "1.0.0",
  "description": "Serverless API example",
  "main": "handler.js",
  "scripts": {
    "deploy": "serverless deploy",
    "remove": "serverless remove",
    "logs": "serverless logs -f hello -t",
    "local": "serverless offline"
  },
  "dependencies": {
    "aws-sdk": "^2.1500.0"
  },
  "devDependencies": {
    "serverless": "^3.38.0",
    "serverless-offline": "^13.3.0"
  }
}
```

### 2. AWS SAM Approach

#### template.yaml

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Serverless API with SAM

Globals:
  Function:
    Timeout: 10
    MemorySize: 256
    Runtime: nodejs20.x
    Environment:
      Variables:
        STAGE: !Ref Stage

Parameters:
  Stage:
    Type: String
    Default: dev
    AllowedValues:
      - dev
      - staging
      - prod

Resources:
  # API Gateway
  ApiGateway:
    Type: AWS::Serverless::Api
    Properties:
      StageName: !Ref Stage
      Cors:
        AllowMethods: "'GET, POST, PUT, DELETE, OPTIONS'"
        AllowHeaders: "'Content-Type,Authorization'"
        AllowOrigin: "'*'"

  # Lambda Functions
  HelloFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: ./
      Handler: handler.hello
      Events:
        HelloApi:
          Type: Api
          Properties:
            RestApiId: !Ref ApiGateway
            Path: /hello
            Method: GET

  GetUserFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: ./
      Handler: handler.getUser
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref UsersTable
      Events:
        GetUserApi:
          Type: Api
          Properties:
            RestApiId: !Ref ApiGateway
            Path: /users/{id}
            Method: GET

  CreateUserFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: ./
      Handler: handler.createUser
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref UsersTable
      Events:
        CreateUserApi:
          Type: Api
          Properties:
            RestApiId: !Ref ApiGateway
            Path: /users
            Method: POST

  # DynamoDB Table
  UsersTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub users-${Stage}
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH

Outputs:
  ApiUrl:
    Description: "API Gateway endpoint URL"
    Value: !Sub "https://${ApiGateway}.execute-api.${AWS::Region}.amazonaws.com/${Stage}"

  HelloFunction:
    Description: "Hello Lambda Function ARN"
    Value: !GetAtt HelloFunction.Arn

  UsersTableName:
    Description: "DynamoDB table name"
    Value: !Ref UsersTable
```

#### samconfig.toml

```toml
version = 0.1

[default.deploy.parameters]
stack_name = "advent-serverless-api"
region = "us-east-1"
capabilities = "CAPABILITY_IAM"
parameter_overrides = "Stage=dev"
```

### 3. Terraform Approach

#### main.tf

```hcl
terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Lambda function
resource "aws_lambda_function" "hello" {
  filename      = "function.zip"
  function_name = "hello-${var.environment}"
  role          = aws_iam_role.lambda_role.arn
  handler       = "handler.hello"
  runtime       = "nodejs20.x"
  timeout       = 10
  memory_size   = 256

  environment {
    variables = {
      STAGE = var.environment
    }
  }

  source_code_hash = filebase64sha256("function.zip")
}

# IAM role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Attach CloudWatch Logs policy
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# API Gateway
resource "aws_apigatewayv2_api" "api" {
  name          = "serverless-api-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE"]
    allow_headers = ["content-type", "authorization"]
  }
}

# API Gateway integration
resource "aws_apigatewayv2_integration" "hello" {
  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.hello.invoke_arn
}

# API Gateway route
resource "aws_apigatewayv2_route" "hello" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /hello"
  target    = "integrations/${aws_apigatewayv2_integration.hello.id}"
}

# API Gateway stage
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = var.environment
  auto_deploy = true
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.hello.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# Outputs
output "api_url" {
  value = aws_apigatewayv2_stage.default.invoke_url
}

output "function_name" {
  value = aws_lambda_function.hello.function_name
}
```

## Explanation

### Serverless Concepts

#### 1. AWS Lambda

**Event-driven compute:**
```
HTTP Request → API Gateway → Lambda Function → Response
```

**Pricing:** Pay per request + compute time

**Benefits:**
- No servers to manage
- Auto-scaling
- Pay-per-use
- High availability built-in

#### 2. API Gateway

**Managed API service:**
- Handles HTTP requests
- Routes to Lambda
- Authentication/authorization
- Rate limiting
- CORS support

#### 3. Cold Starts

**First invocation slow:**
- Container initialization
- Code loading
- Connection setup

**Mitigations:**
- Provisioned concurrency
- Keep functions warm
- Optimize package size

### Lambda Event Structure

```javascript
{
  "requestContext": {
    "requestId": "abc-123",
    "http": {
      "method": "GET",
      "path": "/hello"
    }
  },
  "headers": {
    "content-type": "application/json"
  },
  "queryStringParameters": {
    "name": "World"
  },
  "body": null
}
```

### Response Format

```javascript
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json"
  },
  "body": JSON.stringify({ message: "Success" })
}
```

## Result

### Deploy with Serverless Framework

```bash
# Install Serverless Framework
npm install -g serverless

# Install dependencies
npm install

# Deploy to AWS
serverless deploy --stage dev

# Output:
# Deploying advent-serverless-api to stage dev (us-east-1)
#
# ✔ Service deployed to stack advent-serverless-api-dev
#
# endpoints:
#   GET - https://abc123.execute-api.us-east-1.amazonaws.com/hello
#   GET - https://abc123.execute-api.us-east-1.amazonaws.com/users/{id}
#   POST - https://abc123.execute-api.us-east-1.amazonaws.com/users
#
# functions:
#   hello: advent-serverless-api-dev-hello
#   getUser: advent-serverless-api-dev-getUser
#   createUser: advent-serverless-api-dev-createUser
```

### Deploy with AWS SAM

```bash
# Install AWS SAM CLI
brew install aws-sam-cli

# Build
sam build

# Deploy
sam deploy --guided

# Output:
# Successfully created/updated stack - advent-serverless-api
#
# CloudFormation outputs:
# ApiUrl: https://abc123.execute-api.us-east-1.amazonaws.com/dev
# HelloFunction: arn:aws:lambda:us-east-1:123456789:function:HelloFunction
```

### Test the API

```bash
# Get API URL
API_URL=$(serverless info --verbose | grep "GET" | head -1 | awk '{print $NF}')

# Test hello endpoint
curl "$API_URL"
# {"message":"Hello, World!","timestamp":"2025-12-17T..."}

# Test with query parameter
curl "$API_URL?name=DevOps"
# {"message":"Hello, DevOps!","timestamp":"2025-12-17T..."}

# Test getUser endpoint
curl "https://abc123.execute-api.us-east-1.amazonaws.com/users/123"
# {"id":"123","name":"John Doe","email":"john@example.com"}

# Test createUser endpoint
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane","email":"jane@example.com"}' \
  "https://abc123.execute-api.us-east-1.amazonaws.com/users"
# {"id":"1702820000000","name":"Jane","email":"jane@example.com","createdAt":"2025-12-17T..."}
```

### View Logs

```bash
# Serverless Framework
serverless logs -f hello -t

# AWS CLI
aws logs tail /aws/lambda/hello-dev --follow

# CloudWatch Logs Insights query
aws logs start-query \
  --log-group-name /aws/lambda/hello-dev \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc'
```

## Validation

### Testing Checklist

```bash
# 1. Function deployed
aws lambda get-function --function-name hello-dev
# Should return function configuration

# 2. API Gateway exists
aws apigatewayv2 get-apis
# Should list your API

# 3. Endpoint responds
curl -I https://abc123.execute-api.us-east-1.amazonaws.com/hello
# Should return 200 OK

# 4. Logs visible
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/hello
# Should show log group

# 5. Function can be invoked
aws lambda invoke \
  --function-name hello-dev \
  --payload '{"queryStringParameters":{"name":"Test"}}' \
  response.json
cat response.json
# Should show response

# 6. Metrics available
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=hello-dev \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

## Best Practices

### ✅ Do's

1. **Use Infrastructure as Code**: Serverless Framework, SAM, or Terraform
2. **Set appropriate timeouts**: Default may be too long
3. **Monitor cold starts**: Track performance
4. **Use environment variables**: Configuration
5. **Enable logging**: CloudWatch Logs
6. **Set memory appropriately**: Affects CPU too

### ❌ Don'ts

1. **Don't put secrets in code**: Use Parameter Store/Secrets Manager
2. **Don't make functions too large**: Keep them focused
3. **Don't ignore costs**: Monitor usage
4. **Don't skip error handling**: Return proper status codes
5. **Don't forget CORS**: Enable for web apps

## Links

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Serverless Framework](https://www.serverless.com/framework/docs)
- [AWS SAM](https://docs.aws.amazon.com/serverless-application-model/)
- [API Gateway](https://docs.aws.amazon.com/apigateway/)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

## Share Your Success

Deployed serverless? Share it!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- API endpoint (if public)
- Response time
- Cost estimate
- What you built

Use hashtags: **#AdventOfDevOps #Serverless #AWS #Lambda #Day17**
