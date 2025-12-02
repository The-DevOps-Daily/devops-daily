'use client';

import { useTheme } from 'next-themes';
import Giscus from '@giscus/react';
import { useEffect, useState } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface GiscusCommentsProps {
  className?: string;
  title?: string;
}

export function GiscusComments({ className, title }: GiscusCommentsProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Avoid hydration mismatch by waiting for client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine the theme to use for Giscus
  const giscusTheme = mounted ? (resolvedTheme === 'dark' ? 'dark' : 'light') : 'light';
  
  // Use title if provided, otherwise fall back to pathname
  // Note: title should always be provided from the parent component
  const discussionTerm = title || (typeof window !== 'undefined' ? window.location.pathname : '');

  if (!mounted) {
    return null;
  }

  const handleLoadComments = () => {
    setIsLoading(true);
    // Small delay to show loading state
    setTimeout(() => {
      setShowComments(true);
      setIsLoading(false);
    }, 300);
  };

  if (!showComments) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={className}
      >
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-linear-to-br from-primary/5 via-purple-500/5 to-pink-500/5 rounded-lg border border-border/50">
          <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-linear-to-br from-primary/10 to-purple-500/10">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Join the Discussion</h3>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            Share your thoughts, ask questions, and connect with the community. Sign in with GitHub to participate.
          </p>
          <Button
            onClick={handleLoadComments}
            disabled={isLoading}
            size="lg"
            className="relative group overflow-hidden bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <span className="absolute inset-0 w-full h-full bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading comments...
              </>
            ) : (
              <>
                <MessageSquare className="mr-2 h-5 w-5" />
                Load Comments
              </>
            )}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4 }}
        className={className}
      >
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <MessageSquare className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <h2 className="text-xl font-semibold">Discussions</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Powered by{' '}
              <a
                href="https://giscus.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Giscus
              </a>
              {' '}& GitHub Discussions
            </p>
          </div>
        </div>
        <Giscus
          id="comments"
          repo="The-DevOps-Daily/devops-daily"
          repoId="MDEwOlJlcG9zaXRvcnkzNTUzMDQ5MTk="
          category="General"
          categoryId="DIC_kwDOFS2F184CjIVy"
          mapping="specific"
          term={discussionTerm}
          strict="0"
          reactionsEnabled="1"
          emitMetadata="0"
          inputPosition="top"
          theme={giscusTheme}
          lang="en"
          loading="lazy"
        />
      </motion.div>
    </AnimatePresence>
  );
}
