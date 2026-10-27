---
title: 'Least Privilege: Databases, Linux, Kubernetes and Cloud IAM'
description: 'Least privilege, tested: Postgres grants, systemd sandboxing, a Kubernetes RBAC escalation, Pod Security, linted IAM policies and just-in-time access.'
order: 3
---

**TLDR**: Least privilege means every user, service and machine gets only the access it needs for its job, for only as long as it needs it. It limits the **blast radius**: when an account or a service is compromised, the attacker gets that account's permissions and no more. In this part you apply it at every level of the ticket shop and test it: Postgres roles that let the API void a ticket but not change its code, a systemd service that scores "OK" instead of "UNSAFE", a Kubernetes deploy account that cannot read Secrets but can still steal one by patching a Deployment, a namespace that rejects privileged pods, and an IAM policy linter that flags wildcards.

NIST's definition is short: each entity is granted the minimum system resources and authorizations that it needs to perform its function. The hard part is not agreeing with it; it is finding out what "needs" means for each identity, and keeping it that way as systems change. Permissions only grow unless someone removes them.

## Prerequisites

- [Part 2](/guides/security-principles/02-defense-in-depth), which created the `shop` database and the hardened kind cluster setup this part continues with. The [companion repository](https://github.com/The-DevOps-Daily/guide-security-principles-demo-2026-10-27) has all files.
- Ubuntu 26.04 (or similar) with `sudo`, PostgreSQL 18 and systemd. The outputs come from Ubuntu 26.04 with PostgreSQL 18.6 and systemd 259.
- For the IAM section: Python 3 to run the policy linter. No AWS account is needed; the `aws` commands are checked for syntax in the companion repository's workflow.

## Why It Matters

Over-broad permissions turn small bugs into large incidents:

- **Blast radius.** A web app that connects to its database as a superuser turns a SQL injection into `DROP DATABASE`. With a narrow role, the same bug can still read and change what that role may read and change, but it cannot drop tables, forge ticket codes or delete orders (Part 2 showed the first of these).
- **Lateral movement.** Attackers rarely land where the data is. They land on a build runner or a web server and move with the credentials they find there.
- **Mistakes.** Most damage from privileged access is accidental: the wrong terminal, the wrong cluster context, a cleanup script with a wildcard.
- **Audits.** You cannot review access that nobody can explain. Narrow, named permissions are also cheaper to audit.

The 2019 Capital One breach is the usual example. According to the US Department of Justice's indictment, the attacker sent commands through a misconfigured web application firewall to obtain the credentials of a cloud role, then used that role to list and copy data from S3. Public analyses described the first step as server-side request forgery against the EC2 instance metadata service (IMDSv1). About 100 million people in the US and 6 million in Canada were affected, and the bank paid an $80 million fine to its US regulator. The role needed to read a few things; it could read much more. Least privilege on that role, and IMDSv2 on the instance, would each have shrunk the damage.

## Database Roles

The database is where the data is, so its permissions matter most. The rules:

- **The application never owns its tables.** A separate owner role (`shop_owner`, which cannot log in) owns the schema; migrations run as the owner, the application runs as a role with grants.
- **One role per component**: the API, the worker, reporting and migrations each get their own login.
- **Grant per table and per column**, and grant write access only where the component writes.

Part 2's `setup.sql` did this for the ticket shop. `\dp` shows the result:

```terminal
{
  "title": "who can do what on tickets",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd ~/security-principles-demo/part03"
    },
    {
      "cmd": "sudo -u postgres psql -d shop -c '\\dp tickets'",
      "output": "                                       Access privileges\n Schema |  Name   | Type  |       Access privileges        |    Column privileges    | Policies\n--------+---------+-------+--------------------------------+-------------------------+----------\n public | tickets | table | shop_owner=arwdDxtm/shop_owner+| status:                +|\n        |         |       | shop_api=r/shop_owner         +|   shop_api=w/shop_owner |\n        |         |       | shop_worker=ar/shop_owner      |                         |\n(1 row)"
    }
  ]
}
```

Read the access privileges as `role=letters/grantor`: `r` is SELECT, `a` INSERT, `w` UPDATE, `d` DELETE. `shop_api` can read tickets and update only the `status` column (the column privileges line), and `shop_worker` can read and create them. Test it as the API would connect:

```sql
\set ON_ERROR_STOP off
-- Void a ticket after a refund: allowed, only the status column
UPDATE tickets SET status = 'void' WHERE id = 2;
-- Change a ticket's QR code: not allowed
UPDATE tickets SET code = 'QR-FORGED' WHERE id = 1;
-- Delete an order: not allowed
DELETE FROM orders WHERE id = 2;
-- Write to the audit log: allowed
INSERT INTO audit_log (actor, action) VALUES ('api', 'void ticket 2');
-- Rewrite the audit log: not allowed
UPDATE audit_log SET action = 'nothing happened';
```

```terminal
{
  "title": "the API's role, tested",
  "prompt": "$",
  "steps": [
    {
      "cmd": "psql -h 127.0.0.1 -U shop_api -d shop -f api-checks.sql",
      "output": "UPDATE 1\npsql:api-checks.sql:5: ERROR:  permission denied for table tickets\npsql:api-checks.sql:7: ERROR:  permission denied for table orders\nINSERT 0 1\npsql:api-checks.sql:11: ERROR:  permission denied for table audit_log"
    }
  ]
}
```

The API can do its job (void a ticket, record it) and nothing more: it cannot forge a ticket code, delete orders or change history. The audit log is append-only for the application, which is what makes it useful as evidence (Part 1's non-repudiation).

### The Default Privileges Trap

Reporting is a common place where least privilege erodes. Give the reporting role its own schema of views that expose only what reports need (totals, counts), never the raw tables with emails and ticket codes. Then grant it `SELECT ON ALL TABLES IN SCHEMA reporting`, which also covers views. That grant has a catch: it covers the views that exist **now**. A view added by the next migration is invisible to reporting, and the usual "fix" under pressure is to make the reporting role a superuser. Watch it happen, then fix it with `ALTER DEFAULT PRIVILEGES`:

```sql
\set ON_ERROR_STOP off
CREATE ROLE reporting LOGIN PASSWORD 'lab-only-change-me';
GRANT CONNECT ON DATABASE shop TO reporting;

-- Reports read views in their own schema, never the raw tables
SET ROLE shop_owner;
CREATE SCHEMA reporting;
CREATE VIEW reporting.sales AS
  SELECT status, count(*) AS orders, sum(total) AS revenue FROM orders GROUP BY status;
GRANT USAGE ON SCHEMA reporting TO reporting;
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO reporting;

\echo '-- the next migration adds a view'
CREATE VIEW reporting.tickets AS
  SELECT status, count(*) AS tickets FROM tickets GROUP BY status;
RESET ROLE;

\echo '-- reporting reads both views, and tries a raw table'
SET ROLE reporting;
SELECT * FROM reporting.sales;
SELECT * FROM reporting.tickets;
SELECT code FROM public.tickets;
RESET ROLE;

\echo '-- fix: default privileges for future views, and a grant for the one that slipped through'
SET ROLE shop_owner;
ALTER DEFAULT PRIVILEGES FOR ROLE shop_owner IN SCHEMA reporting GRANT SELECT ON TABLES TO reporting;
GRANT SELECT ON reporting.tickets TO reporting;
CREATE VIEW reporting.events AS SELECT count(*) AS events FROM events;
RESET ROLE;

\echo '-- reporting reads the fixed view and the newest one'
SET ROLE reporting;
SELECT * FROM reporting.tickets;
SELECT * FROM reporting.events;
```

```terminal
{
  "title": "new views and default privileges",
  "prompt": "$",
  "steps": [
    {
      "cmd": "sudo -u postgres psql -q -d shop < reporting.sql",
      "output": "-- the next migration adds a view\n-- reporting reads both views, and tries a raw table\n  status   | orders | revenue\n-----------+--------+---------\n fulfilled |      1 |   90.00\n paid      |      1 |   45.00\n(2 rows)\n\nERROR:  permission denied for view tickets\nERROR:  permission denied for table tickets\n-- fix: default privileges for future views, and a grant for the one that slipped through\n-- reporting reads the fixed view and the newest one\n status | tickets\n--------+---------\n void   |       1\n valid  |       1\n(2 rows)\n\n events\n--------\n      1\n(1 row)"
    }
  ]
}
```

The views run with their owner's rights, so `reporting` gets totals without any access to the raw tables (the query on `public.tickets` is refused). The schema is named after the role on purpose: PostgreSQL's default `search_path` starts with `"$user"`, so unqualified names used by `reporting` resolve to its own schema first. Default privileges are set per creating role (`FOR ROLE shop_owner`), which is one more reason to run all migrations as one owner role. PostgreSQL also has the predefined role `pg_read_all_data`, but that reads every table, present and future, emails and ticket codes included, so keep it for the few roles that really need everything.

The tables use identity columns, so the API needs no grant on their sequences; tables with `serial` columns also need `USAGE` on each sequence.

## Linux: Service Users, Files and systemd

On a host, least privilege means: no service runs as root, each service has its own user, secrets are readable only by what needs them, and the service manager removes everything else the process could touch.

Start with a secret: the worker's database password, generated on the host and never typed on a command line. The file is readable by root only:

```terminal
{
  "title": "a root-only credential file",
  "prompt": "$",
  "steps": [
    {
      "cmd": "sudo install -d -m 0700 /etc/shop-worker"
    },
    {
      "cmd": "sudo sh -c 'umask 077; openssl rand -hex 16 > /etc/shop-worker/db-password'"
    },
    {
      "cmd": "sudo ls -l /etc/shop-worker",
      "output": "total 4\n-rw------- 1 root root 33 Oct 27 17:45 db-password"
    },
    {
      "cmd": "sudo -u nobody cat /etc/shop-worker/db-password",
      "output": "cat: /etc/shop-worker/db-password: Permission denied"
    }
  ]
}
```

The worker itself is a small stand-in script that reports what it can see:

```python
"""Stand-in for the ticket shop worker: loads its credential, reports, and waits for jobs."""

import os
import pathlib
import time

creds = os.environ.get('CREDENTIALS_DIRECTORY')
password = pathlib.Path(creds, 'db-password').read_text().strip() if creds else None
print(f'worker running as uid {os.getuid()}; db password loaded: {password is not None}', flush=True)
while True:
    time.sleep(60)
```

A first unit file, the way many services are written:

```ini
[Unit]
Description=Ticket shop worker (stand-in)

[Service]
ExecStart=/usr/bin/python3 /opt/shop-worker/worker.py
```

`systemd-analyze security` scores a unit's exposure from 0 (locked down) to 10 (unrestricted). (`SYSTEMD_EMOJI=0` makes it print a text smiley instead of an emoji next to the rating.)

```terminal
{
  "title": "how exposed is the basic unit?",
  "prompt": "$",
  "steps": [
    {
      "cmd": "sudo install -D -m 0644 worker.py /opt/shop-worker/worker.py"
    },
    {
      "cmd": "sudo install -m 0644 shop-worker.service.basic /etc/systemd/system/shop-worker.service && sudo systemctl daemon-reload"
    },
    {
      "cmd": "SYSTEMD_EMOJI=0 systemd-analyze security shop-worker.service | tail -n 1",
      "output": "→ Overall exposure level for shop-worker.service: 9.6 UNSAFE :-{"
    }
  ]
}
```

It runs as root with access to the whole system. The hardened version gives the worker a user that exists only while it runs (`DynamicUser`), hands it the password through systemd's credentials mechanism, and removes everything it does not use:

```ini
[Unit]
Description=Ticket shop worker (stand-in)

[Service]
ExecStart=/usr/bin/python3 /opt/shop-worker/worker.py
# A fresh, unprivileged user for this service only
DynamicUser=yes
# systemd reads the root-only file and gives the service a private copy in $CREDENTIALS_DIRECTORY
LoadCredential=db-password:/etc/shop-worker/db-password
NoNewPrivileges=yes
CapabilityBoundingSet=
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
PrivateUsers=yes
ProtectHostname=yes
ProtectClock=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectKernelLogs=yes
ProtectControlGroups=yes
ProtectProc=invisible
ProcSubset=pid
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
RestrictNamespaces=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
LockPersonality=yes
MemoryDenyWriteExecute=yes
SystemCallArchitectures=native
SystemCallFilter=@system-service
SystemCallFilter=~@privileged @resources
UMask=0077
```

```terminal
{
  "title": "the hardened unit",
  "prompt": "$",
  "steps": [
    {
      "cmd": "sudo install -m 0644 shop-worker.service /etc/systemd/system/shop-worker.service && sudo systemctl daemon-reload"
    },
    {
      "cmd": "SYSTEMD_EMOJI=0 systemd-analyze security shop-worker.service | tail -n 1",
      "output": "→ Overall exposure level for shop-worker.service: 1.1 OK :-)"
    },
    {
      "cmd": "sudo systemctl start shop-worker && sleep 2 && sudo journalctl -u shop-worker -n 1 -o cat --no-pager",
      "output": "worker running as uid 64081; db password loaded: True"
    }
  ]
}
```

The worker runs as an unprivileged dynamic user and still gets its password, although that user could never open `/etc/shop-worker/db-password` itself. Each line in the full `systemd-analyze security` report names a setting and what it protects; work through the ones your service can live without. A few need care: `MemoryDenyWriteExecute` breaks runtimes with a JIT compiler (Node.js, Java), and `RestrictAddressFamilies` must include every socket type the service uses. Start the service and run its tests after each change.

The same rules apply to plain files. Configuration and code should be owned by root and only readable by the service, so that a compromised service cannot change its own code; data and log directories are the only places it writes. Avoid world-writable modes such as `777` entirely, and never run a service as root "for now".

## Kubernetes RBAC

Kubernetes Role-Based Access Control decides what each user and service account can do through the API server:

- A **Role** lists allowed verbs on resources in one namespace; a **ClusterRole** does the same cluster-wide or for reuse.
- A **RoleBinding** grants a Role (or a ClusterRole, limited to one namespace) to subjects; a **ClusterRoleBinding** grants it in every namespace.
- There are no deny rules. Anything not granted is denied, so least privilege means granting less, not denying more.

Create an account for the CI pipeline that deploys the ticket shop. It needs to update Deployments and read pods and their logs; nothing else:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: deployer
  namespace: shop
automountServiceAccountToken: false
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: deployer
  namespace: shop
rules:
  - apiGroups: ['apps']
    resources: ['deployments']
    verbs: ['get', 'list', 'watch', 'patch', 'update']
  - apiGroups: ['']
    resources: ['pods', 'pods/log']
    verbs: ['get', 'list', 'watch']
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: deployer
  namespace: shop
subjects:
  - kind: ServiceAccount
    name: deployer
    namespace: shop
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: deployer
```

`get` on `pods/log` is enough for `kubectl logs -f`: following a log is a `get` with a parameter, not a `watch`. `kubectl auth can-i` with `--as` checks permissions without a token:

```terminal
{
  "title": "what can the deployer do?",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd ~/security-principles-demo/part03"
    },
    {
      "cmd": "kubectl apply -f rbac-deployer.yaml",
      "output": "serviceaccount/deployer created\nrole.rbac.authorization.k8s.io/deployer created\nrolebinding.rbac.authorization.k8s.io/deployer created"
    },
    {
      "cmd": "kubectl auth can-i --list -n shop --as=system:serviceaccount:shop:deployer",
      "output": "Resources                                       Non-Resource URLs                      Resource Names   Verbs\nselfsubjectreviews.authentication.k8s.io        []                                     []               [create]\nselfsubjectaccessreviews.authorization.k8s.io   []                                     []               [create]\nselfsubjectrulesreviews.authorization.k8s.io    []                                     []               [create]\ndeployments.apps                                []                                     []               [get list watch patch update]\npods/log                                        []                                     []               [get list watch]\npods                                            []                                     []               [get list watch]\nclustertrustbundles.certificates.k8s.io         []                                     []               [get list watch]"
    },
    {
      "cmd": "kubectl auth can-i get secrets -n shop --as=system:serviceaccount:shop:deployer",
      "output": "no"
    },
    {
      "cmd": "kubectl get secret postgres -n shop --as=system:serviceaccount:shop:deployer",
      "output": "Error from server (Forbidden): secrets \"postgres\" is forbidden: User \"system:serviceaccount:shop:deployer\" cannot get resource \"secrets\" in API group \"\" in the namespace \"shop\""
    }
  ]
}
```

The first lines of the list show the Role's rules plus what every authenticated identity gets (self-reviews, reading cluster trust bundles, and discovery URLs further down). Reading the Secret is forbidden. Now the uncomfortable part: the deployer can change a Deployment's pod template, and the pods run with the namespace's Secrets and service accounts available to them.

```terminal
{
  "title": "patch a Deployment to read a Secret",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl -n shop patch deployment worker --as=system:serviceaccount:shop:deployer --type=json -p '[{\"op\":\"add\",\"path\":\"/spec/template/spec/containers/0/env/-\",\"value\":{\"name\":\"STOLEN\",\"valueFrom\":{\"secretKeyRef\":{\"name\":\"postgres\",\"key\":\"password\"}}}}]'",
      "output": "deployment.apps/worker patched"
    },
    {
      "cmd": "kubectl -n shop rollout status deployment/worker --timeout=120s >/dev/null && kubectl -n shop exec deploy/worker -- printenv STOLEN",
      "output": "lab-only-change-me"
    },
    {
      "cmd": "kubectl -n shop rollout undo deployment/worker && kubectl -n shop rollout status deployment/worker --timeout=120s",
      "output": "Warning: resource deployments/worker was previously managed with 'kubectl apply'. Rolling back will not update the kubectl.kubernetes.io/last-applied-configuration annotation, which may cause unexpected behavior on future 'kubectl apply' operations. Consider using 'kubectl apply' with your previous configuration file instead.\ndeployment.apps/worker rolled back\nWaiting for deployment \"worker\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"worker\" rollout to finish: 1 old replicas are pending termination...\ndeployment \"worker\" successfully rolled out"
    }
  ]
}
```

The patch succeeded although the deployer cannot `get secrets`. (The rollback warns that `kubectl rollout undo` does not update the last-applied annotation; in a GitOps setup you would revert the commit instead.) anyone who can create or change workloads in a namespace can read every Secret in it, use every service account in it, and run any image there. (The second command ran with admin rights to show the result; the attacker's container would simply send the value out.) This is the most common hidden escalation path in Kubernetes. The [RBAC good practices](https://kubernetes.io/docs/concepts/security/rbac-good-practices/) list the others:

- **`list` or `watch` on Secrets** returns their contents, not just their names.
- **`escalate`, `bind` and `impersonate`** let a subject grant itself more.
- **`create` on pods, Deployments, Jobs and other workloads** gives the namespace's Secrets and service accounts (as above), and with a permissive Pod Security level, access to the node.
- **`get` on `nodes/proxy`** reaches the kubelet API, which can run commands in pods.

So treat "can deploy to namespace X" as "has everything in namespace X". Put workloads with different trust levels in different namespaces, keep production deploys in a pipeline that reviews manifests (GitOps), and use admission policies to restrict what a Deployment may contain.

Kubernetes Secrets are also only base64-encoded. Anyone who can read the object reads the value:

```terminal
{
  "title": "base64 is not encryption",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl -n shop get secret postgres -o jsonpath='{.data.password}' | base64 -d; echo",
      "output": "lab-only-change-me"
    }
  ]
}
```

Encrypt Secrets at rest in etcd (managed clusters do this, often with a KMS key), and keep `get`, `list` and `watch` on Secrets to as few subjects as possible.

### Audit Who Has cluster-admin

Bindings accumulate. List every subject bound to `cluster-admin`:

```terminal
{
  "title": "cluster-admin bindings",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl get clusterrolebindings -o json | jq -r '.items[] | select(.roleRef.name == \"cluster-admin\") | .metadata.name + \": \" + ([.subjects[]? | .kind + \"/\" + .name] | join(\", \"))'",
      "output": "cluster-admin: Group/system:masters\nkubeadm:cluster-admins: Group/kubeadm:cluster-admins"
    }
  ]
}
```

On this fresh kind cluster, only the built-in `system:masters` group and kubeadm's admin group have it. Anything else on that list in a real cluster needs an owner and a reason. Tools such as `kubectl who-can` (from the krew plugin index) and `rbac-tool` answer the reverse question: who can do this verb on this resource.

## Pod Security: Least Privilege for Containers

RBAC controls who can call the API; the pod's security context controls what the container can do on the node. The **Pod Security Standards** define three levels (privileged, baseline, restricted), and the built-in **Pod Security Admission** controller enforces them per namespace with a label. `restricted` requires what Part 1's manifests already set: `runAsNonRoot: true`, `allowPrivilegeEscalation: false`, all capabilities dropped (only `NET_BIND_SERVICE` may be added back), a `RuntimeDefault` or `Localhost` seccomp profile, and only safe volume types.

A dry run tells you whether the existing pods would pass, then the label enforces it:

```terminal
{
  "title": "enforce the restricted level",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl label --dry-run=server --overwrite namespace shop pod-security.kubernetes.io/enforce=restricted",
      "output": "namespace/shop labeled (server dry run)"
    },
    {
      "cmd": "kubectl label --overwrite namespace shop pod-security.kubernetes.io/enforce=restricted pod-security.kubernetes.io/warn=restricted",
      "output": "namespace/shop labeled"
    },
    {
      "cmd": "kubectl -n shop run debug --image=postgres:18.6-alpine3.24@sha256:10a5c69a83035ab5239f5620d708520e8b28f5aa1f2b20143e6024532edadfb5 -- sleep 3600",
      "output": "Error from server (Forbidden): pods \"debug\" is forbidden: violates PodSecurity \"restricted:latest\": allowPrivilegeEscalation != false (container \"debug\" must set securityContext.allowPrivilegeEscalation=false), unrestricted capabilities (container \"debug\" must set securityContext.capabilities.drop=[\"ALL\"]), runAsNonRoot != true (pod or container \"debug\" must set securityContext.runAsNonRoot=true), seccompProfile (pod or container \"debug\" must set securityContext.seccompProfile.type to \"RuntimeDefault\" or \"Localhost\")"
    }
  ]
}
```

The dry run printed no warnings, because every pod in `shop` already complies. The quick debug pod is rejected with the exact list of what it is missing. The rejection is the point: a `kubectl run` with default settings is a root container with every default capability, and in a restricted namespace nobody can start one, including someone holding the deployer's token.

The API pods also set `automountServiceAccountToken: false`, because the API never calls the Kubernetes API. Without a token in the pod, a compromised API cannot use RBAC at all:

```terminal
{
  "title": "no token in the API pods",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl -n shop exec deploy/api -- ls /var/run/secrets/kubernetes.io/serviceaccount",
      "output": "ls: /var/run/secrets/kubernetes.io/serviceaccount: No such file or directory\ncommand terminated with exit code 1"
    }
  ]
}
```

Turn the token on only for pods that call the API server, and give each of those its own service account and Role. Cloud workload identity (EKS Pod Identity, IRSA, GKE Workload Identity) uses its own projected token, so it does not need the default one.

## Cloud IAM

Cloud IAM is where least privilege matters most and drifts fastest, because one policy can cover thousands of resources. In AWS, a request is allowed only if some policy allows it and nothing denies it:

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "Request", "sub": "principal, action, resource", "icon": "globe", "tone": "slate" },
    { "label": "Explicit deny?", "sub": "in any policy", "icon": "shield", "tone": "red" },
    { "label": "Org guardrails", "sub": "RCPs, then SCPs allow it?", "icon": "gear", "tone": "violet" },
    { "label": "Allowed?", "sub": "identity or resource policy", "icon": "check", "tone": "blue" },
    { "label": "Within limits?", "sub": "boundary, session policy", "icon": "lock", "tone": "amber" }
  ],
  "branch": [
    { "label": "Allow", "variant": "good" },
    { "label": "Deny (the default)", "variant": "bad" }
  ]
}
```

An explicit `Deny` anywhere wins. Organization guardrails (resource control policies and service control policies) set the maximum for every account in an AWS Organization, permissions boundaries set the maximum for a role, and session policies narrow a session further. None of them grant anything on their own: an identity or resource policy still has to allow the action. Two exceptions are worth knowing: organization policies do not apply to the organization's management account (one more reason to run no workloads there), and a few same-account resource policy grants bypass permissions boundaries and session policies; AWS's [policy evaluation logic](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html) has the details.

### Write Narrow Policies, and Lint Them

The ticket shop API needs to read two secrets and fetch ticket PDFs. A broad policy gets it working in a minute:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:*", "secretsmanager:*"],
      "Resource": "*"
    }
  ]
}
```

That policy can delete every bucket and every secret in the account. The narrow version names the actions and the resources:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadOwnSecrets",
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": [
        "arn:aws:secretsmanager:eu-west-1:111122223333:secret:shop/payment-api-key-??????",
        "arn:aws:secretsmanager:eu-west-1:111122223333:secret:shop/webhook-signing-secret-??????"
      ]
    },
    {
      "Sid": "ReadTicketPdfs",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::shop-tickets-example/tickets/*"
    },
    {
      "Sid": "DecryptTicketPdfsThroughS3",
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "arn:aws:kms:eu-west-1:111122223333:key/1234abcd-12ab-34cd-56ef-1234567890ab",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "s3.eu-west-1.amazonaws.com"
        }
      }
    }
  ]
}
```

IAM policies are JSON, which has no comments: a policy with `//` comments fails to parse. The `-??????` suffix matches the six random characters that Secrets Manager appends to every secret ARN. The ticket bucket uses SSE-KMS with the customer managed key from [Part 2](/guides/security-principles/02-defense-in-depth#h2-data-layer), so reading an object also needs `kms:Decrypt` on that key; the `kms:ViaService` condition allows it only for requests that come through S3, and the key's own key policy must allow the role as well. Policy linters catch the broad version before it reaches an account. [Parliament](https://github.com/duo-labs/parliament) runs offline. Its last release (1.6.4, April 2025) still imports `pkg_resources`, which setuptools deprecated years ago and removed in version 82, so its virtual environment needs an older setuptools. It reads the policy from standard input:

```terminal
{
  "title": "lint both policies",
  "prompt": "$",
  "steps": [
    {
      "cmd": "python3 -m venv ~/venv-iam && ~/venv-iam/bin/pip install -q parliament==1.6.4 'setuptools<82'"
    },
    {
      "cmd": "~/venv-iam/bin/parliament < iam/api-policy-broad.json 2>/dev/null | cut -c1-110",
      "output": "LOW - Unnecessary use of Resource * -  - ['s3:AbortMultipartUpload', 's3:AssociateAccessGrantsIdentityCenter',"
    },
    {
      "cmd": "~/venv-iam/bin/parliament < iam/api-policy-broad.json 2>/dev/null | grep -o \"'[a-z0-9]*:[A-Za-z]*'\" | wc -l",
      "output": "165"
    },
    {
      "cmd": "~/venv-iam/bin/parliament < iam/api-policy.json 2>/dev/null && echo 'no findings'",
      "output": "no findings"
    }
  ]
}
```

The finding (cut to its first 110 characters here) lists the 165 granted actions that could be limited to specific resources but are not, including `s3:DeleteBucket`, `s3:PutBucketPolicy` and `secretsmanager:DeleteSecret`. Parliament rates it only LOW, because it checks patterns rather than intent; the severity matters less than the fact that a reviewer sees the list. The narrow policy has no findings. (`2>/dev/null` hides the deprecation warning about `pkg_resources`.)

With an AWS account, IAM Access Analyzer's policy validation does the same with AWS's own rules, and can run in CI against Terraform plans:

```bash
aws accessanalyzer validate-policy --policy-type IDENTITY_POLICY \
  --policy-document file://iam/api-policy.json
```

More habits that keep cloud permissions narrow:

- **Roles, not users.** Humans sign in through single sign-on (IAM Identity Center) and get temporary role sessions; workloads get roles from their platform. Long-lived access keys are the exception that needs a reason.
- **Conditions narrow further**: `aws:SourceVpce` to require a VPC endpoint, `aws:PrincipalOrgID` on resource policies, `aws:MultiFactorAuthPresent` for sensitive actions.
- **Close the metadata hole.** Require IMDSv2 on every EC2 instance (`HttpTokens=required`), and set it as the account default per Region so new instances get it automatically.
- **Workload identity in Kubernetes.** On EKS, AWS recommends EKS Pod Identity (IRSA still works): each service account maps to its own IAM role, so pods never hold access keys.
- **Guardrails at the top.** Use SCPs and RCPs in AWS Organizations to deny what no account should ever do, such as leaving the organization, disabling CloudTrail, or sharing data outside the organization.

## Temporary and Just-in-Time Access

Standing admin access is the opposite of least privilege: the permission exists 24 hours a day for a task that takes 20 minutes a month. Replace it with access that is requested, approved, short and logged:

```bash
# A one-hour admin session that requires a fresh MFA code
aws sts assume-role \
  --role-arn arn:aws:iam::111122223333:role/ShopProdAdmin \
  --role-session-name ana-incident-4711 \
  --serial-number arn:aws:iam::111122223333:mfa/ana \
  --token-code 123456 \
  --duration-seconds 3600
```

The role's trust policy decides who may assume it, and `aws:MultiFactorAuthPresent` in its conditions enforces MFA. The role's maximum session can be 1 to 12 hours, but a session that assumes another role (role chaining) is limited to one hour. In practice you use a tool that wraps this flow with requests and approvals: IAM Identity Center permission sets with an approval workflow, Microsoft Entra Privileged Identity Management, Google Cloud's Privileged Access Manager, or Teleport access requests, which also cover SSH and Kubernetes. Whatever you use, name sessions after the person and the ticket, as above, so the audit log answers "who did this and why".

## Review and Remove Access

Least privilege is a process, not a configuration. Schedule reviews and use the data the platforms already collect:

```bash
# Every IAM user, their keys and when they were last used
aws iam generate-credential-report
aws iam get-credential-report --query Content --output text | base64 -d

# Which services a role tried to use, and when: start a job, then read its result
aws iam generate-service-last-accessed-details \
  --arn arn:aws:iam::111122223333:role/shop-api
aws iam get-service-last-accessed-details --job-id 98a765b4-3cde-2101-2345-example678f9

# Continuous findings for unused roles, keys and permissions across the account
aws accessanalyzer create-analyzer --analyzer-name unused-access \
  --type ACCOUNT_UNUSED_ACCESS \
  --configuration '{"unusedAccess":{"unusedAccessAge":90}}'
```

The job ID comes from the first command's output. Last-accessed data counts attempts, including denied ones, so a service that appears there was at least tried. Remove what has not been used in 90 days, rotate or delete old access keys, and for Kubernetes, check the `cluster-admin` list above and every RoleBinding in production namespaces. Tie access to joiners, movers and leavers in your identity provider, so leaving the team removes access everywhere at once.

## Common Mistakes

- **Shared identities**: one service account for every app, one database user for every service, one AWS role for the whole pipeline. You can neither narrow them nor tell who did what.
- **Wildcards** in actions (`s3:*`) or resources (`*`) "to get it working", never revisited.
- **The application owns its tables**, so an injection can drop them.
- **Services running as root** on hosts and in containers.
- **Ignoring escalation paths**: workload create rights in a namespace with valuable Secrets, `list` on Secrets, `bind` or `impersonate`.
- **Standing admin access** instead of short, approved sessions.
- **Grants that only grow**: no reviews, no expiry, no last-used data.

## Summary

- Least privilege limits the **blast radius** of every compromise and mistake.
- **Databases**: an owner role that cannot log in, one role per component, column grants, an append-only audit log, and default privileges for future tables.
- **Hosts**: a user per service, root-only secrets handed over with `LoadCredential`, and systemd sandboxing measured with `systemd-analyze security`.
- **Kubernetes**: narrow Roles, the knowledge that workload rights include Secrets, Pod Security `restricted`, and no service account token where it is not needed.
- **Cloud IAM**: named actions and resources, linted policies, roles instead of users, IMDSv2, and guardrails at the organization level.
- **Time**: just-in-time sessions and regular reviews based on last-used data.

## Keep Learning

- Next: [Part 4, Zero Trust Architecture](/guides/security-principles/04-zero-trust), which checks identity on every request instead of trusting the network
- [Broken access control in the OWASP Top 10 guide](/guides/owasp-top-10/01-broken-access-control)
- [Determining Minimum AWS Permissions for Terraform Configurations](/posts/minimum-aws-permissions-for-terraform)
- [hostNetwork Is Still a Footgun: What CVE-2026-32193 Teaches Every Cluster](/posts/hostnetwork-footgun-cve-2026-32193)
- [AWS Security Checklist](/checklists/aws-security) and [Kubernetes Security Checklist](/checklists/kubernetes-security)
- [Flashcards: Pod Security Standards in Kubernetes](/flashcards/pod-security-standards-kubernetes)
- [Interview questions: Cloud IAM basics](/interview-questions/junior/cloud-iam-basics)
