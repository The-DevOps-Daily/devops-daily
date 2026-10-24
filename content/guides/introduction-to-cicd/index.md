---
title: 'Introduction to CI/CD with GitHub Actions'
seoTitle: 'GitHub Actions Tutorial: CI/CD From First Workflow to Deployment'
description: 'Learn CI/CD with GitHub Actions: write workflows, test on a matrix, cache, pass artifacts, use secrets and OIDC, and deploy with approvals.'
category:
  name: 'CI/CD'
  slug: 'ci-cd'
publishedAt: '2025-02-26T10:00:00Z'
updatedAt: '2026-10-24T09:00:00Z'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - GitHub Actions
  - CI/CD
  - Continuous Integration
  - Continuous Deployment
  - Automation
  - DevOps
---

**CI/CD** means that every change you push is built and tested automatically (continuous integration), and that every change which passes can be released by a script instead of by hand (continuous delivery and deployment). **GitHub Actions** is the CI/CD system built into GitHub: you describe the automation in YAML files in your repository, and GitHub runs them on machines called runners when something happens, such as a push or a pull request.

This guide teaches GitHub Actions by building one pipeline from the first line. The example app is a small Node.js site, a one-page command cheatsheet. By the last part, every pull request is linted and tested on Linux, Windows, macOS and arm64 runners, merges go through a merge queue, and every change on `main` is deployed to GitHub Pages after an approval and checked on the live site.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Push or PR", "sub": "an event", "icon": "branch", "tone": "slate" },
    { "label": "CI", "sub": "lint, test, build", "icon": "check", "tone": "blue" },
    { "label": "Artifact", "sub": "the built site", "icon": "box", "tone": "violet" },
    { "label": "Approval", "sub": "environment rule", "icon": "shield", "tone": "amber" },
    { "label": "Deploy", "sub": "GitHub Pages", "icon": "rocket", "tone": "green" },
    { "label": "Smoke test", "sub": "the live site", "icon": "activity", "tone": "accent" }
  ]
}
```

Every run log, timing, error message and `gh` output in this guide is real. It comes from the companion repository, where the workflows ran on 24 October 2026, so the outputs show its name, `The-DevOps-Daily/guide-cicd-demo-2026-10-24`. When you follow along in your own repository, your run IDs, times and names will differ.

```github
The-DevOps-Daily/guide-cicd-demo-2026-10-24
```

## What You Will Learn

| Part                                                                                                     | What you do                                                                                       |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [1. Your first workflow](/guides/introduction-to-cicd/01-understanding-cicd-and-first-workflow)          | Learn what CI/CD means, push a first workflow and read its logs                                   |
| [2. Workflow syntax](/guides/introduction-to-cicd/02-workflow-anatomy-and-core-concepts)                 | Use triggers, manual inputs, jobs, outputs, expressions and conditions                            |
| [3. Build and test](/guides/introduction-to-cicd/03-building-and-testing-applications)                   | Lint, test on three Node.js versions and build the app on every pull request                      |
| [4. Caching and artifacts](/guides/introduction-to-cicd/04-working-with-artifacts-and-dependencies)      | Cache npm downloads and pass the built site between jobs                                          |
| [5. Variables, secrets and OIDC](/guides/introduction-to-cicd/05-environment-variables-and-secrets)      | Keep configuration and credentials out of the code, and replace cloud keys with OIDC              |
| [6. Deployments](/guides/introduction-to-cicd/06-deployment-strategies-and-environments)                 | Deploy to GitHub Pages through a protected environment, smoke test it and roll back               |
| [7. Matrices, reuse and merge queues](/guides/introduction-to-cicd/07-advanced-workflows-and-automation) | Test on Linux, Windows, macOS and arm64, share code with reusable workflows and use a merge queue |
| [8. Debugging and speed](/guides/introduction-to-cicd/08-monitoring-debugging-and-optimization)          | Read failures, re-run with debug logs, write job summaries and make runs faster                   |
| [9. Security](/guides/introduction-to-cicd/09-security-best-practices-and-production-patterns)           | Limit the token, avoid script injection and unsafe triggers, and pin actions to commits           |
| [10. The complete pipeline](/guides/introduction-to-cicd/10-real-world-examples-and-next-steps)          | Put it all together and see patterns for Docker images, Terraform and Kubernetes                  |

## What Changed Since This Guide Was First Written

The first version of this guide is from February 2025. GitHub Actions has changed a lot since then. If you have older workflows, these are the changes most likely to affect them:

| Before                                                   | Now (October 2026)                                                                                  | Since                          |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------ |
| `actions/checkout@v4`, `actions/setup-node@v4`           | `checkout@v7` and `setup-node@v7`; JavaScript actions run on Node.js 24                             | June and July 2026             |
| Actions that run on Node.js 20                           | Node.js 20 is removed from the runners; old actions must be upgraded                                | 23 September 2026              |
| `upload-artifact@v3` and `download-artifact@v3`          | v3 stopped working; current versions are `upload-artifact@v7` and `download-artifact@v8`            | 30 January 2025                |
| `actions/cache` on the old cache service                 | A new cache service; `actions/cache` older than v4.2.0 (or v3.4.0) fails                            | February to April 2025         |
| `ubuntu-latest` is Ubuntu 24.04                          | `ubuntu-latest` moves to Ubuntu 26.04, gradually                                                    | 19 October to 19 November 2026 |
| x64 runners only                                         | Linux and Windows arm64 runners (`ubuntu-24.04-arm`, `windows-11-arm`), in private repositories too | August 2025 and January 2026   |
| Fork code checked out in `pull_request_target` workflows | `checkout@v7` refuses to check out fork pull requests in `pull_request_target` and `workflow_run`   | June 2026                      |
| Steps always run one after another                       | `parallel` and `background` steps                                                                   | June 2026                      |
| `./` to call an action from the same repository          | `$/` resolves to the commit that is running, with no checkout                                       | July 2026                      |
| Linux 2-core minutes at $0.008                           | $0.006 per minute; a planned fee for self-hosted runners was postponed                              | 1 January 2026                 |

Each part explains the changes that belong to it, with links to GitHub's announcements.

## What It Costs

Standard GitHub-hosted runners are free in public repositories. For private repositories, your account or organization gets a monthly allowance that all of them share: 2,000 minutes on GitHub Free and 3,000 on Pro and Team. After that you pay per minute, for example $0.006 for a Linux 2-core runner, $0.010 for Windows and $0.062 for macOS ([GitHub's price list](https://docs.github.com/en/billing/reference/actions-runner-pricing), October 2026). GitHub reduced these prices by up to 39% on [1 January 2026](https://github.blog/changelog/2026-01-01-reduced-pricing-for-github-hosted-runners-usage/). It also announced a $0.002 per minute charge for self-hosted runners, then [postponed it](https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/) to re-evaluate; as of October 2026, self-hosted runners are still free to use. Everything in this guide runs on free runners in a public repository.

## Prerequisites

- A GitHub account and a repository you can push to. A public repository keeps everything free.
- Git on your computer, and basic Git and pull request experience. The [Git guide](/guides/introduction-to-git) covers it.
- [Node.js](https://nodejs.org/) 24, or 22.13 and newer in the 22 line, to run the example app locally.
- The [GitHub CLI](https://cli.github.com/) (`gh`). The guide uses it to watch runs and read logs; every step also works in the web interface.

No CI/CD experience is needed. The example app is short, and Part 3 explains every file.

## Practice Hands-On

Design a pipeline in your browser with the [CI/CD Stack Generator](/games/cicd-stack-generator), see why YAML surprises people in the [YAML Parsing Simulator](/games/yaml-parsing-simulator), then test yourself with the [GitHub Actions Workflows Quiz](/quizzes/github-actions-quiz) and the [CI/CD Concepts flashcards](/flashcards/cicd-concepts).

## Keep Learning

- [Jenkins vs GitHub Actions](/comparisons/jenkins-vs-github-actions) and [GitLab CI vs GitHub Actions](/comparisons/gitlab-ci-vs-github-actions)
- [CI/CD Pipeline Setup Checklist](/checklists/cicd-pipeline-setup)
- [Complete CI/CD Pipeline with GitHub Actions](/exercises/ci-cd-github-actions) (exercise)
- Next guides: [Introduction to Docker](/guides/introduction-to-docker) and [Security Gates](/guides/security-gates)

Start with [Part 1: What Is CI/CD? Your First GitHub Actions Workflow](/guides/introduction-to-cicd/01-understanding-cicd-and-first-workflow).
