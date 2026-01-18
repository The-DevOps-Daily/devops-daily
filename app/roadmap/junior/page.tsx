'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ReportIssue } from '@/components/report-issue';
import {
  Terminal,
  GitBranch,
  Cloud,
  Container,
  Workflow,
  Server,
  BookOpen,
  CheckCircle2,
  Clock,
  Target,
  Lightbulb,
  Rocket,
  ChevronRight,
  ExternalLink,
  Star,
  Heart,
  ArrowRight,
  GraduationCap,
  Sparkles,
  Trophy,
  MapPin,
  PlayCircle,
  FileText,
  Code,
  Globe,
  LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface JuniorSkill {
  name: string;
  description: string;
  link?: string;
  external?: boolean;
  icon: LucideIcon;
  priority: 'essential' | 'important' | 'nice-to-have';
  estimatedHours: number;
}

interface JuniorMilestone {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  timeframe: string;
  skills: JuniorSkill[];
  project: {
    name: string;
    description: string;
    difficulty: 'easy' | 'medium';
  };
  outcomes: string[];
  tips: string[];
}

const milestones: JuniorMilestone[] = [
  {
    id: 'foundation',
    title: 'Foundation',
    subtitle: 'Month 1-2',
    description: 'Build your core skills with Linux and command line basics',
    icon: Terminal,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    timeframe: '4-8 weeks',
    skills: [
      {
        name: 'Linux Basics',
        description: 'Learn essential Linux commands, file system navigation, and permissions',
        link: '/guides/introduction-to-linux',
        icon: Terminal,
        priority: 'essential',
        estimatedHours: 20,
      },
      {
        name: 'Bash Scripting',
        description: 'Automate repetitive tasks with simple shell scripts',
        link: '/guides/introduction-to-bash',
        icon: Code,
        priority: 'essential',
        estimatedHours: 15,
      },
      {
        name: 'Git Basics',
        description: 'Learn version control fundamentals - commit, push, pull, and branches',
        link: '/guides/introduction-to-git',
        icon: GitBranch,
        priority: 'essential',
        estimatedHours: 10,
      },
      {
        name: 'Networking Fundamentals',
        description: 'Understand IP addresses, DNS, HTTP, and basic networking concepts',
        link: '/guides/networking-fundamentals',
        icon: Globe,
        priority: 'important',
        estimatedHours: 12,
      },
    ],
    project: {
      name: 'Personal Dev Environment',
      description: 'Set up a Linux VM, configure Git, and write scripts to automate your setup',
      difficulty: 'easy',
    },
    outcomes: [
      'Navigate confidently in the terminal',
      'Write basic automation scripts',
      'Use Git for version control',
    ],
    tips: [
      'Practice commands daily - muscle memory is key',
      'Use a Linux VM or WSL for hands-on learning',
      'Break complex tasks into smaller scripts',
    ],
  },
  {
    id: 'version-control',
    title: 'Version Control & Collaboration',
    subtitle: 'Month 2-3',
    description: 'Master Git workflows and start collaborating with teams',
    icon: GitBranch,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500/10 border-orange-500/20',
    timeframe: '3-4 weeks',
    skills: [
      {
        name: 'Git Branching Strategies',
        description: 'Learn GitFlow, trunk-based development, and when to use each',
        link: '/guides/git-branching-strategies',
        icon: GitBranch,
        priority: 'essential',
        estimatedHours: 8,
      },
      {
        name: 'Pull Requests & Code Review',
        description: 'Create PRs, review code, and collaborate effectively',
        link: '/guides/code-review-best-practices',
        icon: FileText,
        priority: 'essential',
        estimatedHours: 6,
      },
      {
        name: 'GitHub Actions Basics',
        description: 'Automate simple workflows like linting and testing',
        link: '/guides/introduction-to-github-actions',
        icon: Workflow,
        priority: 'important',
        estimatedHours: 10,
      },
    ],
    project: {
      name: 'Automated Testing Pipeline',
      description: 'Create a GitHub repo with automated tests running on every push',
      difficulty: 'easy',
    },
    outcomes: [
      'Collaborate on code with confidence',
      'Set up basic CI pipelines',
      'Resolve merge conflicts easily',
    ],
    tips: [
      'Contribute to open source to practice PRs',
      'Start with simple GitHub Actions workflows',
      'Always write meaningful commit messages',
    ],
  },
  {
    id: 'containers',
    title: 'Containers',
    subtitle: 'Month 3-4',
    description: 'Learn Docker and understand containerization concepts',
    icon: Container,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-500/10 border-cyan-500/20',
    timeframe: '4-6 weeks',
    skills: [
      {
        name: 'Docker Fundamentals',
        description: 'Build, run, and manage containers with Docker',
        link: '/guides/introduction-to-docker',
        icon: Container,
        priority: 'essential',
        estimatedHours: 20,
      },
      {
        name: 'Dockerfile Best Practices',
        description: 'Write efficient, secure, and maintainable Dockerfiles',
        link: '/guides/dockerfile-best-practices',
        icon: FileText,
        priority: 'essential',
        estimatedHours: 8,
      },
      {
        name: 'Docker Compose',
        description: 'Define and run multi-container applications',
        link: '/guides/docker-compose-guide',
        icon: Server,
        priority: 'important',
        estimatedHours: 10,
      },
    ],
    project: {
      name: 'Containerized Web App',
      description: 'Containerize a web application with a database using Docker Compose',
      difficulty: 'medium',
    },
    outcomes: [
      'Containerize any application',
      'Run multi-container setups',
      'Debug container issues',
    ],
    tips: [
      'Always use official base images',
      'Keep images small and secure',
      'Practice with real applications you use',
    ],
  },
  {
    id: 'ci-cd',
    title: 'CI/CD Pipelines',
    subtitle: 'Month 4-5',
    description: 'Build automated pipelines for testing and deployment',
    icon: Workflow,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/10 border-green-500/20',
    timeframe: '4-6 weeks',
    skills: [
      {
        name: 'CI/CD Concepts',
        description: 'Understand continuous integration and delivery principles',
        link: '/guides/ci-cd-fundamentals',
        icon: Workflow,
        priority: 'essential',
        estimatedHours: 6,
      },
      {
        name: 'GitHub Actions Advanced',
        description: 'Build complete CI/CD pipelines with GitHub Actions',
        link: '/guides/github-actions-advanced',
        icon: Workflow,
        priority: 'essential',
        estimatedHours: 15,
      },
      {
        name: 'Testing in Pipelines',
        description: 'Integrate unit tests, linting, and security scans',
        link: '/guides/testing-in-ci-cd',
        icon: CheckCircle2,
        priority: 'important',
        estimatedHours: 10,
      },
    ],
    project: {
      name: 'Full CI/CD Pipeline',
      description: 'Build a pipeline that tests, builds Docker images, and deploys to staging',
      difficulty: 'medium',
    },
    outcomes: [
      'Build end-to-end CI/CD pipelines',
      'Automate testing and deployments',
      'Reduce manual deployment errors',
    ],
    tips: [
      'Start simple, then add complexity',
      'Always have a staging environment',
      'Make pipelines fast - aim for under 10 minutes',
    ],
  },
  {
    id: 'cloud',
    title: 'Cloud Basics',
    subtitle: 'Month 5-6',
    description: 'Get started with cloud platforms and core services',
    icon: Cloud,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/20',
    timeframe: '6-8 weeks',
    skills: [
      {
        name: 'Cloud Fundamentals',
        description: 'Understand cloud computing concepts, pricing, and service models',
        link: '/guides/cloud-computing-fundamentals',
        icon: Cloud,
        priority: 'essential',
        estimatedHours: 10,
      },
      {
        name: 'AWS/Azure/GCP Core Services',
        description: 'Learn compute, storage, and networking basics on your chosen platform',
        link: '/guides/aws-for-beginners',
        icon: Server,
        priority: 'essential',
        estimatedHours: 25,
      },
      {
        name: 'Infrastructure as Code Basics',
        description: 'Introduction to Terraform for managing cloud resources',
        link: '/guides/introduction-to-terraform',
        icon: Code,
        priority: 'important',
        estimatedHours: 15,
      },
    ],
    project: {
      name: 'Deploy to the Cloud',
      description: 'Deploy your containerized app to a cloud platform using IaC',
      difficulty: 'medium',
    },
    outcomes: [
      'Navigate cloud consoles confidently',
      'Deploy applications to the cloud',
      'Manage cloud resources with code',
    ],
    tips: [
      'Use free tier resources for learning',
      'Pick ONE cloud provider to start',
      'Always set up billing alerts',
    ],
  },
];

const priorityConfig = {
  essential: {
    label: 'Essential',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  important: {
    label: 'Important',
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  'nice-to-have': {
    label: 'Nice to Have',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
};

export default function JuniorDevOpsRoadmap() {
  const [completedSkills, setCompletedSkills] = useState<Set<string>>(new Set());
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());

  const toggleMilestone = (milestoneId: string) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(milestoneId)) {
        next.delete(milestoneId);
      } else {
        next.add(milestoneId);
      }
      return next;
    });
  };

  const toggleSkill = (skillName: string) => {
    setCompletedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(skillName)) {
        next.delete(skillName);
      } else {
        next.add(skillName);
      }
      return next;
    });
  };

  const totalSkills = milestones.reduce((acc, m) => acc + m.skills.length, 0);
  const completedCount = completedSkills.size;
  const progressPercentage = Math.round((completedCount / totalSkills) * 100);

  return (
    <div className="min-h-screen bg-linear-to-b from-blue-50/50 via-background to-background dark:from-blue-950/20">
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden border-b md:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-96 h-96 bg-blue-400/20 rounded-full blur-3xl -top-48 -left-48" />
          <div className="absolute w-96 h-96 bg-purple-400/20 rounded-full blur-3xl -bottom-48 -right-48" />
        </div>

        <div className="container relative px-4 mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4 gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" />
              Beginner Friendly
            </Badge>

            <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              Junior DevOps{' '}
              <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-purple-600">
                Roadmap
              </span>
            </h1>

            <p className="mb-8 text-lg text-muted-foreground md:text-xl">
              A clear, focused path to land your first DevOps role.{' '}
              <span className="font-medium text-foreground">No overwhelm, just essentials.</span>
            </p>

            <div className="flex flex-wrap items-center justify-center gap-6 mb-8 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span>6 months</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-green-500" />
                <span>5 milestones</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                <span>{totalSkills} core skills</span>
              </div>
            </div>

            {/* Progress Tracker */}
            <div className="p-4 rounded-lg bg-background/80 backdrop-blur border max-w-md mx-auto">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="font-medium">Your Progress</span>
                <span className="text-muted-foreground">
                  {completedCount}/{totalSkills} skills
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <p className="mt-2 text-xs text-muted-foreground">
                Click skills below to track your progress
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <Button asChild size="lg">
                <a href="#roadmap">
                  Start Learning
                  <ArrowRight className="ml-2 w-4 h-4" />
                </a>
              </Button>
              <Button variant="outline" asChild size="lg">
                <Link href="/roadmap">
                  View Full Roadmap
                  <ExternalLink className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Why This Roadmap Section */}
      <section className="py-12 border-b bg-muted/30">
        <div className="container px-4 mx-auto">
          <div className="max-w-4xl mx-auto">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-background border">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Target className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Focused</h3>
                  <p className="text-sm text-muted-foreground">
                    Only the skills you actually need for a junior role
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-background border">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Lightbulb className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Project Ideas</h3>
                  <p className="text-sm text-muted-foreground">
                    Suggested projects to practice skills
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-background border">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Rocket className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Achievable</h3>
                  <p className="text-sm text-muted-foreground">
                    Realistic 6-month timeline with clear goals
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section id="roadmap" className="py-16">
        <div className="container px-4 mx-auto">
          <div className="max-w-4xl mx-auto">
            <div className="mb-12 text-center">
              <h2 className="mb-3 text-2xl font-bold md:text-3xl">Your Learning Path</h2>
              <p className="text-muted-foreground">
                Follow these milestones in order. Each builds on the previous one.
              </p>
            </div>

            {/* Milestones */}
            <div className="space-y-8">
              {milestones.map((milestone, index) => (
                <Card
                  key={milestone.id}
                  className={cn(
                    'relative overflow-hidden transition-all duration-300',
                    expandedMilestones.has(milestone.id) && 'ring-2 ring-primary'
                  )}
                >
                  {/* Milestone number indicator */}
                  <div className="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-blue-500 via-purple-500 to-pink-500" />

                  <CardHeader
                    className="cursor-pointer"
                    onClick={() =>
                      toggleMilestone(milestone.id)
                    }
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={cn('p-3 rounded-xl border', milestone.bgColor)}>
                          <milestone.icon className={cn('w-6 h-6', milestone.color)} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {milestone.subtitle}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {milestone.timeframe}
                            </span>
                          </div>
                          <CardTitle className="text-xl">{milestone.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {milestone.description}
                          </CardDescription>
                        </div>
                      </div>
                      <ChevronRight
                        className={cn(
                          'w-5 h-5 text-muted-foreground transition-transform',
                          expandedMilestones.has(milestone.id) && 'rotate-90'
                        )}
                      />
                    </div>
                  </CardHeader>

                  {expandedMilestones.has(milestone.id) && (
                    <CardContent className="pt-0">
                      {/* Skills */}
                      <div className="mb-6">
                        <h4 className="mb-3 text-sm font-semibold flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          Skills to Learn
                        </h4>
                        <div className="space-y-2">
                          {milestone.skills.map((skill) => (
                            <div
                              key={skill.name}
                              className={cn(
                                'p-3 rounded-lg border transition-all cursor-pointer',
                                completedSkills.has(skill.name)
                                  ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                                  : 'bg-muted/30 hover:bg-muted/50'
                              )}
                              onClick={() => toggleSkill(skill.name)}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={cn(
                                    'mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                                    completedSkills.has(skill.name)
                                      ? 'bg-green-500 border-green-500'
                                      : 'border-muted-foreground/30'
                                  )}
                                >
                                  {completedSkills.has(skill.name) && (
                                    <CheckCircle2 className="w-3 h-3 text-white" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={cn(
                                        'font-medium',
                                        completedSkills.has(skill.name) && 'line-through opacity-60'
                                      )}
                                    >
                                      {skill.name}
                                    </span>
                                    <Badge
                                      variant="secondary"
                                      className={cn(
                                        'text-xs',
                                        priorityConfig[skill.priority].color
                                      )}
                                    >
                                      {priorityConfig[skill.priority].label}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      ~{skill.estimatedHours}h
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {skill.description}
                                  </p>
                                  {skill.link && (
                                    <Link
                                      href={skill.link}
                                      className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <PlayCircle className="w-3 h-3" />
                                      Start learning
                                      {skill.external && <ExternalLink className="w-3 h-3" />}
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Project */}
                      <div className="mb-6 p-4 rounded-lg bg-linear-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border">
                        <h4 className="mb-2 text-sm font-semibold flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          Milestone Project
                        </h4>
                        <p className="font-medium">{milestone.project.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {milestone.project.description}
                        </p>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {milestone.project.difficulty === 'easy' ? '🌱 Beginner' : '🌿 Intermediate'}
                        </Badge>
                      </div>

                      {/* Outcomes & Tips */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                          <h4 className="mb-2 text-sm font-semibold flex items-center gap-2 text-green-700 dark:text-green-400">
                            <CheckCircle2 className="w-4 h-4" />
                            By the End You'll
                          </h4>
                          <ul className="space-y-1">
                            {milestone.outcomes.map((outcome) => (
                              <li
                                key={outcome}
                                className="text-sm text-green-700 dark:text-green-400 flex items-start gap-2"
                              >
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                {outcome}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                          <h4 className="mb-2 text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                            <Lightbulb className="w-4 h-4" />
                            Pro Tips
                          </h4>
                          <ul className="space-y-1">
                            {milestone.tips.map((tip) => (
                              <li
                                key={tip}
                                className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2"
                              >
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            {/* Next Steps */}
            <Card className="mt-12 bg-linear-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10">
              <CardContent className="p-8 text-center">
                <Sparkles className="w-10 h-10 mx-auto mb-4 text-yellow-500" />
                <h3 className="mb-2 text-xl font-bold">Ready for More?</h3>
                <p className="mb-6 text-muted-foreground max-w-md mx-auto">
                  Once you've completed this roadmap, you'll be ready to tackle intermediate DevOps
                  topics like Kubernetes, advanced IaC, and observability.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button asChild>
                    <Link href="/roadmap">
                      <MapPin className="w-4 h-4 mr-2" />
                      Full DevOps Roadmap
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/guides">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Browse All Guides
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Report Issue */}
            <div className="mt-8 text-center">
              <ReportIssue
                title="Found an issue with this roadmap?"
                type="page"
                slug="roadmap/junior"
                variant="default"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
