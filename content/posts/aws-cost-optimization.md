---
title: 'How We Reduced Our AWS Bill by 73% While Actually Improving Performance'
excerpt: 'The counterintuitive strategies we used to slash cloud costs while actually improving application performance.'
category:
  name: 'Cloud'
  slug: 'cloud'
date: '2024-11-20'
publishedAt: '2024-11-20T08:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - AWS
  - Cost Optimization
  - Cloud
  - FinOps
featured: true
---

"Your AWS bill this month is $127,346."

That was the message I received from our finance team last January that kicked off our cloud cost optimization journey. For privacy reasons, I won't disclose the name of our company, but we're a mid-sized SaaS provider with about 500,000 monthly active users.

Six months later, we've reduced our AWS costs by 73% while simultaneously improving application performance. This wasn't through downsizing or reducing capabilities, but by making smarter architectural choices and leveraging AWS services in ways we hadn't considered before.

Here's exactly how we did it, and how you can apply the same principles to your infrastructure.

## The Cost Problem No One Wanted to Talk About

Our AWS infrastructure had grown organically over five years, expanding with our business. The problem? No one was responsible for holistically reviewing costs. As engineers, we were incentivized to "make it work" and "keep it reliable," but not necessarily to "make it cost-effective."

Our initial infrastructure looked something like this:

- 45 **EC2 instances** (mostly m5.xlarge) across production and staging
- Multiple **RDS instances** (db.r5.2xlarge) with 1TB of allocated storage each
- Several **ElastiCache Redis** clusters (cache.r5.xlarge)
- Multiple **NAT Gateways** in each availability zone
- Overprovisioned **EBS volumes** "just in case"
- Nearly **100TB of S3 storage**, much of it rarely accessed
- Numerous **idle resources** we forgot existed

We were running on what many blog posts recommended: oversized instances, resources in every AZ, and the "latest generation" of everything.

## The Optimization Strategy That Worked

Rather than making dramatic cuts that could impact reliability, we took a data-driven approach. Here's what worked for us:

### 1. Get Complete Visibility into Your Spending

Before making any changes, we needed to understand where our money was going.

```
AWS Cost Categories we defined:
- Compute (EC2, Lambda)
- Database (RDS, DynamoDB)
- Storage (S3, EBS)
- Caching (ElastiCache, DAX)
- Networking (Data Transfer, NAT Gateways)
- Other (CloudWatch, support, etc.)
```

We activated AWS Cost Explorer and implemented detailed tagging for all resources, with mandatory tags for:

- Environment (prod, staging, dev)
- Team (backend, frontend, data, etc.)
- Project (user-service, reporting, etc.)
- Purpose (app-server, batch-job, etc.)

This immediately highlighted that:

- Our staging environment cost 80% as much as production despite handling minimal traffic
- Our data transfer costs were surprisingly high
- Several teams had forgotten resources running

**Cost Savings: $11,500/month just from eliminating obviously abandoned resources**

### 2. Right-size Instances Based on Actual Data, Not Intuition

AWS makes it easy to overprovision "just to be safe." We found most of our instances were running at less than 20% CPU utilization on average, with memory usage below 40%.

Instead of guessing, we used CloudWatch metrics and tools like AWS Compute Optimizer to determine optimal instance types.

```
Example right-sizing results:
- Web servers: m5.xlarge → t3.large (saved 65%)
- Application servers: r5.2xlarge → m5.large (saved 75%)
- Batch processors: c5.2xlarge → m5.large (saved 60%)
```

The counterintuitive finding? The newer, burstable instances (T3) often performed better for our workloads than the more expensive general-purpose (M5) or compute-optimized (C5) instances we were using.

**Cost Savings: $23,400/month from right-sizing EC2 instances**

### 3. Implement Auto-scaling Based on Actual Patterns

Our traffic followed clear patterns, but we were provisioning for peak load 24/7.

We implemented auto-scaling groups for our application tiers with:

- Base capacity to handle minimum traffic
- Target tracking scaling policies based on CPU utilization (around 70%)
- Predictive scaling using machine learning to anticipate our daily and weekly patterns

```yaml
# Sample CloudFormation snippet for our auto-scaling configuration
Resources:
  WebServerGroup:
    Type: 'AWS::AutoScaling::AutoScalingGroup'
    Properties:
      MinSize: 3
      MaxSize: 20
      DesiredCapacity: 3
      HealthCheckType: ELB
      HealthCheckGracePeriod: 300
      LaunchTemplate:
        LaunchTemplateId: !Ref WebServerLaunchTemplate
        Version: !GetAtt WebServerLaunchTemplate.LatestVersionNumber
      Tags:
        - Key: Name
          Value: web-server
          PropagateAtLaunch: true
      TargetGroupARNs:
        - !Ref WebServerTargetGroup

  ScalingPolicy:
    Type: 'AWS::AutoScaling::ScalingPolicy'
    Properties:
      AutoScalingGroupName: !Ref WebServerGroup
      PolicyType: TargetTrackingScaling
      TargetTrackingConfiguration:
        PredefinedMetricSpecification:
          PredefinedMetricType: ASGAverageCPUUtilization
        TargetValue: 70.0
```

This reduced our average number of running instances by 60% while actually improving response times during traffic spikes, since the scaling was now more responsive to actual demand.

**Cost Savings: $19,800/month from implementing proper auto-scaling**

### 4. Reserved Instances and Savings Plans for Predictable Workloads

Once we identified our baseline infrastructure needs, we purchased:

- 1-year Compute Savings Plans for our minimum EC2 capacity
- 3-year Reserved Instances for our database tier
- Reserved capacity for ElastiCache clusters

For a mid-sized company like ours, committing to 1-year terms offered the best balance of savings versus flexibility. We avoided 3-year commitments except for our most stable database workloads.

**Cost Savings: $16,700/month from commitments on predictable resource usage**

### 5. Storage Optimization That No One Talks About

Storage costs were our sleeper issue. We found:

- **RDS storage**: We had allocated 1TB per database, but most were using less than 200GB. We resized them and implemented monitoring to scale up when actually needed.

- **EBS volumes**: Many were overprovisioned and using the wrong type (gp2 instead of gp3). We switched to gp3 volumes and adjusted IOPS based on actual usage patterns.

- **S3 data**: We implemented lifecycle policies to move infrequently accessed data to cheaper storage classes:

```
S3 Lifecycle policies implemented:
- Move objects to STANDARD_IA after 30 days
- Move objects to GLACIER after 90 days
- Delete certain logs and temporary files after retention period
```

The most counterintuitive finding? Moving to smaller but faster storage often improved performance while reducing costs.

**Cost Savings: $14,900/month from storage optimizations**

### 6. Networking Optimizations That Made a Big Difference

Networking costs are often overlooked, but represented about 15% of our bill:

- **NAT Gateway consolidation**: We had one NAT Gateway per AZ per environment. By analyzing traffic patterns, we consolidated down to fewer gateways without impacting reliability.

- **CloudFront for caching**: We implemented CloudFront in front of our APIs and static content, which reduced data transfer costs and improved global performance.

- **VPC Endpoint for S3**: This eliminated NAT Gateway charges for S3 access from private subnets.

- **ALB consolidation**: We had separate Application Load Balancers for different services. We consolidated several of them using path-based routing, which reduced both the number of ALBs and simplified our architecture.

```
Before: 12 Application Load Balancers
After: 4 Application Load Balancers with path-based routing
```

**Cost Savings: $8,200/month from networking optimizations**

### 7. Serverless for Variable Workloads

We identified several batch processing workloads that ran on EC2 instances 24/7 but were only actively processing data for a few hours each day.

We refactored these to use Lambda functions and Step Functions, paying only for the actual compute time used:

```python
# Example of a batch job refactored to Lambda
def process_data(event, context):
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']

    # Download and process file
    s3.download_file(bucket, key, '/tmp/data.csv')
    result = process_file('/tmp/data.csv')

    # Upload results
    s3.upload_file('/tmp/result.json', 'results-bucket', f'results/{key}.json')

    return {
        'statusCode': 200,
        'body': json.dumps({'status': 'success', 'file': key})
    }
```

**Cost Savings: $7,800/month from moving batch workloads to serverless**

## The Unexpected Performance Improvements

When we started this journey, we were concerned that cost-cutting would degrade performance. Instead, we saw the opposite:

1. **Improved response times**: Average API response time decreased from 187ms to 103ms

2. **Better scaling behavior**: Our systems now scale up faster during traffic spikes, improving availability during peak times

3. **Reduced complexity**: Consolidating services made our architecture simpler and easier to manage

4. **Lower latency**: CloudFront and regional optimizations reduced global latency by 22%

The keys to these improvements were:

- Moving to newer, more efficient instance types
- More responsive auto-scaling
- Better caching with CloudFront
- Switching to gp3 EBS volumes with higher IOPS
- Distribution of workloads across appropriate service types

## Lessons Learned: The Non-Obvious Insights

After six months of optimization work, here are the key lessons that weren't obvious to us at the start:

### 1. The Best Services Aren't Always the Most Expensive Ones

AWS constantly releases new instance types and service tiers. Newer generation instances often provide better performance at lower cost. For example, t3.large instances outperformed our m5.xlarge instances for our web tier while costing 65% less.

### 2. Reserved Instances Are Still Worth It (Despite the Flexibility Tradeoff)

In the age of Kubernetes and containerization, there's a tendency to avoid commitments. But we found that most of our workloads had a predictable baseline. Savings Plans and RIs still make financial sense for these workloads.

### 3. Measure Before Optimizing

Many of our assumptions about resource needs were wrong. For instance, we thought our API servers were CPU-bound, but monitoring showed they were actually memory-bound. This insight completely changed our instance type selection.

### 4. Multi-AZ Doesn't Always Mean One of Everything per AZ

We originally had resources deployed identically across three AZs. We learned that we could maintain high availability with asymmetric deployments, for example, having more instances in one AZ during low-traffic periods but ensuring we could scale up quickly in other AZs if needed.

### 5. Different Workloads Need Different Optimization Approaches

One-size-fits-all approaches fail for cloud optimization. Our user-facing APIs benefited from burstable instances and auto-scaling, while our data processing workloads were better suited to Spot Instances or Lambda functions. RDS databases worked best on reserved instances with appropriate sizing.

## The Implementation Process That Worked for Us

Rather than trying to optimize everything at once, we took a phased approach:

1. **Week 1-2**: Visibility and tagging implementation
2. **Week 3-4**: Quick wins (eliminating unused resources, simple right-sizing)
3. **Month 2**: Auto-scaling implementation and testing
4. **Month 3**: Storage and networking optimizations
5. **Month 4-5**: Reserved Instances and Savings Plans
6. **Month 6**: Serverless refactoring of batch workloads

This approach allowed us to see results quickly while building momentum for bigger changes.

## Results: Better Performance at Lower Cost

Our six-month optimization journey resulted in:

- **Monthly AWS bill**: Reduced from $127,346 to $34,384 (73% reduction)
- **Performance**: Improved by 20-45% across various metrics
- **Architecture**: Simpler and more maintainable
- **Reliability**: Maintained or improved
- **Team culture**: More cost-aware without sacrificing innovation

## Applying These Principles to Your AWS Infrastructure

Based on our experience, here's a starting framework you can use:

1. **Implement comprehensive tagging and monitoring**:

   - Environment, Team, Project, Purpose at minimum
   - Set up detailed CloudWatch dashboards for utilization

2. **Identify your baseline and variable workloads**:

   - Commit to Reserved Instances/Savings Plans for the baseline
   - Use auto-scaling for the variable portion
   - Consider serverless for highly variable workloads

3. **Look for the non-obvious optimizations**:

   - Storage costs (often overlooked)
   - Networking and data transfer
   - Idle resources running 24/7

4. **Test before implementing**:

   - Make changes in staging first
   - A/B test new instance types with a percentage of traffic
   - Verify performance metrics after each change

5. **Make cost optimization part of your culture**:
   - Include cost reviews in architecture discussions
   - Celebrate cost savings just like feature launches
   - Give teams visibility into their cloud spend

## Conclusion: Cost Optimization as a Continuous Process

Our cost optimization journey didn't end after six months. We've built ongoing optimization into our regular workflows. Each quarter, we review our infrastructure and look for new opportunities to optimize.

The biggest lesson? Cost optimization done right doesn't compromise performance or reliability, it often improves them by forcing you to understand your workloads better and leverage AWS services more effectively.

By being methodical, data-driven, and willing to challenge our assumptions, we transformed our AWS bill from a growing concern to a competitive advantage, freeing up resources to invest in new features and growth opportunities instead of unnecessary cloud spend.
