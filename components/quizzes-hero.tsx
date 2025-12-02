'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  Trophy,
  Target,
  Brain,
  Sparkles,
  ChevronDown,
  Zap,
  Award,
  CheckCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface QuizzesHeroProps {
  quizCount: number;
}

export function QuizzesHero({ quizCount }: QuizzesHeroProps) {
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

  const particleVariants = {
    animate: shouldReduceMotion
      ? {}
      : (custom: number) => ({
          y: [0, -60 - custom * 25],
          x: [(custom % 2) * 20 - 10, (custom % 2) * -20 + 10],
          opacity: [0, 1, 0],
          scale: [0, 1, 0.5],
          rotate: [0, 360],
          transition: {
            duration: 3.5 + custom * 0.3,
            repeat: Infinity,
            ease: 'easeOut',
            delay: custom * 0.4,
          },
        }),
  };

  const questionMarkVariants = {
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
            delay: custom * 0.7,
          },
        }),
  };

  return (
    <section className="relative overflow-hidden bg-linear-to-b from-purple-50 via-blue-50/30 to-background dark:from-purple-950/20 dark:via-blue-950/10 dark:to-background">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          custom={1}
          variants={orbVariants}
          animate="animate"
          className="absolute w-[600px] h-[600px] bg-linear-to-r from-purple-400 to-pink-400 rounded-full blur-3xl opacity-20 dark:opacity-10 -top-48 -left-48"
        />
        <motion.div
          custom={1.5}
          variants={orbVariants}
          animate="animate"
          className="absolute w-[700px] h-[700px] bg-linear-to-r from-blue-400 to-cyan-400 rounded-full blur-3xl opacity-20 dark:opacity-10 -bottom-48 -right-48"
        />
        <motion.div
          custom={2}
          variants={orbVariants}
          animate="animate"
          className="absolute w-[500px] h-[500px] bg-linear-to-r from-indigo-400 to-purple-400 rounded-full blur-3xl opacity-15 dark:opacity-8 top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2"
        />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid-white/[0.02] dark:bg-grid-black/[0.02] pointer-events-none" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={`particle-${i}`}
            custom={i}
            variants={particleVariants}
            animate="animate"
            className="absolute w-2 h-2 bg-linear-to-br from-purple-400 to-blue-400 rounded-full"
            style={{
              left: `${8 + (i * 6.5) % 84}%`,
              bottom: '5%',
            }}
          />
        ))}
      </div>

      {/* Floating question marks */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={`qmark-${i}`}
            custom={i}
            variants={questionMarkVariants}
            animate="animate"
            className="absolute text-6xl font-bold text-purple-300/20 dark:text-purple-700/20"
            style={{
              left: `${15 + (i * 12) % 70}%`,
              top: `${20 + (i * 15) % 60}%`,
            }}
          >
            ?
          </motion.div>
        ))}
      </div>

      {/* Content */}
      <div className="container relative z-10 px-4 py-20 mx-auto sm:py-28 lg:py-32">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-5xl mx-auto text-center"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="flex justify-center mb-6">
            <Badge
              variant="outline"
              className="px-4 py-1.5 border-purple-500/50 bg-purple-500/10 backdrop-blur-sm text-purple-700 dark:text-purple-300"
            >
              <Trophy className="w-3.5 h-3.5 mr-2" />
              Test Your Knowledge
            </Badge>
          </motion.div>

          {/* Title */}
          <motion.h1
            variants={itemVariants}
            className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          >
            <motion.span
              variants={shimmerVariants}
              animate="animate"
              className="block text-transparent bg-clip-text bg-linear-to-r from-purple-600 via-blue-600 to-indigo-600 dark:from-purple-400 dark:via-blue-400 dark:to-indigo-400"
              style={{
                backgroundSize: '200% 200%',
              }}
            >
              Challenge Yourself
            </motion.span>
            <span className="block mt-2 text-foreground">Level Up Your Skills</span>
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={itemVariants}
            className="max-w-2xl mx-auto mb-10 text-lg leading-relaxed sm:text-xl text-muted-foreground"
          >
            Master DevOps with interactive quizzes designed by industry experts. Test your knowledge,
            track your progress, and earn achievements as you advance.
          </motion.p>

          {/* Stats cards */}
          <motion.div
            variants={itemVariants}
            className="grid max-w-3xl grid-cols-1 gap-6 mx-auto mb-12 sm:grid-cols-3"
          >
            {[
              {
                icon: Target,
                label: `${quizCount} Quizzes`,
                color: 'text-purple-600 dark:text-purple-400',
                bgColor: 'bg-purple-500/10',
              },
              {
                icon: Zap,
                label: 'Instant Feedback',
                color: 'text-blue-600 dark:text-blue-400',
                bgColor: 'bg-blue-500/10',
              },
              {
                icon: Award,
                label: 'Track Progress',
                color: 'text-indigo-600 dark:text-indigo-400',
                bgColor: 'bg-indigo-500/10',
              },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                whileHover={
                  shouldReduceMotion ? {} : { scale: 1.08, y: -8, rotateY: 5 }
                }
                whileTap={shouldReduceMotion ? {} : { scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative p-6 overflow-hidden transition-all duration-300 border shadow-lg group bg-background/80 backdrop-blur-sm rounded-xl hover:shadow-2xl hover:border-purple-300 dark:hover:border-purple-700 border-border"
              >
                {/* Card shine effect */}
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

          {/* Floating brain icon */}
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
                    className="absolute inset-0 bg-purple-400 rounded-full"
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
                    className="absolute inset-0 bg-blue-400 rounded-full"
                  />
                </>
              )}
              {/* Pulse background */}
              <motion.div
                variants={pulseVariants}
                animate="animate"
                className="absolute inset-0 bg-purple-400 rounded-full blur-xl"
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
                className="relative p-5 bg-linear-to-br from-purple-500 via-blue-600 to-indigo-600 rounded-full shadow-2xl"
              >
                <Brain className="w-10 h-10 text-white" />
              </motion.div>
            </div>
          </motion.div>

          {/* Features */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap justify-center gap-6 mb-10 text-sm text-muted-foreground"
          >
            {[
              { icon: CheckCircle, text: 'Real-world Scenarios' },
              { icon: Sparkles, text: 'Interactive Learning' },
              { icon: Target, text: 'Multiple Difficulty Levels' },
            ].map((feature) => (
              <div key={feature.text} className="flex items-center gap-2">
                <feature.icon className="w-4 h-4 text-purple-500" />
                <span>{feature.text}</span>
              </div>
            ))}
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
            <span>Explore quizzes below</span>
            <motion.div
              animate={
                shouldReduceMotion ? {} : { y: [0, 5, 0] }
              }
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
