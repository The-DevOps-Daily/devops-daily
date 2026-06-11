'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ReportIssue } from '@/components/report-issue';
import { RoadmapHero } from '@/components/roadmap-hero';
import { RoadmapStageNav } from '@/components/roadmap-stage-nav';
import { Github } from '@/components/icons/social-icons';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  BookOpen,
  Sparkles,
  ChevronRight,
  Timer,
  Heart,
  Users,
  TrendingUp,
  Brain,
  Award,
  Zap,
  ExternalLink,
  CheckCircle2,
  PlayCircle,
  FileText,
  Code,
  Settings,
  Target,
  Star,
  BookMarked,
  Video,
  Briefcase,
  DollarSign,
  Clock,
  GraduationCap,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';

import {
  type RoadmapSkill,
  type RoadmapProject,
  type CareerProgression,
  skillResourcesDatabase,
  roadmapStages,
} from '@/lib/roadmap-data';

const SkillModal = ({
  skill,
  isOpen,
  onClose,
}: {
  skill: RoadmapSkill | null;
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!skill) return null;

  const resources = skillResourcesDatabase[skill.name] || [];

  const resourceTypeIcons = {
    tutorial: BookOpen,
    documentation: FileText,
    course: GraduationCap,
    video: Video,
    book: BookMarked,
    tool: Settings,
    practice: Target,
  };

  const resourceTypeBadges = {
    tutorial: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    documentation: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
    course: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    video: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    book: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    tool: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    practice: 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400',
  };

  const typeIcons = {
    tool: Settings,
    concept: Brain,
    practice: Target,
    certification: Award,
  };

  const levelColors = {
    basic: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    advanced: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  };

  const TypeIcon = skill.type ? typeIcons[skill.type] : Settings;
  const SkillIcon = skill.icon || TypeIcon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 border rounded-xl bg-linear-to-br from-primary/10 to-primary/5 border-primary/20">
              <SkillIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="pr-8 mb-2 text-xl font-bold">{skill.name}</DialogTitle>
              <div className="flex items-center gap-2 mb-3">
                {skill.level && (
                  <Badge variant="outline" className={cn('text-xs', levelColors[skill.level])}>
                    {skill.level}
                  </Badge>
                )}
                {skill.type && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    <TypeIcon className="w-3 h-3 mr-1" />
                    {skill.type}
                  </Badge>
                )}
              </div>
              {skill.description && (
                <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                  {skill.description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Primary Link */}
          {skill.link && (
            <div className="p-4 border rounded-lg bg-muted/30 border-border/50">
              <h4 className="flex items-center gap-2 mb-2 font-semibold">
                <Star className="w-4 h-4 text-primary" />
                Primary Resource
              </h4>
              {skill.external ? (
                <a
                  href={skill.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 transition-colors text-primary hover:text-primary/80"
                >
                  <ExternalLink className="w-4 h-4" />
                  Visit External Resource
                </a>
              ) : (
                <Link
                  href={skill.link}
                  className="flex items-center gap-2 transition-colors text-primary hover:text-primary/80"
                  onClick={onClose}
                >
                  <ChevronRight className="w-4 h-4" />
                  View Internal Guide
                </Link>
              )}
            </div>
          )}

          {/* Additional Resources */}
          {resources.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 mb-4 font-semibold">
                <BookOpen className="w-4 h-4" />
                Learning Resources ({resources.length})
              </h4>
              <div className="grid gap-3">
                {resources.map((resource, index) => {
                  const ResourceIcon = resourceTypeIcons[resource.type];
                  return (
                    <div
                      key={index}
                      className="p-4 transition-colors border rounded-md border-border/50 hover:border-primary/40 hover:bg-muted/30 group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 transition-colors rounded-md bg-muted/50 group-hover:bg-primary/10">
                          <ResourceIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h5 className="font-medium transition-colors group-hover:text-primary">
                              {resource.title}
                            </h5>
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-xs shrink-0',
                                resourceTypeBadges[resource.type]
                              )}
                            >
                              {resource.type}
                            </Badge>
                          </div>
                          {resource.description && (
                            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                              {resource.description}
                            </p>
                          )}
                          {resource.external ? (
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm transition-colors text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Open Resource
                            </a>
                          ) : (
                            <Link
                              href={resource.url}
                              className="inline-flex items-center gap-1 text-sm transition-colors text-primary hover:text-primary/80"
                              onClick={onClose}
                            >
                              <ChevronRight className="w-3 h-3" />
                              View Guide
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No resources message */}
          {!skill.link && resources.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">
                Resources for this skill are coming soon! Check back later for tutorials and guides.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="absolute p-2 transition-colors rounded-md top-4 right-4 hover:bg-muted/50"
          aria-label="Close modal"
        ></button>
      </DialogContent>
    </Dialog>
  );
};

const SkillCard = ({
  skill,
  stageColor,
  onSkillClick,
}: {
  skill: RoadmapSkill;
  stageColor?: string;
  onSkillClick?: (skill: RoadmapSkill) => void;
}) => {
  const levelColors = {
    basic: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    advanced: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  };

  const typeIcons = {
    tool: Settings,
    concept: Brain,
    practice: Target,
    certification: Award,
  };

  const TypeIcon = skill.type ? typeIcons[skill.type] : Settings;
  const SkillIcon = skill.icon || TypeIcon;

  const content = (
    <div className="relative p-4 transition-colors border cursor-pointer group/skill rounded-md border-border/50 hover:border-primary/40 hover:bg-muted/30 bg-card/50 backdrop-blur-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'p-2 rounded-lg transition-all duration-300 group-hover/skill:scale-110',
              stageColor ? `bg-linear-to-br ${stageColor} bg-opacity-10` : 'bg-muted'
            )}
          >
            <SkillIcon className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold transition-colors group-hover/skill:text-primary">
              {skill.name}
            </h4>
            {skill.level && (
              <Badge variant="outline" className={cn('text-xs h-5 mt-1', levelColors[skill.level])}>
                {skill.level}
              </Badge>
            )}
          </div>
        </div>
        <div className="transition-opacity duration-300 opacity-0 group-hover/skill:opacity-100">
          <ChevronRight className="w-3 h-3 text-primary" />
        </div>
      </div>

      {skill.description && (
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{skill.description}</p>
      )}

      {skill.type && (
        <div className="flex items-center gap-1">
          <TypeIcon className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs capitalize text-muted-foreground">{skill.type}</span>
        </div>
      )}

      <div className="absolute inset-0 transition-opacity duration-300 opacity-0 pointer-events-none rounded-xl bg-linear-to-br from-primary/5 to-transparent group-hover/skill:opacity-100" />
    </div>
  );

  // If onSkillClick is provided, handle click to open modal
  if (onSkillClick) {
    return (
      <div onClick={() => onSkillClick(skill)} className="block">
        {content}
      </div>
    );
  }

  // Fallback to original link behavior if no modal handler
  if (skill.link) {
    if (skill.external) {
      return (
        <a href={skill.link} target="_blank" rel="noopener noreferrer" className="block">
          {content}
        </a>
      );
    } else {
      return (
        <Link href={skill.link} className="block">
          {content}
        </Link>
      );
    }
  }

  return content;
};

const CareerProgressionCard = ({
  careerProgression,
  stageColor,
}: {
  careerProgression: CareerProgression;
  stageColor?: string;
}) => {
  const demandColors = {
    low: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    'very-high': 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  };

  return (
    <div className="p-4 border rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <div
          className={cn(
            'p-2 rounded-lg',
            stageColor ? `bg-linear-to-br ${stageColor} bg-opacity-10` : 'bg-muted'
          )}
        >
          <Briefcase className="w-4 h-4" />
        </div>
        <h4 className="font-semibold">Career Progression</h4>
      </div>

      <div className="space-y-3">
        <div>
          <h5 className="mb-2 text-sm font-medium text-muted-foreground">Potential Roles</h5>
          <div className="flex flex-wrap gap-1">
            {careerProgression.jobTitles.map((title) => (
              <Badge key={title} variant="outline" className="text-xs">
                {title}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium">{careerProgression.salaryRange}</span>
          </div>
          <Badge
            variant="outline"
            className={cn('text-xs', demandColors[careerProgression.demandLevel])}
          >
            {careerProgression.demandLevel.replace('-', ' ')} demand
          </Badge>
        </div>

        <div>
          <h5 className="mb-2 text-sm font-medium text-muted-foreground">Industry Adoption</h5>
          <p className="text-xs text-muted-foreground">{careerProgression.industryAdoption}</p>
        </div>
      </div>
    </div>
  );
};

const ProjectCard = ({ project, stageColor }: { project: RoadmapProject; stageColor?: string }) => {
  const difficultyColors = {
    beginner: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    advanced: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  };

  const content = (
    <div className="p-4 transition-colors border group/project rounded-md border-border/50 hover:border-primary/40 hover:bg-muted/30 bg-card/50 backdrop-blur-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'p-2 rounded-lg transition-all duration-300 group-hover/project:scale-110',
              stageColor ? `bg-linear-to-br ${stageColor} bg-opacity-10` : 'bg-muted'
            )}
          >
            <Code className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold transition-colors group-hover/project:text-primary">
              {project.name}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="outline"
                className={cn('text-xs h-5', difficultyColors[project.difficulty])}
              >
                {project.difficulty}
              </Badge>
              <Badge variant="outline" className="h-5 text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {project.estimatedTime}
              </Badge>
            </div>
          </div>
        </div>
        {project.githubUrl && (
          <div className="transition-opacity duration-300 opacity-0 group-hover/project:opacity-100">
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
          </div>
        )}
      </div>

      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{project.description}</p>

      <div className="flex flex-wrap gap-1">
        {project.technologies.slice(0, 4).map((tech) => (
          <Badge key={tech} variant="secondary" className="text-xs">
            {tech}
          </Badge>
        ))}
        {project.technologies.length > 4 && (
          <Badge variant="secondary" className="text-xs">
            +{project.technologies.length - 4} more
          </Badge>
        )}
      </div>

      <div className="absolute inset-0 transition-opacity duration-300 opacity-0 pointer-events-none rounded-xl bg-linear-to-br from-primary/5 to-transparent group-hover/project:opacity-100" />
    </div>
  );

  if (project.githubUrl || project.liveDemo) {
    return (
      <a
        href={project.githubUrl || project.liveDemo}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block"
      >
        {content}
      </a>
    );
  }

  return <div className="relative">{content}</div>;
};

const MarketContextCard = ({
  marketContext,
  industryStats,
  stageColor,
}: {
  marketContext: string;
  industryStats: string;
  stageColor?: string;
}) => {
  return (
    <div className="p-4 border rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <div
          className={cn(
            'p-2 rounded-lg',
            stageColor ? `bg-linear-to-br ${stageColor} bg-opacity-10` : 'bg-muted'
          )}
        >
          <TrendingUp className="w-4 h-4" />
        </div>
        <h4 className="font-semibold">Market Context</h4>
      </div>

      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">{marketContext}</p>
        <div className="p-3 border rounded-lg bg-primary/5 border-primary/20">
          <p className="text-sm font-medium text-primary">{industryStats}</p>
        </div>
      </div>
    </div>
  );
};

export default function RoadmapPage() {
  const [selectedSkill, setSelectedSkill] = useState<RoadmapSkill | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const learningStages = roadmapStages.filter((stage) => stage.id !== 'lifetime');
  const totalTime = learningStages.reduce((acc, stage) => {
    const weeks = parseInt(stage.timeEstimate.split('-')[1] || stage.timeEstimate);
    return acc + weeks;
  }, 0);

  const handleSkillClick = (skill: RoadmapSkill) => {
    setSelectedSkill(skill);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSkill(null);
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      {/* Enhanced Hero Section with Animations */}
      <RoadmapHero />

      <RoadmapStageNav
        stages={roadmapStages.map((s) => ({ id: s.id, title: s.title, icon: s.icon }))}
      />

      {/* Roadmap Timeline */}
      <section id="roadmap" className="py-20">
        <div className="container px-4 mx-auto">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <Badge variant="outline" className="mb-4">
                <Brain className="w-3.5 h-3.5 mr-2" />
                Interactive Learning Path
              </Badge>
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">The Complete DevOps Journey</h2>
              <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
                Each stage includes curated resources, hands-on projects, and real-world skills you
                can practice immediately.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
                <Link
                  href="/roadmap/junior"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full bg-primary/10 border border-primary/20 hover:border-primary/40 hover:bg-primary/20 transition-all duration-300 group"
                >
                  <GraduationCap className="w-4 h-4 text-primary" />
                  <span>New to DevOps? <span className="text-primary">Junior Roadmap</span></span>
                  <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link 
                  href="/roadmap/devsecops"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-red-500/10 to-purple-500/10 border border-red-500/20 hover:border-red-500/40 hover:from-red-500/20 hover:to-purple-500/20 transition-all duration-300 group"
                >
                  <ShieldCheck className="w-4 h-4 text-red-500" />
                  <span>Security focused? <span className="text-red-600 dark:text-red-400">DevSecOps Roadmap</span></span>
                  <ArrowRight className="w-4 h-4 text-red-500 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Desktop Timeline */}
            <div className="relative hidden lg:block">
              <div className="absolute w-2 h-full transform -translate-x-1/2 left-1/2">
                <div className="w-full h-full rounded-full bg-primary opacity-20" />
                <div className="absolute inset-0 w-1 mx-auto rounded-full bg-primary/60" />
              </div>

              {roadmapStages.map((stage, index) => (
                <div key={stage.id} id={`stage-${stage.id}`} className="relative mb-16 scroll-mt-28">
                  {/* Timeline Icon */}
                  <div className="absolute z-10 transform -translate-x-1/2 -translate-y-1/2 left-1/2 top-8">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full border-4 border-background flex items-center justify-center transition-transform duration-300 hover:scale-105',
                        stage.id === 'lifetime'
                          ? 'bg-linear-to-r from-amber-500 to-primary'
                          : 'bg-primary shadow-lg shadow-primary/25'
                      )}
                    >
                      <stage.icon className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-2 gap-8">
                    {/* Left Side - Skills */}
                    <div className="pr-8">
                      <Card className="group hover:border-primary/40 hover:bg-muted/30 transition-colors border">
                        <div
                          className={cn(
                            'absolute inset-0 rounded-lg opacity-5 transition-opacity duration-300 group-hover:opacity-10',
                            stage.color && `bg-linear-to-br ${stage.color}`
                          )}
                        />

                        <CardHeader className="relative pb-4">
                          <div className="flex items-center gap-3 mb-4">
                            <div
                              className={cn(
                                'p-3 rounded-xl transition-all duration-300 group-hover:scale-110 shadow-lg',
                                stage.id === 'lifetime'
                                  ? 'bg-linear-to-br from-yellow-500/20 via-pink-500/20 to-purple-500/20'
                                  : 'bg-muted',
                                stage.color && `bg-linear-to-br ${stage.color} bg-opacity-10`
                              )}
                            >
                              <stage.icon className="w-6 h-6" />
                            </div>
                            <div>
                              <CardTitle className="text-xl transition-colors group-hover:text-primary">
                                {stage.title}
                              </CardTitle>
                              {stage.badge && (
                                <Badge
                                  variant="outline"
                                  className="mt-1 text-xs bg-primary/10 border-primary/30 text-primary"
                                >
                                  <Star className="w-3 h-3 mr-1" />
                                  {stage.badge}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              'flex items-center gap-1 transition-all duration-300 px-3 py-1 w-fit',
                              stage.id === 'lifetime' &&
                                'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
                            )}
                          >
                            {stage.id === 'lifetime' ? (
                              <>
                                <Heart className="w-3 h-3" />
                                {stage.timeEstimate}
                              </>
                            ) : (
                              <>
                                <Timer className="w-3 h-3" />
                                {stage.timeEstimate}
                              </>
                            )}
                          </Badge>
                          <CardDescription className="mt-2 text-sm leading-relaxed">
                            {stage.description}
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="relative">
                          {/* Skills Grid */}
                          <div>
                            <h4 className="flex items-center gap-2 mb-4 font-semibold">
                              <Target className="w-4 h-4 text-primary" />
                              Skills & Resources ({stage.skills.length})
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                              {stage.skills.map((skill) => (
                                <SkillCard
                                  key={skill.name}
                                  skill={skill}
                                  stageColor={stage.color}
                                  onSkillClick={handleSkillClick}
                                />
                              ))}
                            </div>
                          </div>

                          {stage.id === 'lifetime' && (
                            <div className="pt-6 mt-6 border-t">
                              <p className="text-sm italic text-muted-foreground">
                                "The capacity to learn is a gift; the ability to learn is a skill;
                                the willingness to learn is a choice."
                                <span className="block mt-2 font-semibold text-right">
                                  - Brian Herbert
                                </span>
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Right Side - Projects, Career, Context */}
                    <div className="pl-8">
                      <div className="space-y-6">
                        {/* Market Context */}
                        {stage.marketContext && stage.industryStats && (
                          <MarketContextCard
                            marketContext={stage.marketContext}
                            industryStats={stage.industryStats}
                            stageColor={stage.color}
                          />
                        )}

                        {/* Prerequisites */}
                        {stage.prerequisites && stage.prerequisites.length > 0 && (
                          <Card className="border-blue-200/50 dark:border-blue-800/50">
                            <CardContent className="p-4 bg-blue-50 dark:bg-blue-950/20">
                              <h4 className="flex items-center gap-2 mb-3 text-sm font-semibold text-blue-700 dark:text-blue-300">
                                <CheckCircle2 className="w-4 h-4" />
                                Prerequisites
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {stage.prerequisites.map((prereq) => (
                                  <Badge
                                    key={prereq}
                                    variant="outline"
                                    className="text-xs text-blue-700 bg-blue-100 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300"
                                  >
                                    {prereq}
                                  </Badge>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Career Progression */}
                        {stage.careerProgression && (
                          <CareerProgressionCard
                            careerProgression={stage.careerProgression}
                            stageColor={stage.color}
                          />
                        )}

                        {/* Projects */}
                        {stage.projects && stage.projects.length > 0 && (
                          <Card>
                            <CardHeader className="pb-3">
                              <h4 className="flex items-center gap-2 font-semibold">
                                <Code className="w-4 h-4 text-primary" />
                                Hands-on Projects ({stage.projects.length})
                              </h4>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="grid grid-cols-1 gap-3">
                                {stage.projects.map((project) => (
                                  <ProjectCard
                                    key={project.name}
                                    project={project}
                                    stageColor={stage.color}
                                  />
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Outcomes */}
                        {stage.outcomes && stage.outcomes.length > 0 && (
                          <Card className="border-green-200/50 dark:border-green-800/50">
                            <CardContent className="p-4 bg-green-50 dark:bg-green-950/20">
                              <h4 className="flex items-center gap-2 mb-3 text-sm font-semibold text-green-700 dark:text-green-300">
                                <Award className="w-4 h-4" />
                                Learning Outcomes
                              </h4>
                              <ul className="space-y-2">
                                {stage.outcomes.map((outcome) => (
                                  <li
                                    key={outcome}
                                    className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300"
                                  >
                                    <CheckCircle2 className="shrink-0 w-3 h-3" />
                                    {outcome}
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Timeline */}
            <div className="space-y-12 lg:hidden">
              {roadmapStages.map((stage, index) => (
                <div key={stage.id} className="relative">
                  {index < roadmapStages.length - 1 && (
                    <div className="absolute w-1 h-12 rounded-full top-full left-8 bg-linear-to-b from-primary/50 to-primary/20" />
                  )}

                  <Card
                    className={cn(
                      'group hover:border-primary/40 hover:bg-muted/30 transition-colors border',
                      stage.id === 'lifetime' &&
                        'border-amber-500/40'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute inset-0 rounded-lg opacity-5 transition-opacity duration-300 group-hover:opacity-10',
                        stage.color && `bg-linear-to-br ${stage.color}`
                      )}
                    />

                    <CardHeader className="relative pb-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'p-3 rounded-lg transition-all duration-300',
                              stage.id === 'lifetime'
                                ? 'bg-linear-to-br from-yellow-500/20 via-pink-500/20 to-purple-500/20'
                                : 'bg-muted'
                            )}
                          >
                            <stage.icon className="w-6 h-6" />
                          </div>
                          <div>
                            <CardTitle className="text-xl">{stage.title}</CardTitle>
                            {stage.badge && (
                              <Badge
                                variant="outline"
                                className="mt-1 text-xs bg-primary/10 border-primary/30 text-primary"
                              >
                                <Star className="w-3 h-3 mr-1" />
                                {stage.badge}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'flex items-center gap-1',
                            stage.id === 'lifetime' &&
                              'bg-linear-to-r from-yellow-500 via-pink-500 to-purple-500 text-white border-none'
                          )}
                        >
                          {stage.id === 'lifetime' ? (
                            <>
                              <Heart className="w-3 h-3" />
                              {stage.timeEstimate}
                            </>
                          ) : (
                            <>
                              <Timer className="w-3 h-3" />
                              {stage.timeEstimate}
                            </>
                          )}
                        </Badge>
                      </div>
                      <CardDescription>{stage.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="relative">
                      {/* Market Context */}
                      {stage.marketContext && stage.industryStats && (
                        <div className="mb-4">
                          <MarketContextCard
                            marketContext={stage.marketContext}
                            industryStats={stage.industryStats}
                            stageColor={stage.color}
                          />
                        </div>
                      )}

                      {/* Prerequisites */}
                      {stage.prerequisites && stage.prerequisites.length > 0 && (
                        <div className="p-3 mb-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/50">
                          <h4 className="flex items-center gap-2 mb-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                            <CheckCircle2 className="w-4 h-4" />
                            Prerequisites
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {stage.prerequisites.map((prereq) => (
                              <Badge
                                key={prereq}
                                variant="outline"
                                className="text-xs text-blue-700 bg-blue-100 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300"
                              >
                                {prereq}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Career Progression */}
                      {stage.careerProgression && (
                        <div className="mb-4">
                          <CareerProgressionCard
                            careerProgression={stage.careerProgression}
                            stageColor={stage.color}
                          />
                        </div>
                      )}

                      {/* Skills */}
                      <div className="mb-4">
                        <h4 className="flex items-center gap-2 mb-3 font-semibold">
                          <Target className="w-4 h-4 text-primary" />
                          Skills & Resources ({stage.skills.length})
                        </h4>
                        <div className="space-y-2">
                          {stage.skills.map((skill) => (
                            <SkillCard
                              key={skill.name}
                              skill={skill}
                              stageColor={stage.color}
                              onSkillClick={handleSkillClick}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Projects */}
                      {stage.projects && stage.projects.length > 0 && (
                        <div className="mb-4">
                          <h4 className="flex items-center gap-2 mb-3 font-semibold">
                            <Code className="w-4 h-4 text-primary" />
                            Projects ({stage.projects.length})
                          </h4>
                          <div className="space-y-2">
                            {stage.projects.map((project) => (
                              <ProjectCard
                                key={project.name}
                                project={project}
                                stageColor={stage.color}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Outcomes */}
                      {stage.outcomes && stage.outcomes.length > 0 && (
                        <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200/50 dark:border-green-800/50">
                          <h4 className="flex items-center gap-2 mb-2 text-sm font-semibold text-green-700 dark:text-green-300">
                            <Award className="w-4 h-4" />
                            Learning Outcomes
                          </h4>
                          <ul className="space-y-1">
                            {stage.outcomes.map((outcome) => (
                              <li
                                key={outcome}
                                className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                {outcome}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {stage.id === 'lifetime' && (
                        <div className="pt-4 mt-4 border-t">
                          <p className="text-sm italic text-muted-foreground">
                            "The capacity to learn is a gift; the ability to learn is a skill; the
                            willingness to learn is a choice."
                            <span className="block mt-2 font-semibold text-right">
                              - Brian Herbert
                            </span>
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
            <div className="mt-16 mb-8 text-center">
              <div className="max-w-2xl p-6 mx-auto border rounded-lg bg-muted/30 border-muted-foreground/10">
                <p className="text-sm italic leading-relaxed text-muted-foreground">
                  <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/40 mr-2 mb-0.5"></span>
                  Salary ranges and demand levels reflect US market averages and may vary by region.
                </p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <div className="max-w-2xl mx-auto rounded-lg">
                <ReportIssue
                  title="Found an issue with the roadmap?"
                  type="page"
                  slug="roadmap"
                  variant="default"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-linear-to-b from-background via-muted/20 to-background">
        <div>
          <div>
            <Card className="border-0 shadow-2xl bg-primary/10 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <Sparkles className="w-12 h-12 mx-auto mb-6 text-amber-500" />

                <h2 className="mb-6 text-3xl font-bold text-primary md:text-4xl">
                  Ready to Begin Your DevOps Journey?
                </h2>

                <p className="max-w-2xl mx-auto mb-8 text-xl text-muted-foreground">
                  Join thousands of engineers who are learning DevOps with our interactive learning
                  resources and hands-on guides.
                </p>

                <div className="flex flex-wrap justify-center gap-4 mb-8">
                  <Button asChild size="lg">
                    <Link href="/guides">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Browse Learning Resources
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/posts">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Read Latest Articles
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/games">
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Practice with Quizzes
                    </Link>
                  </Button>
                </div>

                <Separator className="my-8" />

                <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span>Updated Weekly</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span>Community Driven</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-500" />
                    <span>Industry Recognized</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Skill Modal */}
      <SkillModal skill={selectedSkill} isOpen={isModalOpen} onClose={handleCloseModal} />
    </div>
  );
}
