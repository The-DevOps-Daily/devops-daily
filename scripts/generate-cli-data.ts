import { rm, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCliData, getQuizDropSummary, type CliDataInput } from '../lib/cli-export.js';
import { getActiveGames } from '../lib/games.js';
import { getAllPosts } from '../lib/posts.js';
import { sponsors } from '../lib/sponsors.js';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

function outputPath(args: string[]): string {
  const index = args.indexOf('--out');
  if (index === -1) return path.join(process.cwd(), 'public', 'cli', 'v1');
  const supplied = args[index + 1];
  if (!supplied) throw new Error('--out requires a path');
  return path.resolve(supplied);
}

async function readJsonDirectory(directory: string): Promise<Record<string, unknown>[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    names.map(async (name) => {
      const parsed = JSON.parse(await readFile(path.join(directory, name), 'utf8')) as Record<
        string,
        unknown
      >;
      if (directory.endsWith(`${path.sep}checklists`)) {
        return { ...parsed, slug: path.basename(name, '.json') };
      }
      return parsed;
    })
  );
}

async function generateCliData() {
  const root = process.cwd();
  const out = outputPath(process.argv.slice(2));
  const [posts, quizzes, decks, checklists, incidents, games] = await Promise.all([
    getAllPosts(),
    readJsonDirectory(path.join(root, 'content', 'quizzes')),
    readJsonDirectory(path.join(root, 'content', 'flashcards')),
    readJsonDirectory(path.join(root, 'content', 'checklists')),
    readFile(path.join(root, 'content', 'incidents', 'incidents.json'), 'utf8').then(
      (contents) => JSON.parse(contents) as Record<string, unknown>
    ),
    getActiveGames(),
  ]);
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com').replace(/\/+$/, '');
  const input: CliDataInput = {
    posts,
    quizzes,
    decks,
    checklists,
    incidents,
    games,
    sponsors,
    site,
    generatedAt: new Date().toISOString(),
  };
  const files = buildCliData(input);
  const fileEntries = Object.entries(files);
  const tooLarge = fileEntries.find(
    ([, contents]) => Buffer.byteLength(contents, 'utf8') > MAX_FILE_BYTES
  );
  const totalBytes = fileEntries.reduce(
    (total, [, contents]) => total + Buffer.byteLength(contents, 'utf8'),
    0
  );

  if (tooLarge) {
    throw new Error(`${tooLarge[0]} exceeds the 20 MB single-file limit`);
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error(`CLI data exceeds the 25 MB total limit (${totalBytes} bytes)`);
  }

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  for (const [name, contents] of fileEntries.filter(([name]) => name !== 'index.json')) {
    const destination = path.join(out, name);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, contents, 'utf8');
  }
  await writeFile(path.join(out, 'index.json'), files['index.json'], 'utf8');

  const relativeOut = path.relative(root, out) || '.';
  const drops = getQuizDropSummary(quizzes);
  const dropped = drops.branches + drops.conflict + drops.invalidCorrect;
  console.log(
    `cli data: ${fileEntries.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB in ${relativeOut}` +
      (dropped
        ? ` (${dropped} quiz questions left out: they need the web page or are invalid)`
        : '')
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateCliData().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
