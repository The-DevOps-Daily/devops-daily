import { CategoryGrid } from '@/components/category-grid';
import FeaturedPosts from '@/components/featured-posts';
import { Hero } from '@/components/hero';
import LatestPosts from '@/components/latest-posts';
import LatestGuides from '@/components/latest-guides';
import FeaturedExercises from '@/components/featured-exercises';
import { ArrowRight, Terminal, GitBranch, Container, Activity, Gamepad2, Mail } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title:
    'DevOps Daily - Tutorials, Guides, Simulators & News for DevOps Engineers',
  description:
    'Learn DevOps with hands-on tutorials, interactive simulators, quizzes, exercises, and weekly news. Covering Docker, Kubernetes, Terraform, CI/CD, and more.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title:
      'DevOps Daily - Tutorials, Guides, Simulators & News for DevOps Engineers',
    description:
      'Learn DevOps with hands-on tutorials, interactive simulators, quizzes, exercises, and weekly news. Covering Docker, Kubernetes, Terraform, CI/CD, and more.',
    url: '/',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Daily',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title:
      'DevOps Daily - Tutorials, Guides, Simulators & News for DevOps Engineers',
    description:
      'Learn DevOps with hands-on tutorials, interactive simulators, quizzes, and weekly news. 250+ free resources.',
    images: ['/og-image.png'],
  },
};

const FEATURED_SIMULATORS = [
  {
    title: 'DNS Resolution Simulator',
    description: 'Walk through the full DNS resolution process step by step',
    href: '/games/dns-simulator',
    emoji: '🌐',
    color: 'bg-blue-500/10 text-blue-500',
  },
  {
    title: 'Kubernetes Scheduler',
    description: 'Place pods on nodes based on resource requests and constraints',
    href: '/games/k8s-scheduler',
    emoji: '⚓',
    color: 'bg-indigo-500/10 text-indigo-500',
  },
  {
    title: 'Load Balancer Simulator',
    description: 'Compare round-robin, least connections, and weighted algorithms',
    href: '/games/load-balancer-simulator',
    emoji: '⚖️',
    color: 'bg-emerald-500/10 text-emerald-500',
  },
  {
    title: 'CI/CD Pipeline Builder',
    description: 'Design a deployment pipeline with stages, gates, and rollbacks',
    href: '/games/cicd-stack-generator',
    emoji: '🔄',
    color: 'bg-amber-500/10 text-amber-500',
  },
  {
    title: 'Caching Simulator',
    description: 'See how cache hit rates change with different strategies',
    href: '/games/caching-simulator',
    emoji: '💾',
    color: 'bg-purple-500/10 text-purple-500',
  },
  {
    title: 'DDoS Defense',
    description: 'Protect your infrastructure from simulated attack patterns',
    href: '/games/ddos-simulator',
    emoji: '🛡️',
    color: 'bg-red-500/10 text-red-500',
  },
];

export default async function Home() {
  return (
    <div>
      {/* Full-width hero background */}
      <div className="relative overflow-x-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-muted/40 via-muted/15 to-transparent" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent" />
        <div className="container px-4 pt-8 mx-auto">
          <Hero />
        </div>
      </div>

      <div className="container px-4 mx-auto">

      {/* Featured Simulators */}
      <section className="my-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Gamepad2 className="w-7 h-7 text-primary" />
              Interactive Simulators
            </h2>
            <p className="mt-2 text-muted-foreground">
              Learn by building, breaking, and debugging - not by reading docs
            </p>
          </div>
          <Link
            href="/games"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED_SIMULATORS.map((sim) => (
            <Link
              key={sim.href}
              href={sim.href}
              className="group rounded-lg border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${sim.color} flex items-center justify-center text-lg`}>
                  {sim.emoji}
                </div>
                <div>
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{sim.title}</h3>
                  <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{sim.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <Link
          href="/games"
          className="sm:hidden inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors mt-4"
        >
          View all simulators
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Why DevOps Daily */}
      <section className="my-20">
        <div className="text-center mb-12">
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-2">Why DevOps Daily</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Learn DevOps the way it actually sticks</h2>
        </div>

        <div className="space-y-12 max-w-3xl mx-auto">
          {/* Feature 1 */}
          <div className="flex gap-5">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mt-0.5">
              <Gamepad2 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Interactive, not passive</h3>
              <p className="text-muted-foreground leading-relaxed">
                30+ simulators let you build load balancers, schedule Kubernetes pods, resolve DNS queries, and defend against DDoS attacks. You learn by doing, not by scrolling through walls of text.
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="flex gap-5">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mt-0.5">
              <Terminal className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Built for engineers, not students</h3>
              <p className="text-muted-foreground leading-relaxed">
                Real terminal output, production-realistic configs, and actual error messages. Every exercise and guide starts with a problem you have faced in production, not a textbook definition.
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="flex gap-5">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mt-0.5">
              <Activity className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Multiple ways to learn the same topic</h3>
              <p className="text-muted-foreground leading-relaxed">
                Every topic comes with a blog post for context, a quiz to test your knowledge, flashcards for quick review, and a checklist for implementation. Pick the format that works for how you learn.
              </p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="flex gap-5">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mt-0.5">
              <Mail className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Fresh content every week</h3>
              <p className="text-muted-foreground leading-relaxed">
                New posts, quizzes, and simulators published weekly. A curated newsletter with the latest DevOps news lands in your inbox every Monday. All free, no paywall.
              </p>
            </div>
          </div>
        </div>
      </section>

      <CategoryGrid
        className="my-16"
        limit={8}
        showHeader
        showViewAll
        gridClassName="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      />
      <FeaturedPosts className="my-16" />
      <FeaturedExercises className="my-16" />
      <LatestPosts className="my-16" />
      <LatestGuides className="my-16" />

      {/* Core DevOps Practices */}
      <section className="my-20">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Core DevOps Practices</h2>
          <p className="mt-2 text-muted-foreground">
            The building blocks every DevOps engineer should know
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/categories/ci-cd" className="group rounded-lg border bg-card p-5 transition-colors hover:border-foreground/20">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex-shrink-0 w-10 h-10 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">CI/CD</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Automate builds, tests, and deployments. GitHub Actions, Jenkins, GitLab CI, ArgoCD.
                </p>
              </div>
            </div>
          </Link>

          <Link href="/categories/terraform" className="group rounded-lg border bg-card p-5 transition-colors hover:border-foreground/20">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex-shrink-0 w-10 h-10 rounded-md bg-purple-500/10 flex items-center justify-center">
                <Terminal className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">Infrastructure as Code</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Manage infrastructure through code. Terraform, Ansible, Pulumi, CloudFormation.
                </p>
              </div>
            </div>
          </Link>

          <Link href="/categories/docker" className="group rounded-lg border bg-card p-5 transition-colors hover:border-foreground/20">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex-shrink-0 w-10 h-10 rounded-md bg-blue-500/10 flex items-center justify-center">
                <Container className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">Containers</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Package and orchestrate applications. Docker, Kubernetes, Podman, Helm.
                </p>
              </div>
            </div>
          </Link>

          <Link href="/categories/devops" className="group rounded-lg border bg-card p-5 transition-colors hover:border-foreground/20">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex-shrink-0 w-10 h-10 rounded-md bg-amber-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">Monitoring</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Observe and debug production systems. Prometheus, Grafana, ELK, Datadog.
                </p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="my-20 rounded-xl border bg-gradient-to-br from-primary/5 via-card to-card p-8 sm:p-12 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Mail className="w-6 h-6 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Stay sharp, ship faster</h2>
        <p className="text-muted-foreground max-w-lg mx-auto mb-6">
          Get a weekly roundup of new tutorials, simulators, and DevOps news. No spam, unsubscribe anytime.
        </p>
        <a
          href="https://devops-daily.us2.list-manage.com/subscribe?u=d1128776b290ad8d08c02094f&id=fd76a4e93f"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors shadow-md shadow-primary/10"
        >
          <Mail className="w-4 h-4" />
          Subscribe to the newsletter
        </a>
        <p className="text-xs text-muted-foreground mt-3">
          Join 5,000+ DevOps engineers
        </p>
      </section>

      </div>
    </div>
  );
}
