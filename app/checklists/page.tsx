import { Metadata } from 'next';
import { checklists } from '@/data/checklists';
import { ChecklistCard } from '@/components/checklists/checklist-card';
import { ChecklistsHero } from '@/components/checklists/checklists-hero';

export const metadata: Metadata = {
 title: 'DevOps & Security Checklists | The DevOps Daily',
 description: 'Interactive checklists for DevOps, security, and cloud best practices. Track your progress and ensure nothing is missed.',
 keywords: ['devops checklists', 'security checklists', 'kubernetes checklist', 'aws security', 'ci/cd pipeline'],
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
   canonical: '/checklists',
 },
 openGraph: {
   title: 'DevOps & Security Checklists - The DevOps Daily',
  description: 'Interactive checklists for DevOps, security, and cloud best practices. Track your progress, ensure nothing is missed, and export to markdown.',
  type: 'website',
  url: '/checklists',
  siteName: 'The DevOps Daily',
  locale: 'en_US',
  images: [
    {
      url: '/images/checklists/checklists-og.svg',
       width: 1200,
       height: 630,
       alt: 'DevOps & Security Checklists',
     },
   ],
 },
 twitter: {
  card: 'summary_large_image',
  site: '@TheDevOpsDaily',
  creator: '@TheDevOpsDaily',
  title: 'DevOps & Security Checklists - The DevOps Daily',
  description: 'Interactive checklists for DevOps, security, and cloud best practices. Track your progress and ensure nothing is missed.',
  images: ['/images/checklists/checklists-og.svg'],
 },
};

export default function ChecklistsPage() {
  const categories = Array.from(new Set(checklists.map(c => c.category)));

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      {/* Hero Section */}
      <ChecklistsHero totalChecklists={checklists.length} categories={categories} />

      {/* Checklists by Category */}
      <section className="py-8 container mx-auto px-4 mb-16 max-w-7xl">
        {categories.map(category => {
          const categoryChecklists = checklists.filter(c => c.category === category);
          
          return (
            <div key={category} className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
                {category}
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({categoryChecklists.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryChecklists.map(checklist => (
                  <ChecklistCard key={checklist.id} checklist={checklist} />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Pro Tips Section */}
      <section className="py-8 container mx-auto px-4 mb-16 max-w-7xl">
        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            💡 Pro Tips
          </h3>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300">
            <li>✓ Your progress is automatically saved in your browser</li>
            <li>✓ Click on any checklist item to expand and view more details</li>
            <li>✓ Export checklists as markdown to share with your team</li>
            <li>✓ Use the share button to get a direct link to any checklist</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
