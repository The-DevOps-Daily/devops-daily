---
title: 'Secrets Management Best Practices with HashiCorp Vault'
excerpt: 'Run HashiCorp Vault the way production needs it: auto-unseal, AppRole auth for machines, dynamic database credentials that expire on their own, and encryption as a service. Real config, real terminal output.'
category:
  name: 'Security'
  slug: 'security'
date: '2026-06-22'
publishedAt: '2026-06-22T09:00:00Z'
updatedAt: '2026-06-22T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - vault
  - secrets-management
  - security
  - dynamic-secrets
  - encryption
---

A database password leaks. Maybe it was committed to a private repo three years ago, maybe it sat in a CI log, maybe a contractor copied it into a Slack DM. You do not know, because that password has been valid the entire time and nobody rotated it. Now you are in an incident channel at 2am trying to figure out the blast radius of a credential that every service, every old laptop, and every backup job has used since 2023.

This is the problem HashiCorp Vault solves, and it is not the problem most teams use it for. Most teams install Vault, run it in dev mode, dump a pile of static key-value secrets into it, and call it done. That gives you an encrypted password store with a nicer API. Useful, but it leaves the worst part untouched: secrets that live forever and that no human can fully account for.

The real win with Vault is making secrets short-lived and generated on demand, so a leak has an expiry date measured in hours instead of years. This post shows how to run Vault for that: a production server that survives reboots, machine authentication that does not depend on root tokens, dynamic database credentials, and encryption as a service. Every command here is one you can run.

## TLDR

- Never run `vault server -dev` for anything real. It is in-memory and unsealed, so a restart wipes every secret.
- Use auto-unseal (AWS KMS, GCP KMS, or another Vault) so a reboot does not need five humans with key shares.
- Authenticate machines with **AppRole**, not long-lived root or service tokens.
- Use **dynamic secrets** for databases. Vault creates a unique DB user per request with a short TTL and deletes it when the lease ends.
- Use the **transit engine** for encryption as a service so your apps never touch the encryption keys.
- Write least-privilege policies, turn on the audit log, and revoke leases when something goes wrong.

## Prerequisites

- A Linux host (or VM) where you can install the Vault binary
- Vault 1.15 or newer (`vault version` to check)
- A PostgreSQL database you can point Vault at for the dynamic secrets section
- An AWS account with a KMS key if you want auto-unseal (optional but recommended)
- Basic comfort with the command line and HCL config files

## Stop running Vault in dev mode

Dev mode is the trap. You run one command and get a working Vault:

```bash
vault server -dev
```

```text
==> Vault server configuration:
             Api Address: http://127.0.0.1:8200
                     Cgo: disabled
         Cluster Address: https://127.0.0.1:8201
              Listener 1: tcp (addr: "127.0.0.1:8200", tls: "disabled")
               Log Level: info
                   Mlock: supported: true, enabled: false
           Recovery Mode: false
                 Storage: inmem

WARNING! dev mode is enabled! In this mode, Vault runs entirely in-memory
and starts unsealed with a single unseal key.
```

Read that warning. `Storage: inmem` means every secret lives in RAM and disappears on restart. `tls: disabled` means traffic is plaintext. It starts unsealed, so anyone who reaches port 8200 owns it. Dev mode is for trying commands on your laptop, nothing else.

A production server needs three things dev mode skips: persistent storage, TLS, and a seal. Here is a real `config.hcl` using integrated Raft storage and AWS KMS auto-unseal:

```hcl
# /etc/vault.d/vault.hcl
storage "raft" {
  path    = "/opt/vault/data"
  node_id = "vault-1"
}

listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/opt/vault/tls/vault.crt"
  tls_key_file  = "/opt/vault/tls/vault.key"
}

# Auto-unseal: Vault asks KMS to decrypt its root key on boot.
# No more gathering humans with key shares after every restart.
seal "awskms" {
  region     = "us-east-1"
  kms_key_id = "arn:aws:kms:us-east-1:111122223333:key/abc-12345"
}

api_addr     = "https://vault-1.internal:8200"
cluster_addr = "https://vault-1.internal:8201"
ui           = true
```

Start it and initialize once:

```bash
vault server -config=/etc/vault.d/vault.hcl &

export VAULT_ADDR="https://vault-1.internal:8200"
vault operator init -recovery-shares=5 -recovery-threshold=3
```

```text
Recovery Key 1: vR2k9... (give to a different person than key 2)
Recovery Key 2: 8Lp4m...
Recovery Key 3: qW7nZ...
Recovery Key 4: 3xF8t...
Recovery Key 5: hT1bY...

Initial Root Token: hvs.CAESIJ...

Success! Vault is initialized

Recovery key initialized with 5 key shares and a key threshold of 3.
```

Because of auto-unseal you get **recovery keys** instead of unseal keys. Vault unseals itself on boot using KMS, and the recovery keys are only for emergencies like regenerating the root token. Split them across different people and store them offline. Never keep all of them in one place.

Now use that root token once to set up authentication and policies, then throw it away. Root tokens are for break-glass moments, not daily use.

```bash
vault login hvs.CAESIJ...
```

If you ever see this, your Vault restarted and could not reach its seal:

```text
$ vault kv get secret/payments/stripe
Error making API request.
URL: GET https://vault-1.internal:8200/v1/secret/data/payments/stripe
Code: 503. Errors:
* Vault is sealed
```

A sealed Vault answers nothing. That is the whole point. Auto-unseal exists so this state heals itself instead of paging you.

## Authenticate machines with AppRole, not tokens

A common mistake: generate a long-lived token, paste it into an app's environment, and forget it exists. Now you have the same forever-credential problem one layer up. If that token leaks, it works until someone notices.

For machines, use **AppRole**. The app proves its identity with a `role_id` (think username, not very secret) and a `secret_id` (think password, short-lived and delivered separately), and gets back a token scoped to exactly what it needs.

```bash
vault auth enable approle

# Create a role for the payments service.
vault write auth/approle/role/payments-api \
    token_policies="payments-api" \
    token_ttl=1h \
    token_max_ttl=4h \
    secret_id_ttl=24h \
    secret_id_num_uses=1

# role_id is stable and tied to the role.
vault read auth/approle/role/payments-api/role-id
```

```text
Key        Value
---        -----
role_id    7b1c4e2a-9f3d-4a8e-b6c1-2d5f8e0a1b3c
```

The `secret_id` is the part that needs care. Generate it just before the app starts and hand it over once. With `secret_id_num_uses=1` it works exactly one time, so a leaked `secret_id` in a log is already useless.

```bash
vault write -f auth/approle/role/payments-api/secret-id
```

```text
Key                   Value
---                   -----
secret_id             d8a3...e91f
secret_id_accessor    4c2b...77a0
secret_id_ttl         24h
```

The app logs in with both and gets a short-lived token:

```bash
vault write auth/approle/login \
    role_id="7b1c4e2a-9f3d-4a8e-b6c1-2d5f8e0a1b3c" \
    secret_id="d8a3...e91f"
```

```text
Key                  Value
---                  -----
token                hvs.CAESI...
token_duration       1h
token_renewable      true
token_policies       ["default" "payments-api"]
```

That token dies in an hour unless the app renews it. The pattern that delivers the `secret_id` securely (a sidecar, a cloud instance identity, or Vault Agent) is its own topic, but the rule is simple: the `role_id` can live in config, the `secret_id` should be freshly minted and single-use.

## Dynamic database credentials

This is the feature that changes how you think about secrets. Instead of one shared database password that every service knows, Vault creates a brand new database user for each request, with a short TTL, and deletes it when the lease expires.

Enable the database engine and point it at PostgreSQL:

```bash
vault secrets enable database

vault write database/config/orders-db \
    plugin_name="postgresql-database-plugin" \
    allowed_roles="orders-readonly" \
    connection_url="postgresql://{{username}}:{{password}}@db.internal:5432/orders?sslmode=require" \
    username="vault-admin" \
    password="$ROOT_DB_PASSWORD"
```

The `vault-admin` account is the only static credential, and it is a privileged account Vault uses to create and drop other users. Now define a role that says what a generated user is allowed to do:

```bash
vault write database/roles/orders-readonly \
    db_name="orders-db" \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="1h" \
    max_ttl="24h"
```

Ask for credentials:

```bash
vault read database/creds/orders-readonly
```

```text
Key                Value
---                -----
lease_id           database/creds/orders-readonly/Qm9iY...
lease_duration     1h
lease_renewable    true
password           A1a-9Zx2Kp4Lq7Rt0Vn3
username           v-approle-orders-rea-x7Qd2bN9
```

That `username` did not exist a second ago. Run the command again and you get a different user with a different password. Each service instance, each request if you want, gets its own credentials. When the lease ends, Vault runs the revocation statement and the user is gone from PostgreSQL.

Here is why this matters in numbers. A static password sits valid until a human rotates it, which in practice means months or years. A dynamic credential with a one-hour TTL is useless to an attacker an hour after it leaks.

```chart
{
  "type": "bar",
  "title": "How long a leaked credential stays valid",
  "unit": "hours",
  "caption": "Static password assumes a generous 180-day rotation cycle (4320 hours); most teams rotate far less often. Dynamic creds use the 1h default_ttl from the role above.",
  "rows": [
    { "label": "Static shared password", "value": 4320, "series": "Static" },
    { "label": "Vault dynamic credential", "value": 1, "series": "Dynamic" }
  ],
  "series": [
    { "name": "Static", "color": "#ef4444" },
    { "name": "Dynamic", "color": "#10b981" }
  ]
}
```

The shrink in exposure window is the entire reason to run Vault. If you take one thing from this post, make it this section.

## Encryption as a service with the transit engine

Sometimes you do not want to store a secret, you want to encrypt application data: a customer's tax ID, a token, a column in your database. The wrong move is to ship an AES key to every app and hope nobody loses it. The transit engine keeps the key inside Vault and exposes encrypt and decrypt operations. Your app sends plaintext and gets ciphertext back. It never sees the key.

```bash
vault secrets enable transit
vault write -f transit/keys/orders-pii
```

Encrypt some data (transit takes base64 input):

```bash
vault write transit/encrypt/orders-pii \
    plaintext=$(echo -n "4111-1111-1111-1111" | base64)
```

```text
Key            Value
---            -----
ciphertext     vault:v1:8SDd4HCQ9p7Hf2bxN0kZ...
key_version    1
```

Store `vault:v1:8SDd...` in your database. To read it back:

```bash
vault write transit/decrypt/orders-pii \
    ciphertext="vault:v1:8SDd4HCQ9p7Hf2bxN0kZ..."
```

```text
Key          Value
---          -----
plaintext    NDExMS0xMTExLTExMTEtMTExMQ==
```

Base64-decode that and you are back to the card number. The `v1` prefix is the key version, which means you can rotate the key with `vault write -f transit/keys/orders-pii/rotate` and old ciphertext still decrypts while new writes use the fresh key. No key ever leaves Vault, so an app compromise leaks data the app could already see, not the key that protects all of it.

## Least-privilege policies and the audit log

Tokens are only as safe as the policy attached to them. The `payments-api` policy referenced earlier should grant exactly what the service needs and nothing more:

```hcl
# payments-api.hcl
# Read dynamic DB creds for the orders database.
path "database/creds/orders-readonly" {
  capabilities = ["read"]
}

# Encrypt and decrypt PII, but not manage or export the key.
path "transit/encrypt/orders-pii" {
  capabilities = ["update"]
}
path "transit/decrypt/orders-pii" {
  capabilities = ["update"]
}
```

```bash
vault policy write payments-api payments-api.hcl
```

Notice what is missing. No `database/creds/orders-admin`, no `transit/keys/*` management, no wildcard paths. If the payments token leaks, the attacker can read orders and decrypt PII for an hour, and that is the ceiling. When a request asks for something outside the policy, Vault refuses:

```text
$ vault read database/creds/orders-admin
Error reading database/creds/orders-admin: Error making API request.
URL: GET https://vault-1.internal:8200/v1/database/creds/orders-admin
Code: 403. Errors:
* 1 error occurred:
	* permission denied
```

Turn on the audit log before you put anything real in Vault. It records every request and response (secrets are HMAC'd, not stored in clear) so you can answer "who read this secret and when" during an incident:

```bash
vault audit enable file file_path=/var/log/vault/audit.log
```

And when you do have an incident, dynamic secrets give you a clean kill switch. Revoke every credential a database role ever issued in one command:

```bash
vault lease revoke -prefix database/creds/orders-readonly
```

```text
All revocation operations queued successfully!
```

Every dynamic user that role created gets dropped from the database. Try doing that with a shared password that lives in forty places.

## Where to go next

You now have the shape of a real Vault setup: a sealed, persistent server; AppRole for machines; dynamic database credentials; transit for encryption; tight policies; and an audit trail. The static KV store is still there when you need it, but it should be the exception, not the default.

Concrete next steps:

1. **Replace one static database password with a dynamic role this week.** Pick a low-risk read-only service and cut over. Seeing credentials expire on their own is what makes the model click.
2. **Stand up a 3-node Raft cluster**, not a single server. One Vault node is a single point of failure for every secret you own. Run `vault operator raft list-peers` to confirm the cluster.
3. **Deploy Vault Agent** to handle AppRole login and token renewal so your apps read a rendered file or env var instead of calling the Vault API directly.
4. **Set short TTLs and test revocation.** Run `vault lease revoke -prefix` against a staging role and confirm the users vanish from your database. Know the command works before you need it at 2am.
5. **Ship the audit log to your SIEM** so secret access shows up next to the rest of your security telemetry.

Start with step one. Turning a single forever-password into a one-hour credential is the smallest change that removes the largest class of secret leaks you have.
