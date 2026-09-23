'use client';

import { useMemo, useState } from 'react';
import {
  can,
  allowedVerbs,
  isClusterScoped,
  SCENARIOS,
  NAMESPACES,
  RESOURCES,
  VERBS,
  type Cluster,
  type Question,
  type Verb,
  type Binding,
  type Role,
} from '@/lib/games/rbac-sim-engine';

/**
 * Kubernetes RBAC Simulator.
 *
 * Answers "can this subject do this verb on this resource in this namespace",
 * and more importantly why. `kubectl auth can-i` already gives a yes or no;
 * what it will not tell you is which binding granted it, or why the binding
 * you were sure about did not apply.
 *
 * The engine is real and has no Kubernetes in it, so a cluster you assemble
 * here is evaluated by the same rules as the shipped scenarios. See
 * lib/games/rbac-sim-engine.ts and its 28 tests.
 *
 * Styling is scoped under `.rbacsim` (classes prefixed `rb-`) so it does not
 * collide with the site's global Tailwind layer.
 */

function roleYaml(role: Role): string {
  const head = [
    `kind: ${role.kind}`,
    `metadata:`,
    `  name: ${role.name}`,
    ...(role.namespace ? [`  namespace: ${role.namespace}`] : []),
    `rules:`,
  ];
  if (role.rules.length === 0) return [...head, `  []   # grants nothing`].join('\n');
  const rules = role.rules.flatMap((r) => [
    `  - apiGroups: [${r.apiGroups.map((g) => `"${g}"`).join(', ')}]`,
    `    resources: [${r.resources.map((x) => `"${x}"`).join(', ')}]`,
    `    verbs: [${r.verbs.map((v) => `"${v}"`).join(', ')}]`,
    ...(r.resourceNames?.length
      ? [`    resourceNames: [${r.resourceNames.map((n) => `"${n}"`).join(', ')}]`]
      : []),
  ]);
  return [...head, ...rules].join('\n');
}

function bindingYaml(b: Binding): string {
  return [
    `kind: ${b.kind}`,
    `metadata:`,
    `  name: ${b.name}`,
    ...(b.namespace ? [`  namespace: ${b.namespace}`] : []),
    `roleRef:`,
    `  kind: ${b.roleRef.kind}`,
    `  name: ${b.roleRef.name}`,
    `subjects:`,
    ...b.subjects.flatMap((s) => [
      `  - kind: ${s.kind}`,
      `    name: ${s.name}`,
      ...(s.namespace ? [`    namespace: ${s.namespace}`] : []),
    ]),
  ].join('\n');
}

export default function K8sRbacSimulator() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = useMemo(
    () => SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0],
    [scenarioId],
  );

  const [question, setQuestion] = useState<Question>(SCENARIOS[0].question);
  const [copied, setCopied] = useState(false);

  const cluster: Cluster = scenario.cluster;
  const answer = useMemo(() => can(cluster, question), [cluster, question]);
  const verbs = useMemo(
    () =>
      allowedVerbs(cluster, {
        subject: question.subject,
        resource: question.resource,
        namespace: question.namespace,
        resourceName: question.resourceName,
        apiGroup: question.apiGroup,
      }),
    [cluster, question],
  );

  // Every subject any binding in this scenario names, so the picker offers the
  // ones that exist rather than a free-text box nobody can spell.
  const subjects = useMemo(() => {
    const seen = new Map<string, Question['subject']>();
    for (const b of cluster.bindings) {
      for (const s of b.subjects) {
        seen.set(`${s.kind}/${s.namespace ?? '-'}/${s.name}`, s);
      }
    }
    return [...seen.values()];
  }, [cluster]);

  const pickScenario = (id: string) => {
    const s = SCENARIOS.find((x) => x.id === id);
    if (!s) return;
    setScenarioId(id);
    setQuestion(s.question);
  };

  const setResource = (name: string) => {
    const r = RESOURCES.find((x) => x.name === name);
    setQuestion((q) => ({
      ...q,
      resource: name,
      apiGroup: r?.apiGroup || undefined,
      // A named object only makes sense for the resource it belongs to.
      resourceName: undefined,
    }));
  };

  const copyKubectl = () => {
    void navigator.clipboard?.writeText(answer.kubectl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="rbacsim">
      <style>{`
        .rbacsim { --rb-panel:#111936; --rb-line:rgba(255,255,255,.08); --rb-dim:#94a3b8;
          --rb-yes:#34d399; --rb-no:#f87171; color:#e2e8f0; font-size:14px; }
        .rb-scenarios { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
        .rb-scenario { border:1px solid var(--rb-line); background:var(--rb-panel); color:var(--rb-dim);
          border-radius:8px; padding:6px 10px; font-size:12px; cursor:pointer; transition:all .15s; }
        .rb-scenario:hover { color:#e2e8f0; border-color:rgba(255,255,255,.2); }
        .rb-scenario[data-on="1"] { background:#1e293b; color:#fff; border-color:#38bdf8; }
        .rb-teaches { border-left:3px solid #38bdf8; padding:8px 0 8px 12px; color:#cbd5e1;
          line-height:1.65; margin-bottom:14px; font-size:13px; }

        .rb-grid { display:grid; gap:12px; grid-template-columns:1fr; }
        @media (min-width:960px) { .rb-grid { grid-template-columns:minmax(0,1fr) minmax(0,1.05fr); } }
        .rb-pane { border:1px solid var(--rb-line); border-radius:12px; background:var(--rb-panel);
          overflow:hidden; min-width:0; }
        .rb-head { padding:8px 12px; border-bottom:1px solid var(--rb-line); font-size:11px;
          text-transform:uppercase; letter-spacing:.06em; color:var(--rb-dim);
          display:flex; justify-content:space-between; gap:8px; }
        .rb-body { padding:12px; }
        .rb-yaml { margin:0; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px;
          line-height:1.55; white-space:pre-wrap; word-break:break-word; color:#cbd5e1; }
        .rb-yaml + .rb-yaml { margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,.06); }

        .rb-q { display:grid; gap:8px; grid-template-columns:repeat(2,minmax(0,1fr)); }
        @media (min-width:600px) { .rb-q { grid-template-columns:repeat(4,minmax(0,1fr)); } }
        .rb-field label { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.05em;
          color:var(--rb-dim); margin-bottom:3px; }
        .rb-field select, .rb-field input { width:100%; background:#0b1020; border:1px solid var(--rb-line);
          border-radius:6px; color:#e2e8f0; padding:6px 8px; font-size:13px; outline:none; font-family:inherit; }
        .rb-field select:focus, .rb-field input:focus { border-color:#38bdf8; }

        .rb-verdict { margin-top:12px; border-radius:12px; padding:12px; border:1px solid; line-height:1.6; }
        .rb-verdict[data-allowed="1"] { border-color:#34d39955; background:#34d39910; }
        .rb-verdict[data-allowed="0"] { border-color:#f8717155; background:#f8717110; }
        .rb-verdict-head { font-weight:600; margin-bottom:4px; }
        .rb-verdict[data-allowed="1"] .rb-verdict-head { color:var(--rb-yes); }
        .rb-verdict[data-allowed="0"] .rb-verdict-head { color:var(--rb-no); }
        .rb-verdict-body { color:#cbd5e1; font-size:13px; }

        .rb-miss { margin-top:10px; border:1px solid #f59e0b44; background:#f59e0b0f; border-radius:10px;
          padding:10px 12px; font-size:13px; line-height:1.6; color:#cbd5e1; }
        .rb-miss-name { color:#fbbf24; font-family:ui-monospace,monospace; font-size:12px; }

        .rb-verbs { display:flex; flex-wrap:wrap; gap:4px; margin-top:10px; }
        .rb-verb { font-family:ui-monospace,monospace; font-size:11px; padding:2px 7px; border-radius:999px;
          border:1px solid rgba(255,255,255,.12); color:#64748b; }
        .rb-verb[data-on="1"] { border-color:var(--rb-yes); color:var(--rb-yes); background:#34d3990f; }

        .rb-cmd { margin-top:12px; display:flex; gap:8px; align-items:stretch; }
        .rb-cmd code { flex:1; background:#0b1020; border:1px solid var(--rb-line); border-radius:8px;
          padding:9px 10px; font-family:ui-monospace,monospace; font-size:12px; color:#bae6fd;
          overflow-x:auto; white-space:nowrap; }
        .rb-copy { border:1px solid var(--rb-line); background:var(--rb-panel); color:var(--rb-dim);
          border-radius:8px; padding:0 12px; font-size:12px; cursor:pointer; white-space:nowrap; }
        .rb-copy:hover { color:#e2e8f0; }
        .rb-note { margin-top:10px; font-size:12px; color:var(--rb-dim); line-height:1.6; }
      `}</style>

      <div className="rb-scenarios">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            className="rb-scenario"
            data-on={s.id === scenarioId ? '1' : '0'}
            onClick={() => pickScenario(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="rb-teaches">{scenario.teaches}</p>

      <div className="rb-grid">
        <div className="rb-pane">
          <div className="rb-head">
            <span>The cluster</span>
            <span>
              {cluster.roles.length} role{cluster.roles.length === 1 ? '' : 's'},{' '}
              {cluster.bindings.length} binding{cluster.bindings.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="rb-body">
            {cluster.roles.map((r) => (
              <pre className="rb-yaml" key={`${r.kind}-${r.name}`}>
                {roleYaml(r)}
              </pre>
            ))}
            {cluster.bindings.map((b) => (
              <pre className="rb-yaml" key={`${b.kind}-${b.name}`}>
                {bindingYaml(b)}
              </pre>
            ))}
          </div>
        </div>

        <div className="rb-pane">
          <div className="rb-head">
            <span>Can this subject</span>
          </div>
          <div className="rb-body">
            <div className="rb-q">
              <div className="rb-field">
                <label htmlFor="rb-subject">subject</label>
                <select
                  id="rb-subject"
                  value={`${question.subject.kind}/${question.subject.namespace ?? '-'}/${question.subject.name}`}
                  onChange={(e) => {
                    const found = subjects.find(
                      (s) => `${s.kind}/${s.namespace ?? '-'}/${s.name}` === e.target.value,
                    );
                    if (found) setQuestion((q) => ({ ...q, subject: found }));
                  }}
                >
                  {subjects.map((s) => (
                    <option
                      key={`${s.kind}/${s.namespace ?? '-'}/${s.name}`}
                      value={`${s.kind}/${s.namespace ?? '-'}/${s.name}`}
                    >
                      {s.namespace ? `${s.namespace}/${s.name}` : s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rb-field">
                <label htmlFor="rb-verb">verb</label>
                <select
                  id="rb-verb"
                  value={question.verb}
                  onChange={(e) => setQuestion((q) => ({ ...q, verb: e.target.value as Verb }))}
                >
                  {VERBS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rb-field">
                <label htmlFor="rb-resource">resource</label>
                <select id="rb-resource" value={question.resource} onChange={(e) => setResource(e.target.value)}>
                  {RESOURCES.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rb-field">
                <label htmlFor="rb-ns">namespace</label>
                <select
                  id="rb-ns"
                  value={question.namespace ?? ''}
                  onChange={(e) =>
                    setQuestion((q) => ({ ...q, namespace: e.target.value || undefined }))
                  }
                >
                  <option value="">(cluster scope / all namespaces)</option>
                  {NAMESPACES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rb-field" style={{ marginTop: 8 }}>
              <label htmlFor="rb-name">named object, optional</label>
              <input
                id="rb-name"
                value={question.resourceName ?? ''}
                placeholder="e.g. db-password"
                onChange={(e) =>
                  setQuestion((q) => ({ ...q, resourceName: e.target.value || undefined }))
                }
              />
            </div>

            <div className="rb-verdict" data-allowed={answer.allowed ? '1' : '0'}>
              <div className="rb-verdict-head">{answer.allowed ? 'Allowed' : 'Denied'}</div>
              <div className="rb-verdict-body">{answer.summary}</div>
            </div>

            {answer.nearMisses.map((m, i) => (
              <div className="rb-miss" key={i}>
                <span className="rb-miss-name">
                  {m.binding.kind}/{m.binding.name}
                </span>{' '}
                {m.reason}
              </div>
            ))}

            <div className="rb-verbs">
              {VERBS.map((v) => (
                <span key={v} className="rb-verb" data-on={verbs.includes(v) ? '1' : '0'}>
                  {v}
                </span>
              ))}
            </div>
            <p className="rb-note">
              Every verb this subject has on {question.resource}
              {question.namespace
                ? ` in ${question.namespace}`
                : isClusterScoped(question.resource)
                  ? ' at cluster scope'
                  : ' across all namespaces'}
              . RBAC has no
              deny rules, so this list only ever grows as bindings are added.
            </p>

            <div className="rb-cmd">
              <code>{answer.kubectl}</code>
              <button className="rb-copy" onClick={copyKubectl}>
                {copied ? 'copied' : 'copy'}
              </button>
            </div>
            <p className="rb-note">
              The same question, asked of a real cluster. Impersonation needs a user who can
              impersonate, which is usually a cluster admin.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
