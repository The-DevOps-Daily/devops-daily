'use client';

import { easeInOut, easeOut, motion, useReducedMotion } from 'framer-motion';
import { Hammer, Layers, Clock, Target, ChevronDown, Zap, Award, Timer, Brain, CheckCircle, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ExerciseHeroProps {
  totalExercises: number;
  averageTime: number
}

export function ExerciseHero({
  totalExercises,
  averageTime,
}: ExerciseHeroProps) {
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
            ease: "easeOut",
            delay: custom * 0.4,
          },
        }),
  };

  return (
    <section className="relative overflow-hidden bg-linear-to-b from-blue-50 via-cyan-50/40 to-background dark:from-blue-950/20 dark:via-cyan-950/10 dark:to-background">
      
      {/* Background Orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          custom={1}
          variants={orbVariants}
          animate="animate"
          className="absolute w-[550px] h-[550px] bg-linear-to-r from-blue-400 to-cyan-400 rounded-full blur-3xl opacity-20 dark:opacity-10 -top-40 -left-40"
        />
        <motion.div
          custom={1.5}
          variants={orbVariants}
          animate="animate"
          className="absolute w-[600px] h-[600px] bg-linear-to-r from-indigo-400 to-blue-400 rounded-full blur-3xl opacity-20 dark:opacity-10 -bottom-48 -right-48"
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
            className="absolute w-2 h-2 bg-blue-400/70 dark:bg-blue-500/70 rounded-full"
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
              className="px-4 py-1.5 border-blue-500/50 bg-blue-500/10 backdrop-blur-sm text-blue-700 dark:text-blue-300"
            >
              <Hammer className="w-3.5 h-3.5 mr-2" />
              Hands-on Practice
            </Badge>
          </motion.div>

          {/* Title */}
          <motion.h1
            variants={itemVariants}
            className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          >
            <span className="block text-transparent bg-clip-text bg-linear-to-r from-blue-600 via-cyan-600 to-indigo-600 dark:from-blue-400 dark:via-cyan-400 dark:to-indigo-400">
              Master in DevOps
            </span>
            <span className="block mt-2 text-foreground">Through Real-World Exercise</span>
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={itemVariants}
            className="max-w-2xl mx-auto mb-10 text-lg leading-relaxed sm:text-xl text-muted-foreground"
          >
            Strengthen your DevOps expertise with hands-on exercises designed to simulate
            real-world environments. Build skills through practice, not theory.
          </motion.p>

          {/* Stats cards */}
          <motion.div
            variants={itemVariants}
            className="grid max-w-3xl grid-cols-1 gap-6 mx-auto mb-12 sm:grid-cols-3"
          >
            {[
              {
                icon: Target,
                label: `${totalExercises} Exercises`,
                color: 'text-purple-600 dark:text-purple-400',
                bgColor: 'bg-purple-500/10',
              },
              {
                icon: Timer,
                label: `${averageTime} Avg. Minutes`,
                color: 'text-orange-600 dark:text-orange-400',
                bgColor: 'bg-orange-500/10',
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
                  ease: easeInOut,
                }}
                className="relative p-5 bg-linear-to-br from-purple-500 via-blue-600 to-indigo-600 rounded-full shadow-2xl"
              >
                <Brain className="w-10 h-10 text-white" />
              </motion.div>
            </div>
          </motion.div>

          {/* Scroll Indicator */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col items-center gap-2 text-sm text-muted-foreground"
          >
            <span>Browse exercises below</span>
            <motion.div
              animate={
                shouldReduceMotion ? {} : { y: [0, 5, 0] }
              }
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

        </motion.div>
      </div>

    

    </section>
  );
}
