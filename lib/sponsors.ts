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
    url: 'https://m.do.co/c/2a9bba940f39',
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
    name: 'SMTPfast',
    logo: '/smtpfast.svg',
    url: 'https://smtpfa.st',
    tagline: 'Resend-compatible email API on AWS SES',
    description: 'Drop-in /v1/emails compatibility, embeddable signup forms, and SES-grade deliverability — without the AWS console.',
    className: 'text-foreground',
    sidebarClassName: 'w-auto h-10 shrink-0 -mt-0.5 ml-1',
  },
  {
    name: 'QuizAPI',
    logo: '/quizapi.png',
    url: 'https://quizapi.io?ref=devops-daily',
    tagline: 'Developer-first quiz platform',
    description: 'Build, generate, and embed quizzes with a powerful REST API. AI-powered question generation and live multiplayer.',
  },
];

/**
 * Get all active sponsors
 */
export function getSponsors(): Sponsor[] {
  return sponsors;
}
