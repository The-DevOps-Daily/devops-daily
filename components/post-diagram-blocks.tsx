'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  parseDiagramSpec,
  type DiagramSpec,
  type DiagramNode,
  type DiagramGroup,
} from '@/lib/post-diagram';

/* ------------------------------------------------------------------ */
/* Icons: a small inline SVG set, or any emoji passed through as text. */
/* ------------------------------------------------------------------ */

const ICONS: Record<string, string> = {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  queue: '<rect x="3" y="6" width="5" height="12" rx="1"/><rect x="9.5" y="6" width="5" height="12" rx="1"/><rect x="16" y="6" width="5" height="12" rx="1"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  net: '<circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="19" r="2.2"/><path d="M12 7.2v3.8M12 11l-6.4 6M12 11l6.4 6"/>',
  branch: '<circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="8" r="2.4"/><path d="M6 8.4v7.2M6 15c0-4.5 12-1.5 12-6.6"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l2.8 2.8L16 9"/>',
  rocket: '<path d="M12 3c3 2.2 4.8 6 4.8 10L14 16h-4l-2.8-3c0-4 1.8-7.8 4.8-10z"/><circle cx="12" cy="10" r="1.6"/><path d="M9.2 16.5 7 20.5M14.8 16.5 17 20.5"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  pod: '<path d="M12 3l7 4v10l-7 4-7-4V7z"/>',
  k8s: '<path d="M12 2l8.5 4v8L12 22 3.5 14V6z"/><circle cx="12" cy="12" r="3"/><path d="M12 2v6.5M20.5 6 14.6 10M20.5 14l-6-2M12 22v-6.5M3.5 14l6-2M3.5 6l6 4"/>',
  cloud: '<path d="M6.5 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.6 1.5A3.75 3.75 0 0 1 17 18z"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
};

function PdIcon({ name, tone }: { name?: string; tone?: string }) {
  if (!name) return null;
  const cls = 'pd-ic' + (tone ? ' t-' + tone : '');
  if (ICONS[name]) {
    // Safe: the injected markup is a trusted, hardcoded constant (ICONS[name]).
    // `name` is only used as a lookup key; unknown values fall through to the
    // React-escaped text branch below, so author input never reaches innerHTML.
    return (
      <span
        className={cls}
        dangerouslySetInnerHTML={{
          __html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`,
        }}
      />
    );
  }
  return <span className={cls}>{name}</span>;
}

function NodeCard({ node }: { node: DiagramNode }) {
  if (node.variant) {
    return (
      <div className={'pd-node pd-fill v-' + node.variant}>
        {node.status && <span className={'pd-dot s-' + node.status} />}
        <div className="pd-lab">{node.label}</div>
        {node.sub && <div className="pd-sub is-italic">{node.sub}</div>}
      </div>
    );
  }
  return (
    <div className="pd-node">
      {node.status && <span className={'pd-dot s-' + node.status} />}
      <PdIcon name={node.icon} tone={node.tone} />
      <div>
        <div className="pd-lab">{node.label}</div>
        {node.sub && <div className="pd-sub">{node.sub}</div>}
      </div>
    </div>
  );
}

function Conn() {
  return (
    <svg className="pd-conn" viewBox="0 0 58 24" height="24" preserveAspectRatio="none" aria-hidden="true">
      <line className="base" x1="3" y1="12" x2="47" y2="12" />
      <line className="flow" x1="3" y1="12" x2="47" y2="12" />
      <path className="head" d="M45 8l6 4-6 4" />
    </svg>
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/* ------------------------------------------------------------------ */
/* flow / loop / branch                                                */
/* ------------------------------------------------------------------ */

function RowDiagram({ spec }: { spec: DiagramSpec }) {
  const nodes = spec.nodes ?? [];
  const rootRef = useRef<HTMLDivElement>(null);
  const showTrace = spec.type === 'flow' && spec.trace !== false && nodes.length > 1;

  const trace = () => {
    if (prefersReducedMotion()) return;
    const els = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('.pd-row .pd-node') ?? []);
    els.forEach((e) => e.classList.remove('pd-pulse'));
    els.forEach((e, i) =>
      setTimeout(() => {
        els.forEach((x) => x.classList.remove('pd-pulse'));
        e.classList.add('pd-pulse');
        if (i === els.length - 1) setTimeout(() => e.classList.remove('pd-pulse'), 620);
      }, 500 * i)
    );
  };

  const row = (
    <div className="pd-row">
      {nodes.map((n, i) => (
        <React.Fragment key={i}>
          <NodeCard node={n} />
          {i < nodes.length - 1 && <Conn />}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="pdiag" ref={rootRef}>
      {spec.title && <div className="pd-title">{spec.title}</div>}
      {showTrace && (
        <div className="pd-toolbar">
          <button type="button" className="pd-btn" onClick={trace}>
            &#9654; Trace flow
          </button>
        </div>
      )}
      {spec.goal && <div className="pd-goal">{spec.goal}</div>}
      {spec.type === 'loop' ? (
        <div className="pd-loopwrap">
          {spec.loopTop && <div className="pd-toplabel">{spec.loopTop}</div>}
          {row}
          <div className="pd-loopback">
            <svg viewBox="0 0 1000 62" preserveAspectRatio="none" aria-hidden="true">
              <path className="track" d="M 960 8 C 960 56, 700 60, 500 60 C 300 60, 40 56, 40 12" />
              <path className="track" d="M 40 12 l -7 10 M 40 12 l 9 6" />
            </svg>
            {spec.loopBack && <span className="pd-lb-label">{spec.loopBack}</span>}
          </div>
        </div>
      ) : (
        row
      )}
      {spec.type === 'branch' && spec.branch && spec.branch.length > 0 && (
        <div className="pd-branch">
          {spec.branch.map((n, i) => (
            <div className="pd-leg" key={i}>
              <span className="pd-down">&darr;</span>
              <NodeCard node={n} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* infra                                                               */
/* ------------------------------------------------------------------ */

function GroupBox({ group }: { group: DiagramGroup }) {
  return (
    <div className="pd-group">
      <div className="pd-ghead">
        <PdIcon name={group.icon} tone={group.tone} />
        <div>
          <div className="pd-gtitle">{group.label}</div>
          {group.sub && <div className="pd-gsub">{group.sub}</div>}
        </div>
      </div>
      {group.groups && group.groups.length > 0 ? (
        <div className="pd-nested">
          {group.groups.map((g, i) => (
            <GroupBox group={g} key={i} />
          ))}
        </div>
      ) : (
        <div className="pd-gbody">
          {(group.nodes ?? []).map((n, i) => (
            <NodeCard node={n} key={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function InfraDiagram({ spec }: { spec: DiagramSpec }) {
  return (
    <div className="pdiag">
      {spec.title && <div className="pd-title">{spec.title}</div>}
      {spec.flow && spec.flow.length > 0 && (
        <div className="pd-row">
          {spec.flow.map((n, i) => (
            <React.Fragment key={i}>
              <NodeCard node={n} />
              {i < spec.flow!.length - 1 && <Conn />}
            </React.Fragment>
          ))}
        </div>
      )}
      {(spec.groups ?? []).map((g, i) => (
        <GroupBox group={g} key={i} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* graph: columns of nodes with drawn, measured SVG edges              */
/* ------------------------------------------------------------------ */

interface EdgePath {
  id: string;
  d: string;
  from: string;
  to: string;
  label?: string;
  mx: number;
  my: number;
}

function GraphDiagram({ spec }: { spec: DiagramSpec }) {
  const columns = spec.columns ?? [];
  const edges = spec.edges ?? [];
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLElement | null>>({});
  const flowRefs = useRef<Record<string, SVGPathElement | null>>({});
  const svgRef = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<EdgePath[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const active = pinned ?? hovered;
  const layer: Record<string, number> = {};
  const byId: Record<string, DiagramNode> = {};
  columns.forEach((col, ci) =>
    col.forEach((n) => {
      if (n.id) {
        layer[n.id] = ci;
        byId[n.id] = n;
      }
    })
  );

  const draw = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const gr = wrap.getBoundingClientRect();
    const next: EdgePath[] = [];
    edges.forEach((e, i) => {
      const a = nodeRefs.current[e[0]];
      const b = nodeRefs.current[e[1]];
      if (!a || !b) return;
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const x1 = ar.right - gr.left;
      const y1 = ar.top + ar.height / 2 - gr.top;
      const x2 = br.left - gr.left;
      const y2 = br.top + br.height / 2 - gr.top;
      const dx = Math.max(28, (x2 - x1) * 0.5);
      next.push({
        id: 'e' + i,
        from: e[0],
        to: e[1],
        label: e[2],
        mx: (x1 + x2) / 2,
        my: (y1 + y2) / 2,
        d: `M${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
      });
    });
    setPaths(next);
  };

  useEffect(() => {
    draw();
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => draw())
        : null;
    if (ro && wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener('resize', draw);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', draw);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = (id: string) => {
    const set = new Set<string>([id]);
    edges.forEach((e) => {
      if (e[0] === id) set.add(e[1]);
      if (e[1] === id) set.add(e[0]);
    });
    return set;
  };
  const hi = active ? connected(active) : null;

  const firePacket = (pathEl: SVGPathElement, delay: number) => {
    setTimeout(() => {
      const svg = svgRef.current;
      if (!svg) return;
      const len = pathEl.getTotalLength();
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '4.5');
      dot.setAttribute('class', 'pd-pkt');
      svg.appendChild(dot);
      let start: number | null = null;
      const dur = 620;
      const step = (ts: number) => {
        if (start === null) start = ts;
        const t = Math.min(1, (ts - start) / dur);
        const p = pathEl.getPointAtLength(t * len);
        dot.setAttribute('cx', String(p.x));
        dot.setAttribute('cy', String(p.y));
        if (t < 1) requestAnimationFrame(step);
        else if (dot.parentNode) svg.removeChild(dot);
      };
      requestAnimationFrame(step);
    }, delay);
  };

  const trace = () => {
    if (prefersReducedMotion()) return;
    paths.forEach((p) => {
      const el = flowRefs.current[p.id];
      if (el) firePacket(el, (layer[p.from] ?? 0) * 520);
    });
  };

  return (
    <div className="pdiag">
      <div className="pd-toolbar">
        {spec.title && <span className="pd-title pd-title-inline">{spec.title}</span>}
        {spec.trace !== false && edges.length > 0 && (
          <button type="button" className="pd-btn" onClick={trace}>
            &#9654; Trace requests
          </button>
        )}
      </div>
      <div className={'pd-graph' + (active ? ' pd-dim' : '')} ref={wrapRef}>
        <svg className="pd-edges" ref={svgRef} aria-hidden="true">
          {paths.map((p) => {
            const hot = hi && (hi.has(p.from) && hi.has(p.to) && (p.from === hovered || p.to === hovered));
            return (
              <g key={p.id}>
                <path className={'pd-edge' + (hot ? ' hot' : '')} d={p.d} />
                <path
                  className={'pd-edge-flow' + (hot ? ' hot' : '')}
                  d={p.d}
                  ref={(el) => {
                    flowRefs.current[p.id] = el;
                  }}
                />
                {p.label && (
                  <text className={'pd-edge-label' + (hot ? ' hot' : '')} x={p.mx} y={p.my}>
                    {p.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {columns.map((col, ci) => (
          <div className="pd-col" key={ci}>
            {col.map((n, ni) => {
              const id = n.id ?? `c${ci}n${ni}`;
              const dim = hi && !hi.has(id);
              return (
                <div
                  key={id}
                  className={'pd-node pd-clickable' + (dim ? ' pd-faded' : '') + (id === active ? ' pd-hot' : '')}
                  ref={(el) => {
                    nodeRefs.current[id] = el;
                  }}
                  onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setPinned((p) => (p === id ? null : id))}
                >
                  {n.status && <span className={'pd-dot s-' + n.status} />}
                  <PdIcon name={n.icon} tone={n.tone} />
                  <div>
                    <div className="pd-lab">{n.label}</div>
                    {n.sub && <div className="pd-sub">{n.sub}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {active && byId[active]?.detail && (
        <div className="pd-detail">
          <b>{byId[active].label}</b> {byId[active].detail}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* dispatch + styles + hydration                                       */
/* ------------------------------------------------------------------ */

function DiagramBlock({ spec }: { spec: DiagramSpec }) {
  useEffect(() => ensureStyles(), []);
  let inner: React.ReactElement;
  if (spec.type === 'graph') inner = <GraphDiagram spec={spec} />;
  else if (spec.type === 'infra') inner = <InfraDiagram spec={spec} />;
  else inner = <RowDiagram spec={spec} />;
  return <div className="not-prose pd-card">{inner}</div>;
}

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const el = document.createElement('style');
  el.id = 'pd-styles';
  el.textContent = STYLES;
  document.head.appendChild(el);
}

function useHydrate(
  selector: string,
  dataKey: string,
  render: (raw: string) => React.ReactElement | null
) {
  const rootsRef = useRef<Root[]>([]);
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>(selector);
    nodes.forEach((node) => {
      const element = render(node.dataset[dataKey] ?? '');
      if (!element) return;
      node.setAttribute('data-mounted', 'true');
      const root = createRoot(node);
      root.render(element);
      rootsRef.current.push(root);
    });
    const roots = rootsRef.current;
    return () => {
      setTimeout(() => roots.forEach((root) => root.unmount()), 0);
      rootsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function DiagramBlockWrapper({ children }: { children: React.ReactNode }) {
  useHydrate('.post-diagram[data-diagram]:not([data-mounted])', 'diagram', (raw) => {
    const spec = parseDiagramSpec(raw);
    return spec ? <DiagramBlock spec={spec} /> : null;
  });
  return <>{children}</>;
}

const STYLES = `
.pd-card{ margin:1.75rem 0; }
.pdiag{ --pd-card:#ffffff; --pd-bg:#fbfaf7; --pd-ink:#1b1a17; --pd-muted:#857f74; --pd-line:#e3ded4; --pd-line2:#d3cdbf;
  --pd-soft-bg:#efeae0; --pd-soft-ink:#1b1a17; --pd-solid-bg:#1a1a1a; --pd-solid-ink:#fff; --pd-accent:#e0792b;
  --pd-blue:#2f6feb; --pd-green:#2f8a52; --pd-violet:#6d54c9; --pd-red:#c2453f; --pd-amber:#c67c1e; --pd-slate:#4a5568;
  --pd-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  border:1px solid var(--pd-line); border-radius:16px; background:var(--pd-bg); padding:24px 22px;
  box-shadow:0 1px 2px rgba(20,18,14,.03),0 8px 30px -20px rgba(20,18,14,.16);
  font-family:inherit; color:var(--pd-ink); }
.dark .pdiag{ --pd-card:#131a24; --pd-bg:#0f141d; --pd-ink:#e8edf6; --pd-muted:#8b96ab; --pd-line:#27303f; --pd-line2:#33405280;
  --pd-soft-bg:#1b2431; --pd-soft-ink:#e8edf6; --pd-solid-bg:#e8edf6; --pd-solid-ink:#10151d; --pd-accent:#f2a35a;
  --pd-blue:#6fa8ff; --pd-green:#57d08a; --pd-violet:#a996f5; --pd-red:#f6857f; --pd-amber:#e6b45e; --pd-slate:#9aa6b8;
  box-shadow:0 1px 2px rgba(0,0,0,.2),0 8px 30px -20px rgba(0,0,0,.5); }
.pdiag *{ box-sizing:border-box; }
.pdiag .pd-title{ font-family:var(--pd-mono); font-size:12.5px; color:var(--pd-muted); letter-spacing:.04em; margin-bottom:14px; }
.pdiag .pd-title-inline{ margin-bottom:0; }
.pdiag .pd-toolbar{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
.pdiag .pd-btn{ font-family:var(--pd-mono); font-size:12.5px; color:var(--pd-ink); background:var(--pd-card); border:1px solid var(--pd-line2); border-radius:9px; padding:7px 13px; cursor:pointer; transition:border-color .2s,color .2s; }
.pdiag .pd-btn:hover{ border-color:var(--pd-accent); color:var(--pd-accent); }
.pdiag .pd-btn:focus-visible{ outline:2px solid var(--pd-accent); outline-offset:2px; }
.pdiag .pd-goal{ font-family:var(--pd-mono); font-size:13px; background:var(--pd-soft-bg); border:1px solid var(--pd-line); border-radius:8px; padding:8px 14px; width:fit-content; max-width:100%; margin:0 auto 22px; text-align:center; }
.pdiag .pd-toplabel{ text-align:center; font-size:13px; font-style:italic; color:var(--pd-muted); margin-bottom:8px; }
.pdiag .pd-row{ display:flex; align-items:stretch; justify-content:center; flex-wrap:wrap; gap:4px; }
.pdiag .pd-node{ position:relative; display:flex; align-items:center; gap:11px; background:var(--pd-card); border:1px solid var(--pd-line2); border-radius:13px; padding:12px 15px; min-width:140px; transition:transform .22s,box-shadow .22s,border-color .22s; }
@media (prefers-reduced-motion:no-preference){ .pdiag .pd-node{ animation:pd-enter .3s ease backwards; } }
@keyframes pd-enter{ from{ opacity:0; transform:translateY(6px); } }
.pdiag .pd-node:hover{ transform:translateY(-3px); border-color:var(--pd-accent); box-shadow:0 10px 30px -14px rgba(224,121,43,.45); }
.pdiag .pd-node.pd-pulse{ border-color:var(--pd-accent); box-shadow:0 0 0 3px rgba(224,121,43,.15),0 12px 30px -12px rgba(224,121,43,.5); transform:translateY(-3px); opacity:1; }
.pdiag .pd-lab{ font-weight:650; font-size:14px; }
.pdiag .pd-sub{ font-size:12px; color:var(--pd-muted); font-family:var(--pd-mono); margin-top:1px; }
.pdiag .pd-sub.is-italic{ font-style:italic; font-family:inherit; opacity:.75; }
.pdiag .pd-node.pd-fill{ display:block; text-align:center; border:none; }
.pdiag .pd-fill .pd-lab{ font-size:15px; }
.pdiag .pd-fill.v-soft{ background:var(--pd-soft-bg); color:var(--pd-soft-ink); }
.pdiag .pd-fill.v-solid{ background:var(--pd-solid-bg); color:var(--pd-solid-ink); }
.pdiag .pd-fill.v-solid .pd-sub{ color:var(--pd-solid-ink); }
.pdiag .pd-fill.v-accent{ background:color-mix(in srgb, var(--pd-accent) 16%, var(--pd-card)); color:var(--pd-accent); }
.pdiag .pd-fill.v-accent .pd-sub, .pdiag .pd-fill.v-good .pd-sub, .pdiag .pd-fill.v-bad .pd-sub{ color:inherit; }
.pdiag .pd-fill.v-good{ background:color-mix(in srgb, var(--pd-green) 16%, var(--pd-card)); color:var(--pd-green); }
.pdiag .pd-fill.v-bad{ background:color-mix(in srgb, var(--pd-red) 16%, var(--pd-card)); color:var(--pd-red); }
.pdiag .pd-fill.v-line{ background:var(--pd-card); border:1.5px solid var(--pd-line2); }
.pdiag .pd-ic{ width:30px; height:30px; flex:none; display:inline-grid; place-items:center; border-radius:9px; background:var(--pd-soft-bg); color:var(--pd-slate); font-size:16px; }
.pdiag .pd-ic svg{ width:60%; height:60%; }
.pdiag .pd-ic.t-blue{ color:var(--pd-blue); background:color-mix(in srgb,var(--pd-blue) 14%,transparent); }
.pdiag .pd-ic.t-green{ color:var(--pd-green); background:color-mix(in srgb,var(--pd-green) 15%,transparent); }
.pdiag .pd-ic.t-violet{ color:var(--pd-violet); background:color-mix(in srgb,var(--pd-violet) 14%,transparent); }
.pdiag .pd-ic.t-red{ color:var(--pd-red); background:color-mix(in srgb,var(--pd-red) 13%,transparent); }
.pdiag .pd-ic.t-amber{ color:var(--pd-amber); background:color-mix(in srgb,var(--pd-amber) 16%,transparent); }
.pdiag .pd-ic.t-accent{ color:var(--pd-accent); background:color-mix(in srgb,var(--pd-accent) 15%,transparent); }
.pdiag .pd-ic.t-slate{ color:var(--pd-slate); background:color-mix(in srgb,var(--pd-slate) 13%,transparent); }
.pdiag .pd-conn{ width:56px; align-self:center; }
.pdiag .pd-conn .base{ stroke:var(--pd-line2); stroke-width:2; }
.pdiag .pd-conn .head{ fill:none; stroke:var(--pd-muted); stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
.pdiag .pd-conn .flow{ stroke:var(--pd-accent); stroke-width:2.4; stroke-linecap:round; stroke-dasharray:4 10; }
@media (prefers-reduced-motion:no-preference){ .pdiag .pd-conn .flow{ animation:pd-dash .95s linear infinite; } }
@keyframes pd-dash{ to{ stroke-dashoffset:-14; } }
.pdiag .pd-loopwrap{ width:fit-content; max-width:100%; margin:0 auto; }
.pdiag .pd-loopback{ position:relative; height:60px; margin-top:6px; }
.pdiag .pd-loopback svg{ width:100%; height:100%; overflow:visible; }
.pdiag .pd-loopback .track{ fill:none; stroke:var(--pd-line2); stroke-width:1.6; }
.pdiag .pd-lb-label{ position:absolute; left:50%; bottom:2px; transform:translateX(-50%); font-size:13px; font-style:italic; color:var(--pd-muted); background:var(--pd-bg); padding:0 10px; }
.pdiag .pd-branch{ display:flex; justify-content:center; gap:56px; margin-top:8px; }
.pdiag .pd-leg{ display:flex; flex-direction:column; align-items:center; gap:6px; }
.pdiag .pd-down{ color:var(--pd-muted); font-size:20px; line-height:1; }
.pdiag .pd-group{ border:1.5px solid var(--pd-line2); border-radius:16px; padding:14px 16px 18px; background:var(--pd-card); margin-top:16px; }
.pdiag .pd-ghead{ display:flex; align-items:center; gap:10px; margin-bottom:14px; }
.pdiag .pd-gtitle{ font-weight:700; font-size:15px; }
.pdiag .pd-gsub{ font-size:12.5px; color:var(--pd-muted); font-family:var(--pd-mono); }
.pdiag .pd-gbody{ display:flex; flex-wrap:wrap; gap:12px; }
.pdiag .pd-nested{ display:flex; flex-wrap:wrap; gap:12px; }
.pdiag .pd-nested .pd-group{ flex:1; min-width:210px; margin-top:0; }
.pdiag .pd-group .pd-node{ opacity:1; transform:none; }
.pdiag .pd-graph{ position:relative; display:flex; justify-content:space-between; align-items:center; gap:36px; padding:12px 4px; min-height:280px; }
.pdiag .pd-edges{ position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:0; overflow:visible; }
.pdiag .pd-col{ display:flex; flex-direction:column; justify-content:center; gap:16px; z-index:1; }
.pdiag .pd-graph .pd-node{ min-width:132px; cursor:default; }
.pdiag .pd-edge{ fill:none; stroke:var(--pd-line2); stroke-width:2; transition:stroke .2s,opacity .2s; }
.pdiag .pd-edge-flow{ fill:none; stroke:color-mix(in srgb,var(--pd-accent) 55%,var(--pd-line2)); stroke-width:2; stroke-dasharray:3 11; opacity:.8; }
@media (prefers-reduced-motion:no-preference){ .pdiag .pd-edge-flow{ animation:pd-dash 1.1s linear infinite; } }
.pdiag .pd-edge.hot,.pdiag .pd-edge-flow.hot{ stroke:var(--pd-accent); opacity:1; }
.pdiag .pd-edge-label{ font-family:var(--pd-mono); font-size:11px; fill:var(--pd-muted); text-anchor:middle; dominant-baseline:middle; paint-order:stroke; stroke:var(--pd-bg); stroke-width:5px; stroke-linejoin:round; }
.pdiag .pd-edge-label.hot{ fill:var(--pd-accent); }
.pdiag .pd-graph.pd-dim .pd-edge-label:not(.hot){ opacity:.1; }
.pdiag .pd-graph.pd-dim .pd-node.pd-faded{ opacity:.34; }
.pdiag .pd-graph.pd-dim .pd-edge:not(.hot),.pdiag .pd-graph.pd-dim .pd-edge-flow:not(.hot){ opacity:.1; }
.pdiag .pd-node.pd-hot{ border-color:var(--pd-accent); box-shadow:0 0 0 2px rgba(224,121,43,.16); }
.pdiag .pd-clickable{ cursor:pointer; }
.pdiag .pd-dot{ position:absolute; top:8px; right:8px; width:8px; height:8px; border-radius:50%; box-shadow:0 0 0 3px var(--pd-card); }
.pdiag .pd-dot.s-ok{ background:var(--pd-green); }
.pdiag .pd-dot.s-warn{ background:var(--pd-amber); }
.pdiag .pd-dot.s-down{ background:var(--pd-red); }
.pdiag .pd-detail{ margin-top:14px; font-size:13px; color:var(--pd-muted); background:var(--pd-card); border:1px solid var(--pd-line2); border-radius:10px; padding:10px 14px; animation:pd-pop .2s ease; }
@keyframes pd-pop{ from{ opacity:0; transform:translateY(-3px); } }
.pdiag .pd-detail b{ color:var(--pd-ink); font-weight:650; }
.pdiag .pd-pkt{ fill:var(--pd-accent); }
@media (max-width:760px){ .pdiag .pd-row{ flex-direction:column; } .pdiag .pd-conn{ display:none; } .pdiag .pd-graph{ flex-direction:column; gap:14px; } .pdiag .pd-edges{ display:none; } }
`;
