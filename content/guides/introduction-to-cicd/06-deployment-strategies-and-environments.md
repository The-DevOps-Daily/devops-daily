---
title: 'Deployments, Environments and Rollbacks'
description: 'Deploy with GitHub Actions through a protected environment with a required reviewer, run one deployment at a time, smoke test it, and roll back.'
order: 6
---

A deployment pipeline has to answer four questions: what exactly is being deployed, who may deploy it, what happens when two deployments overlap, and how you know it worked. GitHub Actions answers them with artifacts (the exact files CI built), **environments** with protection rules, **concurrency** groups, and a smoke test against the live system.

In this part you deploy the cheatsheet to GitHub Pages through an environment that needs an approval, check the live version automatically, and roll back by re-running an older deployment. Then you look at how rolling, blue-green and canary deployments fit into a workflow when your target is a cluster or a fleet of servers.

## Prerequisites

- The repository from [Part 5](/guides/introduction-to-cicd/05-environment-variables-and-secrets), with the `SITE_TITLE` variable.
- A public repository, or a private one on a plan that includes GitHub Pages and required reviewers (see below).

## Build Once, Deploy the Same Files

The most important rule of deployment pipelines: build the artifact once, test it, and deploy that exact artifact. If each environment rebuilds from source, a dependency update or a different build variable between two builds means production runs something nobody tested.

## Environments and Protection Rules

An **environment** is a named deployment target in **Settings > Environments**, such as `staging`, `production` or `github-pages`. A job that sets `environment: <name>` deploys to it. An environment can hold:

- **Secrets and variables** that only jobs in that environment receive.
- **Required reviewers**: up to six people or teams, one of whom must approve each deployment. "Prevent self-review" stops the person who triggered the run from approving it.
- **A wait timer** of up to 30 days before the job starts.
- **Deployment branches and tags**: for example, only `main` may deploy to production.
- **Custom protection rules** from GitHub Apps, such as a check in your monitoring system (in public preview).

The job pauses before it starts, with no runner and no billable minutes, until the rules pass. A run can wait up to 30 days for an approval. Every deployment is recorded in the repository's deployment history.

Availability depends on the plan. In public repositories, all of this works on every plan. In private repositories, environments, their secrets and branch rules need GitHub Pro, Team or Enterprise, and required reviewers and wait timers need GitHub Enterprise.

If you need an environment's secrets and variables for a job that does not deploy anything, such as integration tests, set `deployment: false` under `environment:` (since [March 2026](https://github.blog/changelog/2026-03-19-github-actions-late-march-2026-updates/)); the job then does not create a deployment record.

## Set Up GitHub Pages

GitHub Pages hosts static sites for free from public repositories, and it can deploy from a workflow. Turn it on with the API (or in **Settings > Pages**, with **Source: GitHub Actions**):

```terminal
{
  "title": "enable Pages",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh api --method POST repos/{owner}/{repo}/pages -f build_type=workflow --jq '{html_url, build_type, https_enforced}'",
      "output": "{\"build_type\":\"workflow\",\"html_url\":\"https://the-devops-daily.github.io/guide-cicd-demo-2026-10-24/\",\"https_enforced\":true}"
    }
  ]
}
```

This also creates an environment called `github-pages` that only the default branch may deploy to. Add yourself as a required reviewer: **Settings > Environments > github-pages > Required reviewers**, then **Save protection rules**. Now it has two rules:

```terminal
{
  "title": "the protection rules",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh api repos/{owner}/{repo}/environments/github-pages --jq '[.protection_rules[].type]'",
      "output": "[\"branch_policy\",\"required_reviewers\"]"
    }
  ]
}
```

## The Deploy Workflow

Create `.github/workflows/deploy.yml`:

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
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          SITE_TITLE: ${{ vars.SITE_TITLE }}
      - name: Package the site for GitHub Pages
        uses: actions/upload-pages-artifact@v5
        with:
          path: dist/

  deploy:
    needs: build
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
        uses: actions/deploy-pages@v5

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
            live=$(curl -sSf "${PAGE_URL}version.json?run=$GITHUB_RUN_ID" | jq -r .commit) || live=""
            echo "Attempt $attempt: live commit ${live:-none}, expected $GITHUB_SHA"
            if [ "$live" = "$GITHUB_SHA" ]; then
              exit 0
            fi
            sleep 10
          done
          echo "::error::The site does not serve commit $GITHUB_SHA"
          exit 1
```

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "build", "sub": "test, build, package", "icon": "gear", "tone": "blue" },
    { "label": "approval", "sub": "github-pages rules", "icon": "shield", "tone": "amber" },
    { "label": "deploy", "sub": "pages: write", "icon": "rocket", "tone": "green" },
    { "label": "smoke-test", "sub": "live version.json", "icon": "activity", "tone": "accent" }
  ]
}
```

The pieces:

- **`concurrency`** puts every run of this workflow into the group `pages-production`. Only one run in a group is active at a time. With `cancel-in-progress: false`, a new run waits instead of canceling a deployment halfway. Only one run can wait: if a third run arrives, it replaces the waiting one, which is canceled. Runs enter the group in the order GitHub queues them, which is usually, but not always, the order of the pushes. Since [May 2026](https://github.blog/changelog/2026-05-07-github-actions-concurrency-groups-now-allow-larger-queues/), `queue: max` lets up to 100 runs wait in order instead.
- **`upload-pages-artifact`** packs `dist/` into an artifact called `github-pages`, the format `deploy-pages` expects. It runs in the `build` job, so the files are fixed before anyone approves anything.
- **The `deploy` job** is the only one with write access: `pages: write` to publish, and `id-token: write` because `deploy-pages` proves its identity with an OIDC token. `environment:` applies the protection rules, and `url:` links the deployment to the live site.
- **The job output `page_url`** passes the site address to the next job.
- **`smoke-test`** checks that the live site serves the commit this run built, and retries for a minute while the new version spreads. Pages serves files through a CDN with `Cache-Control: max-age=600`, so the request adds a query string that the CDN has not seen before.

A review of this workflow found a flaw in that query string: `?run=$GITHUB_RUN_ID` is the same for every retry and for every re-run of the run. If the first request comes back with the old version, the CDN caches that answer under that URL for ten minutes, and the retries get it again. The final version in [Part 10](/guides/introduction-to-cicd/10-real-world-examples-and-next-steps) makes every request unique:

```bash
live=$(curl -sSf "${PAGE_URL}version.json?run=$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-$attempt" | jq -r .commit) || live=""
```

## Deploy and Approve

Push the workflow. The `build` job runs at once, then the run stops at `deploy`:

```terminal
{
  "title": "waiting for approval",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view 40064226338",
      "output": "* main Deploy · 40064226338\nTriggered via push less than a minute ago\n\nJOBS\n✓ build in 12s (ID 120783962872)\n* deploy (ID 120784013137)\n\nANNOTATIONS\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\nbuild: .github#1\n\n\nARTIFACTS\ngithub-pages\n\nFor more information about a job, try: gh run view --job=<job-id>\nView this run on GitHub: https://github.com/The-DevOps-Daily/guide-cicd-demo-2026-10-24/actions/runs/40064226338"
    }
  ]
}
```

The run page shows **Review deployments**; a reviewer opens it, can leave a comment, and approves or rejects. The GitHub CLI has no command for it, but the API does the same:

```terminal
{
  "title": "approve with the API",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh api repos/{owner}/{repo}/actions/runs/40064226338/pending_deployments --jq '.[] | {environment: .environment.name, id: .environment.id, current_user_can_approve}'",
      "output": "{\"current_user_can_approve\":true,\"environment\":\"github-pages\",\"id\":25195568449}"
    },
    {
      "cmd": "gh api --method POST repos/{owner}/{repo}/actions/runs/40064226338/pending_deployments -F 'environment_ids[]=25195568449' -f state=approved -f comment='Build checked' --jq '.[] | {environment, ref, task}'",
      "output": "{\"environment\":\"github-pages\",\"ref\":\"main\",\"task\":\"deploy\"}"
    }
  ]
}
```

After the approval, the deployment and the smoke test ran:

```terminal
{
  "title": "deployed and checked",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view 40064226338",
      "output": "✓ main Deploy · 40064226338\nTriggered via push about 1 minute ago\n\nJOBS\n✓ build in 12s (ID 120783962872)\n✓ deploy in 10s (ID 120784013137)\n✓ smoke-test in 4s (ID 120784100350)\n\nANNOTATIONS\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\nbuild: .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\ndeploy: .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\nsmoke-test: .github#1\n\n\nARTIFACTS\ngithub-pages\n\nFor more information about a job, try: gh run view --job=<job-id>\nView this run on GitHub: https://github.com/The-DevOps-Daily/guide-cicd-demo-2026-10-24/actions/runs/40064226338"
    },
    {
      "cmd": "gh run view --job 120784013137 --log | grep 'Deploy to GitHub Pages' | cut -f3- | grep -E 'Created deployment|Reported success'",
      "output": "2026-10-24T04:55:47.0085791Z Created deployment for 400c52f14fa1eb1a09f0ec85ec2a29843fb1c483, ID: 400c52f14fa1eb1a09f0ec85ec2a29843fb1c483\n2026-10-24T04:55:52.9178340Z Reported success!"
    },
    {
      "cmd": "gh run view 40064226338 --log | grep -E 'Z Attempt [0-9]+:' | cut -f1,3",
      "output": "smoke-test\t2026-10-24T04:55:58.6522241Z Attempt 1: live commit 400c52f14fa1eb1a09f0ec85ec2a29843fb1c483, expected 400c52f14fa1eb1a09f0ec85ec2a29843fb1c483"
    },
    {
      "comment": "the same check from your computer",
      "cmd": "curl -s https://the-devops-daily.github.io/guide-cicd-demo-2026-10-24/version.json",
      "output": "{\n  \"version\": \"1.0.0\",\n  \"commit\": \"400c52f14fa1eb1a09f0ec85ec2a29843fb1c483\"\n}"
    }
  ]
}
```

The site is live at the address in `page_url`, and every deployment shows up in the repository's **Deployments** list with its commit.

## Roll Back

When a deployment goes wrong, you have two ways back:

- **Re-deploy the previous build.** Every run keeps its artifact, so re-running the `deploy` job of an older run puts that run's files back. This is the fast path.
- **Revert the change.** `git revert` the bad commit and merge it; the normal pipeline builds and deploys the result. It is slower, but `main` and production agree again, and the next deployment does not bring the bad change back.

Use the first to stop the damage and the second to fix the history. To try the fast path, the companion repository deployed two versions and then rolled back to the older one. These runs use the final version of `deploy.yml` from Part 7, which has the same `deploy` and `smoke-test` jobs:

```terminal
{
  "title": "roll back by re-running a deploy job",
  "prompt": "$",
  "steps": [
    {
      "comment": "the newest run is live; the one below it is the previous version",
      "cmd": "gh run list --workflow deploy.yml --limit 2",
      "output": "STATUS  TITLE                               WORKFLOW  BRANCH  EVENT  ID           ELAPSED  AGE\n✓       Add kubectl logs to the cheatsheet  Deploy    main    push   40066117968  1m36s    about 1 minute ago\n✓       Package the Pages artifact once...  Deploy    main    push   40065982801  1m36s    about 3 minutes ago"
    },
    {
      "cmd": "gh run view 40065982801 --json jobs --jq '.jobs[] | select(.name == \"deploy\") | .databaseId'",
      "output": "120789437147"
    },
    {
      "comment": "re-runs the deploy job and the jobs that depend on it; the approval is needed again",
      "cmd": "gh run rerun 40065982801 --job 120789437147",
      "output": "✓ Requested rerun of job 120789437147 on run 40065982801"
    },
    {
      "comment": "after the approval: the smoke test of the old run expects the old commit",
      "cmd": "gh run view 40065982801 --log | grep -E 'Z Attempt [0-9]+:' | cut -f1,3",
      "output": "smoke-test\t2026-10-24T05:26:50.7277387Z Attempt 1: live commit cb6978300f41c1fce86ba79ff009a6b297ea5d95, expected cb6978300f41c1fce86ba79ff009a6b297ea5d95"
    },
    {
      "cmd": "curl -s \"https://the-devops-daily.github.io/guide-cicd-demo-2026-10-24/version.json?after=rollback\"",
      "output": "{\n  \"version\": \"1.0.0\",\n  \"commit\": \"cb6978300f41c1fce86ba79ff009a6b297ea5d95\"\n}"
    }
  ]
}
```

The live site serves `cb69783` again, the commit of the older run, while `main` is one commit ahead. Re-running the newest run's `deploy` job rolled it forward again.

Two things make this work. The companion repository got the second one wrong at first:

- **The artifact must still exist.** `upload-pages-artifact` keeps its artifact for 1 day by default. Set `retention-days` to how far back you want to be able to roll:

  ```yaml
  - name: Package the site for GitHub Pages
    uses: actions/upload-pages-artifact@v5
    with:
      path: dist/
      retention-days: 14
  ```

- **The deploy job must not create the artifact.** An earlier version of the workflow packaged the site inside the `deploy` job. Re-running that job uploaded a second `github-pages` artifact into the same run, and the deployment failed:

```terminal
{
  "title": "a re-run that could not roll back",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view 40065147665 --attempt 2 | grep -m 1 'Multiple artifacts'",
      "output": "X Error: Multiple artifacts named \"github-pages\" were unexpectedly found for this workflow run. Artifact count is 2."
    }
  ]
}
```

Package once, in an earlier job, and keep the deploy job to the deployment itself. A run can be re-run for up to 30 days, and at most 50 times (since April 2026).

## Deployment Strategies

GitHub Pages swaps the whole site at once. For an application on servers or Kubernetes, you choose how the new version replaces the old one. The workflow triggers and watches the rollout; the platform (a load balancer, Kubernetes, a service mesh) does the traffic switching.

| Strategy   | How it works                                                                       | You need                                 | Rollback                                    |
| ---------- | ---------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| Recreate   | Stop the old version, start the new one                                            | Nothing extra; accepts a short outage    | Deploy the old version again                |
| Rolling    | Replace instances a few at a time, each after a health check                       | Several instances behind a load balancer | Roll back the same way, or undo the rollout |
| Blue-green | Start the new version next to the old, then switch all traffic at once             | Capacity for two full copies             | Switch traffic back, in seconds             |
| Canary     | Send a small share of traffic to the new version, widen it while metrics stay good | Traffic splitting and good metrics       | Send the share back to zero                 |

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "Deploy v2", "sub": "next to v1", "icon": "rocket", "variant": "soft" },
    { "label": "Canary", "sub": "5% of traffic to v2", "icon": "activity", "variant": "soft" },
    { "label": "Watch metrics", "sub": "errors, latency", "icon": "check", "variant": "accent" }
  ],
  "branch": [
    { "label": "Healthy: widen to 25%, 50%, 100%", "variant": "good" },
    { "label": "Unhealthy: back to 0%, keep v1", "variant": "bad" }
  ]
}
```

On Kubernetes, a Deployment does a rolling update by default, and the workflow only needs to change the image and wait for the result. These steps (not run in the companion repository) deploy an image by digest and undo the rollout only if the new version was applied and did not become healthy:

```yaml
- name: Update the image
  id: update
  env:
    IMAGE: ghcr.io/my-org/cheatsheet@${{ needs.build.outputs.digest }}
  run: kubectl set image deployment/cheatsheet web="$IMAGE"
- name: Wait for the rollout
  id: rollout
  run: kubectl rollout status deployment/cheatsheet --timeout=5m
- name: Undo the rollout if it did not become healthy
  if: failure() && steps.update.outcome == 'success' && steps.rollout.outcome == 'failure'
  run: kubectl rollout undo deployment/cheatsheet
```

The condition matters: a plain `if: failure()` would also run when an earlier step failed before anything changed, and `rollout undo` would then revert the release that was running fine.

For blue-green and canary releases on Kubernetes, tools such as Argo Rollouts and Flagger change the traffic split step by step and roll back on bad metrics; the workflow then only updates the desired version, often through a Git repository that Argo CD watches.

For a single server, a release directory per commit and a symlink give you atomic switches and instant rollbacks. This sketch (also not run here) uses an SSH key from an environment secret and pins the server's host key instead of turning host key checking off:

```yaml
- name: Deploy over SSH
  env:
    SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
    KNOWN_HOSTS: ${{ vars.DEPLOY_KNOWN_HOSTS }}
    HOST: ${{ vars.DEPLOY_HOST }}
  run: |
    install -m 700 -d ~/.ssh
    printf '%s\n' "$SSH_KEY" > ~/.ssh/deploy_key
    chmod 600 ~/.ssh/deploy_key
    printf '%s\n' "$KNOWN_HOSTS" > ~/.ssh/known_hosts
    release="/srv/cheatsheet/releases/$GITHUB_SHA"
    rsync -a -e "ssh -i ~/.ssh/deploy_key" site/ "deploy@$HOST:$release/"
    ssh -i ~/.ssh/deploy_key "deploy@$HOST" \
      "ln -sfn $release /srv/cheatsheet/next && mv -T /srv/cheatsheet/next /srv/cheatsheet/current"
```

`mv -T` replaces the `current` link in one step, so no request ever sees a half-copied release. A rollback points `current` at the previous release directory.

## Common Mistakes

- **Building separately for each environment.** Build once and promote the same artifact.
- **`cancel-in-progress: true` on deployments.** It can stop a deployment halfway. Use it for CI on pull requests, not for deploys.
- **No smoke test.** "The deploy step succeeded" does not mean users get the new version.
- **Production credentials at repository level.** Put them in the environment, so only approved deployment jobs get them.
- **Turning off SSH host key checking.** `StrictHostKeyChecking=no` lets anyone in the network path pose as your server. Store the host key and check it.
- **Artifacts that expire before you need them.** Set `retention-days` on what you may want to roll back to.

## Summary

- Build once, then deploy that exact artifact.
- Environments hold deployment secrets and protection rules such as required reviewers, wait timers and branch rules.
- A `concurrency` group with `cancel-in-progress: false` allows one deployment at a time; `queue: max` keeps more than one waiting.
- A smoke test against the live system confirms the deployment; re-running an older run's deploy job is a fast rollback if its artifact still exists.
- Rolling, blue-green and canary strategies are done by the platform; the workflow starts and watches them.

In [Part 7](/guides/introduction-to-cicd/07-advanced-workflows-and-automation) you test on Linux, Windows and macOS, turn CI into a reusable workflow that the deploy workflow calls, and merge through a merge queue.

## Keep Learning

- [Deployment Strategies: Blue-Green vs Canary vs Rolling](/posts/deployment-strategies-guide) and the [Deployment Strategies simulator](/games/deployment-strategies)
- [Blue-Green vs Canary Deployments](/comparisons/blue-green-vs-canary-deployments)
- [Production Deployment Checklist](/checklists/production-deployment)
- [Interview question: blue-green deployment](/interview-questions/mid/cicd-blue-green-deployment)
- [Preview Environment Simulator](/games/preview-environment-simulator)
