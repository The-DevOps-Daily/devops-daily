---
title: 'Cloud Networking: VPCs, Subnets, Security Groups and NAT'
description: 'Map a lab network onto an AWS VPC: subnets across zones, route tables, NAT gateways, security groups vs NACLs, endpoints, peering, flow logs and costs.'
order: 7
---

A cloud **VPC** (Virtual Private Cloud) is the lab from Part 1, run by someone else. You still choose address ranges and subnets, you still write routes and firewall rules, and NAT still decides how private machines reach the internet. What changes is that every piece is an API object with a price, and that the provider spreads your network over several data centres (**availability zones**) so that one of them can fail.

In this part you translate the lab into an AWS VPC, build the core of it with the AWS CLI, and compare AWS with Google Cloud, Azure and DigitalOcean. Then you look at the parts that cause most cloud networking surprises: security groups versus network ACLs, connecting VPCs, private access to cloud services, and the bill.

## Prerequisites

- Subnetting and NAT from [Part 2](/guides/networking-fundamentals/02-ip-addressing-and-subnetting), firewalls from [Part 4](/guides/networking-fundamentals/04-network-security-and-firewalls-basics).
- To run the commands: an AWS account, the [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) with credentials, and a region (`export AWS_REGION=us-east-1`). The commands create resources that cost money, mainly the NAT gateway and public IPv4 addresses; the cleanup is at the end of the section. Reading along works too: each command's syntax was checked with AWS CLI v2 in the guide's companion repository.

## The Lab, Translated

Every piece of the lab has a managed counterpart:

| In the lab                                                         | In an AWS VPC                                                         | Notes                                                                 |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `10.0.0.0/16` behind the router                                    | The VPC's CIDR block                                                  | Pick it once; you can add blocks later, not change the first          |
| One bridge per subnet                                              | A **subnet**, in one availability zone                                | AWS subnets never span zones                                          |
| The router's routing                                               | **Route tables**, one per group of subnets                            | Each subnet uses exactly one route table                              |
| The router's connection to the simulated internet through `br-wan` | An **internet gateway**                                               | A route to it is what makes a subnet "public"                         |
| `masquerade` for private subnets                                   | A **NAT gateway**                                                     | Outbound only; costs per hour and per GB                              |
| `dnat` to `lb` on `203.0.113.80`                                   | A public IP on a load balancer or instance                            | The internet gateway does the 1:1 translation                         |
| nftables on the router and hosts                                   | **Security groups** (per interface) and **network ACLs** (per subnet) | Security groups are stateful, NACLs are not                           |
| Unbound on the router                                              | The **Route 53 Resolver** at the VPC base address + 2                 | `10.20.0.2` in a `10.20.0.0/16` VPC, and `169.254.169.253` everywhere |
| BIND's `shop.internal` zone                                        | A Route 53 **private hosted zone**                                    | Answers only inside associated VPCs                                   |

## Design the VPC

Use the plan from Part 2: `10.20.0.0/16`, with a public, an app and a data subnet in each zone. Two zones are the minimum for availability; three are common for production. The internet reaches only the load balancer in the public subnets; everything else has private addresses:

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "Internet", "icon": "globe", "tone": "slate" },
    { "label": "Internet gateway", "icon": "net", "tone": "amber" },
    { "label": "Load balancer", "sub": "public subnets", "icon": "server", "tone": "green" },
    { "label": "App instances", "sub": "app subnets :8080", "icon": "box", "tone": "blue" },
    { "label": "Database", "sub": "data subnets :5432", "icon": "database", "tone": "violet" }
  ],
  "groups": [
    {
      "label": "VPC 10.20.0.0/16",
      "icon": "cloud",
      "tone": "amber",
      "groups": [
        {
          "label": "VPC-wide",
          "icon": "net",
          "tone": "amber",
          "nodes": [
            { "label": "Internet gateway", "sub": "routes for public subnets", "icon": "globe", "tone": "amber" },
            { "label": "NAT gateway", "sub": "regional: serves every zone", "icon": "net", "tone": "amber" }
          ]
        },
        {
          "label": "zone a",
          "icon": "net",
          "tone": "slate",
          "nodes": [
            { "label": "public-a", "sub": "10.20.108.0/24: LB", "icon": "net", "tone": "green" },
            { "label": "app-a", "sub": "10.20.0.0/19", "icon": "box", "tone": "blue" },
            { "label": "data-a", "sub": "10.20.96.0/22", "icon": "database", "tone": "violet" }
          ]
        },
        {
          "label": "zone b",
          "icon": "net",
          "tone": "slate",
          "nodes": [
            { "label": "public-b", "sub": "10.20.109.0/24: LB", "icon": "net", "tone": "green" },
            { "label": "app-b", "sub": "10.20.32.0/19", "icon": "box", "tone": "blue" },
            { "label": "data-b", "sub": "10.20.100.0/22", "icon": "database", "tone": "violet" }
          ]
        }
      ]
    }
  ]
}
```

A subnet is **public** only because its route table sends `0.0.0.0/0` to the internet gateway. Nothing else about it is special. A **private** subnet's route table sends `0.0.0.0/0` to a NAT gateway instead, or nowhere at all for a data tier that never needs the internet.

## Build It with the AWS CLI

Each create command prints the new resource's ID with `--query ... --output text`, which you keep in a shell variable for the next command. First the VPC with DNS host names turned on (needed for private hosted zones and for interface endpoints), and the subnets of zone `a`:

```bash
VPC=$(aws ec2 create-vpc --cidr-block 10.20.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=shop}]' \
  --query Vpc.VpcId --output text)
aws ec2 modify-vpc-attribute --vpc-id "$VPC" --enable-dns-hostnames '{"Value":true}'

PUB_A=$(aws ec2 create-subnet --vpc-id "$VPC" --cidr-block 10.20.108.0/24 --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=public-a}]' \
  --query Subnet.SubnetId --output text)
APP_A=$(aws ec2 create-subnet --vpc-id "$VPC" --cidr-block 10.20.0.0/19 --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=app-a}]' \
  --query Subnet.SubnetId --output text)
PUB_B=$(aws ec2 create-subnet --vpc-id "$VPC" --cidr-block 10.20.109.0/24 --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=public-b}]' \
  --query Subnet.SubnetId --output text)
APP_B=$(aws ec2 create-subnet --vpc-id "$VPC" --cidr-block 10.20.32.0/19 --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=app-b}]' \
  --query Subnet.SubnetId --output text)
```

The data subnets (`10.20.96.0/22` and `10.20.100.0/22`) follow the same pattern. Zone names such as `us-east-1a` map to different physical zones in different AWS accounts; when you coordinate across accounts, use zone IDs (`use1-az1`), which `aws ec2 describe-availability-zones` lists.

Now the way out. An internet gateway, attached to the VPC, and a public route table that sends everything else to it:

```bash
IGW=$(aws ec2 create-internet-gateway --query InternetGateway.InternetGatewayId --output text)
aws ec2 attach-internet-gateway --vpc-id "$VPC" --internet-gateway-id "$IGW"

PUBLIC_RT=$(aws ec2 create-route-table --vpc-id "$VPC" --query RouteTable.RouteTableId --output text)
aws ec2 create-route --route-table-id "$PUBLIC_RT" --destination-cidr-block 0.0.0.0/0 --gateway-id "$IGW"
aws ec2 associate-route-table --route-table-id "$PUBLIC_RT" --subnet-id "$PUB_A"
aws ec2 associate-route-table --route-table-id "$PUBLIC_RT" --subnet-id "$PUB_B"
```

The private subnets get outbound access through a NAT gateway. A **regional** NAT gateway is a single gateway that serves every zone of the VPC, so you no longer need one zonal NAT gateway per zone (the default `zonal` mode still exists and is what older guides show):

```bash
NAT=$(aws ec2 create-nat-gateway --availability-mode regional --vpc-id "$VPC" \
  --query NatGateway.NatGatewayId --output text)
aws ec2 wait nat-gateway-available --nat-gateway-ids "$NAT"

PRIVATE_RT=$(aws ec2 create-route-table --vpc-id "$VPC" --query RouteTable.RouteTableId --output text)
aws ec2 create-route --route-table-id "$PRIVATE_RT" --destination-cidr-block 0.0.0.0/0 --nat-gateway-id "$NAT"
aws ec2 associate-route-table --route-table-id "$PRIVATE_RT" --subnet-id "$APP_A"
aws ec2 associate-route-table --route-table-id "$PRIVATE_RT" --subnet-id "$APP_B"
```

Check what a subnet actually uses. A subnet without an explicit association falls back to the VPC's **main route table**, a frequent source of "why can this subnet reach the internet":

```bash
aws ec2 describe-route-tables --filters "Name=association.subnet-id,Values=$APP_A" \
  --query 'RouteTables[].Routes[].[DestinationCidrBlock,GatewayId,NatGatewayId]' --output table
```

The rest of this part adds security groups, an endpoint and flow logs to the same VPC; [Clean Up](#h2-clean-up) at the end removes everything in the right order. Clicking or scripting this is how you learn it. For anything you keep, use infrastructure as code; [Part 9](/guides/networking-fundamentals/09-network-automation) builds the same VPC with Terraform.

### The Same Network on Other Clouds

The ideas carry over, but the scope of a subnet does not. On AWS a subnet lives in one zone; on Google Cloud and Azure a subnet is regional and spans zones; on DigitalOcean a VPC is a single regional range with no subnets at all. These are standalone examples for comparison, not steps of the exercise above (the AWS one uses its own variable, so it does not overwrite `$VPC`):

```tabs
{
  "title": "Create a VPC network and one subnet",
  "tabs": [
    {
      "label": "AWS",
      "lang": "bash",
      "code": "# subnets are zonal: one per tier per zone\nDEMO_VPC=$(aws ec2 create-vpc --cidr-block 10.20.0.0/16 --query Vpc.VpcId --output text)\naws ec2 create-subnet --vpc-id \"$DEMO_VPC\" --cidr-block 10.20.0.0/19 --availability-zone us-east-1a"
    },
    {
      "label": "Google Cloud",
      "lang": "bash",
      "code": "# the network is global, subnets are regional (they span all zones of the region)\ngcloud compute networks create shop --subnet-mode=custom\ngcloud compute networks subnets create app --network=shop --region=us-central1 --range=10.20.0.0/19"
    },
    {
      "label": "Azure",
      "lang": "bash",
      "code": "# a VNet is regional; subnets span the region's zones\naz network vnet create --resource-group shop --name shop --address-prefixes 10.20.0.0/16 \\\n  --subnet-name app --subnet-prefixes 10.20.0.0/19"
    },
    {
      "label": "DigitalOcean",
      "lang": "bash",
      "code": "# one regional range per VPC; Droplets in the region pick addresses from it\ndoctl vpcs create --name shop --region fra1 --ip-range 10.20.0.0/16"
    }
  ]
}
```

Firewalls follow the same split: AWS security groups and Azure network security groups attach to interfaces (and Azure's also to subnets), Google Cloud firewall rules apply to the whole network and select instances by tag or service account, and DigitalOcean Cloud Firewalls attach to Droplets by ID or tag.

## Security Groups and Network ACLs

AWS has two firewalls, and they behave differently:

|             | Security group                                                 | Network ACL                                |
| ----------- | -------------------------------------------------------------- | ------------------------------------------ |
| Attached to | Network interfaces (instances, load balancers, RDS, endpoints) | Subnets                                    |
| State       | **Stateful**: replies are allowed automatically                | **Stateless**: replies need their own rule |
| Rules       | Allow only                                                     | Allow and deny, numbered, first match wins |
| Sources     | CIDR blocks, prefix lists, **other security groups**           | CIDR blocks only                           |
| Default     | Deny all inbound, allow all outbound                           | The default NACL allows everything         |

Security groups do almost all the work. Their best feature is referencing another security group as the source: "the app may accept 8080 from anything that has the load balancer's security group", whatever its addresses are. That is the Part 4 zone model, expressed as identities instead of subnets:

```bash
LB_SG=$(aws ec2 create-security-group --vpc-id "$VPC" --group-name shop-lb \
  --description "load balancer" --query GroupId --output text)
APP_SG=$(aws ec2 create-security-group --vpc-id "$VPC" --group-name shop-app \
  --description "app instances" --query GroupId --output text)
DB_SG=$(aws ec2 create-security-group --vpc-id "$VPC" --group-name shop-db \
  --description "database" --query GroupId --output text)

aws ec2 authorize-security-group-ingress --group-id "$LB_SG" --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id "$APP_SG" --protocol tcp --port 8080 --source-group "$LB_SG"
aws ec2 authorize-security-group-ingress --group-id "$DB_SG" --protocol tcp --port 5432 --source-group "$APP_SG"
```

Because a NACL is stateless, allowing inbound HTTPS also needs an outbound rule for the replies, which go to the client's **ephemeral port** (Part 1): 1024 to 65535 covers every operating system. Most teams leave NACLs open and use them only for broad blocks, such as denying a hostile address range for a whole subnet. A new NACL denies everything until you add rules, and you still have to associate it with subnets:

```bash
NACL=$(aws ec2 create-network-acl --vpc-id "$VPC" --query NetworkAcl.NetworkAclId --output text)
aws ec2 create-network-acl-entry --network-acl-id "$NACL" --ingress --rule-number 100 \
  --protocol tcp --port-range From=443,To=443 --cidr-block 0.0.0.0/0 --rule-action allow
aws ec2 create-network-acl-entry --network-acl-id "$NACL" --egress --rule-number 100 \
  --protocol tcp --port-range From=1024,To=65535 --cidr-block 0.0.0.0/0 --rule-action allow
```

Admin access does not need SSH open to the internet. **Systems Manager Session Manager** gives a shell through AWS's API with no inbound port at all, controlled by IAM and logged. **EC2 Instance Connect Endpoint** reaches instances in private subnets without public addresses, but it still uses SSH: the instance's security group must allow port 22 from the endpoint's security group (and nowhere else).

## Connecting Networks

A VPC rarely stays alone. The options, from simplest to most general:

- **VPC peering** connects two VPCs (also across accounts and regions). It is not transitive: if A peers with B and B with C, A still cannot reach C. Both sides need routes, and the ranges must not overlap (Part 2).
- **Transit Gateway** is a regional router that many VPCs and VPNs attach to; routes between them are managed in one place. It charges per attachment hour and per GB.
- **Site-to-site VPN** (IPsec) and **Direct Connect** (a dedicated line) connect a data centre or office.
- **PrivateLink** publishes one service from a VPC to other VPCs as an endpoint, without connecting the networks at all, and with overlapping ranges allowed.

### Private Access to AWS Services

Instances in private subnets reach S3, DynamoDB, ECR and other AWS APIs through the NAT gateway by default, and you pay NAT processing for every GB. **VPC endpoints** avoid that:

- **Gateway endpoints** (S3 and DynamoDB only) are route table entries, with no hourly or per-GB charge. Add one to every VPC that uses S3:

```bash
S3_ENDPOINT=$(aws ec2 create-vpc-endpoint --vpc-id "$VPC" --vpc-endpoint-type Gateway \
  --service-name "com.amazonaws.$AWS_REGION.s3" --route-table-ids "$PRIVATE_RT" \
  --query VpcEndpoint.VpcEndpointId --output text)
```

- **Interface endpoints** put a network interface for a service (ECR, Secrets Manager, CloudWatch, STS and hundreds more) into your subnets. They cost per zone per hour and per GB, so they pay off for heavy traffic or for subnets with no internet access at all.

## DNS Inside the VPC

The VPC's resolver answers at the VPC base address plus two (`10.20.0.2`) and at `169.254.169.253` from every subnet. It resolves public names, AWS's internal host names (`ip-10-20-0-15.ec2.internal`), and **private hosted zones** associated with the VPC. A private zone such as `shop.internal` works like the lab's `ns1`: internal names with internal addresses, invisible from the internet. **Route 53 Resolver endpoints** forward queries between the VPC and on-premises DNS servers in either direction.

## Load Balancers and Kubernetes

AWS's managed load balancers map onto Part 5: the **Application Load Balancer** works at layer 7 (paths, host names, headers, weighted target groups for canaries), the **Network Load Balancer** at layer 4 (TCP, UDP, TLS passthrough, static addresses per zone). Both live in the public subnets of each zone and send traffic to **target groups** with their own health checks. The [load balancing part](/guides/introduction-to-aws/07-load-balancing) of the AWS guide sets one up.

Kubernetes on AWS (EKS) uses the **VPC CNI** by default: every pod gets a real VPC address from the node's subnet, so pods are reachable from anywhere in the VPC without overlays, and security groups and flow logs see pod addresses. The cost is address space: a node reserves addresses for the pods it may run. That is why Part 2 gave the app subnets a /19 each. Prefix delegation (a /28 per node interface instead of single addresses) packs more pods per node, and a secondary CIDR from `100.64.0.0/10` can host pods when the main range runs low.

## See the Traffic

**VPC Flow Logs** record accepted and rejected traffic per network interface, aggregated into records over a short capture window and sent to CloudWatch Logs or S3. Some traffic is never logged, such as queries to the Amazon-provided DNS server and instance metadata requests, and records can be skipped under load, so treat them as a sample of the truth rather than a packet log. A record in the default format looks like this (an example from the format AWS documents, not a captured log):

```text
2 123456789012 eni-0a1b2c3d4e5f67890 203.0.113.10 10.20.0.15 51616 22 6 1 60 1793091600 1793091660 REJECT OK
```

The fields are the version, account, interface, source and destination address, source and destination port, protocol (6 is TCP), packets, bytes, the capture window, and the action. A burst of `REJECT` records to port 22 from one address is a scan. A `REJECT` for traffic you expected to work means a security group or a network ACL blocked it (or a packet arrived for a connection that was already closed); check both. Turn them on for the VPC (`$FLOW_LOGS_ROLE_ARN` is an IAM role that allows the flow logs service to write to CloudWatch Logs):

```bash
FLOW_LOG=$(aws ec2 create-flow-logs --resource-type VPC --resource-ids "$VPC" --traffic-type REJECT \
  --log-destination-type cloud-watch-logs --log-group-name /vpc/shop/flow-logs \
  --deliver-logs-permission-arn "$FLOW_LOGS_ROLE_ARN" --query 'FlowLogIds[0]' --output text)
```

**Reachability Analyzer** answers "can A reach B on this port, and if not, which rule blocks it" by analysing the configuration, without sending a packet. The exercise above creates no instances, so this one is optional: run it when you have two instances in the VPC and have put their IDs in `APP_INSTANCE` and `DB_INSTANCE`:

```bash
PATH_ID=$(aws ec2 create-network-insights-path --source "$APP_INSTANCE" --destination "$DB_INSTANCE" \
  --protocol tcp --destination-port 5432 --query NetworkInsightsPath.NetworkInsightsPathId --output text)
ANALYSIS_ID=$(aws ec2 start-network-insights-analysis --network-insights-path-id "$PATH_ID" \
  --query NetworkInsightsAnalysis.NetworkInsightsAnalysisId --output text)
aws ec2 describe-network-insights-analyses --network-insights-analysis-ids "$ANALYSIS_ID" \
  --query 'NetworkInsightsAnalyses[0].[Status,NetworkPathFound]' --output text
```

## What Networking Costs

Network charges are easy to miss until the bill arrives. The main items on AWS, from AWS's pricing pages in October 2026:

| Item                    | Price                                                                                                             | How to keep it down                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| NAT gateway             | USD 0.045 per hour and 0.045 per GB processed (AWS's US East example; regional NAT gateways bill per active zone) | Gateway endpoints for S3 and DynamoDB; interface endpoints for heavy AWS API traffic; IPv6 with an egress-only internet gateway |
| Public IPv4 address     | USD 0.005 per hour, in use or idle (about USD 3.60 a month)                                                       | Load balancers and NAT instead of public IPs per instance; IPv6                                                                 |
| Traffic between zones   | USD 0.01 per GB in each direction                                                                                 | Keep chatty services in one zone where availability allows; topology-aware routing in Kubernetes                                |
| Traffic to the internet | First 100 GB a month free across services, then per GB by region                                                  | CDN caching; compression                                                                                                        |
| Gateway endpoints       | No charge                                                                                                         | Add them by default                                                                                                             |
| Interface endpoints     | USD 0.01 per zone per hour and 0.01 per GB                                                                        | Share them across VPCs, or only add the ones you use                                                                            |

Two numbers explain most surprise bills: the NAT gateway's per-GB charge on traffic that could have used a gateway endpoint (container image pulls from ECR, backups to S3), and cross-zone traffic between services that talk constantly. The post on [object storage egress fine print](/posts/object-storage-free-egress-fine-print) compares egress across providers.

## Clean Up

Delete what you created in dependency order: the analysis and flow logs, the endpoint, the NAT gateway (it costs money every hour, so do not skip it), the internet gateway, the security groups from the inside out (each one is referenced by the next), the network ACL, the subnets, the route tables, and finally the VPC. Add the data subnets if you created them:

```bash
# only if you ran the optional Reachability Analyzer example
aws ec2 delete-network-insights-analysis --network-insights-analysis-id "$ANALYSIS_ID"
aws ec2 delete-network-insights-path --network-insights-path-id "$PATH_ID"
aws ec2 delete-flow-logs --flow-log-ids "$FLOW_LOG"
aws logs delete-log-group --log-group-name /vpc/shop/flow-logs
aws ec2 delete-vpc-endpoints --vpc-endpoint-ids "$S3_ENDPOINT"
aws ec2 delete-nat-gateway --nat-gateway-id "$NAT"
aws ec2 wait nat-gateway-deleted --nat-gateway-ids "$NAT"
aws ec2 detach-internet-gateway --internet-gateway-id "$IGW" --vpc-id "$VPC"
aws ec2 delete-internet-gateway --internet-gateway-id "$IGW"
aws ec2 delete-security-group --group-id "$DB_SG"
aws ec2 delete-security-group --group-id "$APP_SG"
aws ec2 delete-security-group --group-id "$LB_SG"
aws ec2 delete-network-acl --network-acl-id "$NACL"
aws ec2 delete-subnet --subnet-id "$PUB_A"
aws ec2 delete-subnet --subnet-id "$APP_A"
aws ec2 delete-subnet --subnet-id "$PUB_B"
aws ec2 delete-subnet --subnet-id "$APP_B"
aws ec2 delete-route-table --route-table-id "$PUBLIC_RT"
aws ec2 delete-route-table --route-table-id "$PRIVATE_RT"
aws ec2 delete-vpc --vpc-id "$VPC"
```

Then check for leftovers that keep billing, such as Elastic IP addresses that nothing uses any more (release them with `aws ec2 release-address --allocation-id ...`):

```bash
aws ec2 describe-addresses --query 'Addresses[].[AllocationId,PublicIp,AssociationId]' --output table
```

## Common Mistakes

- **Overlapping CIDRs** between VPCs, offices and Kubernetes ranges: peering refuses them, and fixing them later means rebuilding. Plan with Part 2's script.
- **One zonal NAT gateway for all zones.** When its zone fails, every private subnet loses the internet, and traffic from other zones pays cross-zone charges. Use one per zone, or a regional NAT gateway.
- **SSH or databases open to `0.0.0.0/0`.** Use Session Manager or Instance Connect Endpoint for shells, and security group references for databases. **VPC Block Public Access** can forbid internet access for whole VPCs or subnets at the account level.
- **Forgetting the route table.** A subnet without an explicit association uses the main route table, which may route to places you did not intend.
- **Subnets too small for Kubernetes**, where every pod takes a VPC address.
- **Treating NACLs like security groups.** They are stateless; a missing outbound rule for ephemeral ports breaks every connection in a way that looks like a timeout.

## Summary

- A VPC is a private range split into subnets; on AWS each subnet lives in one zone, on Google Cloud and Azure subnets span the region.
- Route tables decide everything: a route to an internet gateway makes a subnet public, a route to a NAT gateway gives private subnets outbound access.
- Security groups are stateful and can reference each other; NACLs are stateless subnet filters for broad rules.
- Peering, Transit Gateway, VPN and PrivateLink connect networks; gateway endpoints keep S3 and DynamoDB traffic off the NAT gateway for free.
- Flow logs and Reachability Analyzer show what is allowed and what is blocked; NAT processing, public IPv4 and cross-zone traffic dominate the network bill.

Next, [Part 8](/guides/networking-fundamentals/08-network-monitoring-and-troubleshooting) is a toolkit for the day something in the network breaks.

## Keep Learning

- [AWS VPC simulator](/games/aws-vpc-simulator)
- Interview questions: [AWS VPC networking fundamentals](/interview-questions/junior/aws-vpc-networking)
- Exercise: [build an AWS VPC with Terraform](/exercises/terraform-aws-vpc)
- [VPC networking](/guides/introduction-to-aws/05-vpc-networking) in the Introduction to AWS guide
