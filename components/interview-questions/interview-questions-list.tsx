'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, ChevronRight, Play, BookOpen } from 'lucide-react';
import type { InterviewQuestion } from '@/lib/interview-utils';
import { getDifficultyColor } from '@/lib/interview-utils';
import { InterviewQuizMode } from './interview-quiz-mode';
import { Button } from '@/components/ui/button';

interface InterviewQuestionsListProps {
  questions: InterviewQuestion[];
}

export function InterviewQuestionsList({ questions }: InterviewQuestionsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [quizMode, setQuizMode] = useState(false);

  const categories = useMemo(() => {
    return ['all', ...Array.from(new Set(questions.map(q => q.category))).sort()];
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter(question => {
      const matchesSearch = searchQuery === '' ||
        question.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        question.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        question.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || question.category === selectedCategory;
      const matchesDifficulty = selectedDifficulty === 'all' || question.difficulty === selectedDifficulty;
      
      return matchesSearch && matchesCategory && matchesDifficulty;
    });
  }, [questions, searchQuery, selectedCategory, selectedDifficulty]);

  // Quiz mode view
  if (quizMode) {
    const quizQuestions = selectedCategory === 'all' 
      ? filteredQuestions 
      : filteredQuestions.filter(q => q.category === selectedCategory);
    
    return (
      <InterviewQuizMode
        questions={quizQuestions}
        category={selectedCategory === 'all' ? undefined : selectedCategory}
        onExit={() => setQuizMode(false)}
      />
    );
  }

  return (
    <div>
      {/* Quiz Mode Toggle */}
      <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Play className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Quiz Mode</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Test yourself on {filteredQuestions.length} questions
            </p>
          </div>
        </div>
        <Button onClick={() => setQuizMode(true)} className="gap-2">
          <Play className="h-4 w-4" />
          Start Quiz
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {categories.map(category => (
            <option key={category} value={category}>
              {category === 'all' ? 'All Categories' : category}
            </option>
          ))}
        </select>
        
        <select
          value={selectedDifficulty}
          onChange={(e) => setSelectedDifficulty(e.target.value)}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">All Difficulties</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Showing {filteredQuestions.length} of {questions.length} questions
      </p>

      {/* Questions list */}
      <div className="space-y-4">
        {filteredQuestions.map((question) => (
          <Link
            key={question.id}
            href={`/interview-questions/${question.slug}`}
            className="block p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                    {question.category}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${getDifficultyColor(question.difficulty)}`}>
                    {question.difficulty}
                  </span>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-primary transition-colors">
                  {question.title}
                </h3>
                
                <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">
                  {question.question}
                </p>
                
                <div className="flex flex-wrap gap-1 mt-3">
                  {question.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  {question.tags.length > 4 && (
                    <span className="px-2 py-0.5 text-xs text-gray-400">
                      +{question.tags.length - 4} more
                    </span>
                  )}
                </div>
              </div>
              
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors flex-shrink-0" />
            </div>
          </Link>
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
