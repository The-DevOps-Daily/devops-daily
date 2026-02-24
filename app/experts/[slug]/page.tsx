import Image from 'next/image';
import { getExpertBySlug, getAllExperts, getPostsByExpert, getGuidesByExpert } from '@/lib/experts';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import type { Metadata } from 'next';
import { parseMarkdown } from '@/lib/markdown';
import { CodeBlockWrapper } from '@/components/code-block-wrapper';
import { HeadingWrapper } from '@/components/heading-with-anchor';
import { Mail, Globe, MapPin, DollarSign, Calendar } from 'lucide-react';
import { PostsList } from '@/components/posts-list';
import Link from 'next/link';

export const dynamicParams = false;

export async function generateStaticParams() {
  try {
    const experts = await getAllExperts();
    return experts.map((expert) => ({
      slug: expert.slug,
    }));
  } catch (error) {
    console.warn('Error generating static params for experts:', error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const expert = await getExpertBySlug(slug);

  if (!expert) {
    return {};
  }

  return {
    title: `${expert.name} - ${expert.title || 'DevOps Expert'} | DevOps Daily`,
    description: expert.bio || `Hire ${expert.name} for DevOps consulting and services`,
    alternates: {
      canonical: `/experts/${slug}`,
    },
    openGraph: {
      type: 'profile',
      title: expert.name,
      description: expert.bio || `Hire ${expert.name} for DevOps consulting and services`,
      url: `/experts/${slug}`,
      images: expert.avatar
        ? [
            {
              url: expert.avatar,
              width: 400,
              height: 400,
              alt: expert.name,
            },
          ]
        : undefined,
    },
  };
}

export default async function ExpertPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const expert = await getExpertBySlug(slug);

  if (!expert) {
    notFound();
  }

  // Fetch posts and guides if showPosts is true (default true)
  const showPosts = expert.showPosts !== false;
  const [posts, guides] = showPosts
    ? await Promise.all([
        getPostsByExpert(slug),
        getGuidesByExpert(slug),
      ])
    : [[], []];

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Hire an Expert', href: '/experts' },
    { label: expert.name, href: `/experts/${expert.slug}`, isCurrent: true },
  ];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Hire an Expert', url: '/experts' },
    { name: expert.name, url: `/experts/${expert.slug}` },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <Breadcrumb items={breadcrumbItems} />

        {/* Expert Profile Section */}
        <div className="flex flex-col items-center gap-8 mb-12 md:flex-row md:items-start">
          <div className="relative w-32 h-32 overflow-hidden border-4 rounded-full md:w-40 md:h-40 border-primary/20 bg-muted">
            {expert.avatar ? (
              <Image src={expert.avatar} alt={expert.name} fill className="object-cover" />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <span className="text-4xl font-bold md:text-5xl text-muted-foreground">
                  {expert.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl font-bold md:text-4xl">{expert.name}</h1>
            {expert.title && (
              <p className="mt-2 text-xl text-primary">{expert.title}</p>
            )}
            {expert.bio && (
              <p className="max-w-2xl mt-3 text-lg text-muted-foreground">{expert.bio}</p>
            )}

            {/* Expert Details */}
            <div className="flex flex-wrap gap-4 mt-6 text-sm">
              {expert.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{expert.location}</span>
                </div>
              )}
              {expert.rate && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="w-4 h-4" />
                  <span>{expert.rate}</span>
                </div>
              )}
              {expert.availability && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>{expert.availability}</span>
                </div>
              )}
            </div>

            {/* Contact Links */}
            <div className="flex flex-wrap gap-3 mt-6">
              {expert.email && (
                <a
                  href={`mailto:${expert.email}`}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Mail className="w-4 h-4" />
                  Contact
                </a>
              )}
              {expert.website && (
                <a
                  href={expert.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border rounded-md bg-background hover:bg-accent"
                >
                  <Globe className="w-4 h-4" />
                  Website
                </a>
              )}
            </div>

            {/* Specialties */}
            {expert.specialties && expert.specialties.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-semibold">Specialties</h3>
                <div className="flex flex-wrap gap-2">
                  {expert.specialties.map((specialty) => (
                    <span
                      key={specialty}
                      className="px-3 py-1 text-xs font-medium border rounded-full bg-background border-border"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Expert Content */}
        {expert.content && (
          <HeadingWrapper>
            <CodeBlockWrapper>
              <div
                className="max-w-4xl mx-auto prose prose-lg dark:prose-invert
                  prose-headings:scroll-mt-24
                  prose-pre:bg-muted prose-pre:text-muted-foreground
                  prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:text-sm
                  prose-blockquote:border-l-primary prose-blockquote:bg-muted/10
                  prose-img:rounded-lg prose-img:shadow-lg
                  prose-a:text-primary hover:prose-a:text-primary/80 prose-a:transition-colors
                  prose-strong:text-foreground
                  prose-ul:list-disc prose-ol:list-decimal
                  prose-table:overflow-hidden prose-table:rounded-lg prose-table:shadow
                  prose-th:bg-muted prose-td:border-border"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(expert.content) }}
              />
            </CodeBlockWrapper>
          </HeadingWrapper>
        )}

        {/* Posts and Guides Sections - only shown if showPosts is true */}
        {showPosts && posts.length > 0 && (
          <div className="mt-16">
            <h2 className="mb-6 text-2xl font-bold">Articles by {expert.name}</h2>
            <PostsList posts={posts} />
          </div>
        )}

        {showPosts && guides.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-6 text-2xl font-bold">Guides by {expert.name}</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {guides.map((guide) => (
                <Link
                  key={guide.slug}
                  href={`/guides/${guide.slug}`}
                  className="block p-6 transition-all border rounded-lg bg-card border-border hover:border-primary/50 hover:shadow-md"
                >
                  <h3 className="text-xl font-semibold">{guide.title}</h3>
                  <p className="mt-2 text-muted-foreground">{guide.description}</p>
                  {guide.parts && guide.parts.length > 0 && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {guide.parts.length} {guide.parts.length === 1 ? 'part' : 'parts'}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
