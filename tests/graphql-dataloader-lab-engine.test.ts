import { describe, expect, it } from 'vitest';
import {
  COMMENTS,
  DEFAULT_CONFIG,
  POSTS,
  USERS,
  emptyLoaderCache,
  missionPassed,
  runQuery,
  type RunConfig,
} from '@/lib/games/graphql-dataloader-lab-engine';

function config(overrides: Partial<RunConfig> = {}): RunConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    fields: { ...DEFAULT_CONFIG.fields, ...overrides.fields },
  };
}

describe('GraphQL N+1 and DataLoader Lab engine', () => {
  it('models the fixed blog data and resolver levels', () => {
    const run = runQuery(
      config({ fields: { ...DEFAULT_CONFIG.fields, comments: true, commentAuthors: true } })
    );
    expect(POSTS).toHaveLength(10);
    expect(new Set(POSTS.map((post) => post.authorId)).size).toBe(4);
    expect(COMMENTS).toHaveLength(30);
    expect(USERS).toHaveLength(6);
    expect(run.steps.find((step) => step.id === 'authors')).toMatchObject({
      tick: 2,
      resolverCalls: 10,
    });
    expect(run.steps.find((step) => step.id === 'comments')).toMatchObject({
      tick: 3,
      resolverCalls: 10,
    });
    expect(run.steps.find((step) => step.id === 'comment-authors')).toMatchObject({
      tick: 4,
      resolverCalls: 30,
    });
  });

  it('counts naive posts and authors as eleven queries', () => {
    const run = runQuery(config());
    expect(run.queryCount).toBe(11);
    expect(run.queries[0].sql).toBe('SELECT * FROM posts LIMIT 10');
    expect(run.postAuthorQueryCount).toBe(10);
    expect(
      run.queries.slice(1).every((query) => query.sql === 'SELECT * FROM users WHERE id = $1')
    ).toBe(true);
  });

  it('counts naive nested posts, authors, comments and comment authors as fifty-one queries', () => {
    const run = runQuery(
      config({ fields: { ...DEFAULT_CONFIG.fields, comments: true, commentAuthors: true } })
    );
    expect(run.queryCount).toBe(51);
    expect(run.postAuthorQueryCount).toBe(10);
    expect(run.commentsQueryCount).toBe(10);
    expect(run.commentAuthorQueryCount).toBe(30);
  });

  it('coalesces same-tick user loads, deduplicates keys, and keeps requested-key order', () => {
    const run = runQuery(config({ userLoader: true }));
    const batch = run.batches[0];
    expect(batch).toMatchObject({
      loader: 'users',
      tick: 2,
      requestedKeys: POSTS.map((post) => post.authorId),
    });
    expect(batch.uniqueKeys).toEqual([1, 2, 3, 4]);
    expect(batch.loadedKeys).toEqual([1, 2, 3, 4]);
    expect(batch.sql).toBe('SELECT * FROM users WHERE id IN ($1, $2, $3, $4)');
    expect(run.postAuthorQueryCount).toBe(1);
    expect(run.responseUsers.map((user) => user.id)).toEqual(POSTS.map((post) => post.authorId));
  });

  it('uses four queries with per-request user and comments loaders for every field', () => {
    const run = runQuery(
      config({
        fields: { ...DEFAULT_CONFIG.fields, comments: true, commentAuthors: true },
        userLoader: true,
        commentsLoader: true,
      })
    );
    expect(run.queryCount).toBe(4);
    expect(run.postAuthorQueryCount).toBe(1);
    expect(run.commentsQueryCount).toBe(1);
    expect(run.commentAuthorQueryCount).toBe(1);
    expect(run.steps.find((step) => step.id === 'comment-authors')?.batches[0].loadedKeys).toEqual([
      5, 6,
    ]);
  });

  it('shows the cross-request email leak only when a user loader is shared', () => {
    const shared = config({ userLoader: true, loaderScope: 'shared' });
    const ada = runQuery(shared, emptyLoaderCache());
    const boShared = runQuery({ ...shared, viewer: 'bo' }, ada.nextSharedCache);
    const boPerRequest = runQuery(
      { ...shared, viewer: 'bo', loaderScope: 'per-request' },
      boShared.nextSharedCache
    );
    expect(ada.observedEmails).toContain(USERS[0].email);
    expect(boShared.observedEmails).toContain(USERS[0].email);
    expect(boPerRequest.observedEmails).not.toContain(USERS[0].email);
    expect(boPerRequest.responseUsers.find((user) => user.id === USERS[0].id)?.email).toBeNull();
  });

  it('marks the six missions only after their required runs', () => {
    const naivePosts = runQuery(config());
    const naiveAll = runQuery(
      config({ fields: { ...DEFAULT_CONFIG.fields, comments: true, commentAuthors: true } })
    );
    const userBatch = runQuery(config({ userLoader: true }));
    const four = runQuery(
      config({
        fields: { ...DEFAULT_CONFIG.fields, comments: true, commentAuthors: true },
        userLoader: true,
        commentsLoader: true,
      })
    );
    const sharedAda = runQuery(config({ userLoader: true, loaderScope: 'shared' }));
    const sharedBo = runQuery(
      config({ viewer: 'bo', userLoader: true, loaderScope: 'shared' }),
      sharedAda.nextSharedCache
    );
    const fixed = runQuery(config({ viewer: 'bo', userLoader: true }));
    const runs = [naivePosts, naiveAll, userBatch, four, sharedAda, sharedBo, fixed];
    expect(missionPassed('n-plus-one', { runs })).toBe(true);
    expect(missionPassed('fifty-one', { runs })).toBe(true);
    expect(missionPassed('user-loader', { runs })).toBe(true);
    expect(missionPassed('four', { runs })).toBe(true);
    expect(missionPassed('leak', { runs })).toBe(true);
    expect(missionPassed('per-request', { runs })).toBe(true);
  });
});
