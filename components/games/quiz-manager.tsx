'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
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
}

interface QuizManagerProps {
  quizzes: QuizMetadata[];
  className?: string;
}

export function QuizManager({ quizzes, className }: QuizManagerProps) {
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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {quizzes.map((quiz) => {
          const IconComponent = iconMap[quiz.icon as keyof typeof iconMap] || Target;
          const gradientClass = getDifficultyColor(quiz.category);

          return (
            <Card
              key={quiz.id}
              className="flex flex-col h-full overflow-hidden transition-all duration-300 group hover:shadow-lg border-border/50"
            >
              {/* Color indicator bar */}
              <div className={`h-2 w-full bg-gradient-to-r ${gradientClass}`}></div>

              <CardHeader className="pb-4">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`p-3 rounded-lg bg-gradient-to-br ${gradientClass} text-white shadow-md`}
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

              <CardContent className="flex flex-col justify-between flex-grow">
                <div className="mb-4 space-y-3">
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
                  className={`w-full bg-gradient-to-r ${gradientClass} hover:opacity-90 text-white shadow-md hover:shadow-lg transition-all`}
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

      {/* Call to action for more quizzes */}
      <Card className="border-2 border-dashed bg-gradient-to-br from-muted/50 to-muted/30 border-muted-foreground/20">
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
    </div>
  );
}
