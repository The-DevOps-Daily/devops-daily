---
title: 'Stacked Pull Requests on GitHub: What They Actually Fix'
excerpt: 'GitHub shipped stacked pull requests to public preview. What stacking solves, how the gh-stack workflow works, and when a stack is the wrong shape.'
category:
  name: 'Git'
  slug: 'git'
date: '2026-07-30'
publishedAt: '2026-07-30T18:00:00Z'
updatedAt: '2026-07-30T18:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Git
  - GitHub
  - Code Review
  - CI/CD
  - DevOps
---

Every team eventually produces the pull request nobody wants to open. Forty files, a schema migration, a refactor that touches three services, and a comment from the author that says "sorry, this got big". It sits for four days. The review it eventually gets is a scan for obvious mistakes, because reviewing it properly would take an afternoon nobody has.

The usual advice is to split it up. That advice is correct and, on GitHub, has historically been annoying to follow: you either open one PR and wait for it to merge before starting the next, or you open several PRs whose diffs all contain each other's changes, and reviewers have to mentally subtract one from the other.

On 30 July 2026, GitHub moved [stacked pull requests into public preview](https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview/). This is the workflow that tools like Graphite, git-branchless and Gerrit have offered for years, now built into the place the review already happens.

## TL;DR

- A stack is an ordered series of PRs, each targeting the one below it, so every PR shows only its own layer's diff.
- Reviewers can work on different layers at the same time instead of queueing behind one big review.
- Merging the top ready PR lands it and every unmerged layer beneath it in one operation; merging a middle layer auto-rebases and retargets the ones above.
- Branch protections, required checks, and merge requirements keep working as they already do.
- Install with `gh extension install github/gh-stack`, or create stacks on github.com or mobile.
- Merge queue support is still rolling out, so check that before you restructure a repo's workflow around this.
- Stacking suits changes that are genuinely sequential. It does not help when your work is really several independent changes, and it actively hurts when the bottom layer is the contentious one.

## Prerequisites

- Comfort with `git rebase` and what it does to commit history
- A GitHub repository you can open PRs against
- The [GitHub CLI](https://cli.github.com/) installed, if you want the terminal workflow
- Familiarity with your repo's branch protection rules, since stacking interacts with them

## The problem stacking solves

Say you are adding rate limiting to an API. The work has a natural order:

1. Add a Redis client and its config
2. Add a token bucket implementation with tests
3. Add the middleware that uses it
4. Turn it on for three routes

That is one feature and four genuinely separate reviews. The Redis client is infrastructure someone should check for connection handling and timeouts. The token bucket is an algorithm someone should check for correctness. The middleware is integration. The rollout is a judgement call about which routes go first.

Without stacking you have two options, and both are bad.

**One big PR.** All four concerns arrive at once. The reviewer who cares about the bucket algorithm has to scroll past config. The person who knows the routes has to read Redis setup. Everyone reviews everything shallowly.

**Sequential PRs.** You open the Redis PR, then wait. It sits for a day. You cannot start the token bucket on top of it without branching off an unmerged branch, and if you do, its PR diff will include the Redis changes too, because GitHub compares against `main` by default. Reviewers see 400 lines when 120 are yours.

The second problem is the one stacking fixes directly. Each PR targets the branch below it rather than `main`, so its diff contains only that layer.

```diagram
{
  "type": "flow",
  "title": "A four-layer stack, each PR targeting the one below",
  "nodes": [
    { "label": "main", "detail": "the trunk everything eventually lands on", "tone": "slate" },
    { "label": "PR #1 redis-client", "detail": "base: main. Diff: the client and its config, nothing else", "tone": "blue" },
    { "label": "PR #2 token-bucket", "detail": "base: redis-client. Diff: only the algorithm and its tests", "tone": "violet" },
    { "label": "PR #3 middleware", "detail": "base: token-bucket. Diff: only the wiring", "tone": "amber" },
    { "label": "PR #4 enable-routes", "detail": "base: middleware. Diff: three route registrations", "tone": "green" }
  ]
}
```

## What is actually in the preview

The announcement is specific about the capabilities, and they map to the pain points above.

**Each PR shows only its layer.** Open any PR in the stack and you review that layer's diff. GitHub renders a **stack map** alongside it showing where this PR sits in the larger change, which is the context a standalone small PR normally loses. "Why are we adding a token bucket?" is answerable without asking.

**Reviews happen in parallel.** Four people can review four layers at once. On a sequential-PR workflow, layer 2 cannot even be opened until layer 1 merges, so the total wall-clock time is the sum of every review. In a stack it is closer to the slowest single review.

**Merging is flexible in both directions.** You can merge the latest ready PR and land it plus every unmerged layer below it in one operation. Or you can land layers one at a time, and the PRs above automatically rebase and retarget. That second behaviour is the tedious part of hand-rolled stacking, where merging the bottom branch leaves you rebasing three branches by hand and force-pushing each one.

**Your existing rules still apply.** Branch protections, required status checks, and merge requirements govern what reaches `main` exactly as before. This matters more than it sounds: a common worry about stacking tools is that they route around review policy, and here the policy is unchanged.

## Creating a stack

There are several entry points: github.com, the mobile app, and a CLI extension. There is also a `gh-stack` skill so Copilot's coding agents can work with stacks.

For terminal work, install the extension:

```terminal
{
  "title": "set up and inspect a stack",
  "prompt": "$",
  "steps": [
    { "comment": "one-time install of the extension" },
    { "cmd": "gh extension install github/gh-stack", "output": "✓ Installed extension github/gh-stack" },
    { "comment": "the shape of the work: each branch built on the previous one" },
    { "cmd": "git log --oneline --graph main..enable-routes", "output": "* 9f2c1ad enable rate limiting on 3 routes\n* 4b71e08 add rate limit middleware\n* c0d3e91 add token bucket + tests\n* 7a1f5bc add redis client and config" },
    { "comment": "each PR targets the branch below, not main" },
    { "cmd": "gh pr list --json number,headRefName,baseRefName", "output": "#412  redis-client    -> main\n#413  token-bucket    -> redis-client\n#414  middleware      -> token-bucket\n#415  enable-routes   -> middleware" }
  ]
}
```

The `baseRefName` column is the whole idea. A normal PR has `main` as its base and its diff is measured against `main`. A stacked PR's base is the layer below, so its diff is measured against that, and only your new work shows up.

:::tip
If you want to understand stacking before installing anything, you can build one by hand: create each branch from the previous one, then open each PR with `gh pr create --base <branch-below>`. That is all a stack is at the Git level. The tooling exists because *maintaining* one through rebases is the tedious part, not creating one.
:::

## The part that used to hurt: rebasing

Here is why people bounced off hand-rolled stacking before tooling existed.

You have four branches. A reviewer asks for a change in layer 2. You amend the token bucket, and now layers 3 and 4 are built on a commit that no longer exists. You rebase `middleware` onto the new `token-bucket`, force-push, then rebase `enable-routes` onto the new `middleware`, force-push. Four layers is manageable. Six is not, and one mistake with `--force` on the wrong branch loses work.

This is the cascade that automation exists to handle:

```diagram
{
  "type": "loop",
  "title": "One change low in the stack invalidates everything above it",
  "loopTop": "the reason stacks need tooling rather than discipline",
  "loopBack": "repeat for every layer above the change",
  "nodes": [
    { "label": "Amend layer 2", "detail": "review feedback on the token bucket rewrites its commit", "tone": "amber" },
    { "label": "Layer 3 is orphaned", "detail": "it was built on the old commit, which no longer exists", "tone": "red" },
    { "label": "Rebase and force-push", "detail": "onto the new layer 2, being careful about --force-with-lease", "tone": "blue" },
    { "label": "Layer 4 is now orphaned", "detail": "same problem, one level up", "tone": "red" }
  ]
}
```

GitHub's version handles the retargeting when layers merge. If you are rebasing by hand for any reason, use `--force-with-lease` rather than `--force`, so a push fails instead of silently discarding a teammate's commit. Our post on [undoing a Git rebase](/posts/undo-git-rebase) covers recovery through the reflog when one goes wrong, which is worth reading before your first stack rather than during it.

## When stacking is the wrong tool

A stack encodes a claim: these changes are ordered, and later ones depend on earlier ones. When that claim is false, stacking adds coordination cost for nothing.

**Your changes are actually independent.** If four changes touch different parts of the codebase and none depends on another, open four normal PRs against `main`. They already review in parallel and merge in any order. Putting them in a stack invents a dependency and means a hold-up on layer 1 blocks the rest.

**The bottom layer is the contentious one.** This is the failure mode worth planning for. If layer 1 is "switch to a new Redis client library" and that is going to get argued about, then layers 2 through 4 are built on a foundation that might not survive. Sequence deliberately: put the parts you are confident about at the bottom and the debatable design decisions at the top, where reworking them does not cascade.

**The change genuinely is atomic.** A rename across 200 files is one change. Splitting it into five PRs that each leave the build broken is worse than one large mechanical diff with a clear commit message. Reviewers skim mechanical changes quickly, and that is fine.

**Every layer must be independently safe to merge.** This is the discipline stacking demands and the one teams underestimate. If layer 2 merges to `main` on its own, `main` must still build, tests must still pass, and production must still work. A half-wired feature is acceptable; a broken one is not. That usually means the wiring layer comes last and often sits behind a flag. Our post on [progressive delivery with feature flags](/posts/how-to-implement-progressive-delivery-with-feature-flags) covers the pattern that makes this comfortable.

## What this changes about review culture

The interesting effect is not the tooling, it is what stacking does to the incentives.

Splitting a big change has always been possible and has always cost the author something: extra branches, extra PR descriptions, waiting on merges, rebasing. Reviewers benefit and authors pay, which is why "sorry, this got big" is such a common comment. Lowering the author's cost is what changes behaviour.

Two things worth deciding as a team before adopting it:

**How small is a layer?** A stack of twelve PRs each changing eight lines is its own kind of unreviewable. The unit that works is a coherent idea a reviewer can hold in their head, which in practice is usually somewhere between 50 and 400 lines.

**Who reviews what?** The value of parallel review only materialises if layers reach different people. If one person reviews all six layers sequentially, you have added stack management overhead and saved nobody any time. Route the algorithm layer to whoever knows that domain and the rollout layer to whoever owns the service.

:::warning
Merge queue support is still rolling out over the coming weeks. If your repository merges through a queue, confirm the interaction before you move a team's workflow onto stacks. The two features overlap in what they do to a branch just before it lands, and that is the point at which surprises are most expensive.
:::

## Try it on something small

The honest way to evaluate this is on a change you were going to split anyway.

1. Pick a feature with a genuine internal order, ideally three or four layers.
2. Create the branches so each is built on the previous one.
3. Open each PR with the layer below as its base.
4. Get different people to review different layers and see whether the parallelism materialises.
5. Merge the bottom layer first and watch what happens to the ones above it.

Step 5 is the one to pay attention to, because auto-retargeting is the feature that decides whether stacking is sustainable for your team or an occasional trick for big changes. Doing it by hand is exactly the friction that kept this workflow niche outside of companies that built tooling for it.

If you want to shore up the underlying Git first, our [Git concepts simulator](/games/git-concepts-simulator) covers branching and rebasing interactively, and [resolving merge conflicts](/posts/how-do-i-resolve-merge-conflicts-in-a-git-repository) covers the situation you are most likely to hit mid-stack.

## Wrapping up

Stacked pull requests do not make large changes small. They make a large change reviewable as a sequence of small ones, which is a different and more achievable thing.

The workflow has existed for years in other tools. What changed on 30 July 2026 is that it is now native to GitHub, so the stack lives where the review, the checks, and the branch protections already are, and nobody has to adopt a second tool to get it.

Worth trying on your next change that would have earned an apology in its description.
