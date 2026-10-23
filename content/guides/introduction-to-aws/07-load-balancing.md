---
title: 'Load Balancing and Auto Scaling'
description: 'Put an AWS Application Load Balancer in front of an EC2 Auto Scaling group: launch templates, health checks, target tracking and free HTTPS with ACM.'
order: 7
---

**TLDR**: An **Application Load Balancer** (ALB) in two public subnets spreads requests over healthy targets. An **Auto Scaling group** (ASG) in the private subnets keeps the number of instances you ask for, replaces failed ones, and adds or removes instances with a **target tracking** policy. A **launch template** describes the instances. Keep the health check cheap, keep servers stateless, and terminate HTTPS on the load balancer with a free ACM certificate.

One web server is one failure away from an outage, and it cannot grow when traffic does. In this part the photo app gets a load balancer and a self-healing group of web servers in two Availability Zones.

## Prerequisites

- The `photo-app` VPC with public and private subnets, the S3 gateway endpoint and the security groups from [Part 5](/guides/introduction-to-aws/05-vpc-networking).
- The `photo-app-web` instance profile from [Part 3](/guides/introduction-to-aws/03-ec2-servers).
- Optional: a domain name you control, for HTTPS.

## How the Pieces Fit

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "Users", "icon": "globe", "tone": "slate" },
    { "label": "ALB :443", "sub": "public subnets, 2 AZs", "icon": "net", "tone": "amber" },
    { "label": "Target group", "sub": "health check /healthz", "icon": "check", "tone": "green" }
  ],
  "groups": [
    {
      "label": "Auto Scaling group",
      "sub": "min 2, desired 2, max 4, private subnets",
      "icon": "server",
      "tone": "blue",
      "groups": [
        {
          "label": "AZ us-east-1a",
          "icon": "server",
          "tone": "blue",
          "nodes": [{ "label": "web", "sub": "t4g.micro", "icon": "server", "tone": "blue", "status": "ok" }]
        },
        {
          "label": "AZ us-east-1b",
          "icon": "server",
          "tone": "blue",
          "nodes": [{ "label": "web", "sub": "t4g.micro", "icon": "server", "tone": "blue", "status": "ok" }]
        }
      ]
    }
  ]
}
```

- The **load balancer** accepts connections on its **listeners** (HTTP 80, HTTPS 443) and forwards them to a **target group**.
- The **target group** health-checks its targets and only sends traffic to healthy ones.
- The **Auto Scaling group** launches instances from a **launch template**, registers them in the target group, and replaces any instance that fails its health checks.

## Choose a Load Balancer

| Type                          | Layer                         | Use it for                                                                 |
| ----------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| **Application Load Balancer** | HTTP, HTTPS, gRPC, WebSockets | Web apps and APIs; routes by path, host name or header                     |
| **Network Load Balancer**     | TCP, UDP, TLS                 | Non-HTTP protocols, very high connection rates, static IP addresses per AZ |
| **Gateway Load Balancer**     | IP packets                    | Inserting firewalls and other network appliances                           |
| Classic Load Balancer         | HTTP and TCP                  | Previous generation; do not use for new work                               |

For the photo app, and for most web applications, the answer is an ALB.

## Design the Health Check

The target group calls a URL on every target at a fixed interval. The defaults for HTTP targets: path `/`, every **30 seconds**, **5 seconds** timeout, **5** successes to become healthy, **2** failures to become unhealthy, expecting status `200`.

Give the app a dedicated, cheap endpoint such as `/healthz`. It should answer "can this process serve requests?" and nothing more:

```javascript
import http from 'node:http';

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    // Load balancer health check: is this process able to serve requests?
    // Keep it cheap and local: no database or third-party calls here.
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok\n');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<h1>Hello from photo-app on ${process.env.INSTANCE_ID ?? 'localhost'}</h1>\n`);
});

server.listen(8080);
```

```terminal
{
  "title": "the health check from the load balancer's point of view (Node.js 24, local run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "curl -si http://localhost:8080/healthz",
      "output": "HTTP/1.1 200 OK\nContent-Type: text/plain\nDate: Fri, 23 Oct 2026 15:45:38 GMT\nConnection: keep-alive\nKeep-Alive: timeout=5\nTransfer-Encoding: chunked\n\nok"
    },
    {
      "cmd": "curl -s http://localhost:8080/",
      "output": "<h1>Hello from photo-app on localhost</h1>"
    }
  ]
}
```

Why not check the database in the same endpoint? If the database has a hiccup, every target fails its health check at once. The ALB then **fails open** (when all targets are unhealthy, it sends traffic to all of them anyway), but the Auto Scaling group may already be terminating and replacing perfectly good servers. Check dependencies in a separate endpoint that feeds your monitoring and alarms (Part 8), not the load balancer.

## Step 1: The Launch Template

A launch template is a versioned description of the instances to launch. In **EC2**, **Launch templates**, create `photo-app-web`:

- **AMI**: Amazon Linux 2023, arm64 (in the CLI or infrastructure code, use the SSM parameter from Part 3).
- **Instance type**: `t4g.micro`.
- **Key pair**: none.
- **Network settings**: do not pick a subnet (the Auto Scaling group chooses); security group `photo-app-web`.
- **Advanced details**: IAM instance profile `photo-app-web`, metadata version **V2 only (token required)**, and this user data:

```bash
#!/bin/bash
# Amazon Linux 2023: the package repositories are in S3, so this works
# from a private subnet through the S3 gateway endpoint (no NAT needed).
dnf install -y httpd
echo ok > /var/www/html/healthz

TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-id)
echo "<h1>Hello from photo-app on $INSTANCE_ID</h1>" > /var/www/html/index.html

systemctl enable --now httpd
```

The `photo-app-web` security group must allow HTTP 80 **from the `photo-app-alb` security group**, as planned in Part 5.

:::note
**Launch configurations**, the older way to describe ASG instances, are deprecated. Accounts created on or after 1 October 2024 cannot create them at all, and new instance types are not added to them. Use launch templates. The post [AWS ASG Launch Templates vs Launch Configurations](/posts/aws-asg-launch-templates-vs-configurations) covers migrating old groups.
:::

## Step 2: The Target Group and Load Balancer

1. **EC2**, **Target groups**, **Create target group**: type **Instances**, name `photo-app-web`, protocol HTTP, port 80, VPC `photo-app`. Health check path `/healthz`. Do not register targets; the ASG will.
2. **EC2**, **Load balancers**, **Create**, **Application Load Balancer**: name `photo-app-alb`, scheme **Internet-facing**, the `photo-app` VPC, and both **public** subnets.
3. Security group `photo-app-alb` (HTTP and HTTPS from anywhere).
4. Listener **HTTP:80** forwarding to `photo-app-web`. You change it to a redirect once HTTPS works.

The load balancer gets a DNS name such as `photo-app-alb-1234567890.us-east-1.elb.amazonaws.com`. Use that name (or your own domain pointing to it), never its IP addresses, which change.

## Step 3: The Auto Scaling Group

**EC2**, **Auto Scaling groups**, **Create**:

1. Name `photo-app-web`, launch template `photo-app-web`, version **Latest**.
2. Network: VPC `photo-app`, the two **private app** subnets (`app-a`, `app-b`).
3. **Attach to an existing load balancer**, target group `photo-app-web`. Turn on **Elastic Load Balancing health checks**, so instances that fail the ALB health check are replaced too, and set a **health check grace period** (for example 120 seconds) long enough for user data to finish.
4. Group size: **desired 2, minimum 2, maximum 4**.
5. Scaling: **Target tracking scaling policy**, metric **Average CPU utilization**, target **50**.
6. Add the `Project`, `Environment` and `Owner` tags, and choose **Create**.

After a few minutes, two instances run in different AZs and the target group shows them as **healthy**. Open the load balancer's DNS name and reload a few times: the instance ID in the page changes as the ALB alternates between targets.

## How Scaling Works

**Target tracking** is the policy to start with. You name a metric and a target value, and Auto Scaling creates and manages the CloudWatch alarms to keep the metric near it: it adds instances when the metric is above target and removes them, more cautiously, when it is well below.

| Metric                                     | Good for                                         |
| ------------------------------------------ | ------------------------------------------------ |
| `ASGAverageCPUUtilization`                 | CPU-bound apps                                   |
| `ALBRequestCountPerTarget`                 | Web apps where each request costs about the same |
| A custom metric (queue depth per instance) | Worker fleets reading from a queue               |

The same policy from the CLI:

```bash
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name photo-app-web \
  --policy-name cpu50 \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "PredefinedMetricSpecification": { "PredefinedMetricType": "ASGAverageCPUUtilization" },
    "TargetValue": 50.0
  }'
```

Other options:

- **Scheduled actions** change the desired capacity at known times (business hours, a product launch).
- **Predictive scaling** learns daily and weekly patterns and scales ahead of them.
- **Step scaling** reacts to alarms in steps you define. Use it only if target tracking does not fit.

New instances need time to boot and warm up before their metrics count. Set the group's **default instance warmup** to roughly that time, so one burst does not launch more instances than you need.

## Add HTTPS with ACM

AWS Certificate Manager (ACM) issues public TLS certificates for free when you use them with integrated services such as load balancers and CloudFront, and renews them automatically.

1. In **ACM** (same Region as the ALB), **Request** a public certificate for `photos.example.com`.
2. Choose **DNS validation** and create the CNAME record ACM shows you (one click if the domain is in Route 53).
3. Add a listener **HTTPS:443** to the ALB with the certificate, forwarding to `photo-app-web`. Keep the recommended default security policy.
4. Change the **HTTP:80** listener to **Redirect to HTTPS** (status 301).
5. Point `photos.example.com` at the load balancer: a Route 53 **alias** record, or a CNAME at another DNS provider.

Since February 2026, ACM public certificates are valid for at most 198 days, and the industry limit drops below 100 days in March 2027. Renewal is automatic as long as the validation CNAME stays in DNS, so never delete it.

Traffic from the ALB to the instances stays plain HTTP inside your VPC here. If you need encryption all the way, configure the target group for HTTPS and run TLS on the instances too.

## Route by Path or Host

ALB listener **rules** send different requests to different target groups:

| Condition                | Forward to                     |
| ------------------------ | ------------------------------ |
| Path `/api/*`            | `photo-app-api` target group   |
| Host `admin.example.com` | `photo-app-admin` target group |
| Default                  | `photo-app-web` target group   |

Each part of the application can then scale and deploy on its own.

## Keep Servers Stateless

Any instance can be terminated at any time: by a scale-in, a failed health check or an AZ problem. So:

- keep sessions in a shared store (ElastiCache, DynamoDB or the database), or use signed tokens;
- keep uploads in S3 (Part 4), not on the instance's disk;
- treat instances as cattle: no hand-made changes, everything comes from the launch template.

The ALB supports **sticky sessions**, but they pin users to instances, unbalance the load and lose those users' sessions when an instance goes away. Avoid them unless an old application leaves you no choice.

## Deploy a New Version

1. Create a new **version** of the launch template (new AMI or new user data).
2. Start an **instance refresh** on the ASG: it replaces instances in batches and waits for each new one to pass health checks before it continues.

```bash
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name photo-app-web \
  --preferences '{"MinHealthyPercentage": 100, "MaxHealthyPercentage": 150}'
```

With these preferences, the group launches new instances before it terminates old ones, so capacity never drops below 100 percent. An instance refresh can also roll back automatically when new instances fail, but only if the group uses a specific launch template version instead of **Latest** and you pass the new version as the desired configuration; see [instance refresh rollback](https://docs.aws.amazon.com/autoscaling/ec2/userguide/instance-refresh-rollback.html).

## Test That It Heals

- **Terminate one instance** in the EC2 console. Within a few minutes, the ASG launches a replacement and the target group marks it healthy. Users keep being served by the other instance meanwhile.
- **Generate load** with a tool such as `hey` or `k6` against the DNS name and watch the ASG's **Activity** tab add instances when average CPU passes 50 percent, then remove them after the load stops.

## What to Watch

ALB metrics in CloudWatch (namespace `AWS/ApplicationELB`):

- `HealthyHostCount` and `UnHealthyHostCount` per target group;
- `TargetResponseTime`;
- `HTTPCode_Target_5XX_Count` (your app failed) versus `HTTPCode_ELB_5XX_Count` (the load balancer itself returned the error, for example because no targets are registered or a target refused the connection);
- `RequestCount`.

Turn on **access logs** to S3 to see every request with its timing and status.

## What It Costs

- The **ALB**: per hour, plus **Load Balancer Capacity Units** (LCUs) based on new connections, active connections, processed bytes and rule evaluations.
- **Public IPv4 addresses**: an internet-facing ALB has a public address in each of its AZs, and each one is billed like any public IPv4 address (Part 3).
- The **instances** and their EBS volumes, for every hour they run.
- Auto Scaling itself is free.

See the [Elastic Load Balancing pricing page](https://aws.amazon.com/elasticloadbalancing/pricing/). A load balancer costs money every hour it exists, with or without traffic, so delete it when you finish the guide.

## Common Mistakes

- **Instances in public subnets with public IPs.** Only the load balancer needs to be public.
- **The web security group allows `0.0.0.0/0`** instead of only the ALB's security group.
- **A health check that is too strict or too slow**, such as one that queries the database: one slow dependency takes down every target.
- **A grace period shorter than boot time**, so the ASG kills instances that are still installing.
- **Minimum size 1.** One instance in one AZ is not high availability.
- **Maximum size with no thought.** It is your cost ceiling; set it on purpose.

## Clean Up

Once the Auto Scaling group serves traffic, terminate the `photo-app-dev-web` instance from Part 5 unless you still need it for the database tunnel in Part 6.

To remove this part's resources later, delete in this order: the Auto Scaling group (it terminates its instances), the load balancer, the target group, then the launch template. Check **EC2**, **Instances** and **Volumes** for leftovers.

## Summary

- An ALB in public subnets forwards to a target group; an ASG in private subnets keeps the targets healthy and the count right.
- Launch templates replace launch configurations; instance refresh rolls out new versions.
- Target tracking on CPU or requests per target is the default scaling policy.
- Health checks stay shallow; dependency checks belong in monitoring.
- ACM certificates on the ALB give you free HTTPS that renews itself.

Next: [CloudWatch: Monitoring Your Applications](/guides/introduction-to-aws/08-cloudwatch-monitoring), so you know when something goes wrong before your users tell you.

## Keep Learning

- Try the [Load Balancer Algorithm Simulator](/games/load-balancer-simulator) and the [Horizontal vs Vertical Scaling Simulator](/games/scaling-simulator)
- [How to Design a Multi-Region Active-Active Architecture on AWS](/posts/multi-region-active-active-aws)
- [Ingress vs Load Balancer in Kubernetes: When to Use Each](/posts/ingress-vs-load-balancer-kubernetes)
