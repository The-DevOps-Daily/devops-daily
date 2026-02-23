---
title: 'CI/CD Integration'
description: 'Automate DAST scans in your CI/CD pipeline. Learn to implement security gates, handle findings, and integrate with GitHub Actions, GitLab CI, and Jenkins.'
---

# CI/CD Integration

Automating DAST scans in your CI/CD pipeline catches security vulnerabilities before they reach production. This guide shows you how to integrate OWASP ZAP and Burp Suite into your deployment workflow with smart quality gates and failure policies.

## Integration Strategy

### When to Run DAST

```plaintext
Development → PR → Staging → Production
                ↑         ↑
            Passive  Active
             DAST     DAST
```

- **Pull Requests**: Quick baseline scan (5-10 min)
- **Staging Deploy**: Full active scan (30-60 min)
- **Production**: Passive monitoring only

### Scan Types by Environment

| Environment | Scan Type | Duration | Risk | Purpose |
|------------|-----------|----------|------|----------|
| **PR** | ZAP Baseline | 5-10 min | None | Fast feedback |
| **Staging** | ZAP Full Scan | 30-60 min | High | Comprehensive |
| **Production** | ZAP Baseline | 5-10 min | None | Monitoring |
| **Manual** | Burp Suite | Hours | High | Deep dive |

## GitHub Actions

### Basic ZAP Baseline Scan

```yaml
# .github/workflows/dast.yml
name: DAST Scan

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  zap_scan:
    runs-on: ubuntu-latest
    name: Security Scan
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Start Application
        run: |
          docker-compose up -d
          # Wait for app to be ready
          timeout 60 bash -c 'until curl -f http://localhost:3000/health; do sleep 2; done'
      
      - name: ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.10.0
        with:
          target: 'http://localhost:3000'
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'  # Include pass/info alerts
      
      - name: Upload ZAP Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: zap-scan-report
          path: report_html.html
```

### Advanced ZAP Full Scan with Quality Gates

```yaml
name: DAST Full Scan

on:
  push:
    branches: [main]

jobs:
  zap_full_scan:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Staging
        run: |
          ./deploy-staging.sh
          echo "STAGING_URL=https://staging.example.com" >> $GITHUB_ENV
      
      - name: Run ZAP Full Scan
        run: |
          docker run -v $(pwd):/zap/wrk/:rw \
            ghcr.io/zaproxy/zaproxy:stable zap-full-scan.py \
            -t ${{ env.STAGING_URL }} \
            -r zap-report.html \
            -J zap-report.json \
            -w zap-report.md \
            -z "-config api.maxchildren=5"
      
      - name: Parse ZAP Results
        id: zap_results
        run: |
          # Count severity levels
          HIGH=$(jq '[.site[].alerts[] | select(.riskcode=="3")] | length' zap-report.json)
          MEDIUM=$(jq '[.site[].alerts[] | select(.riskcode=="2")] | length' zap-report.json)
          echo "high=$HIGH" >> $GITHUB_OUTPUT
          echo "medium=$MEDIUM" >> $GITHUB_OUTPUT
      
      - name: Quality Gate
        if: steps.zap_results.outputs.high > 0
        run: |
          echo "::error::Found ${{ steps.zap_results.outputs.high }} high-severity vulnerabilities"
          exit 1
      
      - name: Comment PR with Results
        if: always() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('zap-report.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## DAST Scan Results\n\n${report}`
            });
      
      - name: Upload Reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: zap-reports
          path: |
            zap-report.html
            zap-report.json
            zap-report.md
```

### Authenticated Scanning

```yaml
- name: ZAP Scan with Authentication
  run: |
    # Create context file
    cat > zap-context.yaml << 'EOL'
    env:
      contexts:
        - name: "Staging App"
          urls:
            - "${{ env.STAGING_URL }}"
          authentication:
            method: "json"
            parameters:
              loginUrl: "${{ env.STAGING_URL }}/api/login"
              loginRequestData: '{"username":"{%username%}","password":"{%password%}"}'
            verification:
              method: "response"
              loggedInRegex: "\\Qtoken\\E"
          users:
            - name: "test_user"
              credentials:
                username: "${{ secrets.TEST_USERNAME }}"
                password: "${{ secrets.TEST_PASSWORD }}"
    EOL
    
    docker run -v $(pwd):/zap/wrk/:rw \
      ghcr.io/zaproxy/zaproxy:stable zap-full-scan.py \
      -t ${{ env.STAGING_URL }} \
      -n zap-context.yaml \
      -r zap-report.html
```

## GitLab CI

### Basic Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - test
  - security
  - deploy

dast_scan:
  stage: security
  image: ghcr.io/zaproxy/zaproxy:stable
  variables:
    TARGET_URL: "https://staging.example.com"
  script:
    - zap-baseline.py -t $TARGET_URL -r gl-dast-report.html -J gl-dast-report.json
  artifacts:
    when: always
    reports:
      dast: gl-dast-report.json
    paths:
      - gl-dast-report.html
    expire_in: 1 week
  allow_failure: false
  only:
    - main
    - develop
```

### GitLab DAST with Quality Gates

```yaml
dast_full_scan:
  stage: security
  image: ghcr.io/zaproxy/zaproxy:stable
  before_script:
    - apk add --no-cache jq
  script:
    # Run scan
    - zap-full-scan.py -t $TARGET_URL -r report.html -J report.json || true
    
    # Parse results
    - HIGH=$(jq '[.site[].alerts[] | select(.riskcode=="3")] | length' report.json)
    - MEDIUM=$(jq '[.site[].alerts[] | select(.riskcode=="2")] | length' report.json)
    
    # Quality gate
    - |
      if [ $HIGH -gt 0 ]; then
        echo "Found $HIGH high-severity vulnerabilities"
        exit 1
      fi
  artifacts:
    when: always
    paths:
      - report.html
      - report.json
  only:
    - main
```

## Jenkins

### Declarative Pipeline

```groovy
pipeline {
  agent any
  
  environment {
    TARGET_URL = 'https://staging.example.com'
    ZAP_IMAGE = 'ghcr.io/zaproxy/zaproxy:stable'
  }
  
  stages {
    stage('Deploy to Staging') {
      steps {
        sh './deploy-staging.sh'
      }
    }
    
    stage('DAST Scan') {
      steps {
        script {
          docker.image(env.ZAP_IMAGE).inside('-v $WORKSPACE:/zap/wrk:rw') {
            sh '''
              zap-full-scan.py \
                -t ${TARGET_URL} \
                -r zap-report.html \
                -J zap-report.json
            '''
          }
        }
      }
    }
    
    stage('Parse Results') {
      steps {
        script {
          def report = readJSON file: 'zap-report.json'
          def highAlerts = report.site[0].alerts.findAll { it.riskcode == '3' }.size()
          
          if (highAlerts > 0) {
            error("Found ${highAlerts} high-severity vulnerabilities")
          }
        }
      }
    }
  }
  
  post {
    always {
      publishHTML([
        reportDir: '.',
        reportFiles: 'zap-report.html',
        reportName: 'DAST Security Report'
      ])
    }
  }
}
```

## Quality Gates

### Severity-Based Thresholds

```bash
#!/bin/bash
# parse-zap-results.sh

REPORT="zap-report.json"

# Count by severity
CRITICAL=$(jq '[.site[].alerts[] | select(.riskcode=="3" and .confidence=="3")] | length' $REPORT)
HIGH=$(jq '[.site[].alerts[] | select(.riskcode=="3")] | length' $REPORT)
MEDIUM=$(jq '[.site[].alerts[] | select(.riskcode=="2")] | length' $REPORT)

echo "Critical: $CRITICAL"
echo "High: $HIGH"
echo "Medium: $MEDIUM"

# Set thresholds
if [ $CRITICAL -gt 0 ]; then
  echo "::error::Found $CRITICAL critical vulnerabilities"
  exit 1
elif [ $HIGH -gt 5 ]; then
  echo "::error::Found $HIGH high-severity vulnerabilities (threshold: 5)"
  exit 1
elif [ $MEDIUM -gt 20 ]; then
  echo "::warning::Found $MEDIUM medium-severity vulnerabilities (threshold: 20)"
  # Don't fail, just warn
fi

echo "Security scan passed"
```

### CWE-Based Filtering

```bash
#!/bin/bash
# Fail only on specific vulnerability types

BLOCKLIST=("89" "79" "22" "78")  # SQL Injection, XSS, Path Traversal, OS Command Injection

for CWE in "${BLOCKLIST[@]}"; do
  COUNT=$(jq "[.site[].alerts[] | select(.cweid==\"$CWE\")] | length" zap-report.json)
  if [ $COUNT -gt 0 ]; then
    echo "::error::Found $COUNT instances of CWE-$CWE"
    exit 1
  fi
done
```

## Handling False Positives

### ZAP Rules Configuration

```tsv
# .zap/rules.tsv
# Format: RULE_ID  ACTION  (IGNORE|WARN|FAIL)

# Ignore informational alerts
10021	IGNORE	(X-Content-Type-Options Header Missing)
10020	IGNORE	(X-Frame-Options Header Missing)

# Warn on medium severity
10055	WARN	(CSP: Wildcard Directive)

# Fail on high/critical
40012	FAIL	(Cross Site Scripting)
40018	FAIL	(SQL Injection)
```

Use it:

```yaml
- name: ZAP Scan
  uses: zaproxy/action-baseline@v0.10.0
  with:
    target: ${{ env.TARGET_URL }}
    rules_file_name: '.zap/rules.tsv'
```

### Context-Based Exclusions

```yaml
# zap-context.yaml
env:
  contexts:
    - name: "My App"
      urls:
        - "https://staging.example.com"
      excludePaths:
        - ".*/logout.*"
        - ".*/static/.*"
        - ".*/health.*"
      technology:
        exclude:
          - "PHP"  # We don't use PHP
```

## Best Practices

1. **Start passive, then active**
   - Begin with baseline scans on PRs
   - Add full scans on staging deploys
   - Never active scan production

2. **Use quality gates wisely**
   - Block critical/high vulnerabilities
   - Warn on medium
   - Ignore low/informational initially

3. **Tune your scans**
   - Disable irrelevant checks for your stack
   - Add authentication for better coverage
   - Exclude logout and destructive endpoints

4. **Make reports visible**
   - Upload HTML reports as artifacts
   - Comment on PRs with findings
   - Track metrics over time

5. **Set realistic timeouts**
   ```yaml
   - name: ZAP Scan
     timeout-minutes: 60  # Prevent hanging
   ```

6. **Cache ZAP Docker images**
   ```yaml
   - name: Pull ZAP image
     run: docker pull ghcr.io/zaproxy/zaproxy:stable
   ```

7. **Run parallel scans**
   - Scan multiple microservices concurrently
   - Use GitHub Actions matrix strategy

## Monitoring and Metrics

### Track Over Time

```bash
#!/bin/bash
# Store metrics in time-series database

HIGH=$(jq '[.site[].alerts[] | select(.riskcode=="3")] | length' zap-report.json)
MEDIUM=$(jq '[.site[].alerts[] | select(.riskcode=="2")] | length' zap-report.json)

# Send to monitoring system
curl -X POST https://metrics.example.com/dast \
  -d "high=$HIGH&medium=$MEDIUM&timestamp=$(date +%s)"
```

### Grafana Dashboard

Create dashboards tracking:
- Vulnerabilities over time (by severity)
- Mean time to remediate (MTTR)
- Scan duration trends
- False positive rate

## Troubleshooting

### Scan Takes Too Long

```yaml
# Reduce threads
-z "-config api.maxchildren=2"

# Set timeout
-m 30  # 30 minutes max

# Limit scope
-n context.yaml  # Only scan specific paths
```

### Out of Memory

```yaml
# Increase Docker memory
docker run -m 4g ghcr.io/zaproxy/zaproxy:stable ...

# Or use ZAP options
-z "-config scanner.threadPerHost=1"
```

### Authentication Fails

```bash
# Enable debug mode
zap-full-scan.py -t URL -d

# Check logs
docker logs <container_id>
```

## Next Steps

1. **Implement baseline scans** on all PRs
2. **Add full scans** to staging deployments
3. **Set up quality gates** based on your risk tolerance
4. **Track metrics** to measure improvement
5. **Iterate on tuning** to reduce false positives

---

**Congratulations!** You now have a comprehensive DAST strategy. Remember:
- DAST is one layer of defense
- Combine with SAST, dependency scanning, and IaC security
- Continuous improvement: tune scans based on findings
- Security is a journey, not a destination
