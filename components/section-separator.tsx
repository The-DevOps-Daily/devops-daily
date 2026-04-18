import { cn } from '@/lib/utils';

interface SectionSeparatorProps {
  /** Shell command shown with a `$` prompt, e.g. `cd /content/guides` */
  command: string;
  className?: string;
}

export function SectionSeparator({ command, className }: SectionSeparatorProps) {
  return (
    <div
      className={cn(
        'my-10 flex items-center gap-3 font-mono text-xs text-muted-foreground',
        className
      )}
      aria-hidden="true"
    >
      <span className="flex-1 h-px bg-border" />
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <span className="text-green-500/80">$</span>
        <span>{command}</span>
      </span>
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}
