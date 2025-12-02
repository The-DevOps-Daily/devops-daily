'use client';

import { useState } from 'react';
import { AlertTriangle, ExternalLink, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ReportIssueProps {
  title?: string;
  type?: 'post' | 'guide' | 'exercise' | 'quiz' | 'page';
  slug?: string;
  className?: string;
  variant?: 'default' | 'compact' | 'inline';
}

export function ReportIssue({
  title,
  type = 'page',
  slug,
  className,
  variant = 'default',
}: ReportIssueProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  // Generate the GitHub issue URL with pre-filled title if possible
  const generateIssueUrl = () => {
    const baseUrl = 'https://github.com/The-DevOps-Daily/devops-daily/issues/new';

    if (!title) {
      return baseUrl;
    }

    // Create a descriptive issue title
    const issueTitle = `Issue with ${type}: ${title}`;
    const issueBody = slug
      ? `I found an issue with this ${type}:\n\n**URL:** ${window.location.href}\n**${type.charAt(0).toUpperCase() + type.slice(1)} Slug:** ${slug}\n\n**Description:**\n<!-- Please describe the issue you found -->\n\n**Expected behavior:**\n<!-- What should happen instead? -->\n\n**Additional context:**\n<!-- Any other context about the problem -->`
      : `I found an issue with this ${type}:\n\n**URL:** ${window.location.href}\n\n**Description:**\n<!-- Please describe the issue you found -->\n\n**Expected behavior:**\n<!-- What should happen instead? -->\n\n**Additional context:**\n<!-- Any other context about the problem -->`;

    const params = new URLSearchParams({
      title: issueTitle,
      body: issueBody,
      labels: `content-issue,${type}`,
    });

    return `${baseUrl}?${params.toString()}`;
  };

  const handleClick = () => {
    setIsClicked(true);
    const url = generateIssueUrl();
    window.open(url, '_blank', 'noopener,noreferrer');

    // Reset the clicked state after animation
    setTimeout(() => setIsClicked(false), 200);
  };

  if (variant === 'inline') {
    return (
      <button
        onClick={handleClick}
        className={cn(
          'inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors duration-200',
          'hover:underline underline-offset-4',
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Report issue</span>
        <ExternalLink className="w-3 h-3" />
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <motion.div
        className={cn(
          'flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-all duration-200',
          className
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Found an issue?</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClick}
          className="shrink-0 h-8 px-3 text-xs hover:bg-background/80"
        >
          Report
          <ExternalLink className="w-3 h-3 ml-1.5" />
        </Button>
      </motion.div>
    );
  }

  // Default variant
  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60 bg-linear-to-br from-background to-muted/20 p-6',
        'hover:shadow-lg hover:border-border/80 transition-all duration-300',
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-linear-to-bl from-amber-500/5 to-transparent blur-2xl" />

      <div className="relative flex items-start gap-4">
        {/* Icon */}
        <motion.div
          className="shrink-0 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20"
          animate={{
            scale: isHovered ? 1.1 : 1,
            rotate: isHovered ? 5 : 0,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="mb-2 text-lg font-semibold text-foreground">Found an issue?</h3>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            Help us improve this content by reporting any errors, typos, or suggestions for
            enhancement.
          </p>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={handleClick}
              variant="outline"
              size="sm"
              className={cn(
                'group relative overflow-hidden border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/5',
                'transition-all duration-200',
                isClicked && 'bg-green-500/10 border-green-500/30'
              )}
            >
              <motion.div
                className="flex items-center gap-2"
                animate={{
                  x: isClicked ? [0, -5, 0] : 0,
                }}
                transition={{ duration: 0.2 }}
              >
                {isClicked ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 group-hover:text-amber-500" />
                )}
                <span className="font-medium">{isClicked ? 'Thank you!' : 'Report Issue'}</span>
                {!isClicked && (
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                )}
              </motion.div>

              {/* Hover effect */}
              <motion.div
                className="absolute inset-0 bg-linear-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0"
                initial={{ x: '-100%' }}
                animate={{ x: isHovered ? '100%' : '-100%' }}
                transition={{ duration: 0.6 }}
              />
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
