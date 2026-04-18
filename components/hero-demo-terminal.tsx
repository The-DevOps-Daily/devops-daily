'use client';

import { useEffect, useRef, useState } from 'react';

interface Line {
  /** `$ ...` is a command prompt; anything else is output. */
  text: string;
  /** Optional tint — 'muted' | 'green' | 'amber' | 'red' | 'default' */
  tone?: 'muted' | 'green' | 'amber' | 'red' | 'default';
  /** Optional character-typing delay in ms; command lines animate, output lines appear instantly */
  typed?: boolean;
}

interface Scene {
  title: string;
  lines: Line[];
}

const SCENES: Scene[] = [
  {
    title: 'kubectl --watch',
    lines: [
      { text: '$ kubectl get pods -A', tone: 'default', typed: true },
      { text: 'NAMESPACE     NAME                 STATUS    AGE', tone: 'muted' },
      { text: 'default       api-5c9f-q8k3x       Running   2m', tone: 'green' },
      { text: 'default       worker-7d2a-b4p2l    Running   2m', tone: 'green' },
      { text: 'monitoring    prometheus-0         Running   14d', tone: 'green' },
      { text: 'ingress-nginx nginx-ctrl-xyz       CrashLoop 38s', tone: 'red' },
      { text: '$ kubectl describe pod nginx-ctrl-xyz', tone: 'default', typed: true },
      { text: '  Events: OOMKilled, retrying (3/5)', tone: 'amber' },
    ],
  },
  {
    title: 'terraform plan',
    lines: [
      { text: '$ terraform plan -out=tfplan', tone: 'default', typed: true },
      { text: 'Refreshing state… 24 resources', tone: 'muted' },
      { text: 'Plan: 3 to add, 1 to change, 0 to destroy.', tone: 'amber' },
      { text: '  + aws_eks_cluster.prod', tone: 'green' },
      { text: '  + aws_iam_role.node', tone: 'green' },
      { text: '  ~ aws_security_group.api', tone: 'amber' },
      { text: '$ terraform apply tfplan', tone: 'default', typed: true },
      { text: 'Apply complete. 4 resources changed.', tone: 'green' },
    ],
  },
  {
    title: 'docker compose up',
    lines: [
      { text: '$ docker compose up -d', tone: 'default', typed: true },
      { text: ' ⠋ Network app_default           Created', tone: 'muted' },
      { text: ' ✔ Container app-postgres-1      Started', tone: 'green' },
      { text: ' ✔ Container app-redis-1         Started', tone: 'green' },
      { text: ' ✔ Container app-api-1           Started', tone: 'green' },
      { text: ' ✔ Container app-worker-1        Started', tone: 'green' },
      { text: '$ curl -s localhost:3000/healthz', tone: 'default', typed: true },
      { text: '{"status":"ok","uptime":14}', tone: 'amber' },
    ],
  },
];

const TONE_CLASS: Record<NonNullable<Line['tone']>, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  green: 'text-green-500',
  amber: 'text-primary',
  red: 'text-red-400',
};

const TYPE_SPEED = 28; // ms per character on command lines
const LINE_DELAY = 240; // ms between lines
const SCENE_PAUSE = 2600; // ms to hold a finished scene before clearing

export function HeroDemoTerminal() {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [visibleLines, setVisibleLines] = useState<Line[]>([]);
  const [partial, setPartial] = useState<{ line: Line; chars: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scene = SCENES[sceneIdx];
    setVisibleLines([]);
    setPartial(null);

    let lineIndex = 0;
    const clearTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    const renderNextLine = () => {
      if (lineIndex >= scene.lines.length) {
        // Scene finished. Hold, then next scene
        timerRef.current = setTimeout(() => {
          setSceneIdx((i) => (i + 1) % SCENES.length);
        }, SCENE_PAUSE);
        return;
      }

      const line = scene.lines[lineIndex];
      if (line.typed) {
        // Type character-by-character
        let chars = 0;
        const typeChar = () => {
          chars += 1;
          if (chars <= line.text.length) {
            setPartial({ line, chars });
            timerRef.current = setTimeout(typeChar, TYPE_SPEED);
          } else {
            // Commit the typed line
            setPartial(null);
            setVisibleLines((prev) => [...prev, line]);
            lineIndex += 1;
            timerRef.current = setTimeout(renderNextLine, LINE_DELAY);
          }
        };
        typeChar();
      } else {
        // Output line appears instantly with small delay before next
        setVisibleLines((prev) => [...prev, line]);
        lineIndex += 1;
        timerRef.current = setTimeout(renderNextLine, LINE_DELAY);
      }
    };

    renderNextLine();
    return clearTimer;
  }, [sceneIdx]);

  const currentScene = SCENES[sceneIdx];

  return (
    <div className="rounded-md border border-border/80 bg-card overflow-hidden font-mono text-sm">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b border-border/80">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
          <div className="w-3 h-3 rounded-full bg-green-400/70" />
        </div>
        <span className="text-xs text-muted-foreground ml-2 truncate">
          {currentScene.title}
        </span>
      </div>
      <div className="px-4 py-3 h-[280px] overflow-hidden text-xs sm:text-sm leading-relaxed">
        <div className="space-y-0.5">
          {visibleLines.map((line, i) => (
            <div key={i} className={TONE_CLASS[line.tone ?? 'default']}>
              {line.text}
            </div>
          ))}
          {partial && (
            <div className={TONE_CLASS[partial.line.tone ?? 'default']}>
              {partial.line.text.slice(0, partial.chars)}
              <span className="inline-block w-[0.55em] h-[0.9em] align-baseline bg-foreground/70 ml-[1px]" />
            </div>
          )}
          {!partial && (
            <div className="text-muted-foreground/60">
              <span className="text-green-500/70">$</span>{' '}
              <span className="inline-block w-[0.6em] h-[1em] align-middle bg-foreground/60 animate-cursor-blink" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
