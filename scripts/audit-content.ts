#!/usr/bin/env node

/**
 * Audit content files for structural issues.
 *
 * Checks posts (frontmatter fields, code blocks), quizzes (totalPoints,
 * difficulty counts, correctAnswer), exercises (required fields, categories),
 * and guides (index.md, part ordering).
 *
 * Usage:
 *   npx tsx scripts/audit-content.ts                # audit everything
 *   npx tsx scripts/audit-content.ts --type quizzes  # audit only quizzes
 *   npx tsx scripts/audit-content.ts --json          # JSON output for agents
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const CONTENT_DIR = join(process.cwd(), 'content');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

type Severity = 'critical' | 'warning' | 'info';

interface Issue {
  file: string;
  severity: Severity;
  message: string;
}

interface AuditReport {
  postsScanned: number;
  quizzesScanned: number;
  exercisesScanned: number;
  guidesScanned: number;
  issues: Issue[];
}

const VALID_CATEGORIES = readdirSync(join(CONTENT_DIR, 'categories'))
  .filter(f => f.endsWith('.md'))
  .map(f => f.replace('.md', ''));

// ── Post Auditing ──

function parseFrontmatter(content: string): Record<string, any> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const fm: Record<string, any> = {};
  const lines = match[1].split('\n');
  let currentKey = '';
  let inArray = false;

  for (const line of lines) {
    if (line.match(/^\w[\w\s]*:/)) {
      const [key, ...rest] = line.split(':');
      currentKey = key.trim();
      const value = rest.join(':').trim();
      if (value) {
        fm[currentKey] = value.replace(/^['"]|['"]$/g, '');
      }
      inArray = false;
    } else if (line.match(/^\s+-\s/)) {
      if (!fm[currentKey]) fm[currentKey] = [];
      if (Array.isArray(fm[currentKey])) {
        fm[currentKey].push(line.replace(/^\s+-\s/, '').trim());
      }
    } else if (line.match(/^\s+\w+:/)) {
      // Nested object (category, author)
      if (!fm[currentKey] || typeof fm[currentKey] === 'string') {
        fm[currentKey] = {};
      }
      const [subKey, ...subRest] = line.trim().split(':');
      fm[currentKey][subKey.trim()] = subRest.join(':').trim().replace(/^['"]|['"]$/g, '');
    }
  }

  return fm;
}

function auditPosts(): { count: number; issues: Issue[] } {
  const dir = join(CONTENT_DIR, 'posts');
  const files = readdirSync(dir).filter(f => f.endsWith('.md'));
  const issues: Issue[] = [];

  const requiredFields = ['title', 'excerpt', 'category', 'date', 'publishedAt', 'author', 'tags'];

  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf-8');
    const fm = parseFrontmatter(content);
    const path = `content/posts/${file}`;

    if (!fm) {
      issues.push({ file: path, severity: 'critical', message: 'Missing or invalid frontmatter' });
      continue;
    }

    // Check required fields
    for (const field of requiredFields) {
      if (!fm[field]) {
        issues.push({ file: path, severity: 'critical', message: `Missing frontmatter field: ${field}` });
      }
    }

    // Check category slug is valid
    if (fm.category && typeof fm.category === 'object' && fm.category.slug) {
      if (!VALID_CATEGORIES.includes(fm.category.slug)) {
        issues.push({ file: path, severity: 'critical', message: `Invalid category slug: ${fm.category.slug}` });
      }
    }

    // Check tags count
    if (Array.isArray(fm.tags)) {
      if (fm.tags.length < 3) {
        issues.push({ file: path, severity: 'warning', message: `Only ${fm.tags.length} tags (recommend 3-8)` });
      }
    }

    // Check for unlabeled code blocks
    const body = content.split('---').slice(2).join('---');
    const codeOpens = body.match(/^```(.*)$/gm) || [];
    let inBlock = false;
    for (const line of codeOpens) {
      if (!inBlock) {
        const lang = line.slice(3).trim();
        if (!lang) {
          issues.push({ file: path, severity: 'warning', message: 'Code block without language identifier' });
          break; // Only report once per file
        }
        inBlock = true;
      } else {
        inBlock = false;
      }
    }
  }

  return { count: files.length, issues };
}

// ── Quiz Auditing ──

function auditQuizzes(): { count: number; issues: Issue[] } {
  const dir = join(CONTENT_DIR, 'quizzes');
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  const issues: Issue[] = [];

  for (const file of files) {
    const path = `content/quizzes/${file}`;
    let data: any;

    try {
      data = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
    } catch {
      issues.push({ file: path, severity: 'critical', message: 'Invalid JSON' });
      continue;
    }

    const questions = data.questions || [];

    // totalPoints check
    const actualTotal = questions.reduce((sum: number, q: any) => sum + (q.points || 0), 0);
    if (data.totalPoints !== actualTotal) {
      issues.push({ file: path, severity: 'critical', message: `totalPoints mismatch: declared ${data.totalPoints}, actual ${actualTotal}` });
    }

    // correctAnswer check
    for (const q of questions) {
      const optionCount = (q.options || []).length;
      if (q.correctAnswer < 0 || q.correctAnswer >= optionCount) {
        issues.push({ file: path, severity: 'critical', message: `Question "${q.id}": correctAnswer ${q.correctAnswer} out of range (${optionCount} options)` });
      }
    }

    // Duplicate IDs
    const ids = questions.map((q: any) => q.id);
    const dupes = ids.filter((id: string, i: number) => ids.indexOf(id) !== i);
    if (dupes.length > 0) {
      issues.push({ file: path, severity: 'critical', message: `Duplicate question IDs: ${[...new Set(dupes)].join(', ')}` });
    }

    // Short explanations
    const shortExplanations = questions.filter((q: any) => !q.explanation || q.explanation.length < 50);
    if (shortExplanations.length > 0) {
      issues.push({ file: path, severity: 'warning', message: `${shortExplanations.length} questions with short explanations (<50 chars)` });
    }

    // Question count
    if (questions.length < 10) {
      issues.push({ file: path, severity: 'warning', message: `Only ${questions.length} questions (recommend 10+)` });
    }
  }

  return { count: files.length, issues };
}

// ── Exercise Auditing ──

function auditExercises(): { count: number; issues: Issue[] } {
  const dir = join(CONTENT_DIR, 'exercises');
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  const issues: Issue[] = [];

  for (const file of files) {
    const path = `content/exercises/${file}`;
    let data: any;

    try {
      data = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
    } catch {
      issues.push({ file: path, severity: 'critical', message: 'Invalid JSON' });
      continue;
    }

    // Category check
    if (data.category?.slug && !VALID_CATEGORIES.includes(data.category.slug)) {
      issues.push({ file: path, severity: 'critical', message: `Invalid category slug: ${data.category.slug}` });
    }

    // Steps required fields
    for (const step of (data.steps || [])) {
      if (!step.id || !step.title || !step.description) {
        issues.push({ file: path, severity: 'critical', message: `Step missing required field (id/title/description)` });
        break;
      }
    }

    // Troubleshooting count
    const tsCount = (data.troubleshooting || []).length;
    if (tsCount < 3) {
      issues.push({ file: path, severity: 'warning', message: `Only ${tsCount} troubleshooting items (recommend 3+)` });
    }

    // Completion criteria count
    const ccCount = (data.completionCriteria || []).length;
    if (ccCount < 3) {
      issues.push({ file: path, severity: 'warning', message: `Only ${ccCount} completion criteria (recommend 3+)` });
    }
  }

  return { count: files.length, issues };
}

// ── Guide Auditing ──

function auditGuides(): { count: number; issues: Issue[] } {
  const dir = join(CONTENT_DIR, 'guides');
  const guideDirs = readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  const issues: Issue[] = [];

  for (const guideDir of guideDirs) {
    const guidePath = join(dir, guideDir);
    const path = `content/guides/${guideDir}`;

    // Check index.md exists
    if (!existsSync(join(guidePath, 'index.md'))) {
      issues.push({ file: path, severity: 'critical', message: 'Missing index.md' });
      continue;
    }

    // Check index.md frontmatter
    const indexContent = readFileSync(join(guidePath, 'index.md'), 'utf-8');
    const fm = parseFrontmatter(indexContent);
    if (!fm || !fm.title) {
      issues.push({ file: `${path}/index.md`, severity: 'critical', message: 'Missing or invalid frontmatter in index.md' });
    }

    // Check parts have order field
    const parts = readdirSync(guidePath)
      .filter(f => f !== 'index.md' && f.endsWith('.md'))
      .sort();

    for (const part of parts) {
      const partContent = readFileSync(join(guidePath, part), 'utf-8');
      const partFm = parseFrontmatter(partContent);
      if (!partFm || !partFm.order) {
        issues.push({ file: `${path}/${part}`, severity: 'warning', message: 'Missing order field in frontmatter' });
      }
    }
  }

  return { count: guideDirs.length, issues };
}

// ── Main ──

function run() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const typeIdx = args.indexOf('--type');
  const typeFilter = typeIdx !== -1 ? args[typeIdx + 1] : undefined;

  const report: AuditReport = {
    postsScanned: 0,
    quizzesScanned: 0,
    exercisesScanned: 0,
    guidesScanned: 0,
    issues: [],
  };

  if (!typeFilter || typeFilter === 'posts') {
    const r = auditPosts();
    report.postsScanned = r.count;
    report.issues.push(...r.issues);
  }
  if (!typeFilter || typeFilter === 'quizzes') {
    const r = auditQuizzes();
    report.quizzesScanned = r.count;
    report.issues.push(...r.issues);
  }
  if (!typeFilter || typeFilter === 'exercises') {
    const r = auditExercises();
    report.exercisesScanned = r.count;
    report.issues.push(...r.issues);
  }
  if (!typeFilter || typeFilter === 'guides') {
    const r = auditGuides();
    report.guidesScanned = r.count;
    report.issues.push(...r.issues);
  }

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }

  const criticalCount = report.issues.filter(i => i.severity === 'critical').length;
  process.exit(criticalCount > 0 ? 1 : 0);
}

function printHumanReport(report: AuditReport) {
  const critical = report.issues.filter(i => i.severity === 'critical');
  const warnings = report.issues.filter(i => i.severity === 'warning');

  console.log(`\n${BOLD}Content Audit Report${RESET}\n`);
  console.log(`  Posts:     ${report.postsScanned}`);
  console.log(`  Quizzes:   ${report.quizzesScanned}`);
  console.log(`  Exercises: ${report.exercisesScanned}`);
  console.log(`  Guides:    ${report.guidesScanned}`);
  console.log(`  Issues:    ${critical.length} critical, ${warnings.length} warnings\n`);

  if (critical.length > 0) {
    console.log(`${RED}${BOLD}Critical Issues (${critical.length}):${RESET}`);
    for (const issue of critical) {
      console.log(`  ${RED}✗${RESET} ${issue.file}: ${issue.message}`);
    }
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`${YELLOW}${BOLD}Warnings (${warnings.length}):${RESET}`);
    for (const issue of warnings) {
      console.log(`  ${YELLOW}○${RESET} ${issue.file}: ${issue.message}`);
    }
    console.log();
  }

  if (critical.length === 0 && warnings.length === 0) {
    console.log(`${GREEN}✓ No issues found.${RESET}\n`);
  }
}

run();
