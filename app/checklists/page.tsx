import { Metadata } from 'next';
import { ListChecks } from 'lucide-react';
import { checklists } from '@/data/checklists';
import { ChecklistCard } from '@/components/checklists/checklist-card';

export const metadata: Metadata = {
  title: 'DevOps & Security Checklists | The DevOps Daily',
  description: 'Interactive checklists for DevOps, security, and cloud best practices. Track your progress and ensure nothing is missed.',
  keywords: ['devops checklists', 'security checklists', 'kubernetes checklist', 'aws security', 'ci/cd pipeline'],
};

export default function ChecklistsPage() {
  const categories = Array.from(new Set(checklists.map(c => c.category)));

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      <div className="mb-12 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <ListChecks className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100">
            Interactive Checklists
          </h1>
        </div>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
          Follow best practices with our interactive checklists for security, DevOps, and cloud operations.
          Track your progress and never miss a critical step.
        </p>
      </div>

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

      <div className="mt-16 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
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
    </div>
  );
}
