'use client';

import Link from 'next/link';
import { Fragment, useMemo, type ReactNode } from 'react';
import { useDeferredSearch } from '@/hooks/use-deferred-search';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { PostSummary } from '@/lib/posts';

interface PostsListProps {
  posts: PostSummary[];
  className?: string;
  /**
   * Optional block (e.g. inline sponsors) to render between items when the
   * user is NOT searching. Hidden during search so results stay uninterrupted.
   */
  sponsorSlot?: ReactNode;
  /**
   * Index after which to render sponsorSlot. Defaults to 6. Ignored when
   * sponsorSlot is not provided.
   */
  sponsorAfter?: number;
}

export function PostsList({ posts, className, sponsorSlot, sponsorAfter = 6 }: PostsListProps) {
  const { searchQuery, setSearchQuery, deferredSearchQuery, searchInputRef } = useDeferredSearch({
    focusShortcut: true,
  });

  const filteredPosts = useMemo(() => {
    if (!deferredSearchQuery.trim()) return posts;
    const searchLower = deferredSearchQuery.toLowerCase();
    return posts.filter(
      (post) =>
        post.title.toLowerCase().includes(searchLower) ||
        (post.excerpt ?? '').toLowerCase().includes(searchLower) ||
        (post.categoryName ?? '').toLowerCase().includes(searchLower) ||
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
        filteredPosts.map((post, idx) => (
          // Fragment rather than a wrapping <div> so the outer
          // space-y-8 keeps applying to the Link (and the sponsor block
          // when present) as direct children.
          <Fragment key={post.slug}>
            {/* post-card-* classes (and the card icons) live in app/globals.css so
                each of the hundreds of cards on /posts stays small. */}
            <Link href={`/posts/${post.slug}`} className="post-card group">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="post-card-badge">{post.categoryName ?? 'Uncategorized'}</span>
                  <div className="post-card-meta">
                    <time dateTime={post.date}>{post.date}</time>
                    <span className="mx-2">|</span>
                    <span className="post-card-time">{post.readingTime}</span>
                  </div>
                </div>
                <h3 className="post-card-title">{post.title}</h3>
                <p className="post-card-excerpt">{post.excerpt}</p>
              </div>
            </Link>
            {/* Sponsor slot is hidden while searching so results stay clean.
                Rendered inline after sponsorAfter posts otherwise. */}
            {sponsorSlot &&
              !searchQuery.trim() &&
              idx === Math.min(sponsorAfter - 1, filteredPosts.length - 1) && (
                <div>{sponsorSlot}</div>
              )}
          </Fragment>
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
