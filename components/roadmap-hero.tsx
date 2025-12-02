'use client';

import { motion } from 'framer-motion';
import { Rocket, TrendingUp, Target, Sparkles, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function RoadmapHero() {
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: 'easeOut',
      },
    },
  };

  const floatingVariants = {
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  };

  const pulseVariants = {
   animate: {
     scale: [1, 1.05, 1],
     opacity: [0.5, 0.8, 0.5],
     transition: {
       duration: 2,
       repeat: Infinity,
       ease: 'easeInOut',
     },
   },
 };

  const orbVariants = {
    animate: (custom: number) => ({
      x: [0, custom * 30, 0],
      y: [0, custom * -20, 0],
      scale: [1, 1.2, 1],
      transition: {
        duration: 8 + custom * 2,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    }),
  };

  const shimmerVariants = {
    animate: {
      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
      transition: {
        duration: 5,
        repeat: Infinity,
        ease: 'linear',
      },
    },
  };

  const particleVariants = {
    animate: (custom: number) => ({
      y: [0, -50 - custom * 20],
      opacity: [0, 1, 0],
      transition: {
        duration: 3 + custom * 0.5,
        repeat: Infinity,
        ease: 'easeOut',
        delay: custom * 0.5,
      },
    }),
  };

 return (
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-purple-50/30 to-background dark:from-blue-950/20 dark:via-purple-950/10 dark:to-background">
     {/* Animated gradient orbs */}
     <div className="absolute inset-0 overflow-hidden pointer-events-none">
       <motion.div
         custom={1}
         variants={orbVariants}
         animate="animate"
         className="absolute w-[500px] h-[500px] bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full blur-3xl opacity-20 dark:opacity-10 -top-48 -left-48"
       />
       <motion.div
         custom={1.5}
         variants={orbVariants}
         animate="animate"
         className="absolute w-[600px] h-[600px] bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-3xl opacity-20 dark:opacity-10 -bottom-48 -right-48"
       />
       <motion.div
         custom={2}
         variants={orbVariants}
         animate="animate"
         className="absolute w-[400px] h-[400px] bg-gradient-to-r from-orange-400 to-yellow-400 rounded-full blur-3xl opacity-15 dark:opacity-8 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
       />
     </div>

     {/* Floating particles */}
     <div className="absolute inset-0 overflow-hidden pointer-events-none">
       {[...Array(12)].map((_, i) => (
         <motion.div
           key={i}
           custom={i}
           variants={particleVariants}
           animate="animate"
           className="absolute w-2 h-2 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full"
           style={{
             left: `${10 + (i * 8) % 80}%`,
             bottom: '10%',
           }}
         />
       ))}
    </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: '4rem 4rem',
        }}
      />

      <div className="container relative px-4 py-16 mx-auto sm:px-6 lg:px-8 md:py-24">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-4xl mx-auto text-center"
        >
          {/* Badge with floating animation */}
          <motion.div variants={itemVariants} className="flex justify-center mb-6">
            <Badge
              variant="secondary"
              className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 border-blue-200 dark:border-blue-800"
            >
              <Sparkles className="inline-block w-4 h-4 mr-2 text-yellow-500 animate-pulse" />
              Your Complete DevOps Learning Path
            </Badge>
          </motion.div>

          {/* Main heading with gradient */}
          <motion.h1
            variants={itemVariants}
           className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
         >
           <motion.span
             variants={shimmerVariants}
             animate="animate"
             className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400"
             style={{
               backgroundSize: '200% 200%',
             }}
           >
             Excel in DevOps
           </motion.span>
           <span className="block mt-2 text-foreground">From Zero to Hero</span>
         </motion.h1>

          {/* Description */}
          <motion.p
            variants={itemVariants}
           className="max-w-2xl mx-auto mb-10 text-lg leading-relaxed sm:text-xl text-muted-foreground"
         >
           A comprehensive, structured roadmap designed to guide you through every stage of your
           DevOps career: from foundational skills to senior-level expertise.
         </motion.p>

          {/* Stats with animated cards */}
          <motion.div
            variants={itemVariants}
            className="grid max-w-3xl grid-cols-1 gap-6 mx-auto mb-12 sm:grid-cols-3"
          >
            {[
              { icon: Target, label: '6 Career Stages', color: 'text-blue-600 dark:text-blue-400' },
              {
                icon: TrendingUp,
                label: '150+ Skills',
                color: 'text-purple-600 dark:text-purple-400',
              },
              { icon: Rocket, label: '500+ Resources', color: 'text-pink-600 dark:text-pink-400' },
            ].map((stat, index) => (
             <motion.div
               key={stat.label}
               whileHover={{ scale: 1.08, y: -8, rotateY: 5 }}
               whileTap={{ scale: 0.95 }}
               transition={{ duration: 0.2 }}
               className="p-6 transition-all duration-300 border shadow-lg bg-background/80 backdrop-blur-sm rounded-xl hover:shadow-2xl hover:border-blue-300 dark:hover:border-blue-700 border-border relative overflow-hidden group"
             >
               {/* Card shine effect on hover */}
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
               <stat.icon className={`w-8 h-8 mx-auto mb-3 ${stat.color}`} />
               <p className="text-sm font-semibold text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Floating rocket icon */}
          <motion.div
            variants={floatingVariants}
            animate="animate"
            className="flex justify-center mb-8"
         >
           <div className="relative">
             {/* Multiple pulse rings */}
             <motion.div
               animate={{
                 scale: [1, 1.5, 2],
                 opacity: [0.5, 0.2, 0],
               }}
               transition={{
                 duration: 2,
                 repeat: Infinity,
                 ease: 'easeOut',
               }}
               className="absolute inset-0 bg-blue-400 rounded-full"
             />
             <motion.div
               animate={{
                 scale: [1, 1.5, 2],
                 opacity: [0.5, 0.2, 0],
               }}
               transition={{
                 duration: 2,
                 repeat: Infinity,
                 ease: 'easeOut',
                 delay: 0.5,
               }}
               className="absolute inset-0 bg-purple-400 rounded-full"
             />
             {/* Pulse background effect */}
             <motion.div
               variants={pulseVariants}
               animate="animate"
               className="absolute inset-0 bg-blue-400 rounded-full blur-xl"
             />
             <motion.div
               animate={{
                 rotate: [0, 5, -5, 0],
               }}
               transition={{
                 duration: 4,
                 repeat: Infinity,
                 ease: 'easeInOut',
               }}
               className="relative p-4 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-full shadow-2xl"
             >
               <Rocket className="w-8 h-8 text-white" />
             </motion.div>
           </div>
         </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="flex flex-col items-center gap-2 text-sm text-muted-foreground"
          >
            <span>Scroll to explore the roadmap</span>
            <motion.div
              animate={{ y: [0, 5, 0] }}
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
