import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import GenericQuiz from '@/components/games/generic-quiz';
import { getQuizById, getAllQuizzes, getRelatedQuizzes } from '@/lib/quiz-loader';
import { ReportIssue } from '@/components/report-issue';
import { ArrowLeft, Twitter, Facebook, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RelatedPosts } from '@/components/related-posts';

export const dynamicParams = false;

export async function generateStaticParams() {
  try {
    const quizzes = await getAllQuizzes();
    return quizzes.map((quiz) => ({
      slug: quiz.id,
    }));
  } catch (error) {
    console.warn('Error generating static params for quizzes:', error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const quizConfig = await getQuizById(slug);

  if (!quizConfig) {
    return {};
  }

  return {
    title: `${quizConfig.title} - Learn ${quizConfig.category}`,
    description: quizConfig.description,
    alternates: {
      canonical: `/quizzes/${slug}`,
    },
    openGraph: {
      title: `${quizConfig.title} - DevOps Daily`,
      description: quizConfig.description,
      type: 'website',
      images: [
        {
          url: `/images/games/${slug}-og.png`,
          width: 1200,
          height: 630,
          alt: quizConfig.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${quizConfig.title} - DevOps Daily`,
      description: quizConfig.description,
      images: [`/images/games/${slug}-og.png`],
    },
  };
}

export default async function QuizPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const quizConfig = await getQuizById(slug);

  if (!quizConfig) {
    notFound();
  }

  const relatedQuizzes = await getRelatedQuizzes(slug, quizConfig.category, 3);

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Quizzes', href: '/quizzes' },
    { label: quizConfig.title, href: `/quizzes/${slug}`, isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Quizzes', url: '/quizzes' },
    { name: quizConfig.title, url: `/quizzes/${slug}` },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <div className="container px-4 py-8 mx-auto">
        <Breadcrumb items={breadcrumbItems} />

        <div className="max-w-6xl mx-auto">
          <GenericQuiz quizConfig={quizConfig} />

          {/* Quiz Description Section */}
          <div className="max-w-4xl mx-auto mt-12">
            <div className="prose dark:prose-invert max-w-none">
              <h1 className="mb-4 text-3xl font-bold">{quizConfig.title} - Quiz Overview</h1>
              <p className="mb-6 text-lg leading-relaxed">{quizConfig.description}</p>

              {/* Quiz Stats */}
              <div className="grid grid-cols-1 gap-4 mb-8 md:grid-cols-3 not-prose">
                <div className="p-4 border rounded-lg bg-card">
                  <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">
                    Estimated Time
                  </h3>
                  <p className="text-xl font-bold">{quizConfig.metadata.estimatedTime}</p>
                </div>
                <div className="p-4 border rounded-lg bg-card">
                  <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">
                    Total Points
                  </h3>
                  <p className="text-xl font-bold">{quizConfig.totalPoints}</p>
                </div>
                <div className="p-4 border rounded-lg bg-card">
                  <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">
                    Questions
                  </h3>
                  <p className="text-xl font-bold">{quizConfig.questions.length}</p>
                </div>
              </div>

              {/* Difficulty Breakdown */}
              {quizConfig.metadata.difficultyLevels && (
                <div className="p-6 mb-8 border rounded-lg bg-muted/30">
                  <h2 className="mb-4 text-xl font-semibold">Difficulty Breakdown</h2>
                  <div className="flex flex-wrap gap-4">
                    {quizConfig.metadata.difficultyLevels.beginner > 0 && (
                      <span className="px-3 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-full dark:bg-green-900/30 dark:text-green-300">
                        {quizConfig.metadata.difficultyLevels.beginner} Beginner
                      </span>
                    )}
                    {quizConfig.metadata.difficultyLevels.intermediate > 0 && (
                      <span className="px-3 py-1 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-full dark:bg-yellow-900/30 dark:text-yellow-300">
                        {quizConfig.metadata.difficultyLevels.intermediate} Intermediate
                      </span>
                    )}
                    {quizConfig.metadata.difficultyLevels.advanced > 0 && (
                      <span className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded-full dark:bg-red-900/30 dark:text-red-300">
                        {quizConfig.metadata.difficultyLevels.advanced} Advanced
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Category-specific tips based on quiz configuration */}
              {quizConfig.category && (
                <div
                  className={`p-4 mt-6 border rounded-lg bg-${quizConfig.theme?.primaryColor || 'indigo'}-50 dark:bg-${quizConfig.theme?.primaryColor || 'indigo'}-950/20 border-${quizConfig.theme?.primaryColor || 'indigo'}-500/20`}
                >
                  <h2 className="mb-2 text-xl font-semibold">💡 {quizConfig.category} Tip</h2>
                  <p className="text-sm">{getQuizTip(quizConfig.category)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Report Issue Component */}
          <div className="max-w-4xl mx-auto mt-8">
            <ReportIssue title={quizConfig.title} type="quiz" slug={slug} variant="compact" />
          </div>

          {/* Back to quizzes button */}
          <div className="max-w-4xl mx-auto mt-8">
            <Button asChild variant="outline">
              <Link href="/quizzes">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Quizzes
              </Link>
            </Button>
          </div>

          {/* Related Quizzes */}
          {relatedQuizzes.length > 0 && (
            <div className="max-w-4xl mx-auto mt-12">
              <RelatedPosts
                posts={relatedQuizzes.map((q) => ({
                  title: q.title,
                  slug: q.id,
                  date: q.metadata.createdDate || '',
                  readingTime: q.metadata.estimatedTime,
                  category: { name: q.category, slug: q.category.toLowerCase().replace(/\\s+/g, '-') },
                }))}
                title="Related Quizzes"
                linkPrefix="/quizzes"
                className=""
              />
            </div>
          )}

          {/* Social Share Section */}
          <div className="max-w-4xl mx-auto mt-8">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div>
                <h2 className="font-semibold">Share This Quiz</h2>
                <p className="text-sm text-muted-foreground">
                  Challenge your colleagues and friends!
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(
                      `https://devops-daily.com/quizzes/${slug}`
                    )}&text=${encodeURIComponent(
                      `I just took the ${quizConfig.title} quiz on DevOps Daily! Test your ${quizConfig.category} knowledge:`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Twitter className="w-4 h-4" />
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                      `https://devops-daily.com/quizzes/${slug}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Facebook className="w-4 h-4" />
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                      `https://devops-daily.com/quizzes/${slug}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Helper function to provide category-specific tips
function getQuizTip(category: string): string {
  const tips: Record<string, string> = {
    Kubernetes:
      'Kubernetes can seem complex, but every concept builds on the previous one. Start with understanding pods (the atomic unit), then services (networking), deployments (scaling), and gradually work your way up to advanced topics. The key is understanding the "why" behind each design decision - Kubernetes was built to solve real problems at scale.',
    Docker:
      'Docker is all about understanding layers and optimization. Every command in your Dockerfile creates a new layer, so order matters for caching. Start with the least frequently changing files first (like package.json), then add your code. Always think about the final image size and security - smaller and more secure is better.',
    Terraform:
      'Infrastructure as Code is about thinking declaratively. Instead of "how do I create this?", think "what should the end state look like?". Terraform will figure out the steps. Always plan before apply, use modules for reusability, and remember that state is everything - protect it!',
    Git: 'Git is fundamentally about understanding the commit graph and how references move. Learn branching strategies, learn to rewrite history safely (when appropriate), and remember that Git is a tool for collaboration - clear commit messages and logical commits help your teammates understand your changes.',
    default:
      'Practice makes perfect! Take your time to understand each question and read the explanations carefully. Real-world scenarios often require combining multiple concepts, so think about how these tools work together in production environments.',
  };

  return tips[category] || tips.default;
}
