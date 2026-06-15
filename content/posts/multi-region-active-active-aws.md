---
title: 'How to Design a Multi-Region Active-Active Architecture on AWS'
excerpt: 'A practical walkthrough of building active-active multi-region apps on AWS: traffic routing with Route 53 and Global Accelerator, data replication with DynamoDB Global Tables and Aurora, and the application changes that make failover actually work.'
category:
  name: 'AWS'
  slug: 'aws'
coverImage: '/images/posts/multi-region-active-active-aws.png'
ogImage: '/images/posts/multi-region-active-active-aws.png'
date: '2026-06-15'
publishedAt: '2026-06-15T09:00:00Z'
updatedAt: '2026-06-15T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - aws
  - multi-region
  - high-availability
  - architecture
  - route53
  - dynamodb
---

It is 3:14 AM. PagerDuty goes off. `us-east-1` is having one of its days, and your entire product is down because that is where all of it lives. You have a warm standby in `us-west-2` that nobody has touched in four months. You promote it. The database comes up read-only because the promotion script was never tested against this version of Aurora. By the time traffic shifts, you have eaten 40 minutes of downtime and an angry email from your biggest customer.

This is the failure that pushes teams toward active-active. Not the dream of global low latency. The fear that the standby you are paying for does not actually work.

This post shows you how to design an active-active architecture on AWS that routes traffic to multiple live regions, replicates data between them, and fails a sick region out of rotation in under a minute. You will see the Route 53 config, the DynamoDB setup, the application changes that make it safe, and the real terminal output along the way.

## TLDR

- Go active-active only if you need sub-minute RTO for a full region outage, have global users, or face a data residency rule. Multi-AZ covers almost everything else.
- Route traffic with Route 53 latency records plus health checks, or Global Accelerator when you need sub-30-second failover that does not wait on DNS TTL.
- DynamoDB Global Tables give you multi-region writes. Aurora Global Database does not. It is active-passive for writes, even if you call it active-active for reads.
- The hard part is not infrastructure. It is idempotency keys, globally unique IDs, and conflict resolution in your application code.
- Budget around 2.2x your single-region cost, and test failover on a schedule or it will not work when you need it.

## Prerequisites

- An AWS account with permissions for Route 53, DynamoDB, Aurora, and Global Accelerator
- A working single-region application you can reason about (stateless app tier, a database, object storage)
- Comfort with the AWS CLI and either Terraform or CloudFormation
- A clear RTO and RPO target from your business, in numbers, before you start

## First, are you sure you need this?

Multi-AZ already survives a data center fire and gives you 99.99% availability. A single region with three Availability Zones is the right answer for most apps. Going multi-region doubles your infrastructure, your data transfer bill, and the number of ways your system can be inconsistent.

You need active-active if you have at least one of these:

- A hard RTO under 60 seconds for a full region outage
- Global users where cross-ocean latency hurts the product
- A regulatory rule that forces data into specific geographies
- A contractual SLA your business cannot afford to miss

If none of those apply, stop here and spend the money on better monitoring instead. Multi-region is a tax you pay every single day to solve a problem that happens once a year.

## The shape of an active-active stack

Here is what we are building. Two regions, both serving live traffic, with a global router in front and replicated data underneath.

```text
                         Route 53 / Global Accelerator
                         (latency routing + health checks)
                                      |
                    +-----------------+-----------------+
                    |                                   |
              us-east-1                            eu-west-1
          +----------------+                  +----------------+
          |  ALB           |                  |  ALB           |
          |  App (ECS/EKS) |                  |  App (ECS/EKS) |
          +-------+--------+                  +-------+--------+
                  |                                   |
          +-------v--------+   <-- async repl -->  +--v-------------+
          | DynamoDB       | <===================> | DynamoDB       |
          | Global Tables  |   (last-writer-wins)  | Global Tables  |
          +----------------+                       +----------------+
                  |                                   |
          +-------v--------+   <-- storage repl -->  +-v--------------+
          | Aurora primary |  ====================>  | Aurora reader  |
          | (writes here)  |   (read-only secondary) | (reads only)   |
          +----------------+                         +----------------+
```

Both regions take reads and writes for DynamoDB-backed data. For Aurora-backed data, both regions read but only one writes. That split matters, and we will come back to it.

## Routing traffic to the nearest healthy region

Route 53 latency-based routing returns the region with the lowest measured network latency for the resolver asking. Attach a health check to each record so a sick region drops out of rotation automatically.

Create the health check first:

```bash
aws route53 create-health-check \
  --caller-reference "api-eu-$(date +%s)" \
  --health-check-config '{
    "Type": "HTTPS",
    "ResourcePath": "/healthz",
    "FullyQualifiedDomainName": "api-eu.example.com",
    "Port": 443,
    "RequestInterval": 10,
    "FailureThreshold": 3
  }'
```

Then point a latency record at each region and bind the health check:

```json
{
  "Comment": "Active-active latency record for eu-west-1",
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "api.example.com",
      "Type": "A",
      "SetIdentifier": "eu-west-1",
      "Region": "eu-west-1",
      "AliasTarget": {
        "HostedZoneId": "Z32O12XQLNTSW2",
        "DNSName": "dualstack.alb-eu.eu-west-1.elb.amazonaws.com",
        "EvaluateTargetHealth": true
      },
      "HealthCheckId": "abcd1234-5678-90ab-cdef-1234567890ab"
    }
  }]
}
```

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789ABC \
  --change-batch file://latency-record-eu.json
```

The catch with DNS is TTL. Resolvers and clients cache records, so your real failover time is the health check interval times the failure threshold, plus the TTL. With a 10-second interval, a threshold of 3, and a 60-second TTL, expect roughly 90 seconds before most clients move. Some clients ignore TTL entirely and stay pinned for much longer.

You can watch a failover happen with `dig`:

```bash
$ dig +short api.example.com
# eu-west-1 healthy, you are in Europe
52.18.44.7

# after eu-west-1 health check fails, query again
$ dig +short api.example.com
18.234.91.2   # now resolving to us-east-1
```

If 90 seconds is too slow, or you serve non-HTTP traffic like gaming or IoT, use **AWS Global Accelerator** instead. It hands you two static anycast IPs and routes over the AWS backbone to the nearest healthy region. Failover is sub-30 seconds because it does not depend on DNS caching. It costs about $18 a month per accelerator plus data transfer, so reach for it only when you need that speed.

## Replicating data without losing writes

This is where active-active gets hard. Two regions accepting writes at the same time will conflict, and how you handle that conflict decides whether your design is sound or quietly losing data.

### DynamoDB Global Tables for multi-region writes

DynamoDB Global Tables replicate writes between regions asynchronously, usually within a second. Every region accepts writes locally. Turn it on by adding a replica:

```bash
aws dynamodb update-table \
  --table-name orders \
  --region us-east-1 \
  --replica-updates '[{"Create": {"RegionName": "eu-west-1"}}]'
```

Conflict resolution is last-writer-wins, based on the wall clock of the region that did the write. If two regions update the same item in the same second, one update silently disappears. That is fine for naturally partitioned data like per-user state. It is dangerous for shared counters or hot keys.

The fix for hot keys is to not write the same item from two regions. Partition writes by key so a given record is only ever written from one region, or use atomic counters and CRDTs for data that genuinely needs to merge.

### Aurora Global Database is not active-active for writes

Be honest with yourself here. Aurora Global Database replicates a primary region to up to five secondaries at the storage layer, typically under a second of lag. The secondaries are **read-only**. Only one region accepts writes.

So Aurora Global is active-active for reads and active-passive for writes. If your app sends a write to the secondary region, you get this:

```text
ERROR 1290 (HY000): The MySQL server is running with the
--read-only option so it cannot execute this statement
```

You have two real options. Either send all writes to the primary region from both app tiers (and accept the cross-region write latency for users far from the primary), or shard your relational data by region so each region owns its own slice. There is no managed multi-writer Aurora across regions that you should bet a production system on today.

## The application changes nobody warns you about

You can wire up all the AWS pieces and still corrupt data, because active-active breaks assumptions baked into most application code.

### Every write needs an idempotency key

In multi-region you will have retries, dual delivery during replication lag, and clients that hit a different region after a failover. Without idempotency, a payment gets processed twice and the customer calls support.

Require a client-supplied idempotency key on every write and store it long enough to outlive cross-region replication, 24 hours or more. In DynamoDB, a conditional write does the dedupe for you:

```python
import boto3
from botocore.exceptions import ClientError

table = boto3.resource("dynamodb").Table("charges")

def create_charge(idempotency_key: str, amount: int):
    try:
        table.put_item(
            Item={"pk": idempotency_key, "amount": amount, "status": "captured"},
            # only write if this key was never seen before
            ConditionExpression="attribute_not_exists(pk)",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            # duplicate request, return the existing result, do not charge again
            return table.get_item(Key={"pk": idempotency_key})["Item"]
        raise
```

The retry that would have double-charged now hits the condition and returns the original result:

```text
botocore.errorfactory.ConditionalCheckFailedException:
An error occurred (ConditionalCheckFailedException) when calling
the PutItem operation: The conditional request failed
```

That error is not a bug. That is the system protecting you.

### Drop auto-increment IDs

Two regions handing out `INSERT` rows will both generate ID `4892` for different records. When replication catches up, you get duplicate primary keys and a merge failure. Generate globally unique IDs in the application instead. Use **UUIDv7** or **ULID** so the IDs are time-ordered and still index well:

```python
from uuid_extensions import uuid7   # time-ordered, sortable, no coordination

order_id = str(uuid7())
# '018f9b2a-7c3e-7def-8a1b-2c4d6e8f0a12'
```

UUIDv4 works too, but random IDs fragment your B-tree indexes on large tables. Pick UUIDv7 or ULID for anything that grows.

### Keep session state out of the app server

The user's next request might land in a different region, so local memory and a region-pinned Redis will not survive failover. Use stateless signed tokens (JWT) when you can live with the revocation complexity, or a replicated store like DynamoDB Global Tables for shopping carts and longer sessions.

## What it actually costs and how to test it

The duplicated compute is the obvious cost. The ones that surprise people on the bill:

- Inter-region data transfer at roughly $0.02 per GB for replication, which adds up fast on a write-heavy app
- DynamoDB Global Tables charging replicated write capacity in every region
- Aurora Global Database charging replicated storage in every region
- Engineering time spent debugging consistency bugs and running game days

Budget at least 2.2x your single-region cost. In year one, the engineering tax is bigger than the infrastructure tax.

And test it. The whole reason to go active-active is that the standby is verified working every second, so do not let that promise rot. Run a game day at least quarterly. Use AWS Fault Injection Simulator to cut a region off, or just disable a health check and watch traffic shift:

```bash
aws route53 update-health-check \
  --health-check-id abcd1234-5678-90ab-cdef-1234567890ab \
  --disabled
```

Watch the traffic move in your dashboards, confirm writes still succeed, then test the failback too. If the team is nervous about running this test, that nervousness is exactly the signal that you need to run it.

## Next steps

Pick one path and start small:

1. Write down your RTO and RPO targets in real numbers and confirm multi-AZ truly cannot meet them. If it can, stop and save the money.
2. Add idempotency keys to every write API in your current single-region app. This is the highest-value change and you can do it today, before any multi-region work.
3. Move one bounded, naturally partitioned dataset (sessions or per-user state) to DynamoDB Global Tables and prove replication works end to end.
4. Stand up the second region's app tier behind a Route 53 latency record with a real `/healthz` check, then run a game day and disable one region.
5. Only after steps 1 through 4 feel boring should you tackle the relational data, which is the genuinely hard part.

Do them in that order. Most teams that fail at multi-region fail because they bought the infrastructure before they fixed the application.
