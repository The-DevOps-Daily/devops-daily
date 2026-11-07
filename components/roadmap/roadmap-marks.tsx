import { CircleCheck, CircleDot, CircleMinus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TopicKind } from '@/lib/roadmap-data';
import type { TopicStatus } from '@/lib/roadmap-progress';

export const STATUS_LABELS: Record<TopicStatus, { label: string; action: string }> = {
  done: { label: 'Done', action: 'Done' },
  progress: { label: 'In progress', action: 'In progress' },
  skip: { label: 'Skipped', action: 'Skip' },
};

const STATUS_ICONS = { done: CircleCheck, progress: CircleDot, skip: CircleMinus };
const STATUS_COLORS: Record<TopicStatus, string> = {
  done: 'text-green-600 dark:text-green-400',
  progress: 'text-primary',
  skip: 'text-muted-foreground',
};

/** Fixed 16 px slot, so a status loading in never moves the label. */
export function StatusIcon({
  status,
  withLabel = false,
  className,
}: {
  status?: TopicStatus;
  withLabel?: boolean;
  className?: string;
}) {
  if (!status) {
    return withLabel ? (
      <span className="sr-only">Not started</span>
    ) : (
      <span className="w-4 shrink-0" />
    );
  }
  const Icon = STATUS_ICONS[status];
  return (
    <>
      <Icon
        className={cn('h-4 w-4 shrink-0', STATUS_COLORS[status], className)}
        strokeWidth={2}
        aria-hidden="true"
      />
      {withLabel && <span className="sr-only">{STATUS_LABELS[status].label}</span>}
    </>
  );
}

/** Core: a filled square. Optional: a hollow, dashed circle. Shape, not colour. */
export function KindMarker({ kind, className }: { kind: TopicKind; className?: string }) {
  return kind === 'core' ? (
    <span
      aria-hidden="true"
      className={cn('h-2.5 w-2.5 shrink-0 rounded-[2px] bg-primary', className)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        'h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px] border-dashed border-muted-foreground',
        className
      )}
    />
  );
}

export function KindLabel({ kind }: { kind: TopicKind }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <KindMarker kind={kind} />
      {kind === 'core' ? 'core topic' : 'optional topic'}
    </span>
  );
}
