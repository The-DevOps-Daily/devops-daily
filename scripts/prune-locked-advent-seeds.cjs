// Advent of Postgres: remove the data of days that have not opened yet from the
// built site, so it cannot be downloaded early. Same rule as openAtBuild() in
// lib/advent-postgres.ts: open from 20 minutes before 00:00 UTC on the day, and
// every day on preview builds of other branches.
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const BUILD_LEAD_MS = 20 * 60 * 1000;
const branch = process.env.CF_PAGES_BRANCH;
if (process.env.ADVENT_PREVIEW === '1' || (branch && branch !== 'main')) {
  console.log('Advent of Postgres seeds: preview build, every day kept');
  process.exit(0);
}

const contentDir = path.join(__dirname, '..', 'content', 'advent-of-postgres');
const seedsDir = path.join(__dirname, '..', 'out', 'advent-of-postgres', 'seeds');
let removed = 0;
for (const file of fs.readdirSync(contentDir).filter((f) => /^day-\d+\.md$/.test(f))) {
  const { data } = matter(fs.readFileSync(path.join(contentDir, file), 'utf8'));
  if (new Date(data.publishedAt).getTime() - BUILD_LEAD_MS <= Date.now()) continue;
  for (const ext of ['sql', 'json']) {
    const seed = path.join(seedsDir, `${data.schema}.${ext}`);
    if (fs.existsSync(seed)) {
      fs.rmSync(seed);
      removed++;
    }
  }
}
console.log(`Advent of Postgres seeds: removed ${removed} files of days not open yet`);
