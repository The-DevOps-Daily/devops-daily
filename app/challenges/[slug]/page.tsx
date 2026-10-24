import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShieldCheck, Swords } from 'lucide-react';
import { PageHero } from '@/components/page-hero';
import { BreadcrumbSchema, LearningResourceSchema } from '@/components/schema-markup';
import { RelatedContent } from '@/components/related-content';
import { PassedBy } from '@/components/challenges/passed-by';
import { StartChallenge } from '@/components/challenges/start-challenge';
import { getAllChallenges, getChallengeBySlug } from '@/lib/challenges';
import { getExerciseById } from '@/lib/exercises';
import { getGuideBySlug } from '@/lib/guides';
import { difficultyLabel, CHALLENGES_REPO_URL } from '@/lib/challenge-types';
import { detailPageMetadata } from '@/lib/metadata-utils';
import { truncateMetaDescription } from '@/lib/meta-description';
import { getSocialImagePath } from '@/lib/image-utils';

export const dynamicParams = false;

export async function generateStaticParams() {
  const challenges = await getAllChallenges();
  return challenges.map((challenge) => ({ slug: challenge.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallengeBySlug(slug);
  if (!challenge) return { title: 'Challenge Not Found' };

  return detailPageMetadata({
    path: `/challenges/${slug}`,
    title: `${challenge.title}: a ${challenge.topic} Challenge | DevOps Daily`,
    socialTitle: `${challenge.title}: a ${challenge.topic} Challenge`,
    description: truncateMetaDescription(challenge.description),
    image: getSocialImagePath(slug, 'challenges'),
    ogType: 'website',
    siteName: 'The DevOps Daily',
    locale: 'en_US',
    twitterHandle: '@TheDevOpsDaily',
  });
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-4 scroll-mt-24 text-2xl font-bold">
      {children}
    </h2>
  );
}

export default async function ChallengePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const challenge = await getChallengeBySlug(slug);
  if (!challenge) notFound();

  const [all, exercises, guides] = await Promise.all([
    getAllChallenges(),
    Promise.all((challenge.related?.exercises ?? []).map((id) => getExerciseById(id))),
    Promise.all((challenge.related?.guides ?? []).map((id) => getGuideBySlug(id))),
  ]);
  const others = all.filter((c) => c.id !== challenge.id);
  const relatedLinks = [
    ...exercises
      .filter((e) => e !== null)
      .map((e) => ({
        slug: `exercise-${e.id}`,
        title: e.title,
        description: e.description,
        href: `/exercises/${e.id}`,
        label: 'Exercise',
        meta: e.estimatedTime,
      })),
    ...guides
      .filter((g) => g !== null)
      .map((g) => ({
        slug: `guide-${g.slug}`,
        title: g.title,
        description: g.description,
        href: `/guides/${g.slug}`,
        label: 'Guide',
      })),
  ];

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Challenges', url: '/challenges' },
          { name: challenge.title, url: `/challenges/${challenge.slug}` },
        ]}
      />
      <LearningResourceSchema
        title={challenge.title}
        description={challenge.description}
        difficulty={challenge.difficulty}
        estimatedTime={`${challenge.minutes} minutes`}
        technologies={challenge.tags}
        url={`/challenges/${challenge.slug}`}
        learningResourceType="challenge"
      />
      <PageHero
        title={challenge.title}
        description={challenge.summary}
        icon={Swords}
        breadcrumbs={[{ label: 'Challenges', href: '/challenges' }, { label: challenge.title }]}
        badge={`${challenge.topic} challenge · ${difficultyLabel(challenge.difficulty)}`}
        stats={[
          { label: 'minutes', value: challenge.minutes },
          { label: 'graded checks', value: challenge.checks.length },
        ]}
      />

      <div className="container mx-auto max-w-4xl px-4 py-10">
        <div className="mb-10 flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <StartChallenge challengeId={challenge.id} />
          <PassedBy challengeId={challenge.id} className="text-sm text-muted-foreground" />
        </div>

        <section className="mb-10">
          <SectionHeading id="situation">The situation</SectionHeading>
          <div className="space-y-4 text-foreground/90">
            {challenge.situation.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <SectionHeading id="task">Your task</SectionHeading>
          <ul className="list-disc space-y-2 pl-6 text-foreground/90">
            {challenge.task.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <SectionHeading id="checks">What the grader checks</SectionHeading>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Check
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Passes when
                  </th>
                </tr>
              </thead>
              <tbody>
                {challenge.checks.map((check) => (
                  <tr key={check.id} className="border-t border-border align-top">
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{check.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{check.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            When a check fails, the grader&apos;s comment says what it saw, not how to fix it.
          </p>
        </section>

        <section className="mb-10">
          <SectionHeading id="files">Files you may change</SectionHeading>
          <ul className="space-y-1">
            {challenge.solutionFiles.map((file) => (
              <li key={file}>
                <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{file}</code>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            A pull request that changes any other file, including the tests or the workflows, is not
            graded.
          </p>
        </section>

        <section className="mb-10">
          <SectionHeading id="hints">Hints</SectionHeading>
          <div className="space-y-3">
            {challenge.hints.map((hint) => (
              <details
                key={hint.title}
                className="group rounded-lg border border-border bg-card px-4 py-3"
              >
                <summary className="cursor-pointer font-medium marker:text-muted-foreground">
                  {hint.title}
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{hint.body}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <SectionHeading id="local">Test it locally</SectionHeading>
          <p className="mb-3 text-foreground/90">{challenge.localTest.intro}</p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
            <code>{challenge.localTest.commands}</code>
          </pre>
        </section>

        <section className="mb-10">
          <SectionHeading id="submit">Submit</SectionHeading>
          <ol className="list-decimal space-y-2 pl-6 text-foreground/90">
            <li>
              Fork{' '}
              <a
                href={CHALLENGES_REPO_URL}
                className="text-primary underline-offset-4 hover:underline"
              >
                The-DevOps-Daily/challenges
              </a>{' '}
              and create a branch.
            </li>
            <li>Commit your changes to the files listed above, and nothing else.</li>
            <li>Open a pull request against main in The-DevOps-Daily/challenges.</li>
            <li>
              Read the grader&apos;s comment. If a check fails, push another commit to the same
              branch and it grades again.
            </li>
            <li>
              When every check passes, the PR gets the passed label and is closed. It is never
              merged, and your pass counts here within the hour.
            </li>
          </ol>
        </section>

        <section className="mb-10 rounded-lg border border-border bg-muted/30 p-5">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            How grading stays honest
          </div>
          <p className="text-sm text-muted-foreground">
            The workflow takes the tests and the grader from the repository&apos;s main branch and
            copies only the files above out of your PR. Your code runs in a container or a throwaway
            kind cluster, and some inputs are random at grading time. A second workflow checks the
            result against your PR&apos;s real commit before it comments.
          </p>
        </section>

        {relatedLinks.length > 0 && (
          <RelatedContent title="Learn the basics first" items={relatedLinks} className="mb-10" />
        )}
        {others.length > 0 && (
          <RelatedContent
            title="More challenges"
            items={others.map((c) => ({
              slug: c.slug,
              title: c.title,
              description: c.summary,
              href: `/challenges/${c.slug}`,
              label: `${c.topic} · ${difficultyLabel(c.difficulty)}`,
              meta: `About ${c.minutes} min`,
            }))}
          />
        )}
        <p className="mt-10 text-sm text-muted-foreground">
          <Link href="/challenges" className="text-primary underline-offset-4 hover:underline">
            All challenges
          </Link>
        </p>
      </div>
    </>
  );
}
