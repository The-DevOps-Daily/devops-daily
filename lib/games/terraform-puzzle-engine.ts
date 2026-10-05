// Puzzle engine for the Terraform State Puzzle. Pure and deterministic, so the
// puzzles can be unit tested. Every option is judged against the puzzle's
// starting situation: a wrong pick shows what would happen, then the player
// tries again.

/** best and works solve the puzzle; incomplete is safe but not done; unsafe does damage. */
export type Verdict = 'best' | 'works' | 'incomplete' | 'unsafe';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

/** A terminal transcript. Lines come from real Terraform runs (see the puzzles file). */
export interface Transcript {
  id: string;
  title: string;
  command: string;
  lines: string[];
  /** Shown above the output, for example where a long transcript starts. */
  note?: string;
  /** Output continues past the last line shown. */
  trimmed?: boolean;
}

export interface SourceFile {
  name: string;
  lines: string[];
}

/** A fact from outside Terraform, such as the AWS console or CI. Never shown as terminal output. */
export interface Note {
  source: string;
  lines: string[];
}

export interface Inspect {
  id: string;
  label: string;
  /** Either a real command and its output, or a note from another system. */
  transcript?: Transcript;
  note?: Note;
}

export type BindingAction =
  | 'none'
  | 'create'
  | 'destroy'
  | 'replace'
  | 'move'
  | 'import'
  | 'forget'
  | 'untracked'
  | 'conflict';

/** One row of "address in code / address in state / real object". */
export interface Binding {
  code?: string;
  state?: string;
  object?: string;
  action: BindingAction;
}

export interface Outcome {
  verdict: Verdict;
  summary: string;
  explanation: string;
  transcripts: Transcript[];
  bindings?: Binding[];
}

export interface PuzzleOption {
  id: string;
  label: string;
  /** The code change or command, shown in monospace. */
  code: string[];
  outcome: Outcome;
  /** Inspect steps this option depends on. Picking it before them uses `unchecked` instead. */
  requires?: string[];
  unchecked?: Omit<Outcome, 'transcripts' | 'bindings'> &
    Partial<Pick<Outcome, 'transcripts' | 'bindings'>>;
}

export interface DocLink {
  title: string;
  href: string;
}

export interface Puzzle {
  id: string;
  title: string;
  difficulty: Difficulty;
  /** Oldest Terraform version that has the recommended fix. */
  minVersion?: string;
  story: string;
  goal: string;
  files: SourceFile[];
  evidence: Transcript[];
  notes?: Note[];
  inspects: Inspect[];
  /** Header for the state column of the binding table, such as the workspace. */
  stateLabel?: string;
  bindings: Binding[];
  options: PuzzleOption[];
  hint: string;
  lesson: string;
  docs: DocLink[];
}

export interface PickRecord {
  optionId: string;
  verdict: Verdict;
  /** Picks made after the puzzle was solved are for exploring and do not count. */
  explore: boolean;
}

export interface PuzzleProgress {
  inspected: string[];
  picks: PickRecord[];
  hint: boolean;
}

export interface GameState {
  current: number;
  progress: Record<string, PuzzleProgress>;
  finished: boolean;
}

export type PuzzleStatus = 'todo' | 'started' | 'clean' | 'solved';

export const SOLVING: Verdict[] = ['best', 'works'];

export function isSolving(v: Verdict): boolean {
  return SOLVING.includes(v);
}

function emptyProgress(): PuzzleProgress {
  return { inspected: [], picks: [], hint: false };
}

export function createGame(puzzles: Puzzle[]): GameState {
  const progress: Record<string, PuzzleProgress> = {};
  for (const p of puzzles) progress[p.id] = emptyProgress();
  return { current: 0, progress, finished: false };
}

export function getProgress(state: GameState, puzzleId: string): PuzzleProgress {
  return state.progress[puzzleId] ?? emptyProgress();
}

function withProgress(state: GameState, puzzleId: string, next: PuzzleProgress): GameState {
  return { ...state, progress: { ...state.progress, [puzzleId]: next } };
}

export function getOption(puzzle: Puzzle, optionId: string): PuzzleOption {
  const o = puzzle.options.find((x) => x.id === optionId);
  if (!o) throw new Error(`Unknown option ${optionId} in ${puzzle.id}`);
  return o;
}

/** Inspect steps an option still needs before it counts. */
export function missingChecks(option: PuzzleOption, inspected: string[]): string[] {
  return (option.requires ?? []).filter((id) => !inspected.includes(id));
}

/** The outcome of an option, given what the player has inspected so far. */
export function evaluate(puzzle: Puzzle, optionId: string, inspected: string[]): Outcome {
  const option = getOption(puzzle, optionId);
  if (option.unchecked && missingChecks(option, inspected).length > 0) {
    return {
      transcripts: option.outcome.transcripts,
      bindings: option.outcome.bindings,
      ...option.unchecked,
    };
  }
  return option.outcome;
}

export function isSolved(progress: PuzzleProgress): boolean {
  return progress.picks.some((p) => !p.explore && isSolving(p.verdict));
}

export function inspect(state: GameState, puzzle: Puzzle, inspectId: string): GameState {
  if (!puzzle.inspects.some((i) => i.id === inspectId)) {
    throw new Error(`Unknown inspect ${inspectId} in ${puzzle.id}`);
  }
  const prog = getProgress(state, puzzle.id);
  if (prog.inspected.includes(inspectId)) return state;
  return withProgress(state, puzzle.id, { ...prog, inspected: [...prog.inspected, inspectId] });
}

export function choose(state: GameState, puzzle: Puzzle, optionId: string): GameState {
  const prog = getProgress(state, puzzle.id);
  const outcome = evaluate(puzzle, optionId, prog.inspected);
  const pick: PickRecord = { optionId, verdict: outcome.verdict, explore: isSolved(prog) };
  return withProgress(state, puzzle.id, { ...prog, picks: [...prog.picks, pick] });
}

export function takeHint(state: GameState, puzzle: Puzzle): GameState {
  const prog = getProgress(state, puzzle.id);
  if (prog.hint) return state;
  return withProgress(state, puzzle.id, { ...prog, hint: true });
}

export function goTo(state: GameState, puzzles: Puzzle[], index: number): GameState {
  const current = Math.max(0, Math.min(puzzles.length - 1, index));
  return { ...state, current, finished: false };
}

export function finish(state: GameState): GameState {
  return { ...state, finished: true };
}

/** clean: the first pick solved it. solved: solved after other picks. */
export function puzzleStatus(progress: PuzzleProgress): PuzzleStatus {
  const scored = progress.picks.filter((p) => !p.explore);
  if (isSolved(progress)) return isSolving(scored[0].verdict) ? 'clean' : 'solved';
  return scored.length > 0 || progress.inspected.length > 0 ? 'started' : 'todo';
}

/** The index of the next puzzle that is not solved, after `from`, wrapping around. */
export function nextUnsolved(state: GameState, puzzles: Puzzle[], from: number): number | null {
  for (let step = 1; step <= puzzles.length; step++) {
    const i = (from + step) % puzzles.length;
    if (!isSolved(getProgress(state, puzzles[i].id))) return i;
  }
  return null;
}

export interface Score {
  solved: number;
  clean: number;
  total: number;
  /** Scored picks that would have destroyed, duplicated or reverted something. */
  unsafePicks: number;
  /** Scored picks that were safe but did not reach the goal. */
  incompletePicks: number;
  hints: number;
}

export function score(state: GameState, puzzles: Puzzle[]): Score {
  let solved = 0;
  let clean = 0;
  let unsafePicks = 0;
  let incompletePicks = 0;
  let hints = 0;
  for (const p of puzzles) {
    const prog = getProgress(state, p.id);
    const status = puzzleStatus(prog);
    if (status === 'clean' || status === 'solved') solved++;
    if (status === 'clean') clean++;
    if (prog.hint) hints++;
    for (const pick of prog.picks) {
      if (pick.explore) continue;
      if (pick.verdict === 'unsafe') unsafePicks++;
      if (pick.verdict === 'incomplete') incompletePicks++;
    }
  }
  return { solved, clean, total: puzzles.length, unsafePicks, incompletePicks, hints };
}

export type LineTone =
  'add' | 'remove' | 'change' | 'replace' | 'error' | 'warn' | 'muted' | 'plain';

/** Colour hint for a line of Terraform output, from its leading symbol or keyword. */
export function lineTone(line: string): LineTone {
  const t = line.trimStart();
  // A list item under a warning, such as the objects a removed block forgets.
  if (/^ - /.test(line)) return 'plain';
  if (t.startsWith('-/+') || t.startsWith('+/-')) return 'replace';
  if (/^Error:/.test(t) || t.startsWith('│ Error')) return 'error';
  if (/^Warning:/.test(t) || t.startsWith('# Warning:')) return 'warn';
  if (t.startsWith('#')) return 'muted';
  // git diff lines have no space after the sign; Terraform's always do.
  if (line.startsWith('+++') || line.startsWith('---')) return 'muted';
  if (t.startsWith('+ ') || t === '+' || /^\+\S/.test(line)) return 'add';
  if (t.startsWith('- ') || t === '-' || /^-\S/.test(line)) return 'remove';
  if (t.startsWith('~ ')) return 'change';
  return 'plain';
}

/** The "Plan: X to add, ..." line of a transcript, if it has one. */
export function planSummary(t: Transcript): string | null {
  for (let i = t.lines.length - 1; i >= 0; i--) {
    const l = t.lines[i];
    if (/^Plan: /.test(l) || l.startsWith('No changes.')) return l;
  }
  return null;
}

/** Splits a template string into lines, dropping one leading and one trailing newline. */
export function lines(text: string): string[] {
  return text.replace(/^\n/, '').replace(/\n$/, '').split('\n');
}
