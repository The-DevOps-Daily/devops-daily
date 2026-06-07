---
title: 'Shai-Hulud Reaches PyPI: The Hades Wave That Runs Before You Import It'
excerpt: 'The Shai-Hulud worm jumped to PyPI on June 7. The Hades wave hides in 19 Python packages, runs at interpreter startup through a .pth hook before you import anything, and steals your CI/CD secrets.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-07'
publishedAt: '2026-06-07T09:00:00Z'
updatedAt: '2026-06-07T09:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Supply Chain
  - PyPI
  - Python
  - Security
  - Shai-Hulud
  - DevOps
  - CICD
---

On June 7, 2026, the Shai-Hulud worm reached PyPI in a way it had not before. Earlier waves rode npm install hooks and Packagist. This one, which Socket tracks as the "Hades" branch of the Shai-Hulud/Miasma family, hides inside Python wheels and runs the moment your interpreter starts, before you import anything from the package.

That detail matters. Most people picture a malicious package as something that fires when you `import` it, or at worst during a build step you can sandbox. Hades runs through a Python startup hook, so a single `pip install` of a poisoned wheel is enough to execute the payload on the next interpreter start, on your laptop or on a CI runner. Once it runs, it goes after exactly what a build machine tends to hold: GitHub tokens, PyPI and npm publishing tokens, cloud credentials, and SSH keys.

This is the same worm family behind the [PyTorch Lightning incident](/posts/mini-shai-hulud-pytorch-lightning-supply-chain-attack) and the [AntV npm wave](/posts/antv-npm-shai-hulud-wave-may-2026). The tradecraft is familiar, but the Python delivery is new. This post is the practical version: what shipped, how the startup trick works, the indicators to grep for, and the order to rotate secrets if you were exposed.

## TLDR

- New Shai-Hulud wave on PyPI, June 7, 2026, tracked as the "Hades" branch. Socket counted 37 malicious wheels across 19 PyPI packages, plus a parallel npm campaign of 411 artifacts across 106 packages.
- It looks like a single maintainer-account takeover. Consecutive patch releases were mass-published across the author's whole portfolio at once.
- The wheels carry a `.pth` startup hook that runs at interpreter startup, with no import required, then downloads Bun and runs an obfuscated JavaScript stealer.
- It steals GitHub, PyPI, npm, cloud (AWS, GCP, Azure), Kubernetes, and Vault credentials, plus `.env`, `.npmrc`, `.pypirc`, and AI tool configs, then exfiltrates to attacker-created public GitHub repos.
- High-download research packages were hit, including `dynamo-release`, `spateo-release`, `coolbox`, and `ufish`. PyPI quarantined a number of releases, and Socket flagged the cluster minutes after publication.

## Prerequisites

- You install Python packages with `pip`, `uv`, or `poetry`, or your CI does
- You publish to PyPI, or your build runners hold GitHub or cloud credentials
- Basic comfort with the shell and, for the org audit, the GitHub CLI (`gh`)

## What shipped

Socket's analysis puts the PyPI side at 37 malicious wheel artifacts across 19 packages, with 411 artifacts across 106 packages on the npm side of the same campaign, for 448 tracked artifacts in total. The pattern on PyPI was a burst of consecutive patch releases across one author's entire portfolio, which points to a compromised maintainer account rather than 19 separate attacks.

The painful part is that several of the affected packages are real research tools with hundreds of thousands of cumulative downloads:

- `dynamo-release`, a single-cell RNA velocity framework
- `spateo-release`, a spatial transcriptomics toolkit
- `coolbox`, a Jupyter genomic visualization library
- `ufish` and `napari-ufish`, deep-learning FISH spot detection

The full set of 19 compromised PyPI packages:

```text
bramin            cmd2func          coolbox
dynamo-release    executor-engine   executor-http
funcdesc          magique           magique-ai
mrbios            napari-ufish      nucbox
okite             pantheon-agents   pantheon-toolsets
spateo-release    synago            ufish
uprobe
```

If any of these are in your environment, treat the host as compromised and work through the response section below.

## How the Hades wave works

The clever, and genuinely new, part is the trigger. Each malicious wheel ships two files: a startup hook named like `*-setup.pth`, and an obfuscated JavaScript payload named `_index.js`.

### The .pth startup trick

Python's `site` module processes every `.pth` file in your `site-packages` directory at interpreter startup. Normally a `.pth` file just adds directories to the import path. But there is a documented behavior: any line that begins with `import` is executed. Hades abuses exactly that.

```text
# A normal .pth file just lists paths:
../some/extra/path

# Hades ships a line that starts with "import", so Python RUNS it
# every time the interpreter starts, with no package import needed:
import os; exec(<loader that finds and runs _index.js>)
```

This converts a one-time `pip install` into automatic execution on the next `python` invocation. You do not have to import the package. You do not even have to run the project that depends on it. Any Python process on the machine triggers it.

### Bring your own runtime

The Python loader does not assume Node.js or any particular runtime is present. It:

1. Checks for a sentinel file at `<tempdir>/.bun_ran` and exits early if it exists
2. Locates `_index.js` inside the installed package
3. Downloads Bun v1.3.13 from `github.com/oven-sh/bun` if no cached binary is around
4. Runs `bun run _index.js`
5. Writes the sentinel so it does not fire repeatedly

Downloading its own runtime is a Shai-Hulud signature. It means the payload runs the same way whether or not the victim has Node installed, which is why a Python-only shop is not safe just because it has no npm toolchain.

### The stealer

`_index.js` is wrapped in several layers: an `eval` shell with character-code and rotation decoding, AES-128-GCM and AES-256-GCM stages, gzip, custom PBKDF2/SHA256 decoders, and decoy tokens to slow analysis. It also checks the environment, skipping execution under a Russian locale and watching for StepSecurity harden-runner.

Once decoded, it harvests a wide set of secrets:

- GitHub tokens, GitHub Actions runner secrets, and SSH keys
- Publishing tokens for npm, PyPI, RubyGems, JFrog, and CircleCI
- AWS, GCP, Azure, Kubernetes, and HashiCorp Vault credentials
- `.env`, `.npmrc`, `.pypirc`, Docker configs, shell history, and cloud CLI caches
- Claude and MCP configuration files

### Exfiltration

The primary channel is GitHub itself. The payload uses a stolen token to create a public repository via `POST /user/repos`, then commits the encrypted results to paths like `results/results-<timestamp>-<counter>.json`. The campaign markers are blunt:

- Repository description: `Hades - The End for the Damned`
- Commit message marker: `IfYouYankThisTokenItWillNukeTheComputerOfTheOwnerFully`
- On CI, a GitHub Actions artifact named `format-results` and a workflow named `Run Copilot`

There is also traffic to `https://api.anthropic.com/v1/api`. That is Anthropic's real API host, but `/v1/api` is not a real route. Socket assesses it as network-log camouflage, traffic designed to look benign rather than to move data.

### What is new this time

Compared with earlier Shai-Hulud waves, three things stand out:

- **Python-native trigger.** A `.pth` startup hook replaces the npm `preinstall` script. It runs earlier and on a broader set of processes.
- **Hades theming.** The previous Miasma wave used Zelda references. This one uses underworld names like `stygian`, `cerberus`, and `thanatos`, with the `Hades - The End for the Damned` exfil marker.
- **Toolchain persistence.** Recovered artifacts reach into developer tooling: a `gh-token-monitor` daemon with systemd or LaunchAgent persistence, `.claude/setup.mjs` and `.github/setup.js` hooks, an injected `.github/workflows/codeql.yml`, and `~/.local/share/updater/update.py`.

## Are you exposed? What to check

First, check whether any affected package is installed:

```bash
# List installed packages and match against the compromised set
pip list --format=freeze 2>/dev/null | grep -iE \
  '^(bramin|cmd2func|coolbox|dynamo-release|executor-engine|executor-http|funcdesc|magique|magique-ai|mrbios|napari-ufish|nucbox|okite|pantheon-agents|pantheon-toolsets|spateo-release|synago|ufish|uprobe)='
```

Then scan the host for the runtime indicators the loader leaves behind:

```bash
# Sentinel file and the dropped Bun runtime
ls -la "${TMPDIR:-/tmp}/.bun_ran" /tmp/b.zip /tmp/b/bun 2>/dev/null

# The JavaScript payload and the startup hook inside site-packages
find "$(python -c 'import site; print(site.getsitepackages()[0])' 2>/dev/null)" \
  -name '_index.js' -o -name '*-setup.pth' 2>/dev/null

# Any .pth file that executes an import line (the startup trick)
grep -rEl '^import ' $(python -c 'import site; print(" ".join(site.getsitepackages()))' 2>/dev/null) 2>/dev/null
```

If you have a GitHub organization, audit it for the exfiltration markers:

```bash
# Public repos created with the Hades description
gh search repos 'Hades - The End for the Damned' --json fullName,createdAt

# Commits carrying the campaign marker across your org
gh search commits 'IfYouYankThisTokenItWillNukeTheComputerOfTheOwnerFully' --json repository

# Suspicious workflow and artifact names in your repos
# (look for a workflow called "Run Copilot" and artifacts named "format-results")
```

Watch your logs for a `python` process spawning a `bun` binary, outbound requests to `github.com/oven-sh/bun/releases/download/`, and writes to `/tmp/b.zip` or `/tmp/b/bun`.

## If you were hit: respond in this order

Assume any secret reachable from the affected host or runner is burned. Rotate in priority order, highest blast radius first.

1. **GitHub.** Personal access tokens, GitHub App tokens, Actions secrets, and deploy keys. Revoke, do not just rotate, anything the runner could read.
2. **Package publishing.** PyPI, npm, RubyGems, JFrog, and CircleCI tokens. Re-issue with 2FA and scoped permissions.
3. **Cloud and orchestration.** AWS, GCP, Azure, Kubernetes service-account tokens, and Vault tokens. Review CloudTrail or the equivalent for use during the exposure window.
4. **Keys and local config.** SSH keys, Docker credentials, Git credential helpers, and cloud CLI profiles.
5. **AI and developer tools.** Anthropic and Claude or MCP tokens, and anything stored in editor or agent configs.

Then clean the environment:

- Remove the malicious releases and pin to a known-good version, or remove the package entirely
- Rebuild the affected machine or container from a clean image rather than deleting files in place
- Delete the persistence artifacts: `gh-token-monitor`, `.claude/setup.mjs`, `.github/setup.js`, the injected `codeql.yml`, and `~/.local/share/updater/update.py`
- Remove any attacker-created public repos and the `format-results` artifacts from your org

## How to prevent the next one

The mechanism changes each wave, but the defenses are stable:

- **Pin and verify.** Use a lockfile with hashes (`pip install --require-hashes`, `uv.lock`, or `poetry.lock`). Hash pinning stops a surprise patch release from sliding in.
- **Scan for the pattern, not the name.** A new wave will use new package names. Flag wheels that ship an executable `.pth` line, download a runtime or binary, write executables to temp directories, or hand off to a JavaScript payload.
- **Isolate installs.** Run `pip install` for untrusted or first-time dependencies in a sandbox or ephemeral container with no ambient credentials. CI runners should use short-lived, scoped tokens, not long-lived org secrets.
- **Lock down runners.** Tools like StepSecurity harden-runner that egress-filter CI are worth it precisely because this malware checks for them and the payload tries to avoid them.
- **Audit the AI toolchain.** Treat Claude, MCP, IDE, and workflow configs as part of your attack surface now. These campaigns have moved past package hooks into developer tooling, and a poisoned `.github/workflows/` file or agent config persists long after the package is gone.

## Summary

The Hades wave is a reminder that "I only use Python" is not a safe place to stand. Shai-Hulud now ships Python wheels that execute at interpreter startup through a `.pth` hook, pull down their own runtime, and drain whatever credentials a developer or CI machine can see.

The mental model to keep:

- Installation is execution. A `pip install` of a poisoned wheel can run code on the next `python` start, with no import.
- The target is your secrets, especially CI/CD and GitHub tokens, so a hit on one runner can become a hit on your whole supply chain.
- The fix order is rotate, rebuild, and pin, in that order, and then make the next wave easier to catch with hash pinning and isolated installs.

Check your environment with the commands above, rotate anything that was exposed, and pin your dependencies so the next mass patch release cannot walk straight in.
