'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Breadcrumb } from '@/components/breadcrumb';
import { SponsorSidebar } from '@/components/sponsor-sidebar';
import { ReportIssue } from '@/components/report-issue';
import { cn } from '@/lib/utils';
import Confetti from 'react-confetti';
import {
  Clock,
  Target,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ExternalLink,
  Copy,
  Terminal,
  Book,
  Award,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Play,
  LucideIcon,
  Container,
  Layers,
  Server,
  Workflow,
  Activity,
  Database,
  Shield,
  Cloud,
  GitBranch,
  Code,
  Settings,
  Check,
} from 'lucide-react';
import type { Exercise } from '@/lib/exercises-types';
import Link from 'next/link';

const iconComponents: Record<string, LucideIcon> = {
  Container,
  Layers,
  Server,
  Workflow,
  Activity,
  Database,
  Shield,
  Cloud,
  GitBranch,
  Code,
  Settings,
};

interface ExerciseDetailClientProps {
  exercise: Exercise;
}

export function ExerciseDetailClient({ exercise }: ExerciseDetailClientProps) {
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Load progress from localStorage
    const saved = localStorage.getItem(`exercise-${exercise.id}-progress`);
    if (saved) {
      try {
        const progress = JSON.parse(saved);
        setCompletedSteps(progress.completedSteps || []);
        setCurrentStep(progress.currentStep || 0);
        setIsStarted(progress.isStarted || false);
        if (progress.startTime) {
          setStartTime(new Date(progress.startTime));
        }
      } catch (error) {
        console.error('Error loading exercise progress:', error);
      }
    }
  }, [exercise.id]);

  // Set up window dimensions for confetti
  useEffect(() => {
    const getWindowDimensions = () => {
      // Use document.body to avoid scrollbar issues
      return {
        width: document.body.clientWidth,
        height: window.innerHeight,
      };
    };

    setWindowDimensions(getWindowDimensions());

    const handleResize = () => {
      setWindowDimensions(getWindowDimensions());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check for exercise completion and trigger confetti
  useEffect(() => {
    if (completedSteps.length === exercise.steps.length && completedSteps.length > 0) {
      setShowConfetti(true);
      // Auto-hide confetti after 5 seconds
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [completedSteps.length, exercise.steps.length]);

  // Save progress to localStorage
  useEffect(() => {
    localStorage.setItem(
      `exercise-${exercise.id}-progress`,
      JSON.stringify({
        completedSteps,
        currentStep,
        isStarted,
        startTime: startTime?.toISOString(),
      })
    );
  }, [completedSteps, currentStep, isStarted, startTime, exercise.id]);

  const startExercise = () => {
    setIsStarted(true);
    setStartTime(new Date());
  };

  const resetProgress = () => {
    setCompletedSteps([]);
    setCurrentStep(0);
    setIsStarted(false);
    setStartTime(null);
    localStorage.removeItem(`exercise-${exercise.id}-progress`);
  };

  const toggleStepCompletion = (stepId: string) => {
    setCompletedSteps((prev) =>
      prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId]
    );
  };

  const navigateToStep = (stepIndex: number) => {
    setCurrentStep(Math.max(0, Math.min(stepIndex, exercise.steps.length - 1)));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const IconComponent = iconComponents[exercise.icon] || Code;
  const progressPercentage = (completedSteps.length / exercise.steps.length) * 100;
  const currentStepData = exercise.steps[currentStep];

  const difficultyColors = {
    beginner: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    advanced: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  };

  const environmentColors = {
    local: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    cloud: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    browser: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    container: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400',
  };

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Exercises', href: '/exercises' },
    { label: exercise.title, href: `/exercises/${exercise.id}`, isCurrent: true },
  ];

  return (
    <div className="container px-4 py-8 mx-auto overflow-hidden">
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <Confetti
            width={windowDimensions.width}
            height={windowDimensions.height}
            recycle={false}
            numberOfPieces={300}
            gravity={0.3}
          />
        </div>
      )}

      <Breadcrumb items={breadcrumbItems} />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        {/* Main Content */}
        <div className="xl:col-span-9">
          {/* Exercise Header */}
          <div className="mb-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-4 border rounded-xl bg-linear-to-br from-primary/10 to-primary/5 border-primary/20">
                <IconComponent className="w-8 h-8 text-primary" />
              </div>

              <div className="flex-1">
                <h1 className="mb-2 text-3xl font-bold">{exercise.title}</h1>
                <p className="mb-4 text-lg text-muted-foreground">{exercise.description}</p>

                <div className="flex flex-wrap items-center gap-3">
                  <Badge className={cn('text-sm', difficultyColors[exercise.difficulty])}>
                    {exercise.difficulty}
                  </Badge>
                  <Badge className={cn('text-sm', environmentColors[exercise.environment])}>
                    {exercise.environment}
                  </Badge>
                  <Badge variant="secondary">{exercise.category.name}</Badge>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {exercise.estimatedTime}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Target className="w-4 h-4" />
                    {exercise.steps.length} steps
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            {isStarted && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {completedSteps.length} of {exercise.steps.length} steps completed
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {!isStarted ? (
                <Button onClick={startExercise} size="lg" className="gap-2">
                  <Play className="w-4 h-4" />
                  Start Exercise
                </Button>
              ) : (
                <Button onClick={resetProgress} variant="outline" size="lg" className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Reset Progress
                </Button>
              )}
            </div>
          </div>

          {!isStarted ? (
            /* Exercise Overview */
            <div className="space-y-6">
              {/* Prerequisites */}
              {exercise.prerequisites.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      Prerequisites
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1 list-disc list-inside">
                      {exercise.prerequisites.map((prereq, index) => (
                        <li key={index} className="text-muted-foreground">
                          {prereq}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Learning Objectives */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Learning Objectives
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {exercise.learningObjectives.map((objective, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                        <span>{objective}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Technologies */}
              <Card>
                <CardHeader>
                  <CardTitle>Technologies Used</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {exercise.technologies.map((tech) => (
                      <Badge key={tech} variant="outline">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Steps Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Exercise Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {exercise.steps.map((step, index) => (
                      <div
                        key={step.id}
                        className={cn(
                          'flex items-start gap-3 p-3 border rounded-lg transition-colors',
                          completedSteps.includes(step.id)
                            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                            : 'border-border',
                          currentStep === index && 'ring-2 ring-primary/20'
                        )}
                      >
                        <div
                          className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                            completedSteps.includes(step.id)
                              ? 'bg-green-600 text-white'
                              : 'bg-primary/10'
                          )}
                        >
                          {completedSteps.includes(step.id) ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <span className="text-xs font-medium">{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4
                              className={cn(
                                'font-medium',
                                completedSteps.includes(step.id) &&
                                  'text-green-800 dark:text-green-200'
                              )}
                            >
                              {step.title}
                            </h4>
                            {currentStep === index && (
                              <Badge variant="secondary" className="text-xs">
                                Current
                              </Badge>
                            )}
                          </div>
                          <p
                            className={cn(
                              'text-sm text-muted-foreground',
                              completedSteps.includes(step.id) &&
                                'text-green-700 dark:text-green-300'
                            )}
                          >
                            {step.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Exercise Steps */
            <div className="space-y-6">
              {/* Step Navigation */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => navigateToStep(currentStep - 1)}
                  disabled={currentStep === 0}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Previous
                </Button>

                <div className="text-sm text-muted-foreground">
                  Step {currentStep + 1} of {exercise.steps.length}
                </div>

                <Button
                  variant="outline"
                  onClick={() => navigateToStep(currentStep + 1)}
                  disabled={currentStep === exercise.steps.length - 1}
                  className="gap-2"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Current Step */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {completedSteps.includes(currentStepData.id) ? (
                          <CheckCircle2 className="w-6 h-6 text-green-600" />
                        ) : (
                          <Circle className="w-6 h-6 text-muted-foreground" />
                        )}
                        {currentStepData.title}
                      </div>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Step {currentStep + 1}</Badge>
                      <Button
                        onClick={() => toggleStepCompletion(currentStepData.id)}
                        variant={
                          completedSteps.includes(currentStepData.id) ? 'default' : 'outline'
                        }
                        size="sm"
                        className={cn(
                          'transition-colors',
                          completedSteps.includes(currentStepData.id)
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'hover:bg-green-50 hover:text-green-700 hover:border-green-300'
                        )}
                      >
                        {completedSteps.includes(currentStepData.id) ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Completed
                          </>
                        ) : (
                          <>
                            <Circle className="w-4 h-4 mr-1" />
                            Mark Complete
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">{currentStepData.description}</p>

                  {/* Commands */}
                  {currentStepData.commands && currentStepData.commands.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 mb-2 font-medium">
                        <Terminal className="w-4 h-4" />
                        Commands to Run
                      </h4>
                      <div className="space-y-2">
                        {currentStepData.commands.map((command, index) => (
                          <div key={index} className="relative group">
                            <pre className="p-3 pr-12 overflow-x-auto text-sm rounded-lg bg-muted">
                              <code>{command}</code>
                            </pre>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(command)}
                              className="absolute transition-opacity opacity-0 top-2 right-2 group-hover:opacity-100"
                            >
                              {copiedText === command ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Code Example */}
                  {currentStepData.codeExample && (
                    <div>
                      <h4 className="flex items-center gap-2 mb-2 font-medium">
                        <Code className="w-4 h-4" />
                        Code Example
                      </h4>
                      <div className="relative group">
                        <pre className="p-4 pr-12 overflow-x-auto text-sm rounded-lg bg-muted">
                          <code>{currentStepData.codeExample}</code>
                        </pre>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(currentStepData.codeExample!)}
                          className="absolute transition-opacity opacity-0 top-2 right-2 group-hover:opacity-100"
                        >
                          {copiedText === currentStepData.codeExample ? (
                            <Check className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Expected Output */}
                  {currentStepData.expectedOutput && (
                    <div className="p-3 border border-green-200 rounded-lg bg-green-50 dark:bg-green-950/20 dark:border-green-800">
                      <h4 className="mb-1 font-medium text-green-800 dark:text-green-200">
                        Expected Output
                      </h4>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {currentStepData.expectedOutput}
                      </p>
                    </div>
                  )}

                  {/* Hints */}
                  {currentStepData.hints && currentStepData.hints.length > 0 && (
                    <div className="p-3 border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
                      <h4 className="mb-2 font-medium text-blue-800 dark:text-blue-200">
                        💡 Hints
                      </h4>
                      <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                        {currentStepData.hints.map((hint, index) => (
                          <li key={index} className="list-disc list-inside">
                            {hint}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Validation Criteria */}
                  {currentStepData.validationCriteria &&
                    currentStepData.validationCriteria.length > 0 && (
                      <div>
                        <h4 className="mb-2 font-medium">Validation Criteria</h4>
                        <ul className="space-y-1">
                          {currentStepData.validationCriteria.map((criteria, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                              <span className="text-sm text-muted-foreground">{criteria}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Step Completion Actions */}
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {completedSteps.includes(currentStepData.id) ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-4 h-4" />
                            Step completed
                          </span>
                        ) : (
                          "Mark this step as complete when you're done"
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => toggleStepCompletion(currentStepData.id)}
                          variant={
                            completedSteps.includes(currentStepData.id) ? 'outline' : 'default'
                          }
                          size="sm"
                          className={cn(
                            'transition-colors',
                            completedSteps.includes(currentStepData.id)
                              ? 'border-green-300 text-green-700 hover:bg-green-50'
                              : 'bg-primary hover:bg-primary/90'
                          )}
                        >
                          {completedSteps.includes(currentStepData.id) ? (
                            <>
                              <RotateCcw className="w-4 h-4 mr-1" />
                              Mark Incomplete
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Complete Step
                            </>
                          )}
                        </Button>

                        {currentStep < exercise.steps.length - 1 &&
                          completedSteps.includes(currentStepData.id) && (
                            <Button
                              onClick={() => navigateToStep(currentStep + 1)}
                              variant="outline"
                              size="sm"
                              className="gap-1"
                            >
                              Next Step
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Exercise Completion */}
              {completedSteps.length === exercise.steps.length && (
                <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
                  <CardContent className="p-6 text-center">
                    <Award className="w-12 h-12 mx-auto mb-4 text-green-600" />
                    <h3 className="mb-2 text-xl font-bold text-green-800 dark:text-green-200">
                      🎉 Exercise Completed!
                    </h3>
                    <p className="mb-4 text-green-700 dark:text-green-300">
                      Congratulations! You've successfully completed all steps of this exercise.
                    </p>
                    <div className="flex justify-center gap-3">
                      <Button asChild>
                        <Link href="/exercises">Browse More Exercises</Link>
                      </Button>
                      <Button variant="outline" onClick={resetProgress}>
                        Try Again
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Report Issue Component */}
          <div className="mt-8">
            <ReportIssue
              title={exercise.title}
              type="exercise"
              slug={exercise.id}
              variant="compact"
            />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="xl:col-span-3">
          <div className="sticky space-y-6 top-8">
            {/* Step Progress Sidebar (only when started) */}
            {isStarted && (
              <Card>
                <CardHeader className="p-3">
                  <CardTitle className="text-base">Exercise Progress</CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-2">
                    {exercise.steps.map((step, index) => (
                      <button
                        key={step.id}
                        onClick={() => setCurrentStep(index)}
                        className={cn(
                          'w-full flex items-start gap-3 p-2 rounded-lg text-left transition-colors',
                          currentStep === index
                            ? 'bg-primary/10 border border-primary/20'
                            : 'hover:bg-muted/50'
                        )}
                      >
                        <div className="shrink-0 mt-0.5">
                          {completedSteps.includes(step.id) ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : currentStep === index ? (
                            <Circle className="w-4 h-4 text-primary" />
                          ) : (
                            <Circle className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div
                            className={cn(
                              'text-sm font-medium truncate',
                              currentStep === index ? 'text-primary' : 'text-foreground'
                            )}
                          >
                            {step.title}
                          </div>
                          <div className="text-xs text-muted-foreground">Step {index + 1}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Resources */}
            {exercise.resources && exercise.resources.length > 0 && (
              <Card>
                <CardHeader className="p-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Book className="w-4 h-4" />
                    Resources
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-3">
                    {exercise.resources.map((resource, index) => (
                      <a
                        key={index}
                        href={resource.url}
                        target={resource.external ? '_blank' : undefined}
                        rel={resource.external ? 'noopener noreferrer' : undefined}
                        className="block p-2 transition-colors rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-start gap-2">
                          <ExternalLink className="shrink-0 w-3 h-3 mt-1 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-primary hover:text-primary/80">
                              {resource.title}
                            </div>
                            <Badge variant="outline" className="mt-1 text-xs">
                              {resource.type}
                            </Badge>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <SponsorSidebar />
          </div>
        </aside>
      </div>
    </div>
  );
}
