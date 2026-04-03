import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { getAllPosts } from '@/lib/posts';
import { getAllGuides } from '@/lib/guides';
import { getActiveGames } from '@/lib/games';
import { getAllQuizzes } from '@/lib/quiz-loader';
import { getAllExercises } from '@/lib/exercises';

export async function Hero() {
  const [posts, guides, games, quizzes, exercises] = await Promise.all([
    getAllPosts(),
    getAllGuides(),
    getActiveGames(),
    getAllQuizzes(),
    getAllExercises(),
  ]);

  const latestPost = posts[0];

  return (
    <div className="relative pb-8">
      {/* Main hero - left aligned, no gradient nonsense */}
      <div className="max-w-3xl pt-6 sm:pt-10">
        {/* Latest post badge */}
        {latestPost && (
          <Link
            href={`/posts/${latestPost.slug}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
          >
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              New
            </span>
            <span className="truncate max-w-[300px] sm:max-w-none">{latestPost.title}</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        )}

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
          Learn DevOps by doing,
          <br />
          not just reading.
        </h1>

        <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
          Hands-on exercises, interactive simulators, and practical guides.
          Built for engineers who prefer a terminal over a slide deck.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-wrap items-center gap-3 mt-8">
          <Button asChild size="lg">
            <Link href="/exercises" className="group">
              Start an Exercise
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/posts">Read the Blog</Link>
          </Button>
        </div>
      </div>

      {/* Terminal-style stats block */}
      <div className="mt-12 max-w-2xl">
        <div className="rounded-lg border bg-card overflow-hidden font-mono text-sm">
          {/* Terminal header */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
              <div className="w-3 h-3 rounded-full bg-green-400/60" />
            </div>
            <span className="text-xs text-muted-foreground ml-2">devops-daily --stats</span>
          </div>
          {/* Terminal body */}
          <div className="px-4 py-3 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-green-500">$</span>
              <span className="text-muted-foreground">content overview</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-4 mt-2 pl-4">
              <Link href="/posts" className="group">
                <span className="text-primary">{posts.length}</span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors"> posts</span>
              </Link>
              <Link href="/guides" className="group">
                <span className="text-primary">{guides.length}</span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors"> guides</span>
              </Link>
              <Link href="/exercises" className="group">
                <span className="text-primary">{exercises.length}</span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors"> exercises</span>
              </Link>
              <Link href="/games" className="group">
                <span className="text-primary">{games.length}</span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors"> simulators</span>
              </Link>
            </div>
            <div className="flex items-center gap-2 mt-1 text-muted-foreground/60">
              <span className="text-green-500">$</span>
              <span className="animate-pulse">_</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
