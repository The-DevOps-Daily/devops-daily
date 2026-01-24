import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

// Valid roadmap slugs that should redirect to existing pages
const validRoadmaps = ['junior', 'devsecops'] as const;
type RoadmapSlug = (typeof validRoadmaps)[number];

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return validRoadmaps.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!validRoadmaps.includes(slug as RoadmapSlug)) {
    return {};
  }

  // Return empty metadata since we redirect anyway
  return {};
}

export default async function RoadmapPage({ params }: PageProps) {
  const { slug } = await params;

  if (!validRoadmaps.includes(slug as RoadmapSlug)) {
    notFound();
  }

  // Redirect to the existing roadmap pages
  redirect(`/roadmap/${slug}`);
}
