---
title: 'GitHub Dependabot'
description: 'Configure GitHub Dependabot for automated vulnerability alerts, security updates, and version updates with zero additional cost.'
---

Dependabot is GitHub's built-in dependency management tool. It automatically detects vulnerable dependencies and creates pull requests with fixes—all for free. If you're using GitHub, Dependabot should be your first line of defense.

## What Dependabot Does

Dependabot provides three services:

| Feature | Description | Automatic |
|---------|-------------|----------|
| **Dependabot Alerts** | Notifies you of vulnerable dependencies | Yes (enabled by default for public repos) |
| **Dependabot Security Updates** | Creates PRs to fix vulnerable dependencies | Configurable |
| **Dependabot Version Updates** | Keeps all dependencies up-to-date | Configurable |

## Enabling Dependabot

### For Public Repositories

Dependabot alerts are enabled by default. To enable security updates:

1. Go to **Settings** -> **Code security and analysis**
2. Enable **Dependabot security updates**

### For Private Repositories

1. Go to **Settings** -> **Code security and analysis**
2. Enable **Dependency graph** (required)
3. Enable **Dependabot alerts**
4. Enable **Dependabot security updates**

### Organization-Wide

Organization admins can enable Dependabot for all repositories:

1. Go to **Organization Settings** -> **Code security and analysis**
2. Click **Enable all** for each Dependabot feature

## Dependabot Alerts

When a vulnerability is found in your dependencies, Dependabot:

1. Creates an alert in the **Security** tab
2. Sends email/notification to repository watchers
3. Shows a banner on the repository page

### Viewing Alerts

Navigate to **Security** -> **Dependabot alerts** to see all vulnerabilities.

Each alert includes:
- Severity rating (Critical/High/Medium/Low)
- CVE/GHSA identifier
- Affected versions and fixed version
- Dependency path (how the vulnerable package is included)

### Dismissing Alerts

If a vulnerability doesn't affect your usage, you can dismiss it:

1. Open the alert
2. Click **Dismiss alert**
3. Select a reason:
   - **This alert is inaccurate or incorrect**
   - **This code is used in tests only**
   - **This code is not used**
   - **Risk is tolerable for this project**

Dismissed alerts are tracked for audit purposes.

## Security Updates (Automatic Fix PRs)

When enabled, Dependabot automatically creates pull requests to fix vulnerable dependencies.

### How It Works

1. Dependabot detects a vulnerability in `lodash@4.17.15`
2. It determines `4.17.21` fixes the vulnerability
3. Creates a PR updating `package.json` and `package-lock.json`
4. PR includes:
   - Changelog excerpt
   - Compatibility score (based on other projects' success)
   - Release notes

### Interacting with Dependabot PRs

Comment commands on the PR:

| Command | Action |
|---------|--------|
| `@dependabot rebase` | Rebase the PR against the base branch |
| `@dependabot merge` | Merge when CI passes |
| `@dependabot squash and merge` | Squash and merge when CI passes |
| `@dependabot cancel merge` | Cancel a pending merge |
| `@dependabot close` | Close the PR |
| `@dependabot ignore this dependency` | Close PR and ignore future updates |
| `@dependabot ignore this major version` | Ignore major version updates |
| `@dependabot ignore this minor version` | Ignore minor version updates |

## Version Updates (Keep Everything Current)

Beyond security fixes, Dependabot can keep all dependencies up-to-date. This requires configuration.

### Configuration File

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  # JavaScript/npm
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "America/New_York"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "dependencies"
      - "javascript"

  # Python
  - package-ecosystem: "pip"
    directory: "/backend"
    schedule:
      interval: "daily"
    ignore:
      - dependency-name: "django"
        versions: ["4.x"]  # Stay on Django 3.x for now

  # Docker
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### Supported Ecosystems

| Ecosystem | Manifest Files |
|-----------|----------------|
| `npm` | `package.json`, `package-lock.json` |
| `pip` | `requirements.txt`, `Pipfile`, `pyproject.toml` |
| `maven` | `pom.xml` |
| `gradle` | `build.gradle`, `build.gradle.kts` |
| `bundler` | `Gemfile`, `Gemfile.lock` |
| `composer` | `composer.json`, `composer.lock` |
| `cargo` | `Cargo.toml`, `Cargo.lock` |
| `gomod` | `go.mod`, `go.sum` |
| `docker` | `Dockerfile` |
| `github-actions` | `.github/workflows/*.yml` |
| `terraform` | `*.tf` |
| `nuget` | `*.csproj`, `packages.config` |

### Grouping Updates

Reduce PR noise by grouping related updates:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      # Group all ESLint-related packages
      eslint:
        patterns:
          - "eslint*"
          - "@typescript-eslint/*"
      
      # Group all testing packages
      testing:
        patterns:
          - "jest*"
          - "@testing-library/*"
          - "vitest"
      
      # Group minor and patch updates for everything else
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"
```

### Ignoring Dependencies

```yaml
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    ignore:
      # Ignore all updates for aws-sdk (managed separately)
      - dependency-name: "aws-sdk"
      
      # Ignore major updates for React (breaking changes)
      - dependency-name: "react"
        update-types: ["version-update:semver-major"]
      
      # Ignore specific versions
      - dependency-name: "typescript"
        versions: ["5.x"]  # Stay on 4.x
```

## Dependabot in CI/CD

### Auto-Merge Safe Updates

Automatically merge low-risk Dependabot PRs:

```yaml
# .github/workflows/dependabot-auto-merge.yml
name: Dependabot Auto-Merge

on: pull_request

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]'
    steps:
      - name: Fetch Dependabot metadata
        id: metadata
        uses: dependabot/fetch-metadata@v2
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Auto-merge patch updates
        if: steps.metadata.outputs.update-type == 'version-update:semver-patch'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Auto-merge minor updates for dev dependencies
        if: |
          steps.metadata.outputs.update-type == 'version-update:semver-minor' &&
          steps.metadata.outputs.dependency-type == 'direct:development'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Required Status Checks

Ensure tests pass before auto-merging:

1. Go to **Settings** -> **Branches**
2. Add a branch protection rule for `main`
3. Enable **Require status checks to pass before merging**
4. Select your CI workflow

## Dependabot vs. Snyk

| Feature | Dependabot | Snyk |
|---------|------------|------|
| **Cost** | Free (GitHub) | Free tier + paid |
| **Platforms** | GitHub only | GitHub, GitLab, Bitbucket, CLI |
| **Fix PRs** | Yes | Yes |
| **Container scanning** | Limited | Comprehensive |
| **IaC scanning** | No | Yes |
| **IDE plugins** | No | Yes |
| **Priority scoring** | Basic (CVSS) | Advanced (exploit maturity) |
| **Reachability analysis** | No | Yes (paid) |

**Recommendation**: Use Dependabot as your baseline (it's free), add Snyk for deeper analysis and non-GitHub platforms.

## Troubleshooting

### Dependabot PRs Not Appearing

1. Check **Settings** -> **Code security** -> Ensure Dependabot is enabled
2. Verify `.github/dependabot.yml` syntax
3. Check **Insights** -> **Dependency graph** -> **Dependabot** for errors

### Conflicting PRs

If a Dependabot PR has conflicts:

```
@dependabot rebase
```

If rebasing doesn't work, close and let Dependabot recreate:

```
@dependabot recreate
```

### Too Many PRs

Reduce noise with:

```yaml
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "monthly"  # Less frequent
    open-pull-requests-limit: 5  # Fewer open PRs
    groups:
      all-dependencies:  # Group everything
        patterns: ["*"]
```

## Key Takeaways

1. **Enable Dependabot alerts** on all repositories—it's free and automatic
2. **Use security updates** for automatic vulnerability fix PRs
3. **Configure version updates** with `dependabot.yml` for proactive maintenance
4. **Group related updates** to reduce PR noise
5. **Set up auto-merge** for low-risk patch updates with passing tests
