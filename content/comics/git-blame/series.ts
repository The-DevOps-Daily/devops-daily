export const gitBlame = {
  slug: 'git-blame',
  title: 'git blame',
  tagline: 'Production is down. Everyone has a theory.',
  description:
    'Meet ShipIt: a talented engineering team, a complicated SaaS platform, and a remarkably persistent legacy service. Illustrated stories about shipping software and keeping it running.',
  volume: 'Everything Is Fine',
  // Review editions stay out of search/sitemaps until publication is approved.
  preview: true,
  pdf: '/comics/git-blame/downloads/chapter-01.pdf',
  chapters: [
    {
      number: 1,
      slug: 'chapter-01',
      title: "The Pod That Wouldn't Die",
      topic: 'Kubernetes rollouts & graceful shutdown',
      description: 'A tiny Friday deployment turns green. Checkout has other ideas.',
      available: true,
    },
    {
      number: 2,
      slug: 'chapter-02',
      title: 'It Worked on My Machine',
      topic: 'Containers & configuration drift',
      description: 'Same code. Different environment. A very different afternoon.',
      available: false,
    },
    {
      number: 3,
      slug: 'chapter-03',
      title: 'The $47,000 Cloud Bill',
      topic: 'AWS costs & resource ownership',
      description: 'Someone owns this infrastructure. Probably.',
      available: false,
    },
    {
      number: 4,
      slug: 'chapter-04',
      title: 'The 3 AM Incident',
      topic: 'Observability & incident response',
      description: 'The dashboards are asleep. The customers are not.',
      available: false,
    },
    {
      number: 5,
      slug: 'chapter-05',
      title: 'The Database Migration',
      topic: 'PostgreSQL & backward compatibility',
      description: 'A schema change meets the versions still running.',
      available: false,
    },
    {
      number: 6,
      slug: 'chapter-06',
      title: 'Everything Is Finally Stable',
      topic: 'Reliability & engineering tradeoffs',
      description: 'A quiet platform. An exciting new roadmap.',
      available: false,
    },
  ],
  cast: [
    {
      name: 'Alex',
      role: 'Senior SRE',
      description: 'Calm in a crisis. His mugs remember every incident.',
    },
    {
      name: 'Maya',
      role: 'Platform engineer',
      description: 'Automates everything. Still trying to retire receipt-bridge.',
    },
    {
      name: 'Sam',
      role: 'Software engineer',
      description: 'Ships quickly, learns quickly. The changes are always small.',
    },
    {
      name: 'Chris',
      role: 'Engineering manager',
      description: 'Balances delivery and reliability. Preferably before the end of the day.',
    },
    {
      name: 'Nora',
      role: 'Database engineer',
      description: 'Asks what happens while both versions are still running.',
    },
    {
      name: 'Eli',
      role: 'FinOps engineer',
      description: 'Follows the bill until it has an owner.',
    },
    {
      name: 'Sophia',
      role: 'Application security engineer',
      description: '“Internal to whom?” Curious, practical, and ready to help.',
    },
  ],
};
