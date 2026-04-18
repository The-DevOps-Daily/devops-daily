import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';
import { getAllGuides } from '@/lib/guides';
import { getActiveGames } from '@/lib/games';
import { getAllExercises } from '@/lib/exercises';

interface ActivityItem {
  kind: 'post' | 'guide' | 'sim' | 'exercise';
  title: string;
  href: string;
  date: Date;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
}

const KIND_LABEL: Record<ActivityItem['kind'], string> = {
  post: 'post ',
  guide: 'guide',
  sim: 'sim  ',
  exercise: 'ex   ',
};

export async function HeroActivity() {
  const [posts, guides, games, exercises] = await Promise.all([
    getAllPosts(),
    getAllGuides(),
    getActiveGames(),
    getAllExercises(),
  ]);

  const items: ActivityItem[] = [];

  for (const post of posts.slice(0, 6)) {
    const dateStr = post.date ?? post.publishedAt;
    if (dateStr) {
      items.push({
        kind: 'post',
        title: post.title,
        href: `/posts/${post.slug}`,
        date: new Date(dateStr),
      });
    }
  }
  for (const guide of guides.slice(0, 4)) {
    if (guide.publishedAt) {
      items.push({
        kind: 'guide',
        title: guide.title,
        href: `/guides/${guide.slug}`,
        date: new Date(guide.publishedAt),
      });
    }
  }
  for (const game of games.slice(0, 4)) {
    if (game.createdAt) {
      items.push({
        kind: 'sim',
        title: game.title,
        href: game.href,
        date: new Date(game.createdAt),
      });
    }
  }
  for (const exercise of exercises.slice(0, 4)) {
    const ex = exercise as { createdAt?: string; publishedAt?: string };
    const dateStr = ex.createdAt ?? ex.publishedAt;
    if (dateStr) {
      items.push({
        kind: 'exercise',
        title: exercise.title,
        href: `/exercises/${exercise.id}`,
        date: new Date(dateStr),
      });
    }
  }

  const recent = items
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

  if (recent.length === 0) return null;

  return (
    <div className="rounded-md border border-border/80 bg-card overflow-hidden font-mono text-sm">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b border-border/80">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
          <div className="w-3 h-3 rounded-full bg-green-400/70" />
        </div>
        <span className="text-xs text-muted-foreground ml-2">devops-daily --recent</span>
      </div>
      <div className="px-4 py-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-green-500">$</span>
          <span className="text-muted-foreground">tail -f content.log</span>
        </div>
        <ul className="pl-4 space-y-1.5 text-xs">
          {recent.map((item) => (
            <li key={`${item.kind}-${item.href}`} className="flex items-baseline gap-2">
              <span className="text-muted-foreground/70 tabular-nums w-8 shrink-0 text-right">
                {timeAgo(item.date)}
              </span>
              <span className="text-primary/90 shrink-0">{KIND_LABEL[item.kind]}</span>
              <Link
                href={item.href}
                className="text-foreground truncate hover:text-primary transition-colors"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 text-muted-foreground/50 pt-1">
          <span className="text-green-500/70">$</span>
          <span className="inline-block w-[0.6em] h-[1em] align-middle bg-foreground/60 animate-cursor-blink" />
        </div>
      </div>
    </div>
  );
}
