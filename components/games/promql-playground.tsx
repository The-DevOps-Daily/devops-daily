'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  RotateCcw,
  Lightbulb,
  Keyboard,
  Table as TableIcon,
  LineChart,
  ActivitySquare,
  CheckCircle,
  X,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
      metric: { __name__: 'http_requests_total', job: 'api', instance: 'api-1', method: 'GET', status: '200' },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 1000 + i * 50 + Math.random() * 100,
      })),
    },
    {
      metric: { __name__: 'http_requests_total', job: 'api', instance: 'api-1', method: 'POST', status: '200' },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 500 + i * 20 + Math.random() * 50,
      })),
    },
    {
      metric: { __name__: 'http_requests_total', job: 'api', instance: 'api-1', method: 'GET', status: '500' },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 10 + i * 0.5 + Math.random() * 5,
      })),
    },
    {
      metric: { __name__: 'http_requests_total', job: 'api', instance: 'api-2', method: 'GET', status: '200' },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 900 + i * 45 + Math.random() * 90,
      })),
    },
  ];

  const httpDuration: TimeSeries[] = [
    {
      metric: { __name__: 'http_request_duration_seconds_bucket', job: 'api', instance: 'api-1', le: '0.1' },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 100 + i * 10,
      })),
    },
    {
      metric: { __name__: 'http_request_duration_seconds_bucket', job: 'api', instance: 'api-1', le: '0.5' },
      values: Array.from({ length: samples }, (_, i) => ({
        timestamp: now - (samples - i) * 60 * 1000,
        value: 200 + i * 20,
      })),
    },
    {
      metric: { __name__: 'http_request_duration_seconds_bucket', job: 'api', instance: 'api-1', le: '+Inf' },
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
    title: '1. Basic Metric Selection',
    description: 'Select all time series for a metric',
    query: 'http_requests_total',
    explanation: 'This returns all time series with the metric name "http_requests_total". Each series is identified by unique label combinations.',
    expectedResult: 'Returns 4 time series with different method/status/instance labels',
  },
  {
    id: 'label-filter',
    title: '2. Label Filtering',
    description: 'Filter by label values',
    query: 'http_requests_total{method="GET"}',
    explanation: 'Use curly braces to filter by label values. This returns only GET requests.',
    expectedResult: 'Returns time series where method="GET"',
  },
  {
    id: 'multi-label',
    title: '3. Multiple Label Filters',
    description: 'Combine multiple label filters',
    query: 'http_requests_total{method="GET",status="200"}',
    explanation: 'Combine multiple label filters with commas. This returns only successful GET requests.',
    expectedResult: 'Returns time series where method="GET" AND status="200"',
  },
  {
    id: 'rate-function',
    title: '4. Rate Calculation',
    description: 'Calculate per-second rate over time',
    query: 'rate(http_requests_total[5m])',
    explanation: 'rate() calculates the per-second average rate over the specified time range [5m]. Use for counters.',
    expectedResult: 'Shows requests per second for each series',
  },
  {
    id: 'sum-aggregation',
    title: '5. Sum Aggregation',
    description: 'Aggregate multiple series',
    query: 'sum(rate(http_requests_total[5m]))',
    explanation: 'sum() adds values across all time series. This gives total request rate across all methods/statuses/instances.',
    expectedResult: 'Single value: total requests per second',
  },
  {
    id: 'sum-by',
    title: '6. Sum by Label',
    description: 'Aggregate while preserving specific labels',
    query: 'sum by(method) (rate(http_requests_total[5m]))',
    explanation: 'sum by(label) groups by specified labels. This gives request rate per HTTP method.',
    expectedResult: 'One series per method (GET, POST)',
  },
  {
    id: 'error-rate',
    title: '7. Error Rate Calculation',
    description: 'Calculate percentage of errors',
    query: 'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100',
    explanation: 'Regex match status=~"5.." for 5xx errors. Divide error rate by total rate and multiply by 100 for percentage.',
    expectedResult: 'Percentage of 5xx errors',
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

  execute(query: string): QueryResult {
    try {
      query = query.trim();

      // Simple instant vector selector: metric_name or metric_name{labels}
      const instantVectorMatch = query.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\{([^}]*)\})?$/);
      if (instantVectorMatch) {
        return this.executeInstantVector(instantVectorMatch[1], instantVectorMatch[2] || '');
      }

      // Rate function: rate(metric[duration])
      const rateMatch = query.match(/^rate\(([a-zA-Z_][a-zA-Z0-9_]*)(?:\{([^}]*)\})?\[([0-9]+[smh])\]\)$/);
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
        const labels = sumByMatch[1].split(',').map(l => l.trim());
        const innerResult = this.execute(sumByMatch[2]);
        if (innerResult.resultType === 'instant' || innerResult.resultType === 'range') {
          return this.executeSumBy(innerResult.result as TimeSeries[], labels);
        }
      }

      // Division: query1 / query2
      const divMatch = query.match(/^(.+?)\s*\/\s*(.+)$/);
      if (divMatch) {
        return this.executeDivision(divMatch[1], divMatch[2]);
      }

      // Multiplication: query * number
      const multMatch = query.match(/^(.+?)\s*\*\s*([0-9]+\.?[0-9]*)$/);
      if (multMatch) {
        return this.executeMultiplication(multMatch[1], parseFloat(multMatch[2]));
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
    let filtered = this.metrics.filter(ts => ts.metric.__name__ === metricName);

    if (labelsStr) {
      const labels = this.parseLabels(labelsStr);
      filtered = filtered.filter(ts => this.matchesLabels(ts.metric, labels));
    }

    return {
      resultType: 'instant',
      result: filtered.map(ts => ({
        metric: ts.metric,
        values: [ts.values[ts.values.length - 1]], // Latest value
      })),
    };
  }

  private executeRate(metricName: string, labelsStr: string, duration: string): QueryResult {
    const vectorResult = this.executeInstantVector(metricName, labelsStr);
    const series = vectorResult.result as TimeSeries[];

    // For simplicity, calculate rate using first and last sample
    const ratedSeries = series.map(ts => {
      const fullSeries = this.metrics.find(m => 
        m.metric.__name__ === metricName && this.seriesMatch(m.metric, ts.metric)
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

    series.forEach(ts => {
      const key = groupLabels.map(label => `${label}=${ts.metric[label] || ''}`).join(',');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(ts);
    });

    const result: TimeSeries[] = [];
    groups.forEach((groupSeries, key) => {
      const groupMetric: Record<string, string> = {};
      groupLabels.forEach(label => {
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

    return { resultType: 'scalar', result: 0, error: 'Multiplication only supports scalar results' };
  }

  private parseLabels(labelsStr: string): Array<{ key: string; op: string; value: string }> {
    const labels: Array<{ key: string; op: string; value: string }> = [];
    const parts = labelsStr.split(',').map(p => p.trim());

    parts.forEach(part => {
      const match = part.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*(=~|!~|!=|=)\s*"([^"]*)"/); 
      if (match) {
        labels.push({ key: match[1], op: match[2], value: match[3] });
      }
    });

    return labels;
  }

  private matchesLabels(metric: Record<string, string>, labels: Array<{ key: string; op: string; value: string }>): boolean {
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

export default function PromqlPlayground() {
  const [query, setQuery] = useState('http_requests_total');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [currentTutorial, setCurrentTutorial] = useState(0);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [activeTab, setActiveTab] = useState('playground');

  const metrics = useMemo(() => generateMetrics(), []);
  const executor = useMemo(() => new PromQLExecutor(metrics), [metrics]);

  const executeQuery = useCallback(() => {
    const queryResult = executor.execute(query);
    setResult(queryResult);
  }, [query, executor]);

  const handleReset = () => {
    setQuery('http_requests_total');
    setResult(null);
  };

  const loadTutorial = (index: number) => {
    if (index >= 0 && index < TUTORIALS.length) {
      setCurrentTutorial(index);
      setQuery(TUTORIALS[index].query);
      setResult(null);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        executeQuery();
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShowKeyboardShortcuts(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeQuery]);

  return (
    <div className="w-full max-w-6xl p-4 mx-auto">
      <Card className="overflow-hidden">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ActivitySquare className="w-8 h-8 text-orange-500" />
              <CardTitle className="text-2xl">Prometheus Query Builder</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}
            >
              <Keyboard className="w-4 h-4 mr-2" />
              Shortcuts (?)
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Learn PromQL by executing queries against sample metrics. Try tutorials or write your own queries!
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="playground">Query Editor</TabsTrigger>
              <TabsTrigger value="tutorials">
                <Lightbulb className="w-4 h-4 mr-2" />
                Tutorials ({TUTORIALS.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="playground" className="space-y-4">
              {/* Query Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">PromQL Query</label>
                <Textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your PromQL query..."
                  className="font-mono text-sm"
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button onClick={executeQuery} className="flex-1">
                  <Play className="w-4 h-4 mr-2" />
                  Execute Query (Cmd+Enter)
                </Button>
                <Button onClick={handleReset} variant="outline">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>

              {/* Result Display */}
              {result && (
                <AnimatePresence mode="wait">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    {result.error ? (
                      <Card className="border-red-500/50 bg-red-50 dark:bg-red-950/20">
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-2">
                            <X className="w-5 h-5 text-red-500 mt-0.5" />
                            <div>
                              <p className="font-medium text-red-700 dark:text-red-400">Query Error</p>
                              <p className="text-sm text-red-600 dark:text-red-300">{result.error}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <p className="text-sm font-medium">
                            Result Type: <Badge variant="outline">{result.resultType}</Badge>
                          </p>
                        </div>

                        {result.resultType === 'scalar' ? (
                          <Card>
                            <CardContent className="pt-6">
                              <div className="text-center">
                                <p className="text-3xl font-bold text-orange-600">
                                  {(result.result as number).toFixed(4)}
                                </p>
                                <p className="text-sm text-muted-foreground mt-2">Scalar Value</p>
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg flex items-center gap-2">
                                <TableIcon className="w-5 h-5" />
                                Query Results ({(result.result as TimeSeries[]).length} series)
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="overflow-auto max-h-96">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b">
                                      <th className="text-left p-2">Labels</th>
                                      <th className="text-right p-2">Value</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(result.result as TimeSeries[]).map((series, idx) => {
                                      const lastValue = series.values[series.values.length - 1];
                                      return (
                                        <tr key={idx} className="border-b hover:bg-muted/50">
                                          <td className="p-2 font-mono text-xs">
                                            {'{'}{
                                              Object.entries(series.metric)
                                                .filter(([k]) => k !== '__name__')
                                                .map(([k, v]) => `${k}="${v}"`)
                                                .join(', ')
                                            }{'}'}
                                          </td>
                                          <td className="p-2 text-right font-mono">
                                            {lastValue.value.toFixed(2)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </TabsContent>

            <TabsContent value="tutorials" className="space-y-4">
              <div className="grid gap-4">
                {TUTORIALS.map((tutorial, idx) => (
                  <Card
                    key={tutorial.id}
                    className={cn(
                      'cursor-pointer transition-all',
                      currentTutorial === idx && 'ring-2 ring-orange-500'
                    )}
                    onClick={() => {
                      loadTutorial(idx);
                      setActiveTab('playground');
                    }}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <Badge variant={currentTutorial === idx ? 'default' : 'outline'}>
                            {tutorial.id.split('-')[0]}
                          </Badge>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold mb-1">{tutorial.title}</h3>
                          <p className="text-sm text-muted-foreground mb-2">{tutorial.description}</p>
                          <code className="block p-2 text-xs bg-muted rounded font-mono">
                            {tutorial.query}
                          </code>
                          <p className="text-xs text-muted-foreground mt-2">{tutorial.explanation}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => loadTutorial(currentTutorial - 1)}
                  disabled={currentTutorial === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => loadTutorial(currentTutorial + 1)}
                  disabled={currentTutorial === TUTORIALS.length - 1}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* Keyboard Shortcuts Panel */}
          <AnimatePresence>
            {showKeyboardShortcuts && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-3">Keyboard Shortcuts</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <kbd className="px-2 py-1 bg-background rounded">Cmd/Ctrl + Enter</kbd>
                        <span className="ml-2 text-muted-foreground">Execute Query</span>
                      </div>
                      <div>
                        <kbd className="px-2 py-1 bg-background rounded">?</kbd>
                        <span className="ml-2 text-muted-foreground">Toggle Shortcuts</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
