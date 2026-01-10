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
  priorityCount?: number;
}

export function GuidesList({ guides, className, priorityCount = 2 }: GuidesListProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-8', className)}>
      {guides.map((guide, index) => (
        <Link
          key={guide.slug}
          href={`/guides/${guide.slug}`}
          className="group flex flex-col overflow-hidden rounded-lg border border-border hover:border-primary/50 hover:shadow-md transition-all"
        >
          <div className="relative h-48 overflow-hidden">
            <Image
              src={guide.image || '/placeholder.svg'}
              alt={guide.title}
              fill
              priority={index < priorityCount}
              className="object-cover transition-transform group-hover:scale-105"
            />
          </div>
          <div className="flex-1 p-6">
            <Badge variant="secondary" className="mb-2">
              <span>{guide.category.name}</span>
            </Badge>
            <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
              {guide.title}
            </h3>
            <p className="mt-2 text-muted-foreground">{guide.description}</p>
            <div className="mt-4 flex items-center text-sm text-muted-foreground">
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
