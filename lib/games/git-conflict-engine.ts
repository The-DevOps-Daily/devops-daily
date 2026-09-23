/**
 * Engine for the Git Merge Conflict Simulator.
 *
 * Each lesson is a small repository frozen at an interesting moment (a merge
 * or rebase stopped on a conflict, or a clean tree about to merge). The
 * engine runs a command against that state and returns the new state and the
 * terminal output, and each lesson step decides whether it is done. No real
 * Git runs. Files keep HEAD, index and working-tree content separately, the
 * way Git does, and the outputs follow what Git 2.4x prints (merge backend
 * for rebase, default "merge" conflict style).
 */

export type LineType = 'input' | 'output' | 'error' | 'success' | 'note';

export interface OutputLine {
  type: LineType;
  content: string;
}

export interface Stages {
  base?: string;
  ours?: string;
  theirs?: string;
}

export interface RepoFile {
  path: string;
  binary?: boolean;
  /** Content in HEAD, or null if the file is not in HEAD. */
  head: string | null;
  /** Stage 0 of the index; null while the path is unmerged. */
  index: string | null;
  /** The working tree. */
  content: string;
  /** Stages 1-3 while the path is unmerged. */
  stages: Stages | null;
  /** What `git checkout -m` needs to recreate the conflict after it was resolved. */
  undo: { stages: Stages; conflicted: string } | null;
}

export type FileStatus = 'unmerged' | 'staged' | 'modified' | 'clean';

export function fileStatus(f: RepoFile): FileStatus {
  if (f.stages) return 'unmerged';
  if (f.index !== f.head) return 'staged';
  if (f.content !== f.index) return 'modified';
  return 'clean';
}

/** Staged, and changed again in the working tree since. */
export function hasUnstagedChanges(f: RepoFile): boolean {
  return !f.stages && f.index !== null && f.content !== f.index;
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
      /** The branch as it was before the rebase, for --abort. */
      orig: { log: Commit[]; files: Record<string, string> };
    };

export interface RepoState {
  lessonId: string;
  /** Branch HEAD points at, or null while a rebase has HEAD detached. */
  branch: string | null;
  headSha: string;
  op: Operation | null;
  files: Record<string, RepoFile>;
  /** Newest first, as `git log --oneline` prints them. */
  log: Commit[];
  /** The other side's commits, reachable once a merge is committed. */
  otherLog: Commit[];
  tests: 'not-run' | 'failing' | 'passing' | null;
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
  /**
   * The state this step leads to. If the user already got there another way
   * (say, committed before the status check), the step counts as done.
   */
  goal?: (state: RepoState) => boolean;
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
  /** False when the command failed the way Git would fail it. */
  ok: boolean;
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
    op: state.op ? { ...state.op } : null,
    files: Object.fromEntries(
      Object.entries(state.files).map(([k, v]) => [
        k,
        {
          ...v,
          stages: v.stages ? { ...v.stages } : null,
          undo: v.undo ? { ...v.undo } : null,
        },
      ])
    ),
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

function splitLines(text: string): string[] {
  return text.replace(/\n$/, '').split('\n');
}

function diffLines(before: string, after: string): string[] {
  const a = splitLines(before);
  const b = splitLines(after);
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
  return body;
}

/** A plain unified diff of two versions, as one hunk. */
export function unifiedDiff(path: string, before: string, after: string): string {
  return [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,${splitLines(before).length} +1,${splitLines(after).length} @@`,
    ...diffLines(before, after),
  ].join('\n');
}

function diffstat(before: string, after: string): { insertions: number; deletions: number } {
  const body = diffLines(before, after);
  return {
    insertions: body.filter((l) => l.startsWith('+')).length,
    deletions: body.filter((l) => l.startsWith('-')).length,
  };
}

function statLine(files: number, insertions: number, deletions: number): string {
  const parts = [`${files} file${files === 1 ? '' : 's'} changed`];
  if (insertions) parts.push(`${insertions} insertion${insertions === 1 ? '' : 's'}(+)`);
  if (deletions) parts.push(`${deletions} deletion${deletions === 1 ? '' : 's'}(-)`);
  return ` ${parts.join(', ')}`;
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

const LOGO_BASE = '[PNG image, 512 x 512, 11.9 kB: the old blue logo]\n';
const LOGO_OURS = '[PNG image, 512 x 512, 12.4 kB: blue logo with a sharper outline]\n';
const LOGO_THEIRS = '[PNG image, 512 x 512, 14.1 kB: the new orange logo from the rebrand]\n';
const BRAND_CSS_BEFORE = `:root {
  --brand: #2563eb;
}
`;
const BRAND_CSS_MERGED = `:root {
  --brand: #f97316;
}
`;

const LIMITS_BASE = `from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(get_remote_address, default_limits=["100 per minute"])
`;
const LIMITS_OURS = `from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(get_remote_address, default_limits=["200 per minute"])
`;
const LIMITS_THEIRS = `from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(get_remote_address, default_limits=["30 per minute"])
`;
const LIMITS_CONFLICTED = `from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

<<<<<<< HEAD
limiter = Limiter(get_remote_address, default_limits=["200 per minute"])
=======
limiter = Limiter(get_remote_address, default_limits=["30 per minute"])
>>>>>>> 7c1e2a9 (Tighten the default rate limit)
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

function file(path: string, content: string): RepoFile {
  return { path, head: content, index: content, content, stages: null, undo: null };
}

function conflict(
  path: string,
  base: string,
  ours: string,
  theirs: string,
  conflicted: string,
  binary = false
): RepoFile {
  const stages = { base, ours, theirs };
  return {
    path,
    binary,
    head: ours,
    index: null,
    content: conflicted,
    stages,
    undo: { stages, conflicted },
  };
}

function baseState(lessonId: string, partial: Partial<RepoState>): RepoState {
  return {
    lessonId,
    branch: 'main',
    headSha: 'e41c9d2',
    op: null,
    files: {},
    log: [],
    otherLog: [],
    tests: null,
    nextSha: 0,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const HELP = `Commands in this lab:
  git status | git diff [--cached] | git log --oneline [--merge]
  git show :1:<file> | :2:<file> | :3:<file>     (base, ours, theirs)
  git add <file> | git commit [-m "msg" | --no-edit | -a]
  git merge --abort | git merge --continue
  git checkout --ours|--theirs <file>  (or git restore --ours|--theirs)
  git checkout -m <file>               (recreate the conflict)
  git rebase --continue | --abort
  cat <file> | ls | make test | clear
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
  const unmerged = files.filter((f) => f.stages);
  const staged = files.filter((f) => !f.stages && f.index !== f.head);
  const notStaged = files.filter(hasUnstagedChanges);
  const out: string[] = [];
  const op = state.op;

  if (op?.kind === 'rebase') {
    out.push(`interactive rebase in progress; onto ${op.ontoSha}`);
    out.push('Last command done (1 command done):');
    out.push(`   pick ${op.commitSha} ${op.commitMessage}`);
    out.push('No commands remaining.');
    out.push(`You are currently rebasing branch '${op.branch}' on '${op.ontoSha}'.`);
    if (unmerged.length) {
      out.push('  (fix conflicts and then run "git rebase --continue")');
      out.push('  (use "git rebase --skip" to skip this patch)');
      out.push('  (use "git rebase --abort" to check out the original branch)');
    } else {
      out.push('  (all conflicts fixed: run "git rebase --continue")');
    }
  } else {
    out.push(`On branch ${state.branch}`);
    if (op?.kind === 'merge') {
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
    if (op?.kind === 'rebase') out.push('  (use "git restore --staged <file>..." to unstage)');
    for (const f of staged) out.push(`\tmodified:   ${f.path}`);
  }
  if (unmerged.length) {
    out.push('', 'Unmerged paths:');
    if (op?.kind === 'rebase') out.push('  (use "git restore --staged <file>..." to unstage)');
    out.push('  (use "git add <file>..." to mark resolution)');
    for (const f of unmerged) out.push(`\tboth modified:   ${f.path}`);
  }
  if (notStaged.length) {
    out.push('', 'Changes not staged for commit:');
    out.push('  (use "git add <file>..." to update what will be committed)');
    for (const f of notStaged) out.push(`\tmodified:   ${f.path}`);
  }
  if (!staged.length && !unmerged.length && !notStaged.length) {
    if (!op) out.push('nothing to commit, working tree clean');
  } else if (!staged.length) {
    out.push('', 'no changes added to commit (use "git add" and/or "git commit -a")');
  }
  return out.join('\n');
}

/**
 * Combined diff of a conflicted file as Git wrote it. The first column is
 * against ours, the second against theirs. Only used while the working file
 * is exactly the conflicted text, where each marked-up line comes from one side.
 */
function combinedDiff(f: RepoFile): string {
  const lines = classifyLines(f.content.replace(/\n$/, ''));
  const count = (text?: string) => (text ? splitLines(text).length : 0);
  const body = lines.map(({ text, side }) => {
    if (side.startsWith('marker')) return `++${text}`;
    if (side === 'ours') return ` +${text}`;
    if (side === 'theirs') return `+ ${text}`;
    return `  ${text}`;
  });
  return [
    `diff --cc ${f.path}`,
    'index 7d3e5b2,c41a9f0..0000000',
    `--- a/${f.path}`,
    `+++ b/${f.path}`,
    `@@@ -1,${count(f.stages?.ours)} -1,${count(f.stages?.theirs)} +1,${lines.length} @@@`,
    ...body,
  ].join('\n');
}

/** `git checkout -m` recreates markers labelled "ours" and "theirs", not the original refs. */
function relabel(conflicted: string): string {
  return conflicted
    .replace(/^<<<<<<< .*$/gm, '<<<<<<< ours')
    .replace(/^>>>>>>> .*$/gm, '>>>>>>> theirs');
}

/** The working file is the conflict exactly as Git wrote it (first time or via checkout -m). */
export function isAsWritten(f: RepoFile): boolean {
  return !!f.undo && (f.content === f.undo.conflicted || f.content === relabel(f.undo.conflicted));
}

const BINARY_DIFF = (path: string) =>
  `diff --git a/${path} b/${path}\nindex 1f3e2d4..8a7b6c5 100644\nBinary files a/${path} and b/${path} differ`;

function logLine(c: Commit): string {
  return `${c.sha}${c.refs ? ` (${c.refs})` : ''} ${c.message}`;
}

function commit(state: RepoState, message: string | null, noEdit: boolean): ExecuteResult {
  const files = Object.values(state.files);
  const fail = (content: string, type: LineType = 'error'): ExecuteResult => ({
    state,
    lines: [{ type, content }],
    ok: false,
  });
  if (files.some((f) => f.stages)) {
    return fail(
      "error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict."
    );
  }
  if (state.op?.kind === 'rebase') {
    return fail(
      'You are in the middle of a rebase: run git rebase --continue to commit this step.',
      'note'
    );
  }
  const merging = state.op?.kind === 'merge' ? state.op : null;
  const staged = files.filter((f) => f.index !== f.head);
  if (!merging && staged.length === 0) {
    return { state, lines: [{ type: 'output', content: statusOutput(state) }], ok: false };
  }
  const msg = message ?? (merging ? `Merge branch '${merging.other}'` : null);
  if (!msg) {
    return fail('Aborting commit due to empty commit message. (Use git commit -m "message".)');
  }
  let insertions = 0;
  let deletions = 0;
  for (const f of staged) {
    const s = diffstat(f.head ?? '', f.index ?? '');
    insertions += s.insertions;
    deletions += s.deletions;
  }
  const sha = newSha(state);
  for (const f of files) {
    f.head = f.index;
    f.undo = null;
  }
  const previous = state.log.map((c) => ({
    ...c,
    refs: c.refs?.replace(`HEAD -> ${state.branch}`, '').replace(/^, /, '') || undefined,
  }));
  state.log = [
    { sha, message: msg, refs: `HEAD -> ${state.branch}` },
    ...(merging ? state.otherLog : []),
    ...previous,
  ];
  state.otherLog = [];
  state.headSha = sha;
  state.op = null;
  const lines: OutputLine[] = [];
  if (merging && message === null && !noEdit) {
    lines.push({
      type: 'note',
      content:
        'Git would open your editor with the default merge message; the lab keeps it as it is.',
    });
  }
  lines.push({
    type: 'output',
    content: merging
      ? `[${state.branch} ${sha}] ${msg}`
      : `[${state.branch} ${sha}] ${msg}\n${statLine(staged.length, insertions, deletions)}`,
  });
  return { state, lines, ok: true };
}

export function execute(cmd: string, current: RepoState): ExecuteResult {
  const state = clone(current);
  const t = tokenize(cmd.trim());
  const out = (content: string, type: LineType = 'output'): ExecuteResult => ({
    state,
    lines: content ? [{ type, content }] : [],
    ok: type !== 'error',
  });
  if (t.length === 0) return { state, lines: [], ok: true };

  const [prog, sub, ...rest] = t;

  if (prog === 'clear') return { state, lines: [], ok: true, clear: true };
  if (prog === 'help') return out(HELP);
  if (prog === 'ls') {
    const top = new Set(
      Object.keys(state.files).map((p) => (p.includes('/') ? `${p.split('/')[0]}/` : p))
    );
    return out([...top].sort().join('  '));
  }
  if (prog === 'cat') {
    if (!sub) return out('usage: cat <file>', 'error');
    const f = state.files[sub];
    if (!f) return out(`cat: ${sub}: No such file or directory`, 'error');
    if (f.binary) return out(`(binary data) ${f.content.trim()}`);
    return out(f.content.replace(/\n$/, ''));
  }
  if (prog === 'make' && sub === 'test') return runTests(state);
  if (prog === 'pytest' || (prog === 'python' && sub === '-m' && rest[0] === 'pytest')) {
    return runTests(state);
  }

  if (prog !== 'git') {
    return out(`${prog}: command not found (type help for what this lab supports)`, 'error');
  }

  switch (sub) {
    case 'status':
      return out(statusOutput(state));

    case 'log': {
      if (rest.includes('--merge')) {
        if (state.op?.kind !== 'merge') {
          return out(
            'fatal: --merge requires one of the pseudorefs MERGE_HEAD, CHERRY_PICK_HEAD, REVERT_HEAD or REBASE_HEAD',
            'error'
          );
        }
        if (!Object.values(state.files).some((f) => f.stages)) return out('');
        return out(
          [...state.log.slice(0, 1), ...state.otherLog.slice(0, 1)].map(logLine).join('\n')
        );
      }
      const lines = state.log.slice(0, 5).map(logLine).join('\n');
      if (!rest.includes('--oneline')) {
        return {
          state,
          lines: [
            { type: 'output', content: lines },
            {
              type: 'note',
              content: 'The lab prints git log one line per commit, like --oneline.',
            },
          ],
          ok: true,
        };
      }
      return out(lines);
    }

    case 'show': {
      const m = rest[0]?.match(/^:([123]):(.+)$/);
      if (!m) return out('This lab supports git show :1:<file>, :2:<file> and :3:<file>.', 'note');
      const f = state.files[m[2]];
      if (!f) {
        return out(
          `fatal: path '${m[2]}' does not exist (neither on disk nor in the index)`,
          'error'
        );
      }
      const stage = !f.stages
        ? undefined
        : m[1] === '1'
          ? f.stages.base
          : m[1] === '2'
            ? f.stages.ours
            : f.stages.theirs;
      if (stage === undefined) {
        return out(`fatal: path '${m[2]}' is in the index, but not at stage ${m[1]}`, 'error');
      }
      return out(f.binary ? `(binary data) ${stage.trim()}` : stage.replace(/\n$/, ''));
    }

    case 'diff': {
      const cached = rest.includes('--cached') || rest.includes('--staged');
      const target = rest.find((r) => !r.startsWith('-'));
      const files = Object.values(state.files).filter((f) => !target || f.path === target);
      const parts: string[] = [];
      const lines: OutputLine[] = [];
      for (const f of files) {
        if (cached) {
          if (f.stages) parts.push(`* Unmerged path ${f.path}`);
          else if (f.index !== f.head) {
            parts.push(
              f.binary ? BINARY_DIFF(f.path) : unifiedDiff(f.path, f.head ?? '', f.index ?? '')
            );
          }
        } else if (f.stages) {
          if (f.binary) {
            parts.push(`diff --cc ${f.path}\nindex 1f3e2d4,8a7b6c5..0000000\nBinary files differ`);
          } else if (isAsWritten(f)) {
            parts.push(combinedDiff(f));
          } else {
            lines.push({
              type: 'note',
              content: `${f.path} is still unmerged. Git would print a combined diff of your edit against both sides; the lab only prints it for the file as Git wrote it.`,
            });
          }
        } else if (f.index !== null && f.content !== f.index) {
          parts.push(f.binary ? BINARY_DIFF(f.path) : unifiedDiff(f.path, f.index, f.content));
        }
      }
      if (parts.length) lines.unshift({ type: 'output', content: parts.join('\n') });
      return { state, lines, ok: true };
    }

    case 'add': {
      const targets = rest.includes('.') || rest.includes('-A') ? Object.keys(state.files) : rest;
      if (targets.length === 0) return out('Nothing specified, nothing added.', 'note');
      const lines: OutputLine[] = [];
      let ok = true;
      for (const path of targets) {
        const f = state.files[path];
        if (!f) {
          lines.push({
            type: 'error',
            content: `fatal: pathspec '${path}' did not match any files`,
          });
          ok = false;
          continue;
        }
        if (f.stages && !f.binary && hasMarkers(f.content)) {
          lines.push({
            type: 'note',
            content: `Git staged ${path} with the conflict markers still in it. Git does not check. Fix the file and add it again, or run git checkout -m ${path} to start over.`,
          });
        }
        f.index = f.content;
        f.stages = null;
      }
      return { state, lines, ok };
    }

    case 'commit': {
      if (rest.includes('-a') || rest.includes('-am')) {
        for (const f of Object.values(state.files)) {
          if (f.stages || hasUnstagedChanges(f)) {
            f.index = f.content;
            f.stages = null;
          }
        }
      }
      const mIndex = rest.findIndex((r) => r === '-m' || r === '-am');
      const message = mIndex >= 0 ? (rest[mIndex + 1] ?? '') : null;
      if (mIndex >= 0 && !message) return out("error: switch `m' requires a value", 'error');
      return commit(state, message, rest.includes('--no-edit'));
    }

    case 'merge': {
      if (rest[0] === '--abort') {
        if (state.op?.kind !== 'merge') {
          return out('fatal: There is no merge to abort (MERGE_HEAD missing).', 'error');
        }
        for (const f of Object.values(state.files)) {
          f.content = f.head ?? '';
          f.index = f.head;
          f.stages = null;
          f.undo = null;
        }
        state.op = null;
        state.otherLog = [];
        return { state, lines: [], ok: true };
      }
      if (rest[0] === '--continue') {
        if (state.op?.kind !== 'merge') {
          return out('fatal: There is no merge in progress (MERGE_HEAD missing).', 'error');
        }
        return commit(state, null, false);
      }
      if (state.op) {
        return out(
          "error: Merging is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.",
          'error'
        );
      }
      if (
        rest[0] === 'feature/worker' &&
        state.lessonId === 'semantic-conflict' &&
        !state.files['worker.py']
      ) {
        state.files['worker.py'] = file('worker.py', WORKER_THEIRS);
        const sha = newSha(state);
        state.log = [
          { sha, message: "Merge branch 'feature/worker'", refs: 'HEAD -> main' },
          { sha: '3d2c1b0', message: 'Add a queue worker', refs: 'feature/worker' },
          ...state.log.map((c) => ({ ...c, refs: undefined })),
        ];
        state.headSha = sha;
        state.tests = 'not-run';
        return out(
          "Merge made by the 'ort' strategy.\n worker.py | 11 +++++++++++\n 1 file changed, 11 insertions(+)\n create mode 100644 worker.py"
        );
      }
      return out(
        'This lab only models the merge the lesson opened with. Press Restart lesson to run it again.',
        'note'
      );
    }

    case 'checkout':
    case 'restore': {
      const quiet = sub === 'restore';
      const side = rest.includes('--ours') ? 'ours' : rest.includes('--theirs') ? 'theirs' : null;
      const remerge = rest.includes('-m') || rest.includes('--merge');
      const path = rest.filter((r) => !r.startsWith('-')).pop();
      if (!path) return out(`usage: git ${sub} --ours|--theirs|-m <file>`, 'error');
      const f = state.files[path];
      if (!f)
        return out(`error: pathspec '${path}' did not match any file(s) known to git`, 'error');
      if (remerge) {
        const undo = f.stages
          ? { stages: f.stages, conflicted: f.undo?.conflicted ?? f.content }
          : f.undo;
        if (!undo)
          return out(`error: path '${path}' does not have all necessary versions`, 'error');
        f.stages = { ...undo.stages };
        f.index = null;
        f.content = f.binary ? (undo.stages.ours ?? f.content) : relabel(undo.conflicted);
        return out(quiet ? '' : 'Recreated 1 merge conflict');
      }
      if (side) {
        if (!f.stages) {
          // A resolved path has only stage 0; checkout reads that, whatever the flag.
          f.content = f.index ?? f.content;
          return out(quiet ? '' : 'Updated 1 path from the index');
        }
        const version = f.stages[side];
        if (version === undefined) {
          return out(
            `error: path '${path}' does not have ${side === 'ours' ? 'our' : 'their'} version`,
            'error'
          );
        }
        f.content = version;
        const lines: OutputLine[] = quiet
          ? []
          : [{ type: 'output', content: 'Updated 1 path from the index' }];
        if (state.op?.kind === 'rebase') {
          lines.push({
            type: 'note',
            content:
              side === 'ours'
                ? `That is the rebased side: ${state.op.onto} plus anything already replayed. During a rebase your own commit is --theirs.`
                : `That is your commit ${state.op.commitSha}'s version. During a rebase, your commit is --theirs.`,
          });
        } else if (state.op?.kind === 'merge') {
          lines.push({
            type: 'note',
            content:
              side === 'ours'
                ? `That is ${state.branch}'s whole file, the branch you are on.`
                : `That is ${state.op.other}'s whole file, the branch being merged in.`,
          });
        }
        return { state, lines, ok: true };
      }
      return out(`This lab supports git ${sub} --ours, --theirs and -m.`, 'note');
    }

    case 'rebase': {
      const op = state.op;
      if (rest[0] === '--continue') {
        if (op?.kind !== 'rebase') return out('fatal: No rebase in progress?', 'error');
        const files = Object.values(state.files);
        const unmerged = files.filter((f) => f.stages);
        if (unmerged.length) {
          return out(
            `${unmerged.map((f) => `${f.path}: needs merge`).join('\n')}\nYou must edit all merge conflicts and then\nmark them as resolved using git add`,
            'error'
          );
        }
        if (files.some(hasUnstagedChanges)) {
          return out(
            'error: cannot rebase: You have unstaged changes.\nerror: Please commit or stash them.',
            'error'
          );
        }
        if (files.every((f) => f.index === f.head)) {
          for (const f of files) f.undo = null;
          state.log = state.log.map((c) =>
            c.refs === 'HEAD, main' ? { ...c, refs: `HEAD -> ${op.branch}, main` } : c
          );
          state.branch = op.branch;
          state.op = null;
          return {
            state,
            lines: [
              {
                type: 'output',
                content: `Successfully rebased and updated refs/heads/${op.branch}.`,
              },
              {
                type: 'note',
                content: `Nothing was left to commit, so your commit ${op.commitSha} was dropped: the branch now has main's version, not yours.`,
              },
            ],
            ok: true,
          };
        }
        let insertions = 0;
        let deletions = 0;
        let changed = 0;
        for (const f of files) {
          if (f.index !== f.head) {
            const s = diffstat(f.head ?? '', f.index ?? '');
            insertions += s.insertions;
            deletions += s.deletions;
            changed += 1;
          }
          f.head = f.index;
          f.undo = null;
        }
        const sha = newSha(state);
        state.log = [
          { sha, message: op.commitMessage, refs: `HEAD -> ${op.branch}` },
          ...state.log.map((c) => ({ ...c, refs: c.refs?.replace(/^HEAD, /, '') })),
        ];
        state.branch = op.branch;
        state.headSha = sha;
        state.op = null;
        return out(
          `[detached HEAD ${sha}] ${op.commitMessage}\n${statLine(changed, insertions, deletions)}\nSuccessfully rebased and updated refs/heads/${op.branch}.`
        );
      }
      if (rest[0] === '--abort') {
        if (op?.kind !== 'rebase') return out('fatal: No rebase in progress?', 'error');
        for (const f of Object.values(state.files)) {
          const orig = op.orig.files[f.path] ?? f.head ?? '';
          f.head = orig;
          f.index = orig;
          f.content = orig;
          f.stages = null;
          f.undo = null;
        }
        state.branch = op.branch;
        state.headSha = op.commitSha;
        state.log = op.orig.log.map((c) => ({ ...c }));
        state.op = null;
        return out('');
      }
      if (rest[0] === '--skip') {
        return out(
          `git rebase --skip would drop your commit${op?.kind === 'rebase' ? ` ${op.commitSha}` : ''} from the branch. The lab stops here so you can resolve it instead.`,
          'note'
        );
      }
      return out('This lab supports git rebase --continue and --abort.', 'note');
    }

    default:
      return out(`git ${sub ?? ''} is not part of this lab. Type help.`, 'note');
  }
}

function sameCode(a: string, b: string): boolean {
  const norm = (s: string) =>
    splitLines(s)
      .map((l) => l.replace(/\s+$/, ''))
      .join('\n');
  return norm(a) === norm(b);
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
      ok: true,
    };
  }
  if (!sameCode(worker.content, WORKER_FIXED)) {
    state.tests = 'failing';
    const reason = /get_timeout\(/.test(worker.content)
      ? "AttributeError: module 'app.settings' has no attribute 'get_timeout'"
      : 'AssertionError: poll_forever() did not pass the request timeout to queue.pop()';
    return {
      state,
      lines: [
        {
          type: 'error',
          content: `python -m pytest -q\n...F                                                                     [100%]\nFAILED tests/test_worker.py::test_poll_forever - ${reason}\n1 failed, 3 passed in 0.41s\nmake: *** [Makefile:4: test] Error 1`,
        },
      ],
      // the command ran; a red test run is a result, not a refusal
      ok: true,
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
    ok: true,
  };
}

/** Write the editor's content to the working tree. The index is left alone, as in Git. */
export function saveFile(current: RepoState, path: string, content: string): RepoState {
  const state = clone(current);
  const f = state.files[path];
  if (!f) return state;
  const next = withTrailingNewline(content);
  if (next !== f.content && state.tests === 'passing') state.tests = 'not-run';
  f.content = next;
  return state;
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

const isCmd = (cmd: string, ...forms: RegExp[]) => forms.some((re) => re.test(cmd.trim()));

function requireLines(content: string, required: { line: string; from: string }[]): string | null {
  if (hasMarkers(content)) {
    return 'The file still has conflict markers (<<<<<<<, =======, >>>>>>>). Remove them.';
  }
  const lines = content.split('\n').map((l) => l.trim());
  for (const r of required) {
    if (!lines.includes(r.line)) return `${r.line} is missing. It came from ${r.from}.`;
  }
  return null;
}

const validateRequirements = (content: string) =>
  requireLines(content, [
    { line: 'flask==3.0.3', from: 'both sides' },
    { line: 'redis==5.0.8', from: 'main (ours)' },
    { line: 'prometheus-client==0.20.0', from: 'feature/metrics (theirs)' },
    { line: 'gunicorn==22.0.0', from: 'both sides' },
  ]);

const validateWorker = (content: string) => {
  if (hasMarkers(content)) return 'worker.py has conflict markers in it.';
  if (/get_timeout\(/.test(content)) return 'worker.py still calls get_timeout().';
  if (!sameCode(content, WORKER_FIXED)) {
    return 'Change only the call: queue.pop(timeout=settings.get_request_timeout()). Leave the rest of the file as it was.';
  }
  return null;
};

const headOf = (state: RepoState, path: string) => state.files[path]?.head ?? null;
const indexOf = (state: RepoState, path: string) =>
  state.files[path]?.stages ? null : (state.files[path]?.index ?? null);

function mergeCommitted(before: RepoState, after: RepoState): boolean {
  return before.op?.kind === 'merge' && after.op === null && after.log.length > before.log.length;
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
        done: (cmd, _b, after) => isCmd(cmd, /^git status$/) && after.op?.kind === 'merge',
      },
      {
        kind: 'command',
        instruction: 'Print config.yaml and look at the markers Git wrote into it.',
        hint: 'cat config.yaml',
        command: 'cat config.yaml',
        explanation:
          '<<<<<<< HEAD opens your side: the branch you are on, main. ======= separates the two sides. >>>>>>> feature/retry closes the side being merged in. Lines outside the markers merged cleanly. (That is the default conflict style; with merge.conflictStyle=diff3 Git also shows the base between ||||||| and =======.)',
        done: (cmd, _b, after) =>
          isCmd(cmd, /^cat config\.yaml$/) && hasMarkers(after.files['config.yaml'].content),
      },
      {
        kind: 'command',
        instruction:
          'Show the common ancestor: the version both branches started from (index stage 1).',
        hint: 'git show :1:config.yaml',
        command: 'git show :1:config.yaml',
        explanation:
          'An unmerged path can have up to three index entries. This both-modified conflict has all three: stage 1 is the common ancestor, stage 2 is ours (HEAD), stage 3 is theirs. The base had timeout: 30, so main raised it to 45 and feature/retry to 60.',
        done: (cmd) => isCmd(cmd, /^git show :1:config\.yaml$/),
      },
      {
        kind: 'command',
        instruction: "Now show feature/retry's version of the file, stage 3.",
        hint: 'git show :3:config.yaml',
        command: 'git show :3:config.yaml',
        explanation:
          'Stage 3 is "theirs": the whole file as feature/retry has it. git show :2:config.yaml shows main\'s. The marked-up working file is built from these versions.',
        done: (cmd) => isCmd(cmd, /^git show :3:config\.yaml$/),
      },
      {
        kind: 'command',
        instruction: 'Look at the conflict as Git diffs it.',
        hint: 'git diff',
        command: 'git diff',
        explanation:
          'During a conflict, git diff prints a combined diff with two columns of + and -. The first column compares with ours, the second with theirs, which is why the marker lines start with ++.',
        done: (cmd, before) => {
          const f = before.files['config.yaml'];
          return isCmd(cmd, /^git diff( config\.yaml)?$/) && !!f.stages && isAsWritten(f);
        },
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
          'main added redis and feature/metrics added prometheus-client, at the same spot. The project needs both. Edit requirements.txt in the editor so it lists all four packages with no markers, then Save.',
        hint: 'Delete the three marker lines and keep both redis==5.0.8 and prometheus-client==0.20.0.',
        explanation:
          'Neither side alone was right. A resolution is whatever the file should be after the merge: here both additions, which neither --ours nor --theirs would give you.',
        solution: REQ_SOLUTION,
        validate: validateRequirements,
      },
      {
        kind: 'command',
        instruction: 'Mark the conflict as resolved by staging the file.',
        hint: 'git add requirements.txt',
        command: 'git add requirements.txt',
        explanation:
          'git add is how you tell Git a conflict is resolved: it replaces the index stages with the one version you staged. Git does not look at the content, so it would stage markers too.',
        done: (cmd, _b, after) => {
          const f = after.files['requirements.txt'];
          return (
            isCmd(cmd, /^git add (requirements\.txt|\.|-A)$/) &&
            !f.stages &&
            validateRequirements(f.index ?? '') === null
          );
        },
        goal: (state) => validateRequirements(indexOf(state, 'requirements.txt') ?? '') === null,
      },
      {
        kind: 'command',
        instruction: 'Check the status again before committing.',
        hint: 'git status',
        command: 'git status',
        explanation:
          '"All conflicts fixed but you are still merging": the merge is ready to be concluded with a commit.',
        done: (cmd, _b, after) =>
          isCmd(cmd, /^git status$/) &&
          after.op?.kind === 'merge' &&
          !Object.values(after.files).some((f) => f.stages),
        goal: (state) =>
          state.op === null &&
          validateRequirements(headOf(state, 'requirements.txt') ?? '') === null,
      },
      {
        kind: 'command',
        instruction: 'Conclude the merge with the default merge message.',
        hint: 'git commit --no-edit',
        command: 'git commit --no-edit',
        explanation:
          'The merge commit has two parents, main and feature/metrics, and records your resolution. That is the whole job: edit, add, commit.',
        done: (_cmd, before, after) =>
          mergeCommitted(before, after) &&
          validateRequirements(after.files['requirements.txt'].head ?? '') === null,
        goal: (state) =>
          state.op === null &&
          validateRequirements(headOf(state, 'requirements.txt') ?? '') === null,
      },
    ],
  },
  {
    id: 'ours-theirs',
    title: 'Take a whole side',
    description: 'git checkout --theirs, for a file nobody can merge by hand.',
    icon: 'side',
    focusFile: 'assets/logo.png',
    intro: [
      { type: 'input', content: 'git merge feature/rebrand' },
      {
        type: 'output',
        content:
          'Auto-merging assets/brand.css\nwarning: Cannot merge binary files: assets/logo.png (HEAD vs. feature/rebrand)\nAuto-merging assets/logo.png\nCONFLICT (content): Merge conflict in assets/logo.png\nAutomatic merge failed; fix conflicts and then commit the result.',
      },
    ],
    initial: () => {
      const brand = file('assets/brand.css', BRAND_CSS_BEFORE);
      brand.index = BRAND_CSS_MERGED;
      brand.content = BRAND_CSS_MERGED;
      return baseState('ours-theirs', {
        headSha: 'f3a8d61',
        op: { kind: 'merge', other: 'feature/rebrand', otherSha: '0d4be97' },
        files: {
          'assets/brand.css': brand,
          'assets/logo.png': conflict(
            'assets/logo.png',
            LOGO_BASE,
            LOGO_OURS,
            LOGO_THEIRS,
            LOGO_OURS,
            true
          ),
        },
        log: [
          { sha: 'f3a8d61', message: 'Sharpen the logo outline', refs: 'HEAD -> main' },
          { sha: '44e1c0a', message: 'Add brand colours' },
        ],
        otherLog: [{ sha: '0d4be97', message: 'Rebrand to orange', refs: 'feature/rebrand' }],
      });
    },
    steps: [
      {
        kind: 'command',
        instruction: 'See which files merged and which did not.',
        hint: 'git status',
        command: 'git status',
        explanation:
          "brand.css merged cleanly and is already staged. logo.png is binary: Git cannot merge it line by line, so there are no markers. The working tree still holds main's logo, and the index has all three versions.",
        done: (cmd, _b, after) => isCmd(cmd, /^git status$/) && after.op?.kind === 'merge',
        goal: (state) => state.op === null && headOf(state, 'assets/logo.png') === LOGO_THEIRS,
      },
      {
        kind: 'command',
        instruction:
          "The rebrand is the point of this merge. Take feature/rebrand's logo, the branch you are merging in.",
        hint: 'In a merge, the branch you merge in is "theirs": git checkout --theirs assets/logo.png',
        command: 'git checkout --theirs assets/logo.png',
        explanation:
          "During a merge, --ours is the branch you are on (main, stage 2) and --theirs is the branch being merged in (feature/rebrand, stage 3). It copies that whole file, so main's sharper outline is gone: redo it on the new logo if it still matters.",
        done: (cmd, _b, after) =>
          isCmd(cmd, /^git (checkout|restore) --theirs assets\/logo\.png$/) &&
          after.files['assets/logo.png'].content === LOGO_THEIRS,
        goal: (state) =>
          indexOf(state, 'assets/logo.png') === LOGO_THEIRS ||
          (state.op === null && headOf(state, 'assets/logo.png') === LOGO_THEIRS),
      },
      {
        kind: 'command',
        instruction: 'Mark it as resolved.',
        hint: 'git add assets/logo.png',
        command: 'git add assets/logo.png',
        explanation: 'The index now holds one version of the logo, the orange one.',
        done: (cmd, _b, after) => {
          const f = after.files['assets/logo.png'];
          return (
            isCmd(cmd, /^git add (assets\/logo\.png|\.|-A)$/) &&
            !f.stages &&
            f.index === LOGO_THEIRS
          );
        },
        goal: (state) => indexOf(state, 'assets/logo.png') === LOGO_THEIRS,
      },
      {
        kind: 'command',
        instruction: 'Conclude the merge.',
        hint: 'git commit --no-edit',
        command: 'git commit --no-edit',
        explanation:
          'Merged. Taking a whole side fits files nobody can merge by hand. Lockfiles have their own route: npm can merge package-lock.json conflicts itself once package.json is resolved (npm install --package-lock-only).',
        done: (_cmd, before, after) =>
          mergeCommitted(before, after) && after.files['assets/logo.png'].head === LOGO_THEIRS,
        goal: (state) => state.op === null && headOf(state, 'assets/logo.png') === LOGO_THEIRS,
      },
    ],
  },
  {
    id: 'rebase-flip',
    title: 'Rebase flips ours and theirs',
    description: 'During a rebase, --theirs is your own commit.',
    icon: 'rebase',
    focusFile: 'limits.py',
    intro: [
      { type: 'input', content: 'git rebase main' },
      {
        type: 'output',
        content:
          'Auto-merging limits.py\nCONFLICT (content): Merge conflict in limits.py\nerror: could not apply 7c1e2a9... Tighten the default rate limit\nhint: Resolve all conflicts manually, mark them as resolved with\nhint: "git add/rm <conflicted_files>", then run "git rebase --continue".\nhint: You can instead skip this commit: run "git rebase --skip".\nhint: To abort and get back to the state before "git rebase", run "git rebase --abort".\nCould not apply 7c1e2a9... Tighten the default rate limit',
      },
    ],
    initial: () =>
      baseState('rebase-flip', {
        branch: null,
        headSha: '1a2b3c4',
        op: {
          kind: 'rebase',
          branch: 'feature/rate-limit',
          onto: 'main',
          ontoSha: '1a2b3c4',
          commitSha: '7c1e2a9',
          commitMessage: 'Tighten the default rate limit',
          orig: {
            log: [
              {
                sha: '7c1e2a9',
                message: 'Tighten the default rate limit',
                refs: 'HEAD -> feature/rate-limit',
              },
              { sha: '0f9e8d7', message: 'Add rate limiting' },
            ],
            files: { 'limits.py': LIMITS_THEIRS },
          },
        },
        files: {
          'limits.py': conflict(
            'limits.py',
            LIMITS_BASE,
            LIMITS_OURS,
            LIMITS_THEIRS,
            LIMITS_CONFLICTED
          ),
        },
        log: [
          { sha: '1a2b3c4', message: 'Allow 200 requests per minute', refs: 'HEAD, main' },
          { sha: '0f9e8d7', message: 'Add rate limiting' },
        ],
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
        done: (cmd, _b, after) => isCmd(cmd, /^git status$/) && after.op?.kind === 'rebase',
        goal: (state) => state.op === null && headOf(state, 'limits.py') === LIMITS_THEIRS,
      },
      {
        kind: 'command',
        instruction: 'Print limits.py and read the labels on each side.',
        hint: 'cat limits.py',
        command: 'cat limits.py',
        explanation:
          "<<<<<<< HEAD is main's line, because the detached HEAD points at main's tip. The bottom side, >>>>>>> 7c1e2a9, is your own commit being replayed.",
        done: (cmd, _b, after) =>
          isCmd(cmd, /^cat limits\.py$/) && hasMarkers(after.files['limits.py'].content),
        goal: (state) => state.op === null && headOf(state, 'limits.py') === LIMITS_THEIRS,
      },
      {
        kind: 'command',
        instruction:
          "The team agreed your stricter limit wins. Take your commit's version of limits.py.",
        hint: 'Your commit is "theirs" during a rebase: git checkout --theirs limits.py',
        command: 'git checkout --theirs limits.py',
        explanation:
          'In a merge, --ours is your branch. In a rebase, --ours is the rebased result so far (main plus any of your commits already replayed) and --theirs is the commit being replayed. If you typed --ours by reflex, you just threw your own change away.',
        done: (cmd, _b, after) =>
          isCmd(cmd, /^git (checkout|restore) --theirs limits\.py$/) &&
          after.files['limits.py'].content === LIMITS_THEIRS,
        goal: (state) =>
          indexOf(state, 'limits.py') === LIMITS_THEIRS ||
          (state.op === null && headOf(state, 'limits.py') === LIMITS_THEIRS),
      },
      {
        kind: 'command',
        instruction: 'Mark limits.py as resolved.',
        hint: 'git add limits.py',
        command: 'git add limits.py',
        explanation: 'Staged. The rebase can move on.',
        done: (cmd, _b, after) => {
          const f = after.files['limits.py'];
          return (
            isCmd(cmd, /^git add (limits\.py|\.|-A)$/) && !f.stages && f.index === LIMITS_THEIRS
          );
        },
        goal: (state) => indexOf(state, 'limits.py') === LIMITS_THEIRS,
      },
      {
        kind: 'command',
        instruction: 'Let the rebase finish.',
        hint: 'git rebase --continue',
        command: 'git rebase --continue',
        explanation:
          'Your commit now sits on top of main with a new hash. A rebase replays one commit at a time, and each one can stop on a conflict like this.',
        done: (_cmd, before, after) =>
          before.op?.kind === 'rebase' &&
          after.op === null &&
          after.log.length > before.log.length &&
          headOf(after, 'limits.py') === LIMITS_THEIRS,
        goal: (state) => state.op === null && headOf(state, 'limits.py') === LIMITS_THEIRS,
      },
    ],
  },
  {
    id: 'abort',
    title: 'The escape hatch',
    description: 'git merge --abort, for the merge you should not have started.',
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
        files[path] = conflict(
          path,
          `# ${path}\n`,
          `# ${path} on main\n`,
          `# ${path} on release/2025.12\n`,
          `<<<<<<< HEAD\n# ${path} on main\n=======\n# ${path} on release/2025.12\n>>>>>>> release/2025.12\n`
        );
      }
      files.Dockerfile = conflict(
        'Dockerfile',
        'FROM python:3.12-slim\nRUN pip install -r requirements.txt\nCMD ["gunicorn", "app:app"]\n',
        'FROM python:3.12-slim\nRUN pip install --no-cache-dir -r requirements.txt\nCMD ["gunicorn", "app:app"]\n',
        'FROM python:3.12-slim\nRUN pip install -r requirements.txt && pip install gunicorn==21.2.0\nCMD ["gunicorn", "app:app"]\n',
        'FROM python:3.12-slim\n<<<<<<< HEAD\nRUN pip install --no-cache-dir -r requirements.txt\n=======\nRUN pip install -r requirements.txt && pip install gunicorn==21.2.0\n>>>>>>> release/2025.12\nCMD ["gunicorn", "app:app"]\n'
      );
      return baseState('abort', {
        headSha: 'c0ffee1',
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
          "You meant to merge release/2026.09, not last year's release. Look at the damage.",
        hint: 'git status',
        command: 'git status',
        explanation:
          'Six conflicted files, all from merging the wrong branch. None of them is worth resolving.',
        done: (cmd, _b, after) => isCmd(cmd, /^git status$/) && after.op?.kind === 'merge',
        goal: (state) =>
          state.op === null && Object.values(state.files).every((f) => fileStatus(f) === 'clean'),
      },
      {
        kind: 'command',
        instruction: 'Back out of the merge.',
        hint: 'git merge --abort',
        command: 'git merge --abort',
        explanation:
          '--abort tries to put the index and working tree back to how they were before git merge, and removes MERGE_HEAD. It works while the merge is still in progress. git rebase --abort does the same for a rebase.',
        done: (_cmd, before, after) =>
          before.op?.kind === 'merge' &&
          after.op === null &&
          after.log.length === before.log.length,
        goal: (state) =>
          state.op === null &&
          state.headSha === 'c0ffee1' &&
          Object.values(state.files).every((f) => fileStatus(f) === 'clean'),
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
    focusFile: 'settings.py',
    intro: [
      {
        type: 'note',
        content:
          'main renamed settings.get_timeout() to get_request_timeout() and updated every caller it had. feature/worker, written last week, adds a new caller.',
      },
    ],
    initial: () =>
      baseState('semantic-conflict', {
        headSha: '9e8f7a6',
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
          'No conflict: the branches changed different files, so Git merged them without asking. Git merges text; it does not check that the combined code still works.',
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
        explanation:
          "One line. Git's textual merge could not see it; tests or static analysis can.",
        solution: WORKER_FIXED,
        validate: validateWorker,
      },
      {
        kind: 'command',
        instruction: 'Run the tests again.',
        hint: 'make test',
        command: 'make test',
        explanation: 'Green. The merge result works now, not just the two branches.',
        done: (_cmd, _b, after) => after.tests === 'passing',
        goal: (state) => state.tests === 'passing',
      },
      {
        kind: 'command',
        instruction: 'Stage the fix.',
        hint: 'git add worker.py',
        command: 'git add worker.py',
        explanation: 'Staged.',
        done: (cmd, _b, after) =>
          isCmd(cmd, /^git add (worker\.py|\.|-A)$/) &&
          sameCode(after.files['worker.py'].index ?? '', WORKER_FIXED),
        goal: (state) => sameCode(indexOf(state, 'worker.py') ?? '', WORKER_FIXED),
      },
      {
        kind: 'command',
        instruction: 'Commit it.',
        hint: 'git commit -m "Use get_request_timeout in worker"',
        command: 'git commit -m "Use get_request_timeout in worker"',
        explanation:
          'This is the conflict that reaches production: textually clean, semantically wrong. Test the merge result, not just each branch: run CI on merge commits, or use a merge queue that tests the combined code before it lands.',
        done: (_cmd, before, after) =>
          after.log.length > before.log.length &&
          sameCode(after.files['worker.py'].head ?? '', WORKER_FIXED),
        goal: (state) => sameCode(headOf(state, 'worker.py') ?? '', WORKER_FIXED),
      },
    ],
  },
];

export const TOTAL_STEPS = LESSONS.reduce((sum, lesson) => sum + lesson.steps.length, 0);
