import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Briefcase } from 'lucide-react';
import {
  getAllTopics,
  getTopicBySlug,
  getQuestionsByTopicSlug,
} from '@/content/interview-questions';
import { QuestionBrowser } from '@/components/interview-questions/question-browser';
import { PageHero } from '@/components/page-hero';
import { BreadcrumbSchema } from '@/components/schema-markup';

interface PageProps {
  params: Promise<{ topic: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllTopics().map((t) => ({ topic: t.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { topic: topicSlug } = await params;
  const topic = getTopicBySlug(topicSlug);

  if (!topic) {
    return { title: 'Not Found' };
  }

  const title = `${topic.name} Interview Questions`;
  const description = `${topic.count} ${topic.name} DevOps interview questions with hidden answers, code examples, and explanations across junior, mid, and senior levels.`;

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
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.png'],
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
        description={`Practice ${topic.count} ${topic.name} interview questions across every experience level. Think through each one, then reveal the model answer.`}
        icon={Briefcase}
        breadcrumbs={[
          { label: 'Interview Questions', href: '/interview-questions' },
          { label: topic.name },
        ]}
        stats={[{ label: 'questions', value: topic.count }]}
      />

      <div className="container mx-auto px-4 max-w-4xl py-10">
        <QuestionBrowser questions={questions} lockedTopicSlug={topic.slug} />
      </div>
    </>
  );
}
