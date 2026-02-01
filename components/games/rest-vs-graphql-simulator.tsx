'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Play,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Database,
  Zap,
  ChevronRight,
  Copy,
  Check,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type Scenario = 'user-profile' | 'user-with-posts' | 'user-posts-comments' | 'multiple-resources';

/**
 * TIMING METHODOLOGY
 * Each HTTP request takes ~100ms (DNS + TCP/TLS + server processing).
 * REST: N requests = N × 100ms (sequential waterfall).
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
      requests: [
        { method: 'GET', endpoint: '/api/users/123', description: 'Fetch user' },
      ],
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
        { method: 'GET', endpoint: '/api/posts/1/comments?limit=3', description: 'Comments for post 1' },
        { method: 'GET', endpoint: '/api/posts/2/comments?limit=3', description: 'Comments for post 2' },
        { method: 'GET', endpoint: '/api/posts/3/comments?limit=3', description: 'Comments for post 3' },
        { method: 'GET', endpoint: '/api/posts/4/comments?limit=3', description: 'Comments for post 4' },
        { method: 'GET', endpoint: '/api/posts/5/comments?limit=3', description: 'Comments for post 5' },
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

  const currentScenario = SCENARIOS[scenario];

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

    for (let i = 0; i < restRequests.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, perRequestDelay));
      setRestLogs((prev) =>
        prev.map((log, idx) =>
          idx === i
            ? {
                ...log,
                status: 'success',
                duration: perRequestDelay + Math.random() * 20,
                responseSize: Math.floor(currentScenario.rest.totalPayloadSize / restRequests.length),
              }
            : log
        )
      );
    }
    setRestComplete(true);

    const graphqlDuration = NETWORK_CONSTANTS.ROUND_TRIP_MS + NETWORK_CONSTANTS.GRAPHQL_PARSING_MS;
    await new Promise((resolve) => setTimeout(resolve, 50));
    setGraphqlLog({
      id: 'graphql-0',
      method: 'POST',
      endpoint: '/graphql',
      status: 'success',
      duration: graphqlDuration,
      responseSize: currentScenario.graphql.totalPayloadSize,
    });
    setGraphqlComplete(true);

    setIsRunning(false);
  }, [currentScenario, reset]);

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

  const restTotalTime = restLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
  const graphqlTotalTime = graphqlLog?.duration || 0;
  const restTotalSize = currentScenario.rest.totalPayloadSize;
  const graphqlTotalSize = currentScenario.graphql.totalPayloadSize;
  const savings = Math.round(((restTotalSize - graphqlTotalSize) / restTotalSize) * 100);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Header with Controls */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">REST API vs GraphQL</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Compare data fetching approaches side-by-side
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={runSimulation} disabled={isRunning} size="sm">
                <Play className="w-4 h-4 mr-2" />
                Run Comparison
              </Button>
              <Button onClick={reset} variant="outline" size="sm">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SCENARIOS) as Scenario[]).map((key) => (
              <Button
                key={key}
                variant={scenario === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleScenarioChange(key)}
                className="text-xs"
              >
                {SCENARIOS[key].name}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            <strong>Scenario:</strong> {currentScenario.description}
          </p>

          {/* Inline Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t">
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <div className="text-xs text-muted-foreground mb-1">HTTP Requests</div>
              <div className="flex items-center justify-center gap-2">
                <div>
                  <div className="text-xl font-bold text-orange-500">
                    {currentScenario.rest.requests.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">REST</div>
                </div>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <div>
                  <div className="text-xl font-bold text-pink-500">1</div>
                  <div className="text-[10px] text-muted-foreground">GraphQL</div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <div className="text-xs text-muted-foreground mb-1">Payload</div>
              <div className="flex items-center justify-center gap-2">
                <div>
                  <div className="text-xl font-bold text-orange-500">{formatBytes(restTotalSize)}</div>
                  <div className="text-[10px] text-muted-foreground">REST</div>
                </div>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <div>
                  <div className="text-xl font-bold text-pink-500">{formatBytes(graphqlTotalSize)}</div>
                  <div className="text-[10px] text-muted-foreground">GraphQL</div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <div className="text-xs text-muted-foreground mb-1">Time</div>
              <div className="flex items-center justify-center gap-2">
                <div>
                  <div className="text-xl font-bold text-orange-500">
                    {restComplete ? `${Math.round(restTotalTime)}ms` : '-'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">REST</div>
                </div>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <div>
                  <div className="text-xl font-bold text-pink-500">
                    {graphqlComplete ? `${Math.round(graphqlTotalTime)}ms` : '-'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">GraphQL</div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-green-500/10 text-center border border-green-500/20">
              <div className="text-xs text-muted-foreground mb-1">Bandwidth Saved</div>
              <div className="text-2xl font-bold text-green-500">{savings}%</div>
              <div className="text-[10px] text-green-600 dark:text-green-400 mt-1">less data downloaded<br/>compared to REST</div>
            </div>
          </div>

          {/* Collapsible explanation hint */}
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-3 transition-colors"
          >
            <Info className="w-3 h-3" />
            {showExplanation ? 'Hide' : 'How are these numbers calculated?'}
          </button>

          {showExplanation && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs text-muted-foreground"
            >
              <strong className="text-blue-600 dark:text-blue-400">Timing:</strong> Each HTTP request takes ~100ms
              (DNS + TCP/TLS handshake + server processing). REST makes sequential requests, so 5 requests = 500ms.
              GraphQL bundles everything into 1 request + 15ms parsing = 115ms.
              <br />
              <strong className="text-blue-600 dark:text-blue-400 mt-1 inline-block">Payload:</strong> REST returns full objects with all fields.
              GraphQL returns only the fields you request, reducing bandwidth 2-8x.
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Side-by-side Comparison - THE MAIN SIMULATOR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* REST Side */}
        <Card className="border-orange-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                REST API
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {currentScenario.rest.requests.length} request(s)
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <AnimatePresence>
                {currentScenario.rest.requests.map((req, idx) => {
                  const log = restLogs[idx];
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-md text-xs font-mono',
                        log?.status === 'success'
                          ? 'bg-green-500/10 border border-green-500/30'
                          : log?.status === 'pending'
                          ? 'bg-yellow-500/10 border border-yellow-500/30 animate-pulse'
                          : 'bg-muted/50 border border-border'
                      )}
                    >
                      <span className="text-orange-500 font-semibold w-10">{req.method}</span>
                      <span className="flex-1 truncate">{req.endpoint}</span>
                      {log?.status === 'success' && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      {log?.status === 'pending' && (
                        <Clock className="w-4 h-4 text-yellow-500 animate-spin" />
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {currentScenario.rest.problem && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-orange-500/10 border border-orange-500/30">
                <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-orange-600 dark:text-orange-400">
                  {currentScenario.rest.problem}
                </span>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Over-fetched fields:</span>
              <div className="flex flex-wrap gap-1">
                {currentScenario.rest.overfetchedFields.map((field) => (
                  <span
                    key={field}
                    className="px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-6 w-6 p-0"
                onClick={() =>
                  copyToClipboard(
                    currentScenario.rest.requests.map((r) => `${r.method} ${r.endpoint}`).join('\n'),
                    'rest'
                  )
                }
              >
                {copiedRest ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </Button>
              <pre className="p-3 rounded-md bg-muted/50 text-xs overflow-x-auto">
                <code>
                  {currentScenario.rest.requests.map((r) => `${r.method} ${r.endpoint}`).join('\n')}
                </code>
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* GraphQL Side */}
        <Card className="border-pink-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-pink-500" />
                GraphQL
              </CardTitle>
              <span className="text-xs text-muted-foreground">1 request</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                'flex items-center gap-2 p-2 rounded-md text-xs font-mono',
                graphqlLog?.status === 'success'
                  ? 'bg-green-500/10 border border-green-500/30'
                  : graphqlLog?.status === 'pending'
                  ? 'bg-yellow-500/10 border border-yellow-500/30 animate-pulse'
                  : 'bg-muted/50 border border-border'
              )}
            >
              <span className="text-pink-500 font-semibold w-10">POST</span>
              <span className="flex-1">/graphql</span>
              {graphqlLog?.status === 'success' && (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              {graphqlLog?.status === 'pending' && (
                <Clock className="w-4 h-4 text-yellow-500 animate-spin" />
              )}
            </motion.div>

            <div className="flex items-start gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/30">
              <Zap className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-green-600 dark:text-green-400">
                Single request fetches exactly what you need
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Requested fields (exact):</span>
              <div className="flex flex-wrap gap-1">
                {currentScenario.graphql.exactFields.map((field) => (
                  <span
                    key={field}
                    className="px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-6 w-6 p-0"
                onClick={() => copyToClipboard(currentScenario.graphql.query, 'graphql')}
              >
                {copiedGraphql ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </Button>
              <pre className="p-3 rounded-md bg-muted/50 text-xs overflow-x-auto">
                <code className="text-pink-600 dark:text-pink-400">
                  {currentScenario.graphql.query}
                </code>
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Educational Content - AFTER the simulator */}
      <Card className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border-blue-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-500" />
            Understanding the Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-muted/30 border">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-orange-500" />
                <span className="font-medium text-sm">Network Round-Trip</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Each HTTP request takes ~{NETWORK_CONSTANTS.ROUND_TRIP_MS}ms for DNS lookup,
                TCP/TLS handshake, and server processing.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/30 border">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <span className="font-medium text-sm">REST Waterfall</span>
              </div>
              <p className="text-xs text-muted-foreground">
                REST requires <strong>sequential</strong> requests. For nested data, request 2
                can&apos;t start until request 1 finishes.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/30 border">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-pink-500" />
                <span className="font-medium text-sm">GraphQL Batching</span>
              </div>
              <p className="text-xs text-muted-foreground">
                GraphQL bundles everything into <strong>one request</strong>. The server resolves
                all data in a single round-trip.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pros/Cons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              REST API
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">
                ✅ Advantages
              </h4>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Simple and well-understood</li>
                <li>• Great HTTP caching with standard headers</li>
                <li>• Easy to debug with browser tools</li>
                <li>• Stateless architecture</li>
                <li>• Works well for simple CRUD operations</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                ❌ Disadvantages
              </h4>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Over-fetching: Getting more data than needed</li>
                <li>• Under-fetching: Multiple requests for related data</li>
                <li>• N+1 problem with nested resources</li>
                <li>• Versioning challenges (v1, v2, etc.)</li>
                <li>• No built-in type system</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pink-500" />
              GraphQL
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">
                ✅ Advantages
              </h4>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Fetch exactly what you need, nothing more</li>
                <li>• Single request for complex nested data</li>
                <li>• Strong type system with schema</li>
                <li>• Self-documenting via introspection</li>
                <li>• No versioning needed - evolve schema</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                ❌ Disadvantages
              </h4>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Caching is more complex</li>
                <li>• Query complexity attacks possible</li>
                <li>• Steeper learning curve</li>
                <li>• All requests are POST (harder to cache)</li>
                <li>• Overkill for simple APIs</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* When to Use Each */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">💡 When to Use Each</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
              <h4 className="font-semibold text-orange-600 dark:text-orange-400 mb-2">
                Use REST when:
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Building simple CRUD APIs</li>
                <li>• Caching is critical (CDN, browser)</li>
                <li>• Team is familiar with REST</li>
                <li>• Public APIs with many consumers</li>
                <li>• File uploads/downloads</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-pink-500/5 border border-pink-500/20">
              <h4 className="font-semibold text-pink-600 dark:text-pink-400 mb-2">
                Use GraphQL when:
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Mobile apps need bandwidth efficiency</li>
                <li>• Complex UIs with nested data</li>
                <li>• Rapidly evolving frontend requirements</li>
                <li>• Multiple clients with different needs</li>
                <li>• Real-time subscriptions needed</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
