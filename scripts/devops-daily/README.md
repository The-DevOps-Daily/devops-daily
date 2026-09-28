# DevOps Daily Digest Generator

An automated system for generating weekly DevOps news digests from 250+ sources including Kubernetes, CNCF projects, cloud providers, CI/CD tools, and more.

## Overview

This script automatically:

- Crawls 250+ DevOps RSS feeds and web sources
- Extracts, normalizes, and deduplicates content
- Classifies items by keyword and uses their excerpts as summaries
- Groups content by category
- Generates markdown digest files

Git operations (branching, commits, PR creation) are handled separately by GitHub Actions.

## Directory Structure

```
scripts/devops-daily/
├── index.ts                       # Main entry point
├── crawler/
│   ├── types.ts                   # TypeScript types
│   ├── fetch.ts                   # HTTP fetching with retry
│   ├── rss.ts                     # RSS feed crawler
│   └── web.ts                     # Web scraper with RSS discovery
├── pipeline/
│   ├── classify.ts                # Keyword-based classification
│   ├── assemble.ts                # Digest assembly
│   ├── validate.ts                # Markdown validation
│   └── template.ts                # Markdown generation
├── utils/
│   ├── date.ts                    # Date utilities
│   ├── dedupe.ts                  # Deduplication logic
│   ├── normalize.ts               # Data normalization
│   └── limit.ts                   # Rate limiting
├── data/
│   ├── sources.yaml               # 250+ source definitions
│   └── news.schema.json           # Validation schema
└── README.md                      # This file
```

**Note:** The `git/` directory contains helper modules for git operations but is no longer used by the main script. Git operations are now handled by GitHub Actions.

## Installation

Dependencies are already installed in the main project. If you need to install them separately:

```bash
pnpm add rss-parser axios js-yaml cheerio date-fns gray-matter
pnpm add -D @types/js-yaml
```

## Configuration

### Sources Configuration

Edit `scripts/devops-daily/data/sources.yaml` to add/remove sources:

```yaml
sources:
  - name: 'Kubernetes Blog'
    type: 'rss'
    url: 'https://kubernetes.io/feed.xml'
    category: 'Kubernetes'
    priority: 'high'
```

## Usage

### Run Locally

Generate a digest manually:

```bash
# Make sure you have Node.js 20+ installed
pnpm devops-daily:generate-news
```

The script will:

1. Crawl all configured sources
2. Process and filter items from the last 7 days
3. Classify items by keyword and drop event announcements
4. Use each item's excerpt as its summary
5. Generate markdown file in `content/news/YYYY/week-N.md`
6. Validate the generated file

It makes no AI or other paid API calls.

The script **only generates the markdown file** - it does not commit or create PRs. You can then:

- Manually commit and push the file
- Or let the GitHub Action handle it automatically

### Run via GitHub Actions

The digest can be generated and published automatically via GitHub Actions:

1. **Manual trigger**: Go to Actions → Generate DevOps Weekly Digest → Run workflow
2. **Scheduled**: Runs every Monday at 9:00 AM UTC

The GitHub Action will:

1. Run the generation script
2. Create a new branch (`devops-digest/week-N-YYYY`)
3. Commit the generated file
4. Create a pull request automatically

### Required GitHub Secrets

None beyond the `GITHUB_TOKEN` that GitHub Actions provides automatically.

## Output

### File Location

Generated files are saved to:

```
content/news/
└── 2025/
    ├── week-1.md
    ├── week-2.md
    └── ...
```

### Markdown Format

```markdown
---
title: 'DevOps Weekly Digest - Week 47, 2025'
date: '2025-11-16'
summary: 'Curated updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security.'
---

> Handpicked by DevOps Daily.

## Kubernetes

- **Title**
  Summary of the article...
  _Source: Source Name - Nov 16, 2025_
  [Read more →](https://example.com)

## Cloud Native

...
```

## Categories

Content is organized into these categories:

- **Kubernetes**: K8s core, distributions, tools
- **Cloud Native**: CNCF projects, containers, service mesh
- **CI/CD**: Continuous integration/deployment, GitOps
- **IaC**: Infrastructure as Code (Terraform, Pulumi, etc.)
- **Observability**: Monitoring, logging, tracing
- **Security**: Container security, secrets management
- **Databases**: SQL, NoSQL, data stores
- **Platforms**: Cloud providers, PaaS
- **Misc**: Everything else

## Limits

To maintain quality:

- Max 4 items per source
- Max 12 items per category
- Only items from last 7 days
- Event announcements are filtered out

## Validation

Generated digests are validated for:

- ✅ Front matter format
- ✅ Date format (YYYY-MM-DD)
- ✅ Title format
- ✅ Valid URLs
- ✅ No duplicate URLs

GitHub Actions also run:

- `markdownlint` - Markdown style checking
- `link-check` - URL validation

## Classification

`pipeline/classify.ts` matches keywords in each item's title and excerpt to pick a category, drops event announcements, and uses the first 200 characters of the excerpt as the summary. Items that match no keyword keep the category from `sources.yaml`, or `Misc`.

## Workflow

### Script Workflow

```
┌─────────────────┐
│ Load Sources    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Crawl RSS Feeds │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Crawl Web Pages │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Normalize Items │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Deduplicate     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Filter by Date  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Classify        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Apply Limits    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate MD     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validate        │
└─────────────────┘
```

### GitHub Action Workflow

After the script completes, GitHub Actions handles:

```
┌─────────────────┐
│ Run Script      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Branch   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Commit File     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Push to Remote  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create PR       │
└─────────────────┘
```

## Troubleshooting

### RSS Feed Errors

If a feed fails:

- Check if the URL is still valid
- Verify the feed format (RSS 2.0 or Atom)
- Check for network/firewall issues

### GitHub Action Failures

If the GitHub Action fails:

- Verify the action has `contents: write` and `pull-requests: write` permissions
- Check action logs for specific error messages

## Development

### Adding New Sources

Edit `data/sources.yaml`:

```yaml
- name: 'New Source'
  type: 'rss' # or "web"
  url: 'https://example.com/feed.xml'
  category: 'CI/CD'
  priority: 'medium' # high, medium, or low
```

### Modifying Categories

Update category list in:

- `pipeline/classify.ts` - Category keywords
- `pipeline/assemble.ts` - Category grouping
- `data/news.schema.json` - Validation schema

### Customizing Templates

Edit `pipeline/template.ts` to modify markdown output format.

## Testing

Run a test locally:

```bash
pnpm devops-daily:generate-news
```

This will generate the digest file in `content/news/YYYY/week-N.md` without committing or creating a PR.

Check the generated file manually before committing.

## License

Part of the DevOps Daily project.
