'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronUp,
  Code,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
  TrendingUp,
  Award,
  Shuffle,
  Eye,
  EyeOff,
  Lightbulb,
  BookOpen,
  RotateCcw,
  Square,
  CheckSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodeBlockWrapper } from '@/components/code-block-wrapper';
import type { InterviewQuestion, ExperienceTier } from '@/lib/interview-utils';
import {
  getDifficultyColor,
  markQuestionReviewed,
  getInterviewProgress,
  resetInterviewProgress,
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

function PracticeCard({ question, onComplete }: { question: InterviewQuestion; onComplete: (confident: boolean) => void }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [checkedPoints, setCheckedPoints] = useState<Set<number>>(new Set());
  
  // Key points extracted from the answer for self-evaluation
  const keyPoints = useMemo(() => {
    // Split answer into sentences and take first few as key points
    const sentences = question.answer.split(/[.!]/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 4).map(s => s.trim());
  }, [question.answer]);

  const togglePoint = (index: number) => {
    const newChecked = new Set(checkedPoints);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedPoints(newChecked);
  };

  const handleComplete = (confident: boolean) => {
    onComplete(confident);
    setShowAnswer(false);
    setCheckedPoints(new Set());
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="px-3 py-1 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
            {question.category}
          </span>
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${getDifficultyColor(question.difficulty)}`}>
            {question.difficulty}
          </span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {question.title}
        </h2>
      </div>

      {/* Question */}
      <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">Interview Question</p>
            <p className="text-lg text-gray-800 dark:text-gray-200 leading-relaxed">
              {question.question}
            </p>
          </div>
        </div>
      </div>

      {/* Practice Area */}
      {!showAnswer ? (
        <div className="p-6">
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
              <EyeOff className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Take a moment to formulate your answer
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              Think about the key points you would mention in an interview
            </p>
            <Button
              onClick={() => setShowAnswer(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
            >
              <Eye className="w-4 h-4 mr-2" />
              Reveal Sample Answer
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {/* Sample Answer */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Sample Answer
            </h3>
            <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                {question.answer}
              </p>
            </div>
          </div>

          {/* Explanation */}
          {question.explanation && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                Why This Matters
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {question.explanation}
              </p>
            </div>
          )}

          {/* Self-Evaluation Checklist */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
              Self-Evaluation: Did you mention these points?
            </h3>
            <div className="space-y-2">
              {keyPoints.map((point, index) => (
                <button
                  key={index}
                  onClick={() => togglePoint(index)}
                  className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 ${
                    checkedPoints.has(index)
                      ? 'bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {checkedPoints.has(index) ? (
                    <CheckSquare className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  )}
                  <span className={`text-sm ${
                    checkedPoints.has(index)
                      ? 'text-green-800 dark:text-green-300'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {point}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Code Examples */}
          {question.codeExamples && question.codeExamples.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Code className="w-4 h-4" />
                Code Examples
              </h3>
              <div className="space-y-4">
                {question.codeExamples.map((example, index) => (
                  <div key={index}>
                    {example.label && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{example.label}</p>
                    )}
                    <CodeBlockWrapper language={example.language}>
                      {example.code}
                    </CodeBlockWrapper>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Common Mistakes */}
          {question.commonMistakes && question.commonMistakes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Common Mistakes to Avoid
              </h3>
              <ul className="space-y-2">
                {question.commonMistakes.map((mistake, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    {mistake}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Follow-up Questions */}
          {question.followUpQuestions && question.followUpQuestions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                Possible Follow-up Questions
              </h3>
              <ul className="space-y-2">
                {question.followUpQuestions.map((fq, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="text-blue-500">→</span>
                    {fq}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Self-Assessment */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
              How confident do you feel about this question?
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => handleComplete(true)}
                variant="outline"
                className="flex-1 max-w-[200px] border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Got It
              </Button>
              <Button
                onClick={() => handleComplete(false)}
                variant="outline"
                className="flex-1 max-w-[200px] border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Need Review
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function InterviewTierPage({ tier, questions, categories }: InterviewTierPageProps) {
  const config = tierConfig[tier];
  const Icon = config.icon;
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isShuffled, setIsShuffled] = useState(false);
  const [progress, setProgress] = useState<Record<string, { reviewed: boolean; confident: boolean }>>({});

  // Load progress on mount
  useEffect(() => {
    setProgress(getInterviewProgress());
  }, []);

  // Filter and optionally shuffle questions
  const filteredQuestions = useMemo(() => {
    let result = questions.filter((q) => {
      const matchesSearch =
        !searchQuery ||
        q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = !selectedCategory || q.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    if (isShuffled) {
      result = [...result].sort(() => Math.random() - 0.5);
    }

    return result;
  }, [questions, searchQuery, selectedCategory, isShuffled]);

  const currentQuestion = filteredQuestions[currentIndex];
  
  const completedCount = Object.values(progress).filter(p => p.reviewed).length;
  const confidentCount = Object.values(progress).filter(p => p.confident).length;

  const handleQuestionComplete = (confident: boolean) => {
    if (currentQuestion) {
      markQuestionReviewed(currentQuestion.id, confident);
      setProgress(getInterviewProgress());
      
      // Auto-advance to next question
      if (currentIndex < filteredQuestions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  const handleReset = () => {
    resetInterviewProgress();
    setProgress({});
    setCurrentIndex(0);
  };

  const handleShuffle = () => {
    setIsShuffled(!isShuffled);
    setCurrentIndex(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header */}
      <div className={`bg-gradient-to-r ${config.gradient} py-8`}>
        <div className="container mx-auto px-4 max-w-4xl">
          <Link
            href="/interview-questions"
            className="inline-flex items-center text-white/80 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to all levels
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Icon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{config.title} Interview Practice</h1>
              <p className="text-white/80">{config.subtitle} • {filteredQuestions.length} questions</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl py-8">
        {/* Progress Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Progress: {completedCount} of {questions.length} practiced
            </span>
            <span className="text-sm text-green-600 dark:text-green-400">
              {confidentCount} confident
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${(completedCount / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentIndex(0);
              }}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category filter */}
          <select
            value={selectedCategory || ''}
            onChange={(e) => {
              setSelectedCategory(e.target.value || null);
              setCurrentIndex(0);
            }}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Shuffle button */}
          <Button
            onClick={handleShuffle}
            variant="outline"
            className={isShuffled ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700' : ''}
          >
            <Shuffle className="w-4 h-4 mr-2" />
            {isShuffled ? 'Shuffled' : 'Shuffle'}
          </Button>

          {/* Reset button */}
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>

        {/* Question Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            variant="outline"
          >
            <ChevronUp className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Question {currentIndex + 1} of {filteredQuestions.length}
          </span>
          <Button
            onClick={() => setCurrentIndex(Math.min(filteredQuestions.length - 1, currentIndex + 1))}
            disabled={currentIndex === filteredQuestions.length - 1}
            variant="outline"
          >
            Next
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Current Question Card */}
        {currentQuestion ? (
          <PracticeCard
            key={currentQuestion.id}
            question={currentQuestion}
            onComplete={handleQuestionComplete}
          />
        ) : (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">No questions match your filters.</p>
          </div>
        )}

        {/* Question List (Quick Jump) */}
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
            All Questions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredQuestions.map((q, index) => {
              const isCompleted = progress[q.id]?.reviewed;
              const isConfident = progress[q.id]?.confident;
              const isCurrent = index === currentIndex;
              
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(index)}
                  className={`text-left p-3 rounded-lg border transition-all flex items-center gap-3 ${
                    isCurrent
                      ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    isConfident
                      ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'
                      : isCompleted
                        ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {isConfident ? '✓' : isCompleted ? '?' : index + 1}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {q.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
