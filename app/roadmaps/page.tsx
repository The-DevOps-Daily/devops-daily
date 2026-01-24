'use client';

import Link from 'next/link';
import { Map, ArrowRight, Clock, Target, Users, Sparkles, GraduationCap, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Roadmap {
  slug: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  estimatedTime: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  topics: string[];
  featured?: boolean;
}

const roadmaps: Roadmap[] = [
  {
    slug: 'junior',
    title: 'Junior DevOps Roadmap',
    description:
      'A beginner-friendly roadmap specifically designed for aspiring DevOps engineers. Clear, focused learning path without the overwhelm.',
    icon: GraduationCap,
    color: 'green',
    estimatedTime: '3-6 months',
    difficulty: 'Beginner',
    topics: ['Linux Basics', 'Git', 'Docker', 'CI/CD', 'Cloud Fundamentals'],
    featured: true,
  },
  {
    slug: 'devsecops',
    title: 'DevSecOps Roadmap',
    description:
      'Master the integration of security practices into the DevOps pipeline. Learn to build secure, compliant, and resilient systems.',
    icon: Shield,
    color: 'purple',
    estimatedTime: '4-8 months',
    difficulty: 'Intermediate',
    topics: ['Security Fundamentals', 'SAST/DAST', 'Container Security', 'Compliance', 'Threat Modeling'],
  },
];

const colorClasses = {
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-600 dark:text-green-400',
    gradient: 'from-green-500 to-emerald-600',
    badge: 'bg-green-500/20 text-green-700 dark:text-green-300',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-600 dark:text-purple-400',
    gradient: 'from-purple-500 to-violet-600',
    badge: 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600 dark:text-blue-400',
    gradient: 'from-blue-500 to-blue-600',
    badge: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  },
  orange: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-600 dark:text-orange-400',
    gradient: 'from-orange-500 to-amber-600',
    badge: 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
  },
} as const;

function getDifficultyColor(difficulty: string) {
  switch (difficulty) {
    case 'Beginner':
      return 'bg-green-500/20 text-green-700 dark:text-green-300';
    case 'Intermediate':
      return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300';
    case 'Advanced':
      return 'bg-red-500/20 text-red-700 dark:text-red-300';
    default:
      return 'bg-gray-500/20 text-gray-700 dark:text-gray-300';
  }
}

export default function RoadmapsPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-linear-to-bl from-primary/10 to-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-linear-to-tr from-blue-500/10 to-primary/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Map className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Learning Paths</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="bg-linear-to-r from-primary via-purple-500 to-blue-500 bg-clip-text text-transparent">
                DevOps Roadmaps
              </span>
            </h1>

            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Structured learning paths to guide your DevOps journey. From beginner fundamentals to
              advanced security practices, find the roadmap that fits your goals.
            </p>

            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span>Community Driven</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span>Goal Oriented</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Regularly Updated</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Roadmaps Grid */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {roadmaps.map((roadmap) => {
              const colors = colorClasses[roadmap.color as keyof typeof colorClasses] || colorClasses.blue;
              const Icon = roadmap.icon;

              return (
                <Link key={roadmap.slug} href={`/roadmaps/${roadmap.slug}`}>
                  <Card
                    className={cn(
                      'group h-full transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer',
                      'border-2 hover:border-primary/30',
                      roadmap.featured && 'ring-2 ring-primary/20'
                    )}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className={cn(
                            'p-3 rounded-xl border',
                            colors.bg,
                            colors.border
                          )}
                        >
                          <Icon className={cn('w-6 h-6', colors.text)} />
                        </div>
                        <div className="flex gap-2">
                          {roadmap.featured && (
                            <Badge className="bg-primary/20 text-primary border-primary/30">
                              Featured
                            </Badge>
                          )}
                          <Badge className={getDifficultyColor(roadmap.difficulty)}>
                            {roadmap.difficulty}
                          </Badge>
                        </div>
                      </div>

                      <CardTitle className="text-xl group-hover:text-primary transition-colors">
                        {roadmap.title}
                      </CardTitle>
                      <CardDescription className="text-base leading-relaxed">
                        {roadmap.description}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          <span>{roadmap.estimatedTime}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {roadmap.topics.slice(0, 4).map((topic) => (
                          <Badge key={topic} variant="secondary" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                        {roadmap.topics.length > 4 && (
                          <Badge variant="secondary" className="text-xs">
                            +{roadmap.topics.length - 4} more
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center text-primary font-medium group-hover:gap-3 gap-2 transition-all">
                        <span>Start Learning</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Main Roadmap CTA */}
          <div className="max-w-3xl mx-auto mt-12 text-center">
            <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
              <CardContent className="py-8">
                <Map className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Complete DevOps Roadmap</h3>
                <p className="text-muted-foreground mb-6">
                  Looking for the comprehensive DevOps roadmap covering all topics from beginner to
                  expert? Check out our main roadmap.
                </p>
                <Button asChild>
                  <Link href="/roadmap">
                    View Full Roadmap
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
