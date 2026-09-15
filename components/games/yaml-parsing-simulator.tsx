'use client';

import { useMemo, useState } from 'react';
import { parseYaml, render, specDisagreements, type ParseResult } from '@/lib/games/yaml-sim-engine';

/**
 * YAML Parsing Simulator.
 *
 * You edit YAML on the left and see what the parser decided on the right, under
 * both YAML 1.1 and YAML 1.2, because the two specs disagree and that
 * disagreement is where almost every YAML surprise comes from.
 *
 * The parser is real and runs in the browser: see lib/games/yaml-sim-engine.ts.
 * Nothing here is canned, so a value you type is resolved by the same rules the
 * lessons describe.
 *
 * Styling is scoped under `.yamlsim` (classes prefixed `ys-`) so it does not
 * collide with the site's global Tailwind layer.
 */

interface Lesson {
  title: string;
  blurb: string;
  yaml: string;
  /** What to notice, shown under the output. */
  point: string;
}

const LESSONS: Lesson[] = [
  {
    title: 'The Norway problem',
    blurb: 'A country list, written the obvious way.',
    yaml: `countries:
  - name: Norway
    code: NO
  - name: Sweden
    code: SE`,
    point:
      'Under YAML 1.1, NO is the boolean false. Norway loses its country code. SE is untouched, so the bug only appears for one row and only in some parsers.',
  },
  {
    title: 'Versions are not strings',
    blurb: 'A version number in a deployment file.',
    yaml: `image: myapp
version: 1.10
replicas: 3
minVersion: 1.9`,
    point:
      'version: 1.10 is the float 1.1, which is a lower number than 1.9. The trailing zero is gone before anything compares them. Quote it.',
  },
  {
    title: 'File modes and leading zeros',
    blurb: 'A permission, written the way chmod takes it.',
    yaml: `defaultMode: 0755
fallbackMode: 0644
odd: 08`,
    point:
      'YAML 1.1 reads a leading zero as octal, so 0755 is 493. YAML 1.2 reads it as plain decimal 755. Same file, two different permissions, and 08 is not valid octal so it is a string in one and 8 in the other.',
  },
  {
    title: 'Quoting is the fix',
    blurb: 'The same values, quoted.',
    yaml: `code: "NO"
version: "1.10"
mode: "0755"
enabled: "yes"`,
    point:
      'A quoted scalar is always a string, in both specs, with no resolution applied. This is the whole fix and it costs two characters.',
  },
  {
    title: 'Empty is not empty string',
    blurb: 'A key with nothing after it.',
    yaml: `name: app
replicas:
labels: ~
annotations: null
env: ""`,
    point:
      'Three of these are null and only one is an empty string. A missing value is null, ~ is null, null is null. If your code checks for "" it will not catch any of them.',
  },
  {
    title: 'Block scalars keep your newlines',
    blurb: 'A script in a CI file.',
    yaml: `literal: |
  echo one
  echo two
folded: >
  this becomes
  a single line`,
    point:
      'The pipe keeps line breaks, which is what you want for a script. The angle bracket folds them into spaces, which is what you want for prose and what silently breaks a shell script.',
  },
  {
    title: 'A duplicate key is silent',
    blurb: 'A config where a block was pasted in twice.',
    yaml: `replicas: 3
image: myapp:v2
resources:
  cpu: 500m
replicas: 1`,
    point:
      'The spec calls a repeated key an error. Most parsers in use quietly keep the last one, so replicas is 1 and the 3 you read at the top of the file never applied. Nothing warns you.',
  },
  {
    title: 'Anchors and merge keys',
    blurb: 'The shorthand every CI config uses to avoid repeating itself.',
    yaml: `defaults: &defaults
  image: alpine
  retries: 3

build:
  <<: *defaults
  script: make

test:
  <<: *defaults
  retries: 5
  script: make test`,
    point:
      'The anchor names a block, the alias reuses it, and the merge key folds it in. A key written next to the merge wins over the merged one, which is how test gets retries: 5 while build keeps 3.',
  },
  {
    title: 'Tabs are not indentation',
    blurb: 'Indented with a tab, which looks identical in most editors.',
    yaml: `service:\n\tport: 8080`,
    point:
      'YAML forbids tabs in indentation. Your editor renders it the same width as spaces, which is why this error is so frustrating to find by eye.',
  },
  {
    title: 'The missing space',
    blurb: 'A colon with no space after it.',
    yaml: `key:value
other: fine`,
    point:
      'A mapping needs a colon followed by a space. Without it the whole thing is one plain string, so the parser does not fail where you think it did.',
  },
];

const KIND_COLOR: Record<string, string> = {
  string: '#34d399',
  int: '#60a5fa',
  float: '#a78bfa',
  bool: '#f59e0b',
  null: '#f87171',
};

function Output({ result }: { result: ParseResult }) {
  if (!result.ok) {
    return (
      <div className="ys-err">
        <div className="ys-err-head">line {result.line}: {result.message}</div>
        {result.hint && <div className="ys-err-hint">{result.hint}</div>}
      </div>
    );
  }
  return <pre className="ys-out">{render(result.root)}</pre>;
}

export default function YamlParsingSimulator() {
  const [lesson, setLesson] = useState(0);
  const [text, setText] = useState(LESSONS[0].yaml);

  const as11 = useMemo(() => parseYaml(text, '1.1'), [text]);
  const as12 = useMemo(() => parseYaml(text, '1.2'), [text]);
  const disagreements = useMemo(() => specDisagreements(text), [text]);

  const pick = (i: number) => {
    setLesson(i);
    setText(LESSONS[i].yaml);
  };

  return (
    <div className="yamlsim">
      <style>{`
        .yamlsim { --ys-bg:#0b1020; --ys-panel:#111936; --ys-line:rgba(255,255,255,.08); --ys-dim:#94a3b8; }
        .yamlsim { color:#e2e8f0; font-size:14px; }
        .ys-lessons { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px; }
        .ys-lesson { border:1px solid var(--ys-line); background:var(--ys-panel); color:var(--ys-dim);
          border-radius:8px; padding:6px 10px; font-size:12px; cursor:pointer; transition:all .15s; }
        .ys-lesson:hover { color:#e2e8f0; border-color:rgba(255,255,255,.2); }
        .ys-lesson[data-on="1"] { background:#1e293b; color:#fff; border-color:#38bdf8; }
        .ys-blurb { color:var(--ys-dim); margin-bottom:10px; font-size:13px; }
        .ys-grid { display:grid; gap:12px; grid-template-columns:1fr; }
        @media (min-width:900px) { .ys-grid { grid-template-columns:1fr 1fr; } }
        .ys-pane { border:1px solid var(--ys-line); border-radius:12px; background:var(--ys-panel); overflow:hidden; }
        .ys-pane-head { padding:8px 12px; border-bottom:1px solid var(--ys-line); font-size:12px;
          text-transform:uppercase; letter-spacing:.06em; color:var(--ys-dim); display:flex; justify-content:space-between; }
        .ys-ta { width:100%; min-height:220px; background:transparent; border:0; color:#e2e8f0;
          font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; line-height:1.6;
          padding:12px; resize:vertical; outline:none; tab-size:2; }
        .ys-out { margin:0; padding:12px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
          font-size:13px; line-height:1.6; white-space:pre-wrap; word-break:break-word; min-height:100px; }
        .ys-err { padding:12px; }
        .ys-err-head { color:#fca5a5; font-family:ui-monospace,monospace; font-size:13px; }
        .ys-err-hint { color:var(--ys-dim); margin-top:8px; font-size:13px; line-height:1.6; }
        .ys-split { display:grid; gap:12px; grid-template-columns:1fr; margin-top:12px; }
        @media (min-width:900px) { .ys-split { grid-template-columns:1fr 1fr; } }
        .ys-diff { margin-top:12px; border:1px solid #f59e0b55; background:#f59e0b12; border-radius:12px; padding:12px; }
        .ys-diff-head { color:#fbbf24; font-size:12px; text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px; }
        .ys-diff table { width:100%; border-collapse:collapse; font-size:13px; }
        .ys-diff th { text-align:left; color:var(--ys-dim); font-weight:500; padding:4px 8px 4px 0; font-size:12px; }
        .ys-diff td { padding:4px 8px 4px 0; font-family:ui-monospace,monospace; }
        .ys-notes { margin-top:12px; border:1px solid #38bdf855; background:#38bdf812; border-radius:12px;
          padding:10px 12px; color:#cbd5e1; font-size:13px; line-height:1.65; display:grid; gap:6px; }
        .ys-notes code { background:rgba(255,255,255,.08); padding:1px 5px; border-radius:4px; }
        .ys-point { margin-top:12px; border-left:3px solid #38bdf8; padding:8px 0 8px 12px; color:#cbd5e1; line-height:1.65; }
        .ys-agree { margin-top:12px; color:var(--ys-dim); font-size:13px; }
        .ys-kind { font-size:11px; padding:1px 6px; border-radius:999px; border:1px solid currentColor; }
      `}</style>

      <div className="ys-lessons">
        {LESSONS.map((l, i) => (
          <button key={l.title} className="ys-lesson" data-on={i === lesson ? '1' : '0'} onClick={() => pick(i)}>
            {l.title}
          </button>
        ))}
      </div>

      <p className="ys-blurb">{LESSONS[lesson].blurb} Edit it and watch what changes.</p>

      <div className="ys-grid">
        <div className="ys-pane">
          <div className="ys-pane-head"><span>YAML you wrote</span></div>
          <textarea className="ys-ta" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        </div>
        <div className="ys-pane">
          <div className="ys-pane-head">
            <span>What the parser sees</span>
            <span>YAML 1.2</span>
          </div>
          <Output result={as12} />
        </div>
      </div>

      <div className="ys-split">
        <div className="ys-pane">
          <div className="ys-pane-head">
            <span>The same file, older parser</span>
            <span>YAML 1.1</span>
          </div>
          <Output result={as11} />
        </div>
        <div className="ys-pane">
          <div className="ys-pane-head"><span>Types resolved</span></div>
          <div style={{ padding: 12 }}>
            {as12.ok && as12.coercions.length === 0 && (
              <span style={{ color: '#94a3b8' }}>Every value here stayed a string.</span>
            )}
            {as12.ok &&
              as12.coercions.map((c) => (
                <div key={c.path} style={{ marginBottom: 6, fontFamily: 'ui-monospace,monospace', fontSize: 13 }}>
                  <span style={{ color: '#94a3b8' }}>{c.path}</span>{' '}
                  <span style={{ color: '#64748b' }}>{c.raw}</span>{' '}
                  <span className="ys-kind" style={{ color: KIND_COLOR[c.kind] }}>
                    {c.kind}
                  </span>{' '}
                  <span style={{ color: KIND_COLOR[c.kind] }}>{c.value}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {as12.ok && (as12.duplicates.length > 0 || as12.documents > 1) && (
        <div className="ys-notes">
          {as12.duplicates.length > 0 && (
            <div>
              <strong>Repeated {as12.duplicates.length === 1 ? 'key' : 'keys'}:</strong>{' '}
              {as12.duplicates.join(', ')}. The last value won. Most parsers do this without warning.
            </div>
          )}
          {as12.documents > 1 && (
            <div>
              This file holds <strong>{as12.documents} documents</strong> separated by <code>---</code>. Only the
              first is shown here. Tools that expect one document will read only the first too.
            </div>
          )}
        </div>
      )}

      {disagreements.length > 0 ? (
        <div className="ys-diff">
          <div className="ys-diff-head">
            The two specs disagree about {disagreements.length} value{disagreements.length === 1 ? '' : 's'}
          </div>
          <table>
            <thead>
              <tr>
                <th>where</th>
                <th>you wrote</th>
                <th>YAML 1.1</th>
                <th>YAML 1.2</th>
              </tr>
            </thead>
            <tbody>
              {disagreements.map((d) => (
                <tr key={d.path}>
                  <td style={{ color: '#94a3b8' }}>{d.path}</td>
                  <td>{d.raw}</td>
                  <td style={{ color: '#fbbf24' }}>{d.as11}</td>
                  <td style={{ color: '#34d399' }}>{d.as12}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        as12.ok && as11.ok && <div className="ys-agree">Both specs read this document the same way.</div>
      )}

      <div className="ys-point">{LESSONS[lesson].point}</div>
    </div>
  );
}
