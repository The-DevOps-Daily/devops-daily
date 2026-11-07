'use client';

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimHowTo,
  SimResetButton,
  SimStage,
  SimTerminalWindow,
  revealTop,
  type SimTone,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';

/**
 * Container Security Challenge.
 *
 * Six real `docker run` invocations, each carrying at least one flag that hands
 * an attacker the host. The learner clicks the tokens they think are dangerous,
 * then sees the actual escape path for each one.
 *
 * The teaching point is not "these flags are bad". It is that a container is
 * not a security boundary by default, and that most escapes are one flag rather
 * than a kernel exploit. Every scenario here is something people genuinely ship,
 * usually because a tutorial said to.
 */

interface Token {
  text: string;
  /** Dangerous tokens carry the explanation of what an attacker does with them. */
  danger?: {
    escape: string;
    fix: string;
  };
}

interface Scenario {
  id: string;
  title: string;
  context: string;
  tokens: Token[];
  /** Shown once the scenario is solved. */
  lesson: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'socket',
    title: 'The CI runner',
    context:
      'A build container that needs to build images. Every "docker in docker" tutorial suggests this.',
    tokens: [
      { text: 'docker run -d' },
      {
        text: '-v /var/run/docker.sock:/var/run/docker.sock',
        danger: {
          escape:
            'The Docker socket is the daemon API, and the daemon runs as root on the host. Anyone inside this container can ask it to start a new container with the host filesystem mounted, then write to /etc/sudoers or drop an SSH key. No kernel exploit, just an API call.',
          fix: 'Use a rootless builder such as BuildKit or Kaniko, or a socket proxy that allowlists only the endpoints the build actually needs.',
        },
      },
      { text: 'ci-runner:latest' },
    ],
    lesson:
      'Mounting the Docker socket is equivalent to giving root on the host. It is the single most common container escape, and it is in most CI tutorials.',
  },
  {
    id: 'privileged',
    title: 'The "it did not work so I added this" container',
    context: 'Someone hit a permissions error, added a flag, and the error went away.',
    tokens: [
      { text: 'docker run -it' },
      {
        text: '--privileged',
        danger: {
          escape:
            'Privileged mode grants all capabilities and access to every host device. The classic escape mounts the host disk directly from /dev, reads and rewrites anything on it. A second route abuses cgroup release_agent to make the kernel run a binary on the host as root.',
          fix: 'Grant the specific capability you needed. Nine times out of ten the actual requirement was one of --cap-add=NET_ADMIN or a device mapping.',
        },
      },
      { text: 'ubuntu:24.04 bash' },
    ],
    lesson:
      '--privileged is not "a bit more permission". It removes essentially every boundary between the container and the host at once.',
  },
  {
    id: 'hostfs',
    title: 'The backup job',
    context: 'A container that needs to read some files from the host to back them up.',
    tokens: [
      { text: 'docker run --rm' },
      {
        text: '-v /:/host',
        danger: {
          escape:
            'The entire host filesystem is now readable and writable from inside. An attacker writes to /host/etc/cron.d, or edits /host/root/.ssh/authorized_keys, and owns the machine at the next tick.',
          fix: 'Mount only the directory being backed up, and mount it read-only: -v /var/lib/app:/data:ro',
        },
      },
      { text: 'backup-tool:2' },
    ],
    lesson:
      'A bind mount is a hole in the boundary that is exactly as large as you make it. Mount the narrowest path that works, read-only where you can.',
  },
  {
    id: 'pid',
    title: 'The monitoring agent',
    context: 'An agent that reports on processes running on the machine.',
    tokens: [
      { text: 'docker run -d' },
      {
        text: '--pid=host',
        danger: {
          escape:
            'Sharing the host PID namespace makes every host process visible. /proc/1/root reaches the host filesystem through the init process, and the container can send signals to host processes. Combined with a writable /proc it becomes a full escape.',
          fix: 'Most agents only need metrics. Read them from a mounted /proc as read-only, or use the host metrics endpoint rather than joining its namespace.',
        },
      },
      {
        text: '--cap-add=SYS_PTRACE',
        danger: {
          escape:
            'SYS_PTRACE lets the container attach a debugger to other processes. With --pid=host in the same command, that means attaching to host processes and reading their memory, including credentials.',
          fix: 'Drop it unless you are genuinely debugging. Profilers usually need perf_event_open rather than ptrace.',
        },
      },
      { text: 'monitoring-agent:1.4' },
    ],
    lesson:
      'Two flags that each look survivable can combine into something much worse. Namespace sharing plus a capability is a common pairing in escape write-ups.',
  },
  {
    id: 'caps',
    title: 'The one that looks careful',
    context: 'Someone read that --privileged is bad and replaced it with something more specific.',
    tokens: [
      { text: 'docker run -d' },
      {
        text: '--cap-add=SYS_ADMIN',
        danger: {
          escape:
            'SYS_ADMIN is the capability that does everything. It permits mount, which is enough to remount parts of /proc or /sys writable and reach the host through cgroups. It is often described as "basically root".',
          fix: 'Identify the actual syscall you need. If it genuinely is mounting, do that on the host and bind the result in.',
        },
      },
      {
        text: '--security-opt apparmor=unconfined',
        danger: {
          escape:
            'The default AppArmor profile is what blocks several known escapes even when a capability is present. Turning it off removes the backstop that was covering the flag above.',
          fix: 'Keep the default profile. If it blocks something, write a narrower profile rather than disabling it.',
        },
      },
      { text: 'app:latest' },
    ],
    lesson:
      'Replacing --privileged with specific flags is only an improvement if the specific flags are actually smaller. SYS_ADMIN plus unconfined AppArmor is not.',
  },
  {
    id: 'clean',
    title: 'The last one',
    context:
      'Read it carefully. Not every scenario has something wrong with it, and assuming otherwise is its own failure mode.',
    tokens: [
      { text: 'docker run -d' },
      { text: '--read-only' },
      { text: '--cap-drop=ALL' },
      { text: '--security-opt no-new-privileges' },
      { text: '-v /var/lib/app/data:/data:ro' },
      { text: '--user 10001:10001' },
      { text: 'app:1.9.2' },
    ],
    lesson:
      'This is roughly what a hardened run looks like: no capabilities, a read-only root filesystem, a non-root user, no privilege escalation, and a narrow read-only mount. Nothing to click.',
  },
];

type Phase = 'playing' | 'revealed';
type Tab = 'command' | 'score';
type Score = { found: number; missed: number; wrong: number };

/** The result line after a check: icon, word and tone, from the same counts as the score. */
function verdict(s: Score, dangers: number): { tone: SimTone; label: string } {
  const safe = s.wrong > 0 ? `, and flagged ${s.wrong} safe part${s.wrong > 1 ? 's' : ''}` : '';
  if (dangers === 0) {
    return s.wrong === 0
      ? { tone: 'success', label: 'Correct: nothing here is dangerous' }
      : { tone: 'warning', label: `Nothing here was dangerous${safe}` };
  }
  const all = dangers === 1 ? 'the escape route' : `all ${dangers} escape routes`;
  if (s.missed === 0)
    return { tone: s.wrong ? 'warning' : 'success', label: `You found ${all}${safe}` };
  if (s.found === 0) return { tone: 'danger', label: `You missed ${all}${safe}` };
  return { tone: 'warning', label: `You found ${s.found} of ${dangers} escape routes${safe}` };
}

export default function DockerEscape() {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<Phase>('playing');
  const [scores, setScores] = useState<Score[]>([]);
  const [tab, setTab] = useState<Tab>('command');
  const [announce, setAnnounce] = useState('');
  const uid = useId();
  const tabsRef = useRef<HTMLDivElement>(null);

  const scenario = SCENARIOS[index];
  const dangerIdx = useMemo(
    () => new Set(scenario.tokens.map((t, i) => (t.danger ? i : -1)).filter((i) => i >= 0)),
    [scenario]
  );

  const toggle = useCallback(
    (i: number) => {
      if (phase !== 'playing') return;
      setPicked((prev) => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        return next;
      });
    },
    [phase]
  );

  const check = useCallback(() => {
    const found = [...picked].filter((i) => dangerIdx.has(i)).length;
    const wrong = [...picked].filter((i) => !dangerIdx.has(i)).length;
    setScores((s) => [...s, { found, missed: dangerIdx.size - found, wrong }]);
    setPhase('revealed');
  }, [picked, dangerIdx]);

  const next = useCallback(() => {
    setIndex((i) => i + 1);
    setPicked(new Set());
    setPhase('playing');
  }, []);

  const restart = useCallback(() => {
    setIndex(0);
    setPicked(new Set());
    setPhase('playing');
    setScores([]);
  }, []);

  // The challenge is done once the last scenario is revealed; SimComplete shows then.
  const done = index >= SCENARIOS.length - 1 && phase === 'revealed';
  const totals = scores.reduce(
    (a, s) => ({ found: a.found + s.found, missed: a.missed + s.missed, wrong: a.wrong + s.wrong }),
    { found: 0, missed: 0, wrong: 0 }
  );
  const totalDangers = SCENARIOS.reduce((n, s) => n + s.tokens.filter((t) => t.danger).length, 0);

  const onCheck = () => {
    const found = [...picked].filter((i) => dangerIdx.has(i)).length;
    const wrong = [...picked].filter((i) => !dangerIdx.has(i)).length;
    check();
    setAnnounce(verdict({ found, missed: dangerIdx.size - found, wrong }, dangerIdx.size).label);
    // Move focus to the result, in the copy on screen. The last check opens SimComplete,
    // which takes focus itself.
    if (index >= SCENARIOS.length - 1) return;
    const layout = window.matchMedia('(min-width: 1024px)').matches ? 'd' : 'm';
    requestAnimationFrame(() =>
      document.getElementById(`${uid}-${layout}-result`)?.focus({ preventScroll: true })
    );
  };

  const onNext = () => {
    next();
    setTab('command');
    setAnnounce(`Scenario ${index + 2} of ${SCENARIOS.length}: ${SCENARIOS[index + 1]?.title}`);
    revealTop(tabsRef.current, { onlyIfAbove: true });
  };

  const onRestart = () => {
    restart();
    setTab('command');
    setAnnounce(`Scenario 1 of ${SCENARIOS.length}: ${SCENARIOS[0].title}`);
  };

  const result = phase === 'revealed' ? scores[index] : undefined;
  const v = result ? verdict(result, dangerIdx.size) : null;

  const commandWindow = (
    <SimTerminalWindow
      label="docker run, for review"
      status={phase === 'playing' ? `${picked.size} flagged` : 'checked'}
    >
      <div className="flex flex-wrap gap-2 p-3" role="group" aria-label="docker run command">
        {scenario.tokens.map((t, i) => {
          const isPicked = picked.has(i);
          const isDanger = dangerIdx.has(i);
          const revealed = phase === 'revealed';
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              disabled={revealed}
              aria-pressed={isPicked}
              className={cn(
                'inline-flex min-h-10 items-center gap-1.5 rounded-md border px-2 py-1 text-left font-mono text-[13px] leading-snug [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default lg:min-h-8',
                revealed
                  ? isDanger
                    ? 'border-terminal-error bg-terminal-error/15 text-terminal-error'
                    : isPicked
                      ? 'border-dashed border-terminal-muted text-terminal-muted line-through'
                      : 'border-transparent text-terminal-foreground'
                  : isPicked
                    ? 'border-primary bg-primary/20 text-terminal-input'
                    : 'border-dashed border-terminal-border text-terminal-foreground hover:border-terminal-muted hover:text-terminal-input'
              )}
            >
              {revealed && isDanger && (
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              {t.text}
              {revealed && isDanger && <span className="sr-only"> (escape route)</span>}
              {revealed && !isDanger && isPicked && (
                <span className="sr-only"> (safe, you flagged it)</span>
              )}
            </button>
          );
        })}
      </div>
    </SimTerminalWindow>
  );

  const reveal = (k: string) =>
    v && (
      <>
        <SimFeedback id={`${uid}-${k}-result`} tabIndex={-1} tone={v.tone} label={v.label} />
        <p className="text-xs text-muted-foreground">
          Red parts with a shield are real escape routes. Struck-through parts were safe.
        </p>

        {scenario.tokens.map((t, i) =>
          t.danger ? (
            <SimFeedback
              key={i}
              tone={picked.has(i) ? 'success' : 'danger'}
              label={picked.has(i) ? 'You caught this' : 'You missed this'}
            >
              <code className="block font-mono text-[13px] font-semibold [overflow-wrap:anywhere]">
                {t.text}
              </code>
              <p className="leading-relaxed">
                <strong>The escape:</strong> {t.danger.escape}
              </p>
              <p className="leading-relaxed">
                <strong>The fix:</strong> {t.danger.fix}
              </p>
            </SimFeedback>
          ) : null
        )}

        <div className="rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Lesson
          </p>
          <p className="mt-1">{scenario.lesson}</p>
        </div>
      </>
    );

  const command = (k: string) => (
    <div className="space-y-2">
      <p className="text-sm leading-relaxed text-muted-foreground">{scenario.context}</p>
      {commandWindow}
      {phase === 'playing' ? (
        <Button onClick={onCheck} className="h-10 w-full sm:w-auto">
          {picked.size === 0
            ? 'Nothing here is dangerous'
            : `Check ${picked.size} selection${picked.size > 1 ? 's' : ''}`}
        </Button>
      ) : (
        <>
          {reveal(k)}
          <Button onClick={onNext} className="h-10 w-full sm:w-auto">
            Next scenario <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </>
      )}
    </div>
  );

  const scorecard = (
    <section aria-label="Scorecard" className="rounded-lg border bg-card p-2.5 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Scorecard</h3>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {scores.length}/{SCENARIOS.length}
        </span>
      </div>
      <ol className="space-y-1.5">
        {SCENARIOS.map((s, i) => {
          const sc = scores[i];
          const dangers = s.tokens.filter((t) => t.danger).length;
          const r = sc ? verdict(sc, dangers) : null;
          return (
            <li
              key={s.id}
              aria-current={i === index ? 'step' : undefined}
              className={cn(
                'flex items-start gap-2 rounded-md px-2 py-1.5',
                i === index && 'border border-primary/40 bg-primary/5'
              )}
            >
              <span className="mt-0.5 w-4 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-medium">{s.title}</p>
                <p
                  className={cn(
                    'text-xs',
                    r
                      ? r.tone === 'success'
                        ? 'text-correct-foreground'
                        : r.tone === 'danger'
                          ? 'text-wrong-foreground'
                          : 'text-partial-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  {sc
                    ? dangers === 0
                      ? sc.wrong === 0
                        ? 'Nothing to flag: correct'
                        : `${sc.wrong} safe flagged`
                      : `${sc.found} of ${dangers} found${sc.wrong ? `, ${sc.wrong} safe flagged` : ''}`
                    : i === index
                      ? 'Now'
                      : 'To do'}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        Escape routes found so far: {totals.found}. Some commands have more than one, and one has
        none.
      </p>
    </section>
  );

  return (
    <SimFrame>
      <SimBar
        title="Container Security Challenge"
        icon={ShieldAlert}
        lead={
          <ol className="flex items-center gap-1" aria-label="Scenarios">
            {SCENARIOS.map((s, i) => {
              const finished = i < index || (i === index && phase === 'revealed');
              return (
                <li
                  key={s.id}
                  className={cn(
                    'h-1.5 w-6 rounded-full',
                    finished ? 'bg-correct' : i === index ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <span className="sr-only">
                    Scenario {i + 1}: {s.title},{' '}
                    {finished ? 'checked' : i === index ? 'current' : 'to do'}
                  </span>
                </li>
              );
            })}
          </ol>
        }
        tools={<SimResetButton onReset={onRestart} />}
        progress={{ current: index + 1, total: SCENARIOS.length }}
        heading={scenario.title}
        goal={
          done
            ? 'Challenge complete. The last scenario and your scorecard are below.'
            : 'Click every part of this command that would let an attacker reach the host, then check.'
        }
      >
        <SimHowTo autoOpen={index === 0 && phase === 'playing'}>
          Six real <code className="font-mono">docker run</code> commands that people ship, usually
          because a tutorial said to. Flag the parts that hand an attacker the host, then check to
          see the escape route and the fix for each one.
        </SimHowTo>
      </SimBar>

      <SimAnnouncer message={announce} />

      {done ? (
        <SimComplete
          title="Challenge complete"
          summary={
            <>
              {totals.found} of {totalDangers} escape routes found
              {totals.wrong > 0 &&
                `, ${totals.wrong} safe flag${totals.wrong > 1 ? 's' : ''} flagged`}
              . A container is not a security boundary on its own. Almost everything here was one
              flag, not a kernel bug, which is why reviewing the run command matters as much as
              scanning the image.
            </>
          }
          stats={[
            { label: 'Escape routes found', value: `${totals.found}/${totalDangers}` },
            { label: 'Missed', value: String(totals.missed) },
            { label: 'Safe parts flagged', value: String(totals.wrong) },
          ]}
          onPlayAgain={onRestart}
          playAgainLabel="Start again"
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <section aria-label="The last scenario" className="space-y-2">
              <h3 className="text-sm font-semibold">Last scenario: {scenario.title}</h3>
              {commandWindow}
              {reveal('c')}
            </section>
            {scorecard}
          </div>
        </SimComplete>
      ) : (
        <SimStage
          columns="lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]"
          minHeight="min-h-[22rem]"
          tab={tab}
          onTabChange={(t) => setTab(t as Tab)}
          anchorRef={tabsRef}
          tabsLabel="Challenge panels"
          panels={[
            { id: 'command', label: 'Command', content: command('d'), mobile: command('m') },
            { id: 'score', label: 'Scorecard', content: scorecard },
          ]}
        />
      )}
    </SimFrame>
  );
}
