'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/breadcrumb';
import { ensureContrastOnDark } from '@/lib/color-contrast';
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
    <div className="container px-4 py-8 mx-auto">
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
                Updated {new Date(comparison.updatedDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              <span style={{ color: ensureContrastOnDark(comparison.toolA.color) }}>{comparison.toolA.name}</span>
              <span className="text-muted-foreground mx-3 text-2xl sm:text-3xl lg:text-4xl font-normal">vs</span>
              <span style={{ color: ensureContrastOnDark(comparison.toolB.color) }}>{comparison.toolB.name}</span>
            </h1>

            <p className="text-lg text-muted-foreground mb-4">{comparison.description}</p>

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
                className="overflow-hidden"
                style={{ borderLeftColor: tool.color, borderLeftWidth: '4px' }}
              >
                <CardContent className="p-5">
                  <h3 className="text-lg font-bold mb-2" style={{ color: tool.color }}>
                    {tool.name}
                  </h3>
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

          {/* Section 3: Introduction */}
          <section className="mb-10">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {comparison.introduction.split('\n\n').map((paragraph, i) => (
                <p key={i} className="text-muted-foreground leading-relaxed mb-4">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>

          {/* Section 4: Feature Comparison Table */}
          <section className="mb-10">
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
          <section className="mb-10">
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
          <section className="mb-10">
            <h2 className="flex items-center gap-2 text-2xl font-bold mb-2">
              <GitCompare className="w-6 h-6 text-primary" />
              Decision Matrix
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Pick this if...
            </p>
            <DecisionMatrix
              items={comparison.decisionMatrix}
              toolA={comparison.toolA}
              toolB={comparison.toolB}
            />
          </section>

          {/* Section 7: Use Cases */}
          <section className="mb-10">
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
          <section className="mb-10">
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
          <section className="mb-10">
            <h2 className="flex items-center gap-2 text-2xl font-bold mb-6">
              <HelpCircle className="w-6 h-6 text-primary" />
              Frequently Asked Questions
            </h2>
            <ComparisonFAQ faqs={comparison.faqs} />
          </section>

          {/* Section 11: Related Content */}
          <section className="mb-10">
            <RelatedContent
              currentSlug={comparison.slug}
              comparisons={allComparisons}
            />
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
