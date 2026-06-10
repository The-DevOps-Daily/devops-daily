'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ReportIssue } from '@/components/report-issue';
import {
  Shield,
  Lock,
  Key,
  Eye,
  Container,
  Cloud,
  Workflow,
  Terminal,
  BookOpen,
  CheckCircle2,
  Clock,
  Target,
  Lightbulb,
  Rocket,
  ChevronRight,
  ExternalLink,
  Star,
  ArrowRight,
  ShieldCheck,
  Trophy,
  MapPin,
  PlayCircle,
} from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';

import { type DevSecOpsMilestone, milestones } from '@/lib/roadmap-devsecops-data';

const priorityColors = {
  essential: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  important: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'nice-to-have': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const difficultyColors = {
  easy: 'text-green-600 dark:text-green-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  hard: 'text-red-600 dark:text-red-400',
};

export default function DevSecOpsRoadmapPage() {
  const [expandedMilestones, setExpandedMilestones] = useState<string[]>(['security-fundamentals']);
  const [completedSkills, setCompletedSkills] = useState<Set<string>>(new Set());

  const toggleMilestone = (id: string) => {
    setExpandedMilestones((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const toggleSkill = (milestoneId: string, skillName: string) => {
    const key = `${milestoneId}-${skillName}`;
    setCompletedSkills((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const getTotalProgress = () => {
    const totalSkills = milestones.reduce((acc, m) => acc + m.skills.length, 0);
    return Math.round((completedSkills.size / totalSkills) * 100);
  };

  const getMilestoneProgress = (milestone: DevSecOpsMilestone) => {
    const completed = milestone.skills.filter((s) =>
      completedSkills.has(`${milestone.id}-${s.name}`)
    ).length;
    return Math.round((completed / milestone.skills.length) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="container mx-auto px-4 max-w-6xl relative">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-sm font-medium">
              <ShieldCheck className="h-4 w-4" />
              <span>Security-First DevOps</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              DevSecOps{' '}
              <span className="text-primary">
                Roadmap
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Master the art of integrating security into every stage of the software development
              lifecycle. Shift left, automate security, and build resilient systems.
            </p>

            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Badge variant="outline" className="px-3 py-1">
                <Clock className="h-3 w-3 mr-1" />
                6-7 Months
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                <Target className="h-3 w-3 mr-1" />
                6 Milestones
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                <Shield className="h-3 w-3 mr-1" />
                30+ Security Skills
              </Badge>
            </div>

            {/* Progress Overview */}
            <div className="max-w-md mx-auto pt-8">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Your Progress</span>
                <span className="font-medium">{getTotalProgress()}%</span>
              </div>
              <Progress value={getTotalProgress()} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Click on skills to mark them as completed
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Principles */}
      <section className="py-12 container mx-auto px-4 max-w-6xl">
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ArrowRight className="h-5 w-5 text-red-500" />
                Shift Left
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Integrate security early in the development process to catch vulnerabilities before
                they reach production.
              </p>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-purple-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Workflow className="h-5 w-5 text-purple-500" />
                Automate Everything
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Embed security checks into CI/CD pipelines for consistent, repeatable security
                validation.
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="h-5 w-5 text-blue-500" />
                Continuous Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Monitor, detect, and respond to security threats in real-time across your entire
                infrastructure.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Milestones */}
      <section className="py-12 container mx-auto px-4 max-w-6xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
          Your DevSecOps Journey
        </h2>

        <div className="space-y-6">
          {milestones.map((milestone, index) => {
            const isExpanded = expandedMilestones.includes(milestone.id);
            const progress = getMilestoneProgress(milestone);
            const Icon = milestone.icon;

            return (
              <Card
                key={milestone.id}
                className={cn('transition-all duration-300', milestone.bgColor)}
              >
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => toggleMilestone(milestone.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'p-3 rounded-xl',
                          milestone.bgColor.replace('border', 'bg')
                        )}
                      >
                        <Icon className={cn('h-6 w-6', milestone.color)} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xl">{milestone.title}</CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {milestone.subtitle}
                          </Badge>
                        </div>
                        <CardDescription className="mt-1">
                          {milestone.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <div className="text-sm font-medium">{progress}%</div>
                        <div className="text-xs text-muted-foreground">
                          {milestone.skills.filter((s) =>
                            completedSkills.has(`${milestone.id}-${s.name}`)
                          ).length}
                          /{milestone.skills.length} skills
                        </div>
                      </div>
                      <ChevronRight
                        className={cn(
                          'h-5 w-5 transition-transform',
                          isExpanded && 'rotate-90'
                        )}
                      />
                    </div>
                  </div>
                  <Progress value={progress} className="h-1 mt-4" />
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="grid lg:grid-cols-3 gap-6">
                      {/* Skills */}
                      <div className="lg:col-span-2 space-y-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Skills to Learn
                        </h4>
                        <div className="space-y-2">
                          {milestone.skills.map((skill) => {
                            const isCompleted = completedSkills.has(
                              `${milestone.id}-${skill.name}`
                            );
                            const SkillIcon = skill.icon;

                            return (
                              <div
                                key={skill.name}
                                className={cn(
                                  'p-3 rounded-lg border bg-background/50 cursor-pointer transition-all',
                                  isCompleted && 'bg-green-500/10 border-green-500/30'
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSkill(milestone.id, skill.name);
                                }}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={cn(
                                      'p-1.5 rounded-md',
                                      isCompleted
                                        ? 'bg-green-500/20'
                                        : 'bg-muted'
                                    )}
                                  >
                                    {isCompleted ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <SkillIcon className="h-4 w-4" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className={cn(
                                          'font-medium',
                                          isCompleted && 'line-through opacity-70'
                                        )}
                                      >
                                        {skill.name}
                                      </span>
                                      <Badge
                                        className={cn(
                                          'text-xs',
                                          priorityColors[skill.priority]
                                        )}
                                      >
                                        {skill.priority}
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
                                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <PlayCircle className="h-3 w-3" />
                                        Learn more
                                        {skill.external && (
                                          <ExternalLink className="h-3 w-3" />
                                        )}
                                      </Link>
                                    )}
                                    {skill.simulators?.map((sim) => (
                                      <Link
                                        key={sim.link}
                                        href={sim.link}
                                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2 ml-3"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Terminal className="h-3 w-3" />
                                        Try: {sim.name}
                                      </Link>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Sidebar */}
                      <div className="space-y-4">
                        {/* Project */}
                        <div className="p-4 rounded-lg border bg-background/50">
                          <h4 className="font-semibold flex items-center gap-2 mb-2">
                            <Rocket className="h-4 w-4" />
                            Milestone Project
                          </h4>
                          <p className="font-medium text-sm">{milestone.project.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {milestone.project.description}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn('mt-2', difficultyColors[milestone.project.difficulty])}
                          >
                            {milestone.project.difficulty}
                          </Badge>
                        </div>

                        {/* Outcomes */}
                        <div className="p-4 rounded-lg border bg-background/50">
                          <h4 className="font-semibold flex items-center gap-2 mb-2">
                            <Target className="h-4 w-4" />
                            Outcomes
                          </h4>
                          <ul className="space-y-1">
                            {milestone.outcomes.map((outcome) => (
                              <li
                                key={outcome}
                                className="text-xs text-muted-foreground flex items-start gap-2"
                              >
                                <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                                {outcome}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Tips */}
                        <div className="p-4 rounded-lg border bg-background/50">
                          <h4 className="font-semibold flex items-center gap-2 mb-2">
                            <Lightbulb className="h-4 w-4 text-yellow-500" />
                            Pro Tips
                          </h4>
                          <ul className="space-y-1">
                            {milestone.tips.map((tip) => (
                              <li
                                key={tip}
                                className="text-xs text-muted-foreground flex items-start gap-2"
                              >
                                <Star className="h-3 w-3 text-yellow-500 mt-0.5 shrink-0" />
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 container mx-auto px-4 max-w-4xl">
        <Card className="border-2 border-dashed">
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-2xl font-bold mb-2">Ready to Secure Your Pipeline?</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start with the Security Fundamentals milestone and work your way up. Remember:
              security is a journey, not a destination.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild>
                <Link href="/checklists">
                  <Shield className="h-4 w-4 mr-2" />
                  Security Checklists
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/roadmap">
                  <MapPin className="h-4 w-4 mr-2" />
                  Full DevOps Roadmap
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Resources */}
      <section className="py-12 container mx-auto px-4 max-w-6xl mb-16">
        <h2 className="text-2xl font-bold text-center mb-8">Additional Resources</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/checklists/aws-security"
            className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
          >
            <Cloud className="h-8 w-8 text-orange-500 mb-2" />
            <h4 className="font-semibold">AWS Security</h4>
            <p className="text-xs text-muted-foreground">Cloud security checklist</p>
          </Link>
          <Link
            href="/checklists/kubernetes-security"
            className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
          >
            <Container className="h-8 w-8 text-blue-500 mb-2" />
            <h4 className="font-semibold">Kubernetes Security</h4>
            <p className="text-xs text-muted-foreground">Container security checklist</p>
          </Link>
          <Link
            href="/checklists/docker-security"
            className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
          >
            <Container className="h-8 w-8 text-cyan-500 mb-2" />
            <h4 className="font-semibold">Docker Security</h4>
            <p className="text-xs text-muted-foreground">Image hardening checklist</p>
          </Link>
          <Link
            href="/checklists/ssh-hardening"
            className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
          >
            <Lock className="h-8 w-8 text-green-500 mb-2" />
            <h4 className="font-semibold">SSH Hardening</h4>
            <p className="text-xs text-muted-foreground">Secure access checklist</p>
          </Link>
        </div>
      </section>

      {/* Report Issue */}
      <section className="py-8 container mx-auto px-4 max-w-4xl mb-16">
        <div className="text-center">
          <ReportIssue
            title="Found an issue with this roadmap?"
            type="page"
            slug="roadmap/devsecops"
            variant="default"
          />
        </div>
      </section>
    </div>
  );
}
