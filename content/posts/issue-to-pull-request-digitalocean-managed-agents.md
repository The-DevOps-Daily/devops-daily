---
title: 'Issue to Pull Request with DigitalOcean Managed Agents'
excerpt: 'We gave an OpenCode agent on DigitalOcean Managed Agents three real GitHub issues and no GitHub token. It produced three merged pull requests and one wrong one that passed its tests. Here is the setup, the recorded runs, the cost per issue, and every gotcha we hit.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-28'
publishedAt: '2026-09-28T09:00:00Z'
updatedAt: '2026-10-12T09:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - DigitalOcean
  - AI Agents
  - GitHub
  - Sandboxes
  - Security
---

We gave an agent three real GitHub issues and a microVM of its own, and kept every credential that could change the repository outside that microVM. The agent ran as OpenCode inside [DigitalOcean Managed Agents](https://docs.digitalocean.com/products/managed-agents/), on DeepSeek V4 Pro served by DigitalOcean's own serverless inference, so the only secret it ever held was a DigitalOcean model key.

Across five recorded attempts, it produced three merged pull requests for $0.32 in usage charges on the September invoice, about 11 cents per merged pull request. It also produced one that passed the test suite and was still wrong, which is the most useful part of this post. Below is the whole setup, the recorded runs, the check we added after the wrong one, what the permission rules did and did not stop, and the gotchas that cost us time.

```github
The-DevOps-Daily/do-agent-issue-to-pr
```

## TLDR

- **One script turns an issue into a pull request.** It creates a Harness Runtime session, clones the repository into the microVM, prompts the agent once with no human attached, reads the diff back out, runs the tests again, and opens the pull request with credentials the agent never sees.
- **The model runs on DigitalOcean.** `HARNESS_INFERENCE_MODEL: deepseek-v4-pro` plus a model access key; no Anthropic or OpenAI account involved.
- **Three issues, three merged fixes, about $0.02 to $0.03 of model tokens each** at DigitalOcean's list price.
- **One pull request passed its tests and was wrong.** The agent added tests where `unittest` never runs them. The script now refuses a change that touches `tests/` without raising the number of tests that run.
- **Tool rules are not the boundary.** OpenCode's edit and write tools were refused by our policy, so the agent wrote files with `bash` instead. The sandbox, the missing credentials and the egress allowlist are what actually held.

## Prerequisites

- A DigitalOcean account with Managed Agents (public preview since 21 September 2026) and an API token that can use it.
- A DigitalOcean model access key for serverless inference.
- `doctl` 1.175.0 or later and the GitHub CLI.
- A repository with tests the agent can run. Ours is a deliberately small Python module so the runs are easy to read.

## The shape of it

The target is a small duration parser, `parse_duration("1h30m")`, with three open issues: combined durations return the wrong number, days are not supported, and unknown units are silently ignored. All three are real bugs in the code as first committed, and the existing tests pass on all of them.

The design rule was simple: whatever the agent can touch, it cannot publish. It edits files in a microVM. Everything that talks to GitHub with write access happens outside, in a script we control.

```diagram
{
  "type": "flow",
  "title": "One issue, one session, one pull request",
  "nodes": [
    { "label": "GitHub issue", "sub": "labelled agent", "icon": "branch", "tone": "slate" },
    { "label": "issue-to-pr.sh", "sub": "holds the GitHub token", "icon": "gear", "tone": "amber" },
    { "label": "Harness Runtime", "sub": "OpenCode in a microVM", "icon": "box", "tone": "blue" },
    { "label": "DO inference", "sub": "DeepSeek V4 Pro", "icon": "cpu", "tone": "violet" },
    { "label": "Pull request", "sub": "a person reviews", "icon": "check", "tone": "green" }
  ]
}
```

## The agent spec

A session is described in YAML. This is the file every run uses:

```yaml
name: issue-to-pr
agent: opencode
size: mars-2vcpu-4gb
idle_timeout: 10m
env:
  HARNESS_INFERENCE_MODEL: deepseek-v4-pro
secrets:
  HARNESS_INFERENCE_API_KEY: ${DO_INFERENCE_KEY}
# Naming a host turns egress into a deny-by-default allowlist. The platform
# adds GitHub (for the clone) and the model endpoint on its own.
egress:
  - api.github.com
permissions:
  default: deny
  filesystem:
    mode: workspace-write
  rules:
    - tool: file.read
      action: allow
    - tool: file.write
      match: { path: '/workspace/**' }
      action: allow
    - tool: bash
      action: allow
    # Last matching rule wins, so these override the allow above.
    - tool: bash
      match: { command: 'git push*' }
      action: deny
    - tool: bash
      match: { command: 'curl *' }
      action: deny
```

What each part is for:

- **`agent: opencode`** picks the OpenCode adapter. Managed Agents also has built-in adapters for Claude Code, Codex CLI, Hermes and LangGraph.
- **`HARNESS_INFERENCE_MODEL` and `HARNESS_INFERENCE_API_KEY`** route the model through DigitalOcean serverless inference. The key goes under `secrets`, which are stored separately and never returned by the API. `${DO_INFERENCE_KEY}` is filled in from your shell when you create the session.
- **`egress`** is open by default. Naming a single host switches the session to an allowlist, and the platform adds the hosts the adapter needs.
- **`permissions`** start from `deny`. For native actions the last matching rule wins, which is why the two `bash` denies come after the broad `bash` allow.

You can check a policy before paying for a session. The validate endpoint returns a verdict per rule, and all five of ours came back `exact` ([response](https://github.com/The-DevOps-Daily/do-agent-issue-to-pr/blob/main/runs/checks/policy-validate.json)):

```bash
curl -X POST https://api.digitalocean.com/v2/agents/sessions/policy/validate \
  -H "Authorization: Bearer $DIGITALOCEAN_ACCESS_TOKEN" \
  -H "Content-Type: application/x-yaml" \
  --data-binary @agent.yaml
```

It rejects a spec that still has a `${VAR}` placeholder in it, so validate a copy with the secret filled in or replaced by a dummy value.

## The script, step by step

[`scripts/issue-to-pr.sh`](https://github.com/The-DevOps-Daily/do-agent-issue-to-pr/blob/main/scripts/issue-to-pr.sh) is about 120 lines of bash. The parts that matter:

**1. A fresh microVM per issue.**

```bash
doctl harness-runtime create --spec "$root/agent.yaml" --name "$session" \
  --wait-timeout 300 >/dev/null
```

**2. Clone from outside the agent loop.** The session has no GitHub credentials, so it could not clone a private repository by itself. `exec` runs a command in the sandbox directly, as root, so the checkout is handed to the `agent` user the model runs as:

```bash
doctl harness-runtime exec "$session" -- sh -c \
  "git clone -q https://github.com/$repo $workdir && chown -R agent:agent $workdir"
```

**3. One headless run.** `prompt` sends a single prompt, waits for the run to finish, and exits 0, 1 or 124 on timeout. `--on-hitl reject` refuses anything the policy would otherwise stop to ask a person about, because nobody is there to answer:

```bash
doctl harness-runtime prompt "$session" --on-hitl reject --timeout 1200 \
  -o json - <<<"$prompt" >"$out/answer.json" 2>"$out/progress.log"
```

The prompt includes the issue title and body and four rules: change only what the issue needs, add tests under `tests/`, run the test suite, and do not commit or push. With `-o json` the answer comes back with the run status and token counts.

**4. Check the work instead of trusting the summary.** The script reads the diff out of the sandbox and runs the tests there itself. It also counts the tests before and after, for a reason the next sections explain:

```bash
doctl harness-runtime exec "$session" -- sh -c \
  "git -c safe.directory=$workdir -C $workdir add -A && git -c safe.directory=$workdir -C $workdir diff --cached" \
  >"$out/change.patch"
```

**5. Open the pull request with our credentials.** The patch is applied to a fresh clone on the machine running the script, pushed to a branch named after the session, and opened with `gh pr create`. The agent's closing summary becomes the pull request body.

**6. Remove the session.** An `EXIT` trap saves the session's event log and removes the session, so a failed run does not leave a sandbox behind. It ignores errors from both commands, so check `doctl harness-runtime list` now and then.

## A real run

This is issue #3, "Reject durations with unknown units", exactly as the terminal printed it:

```terminal
{
  "title": "issue-to-pr.sh",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "scripts/issue-to-pr.sh 3",
      "output": "12:58:31 issue #3: Reject durations with unknown units\n12:58:31 creating session issue-3-1790600274\n12:58:51 tests before: 8\n12:58:51 running the agent\n12:59:36 tests pass in the sandbox: 8 before, 10 after\nremote: \nremote: Create a pull request for 'agent/issue-3-1790600274' on GitHub by visiting:        \nremote:      https://github.com/The-DevOps-Daily/do-agent-issue-to-pr/pull/new/agent/issue-3-1790600274        \nremote: \n12:59:43 opened https://github.com/The-DevOps-Daily/do-agent-issue-to-pr/pull/7\nhttps://github.com/The-DevOps-Daily/do-agent-issue-to-pr/issues/3#issuecomment-5870355576\n12:59:49 removing session issue-3-1790600274"
    }
  ]
}
```

The change it produced, [pull request #7](https://github.com/The-DevOps-Daily/do-agent-issue-to-pr/pull/7), checks the whole string before parsing it:

```diff
 _UNITS = {"s": 1, "m": 60, "h": 3600, "d": 86400}
 _PART = re.compile(r"(\d+)([smhd])")
+_VALID = re.compile(r"(\d+[smhd])+")

 def parse_duration(text: str) -> int:
     text = text.strip().lower()
     if not text:
         raise ValueError("empty duration")
+    if not _VALID.fullmatch(text):
+        raise ValueError(f"not a duration: {text!r}")
```

It also added two tests, one for `"1h30x"` and one for `"abc"`. A reviewer would point out that the old "no parts" check below it is now unreachable, which is the kind of note that belongs in a review, not a reason to reject the fix. We merged it. Issue #1 went the same way: a one-character fix (`total =` to `total +=`) and two tests, merged as [#4](https://github.com/The-DevOps-Daily/do-agent-issue-to-pr/pull/4).

## The pull request that passed and was wrong

Issue #2 asked for days, `"7d"` and `"1d12h"`. The first run changed the code correctly and reported that all tests passed, and our script, which at that point only checked that the suite passed, opened [pull request #5](https://github.com/The-DevOps-Daily/do-agent-issue-to-pr/pull/5).

The tests it added looked like this at the bottom of the file:

```python
if __name__ == "__main__":
    unittest.main()

    def test_days(self):
        self.assertEqual(parse_duration("7d"), 604800)
```

They are inside the `if __name__` block, not inside the test class, so `unittest` never collects them. The agent's own summary said "All 8 tests pass (6 pre-existing + 2 new ones)". The test run our script did afterwards in the same sandbox printed `Ran 6 tests`.

A person reading the diff caught it. The script could not, because "the tests pass" was the only thing it checked. So it now counts how many tests run before and after the agent's change, and refuses to open a pull request if the agent touched `tests/` but the count did not go up. It is a coarse check, since it cannot tell which new test ran, but it catches this failure:

```bash
count_tests() {
  doctl harness-runtime exec "$session" -- sh -c \
    "cd $workdir && python3 -m unittest -q 2>&1" | sed -n 's/^Ran \([0-9]*\) tests\{0,1\}.*/\1/p'
}
```

The second run of issue #2 added four tests that ran (6 before, 10 after), but failed to push because pull request #5's branch still existed; each run now pushes to its own branch. The third run added two tests that ran and became [#6](https://github.com/The-DevOps-Daily/do-agent-issue-to-pr/pull/6), which we merged.

The lesson is not specific to this platform. An agent's report of its own work is a claim. Check the claim with something the agent did not write, and keep a person on the merge button.

## What the policy stopped, and what it did not

**The network allowlist held.** With `egress` limited to `api.github.com`, we ran these inside a session with `doctl harness-runtime exec` ([recorded here](https://github.com/The-DevOps-Daily/do-agent-issue-to-pr/blob/main/runs/checks/egress.txt)):

```terminal
{
  "title": "inside the session",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "python3 -c \"import urllib.request as u; print(u.urlopen('https://example.com', timeout=8).status)\"",
      "output": "urllib.error.URLError: <urlopen error Tunnel connection failed: 404 Not Found>"
    },
    {
      "cmd": "python3 -c \"import urllib.request as u; print(u.urlopen('https://pypi.org/simple/', timeout=8).status)\"",
      "output": "urllib.error.URLError: <urlopen error Tunnel connection failed: 404 Not Found>"
    },
    {
      "cmd": "python3 -c \"import urllib.request as u; print(u.urlopen('https://github.com', timeout=8).status)\"",
      "output": "200"
    }
  ]
}
```

GitHub and the model endpoint still work, because the platform adds those hosts itself. An agent talked into leaking something by a malicious issue cannot reach an arbitrary server, though it can still reach the hosts on the list.

**The tool rules did not do what we expected.** The session log for issue #3 shows OpenCode's own editing tools being refused:

```terminal
{
  "title": "doctl harness-runtime logs issue-3-1790600274",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "output": "▸ edit\n[2026-09-28T12:58:59Z] run.tool_call_completed\n  ✗ The user has specified a rule which prevents you from using this specific tool … (22ms)"
    }
  ]
}
```

The `file.write` rule for `/workspace/**` did not cover OpenCode's `edit` and `write` tools in these runs, so `default: deny` refused them. The agent did not stop. It changed the files through `bash` instead, with `sed -i` and `cat >` heredocs, which we had allowed. Every merged fix in this post was written that way.

DigitalOcean's docs warn about exactly this: "Rules match literally ... A denied action doesn't block the goal behind it." If `bash` is allowed, the agent can do anything `bash` can do inside the sandbox, whatever the other rules say. Treat tool rules as a way to shape the agent's behaviour, and treat the microVM, the missing credentials and the egress allowlist as the security boundary.

## What it cost

:::note
**Update, 12 October 2026:** the September invoice has arrived, and the figures in this table were too low. They count only the input and output tokens that the agent reported. The invoice also bills cache-read tokens, 57,000 to 105,000 per run at $0.348 per million, and every token line on the invoice was rounded to the cent, with a one-cent minimum. The five runs were billed $0.05 to $0.08 each, $0.32 in total, which is about 11 cents per merged pull request. Compute came to $0.00. The full breakdown is in [DigitalOcean Agent Droplets: when the $50 plan pays off](/posts/digitalocean-agent-droplets-when-the-plan-pays-off).
:::

Token counts come from the `prompt` command's JSON output; the price is DigitalOcean's list price for DeepSeek V4 Pro, $1.74 per million input tokens and $3.48 per million output tokens.

| Run              | Outcome                      | Input / output tokens | Model cost |
| ---------------- | ---------------------------- | --------------------- | ---------- |
| Issue #1         | Merged (#4)                  | 8,481 / 1,024         | $0.018     |
| Issue #2, first  | Closed in review (#5)        | 14,372 / 1,848        | $0.031     |
| Issue #2, second | Refused to push (old branch) | 14,676 / 2,268        | $0.033     |
| Issue #2, third  | Merged (#6)                  | 9,868 / 1,605         | $0.023     |
| Issue #3         | Merged (#7)                  | 8,750 / 2,109         | $0.023     |

Two smaller costs sit on top. Each new session starts with a short readiness run, which used between 235 and 4,587 input tokens in ours. And the sandbox is billed while it exists: a Medium session lists at about $0.060 an hour under the current billing rule (25% of the allocated vCPUs plus peak memory), and by the script's timestamps each of ours existed for under two minutes, so compute came to a fraction of a cent per issue. These figures are derived from token counts and list prices; the new usage had not reached the invoice when we wrote this.

## Gotchas we hit

- **`doctl` wants an Anthropic key for Claude Code, even on DigitalOcean inference.** `doctl harness-runtime create` refused a `claude-code` spec that used `HARNESS_INFERENCE_*`, asking for `ANTHROPIC_API_KEY`. In doctl's source, `prepareClaudeCodeStart` resolves that key for every `claude-code` session and checks it against Anthropic. Posting the same YAML to `POST /v2/agents/sessions` with `Content-Type: application/x-yaml` created the session ([both recorded](https://github.com/The-DevOps-Daily/do-agent-issue-to-pr/tree/main/runs/checks)). OpenCode has no such check.
- **Model access depends on your inference tier.** Our key got "403 this model is not available for your subscription tier" for the Anthropic and OpenAI models we tried, both in a direct chat completion and inside a Claude Code session. Open models such as DeepSeek V4 Pro worked. Test the model you want with a plain chat completion before building on it.
- **`--gh-repo` did not clone anything for us.** Without a GitHub connection set up through `doctl harness-runtime auth`, the workspace stayed empty. Cloning with `exec` is explicit and works for public repositories.
- **`exec` runs as root.** Files it creates belong to root, and the agent could not edit them until we added `chown`. Git run as root then refuses the agent-owned checkout as "dubious ownership" unless you pass `-c safe.directory`.
- **A closed pull request leaves its branch.** Name branches after the session, not the issue, or the next attempt cannot push.

## Wiring it to GitHub Actions

The repository includes a workflow that runs the same script when an issue gets the `agent` label:

```yaml
on:
  issues:
    types: [labeled]

jobs:
  agent:
    if: github.event.label.name == 'agent'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}
      - run: scripts/issue-to-pr.sh "${{ github.event.issue.number }}"
        env:
          GH_TOKEN: ${{ github.token }}
          DIGITALOCEAN_ACCESS_TOKEN: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}
          DO_INFERENCE_KEY: ${{ secrets.DO_INFERENCE_KEY }}
```

Two things to know before you turn it on. First, the DigitalOcean token in that secret should be able to do as little as possible, ideally in a separate DigitalOcean team: a token that can manage your whole account is a large thing to hand to a workflow. Second, pull requests opened with the workflow's own `GITHUB_TOKEN` do not trigger other workflows, so your normal test workflow will not run on them unless you open them with a GitHub App or a separate token. The script's own test run inside the sandbox covers the gap, but it is not a substitute for CI.

The runs in this post were made with the script from a terminal, not through Actions.

## What we could not conclude

- **Whether this scales past a toy repository.** The target is a few dozen lines with a fast test suite. A real codebase means longer runs, more tokens, and tests the agent may not be able to run inside the sandbox without more egress.
- **Why the `file.write` rule did not cover OpenCode's edit tools.** We saw the refusals, not the mapping behind them.
- **How other models compare.** Our inference tier only allowed open models, so we did not run the same issues through Claude or GPT.
- **Anything about speed.** This is a how-to, not a benchmark, and Managed Agents is a public preview.

## Summary

The pattern is small and reusable: a disposable microVM per task, a model key as the only secret inside, an egress allowlist, a script outside the sandbox that checks the agent's work with something the agent did not write, and a person on the merge button. On DigitalOcean Managed Agents the whole loop is a `create`, a few `exec` calls, one `prompt` and a `remove`, and the model can run on DigitalOcean too.

The agent did good work on three small issues for a few cents each. It also produced a confident pull request whose new tests never ran, and it worked around refused editing tools through `bash` without being asked to. Both are reasons to build the checks first and the automation second.
