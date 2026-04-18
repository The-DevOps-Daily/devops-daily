import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { HeroActivity } from '@/components/hero-activity';
import { getAllPosts } from '@/lib/posts';
import { getAllGuides } from '@/lib/guides';
import { getActiveGames } from '@/lib/games';
import { getAllQuizzes } from '@/lib/quiz-loader';
import { getAllExercises } from '@/lib/exercises';
import { getAllChecklists } from '@/lib/checklists';

export async function Hero() {
  const [posts, guides, games, quizzes, exercises, checklists] = await Promise.all([
    getAllPosts(),
    getAllGuides(),
    getActiveGames(),
    getAllQuizzes(),
    getAllExercises(),
    getAllChecklists(),
  ]);

  const latestPost = posts[0];
  const totalContent =
    posts.length +
    guides.length +
    games.length +
    quizzes.length +
    exercises.length +
    checklists.length;

  return (
    <div className="pb-8">
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-start pt-8 sm:pt-12 relative z-10">
      <div className="lg:col-span-7 max-w-3xl">
        {/* Latest post link */}
        {latestPost && (
          <Link
            href={`/posts/${latestPost.slug}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 group"
          >
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              New
            </span>
            <span className="truncate max-w-[300px] sm:max-w-none">{latestPost.title}</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        )}

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
          Learn DevOps by{' '}
          <span className="text-primary relative inline-block">
            doing
            <svg
              className="absolute -bottom-2 left-0 w-full h-3 text-primary/40"
              viewBox="0 0 120 12"
              preserveAspectRatio="none"
            >
              <path
                d="M2 9 Q15 2 30 8 Q45 1 60 7 Q75 2 90 9 Q105 4 118 7"
                stroke="currentColor"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </span>
          ,<br />
          not just reading.
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed">
          <span className="font-mono tabular-nums text-foreground">{totalContent}+</span>{' '}
          simulators, quizzes, and hands-on exercises for engineers who prefer a terminal over a slide deck.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-wrap items-center gap-3 mt-8">
          <Button asChild size="lg">
            <Link href="/games" className="group">
              Try a Simulator
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/exercises">Start an Exercise</Link>
          </Button>
        </div>

        {/* Social proof */}
        <p className="mt-4 text-sm text-muted-foreground">
          Join <span className="font-mono tabular-nums">5,000+</span> DevOps engineers learning every week
        </p>
      </div>

      {/* Right column — recent activity terminal */}
      <div className="lg:col-span-5 w-full lg:pt-4">
        <HeroActivity />
      </div>
      </div>

      {/* Terminal-style stats block */}
      <div className="mt-10 max-w-2xl relative z-10">
        <div className="rounded-md border border-border/80 bg-card overflow-hidden font-mono text-sm">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b border-border/80">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
              <div className="w-3 h-3 rounded-full bg-green-400/70" />
            </div>
            <span className="text-xs text-muted-foreground ml-2">devops-daily --stats</span>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-green-500">$</span>
              <span className="text-muted-foreground">cat content-overview.txt</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-y-2 gap-x-4 pl-4 py-1">
              <Link
                href="/games"
                className="group hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5 transition-colors"
              >
                <span className="text-primary font-semibold tabular-nums">{games.length}</span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                  {' '}
                  simulators
                </span>
              </Link>
              <Link
                href="/quizzes"
                className="group hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5 transition-colors"
              >
                <span className="text-primary font-semibold tabular-nums">{quizzes.length}</span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                  {' '}
                  quizzes
                </span>
              </Link>
              <Link
                href="/exercises"
                className="group hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5 transition-colors"
              >
                <span className="text-primary font-semibold tabular-nums">{exercises.length}</span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                  {' '}
                  exercises
                </span>
              </Link>
              <Link
                href="/checklists"
                className="group hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5 transition-colors"
              >
                <span className="text-primary font-semibold tabular-nums">{checklists.length}</span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                  {' '}
                  checklists
                </span>
              </Link>
              <Link
                href="/posts"
                className="group hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5 transition-colors"
              >
                <span className="text-primary font-semibold tabular-nums">{posts.length}</span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                  {' '}
                  articles
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground/50">
              <span className="text-green-500/70">$</span>
              <span className="inline-block w-[0.6em] h-[1em] align-middle bg-foreground/60 animate-cursor-blink" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
