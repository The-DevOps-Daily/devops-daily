import { CircleCheck, CircleDot, CircleX, Info, Lightbulb, type LucideIcon } from 'lucide-react';

/**
 * One status map for every simulator. Each tone pairs a surface, a text
 * colour, an icon and a word, so a state never relies on colour alone. The
 * colours are the feedback tokens in app/globals.css (correct, partial,
 * wrong, info, hint).
 */
export type SimTone = 'success' | 'warning' | 'danger' | 'info' | 'hint';

export interface SimToneStyle {
  /** Border and tint for a callout or a choice card after a pick. */
  surface: string;
  /** Status text that passes AA on the surface, in light and dark. */
  text: string;
  /** Icon colour when the icon sits on a neutral surface. */
  iconClass: string;
  /** Solid fill for bars, dots and node borders. */
  fill: string;
  /** Border only, for pills and outlines. */
  border: string;
  icon: LucideIcon;
  /** The default word shown with the icon. */
  label: string;
}

export const SIM_TONE: Record<SimTone, SimToneStyle> = {
  success: {
    surface: 'border-correct/40 bg-correct/10',
    text: 'text-correct-foreground',
    iconClass: 'text-correct-foreground',
    fill: 'bg-correct',
    border: 'border-correct/50',
    icon: CircleCheck,
    label: 'Correct',
  },
  warning: {
    surface: 'border-partial/40 bg-partial/10',
    text: 'text-partial-foreground',
    iconClass: 'text-partial-foreground',
    fill: 'bg-partial',
    border: 'border-partial/50',
    icon: CircleDot,
    label: 'Works, with a catch',
  },
  danger: {
    surface: 'border-wrong/40 bg-wrong/10',
    text: 'text-wrong-foreground',
    iconClass: 'text-wrong-foreground',
    fill: 'bg-wrong',
    border: 'border-wrong/50',
    icon: CircleX,
    label: 'Not quite',
  },
  info: {
    surface: 'border-info/40 bg-info/10',
    text: 'text-info-foreground',
    iconClass: 'text-info-foreground',
    fill: 'bg-info',
    border: 'border-info/50',
    icon: Info,
    label: 'Note',
  },
  hint: {
    surface: 'border-hint/30 bg-hint/5',
    text: 'text-hint-foreground',
    iconClass: 'text-hint',
    fill: 'bg-hint',
    border: 'border-hint/40',
    icon: Lightbulb,
    label: 'Hint',
  },
};

/**
 * Diagram categories (clients, services, packets): at most four hues plus a
 * neutral, always with a text label next to them. `primary` is the thing the
 * player acts on.
 */
export type SimCategory = 'primary' | 'sky' | 'violet' | 'emerald' | 'neutral';

export const SIM_CATEGORY: Record<SimCategory, { fill: string; border: string; svg: string }> = {
  primary: {
    fill: 'bg-primary/15',
    border: 'border-primary/40',
    svg: 'fill-primary/20 stroke-primary',
  },
  sky: {
    fill: 'bg-sky-500/15',
    border: 'border-sky-500/40',
    svg: 'fill-sky-500/20 stroke-sky-500',
  },
  violet: {
    fill: 'bg-violet-500/15',
    border: 'border-violet-500/40',
    svg: 'fill-violet-500/20 stroke-violet-500',
  },
  emerald: {
    fill: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    svg: 'fill-emerald-500/20 stroke-emerald-500',
  },
  neutral: {
    fill: 'bg-zinc-500/15',
    border: 'border-zinc-500/40',
    svg: 'fill-zinc-500/20 stroke-zinc-500',
  },
};
