---
title: 'RDS - Managed Database Services'
description: 'Run MySQL, PostgreSQL, or SQL Server on AWS RDS without managing servers. Covers backups, patching, scaling, Multi-AZ failover, and choosing an instance class.'
order: 6
---

Running a database is like maintaining a high-performance car - it requires regular tune-ups, monitoring, backups, and expertise to keep it running smoothly. Amazon RDS (Relational Database Service) is like having a professional pit crew handle all the maintenance while you focus on using the car.

RDS takes popular databases like MySQL, PostgreSQL, and SQL Server, and handles all the behind-the-scenes work that database administrators usually do.

## Why Use Managed Databases?

Traditional database management involves:

- Installing and configuring database software
- Setting up automated backups
- Applying security patches
- Monitoring performance and scaling
- Planning for disaster recovery
- Handling hardware failures

RDS handles all of this automatically, letting you focus on your application instead of database maintenance.

## What RDS Manages for You

### Automatic Backups

RDS backs up your database daily and keeps transaction logs, allowing you to restore to any point in time within your retention period (up to 35 days).

### Software Updates

Database engines receive regular security patches and updates, applied during maintenance windows you control.

### Monitoring and Alerts

Built-in monitoring tracks database performance, connections, and resource usage with CloudWatch integration.

### High Availability

Multi-AZ deployments automatically replicate your database to a standby instance in a different data center.

### Scaling

Increase CPU, memory, or storage with minimal downtime as your application grows.

## Choosing Your Database Engine

RDS supports six database engines, each with different strengths:

### PostgreSQL (Recommended for Beginners)

- **Best for**: Most web applications, data analysis, complex queries
- **Strengths**: Feature-rich, excellent standards compliance, strong community
- **Cost**: Free (open source license)

### MySQL

- **Best for**: Web applications, content management systems
- **Strengths**: Widely used, lots of documentation and tutorials
- **Cost**: Free (open source license)

### Amazon Aurora

- **Best for**: High-performance applications needing MySQL/PostgreSQL compatibility
- **Strengths**: Better performance than standard MySQL/PostgreSQL, AWS-native features
- **Cost**: More expensive but better performance per dollar

### SQL Server

- **Best for**: Windows applications, .NET development
- **Strengths**: Tight Microsoft integration, familiar to Windows developers
- **Cost**: Requires Microsoft licensing (expensive)

### Oracle

- **Best for**: Enterprise applications with existing Oracle investments
- **Strengths**: Advanced features for large-scale applications
- **Cost**: Expensive licensing

### MariaDB

- **Best for**: MySQL alternative with enhanced features
- **Strengths**: MySQL-compatible with additional capabilities
- **Cost**: Free (open source license)

## Understanding RDS Instance Classes

Like EC2 instances, RDS uses different "classes" optimized for different workloads:

### Burstable Performance (t3/t4g)

- **Best for**: Development, testing, small applications
- **Cost**: Lowest cost option
- **Performance**: Variable (bursts when needed)
- **Example**: db.t3.micro (free tier eligible)

### General Purpose (m5/m6i)

- **Best for**: Most production applications
- **Cost**: Balanced price/performance
- **Performance**: Consistent and reliable
- **Example**: db.m5.large

### Memory Optimized (r5/r6i)

- **Best for**: In-memory databases, analytics workloads
- **Cost**: Higher cost for more memory
- **Performance**: High memory-to-CPU ratio
- **Example**: db.r5.xlarge

For learning and small applications, start with db.t3.micro (free tier) and scale up as needed.

## Creating Your First RDS Database

Let's create a PostgreSQL database for a web application.

### Planning Your Database

Before creating anything, consider:

- **What data will you store**: User accounts, blog posts, e-commerce products?
- **How much data**: A few MB or several GB?
- **Performance needs**: How many concurrent users?
- **Backup requirements**: How often and how long to keep backups?

### Database Configuration

**Engine**: PostgreSQL (latest version)
**Instance Class**: db.t3.micro (free tier)
**Storage**: 20 GB General Purpose SSD (free tier)
**Multi-AZ**: Disabled for cost savings (enable in production)

### Network and Security

**VPC**: Use the custom VPC you created earlier
**Subnet Group**: Place in private subnets (not directly accessible from internet)
**Security Groups**: Allow access only from your web servers

### Database Settings

**Database Name**: Create an initial database (like `webapp_production`)
**Master Username**: Choose something like `dbadmin`
**Master Password**: Use a strong, unique password

## Connecting to Your Database

Once your RDS instance is running, you'll need to connect to it from your applications.

### From Your Computer (for testing)

If you want to connect directly from your laptop for testing:

```bash
# Install PostgreSQL client
# On Mac: brew install postgresql
# On Ubuntu: sudo apt install postgresql-client

# Connect to your database
psql -h your-database-endpoint.amazonaws.com -U dbadmin -d webapp_production
```

### From Your EC2 Instances

Your web servers will connect to the database using connection strings:

```javascript
// Example Node.js connection
const { Pool } = require('pg');

const pool = new Pool({
  host: 'your-database-endpoint.amazonaws.com',
  port: 5432,
  database: 'webapp_production',
  user: 'webapp_user',
  password: process.env.DB_PASSWORD, // Store password in environment variable
  max: 20, // Maximum number of connections in pool
});
```

### Connection Best Practices

**Use connection pooling**: Don't create a new connection for every request
**Store credentials securely**: Use environment variables or AWS Secrets Manager
**Handle connection errors**: Databases can become temporarily unavailable
**Monitor connection usage**: Too many connections can cause performance issues

## Database Security

### Network Security

**Private Subnets**: Keep databases in private subnets without direct internet access
**Security Groups**: Only allow connections from specific sources (your web servers)
**VPC**: Use your custom VPC, not the default VPC

### Access Control

**Database Users**: Create application-specific users with limited permissions
**Strong Passwords**: Use long, complex passwords stored securely
**SSL/TLS**: Always encrypt connections between applications and database

### Example Security Setup

```sql
-- Connect as master user and create application user
CREATE USER webapp_user WITH PASSWORD 'strong_random_password';
CREATE DATABASE webapp_production OWNER webapp_user;

-- Grant only necessary permissions
GRANT CONNECT ON DATABASE webapp_production TO webapp_user;
GRANT USAGE ON SCHEMA public TO webapp_user;
GRANT CREATE ON SCHEMA public TO webapp_user;
```

## Understanding RDS Storage

RDS offers different storage types optimized for different needs:

### General Purpose SSD (gp2)

- **Best for**: Most applications
- **Performance**: 3 IOPS per GB, burstable to 3,000 IOPS
- **Cost**: Balanced cost and performance
- **Size**: 20 GB to 64 TB

### Provisioned IOPS SSD (io1)

- **Best for**: I/O intensive applications
- **Performance**: Up to 64,000 IOPS, consistent performance
- **Cost**: Higher cost for guaranteed performance
- **Size**: 100 GB to 64 TB

### Magnetic Storage

- **Best for**: Infrequently accessed data
- **Performance**: About 100 IOPS
- **Cost**: Lowest cost option
- **Size**: 10 GB to 3 TB

For most applications, General Purpose SSD provides the best balance of performance and cost.

## Backup and Recovery Strategies

### Automated Backups

RDS automatically backs up your database:

- **Daily snapshots**: Complete database backup
- **Transaction logs**: Allow point-in-time recovery
- **Retention period**: 1-35 days (you choose)
- **Backup window**: Schedule during low-usage periods

### Manual Snapshots

Create snapshots before major changes:

- **Before software deployments**: Easy rollback if something goes wrong
- **Before data migrations**: Restore if migration fails
- **Periodic checkpoints**: Additional safety beyond automated backups

### Point-in-Time Recovery

Restore your database to any moment within your backup retention period:

- **Accidental data deletion**: Restore to just before the mistake
- **Corruption discovery**: Go back to when data was known to be good
- **Testing scenarios**: Create a copy of production data at a specific point

## Scaling Your Database

As your application grows, you'll need to scale your database:

### Vertical Scaling (Scale Up)

Increase the power of your existing database:

- **More CPU**: Handle more concurrent connections
- **More memory**: Cache more data for faster queries
- **More storage**: Store more data
- **Better network**: Handle more traffic

Vertical scaling involves brief downtime (usually a few minutes) during the upgrade.

### Read Replicas (Scale Out)

Create read-only copies of your database:

- **Reduce load**: Distribute read queries across multiple databases
- **Geographic distribution**: Place replicas closer to users
- **Reporting**: Run analytics queries without affecting main database
- **High availability**: Promote replica to primary if main database fails

### When to Scale

Monitor these metrics to know when scaling is needed:

- **CPU utilization**: Consistently above 80%
- **Memory usage**: High percentage of available memory used
- **Connection count**: Approaching your instance's connection limit
- **Query performance**: Queries taking longer than usual

## Multi-AZ Deployments for High Availability

Multi-AZ creates a standby copy of your database in a different data center:

### How Multi-AZ Works

1. **Synchronous replication**: Every write is copied to the standby immediately
2. **Automatic failover**: If the primary fails, RDS switches to standby within 60-120 seconds
3. **Same endpoint**: Your application doesn't need to know about the failover
4. **Automatic recovery**: Failed primary is repaired and becomes the new standby

### When to Use Multi-AZ

- **Production applications**: Where downtime is costly
- **Compliance requirements**: Some regulations require high availability
- **Peace of mind**: Sleep better knowing your database can handle failures

### Multi-AZ vs. Read Replicas

**Multi-AZ**: High availability, automatic failover, same region
**Read Replicas**: Performance scaling, manual promotion, can be in different regions

## Cost Management for RDS

### Understanding RDS Pricing

RDS pricing includes:

- **Instance hours**: Based on instance class and engine
- **Storage**: GB per month for allocated storage
- **I/O requests**: Charges for database operations (some instance classes include these)
- **Backups**: Storage beyond your backup retention period
- **Data transfer**: Moving data between regions or to the internet

### Cost Optimization Strategies

**Right-size instances**: Monitor usage and adjust instance class as needed
**Reserved Instances**: Commit to 1-3 years for significant discounts (30-60% savings)
**Storage optimization**: Don't over-allocate storage, but plan for growth
**Backup management**: Balance retention needs with storage costs

### Free Tier Benefits

New AWS accounts get:

- **750 hours per month** of db.t2.micro or db.t3.micro instances
- **20 GB of storage** (any type)
- **20 GB of backup storage**

This is enough to run a small database 24/7 during your first year.

## Monitoring Your Database

### Built-in Monitoring

RDS provides automatic monitoring through CloudWatch:

- **CPU utilization**: How hard your database is working
- **Connection count**: Number of active connections
- **Read/write IOPS**: Database activity levels
- **Free storage**: Available disk space

### Performance Insights

Enhanced monitoring provides deeper visibility:

- **Top SQL statements**: Which queries use the most resources
- **Wait events**: What your database spends time waiting for
- **Database load**: Overall performance patterns

### Setting Up Alerts

Create CloudWatch alarms for important metrics:

- **High CPU**: Alert when consistently above 80%
- **Low storage**: Warn when storage is running low
- **Connection limits**: Alert when approaching connection limits
- **Backup failures**: Immediate notification of backup issues

## Common Database Patterns

### Web Application Pattern

**Architecture**: Web servers in public subnets, database in private subnet
**Security**: Database only accessible from web servers
**Scaling**: Start small, add read replicas as traffic grows
**Backups**: Daily automated backups with 7-day retention

### Development/Testing Pattern

**Architecture**: Single database instance, possibly shared across projects
**Security**: Relaxed security for easier development access
**Scaling**: Minimal - focus on cost savings
**Backups**: Shorter retention, manual snapshots before major changes

### Enterprise Pattern

**Architecture**: Multi-AZ primary with read replicas
**Security**: Encryption at rest and in transit, strict access controls
**Scaling**: Reserved instances, automated scaling policies
**Backups**: Extended retention, cross-region backup copies

## Troubleshooting Common Issues

### Connection Problems

**Can't connect from application**:

- Check security groups allow traffic on database port
- Verify database is in same VPC as application
- Confirm connection string is correct

**Too many connections**:

- Implement connection pooling in your application
- Monitor and close unused connections
- Consider upgrading to larger instance class

### Performance Issues

**Slow queries**:

- Use Performance Insights to identify problematic queries
- Review database indexes
- Consider read replicas for read-heavy workloads

**High CPU usage**:

- Optimize database queries
- Add appropriate indexes
- Scale up to larger instance class

### Storage Issues

**Running out of space**:

- Enable storage auto-scaling
- Increase allocated storage
- Clean up old data or implement archiving

## When Not to Use RDS

While RDS is great for most applications, consider alternatives for:

### NoSQL Requirements

Use DynamoDB for key-value or document storage needs

### Extreme Performance Needs

Consider running databases on EC2 with specialized configurations

### Specific Software Requirements

Some applications need database configurations not supported by RDS

### Cost-Sensitive Development

For learning or very small projects, consider running databases on small EC2 instances

## Next Steps

With your database running securely in RDS, you're ready to learn about handling traffic growth with load balancing and auto-scaling. These services work together with RDS to create applications that can handle varying loads automatically.

Your database provides the foundation for storing data reliably, while load balancers and auto-scaling ensure your web servers can handle however many users you have, from dozens to millions.

Understanding how these pieces work together is key to building applications that are both scalable and cost-effective.
