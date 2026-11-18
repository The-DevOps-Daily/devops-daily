# DevOps Daily Digest Generator

Builds the weekly DevOps digest (`content/news/<year>/week-<N>.md`) from 74 news feeds and 13 release feeds listed in `data/sources.yaml`.

It makes no AI or other paid API calls. Ranking, excerpts and the summary come from the feed text and simple rules.

## What it does

1. Crawls the RSS/Atom feeds and the web sources (a web source is a page where the crawler looks for a feed).
2. Reads the release feeds: GitHub release Atom feeds and the PostgreSQL news feed.
3. Cleans every item: plain-text titles and excerpts, entities decoded, feed boilerplate removed ("The post X appeared first on Y", "| Blog", "Read more"), tracking parameters removed from links, only http(s) links kept, undated items dropped.
4. Keeps the items from the digest window and removes duplicates (same URL, same title).
5. Classifies each item into a category by keyword.
6. Ranks and picks about 25 items (see below).
7. Writes the digest and checks its frontmatter.

Git work (branch, commit, pull request) is done by `.github/workflows/generate-digest.yml`.

## Usage

```bash
pnpm devops-daily:generate-news                     # the current week
pnpm devops-daily:generate-news --week 2026-W47 --force   # rebuild a past week
pnpm devops-daily:generate-news --until 2026-11-16  # the 7 days before a date
pnpm devops-daily:generate-news --pr-body /tmp/body.md    # also write the PR description
```

- `--force` replaces a digest file that already exists.
- Feeds only keep their latest items, so a rebuild of an old week can miss items from busy feeds.

### The digest window

The digest for ISO week N covers the 7 days before Monday 00:00 UTC of week N. The workflow runs on Monday at 05:43 UTC; if GitHub starts it hours late, the window stays the same.

## Ranking

Each source in `sources.yaml` has a `tier`:

- `1`: official project blogs and release notes (Kubernetes, CNCF, GitHub, Google Cloud, AWS What's New, Cloudflare, OpenTelemetry, ...)
- `2`: engineering blogs and tech news (The New Stack, Grafana, GitLab, Fly.io, Sentry, ...)
- `3`: vendor marketing blogs

`pipeline/rank.ts` scores every item:

```
score = tier base (6, 4 or 2) + relevance (-4 to +5) + recency (0 to 1)
```

Relevance comes from keywords: releases and versions, security fixes, deprecations, incidents and project milestones score up; a core DevOps topic adds 1; customer stories, ROI claims, awards, recaps and weekly hub pages score down. Events, webinars and other promotion are dropped.

Picks are made best first under these limits:

- 25 items in total, at most 5 per category
- per source: 3 for tier 1, 2 for tier 2, 1 for tier 3
- nothing below a score of 4.5
- a title that is a near duplicate of a picked one is skipped, so the better-ranked copy of a story wins

## Output

```markdown
---
title: 'DevOps Weekly Digest - Week 47, 2026'
date: '2026-11-16'
summary: 'Headline one and headline two, plus 23 more DevOps updates from week 47.'
---

## 📌 This week in short

<!-- editor-intro: ... -->
<!-- /editor-intro -->

**[Top item title](https://example.com/a)**
Source · Nov 11
First sentence of the excerpt.

## 🚀 Releases

- **Istio** [1.32.0](https://github.com/istio/istio/releases/tag/1.32.0)

## ⚓ Kubernetes

**[Item title](https://example.com/b)**
Source · Nov 12
Excerpt that ends at a full sentence, about 160 to 240 characters.

## ✍️ From DevOps Daily this week

- [Post title](/posts/post-slug)
```

- The title keeps the `DevOps Weekly Digest - Week N, YYYY` pattern: URLs, covers and the series rely on it. The summary changes every week: the top headlines, the item count and the week, at most 155 characters.
- "This week in short" holds the 3 best items from different sources. They are not repeated in their category.
- The editor adds 2-4 lines between the `editor-intro` markers on review. Left empty, the markers render nothing.
- "Releases" lists stable releases from the window, one line per project. Alphas, betas and RCs are skipped, except x.y.0 RCs for projects with `majorRc: true` (Kubernetes, PostgreSQL). A release post listed there is not repeated as news.
- "From DevOps Daily this week" lists up to 6 posts from `content/posts` published in the window.
- Feed text is untrusted. Titles and excerpts are escaped for Markdown (`utils/markdown.ts`), so they cannot add HTML, links, headings or lists.

## Configuration

```yaml
sources:
  - name: 'New Source'
    type: 'rss' # or "web"
    url: 'https://example.com/feed.xml'
    category: 'CI/CD'
    priority: 'medium'
    tier: 2

releases:
  - name: 'Kubernetes'
    github: 'kubernetes/kubernetes'
    majorRc: true
  - name: 'Prometheus'
    github: 'prometheus/prometheus'
    skip: '^0\.' # ignore these tags
```

Categories live in `pipeline/classify.ts` (keywords), `pipeline/assemble.ts` (order) and `pipeline/template.ts` (emoji).

## Pull request

With `--pr-body`, the generator writes the PR description: the source counts from `sources.yaml`, the item counts, the feeds that failed, the top 3 headlines and the review line. Headlines are in code spans, so a feed title cannot mention a GitHub user.

## Tests

```bash
pnpm vitest run scripts/__tests__/digest-pipeline.test.ts tests/news-validation.test.ts
```
