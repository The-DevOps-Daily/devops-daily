// Data for the /roadmap/junior page: milestone and skill definitions.
// Rendering lives in app/roadmap/junior/page.tsx.

import {
  CheckCircle2,
  Cloud,
  Code,
  Container,
  FileText,
  GitBranch,
  Globe,
  Server,
  Terminal,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export interface JuniorSkill {
  name: string;
  description: string;
  link?: string;
  simulators?: { name: string; link: string }[];
  external?: boolean;
  icon: LucideIcon;
  priority: 'essential' | 'important' | 'nice-to-have';
  estimatedHours: number;
}

export interface JuniorMilestone {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  timeframe: string;
  skills: JuniorSkill[];
  project: {
    name: string;
    description: string;
    difficulty: 'easy' | 'medium';
  };
  outcomes: string[];
  tips: string[];
}

export const milestones: JuniorMilestone[] = [
  {
    id: 'foundation',
    title: 'Foundation',
    subtitle: 'Month 1-2',
    description: 'Build your core skills with Linux and command line basics',
    icon: Terminal,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    timeframe: '4-8 weeks',
    skills: [
      {
        name: 'Linux Basics',
        description: 'Learn essential Linux commands, file system navigation, and permissions',
        link: '/guides/introduction-to-linux',
        simulators: [{ name: 'Linux Terminal', link: '/games/linux-terminal' }],
        icon: Terminal,
        priority: 'essential',
        estimatedHours: 20,
      },
      {
        name: 'Bash Scripting',
        description: 'Automate repetitive tasks with simple shell scripts',
        link: '/guides/introduction-to-bash',
        icon: Code,
        priority: 'essential',
        estimatedHours: 15,
      },
      {
        name: 'Git Basics',
        description: 'Learn version control fundamentals - commit, push, pull, and branches',
        link: '/guides/introduction-to-git',
        simulators: [{ name: 'Git Concepts', link: '/games/git-concepts-simulator' }],
        icon: GitBranch,
        priority: 'essential',
        estimatedHours: 10,
      },
      {
        name: 'Networking Fundamentals',
        description: 'Understand IP addresses, DNS, HTTP, and basic networking concepts',
        link: '/guides/networking-fundamentals',
        simulators: [{ name: 'DNS Resolution', link: '/games/dns-simulator' }],
        icon: Globe,
        priority: 'important',
        estimatedHours: 12,
      },
    ],
    project: {
      name: 'Personal Dev Environment',
      description: 'Set up a Linux VM, configure Git, and write scripts to automate your setup',
      difficulty: 'easy',
    },
    outcomes: [
      'Navigate confidently in the terminal',
      'Write basic automation scripts',
      'Use Git for version control',
    ],
    tips: [
      'Practice commands daily - muscle memory is key',
      'Use a Linux VM or WSL for hands-on learning',
      'Break complex tasks into smaller scripts',
    ],
  },
  {
    id: 'version-control',
    title: 'Version Control & Collaboration',
    subtitle: 'Month 2-3',
    description: 'Master Git workflows and start collaborating with teams',
    icon: GitBranch,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500/10 border-orange-500/20',
    timeframe: '3-4 weeks',
    skills: [
      {
        name: 'Git Branching Strategies',
        description: 'Learn GitFlow, trunk-based development, and when to use each',
        link: '/guides/git-branching-strategies',
        icon: GitBranch,
        priority: 'essential',
        estimatedHours: 8,
      },
      {
        name: 'Pull Requests & Code Review',
        description: 'Create PRs, review code, and collaborate effectively',
        link: '/guides/code-review-best-practices',
        icon: FileText,
        priority: 'essential',
        estimatedHours: 6,
      },
      {
        name: 'GitHub Actions Basics',
        description: 'Automate simple workflows like linting and testing',
        link: '/guides/introduction-to-github-actions',
        icon: Workflow,
        priority: 'important',
        estimatedHours: 10,
      },
    ],
    project: {
      name: 'Automated Testing Pipeline',
      description: 'Create a GitHub repo with automated tests running on every push',
      difficulty: 'easy',
    },
    outcomes: [
      'Collaborate on code with confidence',
      'Set up basic CI pipelines',
      'Resolve merge conflicts easily',
    ],
    tips: [
      'Contribute to open source to practice PRs',
      'Start with simple GitHub Actions workflows',
      'Always write meaningful commit messages',
    ],
  },
  {
    id: 'containers',
    title: 'Containers',
    subtitle: 'Month 3-4',
    description: 'Learn Docker and understand containerization concepts',
    icon: Container,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-500/10 border-cyan-500/20',
    timeframe: '4-6 weeks',
    skills: [
      {
        name: 'Docker Fundamentals',
        description: 'Build, run, and manage containers with Docker',
        link: '/guides/introduction-to-docker',
        simulators: [{ name: 'Docker Terminal', link: '/games/docker-terminal-simulator' }],
        icon: Container,
        priority: 'essential',
        estimatedHours: 20,
      },
      {
        name: 'Dockerfile Best Practices',
        description: 'Write efficient, secure, and maintainable Dockerfiles',
        link: '/guides/dockerfile-best-practices',
        icon: FileText,
        priority: 'essential',
        estimatedHours: 8,
      },
      {
        name: 'Docker Compose',
        description: 'Define and run multi-container applications',
        link: '/guides/docker-compose-guide',
        icon: Server,
        priority: 'important',
        estimatedHours: 10,
      },
    ],
    project: {
      name: 'Containerized Web App',
      description: 'Containerize a web application with a database using Docker Compose',
      difficulty: 'medium',
    },
    outcomes: [
      'Containerize any application',
      'Run multi-container setups',
      'Debug container issues',
    ],
    tips: [
      'Always use official base images',
      'Keep images small and secure',
      'Practice with real applications you use',
    ],
  },
  {
    id: 'ci-cd',
    title: 'CI/CD Pipelines',
    subtitle: 'Month 4-5',
    description: 'Build automated pipelines for testing and deployment',
    icon: Workflow,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/10 border-green-500/20',
    timeframe: '4-6 weeks',
    skills: [
      {
        name: 'CI/CD Concepts',
        description: 'Understand continuous integration and delivery principles',
        link: '/guides/ci-cd-fundamentals',
        icon: Workflow,
        priority: 'essential',
        estimatedHours: 6,
      },
      {
        name: 'GitHub Actions Advanced',
        description: 'Build complete CI/CD pipelines with GitHub Actions',
        link: '/guides/github-actions-advanced',
        icon: Workflow,
        priority: 'essential',
        estimatedHours: 15,
      },
      {
        name: 'Testing in Pipelines',
        description: 'Integrate unit tests, linting, and security scans',
        link: '/guides/testing-in-ci-cd',
        icon: CheckCircle2,
        priority: 'important',
        estimatedHours: 10,
      },
    ],
    project: {
      name: 'Full CI/CD Pipeline',
      description: 'Build a pipeline that tests, builds Docker images, and deploys to staging',
      difficulty: 'medium',
    },
    outcomes: [
      'Build end-to-end CI/CD pipelines',
      'Automate testing and deployments',
      'Reduce manual deployment errors',
    ],
    tips: [
      'Start simple, then add complexity',
      'Always have a staging environment',
      'Make pipelines fast - aim for under 10 minutes',
    ],
  },
  {
    id: 'cloud',
    title: 'Cloud Basics',
    subtitle: 'Month 5-6',
    description: 'Get started with cloud platforms and core services',
    icon: Cloud,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/20',
    timeframe: '6-8 weeks',
    skills: [
      {
        name: 'Cloud Fundamentals',
        description: 'Understand cloud computing concepts, pricing, and service models',
        link: '/guides/cloud-computing-fundamentals',
        icon: Cloud,
        priority: 'essential',
        estimatedHours: 10,
      },
      {
        name: 'AWS/Azure/GCP Core Services',
        description: 'Learn compute, storage, and networking basics on your chosen platform',
        link: '/guides/aws-for-beginners',
        simulators: [{ name: 'AWS VPC', link: '/games/aws-vpc-simulator' }],
        icon: Server,
        priority: 'essential',
        estimatedHours: 25,
      },
      {
        name: 'Infrastructure as Code Basics',
        description: 'Introduction to Terraform for managing cloud resources',
        link: '/guides/introduction-to-terraform',
        icon: Code,
        priority: 'important',
        estimatedHours: 15,
      },
    ],
    project: {
      name: 'Deploy to the Cloud',
      description: 'Deploy your containerized app to a cloud platform using IaC',
      difficulty: 'medium',
    },
    outcomes: [
      'Navigate cloud consoles confidently',
      'Deploy applications to the cloud',
      'Manage cloud resources with code',
    ],
    tips: [
      'Use free tier resources for learning',
      'Pick ONE cloud provider to start',
      'Always set up billing alerts',
    ],
  },
];

