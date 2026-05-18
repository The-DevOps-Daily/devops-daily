// Auto-discovers every `*.json` file in this directory at build time.
//
// Why this is a `readdir` of JSON files instead of a hand-curated list of
// `import x from './x.json'` lines:
//
// 1) The static-import pattern silently dropped every new question that
//    content-pipeline generated, because the cron writes the JSON file
//    but does not edit this file. Five GitOps/Argo CD questions sat
//    unused for weeks before anyone noticed. Auto-discovery removes that
//    failure mode.
// 2) The other content types (quizzes, flashcards, checklists) already
//    use this exact pattern. This brings interview questions in line.
// 3) Next.js builds statically (`output: 'export'`), so this module runs
//    once on Node at build time. `readdirSync` + `readFileSync` are
//    available and the cost is paid once.
import fs from 'fs';
import path from 'path';
import type { InterviewQuestion, ExperienceTier } from '@/lib/interview-utils';

const TIER_ORDER: Record<ExperienceTier, number> = {
  junior: 0,
  mid: 1,
  senior: 2,
};

function loadAll(): InterviewQuestion[] {
  const dir = path.join(process.cwd(), 'content', 'interview-questions');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const out: InterviewQuestion[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    out.push(JSON.parse(raw) as InterviewQuestion);
  }

  // Stable ordering: tier first (junior > mid > senior), then alphabetic
  // by slug within a tier. Pages that filter by tier don't care, but a
  // consistent global order keeps the listing page and the llms.txt
  // export deterministic across builds.
  return out.sort((a, b) => {
    const tierDelta =
      (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99);
    if (tierDelta !== 0) return tierDelta;
    return a.slug.localeCompare(b.slug);
  });
}

export const interviewQuestions: InterviewQuestion[] = loadAll();

export const getQuestionBySlug = (slug: string): InterviewQuestion | undefined => {
  return interviewQuestions.find(q => q.slug === slug);
};

export const getQuestionsByCategory = (category: string): InterviewQuestion[] => {
  return interviewQuestions.filter(q => q.category === category);
};

export const getQuestionsByDifficulty = (difficulty: string): InterviewQuestion[] => {
  return interviewQuestions.filter(q => q.difficulty === difficulty);
};

export const getQuestionsByTier = (tier: ExperienceTier): InterviewQuestion[] => {
  return interviewQuestions.filter(q => q.tier === tier);
};

export const getQuestionCountsByTier = (): Record<ExperienceTier, number> => {
  return {
    junior: interviewQuestions.filter(q => q.tier === 'junior').length,
    mid: interviewQuestions.filter(q => q.tier === 'mid').length,
    senior: interviewQuestions.filter(q => q.tier === 'senior').length,
  };
};

export const getQuestionsByTag = (tag: string): InterviewQuestion[] => {
  return interviewQuestions.filter(q => q.tags.includes(tag));
};

export const getAllCategories = (): string[] => {
  return Array.from(new Set(interviewQuestions.map(q => q.category))).sort();
};

export const getAllTags = (): string[] => {
  const tags = interviewQuestions.flatMap(q => q.tags);
  return Array.from(new Set(tags)).sort();
};

export const getAllTiers = (): ExperienceTier[] => {
  return ['junior', 'mid', 'senior'];
};
