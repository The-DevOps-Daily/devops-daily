'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Agentic Loop Simulator.
 *
 * An animation-first, self-contained visualiser of the multi-agent loop pattern
 * (plan -> build -> judge -> repeat) used by coding agents like Claude Code. It
 * plays one task through the loop slowly and legibly: one phase lights up at a
 * time, a decision gate shows loop-or-stop, the context window grows, and a
 * toggle turns the separate judge into a self-check so learners see why an agent
 * grading its own work ships confident bugs.
 *
 * Styling is scoped under `.alsim` (classes prefixed `als-`) so it does not
 * collide with the site's global Tailwind layer.
 */

interface Step {
  role: 'plan' | 'build' | 'judge' | 'decision' | 'done' | 'bug';
  it?: number;
  tool?: string;
  tokens?: number;
  ctx?: string[];
  test?: 'pass' | 'fail';
  met?: boolean;
  ok?: boolean;
  cap: string;
}

const BASE = 2300; // ms per step at 1x, deliberately slow
const TOTAL_BUDGET = 150;

function buildSteps(separateJudge: boolean): Step[] {
  if (separateJudge) {
    return [
      { role: 'plan', it: 1, tokens: 7, ctx: ['goal', 'plan: create the route'], cap: 'Planner: the goal needs a POST /signup route, a DB insert, and a 201 response. Step one, create the route.' },
      { role: 'build', it: 1, tool: 'Edit routes/signup.ts', tokens: 11, ctx: ['signup.ts'], cap: 'Builder: writes routes/signup.ts with a basic handler that inserts the user.' },
      { role: 'judge', it: 1, tool: 'npm test', tokens: 9, test: 'fail', cap: 'Judge: runs the tests. The route works, but the password is stored in plain text. Rejected.' },
      { role: 'decision', it: 1, met: false, cap: 'The judge sends it back to the planner with the reason. Loop again.' },
      { role: 'plan', it: 2, tokens: 6, ctx: ['plan: hash the password'], cap: 'Planner: add password hashing before the insert.' },
      { role: 'build', it: 2, tool: 'Edit routes/signup.ts', tokens: 12, ctx: ['edit: bcrypt hash'], cap: 'Builder: adds bcrypt hashing in the handler.' },
      { role: 'judge', it: 2, tool: 'npm test', tokens: 9, test: 'pass', met: false, cap: 'Judge: tests pass now, but the endpoint returns 200 and the spec says 201. Tests green is not the same as goal met. Rejected.' },
      { role: 'decision', it: 2, met: false, cap: 'The judge checks the spec, not just the tests. Back to the planner.' },
      { role: 'plan', it: 3, tokens: 5, ctx: ['plan: return 201'], cap: 'Planner: change the response status to 201 Created.' },
      { role: 'build', it: 3, tool: 'Edit routes/signup.ts', tokens: 8, ctx: ['edit: 201'], cap: 'Builder: returns 201 Created.' },
      { role: 'judge', it: 3, tool: 'npm test', tokens: 9, test: 'pass', met: true, cap: 'Judge: hashes the password, returns 201, all tests pass, matches the spec. Approved.' },
      { role: 'decision', it: 3, met: true, cap: 'The judge approves. The loop stops here, correct and complete.' },
      { role: 'done', ok: true, cap: 'Three loops, checked each time by a separate judge. Safe to ship.' },
    ];
  }
  return [
    { role: 'plan', it: 1, tokens: 7, ctx: ['goal', 'plan: create the route'], cap: 'Planner: create the POST /signup route first.' },
    { role: 'build', it: 1, tool: 'Edit routes/signup.ts', tokens: 11, ctx: ['signup.ts'], cap: 'Builder: writes the handler that inserts the user.' },
    { role: 'judge', it: 1, tool: 'npm test', tokens: 8, test: 'fail', cap: 'Builder self-check: tests fail, the password is plain text. Keep going.' },
    { role: 'decision', it: 1, met: false, cap: 'Not done by its own check. Loop again.' },
    { role: 'plan', it: 2, tokens: 6, ctx: ['plan: hash the password'], cap: 'Planner: add password hashing.' },
    { role: 'build', it: 2, tool: 'Edit routes/signup.ts', tokens: 12, ctx: ['edit: bcrypt hash'], cap: 'Builder: adds bcrypt hashing.' },
    { role: 'judge', it: 2, tool: 'npm test', tokens: 8, test: 'pass', met: true, cap: 'Builder self-check: tests pass. Looks done, ship it.' },
    { role: 'decision', it: 2, met: true, cap: 'The builder graded its own work and called it done as soon as the tests went green.' },
    { role: 'done', ok: false, cap: 'No separate judge. It stopped the moment tests passed.' },
    { role: 'bug', cap: 'But it returns 200, not the 201 the spec requires, and nobody checked the spec. A separate judge would have caught it. It shipped a confident bug.' },
  ];
}

const ROLE_COLOR: Record<string, string> = { plan: 'var(--als-plan)', build: 'var(--als-build)', judge: 'var(--als-judge)' };

interface View {
  role: Step['role'] | null;
  phaseLabel: string;
  caption: string;
  color: string;
  iter: number;
  tokens: number;
  ctx: string[];
  test: 'pass' | 'fail' | null;
  goalMet: boolean;
  gate: { state: 'idle' | 'no' | 'yes' | 'end'; text: string };
  looping: boolean;
  result: null | { kind: 'ok' | 'bad'; title: string; text: string };
}

function computeView(steps: Step[], idx: number): View {
  if (idx < 0) {
    return {
      role: null, phaseLabel: 'ready',
      caption: 'Press Play to watch three agents build a feature together, one loop at a time. Slow by default.',
      color: 'var(--als-accent)', iter: 0, tokens: 0, ctx: [], test: null, goalMet: false,
      gate: { state: 'idle', text: 'the judge decides: loop or stop' }, looping: false, result: null,
    };
  }
  const st = steps[idx];
  let iter = 0, tokens = 0;
  const ctx: string[] = [];
  let test: 'pass' | 'fail' | null = null;
  let met: boolean | null = null;
  for (let j = 0; j <= idx; j++) {
    const s = steps[j];
    if (s.it) iter = s.it;
    tokens += s.tokens || 0;
    if (s.ctx) ctx.push(...s.ctx);
    if (s.test) test = s.test;
    if (typeof s.met === 'boolean') met = s.met;
  }
  const phaseLabel =
    st.role === 'decision' ? (st.met ? 'approved' : 'rejected') :
    st.role === 'done' ? (st.ok ? 'done' : 'stop') :
    st.role === 'bug' ? 'missed' : st.role;

  let gate: View['gate'] = { state: 'idle', text: 'the judge decides: loop or stop' };
  let looping = false;
  let result: View['result'] = null;
  let goalMet = met === true && st.role !== 'decision';

  if (st.role === 'decision') {
    if (st.met) gate = { state: 'yes', text: 'goal met  ✓  stop' };
    else { gate = { state: 'no', text: 'goal not met  ✗  loop back to plan' }; looping = true; }
  }
  if (st.role === 'done') {
    gate = { state: 'end', text: 'loop ended' };
    goalMet = !!st.ok;
    result = st.ok
      ? { kind: 'ok', title: 'Done, verified by the judge', text: 'Correct, hashed password and a 201, confirmed by a separate agent.' }
      : { kind: 'bad', title: 'Stopped by its own self-check', text: 'Tests passed, so it stopped. Nobody checked it against the spec.' };
  }
  if (st.role === 'bug') {
    gate = { state: 'end', text: 'loop ended' };
    goalMet = false;
    result = { kind: 'bad', title: 'Shipped a confident bug', text: 'Returns 200 instead of 201. The builder was too easy on its own work. A separate judge catches what a self-check misses.' };
  }

  return {
    role: st.role, phaseLabel, caption: st.cap,
    color: ROLE_COLOR[st.role] || 'var(--als-accent)',
    iter, tokens, ctx, test, goalMet, gate, looping, result,
  };
}

const CARDS = [
  { role: 'plan', n: 1, title: 'Plan', agent: 'planner agent', desc: 'Decide the single next step toward the goal.' },
  { role: 'build', n: 2, title: 'Build', agent: 'builder agent + tools', desc: 'Do it: read, edit, run a command.' },
  { role: 'judge', n: 3, title: 'Judge', agent: 'judge agent (separate)', desc: 'Grade the result against the goal and spec.' },
] as const;

export default function AgenticLoopSimulator() {
  const [separateJudge, setSeparateJudge] = useState(true);
  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = useMemo(() => buildSteps(separateJudge), [separateJudge]);
  const view = computeView(steps, idx);
  const atEnd = idx >= steps.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (idx >= steps.length - 1) { setPlaying(false); return; }
    const step = steps[idx];
    const extra = step && step.role === 'decision' && !step.met ? 400 : 0;
    timer.current = setTimeout(() => setIdx((i) => i + 1), BASE / speed + extra);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playing, idx, speed, steps]);

  const restart = (keepPlaying: boolean) => { setIdx(-1); setPlaying(keepPlaying); };
  const onPlay = () => { if (atEnd) { restart(true); return; } setPlaying((p) => !p); };
  const onStep = () => { setPlaying(false); setIdx((i) => Math.min(i + 1, steps.length - 1)); };
  const onReset = () => { setPlaying(false); setIdx(-1); };
  const onToggleJudge = () => { setPlaying(false); setIdx(-1); setSeparateJudge((v) => !v); };

  const tokPct = Math.min(100, (view.tokens / TOTAL_BUDGET) * 100);

  return (
    <div className="alsim">
      <style>{CSS}</style>

      <p className="als-eyebrow">Agentic loop · three agents</p>
      <h2 className="als-h">A loop of three agents: plan, build, judge</h2>
      <div className="als-task"><span className="als-dot" /> Task: <b>add a working /signup endpoint (hash the password, return 201)</b></div>

      <div className="als-loop">
        {CARDS.map((c, i) => (
          <div key={c.role} style={{ display: 'contents' }}>
            <div className={`als-card${view.role === c.role ? ' als-active' : ''}`} style={{ ['--c' as string]: ROLE_COLOR[c.role] }}>
              <div className="als-cardtop"><div className="als-n">{c.n}</div><div className="als-role">{c.title}</div></div>
              <div className="als-agent">{c.agent}</div>
              <p className="als-p">{c.desc}</p>
              <div className="als-tool"><span className="als-blink" /><span>{view.role === c.role ? (steps[idx]?.tool || `${c.title.toLowerCase()}...`) : 'idle'}</span></div>
            </div>
            {i < CARDS.length - 1 && (
              <div className={`als-arrow${(view.role === 'build' && i === 0) || (view.role === 'judge' && i === 1) ? ' als-lit' : ''}`}>&rarr;</div>
            )}
          </div>
        ))}
      </div>

      <div className={`als-decision${view.looping ? ' als-looping' : ''}`} style={{ ['--dwell' as string]: String(BASE / speed) }}>
        <svg viewBox="0 0 1000 78" preserveAspectRatio="none" aria-hidden="true">
          <path className="als-track" d="M 960 8 C 960 68, 700 72, 500 72 C 300 72, 40 68, 40 14" />
          <path key={idx} className="als-flow" d="M 960 8 C 960 68, 700 72, 500 72 C 300 72, 40 68, 40 14" />
          <path className="als-track" d="M 40 14 l -7 10 M 40 14 l 9 7" />
        </svg>
        <div className={`als-gate${view.gate.state === 'no' ? ' als-no' : view.gate.state === 'yes' || view.gate.state === 'end' ? ' als-yes' : ''}`}>{view.gate.text}</div>
      </div>

      <div className="als-caption" style={{ ['--phase' as string]: view.color }}>
        <span className="als-ph" style={{ color: view.color, borderColor: view.color }}>{view.phaseLabel}</span>
        <span className="als-txt">{view.caption}</span>
      </div>

      <div className="als-panels">
        <div className="als-panel">
          <h4 className="als-h4">Loop state</h4>
          <div className="als-row"><span className="als-k">Iteration</span><span className="als-v"><b style={{ color: 'var(--als-accent)' }}>{view.iter}</b> <span style={{ color: 'var(--als-faint)' }}>/ loops</span></span></div>
          <div className="als-row"><span className="als-k">Tokens this run</span><span className="als-v">{view.tokens}k</span></div>
          <div className="als-row"><div className="als-meter"><i style={{ width: `${tokPct}%` }} /></div></div>
          <div className="als-hint">The whole context is re-sent every loop, so cost climbs as it grows.</div>
          <div className="als-row" style={{ marginTop: 12 }}><span className="als-k">Goal: hashed pw + 201</span><span className={`als-v${view.goalMet ? ' als-met' : ''}`}>{view.goalMet ? 'met' : 'not met'}</span></div>
          <div className="als-row"><span className="als-k">Test suite</span><span className={`als-badge${view.test === 'pass' ? ' als-pass' : view.test === 'fail' ? ' als-fail' : ''}`}>{view.test === 'pass' ? 'passing' : view.test === 'fail' ? 'failing' : 'not run'}</span></div>
        </div>
        <div className="als-panel">
          <h4 className="als-h4">Context window <span className="als-sub">(grows each loop)</span></h4>
          <div className="als-ctx">
            {view.ctx.length === 0 ? (
              <span className="als-empty">Empty. The agents start with just the task.</span>
            ) : (
              view.ctx.map((t, i) => <span key={`${t}-${i}`} className="als-chip">{t}</span>)
            )}
          </div>
        </div>
      </div>

      {view.result && (
        <div className={`als-result als-show als-${view.result.kind}`}>
          <span className="als-mk">{view.result.kind === 'ok' ? '✓' : '!'}</span>
          <div className="als-rt"><b>{view.result.title}</b><span>{view.result.text}</span></div>
        </div>
      )}

      <div className="als-controls">
        <button className="als-btn als-primary" onClick={onPlay}>{playing ? '❙❙ Pause' : atEnd ? '↻ Replay' : '▶ Play'}</button>
        <button className="als-btn" onClick={onStep}>Step &rsaquo;</button>
        <button className="als-btn" onClick={onReset}>&#8635; Restart</button>
        <span className="als-label">Speed</span>
        <div className="als-seg">
          {[0.5, 1, 2].map((s) => (
            <button key={s} className={`als-btn${speed === s ? ' als-on' : ''}`} onClick={() => setSpeed(s)}>{s}&times;</button>
          ))}
        </div>
        <span className="als-spacer" />
        <button className={`als-toggle${separateJudge ? ' als-ton' : ''}`} onClick={onToggleJudge} aria-pressed={separateJudge}>
          <span className="als-sw" /><span>Separate judge agent</span>
        </button>
      </div>

      <div className="als-maps">
        <div className="als-m als-mplan"><b>Plan</b>In Claude Code: a planner subagent, or a plan-mode turn that writes the next step.</div>
        <div className="als-m als-mbuild"><b>Build</b>The main agent using Read, Edit, Bash to change the code.</div>
        <div className="als-m als-mjudge"><b>Judge</b>A separate reviewer subagent, ideally a different model, checking against tests and the spec.</div>
      </div>

      <p className="als-note">Illustrative model of the multi-agent loop pattern (plan &rarr; build &rarr; judge &rarr; repeat) used by coding agents like Claude Code. It shows the harness and the role split, not any model&apos;s internal reasoning. Turn the separate judge off to see why an agent grading its own work ships confident bugs.</p>
    </div>
  );
}

const CSS = `
.alsim {
  --als-ground: #0a0d14; --als-panel: #121824; --als-panel2: #182031; --als-line: #263144;
  --als-ink: #e8edf6; --als-muted: #8b96ab; --als-faint: #5b6577;
  --als-plan: #7aa2ff; --als-build: #f2b043; --als-judge: #3fd0c0;
  --als-pass: #46d888; --als-fail: #fb7185; --als-accent: #f2b043;
  --als-mono: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
  background: radial-gradient(900px 440px at 72% -12%, #17203233, transparent 60%), var(--als-ground);
  border: 1px solid var(--als-line); border-radius: 16px; padding: 26px 24px 28px;
  color: var(--als-ink); max-width: 1060px; margin: 0 auto;
}
.alsim * { box-sizing: border-box; }
.alsim .als-eyebrow { font-family: var(--als-mono); font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--als-accent); margin: 0 0 8px; }
.alsim .als-h { font-family: var(--als-mono); font-weight: 600; font-size: clamp(20px, 3vw, 28px); letter-spacing: -.01em; margin: 0 0 12px; color: var(--als-ink); }
.alsim .als-task { display: inline-flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--als-muted); background: var(--als-panel); border: 1px solid var(--als-line); border-radius: 8px; padding: 8px 13px; }
.alsim .als-task b { color: var(--als-ink); font-weight: 600; }
.alsim .als-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--als-accent); box-shadow: 0 0 12px var(--als-accent); }
.alsim .als-loop { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; align-items: stretch; gap: 10px; margin-top: 22px; }
.alsim .als-card { position: relative; background: var(--als-panel); border: 1px solid var(--als-line); border-radius: 14px; padding: 15px 15px 17px; opacity: .4; filter: saturate(.5); transition: opacity .5s, filter .5s, transform .5s, border-color .5s, box-shadow .5s; }
.alsim .als-card.als-active { opacity: 1; filter: none; transform: translateY(-4px); border-color: var(--c); box-shadow: 0 0 0 1px var(--c), 0 18px 50px -24px var(--c); }
.alsim .als-cardtop { display: flex; align-items: center; gap: 9px; }
.alsim .als-n { font-family: var(--als-mono); font-size: 12px; font-weight: 600; color: var(--c); border: 1px solid var(--c); border-radius: 6px; width: 24px; height: 24px; display: grid; place-items: center; opacity: .9; flex: none; }
.alsim .als-role { font-family: var(--als-mono); font-size: 15px; font-weight: 600; color: var(--als-ink); }
.alsim .als-agent { font-family: var(--als-mono); font-size: 10.5px; letter-spacing: .04em; text-transform: uppercase; color: var(--c); opacity: .8; margin: 9px 0 6px; }
.alsim .als-p { margin: 0; font-size: 12.5px; color: var(--als-muted); min-height: 34px; }
.alsim .als-tool { margin-top: 12px; font-family: var(--als-mono); font-size: 12px; color: var(--c); background: #0c111b; border: 1px dashed var(--als-line); border-radius: 8px; padding: 7px 10px; min-height: 32px; display: flex; align-items: center; gap: 8px; opacity: 0; transition: opacity .4s; }
.alsim .als-card.als-active .als-tool { opacity: 1; }
.alsim .als-blink { width: 7px; height: 7px; border-radius: 2px; background: var(--c); animation: als-blink 1.1s steps(2) infinite; flex: none; }
@keyframes als-blink { 50% { opacity: .25; } }
.alsim .als-arrow { align-self: center; color: var(--als-faint); font-family: var(--als-mono); font-size: 20px; transition: color .4s, transform .4s; }
.alsim .als-arrow.als-lit { color: var(--als-accent); transform: scale(1.15); }
.alsim .als-decision { position: relative; height: 78px; margin-top: 8px; }
.alsim .als-decision svg { width: 100%; height: 100%; display: block; overflow: visible; }
.alsim .als-track { fill: none; stroke: var(--als-line); stroke-width: 2; }
.alsim .als-flow { fill: none; stroke: var(--als-accent); stroke-width: 2.5; stroke-dasharray: 1400; stroke-dashoffset: 1400; filter: drop-shadow(0 0 6px #f2b04366); }
.alsim .als-decision.als-looping .als-flow { animation: als-draw calc(var(--dwell) * 1ms) ease forwards; }
@keyframes als-draw { to { stroke-dashoffset: 0; } }
.alsim .als-gate { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-family: var(--als-mono); font-size: 12px; letter-spacing: .03em; color: var(--als-muted); background: var(--als-ground); padding: 5px 14px; border: 1px solid var(--als-line); border-radius: 20px; white-space: nowrap; transition: color .3s, border-color .3s, background .3s; }
.alsim .als-gate.als-no { color: var(--als-accent); border-color: #f2b04366; }
.alsim .als-gate.als-yes { color: var(--als-pass); border-color: #46d88866; background: #46d8880f; }
.alsim .als-caption { margin: 16px 0 22px; min-height: 56px; display: flex; align-items: center; gap: 14px; background: linear-gradient(90deg, #121824, #0e131d); border: 1px solid var(--als-line); border-left: 3px solid var(--phase); border-radius: 10px; padding: 13px 18px; transition: border-color .4s; }
.alsim .als-ph { font-family: var(--als-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .1em; border: 1px solid; border-radius: 5px; padding: 3px 8px; white-space: nowrap; opacity: .9; }
.alsim .als-txt { font-size: 14.5px; color: var(--als-ink); }
.alsim .als-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.alsim .als-panel { background: var(--als-panel); border: 1px solid var(--als-line); border-radius: 12px; padding: 15px 18px; }
.alsim .als-h4 { font-family: var(--als-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .13em; color: var(--als-faint); margin: 0 0 13px; font-weight: 600; }
.alsim .als-sub { text-transform: none; letter-spacing: 0; color: var(--als-faint); }
.alsim .als-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.alsim .als-row:last-child { margin-bottom: 0; }
.alsim .als-k { font-size: 13px; color: var(--als-muted); }
.alsim .als-v { font-family: var(--als-mono); font-size: 14px; color: var(--als-ink); font-variant-numeric: tabular-nums; }
.alsim .als-v.als-met { color: var(--als-pass); }
.alsim .als-meter { height: 8px; border-radius: 5px; background: #0c111b; border: 1px solid var(--als-line); overflow: hidden; flex: 1; }
.alsim .als-meter i { display: block; height: 100%; background: linear-gradient(90deg, #f2b043, #fb7185); transition: width .6s; }
.alsim .als-hint { font-size: 11.5px; color: var(--als-faint); }
.alsim .als-badge { font-family: var(--als-mono); font-size: 12px; padding: 4px 10px; border-radius: 20px; border: 1px solid var(--als-line); color: var(--als-muted); }
.alsim .als-badge.als-fail { color: var(--als-fail); border-color: #fb718555; background: #fb71850f; }
.alsim .als-badge.als-pass { color: var(--als-pass); border-color: #46d88855; background: #46d8880f; }
.alsim .als-ctx { display: flex; flex-wrap: wrap; gap: 7px; min-height: 88px; align-content: flex-start; }
.alsim .als-chip { font-family: var(--als-mono); font-size: 11.5px; color: var(--als-plan); background: #7aa2ff12; border: 1px solid #7aa2ff30; border-radius: 6px; padding: 4px 9px; animation: als-pop .45s ease backwards; }
.alsim .als-empty { color: var(--als-faint); font-size: 12.5px; }
@keyframes als-pop { from { opacity: 0; transform: translateY(6px) scale(.96); } }
.alsim .als-result { margin-top: 15px; border-radius: 12px; padding: 15px 18px; display: flex; align-items: center; gap: 14px; animation: als-pop .5s ease; }
.alsim .als-result.als-ok { background: #46d8880e; border: 1px solid #46d88840; }
.alsim .als-result.als-bad { background: #fb71850e; border: 1px solid #fb718540; }
.alsim .als-mk { font-family: var(--als-mono); font-weight: 700; font-size: 22px; }
.alsim .als-result.als-ok .als-mk { color: var(--als-pass); }
.alsim .als-result.als-bad .als-mk { color: var(--als-fail); }
.alsim .als-rt b { display: block; font-size: 15px; margin-bottom: 2px; }
.alsim .als-rt span { font-size: 13.5px; color: var(--als-muted); }
.alsim .als-controls { margin-top: 20px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; background: var(--als-panel2); border: 1px solid var(--als-line); border-radius: 12px; padding: 12px 14px; }
.alsim .als-btn { font-family: var(--als-mono); font-size: 13px; color: var(--als-ink); background: #0e131d; border: 1px solid var(--als-line); border-radius: 8px; padding: 9px 14px; cursor: pointer; transition: border-color .2s, background .2s, color .2s; }
.alsim .als-btn:hover { border-color: var(--als-accent); color: var(--als-accent); }
.alsim .als-btn:focus-visible { outline: 2px solid var(--als-accent); outline-offset: 2px; }
.alsim .als-primary { background: var(--als-accent); color: #1a1204; border-color: var(--als-accent); font-weight: 600; }
.alsim .als-primary:hover { filter: brightness(1.08); color: #1a1204; }
.alsim .als-seg { display: inline-flex; border: 1px solid var(--als-line); border-radius: 8px; overflow: hidden; }
.alsim .als-seg .als-btn { border: none; border-radius: 0; border-right: 1px solid var(--als-line); padding: 9px 12px; }
.alsim .als-seg .als-btn:last-child { border-right: none; }
.alsim .als-seg .als-btn.als-on { background: var(--als-accent); color: #1a1204; font-weight: 600; }
.alsim .als-spacer { flex: 1; }
.alsim .als-label { font-size: 12px; color: var(--als-faint); font-family: var(--als-mono); letter-spacing: .04em; }
.alsim .als-toggle { display: inline-flex; align-items: center; gap: 9px; font-size: 13px; color: var(--als-muted); cursor: pointer; background: none; border: none; padding: 0; }
.alsim .als-toggle .als-sw { width: 40px; height: 22px; border-radius: 20px; background: #0e131d; border: 1px solid var(--als-line); position: relative; transition: background .25s; }
.alsim .als-toggle .als-sw::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--als-faint); transition: transform .25s, background .25s; }
.alsim .als-toggle.als-ton .als-sw { background: #3fd0c033; border-color: #3fd0c066; }
.alsim .als-toggle.als-ton .als-sw::after { transform: translateX(18px); background: var(--als-judge); }
.alsim .als-toggle.als-ton { color: var(--als-ink); }
.alsim .als-maps { margin-top: 16px; background: var(--als-panel); border: 1px solid var(--als-line); border-radius: 12px; padding: 14px 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.alsim .als-m { font-size: 12.5px; color: var(--als-muted); }
.alsim .als-m b { display: block; font-family: var(--als-mono); font-size: 12px; margin-bottom: 3px; }
.alsim .als-mplan b { color: var(--als-plan); }
.alsim .als-mbuild b { color: var(--als-build); }
.alsim .als-mjudge b { color: var(--als-judge); }
.alsim .als-note { font-size: 12px; color: var(--als-faint); margin: 16px 0 0; line-height: 1.6; }
@media (max-width: 820px) {
  .alsim .als-loop { grid-template-columns: 1fr; }
  .alsim .als-arrow { display: none; }
  .alsim .als-panels { grid-template-columns: 1fr; }
  .alsim .als-maps { grid-template-columns: 1fr; }
  .alsim .als-card { opacity: .55; }
}
@media (prefers-reduced-motion: reduce) {
  .alsim .als-card, .alsim .als-caption, .alsim .als-tool, .alsim .als-arrow, .alsim .als-meter i, .alsim .als-gate { transition: none; }
  .alsim .als-decision.als-looping .als-flow { animation: none; stroke-dashoffset: 0; }
  .alsim .als-chip, .alsim .als-result { animation: none; }
  .alsim .als-blink { animation: none; }
}
`;
