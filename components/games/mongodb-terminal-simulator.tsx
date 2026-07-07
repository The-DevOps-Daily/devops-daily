'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  BarChart3,
  BookOpen,
  CheckCircle,
  Circle,
  Columns3,
  Combine,
  Database,
  Filter,
  Group,
  Layers,
  Leaf,
  Lightbulb,
  Pencil,
  Play,
  RotateCcw,
  Sigma,
  Table,
  Target,
  Terminal,
  Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
  const bare = input.replace(/;+\s*$/, '').trim().toLowerCase();

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
    question: 'Return the 3 most expensive products (name and price, no _id), most expensive first.',
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
    solution: 'db.products.find({ price: { $lt: 20 } }, { name: 1, price: 1, _id: 0 }).sort({ price: 1 })',
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
  challenge: Challenge,
): { lines: TerminalLine[]; solved: boolean } {
  const now = () => new Date();
  const lines: TerminalLine[] = [{ type: 'input', content: input, timestamp: now() }];

  const userResult = runMongo(input);
  if (userResult.kind === 'error') {
    lines.push({ type: 'error', content: `Error: ${userResult.error}`, timestamp: now() });
    lines.push({
      type: 'error',
      content: "Not quite — that command didn't run. Fix it and try again.",
      timestamp: now(),
    });
    return { lines, solved: false };
  }

  const output = formatResult(userResult);
  lines.push({
    type: 'output',
    content: userResult.kind === 'docs' && userResult.docs.length === 0 ? '(no documents matched)' : output,
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
    content: "Not quite — your result doesn't match the expected output. Check the fields, filter, and order.",
    timestamp: now(),
  });
  return { lines, solved: false };
}

export default function MongodbTerminalSimulator() {
  const {
    currentLessonIndex,
    currentCommandIndex,
    currentLesson,
    currentCommand,
    completedCommands,
    completedCount,
    totalCommands,
    progressPercentage,
    terminalHistory,
    inputValue,
    setInputValue,
    showHint,
    setShowHint,
    inputRef,
    terminalRef,
    submitCommand,
    handleSubmit,
    handleKeyDown,
    resetProgress,
    jumpToLesson,
  } = useTerminalSimulator({
    lessons: LESSONS,
    execute: executeCommand,
    matches: (cmd, command) => commandMatches(cmd, command.expectedCommand),
    successMessage: (command) => `✓ ${command.explanation}`,
    completionKeyStyle: 'index',
    advanceDelayMs: 700,
    historyStyle: 'recent-first',
    promoteOutputType: true,
    guardRepeatCompletion: true,
  });

  const resetLab = useCallback(() => {
    resetProgress();
    inputRef.current?.focus();
  }, [inputRef, resetProgress]);

  const runCurrentCommand = useCallback(() => {
    if (!currentCommand) return;
    const command = Array.isArray(currentCommand.expectedCommand)
      ? currentCommand.expectedCommand[0]
      : currentCommand.expectedCommand;
    submitCommand(command);
  }, [currentCommand, submitCommand]);

  // --- Challenge mode state -------------------------------------------------
  const [mode, setMode] = useState<'lessons' | 'challenges'>('lessons');
  const [activeChallenge, setActiveChallenge] = useState(0);
  const [challengeInput, setChallengeInput] = useState('');
  const [challengeHistory, setChallengeHistory] = useState<TerminalLine[]>([]);
  const [solvedChallenges, setSolvedChallenges] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const challengeInputRef = useRef<HTMLInputElement>(null);
  const challengeTerminalRef = useRef<HTMLDivElement>(null);
  const solvedCount = solvedChallenges.size;

  useEffect(() => {
    if (challengeTerminalRef.current) {
      challengeTerminalRef.current.scrollTop = challengeTerminalRef.current.scrollHeight;
    }
  }, [challengeHistory]);

  const submitChallenge = useCallback(
    (raw: string) => {
      const input = raw.trim();
      if (!input) return;
      setChallengeInput('');
      const bare = input.replace(/;+\s*$/, '').trim().toLowerCase();
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
    [activeChallenge],
  );

  const handleChallengeSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      submitChallenge(challengeInput);
    },
    [challengeInput, submitChallenge],
  );

  const selectChallenge = useCallback((index: number) => {
    setActiveChallenge(index);
    challengeInputRef.current?.focus();
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
    challengeInputRef.current?.focus();
  }, []);

  const switchMode = useCallback(
    (next: 'lessons' | 'challenges') => {
      setMode(next);
      if (next === 'challenges') {
        window.setTimeout(() => challengeInputRef.current?.focus(), 0);
      } else {
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    },
    [inputRef],
  );

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-md border bg-muted/20 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-primary">
              <Leaf className="h-6 w-6" />
            </div>
            <div>
              <p className="font-mono text-xs text-muted-foreground">// mongo shell playground</p>
              <h2 className="text-2xl font-bold md:text-3xl">MongoDB Terminal Simulator</h2>
            </div>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Practice MongoDB queries against a small e-commerce dataset in a safe browser terminal.
            Every command runs live: filter and project with find(), shape the cursor with sort, skip,
            and limit, write with insertOne, updateOne, and deleteMany, and summarise with the
            aggregation pipeline. The data mirrors the SQL simulator, so you can see the same records
            as documents.
          </p>
          <div className="mt-4 inline-flex rounded-md border bg-background p-1">
            <button
              type="button"
              onClick={() => switchMode('lessons')}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                mode === 'lessons'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <BookOpen className="h-4 w-4" />
              Lessons
            </button>
            <button
              type="button"
              onClick={() => switchMode('challenges')}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                mode === 'challenges'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Target className="h-4 w-4" />
              Challenges
            </button>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {mode === 'lessons' ? 'Progress' : 'Challenges solved'}
              </span>
              <span className="text-sm text-muted-foreground">
                {mode === 'lessons'
                  ? `${completedCount}/${totalCommands}`
                  : `${solvedCount}/${CHALLENGES.length}`}
              </span>
            </div>
            <Progress
              value={mode === 'lessons' ? progressPercentage : (solvedCount / CHALLENGES.length) * 100}
            />
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Collections" value={COLLECTIONS.length} />
              <Metric label="Documents" value={TOTAL_DOCS} />
              {mode === 'lessons' ? (
                <Metric label="Lessons" value={LESSONS.length} />
              ) : (
                <Metric label="Challenges" value={CHALLENGES.length} />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        {mode === 'lessons' ? (
          <>
            <div className="space-y-4">
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="h-5 w-5" />
                    Lessons
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-4 pt-0">
                  {LESSONS.map((lesson, lessonIndex) => {
                    const lessonCompleted = lesson.commands.every((_, commandIndex) =>
                      completedCommands.has(`${lessonIndex}-${commandIndex}`),
                    );
                    const active = lessonIndex === currentLessonIndex;

                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => {
                          jumpToLesson(lessonIndex);
                          inputRef.current?.focus();
                        }}
                        className={cn(
                          'w-full rounded-md border p-2.5 text-left transition-colors',
                          active
                            ? 'border-primary/60 bg-primary/10'
                            : 'border-border hover:border-primary/40 hover:bg-muted/30',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'rounded-md border p-1.5',
                              active ? 'text-primary' : 'text-muted-foreground',
                            )}
                          >
                            {lesson.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium">{lesson.title}</p>
                              {lessonCompleted && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                            </div>
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
                      <p className="text-sm font-medium sm:text-base">{currentCommand?.instruction}</p>
                      {showHint && currentCommand && (
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
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                      </div>
                      <span className="ml-2 text-sm text-muted-foreground">mongosh</span>
                    </div>
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      devops&gt;
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div
                    ref={terminalRef}
                    className="h-[580px] cursor-text overflow-auto p-5 font-mono text-sm leading-relaxed sm:text-[15px]"
                    onClick={() => inputRef.current?.focus()}
                  >
                    {terminalHistory.length === 0 && (
                      <div className="mb-4 text-emerald-400">
                        <p>Welcome to the MongoDB shell playground.</p>
                        <p className="mt-2 text-muted-foreground">
                          Type &quot;help&quot;, run &quot;show collections&quot;, or follow the current
                          task above.
                        </p>
                      </div>
                    )}
                    {terminalHistory.map((line, index) => (
                      <div
                        key={`${line.timestamp.getTime()}-${index}`}
                        className={cn(
                          'mb-2',
                          line.type === 'output' ? 'whitespace-pre' : 'whitespace-pre-wrap break-words',
                          line.type === 'input' && 'text-slate-100',
                          line.type === 'output' && 'text-slate-300',
                          line.type === 'error' && 'text-red-400',
                          line.type === 'success' &&
                            'whitespace-pre-wrap rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300',
                        )}
                      >
                        {line.type === 'input' && <span className="text-emerald-400">devops&gt; </span>}
                        {line.content}
                      </div>
                    ))}
                    <form onSubmit={handleSubmit} className="flex items-center">
                      <span className="whitespace-nowrap text-emerald-400">devops&gt;</span>
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
                        placeholder="db.customers.find()"
                      />
                    </form>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-5 w-5" />
                    Challenges
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-4 pt-0">
                  {CHALLENGES.map((challenge, index) => {
                    const solved = solvedChallenges.has(index);
                    const active = index === activeChallenge;

                    return (
                      <button
                        key={challenge.id}
                        type="button"
                        onClick={() => selectChallenge(index)}
                        className={cn(
                          'w-full rounded-md border p-2.5 text-left transition-colors',
                          active
                            ? 'border-primary/60 bg-primary/10'
                            : 'border-border hover:border-primary/40 hover:bg-muted/30',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'mt-0.5 shrink-0',
                              solved ? 'text-emerald-500' : active ? 'text-primary' : 'text-muted-foreground',
                            )}
                          >
                            {solved ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-muted-foreground">
                              Challenge {index + 1}
                            </p>
                            <p className="mt-0.5 text-sm">{challenge.question}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              <Button size="sm" variant="outline" onClick={resetChallenges} className="w-full">
                <RotateCcw className="mr-1 h-4 w-4" />
                Reset challenges
              </Button>
            </div>

            <div className="space-y-4">
              <Card className="border-primary/40">
                <CardContent className="space-y-2.5 p-3.5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          Challenge {activeChallenge + 1} / {CHALLENGES.length}
                        </Badge>
                        {solvedChallenges.has(activeChallenge) && (
                          <Badge className="gap-1 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/15">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Solved
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium sm:text-base">
                        {CHALLENGES[activeChallenge].question}
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Write your own query in the terminal below and press Enter. Your result is graded
                        against the expected output.
                      </p>
                      {revealed.has(activeChallenge) && (
                        <div className="mt-2 rounded-md border border-primary/30 bg-primary/10 p-2">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Reference solution
                          </p>
                          <code className="block whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                            {CHALLENGES[activeChallenge].solution}
                          </code>
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" onClick={revealSolution}>
                        <Lightbulb className="mr-1 h-4 w-4" />
                        Show solution
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
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                      </div>
                      <span className="ml-2 text-sm text-muted-foreground">mongosh</span>
                    </div>
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      devops&gt;
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div
                    ref={challengeTerminalRef}
                    className="h-[580px] cursor-text overflow-auto p-5 font-mono text-sm leading-relaxed sm:text-[15px]"
                    onClick={() => challengeInputRef.current?.focus()}
                  >
                    {challengeHistory.length === 0 && (
                      <div className="mb-4 text-emerald-400">
                        <p>Challenge mode — write the query yourself.</p>
                        <p className="mt-2 text-muted-foreground">
                          Type a query to answer the current challenge, run &quot;show collections&quot;,
                          or &quot;help&quot; for commands.
                        </p>
                      </div>
                    )}
                    {challengeHistory.map((line, index) => (
                      <div
                        key={`${line.timestamp.getTime()}-${index}`}
                        className={cn(
                          'mb-2',
                          line.type === 'output' ? 'whitespace-pre' : 'whitespace-pre-wrap break-words',
                          line.type === 'input' && 'text-slate-100',
                          line.type === 'output' && 'text-slate-300',
                          line.type === 'error' && 'text-red-400',
                          line.type === 'success' &&
                            'whitespace-pre-wrap rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300',
                        )}
                      >
                        {line.type === 'input' && <span className="text-emerald-400">devops&gt; </span>}
                        {line.content}
                      </div>
                    ))}
                    <form onSubmit={handleChallengeSubmit} className="flex items-center">
                      <span className="whitespace-nowrap text-emerald-400">devops&gt;</span>
                      <input
                        ref={challengeInputRef}
                        type="text"
                        value={challengeInput}
                        onChange={(event) => setChallengeInput(event.target.value)}
                        className="ml-2 min-w-0 flex-1 bg-transparent text-slate-100 caret-emerald-400 outline-none"
                        spellCheck={false}
                        autoComplete="off"
                        autoCapitalize="off"
                        placeholder="db.products.find(...)"
                      />
                    </form>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-5 w-5" />
                Collections
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              {COLLECTIONS.map((collection) => (
                <div key={collection.name} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 font-mono text-sm font-medium">
                      <Table className="h-3.5 w-3.5 text-primary" />
                      {collection.name}
                    </p>
                    <Badge variant="secondary" className="tabular-nums">
                      {collection.count} docs
                    </Badge>
                  </div>
                  <ul className="space-y-1">
                    {collection.fields.map((field) => (
                      <li
                        key={field.name}
                        className="flex items-center justify-between gap-2 font-mono text-xs text-muted-foreground"
                      >
                        <span>{field.name}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                          {field.type}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal className="h-5 w-5" />
                Cheat sheet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0 text-xs text-muted-foreground">
              <p><code className="text-foreground">find(filter, projection)</code> read documents</p>
              <p><code className="text-foreground">{'{ field: 1, _id: 0 }'}</code> include / exclude fields</p>
              <p><code className="text-foreground">{'$lt $gt $gte $lte $ne'}</code> comparisons</p>
              <p><code className="text-foreground">{'$in'}</code> / <code className="text-foreground">{'$and'}</code> / <code className="text-foreground">{'$or'}</code> combine</p>
              <p><code className="text-foreground">sort / skip / limit</code> shape the cursor</p>
              <p><code className="text-foreground">countDocuments(filter)</code> count matches</p>
              <p><code className="text-foreground">insertOne / updateOne / deleteMany</code> write</p>
              <p><code className="text-foreground">aggregate([ $match, $group, $sort ])</code> pipeline</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {mode === 'lessons' && completedCount === totalCommands && (
        <Card className="mt-4 border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="font-semibold">Lab complete</p>
                <p className="text-sm text-muted-foreground">
                  You practiced the core MongoDB workflow from find() and projections through operators,
                  sorting, paging, writes, and the aggregation pipeline. Switch to Challenges to write
                  queries from scratch.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={resetLab}>
              Start over
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === 'challenges' && solvedCount === CHALLENGES.length && (
        <Card className="mt-4 border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="font-semibold">All challenges solved</p>
                <p className="text-sm text-muted-foreground">
                  Nice work — you wrote every query yourself. Reset to practice again, or head back
                  to the lessons.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={resetChallenges}>
              Reset challenges
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
