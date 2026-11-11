'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeftRight,
  Play,
  CheckCircle,
  AlertTriangle,
  Clock,
  Zap,
  Copy,
  Check,
} from 'lucide-react';
import { MotionConfig, motion } from 'framer-motion';
import {
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFrame,
  SimMissionList,
  SimPhoneBar,
  SimResetButton,
  SimStage,
  useMissions,
  type Mission,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';

type Scenario = 'user-profile' | 'user-with-posts' | 'user-posts-comments' | 'multiple-resources';

/**
 * TIMING METHODOLOGY
 * Each HTTP request takes ~100ms (DNS + TCP/TLS + server processing).
 * REST: N requests = N × 100ms (sequential waterfall).
 * Independent REST requests share one 100ms parallel batch.
 * GraphQL: 1 request + 15ms parsing = 115ms total.
 */
const NETWORK_CONSTANTS = {
  ROUND_TRIP_MS: 100,
  GRAPHQL_PARSING_MS: 15,
};

interface RequestLog {
  id: string;
  method: string;
  endpoint: string;
  status: 'pending' | 'success' | 'complete';
  duration?: number;
  responseSize?: number;
}

interface ScenarioData {
  name: string;
  description: string;
  rest: {
    requests: { method: string; endpoint: string; description: string }[];
    totalPayloadSize: number;
    overfetchedFields: string[];
    problem?: string;
  };
  graphql: {
    query: string;
    totalPayloadSize: number;
    exactFields: string[];
  };
}

const SCENARIOS: Record<Scenario, ScenarioData> = {
  'user-profile': {
    name: 'Simple Fetch',
    description: 'Get basic user profile information',
    rest: {
      requests: [{ method: 'GET', endpoint: '/api/users/123', description: 'Fetch user' }],
      totalPayloadSize: 2048,
      overfetchedFields: ['created_at', 'updated_at', 'last_login', 'settings', 'preferences'],
    },
    graphql: {
      query: `query {\n  user(id: "123") {\n    id\n    name\n    email\n    avatar\n  }\n}`,
      totalPayloadSize: 256,
      exactFields: ['id', 'name', 'email', 'avatar'],
    },
  },
  'user-with-posts': {
    name: 'Nested Data',
    description: 'Get user profile with their posts',
    rest: {
      requests: [
        { method: 'GET', endpoint: '/api/users/123', description: 'Fetch user' },
        { method: 'GET', endpoint: '/api/users/123/posts?limit=5', description: 'Fetch posts' },
      ],
      totalPayloadSize: 8192,
      overfetchedFields: ['user.settings', 'post.metadata', 'post.raw_content'],
      problem: 'Requires 2 sequential requests (waterfall)',
    },
    graphql: {
      query: `query {\n  user(id: "123") {\n    name\n    email\n    posts(limit: 5) {\n      id\n      title\n      excerpt\n    }\n  }\n}`,
      totalPayloadSize: 1024,
      exactFields: ['name', 'email', 'posts.id', 'posts.title', 'posts.excerpt'],
    },
  },
  'user-posts-comments': {
    name: 'Related Data',
    description: 'Get user with posts and comments (N+1 problem)',
    rest: {
      requests: [
        { method: 'GET', endpoint: '/api/users/123', description: 'Fetch user' },
        { method: 'GET', endpoint: '/api/users/123/posts?limit=5', description: 'Fetch posts' },
        {
          method: 'GET',
          endpoint: '/api/posts/1/comments?limit=3',
          description: 'Comments for post 1',
        },
        {
          method: 'GET',
          endpoint: '/api/posts/2/comments?limit=3',
          description: 'Comments for post 2',
        },
        {
          method: 'GET',
          endpoint: '/api/posts/3/comments?limit=3',
          description: 'Comments for post 3',
        },
        {
          method: 'GET',
          endpoint: '/api/posts/4/comments?limit=3',
          description: 'Comments for post 4',
        },
        {
          method: 'GET',
          endpoint: '/api/posts/5/comments?limit=3',
          description: 'Comments for post 5',
        },
      ],
      totalPayloadSize: 24576,
      overfetchedFields: ['user.*', 'post.*', 'comment.internal_id'],
      problem: 'N+1 problem: 1 + 1 + N requests',
    },
    graphql: {
      query: `query {\n  user(id: "123") {\n    name\n    posts(limit: 5) {\n      title\n      comments(limit: 3) {\n        text\n        author { name }\n      }\n    }\n  }\n}`,
      totalPayloadSize: 2048,
      exactFields: ['name', 'posts.title', 'comments.text', 'author.name'],
    },
  },
  'multiple-resources': {
    name: 'Multiple Resources',
    description: 'Fetch users, posts, and tags in one view',
    rest: {
      requests: [
        { method: 'GET', endpoint: '/api/users?limit=10', description: 'Fetch users' },
        { method: 'GET', endpoint: '/api/posts?limit=10', description: 'Fetch posts' },
        { method: 'GET', endpoint: '/api/tags', description: 'Fetch tags' },
      ],
      totalPayloadSize: 32768,
      overfetchedFields: ['users.password_hash', 'posts.raw_html', 'tags.metadata'],
      problem: '3 parallel requests needed',
    },
    graphql: {
      query: `query DashboardData {\n  users(limit: 10) {\n    id\n    name\n    avatar\n  }\n  recentPosts: posts(limit: 10) {\n    id\n    title\n    author { name }\n  }\n  tags {\n    id\n    name\n    count\n  }\n}`,
      totalPayloadSize: 4096,
      exactFields: ['users.id,name,avatar', 'posts.id,title,author', 'tags.id,name,count'],
    },
  },
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

type Tab = 'comparison' | 'details' | 'notes';

interface MissionState {
  scenario: Scenario;
  restComplete: boolean;
  graphqlComplete: boolean;
}

const MISSIONS: Mission<MissionState>[] = [
  {
    id: 'profile',
    label: 'Compare one user profile over REST and GraphQL.',
    hint: 'Keep Simple Fetch in the menu and press Run comparison.',
    check: (state) =>
      state.scenario === 'user-profile' && state.restComplete && state.graphqlComplete,
  },
  {
    id: 'nested',
    label: 'Load a user with posts and comments, and count the round trips.',
    hint: 'Pick Related Data in the menu and press Run comparison: REST needs a request per level.',
    check: (state) =>
      state.scenario === 'user-posts-comments' && state.restComplete && state.graphqlComplete,
  },
  {
    id: 'many',
    label: 'Fetch several resources at once.',
    hint: 'Pick Multiple Resources and press Run comparison: one GraphQL query, several REST calls.',
    check: (state) =>
      state.scenario === 'multiple-resources' && state.restComplete && state.graphqlComplete,
  },
];

export default function RestVsGraphqlSimulator() {
  const [scenario, setScenario] = useState<Scenario>('user-profile');
  const [isRunning, setIsRunning] = useState(false);
  const [restLogs, setRestLogs] = useState<RequestLog[]>([]);
  const [graphqlLog, setGraphqlLog] = useState<RequestLog | null>(null);
  const [restComplete, setRestComplete] = useState(false);
  const [graphqlComplete, setGraphqlComplete] = useState(false);
  const [copiedRest, setCopiedRest] = useState(false);
  const [copiedGraphql, setCopiedGraphql] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [tab, setTab] = useState<Tab>('comparison');
  const [dismissed, setDismissed] = useState(false);

  const currentScenario = SCENARIOS[scenario];

  const missionState = useMemo(
    () => ({ scenario, restComplete, graphqlComplete }),
    [graphqlComplete, restComplete, scenario]
  );
  const missions = useMissions(MISSIONS, missionState);

  const reset = useCallback(() => {
    setIsRunning(false);
    setRestLogs([]);
    setGraphqlLog(null);
    setRestComplete(false);
    setGraphqlComplete(false);
  }, []);

  const runSimulation = useCallback(async () => {
    reset();
    setIsRunning(true);

    const restRequests = currentScenario.rest.requests;
    const perRequestDelay = NETWORK_CONSTANTS.ROUND_TRIP_MS;

    const initialLogs: RequestLog[] = restRequests.map((req, i) => ({
      id: `rest-${i}`,
      method: req.method,
      endpoint: req.endpoint,
      status: 'pending',
    }));
    setRestLogs(initialLogs);

    setGraphqlLog({
      id: 'graphql-0',
      method: 'POST',
      endpoint: '/graphql',
      status: 'pending',
    });

    const runRest = async () => {
      const requestBatches =
        scenario === 'multiple-resources'
          ? [restRequests.map((_, index) => index)]
          : scenario === 'user-posts-comments'
            ? [[0], [1], restRequests.slice(2).map((_, index) => index + 2)]
            : restRequests.map((_, index) => [index]);

      for (const batch of requestBatches) {
        await new Promise((resolve) => setTimeout(resolve, perRequestDelay));
        setRestLogs((prev) =>
          prev.map((log, index) =>
            batch.includes(index)
              ? {
                  ...log,
                  status: 'success',
                  duration: perRequestDelay,
                  responseSize: Math.floor(
                    currentScenario.rest.totalPayloadSize / restRequests.length
                  ),
                }
              : log
          )
        );
      }
      setRestComplete(true);
    };

    const runGraphql = async () => {
      const graphqlDuration =
        NETWORK_CONSTANTS.ROUND_TRIP_MS + NETWORK_CONSTANTS.GRAPHQL_PARSING_MS;
      await new Promise((resolve) => setTimeout(resolve, graphqlDuration));
      setGraphqlLog({
        id: 'graphql-0',
        method: 'POST',
        endpoint: '/graphql',
        status: 'success',
        duration: graphqlDuration,
        responseSize: currentScenario.graphql.totalPayloadSize,
      });
      setGraphqlComplete(true);
    };

    await Promise.all([runRest(), runGraphql()]);
    setIsRunning(false);
  }, [currentScenario, reset, scenario]);

  const handleScenarioChange = (newScenario: Scenario) => {
    setScenario(newScenario);
    reset();
  };

  const copyToClipboard = async (text: string, type: 'rest' | 'graphql') => {
    await navigator.clipboard.writeText(text);
    if (type === 'rest') {
      setCopiedRest(true);
      setTimeout(() => setCopiedRest(false), 2000);
    } else {
      setCopiedGraphql(true);
      setTimeout(() => setCopiedGraphql(false), 2000);
    }
  };

  const startOver = () => {
    reset();
    missions.reset();
    setDismissed(false);
  };

  const restTotalTime =
    scenario === 'multiple-resources'
      ? NETWORK_CONSTANTS.ROUND_TRIP_MS
      : scenario === 'user-posts-comments'
        ? 3 * NETWORK_CONSTANTS.ROUND_TRIP_MS
        : currentScenario.rest.requests.length * NETWORK_CONSTANTS.ROUND_TRIP_MS;
  const graphqlTotalTime = graphqlLog?.duration || 0;
  const restTotalSize = currentScenario.rest.totalPayloadSize;
  const graphqlTotalSize = currentScenario.graphql.totalPayloadSize;
  const savings = Math.round(((restTotalSize - graphqlTotalSize) / restTotalSize) * 100);
  const restRequestText = currentScenario.rest.requests
    .map((request) => `${request.method} ${request.endpoint}`)
    .join('\n');
  const announcement = isRunning
    ? `Running ${currentScenario.name}: REST and GraphQL requests are in flight.`
    : restComplete && graphqlComplete
      ? `${currentScenario.name} complete. Compare the two totals.`
      : `${currentScenario.name} ready to run.`;

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar className="mx-auto w-full max-w-6xl">
        <SimBar
          title="REST vs GraphQL"
          icon={ArrowLeftRight}
          lead={
            <div className="flex min-w-0 items-center gap-2">
              <label htmlFor="rest-graphql-scenario" className="sr-only">
                Scenario
              </label>
              <select
                id="rest-graphql-scenario"
                value={scenario}
                onChange={(event) => handleScenarioChange(event.target.value as Scenario)}
                disabled={isRunning}
                className="h-10 max-w-52 rounded-md border border-input bg-background px-2 text-sm lg:h-8"
              >
                {(Object.keys(SCENARIOS) as Scenario[]).map((key) => (
                  <option key={key} value={key}>
                    {SCENARIOS[key].name}
                  </option>
                ))}
              </select>
            </div>
          }
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={currentScenario.name}
          actions={
            <Button
              type="button"
              size="sm"
              className="h-10 lg:h-8"
              onClick={runSimulation}
              disabled={isRunning}
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              {isRunning ? 'Running' : 'Run comparison'}
            </Button>
          }
          goal={
            missions.complete ? (
              'All three missions are done. Keep comparing the scenarios.'
            ) : (
              <>
                {missions.current?.label}{' '}
                <span className="text-muted-foreground">{missions.current?.hint}</span>
              </>
            )
          }
        />

        <SimAnnouncer message={announcement} />

        {missions.complete && !dismissed ? (
          <SimComplete
            title="API Bazaar comparison complete"
            summary="You compared a profile, a nested resource waterfall, and a parallel REST batch with one GraphQL query."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'REST round trips', value: currentScenario.rest.requests.length },
              { label: 'GraphQL round trips', value: 1 },
            ]}
            actions={
              <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
                Keep exploring
              </Button>
            }
            onPlayAgain={startOver}
            playAgainLabel="Start over"
          />
        ) : (
          <SimStage
            columns="lg:grid-cols-2"
            minHeight="min-h-[25rem]"
            tab={tab}
            onTabChange={(next) => {
              if (next === 'comparison' || next === 'details' || next === 'notes') setTab(next);
            }}
            tabsLabel="REST versus GraphQL panels"
            panels={[
              {
                id: 'comparison',
                label: 'Timelines',
                className: 'space-y-2',
                content: (
                  <>
                    <section className="rounded-lg border bg-card p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">{currentScenario.description}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {scenario === 'multiple-resources'
                              ? 'The three REST GETs are independent, so they share one network round trip.'
                              : scenario === 'user-posts-comments'
                                ? 'User, posts, then the independent comment requests form three dependency levels.'
                                : 'Each REST request waits for the preceding resource in this scenario.'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-md bg-muted px-2 py-1 font-mono text-xs tabular-nums">
                          {currentScenario.rest.requests.length}:1 requests
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-md border border-partial/40 bg-partial/10 p-2">
                          <p className="text-xs font-medium text-partial-foreground">REST total</p>
                          <p className="font-mono text-xl font-semibold tabular-nums">
                            {restComplete ? `${restTotalTime}ms` : 'not run yet'}
                          </p>
                        </div>
                        <div className="rounded-md border border-info/40 bg-info/10 p-2">
                          <p className="text-xs font-medium text-info-foreground">GraphQL total</p>
                          <p className="font-mono text-xl font-semibold tabular-nums">
                            {graphqlComplete ? `${graphqlTotalTime}ms` : 'not run yet'}
                          </p>
                        </div>
                      </div>
                    </section>

                    <div className="grid gap-2 md:grid-cols-2">
                      <Card className="border-partial/40">
                        <CardHeader className="p-3 pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-sm">REST API</CardTitle>
                            <span className="text-xs text-muted-foreground">
                              {currentScenario.rest.requests.length} request(s)
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2 p-3 pt-0">
                          {currentScenario.rest.requests.map((request, index) => {
                            const log = restLogs[index];
                            return (
                              <motion.div
                                key={request.endpoint}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={cn(
                                  'flex items-center gap-2 rounded-md border p-2 font-mono text-xs',
                                  log?.status === 'success'
                                    ? 'border-correct/40 bg-correct/10'
                                    : log?.status === 'pending'
                                      ? 'border-partial/40 bg-partial/10'
                                      : 'border-border bg-muted/50'
                                )}
                              >
                                <span className="w-9 shrink-0 font-semibold text-partial-foreground">
                                  {request.method}
                                </span>
                                <span className="min-w-0 flex-1 truncate">{request.endpoint}</span>
                                {log?.status === 'success' && (
                                  <CheckCircle
                                    className="h-4 w-4 shrink-0 text-correct-foreground"
                                    aria-hidden="true"
                                  />
                                )}
                                {log?.status === 'pending' && (
                                  <Clock
                                    className="h-4 w-4 shrink-0 text-partial-foreground motion-safe:animate-spin"
                                    aria-hidden="true"
                                  />
                                )}
                              </motion.div>
                            );
                          })}
                          {currentScenario.rest.problem && (
                            <div className="flex gap-2 rounded-md border border-partial/40 bg-partial/10 p-2 text-xs text-partial-foreground">
                              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                              {currentScenario.rest.problem}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="border-info/40">
                        <CardHeader className="p-3 pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-sm">GraphQL</CardTitle>
                            <span className="text-xs text-muted-foreground">1 request</span>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2 p-3 pt-0">
                          <motion.div
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={cn(
                              'flex items-center gap-2 rounded-md border p-2 font-mono text-xs',
                              graphqlLog?.status === 'success'
                                ? 'border-correct/40 bg-correct/10'
                                : graphqlLog?.status === 'pending'
                                  ? 'border-info/40 bg-info/10'
                                  : 'border-border bg-muted/50'
                            )}
                          >
                            <span className="w-9 shrink-0 font-semibold text-info-foreground">
                              POST
                            </span>
                            <span className="flex-1">/graphql</span>
                            {graphqlLog?.status === 'success' && (
                              <CheckCircle
                                className="h-4 w-4 shrink-0 text-correct-foreground"
                                aria-hidden="true"
                              />
                            )}
                            {graphqlLog?.status === 'pending' && (
                              <Clock
                                className="h-4 w-4 shrink-0 text-info-foreground motion-safe:animate-spin"
                                aria-hidden="true"
                              />
                            )}
                          </motion.div>
                          <div className="flex gap-2 rounded-md border border-correct/40 bg-correct/10 p-2 text-xs text-correct-foreground">
                            <Zap className="h-4 w-4 shrink-0" aria-hidden="true" />
                            One request selects only the fields this view needs.
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                ),
              },
              {
                id: 'details',
                label: 'Details',
                className: 'space-y-2',
                content: (
                  <>
                    <SimMissionList missions={missions.missions} />
                    <section className="rounded-lg border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">REST requests and response</h3>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 p-0 lg:h-8 lg:w-8"
                          aria-label="Copy REST requests"
                          onClick={() => copyToClipboard(restRequestText, 'rest')}
                        >
                          {copiedRest ? (
                            <Check className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Copy className="h-4 w-4" aria-hidden="true" />
                          )}
                        </Button>
                      </div>
                      <pre className="mt-2 overflow-x-auto rounded-md bg-muted/50 p-2 text-xs">
                        <code>{restRequestText}</code>
                      </pre>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Response payload: {formatBytes(restTotalSize)}. Extra fields include{' '}
                        {currentScenario.rest.overfetchedFields.join(', ')}.
                      </p>
                    </section>
                    <section className="rounded-lg border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">GraphQL query and response</h3>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 p-0 lg:h-8 lg:w-8"
                          aria-label="Copy GraphQL query"
                          onClick={() => copyToClipboard(currentScenario.graphql.query, 'graphql')}
                        >
                          {copiedGraphql ? (
                            <Check className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Copy className="h-4 w-4" aria-hidden="true" />
                          )}
                        </Button>
                      </div>
                      <pre className="mt-2 overflow-x-auto rounded-md bg-muted/50 p-2 text-xs">
                        <code>{currentScenario.graphql.query}</code>
                      </pre>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Response payload: {formatBytes(graphqlTotalSize)}. Selected fields:{' '}
                        {currentScenario.graphql.exactFields.join(', ')}.
                      </p>
                    </section>
                  </>
                ),
              },
              {
                id: 'notes',
                label: 'How it works',
                className: 'space-y-2',
                content: (
                  <details
                    open={showExplanation}
                    onToggle={(event) => setShowExplanation(event.currentTarget.open)}
                    className="rounded-lg border bg-card p-3"
                  >
                    <summary className="cursor-pointer text-sm font-semibold">
                      Timing and trade-offs
                    </summary>
                    <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                      <p>
                        The model gives each network round trip {NETWORK_CONSTANTS.ROUND_TRIP_MS}{' '}
                        ms. Related REST resources form a waterfall; independent GETs can run in
                        parallel. GraphQL is one round trip plus{' '}
                        {NETWORK_CONSTANTS.GRAPHQL_PARSING_MS} ms of simplified server work.
                      </p>
                      <p>
                        REST can over-fetch complete resources or under-fetch related data. GraphQL
                        lets a client select fields, but server-side resolvers still need batching
                        to avoid their own N+1 lookups.
                      </p>
                      <p>
                        REST GET endpoints work naturally with standard HTTP caching. GraphQL
                        caching can be effective too, but usually needs query-aware cache keys and
                        policies. For this scenario, the selected GraphQL response is {savings}%
                        smaller.
                      </p>
                    </div>
                  </details>
                ),
              },
            ]}
          />
        )}

        <SimPhoneBar>
          <Button
            type="button"
            className="h-10 flex-1"
            onClick={runSimulation}
            disabled={isRunning}
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            {isRunning ? 'Running' : 'Run comparison'}
          </Button>
          <Button type="button" variant="outline" className="h-10" onClick={startOver}>
            Reset
          </Button>
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
