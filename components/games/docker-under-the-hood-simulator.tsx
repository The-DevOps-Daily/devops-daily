'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CirclePlay,
  Cloud,
  Container,
  Cpu,
  Layers,
  Package,
  Pause,
  Play,
  RotateCcw,
  Settings,
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFrame,
  SimPhoneBar,
  SimResetButton,
  SimStage,
  SimTerminalWindow,
  revealTop,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';

/**
 * How Docker Works Under the Hood.
 *
 * An animation-first walkthrough of what actually happens when you run
 * `docker run -p 8080:80 nginx`. It steps down the whole stack one layer at a
 * time: the CLI, the daemon, the registry pull, containerd, the OCI bundle,
 * runc, the running container, and the shared kernel. Each stage explains what
 * happens and shows the real low-level command you can run yourself, so it
 * doubles as a tour of the actual primitives (namespaces, cgroups, runc).
 */

const ICONS: Record<string, LucideIcon> = {
  terminal: SquareTerminal,
  gear: Settings,
  cloud: Cloud,
  layers: Layers,
  package: Package,
  play: CirclePlay,
  container: Container,
  cpu: Cpu,
  check: Check,
};

function Icon({ name, className }: { name: string; className?: string }) {
  const Glyph = ICONS[name] ?? SquareTerminal;
  return <Glyph className={cn('h-5 w-5', className)} aria-hidden="true" />;
}

interface Stage {
  key: string;
  actor: string;
  icon: string;
  title: string;
  tag: string;
  detail: string;
  cmd: string;
  cmdNote: string;
  artifact?: { label: string; lines: string[] };
  optional?: boolean; // the registry pull, only when the image is not local
}

const KERNEL_PRIMS = ['namespaces', 'cgroups', 'networking', 'mounts'];

function buildStages(imageLocal: boolean): Stage[] {
  const all: Stage[] = [
    {
      key: 'cli',
      actor: 'Docker CLI',
      icon: 'terminal',
      title: 'You run a command',
      tag: 'REST over a Unix socket',
      detail:
        'The docker CLI is just a small REST client. It turns your command into an HTTP request and sends it to the Docker daemon over a local socket. The CLI never creates a container itself.',
      cmd: 'curl --unix-socket /var/run/docker.sock http://localhost/v1.45/info',
      cmdNote: 'The CLI talks to dockerd exactly like this under the hood.',
    },
    {
      key: 'dockerd',
      actor: 'Docker daemon',
      icon: 'gear',
      title: 'dockerd takes the request',
      tag: 'the long-running engine',
      detail:
        'The daemon (dockerd) parses the request and prepares the container config: env, the 8080:80 port map, mounts. First it checks whether the nginx image is already on disk.',
      cmd: 'docker image inspect nginx',
      cmdNote: 'dockerd looks here first. A miss triggers a pull.',
    },
    {
      key: 'pull',
      actor: 'Registry',
      icon: 'cloud',
      title: 'Pull the image',
      tag: 'only the missing layers',
      detail:
        'The image is a stack of read-only layers plus a manifest. Because nginx is not local, the daemon downloads each layer it does not already have from the registry (Docker Hub, ECR, ...) into its content store.',
      cmd: 'docker pull nginx:latest',
      cmdNote: 'Shared base layers are downloaded once and reused across images.',
      artifact: {
        label: 'manifest layers',
        lines: [
          'sha256:9b1c...  31 MB   (debian base)',
          'sha256:4f2d...  1.2 MB  (nginx apt install)',
          'sha256:7a80...  0.6 KB  (config + entrypoint)',
        ],
      },
      optional: true,
    },
    {
      key: 'containerd',
      actor: 'containerd',
      icon: 'layers',
      title: 'dockerd hands off to containerd',
      tag: 'the container supervisor',
      detail:
        'dockerd does not start the process. It delegates to containerd, which owns the container lifecycle: it unpacks the image layers into a snapshot, tracks state, and gets a runtime bundle ready.',
      cmd: 'sudo ctr -n moby containers ls',
      cmdNote: 'Your Docker containers live under containerd’s "moby" namespace.',
    },
    {
      key: 'bundle',
      actor: 'OCI bundle',
      icon: 'package',
      title: 'Assemble the runtime bundle',
      tag: 'config.json + rootfs',
      detail:
        'containerd builds an OCI bundle: a config.json (which process to run, which namespaces and cgroups to create, which mounts) and a rootfs (the image layers plus a fresh writable layer, unioned with overlayfs).',
      cmd: 'runc spec',
      cmdNote: 'Generates a sample config.json so you can see its shape.',
      artifact: {
        label: 'config.json (excerpt)',
        lines: [
          '"process": { "args": ["/docker-entrypoint.sh", "nginx", "-g", "daemon off;"] },',
          '"linux": { "namespaces": [',
          '  {"type":"pid"}, {"type":"network"}, {"type":"mount"},',
          '  {"type":"uts"}, {"type":"ipc"} ] }',
        ],
      },
    },
    {
      key: 'runc',
      actor: 'runc',
      icon: 'play',
      title: 'runc creates the container',
      tag: 'namespaces + cgroups, then exec',
      detail:
        'containerd calls runc, the low-level OCI runtime. runc reads config.json, creates the namespaces and the cgroup, pivots the root into rootfs, drops capabilities, then execs nginx as PID 1 inside the container. runc exits; a shim keeps it attached to containerd.',
      cmd: 'sudo runc --root /run/containerd/runc/moby list',
      cmdNote:
        "The containers runc is managing, by ID. Docker keeps runc's state under containerd's moby namespace, so a plain runc list shows nothing on a Docker host.",
    },
    {
      key: 'container',
      actor: 'Running container',
      icon: 'container',
      title: 'The container is running',
      tag: 'an isolated process, not a VM',
      detail:
        'nginx is now a normal host process, just boxed in: its own PID 1, its own network interface, its own view of the filesystem. Your -p 8080:80 is wired up with an iptables DNAT rule so host port 8080 reaches the container’s port 80.',
      cmd: "docker inspect --format '{{.State.Pid}}' <id>",
      cmdNote: 'That PID is a real process you can see in ps on the host.',
    },
    {
      key: 'kernel',
      actor: 'Linux kernel',
      icon: 'cpu',
      title: 'It all runs on the shared kernel',
      tag: 'namespaces · cgroups · networking · mounts',
      detail:
        'There is no guest OS. The container shares the host kernel, and the "isolation" is just kernel features: namespaces decide what the process can see, cgroups cap what it can use, plus host networking and mounts. That is why containers start in milliseconds.',
      cmd: "lsns -p $(docker inspect --format '{{.State.Pid}}' <id>)",
      cmdNote: 'Lists the namespaces the nginx process is living in.',
    },
  ];
  return all.filter((s) => !(s.optional && imageLocal));
}

const STEP_MS = 2600;

type Tab = 'stage' | 'pipeline';

export default function DockerUnderTheHoodSimulator() {
  const [imageLocal, setImageLocal] = useState(false);
  const [stages, setStages] = useState<Stage[]>(() => buildStages(false));
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>('stage');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The marker above the phone tabs, kept in state so handlers built during render can use it.
  const [tabsAnchor, setTabsAnchor] = useState<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  useEffect(() => {
    const next = buildStages(imageLocal);
    setStages(next);
    setActive((a) => Math.min(a, next.length - 1));
  }, [imageLocal]);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    if (!playing) return;
    if (active >= stages.length - 1) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setActive((a) => a + 1), STEP_MS);
    return clearTimer;
  }, [playing, active, stages.length]);

  useEffect(() => () => clearTimer(), []);

  const go = useCallback(
    (i: number) => {
      clearTimer();
      setPlaying(false);
      setActive(Math.max(0, Math.min(i, stages.length - 1)));
    },
    [stages.length]
  );

  const togglePlay = () => {
    if (active >= stages.length - 1) {
      setActive(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };

  const current = stages[active];
  // The walkthrough is done at the last stage: SimComplete takes the stage, with that stage in it.
  const atEnd = active >= stages.length - 1;

  // Each stage starts at the top of its column.
  useEffect(() => {
    detailRef.current?.scrollTo?.({ top: 0 });
  }, [active]);

  const copyCmd = async () => {
    try {
      await navigator.clipboard.writeText(current.cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  };

  const pick = (i: number) => {
    go(i);
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      setTab('stage');
      revealTop(tabsAnchor, { onlyIfAbove: true });
    }
  };

  const playLabel = playing ? 'Pause' : atEnd ? 'Replay' : 'Play';
  const PlayIcon = playing ? Pause : atEnd ? RotateCcw : Play;

  const commandLine = (
    <SimTerminalWindow label="the command" bodyClassName="px-3 py-2.5 text-sm">
      <span className="text-terminal-prompt" aria-hidden="true">
        ${' '}
      </span>
      <span className="text-terminal-input">
        docker run -p <b className="text-primary">8080</b>:<b className="text-primary">80</b> nginx
      </span>
    </SimTerminalWindow>
  );

  const pipeline = (k: string) => (
    <div className="space-y-2">
      {commandLine}
      <div className="flex items-center gap-2">
        <Switch
          id={`${uid}-${k}-image-local`}
          checked={imageLocal}
          onCheckedChange={setImageLocal}
        />
        <Label htmlFor={`${uid}-${k}-image-local`} className="font-normal">
          nginx already pulled
        </Label>
      </div>
      <ol className="space-y-0.5" aria-label="Docker run pipeline">
        {stages.map((s, i) => {
          const state = i < active ? 'done' : i === active ? 'active' : 'todo';
          return (
            <li key={s.key} className="relative">
              <button
                type="button"
                onClick={() => pick(i)}
                aria-current={i === active ? 'step' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  state === 'active'
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-transparent hover:bg-muted/50'
                )}
              >
                <span
                  className={cn(
                    'relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-md border',
                    state === 'done' && 'border-correct/50 bg-correct/10 text-correct-foreground',
                    state === 'active' && 'border-primary bg-primary/15 text-primary',
                    state === 'todo' && 'bg-card text-muted-foreground'
                  )}
                >
                  <Icon name={state === 'done' ? 'check' : s.icon} className="h-[18px] w-[18px]" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {s.actor}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-medium leading-snug',
                      state === 'todo' && 'text-muted-foreground'
                    )}
                  >
                    {s.title}
                  </span>
                </span>
                <span className="sr-only">
                  {state === 'done' ? ' (seen)' : state === 'active' ? ' (current)' : ''}
                </span>
              </button>
              {i < stages.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute left-[1.55rem] top-10 h-[calc(100%-1.75rem)] w-0.5',
                    i < active ? 'bg-correct/50' : 'bg-border'
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The whole point: a container is not a small VM. It is one host process that the kernel keeps
        in its own namespaces and cgroups. Every step above is something you can run yourself on a
        real Linux box.
      </p>
    </div>
  );

  const detail = (k: string) => (
    <div className="space-y-3">
      <section
        className="rounded-lg border bg-card p-3"
        aria-labelledby={`${uid}-${k}-stage-title`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {current.tag}
          </Badge>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            Stage {active + 1} / {stages.length}
          </span>
        </div>
        <h3
          id={`${uid}-${k}-stage-title`}
          className="flex items-center gap-2.5 text-base font-semibold"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary">
            <Icon name={current.icon} className="h-[18px] w-[18px]" />
          </span>
          {current.actor}
        </h3>
        <p className="mt-2 max-w-prose text-sm leading-relaxed">{current.detail}</p>

        {current.artifact && (
          <SimTerminalWindow
            label={current.artifact.label}
            className="mt-3"
            bodyClassName="overflow-x-auto p-3"
          >
            <pre className="whitespace-pre text-terminal-foreground">
              {current.artifact.lines.map((l, k) => (
                <span key={k}>{l + '\n'}</span>
              ))}
            </pre>
          </SimTerminalWindow>
        )}

        <SimTerminalWindow label="try it yourself" className="mt-3" bodyClassName="p-3">
          <div className="flex items-start gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre pb-0.5 text-terminal-input">
              <span className="text-terminal-prompt" aria-hidden="true">
                ${' '}
              </span>
              {current.cmd}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyCmd}
              className="h-8 shrink-0 border-terminal-border bg-transparent text-terminal-foreground hover:bg-terminal-bar hover:text-terminal-input"
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </SimTerminalWindow>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.cmdNote}</p>

        {current.key === 'kernel' && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Kernel features">
            {KERNEL_PRIMS.map((p) => (
              <li
                key={p}
                className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-xs"
              >
                {p}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  const stepButtons = (size: 'bar' | 'phone') => (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={size === 'bar' ? 'h-8 w-8 px-0' : 'h-10 w-10 px-0'}
        onClick={() => go(active - 1)}
        disabled={active === 0}
        aria-label="Previous stage"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        size="sm"
        className={size === 'bar' ? 'h-8' : 'h-10 flex-1'}
        onClick={togglePlay}
      >
        <PlayIcon className="h-4 w-4" aria-hidden="true" /> {playLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={size === 'bar' ? 'h-8 w-8 px-0' : 'h-10 w-10 px-0'}
        onClick={() => go(active + 1)}
        disabled={atEnd}
        aria-label="Next stage"
      >
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </>
  );

  return (
    <SimFrame phoneBar>
      <SimBar
        title="How Docker Works Under the Hood"
        icon={Container}
        steps={stages.map((s, i) => ({
          title: `${s.actor}: ${s.title}`,
          status: i < active || (atEnd && i === active) ? 'done' : 'todo',
          statusLabel: i < active ? 'seen' : i === active ? 'current' : 'not seen yet',
        }))}
        current={active}
        onStep={go}
        stepNoun="Stage"
        stepsLabel="Stages"
        tools={<SimResetButton onReset={() => go(0)} />}
        progress={{ current: active + 1, total: stages.length }}
        heading={current.title}
        actions={<div className="hidden items-center gap-2 lg:flex">{stepButtons('bar')}</div>}
        goal={
          <>
            Follow <code className="font-mono">docker run -p 8080:80 nginx</code> from the CLI down
            to the kernel, one stage at a time.
          </>
        }
      />

      <SimAnnouncer message={`Stage ${active + 1} of ${stages.length}: ${current.title}`} />

      {atEnd ? (
        <SimComplete
          title="Walkthrough complete"
          summary="You followed docker run from the CLI down to the kernel: four programs hand the work down, and what runs at the end is one ordinary host process in its own namespaces and cgroups."
          onPlayAgain={togglePlay}
          playAgainLabel="Replay"
        >
          {detail('c')}
        </SimComplete>
      ) : (
        <SimStage
          columns="lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)]"
          minHeight="min-h-[24rem]"
          tab={tab}
          onTabChange={(t) => setTab(t as Tab)}
          anchorRef={setTabsAnchor}
          tabsLabel="Walkthrough panels"
          tabOrder={['stage', 'pipeline']}
          panels={[
            { id: 'pipeline', label: 'Pipeline', content: pipeline('d'), mobile: pipeline('m') },
            {
              id: 'stage',
              label: 'Stage',
              content: detail('d'),
              mobile: detail('m'),
              scrollRef: detailRef,
            },
          ]}
        />
      )}

      <SimPhoneBar>{stepButtons('phone')}</SimPhoneBar>
    </SimFrame>
  );
}
