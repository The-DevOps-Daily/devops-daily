import Image from 'next/image';
import { PostsList } from '@/components/posts-list';
import { getAuthorBySlug, getAllAuthors, getPostsByAuthor, getGuidesByAuthor } from '@/lib/authors';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamicParams = false;

export async function generateStaticParams() {
  try {
    const authors = await getAllAuthors();
    return authors.map((author) => ({
      slug: author.slug,
    }));
  } catch (error) {
    console.warn('Error generating static params for authors:', error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);

  if (!author) {
    return {};
  }

  return {
    title: `${author.name} - Author at DevOps Daily`,
    description: author.bio || `Articles and guides by ${author.name}`,
    alternates: {
      canonical: `/authors/${slug}`,
    },
    openGraph: {
      type: 'profile',
      title: author.name,
      description: author.bio || `Articles and guides by ${author.name}`,
      url: `/authors/${slug}`,
      images: author.avatar
        ? [
            {
              url: author.avatar,
              width: 400,
              height: 400,
              alt: author.name,
            },
          ]
        : undefined,
    },
  };
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);

  if (!author) {
    notFound();
  }

  const [posts, guides] = await Promise.all([
    getPostsByAuthor(slug),
    getGuidesByAuthor(slug),
  ]);

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Authors', href: '/authors' },
    { label: author.name, href: `/authors/${author.slug}`, isCurrent: true },
  ];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Authors', url: '/authors' },
    { name: author.name, url: `/authors/${author.slug}` },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <Breadcrumb items={breadcrumbItems} />

        {/* Author Profile Section */}
        <div className="flex flex-col items-center gap-8 mb-12 md:flex-row md:items-start">
          <div className="relative w-32 h-32 overflow-hidden border-4 rounded-full md:w-40 md:h-40 border-primary/20 bg-muted">
            {author.avatar ? (
              <Image src={author.avatar} alt={author.name} fill className="object-cover" />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <span className="text-4xl font-bold md:text-5xl text-muted-foreground">
                  {author.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl font-bold md:text-4xl">{author.name}</h1>
            {author.bio && (
              <p className="max-w-2xl mt-3 text-lg text-muted-foreground">{author.bio}</p>
            )}

            <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm md:justify-start text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">{author.postCount || 0}</span>{' '}
                {author.postCount === 1 ? 'post' : 'posts'}
              </div>
              <div>
                <span className="font-semibold text-foreground">{author.guideCount || 0}</span>{' '}
                {author.guideCount === 1 ? 'guide' : 'guides'}
              </div>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        {posts.length > 0 && (
          <div className="mb-12">
            <h2 className="mb-6 text-2xl font-bold">Posts by {author.name}</h2>
            <PostsList posts={posts} />
          </div>
        )}

        {guides.length > 0 && (
          <div>
            <h2 className="mb-6 text-2xl font-bold">Guides by {author.name}</h2>
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
