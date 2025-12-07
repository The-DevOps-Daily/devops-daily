'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QuizFilters, DifficultyLevel, SortOption } from '@/components/quiz-filters';
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
  ArrowRight,
  AlertTriangle,
  Play,
  Package,
  DollarSign,
  Database,
 Briefcase,
Shield,
 Lock,
  Settings,
  Workflow,
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
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Load filter preferences from localStorage on mount
  useEffect(() => {
    const savedCategory = localStorage.getItem('quizFilterCategory');
    const savedDifficulty = localStorage.getItem('quizFilterDifficulty');
    const savedSort = localStorage.getItem('quizFilterSort');

    if (savedCategory) setSelectedCategory(savedCategory);
    if (savedDifficulty) setSelectedDifficulty(savedDifficulty as DifficultyLevel);
    if (savedSort) setSortBy(savedSort as SortOption);
  }, []);

  // Save filter preferences to localStorage
  useEffect(() => {
    localStorage.setItem('quizFilterCategory', selectedCategory);
    localStorage.setItem('quizFilterDifficulty', selectedDifficulty);
    localStorage.setItem('quizFilterSort', sortBy);
  }, [selectedCategory, selectedDifficulty, sortBy]);

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
    if (title.includes('junior')) return 'beginner';
    
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
      switch (sortBy) {
        case 'newest':
          // Sort by creation date (newest first)
          const dateA = a.createdDate ? new Date(a.createdDate).getTime() : 0;
          const dateB = b.createdDate ? new Date(b.createdDate).getTime() : 0;
          return dateB - dateA;
        case 'oldest':
          // Sort by creation date (oldest first)
          const dateA2 = a.createdDate ? new Date(a.createdDate).getTime() : 0;
         const dateB2 = b.createdDate ? new Date(b.createdDate).getTime() : 0;
         return dateA2 - dateB2;
        case 'easiest':
         // Sort by difficulty (easiest first: beginner -> intermediate -> advanced)
         const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3 };
         const aDiff = getQuizDifficulty(a);
         const bDiff = getQuizDifficulty(b);
         return difficultyOrder[aDiff] - difficultyOrder[bDiff];
       case 'hardest':
         // Sort by difficulty (hardest first: advanced -> intermediate -> beginner)
          const difficultyOrderHard = { beginner: 1, intermediate: 2, advanced: 3 };
          const aDiffHard = getQuizDifficulty(a);
          const bDiffHard = getQuizDifficulty(b);
          return difficultyOrderHard[bDiffHard] - difficultyOrderHard[aDiffHard];
        case 'time':
          return parseTime(a.estimatedTime) - parseTime(b.estimatedTime);
       case 'points':
         return b.totalPoints - a.totalPoints;
        default:
          return 0;
      }
    });

    return sorted;
  }, [quizzes, selectedCategory, selectedDifficulty, sortBy]);

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedCategory('all');
    setSelectedDifficulty('all');
  };

  const getQuizUrl = (quizId: string) => {
    return `/quizzes/${quizId}`;
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
        sortBy={sortBy}
        onCategoryChange={setSelectedCategory}
        onDifficultyChange={setSelectedDifficulty}
        onSortChange={setSortBy}
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
            <Card
              key={quiz.id}
              className="flex flex-col h-full overflow-hidden transition-all duration-300 group hover:shadow-lg border-border/50"
            >
              {/* Color indicator bar */}
              <div className={`h-2 w-full bg-linear-to-r ${gradientClass}`}></div>

              <CardHeader className="pb-4">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`p-3 rounded-lg bg-linear-to-br ${gradientClass} text-white shadow-md`}
                  >
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <Badge variant="outline" className="bg-background/50">
                    {quiz.category}
                  </Badge>
                </div>

                <CardTitle className="text-xl transition-colors group-hover:text-primary line-clamp-2">
                  {quiz.title}
                </CardTitle>
                <CardDescription className="line-clamp-3">{quiz.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col justify-between grow">
                <div className="mb-4 space-y-3">
                 <div className="flex items-center gap-2">
                   <Badge variant="secondary" className="capitalize text-xs">
                     {formatDifficultyLabel(quizDifficulty)}
                   </Badge>
                 </div>
                 <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />
                      <span>{quiz.totalQuestions} questions</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      <span>{quiz.totalPoints} points</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{quiz.estimatedTime}</span>
                  </div>
                </div>

                <Button
                  asChild
                  className={`w-full bg-linear-to-r ${gradientClass} hover:opacity-90 text-white shadow-md hover:shadow-lg transition-all`}
                >
                  <Link
                    href={getQuizUrl(quiz.id)}
                    className="flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Start Quiz
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
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
