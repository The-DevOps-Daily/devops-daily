import {
  Network,
  KeyRound,
  Binary,
  Fingerprint,
  Clock,
  type LucideIcon,
} from 'lucide-react';

export interface Tool {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  /** Tagline shown on tool pages under the title */
  tagline: string;
  icon: LucideIcon;
  /** Search keywords so the tool shows up for common queries */
  keywords: string[];
  /** Category used for grouping on the index page */
  category: 'networking' | 'encoding' | 'security' | 'scheduling';
  /** Related content slugs for cross-linking on the tool result */
  relatedPosts?: string[];
  relatedSimulators?: string[];
}

export const TOOLS: Tool[] = [
  {
    slug: 'cidr-calculator',
    title: 'CIDR Subnet Calculator',
    shortTitle: 'CIDR Calculator',
    description:
      'Calculate network range, usable IP count, subnet mask, and broadcast address from a CIDR block.',
    tagline: 'Parse CIDR blocks, compute ranges, and check whether an IP lives inside a network.',
    icon: Network,
    keywords: ['cidr', 'subnet', 'ip', 'vpc', 'networking', 'calculator'],
    category: 'networking',
    relatedSimulators: ['aws-vpc-simulator', 'packet-journey', 'dns-simulator'],
  },
  {
    slug: 'jwt-decoder',
    title: 'JWT Decoder',
    shortTitle: 'JWT Decoder',
    description:
      'Paste a JWT and see the header, payload, and signature, plus human-readable expiry and issued-at.',
    tagline: 'Inspect any JWT in your browser. Nothing is sent to a server.',
    icon: KeyRound,
    keywords: ['jwt', 'json web token', 'decode', 'oauth', 'security'],
    category: 'security',
    relatedSimulators: ['ssl-tls-handshake'],
  },
  {
    slug: 'base64',
    title: 'Base64 and URL Encoder / Decoder',
    shortTitle: 'Base64 / URL',
    description:
      'Encode or decode base64 and URL-safe strings. Handy for secrets, Kubernetes manifests, and API debugging.',
    tagline: 'Encode or decode base64 and URL strings in real time.',
    icon: Binary,
    keywords: ['base64', 'encode', 'decode', 'url encode', 'kubernetes secret'],
    category: 'encoding',
  },
  {
    slug: 'uuid-generator',
    title: 'UUID and Secret Generator',
    shortTitle: 'UUID / Secret',
    description:
      'Generate UUIDs (v4, v7), random hex tokens, and base64 secrets suitable for Kubernetes secrets or API keys.',
    tagline: 'Cryptographically secure random identifiers and secrets, generated in your browser.',
    icon: Fingerprint,
    keywords: ['uuid', 'guid', 'secret', 'token', 'random', 'generator'],
    category: 'security',
  },
  {
    slug: 'cron-parser',
    title: 'Cron Expression Parser',
    shortTitle: 'Cron Parser',
    description:
      'Translate cron expressions to human-readable schedules and preview the next run times.',
    tagline: 'Decode cron expressions with the next 5 run times, in your local timezone.',
    icon: Clock,
    keywords: ['cron', 'crontab', 'schedule', 'kubernetes cronjob'],
    category: 'scheduling',
  },
];

export function getToolBySlug(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export const CATEGORY_LABEL: Record<Tool['category'], string> = {
  networking: 'Networking',
  encoding: 'Encoding',
  security: 'Security',
  scheduling: 'Scheduling',
};
