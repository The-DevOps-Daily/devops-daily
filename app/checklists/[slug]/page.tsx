import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllChecklists, getChecklistBySlug } from '@/lib/checklists';
import { ChecklistPageClient } from '@/components/checklists/checklist-page-client';
import { PageHero } from '@/components/page-hero';
import { ListChecks } from 'lucide-react';

export async function generateStaticParams() {
  const checklists = await getAllChecklists();
  return checklists.map((checklist) => ({
    slug: checklist.slug,
  }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const resolvedParams = await params;
  const checklist = await getChecklistBySlug(resolvedParams.slug);

  if (!checklist) {
    return {
      title: 'Checklist Not Found',
    };
  }

  return {
   title: `${checklist.title} | The DevOps Daily`,
   description: checklist.description,
   alternates: {
     canonical: `/checklists/${resolvedParams.slug}`,
   },
   openGraph: {
     title: `${checklist.title} - The DevOps Daily`,
    description: checklist.description,
    type: 'website',
    url: `/checklists/${resolvedParams.slug}`,
    siteName: 'The DevOps Daily',
    locale: 'en_US',
    images: [
      {
        url: `/images/checklists/${resolvedParams.slug}-og.png`,
         width: 1200,
         height: 630,
         alt: checklist.title,
       },
     ],
   },
   twitter: {
    card: 'summary_large_image',
    site: '@TheDevOpsDaily',
    creator: '@TheDevOpsDaily',
    title: `${checklist.title} - The DevOps Daily`,
    description: checklist.description,
    images: [`/images/checklists/${resolvedParams.slug}-og.png`],
   },
  };
}

export default async function ChecklistPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const resolvedParams = await params;
  const checklist = await getChecklistBySlug(resolvedParams.slug);

  if (!checklist) {
    notFound();
  }

  return (
    <>
      <PageHero
        title={checklist.title}
        description={checklist.description}
        icon={ListChecks}
        breadcrumbs={[
          { label: 'Checklists', href: '/checklists' },
          { label: checklist.title },
        ]}
        stats={[
          { label: 'items', value: checklist.items.length },
          { label: checklist.difficulty, value: '' },
          { label: checklist.estimatedTime, value: '' },
        ].filter(s => s.value !== '')}
      />
      <ChecklistPageClient checklist={checklist} />
    </>
  );
}
