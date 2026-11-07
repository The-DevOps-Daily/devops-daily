'use client';

import type { ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';
import {
  BookOpen,
  Cloud,
  FileText,
  GitBranch,
  GitCommit,
  GitFork,
  GitMerge,
  Send,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LAB_TERMINAL_HEIGHT,
  SIM_CATEGORY,
  SimComplete,
  SimFrame,
  SimLabBar,
  SimLabLayout,
  SimLabLessons,
  SimLabPanel,
  SimTerminal,
  labLines,
  labStats,
  lessonsSummary,
  useSimLab,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';
import {
  useTerminalSimulator,
  type ExecuteResult,
  type TerminalLine,
} from '@/hooks/use-terminal-simulator';

type ChangeKind = 'untracked' | 'modified';

interface Commit {
  id: string;
  message: string;
  parents: string[];
  files: Record<string, string>;
  rebasedFrom?: string;
}

interface Change {
  file: string;
  kind: ChangeKind;
  content: string;
}

interface RepoState {
  currentBranch: string;
  head: string;
  branches: Record<string, string>;
  upstreams: Record<string, string>;
  remoteBranches: Record<string, string>;
  commits: Commit[];
  working: Change[];
  staged: Change[];
  fetchedRemoteUpdate: boolean;
  nextCommitNumber: number;
}

interface LessonCommand {
  instruction: string;
  hint: string;
  expectedCommand: string | string[];
  explanation: string;
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  commands: LessonCommand[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'mental-model',
    title: 'Mental Model',
    description: 'Map the working tree, staging area, local repo, and remote',
    icon: <GitCommit className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Start by checking where the lab repository lives.',
        hint: 'Use "pwd".',
        expectedCommand: 'pwd',
        explanation:
          'The working directory is the files you can edit. Git tracks selected snapshots of this directory.',
      },
      {
        instruction: 'List the files in the working directory.',
        hint: 'Use "ls -l".',
        expectedCommand: ['ls -l', 'ls'],
        explanation:
          'Files begin in the working directory. Git compares this directory with the index and the latest commit.',
      },
      {
        instruction: 'Ask Git what it sees right now.',
        hint: 'Use "git status".',
        expectedCommand: 'git status',
        explanation:
          'status is the map: current branch, staged changes, unstaged changes, and untracked files.',
      },
      {
        instruction: 'Read the existing commit history.',
        hint: 'Use "git log --oneline --decorate".',
        expectedCommand: ['git log --oneline --decorate', 'git log --oneline'],
        explanation:
          'A Git commit is a snapshot with a parent pointer. Branches point at commits, and HEAD points at your current branch.',
      },
    ],
  },
  {
    id: 'stage-commit',
    title: 'Stage & Commit',
    description: 'Move a change from working tree to index to local history',
    icon: <FileText className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Create a new file in the working directory.',
        hint: 'Use "echo \"Hi, I am Bob.\" > Bob.txt".',
        expectedCommand: 'echo "Hi, I am Bob." > Bob.txt',
        explanation:
          'This creates an untracked file. It exists in your directory, but it is not part of Git history yet.',
      },
      {
        instruction: 'Check how Git classifies that new file.',
        hint: 'Use "git status".',
        expectedCommand: 'git status',
        explanation:
          'Untracked means Git sees the file but will not include it in a commit until you stage it.',
      },
      {
        instruction: 'Stage the new file.',
        hint: 'Use "git add Bob.txt".',
        expectedCommand: ['git add Bob.txt', 'git add .'],
        explanation:
          'git add copies the selected content into the staging area, also called the index.',
      },
      {
        instruction: 'Inspect the staged change.',
        hint: 'Use "git diff --staged".',
        expectedCommand: ['git diff --staged', 'git diff --cached'],
        explanation:
          'git diff shows unstaged changes by default (working tree vs index). --staged (or --cached) compares the index to your last commit, known as HEAD.',
      },
      {
        instruction: 'Commit the staged snapshot into the local repository.',
        hint: 'Use "git commit -m \"Add Bob\"".',
        expectedCommand: 'git commit -m "Add Bob"',
        explanation:
          'A commit stores the staged snapshot, moves the current branch forward, and makes the working tree clean.',
      },
    ],
  },
  {
    id: 'remote',
    title: 'Remote Sync',
    description: 'Share local commits with origin',
    icon: <Cloud className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Check whether your local branch is ahead of origin.',
        hint: 'Use "git status".',
        expectedCommand: 'git status',
        explanation:
          'After a local commit, main points at a commit that origin/main does not have yet.',
      },
      {
        instruction: 'Push the local commit to the remote.',
        hint: 'Use "git push".',
        expectedCommand: 'git push',
        explanation:
          'push copies commits from your local repository to the remote repository and advances origin/main.',
      },
    ],
  },
  {
    id: 'branches',
    title: 'Branch Pointers',
    description: 'Create a branch and watch HEAD move',
    icon: <GitBranch className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Create and switch to a feature branch.',
        hint: 'Use "git switch -c change-alice".',
        expectedCommand: ['git switch -c change-alice', 'git checkout -b change-alice'],
        explanation:
          'A branch is a movable pointer to a commit. HEAD now points to change-alice instead of main.',
      },
      {
        instruction: 'Modify Alice.txt on the feature branch.',
        hint: 'Use "echo \"Alice learns branches.\" >> Alice.txt".',
        expectedCommand: 'echo "Alice learns branches." >> Alice.txt',
        explanation:
          'The working directory can change before Git history changes. The branch pointer moves only when you commit.',
      },
      {
        instruction: 'Stage the modified file.',
        hint: 'Use "git add Alice.txt".',
        expectedCommand: ['git add Alice.txt', 'git add .'],
        explanation: 'The index now contains the version of Alice.txt you want in the next commit.',
      },
      {
        instruction: 'Commit on the feature branch.',
        hint: 'Use "git commit -m \"Update Alice\"".',
        expectedCommand: 'git commit -m "Update Alice"',
        explanation: 'Only change-alice moved forward. main still points at the previous commit.',
      },
      {
        instruction: 'List local branches and confirm where HEAD points.',
        hint: 'Use "git branch".',
        expectedCommand: 'git branch',
        explanation: 'The star marks the branch HEAD is attached to. Commits advance that branch.',
      },
    ],
  },
  {
    id: 'merge',
    title: 'Merge Concepts',
    description: 'Fast-forward a branch and inspect the graph',
    icon: <GitMerge className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Switch back to main.',
        hint: 'Use "git switch main".',
        expectedCommand: ['git switch main', 'git checkout main'],
        explanation:
          'Switching moves HEAD and updates the working directory to match that branch snapshot.',
      },
      {
        instruction: 'Merge change-alice into main.',
        hint: 'Use "git merge change-alice".',
        expectedCommand: 'git merge change-alice',
        explanation:
          'Because main has not diverged, Git can fast-forward main to the same commit as change-alice.',
      },
      {
        instruction: 'Show the commit graph after the merge.',
        hint: 'Use "git log --oneline --graph --decorate".',
        expectedCommand: [
          'git log --oneline --graph --decorate',
          'git log --graph --oneline --decorate',
        ],
        explanation:
          'The graph shows commits and labels. Branch names are just labels pointing at commits.',
      },
    ],
  },
  {
    id: 'rebase',
    title: 'Fetch & Rebase',
    description: 'Bring in remote work and replay your local branch on top',
    icon: <GitFork className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Create a new feature branch from main.',
        hint: 'Use "git switch -c feature-bob".',
        expectedCommand: ['git switch -c feature-bob', 'git checkout -b feature-bob'],
        explanation:
          'Feature branches let you work without moving main until you are ready to integrate.',
      },
      {
        instruction: 'Change Bob.txt on the feature branch.',
        hint: 'Use "echo \"Bob learns remotes.\" >> Bob.txt".',
        expectedCommand: 'echo "Bob learns remotes." >> Bob.txt',
        explanation:
          'This change is local. It exists only in the working directory until you stage and commit it.',
      },
      {
        instruction: 'Stage the Bob change.',
        hint: 'Use "git add Bob.txt".',
        expectedCommand: ['git add Bob.txt', 'git add .'],
        explanation:
          'The feature branch still has not moved, but the index now has the Bob change ready for a commit.',
      },
      {
        instruction: 'Commit the Bob change on your feature branch.',
        hint: 'Use "git commit -m \"Teach Bob remotes\"".',
        expectedCommand: 'git commit -m "Teach Bob remotes"',
        explanation:
          'Your feature branch now points at a local commit that origin/main does not have.',
      },
      {
        instruction: 'Fetch a simulated teammate change from origin.',
        hint: 'Use "git fetch".',
        expectedCommand: 'git fetch',
        explanation:
          'fetch updates remote-tracking branches without changing your current branch or working directory.',
      },
      {
        instruction: 'Rebase your feature branch onto the updated origin/main.',
        hint: 'Use "git rebase origin/main".',
        expectedCommand: 'git rebase origin/main',
        explanation:
          'rebase replays your branch commits on top of a new base, creating a linear story.',
      },
      {
        instruction: 'Read the final graph with local and remote labels.',
        hint: 'Use "git log --oneline --graph --decorate --all".',
        expectedCommand: [
          'git log --oneline --graph --decorate --all',
          'git log --graph --oneline --decorate --all',
        ],
        explanation:
          'Seeing all branch labels together makes the pointer model click: commits are history, labels are movable names.',
      },
    ],
  },
];

function createInitialState(): RepoState {
  const c1: Commit = {
    id: 'a1b2c3d',
    message: 'Add README',
    parents: [],
    files: {
      'README.md': '# Git Concepts Lab\nPractice Git by watching the model change.',
    },
  };
  const c2: Commit = {
    id: 'b2c3d4e',
    message: 'Add Alice',
    parents: [c1.id],
    files: {
      ...c1.files,
      'Alice.txt': 'Hi, I am Alice.',
    },
  };

  return {
    currentBranch: 'main',
    head: c2.id,
    branches: { main: c2.id },
    upstreams: { main: 'origin/main' },
    remoteBranches: { 'origin/main': c2.id },
    commits: [c1, c2],
    working: [],
    staged: [],
    fetchedRemoteUpdate: false,
    nextCommitNumber: 3,
  };
}

function splitCommand(input: string): string[] {
  return input.match(/"[^"]*"|'[^']*'|\S+/g)?.map((part) => part.replace(/^["']|["']$/g, '')) ?? [];
}

function normalizeCommand(command: string) {
  return command.trim().replace(/\s+/g, ' ');
}

function commandMatches(cmd: string, expected: string | string[]) {
  const normalized = normalizeCommand(cmd);
  if (Array.isArray(expected))
    return expected.some((item) => normalizeCommand(item) === normalized);
  return normalizeCommand(expected) === normalized;
}

function findCommit(state: RepoState, id: string) {
  return state.commits.find((commit) => commit.id === id);
}

function headCommit(state: RepoState) {
  return findCommit(state, state.head) ?? state.commits[state.commits.length - 1];
}

function currentFiles(state: RepoState) {
  const base = { ...headCommit(state).files };

  for (const change of state.staged) {
    base[change.file] = change.content;
  }
  for (const change of state.working) {
    base[change.file] = change.content;
  }

  return base;
}

function upsertChange(changes: Change[], next: Change) {
  return [...changes.filter((change) => change.file !== next.file), next];
}

function removeChanges(changes: Change[], files: string[]) {
  return changes.filter((change) => !files.includes(change.file));
}

function nextCommitId(number: number) {
  return `c${number}d${number + 1}e${number + 2}f`;
}

function isAncestor(state: RepoState, maybeAncestor: string, commitId: string): boolean {
  if (maybeAncestor === commitId) return true;
  const commit = findCommit(state, commitId);
  if (!commit) return false;
  return commit.parents.some((parent) => isAncestor(state, maybeAncestor, parent));
}

function statusText(state: RepoState) {
  const upstream = state.upstreams[state.currentBranch];
  const upstreamHead = upstream ? state.remoteBranches[upstream] : undefined;
  const ahead =
    upstreamHead && state.head !== upstreamHead && isAncestor(state, upstreamHead, state.head);
  const behind =
    upstreamHead && state.head !== upstreamHead && isAncestor(state, state.head, upstreamHead);
  const diverged = upstreamHead && state.head !== upstreamHead && !ahead && !behind;

  const lines = [`On branch ${state.currentBranch}`];
  if (upstream) {
    if (ahead) lines.push(`Your branch is ahead of '${upstream}' by 1 commit.`);
    else if (behind) lines.push(`Your branch is behind '${upstream}' by 1 commit.`);
    else if (diverged) lines.push(`Your branch and '${upstream}' have diverged.`);
    else lines.push(`Your branch is up to date with '${upstream}'.`);
  }

  if (state.staged.length > 0) {
    lines.push('', 'Changes to be committed:');
    for (const change of state.staged)
      lines.push(`  ${change.kind === 'untracked' ? 'new file' : 'modified'}: ${change.file}`);
  }
  if (state.working.length > 0) {
    lines.push('', 'Changes not staged for commit:');
    for (const change of state.working) lines.push(`  ${change.kind}: ${change.file}`);
  }
  if (state.staged.length === 0 && state.working.length === 0) {
    lines.push('', 'nothing to commit, working tree clean');
  }

  return lines.join('\n');
}

function formatFiles(state: RepoState, long = false) {
  const files = Object.keys(currentFiles(state)).sort();
  if (!long) return files.join('  ');
  return files
    .map(
      (file) =>
        `-rw-r--r--  1 devops  devops  ${String(currentFiles(state)[file].length).padStart(3)} ${file}`
    )
    .join('\n');
}

function diffForChange(change: Change) {
  return `diff --git a/${change.file} b/${change.file}
--- a/${change.file}
+++ b/${change.file}
@@ -1 +1 @@
+${change.content.split('\n').slice(-1)[0]}`;
}

function logText(state: RepoState, includeAll: boolean) {
  const commits = [...state.commits].reverse();
  return commits
    .filter((commit) => includeAll || isAncestor(state, commit.id, state.head))
    .map((commit, index) => {
      const labels = [
        ...Object.entries(state.branches)
          .filter(([, id]) => id === commit.id)
          .map(([name]) => (name === state.currentBranch ? `HEAD -> ${name}` : name)),
        ...Object.entries(state.remoteBranches)
          .filter(([, id]) => id === commit.id)
          .map(([name]) => name),
      ];
      const prefix = index === 0 ? '* ' : '| ';
      return `${prefix}${commit.id} ${labels.length ? `(${labels.join(', ')}) ` : ''}${commit.message}`;
    })
    .join('\n');
}

function branchText(state: RepoState, all = false) {
  const local = Object.keys(state.branches).map((branch) =>
    branch === state.currentBranch ? `* ${branch}` : `  ${branch}`
  );
  const remote = all
    ? Object.keys(state.remoteBranches).map((branch) => `  remotes/${branch}`)
    : [];
  return [...local, ...remote].join('\n');
}

function changedFilesAgainstFirstParent(state: RepoState, commit: Commit) {
  const parent = commit.parents[0] ? findCommit(state, commit.parents[0]) : undefined;
  const parentFiles = parent?.files ?? {};

  return Object.fromEntries(
    Object.entries(commit.files).filter(([file, content]) => parentFiles[file] !== content)
  );
}

function parseEcho(input: string) {
  const match = input.match(/^echo\s+["'](.+)["']\s*(>>|>)\s*(\S+)$/);
  if (!match) return null;
  return { text: match[1], operator: match[2], file: match[3] };
}

export default function GitConceptsSimulator() {
  const [repo, setRepo] = useState<RepoState>(createInitialState);
  const lastRunHadError = useRef(false);

  const addWorkingChange = useCallback((file: string, content: string) => {
    setRepo((prev) => {
      const files = currentFiles(prev);
      const kind: ChangeKind = Object.prototype.hasOwnProperty.call(headCommit(prev).files, file)
        ? 'modified'
        : 'untracked';
      const nextContent = content.startsWith('append:')
        ? `${files[file] ?? ''}${files[file] ? '\n' : ''}${content.replace('append:', '')}`
        : content;
      return {
        ...prev,
        working: upsertChange(prev.working, { file, content: nextContent, kind }),
      };
    });
  }, []);

  const runGit = useCallback(
    (args: string[]): { output: string; type: TerminalLine['type'] } => {
      const command = args[0];
      const rest = args.slice(1);

      switch (command) {
        case 'status':
          return { output: statusText(repo), type: 'output' };

        case 'add': {
          const targets =
            rest.includes('.') || rest.includes('-A')
              ? repo.working.map((change) => change.file)
              : rest;
          const selected = repo.working.filter((change) => targets.includes(change.file));
          if (selected.length === 0)
            return { output: 'nothing specified, nothing added', type: 'output' };
          setRepo((prev) => ({
            ...prev,
            staged: selected.reduce((items, change) => upsertChange(items, change), prev.staged),
            working: removeChanges(
              prev.working,
              selected.map((change) => change.file)
            ),
          }));
          return { output: '', type: 'output' };
        }

        case 'diff': {
          const staged = rest.includes('--staged') || rest.includes('--cached');
          const changes = staged ? repo.staged : repo.working;
          return {
            output: changes.length ? changes.map(diffForChange).join('\n\n') : '',
            type: 'output',
          };
        }

        case 'commit': {
          const messageIndex = rest.findIndex((item) => item === '-m' || item === '--message');
          const inlineMessage = rest.find(
            (item) => item.startsWith('-m=') || item.startsWith('--message=')
          );
          const message =
            inlineMessage?.split('=').slice(1).join('=') ||
            (messageIndex >= 0 ? rest[messageIndex + 1] : '');
          if (repo.staged.length === 0)
            return { output: 'nothing to commit, working tree clean', type: 'output' };
          if (!message)
            return { output: 'error: commit message required in this lab', type: 'error' };

          const files = { ...headCommit(repo).files };
          for (const change of repo.staged) files[change.file] = change.content;
          const id = nextCommitId(repo.nextCommitNumber);
          const commit: Commit = { id, message, parents: [repo.head], files };

          setRepo((prev) => ({
            ...prev,
            commits: [...prev.commits, commit],
            head: id,
            branches: { ...prev.branches, [prev.currentBranch]: id },
            staged: [],
            nextCommitNumber: prev.nextCommitNumber + 1,
          }));

          return {
            output: `[${repo.currentBranch} ${id}] ${message}\n ${repo.staged.length} file changed`,
            type: 'output',
          };
        }

        case 'log': {
          const includeAll = rest.includes('--all');
          return { output: logText(repo, includeAll), type: 'output' };
        }

        case 'branch': {
          if (rest[0] === '-a') return { output: branchText(repo, true), type: 'output' };
          return { output: branchText(repo), type: 'output' };
        }

        case 'switch':
        case 'checkout': {
          const create = rest[0] === '-c' || rest[0] === '-b';
          const branch = create ? rest[1] : rest[0];
          if (!branch) return { output: `usage: git ${command} [-c] <branch>`, type: 'error' };
          if (repo.working.length || repo.staged.length) {
            return {
              output: 'error: commit or stash your changes before switching branches',
              type: 'error',
            };
          }
          if (create && repo.branches[branch])
            return { output: `fatal: a branch named '${branch}' already exists`, type: 'error' };
          if (!create && !repo.branches[branch])
            return {
              output: `error: pathspec '${branch}' did not match any branch`,
              type: 'error',
            };

          setRepo((prev) => ({
            ...prev,
            currentBranch: branch,
            head: create ? prev.head : prev.branches[branch],
            branches: create ? { ...prev.branches, [branch]: prev.head } : prev.branches,
          }));
          return {
            output: create
              ? `Switched to a new branch '${branch}'`
              : `Switched to branch '${branch}'`,
            type: 'output',
          };
        }

        case 'merge': {
          const branch = rest[0];
          if (!branch || !repo.branches[branch])
            return { output: `merge: ${branch || ''} - not something we can merge`, type: 'error' };
          const target = repo.branches[branch];
          if (target === repo.head) return { output: 'Already up to date.', type: 'output' };
          if (isAncestor(repo, repo.head, target)) {
            setRepo((prev) => ({
              ...prev,
              head: target,
              branches: { ...prev.branches, [prev.currentBranch]: target },
            }));
            return { output: `Updating ${repo.head}..${target}\nFast-forward`, type: 'output' };
          }
          return {
            output:
              'Automatic merge would create a merge commit. This lab focuses on fast-forward merge here.',
            type: 'output',
          };
        }

        case 'push': {
          const upstream = repo.upstreams[repo.currentBranch] ?? `origin/${repo.currentBranch}`;
          setRepo((prev) => ({
            ...prev,
            upstreams: { ...prev.upstreams, [prev.currentBranch]: upstream },
            remoteBranches: { ...prev.remoteBranches, [upstream]: prev.head },
          }));
          return {
            output: `To github.com:example/git-concepts-lab.git\n   ${upstream} -> ${repo.currentBranch}`,
            type: 'output',
          };
        }

        case 'fetch': {
          if (repo.fetchedRemoteUpdate) return { output: 'Already up to date.', type: 'output' };
          const originMain = repo.remoteBranches['origin/main'];
          const originCommit = findCommit(repo, originMain) ?? headCommit(repo);
          const id = nextCommitId(repo.nextCommitNumber);
          const commit: Commit = {
            id,
            message: 'Teammate updates README',
            parents: [originMain],
            files: {
              ...originCommit.files,
              'README.md': `${originCommit.files['README.md']}\nFetched teammate note.`,
            },
          };
          setRepo((prev) => ({
            ...prev,
            commits: [...prev.commits, commit],
            remoteBranches: { ...prev.remoteBranches, 'origin/main': id },
            fetchedRemoteUpdate: true,
            nextCommitNumber: prev.nextCommitNumber + 1,
          }));
          return {
            output: 'From github.com:example/git-concepts-lab\n   origin/main updated',
            type: 'output',
          };
        }

        case 'rebase': {
          const target = rest[0];
          const targetHead = repo.remoteBranches[target] || repo.branches[target];
          if (!targetHead)
            return { output: `fatal: invalid upstream '${target || ''}'`, type: 'error' };
          if (repo.currentBranch === 'main')
            return {
              output: 'Current branch main is already the integration branch in this lab.',
              type: 'output',
            };
          if (isAncestor(repo, targetHead, repo.head))
            return { output: 'Current branch is up to date.', type: 'output' };
          const targetCommit = findCommit(repo, targetHead);
          if (!targetCommit)
            return { output: `fatal: invalid upstream '${target}'`, type: 'error' };
          // Replay every commit on this branch that the target does not have,
          // oldest first, the way git does. Replaying only the tip would drop
          // earlier unpushed commits (such as "Update Alice") without a word.
          const toReplay: Commit[] = [];
          for (
            let c: Commit | undefined = headCommit(repo);
            c && !isAncestor(repo, c.id, targetHead);
            c = c.parents[0] ? findCommit(repo, c.parents[0]) : undefined
          ) {
            toReplay.unshift(c);
          }
          let base: Commit = targetCommit;
          let number = repo.nextCommitNumber;
          const replayed: Commit[] = [];
          for (const original of toReplay) {
            const commit: Commit = {
              id: nextCommitId(number++),
              message: original.message,
              parents: [base.id],
              files: { ...base.files, ...changedFilesAgainstFirstParent(repo, original) },
              rebasedFrom: original.id,
            };
            replayed.push(commit);
            base = commit;
          }
          setRepo((prev) => ({
            ...prev,
            commits: [...prev.commits, ...replayed],
            head: base.id,
            branches: { ...prev.branches, [prev.currentBranch]: base.id },
            nextCommitNumber: number,
          }));
          return {
            output: `Successfully rebased and updated refs/heads/${repo.currentBranch}.`,
            type: 'output',
          };
        }

        default:
          return {
            output: `git: '${command || ''}' is not a git command in this lab`,
            type: 'error',
          };
      }
    },
    [repo]
  );

  const executeOne = useCallback(
    (rawInput: string): { output: string; type: TerminalLine['type'] } => {
      const input = rawInput.trim();
      if (!input) return { output: '', type: 'output' };

      const echo = parseEcho(input);
      if (echo) {
        addWorkingChange(echo.file, echo.operator === '>>' ? `append:${echo.text}` : echo.text);
        return { output: '', type: 'output' };
      }

      const args = splitCommand(input);
      const command = args[0];

      if (command === 'help') {
        return {
          output: `Available commands:
  pwd, ls, ls -l, cat FILE, clear
  echo "text" > FILE
  echo "text" >> FILE
  git status
  git add FILE
  git diff [--staged]
  git commit -m "message"
  git log --oneline --graph --decorate [--all]
  git branch [-a]
  git switch [-c] BRANCH
  git merge BRANCH
  git push
  git fetch
  git rebase origin/main`,
          type: 'output',
        };
      }

      if (command === 'pwd') return { output: '/home/devops/git-concepts-lab', type: 'output' };
      if (command === 'ls')
        return { output: formatFiles(repo, args.includes('-l')), type: 'output' };
      if (command === 'cat') {
        const file = args[1];
        const files = currentFiles(repo);
        if (!file || !files[file])
          return { output: `cat: ${file || ''}: No such file`, type: 'error' };
        return { output: files[file], type: 'output' };
      }
      if (command === 'git') return runGit(args.slice(1));
      return { output: `command not found: ${command || ''}`, type: 'error' };
    },
    [addWorkingChange, repo, runGit]
  );

  const executeCommand = useCallback(
    (rawInput: string): ExecuteResult => {
      const input = rawInput.trim();
      if (input === 'clear') {
        return { output: '', clear: true };
      }

      const commands = input.split(/\s*(?:&&|;)\s*/).filter(Boolean);
      const results = commands.map(executeOne);
      const output = results
        .map((result) => result.output)
        .filter(Boolean)
        .join('\n');
      const type = results.some((result) => result.type === 'error') ? 'error' : 'output';
      lastRunHadError.current = type === 'error';
      return { output, type };
    },
    [executeOne]
  );

  const onReset = useCallback(() => {
    setRepo(createInitialState());
  }, []);

  const lab = useTerminalSimulator({
    lessons: LESSONS,
    execute: executeCommand,
    matches: (cmd, command) =>
      !lastRunHadError.current && commandMatches(cmd, command.expectedCommand),
    successMessage: (command) => `OK: ${command.explanation}`,
    completionKeyStyle: 'index',
    advanceDelayMs: 500,
    historyStyle: 'recent-first',
    promoteOutputType: true,
    guardRepeatCompletion: true,
    onReset,
    // SimComplete signals Opsville, on the render that completes the last command.
    signalOnComplete: false,
    autoFocus: false,
  });
  const { currentCommand, terminalHistory, inputValue, setInputValue, inputRef, submitCommand } =
    lab;
  const ui = useSimLab(lab);
  const expected = currentCommand
    ? Array.isArray(currentCommand.expectedCommand)
      ? currentCommand.expectedCommand[0]
      : currentCommand.expectedCommand
    : undefined;

  return (
    <SimFrame>
      <SimLabBar
        title="Git Concepts Simulator"
        icon={GitBranch}
        lessons={LESSONS}
        lab={lab}
        ui={ui}
        task={currentCommand?.instruction}
        hint={currentCommand?.hint}
        showMe={expected}
      />

      {ui.showComplete ? (
        <SimComplete
          title="Lab complete"
          summary="You practiced Git as a model of snapshots, areas, refs, remotes, and history."
          stats={labStats(lab, LESSONS, ui, { showMe: true })}
          actions={
            <Button type="button" variant="outline" onClick={ui.keepExploring}>
              Keep exploring
            </Button>
          }
          onPlayAgain={ui.startOver}
          playAgainLabel="Start over"
        />
      ) : (
        <SimLabLayout
          terminal={
            <SimTerminal
              label="~/repo"
              status={`HEAD -> ${repo.currentBranch}`}
              lines={labLines(terminalHistory, [
                { type: 'success', content: 'Welcome to the Git Concepts Lab.' },
                {
                  type: 'muted',
                  content: 'Type "help", run "git status", or follow the task above.',
                },
              ])}
              prompt="$"
              value={inputValue}
              onChange={setInputValue}
              onSubmit={submitCommand}
              onKeyDown={lab.handleKeyDown}
              inputRef={inputRef}
              placeholder="git status"
              autoFocus
              heightClassName={LAB_TERMINAL_HEIGHT}
            />
          }
          aside={
            <>
              <SimLabPanel
                title="Repository"
                icon={Send}
                summary={`${repo.currentBranch}, ${repo.staged.length} staged`}
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <Metric label="Branch" value={repo.currentBranch} />
                    <Metric label="Staged" value={String(repo.staged.length)} />
                    <Metric label="Working" value={String(repo.working.length)} />
                  </div>
                  <ConceptPipeline repo={repo} />
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <StateHeading>Pointer model</StateHeading>
                    <p>
                      <strong className="text-foreground">HEAD</strong> follows{' '}
                      <strong className="text-foreground">{repo.currentBranch}</strong>.
                    </p>
                    <p>
                      <strong className="text-foreground">{repo.currentBranch}</strong> points at{' '}
                      <strong className="font-mono text-foreground">{repo.head}</strong>.
                    </p>
                    <p>
                      Branches and remote refs are labels. Commits are immutable snapshots with
                      parent links.
                    </p>
                  </div>
                </div>
              </SimLabPanel>
              <SimLabPanel
                title="Commit graph"
                icon={GitFork}
                summary={`${repo.commits.length} commits`}
              >
                <CommitGraph repo={repo} />
              </SimLabPanel>
              <SimLabPanel title="Lessons" icon={BookOpen} summary={lessonsSummary(LESSONS, lab)}>
                <SimLabLessons lessons={LESSONS} lab={lab} ui={ui} />
              </SimLabPanel>
            </>
          }
        />
      )}
    </SimFrame>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-1.5">
      <p className="truncate font-mono text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ConceptPipeline({ repo }: { repo: RepoState }) {
  const localClean = repo.working.length === 0 && repo.staged.length === 0;
  const remoteRefs = Object.entries(repo.remoteBranches);

  return (
    <div className="space-y-3">
      <StateHeading>Git areas</StateHeading>
      <AreaCard
        title="Working Directory"
        tone="amber"
        items={repo.working.map((change) => `${change.kind}: ${change.file}`)}
        empty="Clean"
      />
      <AreaCard
        title="Staging Area"
        tone="sky"
        items={repo.staged.map((change) => `${change.kind}: ${change.file}`)}
        empty="Nothing staged"
      />
      <AreaCard
        title="Local Repository"
        tone="emerald"
        items={[
          `${repo.currentBranch} -> ${repo.head}`,
          localClean ? 'working tree clean' : 'snapshot pending',
        ]}
        empty=""
      />
      <AreaCard
        title="Remote Repository"
        tone="violet"
        items={remoteRefs.map(([name, id]) => `${name} -> ${id}`)}
        empty="No remotes"
      />
    </div>
  );
}

function AreaCard({
  title,
  tone,
  items,
  empty,
}: {
  title: string;
  tone: 'amber' | 'sky' | 'emerald' | 'violet';
  items: string[];
  empty: string;
}) {
  const categories = {
    amber: SIM_CATEGORY.primary,
    sky: SIM_CATEGORY.sky,
    emerald: SIM_CATEGORY.emerald,
    violet: SIM_CATEGORY.violet,
  };

  return (
    <div className={cn('rounded-md border p-3', categories[tone].fill, categories[tone].border)}>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="space-y-1">
        {(items.length ? items : [empty]).map((item) => (
          <p key={item} className="truncate font-mono text-xs text-muted-foreground">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function CommitGraph({ repo }: { repo: RepoState }) {
  const visibleCommits = [...repo.commits].reverse().slice(0, 7);

  return (
    <div className="space-y-3">
      {visibleCommits.map((commit) => {
        const labels = [
          ...Object.entries(repo.branches)
            .filter(([, id]) => id === commit.id)
            .map(([name]) => name),
          ...Object.entries(repo.remoteBranches)
            .filter(([, id]) => id === commit.id)
            .map(([name]) => name),
        ];

        return (
          <div key={commit.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="h-4 w-4 rounded-full border-2 border-primary bg-background" />
              <div className="h-full min-h-8 w-px bg-border" />
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-xs font-semibold">{commit.id}</span>
                {labels.map((label) => (
                  <Badge
                    key={label}
                    variant={label === repo.currentBranch ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {label === repo.currentBranch ? `HEAD -> ${label}` : label}
                  </Badge>
                ))}
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">{commit.message}</p>
              {commit.rebasedFrom && (
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  replayed from {commit.rebasedFrom}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StateHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h4>
  );
}
