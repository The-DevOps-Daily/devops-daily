'use client';

import { useMemo, useState } from 'react';

interface Measurement {
  /** CPU in millicores */
  cpu: number;
  /** Memory in MiB */
  memory: number;
}

function formatCpu(millis: number): string {
  if (millis < 1000) return `${millis}m`;
  const cores = millis / 1000;
  return cores % 1 === 0 ? `${cores}` : cores.toFixed(2);
}

function formatMemory(mib: number): string {
  if (mib < 1024) return `${Math.round(mib)}Mi`;
  return `${(mib / 1024).toFixed(2)}Gi`;
}

function copy(text: string, set: (b: boolean) => void) {
  navigator.clipboard.writeText(text).then(() => {
    set(true);
    setTimeout(() => set(false), 1500);
  });
}

export function K8sResourcesCalculator() {
  const [peak, setPeak] = useState<Measurement>({ cpu: 250, memory: 512 });
  const [replicas, setReplicas] = useState(3);
  const [headroomPct, setHeadroomPct] = useState(30);
  const [limitMultiplier, setLimitMultiplier] = useState(2);
  const [setCpuLimit, setSetCpuLimit] = useState(false);

  const requests = useMemo<Measurement>(
    () => ({
      cpu: Math.ceil(peak.cpu * (1 + headroomPct / 100)),
      memory: Math.ceil(peak.memory * (1 + headroomPct / 100)),
    }),
    [peak, headroomPct],
  );

  const limits = useMemo<Measurement>(
    () => ({
      cpu: Math.ceil(requests.cpu * limitMultiplier),
      memory: Math.ceil(requests.memory * limitMultiplier),
    }),
    [requests, limitMultiplier],
  );

  const totalClusterRequests = useMemo<Measurement>(
    () => ({
      cpu: requests.cpu * replicas,
      memory: requests.memory * replicas,
    }),
    [requests, replicas],
  );

  const manifest = useMemo(() => {
    const lines = [
      'resources:',
      '  requests:',
      `    cpu: "${formatCpu(requests.cpu)}"`,
      `    memory: "${formatMemory(requests.memory)}"`,
      '  limits:',
    ];
    if (setCpuLimit) {
      lines.push(`    cpu: "${formatCpu(limits.cpu)}"`);
    }
    lines.push(`    memory: "${formatMemory(limits.memory)}"`);
    return lines.join('\n');
  }, [requests, limits, setCpuLimit]);

  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-card p-5 space-y-4">
        <p className="text-xs font-mono text-muted-foreground">// observed peak usage</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1.5 block">
            <span className="text-xs font-mono text-muted-foreground">
              peak cpu (millicores)
            </span>
            <input
              type="number"
              min={1}
              value={peak.cpu}
              onChange={(e) => setPeak({ ...peak, cpu: Math.max(1, Number(e.target.value)) })}
              className="w-full bg-background border border-input px-3 py-2 rounded-md text-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <span className="text-[11px] text-muted-foreground">
              {formatCpu(peak.cpu)} ({(peak.cpu / 1000).toFixed(2)} cores)
            </span>
          </label>
          <label className="space-y-1.5 block">
            <span className="text-xs font-mono text-muted-foreground">peak memory (MiB)</span>
            <input
              type="number"
              min={1}
              value={peak.memory}
              onChange={(e) =>
                setPeak({ ...peak, memory: Math.max(1, Number(e.target.value)) })
              }
              className="w-full bg-background border border-input px-3 py-2 rounded-md text-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <span className="text-[11px] text-muted-foreground">{formatMemory(peak.memory)}</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/60">
          <label className="space-y-1.5 block">
            <span className="text-xs font-mono text-muted-foreground">replicas</span>
            <input
              type="number"
              min={1}
              value={replicas}
              onChange={(e) => setReplicas(Math.max(1, Number(e.target.value)))}
              className="w-full bg-background border border-input px-3 py-2 rounded-md font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </label>
          <label className="space-y-1.5 block">
            <span className="text-xs font-mono text-muted-foreground">
              headroom over peak ({headroomPct}%)
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={headroomPct}
              onChange={(e) => setHeadroomPct(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </label>
          <label className="space-y-1.5 block">
            <span className="text-xs font-mono text-muted-foreground">
              limit = {limitMultiplier}× request
            </span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.5}
              value={limitMultiplier}
              onChange={(e) => setLimitMultiplier(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={setCpuLimit}
            onChange={(e) => setSetCpuLimit(e.target.checked)}
            className="accent-primary"
          />
          Set CPU limit (not recommended for most workloads; causes throttling)
        </label>
      </div>

      {/* Result tables */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border bg-card overflow-hidden" aria-live="polite">
          <div className="px-4 py-2.5 bg-muted/60 border-b border-border/60 text-xs font-mono text-muted-foreground">
            // per-pod requests
          </div>
          <div className="divide-y divide-border font-mono text-sm">
            <div className="flex items-baseline justify-between px-4 py-3">
              <span className="text-muted-foreground text-xs uppercase tracking-wider">cpu</span>
              <span className="text-primary font-semibold tabular-nums">
                {formatCpu(requests.cpu)}
              </span>
            </div>
            <div className="flex items-baseline justify-between px-4 py-3">
              <span className="text-muted-foreground text-xs uppercase tracking-wider">memory</span>
              <span className="text-primary font-semibold tabular-nums">
                {formatMemory(requests.memory)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-card overflow-hidden" aria-live="polite">
          <div className="px-4 py-2.5 bg-muted/60 border-b border-border/60 text-xs font-mono text-muted-foreground">
            // per-pod limits
          </div>
          <div className="divide-y divide-border font-mono text-sm">
            <div className="flex items-baseline justify-between px-4 py-3">
              <span className="text-muted-foreground text-xs uppercase tracking-wider">cpu</span>
              <span className="font-semibold tabular-nums">
                {setCpuLimit ? formatCpu(limits.cpu) : '—'}
              </span>
            </div>
            <div className="flex items-baseline justify-between px-4 py-3">
              <span className="text-muted-foreground text-xs uppercase tracking-wider">memory</span>
              <span className="font-semibold tabular-nums">{formatMemory(limits.memory)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cluster totals */}
      <div className="rounded-md border bg-primary/5 p-4 font-mono text-sm" aria-live="polite">
        <p className="text-xs text-muted-foreground mb-2">
          // cluster totals for {replicas} {replicas === 1 ? 'replica' : 'replicas'}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-muted-foreground text-xs">cpu requested</span>
            <p className="text-lg text-primary font-semibold tabular-nums">
              {formatCpu(totalClusterRequests.cpu)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">memory requested</span>
            <p className="text-lg text-primary font-semibold tabular-nums">
              {formatMemory(totalClusterRequests.memory)}
            </p>
          </div>
        </div>
      </div>

      {/* Copy-ready manifest */}
      <div className="rounded-md border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/60 border-b border-border/60">
          <span className="text-xs font-mono text-muted-foreground">// resources block</span>
          <button
            onClick={() => copy(manifest, setCopied)}
            className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
          >
            {copied ? 'copied' : 'copy'}
          </button>
        </div>
        <pre className="p-4 text-xs sm:text-sm font-mono overflow-x-auto leading-relaxed">
          {manifest}
        </pre>
      </div>
    </div>
  );
}
