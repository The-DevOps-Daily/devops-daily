---
title: 'Mini Shai-Hulud: PyTorch Lightning Just Stole Your CI Secrets'
excerpt: 'On April 30 a supply chain worm pushed malicious versions of PyTorch Lightning (10M+ downloads/month), intercom-client, and intercom-php to PyPI, npm, and Packagist in 48 hours. It steals every credential in your CI and propagates through your own GitHub tokens. Here is what to check and what to rotate.'
category:
  name: 'Security'
  slug: 'security'
date: '2026-05-05'
publishedAt: '2026-05-05T15:30:00Z'
updatedAt: '2026-05-05T15:30:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: true
tags:
  - security
  - supply-chain
  - pypi
  - npm
  - cve
  - python
  - javascript
---

If your CI installed `lightning==2.6.2` or `lightning==2.6.3` between roughly 14:00 and 14:42 UTC on April 30, 2026, your GitHub token, npm token, AWS keys, kubeconfig, Vault token, Docker creds, SSH keys, and every `.env` file the runner could read are now in someone else's hands. Same story if you pulled `intercom-client@7.0.4` on npm or `intercom/intercom-php@5.0.2` from Packagist that week. The attack is called Mini Shai-Hulud, it ran across three package ecosystems in 48 hours, and it propagates through the credentials it steals.

This is the second post in two weeks where the answer to "are we exposed?" is "rotate first, ask questions second." Here is what happened, why this strain is unusually scary, and the exact commands to figure out whether you ate a poisoned package.

## TLDR

| Detail | Info |
|--------|------|
| Campaign name | Mini Shai-Hulud |
| Attribution | TeamPCP (financially motivated) |
| Disclosed | April 30, 2026 |
| Compromised: PyPI | `lightning` 2.6.2, 2.6.3 (safe: 2.6.1) |
| Compromised: npm | `intercom-client` 7.0.4 |
| Compromised: Packagist | `intercom/intercom-php` 5.0.2 |
| Window malicious versions were live | ~42 minutes (PyPI), longer for npm/PHP |
| Trigger | `import lightning` (PyPI) or `npm install` / `composer install` (npm/PHP) |
| What it steals | GitHub, npm, AWS, GCP, Azure, SSH keys, kubeconfig, Vault, Docker, all `.env` files |
| Exfil channel | `zero.masscan[.]cloud:443/v1/telemetry` (primary), public GitHub repo (fallback) |
| Worm behavior | Republishes infected versions of any npm package the stolen tokens can write to |
| What you do | Lockfile audit, kill compromised pins, rotate everything in scope, hunt for "A Mini Shai-Hulud has Appeared" repos under your org |

## What Happened

On April 30, 2026, attackers pushed malicious versions of three popular packages across three ecosystems within the same 48-hour window:

1. **PyPI**: `lightning` 2.6.2 and 2.6.3 (PyTorch Lightning, the wrapper around PyTorch most ML training jobs end up using). Combined downloads sit around 10 million per month.
2. **npm**: `intercom-client` 7.0.4. Intercom's official JavaScript SDK.
3. **Packagist**: `intercom/intercom-php` 5.0.2. The PHP equivalent.

PyPI quarantined the lightning versions roughly 42 minutes after they went live. npm took longer. Packagist longer still. The attack reached production CI runners in dozens of orgs in that window.

Researchers attribute the campaign to **TeamPCP**, a financially motivated group also tied to the earlier Checkmarx, Bitwarden, Telnyx, LiteLLM, and Trivy poisonings. The "Shai-Hulud" name is a nod to the Dune sandworm, picked because the malware is wormlike: every credential it steals becomes a vector for more poisoning. The "Mini" prefix distinguishes it from the larger Shai-Hulud campaign that hit npm in 2025.

## How the Attack Worked

The same payload (an obfuscated 11MB JavaScript blob called `router_runtime.js`) ran on all three ecosystems. Only the loader differs.

### PyPI: `import lightning`

The malicious package shipped a hidden `_runtime/` directory containing a `start.py` script and the obfuscated payload. Python's package metadata wired `start.py` to run on module import. So:

```bash
pip install lightning==2.6.2
python -c "import lightning"   # this is what triggers it
```

`start.py` downloads the Bun JavaScript runtime to a temp directory, then executes the obfuscated `router_runtime.js`. Bun is a clean choice for the attacker: no Python dependency, doesn't show up in your Python runtime monitoring, and runs fast enough to finish the steal before anything notices.

### npm: `npm install intercom-client@7.0.4`

The npm version uses a `preinstall` hook in `package.json`, which runs before any of the package code is imported. So even a `--ignore-scripts=false` install (the default) is enough; the package never has to be required by application code:

```bash
npm install intercom-client@7.0.4
# preinstall hook fires here, payload already running
```

### Packagist: `composer install` with `intercom/intercom-php@5.0.2`

Composer uses plugin events. The malicious version registered a Composer plugin that hooks `post-install-cmd` and `post-update-cmd`. On install or update, a shell script (`setup-intercom.sh`) downloads Bun and runs the same `router_runtime.js`:

```bash
composer require intercom/intercom-php:5.0.2
# setup-intercom.sh runs here
```

The pattern across all three ecosystems is the same: hook a lifecycle event that fires before the developer would notice anything wrong, drop a runtime, run a payload, exit clean.

## What Gets Stolen

`router_runtime.js` is a credential vacuum. It walks the runner filesystem and the standard environment-variable conventions for every credential type a CI/CD pipeline typically holds:

| Credential | Where the malware looks |
|------------|------------------------|
| GitHub tokens | `GITHUB_TOKEN`, `GH_TOKEN`, `~/.netrc`, `~/.config/gh/hosts.yml`, validated against `api.github.com/user` |
| npm tokens | `NPM_TOKEN`, `~/.npmrc` |
| SSH keys | `~/.ssh/id_*`, `~/.ssh/authorized_keys`, `SSH_AUTH_SOCK` |
| AWS | `~/.aws/credentials`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, IMDSv2 fetch on EC2 runners |
| GCP | `GOOGLE_APPLICATION_CREDENTIALS`, `~/.config/gcloud/` |
| Azure | `~/.azure/`, az-cli refresh tokens |
| Kubernetes | `~/.kube/config`, `KUBECONFIG`, in-cluster service account tokens |
| Vault | `VAULT_TOKEN`, `~/.vault-token` |
| Docker | `~/.docker/config.json` (registry passwords) |
| `.env` files | Recursive scan for `**/.env`, `**/.env.*` from the workspace root |
| Cloud provider IMDS | `169.254.169.254` if reachable |

All of it is bundled, encrypted, and posted to `zero.masscan[.]cloud:443/v1/telemetry`. If that domain is unreachable (firewall, sinkhole, etc.), the malware falls back to creating a public GitHub repository under any GitHub account whose token it just stole, with the repo description set to **"A Mini Shai-Hulud has Appeared."** That string is the cleanest indicator-of-compromise you can hunt for.

## The Worm Part

This is what earns the Shai-Hulud name. Once the malware has working npm tokens, it does not just exfiltrate them. It uses them.

For each npm token the runner had access to, the payload:

1. Lists packages the token can publish.
2. For each package, downloads the latest tarball, injects its own `preinstall` hook into `package.json`, bumps the patch version, and republishes.
3. Pushes the same payload along to whatever GitHub repos the stolen GitHub token can write to, by pushing a branch with the malicious code.

The published Lightning Foundation account `pl-ghost` performed six create-and-delete branch operations on Lightning-AI repos in 70 minutes after the breach, four of them with random 10-character branch names. That is the worm's write-access probing pattern.

In practice, every successful infection becomes a node that infects more packages. The "Mini" qualifier is a polite understatement.

## Are You Affected?

Three checks. Run them now even if your gut says no.

### 1. Did you install a compromised version?

For PyPI:

```bash
# Look at lockfiles and venvs in your build infra
grep -RE 'lightning==2\.6\.[23]\b' \
  --include=requirements*.txt \
  --include=poetry.lock \
  --include=Pipfile.lock \
  --include=uv.lock \
  --include=pyproject.toml \
  . 2>/dev/null

# Check installed sites
pip show lightning | grep -i version
```

For npm:

```bash
# Searches package-lock.json, yarn.lock, pnpm-lock.yaml
grep -RE 'intercom-client.*7\.0\.4' \
  --include=package-lock.json \
  --include=yarn.lock \
  --include=pnpm-lock.yaml \
  --include=package.json \
  . 2>/dev/null
```

For Composer:

```bash
grep -RE 'intercom/intercom-php.*5\.0\.2' \
  --include=composer.lock \
  --include=composer.json \
  . 2>/dev/null
```

Any hits and you assume infection on the host that ran the install.

### 2. Hunt for the GitHub fallback IoC

Across every GitHub org you control, search for repos with the description that the malware uses when its primary exfil channel fails:

```bash
# Loop your orgs through the GitHub API
gh api -X GET search/repositories \
  -f q='"A Mini Shai-Hulud has Appeared" org:YOUR_ORG' \
  --jq '.items[].full_name'
```

Run that for every org. A single hit means at minimum one of your service accounts had its token exfiltrated.

### 3. Check outbound connections

If you ship CI logs to a SIEM, search for any DNS query or connection to `zero.masscan.cloud` or `*.masscan.cloud`. Either is a confirmed exfiltration attempt.

```text
# Splunk / Loki / Datadog: anything matching this domain
domain="masscan.cloud"
```

If you have egress allowlisting on your runners, you may already have blocked the exfil. That is the only happy ending here.

## What to Do Right Now

### 1. Pin off the malicious versions

PyPI:

```bash
# Pin to the last known-good lightning, never resolve patch ranges
pip install 'lightning==2.6.1'

# In requirements.txt
lightning==2.6.1

# In poetry
[tool.poetry.dependencies]
lightning = "2.6.1"
```

npm:

```bash
# Pin intercom-client to a pre-attack release
npm install intercom-client@7.0.3
```

Composer:

```bash
composer require intercom/intercom-php:5.0.1
```

Then commit lockfiles, re-resolve, and check that no transitive resolved back to the bad version. Note that `pyannote-audio` and several other ML libraries pulled `lightning` as a transitive dependency, so anything that depends on Lightning needs a fresh resolve too.

### 2. Rotate credentials, in this order

1. **GitHub tokens for any account whose runner installed the bad versions.** Personal access tokens, fine-grained PATs, GitHub App private keys, deploy keys. Revoke and reissue. While you are there, rotate any GitHub Actions workflow secrets stored in repos those tokens could read.
2. **npm tokens.** Revoke from `npmjs.com → Access Tokens`, regenerate scoped tokens, push them to your CI as new secrets, and then delete the old ones. Do not leave overlap.
3. **AWS / GCP / Azure** credentials that were on the runner. For AWS, that means rotating the IAM access keys and, if it was an EC2 runner, considering the instance role compromised: terminate and rebuild rather than rotate.
4. **Kubeconfigs and in-cluster tokens.** Rotate ServiceAccount tokens for any cluster the runner could talk to. `kubectl rollout restart deployment` does not help here; you need to rotate the actual tokens.
5. **Vault.** Revoke the AppRole or token the runner used. Rotate.
6. **Docker registry credentials.** Rotate registry passwords for any registry the runner authenticated to. Push a new `~/.docker/config.json` to your runners.
7. **SSH keys.** Rotate any keys that lived on the runner, including known_hosts hostkey signers.
8. **Every `.env` file the runner could read.** Treat any secret in those files as exposed. This is usually the longest list, and the most likely place for the secret your team forgot existed.

### 3. Audit your published packages

If your team publishes to npm or Packagist using credentials that were on a poisoned runner, the worm may have already used those tokens. Check the recent versions of every package your team owns:

```bash
# For each package you own
npm view your-package versions --json | jq '.[-5:]'

# Inspect each tarball for an unexpected preinstall script
npm pack your-package@latest
tar -tzf your-package-*.tgz | grep -E 'preinstall|setup-.*\.sh|_runtime'
cat your-package-*/package.json | jq '.scripts'
```

If a recent patch version has a `preinstall` hook your team did not add, deprecate the version, publish a clean follow-up, and post an advisory. Composer plugin events deserve the same scrutiny on Packagist.

### 4. Lock down install scripts going forward

This attack is the third major one in eight months that abuses install-time hooks. The lesson is the same as the last two: do not run install hooks on your CI by default.

```bash
# npm: refuse all install scripts, opt in per-package
npm config set ignore-scripts true

# pnpm: same
pnpm config set ignore-scripts true

# yarn classic
yarn config set ignore-scripts true
```

For Composer, audit which plugins are allowed:

```json
{
  "config": {
    "allow-plugins": {
      "specific/plugin-you-trust": true
    }
  }
}
```

For Python, scope CI installs to a hash-pinned `requirements.txt` and pass `--require-hashes`. That makes a swapped-out version on the registry useless because the hash will not match.

### 5. Egress allowlist your runners

The only mitigation that catches the *next* one of these without you knowing the bad version is egress filtering. CI runners need network access to:

- Your VCS host (GitHub, GitLab, Bitbucket)
- The package registries you actually pull from (npmjs.com, pypi.org, packagist.org)
- Your container registry
- Your cloud provider APIs

Anything else, including arbitrary cloud-bucket downloads or random Bun-runtime mirrors, should be denied at the network level. That blocks the first hop of the exfil even if a poisoned package made it past every other control.

## Why This Keeps Happening

This is the third major install-hook supply chain attack in eight months. They keep working because:

- **Install hooks run before review.** No amount of code review on a PR catches a `preinstall` script in a transitive dependency. The hook fires before any of your team has eyes on the new version.
- **Lockfiles catch versions, not behavior.** A pinned version is great until the upstream owner gets compromised and pushes a bad version under a new pin. Hash pins (PyPI's `--require-hashes`, npm's `npm install --ignore-scripts`, etc.) close that gap, and almost no team uses them.
- **CI runners hold every secret your team has.** They have to. That is the job. Which means a 30-second compromise of a CI runner is a months-long game of credential-tracing for the defenders.
- **The blast radius is set by your trust graph, not the malicious package.** Lightning has 10 million downloads a month. Anything that depends on Lightning is exposed. The number of orgs running ML pipelines that pull Lightning transitively is hard to overstate.

The structural fix is some combination of sandboxed CI runners, hash-pinned dependencies, ignore-scripts by default, egress allowlists, and short-lived OIDC-issued credentials instead of long-lived tokens. You will not get all of those overnight. Pick one and ship it this sprint.

## Key Takeaways

1. **Pin off `lightning==2.6.2` and `lightning==2.6.3`.** Same for `intercom-client@7.0.4` and `intercom/intercom-php@5.0.2`. Pin to the last known-good versions: 2.6.1, 7.0.3, 5.0.1.
2. **Hunt for the IoC.** Search every GitHub org you control for repos described as "A Mini Shai-Hulud has Appeared." Search SIEM logs for connections to `masscan.cloud`.
3. **Rotate everything in scope.** GitHub, npm, cloud creds, kubeconfigs, Vault tokens, registry creds, SSH keys, every `.env` on the runner.
4. **Set `ignore-scripts true`** on your CI for npm and pnpm. Audit Composer's `allow-plugins` list. Use hash-pinned requirements for Python.
5. **Egress allowlist your runners.** It is the only mitigation that catches the next one without you knowing the bad version.
6. **Audit your own published packages.** If the worm got a token your team owned, your packages may already be downstream nodes.

Mini Shai-Hulud is going to keep showing up under different names. The packages will change. The hooks and the credential exfil paths will not.

*Sources: [The Hacker News](https://thehackernews.com/2026/04/pytorch-lightning-compromised-in-pypi.html), [Semgrep](https://semgrep.dev/blog/2026/malicious-dependency-in-pytorch-lightning-used-for-ai-training/), [Socket.dev](https://socket.dev/blog/lightning-pypi-package-compromised), [Kodem Security](https://www.kodemsecurity.com/resources/mini-shai-hulud-strikes-pytorch-lightning-and-intercom-client-inside-the-cross-ecosystem-supply-chain-attack), [OX Security](https://www.ox.security/blog/lightning-python-package-shai-hulud-supply-chain-attack/), [Aikido](https://www.aikido.dev/blog/pytorch-lightning-pypi-compromise-mini-shai-hulud), [GitGuardian](https://blog.gitguardian.com/three-supply-chain-campaigns-hit-npm-pypi-and-docker-hub-in-48-hours/)*
