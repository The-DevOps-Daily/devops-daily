---
title: "CI/CD Integration"
description: "Complete security gate orchestration across GitHub Actions, GitLab CI, and Jenkins"
---

# CI/CD Integration

Orchestrating multiple security gates in CI/CD pipelines requires careful sequencing, parallel execution, and failure handling to balance security with developer velocity.

## Complete Pipeline Architecture

```
Commit → PR Created
           ↓
    [✅ Parallel Static Analysis]
     ├─ Policy Gate (OPA/Kyverno)
     ├─ SAST (Semgrep)
     └─ Secret Scan (Gitleaks)
           ↓
    [✅ Build Stage]
     ├─ Build Docker image
     └─ Build artifacts
           ↓
    [✅ Parallel Security Scans]
     ├─ Vulnerability Scan (Trivy)
     ├─ Compliance Check (Checkov)
     └─ SBOM Generation (Syft)
           ↓
    [✅ Integration Tests]
     └─ Run test suite
           ↓
    [✅ Deployment Gate]
     ├─ Sign artifacts (Cosign)
     ├─ Verify SLSA provenance
     └─ Deploy to staging
```

## GitHub Actions Complete Example

```yaml
name: Security Gates Pipeline

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

permissions:
  contents: read
  packages: write
  security-events: write
  id-token: write  # For Cosign keyless signing

jobs:
  # Stage 1: Static Analysis (runs in parallel)
  policy-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup OPA
        uses: open-policy-agent/setup-opa@v2
      
      - name: Run policy checks
        run: |
          opa test policies/ -v
          opa eval -d policies/ -i kubernetes/deployment.yaml 'data.kubernetes.deny'
  
  sast-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Semgrep
        uses: semgrep/semgrep-action@v1
        with:
          config: auto
          generateSarif: true
      
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: semgrep.sarif
  
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for secret detection
      
      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  
  # Stage 2: Build
  build:
    runs-on: ubuntu-latest
    needs: [policy-gate, sast-scan, secret-scan]
    outputs:
      image-digest: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix={{branch}}-
            type=ref,event=pr
      
      - name: Build and push Docker image
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
  
  # Stage 3: Security Scans (runs in parallel)
  vulnerability-scan:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
      
      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'
  
  compliance-scan:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Checkov
        uses: bridgecrewio/checkov-action@master
        with:
          directory: .
          framework: terraform,kubernetes,dockerfile
          output_format: sarif
          output_file_path: checkov-results.sarif
          soft_fail: false
      
      - name: Upload Checkov results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: checkov-results.sarif
  
  sbom-generation:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Install Syft
        uses: anchore/sbom-action/download-syft@v0
      
      - name: Generate SBOM
        run: |
          syft ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            -o cyclonedx-json \
            > sbom.json
      
      - name: Upload SBOM artifact
        uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: sbom.json
          retention-days: 90
  
  # Stage 4: Integration Tests
  integration-tests:
    runs-on: ubuntu-latest
    needs: [vulnerability-scan, compliance-scan]
    steps:
      - uses: actions/checkout@v4
      
      - name: Run integration tests
        run: |
          docker-compose -f docker-compose.test.yml up --abort-on-container-exit
  
  # Stage 5: Deployment
  deploy:
    runs-on: ubuntu-latest
    needs: [integration-tests, sbom-generation]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Cosign
        uses: sigstore/cosign-installer@v3
      
      - name: Sign container image
        run: |
          cosign sign --yes ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}@${{ needs.build.outputs.image-digest }}
      
      - name: Download SBOM
        uses: actions/download-artifact@v4
        with:
          name: sbom
      
      - name: Attach SBOM to image
        run: |
          cosign attach sbom \
            --sbom sbom.json \
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}@${{ needs.build.outputs.image-digest }}
      
      - name: Deploy to staging
        run: |
          kubectl set image deployment/myapp \
            myapp=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}@${{ needs.build.outputs.image-digest }} \
            -n staging
```

## GitLab CI Complete Example

```yaml
stages:
  - static-analysis
  - build
  - security-scan
  - test
  - deploy

variables:
  DOCKER_REGISTRY: $CI_REGISTRY
  IMAGE_NAME: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

# Stage 1: Static Analysis
policy-gate:
  stage: static-analysis
  image: openpolicyagent/opa:latest
  script:
    - opa test policies/ -v
    - opa eval -d policies/ -i kubernetes/deployment.yaml 'data.kubernetes.deny'

sast-scan:
  stage: static-analysis
  image: semgrep/semgrep:latest
  script:
    - semgrep --config auto --sarif > semgrep.sarif
  artifacts:
    reports:
      sast: semgrep.sarif

secret-scan:
  stage: static-analysis
  image: zricethezav/gitleaks:latest
  script:
    - gitleaks detect --source . --verbose

# Stage 2: Build
build-image:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $IMAGE_NAME .
    - docker push $IMAGE_NAME
  needs:
    - policy-gate
    - sast-scan
    - secret-scan

# Stage 3: Security Scans
vulnerability-scan:
  stage: security-scan
  image: aquasec/trivy:latest
  script:
    - trivy image --exit-code 1 --severity CRITICAL,HIGH $IMAGE_NAME
    - trivy image --format json --output trivy-report.json $IMAGE_NAME
  artifacts:
    reports:
      container_scanning: trivy-report.json
  needs:
    - build-image

compliance-scan:
  stage: security-scan
  image: bridgecrew/checkov:latest
  script:
    - checkov -d . --framework terraform,kubernetes,dockerfile --compact
  needs:
    - build-image

sbom-generation:
  stage: security-scan
  image: anchore/syft:latest
  script:
    - syft $IMAGE_NAME -o cyclonedx-json > sbom.json
  artifacts:
    paths:
      - sbom.json
    expire_in: 90 days
  needs:
    - build-image

# Stage 4: Tests
integration-tests:
  stage: test
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker-compose -f docker-compose.test.yml up --abort-on-container-exit
  needs:
    - vulnerability-scan
    - compliance-scan

# Stage 5: Deploy
deploy-staging:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl config use-context staging
    - kubectl set image deployment/myapp myapp=$IMAGE_NAME -n staging
  needs:
    - integration-tests
    - sbom-generation
  only:
    - main
```

## Jenkins Complete Example

```groovy
pipeline {
    agent any
    
    environment {
        DOCKER_REGISTRY = 'ghcr.io'
        IMAGE_NAME = "${DOCKER_REGISTRY}/${env.JOB_NAME}:${env.BUILD_NUMBER}"
        SLACK_CHANNEL = '#security-alerts'
    }
    
    stages {
        stage('Static Analysis') {
            parallel {
                stage('Policy Gate') {
                    steps {
                        sh 'opa test policies/ -v'
                        sh 'opa eval -d policies/ -i kubernetes/deployment.yaml "data.kubernetes.deny"'
                    }
                }
                
                stage('SAST Scan') {
                    steps {
                        sh 'semgrep --config auto --sarif > semgrep.sarif'
                        recordIssues(
                            tools: [sarif(pattern: 'semgrep.sarif')],
                            qualityGates: [[threshold: 1, type: 'TOTAL_HIGH', unstable: true]]
                        )
                    }
                }
                
                stage('Secret Scan') {
                    steps {
                        sh 'gitleaks detect --source . --verbose'
                    }
                }
            }
        }
        
        stage('Build') {
            steps {
                script {
                    docker.withRegistry('https://ghcr.io', 'github-token') {
                        def customImage = docker.build(IMAGE_NAME)
                        customImage.push()
                    }
                }
            }
        }
        
        stage('Security Scans') {
            parallel {
                stage('Vulnerability Scan') {
                    steps {
                        sh """
                            trivy image --exit-code 1 --severity CRITICAL,HIGH ${IMAGE_NAME}
                            trivy image --format json --output trivy-report.json ${IMAGE_NAME}
                        """
                        archiveArtifacts artifacts: 'trivy-report.json'
                    }
                }
                
                stage('Compliance Scan') {
                    steps {
                        sh 'checkov -d . --framework terraform,kubernetes,dockerfile --compact'
                    }
                }
                
                stage('SBOM Generation') {
                    steps {
                        sh "syft ${IMAGE_NAME} -o cyclonedx-json > sbom.json"
                        archiveArtifacts artifacts: 'sbom.json'
                    }
                }
            }
        }
        
        stage('Integration Tests') {
            steps {
                sh 'docker-compose -f docker-compose.test.yml up --abort-on-container-exit'
            }
        }
        
        stage('Sign and Deploy') {
            when {
                branch 'main'
            }
            steps {
                script {
                    // Sign with Cosign
                    sh """
                        cosign sign --yes ${IMAGE_NAME}
                        cosign attach sbom --sbom sbom.json ${IMAGE_NAME}
                    """
                    
                    // Deploy to staging
                    sh """
                        kubectl set image deployment/myapp \
                            myapp=${IMAGE_NAME} \
                            -n staging
                    """
                }
            }
        }
    }
    
    post {
        failure {
            slackSend(
                channel: SLACK_CHANNEL,
                color: 'danger',
                message: "Security gate FAILED: ${env.JOB_NAME} ${env.BUILD_NUMBER} (<${env.BUILD_URL}|Open>)"
            )
        }
        success {
            slackSend(
                channel: SLACK_CHANNEL,
                color: 'good',
                message: "Security gates passed: ${env.JOB_NAME} ${env.BUILD_NUMBER}"
            )
        }
    }
}
```

## Gate Result Aggregation

### Custom Aggregation Script

```python
#!/usr/bin/env python3
# aggregate-results.py

import json
import sys
from pathlib import Path

def load_results():
    results = {
        'policy': json.loads(Path('policy-results.json').read_text()),
        'sast': json.loads(Path('sast-results.json').read_text()),
        'vulnerability': json.loads(Path('trivy-results.json').read_text()),
        'compliance': json.loads(Path('checkov-results.json').read_text()),
    }
    return results

def calculate_scores(results):
    scores = {}
    
    # Policy score
    policy = results['policy']
    scores['policy'] = {
        'passed': policy['passed'],
        'failed': policy['failed'],
        'score': policy['passed'] / (policy['passed'] + policy['failed']) * 100
    }
    
    # SAST score
    sast = results['sast']
    scores['sast'] = {
        'high': sast['results']['high'],
        'medium': sast['results']['medium'],
        'low': sast['results']['low'],
        'score': 100 if sast['results']['high'] == 0 else 0
    }
    
    # Vulnerability score
    vuln = results['vulnerability']
    critical = len([v for v in vuln['Results'][0]['Vulnerabilities'] if v['Severity'] == 'CRITICAL'])
    high = len([v for v in vuln['Results'][0]['Vulnerabilities'] if v['Severity'] == 'HIGH'])
    scores['vulnerability'] = {
        'critical': critical,
        'high': high,
        'score': 100 if critical == 0 and high == 0 else 0
    }
    
    # Compliance score
    comp = results['compliance']
    scores['compliance'] = {
        'passed': comp['summary']['passed'],
        'failed': comp['summary']['failed'],
        'score': comp['summary']['passed'] / (comp['summary']['passed'] + comp['summary']['failed']) * 100
    }
    
    return scores

def generate_report(scores):
    print("\n=== Security Gates Summary ===")
    print(f"\nPolicy Gate: {scores['policy']['score']:.1f}%")
    print(f"  Passed: {scores['policy']['passed']}")
    print(f"  Failed: {scores['policy']['failed']}")
    
    print(f"\nSAST Scan: {scores['sast']['score']:.1f}%")
    print(f"  High: {scores['sast']['high']}")
    print(f"  Medium: {scores['sast']['medium']}")
    print(f"  Low: {scores['sast']['low']}")
    
    print(f"\nVulnerability Scan: {scores['vulnerability']['score']:.1f}%")
    print(f"  Critical: {scores['vulnerability']['critical']}")
    print(f"  High: {scores['vulnerability']['high']}")
    
    print(f"\nCompliance Check: {scores['compliance']['score']:.1f}%")
    print(f"  Passed: {scores['compliance']['passed']}")
    print(f"  Failed: {scores['compliance']['failed']}")
    
    # Overall score
    overall = sum(s['score'] for s in scores.values()) / len(scores)
    print(f"\n=== Overall Score: {overall:.1f}% ===")
    
    return overall >= 80  # Pass if 80% or higher

if __name__ == '__main__':
    try:
        results = load_results()
        scores = calculate_scores(results)
        passed = generate_report(scores)
        sys.exit(0 if passed else 1)
    except Exception as e:
        print(f"Error aggregating results: {e}")
        sys.exit(1)
```

Use in CI:

```yaml
- name: Aggregate security results
  run: |
    python3 aggregate-results.py
  if: always()
```

## Notification Systems

### Slack Notifications

```bash
#!/bin/bash
# slack-notify.sh

STATUS="$1"  # pass/fail
GATE="$2"    # policy/sast/vulnerability/compliance
MESSAGE="$3"

if [ "$STATUS" == "fail" ]; then
    COLOR="danger"
    EMOJI=":x:"
else
    COLOR="good"
    EMOJI=":white_check_mark:"
fi

PAYLOAD=$( cat <<EOF
{
  "channel": "#security-gates",
  "username": "Security Bot",
  "icon_emoji": ":shield:",
  "attachments": [
    {
      "color": "$COLOR",
      "title": "$EMOJI Security Gate: $GATE",
      "text": "$MESSAGE",
      "fields": [
        {
          "title": "Repository",
          "value": "$GITHUB_REPOSITORY",
          "short": true
        },
        {
          "title": "Branch",
          "value": "$GITHUB_REF_NAME",
          "short": true
        },
        {
          "title": "Commit",
          "value": "<$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/commit/$GITHUB_SHA|$GITHUB_SHA>",
          "short": true
        },
        {
          "title": "Build",
          "value": "<$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID|#$GITHUB_RUN_NUMBER>",
          "short": true
        }
      ],
      "footer": "GitHub Actions",
      "ts": $(date +%s)
    }
  ]
}
EOF
)

curl -X POST "$SLACK_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
```

Use in GitHub Actions:

```yaml
- name: Notify Slack on failure
  if: failure()
  run: |
    ./slack-notify.sh fail "${{ matrix.gate }}" "Gate failed for commit ${{ github.sha }}"
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### PagerDuty Integration

```python
#!/usr/bin/env python3
# pagerduty-alert.py

import os
import sys
import requests

def create_incident(severity, summary, details):
    url = "https://api.pagerduty.com/incidents"
    headers = {
        "Authorization": f"Token token={os.environ['PAGERDUTY_TOKEN']}",
        "Content-Type": "application/json",
        "From": os.environ['PAGERDUTY_EMAIL']
    }
    
    payload = {
        "incident": {
            "type": "incident",
            "title": summary,
            "service": {
                "id": os.environ['PAGERDUTY_SERVICE_ID'],
                "type": "service_reference"
            },
            "urgency": "high" if severity == "critical" else "low",
            "body": {
                "type": "incident_body",
                "details": details
            }
        }
    }
    
    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    return response.json()

if __name__ == '__main__':
    severity = sys.argv[1]  # critical/high
    summary = sys.argv[2]
    details = sys.argv[3]
    
    incident = create_incident(severity, summary, details)
    print(f"Created incident: {incident['incident']['html_url']}")
```

## Override Workflows

### Manual Approval for Critical Violations

```yaml
# GitHub Actions
name: Security Gate with Manual Override

on: [pull_request]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run security gates
        id: gates
        continue-on-error: true
        run: |
          ./run-all-gates.sh
      
      - name: Check if manual override needed
        if: steps.gates.outcome == 'failure'
        uses: trstringer/manual-approval@v1
        with:
          secret: ${{ github.TOKEN }}
          approvers: security-team
          minimum-approvals: 2
          issue-title: "Security gate override required for PR #${{ github.event.pull_request.number }}"
          issue-body: |
            Security gates failed for this PR.
            
            **Repository**: ${{ github.repository }}
            **PR**: #${{ github.event.pull_request.number }}
            **Author**: @${{ github.event.pull_request.user.login }}
            **Branch**: ${{ github.head_ref }}
            
            Please review the security scan results and approve if acceptable.
```

### Temporary Exception Workflow

```yaml
name: Request Security Exception

on:
  workflow_dispatch:
    inputs:
      check_id:
        description: 'Check ID to skip (e.g., CKV_AWS_18)'
        required: true
      reason:
        description: 'Justification for exception'
        required: true
      expiry_date:
        description: 'Exception expiry date (YYYY-MM-DD)'
        required: true
      jira_ticket:
        description: 'JIRA ticket number'
        required: true

jobs:
  create-exception:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Add exception to .checkov.yaml
        run: |
          cat >> .checkov.yaml << EOF
          
          skip-check:
            - ${{ github.event.inputs.check_id }}
              # Reason: ${{ github.event.inputs.reason }}
              # Approved by: ${{ github.actor }}
              # Expires: ${{ github.event.inputs.expiry_date }}
              # Jira: ${{ github.event.inputs.jira_ticket }}
          EOF
      
      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v5
        with:
          title: "Security exception: ${{ github.event.inputs.check_id }}"
          body: |
            ## Security Exception Request
            
            **Check ID**: `${{ github.event.inputs.check_id }}`
            **Reason**: ${{ github.event.inputs.reason }}
            **Expires**: ${{ github.event.inputs.expiry_date }}
            **JIRA**: ${{ github.event.inputs.jira_ticket }}
            **Requested by**: @${{ github.actor }}
          branch: exception/${{ github.event.inputs.check_id }}
          labels: security-exception
          reviewers: security-team
```

## Best Practices

### 1. Fail Fast Strategy

Run fastest gates first:

```yaml
stages:
  - quick-checks    # <30s: Policy, secrets (fail fast)
  - build          # 2-5min: Build artifacts
  - deep-scans     # 5-10min: Vulnerability, compliance
  - deploy         # 2-5min: Sign and deploy
```

### 2. Cache Security Databases

```yaml
- name: Cache Trivy DB
  uses: actions/cache@v3
  with:
    path: ~/.cache/trivy
    key: trivy-db-${{ github.run_id }}
    restore-keys: trivy-db-

- name: Cache OPA bundles
  uses: actions/cache@v3
  with:
    path: ~/.opa/bundles
    key: opa-${{ hashFiles('policies/**') }}
```

### 3. Parallel Execution

```yaml
# Run independent gates in parallel
jobs:
  gate-1:
    runs-on: ubuntu-latest
  gate-2:
    runs-on: ubuntu-latest
  gate-3:
    runs-on: ubuntu-latest
  
  # Then aggregate
  aggregate:
    needs: [gate-1, gate-2, gate-3]
```

### 4. Metrics Collection

```bash
#!/bin/bash
# collect-metrics.sh

METRICS_ENDPOINT="https://metrics.company.com/api/gates"

curl -X POST "$METRICS_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"repository\": \"$GITHUB_REPOSITORY\",
    \"commit\": \"$GITHUB_SHA\",
    \"gate\": \"$GATE_NAME\",
    \"status\": \"$STATUS\",
    \"duration\": $DURATION_SECONDS,
    \"timestamp\": $(date +%s)
  }"
```

## Troubleshooting

### "Pipeline Takes Too Long"

**Problem**: Security gates add 20+ minutes to pipeline.

**Solution**: Run gates in parallel and cache dependencies:

```yaml
strategy:
  matrix:
    gate: [policy, sast, vulnerability, compliance]
jobs:
  security-gates:
    runs-on: ubuntu-latest
    strategy: ${{ strategy }}
    steps:
      - run: ./run-gate.sh ${{ matrix.gate }}
```

### "False Positives Block Deployment"

**Problem**: Known false positives require manual intervention.

**Solution**: Implement allow-list with expiry:

```yaml
# .security-exceptions.yaml
allowlist:
  - check: CKV_AWS_18
    expires: 2025-06-01
    approved_by: security-team
```

### "Conflicting Gate Results"

**Problem**: Trivy passes but Checkov fails on same issue.

**Solution**: Prioritize gates by authority:

```
Priority 1: Compliance gates (regulatory requirement)
Priority 2: Vulnerability gates (known CVEs)
Priority 3: Policy gates (internal standards)
Priority 4: SAST (potential issues)
```

## Next Steps

- [Policy as Code](/guides/security-gates/01-policy-as-code) - OPA and Kyverno policies
- [Vulnerability Gates](/guides/security-gates/02-vulnerability-gates) - CVE scanning
- [Compliance Gates](/guides/security-gates/03-compliance-gates) - Regulatory requirements
