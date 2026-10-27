---
title: 'The CIA Triad: Confidentiality, Integrity and Availability'
description: 'The CIA triad with examples: secrets leaking through process lists and Git history, forged commit authors, checksums, probes, zone spread and rate limits.'
order: 1
---

**TLDR**: The CIA triad names the three things security protects: **confidentiality** (only the right people can read data), **integrity** (nobody can change data or code without it being noticed) and **availability** (the service works when people need it). Classify your data on all three first, because the classification decides which controls you need. In this part you see each property fail on a real system and fix it: a secret visible to every user in the process list, a secret that stays in Git history after you delete it, a commit with a forged author, a tampered download, a deployment that loses traffic, a liveness probe that would restart healthy pods, and a login endpoint without a rate limit.

Every security control answers one question: what are you protecting, and from what? The CIA triad gives you the vocabulary for the first half. A firewall rule protects confidentiality, a signed commit protects integrity, and a second replica protects availability. When you can name the property a control protects, you can also tell when a control is missing, or when two controls pull in different directions.

This part uses the ticket shop from the [Threat Modeling guide](/guides/threat-modeling/01-stride#h2-the-example-system-a-ticket-shop): customers buy tickets through an API, a payment provider sends signed webhooks, a worker issues the tickets, and Postgres stores users, orders and tickets. The rest of this guide builds on the same system.

## Prerequisites

- A Debian or Ubuntu machine where you can use `sudo`, ideally a throwaway VM, with the companion repository cloned to `~/security-principles-demo` as shown in the [overview](/guides/security-principles#h2-prerequisites). The outputs come from Ubuntu 26.04 LTS (nginx 1.28, Git 2.55, Python 3.14).
- For the Git secret scan: [gitleaks](https://github.com/gitleaks/gitleaks/releases) 8.30 or newer on your `PATH`.
- For the availability section: Docker, [kind](https://kind.sigs.k8s.io/docs/user/quick-start/) 0.33 and kubectl 1.37.
- The [companion repository](https://github.com/The-DevOps-Daily/guide-security-principles-demo-2026-10-27) has every file from this part. Its GitHub Actions workflow runs every command shown here, and the outputs in this part come from those runs.

## What the CIA Triad Means

US federal law ([44 U.S.C. 3552](https://www.law.cornell.edu/uscode/text/44/3552)), which NIST's FIPS 199 uses, defines the three properties like this:

| Property            | Definition (short form)                                                                           | The question you ask                         | What a failure looks like                                          |
| ------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| **Confidentiality** | Authorized restrictions on access and disclosure, including protection of personal privacy        | Who can read this, and should they?          | Leaked customer emails, an API key in a public repository          |
| **Integrity**       | Guarding against improper modification or destruction, including authenticity and non-repudiation | Can someone change this without us noticing? | A changed price in an order, a backdoored release, a forged commit |
| **Availability**    | Timely and reliable access to and use of information                                              | Does it work when people need it?            | Checkout down during a ticket sale, a deleted backup               |

Two details in those definitions matter in practice:

- **Integrity includes authenticity.** Knowing that data did not change is not enough; you also need to know who produced it. A checksum gives you the first, a signature gives you both.
- **Availability is a security property.** An attacker who stops your ticket sale for an hour has done real damage without reading or changing a single row. Ransomware attacks availability first.

The triad maps directly onto the STRIDE threat categories: information disclosure breaks confidentiality, tampering and spoofing break integrity, and denial of service breaks availability. Repudiation (denying an action) is why integrity includes non-repudiation, which in practice means audit logs that the actor cannot edit.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "c", "label": "Confidentiality", "sub": "who can read", "icon": "lock", "tone": "blue", "detail": "Controls: access control, encryption, secret storage, data minimisation." },
      { "id": "i", "label": "Integrity", "sub": "who can change", "icon": "shield", "tone": "green", "detail": "Controls: hashes, signatures, access control, audit logs, database constraints." },
      { "id": "a", "label": "Availability", "sub": "does it work", "icon": "activity", "tone": "amber", "detail": "Controls: redundancy, health checks, rate limits, backups you have restored." }
    ],
    [
      { "id": "id", "label": "Info disclosure", "sub": "STRIDE: I", "icon": "globe", "tone": "red", "detail": "Customer emails, password hashes or API keys reach someone who should not see them." },
      { "id": "tm", "label": "Tampering, spoofing", "sub": "STRIDE: T, S, R", "icon": "branch", "tone": "red", "detail": "A changed order total, a forged webhook, a commit under someone else's name." },
      { "id": "dos", "label": "Denial of service", "sub": "STRIDE: D", "icon": "server", "tone": "red", "detail": "Login floods, a crashed database, ransomware that encrypts the only backup." }
    ]
  ],
  "edges": [
    ["c", "id", "broken by"],
    ["i", "tm", "broken by"],
    ["a", "dos", "broken by"]
  ]
}
```

## Classify the Data First

You cannot protect everything equally, and you should not try. Rate each kind of data on all three properties, then spend your effort where the rating is high. For the ticket shop:

| Data                             | Confidentiality | Integrity | Availability | Why                                                                         |
| -------------------------------- | --------------- | --------- | ------------ | --------------------------------------------------------------------------- |
| Payment provider API key         | High            | High      | Medium       | Anyone with it can issue refunds; without it nobody can pay                 |
| Password hashes, customer emails | High            | High      | Medium       | Personal data with legal duties; a changed email hijacks an account         |
| Orders and tickets (QR secrets)  | Medium          | High      | High         | A forged ticket gets someone in for free; lost orders mean angry customers  |
| Event listings and prices        | Low (public)    | High      | High         | Public anyway, but a changed price costs money, and the shop must be up     |
| Application logs                 | Medium          | Medium    | Low          | Can contain personal data and tokens; nobody pays for them during an outage |

A few patterns show up in almost every system:

- **Secrets and credentials** rate high for confidentiality and integrity: they grant access, so a leaked or swapped secret can be as bad as a stolen database.
- **Public data still needs integrity.** Nobody minds that the price list is readable; everybody minds if someone can edit it.
- **Logs are a common leak.** Teams treat them as low-value, so they often get weak access control, and they end up holding emails, tokens and session IDs.

The rating also tells you which way to fail. If the database is down, the ticket shop should stop selling (fail closed) rather than sell tickets it cannot record. A public status page should do the opposite and keep showing the last known state.

## Confidentiality

Confidentiality fails through over-broad access (a bucket or a dashboard that is public by mistake), weak or reused credentials, unencrypted traffic, and secrets that end up somewhere you did not intend: command lines, logs, Git history, container images and CI output. The first three are covered elsewhere on this site; this section shows the last group, because it catches careful teams too.

**Encryption** protects data that someone can read but should not understand: a stolen disk, an intercepted connection, a backup in the wrong bucket. It moves the problem to the key, so the rule is to encrypt by default and keep the keys in a key management service. The [Cryptography Essentials guide](/guides/cryptography-essentials/01-encryption) shows how to choose algorithms and manage keys, and the [TLS part](/guides/cryptography-essentials/03-tls-ssl) covers data in transit.

**Access control** decides who can read data in the first place. On Linux that starts with file permissions; [Part 3](/guides/security-principles/03-least-privilege) covers users, permissions, database roles, Kubernetes RBAC and cloud IAM.

### Secrets in Command Lines Are Public

The payment provider's API key is the most valuable secret in the ticket shop. A common way to call an API from a script is to put the key in a header on the command line. On Linux, every local user can read every process's command line through `/proc`, so the key is visible to anyone on the machine while the command runs.

The Linux examples in this guide need a few packages, installed first. To see the leak, start a local listener that never answers (so the request stays open), then call it the usual way. The `nobody` user plays another local account:

```terminal
{
  "title": "lab packages",
  "prompt": "$",
  "steps": [
    {
      "cmd": "sudo apt-get update -q && sudo apt-get install -y -q git curl jq nginx netcat-openbsd openssh-server python3-venv >/dev/null"
    }
  ]
}
```

```terminal
{
  "title": "a secret on the command line",
  "prompt": "$",
  "steps": [
    {
      "cmd": "nc -lk 127.0.0.1 8099 >/dev/null & listener=$!"
    },
    {
      "cmd": "export PAYMENT_API_KEY='pay_live_Hq8Zt3Lw9Xr2Vb6Nc1Kd'"
    },
    {
      "cmd": "curl -s -m 5 -H \"Authorization: Bearer $PAYMENT_API_KEY\" http://127.0.0.1:8099/charges &"
    },
    {
      "cmd": "sleep 1; sudo -u nobody ps -o user=,args= -C curl",
      "output": "dev      curl -s -m 5 -H Authorization: Bearer pay_live_Hq8Zt3Lw9Xr2Vb6Nc1Kd http://127.0.0.1:8099/charges"
    },
    {
      "cmd": "sudo -u nobody cat /proc/$!/environ",
      "output": "cat: /proc/3346/environ: Permission denied"
    }
  ]
}
```

The key appears in full in the process list, readable by `nobody`. Process environments are better protected: only the same user and root can read `/proc/<pid>/environ`, which is why `cat` fails with "Permission denied". Command lines also end up in `ps` output pasted into tickets and in audit logs that record `execve` arguments. Shell history stores what you typed before expansion, so here it holds the `export` line with the literal key, not the expanded header.

Pass the secret on standard input or in a file instead. curl reads extra headers from a file with `-H @file`, and `@-` means standard input:

```terminal
{
  "title": "the same call, key on stdin",
  "prompt": "$",
  "steps": [
    {
      "cmd": "wait $!"
    },
    {
      "cmd": "curl -s -m 5 -H @- http://127.0.0.1:8099/charges <<<\"Authorization: Bearer $PAYMENT_API_KEY\" &"
    },
    {
      "cmd": "sleep 1; sudo -u nobody ps -o user=,args= -C curl",
      "output": "dev      curl -s -m 5 -H @- http://127.0.0.1:8099/charges"
    },
    {
      "cmd": "wait $!; kill $listener"
    }
  ]
}
```

`wait $!` waits for the earlier curl, which gives up after 5 seconds with exit code 28 (timeout) because the listener never replies. Now the process list shows `-H @-` and nothing else. The same rule applies to every tool: prefer `--password-stdin` (Docker, Helm), `--from-file` or `--env-file` options, and files with mode `0600` over arguments.

### Secrets in Git Stay in Git

The second classic leak is a `.env` file committed by mistake. Deleting it in a later commit does not remove it: every earlier commit still contains it, and so does every clone and fork.

```terminal
{
  "title": "a deleted secret is still in history",
  "prompt": "$",
  "steps": [
    {
      "cmd": "git config --global user.name 'Dev' && git config --global user.email dev@example.com && git config --global init.defaultBranch main"
    },
    {
      "cmd": "git init -q ~/shop-config && cd ~/shop-config"
    },
    {
      "cmd": "printf 'PAYMENT_API_KEY=%s\\n' \"$PAYMENT_API_KEY\" > .env && git add .env && git commit -q -m 'Add local settings'"
    },
    {
      "cmd": "git rm -q .env && git commit -q -m 'Remove secrets'"
    },
    {
      "cmd": "git log --oneline --stat",
      "output": "a2ce7f9 Remove secrets\n .env | 1 -\n 1 file changed, 1 deletion(-)\n9849ad6 Add local settings\n .env | 1 +\n 1 file changed, 1 insertion(+)"
    },
    {
      "cmd": "git show HEAD~1:.env",
      "output": "PAYMENT_API_KEY=pay_live_Hq8Zt3Lw9Xr2Vb6Nc1Kd"
    },
    {
      "cmd": "gitleaks git --no-banner --redact -v .",
      "output": "Finding:     PAYMENT_API_KEY=REDACTED\nSecret:      REDACTED\nRuleID:      generic-api-key\nEntropy:     4.789015\nFile:        .env\nLine:        1\nCommit:      9849ad602626a2979085d5458b895e6c317f2cc1\nAuthor:      Dev\nEmail:       dev@example.com\nDate:        2026-10-27T17:45:04Z\nFingerprint: 9849ad602626a2979085d5458b895e6c317f2cc1:.env:generic-api-key:1\n\n5:45PM INF 1 commits scanned.\n5:45PM INF scanned ~46 bytes (46 bytes) in 87.6ms\n5:45PM WRN leaks found: 1"
    }
  ]
}
```

`git show` prints the key from the earlier commit, and gitleaks finds it in history even though the working tree is clean. gitleaks exits with code 1 when it finds a leak, which makes it easy to use as a pre-commit hook or a CI gate.

Once a secret has been pushed, treat it as compromised: **rotate it first**, at the provider, and only then clean the history if you need to (with `git filter-repo`). Rewriting history does not reach clones, forks, CI caches or anyone who already pulled. To stop the next leak earlier, keep `.env` in `.gitignore`, run a scanner before each commit, and turn on push protection if your Git host has it.

### Where Secrets Should Live

A secret should exist in one place that has access control and an audit log, and reach the application at run time:

- **A secrets manager**: AWS Secrets Manager, Google Secret Manager, Azure Key Vault, HashiCorp Vault or its open-source fork OpenBao. The application or its platform fetches the secret with its own identity, so nobody copies it around.
- **Encrypted files in Git** with [SOPS](/guides/cryptography-essentials/01-encryption#h2-keeping-secrets-in-git-with-sops) when you want secrets reviewed and versioned with the code.
- **Kubernetes Secrets** are only base64-encoded, not encrypted. They are fine as the last step (the External Secrets Operator or the Secrets Store CSI driver can fill them from a secrets manager), provided that you encrypt etcd at rest and limit who can read them. [Part 3](/guides/security-principles/03-least-privilege) shows how far `get secrets` reaches.

The [Secrets Management guide post](/posts/secrets-management-guide) compares the managers, and [You Cannot Rotate a Secret You Cannot Find](/posts/you-cannot-rotate-a-secret-you-cannot-find) covers finding the ones you already have.

## Integrity

Integrity fails when someone changes data, code or configuration and nobody notices: a changed price in an order request, a backdoored release binary, a forged commit, a container image replaced under the same tag, or a webhook that pretends to come from the payment provider. Integrity controls work in two ways: they **prevent** changes (access control, append-only storage, database constraints) or they **detect** them (hashes, signatures, audit logs).

### Detect Changes with Hashes

A cryptographic hash such as SHA-256 is a fingerprint of a file. Store it, recompute it later, and any change shows:

```terminal
{
  "title": "a checksum catches a changed file",
  "prompt": "$",
  "steps": [
    {
      "cmd": "mkdir -p ~/release && cd ~/release"
    },
    {
      "cmd": "printf 'print(\"ticket shop api 1.4.0\")\\n' > app.py && tar -czf shop-api-1.4.0.tar.gz app.py"
    },
    {
      "cmd": "sha256sum shop-api-1.4.0.tar.gz | tee SHA256SUMS",
      "output": "5acebbf589057b84d8d3aa81ff6ec90400063e6b29a84b1e37c1d56f5d343a07  shop-api-1.4.0.tar.gz"
    },
    {
      "cmd": "sha256sum -c SHA256SUMS",
      "output": "shop-api-1.4.0.tar.gz: OK"
    },
    {
      "cmd": "printf 'x' >> shop-api-1.4.0.tar.gz"
    },
    {
      "cmd": "sha256sum -c SHA256SUMS",
      "output": "shop-api-1.4.0.tar.gz: FAILED\nsha256sum: WARNING: 1 computed checksum did NOT match"
    }
  ]
}
```

A checksum only proves that the file matches the checksum. If an attacker can replace the file on your download server, they can usually replace `SHA256SUMS` next to it. To prove **who** published a file you need a signature, made with a private key the attacker does not have. The [hashing part of the Cryptography Essentials guide](/guides/cryptography-essentials/02-hashing#h2-verifying-downloads-checksums-versus-signatures) verifies real releases with GPG and Sigstore.

### Anyone Can Write Any Author Name

Git records whatever name and email the committer configured. Nothing checks them:

```terminal
{
  "title": "a commit under someone else's name",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd ~/shop-config && git -c user.name='Release Bot' -c user.email=release-bot@example.com commit -q --allow-empty -m 'Bump payment SDK'"
    },
    {
      "cmd": "git log --format='%h %an <%ae> signature:%G? %s'",
      "output": "31408ba Release Bot <release-bot@example.com> signature:N Bump payment SDK\na2ce7f9 Dev <dev@example.com> signature:N Remove secrets\n9849ad6 Dev <dev@example.com> signature:N Add local settings"
    }
  ]
}
```

The `%G?` field prints `N` for "no signature" on every commit, including the one that claims to come from the release bot. A signature changes the question from "what name was typed" to "which key signed this": with signing configured, `%G?` shows `G` for a good signature from a key in your allowed signers file, and Git hosts mark a commit as verified when the signing key belongs to the committer's account. It still does not prove that the person named as author wrote the change, so check the signer, not the author field. Signing with an SSH key takes four `git config` lines, shown with real output in the [PKI part of the Cryptography Essentials guide](/guides/cryptography-essentials/04-pki#h3-signed-git-commits-with-an-ssh-key). Then make it count: require signed commits on protected branches, and require review, so one stolen laptop key cannot push straight to `main`.

### Pin What You Deploy

A container tag such as `python:3.14-alpine` is a pointer that the publisher (or an attacker with registry access) can move to a different image at any time. A digest is the hash of the image manifest and cannot move:

```terminal
{
  "title": "a tag points to a digest",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker buildx imagetools inspect python:3.14.7-alpine3.24 | sed -n 1,3p",
      "output": "Name:      docker.io/library/python:3.14.7-alpine3.24\nMediaType: application/vnd.oci.image.index.v1+json\nDigest:    sha256:9e9fde4d32eedce0b661d9ab91e826b62dddf28e928c230ec55f1866cac66b01"
    }
  ]
}
```

The manifests in this guide reference images as `tag@sha256:digest`. The tag stays for humans; the runtime pulls by digest. Update digests with a bot such as Renovate or Dependabot, so pinning does not mean never patching. Signed images go one step further: the [PKI part](/guides/cryptography-essentials/04-pki#h3-signed-container-images-with-sigstore) of the cryptography guide verifies one.

### Integrity in the Data Itself

The same idea applies inside the application:

- **Never trust values the client can change.** The ticket shop computes order totals on the server from the price list, not from the request.
- **Verify every webhook** with the provider's signature (an HMAC over the body with a shared secret) before acting on it. The [HMAC section](/guides/cryptography-essentials/02-hashing#h2-hmac-authenticating-messages) shows how.
- **Let the database enforce rules**: foreign keys, `CHECK` constraints, unique ticket codes.
- **Keep an audit log the application can append to but not change.** In [Part 3](/guides/security-principles/03-least-privilege#h2-database-roles), the API's database role can `INSERT` into the audit table and do nothing else with it, so even a compromised API cannot rewrite history.

## Availability

Availability fails through single points of failure, overload (from attackers or from your own popularity), bad deploys, and data loss. The controls are redundancy, health checks that make the platform route around failures, limits that keep one client from starving the others, and backups that you have actually restored.

### Remove Single Points of Failure

Run more than one copy of everything that serves users, and make sure the copies cannot all fail together. In Kubernetes that means three things: several replicas, a spread across failure domains (nodes and zones), and a PodDisruptionBudget so that maintenance never takes too many down at once.

Create a local cluster with three worker nodes, labelled as three zones:

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: shop
nodes:
  - role: control-plane
  - role: worker
    labels:
      topology.kubernetes.io/zone: zone-a
  - role: worker
    labels:
      topology.kubernetes.io/zone: zone-b
  - role: worker
    labels:
      topology.kubernetes.io/zone: zone-c
```

```terminal
{
  "title": "a three-zone lab cluster",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd ~/security-principles-demo/part01"
    },
    {
      "cmd": "kind create cluster --config kind.yaml --quiet"
    },
    {
      "cmd": "kubectl wait --for=condition=Ready nodes --all --timeout=180s >/dev/null"
    },
    {
      "cmd": "kubectl get nodes -L topology.kubernetes.io/zone",
      "output": "NAME                 STATUS   ROLES           AGE   VERSION   ZONE\nshop-control-plane   Ready    control-plane   29s   v1.37.0\nshop-worker          Ready    <none>          14s   v1.37.0   zone-a\nshop-worker2         Ready    <none>          13s   v1.37.0   zone-b\nshop-worker3         Ready    <none>          13s   v1.37.0   zone-c"
    },
    {
      "cmd": "kubectl create namespace shop",
      "output": "namespace/shop created"
    },
    {
      "cmd": "kubectl apply -f postgres.yaml -f worker.yaml",
      "output": "secret/postgres created\nserviceaccount/postgres created\ndeployment.apps/postgres created\nservice/postgres created\nserviceaccount/worker created\ndeployment.apps/worker created"
    }
  ]
}
```

The [`postgres.yaml`](https://github.com/The-DevOps-Daily/guide-security-principles-demo-2026-10-27/blob/main/part01/postgres.yaml) and [`worker.yaml`](https://github.com/The-DevOps-Daily/guide-security-principles-demo-2026-10-27/blob/main/part01/worker.yaml) files in the companion repository run a lab Postgres (no persistent storage) and a stand-in for the worker. The API is a small Python stand-in for the real application. Its two health endpoints are the important part:

```python
"""Stand-in for the ticket shop API: just enough HTTP to show probes and policies."""

import os
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DB = (os.environ.get('DB_HOST', 'postgres'), int(os.environ.get('DB_PORT', '5432')))


def database_reachable():
    try:
        with socket.create_connection(DB, timeout=1):
            return True
    except OSError:
        return False


class Handler(BaseHTTPRequestHandler):
    def reply(self, code, text):
        body = (text + '\n').encode()
        self.send_response(code)
        self.send_header('Content-Type', 'text/plain')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/healthz':  # liveness: can this process still answer at all?
            self.reply(200, 'ok')
        elif self.path == '/readyz':  # readiness: can it serve real requests right now?
            if database_reachable():
                self.reply(200, 'ready')
            else:
                self.reply(503, 'database unreachable')
        else:
            self.reply(200, f'api {socket.gethostname()}: {self.command} {self.path}')

    do_POST = do_GET

    def log_message(self, *args):
        pass


ThreadingHTTPServer(('', 8080), Handler).serve_forever()
```

A first attempt at the Deployment, with a mistake that is common in copied examples: the pod template has no labels.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: shop
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    spec:
      containers:
        - name: api
          image: python:3.14.7-alpine3.24@sha256:9e9fde4d32eedce0b661d9ab91e826b62dddf28e928c230ec55f1866cac66b01
          command: ['python3', '/app/server.py']
```

```terminal
{
  "title": "the API server rejects it",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl -n shop create configmap api-code --from-file=server.py",
      "output": "configmap/api-code created"
    },
    {
      "cmd": "kubectl apply -f api-broken.yaml",
      "output": "The Deployment \"api\" is invalid: spec.template.metadata.labels: Invalid value: null: `selector` does not match template `labels`"
    }
  ]
}
```

The selector is how a Deployment finds its pods, so pods without the label would never be counted, and the API server refuses the object. The working version adds the labels, the probes, a spread across zones, a dedicated service account and the security settings that [Part 3](/guides/security-principles/03-least-privilege) explains:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: api
  namespace: shop
automountServiceAccountToken: false
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: shop
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      serviceAccountName: api
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: api
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        runAsGroup: 10001
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: api
          image: python:3.14.7-alpine3.24@sha256:9e9fde4d32eedce0b661d9ab91e826b62dddf28e928c230ec55f1866cac66b01
          command: ['python3', '/app/server.py']
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /readyz
              port: 8080
            periodSeconds: 5
            failureThreshold: 2
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 10
            failureThreshold: 3
          resources:
            requests:
              cpu: 50m
              memory: 32Mi
            limits:
              memory: 64Mi
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ['ALL']
          volumeMounts:
            - name: code
              mountPath: /app
              readOnly: true
      volumes:
        - name: code
          configMap:
            name: api-code
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: shop
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 8080
```

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api
  namespace: shop
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: api
```

```terminal
{
  "title": "three replicas in three zones",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f api.yaml -f pdb.yaml",
      "output": "serviceaccount/api created\ndeployment.apps/api created\nservice/api created\npoddisruptionbudget.policy/api created"
    },
    {
      "cmd": "kubectl -n shop rollout status deployment/api --timeout=180s",
      "output": "Waiting for deployment \"api\" rollout to finish: 0 of 3 updated replicas are available...\nWaiting for deployment \"api\" rollout to finish: 1 of 3 updated replicas are available...\nWaiting for deployment \"api\" rollout to finish: 2 of 3 updated replicas are available...\ndeployment \"api\" successfully rolled out"
    },
    {
      "cmd": "kubectl -n shop get pods -l app=api -o custom-columns=POD:.metadata.name,NODE:.spec.nodeName,READY:.status.containerStatuses[0].ready",
      "output": "POD                    NODE           READY\napi-864c4bd569-9mxjb   shop-worker3   true\napi-864c4bd569-j8nhd   shop-worker2   true\napi-864c4bd569-xmvzs   shop-worker    true"
    },
    {
      "cmd": "kubectl -n shop get pdb api",
      "output": "NAME   MIN AVAILABLE   MAX UNAVAILABLE   ALLOWED DISRUPTIONS   AGE\napi    2               N/A               1                     10s"
    }
  ]
}
```

Each pod runs on a different node in a different zone, so losing a whole zone leaves two replicas. The PodDisruptionBudget allows one voluntary disruption at a time: `kubectl drain` during node maintenance evicts one API pod, and waits with the next eviction until a replacement is ready. A budget does not protect against involuntary failures such as a node crash; that is what the spread is for.

Three replicas is a common minimum because it survives one failure while another pod is down for a rolling update. In a managed cloud cluster, the zone label is set for you and the same `topologySpreadConstraints` spread pods across real availability zones.

### Liveness and Readiness Probes Do Different Jobs

Health checks let Kubernetes route around failures automatically, but the two main probes answer different questions, and mixing them up causes outages:

- **Readiness**: should this pod receive traffic right now? A failing readiness probe removes the pod from the Service's endpoints. It is restarted only if something else fails.
- **Liveness**: is this process broken in a way that only a restart fixes, such as a deadlock? A failing liveness probe kills and restarts the container.
- **Startup** (not used here): for slow-starting applications, it holds off the other two probes until the first success.

The API's `/readyz` checks the database; `/healthz` checks only that the process can answer. Watch what happens when the database disappears:

```terminal
{
  "title": "the database goes away",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl -n shop scale deployment/postgres --replicas=0",
      "output": "deployment.apps/postgres scaled"
    },
    {
      "cmd": "kubectl -n shop wait --for=condition=Ready=false pod -l app=api --timeout=90s",
      "output": "pod/api-864c4bd569-9mxjb condition met\npod/api-864c4bd569-j8nhd condition met\npod/api-864c4bd569-xmvzs condition met"
    },
    {
      "cmd": "kubectl -n shop get pods -l app=api",
      "output": "NAME                   READY   STATUS    RESTARTS   AGE\napi-864c4bd569-9mxjb   0/1     Running   0          20s\napi-864c4bd569-j8nhd   0/1     Running   0          20s\napi-864c4bd569-xmvzs   0/1     Running   0          20s"
    },
    {
      "cmd": "kubectl -n shop get endpointslices -l kubernetes.io/service-name=api -o custom-columns=NAME:.metadata.name,READY:.endpoints[*].conditions.ready",
      "output": "NAME        READY\napi-2p96z   false,false,false"
    },
    {
      "cmd": "kubectl -n shop scale deployment/postgres --replicas=1 && kubectl -n shop wait --for=condition=Ready pod -l app=api --timeout=180s",
      "output": "deployment.apps/postgres scaled\npod/api-864c4bd569-9mxjb condition met\npod/api-864c4bd569-j8nhd condition met\npod/api-864c4bd569-xmvzs condition met"
    }
  ]
}
```

All three pods went to `0/1` and the Service stopped sending them traffic, but the restart count stayed at 0. When the database came back, they became ready again without a restart. If `/healthz` had also checked the database, Kubernetes would have restarted every API pod during the outage, which fixes nothing and adds a restart storm to an incident. The [Kubernetes documentation on probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/) draws the same line: the liveness probe passes when the app itself is healthy, and the readiness probe additionally checks that each required back-end service is available. It also warns that wrong liveness probes can cause cascading failures.

### Limit What One Client Can Use

A login endpoint without a limit lets one client try thousands of passwords per minute (an integrity and confidentiality problem) and lets a flood of requests starve everyone else (an availability problem). nginx limits the request rate per client address with `limit_req`:

```nginx
# 5 login attempts per minute per client address; up to 3 extra are allowed in a burst.
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
limit_req_status 429;

# Stand-in for the application behind nginx
server {
    listen 127.0.0.1:8082;
    return 200 "login handled\n";
}

server {
    listen 127.0.0.1:8081;

    location = /login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://127.0.0.1:8082;
    }
}
```

```terminal
{
  "title": "eight login attempts in a row",
  "prompt": "$",
  "steps": [
    {
      "cmd": "sudo cp ~/security-principles-demo/part01/shop-ratelimit.conf /etc/nginx/conf.d/ && sudo nginx -t",
      "output": "nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful"
    },
    {
      "cmd": "sudo systemctl restart nginx"
    },
    {
      "cmd": "for i in $(seq 1 8); do curl -s -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:8081/login; done; echo",
      "output": "200 200 200 200 429 429 429 429"
    }
  ]
}
```

The first request plus the burst of three got through; the next four got `429 Too Many Requests` immediately. One trap when you test this: nginx runs `return` before `limit_req`, so a location that only answers with `return 200` is never limited. The limit applies to locations that pass requests on (`proxy_pass`) or serve files, which is why the stand-in application above sits in its own `server` block. Put the same kind of limit on every expensive or sensitive endpoint (sign-in, password reset, checkout), and add a per-account limit in the application, because attackers spread requests across many addresses. The [rate limiting post](/posts/designing-rate-limiting-for-apis) compares the algorithms.

A rate limit on your own server does not stop a large distributed denial-of-service (DDoS) attack: the traffic fills your network link before nginx sees it. For that you need capacity in front of you, from a CDN or the DDoS protection of your cloud provider (Cloudflare, AWS Shield, Google Cloud Armor and similar), which absorb the flood at the edge.

### Backups That Survive the Incident

Backups protect availability (and integrity) against data loss, but only if they survive the event that destroys the data. Ransomware operators look for backups first, and a backup job that runs `aws s3 sync --delete` copies a deletion or an encryption straight into the backup.

The classic **3-2-1 rule** says: 3 copies of the data, on 2 kinds of storage, with 1 copy off site. Veeam extended it to **3-2-1-1-0**: one more copy that is offline, air-gapped or immutable, and zero errors in regular restore tests. CISA's [#StopRansomware Guide](https://www.cisa.gov/sites/default/files/2025-03/StopRansomware-Guide%20508.pdf) asks for the same things in plain words: offline, encrypted backups of critical data, tested regularly.

On AWS, S3 Object Lock gives you the immutable copy. It works only on versioned buckets, and once it is on you cannot turn it off. In compliance mode nobody, including the account's root user, can delete or overwrite a locked object version before its retention date; AWS documents deleting the whole account as the only way out. That is the point for backups, and also a reason to test with short retention first:

```bash
# Creating the bucket with Object Lock also turns on versioning
aws s3api create-bucket --bucket shop-db-backups-example --region eu-west-1 \
  --create-bucket-configuration LocationConstraint=eu-west-1 \
  --object-lock-enabled-for-bucket

# Every new object version is locked for 30 days
aws s3api put-object-lock-configuration --bucket shop-db-backups-example \
  --object-lock-configuration '{"ObjectLockEnabled":"Enabled","Rule":{"DefaultRetention":{"Mode":"COMPLIANCE","Days":30}}}'
```

Write backups from a role that can put objects but not delete them, keep a copy in a separate account, and restore one on a schedule into a scratch database and run a query against it. A backup you have never restored is a hope, not a control.

## Balancing the Three

The properties pull against each other, and most design decisions are trade-offs:

| Decision                              | Helps                                 | Costs                                                   |
| ------------------------------------- | ------------------------------------- | ------------------------------------------------------- |
| Require MFA for every admin action    | Confidentiality, integrity            | Availability for admins when the MFA provider is down   |
| Fail closed when the database is down | Integrity (no unrecorded sales)       | Availability (no sales at all)                          |
| Encrypt everything with a KMS key     | Confidentiality                       | Availability depends on the KMS and on the key policy   |
| Keep 90 days of detailed logs         | Integrity (investigations), detection | Confidentiality (logs hold personal data), cost         |
| Cache pages at a CDN                  | Availability                          | Confidentiality, if a private page is cached by mistake |

For each system, decide in advance and write it down: what data it handles, the impact of losing each property, who needs access, and how long it may be down. Those answers become your controls, and they are also what an auditor will ask for.

## Common Mistakes

- **Treating availability as "the operations team's problem".** Deleted backups and login floods are security incidents.
- **Secrets in arguments, logs and history.** Use stdin, files and secret stores, and scan repositories and CI logs.
- **Deleting a leaked secret instead of rotating it.** Once pushed, it is public; rotate first.
- **Trusting checksums from the same place as the download.** Verify signatures.
- **Liveness probes that check dependencies.** They restart healthy pods during someone else's outage.
- **Backups the attacker can delete.** Use immutable storage, a separate account, and restore tests.

## Summary

- **Confidentiality, integrity and availability** are the three properties every control protects; integrity includes authenticity.
- **Classify data** on all three before choosing controls, and decide in advance whether each component fails open or closed.
- **Keep secrets off command lines and out of Git**, and treat any pushed secret as compromised.
- **Hashes detect changes, signatures prove who made them**; signed commits show which key committed, and digests stop moved tags.
- **Spread replicas across zones, protect them with a PodDisruptionBudget,** and keep liveness probes local to the process.
- **Rate-limit sensitive endpoints**, and keep immutable backups you have restored.

## Keep Learning

- Next: [Part 2, Defense in Depth](/guides/security-principles/02-defense-in-depth), where one attack meets several independent layers
- [Cryptography Essentials](/guides/cryptography-essentials), for the encryption, hashing and signing behind confidentiality and integrity
- [STRIDE in the Threat Modeling guide](/guides/threat-modeling/01-stride), which finds threats against each property
- [Secrets Management Guide: Vault, AWS Secrets Manager, and Azure Key Vault](/posts/secrets-management-guide)
- [Designing Rate Limiting for APIs](/posts/designing-rate-limiting-for-apis)
- [High Availability Checklist](/checklists/high-availability)
- [Interview questions: secrets management](/interview-questions/mid/secrets-management)
