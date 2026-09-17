/**
 * Write the sponsor block in README.md from lib/sponsors.ts.
 *
 * The README is the one file nobody re-reads, which is how it ended up
 * documenting a Docker flag that did not exist and a pre-commit hook that was
 * never installed. A hand-maintained sponsor list would rot the same way, and
 * a sponsor list that rots is worse than none: it shows logos of companies who
 * have stopped paying and omits the ones who just started.
 *
 * So it is generated. lib/sponsors.ts already calls itself the single source of
 * truth; this makes that true of the README too.
 *
 *   pnpm generate:readme-sponsors          rewrite the block
 *   pnpm generate:readme-sponsors --check  fail if it is out of date (CI)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { sponsors, type Sponsor } from "../lib/sponsors";

const README = "README.md";
const START = "<!-- sponsors:start -->";
const END = "<!-- sponsors:end -->";
const SITE = "https://devops-daily.com";

/** Absolute for site-relative logos, left alone when already absolute. */
function absolute(logo: string): string {
  const clean = logo.split("?")[0];
  return clean.startsWith("http") ? clean : `${SITE}${clean}`;
}

/**
 * A logo that survives both GitHub themes.
 *
 * A README is rendered in the reader's own theme, so a single dark-on-
 * transparent logo disappears for everyone using dark mode, which is most
 * people on GitHub. Where a sponsor has a light variant, `<picture>` with
 * prefers-color-scheme picks it; GitHub honours this. The `<img>` inside stays
 * the fallback for anything that does not, including the plain-text view.
 */
function logoTag(s: Sponsor, height: number): string {
  const light = absolute(s.logo);
  const img = `<img src="${light}" alt="${s.name}" height="${height}">`;
  if (!s.darkLogo) return img;
  return (
    `<picture>` +
    `<source media="(prefers-color-scheme: dark)" srcset="${absolute(s.darkLogo)}">` +
    img +
    `</picture>`
  );
}

/**
 * A table rather than raw <img> tags: GitHub strips most styling, and a table
 * degrades to something readable in a plain-text view of the file. Logos vary
 * wildly in aspect ratio, so height is fixed and width left to the image.
 */
function render(): string {
  const featured = sponsors.filter((s) => s.featured);
  const rest = sponsors.filter((s) => !s.featured);

  const lines: string[] = [START, ""];
  lines.push(
    "DevOps Daily is kept free by its sponsors. If your company wants to reach",
    "engineers who choose tools, [see the sponsorship page](" + SITE + "/sponsorship).",
    "",
  );

  for (const s of featured) {
    lines.push(
      `### [${s.name}](${s.url})`,
      "",
      `<a href="${s.url}">${logoTag(s, 44)}</a>`,
      "",
      s.description ?? s.tagline ?? "",
      "",
    );
  }

  if (rest.length) {
    if (featured.length) lines.push("### Also sponsored by", "");
    // A single row keeps the logos on one line on a wide screen and wraps
    // sensibly on a narrow one.
    lines.push(
      "| " + rest.map((s) => `[${s.name}](${s.url})`).join(" | ") + " |",
      "|" + rest.map(() => ":--:").join("|") + "|",
      "| " +
        rest
          .map((s) => `<a href="${s.url}">${logoTag(s, 28)}</a>`)
          .join(" | ") +
        " |",
      "",
    );
    for (const s of rest) {
      if (s.tagline) lines.push(`- **[${s.name}](${s.url})**: ${s.tagline}`);
    }
    lines.push("");
  }

  lines.push(END);
  return lines.join("\n");
}

function main() {
  const check = process.argv.includes("--check");
  const readme = readFileSync(README, "utf8");

  const from = readme.indexOf(START);
  const to = readme.indexOf(END);
  if (from === -1 || to === -1) {
    console.error(
      `${README} has no ${START} / ${END} markers, so there is nowhere to write the sponsor block.`,
    );
    process.exit(2);
  }

  const next = readme.slice(0, from) + render() + readme.slice(to + END.length);

  if (next === readme) {
    console.log(`README sponsors are up to date (${sponsors.length} sponsors).`);
    return;
  }

  if (check) {
    console.error(
      "README sponsor block is out of date with lib/sponsors.ts.\n" +
        "Run: pnpm generate:readme-sponsors",
    );
    process.exit(1);
  }

  writeFileSync(README, next);
  console.log(`README sponsors rewritten (${sponsors.length} sponsors).`);
}

main();
