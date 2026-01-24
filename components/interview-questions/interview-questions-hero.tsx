'use client';

import { Briefcase, ChevronRight, Users, TrendingUp, Award } from 'lucide-react';
import Link from 'next/link';
import type { ExperienceTier } from '@/lib/interview-utils';

interface InterviewQuestionsHeroProps {
  totalQuestions: number;
  categories: string[];
  questionsByTier: Record<ExperienceTier, number>;
}

const tierConfig = {
  junior: {
    title: 'Junior',
    subtitle: '0-2 years experience',
    description: 'Foundation questions on Linux, Git, Docker basics, and CI/CD fundamentals.',
    icon: Users,
    gradient: 'from-emerald-500 to-teal-600',
    bgGradient: 'from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-600',
  },
  mid: {
    title: 'Mid-Level',
    subtitle: '2-5 years experience',
    description: 'Intermediate questions on Kubernetes, Terraform, monitoring, and architecture.',
    icon: TrendingUp,
    gradient: 'from-blue-500 to-indigo-600',
    bgGradient: 'from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    hoverBorder: 'hover:border-blue-400 dark:hover:border-blue-600',
  },
  senior: {
    title: 'Senior',
    subtitle: '5+ years experience',
    description: 'Advanced questions on system design, incident management, and leadership.',
    icon: Award,
    gradient: 'from-purple-500 to-pink-600',
    bgGradient: 'from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    hoverBorder: 'hover:border-purple-400 dark:hover:border-purple-600',
  },
};

export function InterviewQuestionsHero({
  totalQuestions,
  categories,
  questionsByTier,
}: InterviewQuestionsHeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background py-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
            <Briefcase className="w-4 h-4" />
            <span className="text-sm font-medium">Interview Preparation</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            DevOps Interview Questions
          </h1>

          <p className="text-lg text-gray-600 dark:text-gray-400">
            {totalQuestions} curated questions across {categories.length} categories.
            <span className="block mt-1 text-base">
              Select your experience level to start practicing.
            </span>
          </p>
        </div>

        {/* Tier List */}
        <div className="flex flex-col gap-4">
          {(['junior', 'mid', 'senior'] as ExperienceTier[]).map((tier) => {
            const config = tierConfig[tier];
            const Icon = config.icon;
            const questionCount = questionsByTier[tier] || 0;

            return (
              <Link
                key={tier}
                href={`/interview-questions/${tier}`}
                className={`group relative overflow-hidden rounded-xl border-2 ${config.borderColor} ${config.hoverBorder} bg-gradient-to-br ${config.bgGradient} p-5 transition-all duration-300 hover:shadow-lg`}
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br ${config.gradient}`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {config.title}
                      </h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {config.subtitle}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {config.description}
                    </p>
                  </div>

                  {/* Right side */}
                  <div className="flex-shrink-0 flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {questionCount} questions
                    </span>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>

                {/* Decorative element */}
                <div
                  className={`absolute -right-8 -top-8 w-24 h-24 rounded-full bg-gradient-to-br ${config.gradient} opacity-10 group-hover:opacity-20 transition-opacity`}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
