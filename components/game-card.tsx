import Link from 'next/link';
import {
  Activity,
  ActivitySquare,
  ArrowRight,
  Binary,
  Boxes,
  Braces,
  Bug,
  Clock,
  Cloud,
  Database,
  Dices,
  FileCode,
  FileJson,
  GitBranch,
  GitMerge,
  Globe,
  Heart,
  Laugh,
  LineChart,
  Lock,
  type LucideIcon,
  Mail,
  MailWarning,
  MessageSquare,
  Network,
  Puzzle,
  Rocket,
  Server,
  Shield,
  Siren,
  Sparkles,
  Table,
  Terminal,
  Timer,
  TrendingUp,
  Trophy,
  Webhook,
  Workflow,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { Game } from '@/lib/games';

// Registry entries name their icon as a string (lib/games.ts).
const iconMap: Record<string, LucideIcon> = {
  Activity,
  ActivitySquare,
  Binary,
  Boxes,
  Braces,
  Bug,
  Clock,
  Cloud,
  Database,
  Dices,
  FileCode,
  FileJson,
  GitBranch,
  GitMerge,
  Globe,
  Heart,
  Laugh,
  LineChart,
  Lock,
  Mail,
  MailWarning,
  MessageSquare,
  Network,
  Puzzle,
  Rocket,
  Server,
  Shield,
  Siren,
  Sparkles,
  Table,
  Terminal,
  TrendingUp,
  Trophy,
  Webhook,
  Workflow,
  Zap,
};

/** The fields a card needs; safe to pass from a server page to a client list. */
export type CardGame = Pick<
  Game,
  | 'id'
  | 'title'
  | 'description'
  | 'iconName'
  | 'badgeText'
  | 'color'
  | 'href'
  | 'tags'
  | 'featured'
  | 'type'
  | 'isComingSoon'
>;

export function toCardGame(game: Game): CardGame {
  const { id, title, description, iconName, badgeText, color, href, tags, featured, type } = game;
  return {
    id,
    title,
    description,
    iconName,
    badgeText,
    color,
    href,
    tags,
    featured,
    type,
    isComingSoon: game.isComingSoon,
  };
}

// Nearly every entry has these, so they say nothing on a card.
const HIDDEN_TAGS = new Set(['educational', 'interactive', 'game']);

export function GameCard({ game, tagLimit = 4 }: { game: CardGame; tagLimit?: number }) {
  const Icon = iconMap[game.iconName] || Activity;
  const tags = game.tags.filter((tag) => !HIDDEN_TAGS.has(tag.toLowerCase())).slice(0, tagLimit);

  const card = (
    <Card
      className={`h-full transition-colors overflow-hidden relative border-border ${
        game.isComingSoon ? 'opacity-60 grayscale' : 'hover:border-primary/40 hover:bg-muted/30'
      }`}
    >
      <div className={`h-2 w-full bg-linear-to-r ${game.color}`} />

      {game.isComingSoon && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <div className="text-center">
            <Timer className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Coming Soon</p>
          </div>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-xl bg-linear-to-br ${game.color} text-white shadow-lg`}>
            <Icon className="h-6 w-6" />
          </div>

          <div className="flex gap-1 flex-wrap justify-end">
            {game.badgeText && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                {game.badgeText === 'New' && <Sparkles className="h-3 w-3" />}
                {game.badgeText === 'Popular' && <Zap className="h-3 w-3" />}
                {game.badgeText}
              </Badge>
            )}
            {game.featured && (
              <Badge
                variant="default"
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-primary-foreground text-xs flex items-center gap-1"
              >
                <Activity className="h-3 w-3" />
                Featured
              </Badge>
            )}
          </div>
        </div>

        <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">
          {game.title}
        </CardTitle>
        <CardDescription className="text-sm line-clamp-2">{game.description}</CardDescription>
      </CardHeader>

      <CardFooter className="pt-0 flex-col items-start">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-xs px-2 py-0.5 border-muted-foreground/20 text-muted-foreground"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div
          className={`flex items-center gap-2 text-sm font-medium ${
            game.isComingSoon
              ? 'text-muted-foreground'
              : 'text-primary group-hover:gap-3 transition-all'
          }`}
        >
          {game.isComingSoon ? 'Stay tuned' : game.type === 'game' ? 'Play Now' : 'Start Learning'}
          {!game.isComingSoon && <ArrowRight className="h-4 w-4" />}
        </div>
      </CardFooter>
    </Card>
  );

  if (game.isComingSoon) {
    return (
      <div className="group block" aria-disabled="true">
        {card}
      </div>
    );
  }

  return (
    <Link href={game.href} className="group block h-full">
      {card}
    </Link>
  );
}
