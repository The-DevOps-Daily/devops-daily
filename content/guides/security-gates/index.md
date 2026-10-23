---
title: 'Security Gates'
seoTitle: 'Security Gates in CI/CD: Policy, CVE and Compliance Checks'
description: 'What security gates are and how to add them to CI/CD: policy as code, CVE gates with KEV and EPSS, compliance checks and admission control, with real runs.'
category:
  name: 'Security'
  slug: 'security'
publishedAt: '2026-02-23'
updatedAt: '2026-10-23'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Security
  - DevSecOps
  - CI/CD
  - Quality Gates
  - Policy as Code
  - Vulnerability Management
  - Compliance
  - Kubernetes
---

A **security gate** is an automated check in your delivery pipeline that can stop a change. It has three parts: a check (a scanner or a policy), a decision rule that says which results block, warn or pass, and an exception process for the cases where the rule is wrong. Gates run on pull requests, during the build, before a deployment and at the Kubernetes API server, so a known problem is found while it is still cheap to fix.

This guide builds a full set of gates for one small service, `orders-api`, with real runs of the tools: OPA, Conftest, the Kyverno CLI, gator, OSV-Scanner, Trivy, Checkov, Gitleaks, actionlint, zizmor, cosign and the GitHub CLI. Every gate has a rule a team can live with, because a gate that blocks every build is switched off within a week.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Pull request", "sub": "secrets, SAST, policy, IaC, new deps", "icon": "branch", "tone": "slate" },
    { "label": "Build", "sub": "CVE gate, SBOM", "icon": "box", "tone": "blue" },
    { "label": "Sign and attest", "sub": "provenance, SBOM", "icon": "lock", "tone": "violet" },
    { "label": "Deploy", "sub": "verify signature, admission", "icon": "shield", "tone": "accent" },
    { "label": "Run", "sub": "nightly SBOM rescans", "icon": "activity", "tone": "green" }
  ]
}
```

## Types of Security Gates

| Gate                   | What it checks                                                  | Example tools                                                 | Where it runs                          | Covered in                                              |
| ---------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| Secrets                | API keys, tokens and private keys in code                       | Gitleaks, GitHub push protection                              | Pre-commit, pull request               | [Part 4](/guides/security-gates/04-cicd-integration)    |
| Static analysis (SAST) | Injection, unsafe APIs and similar bugs in your code            | Semgrep, CodeQL                                               | Pull request                           | [SAST Tools guide](/guides/sast-tools)                  |
| Policy                 | Kubernetes manifests, Dockerfiles, Terraform against your rules | OPA, Conftest, Kyverno, Gatekeeper, ValidatingAdmissionPolicy | Pull request and the API server        | [Part 1](/guides/security-gates/01-policy-as-code)      |
| Vulnerabilities        | Known CVEs in dependencies and images                           | OSV-Scanner, Trivy, Grype, dependency review                  | Pull request, build, nightly           | [Part 2](/guides/security-gates/02-vulnerability-gates) |
| Compliance             | Infrastructure code against CIS, PCI DSS and SOC 2 controls     | Checkov, KICS, Trivy                                          | Pull request, before `terraform apply` | [Part 3](/guides/security-gates/03-compliance-gates)    |
| Supply chain           | Signatures, SBOMs and build provenance of artifacts             | cosign, GitHub artifact attestations                          | Build and deploy                       | [Part 4](/guides/security-gates/04-cicd-integration)    |

## Block, Warn or Report

The decision rule matters more than the tool. Most teams end up with three outcomes:

| Outcome    | Use it for                                                       | Examples from this guide                                                                                             |
| ---------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Block**  | Findings that are exploited, easy to fix, or never acceptable    | A secret in the diff; a CVE in the CISA KEV catalog; a privileged container; a database open to the internet         |
| **Warn**   | New rules during rollout, and accepted risks with an expiry date | A new policy in its first weeks; a critical CVE whose fix needs a major upgrade, with an exception until 31 December |
| **Report** | Everything else, sent to a backlog or dashboard                  | High and medium CVEs without exploit activity; advisory IaC checks that do not map to a control                      |

Blocking on severity alone does not work for vulnerabilities. In part 2, a 2022-era lockfile has 66 known vulnerabilities, 6 of them critical. A gate that uses CISA KEV, EPSS and fix availability blocks 9 of them, each with a reason and a fixed version, and the team can actually clear that list.

## A Minimal Gate Script

You can run a first set of gates from one script, locally or in any CI system. This is the script for `orders-api` once all four parts are in place; it stops at the first gate that fails:

```bash
#!/usr/bin/env bash
# Run the orders-api security gates in order of speed. Stop at the first failure.
set -euo pipefail

echo "== 1/4 secrets"
gitleaks dir . --no-banner --redact --ignore-gitleaks-allow

echo "== 2/4 policy"
conftest test --namespace kubernetes k8s/
conftest test --namespace docker Dockerfile

echo "== 3/4 vulnerabilities"
rm -f osv.json
# exit code 1 means "vulnerabilities found"; any other failure stops the script
osv-scanner scan source --lockfile gradle.lockfile --format json --output-file osv.json 2> /dev/null || [ $? -eq 1 ]
./scripts/enrich.sh osv.json
conftest test findings.json --namespace vulns --data exceptions.yaml

echo "== 4/4 compliance"
checkov --directory terraform --config-file .checkov.yaml --output json > checkov.json
conftest test checkov.json --namespace compliance --data compliance/controls.yaml

echo "all gates passed"
```

```terminal
{
  "title": "./scripts/gates.sh",
  "prompt": "$",
  "steps": [
    {
      "cmd": "./scripts/gates.sh",
      "output": "== 1/4 secrets\n7:19PM INF scanned ~213240 bytes (213.24 KB) in 8.52s\n7:19PM INF no leaks found\n== 2/4 policy\n\n6 tests, 6 passed, 0 warnings, 0 failures, 0 exceptions\n\n4 tests, 4 passed, 0 warnings, 0 failures, 0 exceptions\n== 3/4 vulnerabilities\n2 findings, 0 in KEV, 0 with EPSS >= 0.1\nWARN - findings.json - vulns - CVE-2026-47884 in org.springframework:spring-webmvc is accepted until 2026-12-31: orders-api does not use XsltView; the fix needs Spring Framework 7 (ORD-412)\nWARN - findings.json - vulns - CVE-2026-47890 in org.springframework:spring-webmvc is accepted until 2026-12-31: orders-api does not render view fragments over SSE; the fix needs Spring Framework 7 (ORD-412)\n\n6 tests, 4 passed, 2 warnings, 0 failures, 0 exceptions\n== 4/4 compliance\n\n4 tests, 4 passed, 0 warnings, 0 failures, 0 exceptions\nall gates passed"
    }
  ]
}
```

`osv-scanner` exits with code 1 whenever it finds a vulnerability, so the script accepts that code but stops on any other error, and `.checkov.yaml` sets `soft-fail`. The scanners report; the reviewed policies decide. The same pattern works for any scanner: collect the results as JSON, then make one reviewed policy the gate.

## Make Failures Actionable

A developer who sees "security gate failed" opens a ticket with the platform team. A developer who sees this fixes the problem in a few minutes:

```text
FAIL - findings.json - vulns - CVE-2022-22965 in org.springframework:spring-beans 5.3.17 is in the CISA KEV catalog (fix: 5.2.20.RELEASE or 5.3.18)
FAIL - k8s/deployment.yaml - kubernetes - Deployment/orders-api: container "log-shipper" must not run privileged
```

Every message in this guide names the object, the rule and the fix. Link longer explanations from the message, and send results to the place developers already look: pull request annotations and the code scanning tab, as shown in [part 4](/guides/security-gates/04-cicd-integration).

## Exceptions and Overrides

Every gate needs a way through for the cases where the rule is wrong or the fix has to wait. A good exception has:

- **an owner and a reason**, reviewed in a pull request like any other change;
- **an expiry date**, after which the gate fails again (part 2 tests this with a mocked clock);
- **a narrow scope**: one CVE in one package, or one policy for one namespace, never "skip the scanner".

For a true emergency, keep a separate break-glass deployment workflow that runs only through a protected GitHub environment with required reviewers, so the override is approved by a named person and logged ([part 4](/guides/security-gates/04-cicd-integration#h2-overrides-without-bypasses)). Never let people bypass a gate by editing the pipeline in the same pull request.

## Roll Out Gradually

1. **Report only.** Run every scanner and policy, publish the results, block nothing. You learn how noisy each check is.
2. **Block the clear cases.** Secrets, KEV-listed CVEs and privileged containers. Nobody argues with these.
3. **Add rules one at a time**, each first as a warning or in audit mode, then as a block.
4. **Review the exceptions monthly.** A growing exceptions file means the rules or the backlog need attention.

## What Gates Would Have Changed

- **Equifax (2017).** A fix for the Apache Struts vulnerability CVE-2017-5638 was published in March 2017. Attackers used it against Equifax from May, and the breach exposed data on about 147 million people. Exploitation in the wild started within days of the disclosure. The application was already in production, so a build-time gate alone would not have helped; a nightly rescan of what is deployed would have flagged the vulnerable Struts version as soon as the CVE was published ([part 2](/guides/security-gates/02-vulnerability-gates)).
- **Capital One (2019).** An attacker used a server-side request forgery in a misconfigured web application firewall to get credentials for an IAM role, and that role could read far more S3 data than it needed. About 100 million people in the US and 6 million in Canada were affected. Policy and compliance gates on IAM and infrastructure code target exactly this kind of over-broad permission ([part 3](/guides/security-gates/03-compliance-gates)).
- **The gate tools themselves (2026).** In March 2026, attackers force-pushed malicious commits to the version tags of `aquasecurity/trivy-action` and later of Checkmarx's KICS action, so pipelines that referenced those tags ran code that stole CI secrets. Pin every action to a commit SHA ([part 4](/guides/security-gates/04-cicd-integration#h2-pin-and-verify-the-gate-tools)).

## What You Will Learn

1. **[Policy as Code](/guides/security-gates/01-policy-as-code)**: Rego v1 policies for Kubernetes manifests and Dockerfiles, unit tests with `opa test`, and admission control with ValidatingAdmissionPolicy, Kyverno and Gatekeeper.
2. **[Vulnerability Gates](/guides/security-gates/02-vulnerability-gates)**: scan lockfiles and SBOMs, gate on CISA KEV, EPSS and fix availability, and manage expiring exceptions and VEX.
3. **[Compliance Gates](/guides/security-gates/03-compliance-gates)**: check Terraform with Checkov, map checks to CIS, PCI DSS and SOC 2 controls, write custom checks and keep audit evidence.
4. **[CI/CD Integration](/guides/security-gates/04-cicd-integration)**: a complete GitHub Actions pipeline checked with actionlint, SHA-pinned actions, code scanning, signed images with attestations, and a GitLab CI version.

## Prerequisites

- Basic knowledge of Git, a CI system (GitHub Actions or GitLab CI), Docker and Kubernetes manifests.
- A Linux, macOS or Windows (WSL) machine to run the tools locally. Apart from kube-bench in part 3 and the pipeline in part 4, every command in this guide runs without a cloud account or a Kubernetes cluster.

## Keep Learning

- [SAST Tools guide](/guides/sast-tools) and [Threat Modeling guide](/guides/threat-modeling)
- [CI/CD Pipeline Hardening: A Practical Guide to Securing Your Build Infrastructure](/posts/cicd-pipeline-hardening-guide)
- [Pre-commit Hooks for Security: Stop Secrets Before They Hit Your Repository](/posts/pre-commit-hooks-security-guide)
- [CI/CD Pipeline Setup Checklist](/checklists/cicd-pipeline-setup)
- [Interview question: security architecture and DevSecOps](/interview-questions/senior/security-architecture)
