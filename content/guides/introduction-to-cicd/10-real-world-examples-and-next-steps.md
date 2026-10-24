---
title: 'A Complete Pipeline and Next Steps'
description: 'The finished GitHub Actions pipeline for the example app, how a change moves through it, release and infrastructure patterns, and what to learn next.'
order: 10
---

Over nine parts, a one-job "hello" workflow grew into a pipeline that tests every pull request on ten runner configurations, merges through a queue, deploys the exact build that passed after an approval, and checks the live site. This part puts the finished pipeline in one place, follows one change through it, and shows how the same structure extends to releases, containers and infrastructure.

## Prerequisites

- The previous parts, or the [companion repository](https://github.com/The-DevOps-Daily/guide-cicd-demo-2026-10-24), which has every file shown here.

## The Repository

```terminal
{
  "title": "the files",
  "prompt": "$",
  "steps": [
    {
      "cmd": "git ls-files | sort",
      "output": ".github/actions/setup-app/action.yml\n.github/workflows/ci.yml\n.github/workflows/config.yml\n.github/workflows/deploy.yml\n.github/workflows/hello.yml\n.gitignore\nREADME.md\neslint.config.js\npackage-lock.json\npackage.json\nscripts/build.js\nsrc/commands.json\nsrc/render.js\ntest/render.test.js"
    }
  ]
}
```

| File                                   | Role                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`             | Lint, tests on ten runner configurations, build, `all-checks`; for pull requests, the merge queue and the deploy workflow |
| `.github/workflows/deploy.yml`         | On every push to `main`: CI, package, deploy to Pages after approval, smoke test                                          |
| `.github/actions/setup-app/action.yml` | Node.js, the npm cache and `npm ci`, in one step                                                                          |
| `.github/workflows/config.yml`         | Manual demonstration of variables, secrets and OIDC (Part 5)                                                              |
| `.github/workflows/hello.yml`          | The first workflow from Parts 1 and 2                                                                                     |

## How a Change Moves Through the Pipeline

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "pr", "label": "Pull request", "sub": "pull_request", "icon": "branch", "tone": "slate", "detail": "ci.yml runs lint, the test matrix, build and all-checks. Superseded runs are canceled." }
    ],
    [
      { "id": "queue", "label": "Merge queue", "sub": "merge_group", "icon": "queue", "tone": "blue", "detail": "CI runs again on the latest main plus the queued pull requests. all-checks is the required check." }
    ],
    [
      { "id": "main", "label": "main", "sub": "push", "icon": "check", "tone": "violet", "detail": "The merge starts deploy.yml, which calls ci.yml with workflow_call, so main gets the same checks." }
    ],
    [
      { "id": "package", "label": "package", "sub": "github-pages artifact", "icon": "box", "tone": "violet", "detail": "The site that CI built, packaged once and kept for 14 days, so a deploy job can be re-run as a rollback." }
    ],
    [
      { "id": "deploy", "label": "deploy", "sub": "approval required", "icon": "shield", "tone": "amber", "detail": "The github-pages environment waits for a reviewer. Only this job has pages: write and id-token: write." }
    ],
    [
      { "id": "smoke", "label": "smoke-test", "sub": "live version.json", "icon": "activity", "tone": "green", "detail": "Fails the run unless the live site serves the commit that was just deployed." }
    ]
  ],
  "edges": [["pr", "queue", "merge"], ["queue", "main", "merged"], ["main", "package", "CI passed"], ["package", "deploy"], ["deploy", "smoke"]]
}
```

1. You push a branch and open a pull request. `ci.yml` runs for the `pull_request` event: lint, ten test jobs, the build, and `all-checks`. A new push to the branch cancels the run for the old commit.
2. When the checks pass, `gh pr merge` or the **Merge when ready** button puts the pull request into the merge queue. CI runs again, on the latest `main` plus your change. If `all-checks` passes, GitHub merges.
3. The merge pushes to `main`, which starts `deploy.yml`. It calls `ci.yml` as a reusable workflow, so `main` is checked by exactly the same jobs.
4. `package` turns the site artifact into a Pages artifact. `deploy` waits for a reviewer, then publishes it.
5. `smoke-test` fetches `version.json` from the live site and fails unless it shows the new commit.
6. If something is wrong, re-run an older run's `deploy` job to roll back, then fix forward with a new pull request.

## The Final Workflows

Every action is pinned to a commit SHA (Part 9). `ci.yml`:

```yaml
name: CI

on:
  pull_request:
  merge_group:
  workflow_call:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: ./.github/actions/setup-app
      - run: npm run lint

  test:
    runs-on: ${{ matrix.os }}
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: [22, 24, 26]
        include:
          - os: ubuntu-24.04-arm
            node: 24
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: ./.github/actions/setup-app
        with:
          node-version: ${{ matrix.node }}
      - name: Run the tests and write a JUnit report
        run: >-
          npm test --
          --test-reporter=spec --test-reporter-destination=stdout
          --test-reporter=junit --test-reporter-destination=test-results.xml
      - name: Upload the test report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
        with:
          name: test-results-${{ matrix.os }}-node-${{ matrix.node }}
          path: test-results.xml
          retention-days: 7

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: ./.github/actions/setup-app
      - run: npm run build
        env:
          SITE_TITLE: ${{ vars.SITE_TITLE }}
      - name: Write a job summary
        run: |
          {
            echo "### Site build"
            echo ""
            echo "| File | Bytes |"
            echo "| --- | ---: |"
            for f in dist/*; do
              echo "| \`${f#dist/}\` | $(wc -c < "$f") |"
            done
          } | tee -a "$GITHUB_STEP_SUMMARY"
      - name: Upload the site
        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
        with:
          name: site
          path: dist/
          retention-days: 14
          if-no-files-found: error

  # One stable check name for branch rulesets, whatever the matrix contains
  all-checks:
    if: ${{ always() }}
    needs: [lint, test, build]
    runs-on: ubuntu-slim
    timeout-minutes: 5
    steps:
      - name: Fail if a needed job failed or was cancelled
        if: ${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}
        run: exit 1
      - run: echo "All CI jobs passed"
```

`deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

# One deployment at a time; a newer run waits instead of cancelling a deployment
concurrency:
  group: pages-production
  cancel-in-progress: false

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  # Package once, so re-running the deploy job (a rollback) reuses this artifact
  package:
    needs: ci
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Download the site built by CI
        uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2
        with:
          name: site
          path: site
      - name: Package the site for GitHub Pages
        uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
        with:
          path: site/
          retention-days: 14

  deploy:
    needs: package
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    outputs:
      page_url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5.0.1

  smoke-test:
    needs: deploy
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Check that the new version is live
        env:
          PAGE_URL: ${{ needs.deploy.outputs.page_url }}
        run: |
          for attempt in 1 2 3 4 5 6; do
            live=$(curl -sSf "${PAGE_URL}version.json?run=$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-$attempt" | jq -r .commit) || live=""
            echo "Attempt $attempt: live commit ${live:-none}, expected $GITHUB_SHA"
            if [ "$live" = "$GITHUB_SHA" ]; then
              exit 0
            fi
            sleep 10
          done
          echo "::error::The site does not serve commit $GITHUB_SHA"
          exit 1
```

And the composite action, `.github/actions/setup-app/action.yml`:

```yaml
name: Set up the app
description: Install Node.js with the npm cache, then install the dependencies with npm ci

inputs:
  node-version:
    description: The Node.js version to install
    default: '24'

runs:
  using: composite
  steps:
    - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
      with:
        node-version: ${{ inputs.node-version }}
        cache: npm
    - name: Install the dependencies
      run: npm ci
      shell: bash
```

The last runs in the companion repository. The newest Deploy run is the smoke test fix; the 33-second and 46-second Deploy runs show the duration of their latest attempt, the re-run deploy jobs from the rollback in Part 6:

```terminal
{
  "title": "the run history",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run list --limit 8",
      "output": "STATUS  TITLE                              WORKFLOW  BRANCH  EVENT  ID           ELAPSED  AGE\n✓       Make every smoke test request ...  Deploy    main    push   40069252836  1m36s    about 1 minute ago\n✓       Make every smoke test request ...  Hello     main    push   40069252797  12s      about 1 minute ago\n✓       Describe the repository and it...  Deploy    main    push   40066550852  1m44s    about 43 minutes ago\n✓       Pin every action to a full com...  Deploy    main    push   40066422313  1m25s    about 44 minutes ago\n✓       Pin every action to a full com...  Hello     main    push   40066422254  14s      about 44 minutes ago\n✓       Add kubectl logs to the cheats...  Deploy    main    push   40066117968  33s      about 46 minutes ago\n✓       Add kubectl logs to the cheats...  Hello     main    push   40066117936  13s      about 49 minutes ago\n✓       Package the Pages artifact onc...  Deploy    main    push   40065982801  46s      about 47 minutes ago"
    }
  ]
}
```

## Releases From Tags

A deployment on every merge suits a website. A library or a CLI tool is released when you decide, usually by pushing a version tag. This workflow (checked with actionlint, not run in the companion repository) reuses CI, then attaches the built site to a GitHub release:

```yaml
name: Release

on:
  push:
    tags: ['v*']

permissions:
  contents: read

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  release:
    needs: ci
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: write
    steps:
      - uses: actions/download-artifact@v8
        with:
          name: site
          path: site
      - name: Create the release
        env:
          GH_TOKEN: ${{ github.token }}
          TAG: ${{ github.ref_name }}
        run: |
          (cd site && zip -r "../cheatsheet-$TAG.zip" .)
          gh release create "$TAG" "cheatsheet-$TAG.zip" --repo "$GITHUB_REPOSITORY" --generate-notes --verify-tag
```

`git tag v1.1.0 && git push origin v1.1.0` starts it. Only the `release` job can write to the repository, and only after CI passed. For packages on npm or PyPI, use **trusted publishing**, which works with OIDC like the cloud logins in Part 5, instead of storing a registry token.

## Containers, Infrastructure and Kubernetes

The structure stays the same for other targets: CI builds and tests one artifact, a protected job deploys exactly that artifact, and a check confirms the result. Only the artifact and the deploy step change:

- **Container images.** Build once, push to a registry such as GHCR, and deploy by digest, not by tag. The [Docker guide's delivery pipeline](/guides/introduction-to-docker/10-docker-in-production#h2-the-delivery-pipeline) builds a multi-platform image, signs it and deploys it with Compose.
- **Infrastructure with Terraform or OpenTofu.** Run `plan` on pull requests and post it for review, then `apply` the reviewed plan on `main` through a protected environment, with OIDC to the cloud. The [Terraform guide's team workflow](/guides/introduction-to-terraform/09-remote-backends-and-collaboration#h2-team-workflow-plan-in-pull-requests-apply-after-review) has the complete workflow.
- **Kubernetes.** Either the pipeline runs `kubectl set image` and `kubectl rollout status` (Part 6), or, with **GitOps**, it only commits the new image digest to a configuration repository and Argo CD or Flux applies it from inside the cluster. GitOps keeps cluster credentials out of CI. See [GitOps: Deploy Docker Containers with GitHub Actions and ArgoCD](/posts/gitops-deploy-docker-containers-github-actions-argocd).
- **Security gates.** Policy checks, vulnerability scans and signed provenance fit between build and deploy. The [Security Gates guide](/guides/security-gates) adds them to a pipeline like this one.

## Other CI Systems

The concepts carry over: GitLab CI has stages, jobs, `rules`, environments with approvals and a merge train; Jenkins has pipelines in a `Jenkinsfile`, agents and credentials; CircleCI and Bitbucket Pipelines have their own YAML with the same ideas. The comparisons help if you are choosing one or moving between them:

- [Jenkins vs GitHub Actions](/comparisons/jenkins-vs-github-actions)
- [GitLab CI vs GitHub Actions](/comparisons/gitlab-ci-vs-github-actions)
- [CircleCI vs GitHub Actions](/comparisons/circleci-vs-github-actions)
- [Bitbucket Pipelines vs GitHub Actions](/comparisons/bitbucket-pipelines-vs-github-actions)

## What to Learn Next

1. **Containers.** The [Introduction to Docker](/guides/introduction-to-docker) guide, then [Kubernetes](/guides/introduction-to-kubernetes).
2. **Infrastructure as code.** [Terraform](/guides/introduction-to-terraform) for cloud resources, [Ansible](/guides/introduction-to-ansible) for servers.
3. **Pipeline security.** [Security Gates](/guides/security-gates) and [SAST tools](/guides/sast-tools).
4. **Practice.** The [Complete CI/CD Pipeline with GitHub Actions](/exercises/ci-cd-github-actions) exercise, then build a pipeline for a project of your own and remove one manual step from your release process each week.

## Common Mistakes When You Scale This Up

- **Copying workflows between repositories.** Put shared pipelines in a reusable workflow in one repository and call it, pinned to a SHA, from the others.
- **Deploying something CI did not test.** Promote the artifact or image digest that CI built; never rebuild for production.
- **Manual steps that nobody wrote down.** If a release still needs a person to run a command, put the command in a workflow with an environment approval instead.
- **Pipelines nobody owns.** Workflows are code; give `.github/` a code owner and review changes to it like any other code.

## Summary

- The finished pipeline: CI as a reusable workflow for pull requests, the merge queue and `main`; a deploy workflow that packages once, deploys after approval and smoke tests the live site.
- Tags start releases; trusted publishing and OIDC replace stored registry and cloud tokens.
- Containers, Terraform and Kubernetes fit the same shape: build one artifact, deploy exactly that artifact through a protected job, verify the result.

Go back to the [overview](/guides/introduction-to-cicd) for the list of what changed in GitHub Actions in 2025 and 2026, or start the [Docker guide](/guides/introduction-to-docker) next.

## Keep Learning

- [CI/CD Pipeline Setup Checklist](/checklists/cicd-pipeline-setup) and [Production Deployment Checklist](/checklists/production-deployment)
- [Interview question: CI/CD pipeline design](/interview-questions/mid/cicd-pipeline-design)
- [CI/CD Stack Generator](/games/cicd-stack-generator)
- [GitHub Actions Workflows Quiz](/quizzes/github-actions-quiz)
