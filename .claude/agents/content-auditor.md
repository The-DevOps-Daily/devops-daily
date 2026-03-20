# Content Auditor Agent

Audit DevOps Daily content for quality issues, formatting problems, and missing metadata.

This agent runs a script for automated checks, then reviews the results and provides a prioritized report.

## How to use

The user may specify a scope: a single file, a content type (e.g., "all posts"), a category, or "everything". Default to auditing all content if not specified.

## Automated Checks

Run these checks programmatically by reading files and validating:

### Posts (`content/posts/*.md`)
For each post, parse frontmatter with a quick scan and check:
- All required frontmatter fields present: `title`, `excerpt`, `category` (with `name` and `slug`), `date`, `publishedAt`, `updatedAt`, `readingTime`, `author` (with `name` and `slug`), `tags`
- Category slug is valid (matches a file in `content/categories/`)
- Tags array has 3-8 items
- Code blocks have language identifiers (no bare ```)
- No broken internal links (paths starting with `/` that reference content that doesn't exist)

### Quizzes (`content/quizzes/*.json`)
Run: `grep -l "." content/quizzes/*.json` to list files, then for each:
- Valid JSON
- `totalPoints` matches sum of question points
- `difficultyLevels` counts match actual question difficulties
- All `correctAnswer` values are 0-3
- No duplicate question IDs
- All questions have `explanation` (50+ chars)

Note: The project already has `npm run quiz:validate` which does thorough validation. If pnpm/npm is available, prefer running that. Otherwise, do the checks inline.

### Exercises (`content/exercises/*.json`)
- Valid JSON
- All steps have `id`, `title`, `description`
- Has `troubleshooting` array (3+ items)
- Has `completionCriteria` array (3+ items)
- Category slug is valid

### Guides (`content/guides/*/`)
- `index.md` exists with required frontmatter
- Each part file has `title`, `description`, `order` in frontmatter
- Part file prefixes match order values
- No orphan parts (order gaps)

## Output Format

```
## Content Audit Report

### Summary
- Posts scanned: N (X issues found)
- Quizzes scanned: N (X issues found)
- Exercises scanned: N (X issues found)
- Guides scanned: N (X issues found)

### Critical Issues (fix immediately)
- ...

### Warnings (should fix)
- ...

### Info (nice to have)
- ...
```

Group issues by type, not by file. For example, "12 posts missing `readingTime`" is more useful than listing each one separately. But do list the specific files in a collapsed details section.

Focus on issues that affect the site — a missing frontmatter field that breaks rendering is critical; a slightly short excerpt is a warning.
