import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { Badge } from '@/components/ui/badge';
import {
  AUTHORS,
  getAuthorBySlug,
  getAuthorSlugsWithPosts,
  getPostsByAuthor,
} from '@/lib/authors';

interface Params {
  slug: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  // Pre-render every author with an attributed post, plus any registered
  // profile even if they haven't shipped a post yet.
  const usedSlugs = await getAuthorSlugsWithPosts();
  const registeredSlugs = AUTHORS.map((a) => a.slug);
  const all = Array.from(new Set([...usedSlugs, ...registeredSlugs]));
  return all.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = getAuthorBySlug(slug);
  const name = profile?.name ?? 'Author';
  return {
    title: `${name} | DevOps Daily`,
    description:
      profile?.bio ??
      `Posts written by ${name} on DevOps Daily.`,
    alternates: { canonical: `/authors/${slug}` },
    openGraph: {
      title: `${name} on DevOps Daily`,
      description: profile?.bio,
      url: `/authors/${slug}`,
      type: 'profile',
    },
  };
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const profile = getAuthorBySlug(slug);
  const posts = await getPostsByAuthor(slug);

  // If no registered profile and no posts, 404. If posts exist under an
  // unknown slug, synthesize a lightweight profile from the first post.
  if (!profile && posts.length === 0) {
    notFound();
  }

  const name = profile?.name ?? posts[0]?.author?.name ?? slug;

  const breadcrumbItems = [
    { label: 'Authors', href: '/authors' },
    { label: name, href: `/authors/${slug}`, isCurrent: true },
  ];
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Authors', url: '/authors' },
    { name, url: `/authors/${slug}` },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <Breadcrumb items={breadcrumbItems} />

        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-mono text-muted-foreground mb-1">// author</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            {name}
          </h1>
          {profile?.bio && (
            <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">
              {profile.bio}
            </p>
          )}
          <p className="mt-4 text-xs font-mono text-muted-foreground tabular-nums">
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </p>

          <section className="mt-10">
            <p className="text-xs font-mono text-muted-foreground mb-3">
              // posts
            </p>
            {posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No posts published under this author yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {posts.map((post) => (
                  <li key={post.slug}>
                    <Link
                      href={`/posts/${post.slug}`}
                      className="group block rounded-md border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-2 mb-1.5 text-xs text-muted-foreground font-mono tabular-nums">
                        {post.category?.name && (
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {post.category.name}
                          </Badge>
                        )}
                        {post.date && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" strokeWidth={1.5} />
                            {post.date}
                          </span>
                        )}
                        {post.readingTime && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" strokeWidth={1.5} />
                            {post.readingTime}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="text-sm text-muted-foreground leading-relaxed mt-1 line-clamp-2">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-1 text-xs font-mono text-primary/80">
                        Read post
                        <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
