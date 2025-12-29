/**
 * Utility functions for checklist operations
 */

export interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  codeBlocks?: Array<{
    language: string;
    code: string;
    label?: string;
  }>;
  links?: Array<{
    title: string;
    url: string;
  }>;
  critical?: boolean;
}

export interface Checklist {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  tags: string[];
  items: ChecklistItem[];
  resources?: Array<{
    title: string;
    url: string;
  }>;
}

export interface ChecklistProgress {
  [itemId: string]: boolean;
}

const STORAGE_PREFIX = 'checklist_progress_';

/**
 * Get checklist progress from localStorage
 */
export const getChecklistProgress = (checklistId: string): ChecklistProgress => {
  if (typeof window === 'undefined') return {};
  
  const stored = localStorage.getItem(`${STORAGE_PREFIX}${checklistId}`);
  return stored ? JSON.parse(stored) : {};
};

/**
 * Save checklist progress to localStorage
 */
export const saveChecklistProgress = (
  checklistId: string,
  progress: ChecklistProgress
): void => {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(
    `${STORAGE_PREFIX}${checklistId}`,
    JSON.stringify(progress)
  );
};

/**
 * Calculate completion percentage
 */
export const calculateProgress = (
  items: ChecklistItem[],
  progress: ChecklistProgress
): number => {
  if (items.length === 0) return 0;
  
  const completedCount = items.filter(item => progress[item.id]).length;
  return Math.round((completedCount / items.length) * 100);
};

/**
 * Reset checklist progress
 */
export const resetChecklistProgress = (checklistId: string): void => {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(`${STORAGE_PREFIX}${checklistId}`);
};

/**
 * Export checklist to markdown
 */
export const exportToMarkdown = (
  checklist: Checklist,
  progress: ChecklistProgress
): string => {
  let markdown = `# ${checklist.title}\n\n`;
  markdown += `${checklist.description}\n\n`;
  markdown += `**Category:** ${checklist.category}\n`;
  markdown += `**Difficulty:** ${checklist.difficulty}\n`;
  markdown += `**Estimated Time:** ${checklist.estimatedTime}\n\n`;
  markdown += `## Checklist\n\n`;
  
  checklist.items.forEach(item => {
    const checked = progress[item.id] ? 'x' : ' ';
    markdown += `- [${checked}] ${item.title}\n`;
    if (item.description) {
      markdown += `  ${item.description}\n`;
    }
  });
  
  if (checklist.resources && checklist.resources.length > 0) {
    markdown += `\n## Resources\n\n`;
    checklist.resources.forEach(resource => {
      markdown += `- [${resource.title}](${resource.url})\n`;
    });
  }
  
  return markdown;
};

/**
 * Download a file
 */
export const downloadFile = (content: string, filename: string, type: string): void => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Generate shareable URL
 */
export const generateShareUrl = (checklistSlug: string): string => {
  if (typeof window === 'undefined') return '';
  
  return `${window.location.origin}/checklists/${checklistSlug}`;
};
