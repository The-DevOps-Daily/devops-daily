---
title: 'SonarQube SAST: Setup, Security Rules and Quality Gates'
description: 'Use SonarQube for SAST: editions, Docker setup, project scans, taint analysis, quality gates, and CI/CD with GitHub Actions, GitLab and Jenkins.'
order: 2
---

**TLDR**: SonarQube runs as a server (SonarQube Server or the free Community Build) or as a service (SonarQube Cloud). A scanner in your pipeline analyses the code and sends the results to it, and a **quality gate** decides whether the change passes. The free Community Build has the pattern-based security rules but no **taint analysis**, so it does not report injection flaws like SQL or command injection, and it only analyses the main branch. For pull request checks and injection detection you need Developer edition or higher, or SonarQube Cloud (its Free plan includes injection detection). Fail the pipeline with `sonar.qualitygate.wait=true`.

SonarQube started as a code quality tool and still is one: it reports bugs, maintainability problems, duplication and test coverage next to security issues, in one dashboard per project. That makes it a good fit when you want one place for "is this change good enough to merge", with security as one part of the answer.

In this part you choose an edition, run SonarQube locally with Docker Compose, scan the `notes-api` app from [Part 1](/guides/sast-tools/01-sast-fundamentals#h2-the-sample-app-used-in-this-guide), and fail a CI pipeline when the quality gate fails.

:::note
SonarQube needs a Java server with several GB of memory, so this guide did not run it. Configuration files are checked against SonarSource's documentation and source code, rule keys and titles come from SonarQube Cloud's public rules API, and every output shown is labelled as an example.
:::

## Prerequisites

- Docker with Docker Compose, and a Linux host (or Docker Desktop) with at least 4 GB of free memory for the server.
- The `notes-api` app from Part 1, in a Git repository.
- For the CI examples: a GitHub, GitLab or Jenkins project.

## SonarQube Products in 2026

SonarSource renamed its products in 2025. Older tutorials use the old names:

| Product                       | Old name                                                | What it is                                                                                      |
| ----------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **SonarQube Server**          | SonarQube Developer, Enterprise and Data Center Edition | Self-hosted, paid. A long-term active (LTA) release every six months; 2026.5 is the current LTA |
| **SonarQube Community Build** | SonarQube Community Edition                             | Self-hosted, free, a new release every month (26.10 in October 2026)                            |
| **SonarQube Cloud**           | SonarCloud                                              | SaaS. Free plan, Team plan, Enterprise plan, and a free plan for open source                    |
| **SonarQube for IDE**         | SonarLint                                               | Editor extensions for VS Code, JetBrains IDEs, Visual Studio and Eclipse                        |

For security testing, the edition matters more than for anything else:

| Feature                                           | Community Build  | Server Developer and up | Cloud Free                       | Cloud Team and up |
| ------------------------------------------------- | ---------------- | ----------------------- | -------------------------------- | ----------------- |
| Pattern-based security rules                      | Yes              | Yes                     | Yes                              | Yes               |
| Taint analysis (SQL, command and other injection) | No               | Yes                     | Yes                              | Yes               |
| Branch analysis                                   | Main branch only | All branches            | Main branch only                 | All branches      |
| Pull request analysis and decoration              | No               | Yes                     | Pull requests to the main branch | Yes               |
| Private code                                      | Yes              | Yes                     | Up to 50,000 lines               | By plan           |

Advanced Security (software composition analysis plus deeper SAST that follows data into third-party libraries) is a paid add-on, available from Server Enterprise edition and on Cloud Team and Enterprise.

If your code is on GitHub, GitLab, Bitbucket or Azure DevOps and may be analysed in the cloud, **SonarQube Cloud** is the quickest start: no server to run, and its Free plan already finds injection flaws. Self-host when your code cannot leave your network or you need the Server features.

## How SonarQube Works

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "CI pipeline", "icon": "gear", "tone": "slate" },
    { "label": "Scanner", "sub": "analyses code", "icon": "cpu", "tone": "blue" },
    { "label": "Server", "sub": "stores, applies gate", "icon": "server", "tone": "violet" },
    { "label": "Quality gate", "sub": "pass or fail", "icon": "check", "tone": "green" }
  ],
  "groups": [
    {
      "label": "SonarQube Server or Community Build",
      "sub": "Docker or Kubernetes",
      "icon": "server",
      "tone": "violet",
      "nodes": [
        { "label": "Web server", "sub": "UI and Web API :9000", "icon": "globe", "tone": "blue" },
        { "label": "Compute engine", "sub": "processes reports", "icon": "cpu", "tone": "amber" },
        { "label": "Search", "sub": "Elasticsearch", "icon": "activity", "tone": "slate" },
        { "label": "PostgreSQL", "sub": "projects, issues", "icon": "database", "tone": "green" }
      ]
    }
  ]
}
```

- The **scanner** runs where your code is: a CI job or a developer machine. It downloads the rules and the analyzers from the server, analyses the code locally, and uploads a report. The analysis happens in the scanner, but the report includes the source files, so the server can show the code next to each issue.
- The **compute engine** processes the report in the background, and the server then computes the quality gate status.
- The server keeps its data in **PostgreSQL** (versions 15 to 18 for current releases), SQL Server or Oracle, and its search index in an embedded Elasticsearch.

## Run SonarQube With Docker Compose

Elasticsearch inside SonarQube needs higher kernel limits than most Linux hosts have by default. On the Docker host (not inside a container), set them:

```bash
sudo sysctl -w vm.max_map_count=524288
sudo sysctl -w fs.file-max=131072
# make them permanent
printf 'vm.max_map_count=524288\nfs.file-max=131072\n' | sudo tee /etc/sysctl.d/99-sonarqube.conf
```

On Docker Desktop for macOS and Windows the virtual machine usually has suitable limits already. Then create `compose.yaml`, based on SonarSource's own example:

```yaml
services:
  sonarqube:
    image: sonarqube:26.10.0.133078-community
    read_only: true
    depends_on:
      db:
        condition: service_healthy
    environment:
      SONAR_JDBC_URL: jdbc:postgresql://db:5432/sonar
      SONAR_JDBC_USERNAME: sonar
      SONAR_JDBC_PASSWORD: ${SONAR_DB_PASSWORD:?set SONAR_DB_PASSWORD}
    volumes:
      - sonarqube_data:/opt/sonarqube/data
      - sonarqube_extensions:/opt/sonarqube/extensions
      - sonarqube_logs:/opt/sonarqube/logs
      - sonarqube_temp:/opt/sonarqube/temp
    tmpfs:
      - /tmp:size=256M,mode=1777
    ulimits:
      nofile:
        soft: 131072
        hard: 131072
    ports:
      - '9000:9000'

  db:
    image: postgres:18
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -d $${POSTGRES_DB} -U $${POSTGRES_USER}']
      interval: 10s
      timeout: 5s
      retries: 5
    environment:
      POSTGRES_USER: sonar
      POSTGRES_PASSWORD: ${SONAR_DB_PASSWORD:?set SONAR_DB_PASSWORD}
      POSTGRES_DB: sonar
    volumes:
      - postgresql:/var/lib/postgresql

volumes:
  sonarqube_data:
  sonarqube_extensions:
  sonarqube_logs:
  sonarqube_temp:
  postgresql:
```

- Pin the image tag. `sonarqube:community` follows the newest Community Build; for a paid edition use tags such as `2026.5-developer`. The old `lts` and `lts-community` tags are no longer updated.
- The database password comes from the environment (or a `.env` file next to `compose.yaml`) instead of the file. `$${...}` escapes `$` so the health check reads the variables inside the container.
- `read_only: true` and the `tmpfs` for `/tmp` follow SonarSource's example: everything SonarQube writes goes to the named volumes.
- The `postgres:18` image keeps its data under `/var/lib/postgresql`. With `postgres:17` or older, mount the volume at `/var/lib/postgresql/data` instead, or the data ends up in an anonymous volume.

Start it and wait until the server reports `UP`:

```bash
export SONAR_DB_PASSWORD='choose-a-long-random-password'
docker compose up -d
curl -s http://localhost:9000/api/system/status
```

Example response once the server is ready (it says `STARTING` for the first minute or two):

```text
{"id":"...","version":"26.10.0.133078","status":"UP"}
```

Open `http://localhost:9000`, log in as `admin` with the password `admin`, and set a new password when SonarQube asks for one.

## Analyse Your First Project

### Create the project and a token

1. Click **Create Project**, then **Local project**.
2. Enter the display name `notes-api` and the project key `notes-api`, and set the main branch name.
3. Choose how SonarQube decides what **new code** is (the previous version, a number of days, or a reference branch). Quality gates judge new code, so this choice matters. "Previous version" works well if you change `sonar.projectVersion` at each release (see the properties file below); otherwise pick a number of days.
4. Choose **Locally** as the analysis method and generate a **project analysis token**. It can only analyse this one project, which is safer than a personal (user) token in CI.

Store the token in an environment variable, not in a file in the repository:

```bash
export SONAR_TOKEN='sqp_...'
export SONAR_HOST_URL='http://localhost:9000'
```

### Configure the analysis

Create `sonar-project.properties` in the root of `notes-api`:

```properties
sonar.projectKey=notes-api
sonar.projectName=notes-api
# Change this at each release; the "previous version" new code definition uses it
sonar.projectVersion=1.0.0

# What to analyse
sonar.sources=.
sonar.exclusions=semgrep-rules/**,tests/**
sonar.tests=tests
sonar.python.version=3.12

# Test coverage from pytest-cov (pytest --cov --cov-report=xml)
sonar.python.coverage.reportPaths=coverage.xml
```

Exclude test code from `sonar.sources` and list it in `sonar.tests`: SonarQube then applies test rules to it and does not count it as production code. If you do not have tests yet, remove the `sonar.tests` and coverage lines, because the scanner fails when a configured folder does not exist.

### Run the scanner

Pick one of three scanners; all of them read `sonar-project.properties` and the `SONAR_TOKEN` and `SONAR_HOST_URL` variables:

```tabs
{
  "title": "Run a SonarQube analysis",
  "tabs": [
    {
      "label": "SonarScanner CLI",
      "lang": "bash",
      "code": "# macOS: brew install sonar-scanner\n# Linux and Windows: download the zip from the SonarScanner CLI docs and add bin/ to PATH\nsonar-scanner -Dsonar.qualitygate.wait=true"
    },
    {
      "label": "Docker",
      "lang": "bash",
      "code": "# --network host lets the container reach SonarQube on localhost (Linux)\ndocker run --rm --network host \\\n  -e SONAR_TOKEN -e SONAR_HOST_URL \\\n  -v \"$PWD:/usr/src\" \\\n  sonarsource/sonar-scanner-cli:12.2 -Dsonar.qualitygate.wait=true"
    },
    {
      "label": "pysonar (Python)",
      "lang": "bash",
      "code": "# SonarScanner for Python, published on PyPI\npipx install pysonar\npysonar --sonar-qualitygate-wait"
    }
  ]
}
```

The scanner needs Java 21. The CLI zip and the Docker image include a Java runtime, and current scanners can also download the right runtime from the server, so you rarely install Java yourself. When the analysis finishes, the scanner prints a link to the project dashboard. `sonar.qualitygate.wait=true` makes it wait until the server has processed the report, print the quality gate status, and exit with an error if the gate fails, which is what you want in CI.

## What SonarQube Reports for notes-api

These rules in the built-in **Sonar way** quality profile cover the flaws in `notes-api`. Rule keys and titles are from SonarQube Cloud's rules API (October 2026); the injection rules belong to the taint analysis engine:

| Line   | Flaw                  | Rule                                                                                                                                                   | Community Build     |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| 8      | Hard-coded secret key | `python:S6779` Flask secret keys should not be disclosed                                                                                               | Yes                 |
| 19     | SQL injection         | `pythonsecurity:S3649` Database queries should not be vulnerable to injection attacks                                                                  | No (taint analysis) |
| 33, 44 | Command injection     | `pythonsecurity:S2076` OS commands should not be vulnerable to command injection attacks                                                               | No (taint analysis) |
| 48     | MD5 for passwords     | `python:S4790` Weak hashing algorithms should not be used, `python:S5344` Passwords should not be stored in plaintext or with a fast hashing algorithm | Yes                 |
| 52     | Debug mode            | `python:S4507` Debugging features should not be enabled in production                                                                                  | Yes                 |

This is the practical meaning of the edition table: a Community Build scan of `notes-api` can pass the hard-coded key, MD5 and debug checks to you, but stays silent on the two most dangerous bugs, the SQL and command injections.

### Issues, severities and modes

New installations use **Multi-Quality Rule (MQR) mode**. Each issue has an impact on one or more software qualities (**Security**, **Reliability**, **Maintainability**) with a severity of **Blocker**, **High**, **Medium**, **Low** or **Info**. Instances upgraded from old versions may still use **Standard Experience**, with the older types (Bug, Vulnerability, Code Smell) and severities (Blocker, Critical, Major, Minor, Info). An administrator can switch modes; the rules are the same.

**Security Hotspots** were code that needed a human to decide whether it was a problem, such as a weak hash that might not protect anything sensitive. SonarSource is phasing them out: since SonarQube Server 2026.4, rules that raised hotspots raise vulnerabilities (Standard Experience) or security issues (MQR mode) instead. Existing hotspots stay visible, and the Sonar way gate still requires new hotspots to be reviewed.

### Handle false positives

- In the UI, open the issue and change its status to **Accept** (a real issue you will not fix now) or **False positive**, with a comment. The decision is kept for later analyses.
- In code, `# NOSONAR` at the end of a line suppresses every issue on that line. Use it sparingly: it hides new rules on the same line too, and reviewers cannot see the reason unless you write one.
- Exclude generated or vendored code with `sonar.exclusions`, and skip specific rules for specific paths with **Project Settings**, **Analysis Scope**, **Ignore Issues on Multiple Criteria**.

## Quality Gates

A **quality gate** is a set of conditions that an analysis must meet. The built-in **Sonar way** gate checks new code only:

| Condition                              | Fails when                        |
| -------------------------------------- | --------------------------------- |
| No new issues are introduced           | New issues > 0                    |
| All new Security Hotspots are reviewed | Security Hotspots reviewed < 100% |
| New code test coverage                 | Coverage on new code < 80%        |
| Duplication in new code                | Duplicated lines on new code > 3% |

The coverage and duplication conditions are ignored while there are fewer than 20 new lines, so a one-line fix does not fail on coverage. Focusing on new code is what makes the gate usable on an old codebase: the backlog does not block every change, but nothing new gets in.

Start with Sonar way. If you need a different gate, copy it (**Quality Gates**, **Copy**), change the conditions, and assign the copy to your projects. A common security-focused variant adds a condition on the security rating of new code and relaxes coverage for projects that are still adding tests.

Check a project's gate status from scripts with the Web API. Use a token with the `Authorization: Bearer` header:

```bash
curl -s -H "Authorization: Bearer $SONAR_TOKEN" \
  "$SONAR_HOST_URL/api/qualitygates/project_status?projectKey=notes-api"
```

Example response (shortened; the format is from the SonarQube Web API, the values are illustrative):

```text
{
  "projectStatus": {
    "status": "ERROR",
    "conditions": [
      { "status": "ERROR", "metricKey": "new_violations", "comparator": "GT", "errorThreshold": "0", "actualValue": "3" },
      { "status": "OK", "metricKey": "new_security_hotspots_reviewed", "comparator": "LT", "errorThreshold": "100" },
      { "status": "OK", "metricKey": "new_coverage", "comparator": "LT", "errorThreshold": "80", "actualValue": "84.0" },
      { "status": "OK", "metricKey": "new_duplicated_lines_density", "comparator": "GT", "errorThreshold": "3", "actualValue": "0.0" }
    ]
  }
}
```

## Run SonarQube in CI/CD

In CI, the scanner needs the full Git history (for blame data and new code detection), a token in a secret, and the server URL. The examples are templates for a Python project that has a `requirements.txt` and pytest tests that write `coverage.xml`. The `notes-api` sample has neither, so for it drop the test step and the `sonar.tests` and coverage properties.

### GitHub Actions

```yaml
name: SonarQube

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  sonarqube:
    runs-on: ubuntu-latest
    # Secrets are not available to Dependabot or to pull requests from forks
    if: >-
      github.actor != 'dependabot[bot]' &&
      (github.event_name == 'push' ||
      github.event.pull_request.head.repo.full_name == github.repository)
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0 # full history for blame and new code detection

      - uses: actions/setup-python@v7
        with:
          python-version: '3.12'

      - name: Run tests with coverage
        run: |
          pip install -r requirements.txt pytest pytest-cov
          pytest --cov=. --cov-report=xml

      - name: SonarQube scan
        uses: SonarSource/sonarqube-scan-action@v8
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ vars.SONAR_HOST_URL }}
        with:
          args: >
            -Dsonar.qualitygate.wait=true
```

- `SONAR_HOST_URL` is a repository variable, not a secret, because it is not sensitive. For SonarQube Cloud, drop it and set `sonar.organization` in `sonar-project.properties`.
- Since v8, the action verifies the scanner's signature by default. On self-hosted runners that means `gpg` must be installed; the `skipSignatureVerification` input turns the check off if you cannot install it.
- `SonarSource/sonarcloud-github-action` is archived. Use `sonarqube-scan-action` for both SonarQube Server and SonarQube Cloud.
- Community Build has no branch or pull request analysis, so every scan is stored as the main branch and a pull request scan would mix its results into it. With Community Build, run the job on pushes to `main` only; use Developer edition or SonarQube Cloud for pull request checks.

### GitLab CI

```yaml
# .gitlab-ci.yml
stages: [test, analyze]

test:
  stage: test
  image: python:3.12
  rules: # same rules as the scan job, so `needs` always finds this job
    - if: $CI_COMMIT_REF_NAME == $CI_DEFAULT_BRANCH || $CI_PIPELINE_SOURCE == "merge_request_event"
  script:
    - pip install -r requirements.txt pytest pytest-cov
    - pytest --cov=. --cov-report=xml
  artifacts:
    paths:
      - coverage.xml

sonarqube-check:
  stage: analyze
  needs: [test] # also downloads coverage.xml
  image:
    name: sonarsource/sonar-scanner-cli:12.2
    entrypoint: ['']
  variables:
    SONAR_USER_HOME: '${CI_PROJECT_DIR}/.sonar' # analysis cache
    GIT_DEPTH: '0' # full history
  cache:
    key: '${CI_JOB_NAME}'
    paths:
      - .sonar/cache
  script:
    - sonar-scanner -Dsonar.qualitygate.wait=true
  allow_failure: false
  rules:
    - if: $CI_COMMIT_REF_NAME == $CI_DEFAULT_BRANCH || $CI_PIPELINE_SOURCE == "merge_request_event"
```

Define `SONAR_TOKEN` (masked) and `SONAR_HOST_URL` as CI/CD variables in the GitLab project. To show results in merge requests, SonarQube Server (Developer edition and up) has a GitLab integration under **Administration**, **DevOps Platform Integrations**.

### Jenkins

Install the **SonarQube Scanner** plugin, add the server under **Manage Jenkins**, **System** (name it `SonarQube`, with the token as a secret text credential), and add the scanner under **Tools** (name it `SonarScanner`). In SonarQube, add a webhook to `https://<your-jenkins>/sonarqube-webhook/` so Jenkins learns the gate result without polling:

```groovy
// Jenkinsfile
pipeline {
    agent any

    stages {
        stage('Test') {
            steps {
                sh 'python3 -m pip install -r requirements.txt pytest pytest-cov'
                sh 'python3 -m pytest --cov=. --cov-report=xml'
            }
        }

        stage('SonarQube analysis') {
            steps {
                script {
                    def scannerHome = tool 'SonarScanner'
                    withSonarQubeEnv('SonarQube') {
                        sh "${scannerHome}/bin/sonar-scanner"
                    }
                }
            }
        }

        stage('Quality gate') {
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }
    }
}
```

`withSonarQubeEnv` passes the server URL and token to the scanner, and `waitForQualityGate` fails the build when the gate fails. For Maven or Gradle projects, use the Sonar Maven or Gradle plugin inside `withSonarQubeEnv` instead of the CLI.

## SonarQube for IDE

SonarQube for IDE runs many of the same rules in VS Code, JetBrains IDEs, Visual Studio and Eclipse as you type. In **connected mode** it uses the quality profile of your SonarQube Server or Cloud project and shows which issues are already accepted or marked as false positives, so the editor and the pipeline agree.

## Troubleshooting

- **The server stops right after start, and the log mentions `vm.max_map_count`.** Elasticsearch's bootstrap checks failed: set the kernel limits from the [Docker Compose section](#h2-run-sonarqube-with-docker-compose) on the Docker host.
- **`Not authorized` or HTTP 401 from the scanner.** The token is missing, expired, or a project token for a different project. Current versions use `sonar.token` or `SONAR_TOKEN`; `sonar.login` is deprecated and no longer works on SonarQube Cloud.
- **Warnings about a shallow clone, or every line counted as new code.** The CI checkout has no history. Use `fetch-depth: 0` (GitHub) or `GIT_DEPTH: "0"` (GitLab).
- **Out of memory in the scanner.** Raise the scanner's heap, for example `SONAR_SCANNER_JAVA_OPTS="-Xmx2g"`, and exclude generated and vendored code.
- **No injection findings at all.** Check your edition: taint analysis is not in Community Build.

## Common Mistakes

- **Choosing Community Build for security testing without knowing it has no taint analysis.** It will not report SQL or command injection. Use Developer edition, SonarQube Cloud, or add Semgrep and CodeQL for those flaws.
- **Not failing the pipeline.** Without `sonar.qualitygate.wait=true` (or `waitForQualityGate` in Jenkins), a failed gate is only visible on the dashboard.
- **Gating on overall code instead of new code.** The backlog then fails every change. Keep the conditions on new code.
- **Personal tokens in CI.** Use project analysis tokens and store them as CI secrets.
- **Shallow clones.** Without history SonarQube cannot tell new code from old.
- **Default database password and an exposed port 9000.** Put the server behind TLS and authentication like any other internal tool.

## Summary

- SonarQube Server, Community Build, Cloud and for IDE are the 2025 names; Community Build is free but has no taint analysis and analyses the main branch only.
- Docker Compose with PostgreSQL and raised kernel limits runs a local server; the scanner (CLI, Docker or pysonar) analyses the code and uploads the report.
- On `notes-api`, the pattern rules cover the secret key, MD5 and debug mode; SQL and command injection need taint analysis.
- The Sonar way gate fails on any new issue, unreviewed hotspots, less than 80% coverage or more than 3% duplication on new code.
- `sonar.qualitygate.wait=true` turns the gate into a CI failure in GitHub Actions and GitLab; Jenkins uses `waitForQualityGate`.

In [Part 3](/guides/sast-tools/03-semgrep), you scan the same app with Semgrep and write rules of your own.

## Keep Learning

- [Security Gates guide](/guides/security-gates), for policies across several scanners
- [CI/CD Pipeline Setup Checklist](/checklists/cicd-pipeline-setup)
- [Introduction to Docker](/guides/introduction-to-docker), for the Compose setup
- [Interview question: CI/CD pipeline design](/interview-questions/mid/cicd-pipeline-design)
