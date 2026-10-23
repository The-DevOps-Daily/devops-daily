---
title: 'VPC: Build Your Private Network'
description: 'Design an AWS VPC: plan CIDR ranges, create public and private subnets in two AZs, set up route tables, NAT gateways, security groups and VPC endpoints.'
order: 5
---

**TLDR**: A VPC is your private network in one Region. Split it into subnets, one AZ each. A **public subnet** has a route to an internet gateway; a **private subnet** does not. Put load balancers in public subnets and servers and databases in private ones. Security groups are stateful firewalls on each resource and can reference each other. Private servers reach the internet through a NAT gateway (which costs money every hour) and reach S3 for free through a gateway endpoint.

Every AWS account comes with a **default VPC** in each Region: `172.31.0.0/16`, one public subnet per Availability Zone, and an internet gateway. Your Part 3 instance runs there. It is fine for experiments, but every instance in it gets a public address by default, and you did not design any of it.

In this part you build the network the rest of the guide uses: a VPC with public and private subnets in two Availability Zones, so that only the load balancer faces the internet.

## Prerequisites

- The CLI profile from [Part 2](/guides/introduction-to-aws/02-iam-security).
- Basic IP addressing: an address like `10.0.1.25`, and CIDR notation such as `10.0.0.0/16` (the first 16 bits are fixed, the rest is yours).

## The Pieces of a VPC

| Piece                | What it does                                                                 | Cost                                                 |
| -------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| **VPC**              | An isolated IP range (CIDR block) in one Region                              | Free                                                 |
| **Subnet**           | A slice of the VPC's range in exactly one AZ                                 | Free                                                 |
| **Route table**      | Decides where traffic leaving a subnet goes                                  | Free                                                 |
| **Internet gateway** | Connects public subnets to the internet, both directions                     | Free (data transfer is billed)                       |
| **NAT gateway**      | Lets private subnets start connections to the internet, not receive them     | Hourly plus per GB                                   |
| **Security group**   | Stateful firewall on a network interface (instance, load balancer, database) | Free                                                 |
| **Network ACL**      | Stateless firewall on a subnet                                               | Free                                                 |
| **VPC endpoint**     | Private path to AWS services without the internet                            | Gateway type free; interface type hourly plus per GB |

What makes a subnet "public" is only its route table: a route for `0.0.0.0/0` to an internet gateway. Instances in it also need a public IP address to be reachable.

## The Network You Will Build

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "Internet", "icon": "globe", "tone": "slate" },
    { "label": "Internet gateway", "icon": "net", "tone": "amber" },
    { "label": "Load balancer", "sub": "public subnets", "icon": "net", "tone": "green" },
    { "label": "Web servers", "sub": "private subnets", "icon": "server", "tone": "blue" },
    { "label": "Database", "sub": "private subnets", "icon": "database", "tone": "violet" }
  ],
  "groups": [
    {
      "label": "photo-app VPC",
      "sub": "10.0.0.0/16, us-east-1",
      "icon": "cloud",
      "tone": "slate",
      "groups": [
        {
          "label": "AZ us-east-1a",
          "icon": "server",
          "tone": "blue",
          "nodes": [
            { "label": "public-a", "sub": "10.0.0.0/24", "icon": "net", "tone": "green" },
            { "label": "app-a", "sub": "10.0.10.0/24", "icon": "server", "tone": "blue" },
            { "label": "db-a", "sub": "10.0.20.0/24", "icon": "database", "tone": "violet" }
          ]
        },
        {
          "label": "AZ us-east-1b",
          "icon": "server",
          "tone": "blue",
          "nodes": [
            { "label": "public-b", "sub": "10.0.1.0/24", "icon": "net", "tone": "green" },
            { "label": "app-b", "sub": "10.0.11.0/24", "icon": "server", "tone": "blue" },
            { "label": "db-b", "sub": "10.0.21.0/24", "icon": "database", "tone": "violet" }
          ]
        }
      ]
    }
  ]
}
```

Two AZs is the minimum for anything that should survive a data center problem: the load balancer (Part 7) and RDS Multi-AZ (Part 6) both require subnets in at least two AZs.

## Plan the Address Space

Pick a private range (RFC 1918) that does not overlap with your office network, your VPN or any other VPC you might connect later. `10.0.0.0/16` gives you 65,536 addresses, plenty of room for subnets. In every subnet, AWS reserves five addresses: the network address, the next three (VPC router, DNS, future use) and the last one.

A few lines of Python check a plan before you create anything:

```python
import ipaddress

vpc = ipaddress.ip_network("10.0.0.0/16")
plan = {
    "public-a": "10.0.0.0/24",
    "public-b": "10.0.1.0/24",
    "app-a": "10.0.10.0/24",
    "app-b": "10.0.11.0/24",
    "db-a": "10.0.20.0/24",
    "db-b": "10.0.21.0/24",
}

print(f"VPC {vpc}: {vpc.num_addresses} addresses")
nets = [ipaddress.ip_network(c) for c in plan.values()]
for name, net in zip(plan, nets):
    assert net.subnet_of(vpc), name
    # AWS reserves the first four addresses and the last one in every subnet
    print(f"{name:9} {str(net):14} {net.num_addresses - 5} usable")
assert not any(a.overlaps(b) for i, a in enumerate(nets) for b in nets[i + 1:])
print("no overlaps")
```

```terminal
{
  "title": "check the subnet plan",
  "prompt": "$",
  "steps": [
    {
      "cmd": "python3 subnets.py",
      "output": "VPC 10.0.0.0/16: 65536 addresses\npublic-a  10.0.0.0/24    251 usable\npublic-b  10.0.1.0/24    251 usable\napp-a     10.0.10.0/24   251 usable\napp-b     10.0.11.0/24   251 usable\ndb-a      10.0.20.0/24   251 usable\ndb-b      10.0.21.0/24   251 usable\nno overlaps"
    }
  ]
}
```

The gaps between `10.0.1.0/24` and `10.0.10.0/24` leave room for a third AZ or more subnets later. You cannot shrink or move a subnet after creating it, so err on the generous side.

## Create the VPC

The console's **VPC and more** wizard creates the VPC, subnets, route tables, internet gateway and endpoints in one go, and draws a preview of the result:

1. Open **VPC**, choose **Create VPC**, then **VPC and more**.
2. **Name tag auto-generation**: `photo-app`. **IPv4 CIDR block**: `10.0.0.0/16`.
3. **Number of Availability Zones**: 2, and under **Customize AZs** pick `us-east-1a` and `us-east-1b`. **Number of public subnets**: 2. **Number of private subnets**: 4.
4. Expand **Customize subnets CIDR blocks** and enter the six ranges from the plan.
5. **NAT gateways**: **None** for now (see [NAT Gateways](#h2-nat-gateways) before you add one).
6. **VPC endpoints**: **S3 Gateway**.
7. Keep **Enable DNS hostnames** and **Enable DNS resolution** checked, and choose **Create VPC**.

The wizard names subnets like `photo-app-subnet-public1-us-east-1a`. Rename the six subnets (select one, **Tags**, edit **Name**) to `public-a`, `public-b`, `app-a`, `app-b`, `db-a` and `db-b`, matching their CIDR ranges, so they match the names used in the rest of this guide.

The same core steps with the CLI show what the wizard does for you (IDs are examples):

```bash
# The VPC and one public subnet
aws ec2 create-vpc --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=photo-app-vpc}]'
aws ec2 create-subnet --vpc-id vpc-0abc1234def567890 \
  --cidr-block 10.0.0.0/24 --availability-zone us-east-1a

# An internet gateway, attached to the VPC
aws ec2 create-internet-gateway
aws ec2 attach-internet-gateway --vpc-id vpc-0abc1234def567890 \
  --internet-gateway-id igw-0abc1234def567890

# A route table with a default route to the internet gateway,
# associated with the public subnet
aws ec2 create-route-table --vpc-id vpc-0abc1234def567890
aws ec2 create-route --route-table-id rtb-0abc1234def567890 \
  --destination-cidr-block 0.0.0.0/0 --gateway-id igw-0abc1234def567890
aws ec2 associate-route-table --route-table-id rtb-0abc1234def567890 \
  --subnet-id subnet-0abc1234def567890
```

In real projects you describe the network in code instead, with Terraform or CloudFormation, so it can be reviewed and rebuilt. The [AWS VPC with Terraform exercise](/exercises/terraform-aws-vpc) builds this layout.

## Route Tables

Each subnet uses exactly one route table. After the wizard, they look like this (IDs are examples):

```text
Public route table (public-a, public-b)
  Destination      Target
  10.0.0.0/16      local
  0.0.0.0/0        igw-0abc1234def567890
  pl-63a5400a      vpce-0abc1234def567890   (S3 gateway endpoint)

Private route tables (the wizard creates several; each looks like this)
  Destination      Target
  10.0.0.0/16      local
  pl-63a5400a      vpce-0abc1234def567890   (S3 gateway endpoint)
```

The `local` route lets every subnet reach every other subnet in the VPC; you cannot remove it. The most specific route wins, so traffic to `10.0.x.x` stays local even when there is a `0.0.0.0/0` route. The `pl-` entry is the prefix list of S3 addresses in the Region (the ID differs per Region).

## Security Groups

A **security group** is a firewall attached to a network interface. Rules only **allow**; anything not allowed is dropped. Security groups are **stateful**: if a request is allowed in, the response is allowed out automatically, and the other way round.

The best feature: a rule's source can be **another security group** instead of an IP range. The rule then follows the resources, whatever their addresses:

| Security group  | Inbound rule       | Source                            |
| --------------- | ------------------ | --------------------------------- |
| `photo-app-alb` | HTTP 80, HTTPS 443 | `0.0.0.0/0` (and `::/0` for IPv6) |
| `photo-app-web` | HTTP 80            | `photo-app-alb`                   |
| `photo-app-db`  | PostgreSQL 5432    | `photo-app-web`                   |

Outbound, a new security group allows all traffic, which is usually fine. With these rules, the database can only be reached from the web servers, and the web servers only from the load balancer.

Create the three groups in the `photo-app` VPC (**VPC**, **Security groups**, **Create security group**) in the order of the table, because each rule refers to the group above it. Security group names only need to be unique within a VPC, so this `photo-app-web` is a new group, separate from the one you created in the default VPC in Part 3.

The same for the database group with the CLI (IDs are examples):

```bash
aws ec2 create-security-group \
  --group-name photo-app-db \
  --description "photo-app database" \
  --vpc-id vpc-0abc1234def567890

# Allow PostgreSQL only from members of the photo-app-web group
aws ec2 authorize-security-group-ingress \
  --group-id sg-0db0000000000000a \
  --protocol tcp --port 5432 \
  --source-group sg-0eb0000000000000b
```

## Move the Web Server into the New VPC

The Part 3 instance lives in the default VPC, which has no route to the new subnets. Launch its replacement inside `photo-app`:

1. In the EC2 console, select the Part 3 instance and choose **Actions**, **Images and templates**, **Launch more like this**. This copies the AMI, instance type, IAM role, tags and user data.
2. Under **Network settings**, choose the `photo-app` VPC, subnet `public-a`, **Auto-assign public IP: Enable**, and the new `photo-app-web` security group.
3. Launch it, check that it shows as connected in Session Manager, then terminate the Part 3 instance.

This instance, `photo-app-dev-web`, is your way into the VPC for now: Part 6 tunnels to the database through it. Its security group only accepts HTTP from the load balancer, so you will not open the page in a browser until Part 7, where an Auto Scaling group in the private subnets replaces it.

## Network ACLs

A **network ACL** filters traffic at the subnet boundary. It is **stateless** (return traffic needs its own rule, usually for the ephemeral ports 1024-65535), its rules are numbered and evaluated in order, and it can **deny**. The default network ACL allows everything. Leave it that way unless you need a subnet-wide deny, such as blocking an address range; security groups do the everyday work.

## NAT Gateways

Servers in private subnets often need to start connections out: to download packages, call a payment API or reach AWS services that have no endpoint in your VPC. A **NAT gateway** lets them do that while nobody on the internet can connect in.

- A **zonal** NAT gateway lives in one public subnet and AZ. For high availability you create one per AZ and point each private route table at the gateway in its own AZ.
- A **regional** NAT gateway (available since November 2025) spans the AZs where your workloads run, does not need a public subnet, and saves you the per-AZ setup.

Either way, NAT is one of the classic surprise charges. The [VPC pricing page](https://aws.amazon.com/vpc/pricing/) lists, for its US East (Ohio) example, USD 0.045 per NAT gateway hour plus USD 0.045 per GB processed (checked 23 October 2026), and a regional NAT gateway is billed per hour for each AZ it covers. That is more than USD 30 a month per gateway before any traffic.

Ways to need less NAT:

- **Gateway endpoints** for S3 and DynamoDB are free and keep that traffic off the NAT gateway.
- **Interface endpoints** reach most other AWS services privately; they cost per hour per AZ, so they pay off for heavy traffic or strict isolation.
- **IPv6** with an **egress-only internet gateway** gives outbound-only internet access for free.
- **Amazon Linux 2023 package repositories are hosted in S3**, so `dnf install` works from a private subnet through the free S3 gateway endpoint, with no NAT gateway. The web servers in Part 7 rely on this. Third-party repositories still need internet access.

:::note
Session Manager also needs a path out from a private instance: either a NAT gateway or interface endpoints for Systems Manager. Without one, the instance shows as unmanaged. See [Use VPC endpoints for Systems Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/setup-create-vpc.html).
:::

## IPv6

Because every public IPv4 address now costs money by the hour, IPv6 is worth knowing. A VPC can be **dual-stack**: add an Amazon-provided IPv6 block, give subnets IPv6 ranges, and route `::/0` to the internet gateway (public) or to an egress-only internet gateway (private). IPv6 addresses are free and globally unique, so there is no NAT. Load balancers support dual-stack too.

## See the Traffic: Flow Logs

**VPC Flow Logs** record accepted and rejected connections for a VPC, subnet or network interface, and deliver them to CloudWatch Logs or S3. In the default format, a record looks like this (example from the AWS documentation):

```text
2 123456789010 eni-1235b8ca123456789 172.31.16.139 172.31.16.21 20641 22 6 20 4249 1418530010 1418530070 ACCEPT OK
```

The fields are: version, account, interface, source and destination address, source and destination port, protocol (6 is TCP), packets, bytes, start and end time, action and log status. A `REJECT` on the port you expect points at a security group or network ACL. **Reachability Analyzer** goes further: it checks the configured path between two resources and tells you which rule blocks it, without sending any traffic.

## Connect Networks

- **VPC peering** connects two VPCs (also across accounts and Regions) privately. It is not transitive: A to B and B to C does not give A to C.
- **Transit Gateway** is a hub that connects many VPCs and on-premises networks.
- **Site-to-Site VPN** and **Direct Connect** connect your own data center or office.

All of them need non-overlapping CIDR ranges, which is why the planning step matters.

## Troubleshooting

**Cannot reach an instance from the internet:**

1. Is it in a subnet whose route table has `0.0.0.0/0` to an internet gateway?
2. Does it have a public IPv4 address (or IPv6)?
3. Does its security group allow the port from your address?
4. Does a custom network ACL block the port or the ephemeral return ports?
5. Is the service on the instance listening on that port (`ss -tlnp`)?

**A private instance cannot reach the internet:** check for a NAT gateway route in its subnet's route table, and that the NAT gateway (zonal) sits in a public subnet.

**Two resources in the VPC cannot talk:** check that the destination's security group allows the source's security group on the right port, and that DNS resolves (both DNS settings enabled on the VPC).

## Common Mistakes

- **Putting databases in public subnets** "to connect from my laptop". Use Session Manager port forwarding instead (Part 6).
- **One AZ only.** Load balancers and Multi-AZ databases need two.
- **Overlapping CIDR blocks** with networks you may connect later. Re-addressing a VPC means rebuilding it.
- **A NAT gateway left running** in a learning account. It costs money every hour even with no traffic.
- **Security group rules by IP address** between your own tiers. Reference security groups instead.

## Clean Up

The VPC, subnets, route tables, internet gateway and gateway endpoint are free; you can keep them for the next parts. Delete NAT gateways and interface endpoints as soon as you are done with them, and release any Elastic IPs they used.

## Summary

- A VPC is an IP range in one Region; subnets are slices of it in one AZ each.
- The route table makes a subnet public or private.
- Security groups are stateful, allow-only, and can reference each other; network ACLs are stateless and rarely needed.
- NAT gateways cost money per hour and per GB; gateway endpoints for S3 and DynamoDB are free.
- Flow logs and Reachability Analyzer show where traffic stops.

Next: [RDS: Managed Databases](/guides/introduction-to-aws/06-rds-databases), which goes into the private database subnets you just created.

## Keep Learning

- Try it in the browser: [AWS VPC simulator](/games/aws-vpc-simulator)
- Exercise: [AWS VPC with Terraform](/exercises/terraform-aws-vpc)
- [AWS VPC Networking Fundamentals interview questions](/interview-questions/junior/aws-vpc-networking)
