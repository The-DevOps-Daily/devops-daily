---
title: "node-ipc DNS-Tunneling Supply Chain Attack: Your Egress Firewall Probably Missed This"
excerpt: "On May 14, 2026, three malicious versions of the node-ipc npm package shipped a payload that hunts AWS, SSH, kubeconfig, and GitHub CLI credentials, then smuggles them out through DNS TXT queries. Most orgs filter HTTPS egress. Almost nobody filters DNS. Here is what the payload does and how to close the gap."
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-05-22'
publishedAt: '2026-05-22T20:30:00Z'
updatedAt: '2026-05-22T20:30:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: true
tags:
  - Supply Chain
  - Security
  - npm
  - DevOps
  - CICD
  - DNS
---

On May 14, 2026, three new versions of `node-ipc` showed up on the npm registry within minutes of each other: `9.1.6`, `9.2.3`, and `12.0.1`. All three carried an identical 80 KB obfuscated payload injected into the package's CommonJS bundle. Inside that payload was a credential stealer that hunts more than 100 categories of sensitive files and then exfiltrates the spoils through **DNS TXT queries**, not HTTP.

That last detail is the part this post is about. Almost every supply chain post-mortem in the last twelve months ends with the same advice: pin your lockfiles, enable provenance, block outbound traffic to known-bad domains. All good advice. None of it catches an attacker who hides the stolen data inside DNS resolution traffic that your CI runners and developer laptops were going to make anyway.

node-ipc has roughly 822K weekly downloads and is a transitive dependency of a long list of CLI tools and frameworks. If your stack pulls it, even four levels deep, the install-time payload runs as whatever user ran `npm install`, with whatever cloud, SSH, and Kubernetes credentials that user has access to.

This post is the practical version: what the payload does, why DNS exfil works on most networks, the egress filtering you can ship in an afternoon, and the order to rotate if you ran any of the bad versions.

## TL;DR

- Three malicious node-ipc versions: `9.1.6`, `9.2.3`, `12.0.1`, published 2026-05-14. Identical 80 KB payload in each.
- Targets: AWS / GCP / Azure tokens, SSH private keys, kubeconfig, `.env` files, GitHub CLI tokens, Anthropic and OpenAI keys, Bitwarden vaults, and around 90 other credential categories.
- Exfil: payload chunks the stolen data, encrypts it, and embeds the ciphertext in DNS TXT lookups to attacker-controlled domains. Every developer machine and CI runner can resolve DNS by default, so the traffic blends in.
- Likely vector: maintainer account compromise on npm. The repo on GitHub was clean during the window the bad packages were live.
- If you ran a bad version, treat every secret reachable from that machine as burned and rotate in this order: GitHub tokens, cloud STS sessions, long-lived cloud keys, SSH keys, kubeconfig, app secrets.
- Hardening: lock CI runners and developer laptops to a small DNS allowlist (your resolver + your DoH provider), log DNS queries, and alert on TXT queries to non-allowlisted domains. None of this needs new tooling.

## Prerequisites

- Familiarity with `npm install` and lockfile semantics.
- A network where you control the egress path for at least one set of machines (CI runners are the highest-value target).
- `dig`, `tcpdump`, or your cloud's DNS query logs to verify what the actual baseline of outbound DNS looks like.

## What the payload actually does

When a project pulls a bad node-ipc version, the malicious CommonJS bundle runs as part of the package's normal entrypoint. Three things happen, in order.

**1. File harvest.** The payload walks `$HOME`, the working directory, and a handful of well-known config paths looking for credential files. The list includes obvious targets (`~/.aws/credentials`, `~/.config/gcloud/application_default_credentials.json`, `~/.azure/`, `~/.ssh/id_*`, `~/.kube/config`) plus a long tail of the things that have leaked in previous Shai-Hulud waves (`~/.config/gh/hosts.yml`, `~/.npmrc`, `~/.pypirc`, `.env`, `.env.local`, `~/.config/Code/User/settings.json` for VS Code Anthropic keys). It also picks up Bitwarden CLI vault paths, Anthropic / OpenAI / Mistral keys from their canonical locations, and the Cursor / Continue.dev config directories.

**2. Encryption and chunking.** The harvested blob is encrypted with a key derived from a hardcoded attacker public key (so only they can read it), then base32-encoded and split into chunks small enough to fit inside a DNS label. DNS labels are capped at 63 characters each and the full FQDN at 253 characters, which constrains how much you can stuff into one query. The payload uses sequence prefixes (`c00-`, `c01-`, ...) so the attacker's authoritative server can reassemble.

**3. Exfil via DNS TXT lookups.** For each chunk, the payload issues a DNS TXT query for `<chunk>.<sequence>.<victim-id>.<attacker-domain>`. The OS resolver dutifully forwards the query upstream. Eventually it hits the attacker's authoritative name server, which logs the query, returns a junk TXT answer, and now has another piece of your `~/.aws/credentials`.

The clever bit is the resolver hop. The payload itself never opens a socket to the attacker. The OS resolver does, on its behalf, to whatever DNS forwarder you have configured. If your CI runner can resolve `npmjs.com` to install packages in the first place, it can also resolve `<stolen-credentials>.<attacker-domain>` without anything looking obviously wrong.

## Why most egress controls miss this

Pretty much every "secure your CI" post you have read goes something like: lock down outbound HTTPS to a small allowlist of registries (`registry.npmjs.org`, your container registry, GitHub) and block everything else. That is a real control. Most network egress filtering at this layer is implemented via a HTTP CONNECT proxy, an AWS Network Firewall rule, or a Cilium L7 policy.

DNS sits underneath all of that. Before any HTTPS connection happens, the runner asks the OS resolver for an A or AAAA record. The OS resolver forwards to whatever was set in `/etc/resolv.conf`, usually a cloud-provided resolver (AWS at `169.254.169.253` from within a VPC, or Google at `169.254.169.254` for GCE). The resolver chases the query out to authoritative servers on the public internet. By the time the runner's HTTP-egress firewall sees the connection, the DNS query has already happened, and any TXT lookups the payload made along the way are already logged on the attacker's name server.

So:

- An L7 HTTPS allowlist does not block this. The exfil never makes an HTTPS connection.
- A blanket "block all outbound except 443 to allowlisted domains" rule does not block this. UDP/53 (or TCP/53) to the cloud-provided resolver is needed for *any* DNS to work, including the legitimate `registry.npmjs.org` resolution that your build needs.
- Even DoH or DoT to your own resolver does not block this if the resolver itself is happy to forward arbitrary public queries.

The control you actually need is at the **resolver** layer: an allowlist of domains the resolver is willing to answer for, with everything else returning NXDOMAIN. Or, less drastically, query logging plus an alert on patterns that look like exfil.

## Detection: spotting exfil in your DNS logs

If you have DNS query logging enabled on your CI runners or developer laptops, this is what to look for.

**Long, high-entropy labels.** A legitimate query is `registry.npmjs.org`. An exfil query is `mfqxezlj4qcaij2gmiyc4t3oojxw4y3vnu3wcljom5wsa2ltnbxxmzlroruxg4dpobxw4u3jonxw2zlu.c07.victim42.evilcorp.net`. The first label is base32 binary, very long, and uniformly distributed across the alphabet. That is the signal.

A starter detection on AWS Route 53 Resolver query logs in Athena:

```sql
SELECT
  query_timestamp,
  srcaddr,
  query_name,
  query_type,
  length(query_name) AS qlen
FROM route53_resolver_query_logs
WHERE query_type = 'TXT'
  AND query_timestamp >= current_date - interval '1' day
  AND length(query_name) > 80
  AND regexp_like(split_part(query_name, '.', 1), '^[a-z2-7]{50,}$')
ORDER BY query_timestamp DESC;
```

That regex matches a 50-plus-character base32 label, which is the signature of chunked binary in the first label. A normal `dig +short A ...` query never produces a label that long.

On the runner itself, the same idea with `tcpdump`:

```bash
sudo tcpdump -i any -nn -s 0 -A 'udp port 53' 2>/dev/null \
  | grep -oE '[a-z2-7]{50,}\.[^ ]+' \
  | sort -u
```

Leave that running for a baseline build and see what shows up. If anything other than the occasional long ARN-like label appears, dig deeper.

**Volume of TXT queries.** Most builds make a handful of A/AAAA queries and effectively zero TXT queries. A build that produces hundreds of TXT queries to the same parent domain is the loud version of the same signal.

```sql
SELECT
  regexp_extract(query_name, '\.([^.]+\.[^.]+)$', 1) AS parent_domain,
  count(*) AS txt_queries
FROM route53_resolver_query_logs
WHERE query_type = 'TXT'
  AND query_timestamp >= current_timestamp - interval '1' hour
GROUP BY 1
HAVING count(*) > 50
ORDER BY 2 DESC;
```

50 TXT queries per hour to a single parent domain is well above baseline for normal traffic. Tune the threshold once you have a week of baseline data.

## Prevention: a small DNS allowlist for CI

The strongest control is to give your CI runners a resolver that only answers for domains you want to resolve. Everything else gets NXDOMAIN, and the exfil dies at the resolver.

A minimal CoreDNS config that allowlists npm, GitHub, your container registry, and your cloud provider:

```text
# /etc/coredns/Corefile
. {
    template ANY ANY . {
        rcode NXDOMAIN
    }
}

registry.npmjs.org github.com codeload.github.com objects.githubusercontent.com {
    forward . 1.1.1.1 8.8.8.8
    cache 30
    log
}

.ecr.us-east-1.amazonaws.com .s3.us-east-1.amazonaws.com .sts.amazonaws.com {
    forward . 169.254.169.253
    cache 30
    log
}
```

Point your CI runner's `/etc/resolv.conf` at this CoreDNS instance instead of the cloud-provided one. Now an `npm install` of a clean package works. An `npm install` that pulls a bad node-ipc still runs the install hook, but every TXT query the payload issues comes back NXDOMAIN, and your CoreDNS log has the full record of which domain the payload tried to reach.

Two caveats:

1. **The allowlist is real work.** You have to enumerate every domain your builds legitimately query. Expect surprises: the AWS SDK queries STS endpoints by region, GitHub Actions queries a different set of CDN domains depending on what's being downloaded, Docker queries authentication endpoints by image registry. Spend a day in audit-only mode (log everything, NXDOMAIN nothing) before you flip the switch.
2. **DoH inside the runtime breaks this.** If your application or a build tool resolves DNS through DoH directly to `1.1.1.1`, your CoreDNS allowlist never sees the query. Block outbound TCP/443 to known public DoH endpoints (`1.1.1.1`, `8.8.8.8`, `9.9.9.9`, `1.0.0.1`) from runners as a backstop.

For developer laptops the equivalent is your endpoint protection or DNS-filtering provider (Cloudflare Gateway, NextDNS, Pi-hole on your home network). The Cloudflare Gateway policy is one line:

```text
Action: Block
DNS query type matches: TXT
DNS domain matches regex: ^[a-z2-7]{50,}\.
```

That blocks the exact label shape this payload generates without breaking any legitimate query.

## If you ran a bad version

The rotation order matters because some tokens can sign other tokens. Do this top-to-bottom on the affected machine and on anything that machine logged into in the last week.

1. **GitHub tokens.** `gh auth logout`, then go to https://github.com/settings/tokens and revoke every PAT. Reissue with the minimum scope you actually need. Revoking GH tokens first prevents the attacker from pushing malicious commits to your repos using stolen credentials.
2. **Cloud STS sessions.** Force-expire all active sessions: AWS `aws sts get-caller-identity` to find the role, then revoke session via console or `aws iam put-user-policy` denying everything. GCP `gcloud auth revoke --all`. Azure `az logout && az account clear`.
3. **Long-lived cloud keys.** Rotate AWS access keys, GCP service-account JSON keys, Azure SP credentials. Yes, even if you "only had the keys for testing".
4. **SSH keys.** Reissue keypairs. Remove the public key of the compromised machine from every `authorized_keys` it landed on, including GitHub, GitLab, your jump host, and any cloud VM you SSH'd into.
5. **Kubeconfig.** Rotate the cluster CA-signed certs for the user. For EKS / GKE / AKS this is "remove the IAM principal from `aws-auth` and re-add", "remove the GCP IAM binding and re-add", "remove the Azure RBAC role assignment and re-add" respectively.
6. **App secrets.** Anything in `.env` that the payload read: API keys, database passwords, Stripe keys, Sentry DSNs, observability tokens. Rotate the lot.
7. **AI tool keys.** Anthropic, OpenAI, Mistral, Cursor, Continue.dev. These were explicit targets in this payload.

While you're rotating, also run a `git log --since="2026-05-14" --author=<your-email>` on every repo you have push access to. The attacker's first move with a stolen GH token is usually a commit to a repo you maintain, either as a worm-propagation step or as the next pivot. If anything in that log looks unfamiliar, force-push the previous good HEAD and rotate the token before the new one runs the worm again.

## Why this matters beyond node-ipc

The node-ipc payload is the third major npm credential stealer this month. TanStack on May 11, AntV / `echarts-for-react` on May 19, node-ipc on May 14, plus the broader Shai-Hulud campaign behind a chunk of these. All three of those campaigns used HTTP POST to attacker domains for exfil. node-ipc is the first one I have seen in the wild use DNS at scale, and the technique works because the average DevOps egress story stops at HTTPS.

If you only take one thing from this post, it's that **DNS is a control plane your firewall does not look at**. Treat it like one. Log it, allowlist it on the high-value machines (CI runners, anything with cloud admin creds, build servers), and put the same kind of alert on weird DNS patterns that you already have on weird HTTPS patterns. Most teams have spent the last six months adding lockfile pinning and provenance verification. That's necessary. It is not sufficient. The attackers have already moved one layer down.

## Summary

The May 14 node-ipc compromise is small in absolute numbers (three versions, 822K weekly downloads), but big in what it demonstrates. A credential stealer that exfils via DNS TXT queries bypasses the HTTPS egress controls almost every team relies on. The defense is a resolver-layer allowlist, query logging with alerting on high-entropy labels, and treating DNS as part of your egress posture instead of an invisible service that just works.

If you ran any of `node-ipc@9.1.6`, `node-ipc@9.2.3`, or `node-ipc@12.0.1` between May 14 and now, treat the machine as compromised and walk the rotation list above. Then add a DNS allowlist to your CI runners before the next wave teaches everyone the same lesson the hard way.
