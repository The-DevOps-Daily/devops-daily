import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { SectionSeparator } from '@/components/section-separator';
import { GameSponsors } from '@/components/games/game-sponsors';
import { RoadmapProvider } from '@/components/roadmap/roadmap-provider';
import { RoadmapMap } from '@/components/roadmap/roadmap-map';
import {
  RoadmapContinueButton,
  RoadmapStageNav,
  RoadmapStatusCard,
} from '@/components/roadmap/roadmap-hero';
import { KindMarker, StatusIcon } from '@/components/roadmap/roadmap-marks';
import { CareerNotes } from '@/components/roadmap/career-notes';
import { getRoadmapTotals } from '@/lib/roadmap-data';
import { resolveRoadmap } from '@/lib/roadmap-resources';
import { sponsors } from '@/lib/sponsors';

const ISSUE_URL = `https://github.com/The-DevOps-Daily/devops-daily/issues/new?title=${encodeURIComponent(
  'Issue with the DevOps roadmap'
)}&body=${encodeURIComponent('Page: https://devops-daily.com/roadmap\n\nWhat is wrong:\n')}`;

export default async function RoadmapPage() {
  const { stages, careerReading } = await resolveRoadmap();
  const totals = getRoadmapTotals();
  const linked = new Set(
    stages
      .flatMap((s) => s.topics.flatMap((t) => t.resources))
      .filter((r) => r.type !== 'external')
      .map((r) => r.href)
  ).size;
  const facts = [
    [totals.stages, 'stages'],
    [totals.topics, 'topics'],
    [totals.core, 'core topics'],
    [`${totals.minWeeks}-${totals.maxWeeks}`, 'weeks'],
    [totals.projects, 'practice projects'],
    [linked, 'links to our material'],
  ] as const;

  return (
    <div className="min-h-screen">
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Roadmaps', url: '/roadmaps' },
          { name: 'DevOps Roadmap', url: '/roadmap' },
        ]}
      />
      <RoadmapProvider stages={stages}>
        <section className="relative overflow-hidden border-b border-border/50">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle,currentColor_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)] dark:opacity-[0.1]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-br from-primary/[0.06] via-transparent to-transparent"
          />
          <div className="container relative mx-auto px-4 pb-10 pt-8 sm:pt-10">
            <Breadcrumb
              items={[
                { label: 'Roadmaps', href: '/roadmaps' },
                { label: 'DevOps Roadmap', isCurrent: true },
              ]}
            />
            <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-14">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{'// roadmap'}</p>
                <h1 className="mt-2 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                  DevOps Roadmap
                </h1>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                  The path has {totals.stages} stages, from your first Linux command to running
                  systems in production. Select a topic on the map to see what it covers and the
                  guides, simulators, labs and quizzes we have for it. Mark topics as you go. Your
                  progress stays in this browser.
                </p>
                <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-xs text-muted-foreground">
                  {facts.map(([value, label]) => (
                    <li key={label}>
                      <span className="font-semibold text-foreground">{value}</span> {label}
                    </li>
                  ))}
                </ul>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <RoadmapContinueButton />
                  <Link
                    href="/roadmap/junior"
                    className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-muted/40"
                  >
                    <GraduationCap className="h-4 w-4" aria-hidden="true" />
                    New to DevOps? Junior roadmap
                  </Link>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Security focused? Try the{' '}
                  <Link
                    href="/roadmap/devsecops"
                    className="font-medium text-foreground underline decoration-border underline-offset-4 hover:text-primary hover:decoration-primary"
                  >
                    DevSecOps roadmap
                  </Link>
                  .
                </p>
              </div>
              <RoadmapStatusCard />
            </div>
            <div className="mt-10">
              <RoadmapStageNav />
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4">
          {sponsors.length > 0 && <GameSponsors placement="inline" className="mb-0 mt-8" />}

          <SectionSeparator command="roadmap map --all" />
          <div id="roadmap" className="scroll-mt-24">
            <div className="mb-10 flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{'// map'}</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  The path, stage by stage
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Select a topic for what it covers and our material for it. Arrow keys move between
                  topics, Esc closes the panel.
                </p>
              </div>
              <ul
                aria-label="Legend"
                className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground"
              >
                <li className="inline-flex items-center gap-1.5">
                  <KindMarker kind="core" /> core
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <KindMarker kind="optional" /> optional
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <StatusIcon status="done" /> done
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <StatusIcon status="progress" /> in progress
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <StatusIcon status="skip" /> skipped
                </li>
              </ul>
            </div>
            <RoadmapMap />
          </div>

          <SectionSeparator command="cat career-notes.md" className="mt-16" />
          <CareerNotes reading={careerReading} />

          <p className="mx-auto mb-16 mt-14 max-w-2xl border-t border-border pt-6 text-center text-sm text-muted-foreground">
            Found a wrong link or a missing topic?{' '}
            <a
              href={ISSUE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline decoration-border underline-offset-4 hover:text-primary hover:decoration-primary"
            >
              Open an issue on GitHub
            </a>
            .
          </p>
        </div>
      </RoadmapProvider>
    </div>
  );
}
