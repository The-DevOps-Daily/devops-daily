# Link Checker Agent

Check internal links in DevOps Daily content and plan fixes for missing links.

This agent uses `scripts/check-internal-links.ts` for the scanning (fast, zero tokens wasted on file reads) and focuses its reasoning on interpreting results and planning edits.

## Step 1: Run the script

Run the internal link checker script. Pass `--json` for machine-readable output.

```bash
npx tsx scripts/check-internal-links.ts --json
```

Filter by category or content type if the user specified one:
```bash
npx tsx scripts/check-internal-links.ts --category docker --json
npx tsx scripts/check-internal-links.ts --type guides --json
```

The script outputs a JSON report with:
- `filesScanned` — how many files were checked
- `totalLinksChecked` — how many internal links were found
- `brokenLinkCount` — how many point to non-existent content
- `zeroLinkFileCount` — how many files have no internal links at all
- `files[]` — per-file details with broken links and suggestions

## Step 2: Interpret the results

Read the JSON output and provide a summary:
- How many files have broken links (and what the suggested fixes are)
- How many files have zero internal links (this is the SEO gap)
- Which files are highest priority to fix (popular topics, cornerstone content)

## Step 3: Plan fixes (if the user wants them)

If the user asks you to fix the issues:
- For broken links: suggest the correct target using the script's suggestions
- For zero-link files: propose contextually relevant links by searching for related content across posts, guides, exercises, quizzes, flashcards, checklists
- Include links to `/roadmap`, `/books/devops-survival-guide`, and relevant quizzes/flashcards where appropriate

The agent's value is in the **reasoning about what to link where** — the script handles the grunt work of checking 800+ files.

## Available script flags

| Flag | Description | Example |
|------|-------------|---------|
| `--json` | JSON output for agent consumption | `--json` |
| `--category <name>` | Filter files by category/filename match | `--category kubernetes` |
| `--type <type>` | Content type to scan (posts, guides) | `--type guides` |
