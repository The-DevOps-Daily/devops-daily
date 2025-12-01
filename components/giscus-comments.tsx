'use client';

import { useTheme } from 'next-themes';
import Giscus from '@giscus/react';
import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';

interface GiscusCommentsProps {
  className?: string;
}

export function GiscusComments({ className }: GiscusCommentsProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by waiting for client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine the theme to use for Giscus
  const giscusTheme = mounted ? (resolvedTheme === 'dark' ? 'dark' : 'light') : 'light';

  if (!mounted) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-4 pb-2 border-b">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Discussions</h2>
      </div>
      <Giscus
        id="comments"
        repo="The-DevOps-Daily/devops-daily"
        repoId="R_kgDOMUcYgg"
        category="General"
        categoryId="DIC_kwDOMUcYgs4ClPgN"
        mapping="pathname"
        strict="0"
        reactionsEnabled="1"
        emitMetadata="0"
        inputPosition="top"
        theme={giscusTheme}
        lang="en"
        loading="lazy"
      />
    </div>
  );
}
