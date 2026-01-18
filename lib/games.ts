// lib/games.ts
export interface Game {
  id: string;
  title: string;
  description: string;
  iconName: string;
  badgeText?: string;
  color: string;
  href: string;
  tags: string[];
  isNew?: boolean;
  isHot?: boolean;
  isPopular?: boolean;
  isComingSoon?: boolean;
  featured?: boolean;
  category?: string;
}

/**
 * Games configuration
 * This is the single source of truth for game metadata
 */
const games: Game[] = [
  {
    id: 'scaling-simulator',
    title: 'Horizontal vs Vertical Scaling Simulator',
    description:
      'Interactive game to learn scaling strategies for web applications. Experiment with horizontal and vertical scaling, see the effects on performance, cost, and reliability with realistic pricing simulation and budget constraints.',
    iconName: 'TrendingUp',
    badgeText: 'New',
    color: 'from-emerald-500 to-teal-600',
    href: '/games/scaling-simulator',
    tags: ['scaling', 'infrastructure', 'educational', 'interactive', 'cloud', 'auto-scaling'],
    isNew: true,
    featured: true,
    category: 'Infrastructure',
  },
  {
    id: 'linux-terminal',
    title: 'Learn Linux - Interactive Tutorial',
    description:
      'Master essential Linux commands through interactive lessons. Practice pwd, ls, cd, cat, grep, chmod, pipes, and more in a simulated terminal environment with 6 progressive lessons.',
    iconName: 'Terminal',
    badgeText: 'New',
    color: 'from-gray-700 to-gray-900',
    href: '/games/linux-terminal',
    tags: ['linux', 'terminal', 'educational', 'interactive', 'tutorial', 'beginner'],
    isNew: true,
    featured: true,
    category: 'Educational',
  },
  {
    id: 'load-balancer-simulator',
    title: 'Load Balancer Algorithm Simulator',
    description:
      'Learn how different load balancing algorithms distribute traffic across servers. Experiment with Round Robin, Least Connections, IP Hash, and more. See how load balancers handle failures and optimize performance.',
    iconName: 'Server',
    badgeText: 'New',
    color: 'from-cyan-500 to-blue-600',
    href: '/games/load-balancer-simulator',
    tags: ['load-balancing', 'networking', 'educational', 'interactive', 'infrastructure'],
    isNew: true,
    featured: true,
    category: 'Infrastructure',
  },
  {
    id: 'dbms-simulator',
    title: 'Database Management Systems',
    description:
      'Learn about different database types (SQL, NoSQL, Graph, Time-Series) and their use cases. Explore CAP theorem trade-offs and make informed database choices.',
    iconName: 'Database',
    badgeText: 'New',
    color: 'from-blue-500 to-cyan-600',
    href: '/games/dbms-simulator',
    tags: ['database', 'sql', 'nosql', 'educational', 'interactive'],
    isNew: true,
    category: 'Infrastructure',
  },
  {
    id: 'gitops-workflow',
    title: 'GitOps Workflow Simulator',
    description:
      'Learn GitOps principles through interactive scenarios. Understand Git as source of truth, automated sync, and drift detection.',
    iconName: 'GitBranch',
    badgeText: 'New',
    color: 'from-indigo-500 to-purple-600',
    href: '/games/gitops-workflow',
    tags: ['gitops', 'kubernetes', 'argocd', 'educational', 'interactive'],
    isNew: true,
    category: 'DevOps',
  },
  {
    id: 'bug-hunter',
    title: 'Bug Hunter',
    description:
      'DevOps-themed Snake game where you control a bug that infects healthy servers. Grow longer with each infection, but avoid crashing into walls or yourself!',
    iconName: 'Bug',
    badgeText: 'New',
    color: 'from-red-500 to-orange-600',
    href: '/games/bug-hunter',
    tags: ['game', 'arcade', 'interactive', 'security'],
    isNew: true,
    category: 'Games',
  },
  {
    id: 'tcp-vs-udp',
    title: 'TCP vs UDP Simulator',
    description:
      'Interactive visualization showing the differences between TCP\'s reliable connection-oriented protocol and UDP\'s fast connectionless approach. See the 3-way handshake, packet loss, and retransmissions in action.',
    iconName: 'Network',
    badgeText: 'New',
    color: 'from-cyan-500 to-green-600',
    href: '/games/tcp-vs-udp',
    tags: ['networking', 'educational', 'interactive', 'protocols'],
    isNew: true,
    category: 'Networking',
  },
  {
    id: 'devops-scorecard',
    title: 'DevOps Scorecard',
    description:
      'Evaluate your DevOps skills across 8 key areas and generate a beautiful, shareable scorecard with personalized insights.',
    iconName: 'Trophy',
    badgeText: 'New',
    color: 'from-blue-500 to-purple-600',
    href: '/games/devops-scorecard',
    tags: ['assessment', 'career', 'skills'],
    isNew: true,
    featured: true,
    category: 'Assessment',
  },
  {
    id: 'microservices-simulator',
    title: 'Microservices Architecture Simulator',
    description:
      'Design and deploy microservices. See communication patterns, handle failures, and scale independently. Learn when to use microservices and understand the trade-offs.',
    iconName: 'Boxes',
    badgeText: 'New',
    color: 'from-purple-500 to-pink-600',
    href: '/games/microservices-simulator',
    tags: ['microservices', 'architecture', 'interactive', 'distributed-systems'],
    isNew: true,
    category: 'Architecture',
  },
  {
    id: 'k8s-scheduler',
    title: 'Kubernetes Scheduler Challenge',
    description:
      'Drag-and-drop Pods onto Nodes while honoring kube scheduling rules: resources, taints/tolerations, selectors, and topology spread.',
    iconName: 'LineChart',
    color: 'from-sky-500 to-cyan-600',
    href: '/games/k8s-scheduler',
    tags: ['kubernetes', 'scheduling', 'interactive'],
    featured: true,
    category: 'Kubernetes',
  },
  {
    id: 'rate-limit-simulator',
    title: 'Rate Limit Simulator',
    description:
      'Learn API rate limiting, backoff strategies, and throttling with real-time visualization and interactive charts.',
    iconName: 'Activity',
    badgeText: 'Popular',
    color: 'from-blue-500 to-cyan-600',
    href: '/games/rate-limit-simulator',
    tags: ['educational', 'API', 'interactive'],
    isPopular: true,
    category: 'APIs',
  },
  {
    id: 'ddos-simulator',
    title: 'DDoS Attack Simulator',
    description:
      'Educational simulator to understand how DDoS attacks work with stunning real-time visualizations, multiple attack vectors, and protection mechanisms.',
    iconName: 'Shield',
    color: 'from-red-500 to-orange-600',
    href: '/games/ddos-simulator',
    tags: ['educational', 'security', 'interactive', 'visualization'],
    category: 'Security',
  },
  {
    id: 'scalable-sentry',
    title: 'Scalable Sentry',
    description:
      'Tower defense game where you defend your infrastructure against waves of network traffic. Deploy servers, manage resources, and survive boss waves!',
    iconName: 'Shield',
    badgeText: 'New',
    color: 'from-indigo-500 to-purple-600',
    href: '/games/scalable-sentry',
    tags: ['game', 'tower-defense', 'strategy', 'networking'],
    isNew: true,
    category: 'Games',
  },
  {
    id: 'packet-journey',
    title: 'Network Packet Journey',
    description:
      'Follow a single HTTP/HTTPS packet through the entire network stack with stunning animations. Learn DNS, TCP, TLS, CDN, load balancing, and more!',
    iconName: 'Network',
    badgeText: 'New',
    color: 'from-cyan-500 to-blue-600',
    href: '/games/packet-journey',
    tags: ['educational', 'networking', 'interactive', 'visualization'],
    isNew: true,
    category: 'Networking',
  },
  {
    id: 'cicd-stack-generator',
    title: 'CI/CD Stack Generator',
    description: 'Spin the reels to generate your perfect (or perfectly cursed) DevOps stack!',
    iconName: 'Workflow',
    badgeText: 'Fun',
    color: 'from-emerald-500 to-blue-600',
    href: '/games/cicd-stack-generator',
    tags: ['fun', 'interactive'],
    isHot: true,
    category: 'CI/CD',
  },
  {
    id: 'infra-tarot',
    title: 'Infra Tarot Cards',
    description:
      'Draw mystical cards to discover your infrastructure destiny! Get humorous readings about your DevOps future.',
    iconName: 'Sparkles',
    color: 'from-purple-500 to-blue-600',
    href: '/games/infra-tarot',
    tags: ['fun', 'humor', 'mystical'],
    featured: false,
    category: 'Fun',
  },
  {
    id: 'devops-memes',
    title: 'You Might Be a DevOps Engineer If...',
    description:
      'Auto-generating hilarious and painfully accurate DevOps memes. Each reload brings a new dose of reality!',
    iconName: 'Laugh',
    badgeText: 'Hot',
    color: 'from-orange-500 to-red-600',
    href: '/games/devops-memes',
    tags: ['humor', 'memes', 'viral'],
    isHot: true,
    category: 'Fun',
  },
  {
    id: 'cards-against-devops',
    title: 'Cards Against DevOps',
    description:
      'A hilariously inappropriate DevOps party game. Fill in the blanks with the most outrageous DevOps scenarios!',
    iconName: 'Heart',
    color: 'from-pink-500 to-red-600',
    href: '/games/cards-against-devops',
    tags: ['humor', 'party', 'interactive'],
    category: 'Fun',
  },
  {
    id: 'git-quiz',
    title: 'Git Command Quiz',
    description: 'Test your Git knowledge with interactive scenarios and real-world challenges.',
    iconName: 'Activity',
    badgeText: 'Popular',
    color: 'from-orange-500 to-amber-600',
    href: '/games/git-quiz',
    tags: ['git', 'quiz', 'interactive'],
    isPopular: true,
    category: 'Git',
  },
  {
    id: 'uptime-defender',
    title: 'Uptime Defender',
    description:
      'Fast-paced SRE game where you defend your infrastructure uptime! Handle incoming incidents by adding nodes, rotating logs, failing over, restarting pods, and scaling databases.',
    iconName: 'Server',
    badgeText: 'New',
    color: 'from-green-500 to-emerald-600',
    href: '/games/uptime-defender',
    tags: ['game', 'sre', 'interactive', 'real-time'],
    isNew: true,
    category: 'SRE',
  },
  {
    id: 'incident-commander',
    title: 'Incident Commander Simulator',
    description: 'Lead your team through production incidents and learn incident management best practices.',
    iconName: 'Zap',
    badgeText: 'Coming Soon',
    color: 'from-purple-500 to-indigo-600',
    href: '#',
    tags: ['incident-management', 'sre', 'leadership'],
    isComingSoon: true,
    category: 'SRE',
  },
  {
    id: 'terraform-puzzle',
    title: 'Terraform State Puzzle',
    description: 'Fix complex Terraform state issues and learn advanced IaC troubleshooting techniques.',
    iconName: 'Shield',
    badgeText: 'Coming Soon',
    color: 'from-green-500 to-teal-600',
    href: '#',
    tags: ['terraform', 'infrastructure', 'troubleshooting'],
    isComingSoon: true,
    category: 'Infrastructure as Code',
  },
  {
    id: 'database-performance',
    title: 'Database Performance Tuning',
    description: 'Optimize slow queries and database configurations in real-world scenarios.',
    iconName: 'Database',
    badgeText: 'Coming Soon',
    color: 'from-blue-500 to-indigo-600',
    href: '#',
    tags: ['database', 'performance', 'sql'],
    isComingSoon: true,
    category: 'Databases',
  },
  {
    id: 'cloud-cost-optimizer',
    title: 'Cloud Cost Optimizer Game',
    description: 'Make architectural decisions to reduce cloud costs while maintaining performance and reliability.',
    iconName: 'Cloud',
    badgeText: 'Coming Soon',
    color: 'from-emerald-500 to-green-600',
    href: '#',
    tags: ['cloud', 'cost-optimization', 'architecture'],
    isComingSoon: true,
    category: 'Cloud',
  },
  {
    id: 'docker-escape',
    title: 'Container Security Challenge',
    description: 'Learn container security by identifying and fixing vulnerabilities in Docker configurations.',
    iconName: 'Shield',
    badgeText: 'Coming Soon',
    color: 'from-red-500 to-pink-600',
    href: '#',
    tags: ['security', 'docker', 'containers'],
    isComingSoon: true,
    category: 'Security',
  },
];

/**
 * Get all games
 */
export async function getAllGames(): Promise<Game[]> {
  return games;
}

/**
 * Get all active games (excluding coming soon)
 */
export async function getActiveGames(): Promise<Game[]> {
  return games.filter((game) => !game.isComingSoon);
}

/**
 * Get featured games (excluding coming soon)
 */
export async function getFeaturedGames(): Promise<Game[]> {
  return games.filter((game) => game.featured && !game.isComingSoon);
}

/**
 * Get a game by ID
 */
export async function getGameById(id: string): Promise<Game | undefined> {
  return games.find((game) => game.id === id);
}

/**
 * Get games by category
 */
export async function getGamesByCategory(category: string): Promise<Game[]> {
  return games.filter((game) => game.category?.toLowerCase() === category.toLowerCase());
}

/**
 * Get games by tag
 */
export async function getGamesByTag(tag: string): Promise<Game[]> {
  return games.filter((game) => game.tags.some((t) => t.toLowerCase() === tag.toLowerCase()));
}
