import { describe, expect, it } from 'vitest';
import { contentPathToUrl, contentPathsToUrls } from '../content-path-to-url';

const files: Record<string, string> = {
  'content/interview-questions/otel-context-propagation.json': JSON.stringify({
    slug: 'otel-context-propagation',
    tier: 'senior',
  }),
  'content/interview-questions/broken.json': '{ not json',
};
const readFile = (path: string) => files[path] ?? null;

describe('contentPathToUrl', () => {
  it('maps posts, newsletters and advent days by file name', () => {
    expect(contentPathToUrl('content/posts/my-post.md')).toBe('/posts/my-post');
    expect(contentPathToUrl('content/newsletters/2026-week-16.md')).toBe('/newsletters/2026-week-16');
    expect(contentPathToUrl('content/advent-of-devops/day-17.md')).toBe('/advent-of-devops/day-17');
  });

  it('maps a news digest to its year-week slug', () => {
    expect(contentPathToUrl('content/news/2026/week-36.md')).toBe('/news/2026-week-36');
    expect(contentPathToUrl('content/news/2026/week-07.md')).toBe('/news/2026-week-7');
  });

  it('maps guide index and part files to their own routes', () => {
    expect(contentPathToUrl('content/guides/introduction-to-ansible/index.md')).toBe(
      '/guides/introduction-to-ansible'
    );
    expect(contentPathToUrl('content/guides/introduction-to-ansible/02-inventory.md')).toBe(
      '/guides/introduction-to-ansible/02-inventory'
    );
  });

  it('strips the json extension from json-backed content', () => {
    expect(contentPathToUrl('content/comparisons/ansible-vs-chef.json')).toBe('/comparisons/ansible-vs-chef');
    expect(contentPathToUrl('content/exercises/terraform-aws-vpc.json')).toBe('/exercises/terraform-aws-vpc');
    expect(contentPathToUrl('content/quizzes/a-quiz.json')).toBe('/quizzes/a-quiz');
    expect(contentPathToUrl('content/flashcards/terraform-basics.json')).toBe('/flashcards/terraform-basics');
    expect(contentPathToUrl('content/checklists/kubernetes-security.json')).toBe('/checklists/kubernetes-security');
  });

  it('reads the tier of an interview question from the file', () => {
    expect(
      contentPathToUrl('content/interview-questions/otel-context-propagation.json', { readFile })
    ).toBe('/interview-questions/senior/otel-context-propagation');
    expect(contentPathToUrl('content/interview-questions/broken.json', { readFile })).toBeNull();
    expect(contentPathToUrl('content/interview-questions/missing.json', { readFile })).toBeNull();
  });

  it('ignores files that have no page of their own', () => {
    expect(contentPathToUrl('content/categories/cloud.md')).toBeNull();
    expect(contentPathToUrl('content/interview-questions/index.ts')).toBeNull();
    expect(contentPathToUrl('scripts/devops-daily/data/sources.yaml')).toBeNull();
    expect(contentPathToUrl('content/posts/nested/x.md')).toBeNull();
  });

  it('deduplicates and drops unmapped paths in bulk', () => {
    expect(
      contentPathsToUrls([
        'content/posts/a.md',
        'content/categories/cloud.md',
        'content/posts/a.md',
        'content/news/2026/week-1.md',
      ])
    ).toEqual(['/posts/a', '/news/2026-week-1']);
  });
});
