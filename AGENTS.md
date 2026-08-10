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
