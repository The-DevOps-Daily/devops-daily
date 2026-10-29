---
title: 'Defense in Depth: Layered Security You Can Test'
description: 'Defense in depth, tested: one SQL injection followed through the WAF, code, database roles, NetworkPolicies, SSH and AIDE on hosts, encryption and alerts.'
order: 2
---

**TLDR**: Defense in depth means that no single control stands between an attacker and your data. You stack independent layers (network, host, application, data, and detection) so that when one fails, and one always does, the next still holds. The layers must fail independently: two controls that share a credential, a configuration file or an assumption are one control. In this part you follow one SQL injection through the ticket shop and test each layer for real: a NetworkPolicy that blocks an unknown pod, an SSH setting that silently loses to a cloud-init file, AIDE catching a changed file, a database role that stops `DROP TABLE` after the injection works, and a container that cannot write to its own file system.

The idea is older than computers: a castle has a moat, walls, gates and guards, and an attacker has to beat all of them. In security engineering it is often drawn as the "Swiss cheese model": every layer has holes, but the holes rarely line up. Your job is to make sure they do not line up by design.

## Prerequisites

- [Part 1](/guides/security-principles/01-cia-triad), which sets up the ticket shop on a kind cluster. The Kubernetes steps here continue on that cluster.
- A Linux machine where you can use `sudo` (a throwaway VM is ideal): Ubuntu 26.04 LTS with OpenSSH 10.2, AIDE 0.19, PostgreSQL 18 and Docker 29 produced the outputs.
- For the AWS and Terraform snippets: nothing to run. The companion repository's workflow checks every `aws` command for syntax without credentials and runs `terraform validate` on the Terraform files.

## The Layers

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Edge", "sub": "CDN, WAF, rate limits", "icon": "globe", "tone": "slate" },
    { "label": "Network", "sub": "security groups, NetworkPolicy", "icon": "net", "tone": "blue" },
    { "label": "Host", "sub": "patching, SSH, file integrity", "icon": "server", "tone": "violet" },
    { "label": "Application", "sub": "safe queries, hardened container", "icon": "box", "tone": "green" },
    { "label": "Data", "sub": "roles, encryption, backups", "icon": "database", "tone": "amber" },
    { "label": "Detect", "sub": "logs, alerts, response", "icon": "activity", "tone": "red" }
  ]
}
```

| Layer                  | Protects against                                          | Typical controls                                                                      |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Physical**           | Theft, tampering with hardware                            | Data center access control (your cloud provider's job in the cloud)                   |
| **Edge**               | Floods, known attack patterns, abusive clients            | CDN and DDoS protection, WAF, rate limits                                             |
| **Network**            | Reaching services that should not be reachable            | Private subnets, security groups, Kubernetes NetworkPolicies                          |
| **Host**               | Exploits of the OS, stolen credentials, persistence       | Patching, minimal packages, SSH hardening, file integrity monitoring                  |
| **Application**        | Injection, broken access control, vulnerable dependencies | Parameterized queries, authorization checks, dependency scanning, non-root containers |
| **Data**               | Reading or changing data after everything else failed     | Least-privilege database roles, encryption at rest and in transit, immutable backups  |
| **Detect and respond** | Attacks that got through unnoticed                        | Central logs, audit trails, alerts that someone reads, practiced runbooks             |

Two rules make the layers worth having:

- **Independent failure.** If the WAF, the application and the database all accept the same stolen admin password, you have one layer, not three. Use different credentials, owners and mechanisms per layer.
- **Every layer must be tested.** A security group nobody has tried to cross is a belief. The rest of this part tests each layer and shows the output.

### Physical Security and the Shared Responsibility Model

In the cloud, the provider secures the buildings, hardware and hypervisors; you secure everything you configure on top: identities, networks, operating systems, applications and data. The split moves with the service type. On a virtual machine you patch the OS; on a managed database the provider does, but you still own the users, grants, network exposure and backups. If you run your own hardware, physical security is yours: locked rooms with access logs, asset tracking, and wiped or destroyed disks at end of life.

## Follow One Attack Through the Layers

Take one realistic attack on the ticket shop: the order search in the API builds SQL from user input, and an attacker finds it.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "attacker", "label": "Attacker", "sub": "crafted search", "icon": "globe", "tone": "red", "detail": "Sends ' OR '1'='1 and later '; DROP TABLE orders; -- in the email search field." }
    ],
    [
      { "id": "waf", "label": "WAF", "sub": "may block", "icon": "shield", "tone": "slate", "detail": "Managed SQL injection rules catch common payloads, but not every encoding, and only the first 8 to 64 KB of a body." }
    ],
    [
      { "id": "app", "label": "API code", "sub": "the hole", "icon": "box", "tone": "amber", "detail": "The vulnerable function concatenates input into SQL. Parameterized queries close the hole completely." }
    ],
    [
      { "id": "role", "label": "DB role", "sub": "limits damage", "icon": "lock", "tone": "green", "detail": "shop_api owns no tables, so DROP, ALTER and TRUNCATE fail even when the injection works." },
      { "id": "net", "label": "Network", "sub": "limits reach", "icon": "net", "tone": "blue", "detail": "Only the API and the worker can reach Postgres; the database cannot open connections to the Internet." }
    ],
    [
      { "id": "detect", "label": "Detection", "sub": "notices", "icon": "activity", "tone": "violet", "detail": "Database errors such as 'must be owner of table' and WAF matches go to an alert, not only to a log file." }
    ]
  ],
  "edges": [
    ["attacker", "waf"],
    ["waf", "app", "passes"],
    ["app", "role", "SQL"],
    ["app", "net"],
    ["role", "detect", "errors"],
    ["net", "detect", "denials"]
  ]
}
```

Each layer can fail on its own, and each one changes how bad the outcome is:

| If this layer fails ... | ... and the next one holds         | Outcome                                                                                   |
| ----------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| WAF misses the payload  | Parameterized query                | Nothing happens; the input is just an odd email address                                   |
| The code is injectable  | Database role without ownership    | The attacker can read what `shop_api` can read, but cannot drop tables or rewrite tickets |
| The role is too broad   | Network policy and egress rules    | Data can be changed, but the database cannot send it anywhere directly                    |
| Everything above fails  | Alerts on the errors along the way | You find out in minutes instead of from a customer                                        |

The sections below build and test these layers from the outside in.

## Network Layer

### Security Groups That Reference Each Other

In AWS, security groups are stateful firewalls attached to network interfaces. They only allow; anything not allowed is denied. New groups start with no inbound rules and an allow-all outbound rule. The strongest pattern is to reference **groups instead of address ranges**: the database accepts connections from "anything in the API's group", which stays correct when instances and IP addresses change.

```hcl
# Three tiers: the load balancer is public, the API and the database are not.
resource "aws_security_group" "alb" {
  name        = "shop-alb"
  description = "Public HTTPS entry point"
  vpc_id      = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from the Internet"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_api" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward to the API tasks only"
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.api.id
}

resource "aws_security_group" "api" {
  name        = "shop-api"
  description = "API tasks, reachable only from the load balancer"
  vpc_id      = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "api_from_alb" {
  security_group_id            = aws_security_group.api.id
  description                  = "App port from the load balancer only"
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_egress_rule" "api_to_db" {
  security_group_id            = aws_security_group.api.id
  description                  = "Postgres"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.db.id
}

resource "aws_vpc_security_group_egress_rule" "api_https_out" {
  security_group_id = aws_security_group.api.id
  description       = "HTTPS to the payment provider, through the NAT gateway"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_security_group" "db" {
  name        = "shop-db"
  description = "Postgres, reachable only from the API"
  vpc_id      = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "db_from_api" {
  security_group_id            = aws_security_group.db.id
  description                  = "Postgres from the API only"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.api.id
}
```

The standalone `aws_vpc_security_group_ingress_rule` and `aws_vpc_security_group_egress_rule` resources are the current AWS provider style: one resource per rule, so changing one rule never replaces the others. Outbound traffic is restricted too. AWS gives every new group an allow-all outbound rule, but Terraform removes it from groups it creates, so each outbound path above is declared: the load balancer may only forward to the API, and the API may only reach Postgres and HTTPS endpoints. The database group has no outbound rule at all. Security groups are stateful, so replies to allowed connections still flow, but a compromised database cannot open connections to other hosts. DNS through the VPC's own resolver is the exception (security groups cannot block it), and DNS queries can carry data out, which is what DNS query logging and Route 53 Resolver DNS Firewall are for.

The same rule with the AWS CLI. Outside the default VPC, both commands need IDs (`--vpc-id`, `--group-id`); the older `--group-name` form only works in the default VPC:

```bash
aws ec2 create-security-group --group-name shop-db \
  --description "Postgres, reachable only from the API" --vpc-id vpc-0abc1234def567890

aws ec2 authorize-security-group-ingress --group-id sg-0db1234567890abcd \
  --ip-permissions 'IpProtocol=tcp,FromPort=5432,ToPort=5432,UserIdGroupPairs=[{GroupId=sg-0a1b2c3d4e5f67890,Description=api}]'
```

Never open SSH (22) or database ports to `0.0.0.0/0`. If people need shell access, use a session manager instead of a public SSH port: AWS Systems Manager Session Manager needs no inbound port at all, and Google Cloud IAP or Teleport open SSH only to their own proxy. The [Networking Fundamentals guide](/guides/networking-fundamentals/07-cloud-networking) builds a full VPC with these rules.

### Kubernetes NetworkPolicies

Inside a Kubernetes cluster every pod can reach every other pod by default. A NetworkPolicy changes that for the pods it selects, and once any policy selects a pod for a direction (ingress or egress), only traffic that some policy allows gets through. kind enforces NetworkPolicies with its built-in network plugin; on other clusters, check that your network plugin does, or the objects have no effect.

Start with a default deny for both directions in the `shop` namespace, then allow exactly the paths the ticket shop needs: DNS for everyone, the API from anywhere on its port, and Postgres from the API and the worker only.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: shop
spec:
  podSelector: {}
  policyTypes: ['Ingress', 'Egress']
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: shop
spec:
  podSelector: {}
  policyTypes: ['Egress']
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes: ['Ingress', 'Egress']
  ingress:
    - ports:
        - protocol: TCP
          port: 8080
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: worker
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: worker
  policyTypes: ['Egress']
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes: ['Ingress']
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api
        - podSelector:
            matchLabels:
              app: worker
      ports:
        - protocol: TCP
          port: 5432
```

Two details that copied examples often get wrong: the namespace label `kubernetes.io/metadata.name` is set automatically on every namespace (a label such as `name: kube-system` usually does not exist), and DNS needs TCP as well as UDP. Postgres has no egress rule other than DNS, so a compromised database pod cannot connect to anything except the cluster's DNS server.

```terminal
{
  "title": "deny by default, then test",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd ~/security-principles-demo/part02"
    },
    {
      "cmd": "kubectl apply -f netpol.yaml",
      "output": "networkpolicy.networking.k8s.io/default-deny created\nnetworkpolicy.networking.k8s.io/allow-dns created\nnetworkpolicy.networking.k8s.io/api created\nnetworkpolicy.networking.k8s.io/worker created\nnetworkpolicy.networking.k8s.io/postgres created"
    },
    {
      "cmd": "kubectl -n shop exec deploy/worker -- pg_isready -h postgres",
      "output": "postgres:5432 - accepting connections"
    },
    {
      "cmd": "kubectl -n shop run intruder --image=postgres:18.6-alpine3.24@sha256:10a5c69a83035ab5239f5620d708520e8b28f5aa1f2b20143e6024532edadfb5 --restart=Never --rm -i --quiet -- pg_isready -h postgres -t 3",
      "output": "postgres:5432 - no response\npod shop/intruder terminated (Error)"
    },
    {
      "cmd": "kubectl -n shop get pods -l app=api",
      "output": "NAME                   READY   STATUS    RESTARTS   AGE\napi-864c4bd569-9mxjb   1/1     Running   0          36s\napi-864c4bd569-j8nhd   1/1     Running   0          36s\napi-864c4bd569-xmvzs   1/1     Running   0          36s"
    }
  ]
}
```

The worker reaches the database; a new pod without the right label gets no answer at all (`pg_isready` exits with 2). The API pods are still ready, because their egress to Postgres is allowed and their readiness checks keep passing.

Note what the policy trusts: a **label**. Anyone who can create a pod in the namespace can label it `app: worker`. [Part 4](/guides/security-principles/04-zero-trust) shows that hole and narrows it with workload identity.

## Host Layer

Hosts are still everywhere, even in container platforms: Kubernetes nodes, bastions, build runners, database servers. The host layer has three jobs: run as little as possible, keep it patched, and notice when it changes.

- **Run less.** List what listens with `sudo ss -tulpn` and what is enabled with `systemctl list-unit-files --state=enabled`, then remove what the host does not need. Minimal images (Ubuntu minimal, Bottlerocket or Talos for Kubernetes nodes) start from less.
- **Patch automatically.** On Ubuntu Server, `unattended-upgrades` is installed and enabled by default and applies security updates daily; check that it is still on (`systemctl status unattended-upgrades`), and schedule reboots for kernel updates. Better still, replace hosts with freshly built images instead of patching them in place.
- **Use the kernel's own controls.** Keep AppArmor or SELinux enforcing, and do not turn them off to make an application work.

### SSH: Check What sshd Really Uses

For most `sshd_config` keywords, **the first value sshd reads wins**. Ubuntu's main config starts with `Include /etc/ssh/sshd_config.d/*.conf`, and cloud images put files in that directory. So a hardening line that you append to the end of `/etc/ssh/sshd_config` can be silently overridden by a drop-in that was read first. Look at a real cloud VM:

```terminal
{
  "title": "the drop-ins on an Ubuntu cloud VM",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd ~/security-principles-demo/part02"
    },
    {
      "cmd": "sudo systemctl start ssh"
    },
    {
      "cmd": "grep -n '^Include' /etc/ssh/sshd_config",
      "output": "24:Include /etc/ssh/sshd_config.d/*.conf"
    },
    {
      "cmd": "ls /etc/ssh/sshd_config.d/",
      "output": "50-cloud-init.conf\n50-cloudimg-settings.conf\n60-cloudimg-settings.conf"
    },
    {
      "cmd": "sudo grep -i -E '^(passwordauthentication|clientaliveinterval)' -r /etc/ssh/sshd_config.d/",
      "output": "/etc/ssh/sshd_config.d/50-cloudimg-settings.conf:ClientAliveInterval 120\n/etc/ssh/sshd_config.d/60-cloudimg-settings.conf:PasswordAuthentication no\n/etc/ssh/sshd_config.d/50-cloud-init.conf:PasswordAuthentication yes"
    },
    {
      "cmd": "sudo sshd -T | grep -E '^(passwordauthentication|permitrootlogin|kbdinteractiveauthentication|maxauthtries|persourcepenalties|clientaliveinterval|channeltimeout|x11forwarding|allowtcpforwarding) '",
      "output": "maxauthtries 6\nclientaliveinterval 120\npermitrootlogin prohibit-password\npasswordauthentication yes\nkbdinteractiveauthentication no\nx11forwarding yes\nallowtcpforwarding yes\nchanneltimeout none\npersourcepenalties crash:90 authfail:5 noauth:1 grace-exceeded:10 refuseconnection:10 max:600 min:15 max-sources4:65536 max-sources6:65536 overflow:permissive overflow6:permissive"
    }
  ]
}
```

This VM shows the trap: `60-cloudimg-settings.conf` turns password logins off, but `50-cloud-init.conf` sorts first and turns them on, so `sshd -T` reports `passwordauthentication yes`. Anyone reading only the last file would believe passwords are off. `sshd -T` prints the effective configuration after every include and default has been applied, so it is the only reliable way to check a setting. (Both `sshd -T` and `sshd -t` need the directory `/run/sshd`, which exists while the ssh service runs; that is why the first command starts it.) Put your hardening in a drop-in whose name sorts **before** the others, so it is read first. This is `10-hardening.conf`, installed as `/etc/ssh/sshd_config.d/10-hardening.conf`:

```text
# Read before 50-cloud-init.conf and friends: for most options the first value wins.
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
AuthenticationMethods publickey
MaxAuthTries 3
LoginGraceTime 30
# Close interactive sessions after 30 minutes without traffic,
# and connections that never open a session after 5 minutes.
ChannelTimeout session=30m
UnusedConnectionTimeout 5m
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
AllowGroups ssh-users
```

```terminal
{
  "title": "test, then check the effective values",
  "prompt": "$",
  "steps": [
    {
      "cmd": "sudo groupadd --system ssh-users && sudo usermod -aG ssh-users \"$USER\" && getent group ssh-users",
      "output": "ssh-users:x:986:dev"
    },
    {
      "cmd": "sudo install -m 0644 10-hardening.conf /etc/ssh/sshd_config.d/"
    },
    {
      "cmd": "sudo sshd -t && echo 'config OK'",
      "output": "config OK"
    },
    {
      "cmd": "sudo sshd -T | grep -E '^(passwordauthentication|permitrootlogin|kbdinteractiveauthentication|maxauthtries|persourcepenalties|clientaliveinterval|channeltimeout|unusedconnectiontimeout|x11forwarding|allowtcpforwarding|allowgroups) '",
      "output": "maxauthtries 3\nclientaliveinterval 120\nunusedconnectiontimeout 300\npermitrootlogin no\npasswordauthentication no\nkbdinteractiveauthentication no\nx11forwarding no\nallowtcpforwarding no\nallowgroups ssh-users\nchanneltimeout session=30m\npersourcepenalties crash:90 authfail:5 noauth:1 grace-exceeded:10 refuseconnection:10 max:600 min:15 max-sources4:65536 max-sources6:65536 overflow:permissive overflow6:permissive"
    },
    {
      "cmd": "sudo systemctl try-reload-or-restart ssh"
    }
  ]
}
```

The first command adds your own login (`$USER`) to `ssh-users`, and `getent` confirms it, because `AllowGroups` locks out everyone else, including you if you forget. Run `sshd -t` before every reload, keep your current session open, and test a new login from a second terminal before you close it. On Ubuntu, ssh starts through socket activation (`ssh.socket`): `try-reload-or-restart` reloads a running sshd and does nothing if none is running yet, in which case the next connection starts one with the new settings. Changing `Port` or `ListenAddress` also needs `sudo systemctl daemon-reload` and a restart of `ssh.socket`.

Some settings in older hardening guides are wrong or obsolete:

- **`Protocol 2`** has done nothing since OpenSSH 7.4 (2016), which removed SSH protocol 1 from the server. sshd ignores the line without a warning.
- **`MaxAuthTries`** counts attempts per connection. It is not an account lockout; an attacker simply reconnects.
- **`ClientAliveInterval` and `ClientAliveCountMax`** disconnect clients that stop answering, not idle users. An idle client still answers the keepalives. For idle sessions use `ChannelTimeout` and `UnusedConnectionTimeout` (OpenSSH 9.2 and newer).
- **`PerSourcePenalties`** (OpenSSH 9.8 and newer, on by default) is the built-in answer to password guessing and crash probing: it refuses connections from an address for a while after failed authentications. You saw its default values in the `sshd -T` output above. For sshd alone, it covers what many people installed fail2ban for.

The [SSH Hardening Checklist](/checklists/ssh-hardening) has the full list.

### Detect Changes with AIDE

File integrity monitoring records a fingerprint (hashes, permissions, owners) of important files and reports any change. It is how you notice a backdoored binary or an edited `sudoers` file. AIDE is the standard open-source tool on Linux. Debian and Ubuntu ship a full configuration (`aideinit` builds the database, and a daily timer runs the check); this small configuration watches one directory so the run takes seconds:

```text
database_in=file:/var/lib/aide-shop/aide.db
database_out=file:/var/lib/aide-shop/aide.db.new
report_url=stdout
# permissions, owner, group, size, modification time and SHA-256 of every file
/etc/shop p+u+g+s+m+sha256
```

```terminal
{
  "title": "baseline, change, check",
  "prompt": "$",
  "steps": [
    {
      "cmd": "sudo apt-get install -y -qq aide >/dev/null && sudo install -m 0600 aide-shop.conf /etc/aide-shop.conf"
    },
    {
      "cmd": "sudo mkdir -p /etc/shop /var/lib/aide-shop && echo 'log_level=info' | sudo tee /etc/shop/app.conf >/dev/null"
    },
    {
      "cmd": "sudo aide --config /etc/aide-shop.conf --init >/dev/null && sudo mv /var/lib/aide-shop/aide.db.new /var/lib/aide-shop/aide.db"
    },
    {
      "cmd": "sudo aide --config /etc/aide-shop.conf --check",
      "output": "Start timestamp: 2026-10-27 17:45:40 +0000 (AIDE 0.19.2)\nAIDE found NO differences between database and filesystem. Looks okay!!"
    },
    {
      "cmd": "echo 'debug_token=letmein' | sudo tee -a /etc/shop/app.conf >/dev/null && sudo chmod 0666 /etc/shop/app.conf"
    },
    {
      "cmd": "sudo aide --config /etc/aide-shop.conf --check",
      "output": "Start timestamp: 2026-10-27 17:45:40 +0000 (AIDE 0.19.2)\nAIDE found differences between database and filesystem!!\n\nSummary:\n  Total number of entries:\t2\n  Added entries:\t\t0\n  Removed entries:\t\t0\n  Changed entries:\t\t1\n\n---------------------------------------------------\nChanged entries:\n---------------------------------------------------\n\nf > p.. .   H      : /etc/shop/app.conf\n\n---------------------------------------------------\nDetailed information about changes:\n---------------------------------------------------\n\nFile: /etc/shop/app.conf\n Size      : 15                               | 35\n Perm      : -rw-r--r--                       | -rw-rw-rw-\n SHA256    : m4un7NqHYcHbtEz8b3hbCuGGO/wm41hs | RZzutW4ja5e1poflJPAbeeOh/4Uu7Aet\n             huFGz0fx+DE=                     | Ol7vBX1ZZt0="
    }
  ]
}
```

AIDE lists the changed size, permissions and SHA-256 hash, old and new side by side, and exits with code 4 ("changed entries"), so a timer or a monitoring agent can alert on a non-zero exit. After a planned change, update the baseline (`--update`, then move the new database into place). Store the database or a copy of it somewhere the monitored host cannot write, or an attacker with root simply rebuilds it.

## Application Layer

### Parameterized Queries, and What Happens When They Are Missing

Here is the order search from the attack above, in a vulnerable and a safe version. It connects to a local PostgreSQL 18 database as the role the API uses, `shop_api`. The setup file creates the tables, a sample order for two customers and the roles that [Part 3](/guides/security-principles/03-least-privilege) explains in detail:

```sql
CREATE ROLE shop_owner NOLOGIN;
CREATE ROLE shop_api LOGIN PASSWORD 'lab-only-change-me';
CREATE ROLE shop_worker LOGIN PASSWORD 'lab-only-change-me';
CREATE DATABASE shop OWNER shop_owner;
\connect shop
SET ROLE shop_owner;

CREATE TABLE events (id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL);
CREATE TABLE orders (
  id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL,
  total numeric(10, 2) NOT NULL CHECK (total >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'fulfilled', 'refunded'))
);
CREATE TABLE tickets (
  id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id int NOT NULL REFERENCES orders,
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'void'))
);
CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  action text NOT NULL
);

INSERT INTO events (name) VALUES ('Spring concert');
INSERT INTO orders (email, total, status) VALUES
  ('ana@example.com', 90.00, 'fulfilled'),
  ('ben@example.com', 45.00, 'paid');
INSERT INTO tickets (order_id, code) VALUES (1, 'QR-7F3A'), (1, 'QR-9C21');

GRANT CONNECT ON DATABASE shop TO shop_api, shop_worker;
GRANT USAGE ON SCHEMA public TO shop_api, shop_worker;
GRANT SELECT ON events TO shop_api;
GRANT SELECT, INSERT, UPDATE ON orders TO shop_api;
GRANT SELECT, UPDATE (status) ON tickets TO shop_api;
GRANT INSERT ON audit_log TO shop_api;
GRANT SELECT, UPDATE (status) ON orders TO shop_worker;
GRANT SELECT, INSERT ON tickets TO shop_worker;
GRANT INSERT ON audit_log TO shop_worker;
```

```python
"""Order search from the ticket shop API, in an unsafe and a safe version."""

import sys

import psycopg


def find_orders_unsafe(cur, email):
    # The input becomes part of the SQL text.
    cur.execute(f"SELECT id, email, total FROM orders WHERE email = '{email}'")
    return cur.fetchall()


def find_orders_safe(cur, email):
    # The input travels separately from the SQL and is never parsed as SQL.
    cur.execute('SELECT id, email, total FROM orders WHERE email = %s', (email,))
    return cur.fetchall()


mode, email = sys.argv[1], sys.argv[2]
find = find_orders_safe if mode == 'safe' else find_orders_unsafe
with psycopg.connect('host=127.0.0.1 dbname=shop user=shop_api', autocommit=True) as conn:
    try:
        for row in find(conn.cursor(), email):
            print(row)
    except psycopg.Error as e:
        print(f'{type(e).__name__}: {e}')
```

The password for `shop_api` goes into `~/.pgpass` with mode `0600`, so it is not on the command line (Part 1 showed why):

```terminal
{
  "title": "set up the database",
  "prompt": "$",
  "steps": [
    {
      "cmd": "sudo apt-get install -y -qq postgresql python3-psycopg >/dev/null && sudo systemctl enable --now postgresql"
    },
    {
      "cmd": "sudo -u postgres psql -q -v ON_ERROR_STOP=1 < setup.sql"
    },
    {
      "cmd": "echo '127.0.0.1:5432:shop:shop_api:lab-only-change-me' > ~/.pgpass && chmod 600 ~/.pgpass"
    }
  ]
}
```

Now a normal search, then the classic injection, against both versions:

```terminal
{
  "title": "the injection, layer by layer",
  "prompt": "$",
  "steps": [
    {
      "cmd": "python3 orders.py unsafe 'ana@example.com'",
      "output": "(1, 'ana@example.com', Decimal('90.00'))"
    },
    {
      "cmd": "python3 orders.py unsafe \"x' OR '1'='1\"",
      "output": "(1, 'ana@example.com', Decimal('90.00'))\n(2, 'ben@example.com', Decimal('45.00'))"
    },
    {
      "cmd": "python3 orders.py safe \"x' OR '1'='1\""
    },
    {
      "cmd": "python3 orders.py unsafe \"x'; DROP TABLE orders; --\"",
      "output": "InsufficientPrivilege: must be owner of table orders"
    }
  ]
}
```

The unsafe version returns every customer's order to anyone who types a quote; the safe version treats the same input as an email address that matches nothing. The last attempt shows the next layer: the injected `DROP TABLE` reaches the database and runs as `shop_api`, and fails because that role does not own the table. psycopg runs several statements in one call when you pass no parameters, which is one more reason never to build SQL from strings. The database error is also a signal: an application should never produce "must be owner of table", so an alert on it catches attacks like this one early.

Parameterized queries are the fix; ORMs and query builders use them for you, until someone reaches for a raw query with string formatting. The [injection part of the OWASP Top 10 guide](/guides/owasp-top-10/03-injection) covers the other kinds of injection.

### A Container That Cannot Change Itself

A container is a process with restrictions, and you choose how tight they are. For the API image: a small, pinned base, a numeric non-root user, no shell tools it does not need, and at run time a read-only file system, no Linux capabilities and no way to gain privileges. A numeric `USER` matters: when a pod does not set `runAsUser`, Kubernetes can only verify `runAsNonRoot` if the image's user is a number.

```dockerfile
FROM python:3.14.7-alpine3.24@sha256:9e9fde4d32eedce0b661d9ab91e826b62dddf28e928c230ec55f1866cac66b01
WORKDIR /app
COPY server.py .
USER 10001:10001
EXPOSE 8080
CMD ["python3", "/app/server.py"]
```

The build directory gets a copy of `server.py` from [Part 1](/guides/security-principles/01-cia-triad#h3-remove-single-points-of-failure). The file is owned by root inside the image, so user 10001 can read it but not change it:

```terminal
{
  "title": "build and run with everything dropped",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cp ../part01/server.py shop-api/"
    },
    {
      "cmd": "docker build -q -t shop-api:1.4.0 shop-api >/dev/null && docker run --rm shop-api:1.4.0 id",
      "output": "uid=10001 gid=10001 groups=10001"
    },
    {
      "cmd": "docker run -d --name api --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges=true -p 127.0.0.1:8080:8080 shop-api:1.4.0"
    },
    {
      "cmd": "sleep 2; curl -s http://127.0.0.1:8080/orders",
      "output": "api fd2bab448391: GET /orders"
    },
    {
      "cmd": "docker exec api sh -c 'echo \"import os\" > /app/backdoor.py'",
      "output": "sh: can't create /app/backdoor.py: Read-only file system"
    },
    {
      "cmd": "docker exec api grep -E '^(CapEff|NoNewPrivs)' /proc/1/status",
      "output": "CapEff:\t0000000000000000\nNoNewPrivs:\t1"
    },
    {
      "cmd": "docker rm -f api"
    }
  ]
}
```

The process runs as UID 10001, has no capabilities (`CapEff` is all zeros), cannot gain any through setuid binaries (`NoNewPrivs: 1`), and cannot write a file to the image even though a shell is available. In Kubernetes the same settings are `readOnlyRootFilesystem`, `capabilities.drop: ['ALL']` and `allowPrivilegeEscalation: false`, which the API Deployment from Part 1 already has. A distroless base (Google's distroless images are now built on Debian 13) goes one step further by removing the shell and package manager entirely. Scan images for known vulnerabilities in CI (Trivy, Grype); the [Docker Security Hardening Checklist](/checklists/docker-security) has the rest.

### A Web Application Firewall, With Its Limits

A WAF inspects HTTP requests at the edge and blocks known attack patterns before they reach your code. Start with the managed rule groups instead of writing your own, and add a rate-based rule:

```hcl
resource "aws_wafv2_web_acl" "shop" {
  name  = "shop-api"
  scope = "REGIONAL" # attach to the Application Load Balancer

  default_action {
    allow {}
  }

  rule {
    name     = "aws-common"
    priority = 10
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-common"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-sqli"
    priority = 20
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesSQLiRuleSet"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-sqli"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "login-rate-limit"
    priority = 30
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit                 = 100 # requests per client IP in the evaluation window
        evaluation_window_sec = 300
        aggregate_key_type    = "IP"
        scope_down_statement {
          byte_match_statement {
            search_string         = "/login"
            positional_constraint = "STARTS_WITH"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "NONE"
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "login-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "shop-api"
    sampled_requests_enabled   = true
  }
}
```

Know what a WAF cannot do. It matches patterns, so new encodings and logic flaws pass. It also sees only part of large requests: AWS WAF inspects the first 8 KB of a request body behind an Application Load Balancer (16 KB by default, up to 64 KB, for CloudFront and API Gateway), and a rule that does not handle oversized bodies inspects only that part. The common rule set above already contains `SizeRestrictions_BODY`, which blocks bodies larger than 8 KB; keep it, and if one endpoint needs larger uploads, exempt only that path instead of turning the rule off. Run new rules in count mode first to find false positives. A WAF buys you time to fix the code; it does not replace the fix.

## Data Layer

The data layer is what is left when everything in front of it has failed.

**Least-privilege database roles** were the layer that stopped `DROP TABLE` above. [Part 3](/guides/security-principles/03-least-privilege#h2-database-roles) goes through them.

**Encryption at rest** protects disks, snapshots and backups that leave your control. In AWS most of it is on or one setting away:

- S3 encrypts every new object with SSE-S3 since January 2023, with no option to turn it off. Use SSE-KMS with a customer managed key when you need a key policy that decides who can decrypt, and turn on S3 Bucket Keys to reduce KMS costs.
- EBS encryption by default is a per-Region account setting that is off until you turn it on, and it does not touch existing volumes. Turn it on in every Region you use.
- RDS and Aurora encrypt at creation time only; an unencrypted database has to be restored from an encrypted snapshot copy.

```bash
aws ec2 enable-ebs-encryption-by-default --region eu-west-1
aws ec2 get-ebs-encryption-by-default --region eu-west-1

aws s3api put-bucket-encryption --bucket shop-tickets-example \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms","KMSMasterKeyID":"alias/shop-data"},"BucketKeyEnabled":true}]}'
```

Encryption at rest does not help against an attacker who uses the application or a stolen role, because those decrypt transparently. That is why it sits behind access control, not instead of it.

**Encryption in transit** means TLS on every hop, including inside your network: client to load balancer, load balancer to API, API to Postgres (with `sslmode=verify-full`, which checks the server certificate). At the Kubernetes edge, the ingress-nginx controller was retired in March 2026 and its repository archived, so new clusters use the Gateway API. The HTTP to HTTPS redirect, which used to be an annotation, is a standard filter:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: shop
  namespace: shop
spec:
  gatewayClassName: example
  listeners:
    - name: http
      protocol: HTTP
      port: 80
    - name: https
      protocol: HTTPS
      port: 443
      hostname: tickets.example.com
      tls:
        certificateRefs:
          - name: tickets-example-com-tls
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: http-to-https
  namespace: shop
spec:
  parentRefs:
    - name: shop
      sectionName: http
  rules:
    - filters:
        - type: RequestRedirect
          requestRedirect:
            scheme: https
            statusCode: 301
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api
  namespace: shop
spec:
  parentRefs:
    - name: shop
      sectionName: https
  hostnames: ['tickets.example.com']
  rules:
    - backendRefs:
        - name: api
          port: 80
```

`gatewayClassName` names the implementation that your cluster runs (Envoy Gateway, Istio, Cilium, a cloud load balancer controller and others). The API server validates the objects against the Gateway API CRDs even before an implementation is installed:

```terminal
{
  "title": "server-side validation with the Gateway API CRDs",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.6.3/standard-install.yaml >/dev/null"
    },
    {
      "cmd": "kubectl apply --dry-run=server -f gateway.yaml",
      "output": "gateway.gateway.networking.k8s.io/shop created (server dry run)\nhttproute.gateway.networking.k8s.io/http-to-https created (server dry run)\nhttproute.gateway.networking.k8s.io/api created (server dry run)"
    }
  ]
}
```

Add `Strict-Transport-Security` (HSTS) to HTTPS responses so browsers never try plain HTTP again; the [TLS part of the Cryptography Essentials guide](/guides/cryptography-essentials/03-tls-ssl) covers server settings, and [Part 4](/guides/security-principles/04-zero-trust) adds mutual TLS between services.

**Classify the data** so each class gets the right controls:

| Class        | Ticket shop examples                         | Minimum controls                                                         |
| ------------ | -------------------------------------------- | ------------------------------------------------------------------------ |
| Public       | Event listings, prices                       | Integrity: only the admin role can change them                           |
| Internal     | Sales dashboards, runbooks                   | Single sign-on, no public links                                          |
| Confidential | Orders, customer emails, application logs    | Encryption at rest and in transit, access logged, retention limits       |
| Restricted   | Password hashes, payment API key, QR secrets | Secrets manager or dedicated columns, named roles only, alerts on access |

## Detection and Response Layer

Every layer above produced a signal when it held: the intruder's connection timed out, sshd validated a new config, AIDE exited with 4, Postgres refused `DROP TABLE`, the container refused a write. Those signals are only useful if they reach someone:

- **Collect logs centrally**, where the systems that produce them cannot delete them: cloud audit logs (CloudTrail, with an organization trail), Kubernetes API audit logs, database logs, WAF logs, and host logs.
- **Alert on the impossible**, not only on thresholds. "must be owner of table" from the API's role, a new `cluster-admin` binding, an AIDE change outside a deploy window, and a root login are each worth a page.
- **Practice the response.** A runbook that nobody has run fails during the first real incident. The [security incident response quiz](/quizzes/security-incident-response-quiz) is a quick self-check.

## Putting It Together

A controls matrix lists every asset against every layer and makes gaps visible. For the ticket shop's customer data:

| Layer       | Control                                                     | Tested by                                        |
| ----------- | ----------------------------------------------------------- | ------------------------------------------------ |
| Edge        | WAF managed rules, rate limit on `/login`                   | WAF logs in count mode, Part 1's rate limit test |
| Network     | Security groups by reference, NetworkPolicies, no DB egress | The intruder pod above                           |
| Host        | Patching, SSH drop-in, AIDE                                 | `sshd -T`, AIDE check                            |
| Application | Parameterized queries, read-only non-root container         | The injection test, the container test           |
| Data        | `shop_api` owns nothing, encryption at rest and in transit  | `DROP TABLE` as `shop_api`                       |
| Detect      | Alerts on database permission errors and policy changes     | A test alert in each release                     |

Look for rows with one control and no test: that is where a single mistake becomes an incident.

## Common Mistakes

- **Layers that share a weakness**: one admin password for the WAF console, the cloud account and the database.
- **Trusting the internal network**: "it is behind the firewall" is not authentication.
- **Appending SSH hardening to the end of `sshd_config`** and never checking `sshd -T`.
- **NetworkPolicies on a cluster whose network plugin ignores them.** Test that a blocked connection is really blocked.
- **A WAF as the only fix** for an injectable endpoint.
- **Signals nobody reads**: AIDE reports in a local mailbox, audit logs that are never alerted on.

## Summary

- Defense in depth stacks **independent** layers so that one failure is not a breach.
- Follow a real attack through your layers and check what each one stops.
- **Network**: reference security groups instead of address ranges, deny by default in Kubernetes, and allow DNS on UDP and TCP.
- **Host**: run less, patch automatically, verify SSH with `sshd -T`, and watch files with AIDE.
- **Application**: parameterized queries, numeric non-root users, read-only containers without capabilities; a WAF is a delay, not a fix.
- **Data**: roles that own nothing, encryption at rest and in transit, the Gateway API for TLS at the edge.
- **Detect**: every layer that holds should also raise an alert.

## Keep Learning

- Next: [Part 3, the Principle of Least Privilege](/guides/security-principles/03-least-privilege), which tightens the roles and permissions this part relied on
- [Network Security and Firewalls in the Networking Fundamentals guide](/guides/networking-fundamentals/04-network-security-and-firewalls-basics)
- [Attack trees in the Threat Modeling guide](/guides/threat-modeling/03-attack-trees), for finding the paths through your layers
- [Injection in the OWASP Top 10 guide](/guides/owasp-top-10/03-injection)
- [Docker Security Best Practices](/posts/docker-security-best-practices)
- [Kubernetes Security Checklist](/checklists/kubernetes-security) and [SSH Hardening Checklist](/checklists/ssh-hardening)
- [Exercise: Securing Your Linux Server](/exercises/linux-server-security)
- [Quiz: Network and Security Fundamentals](/quizzes/network-security-quiz)
