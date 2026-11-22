---
title: 'How to Give Every Pull Request Its Own Postgres Database, Then Delete It After Merge'
excerpt: 'Create a Neon branch of your main database when a pull request opens, run migrations, seed and tests on it, and delete it when the PR closes. Here is the complete GitHub Actions workflow, tested on real pull requests: a branch with a million rows answered its first query in about 1.4 seconds, and cleanup left no branch behind.'
category:
  name: 'CI/CD'
  slug: 'ci-cd'
date: '2026-11-25'
publishedAt: '2026-11-25T15:00:00Z'
updatedAt: '2026-11-25T15:00:00Z'
readingTime: '18 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - CI/CD
  - GitHub Actions
  - Postgres
  - Neon
  - Preview Environments
  - Database Branching
sponsorCampaign: 'neon'
---

**Short answer:** give each pull request a database branch. In GitHub Actions, create a Neon branch of `main` named `preview/pr-<number>` when the pull request opens, run your migrations, seed and tests against its connection string, and delete the branch when the pull request closes. Set an expiry on every branch and run a daily sweep, so a failed cleanup job cannot leave branches behind.

A Neon branch is a copy-on-write copy of the parent database. The preview gets your real schema and data right away, and it stores only what the pull request changes. We built this as a small demo repo and ran it on real pull requests. A branch of a 309 MB database with a million rows answered its first query 1.3 to 1.8 seconds after the create request, it caught a migration that an empty test database passed, and when the pull requests closed, every branch was deleted.

```github
https://github.com/The-DevOps-Daily/postgres-per-pr
```

## TL;DR

- **Create on open, delete on close.** `neondatabase/create-branch-action` makes `preview/pr-<n>` from `main` on `opened`, `reopened` and `synchronize`. `neondatabase/delete-branch-action` removes it on `closed`, which GitHub sends for merged and unmerged pull requests.
- **Ready in under two seconds.** Over 10 runs on GitHub Actions, the first query on a new branch of a 1,002,000-row database worked 1,326 to 1,791 ms after the create request (median 1,438 ms). Deleting took 1.6 to 2.1 seconds.
- **Real data catches real bugs.** A unique index passed on an empty `postgres:18` container and failed on the branch, because production had 2,000 duplicates that differ only in case.
- **Storage follows the writes.** Three previews that each look like the full 309 MB database stored about 99 MB together, a little less than the 109 MB of indexes their migrations built.
- **On a paid plan, the first limit is compute, not branches.** At 25 branches, 20 preview computes answered and 4 failed with `exceeded the limit of concurrently active endpoints`.
- **Cheap to test.** The whole test, 47 branches over three hours, used 1,577 CU-seconds of compute and 13 extra branch-hours on Neon, about 13 cents.
- **Backstops matter.** `expires_at` plus a daily sweep deleted the orphans we planted and kept the open pull request's branch.
- **Mask first.** Never branch real personal data into previews: branch from a checked anonymized branch, or use a schema-only branch.

## Prerequisites

- A GitHub repository with a migration command, for example `npm run migrate` or `prisma migrate deploy`.
- A Neon project whose default branch is `main`. Any plan works for the workflow, but the limits differ (see [the limits section](#h2-the-limits-you-hit-first)).
- A `NEON_API_KEY` repository secret and a `NEON_PROJECT_ID` repository variable. The [Neon GitHub integration](https://neon.com/docs/guides/neon-github-integration) sets both. If you make the key yourself, make it a project-scoped key, so it cannot reach your other projects.
- Basic GitHub Actions knowledge: events, jobs and secrets. The [GitHub Actions quiz](/quizzes/github-actions-quiz) is a quick check.

## How it works

Three workflows do the work. One creates the database, one deletes it, and one cleans up after the other two.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "PR opened or pushed", "sub": "pull_request", "icon": "branch", "tone": "slate" },
    { "label": "Create branch", "sub": "preview/pr-<n> from main", "icon": "database", "tone": "violet" },
    { "label": "Migrate, seed, test", "sub": "against the branch", "icon": "check", "tone": "green" },
    { "label": "Comment", "sub": "schema diff + host", "icon": "activity", "tone": "blue" },
    { "label": "PR closed", "sub": "merged or not", "icon": "gear", "tone": "amber" },
    { "label": "Delete branch", "sub": "plus expiry and a daily sweep", "icon": "shield", "tone": "red" }
  ]
}
```

- **`preview-db.yml`** runs on `opened`, `reopened` and `synchronize`. It creates the branch with [`neondatabase/create-branch-action`](https://github.com/neondatabase/create-branch-action), or reuses it if it already exists, runs your migrations, seed and tests on it, and posts two comments: the schema diff from [`neondatabase/schema-diff-action`](https://github.com/neondatabase/schema-diff-action), and the host and branch name.
- **`preview-db-cleanup.yml`** runs on `closed`. GitHub sends `closed` for merged and for abandoned pull requests, so one job covers both. It deletes the branch with [`neondatabase/delete-branch-action`](https://github.com/neondatabase/delete-branch-action).
- **`orphan-sweep.yml`** runs every day. It deletes any `preview/pr-<n>` branch whose pull request is no longer open, or that is older than a set number of days.

Each branch also gets an `expires_at` 14 days out, so Neon deletes it even if all three workflows fail. Neon allows an expiry of at most 30 days from now ([branch expiration docs](https://neon.com/docs/guides/branch-expiration), updated 2026-11-10).

Why does `main` matter here? The migrations runner records each applied file in a `schema_migrations` table. A branch of `main` inherits that table, so on the preview only the migrations the pull request adds actually run, against a full copy of production data. This is the same idea as [rehearsing migrations on a Neon branch](/posts/rehearse-migrations-on-a-neon-branch), done on every pull request instead of before a deploy.

## The workflow

This is the complete workflow. Copy it to `.github/workflows/preview-db.yml` and change the step marked "Replace these". It assumes an npm project with a lockfile (for `cache: npm` and `npm ci`) and the default Neon database `neondb` with role `neondb_owner`. If yours differ, set `database` and `role` on `create-branch-action`, `database` on `schema-diff-action`, and the names in the comment. For another language, swap the Node.js setup steps for your own. It is [`examples/preview-db.yml`](https://github.com/The-DevOps-Daily/postgres-per-pr/blob/main/examples/preview-db.yml) in the repo. The repo's own `.github/workflows/preview-db.yml` is a longer version of it that also records step timings and puts them in the comment. We ran this exact file on [pull request #4](https://github.com/The-DevOps-Daily/postgres-per-pr/pull/4) to check it works as printed.

```yaml
# .github/workflows/preview-db.yml
# A Postgres database per pull request: a Neon branch of main named preview/pr-<number>.
# Needs a NEON_API_KEY secret and a NEON_PROJECT_ID variable (the Neon GitHub integration sets both).
name: preview-db

on:
  pull_request:
    types: [opened, reopened, synchronize]

# One run per pull request at a time, shared with the cleanup workflow.
concurrency:
  group: preview-db-${{ github.event.pull_request.number }}
  cancel-in-progress: false

permissions:
  contents: read
  pull-requests: write

jobs:
  preview:
    # Pull requests from forks get no secrets.
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      BRANCH: preview/pr-${{ github.event.pull_request.number }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24
          cache: npm

      - run: npm ci --ignore-scripts

      # Backstop: Neon deletes the branch 14 days after it was created, even if no cleanup runs.
      # The action does not change the expiry of a branch that already exists.
      - name: Expiry date
        run: echo "EXPIRES_AT=$(date -u --date '+14 days' +%Y-%m-%dT%H:%M:%SZ)" >> "$GITHUB_ENV"

      - name: Create the Neon branch
        id: branch
        # Its outputs are not registered as secrets. The runner masked the user:password part of
        # db_url in our logs, but never print the password output on its own.
        uses: neondatabase/create-branch-action@fb620d43d4c565abaf088b848a4e28e5c4ea4d9c # v6 (6.3.1)
        with:
          project_id: ${{ vars.NEON_PROJECT_ID }}
          api_key: ${{ secrets.NEON_API_KEY }}
          branch_name: ${{ env.BRANCH }}
          parent_branch: main
          expires_at: ${{ env.EXPIRES_AT }}

      # Replace these with your own migrate, seed and test commands.
      - name: Migrate, seed, test
        run: |
          node scripts/wait-for-db.mjs
          node scripts/migrate.mjs
          node scripts/seed.mjs
          npm test
        env:
          DATABASE_URL: ${{ steps.branch.outputs.db_url }}

      - name: Schema diff against main
        if: ${{ !cancelled() && steps.branch.outcome == 'success' }}
        uses: neondatabase/schema-diff-action@80cfa8521628e890015b60f5291a7738926617dc # v1.0.1
        with:
          project_id: ${{ vars.NEON_PROJECT_ID }}
          api_key: ${{ secrets.NEON_API_KEY }}
          compare_branch: ${{ env.BRANCH }}
          base_branch: main

      # One comment per pull request, updated on every push. No password in it.
      - name: Comment the connection details
        if: ${{ !cancelled() && steps.branch.outcome == 'success' }}
        uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0
        env:
          DB_HOST: ${{ steps.branch.outputs.db_host }}
          BRANCH_ID: ${{ steps.branch.outputs.branch_id }}
          JOB_STATUS: ${{ job.status }}
        with:
          script: |
            const marker = '<!-- preview-db -->';
            const { BRANCH, BRANCH_ID, DB_HOST, JOB_STATUS } = process.env;
            const body = [
              marker,
              `### Preview database: \`${BRANCH}\``,
              `- Neon branch: \`${BRANCH_ID}\`, deleted when this PR closes, or 14 days after it was created`,
              `- Host: \`${DB_HOST}\`, database \`neondb\`, role \`neondb_owner\``,
              `- Migrate, seed, test: ${JOB_STATUS === 'success' ? 'passed' : 'failed, see the run'}`,
            ].join('\n');
            const { owner, repo } = context.repo;
            const issue_number = context.payload.pull_request.number;
            const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number });
            const old = comments.find((c) => c.body.startsWith(marker));
            if (old) await github.rest.issues.updateComment({ owner, repo, comment_id: old.id, body });
            else await github.rest.issues.createComment({ owner, repo, issue_number, body });
```

The parts that matter:

- **`concurrency`** lets only one run per pull request work at a time, and the cleanup workflow uses the same group. A `closed` event that arrives during a create run waits for it to finish. It is not a strict queue: GitHub keeps at most one pending run per group and drops an older pending one, so in a burst of events a late create can still run after the delete. The expiry and the daily sweep below clean up that case.
- **The fork check.** GitHub does not give secrets to `pull_request` runs from forks, so the job would fail anyway. The `if:` skips it cleanly. Do not switch to `pull_request_target` to get the secret: that event runs with your secrets while the pull request code is untrusted.
- **The key goes only to the Neon steps.** `NEON_API_KEY` is passed with `with:` to the three Neon actions, not as a job-wide `env`. Your migrations and tests get only `DATABASE_URL`. A pull request from a branch in your repository can still change the workflow itself, so anyone with push access can reach the key. Use a project-scoped key, and if that is not enough, require approval with a [GitHub environment](/guides/introduction-to-cicd/06-deployment-strategies-and-environments).
- **Keep the password out of the comment and the logs.** The comment has the host, database and role. The action does not register its outputs as secrets. In our logs the runner still hid the `user:password@` part of `DATABASE_URL` (it printed `DATABASE_URL: ***ep-blue-rain-...`), but a migration tool or an error message that prints the password on its own would show it in clear text. The repo's `scripts/wait-for-db.mjs`, the first command in that step, registers the password with `::add-mask::` before anything else runs; do the same in your first command. Never echo the action's `password` output or pass it to a step on its own. A reviewer who needs to connect gets the connection string from the Neon Console or with `neon connection-string preview/pr-<n>`.
- **Pushes reuse the branch.** On `synchronize` the action returns the existing branch, so the schema from the last push is still there and only new migration files run. If you edit a migration that already ran on the preview, our runner refuses, because the file's checksum changed. If you delete or revert one, nothing undoes its changes on the branch, and the preview no longer matches the pull request. In both cases add a forward migration, or delete the branch (close and reopen the pull request, or reset it with [`neondatabase/reset-branch-action`](https://github.com/neondatabase/reset-branch-action)) to start again from `main`. Pull request #3 below could change its migration only because the first version failed and was rolled back. The action also does not change the expiry of an existing branch, so the 14 days count from the first push.
- **Pinned actions.** Every `uses:` is pinned to a commit SHA, with the version in a comment. The [CI/CD guide's security chapter](/guides/introduction-to-cicd/09-security-best-practices-and-production-patterns#h2-pin-actions-to-commits) explains why.

The cleanup workflow is shorter:

```yaml
# .github/workflows/preview-db-cleanup.yml
# Delete the pull request's Neon branch when the PR closes (merged or not).
name: preview-db-cleanup

on:
  pull_request:
    types: [closed]

concurrency:
  group: preview-db-${{ github.event.pull_request.number }}
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  delete:
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Delete the Neon branch
        uses: neondatabase/delete-branch-action@4468d825d5a88ef4012f1705a82f02ec3072f776 # v3.2.1
        with:
          project_id: ${{ vars.NEON_PROJECT_ID }}
          api_key: ${{ secrets.NEON_API_KEY }}
          branch: preview/pr-${{ github.event.pull_request.number }}
```

`delete-branch-action` fails the job when the branch no longer exists, for example after the expiry or the sweep below got there first. The repo's version of this workflow looks the branch up first and skips the delete; see [the cleanup check](#h3-cleanup-checked) for both cases.

On a real pull request the two comments look like this. These are the comments of the instrumented workflow on [pull request #2](https://github.com/The-DevOps-Daily/postgres-per-pr/pull/2), which adds an index:

```text
Preview database: preview/pr-2

Neon branch      preview/pr-2 (br-damp-frog-bea6q8tw), created by this run
Host             ep-dawn-violet-be0tcp2e.c-9.us-east-2.aws.neon.tech
Database / role  neondb / neondb_owner
Expires          2026-12-06T07:29:19Z (deleted earlier when this PR closes)
Checks           migrate, seed and tests passed
```

The schema diff comment (excerpt):

```diff
--- neondb-schema.sql	Branch main
+++ neondb-schema.sql	Branch preview/pr-2
@@ -131,8 +131,15 @@
     ADD CONSTRAINT users_pkey PRIMARY KEY (id);


 --
+-- Name: bookmarks_user_recent_idx; Type: INDEX; Schema: public; Owner: neondb_owner
+--
+
+CREATE INDEX bookmarks_user_recent_idx ON public.bookmarks USING btree (user_id, created_at DESC, id DESC);
+
+
+--
 -- Name: bookmarks bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
```

The schema diff comment compares the preview branch with `main`, so a reviewer sees what the migration did to the real schema, not only the SQL file.

## Catch the branches the close job misses

The close workflow can miss a branch: a run that failed, was cancelled, or never started because Actions was down. The 14-day expiry catches those eventually. A daily sweep catches them the next morning. This is `orphan-sweep.yml`:

```yaml
name: orphan-sweep

on:
  schedule:
    - cron: '17 3 * * *'
  workflow_dispatch:
    inputs:
      max_age_days:
        description: Delete preview branches older than this many days
        default: '7'
      dry_run:
        description: Only list what would be deleted
        type: boolean
        default: false

permissions:
  contents: read
  pull-requests: read

jobs:
  sweep:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - run: node scripts/cleanup-orphans.mjs
        env:
          NEON_API_KEY: ${{ secrets.NEON_API_KEY }}
          NEON_PROJECT_ID: ${{ vars.NEON_PROJECT_ID }}
          GITHUB_TOKEN: ${{ github.token }}
          MAX_AGE_DAYS: ${{ inputs.max_age_days || '7' }}
          DRY_RUN: ${{ inputs.dry_run && '1' || '0' }}
```

[`scripts/cleanup-orphans.mjs`](https://github.com/The-DevOps-Daily/postgres-per-pr/blob/main/scripts/cleanup-orphans.mjs) lists the project's branches and, for every branch named exactly `preview/pr-<n>`, asks the GitHub API for pull request `<n>`. It deletes the branch when the pull request is closed or does not exist, or when the branch is older than `MAX_AGE_DAYS`. It never touches the default branch, protected branches, or any branch with another name, so people can still make their own branches in the same project. Copy it with `scripts/lib/env.mjs` and `scripts/lib/neon.mjs`, which it imports.

The age rule is a lifetime policy, not only orphan cleanup. It deletes the branch of an open pull request that is older than `MAX_AGE_DAYS`, even if a reviewer is using it or a run is migrating it at that moment, and the sweep does not share the per-PR concurrency group. The next push recreates the branch from the current `main`, with a new host. Set `MAX_AGE_DAYS` above how long your pull requests usually stay open.

Run it with `dry_run` first. Our dry runs and the real run are in the [cleanup check](#h3-cleanup-checked) below.

## What we measured

All numbers below come from GitHub Actions runs on GitHub-hosted `ubuntu-latest` runners, against a Neon project in `aws-us-east-2` on Postgres 18. The raw data is in the repo's [`results/`](https://github.com/The-DevOps-Daily/postgres-per-pr/tree/main/results) folder.

The `main` branch plays production: 50,000 users and 1,002,000 bookmarks, 309 MB by `pg_database_size` (Postgres prints it as 295 MB, in MiB). All sizes in this post are decimal MB. The data is synthetic, with no real people in it. It includes 2,000 bookmarks that differ from another bookmark of the same user only in the case of the host name, such as `https://Site12.example/...` next to `https://site12.example/...`. Real data collects duplicates like these, and they matter below.

### Time until the preview database answers

`bench/branch-timing.mjs` ran 10 times in a row in a GitHub Actions job. Each run creates a branch of `main` with its own compute through the Neon API, waits for the create operations, gets the connection string, and retries `SELECT 1` until it works. Then it runs the same migrate, seed and test commands as the workflow, deletes the branch, and checks that a `GET` for it returns 404.

```chart
{
  "type": "dots",
  "title": "Branch create, first query and delete times, 10 runs",
  "unit": "ms",
  "caption": "Neon branch of a 309 MB database with 1,002,000 rows, aws-us-east-2, from a GitHub-hosted runner. bench/branch-timing.mjs, 2026-11-22.",
  "series": [
    { "name": "Create operations finished", "samples": [1444, 1111, 1108, 1096, 1126, 1105, 1149, 1389, 1123, 1522], "median": 1124.5 },
    { "name": "First query answered", "samples": [1791, 1415, 1343, 1326, 1413, 1460, 1470, 1620, 1408, 1764], "median": 1437.5 },
    { "name": "Delete, from the delete request", "samples": [1821, 1855, 2095, 1822, 1595, 1868, 1808, 1811, 2139, 2103], "median": 1838.5 }
  ]
}
```

| Stage                                                         | Min      | Median   | Max      |
| ------------------------------------------------------------- | -------- | -------- | -------- |
| Create request answered by the API                            | 121 ms   | 136 ms   | 222 ms   |
| Create operations finished, from the create request           | 1,096 ms | 1,125 ms | 1,522 ms |
| First `SELECT 1`, from the create request                     | 1,326 ms | 1,438 ms | 1,791 ms |
| Delete, from the delete request until its operations finished | 1,595 ms | 1,839 ms | 2,139 ms |

The first connection worked on the first try in all 10 runs. Every branch had all 1,002,000 bookmarks, because it is a branch of `main`, not a restore. After every delete the API returned 404 for the branch.

Migrate, seed and test took 277 to 304 ms, 354 to 396 ms and 563 to 624 ms. Those include starting a Node.js process each time, and migrate had nothing to apply, because the bench branches carry no new migrations. The real migration times are in the pull requests below.

### Three real pull requests

We opened three pull requests on the demo repo. Each one ran `preview-db.yml` on a Neon branch, and `ci-container.yml`, the usual alternative, on a `postgres:18` service container with an empty database. Both run the same migrate, seed and test commands.

| Pull request                                                             | Change                                         | Neon: create step | Neon: migration | Container: migration | Result                           |
| ------------------------------------------------------------------------ | ---------------------------------------------- | ----------------- | --------------- | -------------------- | -------------------------------- |
| [#1](https://github.com/The-DevOps-Daily/postgres-per-pr/pull/1)         | add a nullable `archived_at` column            | 659 ms            | 95 ms           | 1 ms                 | both pass                        |
| [#2](https://github.com/The-DevOps-Daily/postgres-per-pr/pull/2)         | index on `(user_id, created_at DESC, id DESC)` | 905 ms            | 2,252 ms        | 2 ms                 | both pass                        |
| [#3](https://github.com/The-DevOps-Daily/postgres-per-pr/pull/3), push 1 | unique index on `(user_id, lower(url))`        | 1,528 ms          | failed          | 2 ms                 | **container passes, Neon fails** |
| [#3](https://github.com/The-DevOps-Daily/postgres-per-pr/pull/3), push 2 | delete the case duplicates, then the index     | 381 ms (reused)   | 2,618 ms        | 2 ms                 | both pass                        |

The create step time is measured inside the workflow around `create-branch-action`. The first query then took 761, 915, 1,062 and 135 ms. The last one was fast because the branch already existed and its compute was still running from the first push.

Pull request #3 is why a branch of production beats an empty container. The first push added this migration:

```sql
CREATE UNIQUE INDEX bookmarks_user_url_lower_key ON bookmarks (user_id, lower(url));
```

On the empty container it built in 2 ms and every test passed. On the Neon branch it failed:

```text
Error: 005_bookmarks_unique_url_case.sql failed: 23505 could not create unique index "bookmarks_user_url_lower_key"
```

The 2,000 case duplicates in `main` broke it. Merged as it was, this migration would have failed the deploy. The second push deleted the duplicates first, keeping the oldest bookmark of each pair, and the branch went green. Our container job could not tell the two versions apart. A container loaded with data that has the same duplicates would have caught it too, but then someone has to build and maintain that dataset; the branch has it for free.

The index in #2 shows the other gap: 2 ms on an empty table, 2,252 ms on a million rows. Neither number is a problem here, and neither is the lock time of the real deploy, which also depends on production hardware and traffic. But only the second one is in the right range. The [zero-downtime Postgres migrations checklist](/checklists/zero-downtime-postgres-migrations) covers what to do when that number gets big.

The whole job took about the same time either way. Over all our pull request runs, the Neon workflow took 16 to 27 seconds (13 to 17 for the shorter example version), and the container job 18 to 31 seconds. The container job spent 8 to 12 seconds in "Initialize containers", pulling and starting `postgres:18`. The Neon job spent that time on the branch, the schema diff and the comments.

### Storage: a full copy that is not stored twice

Each preview branch looks like a full copy. Inside Postgres, `pg_database_size` on the three branches reported 309 MB, 350 MB and 377 MB, and Neon's API reported a logical size of 333 MB for `main`. Three full copies would be about 1 GB. Neon does not store them as copies: a branch shares the parent's data and keeps only the pages it writes.

`bench/branch-objects.mjs` listed what each branch changed, compared with `main`:

| Branch         | What the migration wrote                 | New or changed relations                |
| -------------- | ---------------------------------------- | --------------------------------------- |
| `preview/pr-1` | a nullable column, 50 fixture rows       | none: no relation changed size          |
| `preview/pr-2` | a new index on 1,002,000 rows            | `bookmarks_user_recent_idx`, 40.7 MB    |
| `preview/pr-3` | deleted 2,000 rows, built a unique index | `bookmarks_user_url_lower_key`, 68.0 MB |

Neon's consumption API reports child branch storage per hour, as byte-months. For 08:00 to 09:00 UTC, when these three were the project's only child branches, it reported 133,665 byte-months. The root branch figure for the same hour, 447,906, times 744 hours gives back `main`'s logical size of 333 MB, so the same factor puts the three children at about **99 MB together**. That is about a tenth of three full copies, and a little less than the 109 MB of new indexes we measured inside Postgres. We did not find out why it is lower, and the figure does not split by branch. Neon's [usage docs](https://neon.com/docs/introduction/usage-calculations) explain the 744-hour month.

At the $0.35 per GB-month storage price on Launch and Scale, 99 MB costs about 3.5 cents a month. Compute costs more than storage here. The whole test, with 34 bench branches, 9 workflow runs on preview branches and every migration, used 1,577 CU-seconds between 07:00 and 10:00 UTC by the consumption API, about 0.44 CU-hours or 10 cents at the Scale rate. Extra branches added about 2.6 cents more, for a reason explained in [the limits section](#h2-the-limits-you-hit-first).

The rule of thumb: **a preview branch costs about what its pull request writes.** A column added with no default changed no relation size in our test, so it adds very little. An index on a big table adds about the size of the index. We did not test a migration that rewrites a whole table, such as a column type change, but by the same logic it writes, and so stores, about the size of the table. `branch-objects.mjs` only compares relation sizes, so small writes into existing pages do not show in that table.

### Cleanup, checked

Over the test we created 34 branches with the benches and 13 more through pull requests and by hand. All of them were deleted, and the project ended with `main` only. The full list, with what deleted each branch, is in [`results/cleanup-proof.md`](https://github.com/The-DevOps-Daily/postgres-per-pr/blob/main/results/cleanup-proof.md).

- **Merge and close.** We merged #1 and closed #2 and #3 without merging. All three `preview-db-cleanup` runs deleted the branch, and the "Check it is gone" step confirmed it. The merge also ran `deploy-migrations.yml`, which applied `003_bookmarks_archived_at.sql` to `main` in 81 ms.
- **Reopen.** Reopening #2 made a new branch from the updated `main`, which now had `003`, so only the index migration ran: 1,952 ms. The comment said "created by this run".
- **A branch that is already gone.** We deleted the reopened branch by hand, the way an expiry or the sweep would, and closed #2 again. The repo's cleanup looked first, found nothing, skipped the delete and passed. The short example cleanup has no lookup, and when we did the same to #4 it failed with `ERROR: Branch preview/pr-4 not found.` That red run is harmless, but it is noise. Its log also listed every other branch name in the project, which you may not want in public logs.
- **Orphans.** We planted `preview/pr-3` (its PR was closed), `preview/pr-99` (no such PR) and `dev/alice` (not a preview name), with #4 still open. The sweep deleted the first two, kept `preview/pr-4` and `dev/alice`, and a dry run with `max_age_days=0` showed it would also delete `preview/pr-4` for its age.

## The limits you hit first

Two limits apply. On the Free plan you hit the branch count first; on our Scale plan we hit the compute limit first.

**Branches per project.** From Neon's [plans page](https://neon.com/docs/introduction/plans) (updated 2026-11-18): the Free plan includes 10 branches per project and "Branch creation fails once you reach 10 branches per project." Launch includes 10 and Scale includes 25, counting the root branch. On those plans extra branches are billed at $1.50 per branch-month, prorated hourly, up to 5,000 per project. So on a paid plan a busy repository does not get an error at the included count; it gets a slightly larger bill.

**Concurrently active computes.** Each preview branch in this workflow has its own compute, and Neon caps how many can run at the same time. Neon's [GitHub Actions guide](https://neon.com/docs/guides/branching-github-actions) (updated 2026-11-18) says computes beyond the limit stay suspended, and connections fail with "You have exceeded the limit of concurrently active endpoints."

We tested both on our Scale plan with `bench/limits.mjs`. It filled the project to 25 branches, the Scale allowance, with `main` plus 24 new branches, each with its own compute. Then it connected to all 24 at once, retrying each one for 60 seconds:

```terminal
{
  "title": "bench/limits.mjs on GitHub Actions",
  "prompt": "$",
  "steps": [
    { "cmd": "TARGET_BRANCHES=25 node bench/limits.mjs", "output": "{\"n\":2,...,\"ok\":true,\"ms\":1262,\"endpointState\":\"init\"}\n...\n{\"n\":21,...,\"ok\":true,\"ms\":1223,\"endpointState\":\"init\"}\n{\"n\":22,...,\"ok\":true,\"ms\":1438,\"endpointState\":\"idle\"}\n...\n{\"n\":25,...,\"ok\":true,\"ms\":599,\"endpointState\":\"idle\"}\nbranches at peak 25, computes answered 20 of 24\nbranches after cleanup 1 (before 1)" }
  ]
}
```

All 25 branches were created. 20 of the 24 new computes answered within the first second. The other 4 kept failing for the full 60 seconds, about 52 attempts each, with:

```text
53000 You have exceeded the limit of concurrently active endpoints. Please suspend some endpoints and try again.
```

The project then had 21 active computes: `main` plus 20 previews. That matches Neon's [compute docs](https://neon.com/docs/manage/endpoints) (updated 2026-11-10): "The default limit is 20 concurrently active computes per project," computes on the default branch and suspended computes do not count, and Scale plan users can request a higher limit from the console. We stopped at 25 branches on purpose, to stay inside the 25 included in Scale.

That did not keep the extra-branch line of the bill at zero. Neon's [usage docs](https://neon.com/docs/introduction/usage-calculations) count extra branches in branch-hours: all child branches per hour, minus the allowance (24 child branches on Scale, 9 on Launch). For 07:00 to 08:00 UTC the consumption API reported 37 branch-hours. That is exactly every child branch that existed in that hour: the 10 timing branches, the 24 limit branches and the 3 previews, although no more than 24 existed at the same time. 13 branch-hours above the allowance come to about 2.6 cents at $1.50 per branch-month. Small, but it means **short-lived branches count per hour, not only at their peak**: a CI that makes more than 24 branches within one hour pays for extra branches even if it deletes each one after a minute.

What this means for the workflow:

- **On a paid plan, 20 active preview computes is the ceiling**, not 25 open pull requests. Any other active compute outside the default branch, such as a read replica on another branch, takes a slot too. A preview whose compute has scaled to zero does not count, so idle previews are fine. On the Free plan the branch count comes first: 10 branches including `main` leaves room for 9 previews.
- **Keep the suspend timeout short** on preview computes, so a branch that finished its tests stops counting soon. `create-branch-action` passes `suspend_timeout: 0` by default, and its README says 0 disables auto-suspend. That is not what we saw: our three preview computes went idle at 07:38:15 to 07:38:16, five minutes after our last connection to them at about 07:33, which is Neon's default. On Scale you can set `suspend_timeout: 60` to free the slot after one minute; Launch suspends after 5 minutes.
- **If you run many PRs at once**, request a higher limit (Scale plan), or run the tests on fewer computes. For example, a schema-only test branch per job that is deleted at the end of the job, and a long-lived preview only for the pull requests that need one.

## A Neon branch, a container, or something else

The Neon rows come from our runs and Neon's docs. The other rows come only from each vendor's current docs, read on 2026-11-22, with the source linked in the row. We did not run Prisma Postgres, Supabase or PlanetScale for this post.

| Option                                                         | Setup                                                                                                                                                                                         | Cost model                                                                                                                                                                                                                                                                         | Data in the preview                                                                                                                                                                                                       | Cleanup                                                              | Limits                                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Postgres container per CI job** (`services: postgres`)       | A `services:` block in the job                                                                                                                                                                | Runner minutes only                                                                                                                                                                                                                                                                | Empty. Schema from migrations, rows from your seed                                                                                                                                                                        | Gone when the job ends                                               | No preview that outlives the job. We measured 8 to 12 s to pull and start `postgres:18`                               |
| **One database per PR on a shared server** (`CREATE DATABASE`) | Your own server, plus create and drop scripts                                                                                                                                                 | The server, running all the time                                                                                                                                                                                                                                                   | Empty, or a copy with `CREATE DATABASE ... TEMPLATE`, which needs [no other sessions connected to the source](https://www.postgresql.org/docs/current/manage-ag-templatedbs.html) during the copy                         | Your `DROP DATABASE` job                                             | Server disk and connections, shared by every PR                                                                       |
| **Neon branch per PR** (this post)                             | Two Neon actions, an API key, a project ID                                                                                                                                                    | Compute per CU-hour ($0.106 Launch, $0.222 Scale). A child branch's storage is billed on the lower of its changes or its logical size, at $0.35/GB-month. 10 (Launch) or 25 (Scale) branches included, then $1.50/branch-month ([plans](https://neon.com/docs/introduction/plans)) | Copy-on-write copy of the parent's schema and data. Schema-only is an option                                                                                                                                              | `delete-branch-action` on close, plus `expires_at` (30 days at most) | 10 branches on Free. 20 concurrently active computes per project by default; we hit it at the 21st                    |
| **Prisma Postgres, database per PR**                           | Prisma CLI in the workflow (`prisma postgres create`, `delete`), service token that expires after 90 days by default ([guide](https://www.prisma.io/docs/guides/integrations/github-actions)) | Operations plus storage. Free $0, Starter $10, Pro $49, Business $129 a month ([pricing](https://www.prisma.io/pricing?view=full))                                                                                                                                                 | Empty. The guide runs migrations and a seed script                                                                                                                                                                        | The guide's `closed` job deletes the database                        | 50 databases on Free, 1,000 on paid plans                                                                             |
| **Supabase preview branches**                                  | GitHub integration. "Branching (preview environments for pull requests) requires the Pro Plan" ([docs](https://supabase.com/docs/guides/deployment))                                          | Branch compute from $0.01344/hour on Micro, not covered by compute credits or the spend cap ([billing](https://supabase.com/docs/guides/platform/manage-your-usage/branching))                                                                                                     | By default "new branches do not start with any data". Schema from your migrations, rows from a seed file. A dashboard option (beta) can include data ([branching](https://supabase.com/docs/guides/deployment/branching)) | Preview branches are deleted when the PR is merged or closed         | Not stated on the branching pages we read                                                                             |
| **PlanetScale Postgres branches**                              | A branch from the Branches page, or from a backup ([branching](https://planetscale.com/docs/postgres/branching))                                                                              | Each branch is billed for its resources; development branches from $5/month, billed only for the time they exist                                                                                                                                                                   | A new branch has no schema or data; a branch made from a backup has both                                                                                                                                                  | Deleting a branch is documented; automation on PR close is not shown | 100 development branches per database by default, configurable up to 5,000. No schema merge between Postgres branches |

PlanetScale is best known for branching with deploy requests, and that is its Vitess product, which is MySQL. Its [Postgres branching docs](https://planetscale.com/docs/postgres/branching) say Postgres branches do not use deploy requests.

How to pick:

- **Keep the container job for fast unit tests.** It needs no secret, works for fork pull requests, and costs nothing extra. With an empty database it cannot catch a migration that fails on real data, as pull request #3 showed.
- **Use a branch per PR when the data matters**: migrations on big tables, constraints that real rows can break, and previews people click through. Of the managed options, a Neon branch is the one whose per-PR flow starts from a copy of the parent's schema and data by default. The Supabase and Prisma Postgres flows start empty and seed.
- **A shared server** is cheap if you already run one, but you own every script, and its `TEMPLATE` copy fails if anyone else is connected to the source when it starts.

If you are choosing between Neon and Supabase for more than previews, the [Neon vs Supabase comparison](/comparisons/neon-vs-supabase) covers the rest of the platform.

## Do not branch real PII into previews

A branch of production is a copy of production. If `main` has real emails, names or payment data, every preview branch has them too, and every person and job that can read the preview can read them. That includes the connection string a reviewer copies into a laptop tool.

So before you give pull requests a branch of production:

- **Branch from a masked branch, not from production.** Create an anonymized branch on a schedule, check it, and set `parent_branch` in the workflow to it instead of `main`. Masking the columns you know about is not enough: our test of [Neon anonymized branches](/posts/neon-anonymized-branches-what-masking-misses) found all 20,000 original emails still readable in copies, JSON payloads and an audit table after the masking run. Scan the branch before you branch from it.
- **Or use a schema-only branch.** `create-branch-action` takes `branch_type: schema-only`, which copies the schema and none of the rows. You lose the data realism that caught pull request #3, but nothing personal leaves production. Note that the rows of your migration history table do not come along either, so a runner like ours would try to run `001_create_users.sql` again and fail. Use a migration tool that can mark existing migrations as applied (a baseline), or copy the history rows into the branch before migrating. Schema-only branches are root branches with their own allowance, including `main`: 3 on Free, 5 on Launch and 25 on Scale, so Free leaves room for only two of them. They also cannot be reset from a parent. See Neon's [schema-only docs](https://neon.com/docs/guides/branching-schema-only).
- **Keep the comment free of secrets.** The workflow above posts the host, not the password. On a public repository even the host is visible to everyone, so you may prefer to post only the branch name.

The demo's `main` is synthetic, so this post could branch it freely.

## What we could not conclude

- **One region, one plan, one runner type.** Every number is from `aws-us-east-2`, our Scale plan and GitHub-hosted `ubuntu-latest` runners. A project far from your runners adds round trips to every step. We did not test the Free plan's hard limit of 10 branches; that sentence comes from Neon's docs.
- **Creates in a row, not at once.** The 10 timed creates ran one after another. The limits test created 24 branches back to back and they took 0.6 to 2.4 seconds each, but we did not time many pull requests opening in the same second.
- **Storage from one billing hour.** The 99 MB is Neon's billing figure for one hour and three branches together, converted from byte-months. It does not split by branch. The index sizes inside Postgres are a separate measurement of similar size, and we did not find out why the billed figure is a little lower.
- **Other vendors from their docs only.** We did not run Prisma Postgres, Supabase branching or PlanetScale. Their rows in the table are what their docs said on 2026-11-22, and docs change.
- **Not a cost model for your team.** Our whole test cost about 13 cents of compute and extra branches, and it used few computes for a few minutes. A team with long-lived previews that people click through all day pays for compute while they are active, and that depends on traffic and the suspend timeout, which we did not model.
- **A synthetic production.** The 2,000 case duplicates were planted on purpose to show what an empty database misses. Your data will have its own surprises, and the point is that the branch finds them, not that it finds these.

## FAQ

### Does every preview branch copy my whole database?

It looks like a full copy: each of our preview branches started with all 1,002,000 rows and the full 309 MB of `main`. On disk it is not a full copy. A branch shares its parent's data and stores only the pages it changes. In our test three previews added about 99 MB together, the size of the indexes their migrations built.

### What happens if the cleanup job fails?

The branch stays until something else deletes it. That is why the workflow sets `expires_at` 14 days out, and why the daily sweep deletes any `preview/pr-<n>` branch whose pull request is not open. In our test the sweep deleted the two orphans we planted and kept the branch of the open pull request.

### How many pull requests can have a preview database at once?

Branches: 10 per project on Free (creation fails after that), and on Launch and Scale 10 or 25 included, then billed per branch up to 5,000. Running computes: 20 per project by default, not counting the default branch. In our test the 21st to 24th preview computes could not start until others suspended.

### Can pull requests from forks use it?

Not with this workflow. GitHub does not pass secrets to `pull_request` runs from forks, and the job skips them. Keep a container job for fork pull requests, and do not use `pull_request_target` to work around it.

### Do I still need a Postgres container in CI?

It is still the best place for fast unit tests, and it is the only option here that works for forks with no secret. The branch adds what our empty container could not show: migrations and constraints that fail on real data, and migration times on real table sizes. A container can do the same only if you load it with representative data yourself.

### Does it work with Prisma, Drizzle or Rails migrations?

Yes. The branch is plain Postgres with a connection string. Replace the "Migrate, seed, test" step with `npx prisma migrate deploy`, `npx drizzle-kit migrate`, `bin/rails db:migrate` or whatever your project uses, and for a non-Node.js project replace the Node.js setup steps too (for Rails, Ruby and Bundler). `create-branch-action` also has a `prisma: true` input that adjusts the connection string for Prisma.

## Summary

- Create a Neon branch of `main` per pull request with `create-branch-action`, run migrations, seed and tests on it, and post the schema diff. Delete it on `closed` with `delete-branch-action`, which covers merged and abandoned pull requests.
- Add two backstops: `expires_at` on every branch, and a daily sweep for `preview/pr-<n>` branches whose pull request is not open.
- In our runs a branch of a 309 MB, million-row database answered its first query 1.3 to 1.8 seconds after the create request, and was gone 1.6 to 2.1 seconds after the delete request.
- The branch caught a unique index that real data breaks. The empty container passed it.
- Three preview branches of a 309 MB database stored about 99 MB together: storage follows what the pull request writes, not the size of the database.
- On a paid plan the limit you hit first is 20 concurrently active computes per project, not the branch count; on Free it is 10 branches. Keep preview computes suspending quickly.
- Never branch real personal data into previews. Branch from a checked [anonymized branch](/posts/neon-anonymized-branches-what-masking-misses) or use a schema-only branch.

If your previews also need the backend and files, not only the database, see [preview environments that include the backend](/posts/neon-functions-preview-environments-backend) and [storage that rides the same branch](/posts/neon-stop-a-bucket-per-preview-environment). To practise the whole pull request to teardown flow, try the [Preview Environment Simulator](/games/preview-environment-simulator).
