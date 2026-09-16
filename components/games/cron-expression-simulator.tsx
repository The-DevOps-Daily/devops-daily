'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  parseCron,
  nextFireTimes,
  describeCron,
  observations,
  findNextTransition,
  EXAMPLES,
  TIMEZONES,
  type FieldName,
  type FieldSpec,
} from '@/lib/games/cron-sim-engine';

/**
 * Cron Expression Simulator.
 *
 * You type a cron expression and it answers the only question that settles a
 * cron argument: when does this actually fire, in the zone the scheduler runs
 * in. The parser and the schedule are real and run in the browser, so an
 * expression you invent is treated exactly like the shipped examples.
 *
 * The two grids under the input are the reason this exists. Seeing 60 minute
 * cells with nine of them lit is how `*\/7` stops being an abstract argument.
 *
 * Engine and its tests: lib/games/cron-sim-engine.ts
 * Styling is scoped under `.cronsim` (classes prefixed `cs-`) so it does not
 * collide with the site's global Tailwind layer.
 */

const FIELD_LABELS: { name: FieldName; label: string; range: string }[] = [
  { name: 'minute', label: 'minute', range: '0-59' },
  { name: 'hour', label: 'hour', range: '0-23' },
  { name: 'dom', label: 'day of month', range: '1-31' },
  { name: 'month', label: 'month', range: '1-12' },
  { name: 'dow', label: 'day of week', range: '0-7' },
];

const COUNT_OPTIONS = [5, 10, 25];

/** `2026-09-16T11:40` for a datetime-local input, from an instant, in a zone. */
function toLocalInput(at: number, tz: string): string {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${String(Number(p.hour) % 24).padStart(2, '0')}:${p.minute}`;
}

/** The instant a `2026-09-16T11:40` string refers to in a zone. */
function fromLocalInput(value: string, tz: string): number | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  // One correction pass is enough for every real zone offset.
  const probe = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const wallAsUtc = (t: number) => {
    const p = Object.fromEntries(probe.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
  };
  let guess = wanted - (wallAsUtc(wanted) - wanted);
  guess = wanted - (wallAsUtc(guess) - guess);
  return guess;
}

/** A row of cells, lit where the field matches. The `*\/7` lesson, made visible. */
function ValueGrid({ spec, from, to }: { spec: FieldSpec; from: number; to: number }) {
  const hit = useMemo(() => new Set(spec.values), [spec.values]);
  const cells = [];
  for (let v = from; v <= to; v++) {
    cells.push(
      <span key={v} className="cs-cell" data-on={hit.has(v) ? '1' : '0'} title={String(v)}>
        {v % 5 === 0 || to - from < 13 ? v : ''}
      </span>,
    );
  }
  return <div className="cs-grid">{cells}</div>;
}

export default function CronExpressionSimulator() {
  const [expr, setExpr] = useState(EXAMPLES[0].expr);
  const [tz, setTz] = useState('UTC');
  const [count, setCount] = useState(5);
  const [active, setActive] = useState(EXAMPLES[0].id);
  const [copied, setCopied] = useState(false);
  /** null means "from now", which is what people want unless they say otherwise. */
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);

  // Date.now() only after mount: a static export would otherwise render a
  // build-time clock into the HTML and hydrate to a different one.
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const from = startAt ?? now;
  const parsed = useMemo(() => parseCron(expr), [expr]);
  const schedule = useMemo(
    () => (from === null ? null : nextFireTimes(parsed, tz, count, from)),
    [parsed, tz, count, from],
  );
  const sentence = useMemo(() => describeCron(parsed), [parsed]);
  const notes = useMemo(
    () => (schedule ? observations(parsed, schedule, tz) : []),
    [parsed, schedule, tz],
  );
  const transition = useMemo(
    () => (from === null ? null : findNextTransition(tz, from)),
    [tz, from],
  );

  const pick = useCallback((id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setActive(id);
    setExpr(ex.expr);
    setTz(ex.tz ?? 'UTC');
    setStartAt(ex.from ? Date.parse(ex.from) : null);
  }, []);

  const onExpr = (value: string) => {
    setExpr(value);
    setActive('');
  };

  const copy = () => {
    void navigator.clipboard?.writeText(expr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const jumpToTransition = () => {
    if (!transition) return;
    // A day before the change, so the runs either side of it are both in view.
    setStartAt(transition.at - 26 * 3_600_000);
  };

  const errorFields = new Set(parsed.errors.map((e) => e.field).filter(Boolean));
  const parts = parsed.normalised.split(/\s+/);

  return (
    <div className="cronsim">
      <style>{`
        .cronsim { --cs-panel:#111936; --cs-line:rgba(255,255,255,.08); --cs-dim:#94a3b8; --cs-accent:#38bdf8;
          color:#e2e8f0; font-size:14px; }
        .cs-examples { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px; }
        .cs-ex { border:1px solid var(--cs-line); background:var(--cs-panel); color:var(--cs-dim);
          border-radius:8px; padding:6px 10px; font-size:12px; cursor:pointer; transition:all .15s; }
        .cs-ex:hover { color:#e2e8f0; border-color:rgba(255,255,255,.2); }
        .cs-ex[data-on="1"] { background:#1e293b; color:#fff; border-color:var(--cs-accent); }

        .cs-inputrow { display:flex; gap:8px; align-items:stretch; flex-wrap:wrap; }
        .cs-input { flex:1 1 280px; background:var(--cs-panel); border:1px solid var(--cs-line); border-radius:12px;
          color:#e2e8f0; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:clamp(16px,3.4vw,22px);
          letter-spacing:.12em; padding:14px 16px; outline:none; min-width:0; }
        .cs-input:focus { border-color:var(--cs-accent); box-shadow:0 0 0 3px rgba(56,189,248,.15); }
        .cs-input[data-bad="1"] { border-color:#f8717155; }
        .cs-copy { border:1px solid var(--cs-line); background:var(--cs-panel); color:var(--cs-dim);
          border-radius:12px; padding:0 14px; font-size:12px; cursor:pointer; white-space:nowrap; }
        .cs-copy:hover { color:#e2e8f0; }

        .cs-fields { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; margin-top:8px; }
        .cs-field { background:var(--cs-panel); border:1px solid var(--cs-line); border-radius:8px; padding:8px 6px;
          text-align:center; min-width:0; }
        .cs-field[data-bad="1"] { border-color:#f87171; background:#f8717112; }
        .cs-field-val { font-family:ui-monospace,monospace; font-size:14px; color:#e2e8f0; overflow:hidden;
          text-overflow:ellipsis; white-space:nowrap; }
        .cs-field-name { font-size:10px; color:var(--cs-dim); text-transform:uppercase; letter-spacing:.06em; margin-top:3px; }
        .cs-field-desc { font-size:11px; color:#64748b; margin-top:4px; line-height:1.4; }
        @media (max-width:640px) { .cs-field-desc { display:none; } }

        .cs-sentence { margin-top:12px; font-size:clamp(15px,2.6vw,18px); line-height:1.5; color:#fff; }
        .cs-sentence-sub { color:var(--cs-dim); font-size:13px; margin-top:4px; }

        .cs-err { margin-top:12px; border:1px solid #f8717155; background:#f8717112; border-radius:12px; padding:12px; }
        .cs-err-line { color:#fca5a5; font-size:14px; line-height:1.6; }
        .cs-err-hint { color:var(--cs-dim); font-size:13px; line-height:1.6; margin-top:4px; }

        .cs-controls { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:16px; }
        .cs-ctl { background:var(--cs-panel); border:1px solid var(--cs-line); border-radius:8px; color:#e2e8f0;
          padding:7px 10px; font-size:13px; outline:none; font-family:inherit; }
        .cs-ctl:focus { border-color:var(--cs-accent); }
        .cs-lab { font-size:12px; color:var(--cs-dim); }
        .cs-btn { background:var(--cs-panel); border:1px solid var(--cs-line); border-radius:8px; color:var(--cs-dim);
          padding:7px 10px; font-size:12px; cursor:pointer; }
        .cs-btn:hover:not(:disabled) { color:#e2e8f0; border-color:rgba(255,255,255,.2); }
        .cs-btn:disabled { opacity:.4; cursor:default; }
        .cs-btn[data-accent="1"] { border-color:#f59e0b55; color:#fbbf24; }
        .cs-seg { display:inline-flex; border:1px solid var(--cs-line); border-radius:8px; overflow:hidden; }
        .cs-seg button { background:var(--cs-panel); border:0; color:var(--cs-dim); padding:7px 11px; font-size:12px;
          cursor:pointer; font-family:inherit; }
        .cs-seg button[data-on="1"] { background:#1e293b; color:#fff; }

        .cs-panes { display:grid; gap:12px; grid-template-columns:1fr; margin-top:12px; }
        @media (min-width:900px) { .cs-panes { grid-template-columns:minmax(0,1.1fr) minmax(0,1fr); } }
        .cs-pane { border:1px solid var(--cs-line); border-radius:12px; background:var(--cs-panel); overflow:hidden; min-width:0; }
        .cs-pane-head { padding:8px 12px; border-bottom:1px solid var(--cs-line); font-size:12px;
          text-transform:uppercase; letter-spacing:.06em; color:var(--cs-dim); display:flex;
          justify-content:space-between; gap:8px; }
        .cs-pane-body { padding:12px; }

        .cs-times { width:100%; border-collapse:collapse; font-size:13px; }
        .cs-times th { text-align:left; color:var(--cs-dim); font-weight:500; font-size:11px; text-transform:uppercase;
          letter-spacing:.05em; padding:8px 12px; border-bottom:1px solid var(--cs-line); }
        .cs-times td { padding:7px 12px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
          border-bottom:1px solid rgba(255,255,255,.04); white-space:nowrap; }
        .cs-times tr:last-child td { border-bottom:0; }
        .cs-times tr[data-dup="1"] td { background:#f59e0b12; }
        .cs-when { color:#fff; }
        .cs-day { color:var(--cs-dim); }
        .cs-gap { color:#64748b; text-align:right; }
        .cs-gap[data-odd="1"] { color:#fbbf24; }
        .cs-tag { font-size:10px; text-transform:uppercase; letter-spacing:.05em; padding:1px 6px; border-radius:999px;
          border:1px solid currentColor; margin-left:6px; font-family:system-ui,sans-serif; }
        .cs-scroll { overflow-x:auto; max-height:420px; overflow-y:auto; }

        .cs-grid { display:flex; flex-wrap:wrap; gap:3px; }
        .cs-cell { width:22px; height:18px; border-radius:3px; background:rgba(255,255,255,.05);
          border:1px solid transparent; font-size:9px; color:#475569; display:flex; align-items:center;
          justify-content:center; font-family:ui-monospace,monospace; }
        .cs-cell[data-on="1"] { background:rgba(56,189,248,.22); border-color:var(--cs-accent); color:#bae6fd; }
        .cs-gridlab { font-size:11px; color:var(--cs-dim); text-transform:uppercase; letter-spacing:.05em;
          margin:0 0 6px; display:flex; justify-content:space-between; }
        .cs-gridwrap + .cs-gridwrap { margin-top:14px; }

        .cs-note { border-radius:12px; padding:10px 12px; margin-top:10px; line-height:1.6; font-size:13px;
          border:1px solid var(--cs-line); background:rgba(255,255,255,.02); }
        .cs-note[data-kind="or"], .cs-note[data-kind="gap"] { border-color:#f59e0b55; background:#f59e0b10; }
        .cs-note[data-kind="dst"] { border-color:#a78bfa55; background:#a78bfa10; }
        .cs-note[data-kind="frequency"] { border-color:#f8717155; background:#f8717110; }
        .cs-note-title { color:#fff; font-weight:600; margin-bottom:3px; }
        .cs-note-body { color:#cbd5e1; }
        .cs-note code, .cs-teaches code { background:rgba(255,255,255,.08); padding:1px 5px; border-radius:4px;
          font-family:ui-monospace,monospace; font-size:.92em; }

        .cs-teaches { margin-top:14px; border-left:3px solid var(--cs-accent); padding:8px 0 8px 12px;
          color:#cbd5e1; line-height:1.65; }
        .cs-empty { color:var(--cs-dim); line-height:1.6; }
        .cs-skipped { margin-top:10px; font-size:12px; color:#c4b5fd; line-height:1.6; }
      `}</style>

      <div className="cs-examples">
        {EXAMPLES.map((ex) => (
          <button key={ex.id} className="cs-ex" data-on={ex.id === active ? '1' : '0'} onClick={() => pick(ex.id)}>
            {ex.label}
          </button>
        ))}
      </div>

      <div className="cs-inputrow">
        <input
          className="cs-input"
          data-bad={parsed.ok ? '0' : '1'}
          value={expr}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Cron expression"
          onChange={(e) => onExpr(e.target.value)}
        />
        <button className="cs-copy" onClick={copy}>
          {copied ? 'copied' : 'copy'}
        </button>
      </div>

      {parsed.ok && parsed.fields && (
        <div className="cs-fields">
          {FIELD_LABELS.map((f, i) => (
            <div key={f.name} className="cs-field">
              <div className="cs-field-val">{parts[i]}</div>
              <div className="cs-field-name">{f.label}</div>
              <div className="cs-field-desc">{parsed.fields![f.name].describe}</div>
            </div>
          ))}
        </div>
      )}

      {!parsed.ok && (
        <>
          <div className="cs-fields">
            {FIELD_LABELS.map((f, i) => (
              <div key={f.name} className="cs-field" data-bad={errorFields.has(f.name) ? '1' : '0'}>
                <div className="cs-field-val">{parts[i] ?? '-'}</div>
                <div className="cs-field-name">{f.label}</div>
                <div className="cs-field-desc">{f.range}</div>
              </div>
            ))}
          </div>
          <div className="cs-err">
            {parsed.errors.map((e, i) => (
              <div key={i}>
                <div className="cs-err-line">{e.message}</div>
                {e.hint && <div className="cs-err-hint">{e.hint}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {parsed.ok && (
        <div className="cs-sentence">
          {sentence}
          {parsed.macro && (
            <div className="cs-sentence-sub">
              <code>{parsed.macro}</code> expands to <code>{parsed.normalised}</code>
            </div>
          )}
        </div>
      )}

      <div className="cs-controls">
        <span className="cs-lab">timezone</span>
        <select className="cs-ctl" value={tz} onChange={(e) => setTz(e.target.value)} aria-label="Timezone">
          {TIMEZONES.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>

        <span className="cs-lab">from</span>
        <input
          className="cs-ctl"
          type="datetime-local"
          aria-label="Start from"
          value={from === null ? '' : toLocalInput(from, tz)}
          onChange={(e) => {
            const at = fromLocalInput(e.target.value, tz);
            if (at !== null) setStartAt(at);
          }}
        />
        <button className="cs-btn" onClick={() => setStartAt(null)} disabled={startAt === null}>
          now
        </button>

        <button
          className="cs-btn"
          data-accent="1"
          onClick={jumpToTransition}
          disabled={!transition}
          title={
            transition
              ? `${transition.localBefore} ${transition.abbrBefore} jumps to ${transition.localAfter} ${transition.abbrAfter}`
              : `${tz} has no daylight saving`
          }
        >
          {transition
            ? `jump to the ${transition.shiftMinutes > 0 ? 'clock going forward' : 'clock going back'}`
            : 'no clock change in this zone'}
        </button>

        <div className="cs-seg" role="group" aria-label="How many runs">
          {COUNT_OPTIONS.map((n) => (
            <button key={n} data-on={n === count ? '1' : '0'} onClick={() => setCount(n)}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="cs-panes">
        <div className="cs-pane">
          <div className="cs-pane-head">
            <span>Next {count} runs</span>
            <span>{tz}</span>
          </div>
          {schedule === null ? (
            <div className="cs-pane-body cs-empty">Working out the schedule.</div>
          ) : schedule.never ? (
            <div className="cs-pane-body cs-empty">
              {parsed.ok
                ? `This never fires. Nothing matches in the next ${Math.round(schedule.horizonDays / 365)} years, which for a valid expression means the date it asks for does not exist.`
                : 'Fix the expression above to see a schedule.'}
            </div>
          ) : (
            <div className="cs-scroll">
              <table className="cs-times">
                <thead>
                  <tr>
                    <th>when</th>
                    <th>day</th>
                    <th style={{ textAlign: 'right' }}>gap</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.times.map((t, i) => (
                    <tr key={`${t.at}-${i}`} data-dup={t.repeated ? '1' : '0'}>
                      <td className="cs-when">
                        {t.local}
                        <span className="cs-day" style={{ marginLeft: 8, fontSize: 11 }}>
                          {t.zoneAbbr}
                        </span>
                        {t.repeated && (
                          <span className="cs-tag" style={{ color: '#fbbf24' }}>
                            twice
                          </span>
                        )}
                      </td>
                      <td className="cs-day">{t.weekday}</td>
                      <td
                        className="cs-gap"
                        data-odd={
                          t.gapMinutes !== null &&
                          schedule.times.some((o) => o.gapMinutes !== null && o.gapMinutes !== t.gapMinutes)
                            ? '1'
                            : '0'
                        }
                      >
                        {t.gapMinutes === null ? '' : formatGap(t.gapMinutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {schedule && schedule.skipped.length > 0 && (
            <div className="cs-pane-body cs-skipped">
              Skipped: {schedule.skipped.map((s) => s.local).join(', ')}. The clock jumped forward over{' '}
              {schedule.skipped.length === 1 ? 'it' : 'them'}, so nothing ran.
            </div>
          )}
        </div>

        <div className="cs-pane">
          <div className="cs-pane-head">
            <span>What matches</span>
          </div>
          <div className="cs-pane-body">
            {parsed.ok && parsed.fields ? (
              <>
                <div className="cs-gridwrap">
                  <p className="cs-gridlab">
                    <span>minutes of the hour</span>
                    <span>{parsed.fields.minute.values.length} of 60</span>
                  </p>
                  <ValueGrid spec={parsed.fields.minute} from={0} to={59} />
                </div>
                <div className="cs-gridwrap">
                  <p className="cs-gridlab">
                    <span>hours of the day</span>
                    <span>{parsed.fields.hour.values.length} of 24</span>
                  </p>
                  <ValueGrid spec={parsed.fields.hour} from={0} to={23} />
                </div>
                <div className="cs-gridwrap">
                  <p className="cs-gridlab">
                    <span>days of the month</span>
                    <span>{parsed.fields.dom.values.length} of 31</span>
                  </p>
                  <ValueGrid spec={parsed.fields.dom} from={1} to={31} />
                </div>
              </>
            ) : (
              <div className="cs-empty">The grids appear once the expression parses.</div>
            )}
          </div>
        </div>
      </div>

      {notes.map((o, i) => (
        <div key={i} className="cs-note" data-kind={o.kind}>
          <div className="cs-note-title">
            <Ticked text={o.title} />
          </div>
          <div className="cs-note-body">
            <Ticked text={o.body} />
          </div>
        </div>
      ))}

      {active && <div className="cs-teaches">{EXAMPLES.find((e) => e.id === active)?.teaches}</div>}
    </div>
  );
}

function formatGap(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  return h ? `${d}d ${h}h` : `${d}d`;
}

/** Renders the engine's backtick spans as <code>, as React nodes rather than HTML. */
function Ticked({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((chunk, i) =>
        chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 2 ? (
          <code key={i}>{chunk.slice(1, -1)}</code>
        ) : (
          <span key={i}>{chunk}</span>
        ),
      )}
    </>
  );
}
