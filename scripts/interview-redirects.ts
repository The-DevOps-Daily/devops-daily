#!/usr/bin/env tsx
/**
 * Writes one 301 per interview question to public/_redirects. The questions
 * used to have pages of their own; they now live on their topic page:
 *
 *   /interview-questions/<tier>/<slug> /interview-questions/topic/<topic>#<slug> 301
 *
 * Usage: npx tsx scripts/interview-redirects.ts
 * Run it again after adding a question or changing a question's category.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tagToSlug } from '../lib/tag-utils';
import { insertStaticRedirects } from './redirects-order';

export const INTERVIEW_REDIRECTS_HEADER =
  '# Single interview question pages merged into their topic pages (Nov 2026)';

const TIER_ORDER = ['junior', 'mid', 'senior'];
const SOURCE = /^\/interview-questions\/(junior|mid|senior)\/[^/\s]+$/;

export interface QuestionRef {
  slug: string;
  tier: string;
  category: string;
}

export function interviewRedirectLine({ slug, tier, category }: QuestionRef): string {
  return `/interview-questions/${tier}/${slug} /interview-questions/topic/${tagToSlug(category)}#${slug} 301`;
}

export function isInterviewQuestionRedirect(line: string): boolean {
  return SOURCE.test(line.trim().split(/\s+/)[0] ?? '');
}

/** Replaces the block of question redirects, or adds it above the dynamic rules. */
export function applyInterviewRedirects(current: string, questions: QuestionRef[]): string {
  const lines = current.split('\n');
  const kept = lines.filter((line, index) => {
    if (isInterviewQuestionRedirect(line) || line.trim() === INTERVIEW_REDIRECTS_HEADER) {
      return false;
    }
    return !(line.trim() === '' && lines[index + 1]?.trim() === INTERVIEW_REDIRECTS_HEADER);
  });
  const sorted = [...questions].sort(
    (a, b) =>
      TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || a.slug.localeCompare(b.slug)
  );
  return insertStaticRedirects(kept.join('\n'), [
    '',
    INTERVIEW_REDIRECTS_HEADER,
    ...sorted.map(interviewRedirectLine),
  ]);
}

export function loadQuestionRefs(dir = join(process.cwd(), 'content', 'interview-questions')) {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')) as QuestionRef);
}

const isMain =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const redirectsPath = join(process.cwd(), 'public', '_redirects');
  const questions = loadQuestionRefs();
  writeFileSync(
    redirectsPath,
    applyInterviewRedirects(readFileSync(redirectsPath, 'utf8'), questions)
  );
  console.log(`Wrote ${questions.length} interview question redirects to public/_redirects.`);
}
