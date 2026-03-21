import { CategoryGrid } from '@/components/category-grid';
import FeaturedPosts from '@/components/featured-posts';
import { Hero } from '@/components/hero';
import LatestPosts from '@/components/latest-posts';
import LatestGuides from '@/components/latest-guides';
import FeaturedExercises from '@/components/featured-exercises';
import { GitBranch, Container, Server, Activity, Terminal, ArrowRight } from 'lucide-react';
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

      {/* What is DevOps — citable educational content */}
      <section className="my-20 relative overflow-hidden rounded-2xl border bg-card">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-blue-500/5" />
          <div className="absolute top-10 right-10 w-64 h-64 bg-primary/10 rounded-full filter blur-[100px]" />
          <div className="absolute bottom-10 left-10 w-48 h-48 bg-blue-500/10 rounded-full filter blur-[80px]" />
        </div>

        <div className="relative z-10 px-6 py-12 sm:px-12 sm:py-16 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Terminal className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary tracking-wide uppercase">
              Learn DevOps
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">What is DevOps?</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              DevOps is a set of practices that combines software development (Dev) and IT operations
              (Ops) to shorten the systems development lifecycle while delivering features, fixes,
              and updates frequently and reliably. It emphasizes collaboration, automation, continuous
              integration, continuous delivery, and infrastructure as code to enable teams to build,
              test, and release software faster with fewer errors.
            </p>
            <p>
              At its core, DevOps bridges the gap between development teams who write code and
              operations teams who deploy and maintain it. Rather than working in silos with
              handoffs, DevOps teams share responsibility for the entire software lifecycle — from
              writing code to monitoring it in production.
            </p>
          </div>
          <div className="mt-8">
            <Link
              href="/roadmap"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Explore the DevOps Roadmap
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Core DevOps Practices */}
      <section className="my-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Core DevOps Practices</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            The building blocks every DevOps engineer needs to master
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="group relative rounded-xl border bg-card p-6 transition-all hover:shadow-lg hover:border-primary/30">
            <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-emerald-500/10">
              <GitBranch className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Continuous Integration &amp; Delivery</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              CI/CD automates the process of integrating code changes, running tests, and deploying
              to production. Developers merge code frequently, automated pipelines validate every
              change, and releases happen reliably through tools like GitHub Actions, Jenkins, GitLab
              CI, and ArgoCD.
            </p>
            <Link
              href="/categories/ci-cd"
              className="mt-4 inline-flex items-center gap-1 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Explore CI/CD <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="group relative rounded-xl border bg-card p-6 transition-all hover:shadow-lg hover:border-primary/30">
            <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-purple-500/10">
              <Server className="w-6 h-6 text-purple-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Infrastructure as Code</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              IaC manages infrastructure through version-controlled configuration files instead of
              manual processes. Tools like Terraform, Ansible, and Pulumi allow teams to provision
              servers, networks, and cloud resources reproducibly — treating infrastructure with the
              same rigor as application code.
            </p>
            <Link
              href="/categories/terraform"
              className="mt-4 inline-flex items-center gap-1 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Explore IaC <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="group relative rounded-xl border bg-card p-6 transition-all hover:shadow-lg hover:border-primary/30">
            <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-500/10">
              <Container className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Containerization &amp; Orchestration</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Containers package applications with their dependencies for consistent deployment
              across environments. Docker is the standard container runtime, while Kubernetes
              orchestrates containers at scale — handling scheduling, scaling, networking, and
              self-healing across clusters of machines.
            </p>
            <Link
              href="/categories/docker"
              className="mt-4 inline-flex items-center gap-1 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Explore Containers <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="group relative rounded-xl border bg-card p-6 transition-all hover:shadow-lg hover:border-primary/30">
            <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-amber-500/10">
              <Activity className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Monitoring &amp; Observability</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Observability gives teams visibility into system behavior through metrics, logs, and
              traces. Tools like Prometheus, Grafana, the ELK Stack, and Datadog help detect issues
              before users are affected, understand root causes during incidents, and track system
              health over time.
            </p>
            <Link
              href="/categories/devops"
              className="mt-4 inline-flex items-center gap-1 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Explore Monitoring <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
