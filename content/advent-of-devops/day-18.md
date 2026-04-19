---
title: 'Day 18 - Deploy a Static Site'
day: 18
excerpt: 'Deploy a static website to AWS S3 with CloudFront CDN for global performance and HTTPS support.'
description: 'Learn static site deployment using S3, CloudFront, and automation with GitHub Actions for continuous deployment.'
publishedAt: '2026-12-18T00:00:00Z'
updatedAt: '2026-12-18T00:00:00Z'
difficulty: 'Beginner'
category: 'Cloud'
tags:
  - AWS
  - S3
  - CloudFront
  - Static Sites
---

## Description

You have a static website (HTML, CSS, JavaScript) and need to host it reliably with global CDN performance and HTTPS. Deploy it to AWS S3 with CloudFront for a production-ready static site hosting solution.

## Task

Deploy a static website to AWS S3 with CloudFront CDN.

**Requirements:**
- Create S3 bucket for hosting
- Configure bucket for static website hosting
- Set up CloudFront distribution
- Configure custom domain (optional)
- Automate deployment with GitHub Actions

## Target

- ✅ Website accessible via HTTP/HTTPS
- ✅ CloudFront CDN serving content globally
- ✅ Automated deployment on push
- ✅ Custom domain configured (optional)
- ✅ SSL certificate active

## Sample App

### Static Website Files

#### index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Advent of DevOps - Day 18</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>🎄 Advent of DevOps</h1>
            <p>Day 18: Static Site Deployment</p>
        </header>

        <main>
            <section class="hero">
                <h2>Welcome to My Static Site</h2>
                <p>Deployed with AWS S3 + CloudFront</p>
            </section>

            <section class="features">
                <div class="feature">
                    <h3>⚡ Fast</h3>
                    <p>Served from CloudFront edge locations</p>
                </div>
                <div class="feature">
                    <h3>🔒 Secure</h3>
                    <p>HTTPS enabled by default</p>
                </div>
                <div class="feature">
                    <h3>📈 Scalable</h3>
                    <p>Handles millions of requests</p>
                </div>
            </section>

            <section class="info">
                <h3>Deployment Info</h3>
                <ul id="deployment-info">
                    <li>Build: <span id="build-id">Loading...</span></li>
                    <li>Deployed: <span id="deploy-time">Loading...</span></li>
                    <li>Version: <span id="version">1.0.0</span></li>
                </ul>
            </section>
        </main>

        <footer>
            <p>&copy; 2025 Advent of DevOps</p>
        </footer>
    </div>

    <script src="app.js"></script>
</body>
</html>
```

#### styles.css

```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

header {
    text-align: center;
    color: white;
    padding: 40px 20px;
}

header h1 {
    font-size: 3rem;
    margin-bottom: 10px;
}

main {
    background: white;
    border-radius: 10px;
    padding: 40px;
    margin: 20px 0;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}

.hero {
    text-align: center;
    padding: 40px 0;
}

.hero h2 {
    font-size: 2.5rem;
    color: #667eea;
    margin-bottom: 20px;
}

.features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 30px;
    margin: 40px 0;
}

.feature {
    text-align: center;
    padding: 30px;
    background: #f8f9fa;
    border-radius: 8px;
    transition: transform 0.3s;
}

.feature:hover {
    transform: translateY(-5px);
}

.feature h3 {
    font-size: 2rem;
    margin-bottom: 15px;
}

.info {
    background: #f8f9fa;
    padding: 30px;
    border-radius: 8px;
    margin-top: 40px;
}

.info ul {
    list-style: none;
    font-size: 1.1rem;
}

.info li {
    padding: 10px 0;
    border-bottom: 1px solid #ddd;
}

.info li:last-child {
    border-bottom: none;
}

footer {
    text-align: center;
    color: white;
    padding: 20px;
}

@media (max-width: 768px) {
    header h1 {
        font-size: 2rem;
    }

    .hero h2 {
        font-size: 1.8rem;
    }

    .features {
        grid-template-columns: 1fr;
    }
}
```

#### app.js

```javascript
// Display deployment information
document.addEventListener('DOMContentLoaded', () => {
    // Fetch deployment metadata
    fetch('/metadata.json')
        .then(response => response.json())
        .then(data => {
            document.getElementById('build-id').textContent = data.buildId || 'N/A';
            document.getElementById('deploy-time').textContent = new Date(data.deployedAt).toLocaleString();
            document.getElementById('version').textContent = data.version;
        })
        .catch(error => {
            console.error('Failed to load metadata:', error);
            document.getElementById('build-id').textContent = 'Unknown';
            document.getElementById('deploy-time').textContent = 'Unknown';
        });

    // Log to console
    console.log('🎄 Advent of DevOps - Day 18');
    console.log('Deployed with AWS S3 + CloudFront');
});
```

#### metadata.json

```json
{
    "buildId": "BUILD_ID_PLACEHOLDER",
    "deployedAt": "DEPLOY_TIME_PLACEHOLDER",
    "version": "1.0.0",
    "environment": "production"
}
```

## Solution

### 1. Terraform Infrastructure

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

# S3 bucket for website
resource "aws_s3_bucket" "website" {
  bucket = var.bucket_name
}

# S3 bucket public access block
resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket policy for CloudFront
resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.website.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.website.arn
          }
        }
      }
    ]
  })
}

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "website" {
  name                              = "website-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "website" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"  # US, Canada, Europe
  comment             = "Static website distribution"

  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.website.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.website.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  # Custom error responses
  custom_error_response {
    error_code         = 404
    response_code      = 404
    response_page_path = "/404.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 403
    response_page_path = "/404.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Environment = var.environment
    Project     = "advent-of-devops"
  }
}

# Outputs
output "website_bucket" {
  value = aws_s3_bucket.website.id
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.website.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.website.id
}
```

#### variables.tf

```hcl
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "S3 bucket name for website"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}
```

### 2. GitHub Actions Deployment

#### .github/workflows/deploy.yml

```yaml
name: Deploy Static Site

on:
  push:
    branches: [ main ]
  workflow_dispatch:

env:
  AWS_REGION: us-east-1
  S3_BUCKET: ${{ secrets.S3_BUCKET }}
  CLOUDFRONT_DISTRIBUTION_ID: ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }}

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Update metadata
        run: |
          sed -i "s/BUILD_ID_PLACEHOLDER/${{ github.run_number }}/g" metadata.json
          sed -i "s/DEPLOY_TIME_PLACEHOLDER/$(date -u +%Y-%m-%dT%H:%M:%SZ)/g" metadata.json

      - name: Sync to S3
        run: |
          aws s3 sync . s3://${{ env.S3_BUCKET }} \
            --exclude ".git/*" \
            --exclude ".github/*" \
            --exclude "README.md" \
            --exclude "terraform/*" \
            --delete

      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ env.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"

      - name: Deployment summary
        run: |
          echo "✅ Deployment complete!"
          echo "🌐 CloudFront URL: https://${{ secrets.CLOUDFRONT_DOMAIN }}"
          echo "📦 Build: ${{ github.run_number }}"
          echo "🔖 Commit: ${{ github.sha }}"
```

### 3. Deployment Scripts

#### deploy.sh

```bash
#!/bin/bash
set -euo pipefail

BUCKET_NAME="${1:-}"
CLOUDFRONT_ID="${2:-}"

if [ -z "$BUCKET_NAME" ] || [ -z "$CLOUDFRONT_ID" ]; then
    echo "Usage: $0 <bucket-name> <cloudfront-distribution-id>"
    exit 1
fi

echo "Deploying to S3 bucket: $BUCKET_NAME"

# Update metadata
sed -i.bak "s/BUILD_ID_PLACEHOLDER/manual-$(date +%s)/g" metadata.json
sed -i.bak "s/DEPLOY_TIME_PLACEHOLDER/$(date -u +%Y-%m-%dT%H:%M:%SZ)/g" metadata.json
rm -f metadata.json.bak

# Sync files to S3
aws s3 sync . "s3://${BUCKET_NAME}" \
    --exclude ".git/*" \
    --exclude "*.sh" \
    --exclude "terraform/*" \
    --exclude "*.md" \
    --delete

echo "Files uploaded to S3"

# Invalidate CloudFront cache
echo "Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo "Invalidation created: $INVALIDATION_ID"
echo "Waiting for invalidation to complete..."

aws cloudfront wait invalidation-completed \
    --distribution-id "$CLOUDFRONT_ID" \
    --id "$INVALIDATION_ID"

echo "✅ Deployment complete!"
```

## Explanation

### Static Site Hosting Architecture

```
User → CloudFront (CDN) → S3 Bucket (Website Files)
         ↓
    Edge Locations (Global)
         ↓
    Fast Content Delivery
```

### Key Components

#### 1. S3 Bucket

**Static website hosting:**
- Stores HTML, CSS, JS files
- Serves content to CloudFront
- Not publicly accessible (via OAC)

#### 2. CloudFront

**CDN distribution:**
- Caches content at edge locations
- Provides HTTPS
- Reduces latency globally
- Protects against DDoS

#### 3. Origin Access Control (OAC)

**Security:**
- S3 bucket not public
- Only CloudFront can access
- More secure than OAI (legacy)

### Cache Behavior

```yaml
default_cache_behavior:
  min_ttl: 0        # Minimum cache time
  default_ttl: 3600 # 1 hour default
  max_ttl: 86400    # 24 hours maximum
```

**Cache invalidation:**
```bash
aws cloudfront create-invalidation \
  --distribution-id DIST_ID \
  --paths "/*"
```

## Result

### Deploy Infrastructure

```bash
# Initialize Terraform
cd terraform
terraform init

# Plan deployment
terraform plan -var="bucket_name=my-static-site-bucket"

# Apply
terraform apply -var="bucket_name=my-static-site-bucket"

# Output:
# cloudfront_domain = "d123456789.cloudfront.net"
# cloudfront_distribution_id = "E1234567890ABC"
# website_bucket = "my-static-site-bucket"
```

### Deploy Website

```bash
# Manual deployment
./deploy.sh my-static-site-bucket E1234567890ABC

# Output:
# Deploying to S3 bucket: my-static-site-bucket
# upload: ./index.html to s3://my-static-site-bucket/index.html
# upload: ./styles.css to s3://my-static-site-bucket/styles.css
# upload: ./app.js to s3://my-static-site-bucket/app.js
# Files uploaded to S3
# Invalidating CloudFront cache...
# Invalidation created: I1234567890ABC
# Waiting for invalidation to complete...
# ✅ Deployment complete!
```

### Access Website

```bash
# Get CloudFront URL
CLOUDFRONT_URL=$(terraform output -raw cloudfront_domain)

echo "Website URL: https://$CLOUDFRONT_URL"

# Test website
curl -I "https://$CLOUDFRONT_URL"

# Output:
# HTTP/2 200
# content-type: text/html
# server: CloudFront
# x-cache: Hit from cloudfront
```

## Validation

### Testing Checklist

```bash
# 1. S3 bucket exists
aws s3 ls s3://my-static-site-bucket/
# Should list files

# 2. CloudFront distribution active
aws cloudfront get-distribution \
  --id E1234567890ABC \
  --query 'Distribution.Status'
# Should return "Deployed"

# 3. Website accessible via HTTPS
curl -I https://d123456789.cloudfront.net
# Should return 200 OK

# 4. Content served from CloudFront
curl -I https://d123456789.cloudfront.net | grep x-cache
# Should show "Hit from cloudfront" or "Miss from cloudfront"

# 5. Cache invalidation works
aws cloudfront list-invalidations \
  --distribution-id E1234567890ABC
# Should list invalidations

# 6. Custom error pages work
curl -I https://d123456789.cloudfront.net/nonexistent.html
# Should return 404 with custom error page
```

## Best Practices

### ✅ Do's

1. **Use CloudFront**: Global CDN performance
2. **Enable HTTPS**: Security first
3. **Set cache headers**: Control caching
4. **Invalidate on deploy**: Clear old content
5. **Use versioned URLs**: For assets (app.v1.js)
6. **Enable compression**: Faster transfers

### ❌ Don'ts

1. **Don't make S3 public**: Use OAC
2. **Don't skip invalidation**: Serve old content
3. **Don't ignore costs**: Monitor usage
4. **Don't forget 404 pages**: User experience
5. **Don't hardcode URLs**: Use environment variables

## Links

- [S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [GitHub Actions AWS](https://github.com/aws-actions)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

## Share Your Success

Deployed your static site? Share it!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Website URL
- Deployment time
- CloudFront edge locations
- What you deployed

Use hashtags: **#AdventOfDevOps #AWS #CloudFront #StaticSite #Day18**
