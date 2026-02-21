/**
 * Centralized sponsor data for the entire site (single source of truth).
 * Add, update, or remove sponsors here and changes will be reflected everywhere.
 */

export interface Sponsor {
  name: string;
  logo: string;
  url: string;
  tagline?: string;
  description?: string;
  /** Base className for logo (colors, fill, etc.) - used everywhere */
  className?: string;
  /** Additional className for sidebar context (sizing, positioning) */
  sidebarClassName?: string;
}

export const sponsors: Sponsor[] = [
  {
    name: 'DigitalOcean',
    logo: 'https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%202.svg',
    url: 'https://www.jdoqocy.com/click-101674709-15836238',
    tagline: 'Cloud infrastructure for developers',
    description: 'Simple, reliable cloud computing designed for developers',
  },
  {
    name: 'DevDojo',
    logo: '/devdojo.svg?height=60&width=120',
    url: 'https://devdojo.com',
    tagline: 'Developer community & tools',
    description: 'Join a community of developers sharing knowledge and tools',
    className: 'fill-current text-red-500',
    sidebarClassName: 'w-auto h-12 shrink-0 -mt-0.5 ml-1',
  },
  {
    name: 'Acronis',
    logo: '/acronis.svg',
    url: 'https://www.jdoqocy.com/click-101674709-10562048',
    tagline: 'The most secure backup',
    description: 'Acronis: the most secure backup solution for your data',
  },
  {
    name: 'Pluralsight',
    logo: '/pluralsight-logo.png',
    url: 'https://www.jdoqocy.com/click-101674709-17135608',
    tagline: 'Technology skills platform',
    description: 'Expert-led courses in software development, IT ops, data, and cybersecurity',
    className: 'bg-[hsl(240_10%_3.9%)] rounded px-3 py-2',
  },
];

/**
 * Get all active sponsors
 */
export function getSponsors(): Sponsor[] {
  return sponsors;
}
