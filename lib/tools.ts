import {
  Network,
  KeyRound,
  Binary,
  Fingerprint,
  Clock,
  Container,
  type LucideIcon,
} from 'lucide-react';

export interface ToolFaq {
  question: string;
  answer: string;
}

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
  category: 'networking' | 'encoding' | 'security' | 'scheduling' | 'kubernetes';
  /** Related content slugs for cross-linking on the tool result */
  relatedPosts?: string[];
  relatedSimulators?: string[];
  /** FAQ emitted as FAQPage schema for AI search / Google rich results */
  faqs?: ToolFaq[];
}

export const TOOLS: Tool[] = [
  {
    slug: 'cidr-calculator',
    title: 'CIDR Subnet Calculator',
    shortTitle: 'CIDR Calculator',
    description:
      'CIDR subnet calculator: parse a CIDR block to get network range, subnet mask, broadcast address, usable IPs, and check whether an IP belongs to the network.',
    tagline: 'Parse CIDR blocks, compute ranges, split into smaller subnets, and check whether an IP lives inside a network.',
    icon: Network,
    keywords: ['cidr', 'subnet', 'ip', 'vpc', 'networking', 'calculator'],
    category: 'networking',
    relatedSimulators: ['aws-vpc-simulator', 'packet-journey', 'dns-simulator'],
    faqs: [
      {
        question: 'What does /24 mean in CIDR?',
        answer:
          'A /24 CIDR block has 24 bits of network prefix, leaving 8 bits for hosts. That gives 256 total addresses, of which 254 are usable (the first is the network address, the last is broadcast).',
      },
      {
        question: 'How many usable IP addresses does a /16 have?',
        answer:
          'A /16 has 2^16 = 65,536 total addresses. Subtracting the network and broadcast addresses leaves 65,534 usable host addresses. AWS VPCs commonly use /16 as the VPC CIDR.',
      },
      {
        question: 'Can I split a CIDR block into smaller subnets?',
        answer:
          'Yes. Use the subnet splitter on this page to divide a parent CIDR into equal-sized children. For example, a /16 can be split into 4 /18 subnets, 16 /20 subnets, and so on.',
      },
      {
        question: 'How do I check if an IP is inside a CIDR range?',
        answer:
          'Enter the CIDR block, then paste the IP into the checker. The tool bit-masks the IP with the subnet mask and compares it to the network address to confirm inclusion.',
      },
    ],
  },
  {
    slug: 'jwt-decoder',
    title: 'JWT Decoder',
    shortTitle: 'JWT Decoder',
    description:
      'JWT decoder that parses the header, payload, and signature in your browser. Shows human-readable expiry and issued-at, with no token sent to any server.',
    tagline: 'Inspect any JWT in your browser. Nothing is sent to a server.',
    icon: KeyRound,
    keywords: ['jwt', 'json web token', 'decode', 'oauth', 'security'],
    category: 'security',
    relatedSimulators: ['ssl-tls-handshake'],
    faqs: [
      {
        question: 'Does this decoder send my JWT to a server?',
        answer:
          'No. Decoding happens entirely in your browser using base64url decoding. Nothing is transmitted.',
      },
      {
        question: 'Can a JWT be decoded without the secret?',
        answer:
          'Yes. JWT payloads are base64url-encoded, not encrypted. Anyone with the token can read its header and payload. The signature requires the secret to verify, not to read.',
      },
      {
        question: 'What do iat and exp mean?',
        answer:
          '`iat` is the issued-at timestamp (UNIX seconds). `exp` is the expiration timestamp. Both should be integers. This decoder shows them in ISO format plus a relative "N minutes ago" or "in N minutes" indicator.',
      },
      {
        question: 'Why should I never put secrets in a JWT?',
        answer:
          'The payload is not encrypted, just encoded. Anyone who intercepts the token can read every claim. If you need confidentiality, encrypt the payload (JWE) or use opaque tokens.',
      },
    ],
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
    faqs: [
      {
        question: 'Is base64 encryption?',
        answer:
          'No. Base64 is an encoding, not a cipher. It is trivially reversible. Never use base64 alone to hide secret data.',
      },
      {
        question: 'Why are Kubernetes Secrets base64-encoded?',
        answer:
          'So binary data can round-trip through YAML, which is text. It is not a security feature. Anyone with read access to the Secret can base64-decode the value.',
      },
      {
        question: 'What is the difference between base64 and URL encoding?',
        answer:
          'Base64 turns arbitrary bytes into 64 printable characters (A-Z, a-z, 0-9, +, /). URL encoding (percent-encoding) escapes characters that would otherwise have special meaning in a URL.',
      },
    ],
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
    faqs: [
      {
        question: 'What is the difference between UUID v4 and UUID v7?',
        answer:
          'UUID v4 is fully random. UUID v7 embeds a millisecond timestamp in the first bytes, so IDs sort by creation time. v7 is the better choice for database primary keys because it avoids the B-tree index fragmentation that v4 causes.',
      },
      {
        question: 'Are these UUIDs cryptographically secure?',
        answer:
          'Yes. All values are generated with the browser Web Crypto API (crypto.getRandomValues). You should still not use a browser tool to mint secrets that require hardware-backed randomness (HSM).',
      },
      {
        question: 'How do I put this into a Kubernetes Secret?',
        answer:
          'Use the "Kube Secret" format. It generates 32 random bytes and base64-encodes them, ready to paste into the data field of a Secret manifest.',
      },
    ],
  },
  {
    slug: 'cron-parser',
    title: 'Cron Expression Parser',
    shortTitle: 'Cron Parser',
    description:
      'Cron expression parser that translates schedules into plain English and previews the next 5 run times in your local timezone. Validates 5 and 6-field syntax.',
    tagline: 'Decode cron expressions with the next 5 run times, in your local timezone.',
    icon: Clock,
    keywords: ['cron', 'crontab', 'schedule', 'kubernetes cronjob'],
    category: 'scheduling',
    faqs: [
      {
        question: 'What does * * * * * mean?',
        answer:
          'Every minute of every hour of every day. The five fields are minute, hour, day-of-month, month, day-of-week. An asterisk in any field means "any value".',
      },
      {
        question: 'How do I run a job every 15 minutes?',
        answer:
          'Use `*/15 * * * *`. The slash introduces a step value; `*/15` means every 15 minutes starting at minute 0.',
      },
      {
        question: 'What timezone do the next run times use?',
        answer:
          'Your local timezone, as reported by the browser. If your server runs cron in UTC, remember to adjust mentally before scheduling.',
      },
      {
        question: 'Are @daily and 0 0 * * * the same?',
        answer:
          'Yes. `@daily` and `@midnight` are shortcuts for `0 0 * * *`. This parser expands them automatically when computing the next run times.',
      },
    ],
  },
  {
    slug: 'k8s-resources',
    title: 'Kubernetes Resource Calculator',
    shortTitle: 'K8s Resources',
    description:
      'Size CPU and memory requests / limits for a Pod based on workload characteristics, replicas, and headroom.',
    tagline: 'Plan Kubernetes requests and limits without guessing. See node-fit, cluster totals, and recommended burst.',
    icon: Container,
    keywords: [
      'kubernetes',
      'k8s',
      'memory calculator',
      'cpu',
      'request',
      'limit',
      'pod',
      'sizing',
    ],
    category: 'kubernetes',
    relatedSimulators: ['k8s-scheduler', 'scaling-simulator'],
    faqs: [
      {
        question: 'What is the difference between requests and limits?',
        answer:
          'Requests are what Kubernetes guarantees a container. The scheduler uses them to place Pods on nodes. Limits are the hard ceiling; exceeding them for CPU causes throttling, for memory causes an OOMKill.',
      },
      {
        question: 'Should I set CPU limits?',
        answer:
          'This is debated. CPU limits cause throttling under load, which can hurt latency even when the node has spare capacity. Many teams set CPU requests but leave limits off. This calculator defaults to a limit for safety but lets you unset it.',
      },
      {
        question: 'What headroom should I use?',
        answer:
          'A common rule of thumb is 25-50% headroom over measured peak usage. The calculator lets you set a multiplier so you can size from real metrics and add buffer explicitly.',
      },
    ],
  },
  {
    slug: 'yaml-json-formatter',
    title: 'YAML / JSON Formatter and Linter',
    shortTitle: 'YAML / JSON',
    description:
      'Paste YAML or JSON to validate, pretty-print, and convert between the two. Runs entirely in your browser.',
    tagline: 'Validate, format, and convert YAML and JSON. Browser-only.',
    icon: Binary,
    keywords: ['yaml', 'json', 'format', 'lint', 'validator', 'converter'],
    category: 'encoding',
    faqs: [
      {
        question: 'Can I convert JSON to YAML and back?',
        answer:
          'Yes. Pick the target format and the tool will validate the input first, then emit a pretty-printed version in the other format.',
      },
      {
        question: 'Does this support YAML anchors or multi-document streams?',
        answer:
          'It supports standard YAML 1.2 features via js-yaml. Multi-document YAML (--- separators) is parsed; only the first document is converted to JSON (JSON cannot represent multiple root documents).',
      },
      {
        question: 'Is my data sent anywhere?',
        answer:
          'No. Parsing and formatting happen entirely in your browser.',
      },
    ],
  },
];

export function getToolBySlug(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

/**
 * Build Next.js Metadata for a tool page. Keeps title / description /
 * canonical / OG / Twitter image consistent across all tools so adding a
 * new one only requires writing the page body.
 */
export function buildToolMetadata(slug: string) {
  const tool = getToolBySlug(slug);
  if (!tool) {
    return { title: 'Tool | DevOps Daily' };
  }
  const imagePath = `/images/tools/${tool.slug}.png`;
  return {
    title: `${tool.title} | DevOps Daily`,
    description: tool.description,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      title: tool.title,
      description: tool.tagline,
      url: `/tools/${tool.slug}`,
      type: 'website' as const,
      images: [
        {
          url: imagePath,
          width: 1200,
          height: 630,
          alt: tool.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: tool.title,
      description: tool.tagline,
      images: [imagePath],
    },
  };
}

export const CATEGORY_LABEL: Record<Tool['category'], string> = {
  networking: 'Networking',
  encoding: 'Encoding',
  security: 'Security',
  scheduling: 'Scheduling',
  kubernetes: 'Kubernetes',
};
