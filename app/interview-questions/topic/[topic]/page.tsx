import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Briefcase, Play } from 'lucide-react';
import {
  getAllTopics,
  getTopicBySlug,
  getQuestionsByTopicSlug,
} from '@/content/interview-questions';
import { TopicQuestions } from '@/components/interview-questions/topic-questions';
import { PageHero } from '@/components/page-hero';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { CarbonAds } from '@/components/carbon-ads';
import { RelatedAcrossTypes } from '@/components/related-across-types';
import { getRelatedAcrossTypes } from '@/lib/related-cross-type';
import { truncateMetaDescription } from '@/lib/meta-description';
import {
  getInterviewTopicHref,
  getTierLabel,
  type ExperienceTier,
  type InterviewQuestion,
} from '@/lib/interview-utils';

interface PageProps {
  params: Promise<{ topic: string }>;
}

const TIERS: ExperienceTier[] = ['junior', 'mid', 'senior'];

const TIER_WORDS: Record<ExperienceTier, string> = {
  junior: 'junior',
  mid: 'mid-level',
  senior: 'senior',
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllTopics().map((t) => ({ topic: t.slug }));
}

function tiersOf(questions: InterviewQuestion[]): ExperienceTier[] {
  return TIERS.filter((tier) => questions.some((q) => q.tier === tier));
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'question' : 'questions'}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { topic: topicSlug } = await params;
  const topic = getTopicBySlug(topicSlug);

  if (!topic) {
    return { title: 'Not Found' };
  }

  const levels = joinWords(tiersOf(getQuestionsByTopicSlug(topic.slug)).map((t) => TIER_WORDS[t]));
  const title = `${topic.name} Interview Questions`;
  const description = truncateMetaDescription(
    `${topic.count} ${topic.name} interview ${topic.count === 1 ? 'question with a full answer' : 'questions with full answers'}, code examples, common mistakes and follow-ups for ${levels} DevOps roles.`
  );

  return {
    title: { absolute: `${title} | The DevOps Daily` },
    description,
    alternates: {
      canonical: `/interview-questions/topic/${topic.slug}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/interview-questions/topic/${topic.slug}`,
      images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.jpg'],
    },
  };
}

export default async function TopicPage({ params }: PageProps) {
  const { topic: topicSlug } = await params;
  const topic = getTopicBySlug(topicSlug);

  if (!topic) {
    notFound();
  }

  const questions = getQuestionsByTopicSlug(topic.slug);
  const tiers = tiersOf(questions);
  const otherTopics = getAllTopics().filter((t) => t.slug !== topic.slug);
  const tags = Array.from(new Set(questions.flatMap((q) => q.tags || [])));

  const crossTypeRelated = await getRelatedAcrossTypes({
    current: { type: 'interview-question', id: '', category: topic.name, tags },
    limit: 3,
    excludeTypes: ['interview-question'],
  });

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Interview Questions', url: '/interview-questions' },
          { name: topic.name, url: `/interview-questions/topic/${topic.slug}` },
        ]}
      />
      <PageHero
        title={`${topic.name} Interview Questions`}
        description={`${countLabel(topic.count)} for ${joinWords(tiers.map((t) => TIER_WORDS[t]))} ${topic.name} interviews, with model answers, code examples and common mistakes. Answer each one out loud first, then reveal the answer.`}
        icon={Briefcase}
        breadcrumbs={[
          { label: 'Interview Questions', href: '/interview-questions' },
          { label: topic.name },
        ]}
        stats={[
          { label: 'questions', value: topic.count },
          { label: tiers.length === 1 ? 'level' : 'levels', value: tiers.length },
        ]}
      />

      <div className="container mx-auto px-4 max-w-3xl py-10">
        <nav aria-label="Questions on this page" className="mb-8 rounded-md border bg-card p-5">
          <p className="text-xs font-mono text-muted-foreground mb-4">
            // {countLabel(questions.length)} on this page
          </p>
          <div className="space-y-4">
            {tiers.map((tier) => (
              <div key={tier}>
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80 mb-1.5">
                  {getTierLabel(tier)}
                </p>
                <ul className="space-y-1">
                  {questions
                    .filter((q) => q.tier === tier)
                    .map((q) => (
                      <li key={q.id}>
                        <a
                          href={`#${q.slug}`}
                          className="text-sm text-foreground hover:text-primary hover:underline"
                        >
                          {q.title}
                        </a>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t">
            <Link
              href={`/interview-questions/practice?topic=${topic.slug}`}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Play className="w-4 h-4" strokeWidth={2} />
              Practice in a session
            </Link>
          </div>
        </nav>

        <div className="mb-10">
          <CarbonAds />
        </div>

        <TopicQuestions questions={questions} />

        {otherTopics.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xl font-semibold mb-4">More interview topics</h2>
            <div className="flex flex-wrap gap-2">
              {otherTopics.map((t) => (
                <Link
                  key={t.slug}
                  href={getInterviewTopicHref(t.name)}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <span>{t.name}</span>
                  <span className="font-mono text-muted-foreground/70">{t.count}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {crossTypeRelated.length > 0 && (
        <section className="container mx-auto px-4 max-w-4xl pb-12">
          <RelatedAcrossTypes items={crossTypeRelated} />
        </section>
      )}
    </>
  );
}
