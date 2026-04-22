import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllNewsletters, getNewsletterBySlug } from '@/lib/newsletters';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { Mail, ArrowLeft, Calendar } from 'lucide-react';
import type { Metadata } from 'next';

export const dynamicParams = false;

export async function generateStaticParams() {
  const newsletters = await getAllNewsletters();
  return newsletters.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const newsletter = await getNewsletterBySlug(slug);

  if (!newsletter) return {};

  const ogImage = `/images/newsletters/${slug}-og.png`;
  const ogExists = await import('fs/promises')
    .then((fs) => fs.access(`${process.cwd()}/public${ogImage}`).then(() => true).catch(() => false));
  const image = ogExists ? ogImage : '/og-image.png';

  return {
    title: { absolute: newsletter.title },
    description: `DevOps Daily Newsletter - Week ${newsletter.week}, ${newsletter.year}. Weekly roundup of new content and learning resources.`,
    alternates: { canonical: `/newsletters/${slug}` },
    openGraph: {
      title: newsletter.title,
      description: `Weekly roundup - Week ${newsletter.week}, ${newsletter.year}`,
      type: 'article',
      publishedTime: newsletter.date,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: newsletter.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: newsletter.title,
      description: `Weekly roundup - Week ${newsletter.week}, ${newsletter.year}`,
      images: [image],
    },
  };
}

export default async function NewsletterDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const newsletter = await getNewsletterBySlug(slug);

  if (!newsletter) notFound();

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Newsletters', url: '/newsletters' },
    { name: newsletter.title, url: `/newsletters/${slug}` },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
        <article className="max-w-3xl mx-auto px-4 py-12">
          {/* Back link */}
          <Link
            href="/newsletters"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            All Newsletters
          </Link>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                {new Date(newsletter.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2">{newsletter.title}</h1>
          </div>

          {/* Content */}
          <div
            className="prose prose-lg dark:prose-invert max-w-none
              prose-headings:font-semibold
              prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
              prose-p:leading-relaxed
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-img:rounded-lg prose-img:shadow-md"
            dangerouslySetInnerHTML={{ __html: newsletter.content }}
          />

          {/* Subscribe CTA */}
          <div className="mt-12 p-6 rounded-xl border border-primary/20 bg-primary/5 text-center">
            <h3 className="font-semibold mb-2">Get this in your inbox</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Subscribe to receive the DevOps Daily newsletter every Monday.
            </p>
            <a
              href="https://devops-daily.us2.list-manage.com/subscribe?u=d1128776b290ad8d08c02094f&id=fd76a4e93f"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Subscribe
            </a>
          </div>
        </article>
      </div>
    </>
  );
}
