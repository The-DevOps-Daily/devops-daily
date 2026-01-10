import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Clock, Calendar, BookOpen } from 'lucide-react';

type ContentItem = {
  title: string;
  slug: string;
  excerpt?: string;
  description?: string;
  date?: string;
  publishedAt?: string;
  readingTime?: string;
  category?: {
    name: string;
    slug: string;
  };
  partsCount?: number;
};

interface RelatedContentProps {
  items: ContentItem[];
  type: 'post' | 'guide' | 'quiz';
  title?: string;
  className?: string;
}

export function RelatedContent({ items, type, title = 'You Might Also Like', className }: RelatedContentProps) {
  if (!items.length) return null;

  const getItemUrl = (item: ContentItem) => {
    if (type === 'guide') {
      return `/guides/${item.slug}`;
    }
    if (type === 'quiz') {
      return `/quizzes/${item.slug}`;
    }
    return `/posts/${item.slug}`;
  };

  const getItemDate = (item: ContentItem) => {
    return item.publishedAt || item.date || '';
  };

  return (
    <div className={cn('mt-12', className)}>
      <div className="pb-4 mb-6 border-b border-border">
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.slug}
            href={getItemUrl(item)}
            className="group flex flex-col p-5 bg-card rounded-lg border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-200"
          >
            <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors mb-3">
              {item.title}
            </h3>
            {(item.excerpt || item.description) && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {item.excerpt || item.description}
              </p>
            )}
            <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground">
              {getItemDate(item) && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(getItemDate(item)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
              {item.readingTime && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{item.readingTime}</span>
                </div>
              )}
              {type === 'guide' && item.partsCount && (
                <div className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  <span>{item.partsCount} {item.partsCount === 1 ? 'part' : 'parts'}</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
