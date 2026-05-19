---
title: 'AntV npm Compromise: The Shai-Hulud Worm Comes for Your Dashboards (May 19, 2026)'
excerpt: 'A new Shai-Hulud wave landed at 01:56 UTC on May 19 and rode the @antv maintainer account through 323 packages including echarts-for-react. Here is what got published, what it steals, and the lockfile grep that tells you if you are exposed.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-05-19'
publishedAt: '2026-05-19T09:00:00Z'
updatedAt: '2026-05-19T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Supply Chain
  - npm
  - Security
  - DevOps
  - Node.js
  - CI/CD
---

A new wave of the Shai-Hulud worm hit npm at 01:56 UTC on May 19, 2026. This time the carrier was the `atool` maintainer account, which has publish rights across the AntV data-visualization ecosystem and a handful of downstream packages. Inside an hour the attacker pushed malicious versions of `@antv/g2`, `@antv/g6`, `@antv/x6`, `@antv/l7`, `@antv/s2`, `@antv/f2`, `@antv/g`, `@antv/g2plot`, `@antv/graphin`, `@antv/data-set`, plus the chart-glue libraries `echarts-for-react` (1.1M weekly downloads), `timeago.js`, `size-sensor`, and `canvas-nest.js`. Socket counted 639 compromised package versions across 323 unique packages in the burst, and 1,055 versions across 502 packages when you stack it on the broader campaign.

If your stack pulls any of these, even transitively, the payload runs at install time and exfiltrates whatever CI tokens, cloud credentials, and SSH keys the runner can see. This post is the short, practical version: what shipped, what it does, the one-liner grep that tells you if you are exposed, and the order to rotate secrets if you were.

## TLDR

- New Shai-Hulud wave on May 19, 2026. Same worm family as the earlier TanStack and PyTorch Lightning incidents, different namespace and a fresh C2.
- Compromised maintainer: `atool` on npm. AntV namespace plus `echarts-for-react`, `timeago.js`, `size-sensor`, `canvas-nest.js`, packages under `@lint-md/`, `@openclaw-cn/`, and `@starmind/`.
- Trigger: `"preinstall": "bun run index.js"` in the package.json. Runs the moment your CI installs.
- Exfil destination: `t.m-kosche.com:443/api/public/otel/v1/traces` over HTTPS, AES-256-GCM payload with RSA-OAEP key wrapping. Looks like an OpenTelemetry traces submission.
- Targets GitHub tokens, npm tokens, AWS keys, Kubernetes service-account tokens, Vault tokens, SSH keys, Docker auth files, database connection strings.
- Creates a repository under the victim GitHub account named `<dune-word>-<dune-word>-<digits>` (e.g., `sayyadina-stillsuit-852`) and uploads stolen data as `results/results-<timestamp>-<counter>.json`. Marker string in commits: `niagA oG eW ereH :duluH-iahS`.
- If your lockfile mentions any of the named packages with a version published between 01:56 and 02:56 UTC on May 19, treat the host that installed it as compromised and rotate everything in scope.

## Prerequisites

- A Node.js / npm / pnpm / Yarn / Bun project (or a CI pipeline that installs Node packages).
- 5 minutes to grep your lockfiles.
- Access to rotate the credentials in your CI environment (npm tokens, GitHub Actions secrets, cloud IAM keys).

## What changed in this wave

The Shai-Hulud worm has been hitting npm in waves since the late-2025 TanStack incident. The core loop has not changed: compromise a maintainer, publish malicious patch versions with a `preinstall` script, harvest credentials, use the stolen npm tokens to spread to packages the victim maintains. What is new in the May 19 wave:

- **Carrier:** the `atool` account. This account has publish rights across the AntV ecosystem, which means a single account compromise unlocked 10+ heavily-used charting packages plus several React glue libraries. The TanStack wave moved through a single namespace; this one fans out wider.
- **Transport:** the worm now ships a `bun run index.js` preinstall script. Bun executes faster than Node and tolerates more permissive parsing, so the payload runs cleanly on Bun-installing runners (which is most modern Node CI). The earlier waves used `node` or `npm run`. If your CI has Bun preinstalled (the default on a lot of GitHub Actions images now), it executes without a separate runtime install step.
- **Crypto:** payload upgraded from raw HTTPS POSTs to AES-256-GCM body with RSA-OAEP wrapping. The traffic now blends into OpenTelemetry trace submissions to `t.m-kosche.com`, which dodges the simple `egress to known-bad domain` SOC rules unless you also fingerprint the request shape.
- **Persistence:** the worm creates a public repository under the victim's GitHub account, with a Dune-themed naming pattern, and stores exfiltrated data as a JSON file in `results/`. This is a backup channel in case the direct HTTPS exfil is blocked, and it is a public-internet-readable copy of your stolen secrets until you find and delete the repo.

The post-install behavior is otherwise the well-documented Shai-Hulud set: walk the file system for `.env`, `.npmrc`, `~/.aws/credentials`, `~/.docker/config.json`, `~/.kube/config`, SSH private keys, then walk environment variables for the usual CI tokens, then attempt to publish modified versions of any packages the stolen npm token can publish.

## The 60-second check: are you exposed

Run this in every repo. It grep across all the common lockfile formats:

```bash
grep -rE "(@antv/|echarts-for-react|\"timeago\.js\"|\"size-sensor\"|\"canvas-nest\.js\"|@lint-md/|@openclaw-cn/|@starmind/)" \
  --include="package.json" \
  --include="package-lock.json" \
  --include="pnpm-lock.yaml" \
  --include="bun.lock" \
  --include="yarn.lock" \
  -l
```

Zero matches: you are clear. Direct deps, transitive deps, and dev deps are all covered because they all end up resolved into the lockfile.

If you do hit a match, dig one level deeper to find the resolved version:

```bash
# For npm / pnpm / Bun lockfiles
grep -A2 -E "(@antv/|echarts-for-react)" package-lock.json pnpm-lock.yaml bun.lock 2>/dev/null

# For Yarn classic
grep -A2 -E "(@antv/|echarts-for-react)" yarn.lock
```

Any version published between **2026-05-19 01:56 UTC and 02:56 UTC** is the malicious window. Older versions are clean. Versions published after Socket and npm pulled the malicious ones (early May 19) are also clean. If you installed during the window, assume compromise.

## If you were exposed: rotation order

The worm runs as the CI user, so the credentials it reaches are everything the CI runner had access to. Rotate in this order. The order matters because some tokens can re-grant access to others.

1. **npm publish tokens** first. If any package you maintain was on the CI runner's auth, the worm has already tried to use it. Rotate via `npm token revoke` and re-issue, then audit `npm token list` for unknown tokens.
2. **GitHub Actions `GITHUB_TOKEN` and personal access tokens.** Revoke at `github.com/settings/tokens`. If the worker created a public repo under your account, find and delete it (search your repos for names matching `<dune>-<dune>-<digits>` or the marker string `niagA oG eW ereH :duluH-iahS`).
3. **Cloud IAM keys** — AWS, GCP, Azure. The worm reads `~/.aws/credentials`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. Rotate via the cloud console; do not just edit the env var.
4. **Kubernetes service-account tokens.** If the runner had a `KUBECONFIG`, that token can pull secrets from the cluster. Rotate the service account.
5. **Vault tokens.** `VAULT_TOKEN` is in the targeted list. Revoke the token and audit the audit log for its recent use.
6. **SSH keys.** The worm copies `~/.ssh/id_*` private keys. Rotate any key the CI runner had access to (deploy keys, signing keys).
7. **Anything in `.env` files on disk.** If they were on the runner, they are gone. Rotate every credential listed.

After rotation, audit GitHub for new repos under your org, npm for new versions on packages you own, and cloud logs for unusual API calls from unknown IPs in the past 24 hours.

## Indicators of compromise to feed your SOC

Network egress to either of these is a red flag for the May 19 wave:

```text
t.m-kosche.com                 (primary C2, HTTPS port 443)
fulcio.sigstore.dev            (secondary endpoint, abuses sigstore)
rekor.sigstore.dev             (secondary endpoint, abuses sigstore)
```

The sigstore endpoints are legitimate services, which makes pure-domain alerting noisy. Pair the egress alert with the source: if a CI runner that normally does not touch sigstore suddenly POSTs there during a Node install, that is the pattern.

File-system markers on a runner that ran the payload:

```text
~/.cache/npm/_logs/                    (preinstall script left logs here)
/tmp/results-<timestamp>-<counter>.json  (staged exfil before HTTPS POST)
```

GitHub-side markers on the victim account:

```text
A new public repo named <dune-word>-<dune-word>-<digits>
  e.g. sayyadina-stillsuit-852, paul-fremen-1213, gurney-crysknife-49
Commit body containing: niagA oG eW ereH :duluH-iahS
File path: results/results-<timestamp>-<counter>.json
```

The Dune reference is the worm author's signature across waves. The reversed string decodes to `Shai-Hulud: Here We Go Again`. It is consistent enough that you can search your org-wide GitHub event log for it.

## Preventing the next wave

This is the third Shai-Hulud wave in roughly six months. There is going to be a fourth. Defenses that actually move the needle:

- **Pin npm dependencies with `--save-exact`** and resolve transitives through a single lockfile per repo. Caret-pinning (`^1.2.3`) is what gets you auto-installed into the malicious window. Exact pins force a human to bump.
- **Disable `preinstall` and `postinstall` scripts in CI** with `npm config set ignore-scripts true` (or `--ignore-scripts` on the install command, or `enableScripts: false` in `.yarnrc.yml`). This breaks some legitimate packages that need a native build step, but those are usually a known short list you can opt back in for. The default should be off.
- **Run installs in an ephemeral runner with no production credentials in env.** GitHub Actions composite jobs make this practical: one job does `npm ci --ignore-scripts` against a hermetic cache, the next stage does the build, only the deploy stage has the real secrets. If a malicious preinstall fires, it sees nothing worth exfiltrating.
- **Egress allowlist on CI runners.** The default GitHub Actions runner can talk to the entire internet. An egress allowlist of registry.npmjs.org, github.com, your registry, and your deploy targets kills almost every supply-chain payload. Tools like Sysdig's egress policies, Step Security's harden-runner action, or a simple iptables rule in your self-hosted runner image all do this.
- **npm token scoping.** Use `--scope` and granular permissions. A token that can only publish `@your-org/foo` cannot be used by a worm to publish `@your-org/bar`. Audit `npm token list` regularly and prune.
- **Watch for new repos under your org and your maintainer accounts.** A Shai-Hulud-style worm cannot hide the repo it creates. A simple cron that diffs `gh repo list` against a known list will catch it within an hour.

## Summary

A new Shai-Hulud wave landed on npm at 01:56 UTC on May 19, 2026 through the compromised `atool` maintainer account. It published malicious patch versions of the entire AntV data-viz namespace plus `echarts-for-react`, `timeago.js`, `size-sensor`, `canvas-nest.js`, and a handful of `@lint-md`, `@openclaw-cn`, `@starmind` packages. The payload runs at install time via a `bun run index.js` preinstall hook, harvests cloud and CI credentials, exfiltrates them to `t.m-kosche.com` disguised as OpenTelemetry traces, and creates a public GitHub repo to stash a backup copy.

Run the grep above against every lockfile in your stack right now. If you have a match in the malicious window, rotate npm publish tokens first, then GitHub tokens, then cloud IAM, then service-account tokens, then SSH keys. After that, harden CI with `--ignore-scripts`, exact pins, and an egress allowlist so the next wave does not get the same easy ride.

## Source

Socket's running disclosure: [`socket.dev/blog/antv-packages-compromised`](https://socket.dev/blog/antv-packages-compromised). The page is updated as the investigation continues.
