import {
  BookOpen,
  CircleHelp,
  ExternalLink,
  FileText,
  FlaskConical,
  Layers,
  ListChecks,
  Terminal,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import type { ResolvedResource, ResourceType } from '@/lib/roadmap-resources';

type Group = 'read' | 'practice' | 'check';

export const RESOURCE_TYPES: Record<
  ResourceType,
  { label: string; icon: LucideIcon; group: Group }
> = {
  guide: { label: 'Guide', icon: BookOpen, group: 'read' },
  post: { label: 'Post', icon: FileText, group: 'read' },
  external: { label: 'External', icon: ExternalLink, group: 'read' },
  simulator: { label: 'Simulator', icon: Terminal, group: 'practice' },
  lab: { label: 'Lab', icon: FlaskConical, group: 'practice' },
  challenge: { label: 'Challenge', icon: Trophy, group: 'practice' },
  quiz: { label: 'Quiz', icon: CircleHelp, group: 'check' },
  flashcards: { label: 'Flashcards', icon: Layers, group: 'check' },
  checklist: { label: 'Checklist', icon: ListChecks, group: 'check' },
};

const GROUPS: { id: Group; title: string }[] = [
  { id: 'read', title: 'Read' },
  { id: 'practice', title: 'Practice' },
  { id: 'check', title: 'Check yourself' },
];

export function ResourceLink({
  resource,
  onOpen,
}: {
  resource: ResolvedResource;
  onOpen?: (resource: ResolvedResource) => void;
}) {
  const type = RESOURCE_TYPES[resource.type];
  const Icon = type.icon;
  const external = resource.type === 'external';
  const meta =
    resource.type === 'simulator'
      ? resource.meta
      : [type.label, resource.meta].filter(Boolean).join(', ');
  return (
    <a
      href={resource.href}
      onClick={onOpen ? () => onOpen(resource) : undefined}
      {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
      className="group flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/50 hover:bg-muted/40"
    >
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug text-foreground">
          {resource.title}
          {external && <span className="sr-only"> (opens in a new tab)</span>}
        </span>
        {meta && (
          <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{meta}</span>
        )}
      </span>
    </a>
  );
}

export function ResourceGroups({
  resources,
  onOpen,
  idPrefix,
}: {
  resources: ResolvedResource[];
  onOpen?: (resource: ResolvedResource) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-5">
      {GROUPS.map((group) => {
        const items = resources.filter((r) => RESOURCE_TYPES[r.type].group === group.id);
        if (items.length === 0) return null;
        const headingId = `${idPrefix}-${group.id}`;
        return (
          <section key={group.id} aria-labelledby={headingId}>
            <h3 id={headingId} className="mb-2 font-mono text-xs text-muted-foreground">
              {`// ${group.title.toLowerCase()}`}
            </h3>
            <ul className="grid gap-2">
              {items.map((resource) => (
                <li key={resource.href}>
                  <ResourceLink resource={resource} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
