# Link Checker Agent

Check external and internal links in DevOps Daily content for broken URLs, redirects, and stale references.

This agent leverages the existing `scripts/check-broken-links.ts` for internal links (post-build) and adds external link checking for markdown content.

## How to use

The user may specify:
- A specific file or content type to check
- "internal" — internal links only (uses existing script output or scans markdown)
- "external" — external URLs only (fetches each URL)
- Default: check both

## Internal Link Checking

The project already has `scripts/check-broken-links.ts` which checks internal links in built HTML output. However, this requires a build. For a faster pre-build check:

1. Scan markdown files for internal links: patterns like `](/posts/...`, `](/guides/...`, `](/exercises/...`
2. Verify the target content exists:
   - `/posts/<slug>` → check `content/posts/<slug>.md` exists
   - `/guides/<slug>` → check `content/guides/<slug>/index.md` exists
   - `/exercises/<slug>` → check `content/exercises/<slug>.json` exists
   - `/quizzes/<slug>` → check `content/quizzes/<slug>.json` exists
   - `/categories/<slug>` → check `content/categories/<slug>.md` exists

## External Link Checking

For external URLs found in markdown content:
1. Extract all URLs starting with `http://` or `https://`
2. For each unique URL, use `WebFetch` or `curl` to check if it's reachable
3. Report: HTTP status, redirect chains, timeouts
4. Flag: 404s, 5xx errors, excessive redirects, HTTP→HTTPS redirects (suggest updating URL)

**Rate limiting**: Check at most 5 URLs per second to avoid being blocked. Focus on unique URLs — many posts may link to the same documentation pages.

**Scope priority**: If checking "everything" would mean hundreds of external URLs, prioritize:
1. News digests (most likely to have stale links — they reference current events)
2. Posts (long-lived content with reference links)
3. Guides (critical learning resources)

## Output Format

```
## Link Check Report

### Summary
- Files scanned: N
- Internal links checked: N (X broken)
- External links checked: N (X broken, Y redirected)

### Broken Internal Links
| Source File | Broken Link | Suggested Fix |
|-------------|-------------|---------------|
| posts/foo.md | /posts/old-slug | /posts/new-slug (did you mean?) |

### Broken External Links
| Source File | URL | Status | Notes |
|-------------|-----|--------|-------|
| posts/bar.md | https://example.com/old | 404 | Remove or find replacement |

### Redirected URLs (update these)
| Source File | Current URL | Redirects To |
|-------------|-------------|--------------|
| posts/baz.md | http://docs.example.com | https://docs.example.com |
```

For broken internal links, try to suggest the correct path by searching for similar slugs in the content directory.
