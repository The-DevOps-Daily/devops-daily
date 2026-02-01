---
title: 'SonarQube'
description: 'Set up SonarQube for comprehensive code quality and security analysis. Learn configuration, quality gates, and CI/CD integration.'
---

SonarQube is an open-source platform for continuous code quality and security inspection. It analyzes source code for bugs, vulnerabilities, and code smells across 30+ programming languages, making it a popular choice for enterprise DevSecOps pipelines.

## SonarQube Architecture

SonarQube consists of three main components:

```
+------------------+      +------------------+      +------------------+
|   SonarScanner   | ---> |   SonarQube      | ---> |    Database      |
|   (CI Runner)    |      |   Server         |      |   (PostgreSQL)   |
+------------------+      +------------------+      +------------------+
      Analyzes             Processes                Stores
      source code          results                  history
```

- **SonarScanner** — Runs in your CI/CD pipeline, analyzes code, sends results to server
- **SonarQube Server** — Web interface, API, rule engine, and compute engine
- **Database** — PostgreSQL, Oracle, or SQL Server (not embedded H2 for production)

## Setting Up SonarQube with Docker

The fastest way to get started is with Docker:

```bash
# Create a network for SonarQube and PostgreSQL
docker network create sonarnet

# Start PostgreSQL database
docker run -d --name sonar-postgres \\
  --network sonarnet \\
  -e POSTGRES_USER=sonar \\
  -e POSTGRES_PASSWORD=sonar_password \\
  -e POSTGRES_DB=sonarqube \\
  -v sonar_postgres_data:/var/lib/postgresql/data \\
  postgres:15-alpine

# Start SonarQube server
docker run -d --name sonarqube \\
  --network sonarnet \\
  -p 9000:9000 \\
  -e SONAR_JDBC_URL=jdbc:postgresql://sonar-postgres:5432/sonarqube \\
  -e SONAR_JDBC_USERNAME=sonar \\
  -e SONAR_JDBC_PASSWORD=sonar_password \\
  -v sonar_data:/opt/sonarqube/data \\
  -v sonar_extensions:/opt/sonarqube/extensions \\
  -v sonar_logs:/opt/sonarqube/logs \\
  sonarqube:lts-community
```

**Important:** Wait 1-2 minutes for SonarQube to initialize, then access `http://localhost:9000`.

Default credentials: `admin` / `admin` (change immediately after first login).

### Docker Compose Setup

For a more maintainable setup, use Docker Compose:

```yaml
# docker-compose.yml
version: '3.8'

services:
  sonarqube:
    image: sonarqube:lts-community
    container_name: sonarqube
    depends_on:
      - db
    ports:
      - "9000:9000"
    environment:
      SONAR_JDBC_URL: jdbc:postgresql://db:5432/sonarqube
      SONAR_JDBC_USERNAME: sonar
      SONAR_JDBC_PASSWORD: sonar_password
    volumes:
      - sonarqube_data:/opt/sonarqube/data
      - sonarqube_extensions:/opt/sonarqube/extensions
      - sonarqube_logs:/opt/sonarqube/logs
    ulimits:
      nofile:
        soft: 65536
        hard: 65536

  db:
    image: postgres:15-alpine
    container_name: sonar-postgres
    environment:
      POSTGRES_USER: sonar
      POSTGRES_PASSWORD: sonar_password
      POSTGRES_DB: sonarqube
    volumes:
      - postgresql_data:/var/lib/postgresql/data

volumes:
  sonarqube_data:
  sonarqube_extensions:
  sonarqube_logs:
  postgresql_data:
```

Start with `docker compose up -d`.

## Configuring Your First Project

### Step 1: Create a Project in SonarQube

1. Log into SonarQube at `http://localhost:9000`
2. Click **Create Project** > **Manually**
3. Enter a project key (e.g., `my-webapp`) and display name
4. Choose **Locally** for the analysis method (for initial setup)
5. Generate a token and save it securely

### Step 2: Create sonar-project.properties

In your project root, create a configuration file:

```properties
# sonar-project.properties

# Required: Unique project identifier
sonar.projectKey=my-webapp

# Optional but recommended
sonar.projectName=My Web Application
sonar.projectVersion=1.0.0

# Source code location (relative to this file)
sonar.sources=src

# Test code location
sonar.tests=tests

# Exclude files from analysis
sonar.exclusions=**/node_modules/**,**/vendor/**,**/*.min.js

# Language-specific settings (for Python example)
sonar.python.version=3.11

# Coverage report location (if using coverage tools)
sonar.python.coverage.reportPaths=coverage.xml
```

### Step 3: Run the Scanner

Install and run SonarScanner:

```bash
# Install SonarScanner (macOS)
brew install sonar-scanner

# Or download from sonarqube.org and add to PATH

# Run the scan
sonar-scanner \\
  -Dsonar.host.url=http://localhost:9000 \\
  -Dsonar.token=your_generated_token
```

After the scan completes, view results in the SonarQube web interface.

## Understanding SonarQube Metrics

SonarQube categorizes issues into several types:

### Issue Types

| Type | Description | Example |
|------|-------------|---------|
| **Bug** | Code that is demonstrably wrong | Null pointer dereference |
| **Vulnerability** | Security weakness | SQL injection, XSS |
| **Code Smell** | Maintainability issue | Duplicate code, long methods |
| **Security Hotspot** | Needs manual review | Hardcoded IP address |

### Severity Levels

| Severity | Description |
|----------|-------------|
| **Blocker** | Must be fixed immediately |
| **Critical** | High impact, fix soon |
| **Major** | Significant issue |
| **Minor** | Low impact |
| **Info** | Informational only |

### Key Metrics

```
+-----------------------------------------------+
|            Quality Gate: PASSED               |
+-----------------------------------------------+
|  Bugs: 3          Vulnerabilities: 1          |
|  Code Smells: 47  Security Hotspots: 5        |
+-----------------------------------------------+
|  Coverage: 78%    Duplications: 2.3%          |
+-----------------------------------------------+
```

- **Coverage** — Percentage of code covered by tests
- **Duplications** — Percentage of duplicated code blocks
- **Technical Debt** — Estimated time to fix all code smells

## Quality Gates

Quality Gates define the minimum quality standards for your project. If code fails the gate, the build should fail.

### Default Quality Gate

SonarQube's default "Sonar way" quality gate requires:

- No new bugs
- No new vulnerabilities
- All security hotspots reviewed
- Code coverage on new code >= 80%
- Duplications on new code < 3%

### Creating Custom Quality Gates

1. Go to **Quality Gates** in the SonarQube UI
2. Click **Create**
3. Add conditions:

```
Condition: Coverage on New Code
Operator: is less than
Value: 80%
Status: Error
```

Example custom quality gate for security-focused projects:

| Condition | Operator | Value | Status |
|-----------|----------|-------|--------|
| New Bugs | is greater than | 0 | Error |
| New Vulnerabilities | is greater than | 0 | Error |
| New Security Hotspots Reviewed | is less than | 100% | Error |
| New Code Coverage | is less than | 70% | Warning |

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/sonarqube.yml
name: SonarQube Analysis

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  sonarqube:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for blame information

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies and run tests
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov
          pytest --cov=src --cov-report=xml

      - name: SonarQube Scan
        uses: SonarSource/sonarqube-scan-action@v5
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
```

### GitLab CI

```yaml
# .gitlab-ci.yml
sonarqube-check:
  stage: test
  image: sonarsource/sonar-scanner-cli:latest
  variables:
    SONAR_USER_HOME: "${CI_PROJECT_DIR}/.sonar"
    GIT_DEPTH: "0"
  cache:
    key: "${CI_JOB_NAME}"
    paths:
      - .sonar/cache
  script:
    - sonar-scanner
        -Dsonar.projectKey=${CI_PROJECT_PATH_SLUG}
        -Dsonar.host.url=${SONAR_HOST_URL}
        -Dsonar.token=${SONAR_TOKEN}
  allow_failure: true
  rules:
    - if: $CI_PIPELINE_SOURCE == 'merge_request_event'
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        SONAR_TOKEN = credentials('sonar-token')
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Build & Test') {
            steps {
                sh 'mvn clean verify'
            }
        }
        
        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh 'mvn sonar:sonar'
                }
            }
        }
        
        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }
    }
}
```

## Security Rules Deep Dive

SonarQube includes extensive security rules based on OWASP, CWE, and SANS standards.

### Vulnerability Categories

| Category | CWE | Example Rule |
|----------|-----|-------------|
| Injection | CWE-89 | SQL queries should not be vulnerable to injection |
| XSS | CWE-79 | HTTP responses should not be vulnerable to XSS |
| CSRF | CWE-352 | Server-side requests should not be vulnerable to forging |
| Hardcoded Secrets | CWE-798 | Credentials should not be hardcoded |
| Weak Crypto | CWE-327 | Cryptographic algorithms should be secure |

### Viewing Security Reports

1. Navigate to your project in SonarQube
2. Click **Security Reports** in the left menu
3. View reports by:
   - **OWASP Top 10** — Categorized by OWASP 2021 risks
   - **CWE Top 25** — Most dangerous software weaknesses
   - **Security Hotspots** — Code requiring manual security review

### Customizing Security Rules

```
Administration > Quality Profiles > [Your Profile] > Activate More Rules
```

Filter by:
- **Tag:** security, vulnerability, cwe-top-25
- **Type:** Vulnerability, Security Hotspot
- **Severity:** Blocker, Critical

## Best Practices

### 1. Start with the Default Quality Gate

SonarQube's "Sonar way" gate is well-calibrated. Customize only after understanding your project's needs.

### 2. Focus on New Code

Don't try to fix all legacy issues at once. SonarQube's "Clean as You Code" approach focuses on keeping new code clean.

### 3. Review Security Hotspots Regularly

Hotspots are not confirmed vulnerabilities—they require human judgment. Schedule weekly reviews.

### 4. Integrate with Pull Requests

Block merges that fail the quality gate. This prevents new vulnerabilities from entering the main branch.

### 5. Exclude Generated Code

Don't waste time analyzing auto-generated files:

```properties
# sonar-project.properties
sonar.exclusions=**/generated/**,**/migrations/**,**/*.min.js
```

## SonarQube Editions

| Feature | Community | Developer | Enterprise |
|---------|-----------|-----------|------------|
| Price | Free | Paid | Paid |
| Languages | 19+ | 24+ | 30+ |
| Branch Analysis | Main only | All branches | All branches |
| PR Decoration | No | Yes | Yes |
| SAST Depth | Basic | Advanced | Advanced |
| Portfolio Mgmt | No | No | Yes |

Community Edition is sufficient for most open-source projects. Developer Edition adds branch analysis and PR integration essential for enterprise workflows.

## Troubleshooting

### Common Issues

**Scanner cannot connect to server:**
```bash
# Check server is running
curl -s http://localhost:9000/api/system/status | jq

# Verify token is valid
curl -u your_token: http://localhost:9000/api/projects/search
```

**Out of memory during analysis:**
```bash
# Increase scanner memory
export SONAR_SCANNER_OPTS="-Xmx2048m"
sonar-scanner
```

**Analysis takes too long:**
```properties
# Limit scope in sonar-project.properties
sonar.exclusions=**/test/**,**/docs/**
sonar.cpd.exclusions=**/test/**
```

## Key Takeaways

1. **SonarQube provides comprehensive analysis** — Bugs, vulnerabilities, code smells, and coverage in one platform
2. **Quality Gates enforce standards** — Block merges that don't meet your security requirements
3. **CI/CD integration is essential** — Automate analysis on every commit
4. **Focus on new code** — Don't get overwhelmed by legacy issues
5. **Review Security Hotspots** — These require human judgment, not automated fixes

Next, we'll explore Semgrep for fast, customizable security scanning.
