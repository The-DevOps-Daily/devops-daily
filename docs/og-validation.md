# OG Data Validation

This document explains the pre-commit hook that validates Open Graph (OG) metadata for content files.

## Overview

The OG validation hook ensures that all content has proper metadata for social sharing. When content is shared on Twitter, LinkedIn, Slack, etc., these platforms use OG tags to display rich previews. Missing or malformed OG data results in poor-looking shares.

## Installation

Install the git hooks by running:

```bash
npm run hooks:install
```

This copies the pre-commit hook to `.git/hooks/`. If you already have a pre-commit hook, it will be backed up to `pre-commit.bak`.

## What Gets Validated

### Required Fields (Errors)

These fields are **required** and will block your commit if missing:

| Content Type | Required Fields |
|--------------|----------------|
| Posts | `title`, `excerpt` |
| Guides | `title`, `description` |
| Exercises | `title`, `description` |
| Checklists | `title`, `description` |
| Advent of DevOps | `title`, `description` |
| News | `title`, `summary` |

### Warnings (Non-blocking)

These issues generate warnings but won't block your commit:

| Warning | Recommendation |
|---------|---------------|
| Title > 70 characters | Shorten title; longer titles get truncated on social platforms |
| Description < 50 characters | Add more detail to the description |
| Description > 200 characters | Consider shortening; descriptions are typically truncated at ~160 chars |
| Missing OG image | Add an image at `public/images/{type}/{slug}.{svg,png}` |

### OG Image Requirements

Each content file should have a corresponding OG image:

```
content/posts/my-post.md       → public/images/posts/my-post.svg (or .png)
content/guides/my-guide.md     → public/images/guides/my-guide.svg (or .png)
content/checklists/foo.json    → public/images/checklists/foo.svg (or .png)
content/news/2025/week-1.md    → public/images/news/week-1.svg (or .png)
```

SVG is preferred for smaller file sizes, but PNG is also supported.

## Usage

### Automatic (Pre-commit Hook)

Once installed, the hook runs automatically on every commit. It only validates **staged files** that are content files (`.md` or `.json` in content directories).

```bash
git add content/posts/new-post.md
git commit -m "Add new post"  # Hook runs automatically
```

### Manual Validation

You can manually validate all content files:

```bash
npm run og:validate
```

Or validate only staged files:

```bash
npm run og:validate:staged
```

### Skipping Validation

If you need to bypass validation (e.g., for WIP commits), use:

```bash
git commit --no-verify -m "WIP: work in progress"
```

**Note:** Use this sparingly. Skipped validation should be fixed before merging.

## Examples

### Valid Post Frontmatter

```yaml
---
title: "How to Set Up Docker on Ubuntu"
excerpt: "A step-by-step guide to installing and configuring Docker on Ubuntu 22.04, including post-installation steps and troubleshooting tips."
date: "2025-01-15"
author: "devops-daily"
---
```

### Valid Checklist JSON

```json
{
  "title": "Kubernetes Security Checklist",
  "description": "Essential security practices for hardening your Kubernetes clusters in production.",
  "items": [...]
}
```

### Common Errors

**Error: Missing required field: excerpt**
```yaml
---
title: "My Post"
# excerpt is missing!
---
```

**Warning: Title too long**
```yaml
---
title: "A Comprehensive Guide to Understanding and Implementing Kubernetes Network Policies for Multi-Tenant Clusters"
# This is 108 characters - will be truncated on social platforms
---
```

## Troubleshooting

### "npx not found, skipping OG validation"

This means Node.js/npm is not installed or not in your PATH. Install Node.js first.

### Hook not running

Make sure you've installed the hooks:
```bash
npm run hooks:install
```

Verify the hook exists and is executable:
```bash
ls -la .git/hooks/pre-commit
```

### False positives for OG images

The validator looks for images in `public/images/{type}/{slug}.{svg,png}`. If your image has a different name or location, it will show as missing. Consider renaming to match the expected pattern.

## Configuration

The validation rules are defined in `scripts/git-hooks/validate-og-data.ts`. The `CONTENT_CONFIG` object maps each content type to its:

- Directory location
- Image directory
- File extension
- Required frontmatter fields
- Description field names (varies by content type)

To modify validation rules, edit this configuration object.
