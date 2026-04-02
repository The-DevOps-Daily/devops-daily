'use client';

import { easeInOut, easeOut, motion, useReducedMotion } from 'framer-motion';
import { Scale, ChevronDown, Zap, BarChart3, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ComparisonsHeroProps {
  totalComparisons: number;
}

export function ComparisonsHero({ totalComparisons }: ComparisonsHeroProps) {
  const shouldReduceMotion = useReducedMotion();

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
        ease: easeOut,
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
            ease: easeInOut,
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
            ease: easeInOut,
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
            ease: easeInOut,
          },
        }),
  };

  const particleVariants = {
    animate: shouldReduceMotion
      ? {}
      : (custom: number) => ({
          y: [0, -50 - custom * 20],
          opacity: [0, 1, 0],
          scale: [0.6, 1, 0.5],
          rotate: [0, 360],
          transition: {
            duration: 3 + custom * 0.3,
            repeat: Infinity,
            ease: 'easeOut' as const,
            delay: custom * 0.4,
          },
        }),
  };

  return (
    <section className="relative overflow-hidden bg-linear-to-b from-indigo-50 via-purple-50/40 to-background dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-background">
      {/* Background Orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          custom={1}
          variants={orbVariants}
          animate="animate"
          className="absolute w-[550px] h-[550px] bg-linear-to-r from-indigo-400 to-purple-400 rounded-full blur-3xl opacity-20 dark:opacity-10 -top-40 -left-40"
        />
        <motion.div
          custom={1.5}
          variants={orbVariants}
          animate="animate"
          className="absolute w-[600px] h-[600px] bg-linear-to-r from-purple-400 to-pink-400 rounded-full blur-3xl opacity-20 dark:opacity-10 -bottom-48 -right-48"
        />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-grid-white/[0.02] dark:bg-grid-black/[0.02] pointer-events-none" />

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            custom={i}
            variants={particleVariants}
            animate="animate"
            className="absolute w-2 h-2 bg-indigo-400/70 dark:bg-indigo-500/70 rounded-full"
            style={{
              left: `${10 + (i * 7) % 80}%`,
              bottom: '5%',
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="container relative z-10 px-4 py-20 mx-auto sm:py-28 lg:py-32">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-4xl mx-auto text-center"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="flex justify-center mb-6">
            <Badge
              variant="outline"
              className="px-4 py-1.5 border-indigo-500/50 bg-indigo-500/10 backdrop-blur-sm text-indigo-700 dark:text-indigo-300"
            >
              <Scale className="w-3.5 h-3.5 mr-2" />
              Tool Comparisons
            </Badge>
          </motion.div>

          {/* Title */}
          <motion.h1
            variants={itemVariants}
            className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          >
            <span className="block text-transparent bg-clip-text bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400">
              DevOps Tool
            </span>
            <span className="block mt-2 text-foreground">Comparisons</span>
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={itemVariants}
            className="max-w-2xl mx-auto mb-10 text-lg leading-relaxed sm:text-xl text-muted-foreground"
          >
            Side-by-side comparisons of popular DevOps tools. Feature tables,
            pros and cons, use cases, and honest verdicts to help you make
            informed decisions.
          </motion.p>

          {/* Stats cards */}
          <motion.div
            variants={itemVariants}
            className="grid max-w-3xl grid-cols-1 gap-6 mx-auto mb-12 sm:grid-cols-3"
          >
            {[
              {
                icon: Scale,
                label: `${totalComparisons} Comparisons`,
                color: 'text-indigo-600 dark:text-indigo-400',
                bgColor: 'bg-indigo-500/10',
              },
              {
                icon: BarChart3,
                label: 'Feature Tables',
                color: 'text-purple-600 dark:text-purple-400',
                bgColor: 'bg-purple-500/10',
              },
              {
                icon: Target,
                label: 'Decision Matrix',
                color: 'text-pink-600 dark:text-pink-400',
                bgColor: 'bg-pink-500/10',
              },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                whileHover={
                  shouldReduceMotion ? {} : { scale: 1.08, y: -8, rotateY: 5 }
                }
                whileTap={shouldReduceMotion ? {} : { scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative p-6 overflow-hidden transition-all duration-300 border shadow-lg group bg-background/80 backdrop-blur-sm rounded-xl hover:shadow-2xl hover:border-indigo-300 dark:hover:border-indigo-700 border-border"
              >
                <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <div
                  className={`w-12 h-12 mx-auto mb-3 flex items-center justify-center rounded-lg ${stat.bgColor}`}
                >
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Floating VS icon */}
          <motion.div
            variants={floatingVariants}
            animate="animate"
            className="flex justify-center mb-8"
          >
            <div className="relative">
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
                    className="absolute inset-0 bg-indigo-400 rounded-full"
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
                    className="absolute inset-0 bg-purple-400 rounded-full"
                  />
                </>
              )}
              <motion.div
                variants={pulseVariants}
                animate="animate"
                className="absolute inset-0 bg-indigo-400 rounded-full blur-xl"
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
                  ease: easeInOut,
                }}
                className="relative p-5 bg-linear-to-br from-indigo-500 via-purple-600 to-pink-600 rounded-full shadow-2xl"
              >
                <span className="text-2xl font-black text-white">VS</span>
              </motion.div>
            </div>
          </motion.div>

          {/* Scroll Indicator */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col items-center gap-2 text-sm text-muted-foreground"
          >
            <span>Browse comparisons below</span>
            <motion.div
              animate={shouldReduceMotion ? {} : { y: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ChevronDown className="w-5 h-5" />
            </motion.div>
          </motion.div>

          {/* Features */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap justify-center gap-6 mb-10 text-sm text-muted-foreground"
          >
            {[
              { icon: Zap, text: 'Honest Verdicts' },
              { icon: BarChart3, text: 'Feature Comparison Tables' },
              { icon: Target, text: 'Use Case Recommendations' },
            ].map((feature) => (
              <div key={feature.text} className="flex items-center gap-2">
                <feature.icon className="w-4 h-4 text-indigo-500" />
                <span>{feature.text}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
