import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAllTopics, interviewQuestions } from '@/content/interview-questions';
import {
  applyInterviewRedirects,
  interviewRedirectLine,
  isInterviewQuestionRedirect,
} from '../scripts/interview-redirects';

const FIX = 'Run: npx tsx scripts/interview-redirects.ts';

const redirects = readFileSync('public/_redirects', 'utf8');
const rules = redirects
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));
const questionRules = rules.filter(isInterviewQuestionRedirect);

describe('interview question redirects', () => {
  it('has exactly one redirect for every question, to its topic page', () => {
    const problems = interviewQuestions.flatMap((q) => {
      const source = `/interview-questions/${q.tier}/${q.slug}`;
      const matching = rules.filter((rule) => rule.split(/\s+/)[0] === source);
      return matching.length === 1 && matching[0] === interviewRedirectLine(q)
        ? []
        : [`${source}: ${matching.length} rule(s) ${JSON.stringify(matching)}`];
    });
    expect(problems, FIX).toEqual([]);
    expect(questionRules, FIX).toHaveLength(interviewQuestions.length);
  });

  it('sends every redirect to a topic that exists and a question on it', () => {
    const topics = new Set(getAllTopics().map((t) => t.slug));
    const bad = questionRules.filter((rule) => {
      const [, target, status] = rule.split(/\s+/);
      const match = target.match(/^\/interview-questions\/topic\/([^#/]+)#(.+)$/);
      if (!match || status !== '301' || !topics.has(match[1])) return true;
      const question = interviewQuestions.find((q) => q.slug === match[2]);
      return !question || interviewRedirectLine(question) !== rule;
    });
    expect(bad).toEqual([]);
  });

  it('keeps public/_redirects in the form the script writes', () => {
    expect(applyInterviewRedirects(redirects, interviewQuestions), FIX).toBe(redirects);
  });

  it('no longer builds a page per question', () => {
    expect(existsSync('app/interview-questions/[tier]/[slug]')).toBe(false);
  });
});
