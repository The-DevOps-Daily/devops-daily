# DevOps Daily cover templates

The production cover system is generated from the shared, code-native SVG renderer in
[`scripts/og-utils.ts`](../../scripts/og-utils.ts). It gives every content type the same
layout rules while retaining a distinct accent colour and content label.

Supported types:

- posts, guides, exercises, news and Advent entries
- quizzes, games and tools
- checklists and interview questions
- comparisons and flashcards

Generate missing covers for every supported type:

```bash
pnpm generate:images
```

Regenerate all covers after a deliberate design change:

```bash
pnpm generate:images -- --force
```

Generate one longest-title sample per type for visual review:

```bash
pnpm generate:images:preview
```

Render and pixel-check every current item without writing files:

```bash
pnpm validate:images
```

Generate selected covers only:

```bash
pnpm generate:images -- --force \
  --only=post/example-post,comparison/github-vs-gitlab
```

The renderer writes SVG and PNG pairs atomically at 1200x630. It escapes XML,
adapts title font size and width, splits long unbroken tokens, and rejects empty or
implausibly long titles before replacing an existing cover.

## Legacy files

The standalone SVG files in this directory are retained temporarily for compatibility
with older manual workflows. New content should use the shared generator so cover
types do not drift apart again.
