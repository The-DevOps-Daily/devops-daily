import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar } from 'lucide-react';
import { OptimizedImage } from '@/components/optimized-image';
import { getFeaturedPosts } from '@/lib/posts';
import type { Post } from '@/lib/posts';

interface FeaturedPostsProps {
  className?: string;
}

export default async function FeaturedPosts({ className }: FeaturedPostsProps) {
  const featuredPosts: Post[] = await getFeaturedPosts(3);
  return (
    <section className={cn('', className)}>
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Featured Posts</h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Our most popular articles and tutorials
        </p>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {featuredPosts.map((post, index) => (
          <Link
            key={post.slug}
            href={`/posts/${post.slug}`}
            className="flex flex-col overflow-hidden transition-all border rounded-lg group border-border hover:border-primary/50 hover:shadow-md"
          >
            <div className="relative h-48 overflow-hidden">
              <OptimizedImage
                src={post.image || '/placeholder.svg'}
                alt={post.title}
                fill
                priority={index === 0}
                className="transition-transform group-hover:scale-105"
              />
            </div>
            <div className="flex-1 p-6">
              <Badge variant="secondary" className="mb-2">
                <span>{post.category?.name ?? 'Uncategorized'}</span>
              </Badge>
              <h3 className="text-xl font-semibold transition-colors line-clamp-2 group-hover:text-primary">
                {post.title}
              </h3>
              <p className="mt-2 text-muted-foreground line-clamp-3">{post.excerpt}</p>
              <div className="flex items-center mt-4 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4 mr-1" />
                <time dateTime={post.date}>{post.date}</time>
                <span className="mx-2">|</span>
                <Clock className="w-4 h-4 mr-1" />
                <span>{post.readingTime}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
