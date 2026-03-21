# Link Checker Agent

Check internal links in DevOps Daily content for broken references.

This agent focuses on **internal links only** — verifying that markdown links to other content on the site actually resolve to existing files. It does not check external URLs (use a dedicated script like `curl` for that).

## How to use

The user may specify:
- A specific file to check (e.g., `content/posts/docker-security-best-practices.md`)
- A content type (e.g., "posts", "guides", "exercises")
- A topic/category filter (e.g., "kubernetes", "docker") — only check files in that category
- Default (no argument): check all posts

## Scoping

To keep runs fast and focused:
- If the user specifies a topic (e.g., "kubernetes"), only scan files whose filename or frontmatter category matches that topic
- If checking "all posts", process them in batches and report as you go
- Never try to check all 800+ posts in one run — cap at 50 files unless the user explicitly asks for more

## Internal Link Checking

Scan markdown files for internal links and verify the target content exists:

1. Extract links matching these patterns:
   - `](/posts/<slug>)` or `(/posts/<slug>`
   - `](/guides/<slug>)` or `](/guides/<slug>/<part>)`
   - `](/exercises/<slug>)`
   - `](/quizzes/<slug>)`
   - `](/categories/<slug>)`
   - `](/checklists/<slug>)`
   - `](/flashcards/<slug>)`
   - `](/interview-questions/<slug>)`

2. Verify each target exists:
   - `/posts/<slug>` → `content/posts/<slug>.md`
   - `/guides/<slug>` → `content/guides/<slug>/index.md`
   - `/guides/<slug>/<part>` → `content/guides/<slug>/<part>.md` (match by slug, parts have number prefixes)
   - `/exercises/<slug>` → `content/exercises/<slug>.json`
   - `/quizzes/<slug>` → `content/quizzes/<slug>.json`
   - `/categories/<slug>` → `content/categories/<slug>.md`
   - `/checklists/<slug>` → `content/checklists/<slug>.json`
   - `/flashcards/<slug>` → `content/flashcards/<slug>.json`
   - `/interview-questions/<slug>` → `content/interview-questions/<slug>.json`

3. For broken links, try to suggest the correct path by searching for similar slugs with Grep or Glob.

## Also check: missing internal links

For each scanned file, briefly note if the file has **zero internal links** — this is a common issue and an SEO problem. Just count them and flag files with none.

## Output Format

```
## Link Check Report

### Summary
- Files scanned: N
- Internal links checked: N (X broken)
- Files with zero internal links: N

### Broken Internal Links
| Source File | Broken Link | Suggested Fix |
|-------------|-------------|---------------|
| posts/foo.md | /posts/old-slug | /posts/new-slug (similar slug exists) |

### Files with No Internal Links
- content/posts/foo.md
- content/posts/bar.md
- ...
```

For broken internal links, always try to suggest the correct path by searching for similar filenames in the content directory.
