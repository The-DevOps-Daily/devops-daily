/**
 * Engine for the Git Merge Conflict Simulator.
 *
 * Each lesson is a small repository frozen at an interesting moment (a merge
 * or rebase stopped on a conflict, or a clean tree about to merge). The
 * engine runs a command against that state and returns the new state and the
 * terminal output, and decides whether a lesson step is done. No real Git
 * runs; the outputs follow what Git 2.4x prints for the same situation.
 */

export type LineType = 'input' | 'output' | 'error' | 'success' | 'note';

export interface OutputLine {
  type: LineType;
  content: string;
}

export type FileStatus = 'clean' | 'unmerged' | 'modified' | 'staged' | 'new';

export interface RepoFile {
  path: string;
  /** What the working tree holds now. */
  content: string;
  status: FileStatus;
  /** Index stages while the file is unmerged: 1 base, 2 ours, 3 theirs. */
  base?: string;
  ours?: string;
  theirs?: string;
  /** The file as Git wrote it, markers included, so `checkout -m` can restore it. */
  conflicted?: string;
  /** Content in HEAD, for diffs of later edits. */
  head?: string;
}

export interface Commit {
  sha: string;
  message: string;
  refs?: string;
}

export type Operation =
  | { kind: 'merge'; other: string; otherSha: string }
  | {
      kind: 'rebase';
      branch: string;
      onto: string;
      ontoSha: string;
      commitSha: string;
      commitMessage: string;
    };

export interface RepoState {
  lessonId: string;
  /** Branch HEAD points at, or null while a rebase has HEAD detached. */
  branch: string | null;
  branches: string[];
  headSha: string;
  op: Operation | null;
  files: Record<string, RepoFile>;
  /** Newest first, as `git log --oneline` prints them. */
  log: Commit[];
  /** Commits on the other side, shown by `git log --merge`. */
  otherLog: Commit[];
  tests: 'not-run' | 'failing' | 'passing' | null;
  lockfileRegenerated: boolean;
  nextSha: number;
}

export interface CommandStep {
  kind: 'command';
  instruction: string;
  hint: string;
  /** The command the Run button types. */
  command: string;
  /** Explanation shown when the step completes. */
  explanation: string;
  done: (cmd: string, before: RepoState, after: RepoState) => boolean;
}

export interface EditStep {
  kind: 'edit';
  file: string;
  instruction: string;
  hint: string;
  explanation: string;
  /** A correct result, for the "Show a solution" button. */
  solution: string;
  /** Null when the content is acceptable, otherwise what is wrong with it. */
  validate: (content: string) => string | null;
}

export type Step = CommandStep | EditStep;

export interface Lesson {
  id: string;
  title: string;
  description: string;
  icon: 'markers' | 'edit' | 'side' | 'rebase' | 'abort' | 'bug';
  /** Lines already in the terminal when the lesson opens. */
  intro: OutputLine[];
  /** The file shown in the editor first. */
  focusFile: string;
  initial: () => RepoState;
  steps: Step[];
}

export interface ExecuteResult {
  state: RepoState;
  lines: OutputLine[];
  clear?: boolean;
}

const MARKER = /^(<<<<<<<|=======|>>>>>>>)( |$)/m;

export function hasMarkers(content: string): boolean {
  return MARKER.test(content);
}

/** Which side of a conflict each line is on, for highlighting. */
export type LineSide = 'plain' | 'ours' | 'theirs' | 'marker-ours' | 'marker-sep' | 'marker-theirs';

export function classifyLines(content: string): { text: string; side: LineSide }[] {
  let side: 'plain' | 'ours' | 'theirs' = 'plain';
  return content.split('\n').map((text) => {
    if (text.startsWith('<<<<<<<')) {
      side = 'ours';
      return { text, side: 'marker-ours' as const };
    }
    if (text.startsWith('=======') && side === 'ours') {
      side = 'theirs';
      return { text, side: 'marker-sep' as const };
    }
    if (text.startsWith('>>>>>>>') && side === 'theirs') {
      side = 'plain';
      return { text, side: 'marker-theirs' as const };
    }
    return { text, side };
  });
}

function clone(state: RepoState): RepoState {
  return {
    ...state,
    branches: [...state.branches],
    op: state.op ? { ...state.op } : null,
    files: Object.fromEntries(Object.entries(state.files).map(([k, v]) => [k, { ...v }])),
    log: state.log.map((c) => ({ ...c })),
    otherLog: state.otherLog.map((c) => ({ ...c })),
  };
}

function newSha(state: RepoState): string {
  const shas = ['5d2c8e1', '8a1b2c3', '5e6f7a8', 'b7c9d20', 'c3e4f51', 'd81a6b9'];
  const sha = shas[state.nextSha % shas.length];
  state.nextSha += 1;
  return sha;
}

function withTrailingNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

const CONFIG_BASE = `service: api
timeout: 30
retries: 3
`;
const CONFIG_OURS = `service: api
timeout: 45
retries: 3
`;
const CONFIG_THEIRS = `service: api
timeout: 60
retries: 3
`;
const CONFIG_CONFLICTED = `service: api
<<<<<<< HEAD
timeout: 45
=======
timeout: 60
>>>>>>> feature/retry
retries: 3
`;

const REQ_BASE = `flask==3.0.3
gunicorn==22.0.0
`;
const REQ_OURS = `flask==3.0.3
redis==5.0.8
gunicorn==22.0.0
`;
const REQ_THEIRS = `flask==3.0.3
prometheus-client==0.20.0
gunicorn==22.0.0
`;
const REQ_CONFLICTED = `flask==3.0.3
<<<<<<< HEAD
redis==5.0.8
=======
prometheus-client==0.20.0
>>>>>>> feature/metrics
gunicorn==22.0.0
`;
const REQ_SOLUTION = `flask==3.0.3
redis==5.0.8
prometheus-client==0.20.0
gunicorn==22.0.0
`;

const LOCK_BASE = `{
  "name": "dashboard",
  "lockfileVersion": 3,
  "packages": {
    "node_modules/react": {
      "version": "18.3.1",
      "integrity": "sha512-wS+hAgJShR0Kh..."
    }
  }
}
`;
const LOCK_OURS = `{
  "name": "dashboard",
  "lockfileVersion": 3,
  "packages": {
    "node_modules/date-fns": {
      "version": "3.6.0",
      "integrity": "sha512-fRHTG8g/Gif+k..."
    },
    "node_modules/react": {
      "version": "18.3.1",
      "integrity": "sha512-wS+hAgJShR0Kh..."
    }
  }
}
`;
const LOCK_THEIRS = `{
  "name": "dashboard",
  "lockfileVersion": 3,
  "packages": {
    "node_modules/chart.js": {
      "version": "4.4.4",
      "integrity": "sha512-emICKGBABnxh..."
    },
    "node_modules/react": {
      "version": "18.3.1",
      "integrity": "sha512-wS+hAgJShR0Kh..."
    }
  }
}
`;
const LOCK_CONFLICTED = `{
  "name": "dashboard",
  "lockfileVersion": 3,
  "packages": {
<<<<<<< HEAD
    "node_modules/date-fns": {
      "version": "3.6.0",
      "integrity": "sha512-fRHTG8g/Gif+k..."
=======
    "node_modules/chart.js": {
      "version": "4.4.4",
      "integrity": "sha512-emICKGBABnxh..."
>>>>>>> feature/charts
    },
    "node_modules/react": {
      "version": "18.3.1",
      "integrity": "sha512-wS+hAgJShR0Kh..."
    }
  }
}
`;
const LOCK_REGENERATED = `{
  "name": "dashboard",
  "lockfileVersion": 3,
  "packages": {
    "node_modules/chart.js": {
      "version": "4.4.4",
      "integrity": "sha512-emICKGBABnxh..."
    },
    "node_modules/date-fns": {
      "version": "3.6.0",
      "integrity": "sha512-fRHTG8g/Gif+k..."
    },
    "node_modules/react": {
      "version": "18.3.1",
      "integrity": "sha512-wS+hAgJShR0Kh..."
    }
  }
}
`;
const PACKAGE_JSON_MERGED = `{
  "name": "dashboard",
  "dependencies": {
    "chart.js": "^4.4.4",
    "date-fns": "^3.6.0",
    "react": "^18.3.1"
  }
}
`;

const APP_BASE = `from flask import Flask

app = Flask(__name__)


@app.get("/health")
def health():
    return {"status": "ok"}
`;
const APP_OURS = `from flask import Flask

from app.version import VERSION

app = Flask(__name__)


@app.get("/health")
def health():
    return {"status": "ok", "version": VERSION}
`;
const APP_THEIRS = `from flask import Flask

from app.limits import limiter

app = Flask(__name__)


@app.get("/health")
@limiter.exempt
def health():
    return {"status": "ok"}
`;
const APP_CONFLICTED = `from flask import Flask

<<<<<<< HEAD
from app.version import VERSION
=======
from app.limits import limiter
>>>>>>> 7c1e2a9 (Exempt health check from rate limiting)

app = Flask(__name__)


@app.get("/health")
<<<<<<< HEAD
def health():
    return {"status": "ok", "version": VERSION}
=======
@limiter.exempt
def health():
    return {"status": "ok"}
>>>>>>> 7c1e2a9 (Exempt health check from rate limiting)
`;

const RELEASE_FILES = [
  'CHANGELOG.md',
  'Dockerfile',
  'api/routes.py',
  'api/settings.py',
  'charts/api/values.yaml',
  'requirements.txt',
];

const SETTINGS_PY = `import os


def get_request_timeout():
    return float(os.environ.get("REQUEST_TIMEOUT", "30"))
`;
const WORKER_THEIRS = `import time

from app import queue, settings


def poll_forever():
    while True:
        job = queue.pop(timeout=settings.get_timeout())
        if job:
            job.run()
        time.sleep(0.1)
`;
const WORKER_FIXED = WORKER_THEIRS.replace(
  'settings.get_timeout()',
  'settings.get_request_timeout()'
);

function file(path: string, content: string, status: FileStatus = 'clean'): RepoFile {
  return { path, content, status, head: content };
}

function conflict(
  path: string,
  base: string,
  ours: string,
  theirs: string,
  conflicted: string
): RepoFile {
  return {
    path,
    content: conflicted,
    status: 'unmerged',
    base,
    ours,
    theirs,
    conflicted,
    head: ours,
  };
}

function baseState(lessonId: string, partial: Partial<RepoState>): RepoState {
  return {
    lessonId,
    branch: 'main',
    branches: ['main'],
    headSha: 'e41c9d2',
    op: null,
    files: {},
    log: [],
    otherLog: [],
    tests: null,
    lockfileRegenerated: false,
    nextSha: 0,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const HELP = `Commands in this lab:
  git status | git diff [--cached] | git log [--oneline] [--merge]
  git show :1:<file> | :2:<file> | :3:<file>     (base, ours, theirs)
  git add <file> | git commit [-m "msg" | --no-edit]
  git merge <branch> | git merge --abort | git merge --continue
  git checkout --ours|--theirs <file>  (or git restore --ours|--theirs)
  git checkout -m <file>               (put the conflict markers back)
  git rebase --continue | --abort | --skip
  cat <file> | ls | npm install | make test | clear
Edit files in the editor and press Save.`;

function tokenize(cmd: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd)) !== null) tokens.push(m[1] ?? m[2] ?? m[3]);
  return tokens;
}

function statusOutput(state: RepoState): string {
  const files = Object.values(state.files);
  const unmerged = files.filter((f) => f.status === 'unmerged');
  const staged = files.filter((f) => f.status === 'staged');
  const modified = files.filter((f) => f.status === 'modified');
  const untracked = files.filter((f) => f.status === 'new');
  const out: string[] = [];

  if (state.op?.kind === 'rebase') {
    out.push(`rebase in progress; onto ${state.op.ontoSha}`);
    out.push(`You are currently rebasing branch '${state.op.branch}' on '${state.op.ontoSha}'.`);
    if (unmerged.length) {
      out.push('  (fix conflicts and then run "git rebase --continue")');
      out.push('  (use "git rebase --skip" to skip this patch)');
      out.push('  (use "git rebase --abort" to check out the original branch)');
    } else {
      out.push('  (all conflicts fixed: run "git rebase --continue")');
    }
  } else {
    out.push(`On branch ${state.branch}`);
    if (state.op?.kind === 'merge') {
      if (unmerged.length) {
        out.push('You have unmerged paths.');
        out.push('  (fix conflicts and run "git commit")');
        out.push('  (use "git merge --abort" to abort the merge)');
      } else {
        out.push('All conflicts fixed but you are still merging.');
        out.push('  (use "git commit" to conclude merge)');
      }
    }
  }

  if (staged.length) {
    out.push('', 'Changes to be committed:');
    for (const f of staged) out.push(`\tmodified:   ${f.path}`);
  }
  if (unmerged.length) {
    out.push('', 'Unmerged paths:', '  (use "git add <file>..." to mark resolution)');
    for (const f of unmerged) out.push(`\tboth modified:   ${f.path}`);
  }
  if (modified.length) {
    out.push(
      '',
      'Changes not staged for commit:',
      '  (use "git add <file>..." to update what will be committed)'
    );
    for (const f of modified) out.push(`\tmodified:   ${f.path}`);
  }
  if (untracked.length) {
    out.push('', 'Untracked files:');
    for (const f of untracked) out.push(`\t${f.path}`);
  }
  if (!staged.length && !unmerged.length && !modified.length && !untracked.length && !state.op) {
    out.push('nothing to commit, working tree clean');
  } else if (unmerged.length && !staged.length) {
    out.push('', 'no changes added to commit (use "git add" and/or "git commit -a")');
  }
  return out.join('\n');
}

/** Combined diff of a conflicted file: first column is ours, second is theirs. */
function combinedDiff(f: RepoFile): string {
  const lines = classifyLines(f.content.replace(/\n$/, ''));
  const count = (text?: string) => (text ? text.replace(/\n$/, '').split('\n').length : 0);
  const body = lines.map(({ text, side }) => {
    if (side.startsWith('marker')) return `++${text}`;
    if (side === 'ours') return ` +${text}`;
    if (side === 'theirs') return `+ ${text}`;
    return `  ${text}`;
  });
  return [
    `diff --cc ${f.path}`,
    `index 7d3e5b2,c41a9f0..0000000`,
    `--- a/${f.path}`,
    `+++ b/${f.path}`,
    `@@@ -1,${count(f.ours)} -1,${count(f.theirs)} +1,${lines.length} @@@`,
    ...body,
  ].join('\n');
}

/** A plain unified diff of two versions, one hunk, from a line LCS. */
export function unifiedDiff(path: string, before: string, after: string): string {
  const a = before.replace(/\n$/, '').split('\n');
  const b = after.replace(/\n$/, '').split('\n');
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const body: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      body.push(` ${a[i]}`);
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || dp[i][j + 1] >= dp[i + 1][j])) {
      body.push(`+${b[j]}`);
      j++;
    } else {
      body.push(`-${a[i]}`);
      i++;
    }
  }
  return [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,${a.length} +1,${b.length} @@`,
    ...body,
  ].join('\n');
}

function logLine(c: Commit): string {
  return `${c.sha}${c.refs ? ` (${c.refs})` : ''} ${c.message}`;
}

function takeSide(state: RepoState, path: string, side: 'ours' | 'theirs'): OutputLine[] {
  const f = state.files[path];
  if (!f)
    return [
      {
        type: 'error',
        content: `error: pathspec '${path}' did not match any file(s) known to git`,
      },
    ];
  if (f.ours === undefined || f.theirs === undefined) {
    return [
      {
        type: 'error',
        content: `error: path '${path}' does not have ${side === 'ours' ? 'our' : 'their'} version`,
      },
    ];
  }
  f.content = side === 'ours' ? f.ours : f.theirs;
  if (f.status !== 'unmerged') f.status = 'modified';
  const lines: OutputLine[] = [{ type: 'output', content: 'Updated 1 path from the index' }];
  if (state.op?.kind === 'rebase') {
    lines.push({
      type: 'note',
      content:
        side === 'ours'
          ? `That is ${state.op.onto}'s version. During a rebase, --ours is the branch you are replaying onto; your own commit is --theirs.`
          : `That is your commit ${state.op.commitSha}'s version. During a rebase, your commit is --theirs.`,
    });
  } else if (state.op?.kind === 'merge') {
    lines.push({
      type: 'note',
      content:
        side === 'ours'
          ? `That is ${state.branch}'s version, the branch you are on.`
          : `That is ${state.op.other}'s version, the branch being merged in.`,
    });
  }
  return lines;
}

function commit(state: RepoState, message: string | null): OutputLine[] {
  const files = Object.values(state.files);
  if (files.some((f) => f.status === 'unmerged')) {
    return [
      {
        type: 'error',
        content:
          "error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.",
      },
    ];
  }
  if (state.op?.kind === 'rebase') {
    return [
      {
        type: 'note',
        content:
          'You are in the middle of a rebase. Use git rebase --continue to commit this step.',
      },
    ];
  }
  const staged = files.filter((f) => f.status === 'staged');
  if (state.op?.kind !== 'merge' && staged.length === 0) {
    return [
      {
        type: 'output',
        content: `On branch ${state.branch}\nnothing to commit, working tree clean`,
      },
    ];
  }
  const merging = state.op?.kind === 'merge' ? state.op : null;
  const msg = message ?? (merging ? `Merge branch '${merging.other}'` : null);
  if (!msg) {
    return [
      {
        type: 'error',
        content: 'Aborting commit due to empty commit message. (Use git commit -m "message".)',
      },
    ];
  }
  const sha = newSha(state);
  for (const f of files) {
    if (f.status === 'staged' || f.status === 'modified') {
      if (f.status === 'staged') {
        f.head = f.content;
        f.status = 'clean';
      }
    }
    delete f.base;
    delete f.ours;
    delete f.theirs;
    delete f.conflicted;
  }
  state.log = [
    { sha, message: msg, refs: `HEAD -> ${state.branch}` },
    ...state.log.map((c) => ({
      ...c,
      refs: c.refs?.replace(`HEAD -> ${state.branch}`, '').replace(/^, /, '') || undefined,
    })),
  ];
  state.headSha = sha;
  state.op = null;
  const lines: OutputLine[] = [];
  if (merging && message === null) {
    lines.push({
      type: 'note',
      content: 'Git would open your editor with the default merge message; the lab keeps it.',
    });
  }
  lines.push({ type: 'output', content: `[${state.branch} ${sha}] ${msg}` });
  return lines;
}

export function execute(cmd: string, current: RepoState): ExecuteResult {
  const state = clone(current);
  const t = tokenize(cmd.trim());
  const out = (content: string, type: LineType = 'output'): ExecuteResult => ({
    state,
    lines: [{ type, content }],
  });
  if (t.length === 0) return { state, lines: [] };

  const [prog, sub, ...rest] = t;

  if (prog === 'clear') return { state, lines: [], clear: true };
  if (prog === 'help') return out(HELP);
  if (prog === 'ls') {
    return out(
      Object.keys(state.files)
        .filter((p) => !p.includes('/'))
        .sort()
        .join('  ') || '(empty)'
    );
  }
  if (prog === 'cat') {
    if (!sub) return out('usage: cat <file>', 'error');
    const f = state.files[sub];
    if (!f) return out(`cat: ${sub}: No such file or directory`, 'error');
    return out(f.content.replace(/\n$/, ''));
  }
  if (prog === 'npm' && (sub === 'install' || sub === 'i')) {
    const lock = state.files['package-lock.json'];
    if (!lock) return out('npm error code ENOENT: no package.json in this repository', 'error');
    if (lock.status === 'unmerged' && hasMarkers(lock.content)) {
      return out(
        'npm error code EJSONPARSE\nnpm error JSON.parse Unexpected token "<" (0x3C) in JSON at position 94 while parsing near "...\\n  \\"packages\\": {\\n<<<<<<< HEAD..."\nnpm error JSON.parse Failed to parse JSON data.',
        'error'
      );
    }
    lock.content = LOCK_REGENERATED;
    state.lockfileRegenerated = true;
    return out('added 1 package, and audited 214 packages in 3s\n\nfound 0 vulnerabilities');
  }
  if (prog === 'make' && sub === 'test') return runTests(state);
  if (prog === 'pytest' || (prog === 'python' && sub === '-m' && rest[0] === 'pytest'))
    return runTests(state);

  if (prog !== 'git') {
    return out(`${prog}: command not found (type help for what this lab supports)`, 'error');
  }

  switch (sub) {
    case 'status':
      return out(statusOutput(state));

    case 'branch':
      return out(
        state.branch === null && state.op?.kind === 'rebase'
          ? [
              `* (no branch, rebasing ${state.op.branch})`,
              ...state.branches.map((b) => `  ${b}`),
            ].join('\n')
          : state.branches.map((b) => `${b === state.branch ? '*' : ' '} ${b}`).join('\n')
      );

    case 'log': {
      if (rest.includes('--merge')) {
        if (state.op?.kind !== 'merge')
          return out('fatal: --merge requires one of the pseudorefs MERGE_HEAD', 'error');
        return out(
          [...state.log.slice(0, 1), ...state.otherLog.slice(0, 1)].map(logLine).join('\n')
        );
      }
      return out(state.log.slice(0, 5).map(logLine).join('\n'));
    }

    case 'show': {
      const m = rest[0]?.match(/^:([123]):(.+)$/);
      if (!m) return out('This lab supports git show :1:<file>, :2:<file> and :3:<file>.', 'note');
      const f = state.files[m[2]];
      if (!f)
        return out(
          `fatal: path '${m[2]}' does not exist (neither on disk nor in the index)`,
          'error'
        );
      const stage = m[1] === '1' ? f.base : m[1] === '2' ? f.ours : f.theirs;
      if (f.status !== 'unmerged' || stage === undefined) {
        return out(`fatal: path '${m[2]}' is in the index, but not at stage ${m[1]}`, 'error');
      }
      return out(stage.replace(/\n$/, ''));
    }

    case 'diff': {
      const cached = rest.includes('--cached') || rest.includes('--staged');
      const target = rest.find((r) => !r.startsWith('-'));
      const files = Object.values(state.files).filter((f) => !target || f.path === target);
      const parts: string[] = [];
      for (const f of files) {
        if (cached) {
          if (f.status === 'staged' && f.head !== undefined && f.head !== f.content) {
            parts.push(unifiedDiff(f.path, f.head, f.content));
          }
        } else if (f.status === 'unmerged') {
          parts.push(
            hasMarkers(f.content) ? combinedDiff(f) : unifiedDiff(f.path, f.ours ?? '', f.content)
          );
        } else if ((f.status === 'modified' || f.status === 'new') && f.head !== f.content) {
          parts.push(unifiedDiff(f.path, f.head ?? '', f.content));
        }
      }
      return out(parts.join('\n'));
    }

    case 'add': {
      const targets = rest.includes('.') || rest.includes('-A') ? Object.keys(state.files) : rest;
      if (targets.length === 0) return out('Nothing specified, nothing added.', 'note');
      const lines: OutputLine[] = [];
      for (const path of targets) {
        const f = state.files[path];
        if (!f) {
          lines.push({
            type: 'error',
            content: `fatal: pathspec '${path}' did not match any files`,
          });
          continue;
        }
        if (f.status === 'unmerged' || f.status === 'modified' || f.status === 'new') {
          if (hasMarkers(f.content)) {
            lines.push({
              type: 'note',
              content: `Git staged ${path} with the conflict markers still in it. Git does not check. Fix the file and add it again, or run git checkout -m ${path} to start over.`,
            });
          }
          f.status = 'staged';
        }
      }
      return { state, lines };
    }

    case 'commit': {
      if (rest.includes('-a') || rest.includes('-am')) {
        for (const f of Object.values(state.files))
          if (f.status === 'modified') f.status = 'staged';
      }
      const mIndex = rest.findIndex((r) => r === '-m' || r === '-am');
      const message = mIndex >= 0 ? (rest[mIndex + 1] ?? '') : null;
      if (mIndex >= 0 && !message) return out("error: switch `m' requires a value", 'error');
      const lines = commit(state, message);
      return { state, lines };
    }

    case 'merge': {
      if (rest[0] === '--abort') {
        if (state.op?.kind !== 'merge')
          return out('fatal: There is no merge to abort (MERGE_HEAD missing).', 'error');
        for (const f of Object.values(state.files)) {
          if (f.head !== undefined) f.content = f.head;
          f.status = 'clean';
          delete f.base;
          delete f.ours;
          delete f.theirs;
          delete f.conflicted;
        }
        state.op = null;
        state.otherLog = [];
        return { state, lines: [] };
      }
      if (rest[0] === '--continue') {
        if (state.op?.kind !== 'merge')
          return out('fatal: There is no merge in progress (MERGE_HEAD missing).', 'error');
        return { state, lines: commit(state, null) };
      }
      if (state.op)
        return out('error: Merging is not possible because you have unmerged files.', 'error');
      if (
        rest[0] === 'feature/worker' &&
        state.lessonId === 'semantic-conflict' &&
        !state.files['worker.py']
      ) {
        state.files['worker.py'] = {
          path: 'worker.py',
          content: WORKER_THEIRS,
          status: 'clean',
          head: WORKER_THEIRS,
        };
        const sha = newSha(state);
        state.log = [
          { sha, message: "Merge branch 'feature/worker'", refs: 'HEAD -> main' },
          ...state.log.map((c) => ({ ...c, refs: undefined })),
        ];
        state.headSha = sha;
        state.tests = 'not-run';
        return out(
          "Merge made by the 'ort' strategy.\n worker.py | 11 +++++++++++\n 1 file changed, 11 insertions(+)\n create mode 100644 worker.py"
        );
      }
      if (rest[0] && state.branches.includes(rest[0])) return out('Already up to date.');
      return out(`merge: ${rest[0] ?? ''} - not something we can merge`, 'error');
    }

    case 'checkout':
    case 'restore': {
      const side = rest.includes('--ours') ? 'ours' : rest.includes('--theirs') ? 'theirs' : null;
      const remerge = rest.includes('-m') || rest.includes('--merge');
      const path = rest.filter((r) => !r.startsWith('-')).pop();
      if (!path) return out(`usage: git ${sub} --ours|--theirs|-m <file>`, 'error');
      const f = state.files[path];
      if (!f)
        return out(`error: pathspec '${path}' did not match any file(s) known to git`, 'error');
      if (remerge) {
        if (!f.conflicted) return out(`error: path '${path}' has no conflict to recreate`, 'error');
        f.content = f.conflicted;
        f.status = 'unmerged';
        return out(`Recreated 1 merge conflict`);
      }
      if (side) return { state, lines: takeSide(state, path, side) };
      return out(`This lab supports git ${sub} --ours, --theirs and -m.`, 'note');
    }

    case 'rebase': {
      const op = state.op;
      if (rest[0] === '--continue') {
        if (op?.kind !== 'rebase') return out('fatal: No rebase in progress?', 'error');
        const unmerged = Object.values(state.files).filter((f) => f.status === 'unmerged');
        if (unmerged.length) {
          return out(
            `${unmerged.map((f) => `${f.path}: needs merge`).join('\n')}\nYou must edit all merge conflicts and then\nmark them as resolved using git add`,
            'error'
          );
        }
        const sha = newSha(state);
        for (const f of Object.values(state.files)) {
          f.head = f.content;
          f.status = 'clean';
          delete f.base;
          delete f.ours;
          delete f.theirs;
          delete f.conflicted;
        }
        state.log = [
          { sha, message: op.commitMessage, refs: `HEAD -> ${op.branch}` },
          ...state.log.map((c) => ({ ...c, refs: c.refs?.replace(/^HEAD, /, '') })),
        ];
        state.branch = op.branch;
        state.headSha = sha;
        state.op = null;
        return out(
          `[detached HEAD ${sha}] ${op.commitMessage}\n 1 file changed, 3 insertions(+), 1 deletion(-)\nSuccessfully rebased and updated refs/heads/${op.branch}.`
        );
      }
      if (rest[0] === '--abort') {
        if (op?.kind !== 'rebase') return out('fatal: No rebase in progress?', 'error');
        for (const f of Object.values(state.files)) {
          if (f.theirs !== undefined) f.content = f.theirs;
          f.head = f.content;
          f.status = 'clean';
          delete f.base;
          delete f.ours;
          delete f.theirs;
          delete f.conflicted;
        }
        state.branch = op.branch;
        state.op = null;
        return out('');
      }
      if (rest[0] === '--skip') {
        return out(
          `Skipping would drop your commit ${op?.kind === 'rebase' ? op.commitSha : ''} from the branch. The lab stops here so you can resolve it instead.`,
          'note'
        );
      }
      return out('This lab supports git rebase --continue, --abort and --skip.', 'note');
    }

    default:
      return out(`git ${sub ?? ''} is not part of this lab. Type help.`, 'note');
  }
}

function runTests(state: RepoState): ExecuteResult {
  const worker = state.files['worker.py'];
  if (!worker) {
    return {
      state,
      lines: [
        {
          type: 'output',
          content:
            'python -m pytest -q\n...                                                                      [100%]\n3 passed in 0.31s',
        },
      ],
    };
  }
  if (/get_timeout\(/.test(worker.content)) {
    state.tests = 'failing';
    return {
      state,
      lines: [
        {
          type: 'error',
          content:
            "python -m pytest -q\n...F                                                                     [100%]\nFAILED tests/test_worker.py::test_poll_forever - AttributeError: module 'app.settings' has no attribute 'get_timeout'\n1 failed, 3 passed in 0.41s\nmake: *** [Makefile:4: test] Error 1",
        },
      ],
    };
  }
  state.tests = 'passing';
  return {
    state,
    lines: [
      {
        type: 'output',
        content:
          'python -m pytest -q\n....                                                                     [100%]\n4 passed in 0.38s',
      },
    ],
  };
}

/** Write the editor's content to the working tree. */
export function saveFile(current: RepoState, path: string, content: string): RepoState {
  const state = clone(current);
  const f = state.files[path];
  if (!f) return state;
  f.content = withTrailingNewline(content);
  if (f.status === 'clean' || f.status === 'staged') {
    f.status = f.content === f.head ? 'clean' : 'modified';
  }
  if (f.status === 'modified' && state.lessonId === 'semantic-conflict' && path === 'worker.py') {
    state.tests = state.tests === 'passing' ? 'not-run' : state.tests;
  }
  return state;
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

const isCmd = (cmd: string, ...forms: RegExp[]) => forms.some((re) => re.test(cmd.trim()));

function requireLines(content: string, required: { line: string; from: string }[]): string | null {
  if (hasMarkers(content))
    return 'The file still has conflict markers (<<<<<<<, =======, >>>>>>>). Remove them.';
  const lines = content.split('\n').map((l) => l.trim());
  for (const r of required) {
    if (!lines.includes(r.line)) return `${r.line} is missing. It came from ${r.from}.`;
  }
  return null;
}

export const LESSONS: Lesson[] = [
  {
    id: 'read-markers',
    title: 'Read the conflict',
    description: 'What <<<<<<<, ======= and >>>>>>> delimit, and which side is which.',
    icon: 'markers',
    focusFile: 'config.yaml',
    intro: [
      { type: 'input', content: 'git merge feature/retry' },
      {
        type: 'output',
        content:
          'Auto-merging config.yaml\nCONFLICT (content): Merge conflict in config.yaml\nAutomatic merge failed; fix conflicts and then commit the result.',
      },
    ],
    initial: () =>
      baseState('read-markers', {
        branches: ['feature/retry', 'main'],
        op: { kind: 'merge', other: 'feature/retry', otherSha: '9b27c40' },
        files: {
          'config.yaml': conflict(
            'config.yaml',
            CONFIG_BASE,
            CONFIG_OURS,
            CONFIG_THEIRS,
            CONFIG_CONFLICTED
          ),
          'README.md': file('README.md', '# api\n'),
        },
        log: [
          { sha: 'e41c9d2', message: 'Raise API timeout to 45s', refs: 'HEAD -> main' },
          { sha: '3f0a1b7', message: 'Add retries setting' },
        ],
        otherLog: [
          {
            sha: '9b27c40',
            message: 'Raise timeout to 60s for slow retries',
            refs: 'feature/retry',
          },
        ],
      }),
    steps: [
      {
        kind: 'command',
        instruction: 'The merge stopped. Ask Git what state the repository is in.',
        hint: 'git status',
        command: 'git status',
        explanation:
          'config.yaml is under "Unmerged paths" as both modified: main and feature/retry each changed the same line since the commit they share. The merge is paused, not failed.',
        done: (cmd) => isCmd(cmd, /^git status$/),
      },
      {
        kind: 'command',
        instruction: 'Print config.yaml and look at the markers Git wrote into it.',
        hint: 'cat config.yaml',
        command: 'cat config.yaml',
        explanation:
          '<<<<<<< HEAD opens your side: the branch you are on, main. ======= separates the two sides. >>>>>>> feature/retry closes the side being merged in. Lines outside the markers merged cleanly.',
        done: (cmd) => isCmd(cmd, /^cat config\.yaml$/),
      },
      {
        kind: 'command',
        instruction:
          'Show the common ancestor: the version both branches started from (index stage 1).',
        hint: 'git show :1:config.yaml',
        command: 'git show :1:config.yaml',
        explanation:
          'While a file is unmerged, the index holds three versions of it: stage 1 is the common ancestor, stage 2 is ours (HEAD), stage 3 is theirs. The base had timeout: 30, so main raised it to 45 and feature/retry to 60.',
        done: (cmd) => isCmd(cmd, /^git show :1:config\.yaml$/),
      },
      {
        kind: 'command',
        instruction: "Now show feature/retry's version of the file, stage 3.",
        hint: 'git show :3:config.yaml',
        command: 'git show :3:config.yaml',
        explanation:
          'Stage 3 is "theirs": the whole file as feature/retry has it. git show :2:config.yaml shows main\'s. The markers in the working file are just these versions written side by side.',
        done: (cmd) => isCmd(cmd, /^git show :3:config\.yaml$/),
      },
      {
        kind: 'command',
        instruction: 'Look at the conflict as Git diffs it.',
        hint: 'git diff',
        command: 'git diff',
        explanation:
          'During a conflict, git diff prints a combined diff with two columns of + and -. The first column compares with ours, the second with theirs. That is why every marker line starts with ++.',
        done: (cmd) => isCmd(cmd, /^git diff( config\.yaml)?$/),
      },
    ],
  },
  {
    id: 'resolve-by-editing',
    title: 'Resolve by editing',
    description: 'Resolving means writing the file you want, not picking a side.',
    icon: 'edit',
    focusFile: 'requirements.txt',
    intro: [
      { type: 'input', content: 'git merge feature/metrics' },
      {
        type: 'output',
        content:
          'Auto-merging requirements.txt\nCONFLICT (content): Merge conflict in requirements.txt\nAutomatic merge failed; fix conflicts and then commit the result.',
      },
    ],
    initial: () =>
      baseState('resolve-by-editing', {
        headSha: 'a07c3e5',
        branches: ['feature/metrics', 'main'],
        op: { kind: 'merge', other: 'feature/metrics', otherSha: '2c9d1f4' },
        files: {
          'requirements.txt': conflict(
            'requirements.txt',
            REQ_BASE,
            REQ_OURS,
            REQ_THEIRS,
            REQ_CONFLICTED
          ),
          'app.py': file('app.py', 'from flask import Flask\n'),
        },
        log: [
          { sha: 'a07c3e5', message: 'Cache sessions in Redis', refs: 'HEAD -> main' },
          { sha: '61b0e2d', message: 'Pin gunicorn' },
        ],
        otherLog: [
          { sha: '2c9d1f4', message: 'Export Prometheus metrics', refs: 'feature/metrics' },
        ],
      }),
    steps: [
      {
        kind: 'edit',
        file: 'requirements.txt',
        instruction:
          'main added redis and feature/metrics added prometheus-client, on the same line. The project needs both. Edit requirements.txt in the editor so it lists all four packages with no markers, then Save.',
        hint: 'Delete the three marker lines and keep both redis==5.0.8 and prometheus-client==0.20.0.',
        explanation:
          'Neither side alone was right. A resolution is whatever the file should be after the merge: here both additions, which neither --ours nor --theirs would give you.',
        solution: REQ_SOLUTION,
        validate: (content) =>
          requireLines(content, [
            { line: 'flask==3.0.3', from: 'both sides' },
            { line: 'redis==5.0.8', from: 'main (ours)' },
            { line: 'prometheus-client==0.20.0', from: 'feature/metrics (theirs)' },
            { line: 'gunicorn==22.0.0', from: 'both sides' },
          ]),
      },
      {
        kind: 'command',
        instruction: 'Mark the conflict as resolved by staging the file.',
        hint: 'git add requirements.txt',
        command: 'git add requirements.txt',
        explanation:
          'git add is how you tell Git a conflict is resolved: it replaces the three index stages with the one version you staged. Git does not check the content, so it would stage markers too.',
        done: (cmd, _b, after) =>
          isCmd(cmd, /^git add (requirements\.txt|\.|-A)$/) &&
          after.files['requirements.txt'].status === 'staged' &&
          !hasMarkers(after.files['requirements.txt'].content),
      },
      {
        kind: 'command',
        instruction: 'Check the status again before committing.',
        hint: 'git status',
        command: 'git status',
        explanation:
          '"All conflicts fixed but you are still merging": the merge is ready to be concluded with a commit.',
        done: (cmd) => isCmd(cmd, /^git status$/),
      },
      {
        kind: 'command',
        instruction: 'Conclude the merge with the default merge message.',
        hint: 'git commit --no-edit',
        command: 'git commit --no-edit',
        explanation:
          'The merge commit has two parents, main and feature/metrics, and records your resolution. That is the whole job: edit, add, commit.',
        done: (_cmd, before, after) =>
          before.op?.kind === 'merge' && after.op === null && after.log.length > before.log.length,
      },
    ],
  },
  {
    id: 'ours-theirs',
    title: 'Take a whole side',
    description: 'git checkout --ours and --theirs, and why lockfiles are regenerated, not edited.',
    icon: 'side',
    focusFile: 'package-lock.json',
    intro: [
      { type: 'input', content: 'git merge feature/charts' },
      {
        type: 'output',
        content:
          'Auto-merging package.json\nAuto-merging package-lock.json\nCONFLICT (content): Merge conflict in package-lock.json\nAutomatic merge failed; fix conflicts and then commit the result.',
      },
    ],
    initial: () =>
      baseState('ours-theirs', {
        headSha: 'f3a8d61',
        branches: ['feature/charts', 'main'],
        op: { kind: 'merge', other: 'feature/charts', otherSha: '0d4be97' },
        files: {
          'package.json': { ...file('package.json', PACKAGE_JSON_MERGED), status: 'staged' },
          'package-lock.json': conflict(
            'package-lock.json',
            LOCK_BASE,
            LOCK_OURS,
            LOCK_THEIRS,
            LOCK_CONFLICTED
          ),
        },
        log: [
          { sha: 'f3a8d61', message: 'Format dates with date-fns', refs: 'HEAD -> main' },
          { sha: '44e1c0a', message: 'Upgrade React to 18.3' },
        ],
        otherLog: [{ sha: '0d4be97', message: 'Add usage charts', refs: 'feature/charts' }],
      }),
    steps: [
      {
        kind: 'command',
        instruction: 'See which files merged and which did not.',
        hint: 'git status',
        command: 'git status',
        explanation:
          'package.json merged cleanly and is already staged, with both new dependencies. Only the lockfile conflicts. It is generated by npm, so hand-editing it is the wrong tool.',
        done: (cmd) => isCmd(cmd, /^git status$/),
      },
      {
        kind: 'command',
        instruction:
          "Replace the lockfile with feature/charts' version, the branch you are merging in.",
        hint: 'In a merge, the branch you merge in is "theirs": git checkout --theirs package-lock.json',
        command: 'git checkout --theirs package-lock.json',
        explanation:
          'During a merge, --ours is the branch you are on (main, stage 2) and --theirs is the branch being merged in (feature/charts, stage 3). --theirs copied stage 3 into the working tree, whole.',
        done: (cmd, _b, after) =>
          isCmd(cmd, /^git (checkout|restore) --theirs package-lock\.json$/) &&
          after.files['package-lock.json'].content === LOCK_THEIRS,
      },
      {
        kind: 'command',
        instruction:
          "That lockfile is missing main's date-fns. Let npm rebuild it from the merged package.json.",
        hint: 'npm install',
        command: 'npm install',
        explanation:
          "npm rebuilds the lockfile from package.json, which already has both branches' dependencies. Taking one side and regenerating is the safe way to resolve any generated file.",
        done: (_cmd, _b, after) => after.lockfileRegenerated,
      },
      {
        kind: 'command',
        instruction: 'Stage the regenerated lockfile.',
        hint: 'git add package-lock.json',
        command: 'git add package-lock.json',
        explanation:
          'Now the index holds one version of the lockfile, with chart.js and date-fns in it.',
        done: (cmd, _b, after) =>
          isCmd(cmd, /^git add (package-lock\.json|\.|-A)$/) &&
          after.files['package-lock.json'].status === 'staged' &&
          after.lockfileRegenerated,
      },
      {
        kind: 'command',
        instruction: 'Conclude the merge.',
        hint: 'git commit --no-edit',
        command: 'git commit --no-edit',
        explanation: 'Merged, with a lockfile that npm wrote rather than a person.',
        done: (_cmd, before, after) =>
          before.op?.kind === 'merge' && after.op === null && after.log.length > before.log.length,
      },
    ],
  },
  {
    id: 'rebase-flip',
    title: 'Rebase flips ours and theirs',
    description: 'During a rebase, --ours is the other branch and --theirs is your commit.',
    icon: 'rebase',
    focusFile: 'app.py',
    intro: [
      { type: 'input', content: 'git rebase main' },
      {
        type: 'output',
        content:
          'Auto-merging app.py\nCONFLICT (content): Merge conflict in app.py\nerror: could not apply 7c1e2a9... Exempt health check from rate limiting\nhint: Resolve all conflicts manually, mark them as resolved with\nhint: "git add/rm <conflicted_files>", then run "git rebase --continue".\nhint: You can instead skip this commit: run "git rebase --skip".\nhint: To abort and get back to the state before "git rebase", run "git rebase --abort".\nCould not apply 7c1e2a9... Exempt health check from rate limiting',
      },
    ],
    initial: () =>
      baseState('rebase-flip', {
        branch: null,
        headSha: '1a2b3c4',
        branches: ['feature/rate-limit', 'main'],
        op: {
          kind: 'rebase',
          branch: 'feature/rate-limit',
          onto: 'main',
          ontoSha: '1a2b3c4',
          commitSha: '7c1e2a9',
          commitMessage: 'Exempt health check from rate limiting',
        },
        files: {
          'app.py': conflict('app.py', APP_BASE, APP_OURS, APP_THEIRS, APP_CONFLICTED),
        },
        log: [
          { sha: '1a2b3c4', message: 'Report version in health check', refs: 'HEAD, main' },
          { sha: '0f9e8d7', message: 'Add health endpoint' },
        ],
        otherLog: [],
      }),
    steps: [
      {
        kind: 'command',
        instruction:
          'You were on feature/rate-limit and ran git rebase main. Check where you are now.',
        hint: 'git status',
        command: 'git status',
        explanation:
          "You are not on your branch any more. HEAD is detached at main's tip (1a2b3c4), and Git is replaying your commit 7c1e2a9 on top of it. That is why the sides swap.",
        done: (cmd) => isCmd(cmd, /^git status$/),
      },
      {
        kind: 'command',
        instruction: 'Print app.py and read the labels on each side.',
        hint: 'cat app.py',
        command: 'cat app.py',
        explanation:
          "<<<<<<< HEAD is now main's code, because HEAD is main. The bottom side, >>>>>>> 7c1e2a9, is your own commit being replayed.",
        done: (cmd) => isCmd(cmd, /^cat app\.py$/),
      },
      {
        kind: 'command',
        instruction:
          "You decide your commit's version of app.py is the one to keep for now. Take it with a single checkout.",
        hint: 'Your commit is "theirs" during a rebase: git checkout --theirs app.py',
        command: 'git checkout --theirs app.py',
        explanation:
          'In a merge, --ours is your branch. In a rebase, --ours is the branch you are rebasing onto and --theirs is your commit. If you typed --ours by reflex, you just threw your own change away.',
        done: (cmd, _b, after) =>
          isCmd(cmd, /^git (checkout|restore) --theirs app\.py$/) &&
          after.files['app.py'].content === APP_THEIRS,
      },
      {
        kind: 'command',
        instruction: 'Mark app.py as resolved.',
        hint: 'git add app.py',
        command: 'git add app.py',
        explanation: 'Staged. The rebase can move on to the next commit.',
        done: (cmd, _b, after) =>
          isCmd(cmd, /^git add (app\.py|\.|-A)$/) &&
          after.files['app.py'].status === 'staged' &&
          after.files['app.py'].content === APP_THEIRS,
      },
      {
        kind: 'command',
        instruction: 'Let the rebase finish.',
        hint: 'git rebase --continue',
        command: 'git rebase --continue',
        explanation:
          'Your commit now sits on top of main with a new hash. A rebase is a series of small merges, one per commit, and each one can stop like this.',
        done: (_cmd, before, after) =>
          before.op?.kind === 'rebase' && after.op === null && after.log.length > before.log.length,
      },
    ],
  },
  {
    id: 'abort',
    title: 'The escape hatch',
    description: 'git merge --abort puts everything back the way it was.',
    icon: 'abort',
    focusFile: 'Dockerfile',
    intro: [
      { type: 'input', content: 'git merge release/2025.12' },
      {
        type: 'output',
        content: [
          ...RELEASE_FILES.map(
            (f) => `Auto-merging ${f}\nCONFLICT (content): Merge conflict in ${f}`
          ),
          'Automatic merge failed; fix conflicts and then commit the result.',
        ].join('\n'),
      },
    ],
    initial: () => {
      const files: Record<string, RepoFile> = {};
      for (const path of RELEASE_FILES) {
        const ours = `# ${path} on main\n`;
        const theirs = `# ${path} on release/2025.12\n`;
        files[path] = conflict(
          path,
          `# ${path}\n`,
          ours,
          theirs,
          `<<<<<<< HEAD\n# ${path} on main\n=======\n# ${path} on release/2025.12\n>>>>>>> release/2025.12\n`
        );
      }
      files.Dockerfile.conflicted =
        'FROM python:3.12-slim\n<<<<<<< HEAD\nRUN pip install --no-cache-dir -r requirements.txt\n=======\nRUN pip install -r requirements.txt && pip install gunicorn==21.2.0\n>>>>>>> release/2025.12\nCMD ["gunicorn", "app:app"]\n';
      files.Dockerfile.content = files.Dockerfile.conflicted;
      files.Dockerfile.ours =
        'FROM python:3.12-slim\nRUN pip install --no-cache-dir -r requirements.txt\nCMD ["gunicorn", "app:app"]\n';
      files.Dockerfile.head = files.Dockerfile.ours;
      files.Dockerfile.theirs =
        'FROM python:3.12-slim\nRUN pip install -r requirements.txt && pip install gunicorn==21.2.0\nCMD ["gunicorn", "app:app"]\n';
      return baseState('abort', {
        headSha: 'c0ffee1',
        branches: ['main', 'release/2025.12', 'release/2026.09'],
        op: { kind: 'merge', other: 'release/2025.12', otherSha: '8d7e6f5' },
        files,
        log: [
          { sha: 'c0ffee1', message: 'Prepare 2026.09 release', refs: 'HEAD -> main' },
          { sha: 'b1a2c3d', message: 'Bump gunicorn to 22.0.0' },
        ],
        otherLog: [{ sha: '8d7e6f5', message: 'Release 2025.12', refs: 'release/2025.12' }],
      });
    },
    steps: [
      {
        kind: 'command',
        instruction:
          'You meant to merge release/2026.09, not a release from last year. Look at the damage.',
        hint: 'git status',
        command: 'git status',
        explanation:
          'Six conflicted files, all from merging the wrong branch. None of them is worth resolving.',
        done: (cmd) => isCmd(cmd, /^git status$/),
      },
      {
        kind: 'command',
        instruction: 'Back out of the merge completely.',
        hint: 'git merge --abort',
        command: 'git merge --abort',
        explanation:
          '--abort resets the index and working tree to where they were before git merge, and removes MERGE_HEAD. It works while the merge is still in progress. git rebase --abort does the same for a rebase.',
        done: (_cmd, before, after) =>
          before.op?.kind === 'merge' &&
          after.op === null &&
          after.log.length === before.log.length,
      },
      {
        kind: 'command',
        instruction: 'Confirm the repository is back to normal.',
        hint: 'git status',
        command: 'git status',
        explanation:
          'Clean, as if the merge never happened. One caveat: if you had uncommitted changes when you started the merge, --abort may not be able to restore them, which is a good reason to commit or stash first.',
        done: (cmd, _b, after) => isCmd(cmd, /^git status$/) && after.op === null,
      },
    ],
  },
  {
    id: 'semantic-conflict',
    title: 'Clean merge, broken code',
    description: 'The conflict Git cannot see, and the one that reaches production.',
    icon: 'bug',
    focusFile: 'worker.py',
    intro: [
      {
        type: 'note',
        content:
          'main renamed settings.get_timeout() to get_request_timeout() and updated every caller. feature/worker, written last week, adds a new caller.',
      },
    ],
    initial: () =>
      baseState('semantic-conflict', {
        headSha: '9e8f7a6',
        branches: ['feature/worker', 'main'],
        files: {
          'settings.py': file('settings.py', SETTINGS_PY),
          'api.py': file(
            'api.py',
            'from app import settings\n\n\ndef call_backend(client):\n    return client.get("/items", timeout=settings.get_request_timeout())\n'
          ),
        },
        log: [
          {
            sha: '9e8f7a6',
            message: 'Rename get_timeout to get_request_timeout',
            refs: 'HEAD -> main',
          },
          { sha: '5a4b3c2', message: 'Read timeout from the environment' },
        ],
        tests: 'not-run',
      }),
    steps: [
      {
        kind: 'command',
        instruction: 'Merge feature/worker into main.',
        hint: 'git merge feature/worker',
        command: 'git merge feature/worker',
        explanation:
          'No conflict: the branches changed different files, so Git merged them without asking. Git merges text. It does not check that the code still makes sense.',
        done: (cmd, _b, after) =>
          isCmd(cmd, /^git merge feature\/worker$/) && !!after.files['worker.py'],
      },
      {
        kind: 'command',
        instruction: 'Run the tests on the merge result.',
        hint: 'make test',
        command: 'make test',
        explanation:
          'worker.py calls settings.get_timeout(), which no longer exists on main. Each branch passed its own tests; only the combination is broken.',
        done: (_cmd, _b, after) => after.tests === 'failing',
      },
      {
        kind: 'edit',
        file: 'worker.py',
        instruction: 'Fix worker.py in the editor so it calls the renamed function, then Save.',
        hint: 'Change settings.get_timeout() to settings.get_request_timeout().',
        explanation: 'One line, but no tool would have flagged it before the tests did.',
        solution: WORKER_FIXED,
        validate: (content) => {
          if (/get_timeout\(/.test(content)) return 'worker.py still calls get_timeout().';
          if (!/get_request_timeout\(/.test(content))
            return 'worker.py should call settings.get_request_timeout().';
          return null;
        },
      },
      {
        kind: 'command',
        instruction: 'Run the tests again.',
        hint: 'make test',
        command: 'make test',
        explanation: 'Green. The merge result works now, not just the two branches.',
        done: (_cmd, _b, after) => after.tests === 'passing',
      },
      {
        kind: 'command',
        instruction: 'Stage the fix.',
        hint: 'git add worker.py',
        command: 'git add worker.py',
        explanation: 'Staged.',
        done: (cmd, _b, after) =>
          isCmd(cmd, /^git add (worker\.py|\.|-A)$/) &&
          after.files['worker.py'].status === 'staged',
      },
      {
        kind: 'command',
        instruction: 'Commit it.',
        hint: 'git commit -m "Use get_request_timeout in worker"',
        command: 'git commit -m "Use get_request_timeout in worker"',
        explanation:
          'This is the conflict that reaches production: textually clean, semantically wrong. Test the merge result, not just each branch: run CI on merge commits, or use a merge queue that tests the combined code before it lands.',
        done: (_cmd, before, after) =>
          after.log.length > before.log.length && after.files['worker.py'].status === 'clean',
      },
    ],
  },
];

export const TOTAL_STEPS = LESSONS.reduce((sum, lesson) => sum + lesson.steps.length, 0);
