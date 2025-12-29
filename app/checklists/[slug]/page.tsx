import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { checklists, getChecklistBySlug } from '@/data/checklists';
import { ChecklistPageClient } from '@/components/checklists/checklist-page-client';

export function generateStaticParams() {
  return checklists.map((checklist) => ({
    slug: checklist.slug,
  }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const resolvedParams = await params;
  const checklist = getChecklistBySlug(resolvedParams.slug);

  if (!checklist) {
    return {
      title: 'Checklist Not Found',
    };
  }

  return {
    title: `${checklist.title} | The DevOps Daily`,
    description: checklist.description,
    keywords: checklist.tags,
  };
}

export default async function ChecklistPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const resolvedParams = await params;
  const checklist = getChecklistBySlug(resolvedParams.slug);

  if (!checklist) {
    notFound();
  }

  return <ChecklistPageClient checklist={checklist} />;
}
