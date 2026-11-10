'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ActivitySquare, Play, RotateCcw } from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import {
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimMissionList,
  SimResetButton,
  SimStage,
  useMissions,
  type Mission,
} from '@/components/games/sim';

// ============================================================================
// TYPES
// ============================================================================

interface MetricSample {
  timestamp: number;
  value: number;
}

interface TimeSeries {
  metric: Record<string, string>;
  values: MetricSample[];
}

interface QueryResult {
  resultType: 'instant' | 'range' | 'scalar';
  result: TimeSeries[] | number;
  error?: string;
}

interface Tutorial {
  id: string;
  title: string;
  description: string;
  query: string;
  explanation: string;
  expectedResult?: string;
}

// ============================================================================
// SAMPLE DATA
// ============================================================================

// Generate sample metrics data for the last hour
const generateMetrics = (): TimeSeries[] => {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const samples = 60; // One sample per minute for last hour

  const httpRequestsTotal: TimeSeries[] = [
    {
      metric: {
        __name__: 'http_requests_total',
        job: 'api',
        instance: 'api-1',
        method: 'GET',
        status: '200',
      },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 1000 + i * 50 + Math.random() * 100,
      })),
    },
    {
      metric: {
        __name__: 'http_requests_total',
        job: 'api',
        instance: 'api-1',
        method: 'POST',
        status: '200',
      },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 500 + i * 20 + Math.random() * 50,
      })),
    },
    {
      metric: {
        __name__: 'http_requests_total',
        job: 'api',
        instance: 'api-1',
        method: 'GET',
        status: '500',
      },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 10 + i * 0.5 + Math.random() * 5,
      })),
    },
    {
      metric: {
        __name__: 'http_requests_total',
        job: 'api',
        instance: 'api-2',
        method: 'GET',
        status: '200',
      },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 900 + i * 45 + Math.random() * 90,
      })),
    },
  ];

  const httpDuration: TimeSeries[] = [
    {
      metric: {
        __name__: 'http_request_duration_seconds_bucket',
        job: 'api',
        instance: 'api-1',
        le: '0.1',
      },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 100 + i * 10,
      })),
    },
    {
      metric: {
        __name__: 'http_request_duration_seconds_bucket',
        job: 'api',
        instance: 'api-1',
        le: '0.5',
      },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 200 + i * 20,
      })),
    },
    {
      metric: {
        __name__: 'http_request_duration_seconds_bucket',
        job: 'api',
        instance: 'api-1',
        le: '+Inf',
      },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 250 + i * 25,
      })),
    },
  ];

  const cpuUsage: TimeSeries[] = [
    {
      metric: { __name__: 'process_cpu_seconds_total', job: 'api', instance: 'api-1' },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 100 + i * 0.5 + Math.sin(i / 10) * 10,
      })),
    },
    {
      metric: { __name__: 'process_cpu_seconds_total', job: 'api', instance: 'api-2' },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 90 + i * 0.4 + Math.sin(i / 10 + 1) * 8,
      })),
    },
  ];

  const memoryUsage: TimeSeries[] = [
    {
      metric: { __name__: 'node_memory_bytes', job: 'node', instance: 'node-1', type: 'used' },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 2_000_000_000 + i * 1_000_000 + Math.random() * 10_000_000,
      })),
    },
    {
      metric: { __name__: 'node_memory_bytes', job: 'node', instance: 'node-1', type: 'free' },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 2_000_000_000 - i * 1_000_000 + Math.random() * 10_000_000,
      })),
    },
  ];

  const upMetrics: TimeSeries[] = [
    {
      metric: { __name__: 'up', job: 'api', instance: 'api-1' },
      values: Array.from({ length: samples }, () => ({
        timestamp: now,
        value: 1,
      })),
    },
    {
      metric: { __name__: 'up', job: 'api', instance: 'api-2' },
      values: Array.from({ length: samples }, () => ({
        timestamp: now,
        value: 1,
      })),
    },
  ];

  return [...httpRequestsTotal, ...httpDuration, ...cpuUsage, ...memoryUsage, ...upMetrics];
};

// ============================================================================
// TUTORIALS
// ============================================================================

const TUTORIALS: Tutorial[] = [
  {
    id: 'basic-select',
    title: '🎯 Your First Query: See All Requests',
    description:
      "Learn how to view a metric - think of it like looking at your app's request counter",
    query: 'http_requests_total',
    explanation:
      'This shows every HTTP request your app has handled. Each row is a different server or endpoint (like api-1, api-2).',
  },
  {
    id: 'label-filter',
    title: '🔍 Filter What You See: Only GET Requests',
    description: "Too much data? Let's narrow it down to just GET requests",
    query: 'http_requests_total{method="GET"}',
    explanation:
      'The {method="GET"} part is like a filter - it says "only show me GET requests, ignore POST, DELETE, etc."',
  },
  {
    id: 'multi-label',
    title: '🎯 Get Specific: Successful GET Requests',
    description:
      'Combine filters to see exactly what you want - only successful (200) GET requests',
    query: 'http_requests_total{method="GET",status="200"}',
    explanation:
      'You can stack filters with commas. This shows GET requests that returned a 200 (success) status code.',
  },
  {
    id: 'rate-function',
    title: '📈 Speed Matters: Requests Per Second',
    description: 'How fast are requests coming in? Use rate() to see per-second speed',
    query: 'rate(http_requests_total[5m])',
    explanation:
      'rate() converts your growing counter into "requests per second over the last 5 minutes". Like checking your car\'s speedometer!',
  },
  {
    id: 'sum-aggregation',
    title: '🧮 Total It Up: All Requests Combined',
    description: 'Add up all servers to get your total request rate',
    query: 'sum(rate(http_requests_total[5m]))',
    explanation:
      "sum() adds up all your servers' request rates into one number. Perfect for dashboards!",
  },
  {
    id: 'sum-by',
    title: '📊 Break It Down: Requests by HTTP Method',
    description: 'See totals separated by GET, POST, etc.',
    query: 'sum by(method) (rate(http_requests_total[5m]))',
    explanation:
      '"sum by(method)" means "give me separate totals for each HTTP method". Like organizing by category!',
  },
  {
    id: 'error-rate',
    title: '🚨 Real-World: Error Rate Percentage',
    description: 'What % of requests are failing? This is how SREs monitor health',
    query:
      'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100',
    explanation:
      'This divides 5xx errors by total requests and converts to %. If you see 2.5, that means 2.5% of requests are failing.',
  },
];

// ============================================================================
// PROMQL PARSER & EXECUTOR
// ============================================================================

class PromQLExecutor {
  private metrics: TimeSeries[];

  constructor(metrics: TimeSeries[]) {
    this.metrics = metrics;
  }

  private splitTopLevel(query: string): { left: string; op: '*' | '/'; right: string } | null {
    let depth = 0;
    let inQuote = false;

    for (let index = query.length - 1; index >= 0; index--) {
      const character = query[index];
      if (character === '"') {
        inQuote = !inQuote;
        continue;
      }
      if (inQuote) continue;

      if (character === ')' || character === ']' || character === '}') {
        depth++;
      } else if (character === '(' || character === '[' || character === '{') {
        depth--;
      } else if (depth === 0 && (character === '*' || character === '/')) {
        return {
          left: query.slice(0, index).trim(),
          op: character,
          right: query.slice(index + 1).trim(),
        };
      }
    }

    return null;
  }

  execute(query: string): QueryResult {
    try {
      query = query.trim();

      const arithmetic = this.splitTopLevel(query);
      if (arithmetic) {
        if (arithmetic.op === '/') return this.executeDivision(arithmetic.left, arithmetic.right);
        if (/^[0-9]+\.?[0-9]*$/.test(arithmetic.right)) {
          return this.executeMultiplication(arithmetic.left, parseFloat(arithmetic.right));
        }
        return {
          resultType: 'instant',
          result: [],
          error: `Unsupported query syntax. Try: metric_name, metric_name{label="value"}, rate(metric[5m]), sum(query), sum by(label) (query)`,
        };
      }

      // Simple instant vector selector: metric_name or metric_name{labels}
      const instantVectorMatch = query.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\{([^}]*)\})?$/);
      if (instantVectorMatch) {
        return this.executeInstantVector(instantVectorMatch[1], instantVectorMatch[2] || '');
      }

      // Rate function: rate(metric[duration])
      const rateMatch = query.match(
        /^rate\(([a-zA-Z_][a-zA-Z0-9_]*)(?:\{([^}]*)\})?\[([0-9]+[smh])\]\)$/
      );
      if (rateMatch) {
        return this.executeRate(rateMatch[1], rateMatch[2] || '', rateMatch[3]);
      }

      // Sum aggregation: sum(query)
      const sumMatch = query.match(/^sum\((.+)\)$/);
      if (sumMatch) {
        const innerResult = this.execute(sumMatch[1]);
        if (innerResult.resultType === 'instant' || innerResult.resultType === 'range') {
          return this.executeSum(innerResult.result as TimeSeries[]);
        }
      }

      // Sum by label: sum by(label) (query)
      const sumByMatch = query.match(/^sum\s+by\(([^)]+)\)\s*\((.+)\)$/);
      if (sumByMatch) {
        const labels = sumByMatch[1].split(',').map((l) => l.trim());
        const innerResult = this.execute(sumByMatch[2]);
        if (innerResult.resultType === 'instant' || innerResult.resultType === 'range') {
          return this.executeSumBy(innerResult.result as TimeSeries[], labels);
        }
      }

      return {
        resultType: 'instant',
        result: [],
        error: `Unsupported query syntax. Try: metric_name, metric_name{label="value"}, rate(metric[5m]), sum(query), sum by(label) (query)`,
      };
    } catch (error) {
      return {
        resultType: 'instant',
        result: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private executeInstantVector(metricName: string, labelsStr: string): QueryResult {
    let filtered = this.metrics.filter((ts) => ts.metric.__name__ === metricName);

    if (labelsStr) {
      const labels = this.parseLabels(labelsStr);
      filtered = filtered.filter((ts) => this.matchesLabels(ts.metric, labels));
    }

    return {
      resultType: 'instant',
      result: filtered.map((ts) => ({
        metric: ts.metric,
        values: [ts.values[ts.values.length - 1]], // Latest value
      })),
    };
  }

  private executeRate(metricName: string, labelsStr: string, duration: string): QueryResult {
    const vectorResult = this.executeInstantVector(metricName, labelsStr);
    const series = vectorResult.result as TimeSeries[];

    // For simplicity, calculate rate using first and last sample
    const ratedSeries = series.map((ts) => {
      const fullSeries = this.metrics.find(
        (m) => m.metric.__name__ === metricName && this.seriesMatch(m.metric, ts.metric)
      );
      if (!fullSeries || fullSeries.values.length < 2) {
        return { metric: ts.metric, values: [{ timestamp: Date.now(), value: 0 }] };
      }

      const first = fullSeries.values[0];
      const last = fullSeries.values[fullSeries.values.length - 1];
      const deltaValue = last.value - first.value;
      const deltaTime = (last.timestamp - first.timestamp) / 1000; // seconds
      const rate = deltaTime > 0 ? deltaValue / deltaTime : 0;

      return {
        metric: ts.metric,
        values: [{ timestamp: last.timestamp, value: Math.max(0, rate) }],
      };
    });

    return {
      resultType: 'instant',
      result: ratedSeries,
    };
  }

  private executeSum(series: TimeSeries[]): QueryResult {
    if (series.length === 0) {
      return { resultType: 'scalar', result: 0 };
    }

    const totalValue = series.reduce((sum, ts) => {
      const lastValue = ts.values[ts.values.length - 1]?.value || 0;
      return sum + lastValue;
    }, 0);

    return {
      resultType: 'scalar',
      result: totalValue,
    };
  }

  private executeSumBy(series: TimeSeries[], groupLabels: string[]): QueryResult {
    const groups = new Map<string, TimeSeries[]>();

    series.forEach((ts) => {
      const key = groupLabels.map((label) => `${label}=${ts.metric[label] || ''}`).join(',');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(ts);
    });

    const result: TimeSeries[] = [];
    groups.forEach((groupSeries, key) => {
      const groupMetric: Record<string, string> = {};
      groupLabels.forEach((label) => {
        if (groupSeries[0].metric[label]) {
          groupMetric[label] = groupSeries[0].metric[label];
        }
      });

      const totalValue = groupSeries.reduce((sum, ts) => {
        const lastValue = ts.values[ts.values.length - 1]?.value || 0;
        return sum + lastValue;
      }, 0);

      result.push({
        metric: groupMetric,
        values: [{ timestamp: Date.now(), value: totalValue }],
      });
    });

    return {
      resultType: 'instant',
      result,
    };
  }

  private executeDivision(query1: string, query2: string): QueryResult {
    const result1 = this.execute(query1);
    const result2 = this.execute(query2);

    if (result1.resultType === 'scalar' && result2.resultType === 'scalar') {
      const val1 = result1.result as number;
      const val2 = result2.result as number;
      return { resultType: 'scalar', result: val2 !== 0 ? val1 / val2 : 0 };
    }

    return { resultType: 'scalar', result: 0, error: 'Division only supports scalar results' };
  }

  private executeMultiplication(query: string, multiplier: number): QueryResult {
    const result = this.execute(query);

    if (result.resultType === 'scalar') {
      return { resultType: 'scalar', result: (result.result as number) * multiplier };
    }

    return {
      resultType: 'scalar',
      result: 0,
      error: 'Multiplication only supports scalar results',
    };
  }

  private parseLabels(labelsStr: string): Array<{ key: string; op: string; value: string }> {
    const labels: Array<{ key: string; op: string; value: string }> = [];
    const parts = labelsStr.split(',').map((p) => p.trim());

    parts.forEach((part) => {
      const match = part.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*(=~|!~|!=|=)\s*"([^"]*)"/);
      if (match) {
        labels.push({ key: match[1], op: match[2], value: match[3] });
      }
    });

    return labels;
  }

  private matchesLabels(
    metric: Record<string, string>,
    labels: Array<{ key: string; op: string; value: string }>
  ): boolean {
    return labels.every(({ key, op, value }) => {
      const metricValue = metric[key];
      switch (op) {
        case '=':
          return metricValue === value;
        case '!=':
          return metricValue !== value;
        case '=~':
          try {
            return new RegExp(value).test(metricValue || '');
          } catch {
            return false;
          }
        case '!~':
          try {
            return !new RegExp(value).test(metricValue || '');
          } catch {
            return true;
          }
        default:
          return false;
      }
    });
  }

  private seriesMatch(m1: Record<string, string>, m2: Record<string, string>): boolean {
    const keys1 = Object.keys(m1).sort();
    const keys2 = Object.keys(m2).sort();
    if (keys1.length !== keys2.length) return false;
    return keys1.every((key, i) => key === keys2[i] && m1[key] === m2[key]);
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function vector(result: QueryResult | null): result is QueryResult & { result: TimeSeries[] } {
  return Boolean(result && !result.error && Array.isArray(result.result));
}

const MISSIONS: Mission<{ query: string; result: QueryResult | null }>[] = [
  {
    id: 'post-only',
    label: 'Show only the POST requests.',
    hint: 'Add a label filter: {method="POST"}.',
    check: ({ result }) =>
      vector(result) &&
      result.result.length > 0 &&
      result.result.every(
        (series) =>
          series.metric.__name__ === 'http_requests_total' && series.metric.method === 'POST'
      ),
  },
  {
    id: 'per-second',
    label: 'Turn http_requests_total into requests per second.',
    hint: 'Wrap it in rate(...[5m]).',
    check: ({ query, result }) =>
      query.includes('rate(') &&
      query.includes('http_requests_total') &&
      !query.includes('sum') &&
      vector(result) &&
      result.result.length > 0,
  },
  {
    id: 'one-number',
    label: "Get one number: every server's requests per second added up.",
    hint: 'sum() adds the series together.',
    check: ({ query, result }) =>
      Boolean(
        result &&
        !result.error &&
        result.resultType === 'scalar' &&
        typeof result.result === 'number' &&
        result.result > 0 &&
        query.includes('sum(') &&
        query.includes('rate(') &&
        query.includes('http_requests_total') &&
        !query.includes('/')
      ),
  },
  {
    id: 'by-instance',
    label: 'Split the request rate by instance.',
    hint: 'sum by(instance) (...) keeps one series per instance.',
    check: ({ query, result }) =>
      query.includes('rate(') &&
      vector(result) &&
      result.result.length === 2 &&
      result.result.every((series) => {
        const labels = Object.keys(series.metric);
        return labels.length === 1 && labels[0] === 'instance';
      }),
  },
  {
    id: 'error-rate',
    label: 'Show the share of failing (5xx) requests as a percentage.',
    hint: 'Divide the 5xx rate by the total rate, then * 100.',
    check: ({ query, result }) =>
      Boolean(
        result &&
        !result.error &&
        result.resultType === 'scalar' &&
        typeof result.result === 'number' &&
        result.result > 0 &&
        result.result < 5 &&
        query.includes('status') &&
        query.includes('5') &&
        query.includes('/') &&
        query.includes('100')
      ),
  },
];

export default function PromqlPlayground() {
  const [query, setQuery] = useState('http_requests_total');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [currentTutorial, setCurrentTutorial] = useState(0);
  const [ranQuery, setRanQuery] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [runs, setRuns] = useState(0);
  const [tab, setTab] = useState<'editor' | 'guide'>('editor');
  const [doneBeforeRun, setDoneBeforeRun] = useState<Set<string>>(() => new Set());
  const queryId = useId();

  const metrics = useMemo(() => generateMetrics(), []);
  const executor = useMemo(() => new PromQLExecutor(metrics), [metrics]);
  const missionState = useMemo(() => ({ query: ranQuery, result }), [ranQuery, result]);
  const missions = useMissions(MISSIONS, missionState);

  const quickExamples = [
    { label: 'Show all requests', query: 'http_requests_total' },
    { label: 'Requests per second', query: 'rate(http_requests_total[5m])' },
    {
      label: 'Error rate %',
      query:
        'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100',
    },
    { label: 'Total requests/sec', query: 'sum(rate(http_requests_total[5m]))' },
  ];

  const executeQuery = useCallback(() => {
    setDoneBeforeRun(
      new Set(missions.missions.filter((mission) => mission.done).map((mission) => mission.id))
    );
    const queryResult = executor.execute(query);
    setResult(queryResult);
    setRanQuery(query);
    setRuns((count) => count + 1);
  }, [executor, missions.missions, query]);

  const handleReset = () => {
    setQuery('http_requests_total');
    setResult(null);
    setRanQuery('');
  };

  const loadTutorial = (index: number) => {
    if (index >= 0 && index < TUTORIALS.length) {
      setCurrentTutorial(index);
      setQuery(TUTORIALS[index].query);
      setResult(null);
      setRanQuery('');
    }
  };

  const startOver = () => {
    handleReset();
    missions.reset();
    setDismissed(false);
    setRuns(0);
  };

  const missionDoneThisRun = missions.missions.find(
    (mission) => mission.done && !doneBeforeRun.has(mission.id)
  );

  const announcement = !result
    ? ''
    : result.error
      ? `Query error: ${result.error}`
      : result.resultType === 'scalar' && typeof result.result === 'number'
        ? `Scalar ${result.result.toFixed(4)}`
        : Array.isArray(result.result)
          ? `${result.result.length} series`
          : '';

  const resultPanel = result ? (
    <div className="space-y-2">
      {missionDoneThisRun && (
        <SimFeedback tone="success" label="Mission done">
          <p>{missionDoneThisRun.label}</p>
        </SimFeedback>
      )}
      {result.error ? (
        <SimFeedback tone="danger" label="Query error" role="alert">
          <p>{result.error}</p>
        </SimFeedback>
      ) : result.resultType === 'scalar' && typeof result.result === 'number' ? (
        <section className="rounded-lg border bg-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Scalar</p>
          <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">
            {result.result.toFixed(4)}
          </p>
        </section>
      ) : Array.isArray(result.result) ? (
        <section className="rounded-lg border bg-card p-3">
          <p className="mb-2 text-sm font-medium">{result.result.length} series</p>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Labels</th>
                  <th className="p-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {result.result.map((series, index) => {
                  const lastValue = series.values[series.values.length - 1];
                  return (
                    <tr key={index} className="border-b">
                      <td className="p-2 font-mono text-xs">
                        {'{'}
                        {Object.entries(series.metric)
                          .filter(([key]) => key !== '__name__')
                          .map(([key, value]) => `${key}="${value}"`)
                          .join(', ')}
                        {'}'}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums">
                        {lastValue.value.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  ) : (
    <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
      Run a query to see its result here.
    </p>
  );

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame>
        <SimBar
          title="PromQL Playground"
          icon={ActivitySquare}
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading="Missions"
          goal={
            missions.complete ? (
              'All five done. Keep writing your own queries.'
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
            title="Missions complete"
            summary="You filtered by label, turned a counter into a rate, summed it, grouped it by instance and computed an error-rate percentage."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Queries run', value: runs },
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
            columns="lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
            minHeight="min-h-[22rem]"
            tab={tab}
            onTabChange={(nextTab) => {
              if (nextTab === 'editor' || nextTab === 'guide') setTab(nextTab);
            }}
            tabsLabel="Playground panels"
            panels={[
              {
                id: 'editor',
                label: 'Query',
                content: (
                  <div className="space-y-2">
                    <section className="space-y-2 rounded-lg border bg-card p-3">
                      <label htmlFor={queryId} className="text-sm font-medium">
                        PromQL query
                      </label>
                      <Textarea
                        id={queryId}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                            event.preventDefault();
                            executeQuery();
                          }
                        }}
                        placeholder='Try: http_requests_total{method="GET"}'
                        className="min-h-20 resize-y font-mono text-sm"
                        rows={3}
                        spellCheck={false}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" onClick={executeQuery} className="h-10 lg:h-9">
                          <Play className="h-4 w-4" aria-hidden="true" />
                          Run query
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleReset}
                          className="h-10 lg:h-9"
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          Reset
                        </Button>
                      </div>
                      <p className="hidden text-xs text-muted-foreground lg:block">
                        Ctrl or Cmd + Enter runs the query.
                      </p>
                    </section>

                    <section className="space-y-1.5">
                      <p className="text-sm font-medium">Examples</p>
                      <div className="flex flex-wrap gap-1.5">
                        {quickExamples.map((example) => (
                          <Button
                            key={example.label}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-10 lg:h-8"
                            onClick={() => {
                              setQuery(example.query);
                              setResult(null);
                            }}
                          >
                            {example.label}
                          </Button>
                        ))}
                      </div>
                    </section>

                    {resultPanel}
                  </div>
                ),
              },
              {
                id: 'guide',
                label: 'Missions',
                content: (
                  <div className="space-y-2">
                    <SimMissionList missions={missions.missions} />
                    <section className="space-y-1.5">
                      <h3 className="text-sm font-semibold">Tutorials</h3>
                      <ol className="space-y-1.5">
                        {TUTORIALS.map((tutorial, index) => (
                          <li key={tutorial.id}>
                            <button
                              type="button"
                              onClick={() => {
                                loadTutorial(index);
                                if (!window.matchMedia('(min-width: 1024px)').matches) {
                                  setTab('editor');
                                }
                              }}
                              className={`w-full rounded-md border p-2.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                currentTutorial === index ? 'border-primary/50 bg-primary/5' : ''
                              }`}
                            >
                              <span className="block font-medium">
                                {tutorial.title.replace(
                                  /^\p{Extended_Pictographic}\uFE0F?\s*/u,
                                  ''
                                )}
                              </span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {tutorial.description}
                              </span>
                              <code className="mt-1.5 block break-all rounded bg-muted/50 px-1.5 py-1 font-mono text-xs">
                                {tutorial.query}
                              </code>
                            </button>
                            {currentTutorial === index && (
                              <p className="px-2.5 pt-1 text-xs text-muted-foreground">
                                {tutorial.explanation}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </section>
                  </div>
                ),
              },
            ]}
          />
        )}
      </SimFrame>
    </MotionConfig>
  );
}
