import { PageHero } from '@/components/page-hero';
import { ComparisonsList } from '@/components/comparisons/comparisons-list';
import { SponsorSidebar } from '@/components/sponsor-sidebar';
import { getAllComparisons } from '@/lib/comparisons';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquarePlus, Scale } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DevOps Tool Comparisons - Side-by-Side Feature Analysis',
  description:
    'Compare popular DevOps tools side by side. Feature comparison tables, pros and cons, use cases, and honest verdicts for Terraform, Pulumi, Argo CD, Flux, Jenkins, GitHub Actions, and more.',
  alternates: {
    canonical: '/comparisons',
  },
  openGraph: {
    title: 'DevOps Tool Comparisons | DevOps Daily',
    description:
      'Compare popular DevOps tools side by side. Feature comparison tables, pros and cons, use cases, and honest verdicts.',
    url: '/comparisons',
    type: 'website',
    images: [
      {
        url: 'https://devops-daily.com/images/comparisons-og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Tool Comparisons',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevOps Tool Comparisons | DevOps Daily',
    description:
      'Compare popular DevOps tools side by side with feature tables, pros/cons, and verdicts.',
    images: ['https://devops-daily.com/images/comparisons-og-image.png'],
  },
};

export default async function ComparisonsPage() {
  const comparisons = await getAllComparisons();

  return (
    <div className="min-h-screen">
      <PageHero
        title="DevOps Tool Comparisons"
        accentWord="Comparisons"
        description="Compare popular DevOps tools side by side. Feature comparison tables, pros and cons, use cases, and honest verdicts."
        icon={Scale}
        breadcrumbs={[{ label: 'Comparisons' }]}
        stats={[{ label: 'comparisons', value: comparisons.length }]}
      />

      <div className="py-8 container mx-auto px-4 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Main Content */}
        <div className="lg:col-span-9">
          <ComparisonsList comparisons={comparisons} />

          {/* Suggest a Comparison CTA */}
          <Card className="mt-12 border-dashed">
            <CardContent className="p-8 text-center">
              <MessageSquarePlus className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Suggest a Comparison</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Have two DevOps tools you want compared? Open an issue on our GitHub
                repository and we will add it to the list.
              </p>
              <a
                href="https://github.com/The-DevOps-Daily/devops-daily/issues/new?title=Comparison+Suggestion:+Tool+A+vs+Tool+B&labels=comparison,content"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <MessageSquarePlus className="w-4 h-4" />
                Suggest on GitHub
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-3">
          <div className="sticky space-y-6 top-8">
            <SponsorSidebar />
          </div>
        </aside>
      </div>
    </div>
  );
}
