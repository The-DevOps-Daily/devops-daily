'use client';

import { cn } from '@/lib/utils';
import { TOPIC_STATUSES } from '@/lib/roadmap-progress';
import { StatusIcon, STATUS_LABELS } from '@/components/roadmap/roadmap-marks';
import { useSyllabus } from './syllabus-provider';

/**
 * A table row. The content is rendered on the server; this only adds the
 * status styling and remembers the last resource opened from the row.
 */
export function TopicRow({
  topicId,
  id,
  className,
  children,
}: {
  topicId: string;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { progress, loaded, next, recordOpen } = useSyllabus();
  const status = loaded ? progress.topics[topicId] : undefined;
  return (
    <li
      id={id}
      data-status={status}
      onClick={(event) => {
        const link = (event.target as Element).closest<HTMLAnchorElement>(
          'a[data-roadmap-resource]'
        );
        const href = link?.getAttribute('href');
        if (link && href) recordOpen(topicId, link.dataset.title ?? link.textContent ?? href, href);
      }}
      className={cn(
        className,
        loaded && next?.id === topicId && 'bg-primary/[0.05]',
        status === 'skip' && 'text-muted-foreground'
      )}
    >
      {children}
    </li>
  );
}

export function UpNextTag({ topicId }: { topicId: string }) {
  const { next, loaded } = useSyllabus();
  if (!loaded || next?.id !== topicId) return null;
  return (
    <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-normal text-primary">
      up next
    </span>
  );
}

export function TopicStatusControl({ topicId, topicName }: { topicId: string; topicName: string }) {
  const { progress, loaded, setStatus } = useSyllabus();
  const status = loaded ? progress.topics[topicId] : undefined;
  return (
    <div
      role="group"
      aria-label={`Your status for ${topicName}`}
      className="grid grid-cols-3 gap-1.5 lg:grid-cols-1"
    >
      {TOPIC_STATUSES.map((option) => {
        const pressed = status === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={pressed}
            disabled={!loaded}
            onClick={() => setStatus(topicId, pressed ? null : option)}
            className={cn(
              'inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-xs font-medium transition-colors lg:min-h-8 lg:justify-start',
              pressed
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:border-primary/50'
            )}
          >
            <StatusIcon
              status={option}
              className={cn('h-3.5 w-3.5', pressed && 'text-primary-foreground')}
            />
            {STATUS_LABELS[option].action}
          </button>
        );
      })}
    </div>
  );
}
