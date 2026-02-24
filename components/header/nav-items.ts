import {
  BookOpen,
  FileText,
  Map,
  Target,
  Gamepad2,
  Wrench,
  Users,
  UserCircle,
  FolderOpen,
  Tags,
  Trophy,
  Briefcase,
  ExternalLink,
  Home,
  Newspaper,
  Library,
  ListChecks,
  Layers,
  Gift,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  external?: boolean;
  badge?: string;
  featured?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  color?: string;
}

// Color themes for different sections
export const sectionColors = {
  primary: {
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    text: 'text-primary',
    gradient: 'from-primary to-purple-600',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600',
    gradient: 'from-blue-500 to-blue-600',
  },
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-600',
    gradient: 'from-green-500 to-emerald-600',
  },
  orange: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-600',
    gradient: 'from-orange-500 to-amber-600',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-600',
    gradient: 'from-purple-500 to-violet-600',
  },
  teal: {
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
    text: 'text-teal-600',
    gradient: 'from-teal-500 to-cyan-600',
  },
  pink: {
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    text: 'text-pink-600',
    gradient: 'from-pink-500 to-rose-600',
  },
} as const;

// Main navigation items (no dropdowns)
export const mainNavigation = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Posts', href: '/posts', icon: FileText },
  { label: 'Guides', href: '/guides', icon: BookOpen },
  { label: 'News', href: '/news', icon: Newspaper, badge: 'New' },
];

// Dropdown navigation data
export const dropdownNavigation: Record<string, NavSection[]> = {
  tools: [
    {
      title: 'DevOps Tools',
      icon: Wrench,
      description: 'Curated tools and resources',
      color: 'blue',
      items: [
        {
          label: 'DevOps Toolbox',
          href: '/toolbox',
          description: 'Essential DevOps tools collection',
          icon: Wrench,
          featured: false,
        },
        {
          label: 'DevOps Books',
          href: '/books',
          description: 'Curated DevOps & SRE books',
          icon: Library,
        },
        {
          label: 'Interactive Games',
          href: '/games',
          description: 'DevOps games and simulators',
          icon: Gamepad2,
        },
        {
          label: 'Checklists',
          href: '/checklists',
          description: 'Interactive security & DevOps checklists',
          icon: ListChecks,
        },
      ],
    },
    {
      title: 'Learning Resources',
      icon: Map,
      description: 'Structured learning paths',
      color: 'green',
      items: [
        {
          label: 'Practical Exercises',
          href: '/exercises',
          description: 'Hands-on DevOps exercises',
          icon: Target,
        },
        {
          label: 'DevOps Roadmap',
          href: '/roadmap',
          description: 'Your journey to DevOps mastery',
          icon: Map,
          featured: false,
        },
        {
          label: 'All Roadmaps',
          href: '/roadmaps',
          description: 'Browse all learning paths',
          icon: Map,
        },
       {
         label: 'Flashcards',
         href: '/flashcards',
         description: 'Study DevOps concepts',
         icon: Layers,
       },
       {
         label: 'Quizzes & Tests',
         href: '/quizzes',
          description: 'Test your DevOps knowledge',
          icon: Trophy,
        },
        {
          label: 'Interview Questions',
          href: '/interview-questions',
          description: 'Practice DevOps interview Q&A',
          icon: Briefcase,
          badge: 'New',
        },
      ],
    },
  ],
  more: [
    {
      title: 'Explore Content',
      icon: FolderOpen,
      description: 'Discover by topic and author',
      color: 'purple',
      items: [
        {
          label: 'Categories',
          href: '/categories',
          description: 'Browse by technology topic',
          icon: FolderOpen,
        },
        {
          label: 'Tags',
          href: '/tags',
          description: 'Find content by tags',
          icon: Tags,
        },
        {
          label: 'Hire an Expert',
          href: '/experts',
          description: 'Find DevOps experts for hire',
          icon: UserCircle,
        },
      ],
    },
    {
      title: 'Special Events',
      icon: Gift,
      description: 'Seasonal challenges',
      color: 'pink',
      items: [
        {
          label: 'Advent of DevOps',
          href: '/advent-of-devops',
          description: '25 days of DevOps challenges',
          icon: Gift,
          featured: true,
          badge: '2025',
        },
      ],
    },
    {
      title: 'Community',
      icon: Users,
      description: 'Connect and contribute',
      color: 'orange',
      items: [
        {
          label: 'GitHub',
          href: 'https://github.com/The-DevOps-Daily',
          description: 'Contribute to our projects',
          icon: ExternalLink,
          external: true,
        },
        {
          label: 'Twitter',
          href: 'https://x.com/thedevopsdaily',
          description: 'Follow us for updates',
          icon: ExternalLink,
          external: true,
        },
      ],
    },
  ],
};
