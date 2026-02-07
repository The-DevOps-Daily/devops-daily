'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  GitBranch,
  GitCommit,
  GitMerge,
  CheckCircle,
  XCircle,
  RotateCcw,
  Lightbulb,
  Trophy,
  Star,
  GitFork,
  Sparkles,
  Play,
  Target,
  BookOpen,
  Zap,
  Keyboard,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GitScenario {
  id: string;
  title: string;
  description: string;
  situation: string;
  branches: Array<{
    name: string;
    commits: string[];
    current?: boolean;
  }>;
  conflict?: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  points: number;
}

const scenarios: GitScenario[] = [
  {
    id: 'merge-conflict-basic',
    title: 'Basic Merge Conflict',
    description: 'You have changes in both main and feature branches that conflict.',
    situation:
      'You are on the main branch and want to merge feature-auth, but there are conflicts in app.js',
    branches: [
      { name: 'main', commits: ['Initial commit', 'Update app.js'], current: true },
      { name: 'feature-auth', commits: ['Initial commit', 'Add auth to app.js'] },
    ],
    conflict: 'Both branches modified app.js differently',
    options: [
      'git merge feature-auth',
      'git merge feature-auth &&\ngit add . && git commit',
      'git merge feature-auth\n→ resolve conflicts\n→ git add .\n→ git commit',
      'git rebase feature-auth',
    ],
    correctAnswer: 2,
    explanation:
      'When merging with conflicts, you must: 1) Start the merge, 2) Resolve conflicts manually, 3) Add resolved files, 4) Commit the merge.',
    difficulty: 'beginner',
    points: 10,
  },
  {
    id: 'fast-forward-merge',
    title: 'Fast-Forward Merge',
    description: 'Your feature branch is ahead of main with no conflicts.',
    situation:
      'feature-ui is 3 commits ahead of main, and main has no new commits since branching.',
    branches: [
      { name: 'main', commits: ['Initial commit', 'Setup project'], current: true },
      {
        name: 'feature-ui',
        commits: ['Initial commit', 'Setup project', 'Add navbar', 'Style buttons', 'Add footer'],
      },
    ],
    options: [
      'git merge feature-ui',
      'git merge --no-ff feature-ui',
      'git rebase feature-ui',
      'git cherry-pick feature-ui',
    ],
    correctAnswer: 0,
    explanation:
      'This is a fast-forward merge situation. Git will simply move the main pointer forward to match feature-ui.',
    difficulty: 'beginner',
    points: 8,
  },
  {
    id: 'rebase-vs-merge',
    title: 'Clean History with Rebase',
    description: 'You want to maintain a linear history when integrating your feature branch.',
    situation:
      'You have been working on feature-api while main has received new commits. You want a clean, linear history.',
    branches: [
      {
        name: 'main',
        commits: ['Initial commit', 'Setup', 'Bug fix', 'Security update'],
        current: false,
      },
      {
        name: 'feature-api',
        commits: ['Initial commit', 'Setup', 'Add API routes', 'Add validation'],
        current: true,
      },
    ],
    options: [
      'git merge main',
      'git merge --squash main',
      'git cherry-pick main',
      'git rebase main',
    ],
    correctAnswer: 3,
    explanation:
      'Rebase will replay your feature commits on top of the latest main, creating a linear history without merge commits.',
    difficulty: 'intermediate',
    points: 15,
  },
  {
    id: 'undo-last-commit',
    title: 'Oops! Wrong Commit',
    description: 'You just committed changes but realized you made a mistake.',
    situation:
      'You committed "Fix typo" but the commit contains additional unintended changes that should not be included.',
    branches: [
      {
        name: 'main',
        commits: ['Initial commit', 'Add features', 'Fix typo (WRONG)'],
        current: true,
      },
    ],
    options: [
      'git revert HEAD',
      'git reset --hard HEAD~1',
      'git commit --amend',
      'git reset --soft HEAD~1',
    ],
    correctAnswer: 3,
    explanation:
      'reset --soft HEAD~1 undoes the commit but keeps your changes staged, allowing you to modify and recommit correctly.',
    difficulty: 'intermediate',
    points: 12,
  },
  {
    id: 'stash-workflow',
    title: 'Interrupted Workflow',
    description: 'You are working on a feature but need to quickly fix a bug on main.',
    situation:
      'You have uncommitted changes on feature-search but need to switch to main to fix an urgent bug.',
    branches: [
      { name: 'main', commits: ['Initial commit', 'Add search'], current: false },
      {
        name: 'feature-search',
        commits: ['Initial commit', 'Add search', 'WIP: advanced filters'],
        current: true,
      },
    ],
    options: [
      'git commit -m "WIP" &&\ngit checkout main',
      'git stash &&\ngit checkout main',
      'git reset --hard &&\ngit checkout main',
      'git checkout main\n(force)',
    ],
    correctAnswer: 1,
    explanation:
      'git stash saves your uncommitted changes temporarily, allowing you to switch branches cleanly and restore them later with git stash pop.',
    difficulty: 'intermediate',
    points: 12,
  },
  {
    id: 'interactive-rebase',
    title: 'Clean Up Commit History',
    description: 'You have multiple small commits that should be combined before merging.',
    situation:
      'You have 4 commits: "Add login", "Fix typo", "Another typo fix", "Update login". You want to clean this up before merging.',
    branches: [
      {
        name: 'feature-login',
        commits: ['Initial', 'Add login', 'Fix typo', 'Another typo fix', 'Update login'],
        current: true,
      },
    ],
    options: [
      'git merge --squash',
      'git rebase -i HEAD~4',
      'git reset --soft HEAD~4 &&\ngit commit',
      'git commit --amend',
    ],
    correctAnswer: 1,
    explanation:
      'Interactive rebase (git rebase -i) allows you to squash, reorder, or edit commits to create a cleaner history.',
    difficulty: 'advanced',
    points: 20,
  },
  {
    id: 'cherry-pick-scenario',
    title: 'Selective Commit Integration',
    description: 'You need only one specific commit from another branch.',
    situation:
      'The experimental-features branch has many commits, but you only want the "Add error handling" commit on main.',
    branches: [
      { name: 'main', commits: ['Initial commit', 'Core features'], current: true },
      {
        name: 'experimental-features',
        commits: [
          'Initial commit',
          'Core features',
          'Experimental UI',
          'Add error handling',
          'More experiments',
        ],
      },
    ],
    options: [
      'git merge\nexperimental-features',
      'git rebase\nexperimental-features',
      'git cherry-pick\n<commit-hash>',
      'git diff\nexperimental-features',
    ],
    correctAnswer: 2,
    explanation:
      'Cherry-pick allows you to apply a specific commit from another branch without merging the entire branch.',
    difficulty: 'advanced',
    points: 18,
  },
];

export default function GitCommandQuiz() {
  const [currentScenario, setCurrentScenario] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [completedScenarios, setCompletedScenarios] = useState<number[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const scenario = scenarios[currentScenario];
  const progress = ((currentScenario + 1) / scenarios.length) * 100;
  const totalPoints = scenarios.reduce((sum, s) => sum + s.points, 0);

  const handleAnswerSelect = (answerIndex: number) => {
    if (showResult) return;
    setSelectedAnswer(answerIndex);
  };

  const handleSubmit = () => {
    if (selectedAnswer === null) return;

    const isCorrect = selectedAnswer === scenario.correctAnswer;
    setShowResult(true);

    if (isCorrect && !completedScenarios.includes(currentScenario)) {
      setScore(score + scenario.points);
      setCompletedScenarios([...completedScenarios, currentScenario]);
    }
  };

  const handleNext = () => {
    if (currentScenario < scenarios.length - 1) {
      setCurrentScenario(currentScenario + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setShowHint(false);
    } else {
      // Go to results page
      setCurrentScenario(scenarios.length);
    }
  };

  const handleRestart = () => {
    setCurrentScenario(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setCompletedScenarios([]);
    setShowHint(false);
    setGameStarted(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (!gameStarted || currentScenario >= scenarios.length) {
        if ((e.key === 'Enter' || e.key === ' ') && !gameStarted) {
          e.preventDefault();
          setGameStarted(true);
        }
        if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
          handleRestart();
        }
        return;
      }

      const num = parseInt(e.key);
      if (num >= 1 && num <= scenario.options.length && !showResult) {
        e.preventDefault();
        setSelectedAnswer(num - 1);
      }

      if (e.key === 'Enter' && selectedAnswer !== null && !showResult) {
        e.preventDefault();
        handleSubmit();
      }

      if ((e.key === 'n' || e.key === 'N' || e.key === 'ArrowRight') && showResult) {
        e.preventDefault();
        handleNext();
      }

      if ((e.key === 'h' || e.key === 'H') && !showResult) {
        e.preventDefault();
        setShowHint((prev) => !prev);
      }

      if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
        handleRestart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStarted, currentScenario, selectedAnswer, showResult, scenario]);

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
    if (percentage >= 90) return { rating: 'Git Guru!', icon: Trophy, color: 'text-yellow-500' };
    if (percentage >= 75) return { rating: 'Git Expert', icon: Star, color: 'text-purple-500' };
    if (percentage >= 60)
      return { rating: 'Git Proficient', icon: CheckCircle, color: 'text-blue-500' };
    if (percentage >= 40)
      return { rating: 'Git Learner', icon: GitBranch, color: 'text-green-500' };
    return { rating: 'Keep Learning!', icon: GitCommit, color: 'text-gray-500' };
  };

  if (!gameStarted) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="relative overflow-hidden border-2 border-primary/20 bg-linear-to-br from-blue-50/80 to-purple-50/80 dark:from-blue-950/30 dark:to-purple-950/30">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-xl animate-pulse" />
              <div
                className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-500/10 rounded-full blur-xl animate-pulse"
                style={{ animationDelay: '1s' }}
              />
            </div>

            <CardHeader className="text-center pb-4 relative">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.2 }}
                className="mx-auto mb-6 p-6 bg-linear-to-br from-blue-500 to-purple-600 rounded-full w-fit shadow-xl"
              >
                <GitFork className="h-10 w-10 text-white" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <CardTitle className="text-4xl md:text-5xl font-bold mb-4 bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Git Command Quiz
                </CardTitle>
                <CardDescription className="text-lg md:text-xl text-muted-foreground">
                  Learn Git through real-world scenarios and learn the commands that matter
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
                    Basic merge conflicts and workflows
                  </p>
                  <div className="mt-2 text-xs text-green-600 dark:text-green-400">3 scenarios</div>
                </div>

                <div className="text-center p-6 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-yellow-200 dark:border-yellow-800 shadow-sm hover:shadow-md transition-all">
                  <Badge className="mb-3 bg-yellow-500 hover:bg-yellow-600 text-white border-0 px-4 py-1">
                    <Zap className="w-3 h-3 mr-1" />
                    Intermediate
                  </Badge>
                  <p className="text-sm text-muted-foreground font-medium">
                    Rebasing, stashing, and cleanup
                  </p>
                  <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                    3 scenarios
                  </div>
                </div>

                <div className="text-center p-6 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-red-200 dark:border-red-800 shadow-sm hover:shadow-md transition-all">
                  <Badge className="mb-3 bg-red-500 hover:bg-red-600 text-white border-0 px-4 py-1">
                    <BookOpen className="w-3 h-3 mr-1" />
                    Advanced
                  </Badge>
                  <p className="text-sm text-muted-foreground font-medium">
                    Interactive rebase and cherry-picking
                  </p>
                  <div className="mt-2 text-xs text-red-600 dark:text-red-400">2 scenarios</div>
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
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>{scenarios.length} scenarios</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span>{totalPoints} total points</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Learn by doing</span>
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
                  className="bg-linear-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 px-8 py-4 text-lg"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Start Quiz
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Game completed
  if (currentScenario >= scenarios.length) {
    const { rating, icon: RatingIcon, color } = getScoreRating();

    return (
      <div className="w-full max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="text-center border-2 border-primary/20 bg-linear-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
            <CardHeader>
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className={`mx-auto mb-4 p-4 bg-linear-to-br from-blue-500 to-purple-600 rounded-full w-fit`}
              >
                <RatingIcon className={`h-8 w-8 text-white`} />
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
                      {completedScenarios.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Correct</div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="text-2xl font-bold text-red-500">
                      {scenarios.length - completedScenarios.length}
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
                    className="bg-linear-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
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

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Progress Header */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="px-3 py-1">
                Scenario {currentScenario + 1} of {scenarios.length}
              </Badge>
              <Badge
                className={`${getDifficultyColor(scenario.difficulty)} text-white border-0 px-3 py-1`}
              >
                {scenario.difficulty}
              </Badge>
              <Badge
                variant="secondary"
                className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-3 py-1"
              >
                <Star className="w-3 h-3 mr-1" />
                {scenario.points} pts
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground font-medium">
              Score: <span className="font-bold text-primary text-lg">{score}</span>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Main Scenario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            {scenario.title}
          </CardTitle>
          <CardDescription>{scenario.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Git Visualization */}
          <div className="bg-muted/30 p-4 rounded-lg border-l-4 border-blue-500">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Repository State
            </h4>
            <p className="text-sm text-muted-foreground mb-3">{scenario.situation}</p>

            <div className="space-y-2">
              {scenario.branches.map((branch, index) => (
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

            {scenario.conflict && (
              <Alert className="mt-3 border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
                <AlertDescription className="text-sm">⚠️ {scenario.conflict}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Answer Options */}
          <div className="space-y-3">
            <h4 className="font-semibold">What's the correct approach?</h4>
            {scenario.options.map((option, index) => (
              <motion.div key={index} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full text-left justify-start h-auto p-4 transition-all',
                    selectedAnswer === index &&
                      !showResult &&
                      'border-primary bg-primary/10 text-primary',
                    showResult &&
                      index === scenario.correctAnswer &&
                      'border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300',
                    showResult &&
                      selectedAnswer === index &&
                      index !== scenario.correctAnswer &&
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
                    {showResult && index === scenario.correctAnswer && (
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    )}
                    {showResult && selectedAnswer === index && index !== scenario.correctAnswer && (
                      <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    )}
                  </div>
                </Button>
              </motion.div>
            ))}
          </div>

          {/* Hint Button */}
          {!showResult && (
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
            {showHint && !showResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Alert className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20">
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription>
                    Think about what happens in each step:{' '}
                    {scenario.difficulty === 'beginner'
                      ? 'Start with the basic git command, then consider what to do with conflicts.'
                      : scenario.difficulty === 'intermediate'
                        ? 'Consider whether you want to preserve history or create a clean linear timeline.'
                        : 'Think about the end goal and which Git feature is designed for this specific use case.'}
                  </AlertDescription>
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
                    selectedAnswer === scenario.correctAnswer
                      ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20'
                      : 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {selectedAnswer === scenario.correctAnswer ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold mb-2">
                        {selectedAnswer === scenario.correctAnswer ? 'Correct!' : 'Not quite right'}
                      </div>
                      <AlertDescription>{scenario.explanation}</AlertDescription>
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
                  className="bg-linear-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  Submit Answer
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  className="bg-linear-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {currentScenario < scenarios.length - 1 ? 'Next Scenario' : 'See Results'}
                  <Sparkles className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Keyboard shortcuts hint */}
            <div className="hidden sm:flex items-center gap-2 text-xs opacity-70">
              <Keyboard className="h-3 w-3" />
              <span>1-{scenario.options.length} select · Enter submit · N next · H hint · R restart</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
