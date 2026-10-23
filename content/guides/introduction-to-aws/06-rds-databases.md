---
title: 'RDS: Managed Databases'
description: 'Run PostgreSQL or MySQL on Amazon RDS: create a private database, connect over TLS, keep the password in Secrets Manager, and use backups and Multi-AZ.'
order: 6
---

**TLDR**: Amazon RDS runs the database engine for you: installs it, patches it, backs it up and fails it over. You choose the engine, instance class and storage, and put it in private subnets with a security group that only your web servers can reach. Let RDS keep the master password in Secrets Manager, connect with TLS, and give the application its own limited user. A restore always creates a new instance. Multi-AZ adds a standby in another AZ; read replicas add read capacity.

Running a database yourself means installing it, tuning it, applying security patches, testing backups, and getting up at night when a disk fills. Amazon Relational Database Service (RDS) takes over most of that. You still own the schema, the queries, the users and the capacity decisions.

In this part, the photo app gets a PostgreSQL database in the private subnets from Part 5.

## Prerequisites

- The `photo-app` VPC with two private database subnets, the `photo-app-db` security group, and the `photo-app-dev-web` instance in the new VPC, all from [Part 5](/guides/introduction-to-aws/05-vpc-networking).
- The [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) for the AWS CLI on your computer, for the tunnel to the database.
- A PostgreSQL client (`psql`) on your computer. The [PostgreSQL guide](/guides/introduction-to-postgres/02-installation-and-setup) shows how to install only the client.

## What RDS Does and What You Still Do

| RDS handles                                 | You handle                                      |
| ------------------------------------------- | ----------------------------------------------- |
| Installing and patching the engine and OS   | Choosing the engine version and when to upgrade |
| Automated backups and point-in-time restore | Testing that a restore works                    |
| Multi-AZ replication and automatic failover | Deciding whether you need it                    |
| Storage, which can grow automatically       | Schema, indexes and slow queries                |
| Metrics in CloudWatch                       | Users, permissions and connection limits        |

You do not get a shell on the database host, and you get admin rights that are close to, but not quite, a superuser.

## Choose an Engine and Version

RDS runs **PostgreSQL**, **MySQL**, **MariaDB**, **Oracle**, **Microsoft SQL Server** and **IBM Db2**. **Amazon Aurora** is AWS's own engine, compatible with MySQL or PostgreSQL, with storage that is replicated across three AZs; it costs more but fails over faster and scales reads further.

For new applications, PostgreSQL or MySQL are the usual choices. Pick a current major version:

- **PostgreSQL 18** is available on RDS since November 2025.
- **MySQL 8.4** is the current long-term version. **MySQL 8.0** left RDS standard support on 31 July 2026.

Every major version reaches the end of standard support eventually. If you keep running it, RDS moves the instance to **RDS Extended Support** and adds a per-vCPU hourly charge on top of the normal price. Plan major version upgrades; do not let them happen to you.

## Choose an Instance Class and Storage

Instance classes mirror EC2, with a `db.` prefix:

| Class                                          | Use it for                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `db.t4g`, `db.t3` (burstable)                  | Development, small apps. `db.t4g.micro` and `db.t3.micro` are covered by the free plan |
| `db.m7g`, `db.m8g` (general purpose, Graviton) | Most production databases                                                              |
| `db.r7g`, `db.r8g` (memory optimized)          | Large working sets that should fit in memory                                           |

For storage, use **General Purpose SSD (gp3)**, which RDS recommends for most workloads. For PostgreSQL, MySQL and MariaDB, volumes under 400 GiB get a baseline of 3,000 IOPS and 125 MiB/s; from 400 GiB the baseline rises, and you can provision more IOPS and throughput without growing the volume. **Provisioned IOPS (io2 Block Express)** is for databases that need sustained, high, predictable I/O. Magnetic storage is gone. Turn on **storage autoscaling** with a maximum, so a growing table does not fill the disk at 3 a.m.

## Create the Database

### 1. A DB subnet group

A **DB subnet group** tells RDS which subnets it may use. In **RDS**, **Subnet groups**, create `photo-app-db` in the `photo-app` VPC with the two private database subnets (`db-a` and `db-b`, in different AZs).

### 2. The database instance

In **RDS**, choose **Create database**, then **Full configuration**:

1. **Engine**: PostgreSQL, the newest **18.x** version.
2. **Templates**: **Free tier** (or **Dev/Test**). This picks a single-AZ instance.
3. **DB instance identifier**: `photo-app-db`. **Master username**: `postgres`.
4. **Credentials management**: **Managed in AWS Secrets Manager**. RDS generates the password, stores it in Secrets Manager and can rotate it. You never type it.
5. **Instance class**: `db.t4g.micro`. **Storage**: gp3, 20 GiB, autoscaling up to 100 GiB.
6. **Connectivity**: VPC `photo-app`, subnet group `photo-app-db`, **Public access: No**, security group `photo-app-db` (PostgreSQL 5432 from `photo-app-web`, as set up in Part 5).
7. **Additional configuration**: initial database name `photoapp`, backup retention **7 days**, encryption **enabled**, deletion protection on for anything you care about.

Creation takes several minutes. The CLI equivalent (IDs are examples):

```bash
# See which versions are available, newest last
aws rds describe-db-engine-versions --engine postgres \
  --query "DBEngineVersions[].EngineVersion" --output text

aws rds create-db-subnet-group \
  --db-subnet-group-name photo-app-db \
  --db-subnet-group-description "photo-app database subnets" \
  --subnet-ids subnet-0aaa1111bbbb22223 subnet-0ccc3333dddd44445

aws rds create-db-instance \
  --db-instance-identifier photo-app-db \
  --engine postgres \
  --db-instance-class db.t4g.micro \
  --master-username postgres \
  --manage-master-user-password \
  --db-name photoapp \
  --storage-type gp3 --allocated-storage 20 --max-allocated-storage 100 \
  --db-subnet-group-name photo-app-db \
  --vpc-security-group-ids sg-0db0000000000000a \
  --no-publicly-accessible \
  --storage-encrypted \
  --backup-retention-period 7
```

Without `--engine-version`, RDS uses the default version for the engine. Pass a specific version from the first command when you want to choose.

## Connect Securely

The database has no public address, which is what you want. To reach it from your laptop, open a tunnel through the `photo-app-dev-web` instance from Part 5 with **Session Manager port forwarding**. The instance is in the `photo-app-web` security group, which the database allows, and nothing needs to listen on the internet:

```bash
# Terminal 1: forward localhost:5432 to the database through the instance
aws ssm start-session \
  --target i-0abc123def4567890 \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["photo-app-db.abcdefghijkl.us-east-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5432"]}'

# Terminal 2: read the generated master password from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id 'arn:aws:secretsmanager:us-east-1:111122223333:secret:rds!db-0123abcd-4567-89ef-0123-456789abcdef-AbCdEf' \
  --query SecretString --output text
```

The secret ARN is on the database's **Configuration** tab. The secret value is a small JSON document with `username` and `password`.

### Use TLS and verify the certificate

RDS for PostgreSQL 15 and later requires TLS by default (`rds.force_ssl` is on). Go one step further and verify the server certificate, so a machine in the middle cannot pretend to be your database. Download the RDS certificate bundle, which holds the root and intermediate certificates for every Region:

```terminal
{
  "title": "download the RDS CA bundle",
  "prompt": "$",
  "steps": [
    {
      "cmd": "curl -sS -O https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem"
    },
    {
      "cmd": "grep -c 'BEGIN CERTIFICATE' global-bundle.pem",
      "output": "114"
    }
  ]
}
```

Then connect with `sslmode=verify-full`. Through the tunnel, the host name does not match the certificate, so set `host` to the RDS endpoint and `hostaddr` to the tunnel:

```bash
psql "host=photo-app-db.abcdefghijkl.us-east-1.rds.amazonaws.com hostaddr=127.0.0.1 port=5432 \
      dbname=photoapp user=postgres sslmode=verify-full sslrootcert=global-bundle.pem"
```

From the web server itself, install a client with `sudo dnf install -y postgresql17` (Amazon Linux 2023) and connect to the endpoint directly. An older `psql` can talk to a newer server, with a warning that some `psql` features might not work.

## Create an Application User

The master user is for administration. The application gets its own login with only the rights it needs. Connected as `postgres` to the `photoapp` database:

```sql
CREATE ROLE photo_app WITH LOGIN PASSWORD 'use-a-generated-password';
GRANT CONNECT ON DATABASE photoapp TO photo_app;

-- A schema where the app creates and owns its tables
CREATE SCHEMA app;
GRANT USAGE, CREATE ON SCHEMA app TO photo_app;
ALTER ROLE photo_app IN DATABASE photoapp SET search_path = app;
```

Since PostgreSQL 15, ordinary users cannot create objects in the `public` schema, so the app gets its own schema. Store the app's password in Secrets Manager too (as a secret of its own, which you delete yourself when you clean up), and give the web server role `secretsmanager:GetSecretValue` on that one secret. Alternatively, **IAM database authentication** lets the app log in with a short-lived token generated from its IAM role, so there is no database password at all.

Many short-lived connections (from Lambda, or many web processes) can exhaust the database's connection limit. Use a pool in the application, or **RDS Proxy** in front of the database.

## Backups and Restores

- **Automated backups**: a daily snapshot plus transaction logs, kept for 1 to 35 days (the console defaults to 7, the CLI and API to 1). They let you restore to any second in the retention window, usually up to the last five minutes.
- **Manual snapshots**: taken whenever you want (before a migration, before an upgrade) and kept until you delete them.
- **Restores create a new DB instance** with a new endpoint. They never overwrite the existing one. Plan how the application will switch to it, and practice once.
- Copy snapshots to another Region or account for disaster recovery.

When you delete a database, RDS offers a **final snapshot**. Take it unless the data is truly disposable.

## High Availability: Multi-AZ

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "App", "sub": "same endpoint before and after failover", "icon": "server", "tone": "blue" },
    { "label": "DNS endpoint", "sub": "photo-app-db...rds.amazonaws.com", "icon": "net", "tone": "amber" }
  ],
  "groups": [
    {
      "label": "AZ us-east-1a",
      "icon": "server",
      "tone": "violet",
      "nodes": [{ "label": "Primary", "sub": "reads and writes", "icon": "database", "tone": "violet", "status": "ok" }]
    },
    {
      "label": "AZ us-east-1b",
      "icon": "server",
      "tone": "slate",
      "nodes": [{ "label": "Standby", "sub": "synchronous copy, not readable", "icon": "database", "tone": "slate" }]
    }
  ]
}
```

- A **Multi-AZ DB instance** keeps a synchronous standby in another AZ. If the primary or its AZ fails, RDS points the endpoint's DNS name at the standby, typically within 60 to 120 seconds. The standby serves no traffic. Patching and instance class changes also use it to cut downtime.
- A **Multi-AZ DB cluster** (MySQL and PostgreSQL) has two readable standbys and fails over typically in under 35 seconds.
- **Read replicas** are asynchronous, readable copies, also in other Regions. They scale reads and reporting; you promote one manually if you need it as a new primary.

Multi-AZ roughly doubles the instance cost. Use it for production, not for this learning setup. Your application must reconnect after a failover: most drivers and pools do, as long as they do not cache the old IP address.

## Maintenance and Upgrades

- **Minor versions** (18.1 to 18.2) bring fixes; let RDS apply them in your **maintenance window** with automatic minor version upgrade, or schedule them yourself.
- **Major versions** (17 to 18) can break things. Test on a restored snapshot first. **Blue/Green Deployments** create a synchronized copy on the new version and switch over in about a minute.

## Monitoring

Watch these CloudWatch metrics from the start (Part 8 adds alarms):

- `CPUUtilization` and, on burstable classes, `CPUCreditBalance`;
- `FreeStorageSpace` (alarm well before zero);
- `FreeableMemory` and `DatabaseConnections`;
- `ReadLatency` and `WriteLatency`.

**CloudWatch Database Insights** shows database load by wait event and the top SQL statements. It replaced the Performance Insights console on 31 July 2026; the Performance Insights API still works.

## What It Costs

- **Instance hours**, by class and engine (doubled for Multi-AZ);
- **storage** per GB-month, plus provisioned IOPS and throughput where you set them;
- **backup storage** beyond the size of your databases in the Region, and manual snapshots;
- **Extended Support** charges for major versions past standard support;
- **data transfer** out of the Region or across AZs.

On the free plan, `db.t4g.micro` and `db.t3.micro` instances of PostgreSQL, MySQL and MariaDB, and `db.t3.micro` for SQL Server Express, are covered by your credits for up to six months. See the [RDS pricing page](https://aws.amazon.com/rds/pricing/) for rates. For a steady production database, **Reserved Instances** lower the hourly price in exchange for a one- or three-year commitment.

## When RDS Is Not the Right Fit

- **Key-value or document access at any scale**: DynamoDB, which is serverless and has an always-free allowance.
- **Spiky or mostly idle workloads**: Aurora Serverless v2 adjusts capacity with load and can scale down to zero.
- **Extensions or settings RDS does not support**: run the database on EC2 yourself, and accept the operations work.

## Common Mistakes

- **Public access "temporarily".** Use port forwarding instead.
- **The application logs in as the master user.** Give it its own role.
- **No final snapshot on delete**, or a retention period of 1 day.
- **Storage fills up.** Enable autoscaling and alarm on `FreeStorageSpace`.
- **Ignoring the end of standard support** and getting Extended Support charges.
- **Never testing a restore.** A backup you have not restored is a hope, not a plan.

## Clean Up

Stopping an RDS instance saves instance hours, but RDS starts it again automatically after seven days. To stop paying, delete it: **Actions**, **Delete**, take a final snapshot if you want to keep the data, and delete old manual snapshots you no longer need.

## Summary

- RDS runs PostgreSQL, MySQL, MariaDB, Oracle, SQL Server and Db2, and Aurora; pick a current major version.
- Use gp3 storage with autoscaling, private subnets, and a security group that only allows your app.
- Secrets Manager holds the master password; connect with `sslmode=verify-full`; the app has its own role.
- Restores create new instances; Multi-AZ is for availability, read replicas for reads.

Next: [Load Balancing and Auto Scaling](/guides/introduction-to-aws/07-load-balancing), where the single web server becomes a group that heals and grows by itself.

## Keep Learning

- The full [Introduction to PostgreSQL guide](/guides/introduction-to-postgres)
- [How to Apply SQL Scripts to RDS Databases With Terraform](/posts/terraform-apply-sql-scripts-rds)
- [Database Backup and Recovery interview questions](/interview-questions/mid/database-backup-recovery)
