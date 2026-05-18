---
title: 'When One Data Center Room Got Hot: AWS US-EAST-1, Coinbase, and the DR Drill That Was Not'
excerpt: 'On May 7, 2026, cooling failed in a single hall of one US-EAST-1 data center. Coinbase, FanDuel, and CME Group went down for hours, and Coinbase publicly confirmed their backup systems did not work as expected. Here is what happened, the multi-AZ checklist that would have caught it, and the AWS Fault Injection Simulator commands to run the drill before the next thermal event.'
category:
  name: 'AWS'
  slug: 'aws'
date: '2026-05-15'
publishedAt: '2026-05-15T15:00:00Z'
updatedAt: '2026-05-15T15:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: true
tags:
  - AWS
  - Reliability
  - Disaster Recovery
  - Incident Response
  - Cloud
---

At 17:25 PDT on Thursday, May 7, 2026, the cooling in one data center hall inside AWS US-EAST-1 started failing. Temperature climbed. Within minutes, AWS lost power on the affected racks and published the first status update warning that EC2 instances and EBS volumes in `use1-az4` were impaired. Twenty-plus hours later, at 13:50 PT on May 8, cooling was finally stabilised and most affected resources were recovered.

In between, more than 150 cloud services reported issues. Coinbase's primary exchange was offline for over five hours during its Q1 earnings day. FanDuel and CME Group both took multi-hour hits to trading. Coinbase's Head of Platform [stated publicly](https://www.benzinga.com/crypto/26/05/52433912/coinbase-says-aws-cooling-failure-crashed-exchange-during-turbulent-week-ceo-brian-armstrong-calls-it-never-acceptable) that the matching engine and Kafka pipeline run pinned to a single AZ to keep latency down, and that the backup systems "did not work as expected during the incident, extending the outage and forcing engineers to manually execute disaster recovery procedures."

That sentence is the entire post. If you operate anything on AWS that matters, the rest of this article exists to make sure your team is not the one writing that sentence next quarter.

## TL;DR

- A thermal event in **one hall** of **one data center** in **one AZ** (`use1-az4`) took down core services at Coinbase, FanDuel, and CME Group for hours. None of those companies are small or sloppy.
- Multi-AZ is not a checkbox. It is a property you can only verify by killing an AZ on purpose and confirming everything stays up. AWS provides [Fault Injection Simulator (FIS)](https://aws.amazon.com/fis/) to do this safely.
- Single-AZ-for-latency is sometimes the right call. If you make that call, the cost is a hot standby that an engineer can promote in under five minutes with no thinking, plus a quarterly drill that proves the promotion actually works.
- EBS volumes on physically damaged racks are not recoverable. Cross-AZ snapshots are not optional and are not a substitute for a working replica.
- Coinbase's incident is the textbook example of "we had a DR plan, we just had not run it under realistic single-AZ loss." That gap is the thing to fix this quarter.

## Prerequisites

- An AWS account running anything that handles real money or real users.
- Permission to create IAM roles and FIS experiment templates, or the ability to ask someone who does.
- Honesty about whether the last successful DR drill actually killed a primary, or just took a snapshot.

## What happened, technically

The official AWS communication during the incident gives the cleanest timeline. AWS first noted the issue at 00:25 UTC on May 8 ([17:25 PDT May 7](https://www.theregister.com/off-prem/2026/05/08/aws-warns-of-ec2-impairment-as-power-loss-hits-notorious-us-east-1-region/5235509)). The wording was specific: "EC2 instances and EBS volumes hosted on impacted hardware are affected by the loss of power during the thermal event." By 01:47 UTC AWS added that "Other AWS services that depend on the affected EC2 instances and EBS volumes in this Availability Zone may also experience impairments," which is the standard signal that the blast radius is now broader than just compute and block storage.

By 03:06 UTC AWS [recommended](https://aws.amazon.com/premiumsupport/technology/pes/) that "customers needing immediate recovery restore from EBS snapshots or launch resources in unaffected zones." That sentence is the operational tell. AWS was effectively telling the world that recovery in `use1-az4` was going to take hours and that anyone with a working multi-AZ posture should fail away from it now.

Power was restored progressively, but the EBS volumes on the damaged racks did not all come back. AWS's status thread for the day used the phrase "subset of EBS volumes will require additional time to recover" for the entire morning of May 8, which in plain English means some volumes were lost to physical damage. The customers who recovered cleanly were the ones whose data plane did not depend on `use1-az4` at all.

Two technical observations worth pinning to a sticky note:

1. **An AZ is not an abstraction.** It is a physical place. When a hall overheats, the racks inside it can be physically damaged. "Multi-AZ" exists because that is the failure mode AWS designs around. The CDR pattern that pretends an AZ is just a logical label is wrong about the world.
2. **The "EBS volumes on damaged hardware" language is the worst-case wording in AWS's playbook.** It means restore from snapshot, not wait for the volume. If your runbook says "wait for the AZ to come back", your runbook does not handle this incident.

## The Coinbase specifics

[Coinbase's Head of Platform, Rob Witoff](https://www.coindesk.com/business/2026/05/08/coinbase-disruption-tied-to-aws-outage-draws-criticism-amid-staff-layoffs-and-q1-losses), confirmed three things during the incident:

1. Coinbase's primary exchange systems run in a **single AZ** to minimise matching-engine latency.
2. The affected zone hosted parts of the matching engine and the Kafka messaging infrastructure.
3. Backup systems "did not work as expected during the incident, extending the outage and forcing engineers to manually execute disaster recovery procedures."

None of those choices are dumb on their own. A matching engine at exchange scale is genuinely latency-sensitive and there are real reasons to pin it to one AZ. The problem is that single-AZ-for-latency only survives an `use1-az4` event if the failover into another AZ is a battle-tested one-button operation that an SRE can trigger in the first five minutes of an alert. Coinbase had a backup. The backup did not work. That gap is what cost them five hours.

The pattern is general enough to be worth a name. Call it the *"we have a backup"* fallacy: the backup exists, but it has never been promoted to primary under real failure conditions, so nobody knows what breaks when it is. The fix is not to write a longer DR doc. The fix is to actually break things on purpose, on a schedule.

## The multi-AZ checklist that would have caught it

A surprising amount of AWS multi-AZ is opt-in. Going through the common stack:

```text
                                 +---------------+
                                 |   Route 53    |
                                 |  (health      |
                                 |   checks +    |
                                 |   failover)   |
                                 +-------+-------+
                                         |
                       +-----------------+-----------------+
                       |                                   |
                +------v-------+                   +-------v------+
                |   ALB        |                   |   ALB        |
                |  multi-AZ    |                   |  multi-AZ    |
                |  (zone A)    |                   |  (zone B)    |
                +------+-------+                   +-------+------+
                       |                                   |
            +----------+-----------+              +--------+---------+
            |          |           |              |        |         |
       +----v---+ +----v---+  +----v---+    +-----v--+ +---v----+ +--v-----+
       | EC2/   | | EC2/   |  | EC2/   |    | EC2/   | | EC2/   | | EC2/   |
       |  pod   | |  pod   |  |  pod   |    |  pod   | |  pod   | |  pod   |
       +--------+ +--------+  +--------+    +--------+ +--------+ +--------+
            \________/\__________/                \________/\________/
                    az-1                                  az-2

   RDS Multi-AZ standby in az-2.   S3 + DynamoDB global per region.
   Kafka MSK with min.insync.replicas across 3 AZs, ackS=all.
   Snapshots replicated to a second region nightly.
```

Concrete checks per service:

- **EC2 + Auto Scaling Groups**: ASG must be configured with all three AZs in the region, with `availability_zones` explicit. `Capacity-Optimized-Prioritized` allocation. Run `aws autoscaling describe-auto-scaling-groups --query 'AutoScalingGroups[].[AutoScalingGroupName,AvailabilityZones]'` and confirm every critical ASG lists three AZs.
- **ALB**: cross-zone load balancing on. The default is off for NLB and on for ALB, which is the opposite of what most operators assume. Verify with `aws elbv2 describe-load-balancer-attributes --load-balancer-arn $ARN`.
- **RDS**: `MultiAZ: true` and the reader endpoint actually used by reads. RDS Multi-AZ failover takes [60 to 120 seconds](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.Failover.html), which is fine for most apps. The trap is apps that hardcode the primary endpoint and never failover the connection pool.
- **EKS / Kubernetes**: control plane is AWS-managed across three AZs by default. Worker node groups need explicit `subnets` covering three AZs. `kubectl get nodes -o wide` and check the topology label `topology.kubernetes.io/zone` spans three values. PodDisruptionBudgets + `topologySpreadConstraints` with `maxSkew: 1` and `topologyKey: topology.kubernetes.io/zone` for everything that matters.
- **EBS**: snapshots cross-AZ are automatic. Cross-region snapshot copies via AWS Backup or DLM are not, and are what saves you if a whole region degrades.
- **MSK (managed Kafka)**: 3-broker cluster across 3 AZs, `min.insync.replicas=2`, producer `acks=all`. The Coinbase post-incident language ("matching engine and Kafka messaging infrastructure") suggests this was one of the failure points. A single-AZ Kafka under heavy producer load is the kind of latency-driven choice that bites.
- **S3 + DynamoDB**: both are regional, not zonal. They survived `use1-az4` without operator intervention. If your runbook is built on those primitives, your blast radius is already smaller.

A surprising number of teams pass every audit on this list because every individual resource is multi-AZ, then fail in production because one shared piece of infrastructure (a self-hosted Redis, a homegrown service-discovery layer, a quotation engine that holds in-memory state) is single-AZ. The audit script you actually want is the one that walks the dependency graph of your most critical user-facing flow and flags every single-AZ node in it.

## The drill that proves the checklist

The checklist above is necessary. It is not sufficient. The only thing that proves multi-AZ works is killing an AZ on purpose and watching the dashboard.

AWS Fault Injection Simulator (FIS) is the tool. The shape of a "kill an AZ" experiment template:

```json
{
  "description": "Simulate loss of use1-az4 EC2 capacity",
  "roleArn": "arn:aws:iam::123456789012:role/FISExperimentRole",
  "stopConditions": [
    {
      "source": "aws:cloudwatch:alarm",
      "value": "arn:aws:cloudwatch:us-east-1:123456789012:alarm:UserErrorRateHigh"
    }
  ],
  "targets": {
    "EC2Instances-AZ4": {
      "resourceType": "aws:ec2:instance",
      "selectionMode": "ALL",
      "filters": [
        {
          "path": "Placement.AvailabilityZone",
          "values": ["use1-az4"]
        },
        {
          "path": "State.Name",
          "values": ["running"]
        }
      ]
    }
  },
  "actions": {
    "StopAZ4Instances": {
      "actionId": "aws:ec2:stop-instances",
      "parameters": { "startInstancesAfterDuration": "PT30M" },
      "targets": { "Instances": "EC2Instances-AZ4" }
    }
  },
  "tags": { "Name": "kill-az4-30min" }
}
```

The pattern that matters is the **stop condition tied to a real customer-impact alarm**. The experiment kills every EC2 instance in `use1-az4` for 30 minutes, but if the user-facing error rate alarm fires (because failover did not work), FIS aborts the experiment and the instances come back. That is the lock that lets you run this in production without ending your career.

Run it on a quarterly cadence. The first time, run it in staging at 09:00 on a Tuesday with the on-call team watching. The second time, run it in production at the same time. By the third time, run it on a Friday afternoon with nobody told in advance. If anything breaks at that point, you have found the thing that would have broken during the next thermal event, and you have found it with a stop-condition you control.

A few additional FIS actions worth chaining into the same template once the basic AZ kill is solid:

- `aws:ec2:terminate-instances` instead of `stop-instances` for a more aggressive version that does not allow recovery without replacement.
- `aws:network:disrupt-connectivity` with scope `availability-zone` to simulate the network-partition variant.
- `aws:eks:pod-cpu-stress` to layer in worker-node pressure during the AZ failure.
- `aws:rds:failover-db-cluster` to deliberately fail an Aurora primary at the same moment.

The most realistic single-AZ-failure drill is the one that combines AZ-level EC2 loss with RDS primary failover and 50% packet loss to S3, because that is closer to what happens during an actual hall-overheat event than any single FIS action on its own.

## The single-AZ-for-latency exception

The honest version of this post acknowledges that single-AZ deployments are sometimes correct. Latency-sensitive trading systems, real-time bidding pipelines, and tight feedback-loop control planes all have cases where the extra 2-4 ms of cross-AZ round-trip is unaffordable.

If that is you, the test is not "are we multi-AZ", the test is "can we cut over to a hot standby in another AZ in under five minutes with one button". Concrete requirements:

1. The standby exists and is **continuously receiving traffic**. Not "warm". Not "pre-provisioned". Actively serving a small percentage of read traffic at minimum, so its connection pools and caches are not cold.
2. **A documented promotion procedure** that a single on-call engineer can execute from their laptop without consulting anyone. Less than 20 commands. Idempotent. Tested in the quarterly drill.
3. **Monitoring on the promotion path itself**. The most common DR failure is "we promoted, but the new primary's connection-pool size limit was 1000, and we have 5000 active clients trying to reconnect at once". Watch for it.
4. **An honest RTO number**. Coinbase's outage was over five hours. Their RTO target before this incident is not public, but the only way "more than 5 hours" is the correct RTO for an exchange is if a regulator agreed to it in writing. For everyone else, the post-incident RTO target is the new floor.

The Coinbase situation looks like the standby existed but had not been promoted under realistic conditions in some time. That is the single most common failure mode I have seen in production DR audits. The standby is real. It has just never been used in anger. The drill is what closes that gap.

## What to do this week

Five things, in order:

1. **Run the inventory.** `aws ec2 describe-instances --filters "Name=availability-zone,Values=use1-az4"` and equivalents for your critical regions. Anything in a single AZ that is in the customer-facing path needs a multi-AZ peer or a documented exception.
2. **Audit the dependency graph.** The shared single-AZ resource is usually not in the obvious places (the database, the load balancer). It is in the homegrown bits (a service-discovery layer, a metric aggregator, an internal API gateway, a self-hosted Redis). Run the trace and flag every single-AZ node.
3. **Schedule the first FIS drill.** Staging only, 30 minutes, working hours, on-call watching, stop-condition tied to a real alarm. Aim for next Tuesday.
4. **Write the promotion runbook.** Numbered steps. Less than 20 commands. Idempotent. Reviewed by someone who was not on the team that wrote it.
5. **Set the cadence.** Quarterly minimum. The drill that does not happen on a schedule is the drill that is not happening.

The thermal event will repeat. AWS will have another one, in some other AZ, in some other quarter. So will GCP. So will Azure. The teams that recover in 30 minutes instead of 5 hours are not the teams with the better cloud architecture. They are the teams that have rehearsed.

## Sources

- AWS service health page coverage of the May 7-8 incident: [health.aws.amazon.com](https://health.aws.amazon.com/) and the AWS [Post-Event Summaries index](https://aws.amazon.com/premiumsupport/technology/pes/)
- The Register coverage of the thermal event: [theregister.com/off-prem/2026/05/08/aws-warns-of-ec2-impairment-as-power-loss-hits-notorious-us-east-1-region](https://www.theregister.com/off-prem/2026/05/08/aws-warns-of-ec2-impairment-as-power-loss-hits-notorious-us-east-1-region/5235509)
- Coinbase outage timeline and Rob Witoff statement: [coindesk.com](https://www.coindesk.com/business/2026/05/08/coinbase-disruption-tied-to-aws-outage-draws-criticism-amid-staff-layoffs-and-q1-losses) and [benzinga.com](https://www.benzinga.com/crypto/26/05/52433912/coinbase-says-aws-cooling-failure-crashed-exchange-during-turbulent-week-ceo-brian-armstrong-calls-it-never-acceptable)
- Service-impact roundup: [StatusGator](https://statusgator.com/blog/may-7-2026-aws-outage-impact/)
- AWS FIS docs: [aws.amazon.com/fis](https://aws.amazon.com/fis/)
- RDS Multi-AZ failover behaviour: [docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.Failover.html](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.Failover.html)
- Advanced Multi-AZ Resilience Patterns whitepaper: [docs.aws.amazon.com/whitepapers/latest/advanced-multi-az-resilience-patterns](https://docs.aws.amazon.com/whitepapers/latest/advanced-multi-az-resilience-patterns/advanced-multi-az-resilience-patterns.html)

Drill the failover. The thermal event will return. The DR runbook that has never been used is not a runbook, it is a wish.
