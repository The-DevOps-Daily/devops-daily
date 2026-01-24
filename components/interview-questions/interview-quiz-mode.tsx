'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  ChevronRight,
  Trophy,
  Clock,
  Target,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  InterviewQuestion,
  QuizModeState,
} from '@/lib/interview-utils';
import {
  getDifficultyColor,
  saveQuizModeState,
  clearQuizModeState,
  calculateQuizResult,
  getScoreRating,
} from '@/lib/interview-utils';

interface InterviewQuizModeProps {
  questions: InterviewQuestion[];
  category?: string;
  onExit: () => void;
}

export function InterviewQuizMode({ questions, category, onExit }: InterviewQuizModeProps) {
  const [state, setState] = useState<QuizModeState>({
    currentIndex: 0,
    answers: {},
    completed: false,
    startedAt: new Date().toISOString(),
  });
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedCorrect, setSelectedCorrect] = useState<boolean | null>(null);

  const currentQuestion = questions[state.currentIndex];
  const progress = ((state.currentIndex + 1) / questions.length) * 100;
  const alreadyAnswered = currentQuestion?.id in state.answers;

  // Save state to localStorage on changes
  useEffect(() => {
    saveQuizModeState(state, category);
  }, [state, category]);

  const handleAnswer = (isCorrect: boolean) => {
    if (alreadyAnswered) return;

    setSelectedCorrect(isCorrect);
    setShowAnswer(true);

    setState((prev) => ({
      ...prev,
      answers: {
        ...prev.answers,
        [currentQuestion.id]: isCorrect,
      },
    }));
  };

  const handleNext = () => {
    if (state.currentIndex < questions.length - 1) {
      setState((prev) => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
      }));
      setShowAnswer(false);
      setSelectedCorrect(null);
    } else {
      setState((prev) => ({
        ...prev,
        completed: true,
        completedAt: new Date().toISOString(),
      }));
    }
  };

  const handleRestart = () => {
    clearQuizModeState(category);
    setState({
      currentIndex: 0,
      answers: {},
      completed: false,
      startedAt: new Date().toISOString(),
    });
    setShowAnswer(false);
    setSelectedCorrect(null);
  };

  // Results screen
  if (state.completed) {
    const result = calculateQuizResult(state);
    const rating = getScoreRating(result.percentage);

    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <div className="text-6xl mb-4">{rating.emoji}</div>
          <CardTitle className="text-2xl">Quiz Complete!</CardTitle>
          <p className="text-muted-foreground">{rating.label}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold text-green-600">{result.correct}</div>
              <div className="text-sm text-muted-foreground">Correct</div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">{result.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold text-primary">{result.percentage}%</div>
              <div className="text-sm text-muted-foreground">Score</div>
            </div>
          </div>

          {result.timeSpent && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Completed in {Math.floor(result.timeSpent / 60)}m {result.timeSpent % 60}s
              </span>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <Button onClick={handleRestart} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={onExit}>
              Back to Questions
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Question {state.currentIndex + 1} of {questions.length}</span>
          <span>{Object.values(state.answers).filter(Boolean).length} correct</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <Badge className={cn('text-xs', getDifficultyColor(currentQuestion.difficulty))}>
              {currentQuestion.difficulty}
            </Badge>
            <Badge variant="outline">{currentQuestion.category}</Badge>
          </div>
          <CardTitle className="text-xl">{currentQuestion.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-muted rounded-lg">
            <p className="font-medium">{currentQuestion.question}</p>
          </div>

          {/* Self-assessment buttons */}
          {!showAnswer && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Think about your answer, then rate yourself:
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => handleAnswer(true)}
                  className="flex-1 max-w-xs bg-green-600 hover:bg-green-700"
                  disabled={alreadyAnswered}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  I Know This
                </Button>
                <Button
                  onClick={() => handleAnswer(false)}
                  variant="outline"
                  className="flex-1 max-w-xs border-orange-500 text-orange-600 hover:bg-orange-50"
                  disabled={alreadyAnswered}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Show Answer
                </Button>
              </div>
            </div>
          )}

          {/* Answer reveal */}
          {showAnswer && (
            <div className="space-y-4">
              <div
                className={cn(
                  'p-4 rounded-lg border-2',
                  selectedCorrect
                    ? 'bg-green-50 border-green-500 dark:bg-green-950/30'
                    : 'bg-orange-50 border-orange-500 dark:bg-orange-950/30'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {selectedCorrect ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Target className="h-5 w-5 text-orange-600" />
                  )}
                  <span className="font-semibold">
                    {selectedCorrect ? 'Great!' : 'Here\'s the answer:'}
                  </span>
                </div>
                <p className="text-sm">{currentQuestion.answer}</p>
              </div>

              {currentQuestion.explanation && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Explanation:</p>
                  <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                </div>
              )}

              <Button onClick={handleNext} className="w-full">
                {state.currentIndex < questions.length - 1 ? (
                  <>
                    Next Question
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    See Results
                    <Trophy className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exit button */}
      <div className="text-center">
        <Button variant="ghost" onClick={onExit} size="sm">
          Exit Quiz Mode
        </Button>
      </div>
    </div>
  );
}
