import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, Info } from 'lucide-react';

interface PostHeaderProps {
  post: {
    title: string;
    date: string;
    readingTime: string;
    category: {
      name: string;
      slug: string;
    };
    author?: {
      name: string;
      slug: string;
    };
  };
  hasAffiliateLinks?: boolean;
}

export function PostHeader({ post, hasAffiliateLinks = false }: PostHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Badge variant="secondary">
          <Link href={`/categories/${post.category.slug}`}>{post.category.name}</Link>
        </Badge>
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="mr-1 h-4 w-4" />
          <span>{post.date}</span>
        </div>
        <div className="flex items-center text-sm text-muted-foreground">
          <Clock className="mr-1 h-4 w-4" />
          <span>{post.readingTime}</span>
        </div>
      </div>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{post.title}</h1>
      {hasAffiliateLinks && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>Disclosure:</strong> This post contains affiliate links. We may earn a commission when you purchase through links in this article.
          </span>
        </div>
      )}
    </div>
  );
}
