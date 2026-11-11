# Repository agent instructions

## DevOps Daily posts

Before creating or substantially editing a file in `content/posts/`, read
`.claude/commands/write-post.md` completely and follow it as the authoritative
content guide. The command is agent-neutral even though it lives under
`.claude/`; do not maintain a duplicated Codex copy that can drift from it.

Keep custom inline visuals when they improve the article. Store post-specific
assets under `public/images/posts/<slug>/` and reference them from files in
`content/posts/` with `../../public/images/posts/<slug>/<file>`. This keeps the
images visible in local Markdown previews; the site renderer converts that
authoring path to the public `/images/...` URL. The generated OG image complements
these assets; it does not replace useful diagrams, screenshots, or illustrations
in the post.

Before finishing a post, validate its frontmatter and Markdown, validate every
JSON-backed interactive block, and run the narrowest relevant content tests plus
formatting checks.

## Cover images (OG images)

Every cover comes from `scripts/generate-content-og.ts`, which writes the light
1200x630 JPEG card. This applies to posts, guides, exercises, news, advent days,
quizzes, games and simulators, checklists, interview questions, comparisons,
flashcards, tools and challenges. Generate one cover with:

```bash
npx tsx scripts/generate-content-og.ts --only=<type>/<slug>
```

`<type>` is singular: `post`, `guide`, `exercise`, `news`, `advent`, `quiz`,
`game`, `checklist`, `interview`, `comparison`, `flashcard`, `tool` or
`challenge`. Add `--force` to replace an existing cover. Commit the new `.jpg`;
if it replaced a PNG, also commit the PNG removal and the new `public/_redirects`
line.

Never hand-make a cover, never write a one-off cover generator, and never add a
PNG cover. The old dark PNG template was removed in Nov 2026.
`tests/content-covers.test.ts` fails CI on any PNG cover, and
`pnpm validate:games` fails on a game without its JPG cover.
