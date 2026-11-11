// Pure execution model for the GraphQL N+1 and DataLoader Lab. The model keeps
// one request in one event-loop turn per resolver level, which makes the
// DataLoader batching boundary explicit and deterministic.

export type ViewerId = 'ada' | 'bo';
export type LoaderScope = 'per-request' | 'shared';
export type ExecutionStepId =
  'parse' | 'posts' | 'authors' | 'comments' | 'comment-authors' | 'response';

export interface User {
  id: number;
  viewer: ViewerId | null;
  name: string;
  email: string;
}

export interface Post {
  id: number;
  title: string;
  authorId: number;
}

export interface Comment {
  id: number;
  postId: number;
  authorId: number;
}

export interface QueryFields {
  postAuthors: boolean;
  comments: boolean;
  commentAuthors: boolean;
  userEmail: boolean;
}

export interface RunConfig {
  viewer: ViewerId;
  fields: QueryFields;
  userLoader: boolean;
  commentsLoader: boolean;
  loaderScope: LoaderScope;
}

export interface ResolvedUser {
  id: number;
  name: string;
  email: string | null;
}

export interface LoaderCache {
  users: Record<string, ResolvedUser>;
  comments: Record<string, true>;
}

export interface SqlQuery {
  sql: string;
  parameters: number[];
  tick: number;
  resolver: string;
}

export interface LoaderBatch {
  loader: 'users' | 'comments';
  tick: number;
  requestedKeys: number[];
  uniqueKeys: number[];
  loadedKeys: number[];
  cacheHits: number[];
  sql: string | null;
}

export interface ExecutionStep {
  id: ExecutionStepId;
  title: string;
  tick: number;
  resolverCalls: number;
  summary: string;
  sql: SqlQuery[];
  batches: LoaderBatch[];
}

export interface QueryRun {
  config: RunConfig;
  steps: ExecutionStep[];
  queries: SqlQuery[];
  batches: LoaderBatch[];
  queryCount: number;
  postAuthorQueryCount: number;
  commentsQueryCount: number;
  commentAuthorQueryCount: number;
  responseUsers: ResolvedUser[];
  observedEmails: string[];
  nextSharedCache: LoaderCache;
}

export interface MissionRunHistory {
  runs: QueryRun[];
}

export const LAB_COPY = {
  title: 'GraphQL N+1 and DataLoader Lab',
  readyHeading: 'Configure a GraphQL request',
  freePlayGoal: 'All missions are complete. Change a field or cache scope and explore the trace.',
  schema: {
    posts: 'Query.posts(first: 10): [Post]',
    postAuthor: 'Post.author: User',
    postComments: 'Post.comments: [Comment]',
    commentAuthor: 'Comment.author: User',
    userName: 'User.name',
    userEmail: 'User.email',
  },
  simplifiedModel:
    'A simplified model: each resolver level runs in one event-loop tick; real applications can add more work between loads.',
  awaitingNote:
    'Not modelled: awaiting between DataLoader loads splits them into separate batches.',
} as const;

export const USERS: User[] = [
  { id: 1, viewer: 'ada', name: 'Ada', email: 'ada@blog.example' },
  { id: 2, viewer: 'bo', name: 'Bo', email: 'bo@blog.example' },
  { id: 3, viewer: null, name: 'Cy', email: 'cy@blog.example' },
  { id: 4, viewer: null, name: 'Dee', email: 'dee@blog.example' },
  { id: 5, viewer: null, name: 'Eli', email: 'eli@blog.example' },
  { id: 6, viewer: null, name: 'Fay', email: 'fay@blog.example' },
];

export const POSTS: Post[] = [
  { id: 1, title: 'Tracing a deploy', authorId: 1 },
  { id: 2, title: 'Cache keys', authorId: 2 },
  { id: 3, title: 'Database pools', authorId: 3 },
  { id: 4, title: 'Reliable queues', authorId: 4 },
  { id: 5, title: 'Runbooks', authorId: 1 },
  { id: 6, title: 'Feature flags', authorId: 2 },
  { id: 7, title: 'Service ownership', authorId: 3 },
  { id: 8, title: 'Error budgets', authorId: 4 },
  { id: 9, title: 'Load shedding', authorId: 1 },
  { id: 10, title: 'Incident notes', authorId: 2 },
];

export const COMMENTS: Comment[] = POSTS.flatMap((post, index) => [
  { id: post.id * 10 + 1, postId: post.id, authorId: [2, 5, 6][index % 3] },
  { id: post.id * 10 + 2, postId: post.id, authorId: [3, 6, 5][index % 3] },
  { id: post.id * 10 + 3, postId: post.id, authorId: [4, 5, 6][index % 3] },
]);

export const EXECUTION_STEPS: Array<{ id: ExecutionStepId; title: string; tick: number }> = [
  { id: 'parse', title: 'Parse', tick: 0 },
  { id: 'posts', title: 'Posts', tick: 1 },
  { id: 'authors', title: 'Authors', tick: 2 },
  { id: 'comments', title: 'Comments', tick: 3 },
  { id: 'comment-authors', title: 'Comment authors', tick: 4 },
  { id: 'response', title: 'Response', tick: 5 },
];

export const DEFAULT_FIELDS: QueryFields = {
  postAuthors: true,
  comments: false,
  commentAuthors: false,
  userEmail: true,
};

export const DEFAULT_CONFIG: RunConfig = {
  viewer: 'ada',
  fields: DEFAULT_FIELDS,
  userLoader: false,
  commentsLoader: false,
  loaderScope: 'per-request',
};

export const MISSIONS = [
  {
    id: 'n-plus-one',
    label: 'Ask for posts and their authors, and count the queries.',
    hint: 'Press Run query with Post authors on: one query for the posts, then one per author.',
  },
  {
    id: 'fifty-one',
    label: 'Add the comments and their authors.',
    hint: 'Turn Comments on and Comment authors on, then press Run query. Every level multiplies the queries.',
  },
  {
    id: 'user-loader',
    label: 'Batch the user lookups with a DataLoader.',
    hint: 'Turn on Use User DataLoader and press Run query: all the author loads in one tick become one query.',
  },
  {
    id: 'four',
    label: 'Get the whole page in four queries.',
    hint: 'With every field on, turn on Use Comments DataLoader too and press Run query.',
  },
  {
    id: 'leak',
    label: 'Share one loader across requests and watch Bo see Ada’s email.',
    hint: 'Pick Shared by all requests, press Run query as Viewer: Ada, then pick Viewer: Bo and run again.',
  },
  {
    id: 'per-request',
    label: 'Fix it: one loader per request.',
    hint: 'Pick Per request and run as Viewer: Bo again: a fresh cache for every request.',
  },
] as const;

function unique(values: number[]): number[] {
  return [...new Set(values)];
}

function copyCache(cache: LoaderCache): LoaderCache {
  return { users: { ...cache.users }, comments: { ...cache.comments } };
}

function byId(id: number): User {
  const user = USERS.find((candidate) => candidate.id === id);
  if (!user) throw new Error(`Unknown user ${id}`);
  return user;
}

function resolveUser(id: number, viewer: ViewerId): ResolvedUser {
  const user = byId(id);
  return {
    id: user.id,
    name: user.name,
    email: user.viewer === viewer ? user.email : null,
  };
}

function inSql(table: 'users' | 'comments', keys: number[]): string {
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
  const column = table === 'users' ? 'id' : 'post_id';
  return `SELECT * FROM ${table} WHERE ${column} IN (${placeholders})`;
}

function oneSql(table: 'users' | 'comments'): string {
  const column = table === 'users' ? 'id' : 'post_id';
  return `SELECT * FROM ${table} WHERE ${column} = $1`;
}

function emptyStep(id: ExecutionStepId, resolverCalls: number, summary: string): ExecutionStep {
  const definition = EXECUTION_STEPS.find((step) => step.id === id);
  if (!definition) throw new Error(`Unknown execution step ${id}`);
  return {
    ...definition,
    resolverCalls,
    summary,
    sql: [],
    batches: [],
  };
}

function userLoads(
  keys: number[],
  tick: number,
  viewer: ViewerId,
  useLoader: boolean,
  cache: LoaderCache,
  resolver: string
): { queries: SqlQuery[]; batch: LoaderBatch | null; resolved: ResolvedUser[] } {
  if (!useLoader) {
    const queries = keys.map((key) => ({
      sql: oneSql('users'),
      parameters: [key],
      tick,
      resolver,
    }));
    return { queries, batch: null, resolved: keys.map((key) => resolveUser(key, viewer)) };
  }

  const uniqueKeys = unique(keys);
  const cacheHits = uniqueKeys.filter((key) => cache.users[String(key)] !== undefined);
  const loadedKeys = uniqueKeys.filter((key) => !cacheHits.includes(key));
  const sql = loadedKeys.length > 0 ? inSql('users', loadedKeys) : null;
  const queries = sql ? [{ sql, parameters: loadedKeys, tick, resolver }] : [];
  for (const key of loadedKeys) cache.users[String(key)] = resolveUser(key, viewer);
  return {
    queries,
    batch: {
      loader: 'users',
      tick,
      requestedKeys: keys,
      uniqueKeys,
      loadedKeys,
      cacheHits,
      sql,
    },
    resolved: keys.map((key) => cache.users[String(key)]),
  };
}

function commentLoads(
  keys: number[],
  tick: number,
  useLoader: boolean,
  cache: LoaderCache
): { queries: SqlQuery[]; batch: LoaderBatch | null } {
  if (!useLoader) {
    return {
      queries: keys.map((key) => ({
        sql: oneSql('comments'),
        parameters: [key],
        tick,
        resolver: 'Post.comments',
      })),
      batch: null,
    };
  }
  const uniqueKeys = unique(keys);
  const cacheHits = uniqueKeys.filter((key) => cache.comments[String(key)] !== undefined);
  const loadedKeys = uniqueKeys.filter((key) => !cacheHits.includes(key));
  const sql = loadedKeys.length > 0 ? inSql('comments', loadedKeys) : null;
  const queries = sql ? [{ sql, parameters: loadedKeys, tick, resolver: 'Post.comments' }] : [];
  for (const key of loadedKeys) cache.comments[String(key)] = true;
  return {
    queries,
    batch: {
      loader: 'comments',
      tick,
      requestedKeys: keys,
      uniqueKeys,
      loadedKeys,
      cacheHits,
      sql,
    },
  };
}

export function emptyLoaderCache(): LoaderCache {
  return { users: {}, comments: {} };
}

export function allFields(fields: QueryFields): boolean {
  return fields.postAuthors && fields.comments && fields.commentAuthors && fields.userEmail;
}

/** Runs one GraphQL request and returns the cache that a deliberately shared loader retains. */
export function runQuery(config: RunConfig, sharedCache = emptyLoaderCache()): QueryRun {
  const cache = config.loaderScope === 'shared' ? copyCache(sharedCache) : emptyLoaderCache();
  const steps = [
    emptyStep('parse', 1, 'The operation is parsed and validated.'),
    emptyStep('posts', 1, `${POSTS.length} post records resolve.`),
    emptyStep(
      'authors',
      config.fields.postAuthors ? POSTS.length : 0,
      config.fields.postAuthors
        ? `${POSTS.length} Post.author resolvers begin in tick 2.`
        : 'Post.author was not requested.'
    ),
    emptyStep(
      'comments',
      config.fields.comments ? POSTS.length : 0,
      config.fields.comments
        ? `${POSTS.length} Post.comments resolvers begin after post authors.`
        : 'Post.comments was not requested.'
    ),
    emptyStep(
      'comment-authors',
      config.fields.comments && config.fields.commentAuthors ? COMMENTS.length : 0,
      config.fields.comments && config.fields.commentAuthors
        ? `${COMMENTS.length} Comment.author resolvers begin after comments.`
        : 'Comment.author was not requested.'
    ),
    emptyStep('response', 1, 'GraphQL assembles the response in query order.'),
  ];
  const queries: SqlQuery[] = [];
  const batches: LoaderBatch[] = [];
  const postQuery: SqlQuery = {
    sql: `SELECT * FROM posts LIMIT ${POSTS.length}`,
    parameters: [],
    tick: 1,
    resolver: 'Query.posts',
  };
  steps[1].sql.push(postQuery);
  queries.push(postQuery);

  const responseUsers: ResolvedUser[] = [];
  if (config.fields.postAuthors) {
    const result = userLoads(
      POSTS.map((post) => post.authorId),
      2,
      config.viewer,
      config.userLoader,
      cache,
      'Post.author'
    );
    steps[2].sql.push(...result.queries);
    if (result.batch) steps[2].batches.push(result.batch);
    queries.push(...result.queries);
    if (result.batch) batches.push(result.batch);
    responseUsers.push(...result.resolved);
  }

  if (config.fields.comments) {
    const result = commentLoads(
      POSTS.map((post) => post.id),
      3,
      config.commentsLoader,
      cache
    );
    steps[3].sql.push(...result.queries);
    if (result.batch) steps[3].batches.push(result.batch);
    queries.push(...result.queries);
    if (result.batch) batches.push(result.batch);
  }

  if (config.fields.comments && config.fields.commentAuthors) {
    const result = userLoads(
      COMMENTS.map((comment) => comment.authorId),
      4,
      config.viewer,
      config.userLoader,
      cache,
      'Comment.author'
    );
    steps[4].sql.push(...result.queries);
    if (result.batch) steps[4].batches.push(result.batch);
    queries.push(...result.queries);
    if (result.batch) batches.push(result.batch);
    responseUsers.push(...result.resolved);
  }

  const postAuthorQueryCount = steps[2].sql.length;
  const commentsQueryCount = steps[3].sql.length;
  const commentAuthorQueryCount = steps[4].sql.length;
  return {
    config,
    steps,
    queries,
    batches,
    queryCount: queries.length,
    postAuthorQueryCount,
    commentsQueryCount,
    commentAuthorQueryCount,
    responseUsers: config.fields.userEmail
      ? responseUsers
      : responseUsers.map((user) => ({ ...user, email: null })),
    observedEmails: config.fields.userEmail
      ? responseUsers.flatMap((user) => (user.email ? [user.email] : []))
      : [],
    nextSharedCache: cache,
  };
}

export function missionPassed(
  id: (typeof MISSIONS)[number]['id'],
  history: MissionRunHistory
): boolean {
  const runs = history.runs;
  if (id === 'n-plus-one') {
    return runs.some(
      (run) =>
        run.config.fields.postAuthors &&
        !run.config.fields.comments &&
        !run.config.userLoader &&
        run.queryCount === POSTS.length + 1
    );
  }
  if (id === 'fifty-one') {
    return runs.some(
      (run) =>
        allFields(run.config.fields) &&
        !run.config.userLoader &&
        !run.config.commentsLoader &&
        run.queryCount === 1 + POSTS.length + POSTS.length + COMMENTS.length
    );
  }
  if (id === 'user-loader') {
    return runs.some(
      (run) =>
        run.config.fields.postAuthors &&
        run.config.userLoader &&
        run.config.loaderScope === 'per-request' &&
        run.postAuthorQueryCount === 1
    );
  }
  if (id === 'four') {
    return runs.some(
      (run) =>
        allFields(run.config.fields) &&
        run.config.userLoader &&
        run.config.commentsLoader &&
        run.config.loaderScope === 'per-request' &&
        run.queryCount === 4
    );
  }
  if (id === 'leak') {
    return runs.some(
      (run, index) =>
        run.config.viewer === 'bo' &&
        run.config.loaderScope === 'shared' &&
        run.observedEmails.includes(USERS[0].email) &&
        runs
          .slice(0, index)
          .some(
            (earlier) =>
              earlier.config.viewer === 'ada' &&
              earlier.config.loaderScope === 'shared' &&
              earlier.observedEmails.includes(USERS[0].email)
          )
    );
  }
  return runs.some(
    (run, index) =>
      run.config.viewer === 'bo' &&
      run.config.loaderScope === 'per-request' &&
      !run.observedEmails.includes(USERS[0].email) &&
      missionPassed('leak', { runs: runs.slice(0, index) })
  );
}
