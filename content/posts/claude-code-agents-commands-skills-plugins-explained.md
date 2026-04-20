---
title: 'Claude Code: Agents, Commands, Skills, and Plugins Explained'
excerpt: 'A clear breakdown of the four extension types in Claude Code - what each one does, how they differ, and when to use which. No marketing fluff, just practical explanations with examples.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-04-11'
publishedAt: '2026-04-11T09:00:00Z'
updatedAt: '2026-04-11T09:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Claude Code
  - AI
  - Automation
  - Developer Tools
  - CLI
---

Claude Code has four different extension mechanisms: **agents**, **commands**, **skills**, and **plugins**. They overlap in confusing ways, and the documentation does not always make the distinctions clear. This post explains what each one actually does, how they relate to each other, and when to use which.

## TLDR

| Type | What it is | Runs when | Defined in |
|------|-----------|-----------|------------|
| **Slash commands** | Pre-written prompts you trigger with `/` | When you type `/command` | `.claude/commands/` |
| **Skills** | Larger instruction sets Claude loads on demand | When a skill matches the task | Plugin packages |
| **Agents** | Autonomous sub-processes that handle complex tasks | When Claude spawns them | Built-in or custom |
| **Plugins** | Packages that bundle skills, commands, hooks, and MCP servers | At install time | Plugin marketplace or GitHub |

Think of it this way: **plugins** are packages that contain **skills** and **commands**. **Agents** are how Claude delegates work. They are different layers, not competing alternatives.

## Prerequisites

- Claude Code installed
- Basic experience using Claude Code for development tasks
- A project directory with a `.claude/` folder

## Slash Commands

Slash commands are the simplest extension type. They are pre-written prompts saved as markdown files that you trigger by typing `/` followed by the command name.

### Where they live

```text
.claude/
  commands/
    review.md        # /review
    write-test.md    # /write-test
    deploy.md        # /deploy
```

### What they look like

A command file is just a markdown prompt:

```markdown
# Review this PR

Review the current git diff for:
- Bugs and logic errors
- Security issues
- Performance problems
- Code style inconsistencies

Focus on the changes only, not the entire codebase.
Be specific about line numbers and suggest fixes.
```

### How to use them

```bash
# List available commands
/commands

# Run a command
/review
/write-test
```

### When to use slash commands

- Repetitive prompts you type often (code review, test writing, deployment checks)
- Team-shared prompts (commit to `.claude/commands/` in your repo)
- Project-specific workflows (your deploy process, your review checklist)

### When NOT to use them

- Complex multi-step workflows (use skills instead)
- Tasks that need external tool access (use MCP servers instead)
- One-off prompts you will not repeat (just type them directly)

## Skills

Skills are more structured than slash commands. They are larger instruction sets that Claude loads on demand when it detects a matching task. Skills can include multiple steps, tool restrictions, and detailed context.

### How skills differ from commands

| | Slash Commands | Skills |
|---|---|---|
| Triggered by | You type `/name` | Claude detects a matching task |
| Size | Short prompts (10-50 lines) | Detailed instructions (50-500 lines) |
| Complexity | Single prompt | Multi-step workflows |
| Tool access | Uses whatever tools are available | Can restrict to specific tools |
| Packaged in | `.claude/commands/` directory | Plugins |

### Example skill: write-post

A skill might instruct Claude to write a blog post with specific frontmatter format, writing style rules, file location conventions, and validation steps. When you say "write a blog post about X," Claude recognizes this matches the `write-post` skill and loads those detailed instructions.

### How skills are loaded

Skills come from installed plugins. When you install a plugin, its skills become available. Claude checks skill descriptions against your request and loads matching ones automatically.

```text
You: "Write a blog post about Kubernetes networking"

Claude thinks:
  - Does this match any skills?
  - Yes: "write-post" skill matches "write a blog post"
  - Loading skill instructions...
  - Following the skill's format, style, and file conventions
```

### When to use skills

- Complex, multi-step content creation (blog posts, documentation)
- Workflows with specific output formats (frontmatter, file naming conventions)
- Tasks where consistency matters across multiple runs

## Agents

Agents are autonomous sub-processes that Claude spawns to handle complex tasks in parallel or in isolation. They are not something you install - they are a built-in capability.

### How agents work

When Claude encounters a task that would benefit from focused, independent work, it can launch an agent. The agent gets its own context, runs independently, and returns results.

```text
You: "Search the codebase for all API routes that don't have rate limiting"

Claude spawns an Explore agent that:
  1. Searches all route files
  2. Checks each for rate limiting
  3. Returns a list of unprotected routes

Meanwhile, Claude can continue working on other parts of your request.
```

### Types of agents

- **Explore agent** - fast codebase exploration, file searching, code analysis
- **Plan agent** - designs implementation strategies before coding
- **General-purpose agent** - handles complex multi-step research or implementation tasks
- **Custom agents** - you can define specialized agents for your workflows

### When agents are used

You do not usually invoke agents directly. Claude decides when to spawn them based on:

- Task complexity (simple grep vs multi-file analysis)
- Independence (can this subtask run without waiting for other results?)
- Context isolation (does this task need a clean context without your conversation history?)

### Agent vs doing it directly

```text
Simple task (no agent needed):
  "What's in package.json?"
  -> Claude just reads the file

Complex task (agent helps):
  "Audit all 37 API routes for security issues"
  -> Claude spawns an agent to systematically check each route
  -> Agent returns structured findings
```

## Plugins

Plugins are packages that bundle multiple extension types together. A plugin can contain skills, commands, hooks, and MCP server configurations.

### What plugins contain

```text
my-plugin/
  skills/
    write-post.md      # Skill definitions
    review-code.md
  commands/
    quick-check.md     # Slash commands
  hooks/
    pre-commit.sh      # Lifecycle hooks
  mcp/
    config.json        # MCP server setup
  plugin.json          # Plugin metadata
```

### Installing plugins

```bash
# From the official marketplace
/install-plugin context7

# From GitHub
/install-plugin https://github.com/org/plugin-name

# List installed plugins
/plugins
```

### The plugin marketplace

There are two marketplaces:

1. **Official marketplace** (`claude.com/plugins`) - verified by Anthropic, generally safe
2. **Knowledge-work marketplace** - business-focused plugins (marketing, sales, legal)

```bash
# Add the knowledge-work marketplace
/plugin marketplace add anthropics/knowledge-work-plugins
```

### When to install plugins

- When you need capabilities Claude does not have natively (live docs, security scanning)
- When you want structured workflows for your team (standardized PR creation, review process)
- When the context cost is worth the capability

### When NOT to install plugins

- When you can achieve the same thing with a CLAUDE.md file or slash command
- When you are "collecting" plugins without a specific need
- When you notice slower responses after installing several plugins

## How They All Fit Together

```text
Plugin (package)
├── Skills (loaded on demand by Claude)
├── Commands (triggered by you with /)
├── Hooks (run automatically on events)
└── MCP Servers (external tool connections)

Agents (built-in, not installed)
└── Spawned by Claude when needed for complex tasks
```

### A practical example

You install the **Superpowers** plugin. This gives you:

- **Skills**: TDD workflow, debugging methodology, plan-to-code conversion
- **Commands**: `/tdd` to start test-driven development, `/debug` to launch structured debugging
- **Hooks**: maybe a pre-commit hook that runs tests

When you type `/tdd`, it triggers the TDD command, which loads the TDD skill, which instructs Claude to follow a specific red-green-refactor workflow. If the task is complex, Claude might spawn an agent to write tests in parallel while it works on implementation.

All four mechanisms working together.

## Decision Guide

### "I want Claude to follow a specific format when I ask for X"
Use a **skill** (via a plugin) or a **CLAUDE.md** instruction.

### "I want a shortcut for a prompt I type often"
Use a **slash command** in `.claude/commands/`.

### "I want Claude to check my code for security issues automatically"
Install the **Security Guidance plugin**.

### "I want Claude to look up current API docs instead of guessing"
Install the **Context7 plugin**.

### "I want Claude to handle a complex task autonomously"
This happens automatically via **agents** - you do not need to configure anything.

### "I want to enforce rules across my team"
Put them in **CLAUDE.md** (simplest) or create a custom **plugin** (most structured).

## Summary

The four extension types serve different purposes at different levels:

- **Slash commands** are personal shortcuts for prompts you repeat
- **Skills** are structured workflows that Claude loads automatically
- **Agents** are autonomous workers Claude spawns for complex tasks
- **Plugins** are packages that bundle skills, commands, and more

Start with CLAUDE.md for project rules and slash commands for frequent prompts. Add plugins only when you need capabilities that do not exist natively. Agents handle themselves - you do not need to configure them.

The best setup is the minimal one that covers your actual needs. Every extension you add has a cost in complexity and context. Be selective, and your Claude Code experience will be better for it.
