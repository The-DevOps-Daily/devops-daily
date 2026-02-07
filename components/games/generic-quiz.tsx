'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  Lightbulb,
  Trophy,
  Star,
  Sparkles,
  Play,
  Target,
  BookOpen,
  Zap,
  Code,
  GitBranch,
  Terminal,
  Keyboard,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { QuizConfig, QuizQuestion } from '@/lib/quiz-types';

// Icon mapping for dynamic icon rendering
const iconMap = {
  GitBranch,
  Code,
  Terminal,
  Target,
  BookOpen,
  Zap,
  Trophy,
  Star,
  Sparkles,
};

interface GenericQuizProps {
  quizConfig: QuizConfig;
}

export default function GenericQuiz({ quizConfig }: GenericQuizProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [completedQuestions, setCompletedQuestions] = useState<number[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const question = quizConfig.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quizConfig.questions.length) * 100;
  const totalPoints = quizConfig.totalPoints;

  // Get the icon component dynamically
  const IconComponent = iconMap[quizConfig.icon as keyof typeof iconMap] || Target;

  const handleAnswerSelect = (answerIndex: number) => {
    if (showResult) return;
    setSelectedAnswer(answerIndex);
  };

  const handleSubmit = () => {
    if (selectedAnswer === null) return;

    const isCorrect = selectedAnswer === question.correctAnswer;
    setShowResult(true);

    if (isCorrect && !completedQuestions.includes(currentQuestion)) {
      setScore(score + question.points);
      setCompletedQuestions([...completedQuestions, currentQuestion]);
    }
  };

  const handleNext = () => {
    if (currentQuestion < quizConfig.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setShowHint(false);
    } else {
      setCurrentQuestion(quizConfig.questions.length);
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setCompletedQuestions([]);
    setShowHint(false);
    setGameStarted(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Only handle keys when quiz is active (not on start/results screen)
      if (!gameStarted || currentQuestion >= quizConfig.questions.length) {
        // Enter or Space to start quiz
        if ((e.key === 'Enter' || e.key === ' ') && !gameStarted) {
          e.preventDefault();
          setGameStarted(true);
        }
        // R to restart on results screen
        if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
          handleRestart();
        }
        return;
      }

      // Number keys 1-4 to select answer
      const num = parseInt(e.key);
      if (num >= 1 && num <= question.options.length && !showResult) {
        e.preventDefault();
        setSelectedAnswer(num - 1);
      }

      // Enter to submit answer
      if (e.key === 'Enter' && selectedAnswer !== null && !showResult) {
        e.preventDefault();
        handleSubmit();
      }

      // N or ArrowRight for next question (after showing result)
      if ((e.key === 'n' || e.key === 'N' || e.key === 'ArrowRight') && showResult) {
        e.preventDefault();
        handleNext();
      }

      // H to toggle hint
      if ((e.key === 'h' || e.key === 'H') && !showResult && question.hint) {
        e.preventDefault();
        setShowHint((prev) => !prev);
      }

      // R to restart quiz
      if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
        handleRestart();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-500 hover:bg-green-600';
      case 'intermediate':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'advanced':
        return 'bg-red-500 hover:bg-red-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const getScoreRating = () => {
    const percentage = (score / totalPoints) * 100;
    if (percentage >= 90)
      return { rating: `${quizConfig.category} Expert!`, icon: Trophy, color: 'text-yellow-500' };
    if (percentage >= 75)
      return { rating: `${quizConfig.category} Specialist`, icon: Star, color: 'text-purple-500' };
    if (percentage >= 60)
      return {
        rating: `${quizConfig.category} Practitioner`,
        icon: CheckCircle,
        color: 'text-blue-500',
      };
    if (percentage >= 40)
      return { rating: `${quizConfig.category} Learner`, icon: BookOpen, color: 'text-green-500' };
    return { rating: 'Keep Learning!', icon: Target, color: 'text-gray-500' };
  };

  // Start Screen
  if (!gameStarted) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card
            className={`relative overflow-hidden border-2 border-primary/20 bg-linear-to-br ${quizConfig.theme.primaryColor}/5`}
          >
            <div className="absolute inset-0 overflow-hidden">
              <div
                className={`absolute -top-10 -right-10 w-32 h-32 ${quizConfig.theme.gradientFrom}/10 rounded-full blur-xl animate-pulse`}
              />
              <div
                className={`absolute -bottom-10 -left-10 w-40 h-40 ${quizConfig.theme.gradientTo}/10 rounded-full blur-xl animate-pulse`}
                style={{ animationDelay: '1s' }}
              />
            </div>

            <CardHeader className="text-center pb-4 relative">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.2 }}
                className={`mx-auto mb-6 p-6 bg-linear-to-br ${quizConfig.theme.gradientFrom} ${quizConfig.theme.gradientTo} rounded-full w-fit shadow-xl`}
              >
                <IconComponent className="h-10 w-10 text-white" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <CardTitle
                  className={`text-4xl md:text-5xl font-bold mb-4 bg-linear-to-r ${quizConfig.theme.gradientFrom} ${quizConfig.theme.gradientTo} bg-clip-text text-transparent`}
                >
                  {quizConfig.title}
                </CardTitle>
                <CardDescription className="text-lg md:text-xl text-muted-foreground">
                  {quizConfig.description}
                </CardDescription>
              </motion.div>
            </CardHeader>

            <CardContent className="pt-2 relative">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
              >
                <div className="text-center p-6 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-green-200 dark:border-green-800 shadow-sm hover:shadow-md transition-all">
                  <Badge className="mb-3 bg-green-500 hover:bg-green-600 text-white border-0 px-4 py-1">
                    <Target className="w-3 h-3 mr-1" />
                    Beginner
                  </Badge>
                  <p className="text-sm text-muted-foreground font-medium">
                    Basic concepts and fundamentals
                  </p>
                  <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                    {quizConfig.metadata.difficultyLevels.beginner} questions
                  </div>
                </div>

                <div className="text-center p-6 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-yellow-200 dark:border-yellow-800 shadow-sm hover:shadow-md transition-all">
                  <Badge className="mb-3 bg-yellow-500 hover:bg-yellow-600 text-white border-0 px-4 py-1">
                    <Zap className="w-3 h-3 mr-1" />
                    Intermediate
                  </Badge>
                  <p className="text-sm text-muted-foreground font-medium">
                    Advanced workflows and optimization
                  </p>
                  <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                    {quizConfig.metadata.difficultyLevels.intermediate} questions
                  </div>
                </div>

                <div className="text-center p-6 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-red-200 dark:border-red-800 shadow-sm hover:shadow-md transition-all">
                  <Badge className="mb-3 bg-red-500 hover:bg-red-600 text-white border-0 px-4 py-1">
                    <BookOpen className="w-3 h-3 mr-1" />
                    Advanced
                  </Badge>
                  <p className="text-sm text-muted-foreground font-medium">
                    Expert-level scenarios and edge cases
                  </p>
                  <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                    {quizConfig.metadata.difficultyLevels.advanced} questions
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="text-center mb-8"
              >
                <div className="inline-flex items-center gap-6 text-sm text-muted-foreground bg-white/30 dark:bg-gray-800/30 rounded-full px-6 py-3 border border-border/50">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 ${quizConfig.theme.gradientFrom} rounded-full`}></div>
                    <span>{quizConfig.questions.length} questions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 ${quizConfig.theme.gradientTo} rounded-full`}></div>
                    <span>{totalPoints} total points</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>{quizConfig.metadata.estimatedTime}</span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1, type: 'spring', stiffness: 200 }}
                className="text-center"
              >
                <Button
                  size="lg"
                  onClick={() => setGameStarted(true)}
                  className={`bg-linear-to-r ${quizConfig.theme.gradientFrom} ${quizConfig.theme.gradientTo} hover:opacity-90 text-white shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 px-8 py-4 text-lg`}
                >
                  <Play className="mr-2 h-5 w-5" />
                  Start Quiz
                </Button>
                <p className="mt-4 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                  <Keyboard className="h-3 w-3" />
                  <span>Press <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px] font-mono">1-4</kbd> to select, <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px] font-mono">Enter</kbd> to submit</span>
                </p>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Results Screen
  if (currentQuestion >= quizConfig.questions.length) {
    const { rating, icon: RatingIcon, color } = getScoreRating();

    return (
      <div className="w-full max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card
            className={`text-center border-2 border-primary/20 bg-linear-to-br ${quizConfig.theme.primaryColor}/5`}
          >
            <CardHeader>
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className={`mx-auto mb-4 p-4 bg-linear-to-br ${quizConfig.theme.gradientFrom} ${quizConfig.theme.gradientTo} rounded-full w-fit`}
              >
                <RatingIcon className="h-8 w-8 text-white" />
              </motion.div>
              <CardTitle className="text-3xl mb-2">Quiz Complete!</CardTitle>
              <CardDescription className="text-xl">
                <span className={color}>{rating}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring' }}
                  className="text-5xl font-bold text-primary"
                >
                  {score} / {totalPoints}
                </motion.div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="text-2xl font-bold text-green-500">
                      {completedQuestions.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Correct</div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="text-2xl font-bold text-red-500">
                      {quizConfig.questions.length - completedQuestions.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Incorrect</div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <div className="text-2xl font-bold text-blue-500">
                      {Math.round((score / totalPoints) * 100)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Score</div>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="pt-6"
                >
                  <Button
                    onClick={handleRestart}
                    size="lg"
                    className={`bg-linear-to-r ${quizConfig.theme.gradientFrom} ${quizConfig.theme.gradientTo} hover:opacity-90`}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Play Again
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Quiz Question Screen
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Progress Header */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="px-3 py-1">
                Question {currentQuestion + 1} of {quizConfig.questions.length}
              </Badge>
              <Badge
                className={`${getDifficultyColor(question.difficulty)} text-white border-0 px-3 py-1`}
              >
                {question.difficulty}
              </Badge>
              <Badge
                variant="secondary"
                className={`bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-3 py-1`}
              >
                <Star className="w-3 h-3 mr-1" />
                {question.points} pts
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground font-medium">
              Score: <span className="font-bold text-primary text-lg">{score}</span>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Main Question */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconComponent className="h-5 w-5" />
            {question.title}
          </CardTitle>
          <CardDescription>{question.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scenario Visualization (if applicable) */}
          {question.situation && (
            <div className="bg-muted/30 p-4 rounded-lg border-l-4 border-blue-500">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Scenario
              </h4>
              <p className="text-sm text-muted-foreground mb-3">{question.situation}</p>

              {question.branches && (
                <div className="space-y-2">
                  {question.branches.map((branch, index) => (
                    <div key={branch.name} className="flex items-center gap-2 text-sm">
                      <Badge
                        variant={branch.current ? 'default' : 'outline'}
                        className="w-24 justify-center"
                      >
                        {branch.name}
                      </Badge>
                      <div className="flex gap-1">
                        {branch.commits.slice(-3).map((commit, commitIndex) => (
                          <div
                            key={commitIndex}
                            className="w-2 h-2 bg-blue-500 rounded-full"
                            title={commit}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {branch.commits[branch.commits.length - 1]}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {question.codeExample && (
                <div className="mt-3 p-3 bg-black/5 dark:bg-white/5 rounded border font-mono text-sm">
                  <pre className="whitespace-pre-wrap">{question.codeExample}</pre>
                </div>
              )}

              {question.conflict && (
                <Alert className="mt-3 border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
                  <AlertDescription className="text-sm">⚠️ {question.conflict}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Answer Options */}
          <div className="space-y-3">
            <h4 className="font-semibold">Select the correct answer:</h4>
            {question.options.map((option, index) => (
              <motion.div key={index} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full text-left justify-start h-auto p-4 transition-all',
                    selectedAnswer === index &&
                      !showResult &&
                      'border-primary bg-primary/10 text-primary',
                    showResult &&
                      index === question.correctAnswer &&
                      'border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300',
                    showResult &&
                      selectedAnswer === index &&
                      index !== question.correctAnswer &&
                      'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300'
                  )}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={showResult}
                >
                  <div className="flex items-start gap-3 w-full">
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5',
                        selectedAnswer === index && !showResult
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      )}
                    >
                      {selectedAnswer === index && !showResult && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <span className="flex-1 font-mono text-sm wrap-break-word whitespace-pre-wrap leading-relaxed">
                      {option}
                    </span>
                    {showResult && index === question.correctAnswer && (
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    )}
                    {showResult && selectedAnswer === index && index !== question.correctAnswer && (
                      <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    )}
                  </div>
                </Button>
              </motion.div>
            ))}
          </div>

          {/* Hint Button */}
          {!showResult && question.hint && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHint(!showHint)}
              className="text-muted-foreground hover:text-primary"
            >
              <Lightbulb className="mr-2 h-4 w-4" />
              {showHint ? 'Hide Hint' : 'Show Hint'}
            </Button>
          )}

          {/* Hint */}
          <AnimatePresence>
            {showHint && !showResult && question.hint && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Alert className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20">
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription>{question.hint}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result Explanation */}
          <AnimatePresence>
            {showResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Alert
                  className={cn(
                    'border-2',
                    selectedAnswer === question.correctAnswer
                      ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20'
                      : 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {selectedAnswer === question.correctAnswer ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold mb-2">
                        {selectedAnswer === question.correctAnswer ? 'Correct!' : 'Not quite right'}
                      </div>
                      <AlertDescription>{question.explanation}</AlertDescription>
                    </div>
                  </div>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleRestart}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restart
            </Button>

            <div className="space-x-2">
              {!showResult ? (
                <Button
                  onClick={handleSubmit}
                  disabled={selectedAnswer === null}
                  className={`bg-linear-to-r ${quizConfig.theme.gradientFrom} ${quizConfig.theme.gradientTo} hover:opacity-90`}
                >
                  Submit Answer
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  className={`bg-linear-to-r ${quizConfig.theme.gradientFrom} ${quizConfig.theme.gradientTo} hover:opacity-90`}
                >
                  {currentQuestion < quizConfig.questions.length - 1
                    ? 'Next Question'
                    : 'See Results'}
                  <Sparkles className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
