# Write a DevOps Daily Post

Write a new blog post for DevOps Daily on the topic: $ARGUMENTS

## Content Location & Format

- Save as: `content/posts/<slug>.md` (kebab-case, no date prefix)
- Format: Markdown with YAML frontmatter

## Required Frontmatter

```yaml
---
title: '<Post Title>'
excerpt: '<1-2 sentence summary that hooks the reader and describes what they will learn>'
category:
  name: '<Category Name>'
  slug: '<category-slug>'
date: '<YYYY-MM-DD>'
publishedAt: '<YYYY-MM-DDT09:00:00Z>'
updatedAt: '<YYYY-MM-DDT09:00:00Z>'
readingTime: '<N min read>'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Tag1
  - Tag2
  - Tag3
  - Tag4
---
```

### Valid Categories (use only these)

- Docker (docker), Kubernetes (kubernetes), Terraform (terraform), AWS (aws)
- Linux (linux), Git (git), CI/CD (ci-cd), DevOps (devops)
- Cloud (cloud), Python (python), Bash (bash), Networking (networking), FinOps (finops)

### Frontmatter Rules

- `date` and `publishedAt` use today's date
- `readingTime` — estimate generously (posts tend toward higher read times than raw word count suggests)
- Use 3-8 relevant tags, including the category name
- `excerpt` should be compelling and describe what the reader will learn — avoid generic fluff
- `featured` is optional (defaults to false) — set to true for cornerstone/flagship content

## Writing Style

### Opening Paragraph
- Start with a strong, practical opening that frames the problem or opportunity
- Explain WHY this topic matters in real-world DevOps scenarios
- Mention what the reader will learn or be able to do after reading
- No fluff — get to the point quickly

### Structure Pattern
Posts follow this general structure:

1. **Opening paragraph** — problem framing, why it matters
2. **TLDR section** (optional but common, `## TLDR` or `## TL;DR`) — quick summary for scanners
3. **Prerequisites section** (`## Prerequisites`) — bulleted list of what the reader needs
4. **Core content sections** — 3-6 major sections with `##` headers
5. **Practical examples** — real-world code snippets, commands, and config files
6. **Summary or best practices** — wrap-up section with key takeaways

### Technical Content Rules
- Use fenced code blocks with language identifiers: ```dockerfile, ```yaml, ```bash, ```python, ```hcl, etc.
- For non-code blocks (ASCII diagrams, directory trees, plain text examples), use ```text as the language identifier
- Include ASCII diagrams where architecture or flow visualization helps understanding
- Show both "wrong" and "right" approaches when teaching best practices
- Add inline comments in code to explain non-obvious lines
- Include realistic, production-quality examples (not toy examples)
- When showing commands, include expected output where helpful

### Tone
- Practical and direct — write like you're explaining to a skilled colleague
- Avoid buzzwords and marketing speak
- Use "you" to address the reader directly
- Present tense: "Docker uses namespaces" not "Docker will use namespaces"
- Confident but not dogmatic — acknowledge tradeoffs

### Formatting Rules
- ATX-style headers only (`#`, `##`, `###`)
- One blank line between sections
- Use bullet lists for prerequisites, requirements, and quick tips
- Use numbered lists for sequential steps
- Bold key terms on first use
- No emojis in post content

## OG Image

After creating the post, remind the user to generate the OG image:
```bash
npm run generate:images:parallel
npm run convert:svg-to-png:parallel
```

The OG image is auto-generated from the post title and category — no manual image creation needed. The social image will be at `/images/posts/<slug>.png` (1200x630px).

## Validation Checklist

Before finishing, verify:
- [ ] Frontmatter has all required fields
- [ ] Category slug matches an existing category in `content/categories/`
- [ ] Code blocks have language identifiers
- [ ] Post has a Prerequisites section
- [ ] Content is practical with real examples
- [ ] Reading time estimate is reasonable
- [ ] Slug is kebab-case and descriptive
