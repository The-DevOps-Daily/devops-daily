'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CircleCheck, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimMissionList,
  SimResetButton,
  SimStage,
  SimTerminalWindow,
  revealTop,
  useMissions,
  type Mission,
  type SimStepStatus,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';
import {
  can,
  allowedVerbs,
  isClusterScoped,
  SCENARIOS,
  NAMESPACES,
  RESOURCES,
  VERBS,
  type Cluster,
  type Explanation,
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
 * The engine is real and has no Kubernetes in it: every scenario is evaluated
 * by the rules in lib/games/rbac-sim-engine.ts, which its tests pin down.
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

interface MissionState {
  scenarioId: string;
  question: Question;
  answer: Explanation;
}

/**
 * Each mission is one question a scenario's own lesson asks for, checked with
 * the engine's answer. Free play stays open after the last one.
 */
const MISSIONS: Mission<MissionState>[] = [
  {
    id: 'clusterrole-rolebinding',
    label: 'Find the one namespace where the RoleBinding lets ci list pods',
    hint: 'In “The one that surprises everyone”, change the namespace.',
    check: (s) => s.scenarioId === 'clusterrole-rolebinding' && s.answer.allowed,
  },
  {
    id: 'cluster-scoped',
    label: 'Show that a RoleBinding in dev still cannot grant nodes',
    hint: 'In “Nodes are not in a namespace”, set the namespace to dev.',
    check: (s) =>
      s.scenarioId === 'cluster-scoped' &&
      s.question.resource === 'nodes' &&
      s.question.namespace === 'dev' &&
      !s.answer.allowed,
  },
  {
    id: 'resource-names',
    label: 'Show that the one-secret rule does not cover list',
    hint: 'In “One secret, not the list”, switch the verb to list.',
    check: (s) =>
      s.scenarioId === 'resource-names' &&
      s.question.resource === 'secrets' &&
      s.question.verb === 'list' &&
      !s.answer.allowed,
  },
  {
    id: 'no-deny',
    label: 'Show that the empty role takes nothing away',
    hint: 'In “There is no deny”, ask about a verb ci does have, such as list.',
    check: (s) => s.scenarioId === 'no-deny' && s.answer.allowed,
  },
  {
    id: 'cluster-wide',
    label: 'Show that a ClusterRoleBinding reaches prod too',
    hint: 'In “Genuinely cluster-wide”, set the namespace to prod.',
    check: (s) =>
      s.scenarioId === 'cluster-wide' && s.answer.allowed && s.question.namespace === 'prod',
  },
];

const FIELD =
  'h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9';
const LABEL = 'mb-1 block text-xs font-medium text-muted-foreground';

type Tab = 'ask' | 'cluster' | 'scenario';

export default function K8sRbacSimulator() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = useMemo(
    () => SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0],
    [scenarioId]
  );

  const [question, setQuestion] = useState<Question>(SCENARIOS[0].question);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>('ask');
  const [visited, setVisited] = useState<Set<string>>(() => new Set([SCENARIOS[0].id]));
  /** "Keep exploring" closes the end card; free play goes on. */
  const [dismissed, setDismissed] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const uid = useId();

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
    [cluster, question]
  );

  const missionState = useMemo(
    () => ({ scenarioId, question, answer }),
    [scenarioId, question, answer]
  );
  const missions = useMissions(MISSIONS, missionState);

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

  const index = SCENARIOS.findIndex((s) => s.id === scenario.id);
  const doneIds = new Set(missions.missions.filter((m) => m.done).map((m) => m.id));
  const missionFor = (id: string) => MISSIONS.find((m) => m.id === id);

  const open = (i: number) => {
    const s = SCENARIOS[i];
    if (!s) return;
    pickScenario(s.id);
    setVisited((v) => (v.has(s.id) ? v : new Set(v).add(s.id)));
    revealTop(tabsRef.current, { onlyIfAbove: true });
  };

  const startOver = () => {
    pickScenario(SCENARIOS[0].id);
    setVisited(new Set([SCENARIOS[0].id]));
    setDismissed(false);
    missions.reset();
    setTab('ask');
  };

  const stepStatus = (id: string): SimStepStatus => {
    if (!visited.has(id)) return 'todo';
    return !missionFor(id) || doneIds.has(id) ? 'done' : 'started';
  };

  const lesson = (
    <div className="rounded-md border-l-2 border-primary bg-muted/50 px-3 py-2 text-sm leading-relaxed">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        What this one shows
      </p>
      <p className="mt-0.5">{scenario.teaches}</p>
    </div>
  );

  const scenarioPanel = (
    <div className="space-y-2">
      {lesson}
      <SimMissionList missions={missions.missions} />
    </div>
  );

  const clusterPanel = (
    <SimTerminalWindow
      label="the cluster"
      status={`${cluster.roles.length} role${cluster.roles.length === 1 ? '' : 's'}, ${cluster.bindings.length} binding${cluster.bindings.length === 1 ? '' : 's'}`}
      bodyClassName="divide-y divide-terminal-border"
    >
      {cluster.roles.map((r) => (
        <pre
          className="whitespace-pre-wrap break-words p-3 text-terminal-foreground"
          key={`${r.kind}-${r.name}`}
        >
          {roleYaml(r)}
        </pre>
      ))}
      {cluster.bindings.map((b) => (
        <pre
          className="whitespace-pre-wrap break-words p-3 text-terminal-foreground"
          key={`${b.kind}-${b.name}`}
        >
          {bindingYaml(b)}
        </pre>
      ))}
    </SimTerminalWindow>
  );

  const askPanel = (k: string) => (
    <section
      aria-labelledby={`${uid}-${k}-ask`}
      className="space-y-2 rounded-lg border bg-card p-2.5"
    >
      <h3 id={`${uid}-${k}-ask`} className="text-sm font-semibold">
        Can this subject
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        <div>
          <label htmlFor={`${uid}-${k}-subject`} className={LABEL}>
            Subject
          </label>
          <select
            id={`${uid}-${k}-subject`}
            className={FIELD}
            value={`${question.subject.kind}/${question.subject.namespace ?? '-'}/${question.subject.name}`}
            onChange={(e) => {
              const found = subjects.find(
                (s) => `${s.kind}/${s.namespace ?? '-'}/${s.name}` === e.target.value
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

        <div>
          <label htmlFor={`${uid}-${k}-verb`} className={LABEL}>
            Verb
          </label>
          <select
            id={`${uid}-${k}-verb`}
            className={FIELD}
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

        <div>
          <label htmlFor={`${uid}-${k}-resource`} className={LABEL}>
            Resource
          </label>
          <select
            id={`${uid}-${k}-resource`}
            className={FIELD}
            value={question.resource}
            onChange={(e) => setResource(e.target.value)}
          >
            {RESOURCES.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${uid}-${k}-ns`} className={LABEL}>
            Namespace
          </label>
          <select
            id={`${uid}-${k}-ns`}
            className={FIELD}
            value={question.namespace ?? ''}
            onChange={(e) => setQuestion((q) => ({ ...q, namespace: e.target.value || undefined }))}
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

      <div>
        <label htmlFor={`${uid}-${k}-name`} className={LABEL}>
          Named object, optional
        </label>
        <input
          id={`${uid}-${k}-name`}
          className={FIELD}
          value={question.resourceName ?? ''}
          placeholder="e.g. db-password"
          onChange={(e) =>
            setQuestion((q) => ({ ...q, resourceName: e.target.value || undefined }))
          }
        />
      </div>

      <SimFeedback
        tone={answer.allowed ? 'success' : 'danger'}
        label={answer.allowed ? 'Allowed' : 'Denied'}
      >
        <p className="leading-relaxed">{answer.summary}</p>
      </SimFeedback>

      {answer.nearMisses.map((m, i) => (
        <SimFeedback
          key={i}
          tone="warning"
          label={
            <span className="font-mono text-xs">
              {m.binding.kind}/{m.binding.name}
            </span>
          }
        >
          <p className="leading-relaxed">{m.reason}</p>
        </SimFeedback>
      ))}

      <div>
        <ul className="flex flex-wrap gap-1.5" aria-label={`Verbs allowed on ${question.resource}`}>
          {VERBS.map((v) => {
            const on = verbs.includes(v);
            return (
              <li
                key={v}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs',
                  on
                    ? 'border-correct/50 bg-correct/10 text-correct-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {on && <CircleCheck className="h-3 w-3" aria-hidden="true" />}
                {v}
                <span className="sr-only">{on ? ' (allowed)' : ' (not allowed)'}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Every verb this subject has on {question.resource}
          {question.namespace
            ? ` in ${question.namespace}`
            : isClusterScoped(question.resource)
              ? ' at cluster scope'
              : ' across all namespaces'}
          . RBAC has no deny rules, so this list only ever grows as bindings are added.
        </p>
      </div>

      <div>
        <SimTerminalWindow label="the same question, on a real cluster" bodyClassName="p-2.5">
          <div className="flex items-start gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap pb-0.5 text-terminal-input">
              {answer.kubectl}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyKubectl}
              className="h-8 shrink-0 border-terminal-border bg-transparent text-terminal-foreground hover:bg-terminal-bar hover:text-terminal-input"
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </SimTerminalWindow>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Impersonation needs a user who can impersonate, which is usually a cluster admin.
        </p>
      </div>
    </section>
  );

  const barButton = 'h-10 w-10 px-0 lg:h-8 lg:w-8';

  return (
    <SimFrame>
      <SimBar
        title="Kubernetes RBAC Simulator"
        icon={KeyRound}
        steps={SCENARIOS.map((s) => ({ title: s.label, status: stepStatus(s.id) }))}
        current={index}
        onStep={open}
        stepNoun="Scenario"
        stepsLabel="Scenarios"
        tools={<SimResetButton onReset={startOver} />}
        progress={{ current: index + 1, total: SCENARIOS.length }}
        heading={scenario.label}
        meta={
          <Badge variant="secondary" className="tabular-nums">
            Missions {missions.done}/{missions.total}
          </Badge>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className={barButton}
              onClick={() => open(index - 1)}
              disabled={index === 0}
              aria-label="Previous scenario"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={barButton}
              onClick={() => open(index + 1)}
              disabled={index === SCENARIOS.length - 1}
              aria-label="Next scenario"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </>
        }
        goal={
          missions.complete ? (
            'Missions done. Keep asking your own questions in any scenario.'
          ) : (
            <>
              {missions.current?.label}.{' '}
              <span className="hidden sm:inline">{missions.current?.hint}</span>
            </>
          )
        }
      />

      <SimAnnouncer message={`${answer.allowed ? 'Allowed' : 'Denied'}. ${answer.summary}`} />

      {missions.complete && !dismissed ? (
        <SimComplete
          title="Lab complete"
          summary="You found where each binding applies and where it does not: a RoleBinding keeps even a ClusterRole inside its namespace, cluster-scoped resources need a ClusterRoleBinding, and nothing ever takes a permission away."
          stats={[
            { label: 'Missions', value: `${missions.done}/${missions.total}` },
            { label: 'Scenarios opened', value: `${visited.size}/${SCENARIOS.length}` },
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
          columns="lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.25fr)]"
          minHeight="min-h-[26rem]"
          tab={tab}
          onTabChange={(t) => setTab(t as Tab)}
          anchorRef={tabsRef}
          tabsLabel="RBAC panels"
          tabOrder={['ask', 'cluster', 'scenario']}
          panels={[
            { id: 'scenario', label: 'Missions', content: scenarioPanel },
            { id: 'cluster', label: 'Cluster', content: clusterPanel },
            {
              id: 'ask',
              label: 'Ask',
              content: askPanel('d'),
              mobile: (
                <>
                  {lesson}
                  {askPanel('m')}
                </>
              ),
            },
          ]}
        />
      )}
    </SimFrame>
  );
}
