import { createHash } from 'node:crypto';
import { toPortableMarkdown } from './portable-markdown';
import { sponsorHref, type Sponsor } from './sponsors';

const SCHEMA = 1;
const SHARD_COUNT = 16;

export type CliPostInput = {
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  date?: string;
  publishedAt?: string;
  category?: { name?: string };
  tags?: string[];
  readingTime?: string;
};

export type CliDataInput = {
  posts: CliPostInput[];
  quizzes: Record<string, unknown>[];
  decks: Record<string, unknown>[];
  checklists: Record<string, unknown>[];
  incidents: Record<string, unknown> | Record<string, unknown>[];
  games: Array<{
    id: string;
    type: string;
    title: string;
    description?: string;
    category?: string;
    href: string;
  }>;
  sponsors: Sponsor[];
  site: string;
  generatedAt?: string;
};

export type CliFiles = Record<string, string>;

type RecordValue = Record<string, unknown>;

function normalizedSite(site: string): string {
  return site.trim().replace(/\/+$/, '');
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalString(target: RecordValue, key: string, value: unknown) {
  const normalized = text(value);
  if (normalized) target[key] = normalized;
}

function trimValue(value: unknown): unknown {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(trimValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as RecordValue).map(([key, nested]) => [key, trimValue(nested)])
    );
  }
  return value;
}

function isOwn(object: RecordValue, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function transformOutsideInlineCode(
  markdown: string,
  transform: (plain: string) => string
): string {
  let output = '';
  let cursor = 0;

  while (cursor < markdown.length) {
    const start = markdown.indexOf('`', cursor);
    if (start === -1) return output + transform(markdown.slice(cursor));

    output += transform(markdown.slice(cursor, start));
    let ticks = 1;
    while (markdown[start + ticks] === '`') ticks += 1;
    const delimiter = '`'.repeat(ticks);
    const end = markdown.indexOf(delimiter, start + ticks);

    if (end === -1) return output + markdown.slice(start);
    output += markdown.slice(start, end + ticks);
    cursor = end + ticks;
  }

  return output;
}

function rewriteMarkdownText(markdown: string, site: string): string {
  const base = normalizedSite(site);
  // Authoring paths (../../public/images/...) only count as link or image
  // targets; the same words in prose stay as they are.
  const publicPath = /(?:\.\.\/)+public\/|\/public\//;
  return transformOutsideInlineCode(markdown, (plain) =>
    plain
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(new RegExp(`(\\]\\(\\s*)(?:${publicPath.source})`, 'g'), '$1/')
      .replace(new RegExp(`(\\b(?:src|href)\\s*=\\s*["'])(?:${publicPath.source})`, 'gi'), '$1/')
      .replace(new RegExp(`(^\\s*\\[[^\\]]+\\]:\\s*)(?:${publicPath.source})`, 'gm'), '$1/')
      .replace(/(\]\(\s*)\/(?!\/)/g, `$1${base}/`)
      .replace(/(^\s*\[[^\]]+\]:\s*)\/(?!\/)/gm, `$1${base}/`)
      .replace(/\b(src|href)(\s*=\s*["'])\/(?!\/)/gi, `$1$2${base}/`)
  );
}

/** Turns root/public URLs into site URLs without changing code samples. */
export function absolutizeMarkdown(markdown: string, site: string): string {
  const lines = markdown.split(/(?<=\n)/);
  const output: string[] = [];
  let normal = '';
  let fence: { marker: string; length: number } | undefined;

  const flushNormal = () => {
    if (normal) output.push(rewriteMarkdownText(normal, site));
    normal = '';
  };

  for (const line of lines) {
    if (!fence) {
      const opening = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (opening) {
        flushNormal();
        fence = { marker: opening[1][0], length: opening[1].length };
        output.push(line);
      } else {
        normal += line;
      }
      continue;
    }

    output.push(line);
    const closing = new RegExp(`^ {0,3}${fence.marker}{${fence.length},}[ \\t]*(?:\\n)?$`);
    if (closing.test(line)) fence = undefined;
  }

  flushNormal();
  return output.join('');
}

/** FNV-1a 32-bit of the UTF-8 slug, assigned to one of the 16 body files. */
export function postShard(slug: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(slug)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % SHARD_COUNT;
}

function readingTime(post: CliPostInput): string | undefined {
  const configured = text(post.readingTime);
  if (configured) return configured;
  const words = post.content.trim() ? post.content.trim().split(/\s+/).length : 0;
  return `${Math.max(1, Math.round(words / 220))} min read`;
}

export function buildPostsData(posts: CliPostInput[], site: string) {
  const base = normalizedSite(site);
  const sorted = [...posts].sort((left, right) => {
    const leftDate = (text(left.publishedAt) || text(left.date) || '').slice(0, 10);
    const rightDate = (text(right.publishedAt) || text(right.date) || '').slice(0, 10);
    return rightDate.localeCompare(leftDate) || left.slug.localeCompare(right.slug);
  });
  const bodies: Array<Array<[string, string]>> = Array.from({ length: SHARD_COUNT }, () => []);
  const indexPosts: RecordValue[] = [];

  for (const post of sorted) {
    const slug = text(post.slug) || '';
    const bodyName = `posts/${postShard(slug)}.json`;
    const metadata: RecordValue = { slug, title: text(post.title) || '' };
    optionalString(metadata, 'excerpt', post.excerpt);
    metadata.date = (text(post.publishedAt) || text(post.date) || '').slice(0, 10);
    optionalString(metadata, 'category', post.category?.name);
    const tags = post.tags?.map(text).filter((tag): tag is string => Boolean(tag));
    if (tags?.length) metadata.tags = tags;
    const duration = readingTime(post);
    if (duration) metadata.readingTime = duration;
    metadata.url = `${base}/posts/${slug}`;
    metadata.body = bodyName;
    indexPosts.push(metadata);

    const body = absolutizeMarkdown(toPortableMarkdown(post.content), base).trim();
    bodies[postShard(slug)].push([slug, body]);
  }

  const shards = Object.fromEntries(
    bodies.map((entries, index) => [
      `posts/${index}.json`,
      {
        schema: SCHEMA,
        posts: Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right))),
      },
    ])
  );

  return { index: { schema: SCHEMA, posts: indexPosts }, shards };
}

export type QuizDropSummary = { branches: number; conflict: number; invalidCorrect: number };

export function getQuizDropSummary(rawQuizzes: RecordValue[]): QuizDropSummary {
  const dropped = { branches: 0, conflict: 0, invalidCorrect: 0 };
  for (const quiz of rawQuizzes) {
    for (const question of (quiz.questions as RecordValue[] | undefined) || []) {
      if (isOwn(question, 'branches')) dropped.branches += 1;
      else if (isOwn(question, 'conflict')) dropped.conflict += 1;
      else {
        const correct = question.correctAnswer ?? question.correct;
        if (
          !Number.isInteger(correct) ||
          !Array.isArray(question.options) ||
          correct < 0 ||
          correct >= question.options.length
        ) {
          dropped.invalidCorrect += 1;
        }
      }
    }
  }
  return dropped;
}

export function buildQuizzes(rawQuizzes: RecordValue[], site: string) {
  const base = normalizedSite(site);
  const quizzes = [...rawQuizzes]
    .sort((left, right) => (text(left.id) || '').localeCompare(text(right.id) || ''))
    .map((quiz) => {
      const questions = ((quiz.questions as RecordValue[] | undefined) || []).flatMap(
        (question) => {
          if (isOwn(question, 'branches') || isOwn(question, 'conflict')) return [];
          const correct = question.correctAnswer ?? question.correct;
          const options = Array.isArray(question.options)
            ? question.options.map(text).filter((option): option is string => Boolean(option))
            : [];
          if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) return [];

          const mapped: RecordValue = { id: text(question.id) || '' };
          optionalString(mapped, 'title', question.title);
          optionalString(mapped, 'situation', question.situation);
          optionalString(mapped, 'code', question.codeExample);
          mapped.question = text(question.description) || '';
          mapped.options = options;
          mapped.correct = correct;
          optionalString(mapped, 'explanation', question.explanation);
          optionalString(mapped, 'hint', question.hint);
          optionalString(mapped, 'difficulty', question.difficulty);
          if (typeof question.points === 'number') mapped.points = question.points;
          return [mapped];
        }
      );
      const id = text(quiz.id) || '';
      const mapped: RecordValue = { id, title: text(quiz.title) || '' };
      optionalString(mapped, 'description', quiz.description);
      optionalString(mapped, 'category', quiz.category);
      mapped.url = `${base}/quizzes/${id}`;
      mapped.questions = questions;
      return mapped;
    });

  return { schema: SCHEMA, quizzes };
}

export function buildDecks(rawDecks: RecordValue[], site: string) {
  const base = normalizedSite(site);
  const decks = [...rawDecks]
    .sort((left, right) => (text(left.id) || '').localeCompare(text(right.id) || ''))
    .map((deck) => {
      const id = text(deck.id) || '';
      const cards = ((deck.cards as RecordValue[] | undefined) || []).map((card) => {
        const mapped: RecordValue = {
          id: text(card.id) || '',
          front: text(card.front) || '',
          back: text(card.back) || '',
        };
        optionalString(mapped, 'category', card.category);
        return mapped;
      });
      const mapped: RecordValue = { id, title: text(deck.title) || '' };
      optionalString(mapped, 'description', deck.description);
      optionalString(mapped, 'category', deck.category);
      optionalString(mapped, 'difficulty', deck.difficulty);
      mapped.url = `${base}/flashcards/${id}`;
      mapped.cards = cards;
      return mapped;
    });

  return { schema: SCHEMA, decks };
}

export function buildChecklists(rawChecklists: RecordValue[], site: string) {
  const base = normalizedSite(site);
  const checklists = [...rawChecklists]
    .sort((left, right) => (text(left.slug) || '').localeCompare(text(right.slug) || ''))
    .map((checklist) => {
      const id = text(checklist.slug) || '';
      const items = ((checklist.items as RecordValue[] | undefined) || []).map((item) => {
        const mapped: RecordValue = {
          id: text(item.id) || '',
          title: text(item.title) || '',
        };
        optionalString(mapped, 'description', item.description);
        if (item.critical === true) mapped.critical = true;
        const code = ((item.codeBlocks as RecordValue[] | undefined) || []).flatMap((block) => {
          const content = text(block.code);
          if (!content) return [];
          const mappedBlock: RecordValue = {};
          optionalString(mappedBlock, 'language', block.language);
          optionalString(mappedBlock, 'label', block.label);
          mappedBlock.code = content;
          return [mappedBlock];
        });
        if (code.length) mapped.code = code;
        return mapped;
      });
      const mapped: RecordValue = { id, title: text(checklist.title) || '' };
      optionalString(mapped, 'description', checklist.description);
      optionalString(mapped, 'category', checklist.category);
      optionalString(mapped, 'difficulty', checklist.difficulty);
      optionalString(mapped, 'estimatedTime', checklist.estimatedTime);
      mapped.url = `${base}/checklists/${id}`;
      mapped.items = items;
      return mapped;
    });

  return { schema: SCHEMA, checklists };
}

export function buildIncidents(raw: RecordValue | RecordValue[]) {
  const incidents = Array.isArray(raw) ? raw : (raw.incidents as RecordValue[] | undefined) || [];
  for (const incident of incidents) {
    const options = Array.isArray(incident.options) ? (incident.options as RecordValue[]) : [];
    const correct = text(incident.correct);
    if (!options.length)
      throw new Error(`Incident ${text(incident.id) || '(unknown)'} has no options`);
    if (!correct || !options.some((option) => text(option.key) === correct)) {
      throw new Error(`Incident ${text(incident.id) || '(unknown)'} has an invalid correct option`);
    }
    if (!text(incident.linkUrl)?.startsWith('https://devops-daily.com/')) {
      throw new Error(`Incident ${text(incident.id) || '(unknown)'} has an invalid linkUrl`);
    }
  }
  return { schema: SCHEMA, incidents: trimValue(incidents) };
}

export function buildGames(games: CliDataInput['games'], site: string) {
  const base = normalizedSite(site);
  const mapped = games.map((game) => {
    const item: RecordValue = {
      id: text(game.id) || '',
      type: text(game.type) || '',
      title: text(game.title) || '',
    };
    optionalString(item, 'description', game.description);
    optionalString(item, 'category', game.category);
    item.url = `${base}${text(game.href) || ''}`;
    return item;
  });
  if (!mapped.some((game) => game.id === 'opsville')) {
    mapped.push({
      id: 'opsville',
      type: 'game',
      title: 'Opsville',
      description: 'A free pixel-art DevOps town: walk around, fix incidents and learn by playing.',
      url: `${base}/opsville/`,
    });
  }
  return { schema: SCHEMA, games: mapped };
}

export function buildSponsors(sponsors: Sponsor[]) {
  return {
    schema: SCHEMA,
    sponsors: sponsors
      .filter((sponsor) => !sponsor.ownProduct)
      .map((sponsor) => {
        const mapped: RecordValue = { name: sponsor.name.trim() };
        optionalString(mapped, 'text', sponsor.tagline);
        mapped.url = sponsorHref(sponsor, 'cli');
        return mapped;
      }),
  };
}

export function buildManifest(
  files: CliFiles,
  counts: Record<string, number>,
  generatedAt: string,
  site: string
) {
  const entries = Object.entries(files)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, contents]) => [
      name,
      {
        sha256: createHash('sha256').update(contents, 'utf8').digest('hex'),
        bytes: Buffer.byteLength(contents, 'utf8'),
      },
    ]);
  return {
    schema: SCHEMA,
    generatedAt: generatedAt.trim(),
    site: normalizedSite(site),
    files: Object.fromEntries(entries),
    counts,
  };
}

function json(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

/** Builds every v1 file in memory; callers decide where and how to write it. */
export function buildCliData(input: CliDataInput): CliFiles {
  const site = normalizedSite(input.site);
  const posts = buildPostsData(input.posts, site);
  const quizzes = buildQuizzes(input.quizzes, site);
  const decks = buildDecks(input.decks, site);
  const checklists = buildChecklists(input.checklists, site);
  const incidents = buildIncidents(input.incidents);
  const games = buildGames(input.games, site);
  const sponsors = buildSponsors(input.sponsors);
  const files: CliFiles = { 'posts.json': json(posts.index) };

  for (let index = 0; index < SHARD_COUNT; index += 1) {
    const name = `posts/${index}.json`;
    files[name] = json(posts.shards[name]);
  }
  files['quizzes.json'] = json(quizzes);
  files['flashcards.json'] = json(decks);
  files['checklists.json'] = json(checklists);
  files['incidents.json'] = json(incidents);
  files['games.json'] = json(games);
  files['sponsors.json'] = json(sponsors);

  const counts = {
    posts: posts.index.posts.length,
    quizzes: quizzes.quizzes.length,
    flashcards: decks.decks.length,
    checklists: checklists.checklists.length,
    incidents: (incidents.incidents as unknown[]).length,
    games: games.games.length,
    sponsors: sponsors.sponsors.length,
  };
  files['index.json'] = json(
    buildManifest(files, counts, input.generatedAt || new Date().toISOString(), site)
  );
  return files;
}
