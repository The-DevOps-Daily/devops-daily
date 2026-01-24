'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  MousePointerClick,
  ChevronDown,
  Code,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
  TrendingUp,
  Award,
  Shuffle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodeBlockWrapper } from '@/components/code-block-wrapper';
import type { InterviewQuestion, ExperienceTier } from '@/lib/interview-utils';
import {
  getDifficultyColor,
  markQuestionReviewed,
  getInterviewProgress,
} from '@/lib/interview-utils';

const tierConfig = {
  junior: {
    title: 'Junior',
    subtitle: '0-2 years experience',
    icon: Users,
    gradient: 'from-emerald-500 to-teal-600',
    accentColor: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  mid: {
    title: 'Mid-Level',
    subtitle: '2-5 years experience',
    icon: TrendingUp,
    gradient: 'from-blue-500 to-indigo-600',
    accentColor: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
  },
  senior: {
    title: 'Senior',
    subtitle: '5+ years experience',
    icon: Award,
    gradient: 'from-purple-500 to-pink-600',
    accentColor: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
  },
};

interface InterviewTierPageProps {
  tier: ExperienceTier;
  questions: InterviewQuestion[];
  categories: string[];
}

function QuestionCard({ question }: { question: InterviewQuestion }) {
  const [expanded, setExpanded] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<'none' | 'confident' | 'needs-review'>(() => {
    if (typeof window === 'undefined') return 'none';
    const progress = getInterviewProgress();
    const questionProgress = progress[question.id];
    if (!questionProgress?.reviewed) return 'none';
    return questionProgress.confident ? 'confident' : 'needs-review';
  });

  const handleMarkReviewed = (confident: boolean) => {
    markQuestionReviewed(question.id, confident);
    setReviewStatus(confident ? 'confident' : 'needs-review');
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Question header - clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                {question.category}
              </span>
              <span
                className={`px-2.5 py-1 text-xs font-medium rounded-full ${getDifficultyColor(question.difficulty)}`}
              >
                {question.difficulty}
              </span>
              {reviewStatus === 'confident' && (
                <span className="px-2.5 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Got it
                </span>
              )}
              {reviewStatus === 'needs-review' && (
                <span className="px-2.5 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Review
                </span>
              )}
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {question.question}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 hidden sm:inline">
              {expanded ? 'Hide' : 'Show'} answer
            </span>
            <ChevronDown
              className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-5 space-y-5 bg-gray-50/50 dark:bg-gray-900/30">
          {/* Answer */}
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <h4 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">
              Answer
            </h4>
            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
              {question.answer}
            </p>
          </div>

          {/* Explanation */}
          {question.explanation && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Detailed Explanation
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                {question.explanation}
              </p>
            </div>
          )}

          {/* Code Examples */}
          {question.codeExamples && question.codeExamples.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Code className="w-4 h-4 text-gray-500" />
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Code Examples
                </h4>
              </div>
              <div className="space-y-3">
                {question.codeExamples.map((example, index) => (
                  <div key={index}>
                    {example.label && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        {example.label}
                      </p>
                    )}
                    <CodeBlockWrapper
                      language={example.language}
                      code={example.code}
                      showLineNumbers={false}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Common Mistakes */}
          {question.commonMistakes && question.commonMistakes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Common Mistakes to Avoid
                </h4>
              </div>
              <ul className="space-y-2">
                {question.commonMistakes.map((mistake, index) => (
                  <li
                    key={index}
                    className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                  >
                    <span className="text-amber-500 mt-1">•</span>
                    {mistake}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Follow-up Questions */}
          {question.followUpQuestions && question.followUpQuestions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Follow-up Questions
              </h4>
              <ul className="space-y-1">
                {question.followUpQuestions.map((fq, index) => (
                  <li
                    key={index}
                    className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                  >
                    <span className="text-primary">→</span>
                    {fq}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Self-assessment buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">How did you do?</span>
            <button
              onClick={() => handleMarkReviewed(true)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                reviewStatus === 'confident'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              Got it
            </button>
            <button
              onClick={() => handleMarkReviewed(false)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                reviewStatus === 'needs-review'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
              }`}
            >
              <XCircle className="w-4 h-4" />
              Need review
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function InterviewTierPage({ tier, questions, categories }: InterviewTierPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [shuffled, setShuffled] = useState(false);

  const config = tierConfig[tier];
  const Icon = config.icon;

  const tierCategories = useMemo(() => {
    const cats = new Set(questions.map((q) => q.category));
    return ['all', ...Array.from(cats).sort()];
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    let filtered = questions.filter((question) => {
      const matchesSearch =
        searchQuery === '' ||
        question.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        question.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        question.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === 'all' || question.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });

    if (shuffled) {
      filtered = [...filtered].sort(() => Math.random() - 0.5);
    }

    return filtered;
  }, [questions, searchQuery, selectedCategory, shuffled]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header */}
      <section className={`relative overflow-hidden ${config.bgColor} py-12`}>
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back link */}
          <Link
            href="/interview-questions"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to all levels
          </Link>

          <div className="flex items-start gap-4">
            <div
              className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${config.gradient} shadow-lg`}
            >
              <Icon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {config.title} Interview Questions
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {config.subtitle} • {questions.length} questions
              </p>
            </div>
          </div>

          {/* Hint */}
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-white/60 dark:bg-gray-800/60 rounded-lg text-sm text-gray-600 dark:text-gray-400">
            <MousePointerClick className="w-4 h-4" />
            <span>Click on any question to reveal the answer</span>
          </div>
        </div>
      </section>

      {/* Questions */}
      <section className="py-8 container mx-auto px-4 max-w-4xl">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {tierCategories.map((category) => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            onClick={() => setShuffled(!shuffled)}
            className={`gap-2 ${shuffled ? 'bg-primary/10' : ''}`}
          >
            <Shuffle className="w-4 h-4" />
            Shuffle
          </Button>
        </div>

        {/* Results count */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Showing {filteredQuestions.length} of {questions.length} questions
        </p>

        {/* Questions list */}
        <div className="space-y-4">
          {filteredQuestions.map((question) => (
            <QuestionCard key={question.id} question={question} />
          ))}
        </div>

        {filteredQuestions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No questions found matching your criteria.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
