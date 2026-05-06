import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  TYPE_LABELS,
  type CrossContentItem,
} from '@/lib/related-cross-type';
import {
  FileText,
  ListChecks,
  Layers,
  Wrench,
  HelpCircle,
  Briefcase,
  type LucideIcon,
} from 'lucide-react';

interface RelatedAcrossTypesProps {
  items: CrossContentItem[];
  /** Section heading. Default "Also worth your time on this topic". */
  title?: string;
  className?: string;
}

const TYPE_ICONS: Record<CrossContentItem['type'], LucideIcon> = {
  post: FileText,
  checklist: ListChecks,
  flashcard: Layers,
  exercise: Wrench,
  quiz: HelpCircle,
  'interview-question': Briefcase,
};

export function RelatedAcrossTypes({
  items,
  title = 'Also worth your time on this topic',
  className,
}: RelatedAcrossTypesProps) {
  if (!items.length) return null;

  return (
    <section className={cn('', className)}>
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => {
          const Icon = TYPE_ICONS[item.type];
          return (
            <Link
              key={`${item.type}:${item.id}`}
              href={item.href}
              className="group flex flex-col rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                  <Icon className="w-3 h-3" />
                  {TYPE_LABELS[item.type]}
                </span>
              </div>
              <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              {item.description && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                  {item.description}
                </p>
              )}
              {item.meta && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {item.meta}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
