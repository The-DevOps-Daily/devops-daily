'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useDeferredValue, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Post } from '@/lib/posts';

interface PostsListProps {
  posts: Post[];
  className?: string;
}

export function PostsList({ posts, className }: PostsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Handle keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // useDeferredValue keeps the search <input> at 60fps while the filter
  // runs at a lower priority — meaningful on mobile where the previous
  // synchronous filter on every keystroke contributed to INP > 200ms.
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const filteredPosts = useMemo(() => {
    if (!deferredSearchQuery.trim()) return posts;
    const searchLower = deferredSearchQuery.toLowerCase();
    return posts.filter(
      (post) =>
        post.title.toLowerCase().includes(searchLower) ||
        (post.excerpt ?? '').toLowerCase().includes(searchLower) ||
        (post.category?.name || '').toLowerCase().includes(searchLower) ||
        (post.tags && post.tags.some((tag) => tag.toLowerCase().includes(searchLower)))
    );
  }, [posts, deferredSearchQuery]);

  return (
    <div className={cn('space-y-8', className)}>
      <div className="flex items-center gap-2 relative mb-6">
        <Search className="h-5 w-5 text-muted-foreground absolute left-3 pointer-events-none" />
        <Input
          ref={searchInputRef}
          type="text"
          placeholder="Search posts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-14"
        />
        <div className="absolute right-3 flex items-center gap-1 pointer-events-none">
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-80">
            <span className="text-lg">⌘</span>
            <span className="text-sm">K</span>
          </kbd>
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground">No posts found matching "{searchQuery}"</p>
          <button onClick={() => setSearchQuery('')} className="mt-2 text-primary hover:underline">
            Clear search
          </button>
        </div>
      ) : (
        filteredPosts.map((post) => (
          <Link
            key={post.slug}
            href={`/posts/${post.slug}`}
            className="group flex flex-col md:flex-row gap-6 p-6 bg-card rounded-lg border border-border hover:border-primary/50 hover:shadow-md transition-all"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  <span>{post.category?.name ?? 'Uncategorized'}</span>
                </Badge>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-1 h-4 w-4" />
                  <span>{post.date}</span>
                  <span className="mx-2">|</span>
                  <Clock className="mr-1 h-4 w-4" />
                  <span>{post.readingTime}</span>
                </div>
              </div>
              <h3 className="mt-2 text-xl font-semibold group-hover:text-primary transition-colors">
                {post.title}
              </h3>
              <p className="mt-2 text-muted-foreground">{post.excerpt}</p>
            </div>
          </Link>
        ))
      )}

      {/* Show result count when searching */}
      {searchQuery.trim() && filteredPosts.length > 0 && (
        <p className="text-sm text-muted-foreground mt-2">
          Showing {filteredPosts.length} {filteredPosts.length === 1 ? 'result' : 'results'} for "
          {searchQuery}"
        </p>
      )}
    </div>
  );
}
