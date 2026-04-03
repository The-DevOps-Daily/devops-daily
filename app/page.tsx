import { CategoryGrid } from '@/components/category-grid';
import FeaturedPosts from '@/components/featured-posts';
import { Hero } from '@/components/hero';
import LatestPosts from '@/components/latest-posts';
import LatestGuides from '@/components/latest-guides';
import FeaturedExercises from '@/components/featured-exercises';
import { ArrowRight, Terminal, GitBranch, Container, Activity } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title:
    'DevOps Daily - Tutorials, Guides, Exercises & News for DevOps Engineers',
  description:
    'Learn DevOps with hands-on tutorials, comprehensive guides, interactive exercises, quizzes, and weekly news. Covering Docker, Kubernetes, Terraform, CI/CD, and more.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title:
      'DevOps Daily - Tutorials, Guides, Exercises & News for DevOps Engineers',
    description:
      'Learn DevOps with hands-on tutorials, comprehensive guides, interactive exercises, quizzes, and weekly news. Covering Docker, Kubernetes, Terraform, CI/CD, and more.',
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
      'DevOps Daily - Tutorials, Guides, Exercises & News for DevOps Engineers',
    description:
      'Learn DevOps with hands-on tutorials, comprehensive guides, interactive exercises, quizzes, and weekly news.',
    images: ['/og-image.png'],
  },
};

export default async function Home() {
  return (
    <div className="container px-4 py-8 mx-auto">
      <Hero />
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

      {/* Core DevOps Practices - clean cards, no decorative gradients */}
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

      {/* What is DevOps - simple, no decorative blurs */}
      <section className="my-20 rounded-lg border bg-card p-6 sm:p-10 max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight mb-4">What is DevOps?</h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            DevOps combines software development and IT operations to shorten the
            development lifecycle while delivering features, fixes, and updates reliably.
            It emphasizes collaboration, automation, continuous integration, continuous
            delivery, and infrastructure as code.
          </p>
          <p>
            At its core, DevOps bridges the gap between teams who write code and teams
            who deploy and maintain it. Rather than working in silos with handoffs,
            DevOps teams share responsibility for the entire software lifecycle.
          </p>
        </div>
        <Link
          href="/roadmap"
          className="inline-flex items-center gap-1.5 mt-6 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Explore the DevOps Roadmap
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  );
}
