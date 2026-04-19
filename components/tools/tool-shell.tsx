import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Breadcrumb } from '@/components/breadcrumb';
import {
  BreadcrumbSchema,
  FAQSchema,
  SoftwareApplicationSchema,
} from '@/components/schema-markup';
import { CarbonAds } from '@/components/carbon-ads';
import { getToolBySlug } from '@/lib/tools';
import { getGameById } from '@/lib/games';
import { cn } from '@/lib/utils';

interface ToolShellProps {
  slug: string;
  children: React.ReactNode;
  /** Optional content shown below the tool explaining how it works */
  explainer?: React.ReactNode;
  hideAds?: boolean;
  className?: string;
}

const CATEGORY_SCHEMA: Record<
  | 'networking'
  | 'encoding'
  | 'security'
  | 'scheduling'
  | 'kubernetes',
  string
> = {
  networking: 'NetworkingApplication',
  encoding: 'UtilitiesApplication',
  security: 'SecurityApplication',
  scheduling: 'UtilitiesApplication',
  kubernetes: 'DeveloperApplication',
};

/**
 * Shared chrome for every page under `/tools/*`. Mirrors SimulatorShell in
 * spirit: breadcrumb, title bar with mono section label, optional explainer,
 * carbon ads, related content cross-links, and a consistent back-to-tools link.
 */
export async function ToolShell({
  slug,
  children,
  explainer,
  hideAds = false,
  className,
}: ToolShellProps) {
  const tool = getToolBySlug(slug);
  if (!tool) {
    return <div className="container px-4 py-8 mx-auto">Tool not found.</div>;
  }

  const breadcrumbItems = [
    { label: 'Tools', href: '/tools' },
    { label: tool.title, href: `/tools/${tool.slug}`, isCurrent: true },
  ];
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Tools', url: '/tools' },
    { name: tool.title, url: `/tools/${tool.slug}` },
  ];

  // Resolve related simulators by id for the cross-link sidebar
  const relatedSimulators = tool.relatedSimulators
    ? await Promise.all(tool.relatedSimulators.map((id) => getGameById(id)))
    : [];
  const resolvedSims = relatedSimulators.filter(
    (g): g is NonNullable<typeof g> => !!g
  );

  const faqForSchema = tool.faqs?.map((f) => ({
    question: f.question,
    answer: f.answer,
  }));

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <SoftwareApplicationSchema
        name={tool.title}
        description={tool.description}
        url={`/tools/${tool.slug}`}
        category={CATEGORY_SCHEMA[tool.category]}
        keywords={tool.keywords}
      />
      {faqForSchema && faqForSchema.length > 0 && <FAQSchema questions={faqForSchema} />}

      <div className={cn('container px-4 py-8 mx-auto', className)}>
        <Breadcrumb items={breadcrumbItems} />

        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-mono text-muted-foreground mb-1">// tool</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
            {tool.title}
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl mb-6">
            {tool.tagline}
          </p>

          {/* Tool UI */}
          <div className="w-full">{children}</div>

          {/* Explainer */}
          {explainer && (
            <section className="w-full my-10 rounded-md border bg-muted/20 p-6">
              {explainer}
            </section>
          )}

          {/* Related simulators sidebar */}
          {resolvedSims.length > 0 && (
            <section className="my-10">
              <p className="text-xs font-mono text-muted-foreground mb-2">// related simulators</p>
              <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3 bg-border border rounded-md overflow-hidden">
                {resolvedSims.map((sim) => (
                  <Link
                    key={sim.href}
                    href={sim.href}
                    className="group bg-card p-4 transition-colors hover:bg-muted/40"
                  >
                    <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                      {sim.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {sim.description}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Ads */}
          {!hideAds && (
            <div className="w-full max-w-md mx-auto my-8">
              <CarbonAds />
            </div>
          )}

          {/* Back link */}
          <div className="w-full border-t pt-8 mt-8">
            <Link
              href="/tools"
              className="inline-flex items-center gap-1.5 text-sm font-mono text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-green-500/80">$</span> cd /tools
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
