import { Rss, X, Linkedin, Github, Instagram, LucideIcon } from 'lucide-react';

export interface SocialLink {
  name: string;
  href: string;
  icon: LucideIcon;
  colorFrom: string;
  colorTo: string;
  colorFromHover: string;
  colorToHover: string;
  borderColor: string;
  iconColor: string;
  iconHoverColor: string;
}

export interface FooterLink {
  href: string;
  label: string;
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
}

export const socialLinks: SocialLink[] = [
  {
    name: 'RSS Feed',
    href: '/feed.xml',
    icon: Rss,
    colorFrom: 'from-orange-500/10',
    colorTo: 'to-orange-600/10',
    colorFromHover: 'hover:from-orange-500/20',
    colorToHover: 'hover:to-orange-600/20',
    borderColor: 'border-orange-500/20',
    iconColor: 'text-orange-500',
    iconHoverColor: 'group-hover:text-orange-400',
  },
  {
    name: 'X',
    href: 'https://x.com/thedevopsdaily',
    icon: X,
    colorFrom: 'from-slate-500/10',
    colorTo: 'to-slate-600/10',
    colorFromHover: 'hover:from-slate-500/20',
    colorToHover: 'hover:to-slate-600/20',
    borderColor: 'border-slate-500/20',
    iconColor: 'text-slate-500',
    iconHoverColor: 'group-hover:text-slate-400',
  },
  {
    name: 'LinkedIn',
    href: 'https://www.linkedin.com/company/thedevopsdaily',
    icon: Linkedin,
    colorFrom: 'from-blue-500/10',
    colorTo: 'to-blue-600/10',
    colorFromHover: 'hover:from-blue-500/20',
    colorToHover: 'hover:to-blue-600/20',
    borderColor: 'border-blue-500/20',
    iconColor: 'text-blue-500',
    iconHoverColor: 'group-hover:text-blue-400',
  },
  {
    name: 'GitHub',
    href: 'https://github.com/The-DevOps-Daily',
    icon: Github,
    colorFrom: 'from-gray-500/10',
    colorTo: 'to-gray-600/10',
    colorFromHover: 'hover:from-gray-500/20',
    colorToHover: 'hover:to-gray-600/20',
    borderColor: 'border-gray-500/20',
    iconColor: 'text-gray-500',
    iconHoverColor: 'group-hover:text-gray-400',
  },
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/thedailydevops',
    icon: Instagram,
    colorFrom: 'from-pink-500/10',
    colorTo: 'to-pink-600/10',
    colorFromHover: 'hover:from-pink-500/20',
    colorToHover: 'hover:to-pink-600/20',
    borderColor: 'border-pink-500/20',
    iconColor: 'text-pink-500',
    iconHoverColor: 'group-hover:text-pink-400',
  },
];

export const contentSection: FooterSection = {
  title: 'Content',
  links: [
    { href: '/posts', label: 'All Posts' },
    { href: '/guides', label: 'Guides' },
    { href: '/categories', label: 'Categories' },
    { href: '/experts', label: 'Hire an Expert' },
    { href: '/sitemap.xml', label: 'Sitemap' },
  ],
};

export const resourcesSection: FooterSection = {
  title: 'Resources',
  links: [
    { href: '/roadmap', label: 'Roadmap' },
    { href: '/roadmaps', label: 'Roadmaps' },
    { href: '/toolbox', label: 'Toolbox' },
    { href: '/games', label: 'All Games' },
    { href: '/quizzes', label: 'Quizzes' },
    { href: '/books/devops-survival-guide', label: 'DevOps Survival Guide' },
  ],
};

export const topicsSection: FooterSection = {
  title: 'Popular Topics',
  links: [
    { href: '/categories/kubernetes', label: 'Kubernetes' },
    { href: '/categories/terraform', label: 'Terraform' },
    { href: '/categories/docker', label: 'Docker' },
    { href: '/categories/ci-cd', label: 'CI/CD' },
    { href: '/categories/cloud', label: 'Cloud' },
  ],
};

export const legalSection: FooterSection = {
  title: 'Legal',
  links: [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Service' },
    { href: '/sponsorship', label: 'Sponsorship' },
  ],
};
