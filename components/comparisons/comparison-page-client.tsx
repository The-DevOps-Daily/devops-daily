'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/breadcrumb';
import { ToolIcon, toolBorderLeft, toolText, toolVars } from './tool-style';
import { SponsorSidebar } from '@/components/sponsor-sidebar';
import { ReportIssue } from '@/components/report-issue';
import { FeatureComparisonTable } from './feature-comparison-table';
import { ToolProsCons } from './tool-pros-cons';
import { DecisionMatrix } from './decision-matrix';
import { UseCasesSection } from './use-cases-section';
import { VerdictSection } from './verdict-section';
import { ComparisonFAQ } from './comparison-faq';
import { RelatedContent } from './related-content';
import {
  Clock,
  Calendar,
  ExternalLink,
  TableProperties,
  ThumbsUp,
  ThumbsDown,
  GitCompare,
  Lightbulb,
  Award,
  HelpCircle,
  Users,
  Link as LinkIcon,
} from 'lucide-react';
import type { Comparison } from '@/lib/comparison-types';

interface ComparisonPageClientProps {
  comparison: Comparison;
  allComparisons: Comparison[];
}

export function ComparisonPageClient({ comparison, allComparisons }: ComparisonPageClientProps) {
  const breadcrumbItems = [
    { label: 'Comparisons', href: '/comparisons' },
    { label: comparison.title, href: `/comparisons/${comparison.slug}`, isCurrent: true },
  ];

  return (
    <div className="container px-4 py-8 mx-auto" data-sponsor-campaign={comparison.sponsorCampaign}>
      <Breadcrumb items={breadcrumbItems} />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        {/* Main Content */}
        <div className="xl:col-span-9">
          {/* Section 1: Header */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge variant="secondary">{comparison.category}</Badge>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {comparison.estimatedReadTime}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                Updated{' '}
                <time dateTime={comparison.updatedDate}>
                  {new Date(comparison.updatedDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              <span style={toolVars(comparison.toolA.color)} className={toolText}>
                {comparison.toolA.name}
              </span>
              <span className="text-muted-foreground mx-3 text-2xl sm:text-3xl lg:text-4xl font-normal">
                vs
              </span>
              <span style={toolVars(comparison.toolB.color)} className={toolText}>
                {comparison.toolB.name}
              </span>
            </h1>

            <p className="text-lg text-muted-foreground mb-4 max-w-3xl">{comparison.description}</p>

            <div className="flex flex-wrap gap-1.5">
              {comparison.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Section 2: Tool Overview Cards */}
          <div className="grid grid-cols-1 gap-4 mb-10 md:grid-cols-2">
            {[comparison.toolA, comparison.toolB].map((tool) => (
              <Card
                key={tool.name}
                className={`overflow-hidden ${toolBorderLeft}`}
                style={toolVars(tool.color)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <ToolIcon name={tool.icon} color={tool.color} />
                    <h3 className={`text-lg font-bold ${toolText}`}>{tool.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{tool.description}</p>
                  <a
                    href={tool.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    Visit website
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>

          <AtAGlance comparison={comparison} />

          {/* Section 3: Introduction */}
          <section className="mb-10">
            <div className="prose prose-sm dark:prose-invert max-w-3xl">
              {comparison.introduction.split('\n\n').map((paragraph, i) => (
                <p key={i} className="text-muted-foreground leading-relaxed mb-4">
                  {paragraph}
                </p>
              ))}
            </div>
            {comparison.relatedLinks && comparison.relatedLinks.length > 0 && (
              <div className="mt-2 rounded-md border bg-card p-4">
                <p className="text-sm font-medium text-foreground mb-2">Related on DevOps Daily</p>
                <ul className="space-y-1 text-sm">
                  {comparison.relatedLinks.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-primary hover:underline">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Section 4: Feature Comparison Table */}
          <section id="feature-comparison" className="mb-10 scroll-mt-24">
            <h2 className="flex items-center gap-2 text-2xl font-bold mb-6">
              <TableProperties className="w-6 h-6 text-primary" />
              Feature Comparison
            </h2>
            <Card>
              <CardContent className="p-4 sm:p-6">
                <FeatureComparisonTable
                  features={comparison.features}
                  toolA={comparison.toolA}
                  toolB={comparison.toolB}
                />
              </CardContent>
            </Card>
          </section>

          {/* Section 5: Pros and Cons */}
          <section id="pros-and-cons" className="mb-10 scroll-mt-24">
            <h2 className="flex items-center gap-2 text-2xl font-bold mb-6">
              <div className="flex items-center gap-1">
                <ThumbsUp className="w-5 h-5 text-green-600" />
                <ThumbsDown className="w-5 h-5 text-red-500" />
              </div>
              Pros and Cons
            </h2>
            <ToolProsCons toolA={comparison.toolA} toolB={comparison.toolB} />
          </section>

          {/* Section 6: Decision Matrix */}
          <section id="decision-matrix" className="mb-10 scroll-mt-24">
            <h2 className="flex items-center gap-2 text-2xl font-bold mb-2">
              <GitCompare className="w-6 h-6 text-primary" />
              Decision Matrix
            </h2>
            <p className="text-sm text-muted-foreground mb-6">Pick this if...</p>
            <DecisionMatrix
              items={comparison.decisionMatrix}
              toolA={comparison.toolA}
              toolB={comparison.toolB}
            />
          </section>

          {/* Section 7: Use Cases */}
          <section id="use-cases" className="mb-10 scroll-mt-24">
            <h2 className="flex items-center gap-2 text-2xl font-bold mb-6">
              <Lightbulb className="w-6 h-6 text-amber-500" />
              Use Cases
            </h2>
            <UseCasesSection
              useCases={comparison.useCases}
              toolA={comparison.toolA}
              toolB={comparison.toolB}
            />
          </section>

          {/* Section 8: Verdict */}
          <section id="verdict" className="mb-10 scroll-mt-24">
            <h2 className="flex items-center gap-2 text-2xl font-bold mb-6">
              <Award className="w-6 h-6 text-primary" />
              Verdict
            </h2>
            <VerdictSection
              verdict={comparison.verdict}
              toolA={comparison.toolA}
              toolB={comparison.toolB}
            />
          </section>

          {/* Section 9: FAQ */}
          <section id="faq" className="mb-10 scroll-mt-24">
            <h2 className="flex items-center gap-2 text-2xl font-bold mb-6">
              <HelpCircle className="w-6 h-6 text-primary" />
              Frequently Asked Questions
            </h2>
            <ComparisonFAQ faqs={comparison.faqs} />
          </section>

          {/* Section 11: Related Content */}
          <section className="mb-10">
            <RelatedContent currentSlug={comparison.slug} comparisons={allComparisons} />
          </section>

          {/* Report Issue */}
          <div className="mt-8">
            <ReportIssue
              title={comparison.title}
              type="comparison"
              slug={comparison.slug}
              variant="compact"
            />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="xl:col-span-3">
          <div className="sticky space-y-6 top-8">
            {/* Table of Contents */}
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-base">On This Page</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <nav className="space-y-1">
                  {[
                    { label: 'Feature Comparison', id: 'feature-comparison' },
                    { label: 'Pros and Cons', id: 'pros-and-cons' },
                    { label: 'Decision Matrix', id: 'decision-matrix' },
                    { label: 'Use Cases', id: 'use-cases' },
                    { label: 'Verdict', id: 'verdict' },
                    { label: 'FAQ', id: 'faq' },
                  ].map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="block px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </CardContent>
            </Card>

            <SponsorSidebar />
          </div>
        </aside>
      </div>
    </div>
  );
}

/** The answer up front: both scores, how many decision points go to each tool, and the recommendation. */
function AtAGlance({ comparison }: { comparison: Comparison }) {
  const { toolA, toolB, verdict, decisionMatrix } = comparison;
  const picks = (rec: 'toolA' | 'toolB') =>
    decisionMatrix.filter((d) => d.recommendation === rec).length;
  const rows = [
    { tool: toolA, score: verdict.toolAScore, wins: picks('toolA') },
    { tool: toolB, score: verdict.toolBScore, wins: picks('toolB') },
  ];
  return (
    <section aria-labelledby="at-a-glance" className="mb-10 rounded-md border bg-card p-5">
      <p className="mb-4 font-mono text-xs text-muted-foreground" id="at-a-glance">
        {'// at a glance'}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map(({ tool, score, wins }) => (
          <div key={tool.name} style={toolVars(tool.color)} className="flex items-center gap-3">
            <ToolIcon name={tool.icon} color={tool.color} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className={`truncate font-semibold ${toolText}`}>{tool.name}</span>
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {score.toFixed(1)} / 5
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[var(--tool)] dark:bg-[var(--tool-dark)]"
                  style={{ width: `${(score / 5) * 100}%` }}
                />
              </div>
              {decisionMatrix.length > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                  Best pick in {wins} of {decisionMatrix.length} situations
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-start gap-2 border-t pt-4 text-sm leading-relaxed">
        <Award className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          {verdict.recommendation}{' '}
          <a href="#verdict" className="whitespace-nowrap font-medium text-primary hover:underline">
            Read the verdict
          </a>
        </span>
      </p>
    </section>
  );
}
