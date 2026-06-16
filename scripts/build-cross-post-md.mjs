/**
 * Turns a published post into a DEV-ready cross-post:
 *  - DEV frontmatter with canonical_url pointing back to the original
 *  - an "originally published" note
 *  - every ```chart fence replaced by the rendered PNG (hosted on
 *    devops-daily.com) plus a caption linking to the interactive version
 * Output: cross-posts/dev/<slug>.md
 *
 *   node scripts/build-cross-post-md.mjs <slug> [<slug> ...]
 */
import matter from "gray-matter";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://devops-daily.com";

function devTags(tags = []) {
  return tags
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean)
    .slice(0, 4);
}

for (const slug of process.argv.slice(2)) {
  const raw = readFileSync(join("content/posts", `${slug}.md`), "utf8");
  const { data, content } = matter(raw);
  const canonical = `${SITE}/posts/${slug}`;

  // Replace chart fences (in order) with the rendered image + interactive link.
  let i = 0;
  const body = content.replace(/```chart\n([\s\S]*?)```/g, (_, specRaw) => {
    const spec = JSON.parse(specRaw);
    const idx = i++;
    const img = `${SITE}/images/cross-posts/${slug}/chart-${idx}-${spec.type}.png`;
    const title = (spec.title || "Chart").replace(/"/g, "");
    return `![${title}](${img})\n\n*${title} — [interactive version on DevOps Daily](${canonical})*`;
  });

  const fm = [
    "---",
    `title: ${JSON.stringify(data.title)}`,
    "published: false",
    `canonical_url: ${canonical}`,
    `cover_image: ${SITE}/images/posts/${slug}.png`,
    `tags: ${devTags(data.tags).join(", ")}`,
    "---",
  ].join("\n");

  const note = `> Originally published on [DevOps Daily](${canonical}). The charts below are static snapshots; the live, interactive versions and the open source benchmark harness are on the original.`;

  const out = `${fm}\n\n${note}\n\n${body.trim()}\n`;
  mkdirSync("cross-posts/dev", { recursive: true });
  writeFileSync(join("cross-posts/dev", `${slug}.md`), out);
  console.log(`cross-posts/dev/${slug}.md  (${i} charts swapped)`);
}
