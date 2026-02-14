/**
 * Centralized sponsor data for the entire site.
 * Add, update, or remove sponsors here and changes will be reflected everywhere.
 */

export interface Sponsor {
  name: string;
  logo: string;
  url: string;
  tagline?: string;
  description?: string;
  className?: string;
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
  },
];

/**
 * Get all active sponsors
 */
export function getSponsors(): Sponsor[] {
  return sponsors;
}
