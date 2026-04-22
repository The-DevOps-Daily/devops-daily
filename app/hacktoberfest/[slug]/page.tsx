import { PostContent } from '@/components/post-content';
import { getAllHacktoberfestDays, getHacktoberfestDay } from '@/lib/hacktoberfest';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, ChevronLeft, ChevronRight, Github, ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const dynamicParams = false;

export async function generateStaticParams() {
  const days = await getAllHacktoberfestDays();
  return days.map((day) => ({ slug: day.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const day = await getHacktoberfestDay(slug);

  if (!day) return {};

  return {
    title: { absolute: `${day.title} - Hacktoberfest 2026` },
    description: day.excerpt,
    alternates: {
      canonical: `/hacktoberfest/${slug}`,
    },
    openGraph: {
      type: 'article',
      title: day.title,
      description: day.excerpt,
      url: `/hacktoberfest/${slug}`,
      images: [{ url: '/images/hacktoberfest/hacktoberfest-og.png', width: 1200, height: 630 }],
    },
  };
}

export default async function HacktoberfestDayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const day = await getHacktoberfestDay(slug);

  if (!day) notFound();

  const allDays = await getAllHacktoberfestDays();
  const currentIndex = allDays.findIndex((d) => d.slug === slug);
  const prevDay = currentIndex > 0 ? allDays[currentIndex - 1] : null;
  const nextDay = currentIndex < allDays.length - 1 ? allDays[currentIndex + 1] : null;

  const breadcrumbItems = [
    { label: 'Hacktoberfest', href: '/hacktoberfest' },
    { label: `Day ${day.day}`, href: `/hacktoberfest/${slug}`, isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Hacktoberfest 2026', url: '/hacktoberfest' },
    { name: `Day ${day.day}`, url: `/hacktoberfest/${slug}` },
  ];

  const difficultyColor =
    day.difficulty === 'Advanced'
      ? 'bg-red-500/10 text-red-600 border-red-500/20'
      : day.difficulty === 'Intermediate'
        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
        : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <div className="container px-4 py-8 mx-auto max-w-4xl">
        <Breadcrumb items={breadcrumbItems} />

        {/* Day header */}
        <div className="mt-8 mb-10">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge variant="outline" className="font-mono">
              Day {day.day}{day.day === 8 ? ' (Bonus)' : ''}
            </Badge>
            <Badge variant="outline" className={difficultyColor}>
              {day.difficulty}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {day.time}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {day.category}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            {day.title}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {day.excerpt}
          </p>
        </div>

        {/* Content */}
        <article className="prose dark:prose-invert max-w-none">
          <PostContent content={day.content} />
        </article>

        {/* GitHub CTA */}
        <div className="mt-12 p-6 rounded-lg border bg-card text-center">
          <h3 className="font-semibold mb-2">Ready to start?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Fork the repo and follow the steps above.
          </p>
          <Button asChild>
            <a
              href="https://github.com/The-DevOps-Daily/devops-daily"
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <Github className="w-4 h-4 mr-2" />
              Open on GitHub
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
        </div>

        {/* Social share */}
        <div className="mt-8 p-4 rounded-lg border bg-muted/30 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Completed Day {day.day}? Share it!
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href={`https://x.com/intent/tweet?text=${encodeURIComponent(`Just completed Day ${day.day} of the @thedevopsdaily Hacktoberfest challenge! 🎃\n\ndevops-daily.com/hacktoberfest\n\n#Hacktoberfest #DevOpsDaily`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-card hover:border-primary/30 transition-colors text-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Share on X
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/hacktoberfest')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-card hover:border-primary/30 transition-colors text-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Share on LinkedIn
            </a>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-10 flex items-center justify-between">
          {prevDay ? (
            <Link
              href={`/hacktoberfest/${prevDay.slug}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Day {prevDay.day}
            </Link>
          ) : (
            <div />
          )}
          <Link
            href="/hacktoberfest"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            All Challenges
          </Link>
          {nextDay ? (
            <Link
              href={`/hacktoberfest/${nextDay.slug}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Day {nextDay.day}
              <ChevronRight className="w-4 h-4" />
            </Link>
          ) : (
            <div />
          )}
        </div>
      </div>
    </>
  );
}
