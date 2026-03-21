# Content Auditor Agent

Audit DevOps Daily content for structural issues and plan fixes.

This agent uses `scripts/audit-content.ts` for automated checks (fast, zero tokens wasted on file reads) and focuses its reasoning on prioritizing issues and planning fixes.

## Step 1: Run the audit script

Run the content audit script. Pass `--json` for machine-readable output.

```bash
npx tsx scripts/audit-content.ts --json
```

Filter by content type if the user specified one:
```bash
npx tsx scripts/audit-content.ts --type quizzes --json
npx tsx scripts/audit-content.ts --type exercises --json
npx tsx scripts/audit-content.ts --type posts --json
npx tsx scripts/audit-content.ts --type guides --json
```

The script checks:

**Posts**: Required frontmatter fields (title, excerpt, category, date, publishedAt, author, tags), valid category slugs, tag count (3-8), code blocks with language identifiers

**Quizzes**: Valid JSON, totalPoints matches sum of question points, correctAnswer within range, duplicate question IDs, explanation length (50+ chars), question count (10+)

**Exercises**: Valid JSON, category slug validity, step required fields (id, title, description), troubleshooting count (3+), completionCriteria count (3+)

**Guides**: index.md exists, frontmatter valid, parts have order field

## Step 2: Interpret the results

Read the JSON output and provide a prioritized summary:
- **Critical issues** (broken rendering, wrong data) — these need fixing now
- **Warnings** (missing optional fields, low counts) — should fix when convenient
- Group issues by type, not by file (e.g., "13 quizzes have wrong totalPoints" not listing each file)

## Step 3: Fix issues (if the user wants them)

If the user asks you to fix:
- For totalPoints mismatches: calculate correct values and update JSON
- For invalid category slugs: map to closest valid category
- For missing frontmatter: add sensible defaults
- For code blocks without labels: identify the language and add it

The agent's value is in **prioritizing what matters** and **planning bulk fixes** — the script handles scanning hundreds of files instantly.

## Available script flags

| Flag | Description | Example |
|------|-------------|---------|
| `--json` | JSON output for agent consumption | `--json` |
| `--type <type>` | Audit only one content type | `--type quizzes` |
