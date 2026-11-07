'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import {
  BookOpen,
  CircleCheck,
  CircleX,
  Code,
  GitBranch,
  Keyboard,
  Play,
  Sparkles,
  Star,
  Target,
  Terminal,
  Trophy,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimHintButton,
  SimResetButton,
  useSimGame,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';
import type { QuizConfig } from '@/lib/quiz-types';

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
  const [announce, setAnnounce] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);
  // The game page and the embed name the quiz already; /quizzes pages have no title above it.
  const quizHeading = useSimGame() ? undefined : quizConfig.title;

  const question = quizConfig.questions[currentQuestion];
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

  const onQuizKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      !gameStarted ||
      currentQuestion >= quizConfig.questions.length
    ) {
      return;
    }

    const number = Number(event.key);
    if (number >= 1 && number <= question.options.length && !showResult) {
      event.preventDefault();
      setSelectedAnswer(number - 1);
    }

    if ((event.key === 'n' || event.key === 'N' || event.key === 'ArrowRight') && showResult) {
      event.preventDefault();
      handleNext();
    }

    if ((event.key === 'h' || event.key === 'H') && !showResult && question.hint) {
      event.preventDefault();
      setShowHint((previous) => !previous);
    }
  };

  const onSubmit = () => {
    handleSubmit();
    const correct = selectedAnswer === question.correctAnswer;
    const firstSentence =
      question.explanation.match(/^.*?[.!?](?:\s|$)/)?.[0].trim() ?? question.explanation;
    setAnnounce(`${correct ? 'Correct' : 'Not quite'}. ${firstSentence}`);
    requestAnimationFrame(() => resultRef.current?.focus({ preventScroll: true }));
  };

  const getScoreRating = () => {
    const percentage = (score / totalPoints) * 100;
    if (percentage >= 90) return { rating: `${quizConfig.category} Expert!` };
    if (percentage >= 75) return { rating: `${quizConfig.category} Specialist` };
    if (percentage >= 60) return { rating: `${quizConfig.category} Practitioner` };
    if (percentage >= 40) return { rating: `${quizConfig.category} Learner` };
    return { rating: 'Keep Learning!' };
  };

  return (
    <div className="mx-auto w-full max-w-4xl" onKeyDown={onQuizKeyDown}>
      <SimFrame>
        {!gameStarted ? (
          <>
            <SimBar
              title={quizConfig.title}
              icon={IconComponent}
              heading={quizHeading}
              goal={`Answer ${quizConfig.questions.length} questions. Each right answer adds its points.`}
            />
            <section className="space-y-3 rounded-lg border bg-card p-4">
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {quizConfig.description}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  [
                    'Beginner',
                    quizConfig.metadata.difficultyLevels.beginner,
                    'Basic concepts and fundamentals',
                  ],
                  [
                    'Intermediate',
                    quizConfig.metadata.difficultyLevels.intermediate,
                    'Advanced workflows and optimization',
                  ],
                  [
                    'Advanced',
                    quizConfig.metadata.difficultyLevels.advanced,
                    'Expert-level scenarios and edge cases',
                  ],
                ].map(([label, count, note]) => (
                  <div key={label} className="rounded-md bg-muted/50 px-3 py-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {label}
                    </div>
                    <div className="font-mono text-2xl font-semibold tabular-nums">{count}</div>
                    <div className="text-xs text-muted-foreground">{note}</div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {quizConfig.questions.length} questions, {totalPoints} points,{' '}
                {quizConfig.metadata.estimatedTime}
              </p>
              <Button type="button" className="h-10" onClick={() => setGameStarted(true)}>
                <Play className="h-4 w-4" aria-hidden="true" />
                Start Quiz
              </Button>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Keyboard className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  While the quiz has focus, keys{' '}
                  <kbd className="rounded border bg-muted px-1 font-mono text-xs">1</kbd> to{' '}
                  <kbd className="rounded border bg-muted px-1 font-mono text-xs">4</kbd> pick an
                  answer, <kbd className="rounded border bg-muted px-1 font-mono text-xs">H</kbd>{' '}
                  opens the hint and{' '}
                  <kbd className="rounded border bg-muted px-1 font-mono text-xs">N</kbd> goes to
                  the next question.
                </span>
              </p>
            </section>
          </>
        ) : currentQuestion >= quizConfig.questions.length ? (
          <>
            <SimBar
              title={quizConfig.title}
              icon={IconComponent}
              tools={<SimResetButton onReset={handleRestart} />}
              progress={{
                current: quizConfig.questions.length,
                total: quizConfig.questions.length,
              }}
              heading={quizHeading ?? 'Results'}
            />
            <SimComplete
              title="Quiz complete"
              summary={`${score} of ${totalPoints} points: ${getScoreRating().rating.replace(/!$/, '')}.`}
              stats={[
                { label: 'Score', value: `${score}/${totalPoints}` },
                {
                  label: 'Correct',
                  value: `${completedQuestions.length}/${quizConfig.questions.length}`,
                },
                { label: 'Percent', value: `${Math.round((score / totalPoints) * 100)}%` },
              ]}
              signal
              onPlayAgain={handleRestart}
              playAgainLabel="Play again"
            />
          </>
        ) : (
          <>
            <SimBar
              title={quizConfig.title}
              icon={IconComponent}
              progress={{ current: currentQuestion + 1, total: quizConfig.questions.length }}
              heading={question.title}
              meta={
                <>
                  <Badge variant="secondary" className="capitalize">
                    {question.difficulty}
                  </Badge>
                  <Badge variant="outline" className="tabular-nums">
                    {question.points} pts
                  </Badge>
                </>
              }
              actions={
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  Score {score}/{totalPoints}
                </span>
              }
              tools={
                <>
                  {question.hint && !showResult && (
                    <SimHintButton
                      onClick={() => setShowHint((value) => !value)}
                      pressed={showHint}
                    />
                  )}
                  <SimResetButton onReset={handleRestart} />
                </>
              }
              goal="Pick the best answer, then submit it."
            >
              {showHint && !showResult && question.hint && (
                <SimFeedback
                  tone="hint"
                  role="status"
                  onDismiss={() => setShowHint(false)}
                  dismissLabel="Close the hint"
                >
                  <p>{question.hint}</p>
                </SimFeedback>
              )}
            </SimBar>
            <section className="space-y-2 rounded-lg border bg-card p-3">
              <p className="text-sm text-muted-foreground">{question.description}</p>

              {question.situation && (
                <div className="space-y-1.5 rounded-md bg-muted/50 p-2.5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Target className="h-4 w-4 text-primary" aria-hidden="true" />
                    Scenario
                  </h3>
                  <p className="text-sm text-muted-foreground">{question.situation}</p>

                  {question.branches && (
                    <div className="space-y-2">
                      {question.branches.map((branch) => (
                        <div key={branch.name} className="flex items-center gap-2 text-sm">
                          <Badge variant={branch.current ? 'default' : 'outline'}>
                            {branch.name}
                          </Badge>
                          <div className="flex gap-1">
                            {branch.commits.slice(-3).map((commit, commitIndex) => (
                              <div
                                key={commitIndex}
                                className="h-2 w-2 rounded-full bg-primary"
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
                    <pre className="overflow-x-auto rounded-md border bg-background p-2 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                      {question.codeExample}
                    </pre>
                  )}

                  {question.conflict && (
                    <SimFeedback tone="warning" label="Conflict">
                      <p>{question.conflict}</p>
                    </SimFeedback>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold">Select the correct answer:</h3>
                <ol className="space-y-1.5">
                  {question.options.map((option, index) => {
                    const correct = showResult && index === question.correctAnswer;
                    const wrong =
                      showResult && selectedAnswer === index && index !== question.correctAnswer;
                    return (
                      <li key={index}>
                        <button
                          type="button"
                          className={cn(
                            'flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
                            selectedAnswer === index && !showResult
                              ? 'border-primary bg-primary/5'
                              : !showResult && 'hover:bg-muted/60',
                            correct && SIM_TONE.success.surface,
                            wrong && SIM_TONE.danger.surface
                          )}
                          aria-pressed={selectedAnswer === index}
                          onClick={() => handleAnswerSelect(index)}
                          disabled={showResult}
                        >
                          <span className="font-mono text-xs text-muted-foreground">
                            {index + 1}
                          </span>
                          <span className="flex-1 font-mono text-sm whitespace-pre-wrap [overflow-wrap:anywhere] leading-relaxed">
                            {option}
                          </span>
                          {correct && (
                            <span
                              className={cn(
                                'inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 font-sans text-xs font-semibold',
                                SIM_TONE.success.surface,
                                SIM_TONE.success.text
                              )}
                            >
                              <CircleCheck className="h-3 w-3" aria-hidden="true" />
                              Correct answer
                            </span>
                          )}
                          {wrong && (
                            <span
                              className={cn(
                                'inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 font-sans text-xs font-semibold',
                                SIM_TONE.danger.surface,
                                SIM_TONE.danger.text
                              )}
                            >
                              <CircleX className="h-3 w-3" aria-hidden="true" />
                              Your answer
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {showResult && (
                <SimFeedback
                  ref={resultRef}
                  tabIndex={-1}
                  tone={selectedAnswer === question.correctAnswer ? 'success' : 'danger'}
                  label={selectedAnswer === question.correctAnswer ? 'Correct' : 'Not quite'}
                >
                  <p>{question.explanation}</p>
                </SimFeedback>
              )}

              <div className="flex justify-end">
                {!showResult ? (
                  <Button
                    type="button"
                    className="h-10"
                    disabled={selectedAnswer === null}
                    onClick={onSubmit}
                  >
                    Submit Answer
                  </Button>
                ) : (
                  <Button type="button" className="h-10" onClick={handleNext}>
                    {currentQuestion < quizConfig.questions.length - 1
                      ? 'Next Question'
                      : 'See Results'}
                  </Button>
                )}
              </div>
            </section>
          </>
        )}
        <SimAnnouncer message={announce} />
      </SimFrame>
    </div>
  );
}
