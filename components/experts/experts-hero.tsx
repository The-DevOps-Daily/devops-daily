'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Users, ChevronDown } from 'lucide-react';

interface ExpertsHeroProps {
  totalExperts: number;
  specialties: string[];
}

export function ExpertsHero({ totalExperts, specialties }: ExpertsHeroProps) {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.12,
        delayChildren: shouldReduceMotion ? 0 : 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.5,
        ease: 'easeOut',
      },
    },
  };

  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-br from-background via-background/95 to-emerald-50/30 dark:to-emerald-950/20 pt-24 pb-20">
      {/* Background - static, no animations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Static gradient orbs - no animation, just CSS */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-400/15 dark:bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-teal-400/15 dark:bg-teal-600/10 rounded-full blur-3xl" />

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
          {/* Icon */}
          <motion.div variants={itemVariants} className="flex justify-center mb-8">
            <div className="relative">
              {/* Single subtle pulse ring - CSS only on desktop */}
              {!shouldReduceMotion && (
                <div className="absolute inset-0 bg-emerald-400/20 rounded-full animate-ping hidden md:block" style={{ animationDuration: '3s' }} />
              )}
              <div className="relative p-5 bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 rounded-full shadow-2xl">
                <Users className="w-10 h-10 text-white" />
              </div>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            variants={itemVariants}
            className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          >
            <span className="text-foreground">Hire a DevOps </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400">
              Expert
            </span>
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={itemVariants}
            className="max-w-2xl mx-auto mb-10 text-lg leading-relaxed sm:text-xl text-muted-foreground"
          >
            Connect with experienced DevOps engineers, cloud architects, and infrastructure specialists
            for consulting, training, and implementation services.
          </motion.p>

          {/* Features */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap justify-center gap-4 mb-10 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full" />
              <span>{totalExperts} {totalExperts === 1 ? 'Expert' : 'Experts'} Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-r from-teal-500 to-cyan-600 rounded-full" />
              <span>{specialties.length}+ Specialties</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full" />
              <span>Vetted Professionals</span>
            </div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col items-center gap-2 text-sm text-muted-foreground"
          >
            <span>Browse Experts</span>
            <ChevronDown className="w-5 h-5 animate-bounce" style={{ animationDuration: '2s' }} />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
