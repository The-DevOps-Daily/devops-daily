---
title: 'The GitHub Actions Workflow That Eliminated Our DevOps Bottleneck'
excerpt: 'How we reduced deployment time from 2 hours to 8 minutes using smart GitHub Actions patterns and parallel execution strategies.'
category:
  name: 'CI/CD'
  slug: 'ci-cd'
date: '2024-11-18'
publishedAt: '2024-11-18T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - GitHub Actions
  - DevOps
  - Automation
---

Our development team was facing a familiar problem: as our codebase grew, our CI/CD pipeline became increasingly slow. What started as a 15-minute deployment process had ballooned to over 2 hours, creating a bottleneck that affected our entire development workflow.

After analyzing the bottlenecks and restructuring our GitHub Actions workflow, we reduced our deployment time to just 8 minutes. In this article, I'll share the exact workflow patterns and configurations that made this possible.

## The Problem: A CI/CD Pipeline That Couldn't Scale

Our application consisted of several components:

- A React frontend with extensive test coverage
- A Node.js API layer with integration tests
- A data processing service with complex validation logic
- Infrastructure defined with Terraform

Our original workflow was simple but linear:

```yaml
# Original linear workflow
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint code
        run: npm run lint

      - name: Run tests
        run: npm run test

      - name: Build all packages
        run: npm run build

      - name: Deploy frontend
        run: ./scripts/deploy-frontend.sh

      - name: Deploy API
        run: ./scripts/deploy-api.sh

      - name: Deploy data services
        run: ./scripts/deploy-data-services.sh

      - name: Run integration tests
        run: npm run integration-tests
```

While this worked initially, as our codebase grew, each step became slower:

- Test suites took longer to run (45+ minutes)
- Builds became more complex (30+ minutes)
- Deployments had more steps (45+ minutes)
- Integration tests became more comprehensive (30+ minutes)

The worst part? If anything failed late in the process, developers would have to start over after fixing the issue, wasting hours of time.

## The Solution: Parallel Jobs and Smart Dependencies

We redesigned our workflow with three key principles:

1. Run independent tasks in parallel
2. Use GitHub Actions' dependency management to orchestrate steps
3. Cache everything that can be cached

Here's the optimized workflow:

```yaml
name: Optimized Build and Deploy

on:
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint code
        run: npm run lint

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test

      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: ./test-results
          retention-days: 5

  build-frontend:
    runs-on: ubuntu-latest
    needs: [lint, unit-tests]
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Build frontend
        run: cd frontend && npm run build

      - name: Upload frontend build
        uses: actions/upload-artifact@v3
        with:
          name: frontend-build
          path: ./frontend/build
          retention-days: 1

  build-api:
    runs-on: ubuntu-latest
    needs: [lint, unit-tests]
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: cd api && npm ci

      - name: Build API
        run: cd api && npm run build

      - name: Upload API build
        uses: actions/upload-artifact@v3
        with:
          name: api-build
          path: ./api/dist
          retention-days: 1

  build-data-services:
    runs-on: ubuntu-latest
    needs: [lint, unit-tests]
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: cd data-services && npm ci

      - name: Build data services
        run: cd data-services && npm run build

      - name: Upload data services build
        uses: actions/upload-artifact@v3
        with:
          name: data-services-build
          path: ./data-services/dist
          retention-days: 1

  deploy-frontend:
    runs-on: ubuntu-latest
    needs: [build-frontend]
    environment: production
    steps:
      - uses: actions/checkout@v3

      - name: Download frontend build
        uses: actions/download-artifact@v3
        with:
          name: frontend-build
          path: ./frontend/build

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy to S3 and invalidate CloudFront
        run: |
          aws s3 sync ./frontend/build s3://${{ secrets.FRONTEND_BUCKET_NAME }} --delete
          aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/*"

  deploy-api:
    runs-on: ubuntu-latest
    needs: [build-api]
    environment: production
    steps:
      - uses: actions/checkout@v3

      - name: Download API build
        uses: actions/download-artifact@v3
        with:
          name: api-build
          path: ./api/dist

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy to Elastic Beanstalk
        run: |
          zip -r api.zip ./api/dist
          aws s3 cp api.zip s3://${{ secrets.DEPLOYMENT_BUCKET }}/api.zip
          aws elasticbeanstalk create-application-version \
            --application-name MyApp \
            --version-label "api-${{ github.sha }}" \
            --source-bundle S3Bucket="${{ secrets.DEPLOYMENT_BUCKET }}",S3Key="api.zip"
          aws elasticbeanstalk update-environment \
            --environment-name MyApp-env \
            --version-label "api-${{ github.sha }}"

  deploy-data-services:
    runs-on: ubuntu-latest
    needs: [build-data-services]
    environment: production
    steps:
      - uses: actions/checkout@v3

      - name: Download data services build
        uses: actions/download-artifact@v3
        with:
          name: data-services-build
          path: ./data-services/dist

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy Lambda functions
        run: |
          cd data-services
          npm ci
          npm run deploy-lambda

  integration-tests:
    runs-on: ubuntu-latest
    needs: [deploy-frontend, deploy-api, deploy-data-services]
    environment: production
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: cd integration-tests && npm ci

      - name: Run integration tests
        run: cd integration-tests && npm run test
        env:
          API_URL: ${{ secrets.PRODUCTION_API_URL }}
          FRONTEND_URL: ${{ secrets.PRODUCTION_FRONTEND_URL }}

  notify:
    runs-on: ubuntu-latest
    needs: [integration-tests]
    if: always()
    steps:
      - name: Notify Slack on success
        if: ${{ success() }}
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {"text": "✅ Deployment succeeded for ${{ github.repository }}@${{ github.ref }}"}
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

      - name: Notify Slack on failure
        if: ${{ failure() }}
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {"text": "❌ Deployment failed for ${{ github.repository }}@${{ github.ref }}"}
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

Let's break down the key optimizations that made this possible.

## Key Optimization #1: Parallel Job Execution

The most significant improvement came from running independent build jobs in parallel. In our original workflow, the build process was strictly sequential. By splitting it into separate jobs that could run concurrently, we immediately reduced our build time.

```yaml
# This setup allows these jobs to run in parallel
lint:
  runs-on: ubuntu-latest
  # No dependencies, starts immediately

unit-tests:
  runs-on: ubuntu-latest
  # No dependencies, starts immediately
```

We then used the `needs` keyword to establish dependencies between jobs:

```yaml
build-frontend:
  runs-on: ubuntu-latest
  needs: [lint, unit-tests] # Only starts after both lint and unit-tests complete
```

This approach ensures that:

- Fast, independent validations (like linting) happen immediately
- Build jobs only start after validations pass, preventing wasted compute time
- Multiple build jobs run concurrently, rather than sequentially

## Key Optimization #2: Artifact Sharing Between Jobs

To avoid rebuilding components in every job, we used GitHub Actions' artifact system to share build outputs:

```yaml
# In build job
- name: Upload frontend build
  uses: actions/upload-artifact@v3
  with:
    name: frontend-build
    path: ./frontend/build
    retention-days: 1

# In deploy job
- name: Download frontend build
  uses: actions/download-artifact@v3
  with:
    name: frontend-build
    path: ./frontend/build
```

This approach:

- Eliminates redundant build operations
- Ensures consistency between build and deployment
- Reduces the complexity of deployment jobs
- Creates an audit trail of exactly what was deployed

One note: we set a short retention period (1 day) for most artifacts to avoid storage costs, while keeping test results longer (5 days) for debugging purposes.

## Key Optimization #3: Environment-Specific Approvals

For production deployments, we added an approval gate using GitHub's environments feature:

```yaml
deploy-frontend:
  runs-on: ubuntu-latest
  needs: [build-frontend]
  environment: production # This enables required approvals
```

In the GitHub repository settings, we configured the "production" environment to require approvals from specific team members before the deployment can proceed.

This added a crucial safety check without significantly impacting automation for non-production environments, which we configured separately with different workflows.

## Key Optimization #4: Strategic Caching

We implemented caching at multiple levels:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v3
  with:
    node-version: '18'
    cache: 'npm' # Caches npm dependencies
```

For more complex caching needs, we used the explicit cache action:

```yaml
- name: Cache Next.js build
  uses: actions/cache@v3
  with:
    path: |
      .next/cache
    key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}
```

Effective caching reduced:

- Dependency installation time (from minutes to seconds)
- Build time for unchanged components
- Test execution time by reusing test caches

## Performance Results

The impact of these changes was dramatic:

| Process        | Original Duration | Optimized Duration | Improvement |
| -------------- | ----------------- | ------------------ | ----------- |
| Linting        | 5 minutes         | 2 minutes          | 60%         |
| Unit Tests     | 45 minutes        | 5 minutes          | 89%         |
| Build          | 30 minutes        | 6 minutes          | 80%         |
| Deployment     | 40 minutes        | 5 minutes          | 88%         |
| Integration    | 30 minutes        | 3 minutes          | 90%         |
| **Total Time** | **150 minutes**   | **8 minutes**      | **95%**     |

The key to this dramatic improvement was parallel execution. While the total compute time increased slightly (from 150 minutes to approximately 21 minutes of cumulative runner time), the wall-clock time decreased dramatically because many processes ran simultaneously.

## Lessons Learned and Best Practices

Throughout this optimization process, we discovered several key principles for efficient GitHub Actions workflows:

### 1. Design for Parallelism from the Start

- Identify which tasks can run independently
- Split monolithic jobs into focused, single-purpose jobs
- Use the `needs` keyword to establish minimal required dependencies

### 2. Optimize Test Execution

- Run tests in parallel using test runners' built-in capabilities (like Jest's `--maxWorkers`)
- Split large test suites into separate jobs by category or type
- Run only affected tests when possible (using tools like Jest's `--changedSince`)

```yaml
# Example of optimized test setup
- name: Run tests
  run: npm test -- --maxWorkers=2 --ci --coverage
```

### 3. Be Strategic with Secrets and Environments

- Use different workflows for production vs. non-production
- Apply stricter controls (approvals, secrets) only where needed
- Keep secret management centralized using GitHub environments

```yaml
# Example environment-specific configuration
deploy-prod:
  environment: production
  # This job uses secrets from the production environment
```

### 4. Optimize for Developer Experience

- Make failure messages clear and actionable
- Add comprehensive notifications (we use Slack)
- Ensure logs are detailed enough to debug issues without re-running

```yaml
# Example of enhanced error output
- name: Test with better error reporting
  run: |
    npm test || {
      echo "::error::Tests failed - see detailed logs below"
      cat test-output.log
      exit 1
    }
```

### 5. Monitor and Iterate

Regular monitoring helped us identify when our workflow needed further optimization:

- Track workflow duration over time
- Analyze which jobs take the longest
- Gather developer feedback on pain points

We created a simple GitHub Action to track and visualize our workflow performance, which helped identify new bottlenecks as they emerged.

## The Final Improvement: Self-Hosted Runners

After optimizing our workflow structure, we made one final improvement: deploying self-hosted runners for specific tasks. While GitHub-hosted runners work great for most jobs, we found that:

- Jobs requiring specialized dependencies benefited from custom runners
- Jobs accessing private networks (like our staging environment) needed dedicated runners
- High-memory operations performed better on optimized hardware

We implemented a mixed approach:

```yaml
# Job using GitHub-hosted runner
unit-tests:
  runs-on: ubuntu-latest

# Job using self-hosted runner
deploy-staging:
  runs-on: self-hosted-staging
```

This hybrid model gave us the best of both worlds: scalability of GitHub-hosted runners for most tasks, and optimized performance for specialized operations.

## Conclusion: A Culture of CI/CD Efficiency

The technical changes we've outlined yielded impressive time savings, but the most significant benefit was cultural. With faster feedback cycles, our developers became more willing to:

- Make smaller, incremental changes
- Run tests locally before pushing
- Refactor code without fear of long wait times
- Experiment with new approaches

A fast CI/CD pipeline doesn't just save time, it transforms how developers work, encouraging practices that further improve code quality and deployment reliability.

By restructuring our GitHub Actions workflow around parallel execution, strategic dependencies, and effective caching, we turned what was once a development bottleneck into a competitive advantage. The same principles can be applied to virtually any CI/CD pipeline, regardless of your specific tech stack or deployment targets.
