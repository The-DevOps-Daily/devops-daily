---
title: 'Debugging and Speeding Up Workflows'
description: 'Find out why a GitHub Actions run failed with gh run view, annotations and debug logs, write job summaries, and make runs faster and cheaper.'
order: 8
---

Sooner or later a run fails and the reason is not obvious, or the pipeline that took two minutes now takes twenty. This part walks through a real failure in the companion repository, from the red check on the pull request to the line that caused it, then shows the tools for harder cases: debug logging, annotations and job summaries. The second half is about making runs faster and cheaper.

## Prerequisites

- The repository from [Part 7](/guides/introduction-to-cicd/07-advanced-workflows-and-automation), with CI running on pull requests.

## A Pull Request That Fails

The change adds the number of commands to the footer of the page. It has two problems that are easy to miss in a review: a variable that is never used, and a test that still expects the old footer.

```bash
git show dc22f5a --format= -- src/render.js
```

```diff
diff --git a/src/render.js b/src/render.js
index 9fa02cf..c5acb0d 100644
--- a/src/render.js
+++ b/src/render.js
@@ -35,6 +35,8 @@ ${list.map((c) => `<dt><code>${escapeHtml(c.cmd)}</code></dt><dd>${escapeHtml(c.
     )
     .join('\n');

+  const count = commands.length;
+
   return `<!doctype html>
 <html lang="en">
 <head>
@@ -45,7 +47,7 @@ ${list.map((c) => `<dt><code>${escapeHtml(c.cmd)}</code></dt><dd>${escapeHtml(c.
 <body>
 <h1>${escapeHtml(title)}</h1>
 ${sections}
-<footer>Version ${escapeHtml(version)}, commit ${escapeHtml(commit.slice(0, 7))}</footer>
+<footer>${commands.length} commands, version ${escapeHtml(version)}, commit ${escapeHtml(commit.slice(0, 7))}</footer>
 </body>
 </html>
 `;
```

Opening the pull request ran CI, and the checks show the damage:

```terminal
{
  "title": "the checks",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh pr checks 2",
      "output": "Some checks were not successful\n0 cancelled, 12 failing, 0 successful, 1 skipped, and 0 pending checks\n\n   NAME                                        DESCRIPTION  ELAPSED  URL\nX  CI/all-checks (pull_request)                             2s       https://github.com/The-DevOps-Daily/gu...\nX  CI/lint (pull_request)                                   9s       https://github.com/The-DevOps-Daily/gu...\nX  CI/test (macos-latest, 22) (pull_request)                12s      https://github.com/The-DevOps-Daily/gu...\nX  CI/test (macos-latest, 24) (pull_request)                12s      https://github.com/The-DevOps-Daily/gu...\nX  CI/test (macos-latest, 26) (pull_request)                15s      https://github.com/The-DevOps-Daily/gu...\nX  CI/test (ubuntu-24.04-arm, 24) (pull_re...               13s      https://github.com/The-DevOps-Daily/gu...\nX  CI/test (ubuntu-latest, 22) (pull_request)               10s      https://github.com/The-DevOps-Daily/gu...\nX  CI/test (ubuntu-latest, 24) (pull_request)               12s      https://github.com/The-DevOps-Daily/gu...\nX  CI/test (ubuntu-latest, 26) (pull_request)               11s      https://github.com/The-DevOps-Daily/gu...\nX  CI/test (windows-latest, 22) (pull_requ...               20s      https://github.com/The-DevOps-Daily/gu...\nX  CI/test (windows-latest, 24) (pull_requ...               32s      https://github.com/The-DevOps-Daily/gu...\nX  CI/test (windows-latest, 26) (pull_requ...               34s      https://github.com/The-DevOps-Daily/gu...\n-  CI/build (pull_request)                                           https://github.com/The-DevOps-Daily/gu..."
    }
  ]
}
```

Twelve checks failed, and `build` was skipped. Start with the annotations: they are the short version of every error, and they appear on the pull request's **Files changed** tab next to the line:

```terminal
{
  "title": "annotations",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view 40065283263 --attempt 1 | grep -A 1 'never used'",
      "output": "X 'count' is assigned a value but never used\nlint: src/render.js#38"
    }
  ]
}
```

That annotation comes from ESLint's output. `actions/setup-node` registers **problem matchers**, regular expressions that turn compiler and linter output into annotations with a file and line. The failed step's log has the full message:

```terminal
{
  "title": "failed steps",
  "prompt": "$",
  "steps": [
    {
      "comment": "the lint job",
      "cmd": "gh run view 40065283263 --attempt 1 --log-failed | grep '^lint' | cut -f3- | grep -E 'render.js|error  |problem'",
      "output": "2026-10-24T05:11:39.6713053Z /home/runner/work/guide-cicd-demo-2026-10-24/guide-cicd-demo-2026-10-24/src/render.js\n2026-10-24T05:11:39.6734433Z ##[error]  38:9  error  'count' is assigned a value but never used  no-unused-vars\n2026-10-24T05:11:39.6740531Z ✖ 1 problem (1 error, 0 warnings)"
    },
    {
      "comment": "one of the test jobs",
      "cmd": "gh run view 40065283263 --attempt 1 --log-failed | grep '^test (ubuntu-latest, 24)' | cut -f3- | grep -E '✖|AssertionError'",
      "output": "2026-10-24T05:11:42.2467538Z ✖ renderPage shows the title, version and short commit (1.20432ms)\n2026-10-24T05:11:42.2605232Z ✖ failing tests:\n2026-10-24T05:11:42.2606988Z ✖ renderPage shows the title, version and short commit (1.20432ms)\n2026-10-24T05:11:42.2608494Z   AssertionError [ERR_ASSERTION]: The input did not match the regular expression /Version 1\\.0\\.0, commit 0123456/. Input:"
    }
  ]
}
```

`--log-failed` prints only the steps that failed, which is usually all you need. `--attempt 1` picks the first attempt of the run; without it, `gh` shows the latest attempt.

And the required check did its job. `all-checks` failed instead of being skipped, so the ruleset from Part 7 blocks the merge:

```terminal
{
  "title": "the required check",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view 40065283263 --attempt 1 | grep -E -A 4 '^X all-checks'",
      "output": "X all-checks in 2s (ID 120787239448)\n  ✓ Set up job\n  X Fail if a needed job failed or was cancelled\n  - Run echo \"All CI jobs passed\"\n  ✓ Complete job"
    },
    {
      "cmd": "gh run view 40065283263 --attempt 1 | grep '^- build'",
      "output": "- build (ID 120787240928)"
    }
  ]
}
```

## Debug Logging

When the normal log is not enough, for example when a condition skips a step and you do not see why, re-run with **debug logging**. The runner then prints how it evaluated every expression and condition:

```terminal
{
  "title": "re-run with debug logs",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run rerun 40065283263 --failed --debug",
      "output": "✓ Requested rerun (failed jobs) of run 40065283263 with debug logging enabled"
    },
    {
      "comment": "why the report was uploaded although the tests failed",
      "cmd": "gh run view 40065283263 --attempt 2 --log | grep '^test (ubuntu-latest, 24)' | cut -f3- | grep -A 6 \"condition for step: 'Upload the test report'\"",
      "output": "2026-10-24T05:13:02.3483808Z ##[debug]Evaluating condition for step: 'Upload the test report'\n2026-10-24T05:13:02.3487620Z ##[debug]Evaluating: !cancelled()\n2026-10-24T05:13:02.3488106Z ##[debug]Evaluating Not:\n2026-10-24T05:13:02.3489362Z ##[debug]..Evaluating cancelled:\n2026-10-24T05:13:02.3490903Z ##[debug]..=> false\n2026-10-24T05:13:02.3491256Z ##[debug]=> true\n2026-10-24T05:13:02.3492504Z ##[debug]Expanded: !false"
    }
  ]
}
```

The debug log of that one job has 477 `##[debug]` lines, so search it rather than read it. To turn debug logging on for every run instead of one re-run, create a repository variable (or secret) `ACTIONS_STEP_DEBUG` with the value `true`. `ACTIONS_RUNNER_DEBUG=true` adds the runner's own diagnostic logs. Turn both off again when you are done; debug logs are long, and in a public repository everyone can read them.

`--failed` re-runs only the failed jobs and the jobs that depend on them. A run can be re-run for up to 30 days and at most 50 times.

## Annotations and Log Groups You Write Yourself

Any step can create annotations and structure its log by printing **workflow commands**:

```bash
echo "::error file=src/render.js,line=38::The footer is missing the version"
echo "::warning file=src/commands.json::The topic 'gh' has more than 10 commands"
echo "::notice::Built 13 commands"

echo "::group::Installed packages"
npm ls --depth=0
echo "::endgroup::"
```

`::error` and `::warning` show up in the run summary and, with `file` and `line`, on the pull request diff. `::group::` folds a part of the log. An `::error` line does not fail the step by itself; exit with a non-zero status for that.

## Job Summaries

Every step can append Markdown to the file in `$GITHUB_STEP_SUMMARY`, and GitHub shows it on the run's summary page. The build job in `ci.yml` now writes a table of the built files (and `tee` also prints it to the log):

```yaml
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
```

```terminal
{
  "title": "the summary in the log",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view --job 120788135809 --log | grep 'Write a job summary' | cut -f3- | tail -n 6",
      "output": "2026-10-24T05:16:53.2059540Z ### Site build\n2026-10-24T05:16:53.2059856Z\n2026-10-24T05:16:53.2060032Z | File | Bytes |\n2026-10-24T05:16:53.2060304Z | --- | ---: |\n2026-10-24T05:16:53.2071343Z | `index.html` | 1647 |\n2026-10-24T05:16:53.2087546Z | `version.json` | 81 |"
    }
  ]
}
```

Use summaries for what a reviewer wants at a glance: test counts, coverage, bundle sizes, the URL of a preview deployment. Each step can write up to 1 MiB. Like logs, summaries mask known secret values; anything else you write stays there until you delete the run.

## Fix It, and Let Concurrency Cancel the Old Run

The fix removes the unused variable and updates the test. It was pushed in two commits, 15 seconds apart. Because `ci.yml` has `cancel-in-progress: true` for pull requests, the second push canceled the run of the first:

```terminal
{
  "title": "superseded runs",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run list --branch footer-count",
      "output": "STATUS  TITLE                     WORKFLOW  BRANCH        EVENT         ID           ELAPSED  AGE\n✓       Show the number of co...  CI        footer-count  pull_request  40065537928  1m38s    about 1 minut...\nX       Show the number of co...  CI        footer-count  pull_request  40065517393  42s      about 2 minut...\nX       Show the number of co...  CI        footer-count  pull_request  40065283263  54s      about 4 minut..."
    },
    {
      "cmd": "gh run view 40065517393 | grep -m 1 -A 1 Canceling",
      "output": "X Canceling since a higher priority waiting request for ci-CI-refs/pull/2/merge exists\ntest (windows-latest, 26): .github#1"
    }
  ]
}
```

The list shows the canceled run with an `X` like a failure; `gh run view` or the annotation tells you it was canceled. With green checks, `gh pr merge 2` sent the pull request through the merge queue, and the deploy workflow published the new footer.

## gh Tips for Runs

- `gh run watch <id> --exit-status` follows a run and exits non-zero if it fails, handy after a push.
- `gh run list --status failure --limit 10` lists recent failures; `--workflow`, `--branch` and `--event` narrow it down.
- `gh run view <id> --log-failed` is the fastest way to the error; `--job <id>` and `--attempt <n>` pick one job or attempt.
- `gh run download <id>` fetches the artifacts, such as the JUnit reports from Part 4.
- For jobs from a reusable workflow, `gh run view --log` cannot name the steps and prints `UNKNOWN STEP` in the step column, so filter those logs by the job column or by text:

```terminal
{
  "title": "logs of a called workflow's job",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view --job 120786814554 --log | cut -f2 | sort | uniq -c",
      "output": "    265 UNKNOWN STEP"
    }
  ]
}
```

## Make Runs Faster and Cheaper

Most slow pipelines have the same few causes. In order of how much they usually save:

1. **Do not run what is not needed.** Cancel superseded runs with `concurrency` (above), skip workflows with `paths` filters when only documentation changed, and run expensive suites, such as end-to-end tests, only on the merge queue or on `main`.
2. **Cache downloads.** The setup actions' built-in caches cover most package managers; `actions/cache` the rest (Part 4).
3. **Run in parallel.** Split independent work into jobs, shard long test suites over a matrix (`--shard=1/4` in many test runners), and use parallel steps for small independent commands (Part 7).
4. **Pick the right runner.** In Part 7, the same job took 30 seconds on Windows and 10 to 11 seconds on Linux and macOS. Run the full matrix where it matters and Linux elsewhere. For tiny jobs such as `all-checks`, the companion repository uses `ubuntu-slim`, a 1 vCPU runner that is a container rather than a VM, with a 15-minute job limit ([generally available since January 2026](https://github.blog/changelog/2026-01-22-1-vcpu-linux-runner-now-generally-available-in-github-actions/)):

```terminal
{
  "title": "ubuntu-slim",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view --job 120788176847 --log | grep 'Set up job' | cut -f3- | grep -A 4 'VM Image'",
      "output": "2026-10-24T05:17:00.3161637Z ##[group]VM Image\n2026-10-24T05:17:00.3163048Z - OS: Linux (x64)\n2026-10-24T05:17:00.3163733Z - Source: Docker\n2026-10-24T05:17:00.3164287Z - Name: ubuntu:24.04\n2026-10-24T05:17:00.3164902Z - Version: 20261021.31.1"
    }
  ]
}
```

5. **Set `timeout-minutes` on every job.** The default is 360 minutes (6 hours), lower only where the runner has its own limit, such as 15 minutes on `ubuntu-slim`. In a private repository, one hung job can cost 360 billed minutes.
6. **Fetch less.** `actions/checkout` fetches one commit by default (`fetch-depth: 1`); only ask for `fetch-depth: 0` when a tool needs the history.
7. **Look for slow steps.** The step timings in the run page, or `gh api repos/{owner}/{repo}/actions/jobs/<id> --jq '.steps[]'`, show where the time goes. In Part 7, they showed that Windows spent its extra time in checkout and `npm ci`, not in the tests.

When the hosted runners are not enough, larger runners (more cores, GPUs, static IP addresses) are billed even in public repositories, and self-hosted runners run on your own machines. Self-hosted runners must stay up to date: since 29 September 2026, runners older than v2.329.0 cannot register, and runners below a newer minimum version stop getting jobs.

## Common Mistakes

- **Reading the whole log.** Start with the annotations and `--log-failed`.
- **Debug logging left on.** It slows reading and exposes more detail than you need, in public repositories to everyone.
- **`continue-on-error` to get a run green.** It hides the failure; fix it or make the step conditional.
- **No `timeout-minutes`.** One stuck job can cost up to 6 hours of runner time.
- **Optimizing before measuring.** Check the step timings first; in the companion repository, the tests were the fastest part of every job.

## Summary

- Annotations, `gh run view --log-failed` and the job summary lead you to most failures quickly.
- `gh run rerun --failed --debug` shows how every condition was evaluated; `ACTIONS_STEP_DEBUG` turns debug logs on for all runs.
- Workflow commands (`::error`, `::warning`, `::group::`) and `$GITHUB_STEP_SUMMARY` make your own steps easier to read.
- Speed comes from skipping unneeded work, caching, parallel jobs and steps, the right runner, and timeouts.

In [Part 9](/guides/introduction-to-cicd/09-security-best-practices-and-production-patterns) you secure the pipeline: token permissions, untrusted input, unsafe triggers, and actions pinned to commit SHAs.

## Keep Learning

- [Why Your CI/CD Pipeline Is Slower Than It Should Be (and How to Fix It)](/posts/why-your-ci-pipeline-is-slower)
- [GitHub Actions Removed Node 20. Find Every node20 Action You Still Run](/posts/github-actions-node20-removed)
- [GitHub Started Enforcing Self-Hosted Runner Versions. We Tested What Happens](/posts/github-self-hosted-runner-version-window)
