---
title: 'Build and Test an Application'
description: 'Lint, test and build an app on every pull request with GitHub Actions: setup-node, npm ci, a Node.js version matrix, service containers, Python and Go.'
order: 3
---

The core of CI is simple: every change runs the same lint, test and build commands, on a clean machine, before anyone merges it. If the commands pass on your laptop but fail in CI, CI has found a difference between the two, such as a missing dependency in the lockfile or a different Node.js version, and that difference would have reached production.

In this part you add the example app to the repository, run its commands locally, and write a CI workflow that runs them on every pull request and on every push to `main`, on three Node.js versions.

## Prerequisites

- The repository from [Part 2](/guides/introduction-to-cicd/02-workflow-anatomy-and-core-concepts).
- [Node.js](https://nodejs.org/) 24, or 22.13 and newer in the 22 line, on your computer. ESLint 10 needs one of those.

## The Example App

The app is a one-page command cheatsheet. A JSON file lists commands, a render function turns them into HTML, and a build script writes the site to `dist/`. It has no runtime dependencies; ESLint is the only development dependency.

`package.json` defines the three commands CI will run. `npm test` uses the test runner built into Node.js, and `engines` records the Node.js versions that ESLint 10 supports:

```json
{
  "name": "cheatsheet",
  "version": "1.0.0",
  "description": "A one-page command cheatsheet, tested, built and deployed with GitHub Actions",
  "private": true,
  "type": "module",
  "engines": {
    "node": "^22.13.0 || >=24"
  },
  "scripts": {
    "lint": "eslint .",
    "test": "node --test",
    "build": "node scripts/build.js"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "eslint": "10.13.0",
    "globals": "17.13.0"
  }
}
```

`src/render.js` escapes every value it puts into the page, so a command such as `<script>` shows up as text:

```js
// Renders the command list into a single HTML page.

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Returns [[topic, commands], ...] with topics and commands in alphabetical order.
export function groupByTopic(commands) {
  const groups = new Map();
  for (const command of commands) {
    if (!groups.has(command.topic)) {
      groups.set(command.topic, []);
    }
    groups.get(command.topic).push(command);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([topic, list]) => [topic, list.sort((a, b) => a.cmd.localeCompare(b.cmd))]);
}

export function renderPage(commands, { title, version, commit }) {
  const sections = groupByTopic(commands)
    .map(
      ([topic, list]) => `<section>
<h2>${escapeHtml(topic)}</h2>
<dl>
${list.map((c) => `<dt><code>${escapeHtml(c.cmd)}</code></dt><dd>${escapeHtml(c.description)}</dd>`).join('\n')}
</dl>
</section>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${sections}
<footer>Version ${escapeHtml(version)}, commit ${escapeHtml(commit.slice(0, 7))}</footer>
</body>
</html>
`;
}
```

`scripts/build.js` reads the title from `SITE_TITLE` and the commit from `GITHUB_SHA`, which GitHub sets in every job. Besides the page, it writes `version.json`, which the deployment checks in Part 6 use:

```js
// Builds the site into dist/: index.html plus version.json for smoke tests.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { renderPage } from '../src/render.js';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const commands = JSON.parse(await readFile('src/commands.json', 'utf8'));

const title = process.env.SITE_TITLE || 'Command Cheatsheet';
const commit = process.env.GITHUB_SHA || 'local';

await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', renderPage(commands, { title, version: pkg.version, commit }));
await writeFile(
  'dist/version.json',
  JSON.stringify({ version: pkg.version, commit }, null, 2) + '\n'
);

console.log(
  `Built dist/ with ${commands.length} commands (version ${pkg.version}, commit ${commit.slice(0, 7)})`
);
```

The tests in `test/render.test.js` cover escaping, sorting and the footer:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, groupByTopic, renderPage } from '../src/render.js';

const commands = [
  { topic: 'git', cmd: 'git status', description: 'Show changed files' },
  { topic: 'docker', cmd: 'docker ps', description: 'List running containers' },
  { topic: 'git', cmd: 'git log --oneline', description: 'Short history' },
];

test('escapeHtml escapes markup characters', () => {
  assert.equal(
    escapeHtml('<a href="x">&\'</a>'),
    '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;'
  );
});

test('groupByTopic sorts topics and commands', () => {
  const groups = groupByTopic(commands);
  assert.deepEqual(
    groups.map(([topic]) => topic),
    ['docker', 'git']
  );
  assert.deepEqual(
    groups[1][1].map((c) => c.cmd),
    ['git log --oneline', 'git status']
  );
});

test('renderPage shows the title, version and short commit', () => {
  const html = renderPage(commands, {
    title: 'Cheatsheet',
    version: '1.0.0',
    commit: '0123456789abcdef',
  });
  assert.match(html, /<title>Cheatsheet<\/title>/);
  assert.match(html, /Version 1\.0\.0, commit 0123456/);
});

test('renderPage escapes command text', () => {
  const html = renderPage([{ topic: 'x', cmd: '<script>alert(1)</script>', description: 'bad' }], {
    title: 't',
    version: '1',
    commit: 'abc',
  });
  assert.ok(!html.includes('<script>'));
});
```

`eslint.config.js` turns on ESLint's recommended rules for Node.js code:

```js
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
];
```

`src/commands.json` holds the data, twelve entries like these (the [companion repository](https://github.com/The-DevOps-Daily/guide-cicd-demo-2026-10-24/blob/e7dc8e46f5fa114be941308071191ec0cf6f6b37/src/commands.json) has the full file as of this part):

```json
[
  { "topic": "git", "cmd": "git status", "description": "Show changed and untracked files" },
  { "topic": "gh", "cmd": "gh run list", "description": "List recent workflow runs" }
]
```

Finally, `.gitignore` keeps installed packages and build output out of Git:

```text
node_modules/
dist/
test-results.xml
```

## Run It Locally First

Install the development dependencies, then run the three commands. `npm install` also writes `package-lock.json`, which pins the exact version of every package; commit it, because CI installs from it.

```terminal
{
  "title": "local run",
  "prompt": "$",
  "steps": [
    {
      "cmd": "node --version",
      "output": "v24.22.1"
    },
    {
      "comment": "installs ESLint and writes package-lock.json",
      "cmd": "npm install",
      "output": "added 79 packages, and audited 80 packages in 7s\n\n18 packages are looking for funding\n  run `npm fund` for details\n\nfound 0 vulnerabilities"
    },
    {
      "cmd": "npm run lint",
      "output": "> cheatsheet@1.0.0 lint\n> eslint ."
    },
    {
      "cmd": "npm test",
      "output": "> cheatsheet@1.0.0 test\n> node --test\n\n✔ escapeHtml escapes markup characters (3.812056ms)\n✔ groupByTopic sorts topics and commands (36.738838ms)\n✔ renderPage shows the title, version and short commit (1.69653ms)\n✔ renderPage escapes command text (4.294234ms)\nℹ tests 4\nℹ suites 0\nℹ pass 4\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 404.948236"
    },
    {
      "cmd": "npm run build",
      "output": "> cheatsheet@1.0.0 build\n> node scripts/build.js\n\nBuilt dist/ with 12 commands (version 1.0.0, commit local)"
    },
    {
      "cmd": "cat dist/version.json",
      "output": "{\n  \"version\": \"1.0.0\",\n  \"commit\": \"local\"\n}"
    }
  ]
}
```

ESLint printed nothing, which means no problems. The local build has no `GITHUB_SHA`, so the commit is `local`.

## The CI Workflow

Add `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    strategy:
      fail-fast: false
      matrix:
        node: [22, 24, 26]
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm test

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run build
      - name: Check the build output
        run: |
          test -s dist/index.html
          cat dist/version.json
```

What each part does:

- **Triggers.** `pull_request` runs CI for every pull request, before the merge. `push` to `main` runs it again after the merge, on the code as merged.
- **Three jobs.** `lint` and `test` run in parallel; `build` waits for both with `needs: [lint, test]`. Splitting them shows at a glance which kind of check failed.
- **`actions/setup-node`** installs the requested Node.js version and puts it on the `PATH`. `cache: npm` caches npm's download cache between runs; Part 4 looks at how.
- **`npm ci`, not `npm install`.** `npm ci` installs exactly what `package-lock.json` says, deletes any existing `node_modules` first, and fails if `package.json` and the lockfile disagree. `npm install` may update the lockfile, so CI would test something you never committed.
- **The matrix.** `strategy.matrix.node: [22, 24, 26]` runs the `test` job three times, once per value, and `${{ matrix.node }}` passes the value to setup-node. Node.js 22 and 24 are long-term support releases; Node.js 26 is the current release and is scheduled to become LTS at the end of October 2026. Node.js 20 reached end of life in April 2026.
- **`fail-fast: false`.** By default, the first failing matrix job cancels the others. Turning that off shows you whether a failure happens on every version or only one.

Commit everything, including `package-lock.json`, and push.

## The First CI Run

```terminal
{
  "title": "CI on main",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view 40063854303",
      "output": "✓ main CI · 40063854303\nTriggered via push about 1 minute ago\n\nJOBS\n✓ lint in 10s (ID 120782853422)\n✓ test (26) in 15s (ID 120782853537)\n✓ test (22) in 9s (ID 120782853587)\n✓ test (24) in 11s (ID 120782853647)\n✓ build in 6s (ID 120782909986)\n\nANNOTATIONS\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\nlint: .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\ntest (26): .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\ntest (22): .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\ntest (24): .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\nbuild: .github#1\n\n\nFor more information about a job, try: gh run view --job=<job-id>\nView this run on GitHub: https://github.com/The-DevOps-Daily/guide-cicd-demo-2026-10-24/actions/runs/40063854303"
    }
  ]
}
```

The five jobs ran on five runners. `test (26)` was the slowest: the runner image does not include Node.js 26, so setup-node downloaded it. The log shows where each job got Node.js from:

```terminal
{
  "title": "where Node.js came from",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view 40063854303 --log | grep -E 'Found in cache @|Attempting to download' | cut -f1,3",
      "output": "lint\t2026-10-24T04:49:31.6357858Z Found in cache @ /opt/hostedtoolcache/node/24.21.0/x64\ntest (26)\t2026-10-24T04:49:32.0124217Z Attempting to download 26...\ntest (22)\t2026-10-24T04:49:31.8346638Z Found in cache @ /opt/hostedtoolcache/node/22.23.3/x64\ntest (24)\t2026-10-24T04:49:31.8504523Z Found in cache @ /opt/hostedtoolcache/node/24.21.0/x64\nbuild\t2026-10-24T04:49:48.4470437Z Found in cache @ /opt/hostedtoolcache/node/24.21.0/x64"
    }
  ]
}
```

Two details matter here. First, `node-version: 24` got 24.21.0, the version preinstalled on the image, although 24.22.1 was already released; add `check-latest: true` if you need the newest patch release, at the cost of a download. Second, preinstalled versions change when GitHub updates the image (the default Node.js on Ubuntu 24.04 changed from 20 to 22 in May 2026), which is why the workflow asks for versions explicitly instead of using whatever `node` is on the `PATH`. You can also keep the version in a file with `node-version-file: .nvmrc`.

## Other Languages

The pattern is the same in every language: check out, install the toolchain with a `setup-*` action and its built-in cache, install dependencies from a lockfile, run the checks. These versions of the same workflow were checked with actionlint but not run in the companion repository:

```tabs
{
  "title": "CI for other languages",
  "tabs": [
    {
      "label": "Python",
      "lang": "yaml",
      "code": "name: CI\n\non:\n  push:\n    branches: [main]\n  pull_request:\n\npermissions:\n  contents: read\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    timeout-minutes: 10\n    strategy:\n      fail-fast: false\n      matrix:\n        python: ['3.13', '3.14', '3.15']\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          persist-credentials: false\n      - uses: actions/setup-python@v7\n        with:\n          python-version: ${{ matrix.python }}\n          cache: pip\n          cache-dependency-path: requirements-dev.txt\n      - run: python -m pip install -r requirements-dev.txt\n      - run: python -m ruff check .\n      - run: python -m pytest"
    },
    {
      "label": "Go",
      "lang": "yaml",
      "code": "name: CI\n\non:\n  push:\n    branches: [main]\n  pull_request:\n\npermissions:\n  contents: read\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    timeout-minutes: 10\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          persist-credentials: false\n      - uses: actions/setup-go@v7\n        with:\n          go-version-file: go.mod\n      - run: go vet ./...\n      - run: go test -race ./...\n      - run: go build ./..."
    },
    {
      "label": "Java (Maven)",
      "lang": "yaml",
      "code": "name: CI\n\non:\n  push:\n    branches: [main]\n  pull_request:\n\npermissions:\n  contents: read\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          persist-credentials: false\n      - uses: actions/setup-java@v6\n        with:\n          distribution: temurin\n          java-version: '25'\n          cache: maven\n      - run: ./mvnw --batch-mode verify"
    }
  ]
}
```

`setup-go` caches the module and build caches by default, keyed on `go.sum`. For a project that builds a container image, build and push it with Docker's actions; the [Docker guide's production part](/guides/introduction-to-docker/10-docker-in-production) has a complete workflow.

## Databases and Other Services

Integration tests often need a real database. A job can start **service containers** next to it. This job (not part of the example app) runs a Postgres 18 container, waits until it accepts connections, and points the tests at it:

```yaml
name: Integration tests

on:
  pull_request:

permissions:
  contents: read

jobs:
  integration:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:18
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
```

The password is fine in the file because the container exists only for the length of the job and is not reachable from outside the runner. Service containers need a Linux runner; they do not work on Windows or macOS runners.

## Common Mistakes

- **`npm install` in CI.** Use `npm ci` (or `pnpm install --frozen-lockfile`, `yarn install --immutable`), so CI installs exactly the committed lockfile.
- **No lockfile in the repository.** `cache: npm` then fails with "Dependencies lock file is not found", and every run may install different versions.
- **Relying on preinstalled tools.** Images change every week, and `ubuntu-latest` itself moves to Ubuntu 26.04 in October and November 2026. Ask for the versions you need.
- **Testing only the newest version.** If users run Node.js 22, test on 22.
- **Different commands locally and in CI.** Keep the logic in `package.json` scripts (or a Makefile) and have CI call them, so a developer can run exactly what CI runs.

## Summary

- CI runs the same lint, test and build commands as your laptop, on a clean runner, for every pull request and every push to `main`.
- `actions/setup-node` with an explicit `node-version` and `cache: npm`, then `npm ci`, gives a repeatable install.
- A matrix runs one job definition for several versions; `fail-fast: false` keeps all results.
- Other languages follow the same pattern with `setup-python`, `setup-go` and `setup-java`, and service containers provide databases for integration tests.

In [Part 4](/guides/introduction-to-cicd/04-working-with-artifacts-and-dependencies) you look at what the npm cache did in these runs, and pass the built site from the `build` job to other jobs as an artifact.

## Keep Learning

- [Complete CI/CD Pipeline with GitHub Actions](/exercises/ci-cd-github-actions) (exercise)
- [CI/CD Pipeline Setup Checklist](/checklists/cicd-pipeline-setup)
- [The 9 Types of API Testing, and Where Each Belongs in Your Pipeline](/posts/api-testing-types-where-each-belongs-in-your-pipeline)
