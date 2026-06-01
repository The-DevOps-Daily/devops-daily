'use client';

import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle,
  CircleDot,
  Cloud,
  Code2,
  FileText,
  GitBranch,
  GitCommit,
  GitFork,
  GitMerge,
  Lightbulb,
  Play,
  RotateCcw,
  Send,
  Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type ChangeKind = 'untracked' | 'modified';
type TerminalType = 'input' | 'output' | 'error' | 'success';

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

interface TerminalLine {
  type: TerminalType;
  content: string;
  timestamp: Date;
}

const LESSONS: Lesson[] = [
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
          'git diff shows unstaged changes by default. --staged compares the index to HEAD.',
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
        explanation:
          'The index now contains the version of Alice.txt you want in the next commit.',
      },
      {
        instruction: 'Commit on the feature branch.',
        hint: 'Use "git commit -m \"Update Alice\"".',
        expectedCommand: 'git commit -m "Update Alice"',
        explanation:
          'Only change-alice moved forward. main still points at the previous commit.',
      },
      {
        instruction: 'List local branches and confirm where HEAD points.',
        hint: 'Use "git branch".',
        expectedCommand: 'git branch',
        explanation:
          'The star marks the branch HEAD is attached to. Commits advance that branch.',
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
  if (Array.isArray(expected)) return expected.some((item) => normalizeCommand(item) === normalized);
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
  const ahead = upstreamHead && state.head !== upstreamHead && isAncestor(state, upstreamHead, state.head);
  const behind = upstreamHead && state.head !== upstreamHead && isAncestor(state, state.head, upstreamHead);
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
    for (const change of state.staged) lines.push(`  ${change.kind === 'untracked' ? 'new file' : 'modified'}: ${change.file}`);
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
  return files.map((file) => `-rw-r--r--  1 devops  devops  ${String(currentFiles(state)[file].length).padStart(3)} ${file}`).join('\n');
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
  const remote = all ? Object.keys(state.remoteBranches).map((branch) => `  remotes/${branch}`) : [];
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
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0);
  const [completedCommands, setCompletedCommands] = useState<Set<string>>(new Set());
  const [terminalHistory, setTerminalHistory] = useState<TerminalLine[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentLesson = LESSONS[currentLessonIndex];
  const currentCommand = currentLesson.commands[currentCommandIndex];
  const totalCommands = LESSONS.reduce((sum, lesson) => sum + lesson.commands.length, 0);
  const completedCount = completedCommands.size;
  const progress = (completedCount / totalCommands) * 100;

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight });
  }, [terminalHistory]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addWorkingChange = useCallback((file: string, content: string) => {
    setRepo((prev) => {
      const files = currentFiles(prev);
      const kind: ChangeKind = Object.prototype.hasOwnProperty.call(headCommit(prev).files, file) ? 'modified' : 'untracked';
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
    (args: string[]): { output: string; type: TerminalType } => {
      const command = args[0];
      const rest = args.slice(1);

      switch (command) {
        case 'status':
          return { output: statusText(repo), type: 'output' };

        case 'add': {
          const targets = rest.includes('.') || rest.includes('-A') ? repo.working.map((change) => change.file) : rest;
          const selected = repo.working.filter((change) => targets.includes(change.file));
          if (selected.length === 0) return { output: 'nothing specified, nothing added', type: 'output' };
          setRepo((prev) => ({
            ...prev,
            staged: selected.reduce((items, change) => upsertChange(items, change), prev.staged),
            working: removeChanges(prev.working, selected.map((change) => change.file)),
          }));
          return { output: '', type: 'output' };
        }

        case 'diff': {
          const staged = rest.includes('--staged') || rest.includes('--cached');
          const changes = staged ? repo.staged : repo.working;
          return { output: changes.length ? changes.map(diffForChange).join('\n\n') : '', type: 'output' };
        }

        case 'commit': {
          const messageIndex = rest.findIndex((item) => item === '-m' || item === '--message');
          const inlineMessage = rest.find((item) => item.startsWith('-m=') || item.startsWith('--message='));
          const message = inlineMessage?.split('=').slice(1).join('=') || (messageIndex >= 0 ? rest[messageIndex + 1] : '');
          if (repo.staged.length === 0) return { output: 'nothing to commit, working tree clean', type: 'output' };
          if (!message) return { output: 'error: commit message required in this lab', type: 'error' };

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

          return { output: `[${repo.currentBranch} ${id}] ${message}\n ${repo.staged.length} file changed`, type: 'output' };
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
            return { output: 'error: commit or stash your changes before switching branches', type: 'error' };
          }
          if (create && repo.branches[branch]) return { output: `fatal: a branch named '${branch}' already exists`, type: 'error' };
          if (!create && !repo.branches[branch]) return { output: `error: pathspec '${branch}' did not match any branch`, type: 'error' };

          setRepo((prev) => ({
            ...prev,
            currentBranch: branch,
            head: create ? prev.head : prev.branches[branch],
            branches: create ? { ...prev.branches, [branch]: prev.head } : prev.branches,
          }));
          return { output: create ? `Switched to a new branch '${branch}'` : `Switched to branch '${branch}'`, type: 'output' };
        }

        case 'merge': {
          const branch = rest[0];
          if (!branch || !repo.branches[branch]) return { output: `merge: ${branch || ''} - not something we can merge`, type: 'error' };
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
          return { output: 'Automatic merge would create a merge commit. This lab focuses on fast-forward merge here.', type: 'output' };
        }

        case 'push': {
          const upstream = repo.upstreams[repo.currentBranch] ?? `origin/${repo.currentBranch}`;
          setRepo((prev) => ({
            ...prev,
            upstreams: { ...prev.upstreams, [prev.currentBranch]: upstream },
            remoteBranches: { ...prev.remoteBranches, [upstream]: prev.head },
          }));
          return { output: `To github.com:example/git-concepts-lab.git\n   ${upstream} -> ${repo.currentBranch}`, type: 'output' };
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
            files: { ...originCommit.files, 'README.md': `${originCommit.files['README.md']}\nFetched teammate note.` },
          };
          setRepo((prev) => ({
            ...prev,
            commits: [...prev.commits, commit],
            remoteBranches: { ...prev.remoteBranches, 'origin/main': id },
            fetchedRemoteUpdate: true,
            nextCommitNumber: prev.nextCommitNumber + 1,
          }));
          return { output: 'From github.com:example/git-concepts-lab\n   origin/main updated', type: 'output' };
        }

        case 'rebase': {
          const target = rest[0];
          const targetHead = repo.remoteBranches[target] || repo.branches[target];
          if (!targetHead) return { output: `fatal: invalid upstream '${target || ''}'`, type: 'error' };
          if (repo.currentBranch === 'main') return { output: 'Current branch main is already the integration branch in this lab.', type: 'output' };
          if (repo.head === targetHead) return { output: 'Current branch is up to date.', type: 'output' };
          const current = headCommit(repo);
          const targetCommit = findCommit(repo, targetHead);
          if (!targetCommit) return { output: `fatal: invalid upstream '${target}'`, type: 'error' };
          const id = nextCommitId(repo.nextCommitNumber);
          const commit: Commit = {
            id,
            message: current.message,
            parents: [targetHead],
            files: { ...targetCommit.files, ...changedFilesAgainstFirstParent(repo, current) },
            rebasedFrom: current.id,
          };
          setRepo((prev) => ({
            ...prev,
            commits: [...prev.commits, commit],
            head: id,
            branches: { ...prev.branches, [prev.currentBranch]: id },
            nextCommitNumber: prev.nextCommitNumber + 1,
          }));
          return { output: `Successfully rebased and updated refs/heads/${repo.currentBranch}.`, type: 'output' };
        }

        default:
          return { output: `git: '${command || ''}' is not a git command in this lab`, type: 'error' };
      }
    },
    [repo]
  );

  const executeOne = useCallback(
    (rawInput: string): { output: string; type: TerminalType } => {
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
      if (command === 'ls') return { output: formatFiles(repo, args.includes('-l')), type: 'output' };
      if (command === 'cat') {
        const file = args[1];
        const files = currentFiles(repo);
        if (!file || !files[file]) return { output: `cat: ${file || ''}: No such file`, type: 'error' };
        return { output: files[file], type: 'output' };
      }
      if (command === 'git') return runGit(args.slice(1));
      return { output: `command not found: ${command || ''}`, type: 'error' };
    },
    [addWorkingChange, repo, runGit]
  );

  const executeCommand = useCallback(
    (rawInput: string) => {
      const input = rawInput.trim();
      if (!input) return;
      if (input === 'clear') {
        setTerminalHistory([]);
        setInputValue('');
        return;
      }

      const commands = input.split(/\s*(?:&&|;)\s*/).filter(Boolean);
      const results = commands.map(executeOne);
      const output = results.map((result) => result.output).filter(Boolean).join('\n');
      const type = results.some((result) => result.type === 'error') ? 'error' : 'output';
      const commandKey = `${currentLessonIndex}-${currentCommandIndex}`;
      const isExpected = currentCommand ? commandMatches(input, currentCommand.expectedCommand) : false;
      const outputType = isExpected && type !== 'error' ? 'success' : type;

      if (isExpected && !completedCommands.has(commandKey) && type !== 'error') {
        setCompletedCommands((prev) => new Set(prev).add(commandKey));
        setTimeout(() => {
          if (currentCommandIndex < currentLesson.commands.length - 1) {
            setCurrentCommandIndex((index) => index + 1);
          } else if (currentLessonIndex < LESSONS.length - 1) {
            setCurrentLessonIndex((index) => index + 1);
            setCurrentCommandIndex(0);
          }
          setShowHint(false);
        }, 500);
      }

      setTerminalHistory((prev) => [
        ...prev,
        { type: 'input', content: input, timestamp: new Date() },
        ...(output
          ? [{ type: outputType, content: output, timestamp: new Date() }]
          : []),
        ...(isExpected && currentCommand && type !== 'error'
          ? [
              {
                type: 'success' as const,
                content: `OK: ${currentCommand.explanation}`,
                timestamp: new Date(),
              },
            ]
          : []),
      ]);
      setCommandHistory((prev) => [input, ...prev.filter((item) => item !== input)].slice(0, 25));
      setHistoryIndex(-1);
      setInputValue('');
    },
    [
      completedCommands,
      currentCommand,
      currentCommandIndex,
      currentLesson,
      currentLessonIndex,
      executeOne,
    ]
  );

  const resetLab = useCallback(() => {
    setRepo(createInitialState());
    setCurrentLessonIndex(0);
    setCurrentCommandIndex(0);
    setCompletedCommands(new Set());
    setTerminalHistory([]);
    setInputValue('');
    setCommandHistory([]);
    setHistoryIndex(-1);
    setShowHint(false);
    inputRef.current?.focus();
  }, []);

  const runCurrentCommand = useCallback(() => {
    const command = Array.isArray(currentCommand.expectedCommand)
      ? currentCommand.expectedCommand[0]
      : currentCommand.expectedCommand;
    executeCommand(command);
  }, [currentCommand, executeCommand]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      executeCommand(inputValue);
    },
    [executeCommand, inputValue]
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey && event.key === 'c') {
      event.preventDefault();
      setTerminalHistory((prev) => [
        ...prev,
        {
          type: inputValue.trim() ? 'input' : 'output',
          content: inputValue.trim() ? `${inputValue}^C` : '^C',
          timestamp: new Date(),
        },
      ]);
      setInputValue('');
      setHistoryIndex(-1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
      if (nextIndex >= 0) {
        setHistoryIndex(nextIndex);
        setInputValue(commandHistory[nextIndex]);
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(nextIndex);
      setInputValue(nextIndex >= 0 ? commandHistory[nextIndex] : '');
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-md border bg-muted/20 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-primary">
              <GitBranch className="h-6 w-6" />
            </div>
            <div>
              <p className="font-mono text-xs text-muted-foreground">// git mental model lab</p>
              <h2 className="text-2xl font-bold md:text-3xl">Git Concepts Simulator</h2>
            </div>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Practice Git by watching files move through the working directory, staging area, local
            repository, branch pointers, and remote repository.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedCount}/{totalCommands}
              </span>
            </div>
            <Progress value={progress} />
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Branch" value={repo.currentBranch} />
              <Metric label="Staged" value={String(repo.staged.length)} />
              <Metric label="Working" value={String(repo.working.length)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_330px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Code2 className="h-5 w-5" />
                Lessons
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {LESSONS.map((lesson, lessonIndex) => {
                const lessonCompleted = lesson.commands.every((_, commandIndex) =>
                  completedCommands.has(`${lessonIndex}-${commandIndex}`)
                );
                const active = lessonIndex === currentLessonIndex;

                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => {
                      setCurrentLessonIndex(lessonIndex);
                      setCurrentCommandIndex(0);
                      setShowHint(false);
                      inputRef.current?.focus();
                    }}
                    className={cn(
                      'w-full rounded-md border p-2.5 text-left transition-colors',
                      active
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-border hover:border-primary/40 hover:bg-muted/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('rounded-md border p-1.5', active ? 'text-primary' : 'text-muted-foreground')}>
                        {lessonCompleted ? <CheckCircle className="h-5 w-5 text-emerald-500" /> : lesson.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{lesson.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{lesson.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Button size="sm" variant="outline" onClick={resetLab} className="w-full">
            <RotateCcw className="mr-1 h-4 w-4" />
            Reset lab
          </Button>
        </div>

        <div className="space-y-4">
          <Card className="border-primary/40">
            <CardContent className="space-y-2.5 p-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      Lesson {currentLessonIndex + 1} / {LESSONS.length}
                    </Badge>
                    <Badge>
                      Step {currentCommandIndex + 1} / {currentLesson.commands.length}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium sm:text-base">{currentCommand.instruction}</p>
                  {showHint && (
                    <p className="mt-2 rounded-md border border-primary/30 bg-primary/10 p-2 text-sm text-muted-foreground">
                      {currentCommand.hint}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowHint((value) => !value)}>
                    <Lightbulb className="mr-1 h-4 w-4" />
                    Hint
                  </Button>
                  <Button size="sm" onClick={runCurrentCommand}>
                    <Play className="mr-1 h-4 w-4" />
                    Run
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border bg-[#171717]">
            <CardHeader className="border-b border-border/60 bg-[#262626] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  </div>
                  <span className="ml-2 text-sm text-muted-foreground">git-concepts ~/repo</span>
                </div>
                <Badge variant="secondary" className="font-mono text-[11px]">
                  HEAD {'->'} {repo.currentBranch}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div
                ref={terminalRef}
                className="h-[580px] cursor-text overflow-y-auto p-5 font-mono text-sm leading-relaxed sm:text-[15px]"
                onClick={() => inputRef.current?.focus()}
              >
                {terminalHistory.length === 0 && (
                  <div className="mb-4 text-emerald-400">
                    <p>Welcome to Git Concepts Lab.</p>
                    <p className="mt-2 text-muted-foreground">
                      Type "help", run "git status", or follow the current task above.
                    </p>
                  </div>
                )}
                {terminalHistory.map((line, index) => (
                  <div
                    key={`${line.timestamp.getTime()}-${index}`}
                    className={cn(
                      'mb-2 whitespace-pre-wrap break-words',
                      line.type === 'input' && 'text-slate-100',
                      line.type === 'output' && 'text-slate-300',
                      line.type === 'error' && 'text-red-400',
                      line.type === 'success' &&
                        'rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300'
                    )}
                  >
                    {line.type === 'input' && <span className="text-emerald-400">$ </span>}
                    {line.content}
                  </div>
                ))}
                <form onSubmit={handleSubmit} className="flex items-center">
                  <span className="text-emerald-400">$</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onKeyDown={handleKeyDown}
                    className="ml-2 min-w-0 flex-1 bg-transparent text-slate-100 caret-emerald-400 outline-none"
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="off"
                    placeholder="git status"
                  />
                </form>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <ConceptPipeline repo={repo} />
          <CommitGraph repo={repo} />
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CircleDot className="h-5 w-5" />
                Pointer Model
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">HEAD</strong> follows{' '}
                <strong className="text-foreground">{repo.currentBranch}</strong>.
              </p>
              <p>
                <strong className="text-foreground">{repo.currentBranch}</strong> points at{' '}
                <strong className="font-mono text-foreground">{repo.head}</strong>.
              </p>
              <p>
                Branches and remote refs are labels. Commits are immutable snapshots with parent
                links.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {completedCount === totalCommands && (
        <Card className="mt-4 border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="font-semibold">Lab complete</p>
                <p className="text-sm text-muted-foreground">
                  You practiced Git as a model of snapshots, areas, refs, remotes, and history.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={resetLab}>
              Start over
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <p className="truncate text-sm font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ConceptPipeline({ repo }: { repo: RepoState }) {
  const localClean = repo.working.length === 0 && repo.staged.length === 0;
  const remoteRefs = Object.entries(repo.remoteBranches);

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-5 w-5" />
          Git Areas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <AreaCard title="Working Directory" tone="amber" items={repo.working.map((change) => `${change.kind}: ${change.file}`)} empty="Clean" />
        <AreaCard title="Staging Area" tone="sky" items={repo.staged.map((change) => `${change.kind}: ${change.file}`)} empty="Nothing staged" />
        <AreaCard title="Local Repository" tone="emerald" items={[`${repo.currentBranch} -> ${repo.head}`, localClean ? 'working tree clean' : 'snapshot pending']} empty="" />
        <AreaCard title="Remote Repository" tone="violet" items={remoteRefs.map(([name, id]) => `${name} -> ${id}`)} empty="No remotes" />
      </CardContent>
    </Card>
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
  const tones = {
    amber: 'border-amber-500/30 bg-amber-500/10',
    sky: 'border-sky-500/30 bg-sky-500/10',
    emerald: 'border-emerald-500/30 bg-emerald-500/10',
    violet: 'border-violet-500/30 bg-violet-500/10',
  };

  return (
    <div className={cn('rounded-md border p-3', tones[tone])}>
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
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitFork className="h-5 w-5" />
          Commit Graph
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
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
                    <Badge key={label} variant={label === repo.currentBranch ? 'default' : 'secondary'} className="text-[10px]">
                      {label === repo.currentBranch ? `HEAD -> ${label}` : label}
                    </Badge>
                  ))}
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{commit.message}</p>
                {commit.rebasedFrom && (
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    replayed from {commit.rebasedFrom}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
