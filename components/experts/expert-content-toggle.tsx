'use client';

import { useState, useEffect } from 'react';
import { PostsList } from '@/components/posts-list';
import Link from 'next/link';
import { BookOpen, FileText } from 'lucide-react';

type Post = {
  slug: string;
  title: string;
  excerpt?: string;
  date?: string;
  category?: { name: string; slug: string };
  tags?: { name: string; slug: string }[];
  readingTime?: string;
};

type Guide = {
  slug: string;
  title: string;
  description?: string;
  parts?: { title: string }[];
};

type ExpertContentToggleProps = {
  expertName: string;
  expertSlug: string;
  posts: Post[];
  guides: Guide[];
  postCount: number;
  guideCount: number;
  defaultShowPosts?: boolean;
};

export function ExpertContentToggle({
  expertName,
  expertSlug,
  posts,
  guides,
  postCount,
  guideCount,
  defaultShowPosts = true,
}: ExpertContentToggleProps) {
  const [showContent, setShowContent] = useState(defaultShowPosts);

  // Load preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`expert-${expertSlug}-show-content`);
    if (stored !== null) {
      setShowContent(stored === 'true');
    }
  }, [expertSlug]);

  // Save preference to localStorage when changed
  const toggleContent = () => {
    const newValue = !showContent;
    setShowContent(newValue);
    localStorage.setItem(`expert-${expertSlug}-show-content`, String(newValue));
  };

  const totalContent = postCount + guideCount;

  if (totalContent === 0) {
    return null;
  }

  return (
    <div className="mt-12">
      {/* Toggle Button Section */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Content by {expertName}</h2>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span className="font-semibold text-foreground">{postCount}</span>
              {postCount === 1 ? ' post' : ' posts'}
            </div>
            <div className="flex items-center gap-1">
              <BookOpen className="w-4 h-4" />
              <span className="font-semibold text-foreground">{guideCount}</span>
              {guideCount === 1 ? ' guide' : ' guides'}
            </div>
          </div>
        </div>

        <button
          onClick={toggleContent}
          className="px-4 py-2 text-sm font-medium transition-colors border rounded-md bg-background hover:bg-accent"
          aria-label={showContent ? 'Hide content' : 'Show content'}
        >
          {showContent ? 'Hide Content' : 'Show Content'}
        </button>
      </div>

      {/* Content Sections */}
      {showContent && (
        <>
          {posts.length > 0 && (
            <div className="mb-12">
              <h3 className="mb-6 text-xl font-semibold">Articles by {expertName}</h3>
              <PostsList posts={posts} />
            </div>
          )}

          {guides.length > 0 && (
            <div>
              <h3 className="mb-6 text-xl font-semibold">Guides by {expertName}</h3>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {guides.map((guide) => (
                  <Link
                    key={guide.slug}
                    href={`/guides/${guide.slug}`}
                    className="block p-6 transition-all border rounded-lg bg-card border-border hover:border-primary/50 hover:shadow-md"
                  >
                    <h4 className="text-xl font-semibold">{guide.title}</h4>
                    <p className="mt-2 text-muted-foreground">{guide.description}</p>
                    {guide.parts && guide.parts.length > 0 && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {guide.parts.length} {guide.parts.length === 1 ? 'part' : 'parts'}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
