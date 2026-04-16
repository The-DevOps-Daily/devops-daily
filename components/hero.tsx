import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronRight, Terminal, GitBranch, Cloud, Cpu, Server } from 'lucide-react';
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
  const totalContent = posts.length + guides.length + games.length + quizzes.length + exercises.length + checklists.length;

  return (
    <div className="pb-8">

      {/* Floating tech icons - right side only */}
      <div className="absolute inset-0 pointer-events-none hidden md:block">
        <div className="relative h-full mx-auto max-w-7xl">
          <Terminal className="absolute w-7 h-7 top-16 right-8 text-primary/[0.12] animate-float" />
          <GitBranch className="absolute w-6 h-6 top-40 right-28 text-primary/[0.08] animate-float animation-delay-2000" />
          <Cloud className="absolute w-8 h-8 bottom-32 right-12 text-primary/[0.08] animate-float animation-delay-4000" />
          <Cpu className="absolute w-6 h-6 bottom-16 right-36 text-primary/[0.06] animate-float animation-delay-3000" />
          <Server className="absolute w-7 h-7 top-28 right-52 text-primary/[0.06] animate-float animation-delay-1000" />
        </div>
      </div>

      {/* Decorative arcs - right side, bleeds off edge */}
      <div className="absolute -right-10 top-1/2 -translate-y-1/2 hidden lg:block pointer-events-none">
        <svg className="w-96 h-96 opacity-[0.03]" viewBox="0 0 400 400" fill="none">
          <circle cx="400" cy="200" r="80" stroke="currentColor" strokeWidth="1" className="text-primary" />
          <circle cx="400" cy="200" r="130" stroke="currentColor" strokeWidth="0.8" className="text-primary" />
          <circle cx="400" cy="200" r="180" stroke="currentColor" strokeWidth="0.5" className="text-primary" strokeDasharray="4 8" />
        </svg>
      </div>

      <div className="max-w-3xl pt-8 sm:pt-12 relative z-10">
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
            <svg className="absolute -bottom-2 left-0 w-full h-3 text-primary/40" viewBox="0 0 120 12" preserveAspectRatio="none">
              <path d="M2 9 Q15 2 30 8 Q45 1 60 7 Q75 2 90 9 Q105 4 118 7" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </svg>
          </span>,
          <br />
          not just reading.
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed">
          Interactive simulators, quizzes, flashcards, and hands-on exercises.
          {totalContent}+ pieces of free content built for engineers who prefer a terminal over a slide deck.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-wrap items-center gap-3 mt-8">
          <Button asChild size="lg" className="shadow-md shadow-primary/10">
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
          Join 5,000+ DevOps engineers learning every week
        </p>
      </div>

      {/* Terminal-style stats block */}
      <div className="mt-12 max-w-2xl relative z-10">
        <div className="rounded-lg border border-border/80 bg-card overflow-hidden font-mono text-sm shadow-sm">
          {/* Terminal header */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b border-border/80">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
              <div className="w-3 h-3 rounded-full bg-green-400/70" />
            </div>
            <span className="text-xs text-muted-foreground ml-2">devops-daily --stats</span>
          </div>
          {/* Terminal body */}
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-green-500">$</span>
              <span className="text-muted-foreground">cat content-overview.txt</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-y-2 gap-x-4 pl-4 py-1">
              <Link href="/games" className="group hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5 transition-colors">
                <span className="text-primary font-semibold">{games.length}</span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors"> simulators</span>
              </Link>
              <Link href="/quizzes" className="group hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5 transition-colors">
                <span className="text-primary font-semibold">{quizzes.length}</span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors"> quizzes</span>
              </Link>
              <Link href="/exercises" className="group hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5 transition-colors">
                <span className="text-primary font-semibold">{exercises.length}</span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors"> exercises</span>
              </Link>
              <Link href="/checklists" className="group hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5 transition-colors">
                <span className="text-primary font-semibold">{checklists.length}</span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors"> checklists</span>
              </Link>
              <Link href="/posts" className="group hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5 transition-colors">
                <span className="text-primary font-semibold">{posts.length}</span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors"> articles</span>
              </Link>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground/50">
              <span className="text-green-500/70">$</span>
              <span className="animate-pulse">_</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
