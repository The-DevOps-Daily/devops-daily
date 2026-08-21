'use client';

import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Clock, BookOpen } from 'lucide-react';
import { Guides } from '@/lib/guides';

interface GuidesListProps {
  className?: string;
  guides: Guides[];
}

export function GuidesList({ guides, className }: GuidesListProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8', className)}>
      {guides.map((guide, index) => (
        <Link
          key={guide.slug}
          href={`/guides/${guide.slug}`}
          className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/50 hover:shadow-md"
        >
          <div className="relative aspect-[40/21] overflow-hidden bg-muted/30">
            <Image
              src={guide.image || '/placeholder.svg'}
              alt={guide.title}
              fill
              priority={index === 0}
              sizes="(min-width: 1024px) 36vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </div>
          <div className="flex flex-1 flex-col p-5 sm:p-6">
            <Badge variant="secondary" className="mb-2 self-start">
              <span>{guide.category.name}</span>
            </Badge>
            <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
              {guide.title}
            </h3>
            <p className="mt-2 line-clamp-3 text-muted-foreground">{guide.description}</p>
            <div className="mt-auto flex items-center pt-5 text-sm text-muted-foreground">
              <BookOpen className="mr-1 h-4 w-4" />
              <span>{guide.partsCount} parts</span>
              <span className="mx-2">|</span>
              <Clock className="mr-1 h-4 w-4" />
              <span>{guide.readingTime}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
