---
title: 'The Axios Supply Chain Attack: What DevOps Teams Need to Know'
excerpt: 'A compromised npm maintainer account led to malicious axios versions deploying a RAT across macOS, Windows, and Linux. Here is what happened, how to check if you are affected, and how to prevent this in your pipeline.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-03-31'
publishedAt: '2026-03-31T09:00:00Z'
updatedAt: '2026-03-31T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'Bobby Iliev'
  slug: 'bobby-iliev'
featured: true
tags:
  - security
  - supply-chain
  - npm
  - nodejs
  - devops
  - cicd
---

If you run anything in the JavaScript ecosystem, pay attention. On March 31, 2026, attackers compromised the npm account of a lead axios maintainer and published two backdoored versions that deploy a remote access trojan. Axios is downloaded somewhere between 100 and 300 million times per week, making this one of the most impactful supply chain attacks in npm history.

Here is what happened, how to check if your systems are affected, and what to change in your pipelines so you are not the next victim.

## TLDR

| Detail | Info |
|--------|------|
| Affected versions | `axios@1.14.1` and `axios@0.30.4` |
| Safe versions | `axios@1.14.0` and `axios@0.30.3` |
| Malicious dependency | `plain-crypto-js@4.2.1` |
| C2 server | `sfrclak.com:8000` |
| Platforms targeted | macOS, Windows, Linux |
| Window of exposure | Starting 2026-03-31T00:21:58Z |

## What Happened

An attacker gained access to the npm credentials of an axios maintainer. They changed the account email to an anonymous ProtonMail address and published two versions manually, completely bypassing the project's GitHub Actions CI/CD pipeline. Neither `1.14.1` nor `0.30.4` has a corresponding GitHub tag or release. They were ghost releases, pushed directly to the npm registry.

The timing was deliberate. The malicious dependency `plain-crypto-js@4.2.1` was staged on npm roughly 18 hours before the axios versions went live. Both release branches (v1.x and v0.x) were compromised within 39 minutes of each other. This was not a rushed, opportunistic attack. Somebody planned this.

## How the Malware Works

The axios package code itself looks clean. The attack hides in the dependency tree.

Both malicious axios versions add `plain-crypto-js` as a dependency. That package has nothing to do with cryptography. Its only purpose is to run a `postinstall` script that:

1. Detects your operating system (macOS, Windows, or Linux)
2. Downloads a platform-specific payload from a command-and-control server
3. Executes the payload
4. Deletes itself and overwrites its own `package.json` with a clean stub

After the payload runs, inspecting `node_modules/plain-crypto-js` shows nothing suspicious. The malware erased its own tracks.

The payload itself is a remote access trojan (RAT) that gives the attacker persistent access to the compromised machine.

## Are You Affected?

Run these checks immediately.

### Check your lockfiles

```bash
# Check for the malicious versions
grep -r "axios@1.14.1\|axios@0.30.4\|plain-crypto-js" package-lock.json yarn.lock pnpm-lock.yaml 2>/dev/null
```

If you get any matches, your project pulled in the compromised version.

### Check node_modules directly

```bash
# Check installed version
cat node_modules/axios/package.json | grep version

# Check for the malicious dependency
ls node_modules/plain-crypto-js 2>/dev/null && echo "FOUND - you may be compromised"
```

### Check network logs

Search your network monitoring for any outbound connections to `sfrclak.com`. If you find them, assume the machine is compromised.

### Check CI/CD build logs

Look at any builds that ran after March 31, 2026 00:21 UTC. If those builds ran `npm install` without a lockfile or with a lockfile that resolved to `latest`, they may have pulled the malicious version.

## How to Fix It

### Immediate steps

```bash
# Pin to safe versions
npm install axios@1.14.0

# Or if you were on the 0.x branch
npm install axios@0.30.3

# Remove the malicious dependency if present
rm -rf node_modules/plain-crypto-js

# Clean install
rm -rf node_modules
npm install
```

### Rotate everything

If you find any evidence of the compromised versions in your environment, treat the machine as compromised and rotate:

- npm tokens
- API keys and secrets
- SSH keys
- Cloud provider credentials (AWS, GCP, Azure)
- Database passwords
- CI/CD tokens (GitHub, GitLab, etc.)
- Any other credentials that were accessible on the affected system

This is not optional. The RAT had access to everything the compromised process could reach.

### Redeploy

Rebuild and redeploy all affected services from a clean environment.

## How to Prevent This in Your Pipeline

This attack exploited two weaknesses: compromised credentials and the default behavior of npm's dependency resolution. Here is how to protect your pipeline.

### 1. Always use lockfiles

```bash
# In CI, use ci instead of install
npm ci

# This reads from the lockfile exactly, never resolving "latest"
```

If your lockfile pinned `axios@1.14.0`, running `npm ci` would never pull `1.14.1`. The attack only worked on installs that resolved to the latest version.

### 2. Disable postinstall scripts in CI

```bash
# Add to your CI pipeline
npm ci --ignore-scripts

# Then run only the scripts you actually need
npm run build
```

The malware relied entirely on a `postinstall` script. Disabling scripts blocks this attack vector completely.

### 3. Enable npm audit in CI

```bash
# Add to your pipeline
npm audit --audit-level=high

# Fail the build if vulnerabilities are found
npm audit --audit-level=high || exit 1
```

### 4. Pin dependencies explicitly

In your `package.json`, use exact versions instead of ranges:

```json
{
  "dependencies": {
    "axios": "1.14.0"
  }
}
```

Not `^1.14.0` (which resolves to the latest minor), not `~1.14.0` (which resolves to the latest patch). Exact versions only for critical dependencies.

### 5. Use a dependency scanning tool

Tools like [Socket](https://socket.dev/), [Snyk](https://snyk.io/), or [npm audit signatures](https://docs.npmjs.com/about-registry-signatures) can catch malicious packages before they reach your build environment. Socket's automated detection flagged `plain-crypto-js` within minutes of publication.

### 6. Enable 2FA on your npm account

If you maintain any npm packages, enable two-factor authentication. The attacker got in because the maintainer's credentials were compromised without a second factor blocking the login.

```bash
npm profile enable-2fa auth-and-writes
```

The `auth-and-writes` level requires 2FA for both login and publishing. This is the setting that would have prevented this attack.

## The Bigger Problem

This is not the first supply chain attack on npm and it will not be the last. The JavaScript ecosystem's dependency model means a single compromised package can cascade into millions of installations within hours.

As Andrej Karpathy [pointed out](https://x.com/karpathy), he had axios as a transitive dependency through a Google Workspace CLI tool. His installed version happened to resolve to an unaffected `1.13.5`, but the dependency was not pinned. A few hours later and it would have pulled the malicious version automatically.

The defaults do not protect you. `npm install` resolves to `latest`. Most `package.json` files use caret ranges. Most CI pipelines run `npm install` instead of `npm ci`. Most developers do not audit their dependency tree regularly.

Every one of those defaults worked in the attacker's favor.

## Key Takeaways

1. **Check now.** Search your lockfiles for `axios@1.14.1`, `axios@0.30.4`, or `plain-crypto-js`. Do it before you finish reading this.
2. **Use `npm ci` in CI.** Always. It reads the lockfile exactly and never resolves to latest.
3. **Disable postinstall scripts in CI.** The `--ignore-scripts` flag blocks the most common malware delivery mechanism in npm.
4. **Pin critical dependencies.** Use exact versions for packages that touch networking, auth, or crypto.
5. **Enable 2FA on npm.** If you publish packages, `auth-and-writes` is the only setting that matters.
6. **Run dependency scanning.** Socket, Snyk, or even `npm audit` catch known malicious packages automatically.

Supply chain security is not somebody else's problem. If your application has a `node_modules` directory, it is your problem.

*Sources: [Socket](https://socket.dev/blog/axios-npm-package-compromised), [StepSecurity](https://www.stepsecurity.io/blog/axios-compromised-on-npm-malicious-versions-drop-remote-access-trojan), [Aikido](https://www.aikido.dev/blog/axios-npm-compromised-maintainer-hijacked-rat), [The Hacker News](https://thehackernews.com/2026/03/axios-supply-chain-attack-pushes-cross.html)*
