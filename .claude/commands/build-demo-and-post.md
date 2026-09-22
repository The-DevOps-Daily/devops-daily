# Build a demo repo and its companion post

Build a runnable demo repository and the DevOps Daily post that goes with it, for: $ARGUMENTS

This is the pair we ship most often. The repo is the evidence; the post is the argument. Neither is finished without the other, and the post must only claim what the repo actually measured.

## The order that works

1. Agree the claim, then build the thing that could disprove it
2. Run it and keep the output
3. Check the method before writing a word of prose
4. Create the repo, push, set the About section
5. Write the post from the recorded numbers
6. Codex second opinion
7. OG images, PR, merge, set the repo homepage to the live post URL

Do not write the post first and then build a demo that agrees with it.

## 1. The claim

Write down, in one sentence, what the reader should believe afterwards, and what result would prove it wrong. If no result could prove it wrong, it is not a claim and the post has nothing to measure.

Prefer a claim that can embarrass us. "Overall rankings are meaningless because each engine wins on a different query shape" is worth publishing. "Hybrid search is good" is not.

## 2. Build it

Put it in `~/projects/<repo-name>/`, not inside devops-daily.

Rules that have cost us before:

- **Never fabricate a measurement, a terminal session or a transcript.** If it was not run, it does not go in.
- **Seed anything random and use a sound generator.** The textbook LCG `seed * 1103515245 + 12345` overflows 2^53 in JavaScript floats and degrades; use mulberry32 with `Math.imul`.
- **One script per stage**, each writing its output to a file the next stage reads. A single do-everything script cannot be re-run from the middle when stage 4 is wrong.
- Include the script that **breaks** the thing, where that makes sense. `rls-multi-tenant-starter` ships a script that breaks the schema to prove the tests catch it, and that is the most convincing file in the repo.
- Anyone must be able to run it: a `.env.example`, exact versions, and a README that starts with the command.

## 3. Check the method before writing

This is where the real errors live. Every one of these has bitten a published draft:

- **Truncation.** A judge that silently cut inputs at 900 characters was scoring 52% of the pool on partial text, and fixing it flipped the headline.
- **Adding medians.** Two medians summed is not the median of the sum.
- **Sample size.** Run a power analysis. If 39 queries can only detect a gap of 0.096 and the gaps are 0.002 to 0.043, the honest result is "cannot tell", and that is publishable.
- **Comparing a checked number to an unchecked one.** If you hand-verified one side, hand-verify the other or disclose the asymmetry in the post.
- **Missing cost.** Report the whole operation. Embedding a query is ~580ms, which dwarfed the retrieval it was being compared against, and most published benchmarks leave it out.

Re-read the recorded output and ask what a hostile reader would say. Then fix it before writing.

## 4. The repo

```bash
gh repo create The-DevOps-Daily/<name> --public --description "<one line>" --source . --push
```

Then set the About section, which is easy to forget and is the first thing a visitor reads:

```bash
gh repo edit The-DevOps-Daily/<name> \
  --description "<what it does and what it proves, one sentence>" \
  --add-topic <topic> --add-topic <topic>
```

- **Description**: what it does and what it proves. "Measure what happens to database connections when there is no long-lived process. Two scripts, real Neon Postgres, no simulation." Not "a demo of X".
- **Topics**: 6 to 12, lowercase, hyphenated. Include the technologies, the domain, and the technique, so it is findable three ways. Check a sibling repo for the house style.
- **Homepage**: set it to the published post URL once the post is live (step 7).
- **License**: MIT, unless there is a reason.
- **README** leads with the command to run it, then what each script does, then the result. Do not repeat the post in the README; link to it.

## 5. The post

Follow the `write-post` command for frontmatter, categories, and the ```chart / ```terminal / ```tabs / ```diagram / ```github fences. Beyond that:

- Open with the result, not the setup.
- Every number in the prose comes from a file in the repo. Quote real output in a ```terminal block; never invent a session.
- Include the ```github fence for the repo, once, where it matters.
- Say what you could **not** conclude. A post with no negative result reads like marketing.
- If a method bug was found and fixed while building, that story is usually the most useful section in the post.

## 6. Second opinion

```bash
codex exec "<review prompt>" 2>&1 | tail -40
```

Ask it to check the arithmetic and the fairness of the comparison specifically. It has caught a 170x that was really 98x, a per-year figure that was per-month, and three framing problems where our own product was flattered by the setup.

In a read-only review prompt, say: "do not run project scripts, tests or SQL; reading files with cat/rg/sed is fine".

## 7. Ship

```bash
npm run generate:images:parallel && npm run convert:svg-to-png:parallel
```

OG generation also prunes tracked SVGs and rewrites cache files, so commit the post first and the images second to keep the diff readable.

Open the PR against fresh main, keep the description short (the repo is public), and no AI-origin phrasing anywhere. After merge, set the repo homepage:

```bash
gh repo edit The-DevOps-Daily/<name> --homepage "https://devops-daily.com/posts/<slug>"
```

## If the topic came from the Neon board

The post **and** the demo repo must be Neon focused, not vendor-neutral with Neon mentioned once. That is the failure mode to avoid.
