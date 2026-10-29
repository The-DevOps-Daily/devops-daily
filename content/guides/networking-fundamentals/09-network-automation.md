---
title: 'Network Automation: Firewalls, Terraform and Ansible in CI'
description: 'Network as code: firewall changes that roll back on their own, Ansible with validated nftables, a Terraform VPC with a real plan, and a reviewed pipeline.'
order: 9
---

Every change you made to the lab so far was a command typed by hand. That is fine for learning and for emergencies, and it is how most network outages start: a rule typed on one server and not the others, a route changed in a console with nobody reviewing it, a firewall reload that locks everyone out. Network automation applies the habits of application code to the network: changes live in files, files live in Git, a review and a pipeline check them, and a tool applies them the same way everywhere.

In this part you build up that workflow in four steps: a firewall change that undoes itself when it breaks the site, an Ansible playbook that pushes validated nftables rules to servers, a Terraform configuration for the VPC from Part 7 with a real plan, and a pipeline that runs the checks on every pull request.

## Prerequisites

- A fresh lab from [Part 1](/guides/networking-fundamentals/01-network-fundamentals-and-protocols#h2-build-the-practice-lab): run `sudo ./netlab.sh down && sudo ./netlab.sh up` before you start, because every part changes the lab.
- The firewall rules from [Part 4](/guides/networking-fundamentals/04-network-security-and-firewalls-basics).
- The VPC design from [Part 7](/guides/networking-fundamentals/07-cloud-networking).
- Basic Terraform and Ansible help: the [Introduction to Terraform](/guides/introduction-to-terraform) and [Introduction to Ansible](/guides/introduction-to-ansible) guides start from zero. The Terraform and Ansible output below comes from the guide's companion repository, run on GitHub Actions (Terraform 1.16, AWS provider 6.70, ansible-core 2.21).

## Firewall Changes That Undo Themselves

The riskiest network change is the one that cuts off the path you need to fix it. Network vendors solved this long ago with "commit confirmed": apply a change, and roll it back automatically unless it is confirmed. A short script does the same for nftables. It saves the current rules, checks and loads the new file, runs a health check with a time limit, and restores the saved rules if the check fails. A separate process restores them after two minutes anyway unless the change was confirmed, which covers the case where you lose the SSH session or the script dies halfway; both take the same lock before they decide, so a change ends up either confirmed or rolled back, never both. Save it as `nft-apply.sh` and make it executable (`chmod +x nft-apply.sh`):

```bash
#!/usr/bin/env bash
# nft-apply.sh RULESET CHECK...: load RULESET, then run CHECK (killed after 32 s at most); restore the
# previous rules if CHECK fails, and also after 120 s if this script dies before it can confirm the change
set -u
if [ "$#" -lt 2 ]; then
  echo "usage: $0 RULESET CHECK-COMMAND..." >&2
  exit 2
fi
ruleset=$1
shift

# one change at a time
exec 9>/run/lock/nft-apply.lock || exit 1
flock -n 9 || { echo "another nft-apply is running" >&2; exit 1; }

# the transaction: the saved rules, plus a lock under which "confirm" and "roll back" are decided
tx=$(mktemp -d /root/nft-apply.XXXXXX) || exit 1
# "flush ruleset" first, so that restoring the backup replaces everything in one transaction
{ echo 'flush ruleset'; nft list ruleset; } >"$tx/backup" || { rm -rf "$tx"; exit 1; }
if ! nft -c -f "$ruleset"; then
  echo "rejected: $ruleset does not load; nothing changed"
  rm -rf "$tx"
  exit 1
fi

# the safety net: a separate process that rolls back after 120 s unless the change was confirmed
setsid bash -c 'sleep 120; exec 8>"$1/decide" || exit 0; flock 8
  [ -e "$1/confirmed" ] || { nft -f "$1/backup" && touch "$1/rolled-back"; }' rollback "$tx" \
  </dev/null >/dev/null 2>&1 &
guard=$!

# decide confirmed|rolled-back: settle the outcome once, under the lock the safety net also takes
decide() {
  exec 8>"$tx/decide"
  flock 8
  if [ -e "$tx/rolled-back" ]; then
    echo "the safety net already restored the previous ruleset"
    rm -rf "$tx"
    exit 1
  fi
  if [ "$1" = rolled-back ]; then
    nft -f "$tx/backup" || { echo "RESTORE FAILED: fix the firewall by hand from $tx/backup" >&2; exit 3; }
  fi
  touch "$tx/$1"
  kill -- -"$guard" 2>/dev/null
  rm -rf "$tx"
}

# load the new rules under the same lock, unless the safety net has already rolled back
exec 8>"$tx/decide"
flock 8
if [ -e "$tx/rolled-back" ]; then
  echo "the safety net already restored the previous ruleset; nothing applied"
  rm -rf "$tx"
  exit 1
fi
if ! nft -f "$ruleset"; then
  flock -u 8
  decide rolled-back
  exit 1
fi
flock -u 8

if timeout --kill-after=2s 30s "$@"; then
  decide confirmed
  echo "applied: $ruleset (check passed)"
else
  echo "check failed: restoring the previous ruleset"
  decide rolled-back
  exit 1
fi
```

Here is the router's zone firewall from Part 4, with one mistake: the rule that lets the load balancer reach the app servers on port 8080 is missing. Save it as `router-filter-bad.nft`:

```text
#!/usr/sbin/nft -f
# router: zone rules, but the edge -> app rule is missing
table inet filter
delete table inet filter

table inet filter {
    chain forward {
        type filter hook forward priority filter; policy drop;
        ct state established,related accept
        ct state invalid drop
        iifname "br-wan" ct status dnat accept
        iifname "br-app" oifname "br-data" tcp dport 5432 accept
        ip saddr 10.0.0.0/16 oifname "br-wan" accept
    }
}
```

The health check is the thing users care about: can `client` load the shop? Apply the broken file, then the fixed one (`router-filter.nft`, the same file plus the missing line `iifname "br-edge" oifname "br-app" tcp dport 8080 accept`):

```terminal
{
  "title": "a broken change rolls itself back",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "$",
      "cmd": "sudo ip netns exec router ./nft-apply.sh router-filter-bad.nft ip netns exec client curl -sf -m 3 -o /dev/null http://www.shop.example/health",
      "output": "check failed: restoring the previous ruleset"
    },
    {
      "comment": "the router is back to NAT only",
      "prompt": "router#",
      "cmd": "nft list tables",
      "output": "table ip nat"
    },
    {
      "prompt": "$",
      "cmd": "sudo ip netns exec router ./nft-apply.sh router-filter.nft ip netns exec client curl -sf -m 3 -o /dev/null http://www.shop.example/health",
      "output": "applied: router-filter.nft (check passed)"
    },
    {
      "prompt": "router#",
      "cmd": "nft list tables",
      "output": "table ip nat\ntable inet filter"
    }
  ]
}
```

The bad file loaded fine (it is valid syntax, so `nft -c` could not catch it), the site stopped answering, and the script restored the previous rules after the 3-second check failed. Syntax checks catch typos; only a check of real behaviour catches a missing rule. The same idea works for any network change: apply, test what matters, roll back automatically. The two-minute safety net is a process in its own session, so it survives a closed terminal; for a change that may cut your own SSH connection, a `systemd-run --on-active=120` timer (Part 4) survives even more.

## Configuration Management with Ansible

A script fixes one machine. Ansible applies the same desired state to a whole group of servers over SSH, changes only what differs, and reports what it changed. This playbook installs nftables on the database servers, renders the ruleset from a template, checks it with `nft -c` before it replaces the file, and loads it only when it changed:

```yaml
- name: Database firewall
  hosts: db
  become: true
  tasks:
    - name: Install nftables
      ansible.builtin.package:
        name: nftables
        state: present

    - name: Write the ruleset
      ansible.builtin.template:
        src: nftables.conf.j2
        dest: /etc/nftables.conf
        owner: root
        group: root
        mode: '0644'
        validate: nft -c -f %s
      notify: Load the ruleset

    - name: Load the ruleset at boot
      ansible.builtin.systemd_service:
        name: nftables
        enabled: true
      when: ansible_facts['service_mgr'] == 'systemd'

  handlers:
    - name: Load the ruleset
      ansible.builtin.command: nft -f /etc/nftables.conf
      changed_when: true
```

The template is the `db` ruleset from Part 4 with the addresses taken from variables, so that one file serves every environment:

```text
#!/usr/sbin/nft -f
# Managed by Ansible: local changes are overwritten
flush ruleset

table inet filter {
    chain input {
        type filter hook input priority filter; policy drop;

        iif "lo" accept
        ct state established,related accept
        ct state invalid drop
        meta l4proto { icmp, ipv6-icmp } accept

        tcp dport 22 ip saddr {{ admin_cidr }} accept
{% for cidr in db_clients %}
        ip saddr {{ cidr }} tcp dport 5432 accept
{% endfor %}

        counter comment "everything else"
    }
}
```

```yaml
# the app subnets of the VPC from Part 7, and the admin network
db_clients:
  - 10.20.0.0/19
  - 10.20.32.0/19
admin_cidr: 10.20.108.0/22
```

`validate: nft -c -f %s` is the important line: Ansible writes the rendered file to a temporary path, runs the check against it, and only moves it into place if the check passes. A template typo never reaches `/etc/nftables.conf`. Run it in check mode first to see the diff, then for real, then once more to prove nothing changes on a second run:

```terminal
{
  "title": "check, apply, and apply again (companion repo)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ansible-lint firewall.yml",
      "output": "Passed: 0 failure(s), 0 warning(s) in 1 files processed of 1 encountered. Last profile that met the validation criteria was 'production'."
    },
    {
      "cmd": "ansible-playbook -i inventory.ini firewall.yml --check --diff",
      "output": "PLAY [Database firewall] *******************************************************\n\nTASK [Gathering Facts] *********************************************************\nok: [db1]\n\nTASK [Install nftables] ********************************************************\nSolving dependencies...\nThe following additional packages will be installed:\n  libedit2 libjansson4 libmnl0 libnftables1 libnftnl11 libxtables12\nSuggested packages:\n  firewalld\nThe following NEW packages will be installed:\n  libedit2 libjansson4 libmnl0 libnftables1 libnftnl11 libxtables12 nftables\n0 upgraded, 7 newly installed, 0 to remove and 0 not upgraded.\nchanged: [db1]\n\nTASK [Write the ruleset] *******************************************************\n--- before\n+++ after: /home/runner/.ansible/tmp/ansible-local-5162jfc2sq02/tmp3kqcwv3c/nftables.conf.j2\n@@ -0,0 +1,20 @@\n+#!/usr/sbin/nft -f\n+# Managed by Ansible: local changes are overwritten\n+flush ruleset\n+\n+table inet filter {\n+    chain input {\n+        type filter hook input priority filter; policy drop;\n+\n+        iif \"lo\" accept\n+        ct state established,related accept\n+        ct state invalid drop\n+        meta l4proto { icmp, ipv6-icmp } accept\n+\n+        tcp dport 22 ip saddr 10.20.108.0/22 accept\n+        ip saddr 10.20.0.0/19 tcp dport 5432 accept\n+        ip saddr 10.20.32.0/19 tcp dport 5432 accept\n+\n+        counter comment \"everything else\"\n+    }\n+}\n\nchanged: [db1]\n\nTASK [Load the ruleset at boot] ************************************************\nskipping: [db1]\n\nRUNNING HANDLER [Load the ruleset] *********************************************\nskipping: [db1]\n\nPLAY RECAP *********************************************************************\ndb1                        : ok=3    changed=2    unreachable=0    failed=0    skipped=2    rescued=0    ignored=0"
    },
    {
      "cmd": "ansible-playbook -i inventory.ini firewall.yml",
      "output": "PLAY [Database firewall] *******************************************************\n\nTASK [Gathering Facts] *********************************************************\nok: [db1]\n\nTASK [Install nftables] ********************************************************\nchanged: [db1]\n\nTASK [Write the ruleset] *******************************************************\nchanged: [db1]\n\nTASK [Load the ruleset at boot] ************************************************\nskipping: [db1]\n\nRUNNING HANDLER [Load the ruleset] *********************************************\nchanged: [db1]\n\nPLAY RECAP *********************************************************************\ndb1                        : ok=4    changed=3    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0"
    },
    {
      "cmd": "ansible-playbook -i inventory.ini firewall.yml",
      "output": "PLAY [Database firewall] *******************************************************\n\nTASK [Gathering Facts] *********************************************************\nok: [db1]\n\nTASK [Install nftables] ********************************************************\nok: [db1]\n\nTASK [Write the ruleset] *******************************************************\nok: [db1]\n\nTASK [Load the ruleset at boot] ************************************************\nskipping: [db1]\n\nPLAY RECAP *********************************************************************\ndb1                        : ok=3    changed=0    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0"
    },
    {
      "cmd": "ansible -i inventory.ini db -b -m ansible.builtin.command -a 'nft list chain inet filter input'",
      "output": "db1 | CHANGED | rc=0 >>\ntable inet filter {\n\tchain input {\n\t\ttype filter hook input priority filter; policy drop;\n\t\tiif \"lo\" accept\n\t\tct state established,related accept\n\t\tct state invalid drop\n\t\tmeta l4proto { icmp, ipv6-icmp } accept\n\t\ttcp dport 22 ip saddr 10.20.108.0/22 accept\n\t\tip saddr 10.20.0.0/19 tcp dport 5432 accept\n\t\tip saddr 10.20.32.0/19 tcp dport 5432 accept\n\t\tcounter packets 0 bytes 0 comment \"everything else\"\n\t}\n}"
    }
  ]
}
```

The target in the companion repository is a container (`db1`) instead of an SSH server: its `inventory.ini` connects through the Docker API as root (so it turns `become` off), and the container has no systemd, which is why the boot task is skipped there. Against real servers, the inventory lists their SSH names instead. The second run reports `changed=0`: the state already matches, so nothing is touched and the handler does not reload the firewall. That property, **idempotence**, is what makes it safe to run the same playbook every hour: it puts back a changed or deleted `/etc/nftables.conf`. It does not notice a rule someone added with `nft add rule`, because that change lives only in the kernel and the file still matches; to catch that kind of drift, reload the ruleset on every run or compare `nft list ruleset` with the file in a check.

## Infrastructure as Code with Terraform

Cloud networks are API objects, and Terraform manages them from a declarative description: you write the VPC you want, Terraform compares it with what exists and shows a **plan** of the changes. This is the Part 7 VPC: subnets for every zone and tier from one map, a regional NAT gateway, a route table per tier (the data tier gets none to the internet), a free S3 gateway endpoint, and security groups that reference each other:

```hcl
terraform {
  required_version = ">= 1.10"

  # shared state with a lock file in S3 (Terraform 1.10+), so every runner sees the same state
  backend "s3" {
    bucket       = "example-shop-terraform-state"
    key          = "network/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.70"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "zones" {
  description = "Subnet ranges per availability zone, from the plan in Part 2"
  type = map(object({
    public = string
    app    = string
    data   = string
  }))
  default = {
    "us-east-1a" = { public = "10.20.108.0/24", app = "10.20.0.0/19", data = "10.20.96.0/22" }
    "us-east-1b" = { public = "10.20.109.0/24", app = "10.20.32.0/19", data = "10.20.100.0/22" }
  }
}

locals {
  # { "public-a" = { zone = "us-east-1a", tier = "public", cidr = "10.20.108.0/24" }, ... }
  subnets = merge([
    for zone, ranges in var.zones : {
      for tier, cidr in ranges : "${tier}-${substr(zone, -1, 1)}" => { zone = zone, tier = tier, cidr = cidr }
    }
  ]...)
}

resource "aws_vpc" "shop" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "shop" }
}

resource "aws_subnet" "this" {
  for_each          = local.subnets
  vpc_id            = aws_vpc.shop.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.zone
  tags              = { Name = each.key, Tier = each.value.tier }
}

resource "aws_internet_gateway" "shop" {
  vpc_id = aws_vpc.shop.id
}

resource "aws_nat_gateway" "shop" {
  vpc_id            = aws_vpc.shop.id
  availability_mode = "regional"
  depends_on        = [aws_internet_gateway.shop]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.shop.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.shop.id
  }
}

resource "aws_route_table" "app" {
  vpc_id = aws_vpc.shop.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.shop.id
  }
}

# no default route: the data tier never talks to the internet
resource "aws_route_table" "data" {
  vpc_id = aws_vpc.shop.id
}

locals {
  route_tables = {
    public = aws_route_table.public.id
    app    = aws_route_table.app.id
    data   = aws_route_table.data.id
  }
}

resource "aws_route_table_association" "this" {
  for_each       = local.subnets
  subnet_id      = aws_subnet.this[each.key].id
  route_table_id = local.route_tables[each.value.tier]
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.shop.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.app.id, aws_route_table.data.id]
}

resource "aws_security_group" "tier" {
  for_each    = toset(["lb", "app", "db"])
  name        = "shop-${each.key}"
  description = "shop ${each.key} tier"
  vpc_id      = aws_vpc.shop.id
}

resource "aws_vpc_security_group_ingress_rule" "lb_https" {
  security_group_id = aws_security_group.tier["lb"].id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_ingress_rule" "app_from_lb" {
  security_group_id            = aws_security_group.tier["app"].id
  referenced_security_group_id = aws_security_group.tier["lb"].id
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
}

resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  security_group_id            = aws_security_group.tier["db"].id
  referenced_security_group_id = aws_security_group.tier["app"].id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

# Terraform removes the default "allow all outbound" rule, so outbound is explicit too
resource "aws_vpc_security_group_egress_rule" "lb_to_app" {
  security_group_id            = aws_security_group.tier["lb"].id
  referenced_security_group_id = aws_security_group.tier["app"].id
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
}

resource "aws_vpc_security_group_egress_rule" "app_out" {
  security_group_id = aws_security_group.tier["app"].id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

output "subnet_ids" {
  value = { for name, subnet in aws_subnet.this : name => subnet.id }
}
```

Adding a third zone is one more line in `zones`; the subnets, route table associations and plan follow from it. The `backend` block keeps the state in an S3 bucket (create it once, with versioning on) and uses a lock file there, so that two runs cannot change the network at the same time and every CI runner works from the same state; without it, each fresh runner would start from nothing and create a second VPC. Check and plan:

```terminal
{
  "title": "fmt, validate and plan (companion repo)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "terraform init -input=false",
      "output": "Terraform has been successfully initialized!"
    },
    {
      "cmd": "terraform fmt -check && terraform validate",
      "output": "Success! The configuration is valid."
    },
    {
      "cmd": "terraform plan -input=false -out=tfplan | grep -E '^  # |^Plan:'",
      "output": "  # aws_internet_gateway.shop will be created\n  # aws_nat_gateway.shop will be created\n  # aws_route_table.app will be created\n  # aws_route_table.data will be created\n  # aws_route_table.public will be created\n  # aws_route_table_association.this[\"app-a\"] will be created\n  # aws_route_table_association.this[\"app-b\"] will be created\n  # aws_route_table_association.this[\"data-a\"] will be created\n  # aws_route_table_association.this[\"data-b\"] will be created\n  # aws_route_table_association.this[\"public-a\"] will be created\n  # aws_route_table_association.this[\"public-b\"] will be created\n  # aws_security_group.tier[\"app\"] will be created\n  # aws_security_group.tier[\"db\"] will be created\n  # aws_security_group.tier[\"lb\"] will be created\n  # aws_subnet.this[\"app-a\"] will be created\n  # aws_subnet.this[\"app-b\"] will be created\n  # aws_subnet.this[\"data-a\"] will be created\n  # aws_subnet.this[\"data-b\"] will be created\n  # aws_subnet.this[\"public-a\"] will be created\n  # aws_subnet.this[\"public-b\"] will be created\n  # aws_vpc.shop will be created\n  # aws_vpc_endpoint.s3 will be created\n  # aws_vpc_security_group_egress_rule.app_out will be created\n  # aws_vpc_security_group_egress_rule.lb_to_app will be created\n  # aws_vpc_security_group_ingress_rule.app_from_lb will be created\n  # aws_vpc_security_group_ingress_rule.db_from_app will be created\n  # aws_vpc_security_group_ingress_rule.lb_https will be created\nPlan: 27 to add, 0 to change, 0 to destroy."
    }
  ]
}
```

The plan ran in CI with mock credentials, Terraform's `skip_*` provider settings and a local backend, all in an `_override.tf` file, which is enough to plan new resources without an AWS account; nothing was created. Read a plan before every apply, especially the lines that say `must be replaced` or `will be destroyed`: changing a subnet's range or a VPC's CIDR replaces it, together with everything inside.

Two rules keep Terraform-managed networks healthy:

- **One owner per resource.** If a security group is in Terraform, change it only through Terraform. Console edits become **drift** that the next apply silently reverts, or that blocks it.
- **Detect drift on a schedule.** `terraform plan -detailed-exitcode` exits with 2 when reality differs from the code; a nightly job that alerts on exit code 2 catches manual changes and resources deleted behind your back.

## A Pipeline for Network Changes

Put the pieces together in CI. Every pull request that touches the network gets the syntax checks, a Terraform plan for the reviewer to read, and the nftables files checked by the kernel's own parser; merging to `main` applies the change after an approval, and then a smoke test confirms the result. Credentials come from OIDC (a short-lived role per run), not stored keys:

```yaml
name: network

on:
  pull_request:
    paths: ['network/**']
  push:
    branches: [main]
    paths: ['network/**']

permissions:
  contents: read
  id-token: write

jobs:
  plan:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-24.04
    concurrency:
      group: network-plan-${{ github.ref }}
      cancel-in-progress: true
    defaults:
      run:
        working-directory: network/terraform
    steps:
      - uses: actions/checkout@v7
      - uses: hashicorp/setup-terraform@v4
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: ${{ vars.NETWORK_PLAN_ROLE_ARN }}
          aws-region: us-east-1
      - name: Check the firewall rulesets
        run: |
          sudo apt-get install -y -q nftables
          for f in ../nftables/*.nft; do sudo nft -c -f "$f"; done
      - run: terraform fmt -check
      - run: terraform init -input=false
      - run: terraform validate
      - run: terraform plan -input=false -no-color

  apply:
    if: github.event_name == 'push'
    runs-on: ubuntu-24.04
    environment: network-production
    concurrency:
      group: network-apply
      cancel-in-progress: false
    defaults:
      run:
        working-directory: network/terraform
    steps:
      - uses: actions/checkout@v7
      - uses: hashicorp/setup-terraform@v4
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: ${{ vars.NETWORK_APPLY_ROLE_ARN }}
          aws-region: us-east-1
      - run: terraform init -input=false
      - run: terraform apply -input=false -auto-approve
      - name: Smoke test
        run: ../scripts/netcheck.sh shop.example:443
```

- `environment: network-production` makes the apply job wait for a reviewer configured on that environment. The plan job's role should be read-only for the network, with read access to the state bucket and permission to write and delete only the lock file (`network/terraform.tfstate.tflock`), because `plan` takes the lock too; the apply job's role may change the network and write the state.
- Each job has its own `concurrency` group. A new push to a pull request cancels that pull request's older plan. Applies never cancel each other halfway (`cancel-in-progress: false`); GitHub keeps one pending run per group, so a newer apply replaces an older one that is still waiting, which is fine because the newer commit contains the older change. The Terraform lock file is the second guard.
- The smoke test is Part 8's `netcheck.sh`, run against the real endpoint after the change; extend it with the paths your services depend on.
- This workflow deploys the Terraform part only. It checks the nftables files on every pull request, but rolling them out to servers is the Ansible playbook's job: run it from its own job after the apply, one server at a time (`serial: 1`) with a health check after each, the same idea as `nft-apply.sh`.
- The `uses:` lines are written with major-version tags to keep the example readable. In a real repository, pin each action to a full commit SHA, as the guide's companion repository does.

`actionlint` checks a workflow before you push it, including the expressions and the shell scripts in `run:` steps:

```terminal
{
  "title": "lint the workflow (companion repo)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "actionlint network.yml && echo \"network.yml: no problems found\"",
      "output": "network.yml: no problems found"
    }
  ]
}
```

## Common Mistakes

- **Validating syntax and calling it tested.** `nft -c`, `terraform validate` and `ansible-lint` catch typos, not a missing rule. Add a behaviour check (the health check in `nft-apply.sh`, the smoke test in the pipeline).
- **Mixing manual changes and automation** on the same resources. Pick one owner; treat manual changes as incidents to fold back into code.
- **Applying without reading the plan.** A changed CIDR or subnet replaces resources, and everything in them goes with it.
- **Rolling back with old state files.** Never push an old Terraform state over the current one; revert the commit and apply, so that Terraform computes the way back.
- **Long-lived cloud keys in CI.** Use OIDC roles with separate read-only (plan) and write (apply) permissions.

## Summary

- Keep network changes in files and Git, and let a pipeline check and apply them.
- Make risky changes self-healing: apply, check what users need, roll back automatically on failure.
- Ansible's `validate:` option checks a rendered config before it replaces the live file, and idempotent runs (`changed=0`) make it safe to re-apply often.
- Terraform plans show exactly what will change; detect drift on a schedule and keep one owner per resource.
- A network pipeline lints, plans for review, applies after approval, and smoke-tests the result.

Next, [Part 10](/guides/networking-fundamentals/10-network-concepts) looks at what comes after the fundamentals: VPN tunnels, service meshes, zero trust, eBPF and the Gateway API.

## Keep Learning

- Exercise: [build an AWS VPC with Terraform](/exercises/terraform-aws-vpc)
- [Terraform puzzle](/games/terraform-puzzle) and [GitOps workflow simulator](/games/gitops-workflow)
- The [CI/CD with GitHub Actions](/guides/introduction-to-cicd) guide for pipelines, environments and OIDC
