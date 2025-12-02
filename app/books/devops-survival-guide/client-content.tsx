'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  BookOpen,
  Rocket,
  Users,
  CheckCircle,
  Sparkles,
  Mail,
  Heart,
  Shield,
  Code2,
  Server,
  GitBranch,
  Clock,
  TrendingUp,
  Zap,
  Target,
  Flame,
  AlertTriangle,
  Lock,
  FileText,
  BarChart,
  Lightbulb,
  Gift,
  Coffee,
  Award,
  Star,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

const chapters = [
  {
    number: '00',
    slug: 'intro',
    title: 'Introduction',
    description: 'Your roadmap to DevOps excellence without the burnout',
    icon: BookOpen,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    number: '01',
    slug: 'you-just-got-here',
    title: 'You Just Got Here',
    description: 'First steps in your DevOps journey',
    icon: Rocket,
    color: 'from-purple-500 to-pink-500',
  },
  {
    number: '02',
    slug: 'devops-is-not-a-job-title',
    title: 'DevOps Is Not a Job Title',
    description: 'Understanding what DevOps really means',
    icon: Users,
    color: 'from-green-500 to-emerald-500',
  },
  {
    number: '03',
    slug: 'the-deployment-mess',
    title: 'The Deployment Mess',
    description: 'Taming chaos in your deployment pipeline',
    icon: AlertTriangle,
    color: 'from-orange-500 to-red-500',
  },
  {
    number: '04',
    slug: 'infrastructure-that-doesnt-hate-you',
    title: "Infrastructure That Doesn't Hate You",
    description: 'Building reliable, maintainable infrastructure',
    icon: Server,
    color: 'from-indigo-500 to-blue-500',
  },
  {
    number: '05',
    slug: 'monitoring-vs-guessing',
    title: 'Monitoring vs Guessing',
    description: 'Data-driven decisions over gut feelings',
    icon: BarChart,
    color: 'from-teal-500 to-cyan-500',
  },
  {
    number: '06',
    slug: 'oncall-without-trauma',
    title: 'On-Call Without Trauma',
    description: 'Sustainable incident response practices',
    icon: Shield,
    color: 'from-red-500 to-pink-500',
  },
  {
    number: '07',
    slug: 'security-is-your-job-too',
    title: "Security Is Your Job Too",
    description: 'Integrating security into everything you do',
    icon: Lock,
    color: 'from-yellow-500 to-orange-500',
  },
  {
    number: '08',
    slug: 'no-one-reads-your-docs',
    title: 'No One Reads Your Docs',
    description: 'Making documentation actually useful',
    icon: FileText,
    color: 'from-purple-500 to-violet-500',
  },
  {
    number: '09',
    slug: 'platform-thinking',
    title: 'Platform Thinking',
    description: 'Building products, not just infrastructure',
    icon: Code2,
    color: 'from-blue-500 to-indigo-500',
  },
  {
    number: '10',
    slug: 'tech-debt-but-make-it-boring',
    title: 'Tech Debt (But Make It Boring)',
    description: 'Managing technical debt systematically',
    icon: GitBranch,
    color: 'from-gray-500 to-slate-600',
  },
  {
    number: '11',
    slug: 'measuring-what-actually-matters',
    title: 'Measuring What Actually Matters',
    description: 'Metrics that drive real improvement',
    icon: Target,
    color: 'from-green-500 to-teal-500',
  },
  {
    number: '12',
    slug: 'driving-change-without-a-fancy-title',
    title: 'Driving Change Without a Fancy Title',
    description: 'Leading from wherever you are',
    icon: TrendingUp,
    color: 'from-orange-500 to-amber-500',
  },
  {
    number: '13',
    slug: 'devops-that-doesnt-burn-you-out',
    title: "DevOps That Doesn't Burn You Out",
    description: 'Sustainable practices for the long haul',
    icon: Flame,
    color: 'from-red-500 to-orange-500',
  },
];

export function ClientContent() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section with Parallax & Animated Background */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-linear-to-br from-blue-500/30 to-purple-500/30 rounded-full blur-3xl animate-pulse"
            style={{
              transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)`,
              transition: 'transform 0.3s ease-out',
            }}
          />
          <div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-linear-to-br from-cyan-500/30 to-pink-500/30 rounded-full blur-3xl animate-pulse animation-delay-1000"
            style={{
              transform: `translate(${-mousePosition.x * 0.02}px, ${-mousePosition.y * 0.02}px)`,
              transition: 'transform 0.3s ease-out',
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05),transparent_50%)]" />
        </div>

        {/* Floating tech icons */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          {[Server, Code2, GitBranch, Shield, Zap, Target].map((Icon, idx) => (
            <Icon
              key={idx}
              className={`absolute w-12 h-12 text-primary/10 animate-float`}
              style={{
                top: `${20 + idx * 15}%`,
                left: `${10 + idx * 15}%`,
                animationDelay: `${idx * 0.5}s`,
                animationDuration: `${3 + idx * 0.5}s`,
              }}
            />
          ))}
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge with shimmer effect */}
            <Badge
              variant="outline"
              className="mb-6 px-6 py-2 text-base font-medium border-primary/50 bg-primary/5 backdrop-blur-sm relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <Clock className="inline-block w-4 h-4 mr-2 animate-pulse" />
              Currently Writing
              <Sparkles className="inline-block w-4 h-4 ml-2" />
            </Badge>

            {/* Main heading with gradient */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient bg-size-[200%_auto] leading-tight">
              DevOps Survival Guide
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
              Real-world DevOps practices{' '}
              <span className="text-foreground font-semibold">without the BS</span>. An in-depth
              ebook for engineers looking to master DevOps{' '}
              <span className="text-foreground font-semibold">without burning out</span>.
            </p>

           {/* Stats with counter effect */}
           <div className="flex flex-wrap justify-center gap-8 mb-12">
             {[
               { icon: BookOpen, label: '14 Chapters', count: '14' },
               { icon: Coffee, label: 'Practical Examples', count: '50+' },
               { icon: Users, label: 'Subscribers', count: '1K+' },
               { icon: Award, label: 'Launch Pricing', count: 'Soon' },
             ].map((stat, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 group cursor-default"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <stat.icon className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <div className="text-2xl font-bold">{stat.count}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA with glow effect */}
            <div className="relative inline-block">
              <div className="absolute -inset-1 bg-linear-to-r from-blue-600 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 animate-pulse" />
              <Button
                asChild
              size="lg"
              className="relative text-lg px-10 py-7 shadow-2xl bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all hover:scale-105"
              asChild
            >
              <Link href="#subscribe">
                <Mail className="mr-2 h-5 w-5" />
                Get Early Access
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              <Star className="inline w-4 h-4 text-yellow-500 fill-yellow-500 mr-1" />
              Join 1,000+ engineers getting early access
            </p>
          </div>
        </div>
      </section>

      {/* Chapter Cards with Stagger Animation */}
      <section className="py-20 bg-muted/30 relative">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">What You'll Learn</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                14 detailed chapters covering everything from your first day to driving
                organizational change
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {chapters.map((chapter, idx) => (
                <Card
                  key={chapter.slug}
                  className="group relative overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-500 hover:shadow-2xl hover:scale-105"
                  style={{
                    animationDelay: `${idx * 50}ms`,
                  }}
                >
                  {/* Gradient overlay on hover */}
                  <div
                    className={`absolute inset-0 bg-linear-to-br ${chapter.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}
                  />

                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                  <CardHeader className="relative">
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-3 rounded-xl bg-linear-to-br ${chapter.color} group-hover:scale-110 transition-transform duration-300`}
                      >
                        <chapter.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <Badge variant="outline" className="mb-2 font-mono text-xs">
                          {chapter.number}
                        </Badge>
                        <CardTitle className="text-lg mb-2 group-hover:text-primary transition-colors">
                          {chapter.title}
                        </CardTitle>
                        <CardDescription className="text-sm">{chapter.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What's Inside with Icon Grid */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/5 to-transparent" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4 px-4 py-2">
                <Sparkles className="inline-block w-4 h-4 mr-2" />
                What's Inside
              </Badge>
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Everything You Need to Thrive</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Practical guidance that actually works in the real world
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: Zap,
                  title: 'Practical Examples',
                  description: 'Real-world scenarios from actual production environments',
                  color: 'from-yellow-500 to-orange-500',
                },
                {
                  icon: Shield,
                  title: 'Battle-Tested Patterns',
                  description: 'Proven solutions that have survived production incidents',
                  color: 'from-blue-500 to-cyan-500',
                },
                {
                  icon: Heart,
                  title: 'Burnout Prevention',
                  description: 'Sustainable practices that keep you sane and productive',
                  color: 'from-pink-500 to-red-500',
                },
                {
                  icon: Lightbulb,
                  title: 'Career Growth',
                  description: 'Insights to advance your DevOps career at any level',
                  color: 'from-purple-500 to-pink-500',
                },
                {
                  icon: Users,
                  title: 'Team Dynamics',
                  description: 'How to work effectively across teams and departments',
                  color: 'from-green-500 to-teal-500',
                },
                {
                  icon: Target,
                  title: 'Measurable Impact',
                  description: 'Metrics and KPIs that demonstrate real business value',
                  color: 'from-indigo-500 to-purple-500',
                },
              ].map((benefit, idx) => (
                <Card
                  key={idx}
                  className="group relative overflow-hidden border-border/50 hover:border-primary/50 transition-all hover:shadow-xl hover:-translate-y-2"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div
                    className={`absolute top-0 right-0 w-32 h-32 bg-linear-to-br ${benefit.color} opacity-0 group-hover:opacity-10 rounded-full blur-2xl transition-opacity duration-500 -translate-y-8 translate-x-8`}
                  />

                  <CardHeader>
                    <div
                      className={`w-12 h-12 rounded-lg bg-linear-to-br ${benefit.color} p-2.5 mb-4 group-hover:scale-110 transition-transform`}
                    >
                      <benefit.icon className="w-full h-full text-white" />
                    </div>
                    <CardTitle className="text-xl mb-2">{benefit.title}</CardTitle>
                    <CardDescription className="text-sm">{benefit.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Author Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="outline" className="mb-4 px-4 py-2">
              <Users className="inline-block w-4 h-4 mr-2" />
              About The Authors
            </Badge>

            <h2 className="text-3xl md:text-4xl font-bold mb-6">Written by Engineers, for Engineers</h2>

            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
              This book is crafted by the team at DevOps Daily, experienced DevOps practitioners who've
              learned these lessons the hard way so you don't have to.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
              {[
                { label: 'Production Incidents', value: '1000+' },
                { label: 'Deployments Managed', value: '10K+' },
                { label: 'Engineers Mentored', value: '500+' },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="group"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="text-4xl font-bold mb-2 bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent group-hover:scale-110 transition-transform inline-block">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: 'When will the book be released?',
                  a: "We're currently writing and expect to release chapters progressively throughout 2025. Subscribe to get notified as soon as each chapter drops!",
                },
                {
                  q: 'How much will it cost?',
                  a: "We're committed to keeping DevOps knowledge accessible with affordable pricing. Subscribers will get special early bird pricing when we launch!",
                },
                {
                  q: 'Is this for beginners or experienced engineers?',
                  a: 'Both! Early chapters help newcomers get started right, while later chapters tackle advanced topics that will benefit DevOps professionals at any level.',
                },
                {
                  q: 'Can I contribute or provide feedback?',
                  a: 'Absolutely! We welcome feedback from the community. Subscribers will get early access and opportunities to shape the content.',
                },
              ].map((faq, idx) => (
                <Card
                  key={idx}
                  className="border-border/50 hover:border-primary/50 transition-all group"
                >
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <span className="text-sm font-bold text-primary">{idx + 1}</span>
                      </div>
                      {faq.q}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground pl-10">{faq.a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA - Simplified */}
      <section id="subscribe" className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-linear-to-t from-blue-500/10 to-transparent" />
        </div>

        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <div className="mb-6 relative inline-block">
              <div className="absolute inset-0 animate-ping bg-blue-500/20 rounded-full" />
              <Rocket className="h-16 w-16 mx-auto text-primary relative" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Get Early Access & Level Up Your DevOps Game
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Be the first to read new chapters as they're published. Join 1,000+ engineers for exclusive updates, bonus content, and behind-the-scenes insights.
            </p>

            {/* Newsletter Signup Form */}
            <div className="max-w-md mx-auto">
              <div className="p-8 bg-linear-to-br from-primary/5 to-purple-500/5 border-2 border-primary/20 rounded-2xl shadow-2xl backdrop-blur-sm">
                <form
                  action="https://devops-daily.us2.list-manage.com/subscribe/post?u=d1128776b290ad8d08c02094f&amp;id=fd76a4e93f&amp;f_id=0022c6e1f0"
                  method="post"
                  target="_blank"
                  noValidate
                  className="space-y-4"
                >
                  <input
                    type="email"
                    name="EMAIL"
                    id="mce-EMAIL-final"
                    required
                    placeholder="your@email.com"
                    className="w-full px-5 py-4 border-2 border-border/50 bg-background/50 backdrop-blur-sm rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300"
                  />

                  {/* Honeypot bot field */}
                  <div style={{ position: 'absolute', left: '-5000px' }} aria-hidden="true">
                    <input
                      type="text"
                      name="b_d1128776b290ad8d08c02094f_fd76a4e93f"
                      tabIndex={-1}
                      defaultValue=""
                    />
                  </div>

                  <button
                    type="submit"
                    name="subscribe"
                    className="group inline-flex items-center justify-center w-full px-6 py-4 bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-xl text-lg font-bold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-2xl hover:shadow-blue-500/50 hover:scale-105"
                  >
                    <Mail className="mr-2 h-5 w-5" />
                    Subscribe for Early Access
                    <Sparkles className="ml-2 h-5 w-5" />
                  </button>
                </form>

                <p className="text-center text-sm text-muted-foreground mt-4 flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4" />
                  No spam, ever. Unsubscribe anytime.
                </p>
              </div>

              <div className="mt-6 text-center">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Browse free resources instead</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
