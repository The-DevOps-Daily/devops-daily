import type { CSSProperties } from 'react';
import {
  Activity,
  Anchor,
  ArrowLeftRight,
  BarChart3,
  Bird,
  Blocks,
  Box,
  Boxes,
  ChefHat,
  Circle,
  Cloud,
  Code,
  Cog,
  Container,
  Cylinder,
  Database,
  Dog,
  DollarSign,
  Drama,
  Droplet,
  FileCode,
  FileSearch,
  Flame,
  Gauge,
  GitBranch,
  GitFork,
  Globe,
  Hammer,
  HardDrive,
  Hexagon,
  Inbox,
  KeyRound,
  Layers,
  LayoutGrid,
  Leaf,
  Link,
  Lock,
  MemoryStick,
  Network,
  Package,
  Plug,
  Radar,
  RefreshCw,
  Rocket,
  Route,
  ScanSearch,
  Search,
  Send,
  Server,
  Shield,
  Ship,
  Snowflake,
  Table,
  Terminal,
  TestTube,
  Triangle,
  Workflow,
  Zap,
} from 'lucide-react';
import { Github } from '@/components/icons/social-icons';
import { readableOn } from '@/lib/color-contrast';

/**
 * A tool's brand color as two CSS variables, each adjusted to read on its
 * theme: --tool on the light background, --tool-dark on the dark one. Brand
 * colors such as GitHub's near-black disappear on a dark page without this.
 */
export function toolVars(color: string): CSSProperties {
  // A near-gray brand color (GitHub's #181717) reads as a dull gray once
  // lightened, so it follows the page's own text color instead.
  if (isNeutral(color)) return { '--tool': '#18181b', '--tool-dark': '#f4f4f5' } as CSSProperties;
  // 5.5:1 rather than 4.5:1 on the page background: the text also sits on
  // tints of the tool color and on green and red row highlights, which take
  // up to 15% of the contrast away.
  return {
    '--tool': readableOn(color, '#ffffff', 5.5),
    '--tool-dark': readableOn(color, '#09090b', 5.5),
  } as CSSProperties;
}

function isNeutral(hex: string): boolean {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return false;
  const [r, g, b] = m.slice(1).map((v) => parseInt(v, 16));
  return Math.max(r, g, b) - Math.min(r, g, b) < 24;
}

/** Classes that use the variables from toolVars(). */
export const toolText = 'text-[color:var(--tool)] dark:text-[color:var(--tool-dark)]';
export const toolBg = 'bg-[var(--tool)] text-white dark:bg-[var(--tool-dark)] dark:text-zinc-950';
export const toolBorderLeft =
  'border-l-4 border-l-[color:var(--tool)] dark:border-l-[color:var(--tool-dark)]';
export const toolTint =
  'bg-[color-mix(in_srgb,var(--tool)_10%,transparent)] dark:bg-[color-mix(in_srgb,var(--tool-dark)_14%,transparent)]';

const ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  Activity,
  Anchor,
  ArrowLeftRight,
  BarChart3,
  Bird,
  Blocks,
  Box,
  Boxes,
  ChefHat,
  Circle,
  Cloud,
  Code,
  Cog,
  Container,
  Cylinder,
  Database,
  Dog,
  DollarSign,
  Drama,
  Droplet,
  FileCode,
  FileSearch,
  Flame,
  Gauge,
  GitBranch,
  GitFork,
  Github,
  Globe,
  Hammer,
  HardDrive,
  Hexagon,
  Inbox,
  KeyRound,
  Layers,
  LayoutGrid,
  Leaf,
  Link,
  Lock,
  MemoryStick,
  Network,
  Package,
  Plug,
  Radar,
  RefreshCw,
  Rocket,
  Route,
  ScanSearch,
  Search,
  Send,
  Server,
  Shield,
  Ship,
  Snowflake,
  Table,
  Terminal,
  TestTube,
  Triangle,
  Workflow,
  Zap,
};

/** The tool's icon (the `icon` field of the comparison JSON) on a tinted tile. */
export function ToolIcon({
  name,
  color,
  size = 'md',
}: {
  name: string;
  color: string;
  size?: 'sm' | 'md';
}) {
  const Icon = ICONS[name] ?? Box;
  const tile = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  return (
    <span
      style={toolVars(color)}
      className={`inline-flex ${tile} shrink-0 items-center justify-center rounded-md ${toolTint} ${toolText}`}
      aria-hidden="true"
    >
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={1.75} />
    </span>
  );
}
