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
        url: `/images/checklists/${resolvedParams.slug}-og.svg`,
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
    images: [`/images/checklists/${resolvedParams.slug}-og.svg`],
   },
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
