'use client';

import { useCallback, useMemo, useState } from 'react';

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
 *
 * Styling is scoped under `.cesim` (classes prefixed `ces-`) so it does not
 * collide with the site's global Tailwind layer, following bug-hunter and
 * ddos-simulator.
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

export default function DockerEscape() {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<Phase>('playing');
  const [scores, setScores] = useState<{ found: number; missed: number; wrong: number }[]>([]);

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

  const done = index >= SCENARIOS.length - 1 && phase === 'revealed';
  const totals = scores.reduce(
    (a, s) => ({ found: a.found + s.found, missed: a.missed + s.missed, wrong: a.wrong + s.wrong }),
    { found: 0, missed: 0, wrong: 0 }
  );
  const totalDangers = SCENARIOS.reduce(
    (n, s) => n + s.tokens.filter((t) => t.danger).length,
    0
  );

  return (
    <div className="cesim">
      <style>{CSS}</style>

      <div className="ces-top">
        <div className="ces-progress" aria-label={`Scenario ${index + 1} of ${SCENARIOS.length}`}>
          {SCENARIOS.map((s, i) => (
            <span
              key={s.id}
              className={`ces-dot${i === index ? ' ces-now' : ''}${i < index ? ' ces-past' : ''}`}
            />
          ))}
        </div>
        <span className="ces-count">
          {index + 1} / {SCENARIOS.length}
        </span>
      </div>

      <h3 className="ces-title">{scenario.title}</h3>
      <p className="ces-context">{scenario.context}</p>

      <p className="ces-instruction">
        {phase === 'playing'
          ? 'Click every part of this command that would let an attacker reach the host.'
          : 'Red is a real escape route. Grey was safe.'}
      </p>

      <div className="ces-cmd" role="group" aria-label="docker run command">
        {scenario.tokens.map((t, i) => {
          const isPicked = picked.has(i);
          const isDanger = dangerIdx.has(i);
          const cls =
            phase === 'revealed'
              ? isDanger
                ? ' ces-danger'
                : isPicked
                  ? ' ces-falsepos'
                  : ''
              : isPicked
                ? ' ces-picked'
                : '';
          return (
            <button
              key={i}
              type="button"
              className={`ces-tok${cls}`}
              onClick={() => toggle(i)}
              disabled={phase === 'revealed'}
              aria-pressed={isPicked}
            >
              {t.text}
            </button>
          );
        })}
      </div>

      {phase === 'playing' && (
        <button className="ces-btn ces-primary" onClick={check}>
          {picked.size === 0 ? 'Nothing here is dangerous' : `Check ${picked.size} selection${picked.size > 1 ? 's' : ''}`}
        </button>
      )}

      {phase === 'revealed' && (
        <div className="ces-reveal">
          {scenario.tokens.map((t, i) =>
            t.danger ? (
              <div key={i} className={`ces-card${picked.has(i) ? ' ces-got' : ' ces-miss'}`}>
                <div className="ces-cardtop">
                  <code>{t.text}</code>
                  <span className="ces-tag">{picked.has(i) ? 'you caught this' : 'you missed this'}</span>
                </div>
                <p className="ces-escape">
                  <b>The escape:</b> {t.danger.escape}
                </p>
                <p className="ces-fix">
                  <b>The fix:</b> {t.danger.fix}
                </p>
              </div>
            ) : null
          )}

          {dangerIdx.size === 0 && (
            <div className="ces-card ces-got">
              <div className="ces-cardtop">
                <code>nothing dangerous</code>
                <span className="ces-tag">
                  {picked.size === 0 ? 'correct, you clicked nothing' : 'you flagged a safe flag'}
                </span>
              </div>
            </div>
          )}

          <p className="ces-lesson">{scenario.lesson}</p>

          {!done ? (
            <button className="ces-btn ces-primary" onClick={next}>
              Next scenario &rsaquo;
            </button>
          ) : (
            <div className="ces-final">
              <p>
                <b>
                  {totals.found} of {totalDangers} escape routes found
                </b>
                {totals.wrong > 0 && `, ${totals.wrong} safe flag${totals.wrong > 1 ? 's' : ''} flagged`}
              </p>
              <p className="ces-lesson">
                A container is not a security boundary on its own. Almost everything here was one
                flag, not a kernel bug, which is why reviewing the run command matters as much as
                scanning the image.
              </p>
              <button className="ces-btn" onClick={restart}>
                Start again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const CSS = `
.cesim { --ces-bg:#0d1117; --ces-panel:#161b22; --ces-line:#272e38; --ces-fg:#e6edf3; --ces-dim:#8b949e;
  --ces-red:#f85149; --ces-amber:#d29922; --ces-green:#3fb950;
  background:var(--ces-bg); color:var(--ces-fg); border:1px solid var(--ces-line);
  border-radius:14px; padding:22px; font-family:ui-sans-serif,system-ui,sans-serif; }
.cesim .ces-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
.cesim .ces-progress { display:flex; gap:6px; }
.cesim .ces-dot { width:26px; height:4px; border-radius:2px; background:var(--ces-line); display:block; }
.cesim .ces-dot.ces-past { background:var(--ces-green); }
.cesim .ces-dot.ces-now { background:var(--ces-amber); }
.cesim .ces-count { font-size:12px; color:var(--ces-dim); font-variant-numeric:tabular-nums; }
.cesim .ces-title { margin:0 0 4px; font-size:19px; font-weight:650; }
.cesim .ces-context { margin:0 0 16px; color:var(--ces-dim); font-size:14px; line-height:1.5; }
.cesim .ces-instruction { margin:0 0 10px; font-size:13px; color:var(--ces-amber); }
.cesim .ces-cmd { display:flex; flex-wrap:wrap; gap:8px; background:#010409; border:1px solid var(--ces-line);
  border-radius:10px; padding:14px; margin-bottom:16px; }
.cesim .ces-tok { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px;
  background:transparent; color:var(--ces-fg); border:1px dashed transparent; border-radius:6px;
  padding:5px 8px; cursor:pointer; transition:background .15s,border-color .15s; }
.cesim .ces-tok:hover:not(:disabled) { border-color:var(--ces-dim); }
.cesim .ces-tok:focus-visible { outline:2px solid var(--ces-amber); outline-offset:1px; }
.cesim .ces-tok:disabled { cursor:default; }
.cesim .ces-tok.ces-picked { background:#d2992222; border-color:var(--ces-amber); color:var(--ces-amber); }
.cesim .ces-tok.ces-danger { background:#f8514922; border-color:var(--ces-red); color:var(--ces-red); border-style:solid; }
.cesim .ces-tok.ces-falsepos { background:#8b949e22; border-color:var(--ces-dim); color:var(--ces-dim); text-decoration:line-through; }
.cesim .ces-btn { background:var(--ces-panel); color:var(--ces-fg); border:1px solid var(--ces-line);
  border-radius:8px; padding:9px 15px; font-size:13px; font-weight:550; cursor:pointer; }
.cesim .ces-btn:hover { border-color:var(--ces-dim); }
.cesim .ces-btn.ces-primary { background:#1f6feb; border-color:#1f6feb; color:#fff; }
.cesim .ces-btn.ces-primary:hover { background:#2b7bf3; }
.cesim .ces-reveal { display:grid; gap:12px; }
.cesim .ces-card { background:var(--ces-panel); border:1px solid var(--ces-line); border-left-width:3px;
  border-radius:10px; padding:13px 15px; }
.cesim .ces-card.ces-got { border-left-color:var(--ces-green); }
.cesim .ces-card.ces-miss { border-left-color:var(--ces-red); }
.cesim .ces-cardtop { display:flex; flex-wrap:wrap; align-items:baseline; justify-content:space-between; gap:8px; margin-bottom:8px; }
.cesim .ces-cardtop code { font-size:13px; color:var(--ces-fg); }
.cesim .ces-tag { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--ces-dim); }
.cesim .ces-escape, .cesim .ces-fix { margin:0 0 6px; font-size:13.5px; line-height:1.55; color:var(--ces-dim); }
.cesim .ces-fix { margin-bottom:0; color:#adbac7; }
.cesim .ces-lesson { font-size:14px; line-height:1.6; color:var(--ces-fg); background:#1f6feb14;
  border:1px solid #1f6feb44; border-radius:10px; padding:12px 14px; margin:0; }
.cesim .ces-final { display:grid; gap:10px; justify-items:start; }
@media (max-width:640px) { .cesim { padding:16px; } .cesim .ces-cmd { padding:10px; } }
`;
