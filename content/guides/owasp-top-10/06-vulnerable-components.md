---
title: 'A03:2025 Software Supply Chain Failures'
description: 'A03:2025 Software Supply Chain Failures: vulnerable and malicious dependencies, SBOMs, npm audit and Trivy, release-age delays and a hardened CI workflow.'
order: 4
---

**TLDR**: Your application is mostly code you did not write, built by tools and pipelines you did not write either. A03:2025 widens the old "vulnerable and outdated components" category to the whole chain: dependencies, build systems, CI/CD, registries and developer machines. Know what you ship (lockfiles and an SBOM), scan it for known vulnerabilities on every change, slow down brand-new releases, keep install scripts off, and hold your CI workflows to the same standard as production: pinned actions, minimal permissions and no untrusted code near secrets.

In the 2021 list this category was A06 Vulnerable and Outdated Components. The 2025 edition renamed and widened it, and the [A03:2025 page](https://owasp.org/Top10/2025/A03_2025-Software_Supply_Chain_Failures/) explains why: exactly half of the community survey respondents ranked it the top risk. It has few CVEs, because testing for it is hard, but the highest average exploit and impact scores of all ten categories.

The examples OWASP lists show the range: the SolarWinds build compromise, the 2025 Bybit theft through compromised wallet software, and Shai-Hulud, which OWASP calls the first successful self-propagating npm worm. It used install scripts to steal secrets from developer machines and used any npm tokens it found to publish infected versions of more packages. The waves kept coming in 2026: [AntV in May](/posts/antv-npm-shai-hulud-wave-may-2026), [PyPI in June](/posts/shai-hulud-hades-pypi-wave-june-2026), and attacks on single high-profile packages such as [axios](/posts/axios-supply-chain-attack-what-happened-and-what-to-do).

## Prerequisites

- The companion app from the [guide introduction](/guides/owasp-top-10#h2-the-companion-app), with npm 11 (bundled with Node.js 24) or npm 12.
- Network access to the npm registry for the audit commands.
- For the scanner examples: [Trivy](https://trivy.dev/) and [zizmor](https://docs.zizmor.sh/). The output below comes from the companion repository's CI workflow.

## The Chain You Depend On

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Developer", "sub": "laptop, IDE extensions", "icon": "cpu", "tone": "slate" },
    { "label": "Repository", "sub": "code, reviews, branches", "icon": "branch", "tone": "blue" },
    { "label": "Dependencies", "sub": "registries, lockfile", "icon": "box", "tone": "amber" },
    { "label": "CI/CD", "sub": "actions, runners, secrets", "icon": "gear", "tone": "violet" },
    { "label": "Artifacts", "sub": "packages, images", "icon": "database", "tone": "red" },
    { "label": "Production", "sub": "staged rollout", "icon": "rocket", "tone": "green" }
  ]
}
```

Each step can be attacked, and each can carry a known vulnerability forward. The OWASP list of signs that you are exposed is long; the ones that matter most in practice are: you do not know your transitive dependencies, you patch on a monthly or quarterly schedule, your CI/CD is less protected than the systems it deploys, and one person can push code to production without anyone else looking.

## Know What You Ship

A lockfile records the exact version and integrity hash of every package, including transitive ones. Commit it, and install from it in CI with `npm ci`, which fails if `package.json` and the lockfile disagree instead of quietly resolving new versions.

A Software Bill of Materials (SBOM) is the same inventory in a standard format (CycloneDX or SPDX) that other tools can read, such as OWASP Dependency-Track. npm can write one from the lockfile:

```terminal
{
  "title": "an SBOM for the production dependencies",
  "prompt": "$",
  "steps": [
    {
      "cmd": "npm sbom --sbom-format cyclonedx --omit dev > sbom.json"
    },
    {
      "cmd": "jq '.components | length' sbom.json",
      "output": "81"
    },
    {
      "cmd": "jq -c '.components[] | select(.name == \"express\") | {name, version, purl}' sbom.json",
      "output": "{\"name\":\"express\",\"version\":\"5.3.0\",\"purl\":\"pkg:npm/express@5.3.0\"}"
    }
  ]
}
```

Four direct dependencies pull in 81 packages. Generate an SBOM for every release, store it with the artifact, and you can answer "are we affected?" within minutes when the next advisory lands.

## Find Known Vulnerabilities

The companion repository has a lockfile for Express 4.17.1, a 2019 release, in `examples/outdated/`. `npm audit` checks it against the GitHub Advisory Database:

```terminal
{
  "title": "npm audit on an old Express",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd examples/outdated"
    },
    {
      "cmd": "npm audit",
      "output": "# npm audit report\n\nbody-parser  <=1.20.8\nSeverity: high\nbody-parser vulnerable to denial of service when url encoding is enabled - https://github.com/advisories/GHSA-qwcr-r2fm-qrc7\nbody-parser vulnerable to denial of service when invalid limit value silently disables size enforcement - https://github.com/advisories/GHSA-v422-hmwv-36x6\nbody-parser vulnerable to Denial of Service via trailing bytes after a compressed request body - https://github.com/advisories/GHSA-27r3-jxmh-p828\nDepends on vulnerable versions of qs\nfix available via `npm audit fix --force`\nWill install express@4.22.3, which is outside the stated dependency range\nnode_modules/body-parser\n  express  <=4.21.2 || 5.0.0-alpha.1 - 5.0.0\n  Depends on vulnerable versions of body-parser\n  Depends on vulnerable versions of cookie\n  Depends on vulnerable versions of path-to-regexp\n  Depends on vulnerable versions of qs\n  Depends on vulnerable versions of send\n  Depends on vulnerable versions of serve-static\n  node_modules/express\n\ncookie  <0.7.0\ncookie accepts cookie name, path, and domain with out of bounds characters - https://github.com/advisories/GHSA-pxg6-pf52-xh8x\nfix available via `npm audit fix --force`\nWill install express@4.22.3, which is outside the stated dependency range\nnode_modules/cookie\n\n\npath-to-regexp  <=0.1.12\nSeverity: high\npath-to-regexp outputs backtracking regular expressions - https://github.com/advisories/GHSA-9wv6-86v2-598j\npath-to-regexp contains a ReDoS - https://github.com/advisories/GHSA-rhx6-c78j-4q9w\npath-to-regexp vulnerable to Regular Expression Denial of Service via multiple route parameters - https://github.com/advisories/GHSA-37ch-88jc-xwx2\nfix available via `npm audit fix --force`\nWill install express@4.22.3, which is outside the stated dependency range\nnode_modules/path-to-regexp\n\nqs  <=6.15.3\nSeverity: high\nqs vulnerable to Prototype Pollution - https://github.com/advisories/GHSA-hrpp-h998-j3pp\nqs's arrayLimit bypass in comma parsing allows denial of service - https://github.com/advisories/GHSA-w7fw-mjwx-w883\nqs's arrayLimit bypass in its bracket notation allows DoS via memory exhaustion - https://github.com/advisories/GHSA-6rw7-vpxm-498p\nqs: Denial of Service via Attacker Controlled isBuffer - https://github.com/advisories/GHSA-4mjr-xmp4-gh2g\nfix available via `npm audit fix --force`\nWill install express@4.22.3, which is outside the stated dependency range\nnode_modules/qs\n\nsend  <0.19.0\nsend vulnerable to template injection that can lead to XSS - https://github.com/advisories/GHSA-m6fv-jmcg-4jfg\nfix available via `npm audit fix --force`\nWill install express@4.22.3, which is outside the stated dependency range\nnode_modules/send\n  serve-static  <=1.16.0\n  Depends on vulnerable versions of send\n  node_modules/serve-static\n\n\n7 vulnerabilities (3 low, 4 high)\n\nTo address all issues, run:\n  npm audit fix --force"
    },
    {
      "cmd": "cd ../.."
    }
  ]
}
```

Trivy reads the same lockfile but reports one line per CVE, from several databases, so its count is higher. Here as one line per finding:

```terminal
{
  "title": "trivy fs on the same lockfile",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "trivy fs --quiet --scanners vuln --format json examples/outdated | jq -r '.Results[].Vulnerabilities[] | [.Severity, .PkgName, .InstalledVersion, .VulnerabilityID, .FixedVersion] | @tsv' | column -t -s $'\\t'",
      "output": "HIGH    body-parser     1.19.0  CVE-2024-45590   1.20.3\nHIGH    body-parser     1.19.0  CVE-2026-111181  2.4.0, 1.20.9\nLOW     body-parser     1.19.0  CVE-2026-12590   1.20.6, 2.3.0\nLOW     cookie          0.4.0   CVE-2024-47764   0.7.0\nMEDIUM  express         4.17.1  CVE-2024-29041   4.19.2, 5.0.0-beta.3\nLOW     express         4.17.1  CVE-2024-43796   4.20.0, 5.0.0\nHIGH    path-to-regexp  0.1.7   CVE-2024-45296   1.9.0, 0.1.10, 8.0.0, 3.3.0, 6.3.0\nHIGH    path-to-regexp  0.1.7   CVE-2024-52798   0.1.12\nHIGH    path-to-regexp  0.1.7   CVE-2026-4867    0.1.13\nHIGH    qs              6.7.0   CVE-2022-24999   6.10.3, 6.9.7, 6.8.3, 6.7.3, 6.6.1, 6.5.3, 6.4.1, 6.3.3, 6.2.4\nMEDIUM  qs              6.7.0   CVE-2025-15284   6.14.1\nMEDIUM  qs              6.7.0   CVE-2026-82417   6.16.0\nLOW     qs              6.7.0   CVE-2026-2391    6.14.2\nLOW     send            0.17.1  CVE-2024-43799   0.19.0\nLOW     serve-static    1.14.1  CVE-2024-43800   1.16.0, 2.1.0"
    }
  ]
}
```

Almost every finding is in a transitive dependency (`body-parser`, `qs`, `path-to-regexp`), which is why direct-dependency checks are not enough. The fix is to move to a current Express release. Note what `npm audit fix --force` offered above: a version outside the range in `package.json`. Upgrades like that need a test run, which is one more reason to keep a test suite like the one in this guide.

Container images add a second layer of components: the operating system packages and everything else in the base image. The companion repository has two images of the same app. `examples/insecure/Dockerfile` is a quick first version: the full `node:24` image, `npm install`, npm left in the final image, and the root user. The [hardened Dockerfile](/guides/owasp-top-10/05-security-misconfiguration#h2-containers-and-kubernetes) uses a pinned slim base image, installs production dependencies in a build stage and removes npm, corepack and Yarn from the runtime image. Trivy counts the high and critical vulnerabilities that have a fix available, per package type:

```terminal
{
  "title": "trivy image, quick first image",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker build -q -f examples/insecure/Dockerfile -t invoices-demo:insecure ."
    },
    {
      "cmd": "trivy image --quiet --scanners vuln --ignore-unfixed --severity HIGH,CRITICAL --format json invoices-demo:insecure | jq -r '[.Results[] | {type: .Type, n: (.Vulnerabilities // [] | length)}] | group_by(.type)[] | \"\\(.[0].type): \\(map(.n) | add)\"'",
      "output": "debian: 152\ngobinary: 0\nnode-pkg: 4"
    }
  ]
}
```

```terminal
{
  "title": "trivy image, hardened image",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker build -q -f examples/deploy/Dockerfile -t invoices-demo:ci ."
    },
    {
      "cmd": "trivy image --quiet --scanners vuln --ignore-unfixed --severity HIGH,CRITICAL --format json invoices-demo:ci | jq -r '[.Results[] | {type: .Type, n: (.Vulnerabilities // [] | length)}] | group_by(.type)[] | \"\\(.[0].type): \\(map(.n) | add)\"'",
      "output": "debian: 0\nnode-pkg: 0"
    }
  ]
}
```

Same application, same dependencies: the difference is everything the image carried that the app never used, including build tools, libraries and npm's own bundled packages. `--ignore-unfixed` hides advisories without a fix yet, which you can only track; run the scan without it now and then to see them. Scan the image you deploy in CI, and rebuild it regularly so base image fixes reach production. [Why Your Base Image Has 1,684 CVEs](/posts/why-your-base-image-has-1684-cves) explains why base images carry so many advisories and how to choose one.

## Malicious Packages: Slow Down and Switch Off Scripts

A scanner finds known vulnerabilities. A freshly published malicious version is not known to anyone yet, so two other controls matter more.

**Do not run install scripts.** Shai-Hulud and many similar attacks run in a `preinstall` or `postinstall` script, which executes on every machine that installs the package. npm 12 blocks dependency lifecycle scripts by default and runs only those allowed by an `allowScripts` policy in the root `package.json` (`npm install-scripts approve` records the approvals). pnpm 10 and later also block build scripts unless they are allowed. On npm 11, the version bundled with Node.js 24, turn them off yourself: `npm ci --ignore-scripts` in CI, or `ignore-scripts=true` in `.npmrc`. [npm v12 Will Stop Running Install Scripts](/posts/npm-v12-install-scripts-audit) measured what breaks when you do.

**Wait before taking new versions.** Most malicious releases are found and removed within hours or days. npm 11.10 added `min-release-age`, in days, which makes npm pick only versions older than that. pnpm has `minimumReleaseAge` (in minutes; a day by default since pnpm 11), and Dependabot waits three days by default since July 2026 and supports a longer `cooldown`. Here is npm with a 30-day delay, on the day this guide was written, when Express 5.3.0 was 18 days old:

```terminal
{
  "title": "min-release-age picks an older version",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "REPO=$PWD"
    },
    {
      "cmd": "cd \"$(mktemp -d)\" && npm init -y > /dev/null"
    },
    {
      "cmd": "npm install --package-lock-only --min-release-age=30 express",
      "output": "up to date, audited 69 packages in 4s\n\n1 high severity vulnerability\n\nTo address all issues, run:\n  npm audit fix\n\nRun `npm audit` for details."
    },
    {
      "cmd": "jq -r '.packages[\"node_modules/express\"].version' package-lock.json",
      "output": "5.2.1"
    },
    {
      "cmd": "npm audit",
      "output": "# npm audit report\n\nbody-parser  2.0.0 - 2.3.0\nSeverity: high\nbody-parser vulnerable to Denial of Service via trailing bytes after a compressed request body - https://github.com/advisories/GHSA-27r3-jxmh-p828\nfix available via `npm audit fix`\nnode_modules/body-parser\n\n1 high severity vulnerability\n\nTo address all issues, run:\n  npm audit fix"
    }
  ]
}
```

The delay applies to transitive dependencies too, and here it held back a `body-parser` release that fixes a high-severity denial of service. A release-age delay trades a few days of exposure to known bugs for protection from unknown malicious releases, so give security fixes a fast path: npm's `min-release-age-exclude` setting, or Dependabot security updates, which ignore the cooldown. This example `dependabot.yml` from the companion repository waits a week for routine updates:

```yaml
# Example .github/dependabot.yml. It sits in examples/ so it never runs here.
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    # Wait a week before proposing a new version: most malicious releases are
    # found and removed within days. Security updates are not delayed.
    cooldown:
      default-days: 7
    groups:
      minor-and-patch:
        update-types: ['minor', 'patch']

  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
    cooldown:
      default-days: 7
```

**Check where packages came from.** npm signs every package in the registry, and many packages now publish provenance attestations that link them to the source repository and build workflow:

```terminal
{
  "title": "verify registry signatures and attestations",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd \"$REPO\""
    },
    {
      "cmd": "npm audit signatures",
      "output": "audited 81 packages in 4s\n\n81 packages have verified registry signatures\n\n9 packages have verified attestations\n(use --json --include-attestations to view attestation details)"
    }
  ]
}
```

A valid signature and attestation do not prove that the code is safe. The [TanStack worm](/posts/tanstack-npm-worm-dead-mans-switch) shipped with valid provenance, and the [LiteLLM compromise](/posts/litellm-1-107-0-compromise-pypi-provenance) came out of the real release pipeline. What provenance does give you is a way to notice when a package suddenly comes from a different repository or workflow than before.

## Your CI/CD Is Part of the Supply Chain

OWASP warns about pipelines that are weaker than the systems they build. A CI workflow holds deploy credentials and registry tokens, and it runs code from pull requests. In March 2025, the popular `tj-actions/changed-files` action was compromised (CVE-2025-30066): every repository that referenced it by tag ran the new code, which printed CI secrets into the build logs.

Here is a pull request workflow with the common mistakes, from `examples/insecure/` in the companion repository:

```yaml
# A03 and A08 example: a pull request workflow with common CI/CD mistakes.
# It sits in examples/insecure/ so it never runs. Do not copy it.
name: PR checks

on:
  pull_request_target:

permissions: write-all

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
      - run: echo "Testing ${{ github.event.pull_request.title }}"
      - uses: actions/setup-node@v4
      - run: npm install
      - run: npm test
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

[zizmor](https://docs.zizmor.sh/) is a static analyzer for GitHub Actions workflows:

```terminal
{
  "title": "zizmor on the insecure workflow",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "zizmor -q examples/insecure/workflow.yml",
      "output": "warning[artipacked]: credential persistence through GitHub Actions artifacts\n  --> examples/insecure/workflow.yml:14:9\n   |\n14 |         - uses: actions/checkout@v4\n   |  _________^\n15 | |         with:\n16 | |           ref: ${{ github.event.pull_request.head.sha }}\n   | |________________________________________________________^ does not set persist-credentials: false\n   |\n   = note: audit confidence → Low\n   = note: this finding has an auto-fix\n   = help: audit documentation → https://docs.zizmor.sh/audits/#artipacked\n\nerror[dangerous-triggers]: use of fundamentally insecure workflow trigger\n --> examples/insecure/workflow.yml:6:3\n  |\n6 |   pull_request_target:\n  |   ^^^^^^^^^^^^^^^^^^^ pull_request_target is almost always used insecurely\n  |\n  = note: audit confidence → Medium\n  = help: audit documentation → https://docs.zizmor.sh/audits/#dangerous-triggers\n\nerror[template-injection]: code injection via template expansion\n  --> examples/insecure/workflow.yml:17:32\n   |\n17 |       - run: echo \"Testing ${{ github.event.pull_request.title }}\"\n   |         --- this run block     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ may expand into attacker-controllable code\n   |\n   = note: audit confidence → High\n   = note: this finding has an auto-fix\n   = help: audit documentation → https://docs.zizmor.sh/audits/#template-injection\n\nerror[unpinned-uses]: unpinned action reference\n  --> examples/insecure/workflow.yml:14:15\n   |\n14 |       - uses: actions/checkout@v4\n   |               ^^^^^^^^^^^^^^^^^^^ action is not pinned to a hash (required by blanket policy)\n   |\n   = note: audit confidence → High\n   = note: this finding has an auto-fix\n   = help: audit documentation → https://docs.zizmor.sh/audits/#unpinned-uses\n\nerror[unpinned-uses]: unpinned action reference\n  --> examples/insecure/workflow.yml:18:15\n   |\n18 |       - uses: actions/setup-node@v4\n   |               ^^^^^^^^^^^^^^^^^^^^^ action is not pinned to a hash (required by blanket policy)\n   |\n   = note: audit confidence → High\n   = note: this finding has an auto-fix\n   = help: audit documentation → https://docs.zizmor.sh/audits/#unpinned-uses\n\n9 findings (4 suppressed, 4 unsafe fixes): 0 informational, 0 low, 1 medium, 4 high"
    }
  ]
}
```

The worst problem is the combination: `pull_request_target` runs with the base repository's secrets and write token, and this workflow checks out the pull request's code and runs `npm install` and `npm test` on it. Anyone who opens a pull request can run code with those secrets. The `run` step also expands the pull request title into a shell script, so a crafted title is a command.

The example security workflow from the companion repository avoids all of it: it triggers on `pull_request`, gives the token read access only, pins every action and container image to a full commit SHA or digest, does not persist the checkout credentials, and installs with `--ignore-scripts`:

```yaml
# Example security checks for a Node.js app on every pull request.
# Copy it to .github/workflows/ in your own repository. In this repository it
# lives under examples/ on purpose, so it never runs here.
name: Security checks

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: security-${{ github.ref }}
  cancel-in-progress: true

jobs:
  tests:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24
      - run: npm ci --ignore-scripts
      - run: npm test # the access control and injection tests from the guide

  dependencies:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24
      - run: npm ci --ignore-scripts
      - run: npm audit --omit=dev --audit-level=high
      - run: npm audit signatures

  sast:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - name: Semgrep
        run: >-
          docker run --rm -v "$PWD:/src:ro" -w /src
          semgrep/semgrep:1.182.1@sha256:451b3d875c00dac7ed5db5293e584a07de11449a409c10b3c2d2652f429630b6
          semgrep scan --config p/javascript --config p/owasp-top-ten --config semgrep.yml --metrics off --error src

  config:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      # Accepted findings live in .trivyignore.yaml; add --skip-dirs for test fixtures
      # that are vulnerable on purpose (this repository's examples/ directory, for one).
      - name: Trivy (dependencies, IaC, secrets)
        run: >-
          docker run --rm -v "$PWD:/src:ro"
          aquasec/trivy:0.76.1@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c
          fs --scanners vuln,misconfig,secret --severity HIGH,CRITICAL
          --ignorefile /src/.trivyignore.yaml --exit-code 1 /src

  dast:
    runs-on: ubuntu-24.04
    needs: tests
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24
      - run: npm ci --ignore-scripts
      - name: Start the app
        run: |
          DEMO_PASSWORD="$(openssl rand -hex 16)"
          export DEMO_PASSWORD
          nohup npm start > app.log 2>&1 &
          timeout 30 bash -c 'until curl -sf http://127.0.0.1:3000/ > /dev/null; do sleep 1; done'
      - name: ZAP baseline scan (passive)
        run: |
          # zap-rules.conf records the reviewed IGNORE decisions; any other warning fails the job
          mkdir -p zap && cp zap-rules.conf zap/rules.conf
          chmod -R a+rwX zap # the ZAP container runs as its own user
          docker run --rm --network host -v "$PWD/zap:/zap/wrk:rw" \
            ghcr.io/zaproxy/zaproxy:2.17.0@sha256:030d3df57735dacbb83464854758e674dd9ad01d79d12a129a8e58b1fd384238 \
            zap-baseline.py -t http://127.0.0.1:3000/ -c rules.conf -s -r report.html
```

```terminal
{
  "title": "zizmor on the example security workflow",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "zizmor -q examples/workflows/security.yml",
      "output": "No findings to report. Good job! (5 suppressed)"
    }
  ]
}
```

Beyond the workflow file:

- **Separation of duties.** Protect the main branch, require a review from someone other than the author, and require the security checks to pass. Use protected environments with required reviewers for production deployments.
- **Short-lived credentials.** Use OpenID Connect from CI to your cloud and to npm (trusted publishing), not long-lived tokens in secrets.
- **Staged rollouts.** OWASP recommends not updating all systems at once, so a compromised vendor release reaches a canary first.
- **Developer machines and IDE extensions** are part of the chain: keep them patched, use MFA on registry and Git hosting accounts, and install extensions only from publishers you trust.

## Common Mistakes

- **Scanning direct dependencies only.** Most known vulnerabilities sit in transitive ones.
- **`npm install` in CI.** Use `npm ci` so the lockfile is the source of truth.
- **Patching on a calendar.** Monthly patch windows leave weeks of known exposure; automate updates and review them continuously.
- **Treating provenance as proof of safety.** It tells you where a package was built, not what it does.
- **Pinning actions by tag.** Tags can move; commit SHAs cannot.
- **Secrets in pull request workflows.** Never run untrusted code in a job that can read secrets.

## Summary

- A03:2025 covers the whole chain: dependencies, build systems, CI/CD and developer tools.
- Commit lockfiles, install with `npm ci`, and keep an SBOM per release.
- Scan lockfiles and images in CI with `npm audit` and Trivy, and fix transitive findings by upgrading the parent.
- Block install scripts and wait a few days before taking new versions, with a fast path for security fixes.
- Harden CI like production: pinned actions, read-only tokens, no secrets near untrusted code, and reviews before release.

Next, [A04:2025 Cryptographic Failures](/guides/owasp-top-10/02-cryptographic-failures) covers password storage, encryption and TLS.

## Keep Learning

- [Software Supply Chain Security: SBOMs, Sigstore, and SLSA in Practice](/posts/software-supply-chain-security)
- [npm v12 Will Stop Running Install Scripts: What Actually Breaks](/posts/npm-v12-install-scripts-audit)
- [The Axios Supply Chain Attack: What DevOps Teams Need to Know](/posts/axios-supply-chain-attack-what-happened-and-what-to-do)
- [Dependency Scanning: Finding Vulnerabilities Before Attackers Do](/posts/dependency-scanning-guide)
- [Introduction to CI/CD guide](/guides/introduction-to-cicd)
