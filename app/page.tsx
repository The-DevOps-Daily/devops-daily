import { CategoryGrid } from '@/components/category-grid';
import FeaturedPosts from '@/components/featured-posts';
import { Hero } from '@/components/hero';
import LatestPosts from '@/components/latest-posts';
import LatestGuides from '@/components/latest-guides';
import FeaturedExercises from '@/components/featured-exercises';
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

      {/* Educational content for AI citability */}
      <section className="my-16 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold tracking-tight mb-6">What is DevOps?</h2>
        <div className="prose dark:prose-invert max-w-none">
          <p>
            DevOps is a set of practices that combines software development (Dev) and IT operations
            (Ops) to shorten the systems development lifecycle while delivering features, fixes, and
            updates frequently and reliably. It emphasizes collaboration, automation, continuous
            integration, continuous delivery, and infrastructure as code to enable teams to build,
            test, and release software faster with fewer errors.
          </p>
          <p>
            At its core, DevOps bridges the gap between development teams who write code and
            operations teams who deploy and maintain it. Rather than working in silos with handoffs,
            DevOps teams share responsibility for the entire software lifecycle — from writing code
            to monitoring it in production.
          </p>
        </div>
      </section>

      <section className="my-16 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold tracking-tight mb-6">Core DevOps Practices</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-2">Continuous Integration &amp; Delivery</h3>
            <p className="text-muted-foreground text-sm">
              CI/CD automates the process of integrating code changes, running tests, and deploying
              to production. Developers merge code frequently, automated pipelines validate every
              change, and releases happen reliably through tools like GitHub Actions, Jenkins, GitLab
              CI, and ArgoCD.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-2">Infrastructure as Code</h3>
            <p className="text-muted-foreground text-sm">
              IaC manages infrastructure through version-controlled configuration files instead of
              manual processes. Tools like Terraform, Ansible, and Pulumi allow teams to provision
              servers, networks, and cloud resources reproducibly — treating infrastructure with the
              same rigor as application code.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-2">Containerization &amp; Orchestration</h3>
            <p className="text-muted-foreground text-sm">
              Containers package applications with their dependencies for consistent deployment
              across environments. Docker is the standard container runtime, while Kubernetes
              orchestrates containers at scale — handling scheduling, scaling, networking, and
              self-healing across clusters of machines.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-2">Monitoring &amp; Observability</h3>
            <p className="text-muted-foreground text-sm">
              Observability gives teams visibility into system behavior through metrics, logs, and
              traces. Tools like Prometheus, Grafana, the ELK Stack, and Datadog help detect issues
              before users are affected, understand root causes during incidents, and track system
              health over time.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
