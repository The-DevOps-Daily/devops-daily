'use client';

import type { ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';
import {
  ArrowUpDown,
  BarChart3,
  BookOpen,
  CircleCheck,
  Columns3,
  Combine,
  Database,
  Filter,
  Group,
  Layers,
  Leaf,
  Lightbulb,
  Pencil,
  Sigma,
  Table,
  Target,
  Terminal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LAB_TERMINAL_HEIGHT,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimHowTo,
  SimLabBar,
  SimLabLayout,
  SimLabLessons,
  SimLabPanel,
  SimResetButton,
  SimTerminal,
  focusTerminal,
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
import {
  COLLECTIONS,
  formatResult,
  normalizeMongo,
  resultsMatch,
  runMongo,
} from '@/lib/games/mongo-sim-engine';

interface Lesson {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  commands: LessonCommand[];
}

interface LessonCommand {
  instruction: string;
  hint: string;
  expectedCommand: string | string[];
  explanation: string;
}

const LESSONS: Lesson[] = [
  {
    id: 'find',
    title: 'find() basics',
    description: 'Read documents from a collection',
    icon: <Table className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Return every document in the customers collection.',
        hint: 'Use "db.customers.find()".',
        expectedCommand: 'db.customers.find()',
        explanation:
          'find() with no filter returns every document in the collection, like SELECT * in SQL.',
      },
      {
        instruction: 'Return only the customers based in the USA.',
        hint: 'Pass a filter document: db.customers.find({ country: "USA" }).',
        expectedCommand: 'db.customers.find({ country: "USA" })',
        explanation:
          'The first argument to find() is a filter document. { country: "USA" } keeps documents where the country field equals "USA".',
      },
    ],
  },
  {
    id: 'projection',
    title: 'Projections',
    description: 'Return only the fields you need',
    icon: <Columns3 className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Return the name and country of every customer, without the _id field.',
        hint: 'The second argument to find() is a projection: db.customers.find({}, { name: 1, country: 1, _id: 0 }).',
        expectedCommand: 'db.customers.find({}, { name: 1, country: 1, _id: 0 })',
        explanation:
          'The second argument to find() is a projection. 1 includes a field, 0 excludes it. _id is returned by default unless you set it to 0.',
      },
    ],
  },
  {
    id: 'operators',
    title: 'Query operators',
    description: 'Compare with $lt, $gt, $gte, $lte',
    icon: <Filter className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Return the products that cost less than 50.',
        hint: 'Use a comparison operator: db.products.find({ price: { $lt: 50 } }).',
        expectedCommand: 'db.products.find({ price: { $lt: 50 } })',
        explanation:
          'Operators like $lt (less than), $gt, $gte, and $lte go inside a nested document for the field: { price: { $lt: 50 } }.',
      },
    ],
  },
  {
    id: 'sort-limit',
    title: 'Sort and limit',
    description: 'Order documents and cap the result',
    icon: <ArrowUpDown className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Return the five most expensive products.',
        hint: 'Chain cursor methods: db.products.find().sort({ price: -1 }).limit(5).',
        expectedCommand: 'db.products.find().sort({ price: -1 }).limit(5)',
        explanation:
          'sort({ price: -1 }) orders high to low (1 is ascending). limit(5) caps the cursor at five documents. Cursor methods chain onto find().',
      },
    ],
  },
  {
    id: 'skip',
    title: 'Paging with skip',
    description: 'Return the next page of results',
    icon: <Layers className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Return the second page of five products, ordered by price from high to low.',
        hint: 'Combine skip and limit: db.products.find().sort({ price: -1 }).skip(5).limit(5).',
        expectedCommand: 'db.products.find().sort({ price: -1 }).skip(5).limit(5)',
        explanation:
          'skip(5) jumps past the first five documents; limit(5) then returns the next five. That is offset-style pagination on a cursor.',
      },
    ],
  },
  {
    id: 'in',
    title: 'Matching a set with $in',
    description: 'Match any value from a list',
    icon: <Combine className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Return the orders whose status is either shipped or pending.',
        hint: 'Use $in with an array: db.orders.find({ status: { $in: ["shipped", "pending"] } }).',
        expectedCommand: 'db.orders.find({ status: { $in: ["shipped", "pending"] } })',
        explanation:
          '$in matches when the field equals any value in the array. It is the document way of writing SQL’s IN (...).',
      },
    ],
  },
  {
    id: 'count',
    title: 'Counting documents',
    description: 'Count matches without returning them',
    icon: <Sigma className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Count how many orders have been delivered.',
        hint: 'Use countDocuments with a filter: db.orders.countDocuments({ status: "delivered" }).',
        expectedCommand: 'db.orders.countDocuments({ status: "delivered" })',
        explanation:
          'countDocuments(filter) returns the number of matching documents, so you get a count without pulling the documents back.',
      },
    ],
  },
  {
    id: 'write',
    title: 'insert, update, delete',
    description: 'Write documents and read the result',
    icon: <Pencil className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Insert a new customer with _id 9, name Ivy Chen, country USA.',
        hint: 'Use insertOne: db.customers.insertOne({ _id: 9, name: "Ivy Chen", country: "USA" }).',
        expectedCommand: 'db.customers.insertOne({ _id: 9, name: "Ivy Chen", country: "USA" })',
        explanation:
          'insertOne adds a document and returns { acknowledged: true, insertedId }. This demo does not persist the change, so the dataset stays fixed for the other lessons.',
      },
      {
        instruction: 'Set the price of the product with _id 1 to 54.99.',
        hint: 'Use updateOne with $set: db.products.updateOne({ _id: 1 }, { $set: { price: 54.99 } }).',
        expectedCommand: 'db.products.updateOne({ _id: 1 }, { $set: { price: 54.99 } })',
        explanation:
          'updateOne(filter, update) changes the first matching document. $set assigns fields. The result reports matchedCount and modifiedCount.',
      },
      {
        instruction: 'Delete every cancelled order.',
        hint: 'Use deleteMany: db.orders.deleteMany({ status: "cancelled" }).',
        expectedCommand: 'db.orders.deleteMany({ status: "cancelled" })',
        explanation:
          'deleteMany removes every matching document and returns { deletedCount }. Here two orders are cancelled, so deletedCount is 2. Nothing is persisted.',
      },
    ],
  },
  {
    id: 'aggregate-group',
    title: 'Aggregation: $group',
    description: 'Summarise documents into groups',
    icon: <Group className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Count the orders in each status, most common first.',
        hint: 'Pipe $group into $sort: db.orders.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { count: -1 } }]).',
        expectedCommand:
          'db.orders.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { count: -1 } }])',
        explanation:
          'aggregate() runs an array of stages. $group buckets by _id (here the $status field) and { $sum: 1 } counts documents per bucket. $sort then orders the groups.',
      },
    ],
  },
  {
    id: 'aggregate-match',
    title: 'Aggregation: $match + $group',
    description: 'Filter, then group and average',
    icon: <BarChart3 className="h-5 w-5" />,
    commands: [
      {
        instruction:
          'For products priced 20 or more, show each category with its product count and average price, highest average first.',
        hint: 'Chain $match, $group, and $sort in the pipeline.',
        expectedCommand:
          'db.products.aggregate([{ $match: { price: { $gte: 20 } } }, { $group: { _id: "$category", n: { $sum: 1 }, avgPrice: { $avg: "$price" } } }, { $sort: { avgPrice: -1 } }])',
        explanation:
          '$match filters documents before grouping (like SQL’s WHERE). $group then computes { $sum: 1 } and { $avg: "$price" } per category, and $sort orders the result by the average.',
      },
    ],
  },
];

const TOTAL_DOCS = COLLECTIONS.reduce((sum, collection) => sum + collection.count, 0);

const HELP_TEXT = `Available commands:
  db.<collection>.find(filter, projection)   query documents
  ...find().sort({...}).skip(n).limit(n)      shape the cursor
  db.<collection>.countDocuments(filter)      count matches
  db.<collection>.insertOne / updateOne / deleteMany
  db.<collection>.aggregate([ ...stages ])    run a pipeline
  show collections                            list the collections
  help                                        show this message
  clear                                       clear the terminal

Try:
  db.customers.find({ country: "USA" })
  db.products.find().sort({ price: -1 }).limit(5)
  db.orders.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])`;

const COLLECTIONS_TEXT = COLLECTIONS.map((collection) => collection.name).join('\n');

function outputFor(input: string): ExecuteResult {
  const result = runMongo(input);
  if (result.kind === 'error') return { output: `Error: ${result.error}`, type: 'error' };
  if (result.kind === 'docs' && result.docs.length === 0) {
    return { output: '(no documents matched)' };
  }
  return { output: formatResult(result) };
}

function executeCommand(rawInput: string): ExecuteResult {
  const input = rawInput.trim();
  const bare = input
    .replace(/;+\s*$/, '')
    .trim()
    .toLowerCase();

  if (bare === 'clear') return { output: '', clear: true };
  if (bare === 'help' || bare === '\\h' || bare === '\\?') return { output: HELP_TEXT };
  if (bare === 'show collections' || bare === 'show tables' || bare === 'db.getcollectionnames()') {
    return { output: COLLECTIONS_TEXT };
  }
  return outputFor(input);
}

function commandMatches(cmd: string, expected: string | string[]): boolean {
  const normalized = normalizeMongo(cmd);
  if (Array.isArray(expected)) {
    return expected.some((item) => normalizeMongo(item) === normalized);
  }
  return normalizeMongo(expected) === normalized;
}

interface Challenge {
  id: string;
  question: string;
  solution: string;
}

const CHALLENGES: Challenge[] = [
  {
    id: 'uk-customers',
    question: 'Return the names of every customer in the UK (no _id), alphabetically.',
    solution: 'db.customers.find({ country: "UK" }, { name: 1, _id: 0 }).sort({ name: 1 })',
  },
  {
    id: 'top-3-expensive',
    question:
      'Return the 3 most expensive products (name and price, no _id), most expensive first.',
    solution: 'db.products.find({}, { name: 1, price: 1, _id: 0 }).sort({ price: -1 }).limit(3)',
  },
  {
    id: 'delivered-count',
    question: 'How many orders have the status "delivered"?',
    solution: 'db.orders.countDocuments({ status: "delivered" })',
  },
  {
    id: 'cheap-products',
    question: 'Return the products under 20 (name and price, no _id), cheapest first.',
    solution:
      'db.products.find({ price: { $lt: 20 } }, { name: 1, price: 1, _id: 0 }).sort({ price: 1 })',
  },
  {
    id: 'products-per-category',
    question: 'How many products are in each category? Most products first.',
    solution:
      'db.products.aggregate([{ $group: { _id: "$category", n: { $sum: 1 } } }, { $sort: { n: -1 } }])',
  },
  {
    id: 'cheapest-product',
    question: 'Return the single cheapest product (name and price, no _id).',
    solution: 'db.products.find({}, { name: 1, price: 1, _id: 0 }).sort({ price: 1 }).limit(1)',
  },
];

function gradeChallenge(
  input: string,
  challenge: Challenge
): { lines: TerminalLine[]; solved: boolean } {
  const now = () => new Date();
  const lines: TerminalLine[] = [{ type: 'input', content: input, timestamp: now() }];

  const userResult = runMongo(input);
  if (userResult.kind === 'error') {
    lines.push({ type: 'error', content: `Error: ${userResult.error}`, timestamp: now() });
    lines.push({
      type: 'error',
      content: "Not quite: that command didn't run. Fix it and try again.",
      timestamp: now(),
    });
    return { lines, solved: false };
  }

  const output = formatResult(userResult);
  lines.push({
    type: 'output',
    content:
      userResult.kind === 'docs' && userResult.docs.length === 0
        ? '(no documents matched)'
        : output,
    timestamp: now(),
  });

  const reference = runMongo(challenge.solution);
  if (resultsMatch(userResult, reference)) {
    lines.push({
      type: 'success',
      content: 'Correct! Your result matches the reference solution.',
      timestamp: now(),
    });
    return { lines, solved: true };
  }

  lines.push({
    type: 'error',
    content:
      "Not quite: your result doesn't match the expected output. Check the fields, filter, and order.",
    timestamp: now(),
  });
  return { lines, solved: false };
}

type Mode = 'lessons' | 'challenges';

export default function MongodbTerminalSimulator() {
  const lab = useTerminalSimulator({
    lessons: LESSONS,
    execute: executeCommand,
    matches: (cmd, command) => commandMatches(cmd, command.expectedCommand),
    successMessage: (command) => `✓ ${command.explanation}`,
    completionKeyStyle: 'index',
    advanceDelayMs: 700,
    historyStyle: 'recent-first',
    promoteOutputType: true,
    guardRepeatCompletion: true,
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

  // --- Challenge mode state -------------------------------------------------
  const [mode, setMode] = useState<Mode>('lessons');
  const [activeChallenge, setActiveChallenge] = useState(0);
  const [challengeInput, setChallengeInput] = useState('');
  const [challengeHistory, setChallengeHistory] = useState<TerminalLine[]>([]);
  const [solvedChallenges, setSolvedChallenges] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  /** "Keep practicing" closes the challenges' end card. */
  const [challengesDismissed, setChallengesDismissed] = useState(false);
  const challengeInputRef = useRef<HTMLInputElement>(null);
  const solvedCount = solvedChallenges.size;

  const submitChallenge = useCallback(
    (raw: string) => {
      const input = raw.trim();
      if (!input) return;
      setChallengeInput('');
      const bare = input
        .replace(/;+\s*$/, '')
        .trim()
        .toLowerCase();
      const now = () => new Date();

      if (bare === 'clear') {
        setChallengeHistory([]);
        return;
      }
      if (bare === 'help' || bare === '\\h' || bare === '\\?') {
        setChallengeHistory((prev) => [
          ...prev,
          { type: 'input', content: input, timestamp: now() },
          { type: 'output', content: HELP_TEXT, timestamp: now() },
        ]);
        return;
      }
      if (bare === 'show collections' || bare === 'show tables') {
        setChallengeHistory((prev) => [
          ...prev,
          { type: 'input', content: input, timestamp: now() },
          { type: 'output', content: COLLECTIONS_TEXT, timestamp: now() },
        ]);
        return;
      }

      const { lines, solved } = gradeChallenge(input, CHALLENGES[activeChallenge]);
      setChallengeHistory((prev) => [...prev, ...lines]);
      if (solved) {
        setSolvedChallenges((prev) => new Set(prev).add(activeChallenge));
        setRevealed((prev) => new Set(prev).add(activeChallenge));
      }
    },
    [activeChallenge]
  );

  const selectChallenge = useCallback((index: number) => {
    setActiveChallenge(index);
    focusTerminal(challengeInputRef.current);
  }, []);

  const revealSolution = useCallback(() => {
    setRevealed((prev) => new Set(prev).add(activeChallenge));
  }, [activeChallenge]);

  const resetChallenges = useCallback(() => {
    setActiveChallenge(0);
    setChallengeInput('');
    setChallengeHistory([]);
    setSolvedChallenges(new Set());
    setRevealed(new Set());
    setChallengesDismissed(false);
    focusTerminal(challengeInputRef.current);
  }, []);

  // The lessons' end card shows once per finished run: leaving it for the
  // challenges closes it, as "Keep exploring" does, so coming back to the
  // lessons never shows it (and signals Opsville) a second time.
  const switchMode = (next: Mode) => {
    if (next !== mode && lab.isComplete) ui.keepExploring();
    setMode(next);
  };

  const modeToggle = (
    <div role="group" aria-label="Mode" className="flex items-center gap-1">
      {(
        [
          ['lessons', 'Lessons', BookOpen],
          ['challenges', 'Challenges', Target],
        ] as const
      ).map(([value, label, Icon]) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={mode === value ? 'default' : 'outline'}
          aria-pressed={mode === value}
          onClick={() => switchMode(value)}
          className="h-10 lg:h-8"
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </Button>
      ))}
    </div>
  );

  const collectionsPanel = (
    <SimLabPanel
      title="Collections"
      icon={Database}
      summary={`${COLLECTIONS.length} collections, ${TOTAL_DOCS} documents`}
    >
      <div className="space-y-2">
        {COLLECTIONS.map((collection) => (
          <div key={collection.name} className="rounded-md border p-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 font-mono text-sm font-medium">
                <Table className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {collection.name}
              </p>
              <Badge variant="secondary" className="tabular-nums">
                {collection.count} docs
              </Badge>
            </div>
            <ul className="space-y-0.5">
              {collection.fields.map((field) => (
                <li
                  key={field.name}
                  className="flex items-center justify-between gap-2 font-mono text-xs"
                >
                  <span>{field.name}</span>
                  <span className="uppercase tracking-wide text-muted-foreground">
                    {field.type}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SimLabPanel>
  );

  const cheatSheet = (
    <SimLabPanel title="Cheat sheet" icon={Terminal}>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {CHEAT_SHEET.map(([keywords, what]) => (
          <li key={keywords}>
            <code className="font-mono text-xs font-semibold text-foreground">{keywords}</code>{' '}
            {what}
          </li>
        ))}
      </ul>
    </SimLabPanel>
  );

  if (mode === 'challenges') {
    const challenge = CHALLENGES[activeChallenge];
    const solved = solvedChallenges.has(activeChallenge);
    return (
      <SimFrame key="challenges">
        <SimBar
          title="MongoDB Terminal Simulator"
          icon={Leaf}
          lead={modeToggle}
          steps={CHALLENGES.map((c, i) => ({
            title: c.question,
            status: solvedChallenges.has(i) ? 'done' : 'todo',
            statusLabel: solvedChallenges.has(i) ? 'solved' : 'not solved yet',
          }))}
          current={activeChallenge}
          onStep={selectChallenge}
          stepNoun="Challenge"
          stepsLabel="Challenges"
          tools={
            <SimResetButton
              onReset={resetChallenges}
              label="Reset challenges"
              confirmLabel="Reset challenges?"
            />
          }
          progress={{ current: activeChallenge + 1, total: CHALLENGES.length }}
          heading={`Challenge ${activeChallenge + 1}`}
          meta={
            solved && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-correct-foreground">
                <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> Solved
              </span>
            )
          }
          actions={
            <>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {solvedCount}/{CHALLENGES.length} solved
              </span>
              {!revealed.has(activeChallenge) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 lg:h-8"
                  onClick={revealSolution}
                >
                  <Lightbulb className="h-4 w-4" aria-hidden="true" />
                  Show solution
                </Button>
              )}
            </>
          }
          goal={challenge.question}
        >
          <SimHowTo summary="How challenges work" autoOpen={challengeHistory.length === 0}>
            Write your own MongoDB command in the terminal and press Enter. Your result is graded
            against the expected output.
          </SimHowTo>
          {revealed.has(activeChallenge) && (
            <SimFeedback tone="hint" label="Reference solution" role="status">
              <code className="block whitespace-pre-wrap break-words font-mono text-xs">
                {challenge.solution}
              </code>
            </SimFeedback>
          )}
        </SimBar>

        {solvedCount === CHALLENGES.length && !challengesDismissed ? (
          <SimComplete
            title="All challenges solved"
            summary="You wrote every command yourself. Reset to practice again, or head back to the lessons."
            signal={false}
            learned={null}
            stats={[
              { label: 'Challenges', value: `${solvedCount}/${CHALLENGES.length}` },
              { label: 'Lessons', value: `${lab.completedCount}/${lab.totalCommands}` },
            ]}
            actions={
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setChallengesDismissed(true)}
                >
                  Keep practicing
                </Button>
                <Button type="button" variant="outline" onClick={() => switchMode('lessons')}>
                  Back to the lessons
                </Button>
              </>
            }
            onPlayAgain={resetChallenges}
            playAgainLabel="Reset challenges"
          />
        ) : (
          <SimLabLayout
            terminal={
              <SimTerminal
                label="mongosh"
                status="challenge mode"
                prompt="devops>"
                lines={labLines(challengeHistory, [
                  {
                    type: 'success',
                    content: 'Challenge mode: write the MongoDB command yourself.',
                  },
                  {
                    type: 'muted',
                    content:
                      'Type a command to answer the current challenge, run "show collections", or "help" for commands.',
                  },
                ])}
                value={challengeInput}
                onChange={setChallengeInput}
                onSubmit={submitChallenge}
                inputRef={challengeInputRef}
                placeholder="db.products.find(...)"
                autoFocus
                heightClassName={LAB_TERMINAL_HEIGHT}
              />
            }
            aside={
              <>
                <SimLabPanel
                  title="Challenges"
                  icon={Target}
                  summary={`${solvedCount} of ${CHALLENGES.length} solved`}
                >
                  <ol className="space-y-0.5">
                    {CHALLENGES.map((c, index) => {
                      const done = solvedChallenges.has(index);
                      const active = index === activeChallenge;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => selectChallenge(index)}
                            aria-current={active ? 'step' : undefined}
                            aria-label={`Challenge ${index + 1}: ${c.question}${done ? ', solved' : ''}`}
                            className={cn(
                              'flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              active
                                ? 'border-primary/60 bg-primary/10'
                                : 'border-transparent hover:bg-muted'
                            )}
                          >
                            {done ? (
                              <CircleCheck
                                className="mt-0.5 h-4 w-4 shrink-0 text-correct-foreground"
                                aria-hidden="true"
                              />
                            ) : (
                              <span className="mt-0.5 w-4 shrink-0 text-center font-mono text-xs text-muted-foreground">
                                {index + 1}
                              </span>
                            )}
                            <span className="min-w-0 flex-1">{c.question}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </SimLabPanel>
                {collectionsPanel}
              </>
            }
          />
        )}
      </SimFrame>
    );
  }

  return (
    <SimFrame key="lessons">
      <SimLabBar
        title="MongoDB Terminal Simulator"
        icon={Leaf}
        lead={modeToggle}
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
          summary="You queried, filtered, projected, sorted, counted, grouped and changed documents in the mongo shell."
          stats={labStats(lab, LESSONS, ui, { showMe: true })}
          actions={
            <>
              <Button type="button" variant="outline" onClick={ui.keepExploring}>
                Keep exploring
              </Button>
              <Button type="button" variant="outline" onClick={() => switchMode('challenges')}>
                <Target className="h-4 w-4" aria-hidden="true" />
                Try the challenges
              </Button>
            </>
          }
          onPlayAgain={ui.startOver}
          playAgainLabel="Start over"
        />
      ) : (
        <SimLabLayout
          terminal={
            <SimTerminal
              label="mongosh"
              status="devops>"
              prompt="devops>"
              lines={labLines(terminalHistory, [
                { type: 'success', content: 'Welcome to the MongoDB shell.' },
                {
                  type: 'muted',
                  content: 'Type "help", run "show collections", or follow the task above.',
                },
              ])}
              value={inputValue}
              onChange={setInputValue}
              onSubmit={submitCommand}
              onKeyDown={lab.handleKeyDown}
              inputRef={inputRef}
              placeholder="db.customers.find()"
              autoFocus
              heightClassName={LAB_TERMINAL_HEIGHT}
            />
          }
          aside={
            <>
              {collectionsPanel}
              <SimLabPanel title="Lessons" icon={BookOpen} summary={lessonsSummary(LESSONS, lab)}>
                <SimLabLessons lessons={LESSONS} lab={lab} ui={ui} />
              </SimLabPanel>
              {cheatSheet}
            </>
          }
        />
      )}
    </SimFrame>
  );
}

const CHEAT_SHEET = [
  ['find(filter, projection)', 'read documents'],
  ['{ field: 1, _id: 0 }', 'include / exclude fields'],
  ['$lt $gt $gte $lte $ne', 'comparisons'],
  ['$in / $and / $or', 'combine'],
  ['sort / skip / limit', 'shape the cursor'],
  ['countDocuments(filter)', 'count matches'],
  ['insertOne / updateOne / deleteMany', 'write'],
  ['aggregate([ $match, $group, $sort ])', 'pipeline'],
] as const;
