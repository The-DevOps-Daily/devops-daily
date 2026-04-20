import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar } from 'lucide-react';
import { OptimizedImage } from '@/components/optimized-image';
import { SectionHeader } from '@/components/section-header';
import { getLatestGuides } from '@/lib/guides';
import type { Guide } from '@/lib/guides';

interface LatestGuidesProps {
  className?: string;
  limit?: number;
}

export default async function LatestGuides({ className, limit = 6 }: LatestGuidesProps) {
  const latestGuides: Guide[] = await getLatestGuides(limit);

  return (
    <section className={cn('', className)}>
      <SectionHeader
        label="guides"
        title="Latest Guides"
        description="Step-by-step tutorials to boost your DevOps skills"
        viewAllHref="/guides"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {latestGuides.map((guide, index) => (
          <Link
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            className="group flex flex-col overflow-hidden rounded-md border border-border hover:border-primary/40 hover:bg-muted/30 transition-colors"
          >
            <div className="relative h-48 overflow-hidden">
              <OptimizedImage
                src={guide.image || '/placeholder.svg'}
                alt={guide.title}
                fill
                priority={index === 0}
                className="transition-transform group-hover:scale-105 object-cover"
              />
            </div>
            <div className="flex-1 p-6">
              <Badge variant="secondary" className="mb-2">
                <span>{guide.category?.name ?? 'Uncategorized'}</span>
              </Badge>
              <h3 className="text-xl font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                {guide.title}
              </h3>
              <p className="mt-2 text-muted-foreground line-clamp-3">{guide.description}</p>
              <div className="mt-4 flex items-center text-sm text-muted-foreground">
                <Calendar className="mr-1 h-4 w-4" />
                <span>{guide.publishedAt?.split('T')[0] ?? 'Unknown date'}</span>
                <span className="mx-2">|</span>
                <Clock className="mr-1 h-4 w-4" />
                <span>{guide.readingTime ?? 'Quick read'}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
