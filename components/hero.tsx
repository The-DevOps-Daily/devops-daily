import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Terminal, GitBranch, Cloud, Cpu, Sparkles } from 'lucide-react';
import { getAllPosts } from '@/lib/posts';
import { getAllGuides } from '@/lib/guides';
import { getActiveGames } from '@/lib/games';
import { getAllQuizzes } from '@/lib/quiz-loader';

export async function Hero() {
  // Fetch counts dynamically
  const [posts, guides, games, quizzes] = await Promise.all([
    getAllPosts(),
    getAllGuides(),
    getActiveGames(),
    getAllQuizzes(),
  ]);

  const postsCount = posts.length;
  const guidesCount = guides.length;
  const gamesCount = games.length;
  const quizzesCount = quizzes.length;

  return (
    <div className="relative overflow-hidden bg-background">
      {/* Background decorations */}
      <div className="absolute inset-0 -z-10">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(90deg, #000 1px, transparent 1px),
              linear-gradient(#000 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />

        {/* Gradient orbs */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full filter blur-[100px] animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary/10 rounded-full filter blur-[120px]" />
      </div>

      {/* Floating tech icons - Fixed positioning and z-index */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="relative h-full mx-auto max-w-7xl">
          <Terminal className="absolute w-8 h-8 top-20 left-10 text-primary/20 animate-float" />
          <GitBranch className="absolute w-8 h-8 top-1/3 right-10 lg:right-20 text-primary/15 animate-float animation-delay-2000" />
          <Cloud className="absolute w-8 h-8 bottom-1/3 left-10 lg:left-32 text-primary/10 animate-float animation-delay-4000" />
          <Cpu className="absolute w-8 h-8 bottom-20 right-10 lg:right-40 text-primary/15 animate-float animation-delay-3000" />
        </div>
      </div>

      <div className="relative z-10 max-w-4xl px-4 py-10 mx-auto sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Announcement badge */}
          <div className="flex justify-center mb-8">
            <Badge variant="outline" className="px-4 py-1.5 text-sm border-primary/50 bg-primary/5">
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              New guides added weekly
            </Badge>
          </div>

          <div className="pb-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-7xl">
              <span className="block mb-2 text-foreground">DevOps Daily</span>
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-primary via-blue-500 to-cyan-500 animate-gradient leading-[1.2]">
                Real Guides for Real Engineers
              </span>
            </h1>
          </div>

          <p className="max-w-2xl mx-auto mt-8 text-lg leading-8 sm:text-xl text-muted-foreground">
            Practical DevOps tips, tools, and tutorials. No fluff.
          </p>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-6 sm:gap-8 mt-10 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{postsCount}+</div>
              <div className="text-muted-foreground">Articles</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{guidesCount}+</div>
              <div className="text-muted-foreground">Guides</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{gamesCount}+</div>
              <div className="text-muted-foreground">Games</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{quizzesCount}+</div>
              <div className="text-muted-foreground">Quizzes</div>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
            <Button
              asChild
              size="lg"
              className="transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30"
            >
              <Link href="/posts" className="group">
                Browse Latest Posts
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="transition-all border-2 hover:bg-primary/5"
            >
              <Link href="/guides">Explore Guides</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
