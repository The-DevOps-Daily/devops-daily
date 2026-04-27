---
title: 'Day 21 - Create a Reusable Template Repo'
day: 21
excerpt: 'Build a GitHub template repository with DevOps best practices baked in for quick project bootstrapping.'
description: 'Create a comprehensive template repository with CI/CD, testing, linting, Docker, and documentation for rapid project initialization.'
publishedAt: '2025-12-21T00:00:00Z'
updatedAt: '2026-04-19T00:00:00Z'
difficulty: 'Intermediate'
category: 'Automation'
tags:
  - GitHub
  - Templates
  - Best Practices
  - Automation
---

## Description

Every new project requires the same setup: CI/CD, linting, testing, Docker, documentation. Instead of recreating this each time, build a reusable template repository with all best practices included.

## Task

Create a GitHub template repository with DevOps best practices.

**Requirements:**
- GitHub Actions CI/CD workflows
- Pre-commit hooks
- Docker support
- Documentation templates
- Testing framework
- Code quality tools

## Target

- ✅ Template repository created
- ✅ CI/CD pipeline working
- ✅ Pre-commit hooks configured
- ✅ Dockerfile included
- ✅ README template complete
- ✅ New projects can use template

## Sample App

### Repository Structure

```
project-template/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── release.yml
│   │   └── security.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── pull_request_template.md
├── .devcontainer/
│   └── devcontainer.json
├── .vscode/
│   ├── settings.json
│   └── extensions.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CONTRIBUTING.md
│   └── DEPLOYMENT.md
├── scripts/
│   ├── setup.sh
│   ├── test.sh
│   └── deploy.sh
├── src/
│   └── index.js
├── tests/
│   └── index.test.js
├── .dockerignore
├── .editorconfig
├── .gitignore
├── .pre-commit-config.yaml
├── Dockerfile
├── docker-compose.yml
├── package.json
├── README.md
├── LICENSE
└── CHANGELOG.md
```

## Solution

### 1. README.md Template

```markdown
# Project Name

[![CI](https://github.com/username/repo/workflows/CI/badge.svg)](https://github.com/username/repo/actions)
![License](https://img.shields.io/github/license/username/repo)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

> Brief description of what this project does

## Features

- Feature 1
- Feature 2
- Feature 3

## Quick Start

```bash
# Clone the repository
git clone https://github.com/username/repo.git
cd repo

# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev
```

## Prerequisites

- Node.js >= 20.x
- Docker (optional)
- kubectl (for Kubernetes deployment)

## Installation

### Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Run the application
npm start
```

### Docker

```bash
# Build image
docker build -t myapp:latest .

# Run container
docker run -p 3000:3000 myapp:latest
```

### Kubernetes

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/

# Check status
kubectl get pods
```

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | Database connection | - |

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run build
```

## Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

## Deployment

See `docs/DEPLOYMENT.md` in the repo for deployment instructions.

## Contributing

Please read `docs/CONTRIBUTING.md` in the repo for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the `LICENSE` file in the repo for details.

## Acknowledgments

- Inspiration
- References
- Contributors
```

### 2. CI/CD Workflows

#### .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: matrix.node-version == '20.x'

  docker:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t myapp:test .

      - name: Test Docker image
        run: |
          docker run -d -p 3000:3000 --name test-container myapp:test
          sleep 5
          curl -f http://localhost:3000/health || exit 1
          docker stop test-container

  security:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

      - name: Dependency audit
        run: npm audit --audit-level=high
```

#### .github/workflows/release.yml

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Create Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          draft: false
          prerelease: false

      - name: Build and push Docker image
        env:
          DOCKER_USERNAME: ${{ secrets.DOCKER_USERNAME }}
          DOCKER_PASSWORD: ${{ secrets.DOCKER_PASSWORD }}
        run: |
          echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin
          docker build -t $DOCKER_USERNAME/myapp:${GITHUB_REF#refs/tags/} .
          docker push $DOCKER_USERNAME/myapp:${GITHUB_REF#refs/tags/}
```

### 3. Pre-commit Configuration

#### .pre-commit-config.yaml

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
        args: ['--maxkb=1000']
      - id: check-merge-conflict
      - id: detect-private-key

  - repo: https://github.com/pre-commit/mirrors-eslint
    rev: v8.56.0
    hooks:
      - id: eslint
        files: \.[jt]sx?$
        types: [file]
        additional_dependencies:
          - eslint@8.56.0
          - eslint-config-prettier@9.1.0

  - repo: https://github.com/pre-commit/mirrors-prettier
    rev: v3.1.0
    hooks:
      - id: prettier
        files: \.(js|jsx|ts|tsx|json|yaml|yml|md)$

  - repo: local
    hooks:
      - id: tests
        name: run tests
        entry: npm test
        language: system
        pass_filenames: false
        always_run: true
```

### 4. Dockerfile

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Build application
COPY . .
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

CMD ["node", "dist/index.js"]
```

### 5. Setup Script

#### scripts/setup.sh

```bash
#!/bin/bash

set -euo pipefail

echo "🚀 Setting up development environment..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v git >/dev/null 2>&1 || { echo "❌ Git is required but not installed."; exit 1; }

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Setup pre-commit hooks
echo "🔨 Setting up pre-commit hooks..."
pip install pre-commit
pre-commit install

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please update .env with your configuration"
fi

# Run initial tests
echo "🧪 Running tests..."
npm test

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Update .env with your configuration"
echo "  2. Run 'npm run dev' to start development server"
echo "  3. Visit http://localhost:3000"
```

### 6. Package.json

```json
{
  "name": "project-template",
  "version": "1.0.0",
  "description": "DevOps-ready project template",
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node dist/index.js",
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.{js,ts}",
    "lint:fix": "eslint src/**/*.{js,ts} --fix",
    "format": "prettier --write \"src/**/*.{js,ts,json}\"",
    "format:check": "prettier --check \"src/**/*.{js,ts,json}\"",
    "prepare": "husky install"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/username/project-template.git"
  },
  "keywords": [
    "template",
    "devops",
    "nodejs"
  ],
  "author": "",
  "license": "MIT",
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "eslint": "^8.56.0",
    "eslint-config-prettier": "^9.1.0",
    "husky": "^8.0.0",
    "jest": "^29.7.0",
    "nodemon": "^3.0.0",
    "prettier": "^3.1.0",
    "typescript": "^5.3.0"
  },
  "dependencies": {
    "express": "^4.18.0",
    "dotenv": "^16.3.0"
  }
}
```

### 7. Contributing Guide

#### docs/CONTRIBUTING.md

```markdown
# Contributing Guide

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/repo.git`
3. Create a branch: `git checkout -b feature/my-feature`
4. Make your changes
5. Run tests: `npm test`
6. Commit: `git commit -am 'Add some feature'`
7. Push: `git push origin feature/my-feature`
8. Create a Pull Request

## Development Setup

```bash
# Run setup script
./scripts/setup.sh

# Start development server
npm run dev
```

## Code Style

- Follow ESLint rules
- Run `npm run lint` before committing
- Use Prettier for formatting
- Write meaningful commit messages

## Commit Message Format

```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

## Pull Request Process

1. Update README.md with changes
2. Update CHANGELOG.md
3. Ensure all tests pass
4. Get approval from maintainers
5. Squash commits before merge

## Testing

- Write tests for new features
- Maintain >80% coverage
- Run full test suite before PR

## Questions?

Create an issue or reach out to maintainers.
```

## Explanation

### Template Repository Benefits

**Speed:** New projects start in minutes, not hours
**Consistency:** All projects follow same structure
**Quality:** Best practices built-in
**Maintenance:** Update template, all projects benefit

### Key Components

#### 1. CI/CD Pipeline

```
Push → Lint → Test → Build → Security Scan → Deploy
```

#### 2. Pre-commit Hooks

```
Commit Attempt → Hooks Run → Pass/Fail → Commit Allowed
```

#### 3. Documentation

- README: Overview and quick start
- CONTRIBUTING: How to contribute
- DEPLOYMENT: How to deploy
- ARCHITECTURE: System design

## Result

### Create Template Repository

```bash
# Create new repository on GitHub
# Check "Template repository" option

# Clone locally
git clone https://github.com/yourusername/project-template.git
cd project-template

# Add all template files
# (Copy all files from solution above)

# Commit and push
git add .
git commit -m "feat: initial template setup"
git push origin main
```

### Use Template

```bash
# Create new project from template on GitHub
# Click "Use this template" button

# Or via CLI
gh repo create my-new-project --template yourusername/project-template

# Clone and setup
git clone https://github.com/yourusername/my-new-project.git
cd my-new-project

# Run setup
./scripts/setup.sh

# Start developing!
npm run dev
```

## Validation

### Template Checklist

```bash
# 1. Repository is marked as template
# Check on GitHub repository settings

# 2. CI/CD workflows work
git push origin main
# Check GitHub Actions tab

# 3. Pre-commit hooks installed
git commit -m "test"
# Should run hooks

# 4. Docker build works
docker build -t test .
# Should succeed

# 5. Tests pass
npm test
# Should pass

# 6. Documentation complete
ls docs/
# Should have CONTRIBUTING.md, DEPLOYMENT.md, etc.
```

## Best Practices

### ✅ Do's

1. **Keep template minimal**: Only essentials
2. **Document everything**: README, CONTRIBUTING, etc.
3. **Automate setup**: Provide setup scripts
4. **Test regularly**: Ensure template works
5. **Version template**: Tag releases
6. **Update dependencies**: Keep current

### ❌ Don'ts

1. **Don't include secrets**: Use .env.example
2. **Don't over-engineer**: Keep it simple
3. **Don't skip docs**: Documentation is key
4. **Don't forget .gitignore**: Exclude build artifacts
5. **Don't hardcode values**: Use environment variables

## Links

- [GitHub Template Repositories](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-template-repository)
- [Pre-commit Framework](https://pre-commit.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Keep a Changelog](https://keepachangelog.com/)

## Share Your Success

Created a template repo? Share it!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Template repository URL
- What's included
- Time saved per project
- Number of projects using it

Use hashtags: **#AdventOfDevOps #GitHub #Templates #Day21**
