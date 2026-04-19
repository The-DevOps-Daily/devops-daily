'use client';

import { useMemo, useState } from 'react';
import yaml from 'js-yaml';

type InputFormat = 'yaml' | 'json';
type OutputFormat = 'yaml' | 'json';

interface Success {
  ok: true;
  output: string;
}
interface Failure {
  ok: false;
  error: string;
}
type Result = Success | Failure;

function detectFormat(input: string): InputFormat {
  const trimmed = input.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return 'yaml';
}

function process(
  input: string,
  inputFormat: InputFormat,
  outputFormat: OutputFormat,
): Result {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, output: '' };
  try {
    let data: unknown;
    if (inputFormat === 'yaml') {
      data = yaml.load(trimmed);
    } else {
      data = JSON.parse(trimmed);
    }
    if (outputFormat === 'json') {
      return { ok: true, output: JSON.stringify(data, null, 2) };
    }
    return {
      ok: true,
      output: yaml.dump(data, { indent: 2, lineWidth: 120, quotingType: '"' }),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const SAMPLE_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: app
          image: nginx:1.27-alpine
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              memory: 256Mi
`;

const SAMPLE_JSON = `{
  "name": "web",
  "image": "nginx:1.27-alpine",
  "replicas": 3,
  "resources": {
    "requests": { "cpu": "100m", "memory": "128Mi" },
    "limits": { "memory": "256Mi" }
  }
}`;

export function YamlJsonFormatter() {
  const [input, setInput] = useState(SAMPLE_YAML);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('json');

  const inputFormat = useMemo(() => detectFormat(input), [input]);
  const result = useMemo(
    () => process(input, inputFormat, outputFormat),
    [input, inputFormat, outputFormat],
  );

  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span>input detected as:</span>
          <span className="px-2 py-0.5 rounded border border-primary/30 bg-primary/5 text-primary uppercase">
            {inputFormat}
          </span>
        </div>

        <div className="inline-flex rounded-md border bg-card overflow-hidden font-mono text-sm">
          <button
            onClick={() => setOutputFormat('yaml')}
            className={`px-3 py-1.5 transition-colors ${
              outputFormat === 'yaml'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            → yaml
          </button>
          <button
            onClick={() => setOutputFormat('json')}
            className={`px-3 py-1.5 transition-colors ${
              outputFormat === 'json'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            → json
          </button>
        </div>

        <button
          onClick={() => setInput(SAMPLE_YAML)}
          className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
        >
          load yaml sample
        </button>
        <button
          onClick={() => setInput(SAMPLE_JSON)}
          className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
        >
          load json sample
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border bg-card overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 bg-muted/60 border-b border-border/60 text-xs font-mono text-muted-foreground">
            // input
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck="false"
            className="flex-1 min-h-[320px] bg-background p-4 text-xs sm:text-sm font-mono resize-y focus:outline-none"
          />
        </div>

        <div className="rounded-md border bg-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/60 border-b border-border/60">
            <span className="text-xs font-mono text-muted-foreground">// output</span>
            {result.ok && result.output && (
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(result.output);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
              >
                {copied ? 'copied' : 'copy'}
              </button>
            )}
          </div>
          {result.ok ? (
            <pre
              aria-live="polite"
              className="flex-1 min-h-[320px] bg-background p-4 text-xs sm:text-sm font-mono overflow-auto whitespace-pre-wrap"
            >
              {result.output || (
                <span className="text-muted-foreground/60">…</span>
              )}
            </pre>
          ) : (
            <div
              role="alert"
              aria-live="polite"
              className="flex-1 min-h-[320px] bg-red-500/5 border-t-0 p-4 text-xs sm:text-sm font-mono text-red-500 whitespace-pre-wrap overflow-auto"
            >
              {result.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
