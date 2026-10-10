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
  /** Give this sponsor highlighted styling in sponsor placements. */
  featured?: boolean;
  /** Border and background tint for a featured sponsor, in its own brand color. */
  accentClassName?: string;
  /**
   * Slug on go.devops-daily.com, our click tracker. When set, sponsor
   * placements link through it so we can count clicks per placement. The slug
   * must exist in the sponsor-links worker first, or the link returns 404.
   */
  goSlug?: string;
}

export const GO_LINKS_ORIGIN = 'https://go.devops-daily.com';

/**
 * The link a placement should use for a sponsor. `placement` names where the
 * link sits (sidebar, inline, simulator, readme); GoLinkPageTag adds the page
 * path when a reader clicks it.
 */
export function sponsorHref(sponsor: Sponsor, placement: string): string {
  if (!sponsor.goSlug) return sponsor.url;
  return `${GO_LINKS_ORIGIN}/${sponsor.goSlug}?p=${encodeURIComponent(placement)}`;
}

export const sponsors: Sponsor[] = [
  {
    name: 'Bitrise',
    logo: '/bitrise-brand.svg',
    darkLogo: '/bitrise-brand-light.svg',
    url: 'https://bitrise.io/platform/build-hub',
    goSlug: 'bitrise',
    tagline: 'Managed runners for GitHub Actions',
    description:
      'Bitrise Build Hub runs your GitHub Actions jobs on M4 Macs and AMD Linux machines. Change runs-on and keep your workflows, secrets and logs on GitHub.',
  },
  {
    name: 'Atomsized',
    logo: '/atomsized.svg',
    darkLogo: '/atomsized-light.svg',
    url: 'https://atomsized.com/',
    goSlug: 'atomsized',
    tagline: 'AWS platform engineering and GitOps',
    description:
      'Design and automation for reliable AWS and Kubernetes platforms, safer delivery workflows, and preview and UAT environments your engineers can understand and own.',
  },
  {
    name: 'DigitalOcean',
    logo: 'https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%202.svg',
    url: 'https://m.do.co/c/2a9bba940f39',
    goSlug: 'digitalocean',
    tagline: 'Cloud infrastructure for developers',
    description: 'Simple, reliable cloud computing designed for developers',
  },
  {
    name: 'DevDojo',
    logo: '/devdojo.svg?height=60&width=120',
    url: 'https://devdojo.com',
    goSlug: 'devdojo',
    tagline: 'Developer community & tools',
    description: 'Join a community of developers sharing knowledge and tools',
    className: 'fill-current text-red-500',
  },
  {
    name: 'SMTPfast',
    logo: '/smtpfast.svg',
    url: 'https://smtpfa.st',
    goSlug: 'smtpfast',
    tagline: 'Developer-first email API',
    description:
      'Send transactional and marketing email through a clean REST API. Detailed logs, webhooks, and embeddable signup forms in one dashboard.',
    sidebarClassName: 'translate-x-2',
  },
  {
    name: 'QuizAPI',
    logo: '/quizapi.svg',
    url: 'https://quizapi.io?ref=devops-daily',
    goSlug: 'quizapi',
    tagline: 'Developer-first quiz platform',
    description:
      'Build, generate, and embed quizzes with a powerful REST API. AI-powered question generation and live multiplayer.',
    sidebarClassName: 'translate-x-2',
  },
];

/**
 * Get all active sponsors
 */
export function getSponsors(): Sponsor[] {
  return sponsors;
}

/**
 * Every brand that has sponsored DevOps Daily, current and past, for the
 * "brands we have worked with" row on the sponsorship page. Add a sponsor
 * here once a deal has actually run, and keep them after it ends.
 */
export const sponsorHistory: Pick<Sponsor, 'name' | 'logo' | 'darkLogo'>[] = [
  { name: 'Bitrise', logo: '/bitrise-brand.svg', darkLogo: '/bitrise-brand-light.svg' },
  { name: 'Neon', logo: '/neon-brand.svg', darkLogo: '/neon-brand-light.svg' },
  { name: 'Svix', logo: '/svix-brand.svg', darkLogo: '/svix-brand-light.svg' },
  { name: 'Pluralsight', logo: '/pluralsight-logo.svg', darkLogo: '/pluralsight-logo-light.svg' },
  { name: 'Acronis', logo: '/acronis.svg', darkLogo: '/acronis-light.svg' },
  { name: 'Atomsized', logo: '/atomsized.svg', darkLogo: '/atomsized-light.svg' },
];
