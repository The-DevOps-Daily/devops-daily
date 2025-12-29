'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, ListChecks } from 'lucide-react';

interface ChecklistsHeroProps {
  totalChecklists: number;
  categories: string[];
}

export function ChecklistsHero({ totalChecklists, categories }: ChecklistsHeroProps) {
  const shouldReduceMotion = useReducedMotion();

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.15,
        delayChildren: shouldReduceMotion ? 0 : 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.6,
        ease: 'easeOut',
      },
    },
  };

  const floatingVariants = {
    animate: shouldReduceMotion
      ? {}
      : {
          y: [0, -15, 0],
          rotate: [0, 5, -5, 0],
          transition: {
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          },
        },
  };

  const pulseVariants = {
    animate: shouldReduceMotion
      ? {}
      : {
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.6, 0.3],
          transition: {
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          },
        },
  };

  const shimmerVariants = {
    animate: shouldReduceMotion
      ? {}
      : {
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          transition: {
            duration: 4,
            repeat: Infinity,
            ease: 'linear',
          },
        },
  };

  const orbVariants = {
    animate: shouldReduceMotion
      ? {}
      : (custom: number) => ({
          x: [0, custom * 40, 0],
          y: [0, custom * -30, 0],
          scale: [1, 1.3, 1],
          rotate: [0, 180, 360],
          transition: {
            duration: 10 + custom * 2,
            repeat: Infinity,
            ease: 'easeInOut',
          },
        }),
  };

  const checkmarkVariants = {
    animate: shouldReduceMotion
      ? {}
      : (custom: number) => ({
          y: [0, -20, 0],
          rotate: [0, 10, -10, 0],
          scale: [1, 1.1, 1],
          opacity: [0.2, 0.4, 0.2],
          transition: {
            duration: 3 + custom * 0.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: custom * 0.5,
          },
        }),
  };

  return (
    <section className="relative w-full overflow-hidden bg-linear-to-br from-background via-background/95 to-blue-50/30 dark:to-blue-950/20 pt-24 pb-20">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated gradient orbs */}
        {!shouldReduceMotion && (
          <>
            <motion.div
              custom={1}
              variants={orbVariants}
              animate="animate"
              className="absolute -top-32 -right-32 w-96 h-96 bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl"
            />
            <motion.div
              custom={-1}
              variants={orbVariants}
              animate="animate"
              className="absolute -bottom-32 -left-32 w-96 h-96 bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-3xl"
            />
            <motion.div
              custom={0.5}
              variants={orbVariants}
              animate="animate"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-400/10 dark:bg-indigo-600/5 rounded-full blur-3xl"
            />
          </>
        )}

        {/* Floating checkmarks */}
        {!shouldReduceMotion && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={checkmarkVariants}
                animate="animate"
                className="absolute text-4xl font-bold text-blue-400/20 dark:text-blue-600/10"
                style={{
                  left: `${15 + i * 15}%`,
                  top: `${20 + (i % 2) * 40}%`,
                }}
              >
                ✓
              </motion.div>
            ))}
          </>
        )}

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '4rem 4rem',
          }}
        />
      </div>

      {/* Content */}
      <div className="container relative z-10 px-4 mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-5xl mx-auto text-center"
        >
          {/* Title */}
          <motion.h1
            variants={itemVariants}
            className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          >
            <span className="mt-2 text-foreground">DevOps & Security </span>
            <motion.span
              variants={shimmerVariants}
              animate="animate"
              className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400"
              style={{
                backgroundSize: '200% 200%',
              }}
            >
              Checklists
            </motion.span>
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={itemVariants}
            className="max-w-2xl mx-auto mb-10 text-lg leading-relaxed sm:text-xl text-muted-foreground"
          >
            Follow best practices with interactive checklists for security, DevOps, and cloud
            operations. Track your progress and never miss a critical step.
          </motion.p>

          {/* Floating icon */}
          <motion.div
            variants={floatingVariants}
            animate="animate"
            className="flex justify-center mb-8"
          >
            <div className="relative">
              {/* Multiple pulse rings */}
              {!shouldReduceMotion && (
                <>
                  <motion.div
                    animate={{
                      scale: [1, 1.6, 2.2],
                      opacity: [0.5, 0.2, 0],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                    className="absolute inset-0 bg-blue-400 rounded-full"
                  />
                  <motion.div
                    animate={{
                      scale: [1, 1.6, 2.2],
                      opacity: [0.5, 0.2, 0],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: 'easeOut',
                      delay: 0.6,
                    }}
                    className="absolute inset-0 bg-indigo-400 rounded-full"
                  />
                </>
              )}
              {/* Pulse background */}
              <motion.div
                variants={pulseVariants}
                animate="animate"
                className="absolute inset-0 bg-blue-400 rounded-full blur-xl"
              />
              <motion.div
                animate={
                  shouldReduceMotion
                    ? {}
                    : {
                        rotate: [0, 10, -10, 0],
                      }
                }
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="relative p-5 bg-linear-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-full shadow-2xl"
              >
                <ListChecks className="w-10 h-10 text-white" />
              </motion.div>
            </div>
          </motion.div>

          {/* Features */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap justify-center gap-6 mb-10 text-sm text-muted-foreground"
          >
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-linear-to-r from-blue-500 to-indigo-600 rounded-full"></div>
                <span>{totalChecklists} Interactive Checklists</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-linear-to-r from-indigo-500 to-purple-600 rounded-full"></div>
                <span>{categories.length} Categories</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-linear-to-r from-green-500 to-emerald-600 rounded-full"></div>
                <span>Auto-Save Progress</span>
              </div>
            </div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: shouldReduceMotion ? 0 : 1,
              duration: shouldReduceMotion ? 0.01 : 0.5,
            }}
            className="flex flex-col items-center gap-2 text-sm text-muted-foreground"
          >
            <span>Explore checklists</span>
            <motion.div
              animate={shouldReduceMotion ? {} : { y: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ChevronDown className="w-5 h-5" />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
