---
title: 'From $2,000/mo Heroku to $24/mo Self-Hosting: A Migration Story'
excerpt: 'How we migrated from expensive Heroku dynos to a self-managed DigitalOcean server using Coolify, cutting costs by 98% while maintaining reliability.'
category:
  name: 'Cloud'
  slug: 'cloud'
coverImage: '/images/posts/replacing-heroku-with-self-hosting.png'
ogImage: '/images/posts/replacing-heroku-with-self-hosting.png'
date: '2026-03-03'
publishedAt: '2026-03-03T10:00:00Z'
updatedAt: '2026-03-03T10:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Heroku
  - Self-Hosting
  - Cost Optimization
  - DigitalOcean
  - Coolify
  - DevOps
---

"Your Heroku invoice for this month: $2,147.32."

That email hit differently when our startup was still finding product-market fit. We weren't running some massive operation—just three Node.js services, a PostgreSQL database, and Redis for caching. But Heroku's pricing model meant we were burning cash at an unsustainable rate.

Three months later, we're running the exact same workload on a single $24/month DigitalOcean droplet with Coolify. Our infrastructure is more transparent, performance is better, and we've reclaimed 98% of our hosting budget.

This isn't a hit piece on Heroku—it's a great platform that solved real problems for us early on. But there comes a point where the convenience tax becomes too expensive, especially when modern self-hosting tools have caught up.

**TLDR**: We migrated from $2,000+/month Heroku to a $24/month self-hosted setup using DigitalOcean and Coolify. This post walks through the full migration process, real costs, performance comparisons, and lessons learned. If you're comfortable with basic DevOps and your Heroku bill keeps climbing, this guide shows exactly how to make the switch.

## What We Were Running on Heroku

Before diving into the migration, here's what our Heroku setup looked like:

```
Heroku Resources (Monthly Cost):

Dynos:
- 6x Standard-2X dynos ($50/ea × 6)     = $300
- 2x Performance-M dynos ($250/ea × 2)  = $500

Add-ons:
- Heroku Postgres Standard-0 ($50)      = $50
- Heroku Redis Premium-0 ($60)          = $60
- Heroku Data for Redis ($15)           = $15
- SSL Certificates (SNI included)       = $0
- Papertrail ($7)                       = $7

Data Transfer:
- Outbound data (~500GB/mo)             = ~$200

Build Minutes:
- CI builds (not primary cost)          = $50

Pipeline/Review Apps:                   = $965

TOTAL: ~$2,147/month
```

The breakdown showed some obvious cost centers:
- Performance dynos for our API were expensive but necessary for memory
- We had separate staging and review app environments that were expensive
- Data transfer costs weren't obvious until we dug into billing

## The Self-Hosted Alternative: DigitalOcean + Coolify

Here's what we moved to:

```
Self-Hosted Setup (Monthly Cost):

DigitalOcean Droplet:
- Basic Droplet: 4GB RAM, 2 vCPUs, 80GB SSD  = $24

Optional Enhancements:
- Managed PostgreSQL (1GB RAM, 10GB disk)   = $15
- Managed Redis (1GB, optional)             = $15
- Backups (20% of droplet cost)             = $5
- Cloudflare CDN (free tier)                = $0

TOTAL BASE: $24/month
TOTAL WITH MANAGED SERVICES: $59/month

Savings: $2,088 - $2,123/month (97-98%)
```

The $24/month droplet specs:
- **4GB RAM**: More than enough for our workload
- **2 vCPUs**: Dedicated CPU, not shared
- **80GB SSD**: NVMe storage, very fast
- **4TB transfer**: More than we were using on Heroku

### Why Coolify?

[Coolify](https://coolify.io) is an open-source, self-hostable Heroku alternative. Think of it as your own personal PaaS that you run on your own infrastructure.

Key features that sold us:
- **Git-based deployments**: Push to GitHub/GitLab, auto-deploy
- **Docker-based**: Each app runs in containers
- **Built-in SSL**: Automatic Let's Encrypt certificates
- **Database management**: PostgreSQL, MySQL, Redis, MongoDB support
- **Zero-downtime deployments**: Health checks and rolling deploys
- **Resource monitoring**: Built-in metrics and logs
- **Secrets management**: Environment variables per app

It bridges the gap between "easy button" PaaS and "figure it all out yourself" VPS hosting.

## The Migration Process

Here's exactly how we migrated, step by step.

### Phase 1: Infrastructure Setup (Day 1)

**1. Create DigitalOcean Droplet**

We went with the $24/month droplet in NYC3 region (closest to our users):

```bash
# Using DigitalOcean CLI (doctl)
doctl compute droplet create coolify-prod \\
  --image ubuntu-22-04-x64 \\
  --size s-2vcpu-4gb \\
  --region nyc3 \\
  --ssh-keys <your-ssh-key-id> \\
  --enable-monitoring \\
  --enable-backups
```

Or use the DigitalOcean web console:
- Choose "Marketplace" → Search for "Coolify"
- Or use the regular Ubuntu 22.04 image and install Coolify manually

**2. Install Coolify**

SSH into your droplet:

```bash
ssh root@your-droplet-ip

# Install Coolify (one command)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

The installer:
- Installs Docker and Docker Compose
- Sets up Coolify services
- Configures firewall rules
- Takes about 5 minutes

**3. Access Coolify Dashboard**

After installation:
- Navigate to `http://your-droplet-ip:3000`
- Complete the initial setup wizard
- Set admin password
- Configure your domain (optional but recommended)

**4. Configure DNS**

Point your domains to the droplet:

```
A Record:
coolify.yourdomain.com → your-droplet-ip

Wildcard (for apps):
*.yourdomain.com → your-droplet-ip
```

### Phase 2: Database Migration (Day 1-2)

This was the most critical part. We had two options:

**Option A: Self-hosted databases on the same droplet**
- Lower cost ($24 total)
- More manual backup management
- Good for small workloads

**Option B: DigitalOcean Managed Databases**
- Automated backups and failover
- Separate billing (~$15-30/month)
- Better for production workloads

We chose Option B for peace of mind.

**Migrate PostgreSQL Data**

1. Create a managed PostgreSQL cluster on DigitalOcean:

```bash
doctl databases create postgres-prod \\
  --engine pg \\
  --version 15 \\
  --size db-s-1vcpu-1gb \\
  --region nyc3
```

2. Export data from Heroku Postgres:

```bash
# Get connection details from Heroku
heroku pg:credentials:url DATABASE_URL --app your-app

# Dump the database
pg_dump -Fc --no-acl --no-owner \\
  -h ec2-xxx.compute-1.amazonaws.com \\
  -U your-user \\
  -d your-db > heroku_dump.dump
```

3. Import to DigitalOcean:

```bash
# Restore to DigitalOcean managed DB
pg_restore --verbose --clean --no-acl --no-owner \\
  -h your-do-db-host \\
  -U doadmin \\
  -d defaultdb heroku_dump.dump
```

**Migrate Redis Data**

For Redis, we chose to start fresh since it was just cache. If you need to migrate:

```bash
# Save RDB snapshot from Heroku Redis
redis-cli -h <heroku-redis-host> -p <port> -a <password> --rdb heroku-redis.rdb

# On your new server, stop Redis temporarily
sudo systemctl stop redis

# Replace dump.rdb with your backup
sudo cp heroku-redis.rdb /var/lib/redis/dump.rdb
sudo chown redis:redis /var/lib/redis/dump.rdb

# Restart Redis to load the data
sudo systemctl start redis
```

### Phase 3: Application Migration (Day 2-3)

**1. Create Apps in Coolify**

In Coolify dashboard:
- Click "New Resource" → "Application"
- Connect your Git repository
- Choose branch (e.g., `main`)
- Set build pack (Node.js, Python, etc.)

**2. Configure Environment Variables**

Export from Heroku:

```bash
heroku config --app your-app --shell > .env.production
```

Import to Coolify:
- In app settings → Environment Variables
- Paste the entire `.env.production` content
- Update database URLs to point to new databases

**3. Configure Build Settings**

For a typical Node.js app:

```dockerfile
# Coolify auto-detects this, but you can customize
# Base Image: node:20-alpine
# Build Command: npm ci && npm run build
# Start Command: npm start
# Port: 3000
```

**4. Deploy**

Click "Deploy" in Coolify. It will:
- Clone your repository
- Build a Docker image
- Run health checks
- Start the container
- Set up SSL with Let's Encrypt

### Phase 4: Testing and Cutover (Day 3-4)

**1. Test on Staging Domain**

Before switching production traffic:
- Deploy to `staging.yourdomain.com`
- Run integration tests
- Verify database connections
- Check performance under load

**2. Load Testing**

We used k6 to compare performance:

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
};

export default function () {
  let response = http.get('https://staging.yourdomain.com/api/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  sleep(1);
}
```

Run the test:

```bash
k6 run load-test.js
```

**Results comparison:**

```
Heroku Performance-M Dyno:
- Avg response time: 156ms
- p95 response time: 287ms
- Max concurrent: 200 requests

Self-hosted on $24 droplet:
- Avg response time: 89ms
- p95 response time: 178ms
- Max concurrent: 350 requests
```

The self-hosted setup was actually **faster** because:
- Dedicated resources (not shared)
- Geographic proximity to database
- NVMe SSD storage
- No dyno sleep/wake cycles

**3. DNS Cutover**

When ready to switch:

```
# Update A records
api.yourdomain.com → new-droplet-ip
www.yourdomain.com → new-droplet-ip

# Lower TTL before cutover (24 hours earlier)
TTL: 300 (5 minutes)
```

**4. Monitor Closely**

After cutover:
- Watch application logs in Coolify
- Monitor resource usage
- Check error rates
- Verify database connections

We kept Heroku running in read-only mode for 48 hours as a backup.

## Performance Comparison: Real Numbers

After running on self-hosted for 3 months, here's how it compares:

### Response Times

```
API Endpoint         Heroku    Self-Hosted   Change
----------------------------------------------------
GET /api/users       142ms     87ms          -39%
POST /api/auth       198ms     112ms         -43%
GET /api/dashboard   267ms     189ms         -29%

Average              202ms     129ms         -36%
```

### Resource Utilization

**$24 DigitalOcean Droplet (4GB RAM, 2 vCPU):**

```
Average Load:
- CPU: 22% (1.5 load average)
- RAM: 2.8GB used (70%)
- Disk I/O: Low (<10% wait)
- Network: 120GB/month transfer

Peak Load:
- CPU: 68%
- RAM: 3.4GB (85%)
- Still responsive
```

We have significant headroom. This droplet could handle 3-4x our current traffic before needing an upgrade.

### Uptime

```
Heroku (last 3 months before migration):
- Uptime: 99.87%
- Incidents: 2 (platform-wide issues)

Self-hosted (3 months after migration):
- Uptime: 99.94%
- Incidents: 1 (unplanned reboot for kernel update)
```

## Cost Breakdown: Where the Savings Come From

Let's break down exactly why this is so much cheaper:

### Heroku's Pricing Model

Heroku charges for:
1. **Compute**: Per dyno, per month
2. **Add-ons**: Separate charges for DB, Redis, etc.
3. **Data transfer**: Outbound data charges
4. **Support**: Professional/premium support tiers

```
Heroku Cost Analysis:

Performance-M dyno: $250/month
  - 2.5GB RAM
  - Shared CPU
  - Vertical scaling only

To match our load (6GB RAM total):
  - Need 3x Performance-M dynos
  - Cost: $750/month
  - Plus load balancing overhead
```

### Self-Hosting Model

```
DigitalOcean Droplet: $24/month
  - 4GB RAM (dedicated)
  - 2 vCPU (dedicated)
  - 4TB transfer included
  - No per-app charges

Run unlimited apps on same droplet
  - Only limited by resources
  - No marginal cost per service
```

**The key difference**: You pay for resources used, not resources allocated per app.

### When Heroku Still Makes Sense

Despite the savings, Heroku is still the right choice if:

1. **You're pre-product-market fit**: Focus on product, not infrastructure
2. **Team has zero DevOps experience**: Heroku's simplicity is worth paying for
3. **Compliance requirements**: Enterprise Heroku provides SOC 2, HIPAA, etc.
4. **Complex multi-region**: Heroku's global routing is sophisticated
5. **Time is more valuable than money**: If engineer time costs more than the hosting savings

For us, we had:
- One engineer comfortable with basic DevOps
- Stable product with predictable traffic
- Tight budget constraints
- Single-region deployment needs

Self-hosting made sense.

## Operational Differences: What Changes

Moving from Heroku to self-hosted isn't just a cost decision—it's an operational shift.

### What You Gain

**Full control**:
- Choose your database version
- Install any system packages
- Configure OS-level optimizations
- Direct server access for debugging

**Transparency**:
- See actual resource usage
- Understand what's consuming resources
- No "mystery" performance issues

**Cost predictability**:
- Fixed monthly cost regardless of app count
- No surprise charges
- Easy to forecast expenses

### What You Lose

**Automatic scaling**:
- Heroku: Slider to add dynos
- Self-hosted: Manual droplet resizing or load balancer setup

**Platform-managed updates**:
- Heroku: Security patches automatic
- Self-hosted: You run `apt update && apt upgrade`

**Zero-config add-ons**:
- Heroku: Click to add Redis
- Self-hosted: Configure and manage yourself

**Built-in CI/CD**:
- Heroku: Automatic deploys from GitHub
- Self-hosted: Coolify handles this, but you configure it

### New Responsibilities

With self-hosting, you're now responsible for:

1. **Security updates**: Regular server patching
2. **Backups**: Verify backup processes work
3. **Monitoring**: Set up alerts for issues
4. **SSL renewal**: (Coolify auto-handles this via Let's Encrypt)
5. **Capacity planning**: Monitor and upgrade when needed

**Time investment**: ~2-4 hours/month for maintenance

For us, this was acceptable. One engineer does a monthly maintenance window:
- Apply system updates
- Review monitoring dashboards
- Verify backups
- Check resource trends

## Lessons Learned: What We'd Do Differently

After 3 months of self-hosting, here's what we learned:

### 1. Start with Managed Databases

We initially tried self-hosting PostgreSQL on the same droplet. Bad idea. Backups were manual, and we didn't sleep well.

**Lesson**: Use DigitalOcean Managed Databases ($15/month for 1GB). The peace of mind is worth it.

### 2. Set Up Monitoring from Day One

We waited a week before configuring proper alerts. Had a disk space issue that could've been caught earlier.

**What we use now**:
- Coolify's built-in monitoring
- DigitalOcean monitoring alerts
- UptimeRobot for external health checks
- Sentry for application errors

### 3. Document Everything

Heroku's documentation was our guide. With self-hosting, you are the documentation.

**Our wiki now includes**:
- Deployment procedures
- Rollback steps
- Database backup/restore process
- Common troubleshooting steps
- Access credentials (in 1Password)

### 4. Test Disaster Recovery

We assumed backups worked. Never tested a full restore until we needed one.

**Best practice**: Monthly DR drill
- Restore database backup to test environment
- Verify application works with restored data
- Document any issues

### 5. Use CDN from the Start

We added Cloudflare CDN after noticing high bandwidth usage for static assets.

**Result**: Reduced origin traffic by 70%, improved global load times

### 6. Keep Coolify Updated

Coolify is actively developed. Updates bring bug fixes and features.

```bash
# Update Coolify (takes ~2 minutes)
coolify update
```

We update monthly during maintenance windows.

## Scaling Strategy: When You Outgrow $24/month

The $24 droplet won't last forever. Here's our growth plan:

### Stage 1: Vertical Scaling ($24 → $48)

When CPU consistently >70% or RAM >85%:
- Resize to 8GB RAM, 4 vCPU droplet ($48/month)
- DigitalOcean allows seamless resizing
- ~5 minutes downtime during resize

**Capacity**: 2-3x current traffic

### Stage 2: Horizontal Scaling ($48 → $150)

When single droplet can't handle load:
- Add load balancer ($12/month)
- Add 2 more droplets ($48 × 2)
- Use managed PostgreSQL with read replicas

**Capacity**: 6-8x current traffic

### Stage 3: Multi-Region ($150 → $500+)

For global traffic:
- Droplets in multiple regions
- GeoDNS routing
- Database replication across regions

At this scale, we'd reevaluate whether to move to Kubernetes or stick with Coolify.

**Key insight**: Even at $500/month with multi-region and high availability, we're still 75% cheaper than Heroku.

## Migration Checklist: Your Step-by-Step Guide

If you're considering this migration, here's your complete checklist:

### Pre-Migration (Week Before)

- [ ] Audit current Heroku usage and costs
- [ ] Document all apps, databases, add-ons
- [ ] Export environment variables
- [ ] Identify any Heroku-specific features you use
- [ ] Choose target droplet size
- [ ] Decide: self-hosted DB vs managed DB

### Setup (Day 1)

- [ ] Create DigitalOcean account
- [ ] Deploy droplet with Coolify
- [ ] Configure DNS records (with low TTL)
- [ ] Set up SSL certificates
- [ ] Create managed databases (if using)

### Migration (Day 1-3)

- [ ] Export Heroku database backups
- [ ] Import data to new databases
- [ ] Verify data integrity
- [ ] Configure apps in Coolify
- [ ] Set environment variables
- [ ] Test deployments on staging domains

### Testing (Day 3-4)

- [ ] Run integration tests
- [ ] Perform load testing
- [ ] Compare performance metrics
- [ ] Test all critical user flows
- [ ] Verify third-party integrations

### Cutover (Day 4-5)

- [ ] Schedule maintenance window
- [ ] Update DNS records
- [ ] Monitor application closely (4-8 hours)
- [ ] Keep Heroku running as backup (48 hours)
- [ ] Verify no errors in production

### Post-Migration (Week After)

- [ ] Set up monitoring and alerts
- [ ] Configure automated backups
- [ ] Test backup restoration
- [ ] Document operational procedures
- [ ] Review and optimize resource usage
- [ ] Cancel Heroku subscription (after verification period)

## Alternatives to Coolify

Coolify isn't the only option. Here are other self-hosting tools we considered:

### CapRover

- Similar to Coolify
- Docker-based deployments
- One-click apps (WordPress, Ghost, etc.)
- Free and open-source

**Why we chose Coolify**: Better UI, more active development, Docker Compose support

### Dokku

- Oldest self-hosted Heroku alternative
- Buildpack-based (like Heroku)
- Very lightweight
- CLI-focused

**Why we chose Coolify**: Wanted web UI, easier for team to manage

### Kamal (formerly MRSK)

- From the Rails/37signals team
- Zero-downtime deployments
- Docker-based
- Very minimal, focused on simplicity

**Why we chose Coolify**: Needed database management, not just app deployment

### Kubernetes (K3s/MicroK8s)

- Production-grade orchestration
- Scales infinitely
- Industry standard

**Why we chose Coolify**: Overkill for our scale, higher operational complexity

## Final Thoughts: Who Should Make This Switch

After 3 months of self-hosting, we're confident this was the right move for us. But it's not for everyone.

### You should consider self-hosting if:

✅ Monthly Heroku bill >$500
✅ You have at least one engineer comfortable with Linux/Docker
✅ Your product is stable (not rapidly changing infrastructure needs)
✅ You're willing to take on operational responsibility
✅ You want to understand your infrastructure deeply
✅ Cost savings directly impact your runway or profitability

### Stick with Heroku if:

❌ Monthly Heroku bill <$300 (convenience worth the premium)
❌ Team has zero DevOps knowledge
❌ You're pre-product-market fit (focus on product)
❌ Compliance requirements need enterprise features
❌ You need sophisticated multi-region setup immediately
❌ Engineer time is more expensive than hosting savings

### The Sweet Spot

The ideal candidates for this migration:
- Small to medium teams (2-20 people)
- Stable applications with predictable traffic
- Heroku bills between $500-$5,000/month
- At least one engineer with basic DevOps skills
- Single-region deployments
- Standard web applications (not complex distributed systems)

For us, migrating from $2,000/month to $24/month wasn't just about the money (though that helped our runway significantly). It was about understanding our infrastructure, removing mystery, and building operational maturity as a team.

The tools have evolved. Self-hosting in 2026 with Coolify feels remarkably similar to Heroku, just with more transparency and dramatically lower costs.

If your Heroku bill keeps you up at night, this migration path is proven and achievable. Start with one non-critical app, learn the system, then migrate production when you're comfortable.

---

## Resources

- [Coolify Documentation](https://coolify.io/docs)
- [DigitalOcean Pricing](https://www.digitalocean.com/pricing)
- [Coolify GitHub](https://github.com/coollabsio/coolify)
- [DigitalOcean Marketplace - Coolify](https://marketplace.digitalocean.com/apps/coolify)
- [Database Migration Tools](https://www.digitalocean.com/community/tutorials/how-to-migrate-postgresql-database)

*Have questions about self-hosting? Reach out in the comments or on our community Discord.*
