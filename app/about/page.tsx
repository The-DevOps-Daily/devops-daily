import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BookOpen,
  Code2,
  Gamepad2,
  GraduationCap,
  Heart,
  Mail,
  Map,
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

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background py-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-linear-to-br from-blue-600/10 via-background to-background" />
          <div className="absolute top-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-20 left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              About{' '}
              <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-500 to-purple-600">
                DevOps Daily
              </span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              A community-driven education platform helping engineers learn DevOps practices through
              practical tutorials, hands-on exercises, and real-world guides.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">413+</div>
              <div className="text-muted-foreground">Articles Published</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">28+</div>
              <div className="text-muted-foreground">In-Depth Guides</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">15+</div>
              <div className="text-muted-foreground">Interactive Labs</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">13</div>
              <div className="text-muted-foreground">Topic Categories</div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Our Mission</h2>
            <p className="text-xl text-center text-muted-foreground mb-12">
              Making DevOps knowledge accessible, practical, and free for everyone
            </p>

            <div className="prose dark:prose-invert max-w-3xl mx-auto">
              <p>
                DevOps Daily was created with a simple belief: every engineer deserves access to
                high-quality, practical DevOps education. Too many resources are either too
                theoretical, too superficial, or locked behind paywalls. We set out to change that.
              </p>
              <p>
                We cover the tools and practices that DevOps engineers use every day — from Docker
                and Kubernetes to Terraform, CI/CD pipelines, cloud infrastructure, and site
                reliability engineering. Every tutorial is written to be hands-on, every guide is
                built to take you from beginner to confident practitioner.
              </p>
              <p>
                Beyond articles and guides, we build interactive learning experiences: hands-on labs
                where you practice real scenarios, quizzes to test your knowledge, and simulators
                that let you experiment without the risk of breaking production.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What We Offer Section */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">What We Offer</h2>
            <p className="text-xl text-center text-muted-foreground mb-12">
              Multiple formats to match how you learn best
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="group hover:shadow-lg transition-all duration-300 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                      <BookOpen className="h-6 w-6" />
                    </div>
                    <CardTitle>Tutorials & Articles</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Over 413 articles covering Docker, Kubernetes, Terraform, Git, Linux, Bash, AWS,
                    Python, Cloud, FinOps, CI/CD, and more. Each article is written with practical
                    examples and real-world context.
                  </p>
                </CardContent>
              </Card>

              <Card className="group hover:shadow-lg transition-all duration-300 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
                      <Map className="h-6 w-6" />
                    </div>
                    <CardTitle>Comprehensive Guides</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    28+ multi-chapter guides that take you from fundamentals to advanced topics.
                    Structured learning paths with progress tracking, covering everything from
                    Introduction to Docker to Supply Chain Security.
                  </p>
                </CardContent>
              </Card>

              <Card className="group hover:shadow-lg transition-all duration-300 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10 text-green-600">
                      <Code2 className="h-6 w-6" />
                    </div>
                    <CardTitle>Hands-On Labs & Exercises</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    15+ interactive exercises where you practice real-world scenarios — from Git
                    workflows to Redis caching strategies to Linux performance troubleshooting. Learn
                    by doing, not just reading.
                  </p>
                </CardContent>
              </Card>

              <Card className="group hover:shadow-lg transition-all duration-300 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600">
                      <Gamepad2 className="h-6 w-6" />
                    </div>
                    <CardTitle>Games & Quizzes</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    30+ interactive simulators and 26+ quizzes that make learning DevOps concepts
                    engaging. Test your knowledge, challenge yourself, and solidify your
                    understanding through play.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">What We Value</h2>
            <p className="text-xl text-center text-muted-foreground mb-12">
              The principles behind everything we publish
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="group hover:shadow-lg transition-all duration-300 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-lg">Practical Over Theoretical</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    Every piece of content includes real commands, real configurations, and real
                    scenarios. We write for engineers who need to get things done, not pass an exam.
                  </p>
                </CardContent>
              </Card>

              <Card className="group hover:shadow-lg transition-all duration-300 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10 text-green-600">
                      <Shield className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-lg">Accuracy & Honesty</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    We verify our technical content against official documentation and test our code
                    examples. When we recommend a tool, we explain the trade-offs, not just the
                    highlights.
                  </p>
                </CardContent>
              </Card>

              <Card className="group hover:shadow-lg transition-all duration-300 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
                      <Users className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-lg">Community First</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    DevOps Daily is open source and free to access. We believe in sharing knowledge
                    openly and building a community where engineers help each other grow.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Topics We Cover */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Topics We Cover</h2>
            <p className="text-xl text-center text-muted-foreground mb-12">
              Comprehensive coverage across the DevOps ecosystem
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'Docker', count: '87 articles' },
                { name: 'Terraform', count: '83 articles' },
                { name: 'Git', count: '60 articles' },
                { name: 'Kubernetes', count: '51 articles' },
                { name: 'Linux', count: '46 articles' },
                { name: 'Bash', count: '32 articles' },
                { name: 'Networking', count: '25 articles' },
                { name: 'AWS', count: '20+ articles' },
                { name: 'Python', count: '15+ articles' },
                { name: 'CI/CD', count: '15+ articles' },
                { name: 'Cloud', count: '10+ articles' },
                { name: 'FinOps', count: '10+ articles' },
              ].map((topic) => (
                <div
                  key={topic.name}
                  className="text-center p-4 rounded-lg border border-border/50 bg-background hover:border-primary/50 transition-colors"
                >
                  <div className="font-semibold">{topic.name}</div>
                  <div className="text-sm text-muted-foreground">{topic.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Open Source & Contact */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-linear-to-br from-blue-600/5 via-background to-background" />
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="p-2 rounded-lg bg-pink-500/10 text-pink-600 inline-block mb-6">
              <Heart className="h-6 w-6" />
            </div>

            <h2 className="text-3xl md:text-4xl font-bold mb-6">Open Source & Community Driven</h2>
            <p className="text-xl text-muted-foreground mb-8">
              DevOps Daily is open source. All our content, code, and learning tools are available on
              GitHub. Contributions, feedback, and suggestions are always welcome.
            </p>

            <div className="flex gap-4 justify-center flex-wrap mb-8">
              <a
                href="https://github.com/The-DevOps-Daily"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-blue-500/20"
              >
                View on GitHub
              </a>
              <a
                href="mailto:info@devops-daily.com"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border font-medium hover:bg-muted transition-colors"
              >
                <Mail className="h-4 w-4" />
                info@devops-daily.com
              </a>
            </div>

            <p className="text-sm text-muted-foreground">
              Follow us on{' '}
              <a
                href="https://x.com/thedevopsdaily"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                X (Twitter)
              </a>
              ,{' '}
              <a
                href="https://www.linkedin.com/company/thedevopsdaily"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                LinkedIn
              </a>
              , and{' '}
              <a
                href="https://www.instagram.com/thedailydevops"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>{' '}
              for the latest updates.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
