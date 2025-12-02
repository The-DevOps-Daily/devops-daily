'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ReportIssue } from '@/components/report-issue';
import { RoadmapHero } from '@/components/roadmap-hero';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Archive,
  BookOpen,
  Cloud,
  Database,
  Shield,
  Terminal,
  Workflow,
  Server,
  Container,
  Activity,
  LucideIcon,
  Sparkles,
  ChevronRight,
  Timer,
  Heart,
  Infinity as InfinityIcon,
  Users,
  Rocket,
  TrendingUp,
  Brain,
  Award,
  Zap,
  ExternalLink,
  CheckCircle2,
  PlayCircle,
  FileText,
  Code,
  Settings,
  Globe,
  Lock,
  GitBranch,
  Monitor,
  Target,
  Star,
  BookMarked,
  Video,
  Link as LinkIcon,
  Briefcase,
  DollarSign,
  Calendar,
  Clock,
  Github,
  ExternalLinkIcon,
  TrendingUpIcon,
  Building,
  GraduationCap,
  X,
} from 'lucide-react';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface RoadmapSkill {
  name: string;
  link?: string;
  description?: string;
  level?: 'basic' | 'intermediate' | 'advanced';
  type?: 'tool' | 'concept' | 'practice' | 'certification';
  icon?: LucideIcon;
  external?: boolean;
}

interface SkillResource {
  title: string;
  url: string;
  type: 'tutorial' | 'documentation' | 'course' | 'video' | 'book' | 'tool' | 'practice';
  external?: boolean;
  description?: string;
}

interface SkillWithResources extends RoadmapSkill {
  resources?: SkillResource[];
}

// Comprehensive skill resources database
const skillResourcesDatabase: Record<string, SkillResource[]> = {
  'Linux/Unix Basics': [
    {
      title: 'Linux Fundamentals Guide',
      url: '/guides/introduction-to-linux',
      type: 'tutorial',
      description: 'Complete guide to Linux basics and essential commands',
    },
    {
      title: 'Linux Command Line Tutorial',
      url: 'https://www.linuxcommand.org/',
      type: 'tutorial',
      external: true,
      description: 'Interactive command line learning',
    },
    {
      title: 'Linux Practice Labs',
      url: 'https://www.katacoda.com/courses/linux',
      type: 'practice',
      external: true,
      description: 'Hands-on Linux labs in browser',
    },
  ],
  'Shell Scripting (Bash)': [
    {
      title: 'Bash Scripting Guide',
      url: 'guides/introduction-to-bash',
      type: 'tutorial',
      description: 'Learn bash scripting from basics to advanced',
    },
    {
      title: 'Bash Scripting Tutorial',
      url: 'https://www.shellscript.sh/',
      type: 'tutorial',
      external: true,
      description: 'Comprehensive bash scripting tutorial',
    },
    {
      title: 'ShellCheck Tool',
      url: 'https://www.shellcheck.net/',
      type: 'tool',
      external: true,
      description: 'Validate and improve your shell scripts',
    },
  ],
  'Basic Programming (Python/Go)': [
    {
      title: 'Python for DevOps',
      url: 'https://docs.python.org/3/tutorial/',
      type: 'documentation',
      external: true,
      description: 'Official Python tutorial',
    },
    {
      title: 'Go by Example',
      url: 'https://gobyexample.com/',
      type: 'tutorial',
      external: true,
      description: 'Learn Go with practical examples',
    },
  ],
  'Git Version Control': [
    {
      title: 'Git Fundamentals eBook',
      url: 'https://github.com/bobbyiliev/introduction-to-git-and-github-ebook',
      type: 'book',
      external: true,
      description: 'Learn Git version control',
    },
    {
      title: 'Git Interactive Tutorial',
      url: 'https://learngitbranching.js.org/',
      type: 'practice',
      external: true,
      description: 'Visual Git learning tool',
    },
    {
      title: 'Git Command Quiz',
      url: '/quizzes/git-quiz',
      type: 'practice',
      description: 'Test your Git knowledge with interactive scenarios',
    },
  ],
  'Docker Fundamentals': [
    {
      title: 'Docker Getting Started',
      url: 'https://docs.docker.com/get-started/',
      type: 'documentation',
      external: true,
      description: 'Official Docker tutorial',
    },
    {
      title: 'Docker Deep Dive Course',
      url: '/guides/introduction-to-docker',
      type: 'course',
      description: 'Complete Docker containerization guide',
    },
    {
      title: 'Docker eBook',
      url: 'https://github.com/bobbyiliev/introduction-to-docker-ebook',
      type: 'book',
      external: true,
      description: 'Learn Docker from basics to advanced',
    },
    {
      title: 'Docker Quiz',
      url: '/quizzes/docker-quiz',
      type: 'practice',
      description: 'Test your Docker knowledge with interactive scenarios',
    },
    {
      title: 'Play with Docker',
      url: 'https://labs.play-with-docker.com/',
      type: 'practice',
      external: true,
      description: 'Free Docker playground',
    },
  ],
  'Kubernetes Basics': [
    {
      title: 'Kubernetes Basics',
      url: '/guides/introduction-to-kubernetes',
      type: 'course',
      description: 'Learn Kubernetes from scratch',
    },
    {
      title: 'Kubernetes Documentation',
      url: 'https://kubernetes.io/docs/',
      type: 'documentation',
      external: true,
      description: 'Official Kubernetes docs',
    },
    {
      title: 'Kubernetes Playground',
      url: 'https://labs.play-with-k8s.com/',
      type: 'practice',
      external: true,
      description: 'Free Kubernetes cluster for learning',
    },
  ],
  Terraform: [
    {
      title: 'Terraform Tutorials',
      url: '/categories/terraform',
      type: 'tutorial',
      description: 'Infrastructure as Code with Terraform',
    },
    {
      title: 'Terraform eBook',
      url: 'https://leanpub.com/introduction-to-terraform',
      type: 'book',
      external: true,
      description: 'Learn Terraform from basics to advanced',
    },
    {
      title: 'Terraform Documentation',
      url: 'https://developer.hashicorp.com/terraform/docs',
      type: 'documentation',
      external: true,
      description: 'Official Terraform documentation',
    },
    {
      title: 'Terraform Playground',
      url: 'https://developer.hashicorp.com/terraform/tutorials',
      type: 'practice',
      external: true,
      description: 'Hands-on Terraform tutorials',
    },
    {
      title: 'Terraform Quiz',
      url: '/quizzes/terraform-quiz',
      type: 'practice',
      description: 'Test your Terraform knowledge with interactive scenarios',
    },
  ],
  'GitHub Actions': [
    {
      title: 'CI/CD Introduction',
      url: '/guides/introduction-to-cicd',
      type: 'tutorial',
      description: 'Learn CI/CD pipeline fundamentals',
    },
    {
      title: 'GitHub Actions Guide',
      url: 'https://docs.github.com/en/actions',
      type: 'documentation',
      external: true,
      description: 'GitHub Actions documentation',
    },
    {
      title: 'CI/CD Stack Generator',
      url: '/games/cicd-stack-generator',
      type: 'tool',
      description: 'Generate your perfect CI/CD stack',
    },
  ],
  'AWS Fundamentals': [
    {
      title: 'AWS Getting Started',
      url: '/guides/introduction-to-aws',
      type: 'course',
      description: 'Learn AWS for DevOps',
    },
    {
      title: 'AWS Documentation',
      url: 'https://docs.aws.amazon.com/',
      type: 'documentation',
      external: true,
      description: 'Official AWS documentation',
    },
    {
      title: 'AWS Free Tier',
      url: 'https://aws.amazon.com/free/',
      type: 'practice',
      external: true,
      description: 'Practice with AWS free tier',
    },
  ],
  'Prometheus & Grafana': [
    {
      title: 'Prometheus Tutorial',
      url: 'https://prometheus.io/docs/prometheus/latest/getting_started/',
      type: 'tutorial',
      external: true,
      description: 'Getting started with Prometheus',
    },
    {
      title: 'Grafana Documentation',
      url: 'https://grafana.com/docs/',
      type: 'documentation',
      external: true,
      description: 'Grafana visualization platform docs',
    },
  ],
};

interface RoadmapProject {
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  technologies: string[];
  githubUrl?: string;
  liveDemo?: string;
}

interface CareerProgression {
  jobTitles: string[];
  salaryRange: string;
  demandLevel: 'low' | 'medium' | 'high' | 'very-high';
  nextSteps: string[];
  industryAdoption: string;
}

interface RoadmapStage {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  skills: RoadmapSkill[];
  timeEstimate: string;
  color?: string;
  prerequisites?: string[];
  outcomes?: string[];
  badge?: string;
  projects?: RoadmapProject[];
  careerProgression?: CareerProgression;
  marketContext?: string;
  industryStats?: string;
}

const roadmapStages: RoadmapStage[] = [
  {
    id: 'fundamentals',
    title: 'Fundamentals',
    description:
      'Build a solid foundation with essential programming and system administration skills',
    icon: Terminal,
    timeEstimate: '2-3 weeks',
    color: 'from-amber-500 via-orange-500 to-red-500',
    badge: 'Foundation',
    prerequisites: ['Basic computer literacy', 'Willingness to learn'],
    outcomes: ['Command line proficiency', 'Basic programming skills', 'System understanding'],
    marketContext:
      'Essential foundation skills required by 95% of DevOps job postings. Companies increasingly value engineers who understand both development and operations fundamentals.',
    industryStats: '🔥 Linux skills mentioned in 89% of DevOps job postings',
    careerProgression: {
      jobTitles: ['Junior DevOps Engineer', 'System Administrator', 'Platform Engineer Intern'],
      salaryRange: '$45,000 - $70,000',
      demandLevel: 'very-high',
      nextSteps: [
        'Specialize in cloud platforms',
        'Learn containerization',
        'Focus on automation tools',
      ],
      industryAdoption: 'Universal - Required by all major tech companies',
    },
    projects: [
      {
        name: 'Personal Development Environment',
        description:
          'Set up a complete development environment with Linux, Git, and basic automation scripts',
        difficulty: 'beginner',
        estimatedTime: '1-2 days',
        technologies: ['Linux', 'Git', 'Bash', 'VS Code'],
      },
      {
        name: 'System Monitoring Dashboard',
        description: 'Create Bash scripts to monitor system resources and generate reports',
        difficulty: 'intermediate',
        estimatedTime: '3-5 days',
        technologies: ['Bash', 'Cron', 'Python', 'HTML/CSS'],
      },
      {
        name: 'Automated Backup Solution',
        description: 'Build an automated backup system using shell scripts and cron jobs',
        difficulty: 'intermediate',
        estimatedTime: '2-3 days',
        technologies: ['Bash', 'Cron', 'Rsync', 'Git'],
      },
    ],
    skills: [
      {
        name: 'Linux/Unix Basics',
        description: 'Learn essential Linux commands and file system navigation',
        level: 'basic',
        type: 'concept',
        icon: Terminal,
        link: '/guides/introduction-to-linux',
      },
      {
        name: 'Shell Scripting (Bash)',
        description: 'Automate tasks with powerful shell scripts',
        level: 'basic',
        type: 'tool',
        icon: Code,
        link: '/guides/introduction-to-bash',
      },
      {
        name: 'Basic Programming (Python/Go)',
        description: 'Learn programming fundamentals with Python or Go',
        level: 'basic',
        type: 'concept',
        icon: FileText,
        link: '/guides/introduction-to-python',
      },
      {
        name: 'Networking Fundamentals',
        description: 'Understand TCP/IP, DNS, HTTP, and network protocols',
        level: 'basic',
        type: 'concept',
        icon: Globe,
        link: '/guides/networking-fundamentals',
      },
      {
        name: 'Git Version Control',
        description: 'Learn version control with Git and GitHub',
        level: 'basic',
        type: 'tool',
        icon: GitBranch,
        link: '/guides/introduction-to-git',
      },
    ],
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure as Code',
    description: 'Learn to provision and manage infrastructure through code',
    icon: Server,
    timeEstimate: '2-3 weeks',
    color: 'from-emerald-400 via-teal-500 to-cyan-600',
    badge: 'IaC Specialist',
    prerequisites: ['Linux basics', 'Basic programming'],
    outcomes: ['Infrastructure automation', 'Configuration management', 'Reproducible deployments'],
    marketContext:
      'Infrastructure as Code is a $8.4B market growing at 25% annually. Companies save 40-60% on infrastructure costs through automation.',
    industryStats: '📈 IaC skills increase salary potential by 25-40%',
    careerProgression: {
      jobTitles: [
        'Infrastructure Engineer',
        'Platform Engineer',
        'Cloud Engineer',
        'DevOps Engineer',
      ],
      salaryRange: '$75,000 - $120,000',
      demandLevel: 'very-high',
      nextSteps: [
        'Specialize in cloud platforms',
        'Learn advanced automation',
        'Focus on security',
      ],
      industryAdoption: 'Adopted by 78% of enterprises for cloud infrastructure',
    },
    projects: [
      {
        name: 'Multi-Environment Infrastructure',
        description: 'Create development, staging, and production environments using Terraform',
        difficulty: 'intermediate',
        estimatedTime: '1-2 weeks',
        technologies: ['Terraform', 'AWS/Azure', 'Ansible', 'Git'],
      },
      {
        name: 'Automated Web Application Stack',
        description:
          'Deploy a complete web application stack with load balancers, databases, and monitoring',
        difficulty: 'advanced',
        estimatedTime: '2-3 weeks',
        technologies: ['Terraform', 'Ansible', 'Nginx', 'PostgreSQL', 'Prometheus'],
      },
      {
        name: 'Infrastructure Testing Pipeline',
        description: 'Build a CI/CD pipeline that tests infrastructure changes before deployment',
        difficulty: 'advanced',
        estimatedTime: '1-2 weeks',
        technologies: ['Terraform', 'Terratest', 'GitHub Actions', 'Checkov'],
      },
    ],
    skills: [
      {
        name: 'Terraform',
        description: 'Provision cloud infrastructure with HashiCorp Terraform',
        level: 'intermediate',
        type: 'tool',
        icon: Settings,
        link: '/categories/terraform',
      },
      {
        name: 'Ansible',
        description: 'Automate configuration management and application deployment',
        level: 'intermediate',
        type: 'tool',
        icon: Settings,
        link: '/guides/introduction-to-ansible',
      },
      {
        name: 'CloudFormation',
        description: 'AWS native infrastructure as code service',
        level: 'intermediate',
        type: 'tool',
        icon: Cloud,
        link: 'https://docs.aws.amazon.com/cloudformation/',
        external: true,
      },
      {
        name: 'Configuration Management',
        description: 'Understand configuration management principles and tools',
        level: 'basic',
        type: 'concept',
        icon: Settings,
      },
      {
        name: 'Infrastructure Testing',
        description: 'Test and validate infrastructure code',
        level: 'advanced',
        type: 'practice',
        icon: CheckCircle2,
      },
    ],
  },
  {
    id: 'containers',
    title: 'Containerization & Orchestration',
    description: 'Learn container technologies and orchestration platforms',
    icon: Container,
    timeEstimate: '3-4 weeks',
    color: 'from-indigo-500 via-purple-600 to-pink-600',
    badge: 'Container Expert',
    prerequisites: ['Linux fundamentals', 'Basic networking'],
    outcomes: ['Container expertise', 'Kubernetes proficiency', 'Microservices understanding'],
    marketContext:
      'Container adoption grew 300% in the last 3 years. Kubernetes is used by 83% of container users, making it essential for modern DevOps.',
    industryStats: '🚀 Kubernetes expertise commands 30% salary premium',
    careerProgression: {
      jobTitles: [
        'Container Platform Engineer',
        'Kubernetes Administrator',
        'Site Reliability Engineer',
        'Platform Architect',
      ],
      salaryRange: '$85,000 - $140,000',
      demandLevel: 'very-high',
      nextSteps: [
        'Learn service mesh technologies',
        'Learn advanced Kubernetes patterns',
        'Focus on container security',
      ],
      industryAdoption: 'Used by 96% of organizations either in production or pilot',
    },
    projects: [
      {
        name: 'Microservices E-commerce Platform',
        description:
          'Build and deploy a complete microservices application using Docker and Kubernetes',
        difficulty: 'advanced',
        estimatedTime: '2-3 weeks',
        technologies: ['Docker', 'Kubernetes', 'Helm', 'Istio', 'PostgreSQL', 'Redis'],
      },
      {
        name: 'Container CI/CD Pipeline',
        description: 'Create a pipeline that builds, tests, and deploys containerized applications',
        difficulty: 'intermediate',
        estimatedTime: '1-2 weeks',
        technologies: ['Docker', 'GitHub Actions', 'Kubernetes', 'Harbor Registry'],
      },
      {
        name: 'Kubernetes Cluster Setup',
        description: 'Set up a production-ready Kubernetes cluster with monitoring and logging',
        difficulty: 'advanced',
        estimatedTime: '1-2 weeks',
        technologies: ['Kubernetes', 'Prometheus', 'Grafana', 'ELK Stack', 'Ingress'],
      },
    ],
    skills: [
      {
        name: 'Docker Fundamentals',
        description: 'Learn containerization with Docker',
        level: 'basic',
        type: 'tool',
        icon: Container,
        link: '/guides/introduction-to-docker',
      },
      {
        name: 'Container Networking',
        description: 'Understand how containers communicate',
        level: 'intermediate',
        type: 'concept',
        icon: Globe,
        link: 'https://devdojo.com/post/bobbyiliev/docker-networking-a-quick-guide-to-get-you-started',
        external: true,
      },
      {
        name: 'Kubernetes Basics',
        description: 'Deploy and manage applications on Kubernetes',
        level: 'intermediate',
        type: 'tool',
        icon: Settings,
        link: '/guides/introduction-to-kubernetes',
      },
      {
        name: 'Helm Charts',
        description: 'Package and deploy Kubernetes applications',
        level: 'intermediate',
        type: 'tool',
        icon: BookMarked,
        link: 'https://helm.sh/docs/',
        external: true,
      },
      {
        name: 'Container Security',
        description: 'Secure containerized applications and runtime',
        level: 'advanced',
        type: 'practice',
        icon: Shield,
        link: 'https://devdojo.com/post/bobbyiliev/5-docker-best-practices-i-wish-i-knew-when-i-started',
        external: true,
      },
    ],
  },
  {
    id: 'cicd',
    title: 'CI/CD Pipelines',
    description: 'Build automated deployment pipelines for continuous delivery',
    icon: Workflow,
    timeEstimate: '2-3 weeks',
    color: 'from-lime-400 via-green-500 to-emerald-600',
    badge: 'Pipeline Expert',
    prerequisites: ['Git version control', 'Basic containerization'],
    outcomes: ['Automated deployments', 'Testing integration', 'Release management'],
    marketContext:
      'Organizations with mature CI/CD practices deploy 46x more frequently with 96% faster recovery times. GitOps adoption increased 75% year-over-year.',
    industryStats: '⚡ Teams with CI/CD deploy 2,555x more frequently',
    careerProgression: {
      jobTitles: ['Release Engineer', 'DevOps Engineer', 'Platform Engineer', 'CI/CD Specialist'],
      salaryRange: '$80,000 - $130,000',
      demandLevel: 'very-high',
      nextSteps: [
        'Learn GitOps patterns',
        'Learn advanced testing strategies',
        'Focus on security integration',
      ],
      industryAdoption: 'Used by 87% of software organizations for faster delivery',
    },
    projects: [
      {
        name: 'Multi-Stage CI/CD Pipeline',
        description: 'Build a complete pipeline with testing, security scanning, and deployment',
        difficulty: 'intermediate',
        estimatedTime: '1-2 weeks',
        technologies: ['GitHub Actions', 'Docker', 'SonarQube', 'Kubernetes', 'ArgoCD'],
      },
      {
        name: 'GitOps Deployment System',
        description: 'Implement GitOps workflow for automated deployments with ArgoCD',
        difficulty: 'advanced',
        estimatedTime: '2-3 weeks',
        technologies: ['ArgoCD', 'Helm', 'Kubernetes', 'Git', 'Prometheus'],
      },
      {
        name: 'Blue-Green Deployment Pipeline',
        description: 'Create a zero-downtime deployment strategy with automated rollback',
        difficulty: 'advanced',
        estimatedTime: '1-2 weeks',
        technologies: ['Jenkins', 'Kubernetes', 'Helm', 'Monitoring', 'Load Balancer'],
      },
    ],
    skills: [
      {
        name: 'GitHub Actions',
        description: 'Automate workflows with GitHub Actions',
        level: 'basic',
        type: 'tool',
        icon: GitBranch,
        link: '/guides/introduction-to-cicd',
      },
      {
        name: 'Jenkins',
        description: 'Build CI/CD pipelines with Jenkins',
        level: 'intermediate',
        type: 'tool',
        icon: Workflow,
        link: 'https://www.jenkins.io/doc/pipeline/tour/getting-started/',
        external: true,
      },
      {
        name: 'GitLab CI',
        description: 'Continuous integration with GitLab',
        level: 'intermediate',
        type: 'tool',
        icon: GitBranch,
        link: 'https://docs.gitlab.com/ee/ci/',
        external: true,
      },
      {
        name: 'ArgoCD',
        description: 'GitOps continuous delivery for Kubernetes',
        level: 'advanced',
        type: 'tool',
        icon: Workflow,
        link: 'https://argo-cd.readthedocs.io/en/stable/',
        external: true,
      },
      {
        name: 'Testing Automation',
        description: 'Integrate automated testing in pipelines',
        level: 'intermediate',
        type: 'practice',
        icon: CheckCircle2,
      },
    ],
  },
  {
    id: 'cloud',
    title: 'Cloud Platforms',
    description: 'Learn major cloud service providers and their services',
    icon: Cloud,
    timeEstimate: '4-6 weeks',
    color: 'from-sky-400 via-blue-500 to-indigo-600',
    badge: 'Cloud Architect',
    prerequisites: ['Infrastructure as Code', 'Networking fundamentals'],
    outcomes: ['Multi-cloud expertise', 'Cost optimization', 'Architecture design'],
    marketContext:
      'Cloud market reached $545B in 2024. 92% of enterprises have multi-cloud strategy. AWS holds 33% market share, followed by Azure (22%) and GCP (11%).',
    industryStats: '☁️ Cloud-certified professionals earn 25% more on average',
    careerProgression: {
      jobTitles: [
        'Cloud Engineer',
        'Solutions Architect',
        'Cloud Security Engineer',
        'Principal Engineer',
      ],
      salaryRange: '$95,000 - $180,000',
      demandLevel: 'very-high',
      nextSteps: [
        'Pursue cloud certifications',
        'Specialize in cloud security',
        'Learn multi-cloud management',
      ],
      industryAdoption: 'Adopted by 94% of enterprises globally',
    },
    projects: [
      {
        name: 'Multi-Cloud Architecture',
        description: 'Design and implement an application that runs across AWS, Azure, and GCP',
        difficulty: 'advanced',
        estimatedTime: '3-4 weeks',
        technologies: ['AWS', 'Azure', 'GCP', 'Terraform', 'Kubernetes', 'Load Balancers'],
      },
      {
        name: 'Serverless Application Suite',
        description:
          'Build a complete serverless application with API Gateway, Lambda, and DynamoDB',
        difficulty: 'intermediate',
        estimatedTime: '2-3 weeks',
        technologies: ['AWS Lambda', 'API Gateway', 'DynamoDB', 'CloudFormation', 'S3'],
      },
      {
        name: 'Cost Optimization Dashboard',
        description: 'Create automated cost monitoring and optimization recommendations',
        difficulty: 'advanced',
        estimatedTime: '1-2 weeks',
        technologies: ['CloudWatch', 'AWS Cost Explorer', 'Python', 'Grafana', 'Lambda'],
      },
    ],
    skills: [
      {
        name: 'DigitalOcean',
        description: 'Cloud infrastructure and services for developers',
        level: 'basic',
        type: 'tool',
        icon: Cloud,
        link: 'https://www.digitalocean.com/docs/',
      },
      {
        name: 'AWS Fundamentals',
        description: 'Learn core AWS services and concepts',
        level: 'basic',
        type: 'tool',
        icon: Cloud,
        link: '/guides/introduction-to-aws',
      },
      {
        name: 'Azure Services',
        description: 'Microsoft Azure cloud platform essentials',
        level: 'intermediate',
        type: 'tool',
        icon: Cloud,
        link: 'https://docs.microsoft.com/en-us/azure/',
        external: true,
      },
      {
        name: 'Google Cloud Platform',
        description: 'GCP services and cloud architecture',
        level: 'intermediate',
        type: 'tool',
        icon: Cloud,
        link: 'https://cloud.google.com/docs',
        external: true,
      },
      {
        name: 'Cost Optimization',
        description: 'Optimize cloud costs and resource usage',
        level: 'intermediate',
        type: 'practice',
        icon: TrendingUp,
        link: '/guides/finops-for-devops-engineers',
      },
      {
        name: 'AWS Certified Solutions Architect',
        description: 'Professional certification for AWS',
        level: 'advanced',
        type: 'certification',
        icon: Award,
        link: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
        external: true,
      },
    ],
  },
  {
    id: 'monitoring',
    title: 'Monitoring & Observability',
    description: 'Implement comprehensive monitoring and observability solutions',
    icon: Activity,
    timeEstimate: '2-3 weeks',
    color: 'from-yellow-400 via-amber-500 to-orange-600',
    badge: 'SRE Specialist',
    prerequisites: ['Container basics', 'Cloud fundamentals'],
    outcomes: ['System visibility', 'Incident response', 'Performance optimization'],
    marketContext:
      'Observability market growing at 8.2% CAGR, reaching $1.6B by 2025. Companies with mature observability practices have 69% faster MTTR.',
    industryStats: '📊 SRE roles grew 34% year-over-year',
    careerProgression: {
      jobTitles: [
        'Site Reliability Engineer',
        'Observability Engineer',
        'Platform Reliability Engineer',
        'Principal SRE',
      ],
      salaryRange: '$105,000 - $200,000',
      demandLevel: 'very-high',
      nextSteps: [
        'Manage chaos engineering',
        'Learn advanced SLO/SLI design',
        'Specialize in distributed systems',
      ],
      industryAdoption: 'Critical for 89% of cloud-native organizations',
    },
    projects: [
      {
        name: 'Complete Observability Stack',
        description: 'Build end-to-end monitoring for a microservices application',
        difficulty: 'advanced',
        estimatedTime: '2-3 weeks',
        technologies: ['Prometheus', 'Grafana', 'Jaeger', 'ELK Stack', 'AlertManager'],
      },
      {
        name: 'SLO Monitoring Dashboard',
        description: 'Create SLI/SLO tracking with automated alerting and error budgets',
        difficulty: 'advanced',
        estimatedTime: '1-2 weeks',
        technologies: ['Prometheus', 'Grafana', 'SLO Library', 'PagerDuty', 'Kubernetes'],
      },
      {
        name: 'Performance Analysis Tool',
        description: 'Build automated performance regression detection system',
        difficulty: 'intermediate',
        estimatedTime: '1-2 weeks',
        technologies: ['Prometheus', 'Python', 'Grafana', 'Statistical Analysis', 'Alerts'],
      },
    ],
    skills: [
      {
        name: 'Prometheus & Grafana',
        description: 'Metrics collection and visualization',
        level: 'intermediate',
        type: 'tool',
        icon: Activity,
        link: 'https://www.digitalocean.com/community/developer-center/setting-up-monitoring-for-digitalocean-managed-databases-with-prometheus-and-grafana',
        external: true,
      },
      {
        name: 'ELK Stack',
        description: 'Elasticsearch, Logstash, and Kibana for logs',
        level: 'intermediate',
        type: 'tool',
        icon: FileText,
        link: 'https://www.digitalocean.com/community/tutorials/how-to-install-elasticsearch-logstash-and-kibana-elastic-stack-on-ubuntu-20-04',
        external: true,
      },
      {
        name: 'APM Tools',
        description: 'Application Performance Monitoring',
        level: 'intermediate',
        type: 'tool',
        icon: Monitor,
      },
      {
        name: 'Distributed Tracing',
        description: 'Track requests across microservices',
        level: 'advanced',
        type: 'concept',
        icon: GitBranch,
      },
    ],
  },
  {
    id: 'security',
    title: 'Security & Compliance',
    description: 'Implement DevSecOps practices and security automation',
    icon: Shield,
    timeEstimate: '3-4 weeks',
    color: 'from-rose-500 via-red-600 to-pink-700',
    badge: 'Security Champion',
    prerequisites: ['CI/CD pipelines', 'Container security basics'],
    outcomes: ['Security automation', 'Compliance management', 'Threat mitigation'],
    marketContext:
      'DevSecOps market expected to reach $23.2B by 2027. 85% of organizations plan to increase security automation investment in 2024.',
    industryStats: '🔒 DevSecOps roles increased 164% in the last 2 years',
    careerProgression: {
      jobTitles: [
        'DevSecOps Engineer',
        'Security Engineer',
        'Compliance Engineer',
        'Security Architect',
      ],
      salaryRange: '$110,000 - $190,000',
      demandLevel: 'very-high',
      nextSteps: [
        'Pursue security certifications',
        'Learn threat modeling',
        'Learn zero-trust architecture',
      ],
      industryAdoption: 'Critical priority for 76% of organizations',
    },
    projects: [
      {
        name: 'Secure CI/CD Pipeline',
        description: 'Build a pipeline with integrated security scanning and compliance checks',
        difficulty: 'advanced',
        estimatedTime: '2-3 weeks',
        technologies: ['SAST/DAST', 'Container Scanning', 'Secret Detection', 'Policy as Code'],
      },
      {
        name: 'Zero Trust Network',
        description: 'Implement zero-trust principles with service mesh and mTLS',
        difficulty: 'advanced',
        estimatedTime: '2-3 weeks',
        technologies: ['Istio', 'Cert-Manager', 'OPA Gatekeeper', 'Falco', 'Network Policies'],
      },
      {
        name: 'Compliance Automation',
        description: 'Automate compliance reporting and remediation for SOC2/GDPR',
        difficulty: 'intermediate',
        estimatedTime: '1-2 weeks',
        technologies: ['Open Policy Agent', 'Falco', 'Cloud Security Tools', 'Automation Scripts'],
      },
    ],
    skills: [
      {
        name: 'Security Scanning',
        description: 'Automated vulnerability scanning in pipelines',
        level: 'intermediate',
        type: 'tool',
        icon: Shield,
      },
      {
        name: 'Secrets Management',
        description: 'Secure handling of secrets and credentials',
        level: 'intermediate',
        type: 'practice',
        icon: Lock,
      },
      {
        name: 'RBAC & IAM',
        description: 'Role-based access control and identity management',
        level: 'intermediate',
        type: 'concept',
        icon: Users,
      },
      {
        name: 'Compliance Automation',
        description: 'Automate compliance checks and reporting',
        level: 'advanced',
        type: 'practice',
        icon: CheckCircle2,
      },
      {
        name: 'Container Security',
        description: 'Advanced container and runtime security',
        level: 'advanced',
        type: 'practice',
        icon: Container,
      },
    ],
  },
  {
    id: 'databases',
    title: 'Database Management',
    description: 'Handle data persistence, scaling, and database operations',
    icon: Database,
    timeEstimate: '2-3 weeks',
    color: 'from-violet-400 via-fuchsia-500 to-purple-700',
    badge: 'Data Engineer',
    prerequisites: ['Basic programming', 'Cloud fundamentals'],
    outcomes: ['Database expertise', 'Data reliability', 'Performance optimization'],
    marketContext:
      'Database market growing at 14% CAGR. 73% of organizations use multiple database types. Cloud databases account for 68% of new deployments.',
    industryStats: '💾 Database specialization adds $15-20k to base salary',
    careerProgression: {
      jobTitles: [
        'Database Engineer',
        'Data Platform Engineer',
        'Database Administrator',
        'Data Architect',
      ],
      salaryRange: '$85,000 - $150,000',
      demandLevel: 'high',
      nextSteps: [
        'Learn data streaming platforms',
        'Learn database security',
        'Focus on data governance',
      ],
      industryAdoption: 'Essential for 100% of data-driven organizations',
    },
    projects: [
      {
        name: 'Database Migration Pipeline',
        description: 'Automate migration from legacy systems to cloud databases',
        difficulty: 'advanced',
        estimatedTime: '2-3 weeks',
        technologies: [
          'Database Migration Service',
          'ETL Tools',
          'Monitoring',
          'Rollback Strategies',
        ],
      },
      {
        name: 'Multi-Database Architecture',
        description: 'Design polyglot persistence with different database types',
        difficulty: 'advanced',
        estimatedTime: '2-3 weeks',
        technologies: ['PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Data Sync'],
      },
      {
        name: 'Database Monitoring System',
        description: 'Build comprehensive database performance monitoring',
        difficulty: 'intermediate',
        estimatedTime: '1-2 weeks',
        technologies: ['Prometheus', 'Grafana', 'Database Exporters', 'Alert Rules'],
      },
    ],
    skills: [
      {
        name: 'SQL & NoSQL Databases',
        description: 'Work with relational and non-relational databases',
        level: 'basic',
        type: 'concept',
        icon: Database,
        link: 'https://github.com/bobbyiliev/introduction-to-sql',
        external: true,
      },
      {
        name: 'Database Automation',
        description: 'Automate database deployments and migrations',
        level: 'intermediate',
        type: 'practice',
        icon: Settings,
      },
      {
        name: 'Backup Strategies',
        description: 'Implement robust backup and recovery procedures',
        level: 'intermediate',
        type: 'practice',
        icon: Archive,
      },
      {
        name: 'Performance Tuning',
        description: 'Optimize database performance and queries',
        level: 'advanced',
        type: 'practice',
        icon: TrendingUp,
      },
      {
        name: 'Data Migration',
        description: 'Plan and execute database migrations',
        level: 'advanced',
        type: 'practice',
        icon: Workflow,
      },
    ],
  },
  {
    id: 'lifetime',
    title: 'Continuous Learning',
    description: 'Embrace lifelong learning and community contribution',
    icon: InfinityIcon,
    timeEstimate: 'Forever',
    color:
      'from-pink-400 via-rose-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-600',
    badge: 'Lifelong Learner',
    prerequisites: ['Curiosity', 'Growth mindset'],
    outcomes: ['Continuous growth', 'Community impact', 'Knowledge sharing'],
    marketContext:
      'Technology changes rapidly - 50% of skills become obsolete every 2-5 years. Continuous learners are 40% more likely to receive promotions.',
    industryStats: '🚀 Lifelong learners earn 47% more over their careers',
    careerProgression: {
      jobTitles: [
        'Senior Engineer',
        'Staff Engineer',
        'Principal Engineer',
        'Distinguished Engineer',
        'CTO',
      ],
      salaryRange: '$150,000 - $500,000+',
      demandLevel: 'very-high',
      nextSteps: [
        'Become a thought leader',
        'Mentor others',
        'Contribute to open source',
        'Speak at conferences',
      ],
      industryAdoption: 'Essential for long-term career success',
    },
    projects: [
      {
        name: 'Open Source Contribution',
        description: 'Contribute to major DevOps tools or create your own project',
        difficulty: 'advanced',
        estimatedTime: 'Ongoing',
        technologies: ['GitHub', 'Community Building', 'Documentation', 'Code Review'],
      },
      {
        name: 'Technical Blog Series',
        description: 'Share your DevOps journey and learnings through regular blog posts',
        difficulty: 'intermediate',
        estimatedTime: 'Ongoing',
        technologies: ['Writing', 'SEO', 'Community Engagement', 'Personal Branding'],
      },
      {
        name: 'Mentorship Program',
        description: 'Guide junior engineers and contribute to community growth',
        difficulty: 'intermediate',
        estimatedTime: 'Ongoing',
        technologies: ['Leadership', 'Communication', 'Knowledge Transfer', 'Career Coaching'],
      },
    ],
    skills: [
      {
        name: 'Stay Curious & Experiment',
        description: 'Always explore new technologies and approaches',
        level: 'basic',
        type: 'practice',
        icon: Sparkles,
      },
      {
        name: 'Open Source Contribution',
        description: 'Contribute to open source projects',
        level: 'intermediate',
        type: 'practice',
        icon: GitBranch,
        link: 'https://github.com/',
        external: true,
      },
      {
        name: 'Technical Writing & Blogging',
        description: 'Share knowledge through writing',
        level: 'intermediate',
        type: 'practice',
        icon: FileText,
        // link: '/posts/technical-writing-guide',
      },
      {
        name: 'Mentoring Others',
        description: 'Help others on their DevOps journey',
        level: 'advanced',
        type: 'practice',
        icon: Users,
        // link: '/posts/mentoring-in-tech',
      },
      {
        name: 'Build Side Projects',
        description: 'Create projects to learn and showcase skills',
        level: 'basic',
        type: 'practice',
        icon: Code,
        // link: '/posts/devops-project-ideas',
      },
      {
        name: 'Attend Conferences & Workshops',
        description: 'Learn from industry experts and network',
        level: 'basic',
        type: 'practice',
        icon: Users,
        // link: '/posts/devops-conferences-2024',
      },
      {
        name: 'Join DevOps Communities',
        description: 'Connect with other DevOps professionals',
        level: 'basic',
        type: 'practice',
        icon: Heart,
        // link: '/posts/devops-communities-to-join',
      },
    ],
  },
];

const SkillModal = ({
  skill,
  isOpen,
  onClose,
}: {
  skill: RoadmapSkill | null;
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!skill) return null;

  const resources = skillResourcesDatabase[skill.name] || [];

  const resourceTypeIcons = {
    tutorial: BookOpen,
    documentation: FileText,
    course: GraduationCap,
    video: Video,
    book: BookMarked,
    tool: Settings,
    practice: Target,
  };

  const resourceTypeBadges = {
    tutorial: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    documentation: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
    course: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    video: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    book: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    tool: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    practice: 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400',
  };

  const typeIcons = {
    tool: Settings,
    concept: Brain,
    practice: Target,
    certification: Award,
  };

  const levelColors = {
    basic: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    advanced: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  };

  const TypeIcon = skill.type ? typeIcons[skill.type] : Settings;
  const SkillIcon = skill.icon || TypeIcon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 border rounded-xl bg-linear-to-br from-primary/10 to-primary/5 border-primary/20">
              <SkillIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="pr-8 mb-2 text-xl font-bold">{skill.name}</DialogTitle>
              <div className="flex items-center gap-2 mb-3">
                {skill.level && (
                  <Badge variant="outline" className={cn('text-xs', levelColors[skill.level])}>
                    {skill.level}
                  </Badge>
                )}
                {skill.type && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    <TypeIcon className="w-3 h-3 mr-1" />
                    {skill.type}
                  </Badge>
                )}
              </div>
              {skill.description && (
                <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                  {skill.description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Primary Link */}
          {skill.link && (
            <div className="p-4 border rounded-lg bg-muted/30 border-border/50">
              <h4 className="flex items-center gap-2 mb-2 font-semibold">
                <Star className="w-4 h-4 text-primary" />
                Primary Resource
              </h4>
              {skill.external ? (
                <a
                  href={skill.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 transition-colors text-primary hover:text-primary/80"
                >
                  <ExternalLink className="w-4 h-4" />
                  Visit External Resource
                </a>
              ) : (
                <Link
                  href={skill.link}
                  className="flex items-center gap-2 transition-colors text-primary hover:text-primary/80"
                  onClick={onClose}
                >
                  <ChevronRight className="w-4 h-4" />
                  View Internal Guide
                </Link>
              )}
            </div>
          )}

          {/* Additional Resources */}
          {resources.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 mb-4 font-semibold">
                <BookOpen className="w-4 h-4" />
                Learning Resources ({resources.length})
              </h4>
              <div className="grid gap-3">
                {resources.map((resource, index) => {
                  const ResourceIcon = resourceTypeIcons[resource.type];
                  return (
                    <div
                      key={index}
                      className="p-4 transition-all duration-300 border rounded-lg border-border/50 hover:border-primary/50 group hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 transition-colors rounded-md bg-muted/50 group-hover:bg-primary/10">
                          <ResourceIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h5 className="font-medium transition-colors group-hover:text-primary">
                              {resource.title}
                            </h5>
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-xs shrink-0',
                                resourceTypeBadges[resource.type]
                              )}
                            >
                              {resource.type}
                            </Badge>
                          </div>
                          {resource.description && (
                            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                              {resource.description}
                            </p>
                          )}
                          {resource.external ? (
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm transition-colors text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Open Resource
                            </a>
                          ) : (
                            <Link
                              href={resource.url}
                              className="inline-flex items-center gap-1 text-sm transition-colors text-primary hover:text-primary/80"
                              onClick={onClose}
                            >
                              <ChevronRight className="w-3 h-3" />
                              View Guide
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No resources message */}
          {!skill.link && resources.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">
                Resources for this skill are coming soon! Check back later for tutorials and guides.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="absolute p-2 transition-colors rounded-md top-4 right-4 hover:bg-muted/50"
          aria-label="Close modal"
        ></button>
      </DialogContent>
    </Dialog>
  );
};

const SkillCard = ({
  skill,
  stageColor,
  onSkillClick,
}: {
  skill: RoadmapSkill;
  stageColor?: string;
  onSkillClick?: (skill: RoadmapSkill) => void;
}) => {
  const levelColors = {
    basic: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    advanced: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  };

  const typeIcons = {
    tool: Settings,
    concept: Brain,
    practice: Target,
    certification: Award,
  };

  const TypeIcon = skill.type ? typeIcons[skill.type] : Settings;
  const SkillIcon = skill.icon || TypeIcon;

  const content = (
    <div className="relative p-4 transition-all duration-300 border cursor-pointer group/skill rounded-xl border-border/50 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 bg-card/50 backdrop-blur-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'p-2 rounded-lg transition-all duration-300 group-hover/skill:scale-110',
              stageColor ? `bg-linear-to-br ${stageColor} bg-opacity-10` : 'bg-muted'
            )}
          >
            <SkillIcon className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold transition-colors group-hover/skill:text-primary">
              {skill.name}
            </h4>
            {skill.level && (
              <Badge variant="outline" className={cn('text-xs h-5 mt-1', levelColors[skill.level])}>
                {skill.level}
              </Badge>
            )}
          </div>
        </div>
        <div className="transition-opacity duration-300 opacity-0 group-hover/skill:opacity-100">
          <ChevronRight className="w-3 h-3 text-primary" />
        </div>
      </div>

      {skill.description && (
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{skill.description}</p>
      )}

      {skill.type && (
        <div className="flex items-center gap-1">
          <TypeIcon className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs capitalize text-muted-foreground">{skill.type}</span>
        </div>
      )}

      <div className="absolute inset-0 transition-opacity duration-300 opacity-0 pointer-events-none rounded-xl bg-linear-to-br from-primary/5 to-transparent group-hover/skill:opacity-100" />
    </div>
  );

  // If onSkillClick is provided, handle click to open modal
  if (onSkillClick) {
    return (
      <div onClick={() => onSkillClick(skill)} className="block">
        {content}
      </div>
    );
  }

  // Fallback to original link behavior if no modal handler
  if (skill.link) {
    if (skill.external) {
      return (
        <a href={skill.link} target="_blank" rel="noopener noreferrer" className="block">
          {content}
        </a>
      );
    } else {
      return (
        <Link href={skill.link} className="block">
          {content}
        </Link>
      );
    }
  }

  return content;
};

const CareerProgressionCard = ({
  careerProgression,
  stageColor,
}: {
  careerProgression: CareerProgression;
  stageColor?: string;
}) => {
  const demandColors = {
    low: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    'very-high': 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  };

  return (
    <div className="p-4 border rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <div
          className={cn(
            'p-2 rounded-lg',
            stageColor ? `bg-linear-to-br ${stageColor} bg-opacity-10` : 'bg-muted'
          )}
        >
          <Briefcase className="w-4 h-4" />
        </div>
        <h4 className="font-semibold">Career Progression</h4>
      </div>

      <div className="space-y-3">
        <div>
          <h5 className="mb-2 text-sm font-medium text-muted-foreground">Potential Roles</h5>
          <div className="flex flex-wrap gap-1">
            {careerProgression.jobTitles.map((title) => (
              <Badge key={title} variant="outline" className="text-xs">
                {title}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium">{careerProgression.salaryRange}</span>
          </div>
          <Badge
            variant="outline"
            className={cn('text-xs', demandColors[careerProgression.demandLevel])}
          >
            {careerProgression.demandLevel.replace('-', ' ')} demand
          </Badge>
        </div>

        <div>
          <h5 className="mb-2 text-sm font-medium text-muted-foreground">Industry Adoption</h5>
          <p className="text-xs text-muted-foreground">{careerProgression.industryAdoption}</p>
        </div>
      </div>
    </div>
  );
};

const ProjectCard = ({ project, stageColor }: { project: RoadmapProject; stageColor?: string }) => {
  const difficultyColors = {
    beginner: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    advanced: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  };

  const content = (
    <div className="p-4 transition-all duration-300 border group/project rounded-xl border-border/50 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 bg-card/50 backdrop-blur-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'p-2 rounded-lg transition-all duration-300 group-hover/project:scale-110',
              stageColor ? `bg-linear-to-br ${stageColor} bg-opacity-10` : 'bg-muted'
            )}
          >
            <Code className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold transition-colors group-hover/project:text-primary">
              {project.name}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="outline"
                className={cn('text-xs h-5', difficultyColors[project.difficulty])}
              >
                {project.difficulty}
              </Badge>
              <Badge variant="outline" className="h-5 text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {project.estimatedTime}
              </Badge>
            </div>
          </div>
        </div>
        {project.githubUrl && (
          <div className="transition-opacity duration-300 opacity-0 group-hover/project:opacity-100">
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
          </div>
        )}
      </div>

      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{project.description}</p>

      <div className="flex flex-wrap gap-1">
        {project.technologies.slice(0, 4).map((tech) => (
          <Badge key={tech} variant="secondary" className="text-xs">
            {tech}
          </Badge>
        ))}
        {project.technologies.length > 4 && (
          <Badge variant="secondary" className="text-xs">
            +{project.technologies.length - 4} more
          </Badge>
        )}
      </div>

      <div className="absolute inset-0 transition-opacity duration-300 opacity-0 pointer-events-none rounded-xl bg-linear-to-br from-primary/5 to-transparent group-hover/project:opacity-100" />
    </div>
  );

  if (project.githubUrl || project.liveDemo) {
    return (
      <a
        href={project.githubUrl || project.liveDemo}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block"
      >
        {content}
      </a>
    );
  }

  return <div className="relative">{content}</div>;
};

const MarketContextCard = ({
  marketContext,
  industryStats,
  stageColor,
}: {
  marketContext: string;
  industryStats: string;
  stageColor?: string;
}) => {
  return (
    <div className="p-4 border rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <div
          className={cn(
            'p-2 rounded-lg',
            stageColor ? `bg-linear-to-br ${stageColor} bg-opacity-10` : 'bg-muted'
          )}
        >
          <TrendingUp className="w-4 h-4" />
        </div>
        <h4 className="font-semibold">Market Context</h4>
      </div>

      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">{marketContext}</p>
        <div className="p-3 border rounded-lg bg-primary/5 border-primary/20">
          <p className="text-sm font-medium text-primary">{industryStats}</p>
        </div>
      </div>
    </div>
  );
};

export default function RoadmapPage() {
  const [selectedSkill, setSelectedSkill] = useState<RoadmapSkill | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Set document title for client component
  useEffect(() => {
    document.title = 'DevOps Roadmap | DevOps Daily';
  }, []);

  const learningStages = roadmapStages.filter((stage) => stage.id !== 'lifetime');
  const totalTime = learningStages.reduce((acc, stage) => {
    const weeks = parseInt(stage.timeEstimate.split('-')[1] || stage.timeEstimate);
    return acc + weeks;
  }, 0);

  const handleSkillClick = (skill: RoadmapSkill) => {
    setSelectedSkill(skill);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSkill(null);
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      {/* Enhanced Hero Section with Animations */}
      <RoadmapHero />

      {/* Roadmap Timeline */}
      <section id="roadmap" className="py-20">
        <div className="container px-4 mx-auto">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <Badge variant="outline" className="mb-4">
                <Brain className="w-3.5 h-3.5 mr-2" />
                Interactive Learning Path
              </Badge>
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">The Complete DevOps Journey</h2>
              <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
                Each stage includes curated resources, hands-on projects, and real-world skills you
                can practice immediately.
              </p>
            </div>

            {/* Desktop Timeline */}
            <div className="relative hidden lg:block">
              <div className="absolute w-2 h-full transform -translate-x-1/2 left-1/2">
                <div className="w-full h-full rounded-full bg-linear-to-b from-blue-500 via-purple-500 to-pink-500 opacity-20" />
                <div className="absolute inset-0 w-1 mx-auto rounded-full bg-linear-to-b from-blue-500 via-purple-500 to-pink-500 animate-pulse" />
              </div>

              {roadmapStages.map((stage, index) => (
                <div key={stage.id} className="relative mb-24">
                  {/* Timeline Icon */}
                  <div className="absolute z-10 transform -translate-x-1/2 -translate-y-1/2 left-1/2 top-8">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full border-4 border-background flex items-center justify-center transition-all duration-300 hover:scale-125',
                        stage.id === 'lifetime'
                          ? 'bg-linear-to-r from-yellow-500 via-pink-500 to-purple-500 animate-pulse'
                          : 'bg-primary shadow-lg shadow-primary/25'
                      )}
                    >
                      <stage.icon className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-2 gap-8">
                    {/* Left Side - Skills */}
                    <div className="pr-8">
                      <Card className="group hover:shadow-xl transition-all duration-500 transform hover:scale-[1.02] border-2">
                        <div
                          className={cn(
                            'absolute inset-0 rounded-lg opacity-5 transition-opacity duration-300 group-hover:opacity-10',
                            stage.color && `bg-linear-to-br ${stage.color}`
                          )}
                        />

                        <CardHeader className="relative pb-4">
                          <div className="flex items-center gap-3 mb-4">
                            <div
                              className={cn(
                                'p-3 rounded-xl transition-all duration-300 group-hover:scale-110 shadow-lg',
                                stage.id === 'lifetime'
                                  ? 'bg-linear-to-br from-yellow-500/20 via-pink-500/20 to-purple-500/20'
                                  : 'bg-muted',
                                stage.color && `bg-linear-to-br ${stage.color} bg-opacity-10`
                              )}
                            >
                              <stage.icon className="w-6 h-6" />
                            </div>
                            <div>
                              <CardTitle className="text-xl transition-colors group-hover:text-primary">
                                {stage.title}
                              </CardTitle>
                              {stage.badge && (
                                <Badge
                                  variant="outline"
                                  className="mt-1 text-xs bg-primary/10 border-primary/30 text-primary"
                                >
                                  <Star className="w-3 h-3 mr-1" />
                                  {stage.badge}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              'flex items-center gap-1 transition-all duration-300 px-3 py-1 w-fit',
                              stage.id === 'lifetime' &&
                                'bg-linear-to-r from-yellow-500 via-pink-500 to-purple-500 text-white border-none'
                            )}
                          >
                            {stage.id === 'lifetime' ? (
                              <>
                                <Heart className="w-3 h-3" />
                                {stage.timeEstimate}
                              </>
                            ) : (
                              <>
                                <Timer className="w-3 h-3" />
                                {stage.timeEstimate}
                              </>
                            )}
                          </Badge>
                          <CardDescription className="mt-2 text-sm leading-relaxed">
                            {stage.description}
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="relative">
                          {/* Skills Grid */}
                          <div>
                            <h4 className="flex items-center gap-2 mb-4 font-semibold">
                              <Target className="w-4 h-4 text-primary" />
                              Skills & Resources ({stage.skills.length})
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                              {stage.skills.map((skill) => (
                                <SkillCard
                                  key={skill.name}
                                  skill={skill}
                                  stageColor={stage.color}
                                  onSkillClick={handleSkillClick}
                                />
                              ))}
                            </div>
                          </div>

                          {stage.id === 'lifetime' && (
                            <div className="pt-6 mt-6 border-t">
                              <p className="text-sm italic text-muted-foreground">
                                "The capacity to learn is a gift; the ability to learn is a skill;
                                the willingness to learn is a choice."
                                <span className="block mt-2 font-semibold text-right">
                                  - Brian Herbert
                                </span>
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Right Side - Projects, Career, Context */}
                    <div className="pl-8">
                      <div className="space-y-6">
                        {/* Market Context */}
                        {stage.marketContext && stage.industryStats && (
                          <MarketContextCard
                            marketContext={stage.marketContext}
                            industryStats={stage.industryStats}
                            stageColor={stage.color}
                          />
                        )}

                        {/* Prerequisites */}
                        {stage.prerequisites && stage.prerequisites.length > 0 && (
                          <Card className="border-blue-200/50 dark:border-blue-800/50">
                            <CardContent className="p-4 bg-blue-50 dark:bg-blue-950/20">
                              <h4 className="flex items-center gap-2 mb-3 text-sm font-semibold text-blue-700 dark:text-blue-300">
                                <CheckCircle2 className="w-4 h-4" />
                                Prerequisites
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {stage.prerequisites.map((prereq) => (
                                  <Badge
                                    key={prereq}
                                    variant="outline"
                                    className="text-xs text-blue-700 bg-blue-100 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300"
                                  >
                                    {prereq}
                                  </Badge>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Career Progression */}
                        {stage.careerProgression && (
                          <CareerProgressionCard
                            careerProgression={stage.careerProgression}
                            stageColor={stage.color}
                          />
                        )}

                        {/* Projects */}
                        {stage.projects && stage.projects.length > 0 && (
                          <Card>
                            <CardHeader className="pb-3">
                              <h4 className="flex items-center gap-2 font-semibold">
                                <Code className="w-4 h-4 text-primary" />
                                Hands-on Projects ({stage.projects.length})
                              </h4>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="grid grid-cols-1 gap-3">
                                {stage.projects.map((project) => (
                                  <ProjectCard
                                    key={project.name}
                                    project={project}
                                    stageColor={stage.color}
                                  />
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Outcomes */}
                        {stage.outcomes && stage.outcomes.length > 0 && (
                          <Card className="border-green-200/50 dark:border-green-800/50">
                            <CardContent className="p-4 bg-green-50 dark:bg-green-950/20">
                              <h4 className="flex items-center gap-2 mb-3 text-sm font-semibold text-green-700 dark:text-green-300">
                                <Award className="w-4 h-4" />
                                Learning Outcomes
                              </h4>
                              <ul className="space-y-2">
                                {stage.outcomes.map((outcome) => (
                                  <li
                                    key={outcome}
                                    className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300"
                                  >
                                    <CheckCircle2 className="shrink-0 w-3 h-3" />
                                    {outcome}
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Timeline */}
            <div className="space-y-12 lg:hidden">
              {roadmapStages.map((stage, index) => (
                <div key={stage.id} className="relative">
                  {index < roadmapStages.length - 1 && (
                    <div className="absolute w-1 h-12 rounded-full top-full left-8 bg-linear-to-b from-primary/50 to-primary/20" />
                  )}

                  <Card
                    className={cn(
                      'group hover:shadow-xl transition-all duration-300 border-2',
                      stage.id === 'lifetime' &&
                        'border-gradient-to-r from-yellow-500 via-pink-500 to-purple-500 shadow-xl shadow-primary/10'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute inset-0 rounded-lg opacity-5 transition-opacity duration-300 group-hover:opacity-10',
                        stage.color && `bg-linear-to-br ${stage.color}`
                      )}
                    />

                    <CardHeader className="relative pb-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'p-3 rounded-lg transition-all duration-300',
                              stage.id === 'lifetime'
                                ? 'bg-linear-to-br from-yellow-500/20 via-pink-500/20 to-purple-500/20'
                                : 'bg-muted'
                            )}
                          >
                            <stage.icon className="w-6 h-6" />
                          </div>
                          <div>
                            <CardTitle className="text-xl">{stage.title}</CardTitle>
                            {stage.badge && (
                              <Badge
                                variant="outline"
                                className="mt-1 text-xs bg-primary/10 border-primary/30 text-primary"
                              >
                                <Star className="w-3 h-3 mr-1" />
                                {stage.badge}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'flex items-center gap-1',
                            stage.id === 'lifetime' &&
                              'bg-linear-to-r from-yellow-500 via-pink-500 to-purple-500 text-white border-none'
                          )}
                        >
                          {stage.id === 'lifetime' ? (
                            <>
                              <Heart className="w-3 h-3" />
                              {stage.timeEstimate}
                            </>
                          ) : (
                            <>
                              <Timer className="w-3 h-3" />
                              {stage.timeEstimate}
                            </>
                          )}
                        </Badge>
                      </div>
                      <CardDescription>{stage.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="relative">
                      {/* Market Context */}
                      {stage.marketContext && stage.industryStats && (
                        <div className="mb-4">
                          <MarketContextCard
                            marketContext={stage.marketContext}
                            industryStats={stage.industryStats}
                            stageColor={stage.color}
                          />
                        </div>
                      )}

                      {/* Prerequisites */}
                      {stage.prerequisites && stage.prerequisites.length > 0 && (
                        <div className="p-3 mb-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/50">
                          <h4 className="flex items-center gap-2 mb-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                            <CheckCircle2 className="w-4 h-4" />
                            Prerequisites
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {stage.prerequisites.map((prereq) => (
                              <Badge
                                key={prereq}
                                variant="outline"
                                className="text-xs text-blue-700 bg-blue-100 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300"
                              >
                                {prereq}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Career Progression */}
                      {stage.careerProgression && (
                        <div className="mb-4">
                          <CareerProgressionCard
                            careerProgression={stage.careerProgression}
                            stageColor={stage.color}
                          />
                        </div>
                      )}

                      {/* Skills */}
                      <div className="mb-4">
                        <h4 className="flex items-center gap-2 mb-3 font-semibold">
                          <Target className="w-4 h-4 text-primary" />
                          Skills & Resources ({stage.skills.length})
                        </h4>
                        <div className="space-y-2">
                          {stage.skills.map((skill) => (
                            <SkillCard
                              key={skill.name}
                              skill={skill}
                              stageColor={stage.color}
                              onSkillClick={handleSkillClick}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Projects */}
                      {stage.projects && stage.projects.length > 0 && (
                        <div className="mb-4">
                          <h4 className="flex items-center gap-2 mb-3 font-semibold">
                            <Code className="w-4 h-4 text-primary" />
                            Projects ({stage.projects.length})
                          </h4>
                          <div className="space-y-2">
                            {stage.projects.map((project) => (
                              <ProjectCard
                                key={project.name}
                                project={project}
                                stageColor={stage.color}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Outcomes */}
                      {stage.outcomes && stage.outcomes.length > 0 && (
                        <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200/50 dark:border-green-800/50">
                          <h4 className="flex items-center gap-2 mb-2 text-sm font-semibold text-green-700 dark:text-green-300">
                            <Award className="w-4 h-4" />
                            Learning Outcomes
                          </h4>
                          <ul className="space-y-1">
                            {stage.outcomes.map((outcome) => (
                              <li
                                key={outcome}
                                className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                {outcome}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {stage.id === 'lifetime' && (
                        <div className="pt-4 mt-4 border-t">
                          <p className="text-sm italic text-muted-foreground">
                            "The capacity to learn is a gift; the ability to learn is a skill; the
                            willingness to learn is a choice."
                            <span className="block mt-2 font-semibold text-right">
                              - Brian Herbert
                            </span>
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
            <div className="mt-16 mb-8 text-center">
              <div className="max-w-2xl p-6 mx-auto border rounded-lg bg-muted/30 border-muted-foreground/10">
                <p className="text-sm italic leading-relaxed text-muted-foreground">
                  <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/40 mr-2 mb-0.5"></span>
                  Salary ranges and demand levels reflect US market averages and may vary by region.
                </p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <div className="max-w-2xl mx-auto rounded-lg">
                <ReportIssue
                  title="Found an issue with the roadmap?"
                  type="page"
                  slug="roadmap"
                  variant="default"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-linear-to-b from-background via-muted/20 to-background">
        <div>
          <div>
            <Card className="border-0 shadow-2xl bg-linear-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <Sparkles className="w-12 h-12 mx-auto mb-6 text-yellow-500 animate-pulse" />

                <h2 className="mb-6 text-3xl font-bold text-transparent md:text-4xl bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text">
                  Ready to Begin Your DevOps Journey?
                </h2>

                <p className="max-w-2xl mx-auto mb-8 text-xl text-muted-foreground">
                  Join thousands of engineers who are learning DevOps with our interactive learning
                  resources and hands-on guides.
                </p>

                <div className="flex flex-wrap justify-center gap-4 mb-8">
                  <Button
                    asChild
                    size="lg"
                    className="transition-all duration-300 transform shadow-lg bg-linear-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 hover:scale-105"
                  >
                    <Link href="/guides">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Browse Learning Resources
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="transition-all duration-300 border-2 shadow-md hover:shadow-lg"
                  >
                    <Link href="/posts">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Read Latest Articles
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="transition-all duration-300 border-2 shadow-md hover:shadow-lg"
                  >
                    <Link href="/games">
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Practice with Quizzes
                    </Link>
                  </Button>
                </div>

                <Separator className="my-8" />

                <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span>Updated Weekly</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span>Community Driven</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-500" />
                    <span>Industry Recognized</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Skill Modal */}
      <SkillModal skill={selectedSkill} isOpen={isModalOpen} onClose={handleCloseModal} />
    </div>
  );
}
