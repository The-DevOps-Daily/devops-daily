'use client';

import { Briefcase, Search, Filter } from 'lucide-react';

interface InterviewQuestionsHeroProps {
  totalQuestions: number;
  categories: string[];
}

export function InterviewQuestionsHero({ totalQuestions, categories }: InterviewQuestionsHeroProps) {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-primary/5 via-background to-background py-16">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
            <Briefcase className="w-4 h-4" />
            <span className="text-sm font-medium">Interview Preparation</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            DevOps Interview Questions
          </h1>
          
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            In-depth interview questions with detailed answers, code examples, and expert explanations. 
            Master Kubernetes, Docker, Terraform, CI/CD, and more.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <Search className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-gray-100">{totalQuestions}</strong> Questions
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-gray-100">{categories.length}</strong> Categories
              </span>
            </div>
          </div>
          
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <span
                key={category}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full"
              >
                {category}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
