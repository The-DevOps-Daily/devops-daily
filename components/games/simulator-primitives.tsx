'use client';

import { useId, type ComponentType, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { SIM_TONE } from '@/components/games/sim/tones';
import { cn } from '@/lib/utils';

type MetricTone = 'default' | 'good' | 'warn' | 'bad';
type NodeStatus = 'healthy' | 'lagging' | 'down' | 'routing' | 'hot';
type FlowTone = 'primary' | 'success' | 'warn';
type AdvisorTone = 'primary' | 'warn' | 'bad';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function SimulatorMetricCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  detail,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  tone?: MetricTone;
  detail?: string;
}) {
  const tones = {
    default: 'border-border bg-card',
    good: SIM_TONE.success.surface,
    warn: SIM_TONE.warning.surface,
    bad: SIM_TONE.danger.surface,
  };

  return (
    <div className={cn('rounded-lg border p-4', tones[tone])}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 break-words text-xl font-semibold tracking-tight sm:text-2xl">
        {value}
      </div>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function SimulatorNodeCard({
  title,
  subtitle,
  status = 'healthy',
  load = 40,
  icon: Icon = Database,
}: {
  title: string;
  subtitle: string;
  status?: NodeStatus;
  load?: number;
  icon?: ComponentType<{ className?: string }>;
}) {
  const statusStyles = {
    healthy: SIM_TONE.success.surface,
    lagging: SIM_TONE.warning.surface,
    down: cn(SIM_TONE.danger.surface, 'opacity-70'),
    routing: 'border-primary/40 bg-primary/10',
    hot: SIM_TONE.warning.surface,
  };

  return (
    <div className={cn('rounded-lg border p-3 shadow-sm backdrop-blur', statusStyles[status])}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-md border bg-background/80 p-2">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="break-words text-xs text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        <span
          className={cn(
            'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
            status === 'down'
              ? 'bg-wrong'
              : status === 'lagging' || status === 'hot'
                ? 'bg-partial'
                : 'bg-correct'
          )}
        />
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/80">
        <div
          className={cn(
            'h-full rounded-full',
            load > 85 ? 'bg-wrong' : load > 65 ? 'bg-partial' : 'bg-correct'
          )}
          style={{ width: `${clamp(load, 2, 100)}%` }}
        />
      </div>
    </div>
  );
}

/** A moving dash for traffic. It stops when `paused` or when the visitor prefers reduced motion. */
export function SimulatorFlowLine({
  tone = 'primary',
  delay = 0,
  paused = false,
}: {
  tone?: FlowTone;
  delay?: number;
  paused?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const color = tone === 'success' ? 'bg-correct' : tone === 'warn' ? 'bg-partial' : 'bg-primary';
  const still = paused || reduceMotion;

  return (
    <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-border">
      {still ? (
        <div className={cn('absolute left-1/3 top-0 h-1 w-16 rounded-full', color)} />
      ) : (
        <motion.div
          className={cn('absolute top-0 h-1 w-16 rounded-full', color)}
          animate={{ x: ['-30%', '620%'] }}
          transition={{ repeat: Infinity, duration: 1.4, delay, ease: 'linear' }}
        />
      )}
    </div>
  );
}

export function SimulatorModeButton<T extends string>({
  value,
  current,
  onClick,
  children,
}: {
  value: T;
  current: T;
  onClick: (value: T) => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={value === current ? 'default' : 'outline'}
      aria-pressed={value === current}
      onClick={() => onClick(value)}
      className="h-10 lg:h-8"
    >
      {children}
    </Button>
  );
}

export function SimulatorControlSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const labelId = useId();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span id={labelId} className="font-medium">
          {label}
        </span>
        <Badge variant="secondary" className="shrink-0">
          {value}
          {suffix}
        </Badge>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        thumbLabelledBy={labelId}
        onValueChange={([next]) => onChange(next ?? value)}
      />
    </div>
  );
}

export function SimulatorAdvisorCard({
  title,
  icon: Icon,
  children,
  tone = 'primary',
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  tone?: AdvisorTone;
}) {
  const tones = {
    primary: 'border-primary/25 bg-primary/5',
    warn: SIM_TONE.warning.surface,
    bad: SIM_TONE.danger.surface,
  };

  return (
    <div className={cn('rounded-lg border p-4', tones[tone])}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
