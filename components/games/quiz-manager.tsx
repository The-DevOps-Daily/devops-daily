'use client';

import { memo, useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuizFilters, DifficultyLevel, SortConfig, SortField, SortDirection } from '@/components/quiz-filters';
import {
  GitBranch,
  Code,
  Terminal,
  Target,
  BookOpen,
  Zap,
  Trophy,
  Star,
  Sparkles,
  Clock,
  AlertTriangle,
  Package,
  DollarSign,
  Database,
 Briefcase,
Shield,
 Lock,
  Settings,
  Workflow,
  Network,
  Calculator,
  Cpu,
  type LucideIcon,
} from 'lucide-react';
import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Icon mapping for dynamic rendering
const iconMap = {
  AlertTriangle,
  GitBranch,
  Code,
  Terminal,
  Target,
  BookOpen,
  Zap,
  Trophy,
  Star,
  Sparkles,
  Package,
  Clock,
  DollarSign,
  Database,
 Briefcase,
Shield,
 Lock,
  Settings,
  Workflow,
  Network,
  Calculator,
  Cpu,
};

// Add GraduationCap to iconMap
const iconMapExtended = {
  ...iconMap,
  GraduationCap,
};

// Helper function to format difficulty labels
const formatDifficultyLabel = (difficulty: string): string => {
  const labels: Record<string, string> = {
    beginner: 'Beginner/Junior',
    intermediate: 'Intermediate/Mid',
    advanced: 'Advanced/Senior',
  };
  return labels[difficulty] || difficulty;
};

interface QuizMetadata {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  totalQuestions: number;
  totalPoints: number;
  estimatedTime: string;
  theme: {
    primaryColor: string;
    gradientFrom: string;
    gradientTo: string;
  };
  difficultyLevels: {
    beginner: number;
    intermediate: number;
    advanced: number;
  };
  createdDate?: string;
}

interface QuizManagerProps {
  quizzes: QuizMetadata[];
  className?: string;
}

export function QuizManager({ quizzes, className }: QuizManagerProps) {
  // Filter and sort state
 const [selectedCategory, setSelectedCategory] = useState<string>('all');
 const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'date', direction: 'desc' });

 // Load filter preferences from localStorage on mount
 useEffect(() => {
   const savedCategory = localStorage.getItem('quizFilterCategory');
   const savedDifficulty = localStorage.getItem('quizFilterDifficulty');
    const savedSortField = localStorage.getItem('quizFilterSortField');
    const savedSortDirection = localStorage.getItem('quizFilterSortDirection');

   if (savedCategory) setSelectedCategory(savedCategory);
   if (savedDifficulty) setSelectedDifficulty(savedDifficulty as DifficultyLevel);
    if (savedSortField && savedSortDirection) {
      setSortConfig({ 
        field: savedSortField as SortField, 
        direction: savedSortDirection as SortDirection 
      });
    }
 }, []);

 // Save filter preferences to localStorage
 useEffect(() => {
   localStorage.setItem('quizFilterCategory', selectedCategory);
   localStorage.setItem('quizFilterDifficulty', selectedDifficulty);
    localStorage.setItem('quizFilterSortField', sortConfig.field);
    localStorage.setItem('quizFilterSortDirection', sortConfig.direction);
  }, [selectedCategory, selectedDifficulty, sortConfig]);

 // Get unique categories
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(quizzes.map((quiz) => quiz.category)));
    return uniqueCategories.sort();
  }, [quizzes]);

  // Determine quiz difficulty level
  const getQuizDifficulty = (quiz: QuizMetadata): DifficultyLevel => {
    const levels = quiz.difficultyLevels;
    const total = levels.beginner + levels.intermediate + levels.advanced;
    const beginnerPct = levels.beginner / total;
    const intermediatePct = levels.intermediate / total;
    const advancedPct = levels.advanced / total;
    
    const title = quiz.title.toLowerCase();

    // Explicit beginner indicators
    if (title.includes('junior') || title.includes('beginner')) return 'beginner';
    
    // Fundamentals quizzes with good beginner content
    if (title.includes('fundamentals') && beginnerPct >= 0.4) return 'beginner';
    
    // High beginner percentage
    if (beginnerPct >= 0.5) return 'beginner';
    
    // Advanced topics: automation tools, interview prep, incident response
    if (
      title.includes('ansible') ||
      title.includes('jenkins') ||
      (title.includes('interview') && !title.includes('junior')) ||
      title.includes('incident') ||
      (title.includes('network') && title.includes('security'))
    ) {
      return 'advanced';
    }
    
    // High advanced content with substantial intermediate
    if (advancedPct >= 0.3 && intermediatePct >= 0.35) return 'advanced';
    
    // Default to intermediate
    return 'intermediate';
  };

  // Parse estimated time for sorting
  const parseTime = (timeStr: string): number => {
    const match = timeStr.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  // Filter and sort quizzes
  const filteredAndSortedQuizzes = useMemo(() => {
    let filtered = quizzes;

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((quiz) => quiz.category === selectedCategory);
    }

    // Apply difficulty filter
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter((quiz) => getQuizDifficulty(quiz) === selectedDifficulty);
    }

    // Sort quizzes
   const sorted = [...filtered].sort((a, b) => {
      let result = 0;
      
      switch (sortConfig.field) {
        case 'date':
          const dateA = a.createdDate ? new Date(a.createdDate).getTime() : 0;
          const dateB = b.createdDate ? new Date(b.createdDate).getTime() : 0;
          result = dateA - dateB;
          break;
        case 'difficulty':
          const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3 };
          const aDiff = getQuizDifficulty(a);
          const bDiff = getQuizDifficulty(b);
          result = difficultyOrder[aDiff] - difficultyOrder[bDiff];
          break;
        case 'time':
          result = parseTime(a.estimatedTime) - parseTime(b.estimatedTime);
          break;
        case 'points':
          result = a.totalPoints - b.totalPoints;
          break;
       default:
          result = 0;
     }
      
      // Apply direction (asc = normal, desc = reversed)
      return sortConfig.direction === 'asc' ? result : -result;
   });

   return sorted;
  }, [quizzes, selectedCategory, selectedDifficulty, sortConfig]);

 // Clear all filters
  const handleClearFilters = () => {
    setSelectedCategory('all');
    setSelectedDifficulty('all');
  };

  const getDifficultyColor = (category: string) => {
    // Color mapping based on category/topic
    const colors: Record<string, string> = {
      Git: 'from-orange-500 to-red-600',
      Docker: 'from-blue-500 to-cyan-600',
      Kubernetes: 'from-purple-500 to-indigo-600',
      AWS: 'from-yellow-500 to-orange-600',
      Terraform: 'from-purple-600 to-pink-600',
      'Cost Optimization': 'from-emerald-500 to-teal-600',
      DevOps: 'from-green-500 to-emerald-600',
      'Incident Response': 'from-red-500 to-orange-600',
      Helm: 'from-blue-500 to-indigo-600',
      Linux: 'from-gray-500 to-gray-600',
      Python: 'from-yellow-500 to-orange-600',
      SQL: 'from-blue-500 to-cyan-600',
      'Interview Prep': 'from-green-500 to-emerald-600',
    };

    return colors[category] || 'from-gray-500 to-gray-600';
  };

  if (quizzes.length === 0) {
    return (
      <div className={cn('text-center py-12', className)}>
        <div className="max-w-md mx-auto">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No Quizzes Available</h3>
          <p className="text-sm text-muted-foreground">
            Check back later for new interactive quizzes and learning tools.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Filters */}
     <QuizFilters
       categories={categories}
       selectedCategory={selectedCategory}
       selectedDifficulty={selectedDifficulty}
        sortConfig={sortConfig}
       onCategoryChange={setSelectedCategory}
       onDifficultyChange={setSelectedDifficulty}
        onSortChange={setSortConfig}
       onClearFilters={handleClearFilters}
       totalCount={quizzes.length}
       filteredCount={filteredAndSortedQuizzes.length}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredAndSortedQuizzes.map((quiz) => {
          const IconComponent = iconMapExtended[quiz.icon as keyof typeof iconMapExtended] || Target;
          const gradientClass = getDifficultyColor(quiz.category);
          const quizDifficulty = getQuizDifficulty(quiz);

          return (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              icon={IconComponent}
              gradientClass={gradientClass}
              difficultyLabel={formatDifficultyLabel(quizDifficulty)}
            />
          );
        })}
      </div>

      {/* No results message */}
      {filteredAndSortedQuizzes.length === 0 && (
        <Card className="border-2 border-dashed bg-linear-to-br from-muted/50 to-muted/30 border-muted-foreground/20">
          <CardContent className="p-8 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No Quizzes Found</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Try adjusting your filters to find more quizzes.
            </p>
            <Button variant="outline" onClick={handleClearFilters}>
              Clear All Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Call to action for more quizzes */}
      {filteredAndSortedQuizzes.length > 0 && (
        <Card className="border-2 border-dashed bg-linear-to-br from-muted/50 to-muted/30 border-muted-foreground/20">
        <CardContent className="p-8 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">More Quizzes Coming Soon!</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            We're working on adding more interactive quizzes covering Kubernetes, AWS, Terraform,
            and more DevOps topics.
          </p>
          <Button variant="outline" asChild>
            <Link href="https://github.com/The-DevOps-Daily/devops-daily/issues/new/choose">
              Suggest a Quiz Topic
            </Link>
          </Button>
        </CardContent>
      </Card>
      )}
    </div>
  );
}

interface QuizCardProps {
  quiz: QuizMetadata;
  icon: LucideIcon;
  gradientClass: string;
  difficultyLabel: string;
}

// Every quiz is on the page, so each card keeps its markup small (see
// .quiz-card in app/globals.css).
const QuizCard = memo(function QuizCard({
  quiz,
  icon: IconComponent,
  gradientClass,
  difficultyLabel,
}: QuizCardProps) {
  return (
    <div className="quiz-card group">
      {/* Color indicator bar */}
      <div className={`h-2 w-full bg-linear-to-r ${gradientClass}`}></div>

      <div className="quiz-card-header">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-lg bg-linear-to-br ${gradientClass} text-white shadow-md`}>
            <IconComponent className="w-6 h-6" />
          </div>
          <div className="quiz-card-category">{quiz.category}</div>
        </div>

        <div className="quiz-card-title">{quiz.title}</div>
        <div className="text-sm text-muted-foreground line-clamp-3">{quiz.description}</div>
      </div>

      <div className="quiz-card-body">
        <div className="mb-4 space-y-3">
          <div className="quiz-card-level">{difficultyLabel}</div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="quiz-card-meta quiz-card-questions">
              {quiz.totalQuestions} questions
            </div>
            <div className="quiz-card-meta quiz-card-points">{quiz.totalPoints} points</div>
          </div>
          <div className="quiz-card-meta quiz-card-time text-sm text-muted-foreground">
            {quiz.estimatedTime}
          </div>
        </div>

        <Link href={`/quizzes/${quiz.id}`} className={`quiz-card-start ${gradientClass}`}>
          Start Quiz
        </Link>
      </div>
    </div>
  );
});
