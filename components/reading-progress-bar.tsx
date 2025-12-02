'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const handleScroll = () => {
      // Calculate the scroll progress
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress = (scrollTop / docHeight) * 100;

      setProgress(Math.min(scrollProgress, 100));

      // Show progress bar when user starts scrolling
      setIsVisible(scrollTop > 100);
    };

    // Initial check
    handleScroll();

    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [mounted]);

  // Don't render anything on server
  if (!mounted) {
    return null;
  }

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-100/10 backdrop-blur-sm shadow-sm"
      initial={{ opacity: 0, y: -10 }}
      animate={{
        opacity: isVisible ? 1 : 0,
        y: isVisible ? 0 : -10,
      }}
      transition={{ duration: 0.3 }}
    >
      {/* Background track */}
      <div className="absolute inset-0 h-full bg-linear-to-r from-gray-200/20 to-gray-300/20 dark:from-gray-700/20 dark:to-gray-600/20" />

      {/* Progress bar with gradient */}
      <motion.div
        className="relative h-full overflow-hidden"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      >
        {/* Animated gradient background */}
        <div
          className="absolute inset-0 h-full"
          style={{
            background: `linear-gradient(
              90deg,
              #3b82f6 0%,
              #8b5cf6 25%,
              #ec4899 50%,
              #f59e0b 75%,
              #3b82f6 100%
            )`,
            backgroundSize: '200% 100%',
            animation: 'gradient 8s ease infinite',
          }}
        />

        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 h-full"
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{
            repeat: Infinity,
            duration: 3,
            ease: 'linear',
          }}
        >
          <div className="h-full w-24 bg-linear-to-r from-transparent via-white/20 to-transparent skew-x-12" />
        </motion.div>
      </motion.div>

      {/* Progress percentage tooltip */}
      {/* {isVisible && progress > 0 && progress < 100 && (
        <motion.div
          className="absolute -bottom-8 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-lg border border-border/50 text-xs font-medium"
          style={{
            left: `${Math.max(Math.min(progress, 92), 8)}%`,
            transform: "translateX(-50%)",
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {Math.round(progress)}%
        </motion.div>
      )} */}

      {/* Milestone indicators */}
      {[25, 50, 75].map((milestone) => (
        <motion.div
          key={milestone}
          className="absolute top-0 h-full w-px"
          style={{ left: `${milestone}%` }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: progress > milestone ? 0.3 : 0.1,
            scale: progress > milestone ? 1 : 0.8,
          }}
          transition={{ duration: 0.5 }}
        >
          <div className="h-full w-full bg-white/20" />
          {progress > milestone && (
            <motion.div
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white/40 shadow-sm"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 15,
                delay: 0.1,
              }}
            />
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
