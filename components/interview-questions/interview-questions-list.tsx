'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  Play,
  Code,
  AlertTriangle,
  ExternalLink,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import type { InterviewQuestion } from '@/lib/interview-utils';
import {
  getDifficultyColor,
  markQuestionReviewed,
  getInterviewProgress,
} from '@/lib/interview-utils';
import { InterviewQuizMode } from './interview-quiz-mode';
import { Button } from '@/components/ui/button';
import { CodeBlockWrapper } from '@/components/code-block-wrapper';

interface InterviewQuestionsListProps {
  questions: InterviewQuestion[];
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
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Question header - clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                {question.category}
              </span>
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded ${getDifficultyColor(question.difficulty)}`}
              >
                {question.difficulty}
              </span>
              {reviewStatus === 'confident' && (
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Confident
                </span>
              )}
              {reviewStatus === 'needs-review' && (
                <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Needs Practice
                </span>
              )}
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {question.title}
            </h3>

            <p className="text-gray-600 dark:text-gray-400 text-sm">{question.question}</p>
          </div>

          <ChevronDown
            className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
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
            <p className="text-gray-700 dark:text-gray-300 text-sm">{question.answer}</p>
          </div>

          {/* Explanation */}
          {question.explanation && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Detailed Explanation
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{question.explanation}</p>
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
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {example.label}
                      </p>
                    )}
                    <CodeBlockWrapper language={example.language}>{example.code}</CodeBlockWrapper>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Common Mistakes */}
          {question.commonMistakes && question.commonMistakes.length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Common Mistakes
                </h4>
              </div>
              <ul className="space-y-1">
                {question.commonMistakes.map((mistake, index) => (
                  <li
                    key={index}
                    className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                  >
                    <span className="text-amber-500">\u2022</span>
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
                {question.followUpQuestions.map((followUp, index) => (
                  <li
                    key={index}
                    className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                  >
                    <span className="text-primary font-medium">{index + 1}.</span>
                    {followUp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Resources */}
          {question.resources && question.resources.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Learn More
              </h4>
              <ul className="space-y-1">
                {question.resources.map((resource, index) => (
                  <li key={index}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {resource.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Self-assessment */}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">How did you do?</span>
            <button
              onClick={() => handleMarkReviewed(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                reviewStatus === 'confident'
                  ? 'bg-green-500 text-white'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              Got it!
            </button>
            <button
              onClick={() => handleMarkReviewed(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                reviewStatus === 'needs-review'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
              }`}
            >
              <XCircle className="w-4 h-4" />
              Need practice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function InterviewQuestionsList({ questions }: InterviewQuestionsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [quizMode, setQuizMode] = useState(false);

  const categories = useMemo(() => {
    return ['all', ...Array.from(new Set(questions.map((q) => q.category))).sort()];
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((question) => {
      const matchesSearch =
        searchQuery === '' ||
        question.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        question.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        question.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === 'all' || question.category === selectedCategory;
      const matchesDifficulty =
        selectedDifficulty === 'all' || question.difficulty === selectedDifficulty;

      return matchesSearch && matchesCategory && matchesDifficulty;
    });
  }, [questions, searchQuery, selectedCategory, selectedDifficulty]);

  if (quizMode) {
    return (
      <InterviewQuizMode
        questions={filteredQuestions}
        category={selectedCategory === 'all' ? undefined : selectedCategory}
        onExit={() => setQuizMode(false)}
      />
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category === 'all' ? 'All Categories' : category}
            </option>
          ))}
        </select>

        <select
          value={selectedDifficulty}
          onChange={(e) => setSelectedDifficulty(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">All Difficulties</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>

        <Button onClick={() => setQuizMode(true)} variant="outline" className="gap-2">
          <Play className="h-4 w-4" />
          Quiz Mode
        </Button>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
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
    </div>
  );
}
