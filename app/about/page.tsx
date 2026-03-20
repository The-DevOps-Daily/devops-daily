import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { AboutHero } from '@/components/about/about-hero';
import {
  ArrowRight,
  BookOpen,
  Code2,
  Gamepad2,
  Github,
  GraduationCap,
  Heart,
  Linkedin,
  Mail,
  Map,
  Rss,
  Shield,
  Users,
} from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About DevOps Daily',
  description:
    'DevOps Daily is a community-driven education platform providing tutorials, guides, exercises, and news for DevOps engineers and cloud practitioners.',
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: 'About DevOps Daily',
    description:
      'DevOps Daily is a community-driven education platform providing tutorials, guides, exercises, and news for DevOps engineers and cloud practitioners.',
    type: 'website',
    url: '/about',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'About DevOps Daily',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About DevOps Daily',
    description:
      'DevOps Daily is a community-driven education platform providing tutorials, guides, exercises, and news for DevOps engineers and cloud practitioners.',
    images: ['/og-image.png'],
  },
};

const offerings = [
  {
    icon: BookOpen,
    title: 'Tutorials & Articles',
    description:
      'Over 413 articles covering Docker, Kubernetes, Terraform, Git, Linux, Bash, AWS, Python, Cloud, FinOps, CI/CD, and more. Each written with practical examples and real-world context.',
    color: 'blue',
    href: '/posts',
    cta: 'Browse Articles',
  },
  {
    icon: Map,
    title: 'Comprehensive Guides',
    description:
      '28+ multi-chapter guides that take you from fundamentals to advanced topics. Structured learning paths with progress tracking, from Introduction to Docker to Supply Chain Security.',
    color: 'purple',
    href: '/guides',
    cta: 'Explore Guides',
  },
  {
    icon: Code2,
    title: 'Hands-On Labs',
    description:
      '15+ interactive exercises where you practice real-world scenarios — from Git workflows to Redis caching strategies to Linux performance troubleshooting. Learn by doing.',
    color: 'green',
    href: '/exercises',
    cta: 'Start a Lab',
  },
  {
    icon: Gamepad2,
    title: 'Games & Quizzes',
    description:
      '30+ interactive simulators and 26+ quizzes that make learning DevOps concepts engaging. Test your knowledge and solidify your understanding through play.',
    color: 'orange',
    href: '/games',
    cta: 'Play & Learn',
  },
] as const;

const colorMap = {
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'hover:border-blue-500/50',
  },
  purple: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'hover:border-purple-500/50',
  },
  green: {
    bg: 'bg-green-500/10',
    text: 'text-green-600 dark:text-green-400',
    border: 'hover:border-green-500/50',
  },
  orange: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'hover:border-orange-500/50',
  },
} as const;

const topics = [
  { name: 'Docker', count: 87, href: '/categories/docker' },
  { name: 'Terraform', count: 83, href: '/categories/terraform' },
  { name: 'Git', count: 60, href: '/categories/git' },
  { name: 'Kubernetes', count: 51, href: '/categories/kubernetes' },
  { name: 'Linux', count: 46, href: '/categories/linux' },
  { name: 'Bash', count: 32, href: '/categories/bash' },
  { name: 'Networking', count: 25, href: '/categories/networking' },
  { name: 'DevOps', count: 20, href: '/categories/devops' },
  { name: 'AWS', count: 15, href: '/categories/aws' },
  { name: 'Python', count: 15, href: '/categories/python' },
  { name: 'CI/CD', count: 12, href: '/categories/ci-cd' },
  { name: 'Cloud', count: 10, href: '/categories/cloud' },
];

const values = [
  {
    icon: GraduationCap,
    title: 'Practical Over Theoretical',
    description:
      'Every piece of content includes real commands, real configurations, and real scenarios. We write for engineers who need to get things done.',
    color: 'blue',
  },
  {
    icon: Shield,
    title: 'Accuracy & Honesty',
    description:
      'We verify our technical content against official documentation and test our code examples. When we recommend a tool, we explain the trade-offs.',
    color: 'green',
  },
  {
    icon: Users,
    title: 'Community First',
    description:
      'DevOps Daily is open source and free to access. We believe in sharing knowledge openly and building a community where engineers help each other grow.',
    color: 'purple',
  },
] as const;

export default function AboutPage() {
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'About', url: '/about' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
        {/* Hero */}
        <AboutHero />

        {/* Mission Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <Badge
                  variant="outline"
                  className="mb-4 px-4 py-1.5 border-blue-500/50 bg-blue-500/5"
                >
                  <Heart className="w-3.5 h-3.5 mr-2" />
                  Our Mission
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Making DevOps Knowledge{' '}
                  <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-500 to-purple-600">
                    Accessible
                  </span>
                </h2>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Practical, free, and built for engineers at every level
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p>
                    DevOps Daily was created with a simple belief: every engineer deserves access to
                    high-quality, practical DevOps education. Too many resources are either too
                    theoretical, too superficial, or locked behind paywalls.
                  </p>
                  <p>
                    We cover the tools and practices that DevOps engineers use every day — from
                    Docker and Kubernetes to Terraform, CI/CD pipelines, cloud infrastructure, and
                    site reliability engineering. Every tutorial is hands-on, every guide takes you
                    from beginner to confident practitioner.
                  </p>
                  <p>
                    Beyond articles and guides, we build interactive learning experiences: hands-on
                    labs where you practice real scenarios, quizzes to test your knowledge, and
                    simulators that let you experiment without breaking production.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 rounded-xl border border-border/50 bg-card text-center hover:border-blue-500/50 transition-colors">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                      413+
                    </div>
                    <div className="text-sm text-muted-foreground">Articles</div>
                  </div>
                  <div className="p-6 rounded-xl border border-border/50 bg-card text-center hover:border-purple-500/50 transition-colors">
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                      28+
                    </div>
                    <div className="text-sm text-muted-foreground">Guides</div>
                  </div>
                  <div className="p-6 rounded-xl border border-border/50 bg-card text-center hover:border-green-500/50 transition-colors">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                      15+
                    </div>
                    <div className="text-sm text-muted-foreground">Labs</div>
                  </div>
                  <div className="p-6 rounded-xl border border-border/50 bg-card text-center hover:border-orange-500/50 transition-colors">
                    <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                      56+
                    </div>
                    <div className="text-sm text-muted-foreground">Games & Quizzes</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What We Offer */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <Badge
                  variant="outline"
                  className="mb-4 px-4 py-1.5 border-purple-500/50 bg-purple-500/5"
                >
                  <BookOpen className="w-3.5 h-3.5 mr-2" />
                  What We Offer
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Multiple Formats,{' '}
                  <span className="text-transparent bg-clip-text bg-linear-to-r from-purple-500 to-cyan-500">
                    One Goal
                  </span>
                </h2>
                <p className="text-xl text-muted-foreground">
                  Learn the way that works best for you
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {offerings.map((item) => {
                  const colors = colorMap[item.color];
                  return (
                    <Card
                      key={item.title}
                      className={`group hover:shadow-lg transition-all duration-300 border-border/50 ${colors.border}`}
                    >
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>
                            <item.icon className="h-6 w-6" />
                          </div>
                          <CardTitle>{item.title}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">{item.description}</p>
                        <Link
                          href={item.href}
                          className={`inline-flex items-center text-sm font-medium ${colors.text} group-hover:underline`}
                        >
                          {item.cta}
                          <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Topics We Cover */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <Badge
                  variant="outline"
                  className="mb-4 px-4 py-1.5 border-cyan-500/50 bg-cyan-500/5"
                >
                  <Code2 className="w-3.5 h-3.5 mr-2" />
                  Topics
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Comprehensive{' '}
                  <span className="text-transparent bg-clip-text bg-linear-to-r from-cyan-500 to-blue-600">
                    Coverage
                  </span>
                </h2>
                <p className="text-xl text-muted-foreground">
                  Across the entire DevOps ecosystem
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {topics.map((topic) => (
                  <Link
                    key={topic.name}
                    href={topic.href}
                    className="group flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card hover:border-primary/50 hover:shadow-md transition-all"
                  >
                    <span className="font-medium group-hover:text-primary transition-colors">
                      {topic.name}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {topic.count}+
                    </Badge>
                  </Link>
                ))}
              </div>

              <div className="text-center mt-8">
                <Button asChild variant="outline" size="lg">
                  <Link href="/categories">
                    View All Categories
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <Badge
                  variant="outline"
                  className="mb-4 px-4 py-1.5 border-green-500/50 bg-green-500/5"
                >
                  <Shield className="w-3.5 h-3.5 mr-2" />
                  Our Values
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  What We{' '}
                  <span className="text-transparent bg-clip-text bg-linear-to-r from-green-500 to-emerald-600">
                    Stand For
                  </span>
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {values.map((value) => {
                  const colors = colorMap[value.color];
                  return (
                    <Card
                      key={value.title}
                      className={`group hover:shadow-lg transition-all duration-300 border-border/50 ${colors.border}`}
                    >
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>
                            <value.icon className="h-6 w-6" />
                          </div>
                          <CardTitle className="text-lg">{value.title}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground text-sm">{value.description}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Open Source & Contact CTA */}
        <section className="py-20 relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-linear-to-br from-blue-600/5 via-background to-purple-600/5" />
            <div className="absolute top-20 right-20 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-20 left-20 w-72 h-72 bg-purple-500/5 rounded-full blur-[100px]" />
          </div>

          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-linear-to-br from-blue-500 via-purple-600 to-cyan-600 mb-6 shadow-lg">
                <Github className="h-8 w-8 text-white" />
              </div>

              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Open Source &{' '}
                <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-500 to-purple-600">
                  Community Driven
                </span>
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                All our content, code, and learning tools are available on GitHub. Contributions,
                feedback, and suggestions are always welcome.
              </p>

              <div className="flex gap-4 justify-center flex-wrap mb-10">
                <Button asChild size="lg" className="shadow-lg shadow-blue-500/20">
                  <a
                    href="https://github.com/The-DevOps-Daily"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="mr-2 h-4 w-4" />
                    View on GitHub
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="mailto:info@devops-daily.com">
                    <Mail className="mr-2 h-4 w-4" />
                    Get in Touch
                  </a>
                </Button>
              </div>

              {/* Social Links */}
              <div className="flex justify-center gap-6 text-muted-foreground">
                <a
                  href="/feed.xml"
                  className="hover:text-orange-500 transition-colors"
                  aria-label="RSS Feed"
                >
                  <Rss className="h-5 w-5" />
                </a>
                <a
                  href="https://x.com/thedevopsdaily"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                  aria-label="X (Twitter)"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://www.linkedin.com/company/thedevopsdaily"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-500 transition-colors"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
                <a
                  href="https://github.com/The-DevOps-Daily"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                  aria-label="GitHub"
                >
                  <Github className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
