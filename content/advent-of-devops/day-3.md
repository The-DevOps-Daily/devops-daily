---
title: 'Day 3 - Add GitHub Actions CI'
day: 3
excerpt: 'Set up continuous integration for a repository without automation. Create a GitHub Actions workflow that runs tests on every push.'
description: 'Learn to create GitHub Actions workflows for continuous integration, automated testing, and quality checks.'
publishedAt: '2026-12-03T00:00:00Z'
updatedAt: '2026-12-03T00:00:00Z'
difficulty: 'Beginner'
category: 'CI/CD'
tags:
  - GitHub Actions
  - CI/CD
  - Automation
  - Testing
---

## Description

Your team has been manually testing code before merging pull requests. This is slow, error-prone, and doesn't scale. You need to set up automated testing that runs on every push.

## Task

Add a GitHub Actions workflow that runs tests on every push.

**Requirements:**
- Trigger on push and pull request events
- Run tests for the application
- Report test results
- Fail the build if tests fail

## Target

- ✅ Workflow runs automatically on push
- ✅ All tests execute successfully
- ✅ Clear pass/fail status in GitHub UI
- ✅ Runs in under 2 minutes

## Sample App

### Simple Node.js App (app.test.js)

```javascript
// app.js
function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

module.exports = { add, multiply };
```

```javascript
// app.test.js
const { add, multiply } = require('./app');

test('adds 1 + 2 to equal 3', () => {
  expect(add(1, 2)).toBe(3);
});

test('multiplies 2 * 3 to equal 6', () => {
  expect(multiply(2, 3)).toBe(6);
});
```

### package.json

```json
{
  "name": "advent-ci",
  "version": "1.0.0",
  "scripts": {
    "test": "jest"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  }
}
```

## Solution

### GitHub Actions Workflow (.github/workflows/ci.yml)

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        if: matrix.node-version == '20.x'
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: false

  lint:
    name: Lint Code
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint
        continue-on-error: false
```

## Explanation

### Workflow Breakdown

#### 1. Trigger Events

```yaml
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
```

- Runs on pushes to main/develop
- Runs on PRs targeting these branches
- Can add more triggers as needed

#### 2. Matrix Strategy

```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x]
```

- Tests against multiple Node.js versions
- Ensures compatibility
- Jobs run in parallel

#### 3. Key Steps

**Checkout Code**
```yaml
- uses: actions/checkout@v4
```
- Fetches repository code
- Required as first step

**Setup Node.js**
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: ${{ matrix.node-version }}
    cache: 'npm'
```
- Installs specified Node version
- Caches npm dependencies
- Speeds up subsequent runs

**Install & Test**
```yaml
- run: npm ci
- run: npm test
```
- `npm ci` for clean, deterministic installs
- Runs test suite

### Best Practices Applied

1. **Use npm ci instead of npm install**: Faster, more reliable
2. **Cache Dependencies**: Speeds up workflow significantly
3. **Matrix Testing**: Test multiple versions
4. **Separate Jobs**: Lint and test independently
5. **Descriptive Names**: Clear job and step names

## Result

After setup, you'll see:
- ✅ Green checkmark on passing commits
- ✅ Red X on failing tests
- ✅ Test results in PR checks
- ✅ Automatic testing on every push

### GitHub UI Shows:

```
✓ CI / Run Tests (18.x) — 1m 23s
✓ CI / Run Tests (20.x) — 1m 19s
✓ CI / Lint Code — 45s
```

## Validation

### Test the Workflow

```bash
# Clone your repository
git clone <your-repo>
cd <your-repo>

# Make a change
echo "test('example', () => expect(true).toBe(true));" >> app.test.js

# Commit and push
git add .
git commit -m "test: add example test"
git push origin main

# Watch workflow run in GitHub Actions tab
```

### Check Workflow Status

```bash
# Using GitHub CLI
gh run list --workflow=ci.yml

# View latest run
gh run view --log
```

## Advanced Features

### Add Code Coverage

```yaml
- name: Generate coverage
  run: npm test -- --coverage

- name: Upload to Codecov
  uses: codecov/codecov-action@v3
```

### Add Build Caching

```yaml
- name: Cache build output
  uses: actions/cache@v3
  with:
    path: |
      ~/.npm
      node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

### Conditional Steps

```yaml
- name: Deploy
  if: github.ref == 'refs/heads/main' && success()
  run: npm run deploy
```

## Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [GitHub Actions Marketplace](https://github.com/marketplace?type=actions)
- [actions/checkout](https://github.com/actions/checkout)
- [actions/setup-node](https://github.com/actions/setup-node)

## Share Your Success

Got your CI pipeline running? Share it!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Screenshot of your passing workflow
- Number of tests running
- Workflow execution time

Use hashtags: **#AdventOfDevOps #GitHubActions #CI #Day3**
