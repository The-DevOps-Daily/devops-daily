import {
  Activity,
  BookOpen,
  Boxes,
  Cloud,
  Container,
  Database,
  Flame,
  FolderTree,
  Gauge,
  GitBranch,
  GitFork,
  GitMerge,
  Globe,
  Layers,
  Network,
  Package,
  Server,
  ShieldCheck,
  Siren,
  Snowflake,
  Tags,
  Target,
  Terminal,
  Vault,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';

// Icons referenced by the `icon` field in content/flashcards/*.json.
// Add a name here when a new set uses one; unknown names fall back to BookOpen.
const flashcardIcons: Record<string, LucideIcon> = {
  Activity,
  Boxes,
  Cloud,
  Container,
  Database,
  Flame,
  FolderTree,
  Gauge,
  GitBranch,
  GitFork,
  GitMerge,
  Globe,
  Layers,
  Network,
  Package,
  Server,
  ShieldCheck,
  Siren,
  Snowflake,
  Tags,
  Target,
  Terminal,
  Vault,
  Workflow,
  Zap,
};

export function FlashcardIcon({ name, className }: { name: string; className?: string }) {
  const Icon = flashcardIcons[name] ?? BookOpen;
  return <Icon className={className} />;
}
