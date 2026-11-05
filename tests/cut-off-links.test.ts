import { describe, expect, it } from 'vitest';
import { cutOffPrefix, matchCutOffPath } from '@/lib/cut-off-links';

const URLS = [
  '/posts/how-much-memory-does-a-ci-build-need',
  '/posts/terraform-state-remove-move-migrate-backend',
  '/posts/terraform-state-locking',
  '/posts/terraform-state',
  '/guides/introduction-to-docker',
  '/guides/introduction-to-docker/03-working-with-docker-images',
  '/games/incident-commander-simulator',
  '/comparisons/github-actions-vs-gitlab-ci',
  '/quizzes/terraform-state-quiz',
];

describe('cutOffPrefix', () => {
  it('removes trailing dots, an ellipsis in either form, and dashes', () => {
    expect(cutOffPrefix('/posts/how-much-memory-does-a-c...')?.prefix).toBe(
      'how-much-memory-does-a-c'
    );
    expect(cutOffPrefix('/posts/how-much-memory-does-a-c…')?.prefix).toBe(
      'how-much-memory-does-a-c'
    );
    expect(cutOffPrefix('/posts/how-much-memory-does-a-c%E2%80%A6')?.prefix).toBe(
      'how-much-memory-does-a-c'
    );
    expect(cutOffPrefix('/posts/how-much-memory-does-a-')?.prefix).toBe('how-much-memory-does-a');
    expect(cutOffPrefix('/posts/how-much-memory-does-a-...')?.prefix).toBe(
      'how-much-memory-does-a'
    );
  });

  it('needs at least 12 characters after the cleanup', () => {
    expect(cutOffPrefix('/posts/terra...')).toBeNull();
    expect(cutOffPrefix('/posts/null')).toBeNull();
    expect(cutOffPrefix('/posts/terraform-st')).toEqual({
      section: 'posts',
      prefix: 'terraform-st',
    });
  });

  it('only looks at one slug in the four sections', () => {
    expect(cutOffPrefix('/quizzes/terraform-state-q...')).toBeNull();
    expect(cutOffPrefix('/tags/infrastructure-as-...')).toBeNull();
    expect(cutOffPrefix('/guides/introduction-to-docker/03-working...')).toBeNull();
    expect(cutOffPrefix('/posts/')).toBeNull();
  });
});

describe('matchCutOffPath', () => {
  it('returns the one page whose slug starts with what is left', () => {
    expect(matchCutOffPath('/posts/how-much-memory-does-a-c...', URLS)).toEqual([
      '/posts/how-much-memory-does-a-ci-build-need',
    ]);
    expect(matchCutOffPath('/games/incident-commander', URLS)).toEqual([
      '/games/incident-commander-simulator',
    ]);
    expect(matchCutOffPath('/posts/HOW-MUCH-MEMORY-DOES…', URLS)).toEqual([
      '/posts/how-much-memory-does-a-ci-build-need',
    ]);
  });

  it('returns every match, an exact slug first, when the start is shared', () => {
    expect(matchCutOffPath('/posts/terraform-state-...', URLS)).toEqual([
      '/posts/terraform-state',
      '/posts/terraform-state-remove-move-migrate-backend',
      '/posts/terraform-state-locking',
    ]);
  });

  it('stays in the section and skips nested pages', () => {
    expect(matchCutOffPath('/guides/introduction-to-do...', URLS)).toEqual([
      '/guides/introduction-to-docker',
    ]);
    expect(matchCutOffPath('/comparisons/terraform-state...', URLS)).toEqual([]);
  });

  it('never sends the reader back to the path they are on', () => {
    expect(matchCutOffPath('/posts/terraform-state', ['/posts/terraform-state'])).toEqual([]);
  });
});
