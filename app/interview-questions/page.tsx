import { Metadata } from 'next';
import Link from 'next/link';
import {
  Briefcase,
  ArrowRight,
  Users,
  TrendingUp,
  Award,
  Brain,
  Eye,
  Target,
  Layers,
} from 'lucide-react';
import {
  interviewQuestions,
  getQuestionCountsByTier,
} from '@/content/interview-questions';
import { PageHero } from '@/components/page-hero';
import type { ExperienceTier } from '@/lib/interview-utils';

export const metadata: Metadata = {
  title: 'DevOps Interview Questions | The DevOps Daily',
  description:
    'In-depth DevOps interview questions with detailed answers, code examples, and explanations. Prepare for Kubernetes, Docker, Terraform, CI/CD, AWS, and more.',
  keywords: [
    'devops interview questions',
    'kubernetes interview',
    'docker interview',
    'terraform interview',
    'cicd interview',
    'aws interview',
  ],
  authors: [{ name: 'The DevOps Daily' }],
  creator: 'The DevOps Daily',
  publisher: 'The DevOps Daily',
  applicationName: 'The DevOps Daily',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: '/interview-questions',
  },
  openGraph: {
    title: 'DevOps Interview Questions - The DevOps Daily',
    description:
      'In-depth DevOps interview questions with detailed answers, code examples, and explanations. Prepare for your next interview.',
    type: 'website',
    url: '/interview-questions',
    siteName: 'The DevOps Daily',
    locale: 'en_US',
    images: [
      {
        url: '/images/interview-questions/interview-questions-og.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Interview Questions',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@TheDevOpsDaily',
    creator: '@TheDevOpsDaily',
    title: 'DevOps Interview Questions - The DevOps Daily',
    description:
      'In-depth DevOps interview questions with detailed answers, code examples, and explanations.',
    images: ['/images/interview-questions/interview-questions-og.png'],
  },
};

const tierConfig = {
  junior: {
    title: 'Junior',
    range: '0-2 years',
    description: 'Linux, Git, Docker basics, and CI/CD fundamentals.',
    icon: Users,
    dot: 'bg-emerald-500',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  mid: {
    title: 'Mid-Level',
    range: '2-5 years',
    description: 'Kubernetes, Terraform, monitoring, and architecture.',
    icon: TrendingUp,
    dot: 'bg-primary',
    iconColor: 'text-primary',
  },
  senior: {
    title: 'Senior',
    range: '5+ years',
    description: 'System design, incident response, and technical leadership.',
    icon: Award,
    dot: 'bg-violet-500',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
} as const;

const steps = [
  {
    icon: Brain,
    title: 'Think it through',
    description: 'Read the prompt and answer out loud, like a real interview.',
  },
  {
    icon: Eye,
    title: 'Reveal the answer',
    description: 'Compare against a model answer, code, and common mistakes.',
  },
  {
    icon: Target,
    title: 'Mark your confidence',
    description: 'Track what you know and loop back to the weak spots.',
  },
];

// Topics covered, derived from the question set so the list stays in sync with
// content. Sorted by how many questions touch each topic.
function getTopicCounts(): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const q of interviewQuestions) {
    counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export default function InterviewQuestionsPage() {
  const questionsByTier = getQuestionCountsByTier();
  const topics = getTopicCounts();
  const tiers = ['junior', 'mid', 'senior'] as ExperienceTier[];

  return (
    <div className="min-h-screen">
      <PageHero
        icon={Briefcase}
        title="DevOps Interview Questions"
        accentWord="Interview"
        description={`Practice ${interviewQuestions.length} real interview questions with hidden answers. Think through each one, then reveal the model answer to compare.`}
        breadcrumbs={[{ label: 'Interview Questions' }]}
        badge="Mock Interview Practice"
        stats={[
          { label: 'questions', value: interviewQuestions.length },
          { label: 'topics', value: topics.length },
          { label: 'levels', value: 3 },
        ]}
      />

      <div className="container mx-auto px-4 max-w-4xl py-10">
        {/* How it works */}
        <section className="mb-12">
          <p className="text-xs font-mono text-muted-foreground mb-3">// how it works</p>
          <div className="rounded-md border bg-card divide-y md:divide-y-0 md:divide-x divide-border grid grid-cols-1 md:grid-cols-3">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flex items-start gap-3 p-5">
                  <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary text-sm font-mono font-semibold">
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1 flex items-center gap-1.5">
                      <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Choose your level */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-mono text-muted-foreground">// choose your level</p>
          </div>
          <div className="grid gap-px grid-cols-1 sm:grid-cols-3 bg-border border rounded-md overflow-hidden">
            {tiers.map((tier) => {
              const config = tierConfig[tier];
              const Icon = config.icon;
              const count = questionsByTier[tier] || 0;
              return (
                <Link
                  key={tier}
                  href={`/interview-questions/${tier}`}
                  className="group bg-card p-5 flex flex-col transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between mb-4">
                    <Icon
                      className={`w-5 h-5 ${config.iconColor}`}
                      strokeWidth={1.5}
                    />
                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/80 uppercase tracking-wider">
                      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                      {config.range}
                    </span>
                  </div>
                  <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">
                    {config.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed flex-1">
                    {config.description}
                  </p>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
                    <span className="text-xs font-mono text-muted-foreground">
                      {count} questions
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground transition-all group-hover:text-primary group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Topics covered */}
        <section className="mb-12">
          <p className="text-xs font-mono text-muted-foreground mb-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>// topics covered</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => (
              <span
                key={topic.name}
                className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs"
              >
                <span className="text-foreground">{topic.name}</span>
                <span className="font-mono text-muted-foreground/70">{topic.count}</span>
              </span>
            ))}
          </div>
        </section>

        {/* Cross-links */}
        <section className="rounded-md border bg-muted/20 p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Prefer scored assessments? Try the{' '}
            <Link href="/quizzes" className="text-primary hover:underline font-medium">
              DevOps quizzes
            </Link>{' '}
            or drill concepts with{' '}
            <Link href="/flashcards" className="text-primary hover:underline font-medium">
              flashcards
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
