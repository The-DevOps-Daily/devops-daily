import { CategoryGrid } from '@/components/category-grid';
import { Hero } from '@/components/hero';
import LatestPosts from '@/components/latest-posts';
import LatestGuides from '@/components/latest-guides';
import FeaturedExercises from '@/components/featured-exercises';
import FeaturedQuizzes from '@/components/featured-quizzes';
import { SectionHeader } from '@/components/section-header';
import { SectionSeparator } from '@/components/section-separator';
import { ArrowRight, Globe, Anchor, Scale, GitBranch, Database, Shield } from 'lucide-react';
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
    icon: Globe,
  },
  {
    title: 'Kubernetes Scheduler',
    description: 'Place pods on nodes based on resource requests and constraints',
    href: '/games/k8s-scheduler',
    icon: Anchor,
  },
  {
    title: 'Load Balancer Simulator',
    description: 'Compare round-robin, least connections, and weighted algorithms',
    href: '/games/load-balancer-simulator',
    icon: Scale,
  },
  {
    title: 'CI/CD Pipeline Builder',
    description: 'Design a deployment pipeline with stages, gates, and rollbacks',
    href: '/games/cicd-stack-generator',
    icon: GitBranch,
  },
  {
    title: 'Caching Simulator',
    description: 'See how cache hit rates change with different strategies',
    href: '/games/caching-simulator',
    icon: Database,
  },
  {
    title: 'DDoS Defense',
    description: 'Protect your infrastructure from simulated attack patterns',
    href: '/games/ddos-simulator',
    icon: Shield,
  },
];

export default async function Home() {
  return (
    <div>
      {/* Full-width hero with dot-grid background */}
      <div className="relative overflow-x-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-[0.07] dark:opacity-[0.09]"
          style={{
            backgroundImage:
              'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage:
              'linear-gradient(to bottom, black 60%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 60%, transparent 100%)',
          }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent" />
        <div className="container px-4 pt-8 mx-auto">
          <Hero />
        </div>
      </div>

      <div className="container px-4 mx-auto">

      <SectionSeparator command="ls /simulators" />

      {/* Featured Simulators */}
      <section className="my-16">
        <SectionHeader
          label="featured"
          title="Interactive Simulators"
          viewAllHref="/games"
        />
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3 bg-border border rounded-md overflow-hidden">
          {FEATURED_SIMULATORS.map((sim) => {
            const Icon = sim.icon;
            return (
              <Link
                key={sim.href}
                href={sim.href}
                className="group bg-card p-5 transition-colors hover:bg-muted/40"
              >
                <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors mb-3" strokeWidth={1.5} />
                <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                  {sim.title}
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{sim.description}</p>
              </Link>
            );
          })}
        </div>
        <Link
          href="/games"
          className="sm:hidden inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors mt-4"
        >
          Browse all simulators
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      <SectionSeparator command="cd /categories" />

      <CategoryGrid
        className="my-16"
        limit={8}
        showHeader
        showViewAll
        gridClassName="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      />

      <SectionSeparator command="ls /exercises --recent" />

      <FeaturedExercises className="my-16" />

      <SectionSeparator command="ls /quizzes --latest" />

      <FeaturedQuizzes className="my-16" />

      <SectionSeparator command="ls /posts --latest" />

      <LatestPosts className="my-16" />

      <SectionSeparator command="ls /guides --latest" />

      <LatestGuides className="my-16" />

      {/* About - terminal block, citable for AI search — placed near newsletter as identity moment */}
      <section className="my-16 max-w-3xl mx-auto" aria-label="About DevOps Daily">
        <div className="rounded-md border bg-card overflow-hidden font-mono text-sm">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
              <div className="w-3 h-3 rounded-full bg-green-400/70" />
            </div>
            <span className="text-xs text-muted-foreground ml-2">devops-daily --about</span>
          </div>
          <div className="p-6 space-y-3">
            <div>
              <span className="text-green-500">$</span>{' '}
              <span className="text-muted-foreground">cat about.md</span>
            </div>
            <p className="pl-4 text-foreground leading-relaxed">
              DevOps Daily is a free educational platform covering Kubernetes, Docker, Terraform,
              CI/CD, cloud platforms, observability, and security through hands-on tutorials,
              30+ interactive simulators, quizzes, and a weekly newsletter read by 5,000+ engineers.
            </p>
            <div className="text-xs text-muted-foreground/60 pl-4 pt-1">
              <span className="text-green-500/70">$</span>{' '}
              <span className="inline-block w-[0.6em] h-[1em] align-middle bg-foreground/60 animate-cursor-blink" />
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter CTA - terminal style */}
      <section className="my-20 max-w-3xl mx-auto">
        <div className="rounded-md border bg-card overflow-hidden font-mono text-sm">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
              <div className="w-3 h-3 rounded-full bg-green-400/70" />
            </div>
            <span className="text-xs text-muted-foreground ml-2">devops-daily --subscribe</span>
          </div>
          <div className="p-6 space-y-3">
            <div>
              <span className="text-green-500">$</span>{' '}
              <span className="text-muted-foreground">echo &quot;Weekly DevOps digest. No spam. Unsubscribe anytime.&quot;</span>
            </div>
            <div className="pl-4 text-foreground">
              Weekly DevOps digest. No spam. Unsubscribe anytime.
            </div>
            <div>
              <span className="text-green-500">$</span>{' '}
              <span className="text-muted-foreground">subscribe --email</span>
            </div>
            <form
              action="https://devops-daily.us2.list-manage.com/subscribe/post?u=d1128776b290ad8d08c02094f&amp;id=fd76a4e93f&amp;f_id=0022c6e1f0"
              method="post"
              target="_blank"
              noValidate
              className="flex flex-col sm:flex-row gap-2 pl-4"
            >
              <input
                type="email"
                name="EMAIL"
                required
                placeholder="you@example.com"
                className="flex-1 bg-background border border-input px-3 py-2 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              {/* Honeypot */}
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
                className="px-4 py-2 bg-foreground text-background rounded text-sm font-semibold font-mono hover:bg-foreground/90 transition-colors whitespace-nowrap"
              >
                Subscribe
              </button>
            </form>
            <div className="text-xs text-muted-foreground pl-4 pt-1">
              <span className="text-green-500/70">$</span>{' '}
              <span className="inline-block w-[0.6em] h-[1em] align-middle bg-foreground/60 animate-cursor-blink" />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4 font-mono tabular-nums">
          5,000+ engineers subscribed
        </p>
      </section>

      </div>
    </div>
  );
}
