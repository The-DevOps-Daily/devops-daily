/**
 * Centralized sponsor data for the entire site (single source of truth).
 * Add, update, or remove sponsors here and changes will be reflected everywhere.
 */

export interface Sponsor {
  name: string;
  logo: string;
  /** Optional logo variant for dark mode. */
  darkLogo?: string;
  url: string;
  tagline?: string;
  description?: string;
  /** Base className for logo (colors, fill, etc.) - used everywhere */
  className?: string;
  /** Additional className for sidebar context (sizing, positioning) */
  sidebarClassName?: string;
  /**
   * Give this sponsor top billing: it is tinted in the sidebar and takes a
   * full-width card in the grid layouts instead of a half-width one.
   */
  featured?: boolean;
  /** Border and background tint for a featured sponsor, in its own brand color. */
  accentClassName?: string;
}

export const sponsors: Sponsor[] = [
  {
    name: 'Svix',
    logo: '/svix-brand.svg',
    darkLogo: '/svix-brand-light.svg',
    url: 'https://www.svix.com/?ref=devops-daily',
    tagline: 'Webhooks as a service',
    description:
      'Svix Dispatch sends your webhooks for you: retries with exponential backoff, signed payloads, idempotency keys, and a delivery log your customers can see.',
    featured: true,
    accentClassName: 'border-[#2c70ff]/40 bg-[#2c70ff]/[0.06] hover:border-[#2c70ff]/70',
  },
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
  },
  {
    name: 'SMTPfast',
    logo: '/smtpfast.svg',
    url: 'https://smtpfa.st',
    tagline: 'Developer-first email API',
    description: 'Send transactional and marketing email through a clean REST API. Detailed logs, webhooks, and embeddable signup forms in one dashboard.',
  },
  {
    name: 'QuizAPI',
    logo: '/quizapi.svg',
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
