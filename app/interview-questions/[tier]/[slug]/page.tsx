import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Briefcase } from 'lucide-react';
import { interviewQuestions, getQuestionBySlug } from '@/content/interview-questions';
import { InterviewQuestionPage } from '@/components/interview-questions/interview-question-page';
import { PageHero } from '@/components/page-hero';
import { getSocialImagePath } from '@/lib/image-utils';
import { truncateMetaDescription } from '@/lib/meta-description';
import type { ExperienceTier } from '@/lib/interview-utils';

const validTiers: ExperienceTier[] = ['junior', 'mid', 'senior'];

interface PageProps {
  params: Promise<{ tier: string; slug: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return interviewQuestions.map((question) => ({
    tier: question.tier,
    slug: question.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tier, slug } = await params;
  
  if (!validTiers.includes(tier as ExperienceTier)) {
    return { title: 'Not Found' };
  }

  const question = getQuestionBySlug(slug);
  
  if (!question || question.tier !== tier) {
    return { title: 'Not Found' };
  }

  const socialImage = getSocialImagePath(slug, 'interview-questions');
  // Some questions are long enough that the auto-built description blows
  // past 160 chars; trim at sentence boundary so Google does not truncate.
  const description = truncateMetaDescription(
    `${question.question} - ${question.category} interview question for ${tier} DevOps engineers`,
  );
  
  return {
    title: { absolute: `${question.title} - Interview Question` },
    description,
    alternates: {
      canonical: `/interview-questions/${tier}/${slug}`,
    },
    openGraph: {
      type: 'article',
      title: question.title,
      description,
      url: `/interview-questions/${tier}/${slug}`,
      images: [
        {
          url: socialImage || '/og-image.png',
          width: 1200,
          height: 630,
          alt: question.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: question.title,
      description,
      images: [socialImage || '/og-image.png'],
    },
  };
}

export default async function QuestionPage({ params }: PageProps) {
  const { tier, slug } = await params;
  
  if (!validTiers.includes(tier as ExperienceTier)) {
    notFound();
  }

  const question = getQuestionBySlug(slug);
  
  if (!question || question.tier !== tier) {
    notFound();
  }

  const capitalizedTier = tier.charAt(0).toUpperCase() + tier.slice(1);

  // Related questions - same category, any tier (not just this one), excluding
  // the current question. Sorted: same-tier first, then other tiers. Capped
  // to 5 so the section stays readable but still gives crawlers and readers
  // a meaningful set of next-step links.
  const related = interviewQuestions
    .filter(
      (q) => q.category === question.category && q.slug !== question.slug,
    )
    .sort((a, b) => {
      if (a.tier === tier && b.tier !== tier) return -1;
      if (a.tier !== tier && b.tier === tier) return 1;
      return a.title.localeCompare(b.title);
    })
    .slice(0, 5);

  return (
    <>
      <PageHero
        title={question.title}
        description={question.question}
        icon={Briefcase}
        breadcrumbs={[
          { label: 'Interview Questions', href: '/interview-questions' },
          { label: capitalizedTier },
          { label: question.title },
        ]}
      />
      <InterviewQuestionPage question={question} tier={tier as ExperienceTier} />

      {related.length > 0 && (
        <section className="container mx-auto px-4 max-w-4xl pb-12">
          <h2 className="text-xl font-semibold mb-4">
            More {question.category} interview questions
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {related.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/interview-questions/${q.tier}/${q.slug}`}
                  className="text-sm text-foreground hover:text-primary hover:underline"
                >
                  {q.title}
                </Link>
                {q.tier !== tier && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {q.tier}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
