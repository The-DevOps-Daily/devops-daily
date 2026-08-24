---
title: 'Why Your Kafka Bill Is Mostly Network'
excerpt: 'Run the numbers on a self-managed Kafka cluster and the biggest line item is not brokers or disks, it is cross-AZ data transfer. Here is the arithmetic, where every gigabyte crosses a zone boundary, and the four levers that actually shrink the bill.'
category:
  name: 'FinOps'
  slug: 'finops'
date: '2026-08-24'
publishedAt: '2026-08-24T09:00:00Z'
updatedAt: '2026-08-24T09:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - FinOps
  - Kafka
  - AWS
  - Networking
  - Cloud Costs
  - Data Transfer
---

Ask someone what a Kafka cluster costs and they will start counting brokers. Instance sizes, disk volumes, maybe a line for the ops time. Then the first real cloud bill arrives and the biggest number is none of those things. It is data transfer, and most of it says "regional" or "inter-AZ" next to it.

This is not an accident or a misconfiguration. It falls straight out of how Kafka achieves durability: copies of every byte, placed in different availability zones, on purpose. The cloud provider charges for every one of those zone crossings, in both directions. Multiply a modest produce rate by the number of times each byte crosses a boundary and network quietly becomes 60 to 80 percent of the total.

This post walks the arithmetic for a realistic cluster, shows exactly which hops cost money, and then goes through the levers that actually move the number, including the one config most teams have never turned on.

## TL;DR

- Cross-AZ traffic on AWS costs **$0.01/GB in each direction**, so every gigabyte that crosses a zone boundary costs $0.02.
- With replication factor 3 across 3 AZs and no rack awareness, **each produced gigabyte becomes roughly 4.7 gigabytes of cross-AZ traffic** (produce hop + 2 replication hops + consumer hops per group).
- For a 100 MB/s cluster that is about **$24,000/month in transfer fees**, against roughly $2,500 of brokers, so the network really is the bill.
- The big levers: **fetch-from-follower (KIP-392)** for consumers, **compression before anything else**, managed services that do not bill replication (MSK does not charge broker-to-broker), and honestly asking whether every workload needs 3 AZs.
- Producers are the hard case: leaders are deliberately spread across zones, so some produce traffic always crosses.

## Prerequisites

- A working idea of Kafka's model: topics, partitions, leaders, followers, consumer groups
- A Kafka cluster you can change configs on (any version from 2.4 onward for fetch-from-follower)
- Access to your cloud bill or Cost Explorer, filtered to data transfer

## Where every byte crosses a zone

A durable Kafka deployment spreads brokers across three availability zones and sets `replication.factor=3`, so each partition has its leader in one zone and followers in the other two. That layout is the whole point: an AZ can burn down and you lose nothing. It also defines the traffic pattern.

Follow one produced record through the cluster:

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "producer", "label": "Producer", "sub": "AZ-a", "icon": "box", "tone": "blue" }
    ],
    [
      { "id": "leader", "label": "Partition leader", "sub": "AZ-b", "icon": "queue", "tone": "amber", "detail": "2 out of 3 partitions have their leader in another zone, so most produce traffic crosses a boundary." }
    ],
    [
      { "id": "f1", "label": "Follower", "sub": "AZ-a", "icon": "database", "tone": "violet", "detail": "Replication always crosses: followers live in the other two zones by design." },
      { "id": "f2", "label": "Follower", "sub": "AZ-c", "icon": "database", "tone": "violet", "detail": "The second replica is another full copy across a zone boundary." }
    ],
    [
      { "id": "consumer", "label": "Consumer group", "sub": "AZ-c", "icon": "activity", "tone": "green", "detail": "Without rack awareness every group fetches from the leader, wherever it is. Three groups = three more copies over the wire." }
    ]
  ],
  "edges": [
    ["producer", "leader", "cross-AZ ~2/3 of the time"],
    ["leader", "f1", "always cross-AZ"],
    ["leader", "f2", "always cross-AZ"],
    ["leader", "consumer", "cross-AZ ~2/3 per group"]
  ]
}
```

Count the crossings for one gigabyte of produced data, with clients spread evenly across the three zones:

1. **Produce hop.** The producer must write to the partition leader, and leaders are spread across zones. Two times out of three, the leader is in a different zone than the producer: **~0.67 GB** crosses.
2. **Replication.** The leader ships every byte to both followers, and both are in other zones by design: **2.0 GB** crosses. This one is not probabilistic. It is the durability you asked for.
3. **Consumption.** By default every consumer fetches from the leader, wherever it lives. Same 2-in-3 odds, but multiplied by the number of consumer groups reading the topic. Three groups: **~2.0 GB** crosses.

Total: roughly **4.7 GB of cross-AZ traffic per produced gigabyte**, and the meter runs on both sides of each crossing at [$0.01/GB per direction](https://aws.amazon.com/ec2/pricing/on-demand/#Data_Transfer_within_the_same_AWS_Region).

:::note
These multipliers assume bytes are already compressed. Kafka compresses on the producer, so the wire and the bill see post-compression sizes. If you are not compressing today, every number in this post is 3 to 4 times worse for you, and enabling `compression.type=zstd` is the first thing to do before touching anything else.
:::

## The arithmetic for a real cluster

Take a mid-sized, self-managed cluster on EC2. Nothing exotic:

- 100 MB/s produced (post-compression), steady
- 3 AZs, replication factor 3, 9 brokers
- 3 consumer groups each reading the full stream
- 3-day retention on gp3 volumes
- No rack awareness configured

Per month, that is about 259 TB produced. Applying the multipliers: ~467 MB/s of cross-AZ traffic, about 1,210 TB/month, at $0.02 per crossed gigabyte:

```chart
{
  "type": "bar",
  "title": "Monthly cost, 100 MB/s self-managed Kafka on EC2",
  "unit": "$",
  "caption": "Scenario: 3 AZs, RF=3, 9 m5.2xlarge brokers (on-demand, ~$2,500), 3-day retention on gp3 (~78 TB x3 replicas, ~$6,200), 3 consumer groups, no rack awareness. Transfer at $0.01/GB each direction. List prices, us-east-1, rounded.",
  "rows": [
    { "label": "Cross-AZ transfer", "value": 24200 },
    { "label": "EBS storage", "value": 6200 },
    { "label": "Broker instances", "value": 2500 }
  ]
}
```

The network line is 73 percent of the total, and it scales linearly with throughput while the broker line mostly does not. Double the traffic and the instances might cope fine; the transfer bill doubles regardless. This is why "Kafka is expensive" almost always means "cross-AZ transfer is expensive": the brokers were never the problem.

Break the transfer line down by hop and the shape of the fix becomes obvious:

```chart
{
  "type": "bar",
  "title": "Who is crossing the zone boundary",
  "unit": " MB/s",
  "caption": "Same scenario. Consumer traffic scales with the number of groups; replication scales with RF-1; produce traffic is fixed by leader placement.",
  "rows": [
    { "label": "Replication (RF=3)", "value": 200 },
    { "label": "Consumers (3 groups)", "value": 200 },
    { "label": "Producers", "value": 67 }
  ]
}
```

## Lever 1: stop consumers from crossing (KIP-392)

The consumer share of that chart is the easiest money in Kafka. Since version 2.4, [KIP-392](https://cwiki.apache.org/confluence/display/KAFKA/KIP-392%3A+Allow+consumers+to+fetch+from+closest+replica) lets a consumer fetch from the **closest replica** instead of the leader. With RF=3 across 3 AZs there is a replica in every zone, so every consumer can read locally and that entire 200 MB/s goes to zero.

It takes two configs. Brokers advertise which "rack" (zone) they are in and how to pick a replica:

```properties
# server.properties on each broker
broker.rack=use1-az1        # this broker's AZ
replica.selector.class=org.apache.kafka.common.replica.RackAwareReplicaSelector
```

Consumers state where they are:

```properties
# consumer config
client.rack=use1-az1        # the consumer's own AZ, e.g. from instance metadata
```

On Kubernetes or EC2 you can inject the zone at startup rather than hardcoding it:

```terminal
{
  "title": "wire the rack at boot",
  "steps": [
    { "comment": "EC2: read the zone from instance metadata" },
    { "cmd": "TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')", "output": "" },
    { "cmd": "curl -s -H \"X-aws-ec2-metadata-token: $TOKEN\" http://169.254.169.254/latest/meta-data/placement/availability-zone-id", "output": "use1-az1" },
    { "comment": "pass it to the consumer as client.rack" },
    { "cmd": "java -Dclient.rack=use1-az1 -jar consumer.jar", "output": "[Consumer] Fetching from replica on broker 4 (same rack)" }
  ]
}
```

Two caveats worth knowing before you flip it. Follower fetches can be marginally more stale than leader fetches (the follower has to have replicated the data first), which matters to almost nobody but is worth saying out loud. And the savings only apply to consumers inside the cluster's zones; a consumer in a fourth zone still crosses no matter what.

In the scenario above, this one change removes ~$10,400/month.

## Lever 2: the replication line depends on who runs the cluster

The 200 MB/s of replication traffic is structural. You cannot config your way out of copying bytes to other zones without giving up the durability that justifies Kafka in the first place. What you can change is **who pays for it**:

- **Self-managed on EC2**: you pay list price for every replication byte. That is the $10,400/month slice in our scenario.
- **Amazon MSK**: AWS explicitly does [not charge for data transfer between brokers](https://aws.amazon.com/msk/pricing/): "You are not charged for data transfer used for replication between brokers." Client-to-broker traffic still bills at standard rates, so KIP-392 stays relevant, but the biggest structural line disappears into the service fee. When you compare MSK's per-broker premium against self-managed, include this or the comparison is meaningless.
- **Diskless designs**: a newer generation of Kafka-compatible systems (WarpStream, AutoMQ, Confluent's Freight clusters, and the upstream [KIP-1150 "diskless topics" proposal](https://cwiki.apache.org/confluence/display/KAFKA/KIP-1150%3A+Diskless+Topics)) sidesteps replication entirely by writing straight to object storage and letting S3 replicate across zones for free. The trade is latency: S3-backed topics add tens to hundreds of milliseconds. For workloads that tolerate that, the cross-AZ line genuinely goes away rather than moving.

None of these is automatically right. The point is that the replication slice of your bill is a *vendor and architecture decision*, not a tuning problem.

## Lever 3: producers mostly cannot be fixed, so compress

The produce hop is the smallest slice and the hardest to remove. Leaders for different partitions are deliberately spread across zones, and a producer writing to many partitions will reach leaders in every zone no matter where it sits. Sticky partitioning and careful keying can shave the edges; they cannot change the shape.

What does change the shape is compression, because it shrinks every hop at once: produce, both replication copies, and every consumer group. Producer-side `zstd` routinely gets 3-4x on JSON-ish workloads:

```properties
# producer config: compress once, save on five wire hops
compression.type=zstd
linger.ms=20          # small batching delay so batches are worth compressing
batch.size=262144     # bigger batches compress better than 16KB defaults
```

If the 100 MB/s in our scenario were uncompressed, this single config turns it into ~30 MB/s on the wire and cuts the entire transfer bill by the same factor. It is the only lever that multiplies with all the others.

## Lever 4: ask the 3-AZ question honestly

Every number above came from the assumption that this data needs to survive an AZ failure with no loss. For your payments stream, obviously. For a dev cluster, a CI environment, or a metrics firehose that is also in Prometheus? A single-AZ cluster has **zero** cross-AZ cost by construction, and `min.insync.replicas=2` within one zone still survives broker failure, just not zone failure.

The [use1-az4 thermal event](/posts/aws-use1-az4-thermal-event-single-az-lessons) is a fair counterargument for anything that matters. But paying $24,000/month of transfer to make replayable test traffic zone-durable is a choice, and it should be a deliberate one.

## What the bill looks like after

Applying the levers that fit most production clusters (KIP-392 for the three consumer groups, keeping RF=3, staying self-managed, data already compressed):

```chart
{
  "type": "bar",
  "title": "Monthly transfer cost, before and after",
  "unit": "$",
  "caption": "Same 100 MB/s scenario. 'After' enables rack-aware fetch for all 3 consumer groups; replication and produce hops unchanged. Moving to MSK or a diskless design would also remove most of the remaining $13,800.",
  "rows": [
    { "label": "Consumers", "value": 10400, "series": "Before" },
    { "label": "Consumers", "value": 0, "series": "After" },
    { "label": "Replication", "value": 10400, "series": "Before" },
    { "label": "Replication", "value": 10400, "series": "After" },
    { "label": "Producers", "value": 3400, "series": "Before" },
    { "label": "Producers", "value": 3400, "series": "After" }
  ],
  "series": [
    { "name": "Before", "color": "#f43f5e" },
    { "name": "After", "color": "#10b981" }
  ]
}
```

:::tip
Before changing anything, get the real number for your cluster: in AWS Cost Explorer, filter to the EC2 "DataTransfer-Regional-Bytes" usage type and group by tag. If Kafka brokers and clients carry a team or service tag, the cross-AZ line attributable to Kafka falls straight out. Measure first; the multiplier for your cluster depends on your consumer-group count and compression, not on this post's scenario.
:::

## Summary

- Kafka's durability model turns one produced gigabyte into ~4.7 cross-AZ gigabytes in a typical 3-AZ, RF=3, three-consumer-group setup, and the cloud charges both directions of every crossing.
- At 100 MB/s that is roughly $24,000/month of transfer against $2,500 of brokers. The network is the bill.
- Turn on **fetch-from-follower** (`broker.rack`, `replica.selector.class`, `client.rack`): it deletes the consumer share outright and is two configs.
- **Compress at the producer** with zstd; it is the only lever that multiplies with every other one.
- The replication share is a structural decision: pay it on EC2, let MSK absorb it, or move latency-tolerant workloads to object-storage-backed designs.
- Keep 3 AZs for data that must survive a zone, and stop paying zone-durability prices for data that does not.

For choosing where Kafka belongs at all, see [6 Apache Kafka Use Cases, and When You Do Not Need Kafka](/posts/kafka-use-cases).
