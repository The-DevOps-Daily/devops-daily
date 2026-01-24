'use client';

import { Briefcase, ChevronRight, Users, TrendingUp, Award, Target, BookOpen, Brain } from 'lucide-react';
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
    subtitle: '0-2 years',
    description: 'Linux, Git, Docker basics, CI/CD fundamentals',
    icon: Users,
    gradient: 'from-emerald-500 to-teal-600',
    bgGradient: 'from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-600',
  },
  mid: {
    title: 'Mid-Level',
    subtitle: '2-5 years',
    description: 'Kubernetes, Terraform, monitoring, architecture',
    icon: TrendingUp,
    gradient: 'from-blue-500 to-indigo-600',
    bgGradient: 'from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    hoverBorder: 'hover:border-blue-400 dark:hover:border-blue-600',
  },
  senior: {
    title: 'Senior',
    subtitle: '5+ years',
    description: 'System design, incident management, leadership',
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
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <Briefcase className="w-4 h-4" />
            <span className="text-sm font-medium">Mock Interview Practice</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            DevOps Interview Questions
          </h1>

          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Practice {totalQuestions} real interview questions with hidden answers.
            Think through each question, then reveal the sample answer to compare.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">1. Think First</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Read the question and formulate your answer</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <BookOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">2. Compare</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Reveal the sample answer and key points</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">3. Track Progress</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Mark your confidence level and review weak areas</p>
            </div>
          </div>
        </div>

        {/* Tier List */}
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
          Choose Your Level
        </h2>
        <div className="flex flex-col gap-3">
          {(['junior', 'mid', 'senior'] as ExperienceTier[]).map((tier) => {
            const config = tierConfig[tier];
            const Icon = config.icon;
            const questionCount = questionsByTier[tier] || 0;

            return (
              <Link
                key={tier}
                href={`/interview-questions/${tier}`}
                className={`group relative overflow-hidden rounded-xl border-2 ${config.borderColor} ${config.hoverBorder} bg-gradient-to-br ${config.bgGradient} p-4 transition-all duration-300 hover:shadow-lg`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${config.gradient}`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
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

                  <div className="flex-shrink-0 flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {questionCount} questions
                    </span>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>

                <div
                  className={`absolute -right-8 -top-8 w-20 h-20 rounded-full bg-gradient-to-br ${config.gradient} opacity-10 group-hover:opacity-20 transition-opacity`}
                />
              </Link>
            );
          })}
        </div>

       {/* Note about quizzes */}
       <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center leading-relaxed">
            <span className="font-medium text-gray-700 dark:text-gray-300">This page is for practice</span> — compare your answers with real-world responses to improve your interview skills.{' '}
            <span className="block mt-2">
              Want to test your knowledge with scored assessments?{' '}
              <Link href="/quizzes" className="text-primary hover:underline font-medium">
                Take our DevOps Quizzes →
              </Link>
            </span>
          </p>
       </div>
      </div>
    </section>
  );
}
