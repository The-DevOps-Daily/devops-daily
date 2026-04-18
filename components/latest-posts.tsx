import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar } from 'lucide-react';
import { SectionHeader } from '@/components/section-header';
import { getLatestPosts } from '@/lib/posts';
import type { Post } from '@/lib/posts';

interface LatestPostsProps {
  className?: string;
}

export default async function LatestPosts({ className }: LatestPostsProps) {
  const latestPosts: Post[] = await getLatestPosts(6);
  return (
    <section className={cn('', className)}>
      <SectionHeader
        label="posts"
        title="Latest Posts"
        description="Stay up to date with the latest DevOps content"
        viewAllHref="/posts"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {latestPosts.map((post) => (
          <Link
            key={post.slug}
            href={`/posts/${post.slug}`}
            className="group p-6 bg-card rounded-md border border-border hover:border-primary/40 hover:bg-muted/30 transition-colors"
          >
            <Badge variant="secondary" className="mb-2">
              <span>{post.category?.name ?? 'Uncategorized'}</span>
            </Badge>
            <h3 className="text-xl font-semibold line-clamp-2 group-hover:text-primary transition-colors">
              {post.title}
            </h3>
            <p className="mt-2 text-muted-foreground line-clamp-3">{post.excerpt}</p>
            <div className="mt-4 flex items-center text-sm text-muted-foreground">
              <Calendar className="mr-1 h-4 w-4" />
              <span>{post.date}</span>
              <span className="mx-2">|</span>
              <Clock className="mr-1 h-4 w-4" />
              <span>{post.readingTime}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
