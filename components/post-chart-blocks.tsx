'use client';

import React, { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  type ChartSpec,
  type BarRow,
  type LineSeries,
  type DotSeries,
  parseChartSpec,
  formatValue,
  median,
  seriesColor,
} from '@/lib/post-charts';

/* ------------------------------------------------------------------ */
/* Chart primitives: hand-rolled SVG, theme-aware via currentColor     */
/* ------------------------------------------------------------------ */

function BarChart({ spec }: { spec: ChartSpec }) {
  const rows = spec.rows as BarRow[];
  const width = 720;
  const rowH = 42;
  const labelW = 190;
  const valueW = spec.tickLabel ? 150 : 90;
  const pad = 6;
  const height = rows.length * rowH + pad * 2;
  const max = Math.max(...rows.map((r) => Math.max(r.value, r.tick ?? 0))) * 1.08;
  const scale = (v: number) => (v / max) * (width - labelW - valueW);

  const seriesNames = [...new Set(rows.map((r) => r.series).filter(Boolean))] as string[];
  const colorFor = (row: BarRow) =>
    row.series ? seriesColor(seriesNames.indexOf(row.series)) : seriesColor(0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={spec.title ?? 'Bar chart'}>
      {rows.map((r, i) => {
        const cy = pad + i * rowH + rowH / 2;
        return (
          <g key={`${r.label}-${i}`}>
            <text x={0} y={cy + 4} fontSize={13} className="fill-muted-foreground">{r.label}</text>
            <line x1={labelW} y1={cy} x2={width - valueW} y2={cy} className="stroke-border" strokeOpacity={0.5} />
            <rect
              x={labelW}
              y={cy - 7}
              width={Math.max(2, scale(r.value))}
              height={14}
              rx={4}
              fill={colorFor(r)}
              fillOpacity={0.85}
            />
            {r.tick != null && (
              <line
                x1={labelW + scale(r.tick)}
                y1={cy - 11}
                x2={labelW + scale(r.tick)}
                y2={cy + 11}
                stroke="#f59e0b"
                strokeWidth={2}
              />
            )}
            <text x={width - valueW + 12} y={cy + 4} fontSize={13} fontWeight={600} className="fill-foreground">
              {formatValue(r.value, spec.unit)}
            </text>
            {r.tick != null && (
              <text x={width - valueW + 78} y={cy + 4} fontSize={11.5} className="fill-muted-foreground">
                {spec.tickLabel ?? 'tick'} {formatValue(r.tick, spec.unit)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ spec }: { spec: ChartSpec }) {
  const series = spec.series as LineSeries[];
  const width = 720;
  const height = 300;
  const padL = 56;
  const padR = 16;
  const padT = 12;
  const padB = 34;
  const points = Math.max(...series.map((s) => s.data.length));
  const all = series.flatMap((s) => s.data);
  const maxV = Math.max(...all) * 1.06;
  const minV = Math.min(0, Math.min(...all));
  const x = (i: number) => padL + (i / Math.max(1, points - 1)) * (width - padL - padR);
  const y = (v: number) => padT + (1 - (v - minV) / (maxV - minV)) * (height - padT - padB);
  const yTicks = [...Array(4).keys()].map((t) => minV + ((maxV - minV) * (t + 1)) / 4);
  const labels = spec.x ?? [...Array(points).keys()].map((i) => i + 1);
  const labelStep = Math.ceil(labels.length / 8);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={spec.title ?? 'Line chart'}>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={padL} y1={y(v)} x2={width - padR} y2={y(v)} className="stroke-border" strokeOpacity={0.4} />
          <text x={padL - 8} y={y(v) + 4} fontSize={11.5} textAnchor="end" className="fill-muted-foreground">
            {formatValue(v, spec.unit)}
          </text>
        </g>
      ))}
      {labels.map((l, i) =>
        i % labelStep === 0 ? (
          <text key={`${l}-${i}`} x={x(i)} y={height - 12} fontSize={11.5} textAnchor="middle" className="fill-muted-foreground">
            {String(l)}
          </text>
        ) : null
      )}
      {series.map((s, si) => {
        const d = s.data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
        return (
          <g key={s.name}>
            <path d={d} fill="none" stroke={seriesColor(si)} strokeWidth={2.5} strokeLinejoin="round" />
            {s.data.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={seriesColor(si)} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function DotPlot({ spec }: { spec: ChartSpec }) {
  const series = spec.series as DotSeries[];
  const width = 720;
  const rowH = 58;
  const labelH = 26;
  const padX = 6;
  const height = series.length * rowH + labelH;
  const all = series.flatMap((s) => s.samples);
  const min = Math.min(...all) * 0.94;
  const max = Math.max(...all) * 1.04;
  const scale = (v: number) => padX + ((v - min) / (max - min)) * (width - padX * 2);
  const ticks = [...Array(6).keys()].map((t) => min + ((max - min) * t) / 5);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={spec.title ?? 'Distribution plot'}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={scale(v)} y1={0} x2={scale(v)} y2={height - labelH} className="stroke-border" strokeOpacity={0.35} />
          <text x={scale(v)} y={height - 8} fontSize={11.5} textAnchor="middle" className="fill-muted-foreground">
            {formatValue(v, spec.unit)}
          </text>
        </g>
      ))}
      {series.map((s, si) => {
        const cy = si * rowH + rowH / 2;
        const med = s.median ?? median(s.samples);
        const mx = scale(med);
        return (
          <g key={s.name}>
            {s.name && (
              <text x={padX} y={si * rowH + 15} fontSize={13} className="fill-muted-foreground">{s.name}</text>
            )}
            {s.samples.map((v, j) => (
              <circle key={j} cx={scale(v)} cy={cy + 8} r={4.5} fill={seriesColor(si)} fillOpacity={0.55} />
            ))}
            <line x1={mx} y1={cy - 7} x2={mx} y2={cy + 23} stroke="#f59e0b" strokeWidth={2.5} />
            <text x={mx + 8} y={cy} fontSize={12} fill="#f59e0b" fontWeight={600}>
              {formatValue(med, spec.unit)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Legend({ spec }: { spec: ChartSpec }) {
  let names: string[] = [];
  if (spec.type === 'bar') {
    names = [...new Set((spec.rows ?? []).map((r) => r.series).filter(Boolean))] as string[];
  } else if (spec.series) {
    names = (spec.series as Array<{ name: string }>).map((s) => s.name).filter(Boolean);
  }
  const items = names.map((name, i) => ({ name, color: seriesColor(i) }));
  if (spec.type !== 'line' && spec.tickLabel) items.push({ name: spec.tickLabel, color: '#f59e0b' });
  if (spec.type === 'dots') items.push({ name: 'median', color: '#f59e0b' });
  if (items.length < 2) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.name} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: item.color }} />
          {item.name}
        </span>
      ))}
    </div>
  );
}

export function PostChart({ spec }: { spec: ChartSpec }) {
  return (
    <figure className="my-8 rounded-lg border border-border/60 bg-muted/20 p-4 sm:p-5">
      {spec.title && (
        <figcaption className="mb-4 text-sm font-semibold text-foreground">{spec.title}</figcaption>
      )}
      {spec.type === 'bar' && <BarChart spec={spec} />}
      {spec.type === 'line' && <LineChart spec={spec} />}
      {spec.type === 'dots' && <DotPlot spec={spec} />}
      <Legend spec={spec} />
      {spec.caption && <p className="mt-3 text-xs text-muted-foreground">{spec.caption}</p>}
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Hydration: mounts PostChart into .post-chart placeholders emitted   */
/* by the markdown renderer (same pattern as the code copy buttons).   */
/* ------------------------------------------------------------------ */

export function ChartBlockWrapper({ children }: { children: React.ReactNode }) {
  const rootsRef = useRef<Root[]>([]);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('.post-chart[data-chart]:not([data-mounted])');
    nodes.forEach((node) => {
      const spec = parseChartSpec(node.dataset.chart ?? '');
      if (!spec) return;
      node.setAttribute('data-mounted', 'true');
      const root = createRoot(node);
      root.render(<PostChart spec={spec} />);
      rootsRef.current.push(root);
    });
    const roots = rootsRef.current;
    return () => {
      // Deferred so React isn't unmounting roots mid-render pass
      setTimeout(() => roots.forEach((root) => root.unmount()), 0);
      rootsRef.current = [];
    };
  }, []);

  return <>{children}</>;
}
