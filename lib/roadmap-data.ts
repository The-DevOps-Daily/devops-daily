// Data for the /roadmap page: the skill resources database and the
// stage-by-stage roadmap. Rendering lives in app/roadmap/page.tsx; edits to
// skills, resources, or stages happen here without touching component code.

import {
  Activity,
  Archive,
  Award,
  BookMarked,
  CheckCircle2,
  Cloud,
  Code,
  Container,
  Database,
  FileText,
  GitBranch,
  Globe,
  Heart,
  InfinityIcon,
  Lock,
  Monitor,
  Server,
  Settings,
  Shield,
  Sparkles,
  Terminal,
  TrendingUp,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export interface RoadmapSkill {
  name: string;
  link?: string;
  description?: string;
  level?: 'basic' | 'intermediate' | 'advanced';
  type?: 'tool' | 'concept' | 'practice' | 'certification';
  icon?: LucideIcon;
  external?: boolean;
}

export interface SkillResource {
  title: string;
  url: string;
  type: 'tutorial' | 'documentation' | 'course' | 'video' | 'book' | 'tool' | 'practice';
  external?: boolean;
  description?: string;
}

export interface SkillWithResources extends RoadmapSkill {
  resources?: SkillResource[];
}

// Comprehensive skill resources database
export const skillResourcesDatabase: Record<string, SkillResource[]> = {
  'Linux/Unix Basics': [
    {
      title: 'Linux Fundamentals Guide',
      url: '/guides/introduction-to-linux',
      type: 'tutorial',
      description: 'Complete guide to Linux basics and essential commands',
    },
    {
      title: 'Learn Linux - Interactive Tutorial',
      url: '/games/linux-terminal',
      type: 'practice',
      description: 'Practice Linux commands in a simulated terminal',
    },
    {
      title: 'Introduction to Linux',
      url: 'https://leanpub.com/introduction-to-linux',
      type: 'book',
      external: true,
      description: 'Comprehensive Linux fundamentals ebook on Leanpub',
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
      title: 'Introduction to Bash Scripting',
      url: 'https://github.com/bobbyiliev/introduction-to-bash-scripting',
      type: 'tutorial',
      external: true,
      description: 'Open-source bash scripting ebook on GitHub',
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
    {
      title: 'Git Concepts Simulator',
      url: '/games/git-concepts-simulator',
      type: 'practice',
      description: 'Visualize commits, branches, and merges in an interactive simulator',
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
    {
      title: 'Docker Terminal Simulator',
      url: '/games/docker-terminal-simulator',
      type: 'practice',
      description: 'Practice Docker commands in a simulated terminal',
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
    {
      title: 'Kubernetes Terminal Simulator',
      url: '/games/kubernetes-terminal-simulator',
      type: 'practice',
      description: 'Practice kubectl commands in a simulated cluster',
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
    {
      title: 'AWS VPC Simulator',
      url: '/games/aws-vpc-simulator',
      type: 'practice',
      description: 'Build and explore a VPC network layout interactively',
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
  'Networking Fundamentals': [
    {
      title: 'DNS Resolution Simulator',
      url: '/games/dns-simulator',
      type: 'practice',
      description: 'Walk through how a DNS query resolves, step by step',
    },
  ],
  'Container Networking': [
    {
      title: 'Kubernetes Network Policies Simulator',
      url: '/games/kubernetes-networking-cni-simulator',
      type: 'practice',
      description: 'See how CNI network policies allow and block pod traffic',
    },
    {
      title: 'Load Balancer Simulator',
      url: '/games/load-balancer-simulator',
      type: 'practice',
      description: 'Explore load balancing algorithms and traffic distribution',
    },
  ],
};

export interface RoadmapProject {
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  technologies: string[];
  githubUrl?: string;
  liveDemo?: string;
}

export interface CareerProgression {
  jobTitles: string[];
  salaryRange: string;
  demandLevel: 'low' | 'medium' | 'high' | 'very-high';
  nextSteps: string[];
  industryAdoption: string;
}

export interface RoadmapStage {
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

export const roadmapStages: RoadmapStage[] = [
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

