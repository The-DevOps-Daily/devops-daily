---
title: 'Migrating from Heroku to DigitalOcean: A Technical Migration Guide'
excerpt: 'A step-by-step technical guide to migrating production applications from Heroku to DigitalOcean. Covers App Platform, Managed Databases, Redis, Spaces, and infrastructure-as-code setup with real-world migration strategies.'
category:
  name: 'Cloud'
  slug: 'cloud'
coverImage: '/images/posts/migrating-from-heroku-to-digitalocean.png'
ogImage: '/images/posts/migrating-from-heroku-to-digitalocean.svg'
date: '2026-03-08'
publishedAt: '2026-03-08T10:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - DigitalOcean
  - Heroku
  - Cloud Migration
  - App Platform
  - Managed Database
  - DevOps
  - Infrastructure
---

## TLDR

Migrating from Heroku to DigitalOcean can reduce infrastructure costs by 60-80% while maintaining managed services convenience. DigitalOcean's App Platform provides a comparable developer experience to Heroku with git-based deployments, auto-scaling, and zero-downtime deploys. Combined with Managed Databases (PostgreSQL, MySQL, MongoDB, Redis), Spaces (S3-compatible object storage), and managed Kafka, you get Heroku-like simplicity at a fraction of the cost. This guide walks through a production migration strategy with minimal downtime and technical implementation details.

---

## Why Migrate from Heroku to DigitalOcean?

### Cost Comparison: Real Numbers

**Typical Production Heroku Setup**:
- 2× Performance-M dynos (web): $50/month each = $100/month
- 1× Performance-M dyno (worker): $50/month
- Standard-0 Postgres: $50/month
- Premium-0 Redis: $15/month
- Review apps (2 active): $30/month
- **Total: $245/month**

For a more demanding workload:
- 4× Performance-L dynos (web): $500/month each = $2,000/month
- 2× Performance-L dynos (workers): $1,000/month
- Standard-4 Postgres: $200/month
- Premium-5 Redis: $350/month
- **Total: $3,550/month**

**Equivalent DigitalOcean Setup (Basic)**:
- App Platform: 2× Professional instances ($24/month each) = $48/month
- Managed Database (PostgreSQL): Basic plan = $15/month
- Managed Redis: Basic plan = $15/month
- Spaces (object storage): $5/month + transfer
- **Total: $83/month**
- **Savings: 66% ($162/month)**

**Equivalent DigitalOcean Setup (High-Performance)**:
- App Platform: 4× Professional instances ($48/month for larger) = $192/month
- App Platform workers: 2× instances = $96/month
- Managed Database: Production plan (4GB RAM) = $60/month
- Managed Redis: Production plan = $60/month
- Spaces: $5/month
- **Total: $413/month**
- **Savings: 88% ($3,137/month)**

Beyond cost, you gain:
- More predictable pricing (no dyno sleep, clearer resource limits)
- Better performance per dollar (dedicated resources, not shared containers)
- Infrastructure flexibility (VPCs, Kubernetes, Droplets when needed)
- S3-compatible object storage included

---

## Migration Strategy: Zero-Downtime Approach

### Phase 1: Parallel Infrastructure (Week 1)

Run DigitalOcean infrastructure alongside Heroku without switching traffic.

**Goal**: Validate that DigitalOcean setup works with production data.

**Steps**:
1. Set up DigitalOcean Managed Database (PostgreSQL/MySQL)
2. Configure replication from Heroku Postgres to DigitalOcean
3. Deploy application to App Platform (no public traffic yet)
4. Test functionality with read-replica data
5. Monitor performance and identify issues

**Risk**: Low. Heroku remains primary, DigitalOcean is shadow environment.

### Phase 2: Database Migration (Week 2)

Move database to DigitalOcean with minimal downtime.

**Strategy**: Use logical replication + cutover window.

**Steps**:
1. Set up continuous replication (Heroku → DigitalOcean)
2. Let replication catch up (monitor lag)
3. Schedule maintenance window (typically 5-15 minutes)
4. Stop writes to Heroku
5. Wait for replication to fully sync
6. Update Heroku app DATABASE_URL to point to DigitalOcean
7. Resume traffic

**Downtime**: 5-15 minutes (writes only, reads can continue)

### Phase 3: Application Migration (Week 3)

Move application traffic to App Platform.

**Strategy**: Gradual traffic shift using DNS.

**Steps**:
1. Deploy app to App Platform with DigitalOcean database
2. Set DNS TTL to 60 seconds
3. Add App Platform URL as secondary A record (10% traffic)
4. Monitor errors, latency, throughput
5. Gradually increase traffic: 25% → 50% → 100%
6. Decommission Heroku dynos

**Rollback**: Simple DNS change back to Heroku.

### Phase 4: Supporting Services (Week 4)

Migrate Redis, object storage, background jobs.

**Steps**:
1. Set up Managed Redis on DigitalOcean
2. Migrate Spaces (or keep existing S3, update credentials)
3. Update worker processes to use DigitalOcean Redis
4. Move scheduled jobs to App Platform workers

**Total migration time**: 3-4 weeks with minimal risk.

---

## Technical Implementation: Component by Component

### 1. DigitalOcean App Platform

**What it is**: Platform-as-a-Service similar to Heroku. Git-based deployments, auto-scaling, managed runtime.

**How it compares to Heroku**:
- **Buildpacks**: Supports Docker, Node.js, Python, Ruby, Go, PHP out of box
- **Deployments**: Git push or GitHub integration (like Heroku)
- **Scaling**: Horizontal auto-scaling based on CPU/memory
- **Zero-downtime**: Rolling deployments (like Heroku)
- **Review apps**: Preview environments from PRs

**Key differences**:
- More explicit resource limits (CPU, RAM clearly defined)
- Lower base cost ($5/month starter vs $7/month Heroku Eco)
- No dyno sleeping (all instances stay running)
- Better observability (built-in metrics, no add-on needed)

#### Setup Example: Node.js API

**Option 1: GitHub Integration (Recommended)**

1. Create `.do/app.yaml` in your repository:

```yaml
name: my-api
region: nyc

services:
- name: web
  github:
    repo: yourorg/your-repo
    branch: main
    deploy_on_push: true
  
  build_command: npm install && npm run build
  run_command: npm start
  
  instance_count: 2
  instance_size_slug: professional-xs  # $12/month per instance
  
  http_port: 3000
  
  health_check:
    http_path: /health
    initial_delay_seconds: 10
    period_seconds: 10
  
  envs:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    type: SECRET
  - key: REDIS_URL
    type: SECRET

- name: worker
  github:
    repo: yourorg/your-repo
    branch: main
  
  build_command: npm install
  run_command: npm run worker
  
  instance_count: 1
  instance_size_slug: basic-xs  # $5/month
  
  envs:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    type: SECRET
  - key: REDIS_URL
    type: SECRET

databases:
- name: production-db
  engine: PG
  version: "15"
  production: true
  cluster_name: my-db-cluster
```

2. Deploy via CLI:

```bash
# Install doctl (DigitalOcean CLI)
brew install doctl

# Authenticate
doctl auth init

# Create app from spec
doctl apps create --spec .do/app.yaml

# Or deploy via UI: Apps → Create → Import from GitHub
```

**Option 2: Dockerfile Deployment**

If you have custom Docker setup:

```yaml
services:
- name: web
  dockerfile_path: Dockerfile
  source_dir: /
  
  instance_count: 2
  instance_size_slug: professional-xs
  
  http_port: 8080
```

**Auto-Scaling Configuration**:

```yaml
services:
- name: web
  instance_count: 2
  autoscaling:
    min_instance_count: 2
    max_instance_count: 10
    metrics:
      cpu:
        percent: 75  # Scale up when CPU > 75%
```

#### Environment Variables and Secrets

**Set via CLI**:

```bash
# Get app ID
doctl apps list

# Set environment variable
doctl apps update $APP_ID --set-env="KEY=value"

# Set secret (encrypted)
doctl apps update $APP_ID --set-env="DATABASE_URL=postgresql://..." --encrypt
```

**Set via UI**: Apps → Settings → Environment Variables

**Best practice**: Use App Platform's managed database integration for automatic DATABASE_URL injection.

---

### 2. Managed Databases

DigitalOcean's Managed Databases offer PostgreSQL, MySQL, MongoDB, and Redis with automated backups, point-in-time recovery, read replicas, and connection pooling.

#### PostgreSQL Setup

**Create via CLI**:

```bash
# Create production database cluster
doctl databases create production-postgres \
  --engine pg \
  --version 15 \
  --region nyc3 \
  --size db-s-2vcpu-4gb \
  --num-nodes 1

# Get connection details
doctl databases connection production-postgres

# Create database and user
doctl databases db create production-postgres myapp
doctl databases user create production-postgres myapp-user
```

**Connection Pooling** (recommended for production):

```bash
# Create connection pool
doctl databases pool create production-postgres myapp-pool \
  --db myapp \
  --user myapp-user \
  --size 25 \
  --mode transaction
```

**Connection string format**:

```
# Direct connection
postgresql://username:password@host:25060/database?sslmode=require

# Pooled connection (recommended)
postgresql://username:password@host:25061/database?sslmode=require
```

#### Migrating Data from Heroku Postgres

**Option 1: Logical Replication (Zero Downtime)**

Best for databases >10GB with minimal downtime requirements.

```bash
# 1. On Heroku Postgres, enable logical replication
heroku pg:psql -a myapp
ALTER SYSTEM SET wal_level = logical;
SELECT pg_reload_conf();

# 2. Create publication on source
CREATE PUBLICATION heroku_pub FOR ALL TABLES;

# 3. On DigitalOcean database, create subscription
CREATE SUBSCRIPTION do_sub
CONNECTION 'postgresql://heroku_host:5432/database'
PUBLICATION heroku_pub;

# 4. Monitor replication lag
SELECT * FROM pg_stat_subscription;

# 5. When lag is near zero, stop writes and switch
```

**Option 2: pg_dump/pg_restore (Simpler, Downtime Required)**

Best for databases <10GB or when downtime is acceptable.

```bash
# 1. Put Heroku app in maintenance mode
heroku maintenance:on -a myapp

# 2. Create dump from Heroku
heroku pg:backups:capture -a myapp
heroku pg:backups:download -a myapp

# 3. Restore to DigitalOcean
pg_restore --verbose --clean --no-acl --no-owner \
  -h do-host -U do-user -d myapp latest.dump

# 4. Verify data integrity
psql -h do-host -U do-user -d myapp -c "SELECT count(*) FROM users;"

# 5. Update DATABASE_URL in App Platform
# 6. Deploy and test
# 7. Turn off Heroku maintenance mode
```

#### Backup Configuration

DigitalOcean automatically backs up databases daily:

```bash
# List available backups
doctl databases backups list production-postgres

# Restore from backup
doctl databases backups restore production-postgres backup-id

# Fork database to new cluster (for testing)
doctl databases fork production-postgres test-postgres \
  --restore-from-timestamp "2026-03-01T10:30:00Z"
```

**Point-in-Time Recovery**: Available on clusters $40/month and above. Allows restore to any point within 7-day window.

#### Cost Comparison

| **Heroku Postgres** | **DigitalOcean Managed DB** | **Savings** |
|---------------------|-----------------------------|--------------|
| Hobby-dev: Free (10K rows limit) | Basic (1GB RAM, 10GB disk): $15/month | N/A |
| Mini: $5/month (10M rows) | Same as above | N/A |
| Standard-0: $50/month (64GB storage) | Professional (2GB RAM, 25GB): $30/month | 40% |
| Standard-4: $200/month (256GB storage) | Professional (4GB RAM, 80GB): $60/month | 70% |
| Premium-5: $350/month (512GB storage) | Professional (8GB RAM, 160GB): $120/month | 66% |

---

### 3. Managed Redis

DigitalOcean's Managed Redis offers high-performance caching and session storage with automated failover.

#### Setup

```bash
# Create Redis cluster
doctl databases create production-redis \
  --engine redis \
  --version 7 \
  --region nyc3 \
  --size db-s-1vcpu-1gb \
  --num-nodes 1

# Get connection details
doctl databases connection production-redis
```

**Connection string format**:

```
redis://username:password@host:25061?ssl=true
```

#### Migration from Heroku Redis

**Option 1: Application-Level Migration** (Recommended)

Let cache warm up naturally after switching:

```bash
# 1. Deploy app with REDIS_URL pointing to DigitalOcean
# 2. Cache will repopulate on cache misses
# 3. No data migration needed for true caching
```

**Option 2: redis-cli DUMP/RESTORE** (For persistent data):

```bash
# Install redis-cli
brew install redis  # macOS

# Export from Heroku
heroku redis:cli -a myapp
SAVE  # Force snapshot
BGSAVE  # Background save

# Use redis-copy tool for migration
npm install -g redis-copy

redis-copy \
  --src redis://heroku-redis-url \
  --dst rediss://do-redis-url
```

#### Eviction Policies

Configure via DigitalOcean UI or CLI:

```bash
# Set maxmemory policy
doctl databases options set production-redis \
  --config maxmemory-policy=allkeys-lru
```

Common policies:
- `allkeys-lru`: Evict least recently used keys (recommended for caching)
- `volatile-lru`: Evict LRU keys with TTL set
- `noeviction`: Return errors when memory full (for queues)

#### Cost Comparison

| **Heroku Redis** | **DigitalOcean Redis** | **Savings** |
|------------------|------------------------|--------------|
| Mini: $15/month (25MB) | Basic (1GB RAM): $15/month | 0% but 40× capacity |
| Premium-0: $15/month (100MB) | Basic (1GB RAM): $15/month | 0% but 10× capacity |
| Premium-5: $350/month (4GB) | Professional (4GB RAM): $60/month | 83% |

---

### 4. Spaces (Object Storage)

Spaces is DigitalOcean's S3-compatible object storage. Fully compatible with AWS SDK, making migration from S3 trivial.

#### Creating a Space

```bash
# Create Space
doctl compute spaces create myapp-production \
  --region nyc3

# Generate API keys
doctl compute spaces keys create myapp-spaces-key
```

#### S3 SDK Configuration

**Node.js (AWS SDK v3)**:

```javascript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: 'https://nyc3.digitaloceanspaces.com',
  region: 'us-east-1',  // Required but ignored
  credentials: {
    accessKeyId: process.env.SPACES_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
});

// Upload file
await s3Client.send(new PutObjectCommand({
  Bucket: 'myapp-production',
  Key: 'uploads/avatar.jpg',
  Body: fileBuffer,
  ACL: 'public-read',  // Or 'private'
}));

// Public URL format
const publicUrl = `https://myapp-production.nyc3.digitaloceanspaces.com/uploads/avatar.jpg`;

// CDN URL (if enabled)
const cdnUrl = `https://myapp-production.nyc3.cdn.digitaloceanspaces.com/uploads/avatar.jpg`;
```

**Ruby (aws-sdk-s3)**:

```ruby
require 'aws-sdk-s3'

s3 = Aws::S3::Resource.new(
  endpoint: 'https://nyc3.digitaloceanspaces.com',
  access_key_id: ENV['SPACES_KEY'],
  secret_access_key: ENV['SPACES_SECRET'],
  region: 'us-east-1'
)

obj = s3.bucket('myapp-production').object('uploads/avatar.jpg')
obj.upload_file('/path/to/file.jpg', acl: 'public-read')

puts obj.public_url
```

#### Migrating from AWS S3

**Option 1: aws-cli sync**:

```bash
# Install aws-cli if not present
brew install awscli

# Sync from S3 to Spaces
AWS_ACCESS_KEY_ID=$SPACES_KEY \
AWS_SECRET_ACCESS_KEY=$SPACES_SECRET \
aws s3 sync s3://my-heroku-bucket/ s3://myapp-production/ \
  --endpoint-url https://nyc3.digitaloceanspaces.com
```

**Option 2: rclone (for large datasets)**:

```bash
# Install rclone
brew install rclone

# Configure source (S3)
rclone config create s3-source s3 \
  access_key_id=$AWS_ACCESS_KEY \
  secret_access_key=$AWS_SECRET_KEY

# Configure destination (Spaces)
rclone config create do-spaces s3 \
  access_key_id=$SPACES_KEY \
  secret_access_key=$SPACES_SECRET \
  endpoint=nyc3.digitaloceanspaces.com

# Sync with progress
rclone sync s3-source:my-bucket do-spaces:myapp-production --progress
```

#### CDN Integration

Enable built-in CDN (free) for faster global delivery:

```bash
# Enable CDN via UI: Spaces → Settings → CDN
# CDN endpoint: https://myapp-production.nyc3.cdn.digitaloceanspaces.com
```

Benefits:
- Free CDN (included in Spaces pricing)
- Automatic TLS/SSL
- Global edge caching
- No Cloudflare setup needed

#### Cost Comparison

| **Service** | **Pricing** |
|-------------|-------------|
| **DigitalOcean Spaces** | $5/month for 250GB + 1TB transfer<br>$0.02/GB over 250GB storage<br>$0.01/GB over 1TB transfer |
| **AWS S3 (us-east-1)** | $0.023/GB storage<br>$0.09/GB transfer<br>Minimum ~$10-20/month for typical app |
| **Heroku + S3** | Must use external S3 + egress fees |

**Example**: 100GB storage + 500GB transfer/month:
- **Spaces**: $5/month (included in base)
- **AWS S3**: $2.30 (storage) + $45 (transfer) = $47.30/month
- **Savings**: 89%

---


## Infrastructure as Code

Managing DigitalOcean resources via Terraform ensures reproducibility and version control.

### Terraform Example: Full Stack

**main.tf**:

```hcl
terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.34"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

# VPC for private networking
resource "digitalocean_vpc" "main" {
  name     = "production-vpc"
  region   = "nyc3"
  ip_range = "10.10.0.0/16"
}

# PostgreSQL Database
resource "digitalocean_database_cluster" "postgres" {
  name       = "production-postgres"
  engine     = "pg"
  version    = "15"
  size       = "db-s-2vcpu-4gb"
  region     = "nyc3"
  node_count = 1
  
  private_network_uuid = digitalocean_vpc.main.id
}

resource "digitalocean_database_db" "app" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "myapp"
}

resource "digitalocean_database_user" "app" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "myapp-user"
}

# Redis Cache
resource "digitalocean_database_cluster" "redis" {
  name       = "production-redis"
  engine     = "redis"
  version    = "7"
  size       = "db-s-1vcpu-1gb"
  region     = "nyc3"
  node_count = 1
  
  private_network_uuid = digitalocean_vpc.main.id
}

# Spaces Bucket
resource "digitalocean_spaces_bucket" "uploads" {
  name   = "myapp-production"
  region = "nyc3"
  
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["https://myapp.com"]
    max_age_seconds = 3000
  }
}

# App Platform App
resource "digitalocean_app" "web" {
  spec {
    name   = "myapp"
    region = "nyc"

    service {
      name               = "web"
      instance_count     = 2
      instance_size_slug = "professional-xs"
      
      github {
        repo           = "myorg/myapp"
        branch         = "main"
        deploy_on_push = true
      }
      
      env {
        key   = "DATABASE_URL"
        value = digitalocean_database_cluster.postgres.uri
        type  = "SECRET"
      }
      
      env {
        key   = "REDIS_URL"
        value = digitalocean_database_cluster.redis.uri
        type  = "SECRET"
      }
      
      env {
        key   = "SPACES_KEY"
        value = var.spaces_key
        type  = "SECRET"
      }
    }
  }
}

output "app_live_url" {
  value = digitalocean_app.web.live_url
}

output "database_uri" {
  value     = digitalocean_database_cluster.postgres.uri
  sensitive = true
}
```

**Apply infrastructure**:

```bash
# Initialize
terraform init

# Plan changes
terraform plan -var="do_token=$DIGITALOCEAN_TOKEN"

# Apply
terraform apply -var="do_token=$DIGITALOCEAN_TOKEN"
```

---

## CI/CD with GitHub Actions

Automate deployments to DigitalOcean App Platform.

**.github/workflows/deploy.yml**:

```yaml
name: Deploy to DigitalOcean

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DIGITALOCEAN_TOKEN }}
      
      - name: Trigger App Platform deploy
        run: |
          APP_ID=$(doctl apps list --format ID --no-header)
          doctl apps create-deployment $APP_ID --wait
```

**Required GitHub Secrets**:
- `DIGITALOCEAN_TOKEN`: Personal access token from DigitalOcean

---

## Monitoring and Observability

### Built-in App Platform Metrics

DigitalOcean provides basic metrics out of the box:
- CPU usage per service
- Memory usage
- Request count and latency (p50, p95, p99)
- HTTP error rates (4xx, 5xx)
- Active connections

Access via: **Apps → Your App → Insights**

### Log Aggregation

**Built-in Logs**:

```bash
# View live logs via CLI
doctl apps logs $APP_ID --follow

# View specific component
doctl apps logs $APP_ID --type run --follow
```

**Forward to External Service** (Datadog, Logtail, etc.):

Add log shipping in your app:

```javascript
// Node.js with Winston → Logtail
import winston from 'winston';
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';

const logtail = new Logtail(process.env.LOGTAIL_TOKEN);

const logger = winston.createLogger({
  transports: [new LogtailTransport(logtail)],
});

logger.info('Application started', { service: 'web' });
```

### Database Monitoring

DigitalOcean Managed Databases include:
- Connection pool stats
- Query performance insights
- Replication lag monitoring
- Disk usage alerts

```bash
# View database metrics
doctl databases metrics production-postgres
```

**Set up alerts**:

```bash
# Create CPU alert
doctl monitoring alert create \
  --type v1/insights/droplet/cpu \
  --threshold 80 \
  --window 5m \
  --entities production-postgres
```

### APM Integration

Integrate with Datadog, New Relic, or Sentry:

```bash
# Add APM env vars to App Platform
doctl apps update $APP_ID --set-env="DD_API_KEY=your-key"
doctl apps update $APP_ID --set-env="DD_SERVICE=myapp"
doctl apps update $APP_ID --set-env="DD_ENV=production"
```

---

## Cost Optimization Tips

### 1. Use Reserved Database Capacity

For predictable workloads, reserved capacity saves 20-30%:

```bash
# Currently not available via CLI, purchase through UI
# Databases → Manage → Reserved Capacity
```

### 2. Right-Size Your Instances

Start small, scale up based on metrics:

```yaml
# Start here
instance_size_slug: basic-xs  # $5/month, 512MB RAM

# Scale to this if needed
instance_size_slug: professional-xs  # $24/month, 1GB RAM
```

Monitor memory usage: If consistently >80%, upgrade. If <50%, downgrade.

### 3. Enable Auto-Scaling

Only pay for capacity during traffic spikes:

```yaml
autoscaling:
  min_instance_count: 2
  max_instance_count: 10
  metrics:
    cpu:
      percent: 75
```

### 4. Use Development Environments Wisely

Don't run staging 24/7:

```bash
# Pause staging app when not needed
doctl apps update $STAGING_APP_ID --spec staging-app.yaml

# In staging-app.yaml, set instance_count: 0
```

Or use ephemeral preview environments (GitHub integration).

### 5. Optimize Database Connections

Use connection pooling to reduce database cluster size:

```javascript
// Bad: Each request creates new connection
const client = new pg.Client(process.env.DATABASE_URL);
await client.connect();

// Good: Use connection pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,  // Match your DB pool size
});
```

---

## Common Gotchas and Troubleshooting

### 1. Connection Pool Exhaustion

**Problem**: "remaining connection slots are reserved" errors.

**Solution**: Use DigitalOcean's connection pooling:

```bash
# Create pool with transaction mode
doctl databases pool create production-postgres myapp-pool \
  --db myapp \
  --size 25 \
  --mode transaction

# Use pooled connection string (port 25061, not 25060)
```

### 2. SSL/TLS Certificate Issues

**Problem**: Database connection fails with SSL errors.

**Solution**: Download CA certificate:

```bash
# Download DigitalOcean CA cert
curl -O https://raw.githubusercontent.com/digitalocean/pg_ssl_cert/main/ca-certificate.crt

# Use in connection string
postgresql://user:pass@host:25060/db?sslmode=require&sslrootcert=ca-certificate.crt

# Or for Node.js
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('./ca-certificate.crt').toString(),
  },
});
```

### 3. Environment Variable Naming

**Problem**: Heroku uses `PORT`, DigitalOcean uses `APP_PORT`.

**Solution**: Adjust app startup:

```javascript
// Support both
const port = process.env.PORT || process.env.APP_PORT || 8080;
app.listen(port);
```

Or set `PORT` explicitly in App Platform env vars.

### 4. Build vs Runtime Commands

**Problem**: Database migrations run during build, but DB isn't accessible yet.

**Solution**: Use run commands, not build commands:

```yaml
# WRONG
build_command: npm run build && npm run migrate

# RIGHT
build_command: npm run build
run_command: npm run migrate && npm start
```

### 5. Regional Data Transfer Costs

**Problem**: High data transfer fees if database and app are in different regions.

**Solution**: Keep everything in same region + VPC:

```bash
# Ensure all resources use same region
--region nyc3  # For all components
```

Data transfer within same region + VPC is **free**.

---

## Real-World Migration Example

### Rails API + React Frontend + Sidekiq

**Heroku Setup**:
- 2× Standard-2X dynos (web)
- 2× Standard-2X dynos (worker)
- Standard-4 Postgres
- Premium-5 Redis
- **Total: $850/month**

**DigitalOcean Migration**:

1. **App Platform** (2 services):
```yaml
name: myapp-production
services:
  - name: web
    instance_count: 2
    instance_size_slug: professional-xs
    github:
      repo: myorg/myapp
      branch: main
    build_command: bundle exec rake assets:precompile
    run_command: bundle exec puma -C config/puma.rb
    
  - name: worker
    instance_count: 2
    instance_size_slug: professional-xs
    github:
      repo: myorg/myapp
      branch: main
    run_command: bundle exec sidekiq
```

2. **Managed Database**:
```bash
doctl databases create prod-postgres \
  --engine pg --version 15 --size db-s-4vcpu-8gb --region nyc3
```

3. **Managed Redis**:
```bash
doctl databases create prod-redis \
  --engine redis --version 7 --size db-s-2vcpu-2gb --region nyc3
```

4. **Spaces for ActiveStorage**:
```ruby
# config/storage.yml
digitalocean:
  service: S3
  endpoint: https://nyc3.digitaloceanspaces.com
  access_key_id: <%= ENV['SPACES_KEY'] %>
  secret_access_key: <%= ENV['SPACES_SECRET'] %>
  region: us-east-1
  bucket: myapp-production

# config/environments/production.rb
config.active_storage.service = :digitalocean
```

**Total DigitalOcean Cost**: $192/month
**Savings**: 77% ($658/month = $7,896/year)

**Migration Timeline**:
- **Week 1**: Set up infrastructure, test deployments
- **Week 2**: Configure database replication, test with prod data
- **Week 3**: Cutover database, switch DNS, monitor
- **Week 4**: Migrate Sidekiq jobs, decommission Heroku

**Downtime**: 15 minutes (DNS propagation during cutover)

---

## Key Takeaways

1. **Cost Savings are Real**: 60-88% reduction in infrastructure costs for equivalent performance
2. **Migration is Incremental**: Parallel run + cutover minimizes risk
3. **Use Managed Services**: Don't self-manage databases just because you can
4. **Connection Pooling is Critical**: Avoids database scaling issues
5. **Regional Consistency Matters**: Keep resources in same region + VPC for free data transfer
6. **Terraform from Day 1**: Infrastructure as code prevents configuration drift
7. **Test with Production Data**: Run shadow environment before cutover

---

## The Bottom Line

Migrating from Heroku to DigitalOcean isn't about abandoning managed services — it's about **choosing better-priced managed services**. You keep the developer experience (git push deployments, managed databases, zero-config SSL) while cutting costs by 60-80%.

The migration itself takes 3-4 weeks with minimal downtime when done incrementally. For most teams spending >$200/month on Heroku, the savings justify the effort within 2-3 months.

**When to migrate**:
- Heroku bill >$200/month
- You have 1+ engineer who can dedicate 20-30 hours over 3-4 weeks
- Your app uses standard patterns (PostgreSQL, Redis, S3)
- You want cost predictability

**When to stay on Heroku**:
- Bill <$100/month (migration effort not worth it)
- You need Heroku-specific add-ons with no alternatives
- Team has zero DevOps experience and no time to learn
- You're pre-product-market-fit and optimizing for speed over cost

**Get started**: [Sign up for DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) and receive $200 in credits to test your migration risk-free.
