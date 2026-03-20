# Create a DevOps Daily Guide

Create a new multi-part guide for DevOps Daily on the topic: $ARGUMENTS

## Content Location & Format

- Save as a **directory**: `content/guides/<guide-slug>/`
- Each guide has an `index.md` (overview) and numbered part files (`01-part-slug.md`, `02-part-slug.md`, etc.)
- Format: Markdown with YAML frontmatter

## Directory Structure

```text
content/guides/<guide-slug>/
├── index.md              # Guide overview and introduction
├── 01-<part-slug>.md     # Part 1
├── 02-<part-slug>.md     # Part 2
├── 03-<part-slug>.md     # Part 3
└── ...                   # As many parts as needed
```

## index.md — Guide Overview

```yaml
---
title: '<Guide Title>'
description: '<1-2 sentences describing what the guide covers and what the reader will learn>'
category:
  name: '<Category Name>'
  slug: '<category-slug>'
publishedAt: '<YYYY-MM-DD>'
updatedAt: '<YYYY-MM-DD>'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Tag1
  - Tag2
  - Tag3
---
```

### Index Body Content

The index.md body should contain:

1. **Opening paragraph** — What this guide covers and why it matters
2. **"What You'll Learn" section** (`## What You'll Learn`) — bulleted or numbered list mapping to the parts
3. **Target audience section** (optional, `## Who This Guide Is For`) — who benefits from this guide
4. **Closing encouragement** — brief motivational line to start

Example:
```markdown
Docker has revolutionized how developers build, share, and run applications...

## What You'll Learn

- Core Docker concepts and architecture
- How to install Docker on various platforms
- Working with Docker images and containers
...

## Who This Guide Is For

- DevOps engineers implementing containerization strategies
- Developers looking to standardize development environments
...

Let's start your Docker journey!
```

### Valid Categories (use only these)

- Docker (docker), Kubernetes (kubernetes), Terraform (terraform), AWS (aws)
- Linux (linux), Git (git), CI/CD (ci-cd), DevOps (devops)
- Cloud (cloud), Python (python), Bash (bash), Networking (networking), FinOps (finops)
- Security (security) — used by security-focused guides

## Part Files — Individual Sections

### Part Frontmatter

```yaml
---
title: '<Part Title>'
description: '<1 sentence describing what this part covers>'
order: <N>
---
```

- `title` — descriptive title for this section
- `description` — brief summary
- `order` — integer matching the file number prefix (1, 2, 3, ...)

### Part Body Content

Each part follows the same writing conventions as blog posts:

- Open with a brief intro explaining what this section covers
- Use `##` and `###` headers to organize content
- Include practical code examples with language-labeled fenced blocks (```yaml, ```bash, ```dockerfile, ```hcl, etc.)
- For non-code blocks (ASCII diagrams, directory trees), use ```text
- Include real-world examples and scenarios
- End with a natural transition to the next part (when not the last part)

### Part Naming Convention

Files are prefixed with zero-padded numbers matching the `order` field:

- `01-basics.md` (order: 1)
- `02-installation.md` (order: 2)
- `10-advanced-topics.md` (order: 10)

The slug portion should be kebab-case and descriptive.

## Guide Design Guidelines

### Scope & Structure
- **8-12 parts** is typical for an introduction/comprehensive guide
- **4-6 parts** for a focused/specialized guide
- Each part should be self-contained enough to read alone but build on previous parts
- Parts should progress from fundamentals to advanced topics
- First part should cover core concepts/theory
- Last part should cover advanced topics, best practices, or production readiness

### Content Quality
- Each part should be substantial (800-2000 words)
- Include hands-on examples the reader can follow along with
- Use the same tone as blog posts: practical, direct, addressing the reader as "you"
- No emojis in guide content
- Code blocks must have language identifiers

### Writing Style
- Practical and direct — write like you're teaching a skilled colleague
- Use "you" and "we" to address the reader
- Present tense: "Docker uses namespaces" not "Docker will use namespaces"
- Acknowledge tradeoffs rather than being dogmatic
- Bold key terms on first use

## OG Image

After creating the guide, remind the user to generate the OG image:
```bash
npm run generate:images:parallel
npm run convert:svg-to-png:parallel
```

The OG image is auto-generated from the guide title and category. The social image will be at `/images/guides/<guide-slug>.png` (1200x630px).

## Checklist

- [ ] Guide directory created with index.md and numbered part files
- [ ] index.md has all required frontmatter (title, description, category, publishedAt, updatedAt, author, tags)
- [ ] Each part has frontmatter with title, description, and order
- [ ] Part file prefixes match order values (01 = order 1, etc.)
- [ ] "What You'll Learn" section in index.md maps to the parts
- [ ] Parts progress logically from fundamentals to advanced
- [ ] Code blocks have language identifiers
- [ ] Category slug matches an existing category
- [ ] Guide slug is kebab-case and descriptive
