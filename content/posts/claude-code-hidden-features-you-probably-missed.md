---
title: 'Claude Code Hidden Features You Probably Missed'
excerpt: 'From mobile sessions to automated PR reviews, here are the Claude Code features that most engineers overlook but can seriously level up your workflow.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-03-30'
publishedAt: '2026-03-30T09:00:00Z'
updatedAt: '2026-03-30T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'Bobby Iliev'
  slug: 'bobby-iliev'
featured: true
tags:
  - devops
  - claude-code
  - ai
  - developer-tools
  - automation
  - productivity
---

Most people use Claude Code to write code, fix bugs, and maybe generate a commit message. That's fine, but you're leaving a lot on the table.

Boris Cherny, the creator of Claude Code, recently shared a [thread on X](https://x.com/bcherny/status/2038454336355999749) about features that even daily users tend to overlook. Some of these genuinely changed how I work. Here's a rundown of the ones worth knowing about.

## TLDR

Claude Code has mobile sessions, automated scheduling, voice input, parallel agents, git worktrees, hooks, and a browser extension. Most people use about 20% of what it can do.

## Move Your Session Anywhere with /teleport

You can start a session on your laptop and pick it up on your phone. Or move it to the web. The `/teleport` command transfers your full session context between devices.

The reverse also works. If you're reviewing something on your phone during a commute, you can `/teleport` it back to your terminal when you sit down.

There's also `/remote-control` which lets you connect to a running session from another device without transferring it.

```bash
# On your laptop
/teleport

# On your phone or web - enter the code to pick up the session
```

This is useful when you kick off a long-running task on your workstation and want to check progress from your phone.

## Automate Repetitive Tasks with /loop and /schedule

This one is a genuine workflow changer. You can tell Claude Code to run a task on a recurring schedule for up to a week.

```bash
# Review PRs every 30 minutes
/loop 30m review open PRs and post comments

# Run a health check every hour
/schedule every 1h check if the staging environment is healthy
```

Think about what you do repeatedly: reviewing PRs, checking CI status, monitoring deployments, updating dependencies. You can automate all of it without writing a single script.

Some practical examples:

- Review all open PRs every morning at 9 AM
- Monitor a Slack channel for feedback and create GitHub issues
- Run your test suite after every push and report failures
- Check for dependency updates weekly

## Hooks for Deterministic Automation

Hooks let you run code at specific points in Claude Code's lifecycle. Unlike the AI-driven `/loop` command, hooks are deterministic - they always run the same way.

You configure them in your settings and they fire on events like:

- **Session start** - set up your environment, load context
- **Before bash commands** - validate or log commands before execution
- **On permission requests** - auto-approve specific patterns
- **Continuous operation** - keep Claude running without manual intervention

This is powerful for teams. You can enforce standards (like running linters before every commit) without relying on each engineer to remember.

## Git Worktrees for Parallel Sessions

If you've ever wanted Claude to work on two different branches at the same time, worktrees make this possible. Each session gets its own isolated copy of the repo.

```bash
# Start a session in a worktree
claude --worktree
```

Why this matters: you can have Claude refactoring module A while simultaneously building feature B. Neither session interferes with the other.

This pairs well with `/batch`, which fans out work across dozens of parallel agents. Need to update 50 files? `/batch` can process them concurrently instead of one at a time.

## Voice Input with /voice

You can dictate to Claude instead of typing. This sounds gimmicky until you try it for longer explanations.

```bash
/voice
```

It's particularly useful for:

- Explaining complex requirements ("I need a migration that handles both the old and new schema formats, with a rollback path if...")
- Code reviews ("Look at the authentication flow in this PR and tell me if...")
- Brainstorming ("What's the best way to structure this API given these constraints...")

Typing detailed prompts takes time. Talking is faster for anything longer than a few sentences.

## The Chrome Extension for Frontend Work

Claude Code has a Chrome extension that lets the AI see what your app looks like in the browser. Instead of describing UI bugs, Claude can verify its own output visually.

This closes the feedback loop for frontend work. Claude makes a change, checks the browser, adjusts if something looks off. You stop being the human screenshot tool.

## /branch and --fork-session for Experiments

Want to try two different approaches to the same problem? `/branch` creates a copy of your current session so you can explore a different path without losing your progress.

```bash
# Fork the current session
/branch

# Or fork when starting
claude --fork-session <session-id>
```

This is like git branches but for your AI conversation. Try approach A in one branch, approach B in another, then pick the winner.

## /btw for Side Questions

When Claude is working on a long task, you might have an unrelated question. Instead of interrupting the main task, `/btw` lets you ask a side question.

```bash
/btw what's the difference between SIGTERM and SIGKILL?
```

Claude answers your side question and goes right back to what it was doing. No context switching, no lost progress.

## --bare for SDK Speed

If you're using Claude Code in scripts or CI pipelines, the `--bare` flag skips loading plugins and extra features, making startup up to 10x faster.

```bash
claude --bare -p "generate a migration for adding user roles"
```

This matters when you're calling Claude from automation scripts where every second counts.

## --add-dir for Multi-Repo Work

Working across multiple repositories? You can give Claude access to all of them in a single session.

```bash
claude --add-dir ~/projects/api --add-dir ~/projects/frontend
```

Now Claude can see your API schema and your frontend code at the same time. No more copying types between repos or explaining your API structure manually.

## Custom Agents with --agent

You can create custom agent configurations with their own system prompts and tool permissions.

```bash
claude --agent reviewer    # Uses your custom reviewer agent config
claude --agent deployer    # Uses your custom deployer agent config
```

Define these in your `.claude/agents/` directory. Each agent can have different instructions, different tool access, and different behaviors. A code reviewer agent doesn't need write access. A deployment agent doesn't need to browse the web.

## What This Means for DevOps

These features shift Claude Code from "AI code assistant" to "AI DevOps team member." The combination of scheduling, hooks, parallel sessions, and multi-repo access means you can automate workflows that previously required custom tooling.

Here's a realistic DevOps setup:

1. `/schedule` reviews all PRs every morning
2. Hooks enforce linting and security scanning on every session
3. Worktrees let you debug production while shipping features
4. `--add-dir` gives Claude access to your infra and app repos simultaneously
5. `/loop` monitors your staging environment and alerts you on issues

The key insight from Boris's thread: "There is no one right way to use Claude Code." The tool is intentionally flexible. Experiment with these features and build the workflow that fits your team.

## Try It Out

If you haven't updated Claude Code recently, run:

```bash
claude update
```

Many of these features are recent additions. The mobile app, scheduling, and hooks in particular have been added in the last few months.

For more DevOps tools and guides, check out our [exercises](/exercises) and [quizzes](/quizzes) to sharpen your skills.

*This post was inspired by [Boris Cherny's thread on X](https://x.com/bcherny/status/2038454336355999749). Boris is the creator of Claude Code at Anthropic.*
