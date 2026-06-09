// Data for the /roadmap/devsecops page: milestone and skill definitions.
// Rendering lives in app/roadmap/devsecops/page.tsx.

import {
  AlertTriangle,
  Bug,
  Cloud,
  Code,
  Container,
  Database,
  Eye,
  FileSearch,
  FileText,
  Fingerprint,
  GitBranch,
  Globe,
  Key,
  Lock,
  Network,
  Scan,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Target,
  Terminal,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export interface DevSecOpsSkill {
  name: string;
  description: string;
  link?: string;
  simulators?: { name: string; link: string }[];
  external?: boolean;
  icon: LucideIcon;
  priority: 'essential' | 'important' | 'nice-to-have';
  estimatedHours: number;
}

export interface DevSecOpsMilestone {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  timeframe: string;
  skills: DevSecOpsSkill[];
  project: {
    name: string;
    description: string;
    difficulty: 'easy' | 'medium' | 'hard';
  };
  outcomes: string[];
  tips: string[];
}

export const milestones: DevSecOpsMilestone[] = [
  {
    id: 'security-fundamentals',
    title: 'Security Fundamentals',
    subtitle: 'Month 1-2',
    description: 'Build your security foundation with core concepts and threat modeling',
    icon: Shield,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/20',
    timeframe: '6-8 weeks',
    skills: [
      {
        name: 'Security Principles',
        description: 'Learn CIA triad, defense in depth, least privilege, and zero trust concepts',
        icon: Shield,
        priority: 'essential',
        estimatedHours: 15,
        link: '/guides/security-principles',
      },
      {
        name: 'OWASP Top 10',
        description: 'Understand the most critical web application security risks',
        icon: AlertTriangle,
        priority: 'essential',
        estimatedHours: 20,
        link: '/guides/owasp-top-10',
     },
     {
       name: 'Threat Modeling',
       description: 'Learn STRIDE, DREAD, and attack tree methodologies',
       icon: Bug,
       priority: 'important',
       estimatedHours: 15,
        link: '/guides/threat-modeling',
     },
     {
        name: 'Linux Security Basics',
        description: 'File permissions, user management, SSH hardening, and firewall basics',
        link: '/checklists/ssh-hardening',
        simulators: [{ name: 'Linux Terminal', link: '/games/linux-terminal' }],
        icon: Terminal,
        priority: 'essential',
        estimatedHours: 20,
      },
      {
       name: 'Cryptography Essentials',
       description: 'Symmetric/asymmetric encryption, hashing, TLS/SSL, and PKI basics',
       icon: Key,
       priority: 'important',
       estimatedHours: 15,
       link: '/guides/cryptography-essentials',
     },
    ],
    project: {
      name: 'Security Assessment Report',
      description: 'Perform a basic security assessment on a sample application using OWASP guidelines',
      difficulty: 'easy',
    },
    outcomes: [
      'Identify common security vulnerabilities',
      'Apply security principles to system design',
      'Conduct basic threat modeling sessions',
      'Understand encryption and authentication mechanisms',
    ],
    tips: [
      'Practice on intentionally vulnerable apps like DVWA or Juice Shop',
      'Join security communities like OWASP local chapters',
      'Read security breach post-mortems to learn from real incidents',
    ],
  },
  {
    id: 'secure-development',
    title: 'Secure Development',
    subtitle: 'Month 2-3',
    description: 'Shift security left by integrating security into the development process',
    icon: Code,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500/10 border-orange-500/20',
    timeframe: '6-8 weeks',
    skills: [
      {
        name: 'Secure Coding Practices',
        description: 'Input validation, output encoding, parameterized queries, and error handling',
        icon: Code,
        priority: 'essential',
        estimatedHours: 25,
        link: '/posts/secure-coding-practices-guide',
      },
     {
       name: 'SAST Tools',
       description: 'Static Application Security Testing with SonarQube, Semgrep, or CodeQL',
       icon: FileSearch,
       priority: 'essential',
       estimatedHours: 20,
       link: '/guides/sast-tools',
     },
      {
        name: 'Dependency Scanning',
        description: 'Find vulnerable dependencies with Dependabot, Snyk, or OWASP Dependency-Check',
        icon: Scan,
        priority: 'essential',
        estimatedHours: 10,
       link: '/posts/dependency-scanning-guide',
      },
      {
        name: 'Pre-commit Hooks',
        description: 'Implement security checks before code is committed using git hooks',
        icon: GitBranch,
        priority: 'important',
        estimatedHours: 8,
        link: '/posts/pre-commit-hooks-security-guide',
      },
      {
        name: 'Code Review for Security',
        description: 'Learn to identify security issues during code reviews',
        icon: Eye,
        priority: 'important',
        estimatedHours: 15,
        link: '/posts/security-focused-code-reviews',
      },
    ],
    project: {
      name: 'Secure Code Pipeline',
      description: 'Set up a CI pipeline with SAST, dependency scanning, and pre-commit security hooks',
      difficulty: 'medium',
    },
    outcomes: [
      'Write secure code following best practices',
      'Configure and interpret SAST tool results',
      'Manage vulnerable dependencies effectively',
      'Conduct security-focused code reviews',
    ],
    tips: [
      'Start with one SAST tool and learn it deeply before adding more',
      'Focus on reducing false positives to maintain developer trust',
      'Create security champions in each development team',
    ],
  },
  {
    id: 'pipeline-security',
    title: 'CI/CD Security',
    subtitle: 'Month 3-4',
    description: 'Secure your build and deployment pipelines from threats',
    icon: Workflow,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-500/10 border-yellow-500/20',
    timeframe: '6-8 weeks',
    skills: [
      {
       name: 'Pipeline Hardening',
       description: 'Secure CI/CD configurations, runner isolation, and artifact signing',
        link: '/posts/cicd-pipeline-hardening-guide',
       icon: Workflow,
       priority: 'essential',
        estimatedHours: 20,
      },
      {
        name: 'Secrets Management',
        description: 'HashiCorp Vault, AWS Secrets Manager, or Azure Key Vault for secure secrets',
        icon: Key,
        priority: 'essential',
        estimatedHours: 25,
        link: '/posts/secrets-management-guide',
      },
      {
        name: 'DAST Integration',
        description: 'Dynamic Application Security Testing with OWASP ZAP or Burp Suite',
        icon: Bug,
        priority: 'important',
        estimatedHours: 20,
        link: '/posts/dast-integration-guide',
      },
      {
        name: 'Supply Chain Security',
        description: 'SBOM generation, artifact verification, and Sigstore/cosign',
        icon: Network,
       priority: 'important',
       estimatedHours: 15,
       link: '/posts/software-supply-chain-security',
     },
     {
        name: 'Security Gates',
        description: 'Implement quality gates that block deployments on security failures',
        icon: ShieldAlert,
        priority: 'essential',
        estimatedHours: 10,
        link: '/guides/security-gates',
      },
    ],
    project: {
      name: 'Secure CI/CD Pipeline',
      description: 'Build a complete pipeline with secrets management, DAST, and security gates',
      difficulty: 'medium',
    },
    outcomes: [
      'Design and implement secure CI/CD pipelines',
      'Manage secrets without hardcoding them',
      'Integrate dynamic security testing into deployments',
      'Generate and verify software bills of materials',
    ],
    tips: [
      'Treat pipeline configurations as code - version control and review them',
      'Never store secrets in environment variables visible in logs',
      'Use ephemeral build environments when possible',
    ],
  },
  {
    id: 'container-security',
    title: 'Container Security',
    subtitle: 'Month 4-5',
    description: 'Secure containerized applications from build to runtime',
    icon: Container,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    timeframe: '6-8 weeks',
    skills: [
      {
        name: 'Image Security',
        description: 'Build minimal images, scan with Trivy/Grype, and use trusted base images',
        link: '/checklists/docker-security',
        icon: Container,
        priority: 'essential',
        estimatedHours: 20,
      },
      {
        name: 'Container Runtime Security',
        description: 'Seccomp, AppArmor, read-only filesystems, and non-root users',
        icon: Lock,
        priority: 'essential',
        estimatedHours: 20,
      },
      {
        name: 'Kubernetes Security',
        description: 'RBAC, Network Policies, Pod Security Standards, and admission controllers',
        link: '/checklists/kubernetes-security',
        simulators: [
          { name: 'Kubernetes Terminal', link: '/games/kubernetes-terminal-simulator' },
          { name: 'K8s Network Policies', link: '/games/kubernetes-networking-cni-simulator' },
        ],
        icon: Server,
        priority: 'essential',
        estimatedHours: 30,
      },
      {
        name: 'Runtime Threat Detection',
        description: 'Falco, Sysdig, or Aqua for detecting anomalous container behavior',
        icon: Eye,
        priority: 'important',
        estimatedHours: 15,
      },
      {
        name: 'Service Mesh Security',
        description: 'mTLS, authorization policies, and traffic encryption with Istio or Linkerd',
        simulators: [{ name: 'Service Mesh', link: '/games/service-mesh-simulator' }],
        icon: Network,
        priority: 'nice-to-have',
        estimatedHours: 20,
      },
    ],
    project: {
      name: 'Secure Kubernetes Deployment',
      description: 'Deploy an application to Kubernetes with all security best practices implemented',
      difficulty: 'hard',
    },
    outcomes: [
      'Build and scan secure container images',
      'Implement container runtime hardening',
      'Configure Kubernetes security controls',
      'Monitor containers for security threats',
    ],
    tips: [
      'Start with Pod Security Standards before implementing custom policies',
      'Use distroless or scratch base images for production',
      'Implement network policies even in development environments',
    ],
  },
  {
    id: 'cloud-security',
    title: 'Cloud Security',
    subtitle: 'Month 5-6',
    description: 'Secure cloud infrastructure and implement cloud-native security controls',
    icon: Cloud,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/20',
    timeframe: '6-8 weeks',
    skills: [
      {
        name: 'IAM Best Practices',
        description: 'Least privilege, role-based access, and identity federation',
        link: '/checklists/aws-security',
        simulators: [{ name: 'OAuth / OIDC Flow', link: '/games/oauth-oidc-flow-simulator' }],
        icon: Fingerprint,
        priority: 'essential',
        estimatedHours: 25,
      },
      {
        name: 'Infrastructure as Code Security',
        description: 'Scan Terraform/CloudFormation with Checkov, tfsec, or KICS',
        icon: FileText,
        priority: 'essential',
        estimatedHours: 15,
      },
      {
        name: 'Cloud Security Posture',
        description: 'CSPM tools like Prowler, ScoutSuite, or cloud-native solutions',
        icon: ShieldCheck,
        priority: 'important',
        estimatedHours: 20,
      },
      {
        name: 'Data Protection',
        description: 'Encryption at rest/in transit, key management, and data classification',
        icon: Database,
        priority: 'essential',
        estimatedHours: 15,
      },
      {
        name: 'Network Security',
        description: 'VPCs, security groups, WAF, and DDoS protection',
        simulators: [
          { name: 'DDoS Defense', link: '/games/ddos-simulator' },
          { name: 'Rate Limiting', link: '/games/rate-limit-simulator' },
        ],
        icon: Globe,
        priority: 'important',
        estimatedHours: 20,
      },
    ],
    project: {
      name: 'Secure Cloud Architecture',
      description: 'Design and implement a secure multi-tier cloud architecture following Well-Architected Framework',
      difficulty: 'hard',
    },
    outcomes: [
      'Design IAM policies following least privilege',
      'Scan infrastructure code for security issues',
      'Implement cloud security monitoring and compliance',
      'Secure data in cloud environments',
    ],
    tips: [
      'Get certified in your primary cloud provider (AWS/Azure/GCP)',
      'Use infrastructure as code for all cloud resources',
      'Enable CloudTrail/Activity Logs from day one',
    ],
  },
  {
    id: 'security-operations',
    title: 'Security Operations',
    subtitle: 'Month 6-7',
    description: 'Monitor, detect, and respond to security incidents effectively',
    icon: Eye,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/10 border-green-500/20',
    timeframe: '6-8 weeks',
    skills: [
      {
        name: 'Security Monitoring',
        description: 'SIEM concepts, log aggregation, and security dashboards',
        link: '/checklists/monitoring-observability',
        icon: Eye,
        priority: 'essential',
        estimatedHours: 25,
      },
      {
        name: 'Incident Response',
        description: 'IR playbooks, containment strategies, and post-incident reviews',
        icon: AlertTriangle,
        priority: 'essential',
        estimatedHours: 20,
      },
      {
        name: 'Vulnerability Management',
        description: 'Vulnerability scanning, prioritization, and remediation workflows',
        icon: Bug,
        priority: 'essential',
        estimatedHours: 15,
      },
      {
        name: 'Compliance Automation',
        description: 'Automate compliance checks for SOC2, PCI-DSS, HIPAA, or ISO 27001',
        icon: FileText,
        priority: 'important',
        estimatedHours: 20,
      },
      {
        name: 'Security Metrics',
        description: 'Track MTTD, MTTR, vulnerability counts, and security debt',
        icon: Target,
        priority: 'important',
        estimatedHours: 10,
      },
    ],
    project: {
      name: 'Security Operations Center',
      description: 'Set up monitoring, alerting, and incident response procedures for a production environment',
      difficulty: 'hard',
    },
    outcomes: [
      'Set up centralized security monitoring',
      'Create and execute incident response plans',
      'Manage vulnerabilities across the organization',
      'Track and report on security metrics',
    ],
    tips: [
      'Start small - you cannot monitor everything from day one',
      'Practice incident response with tabletop exercises',
      'Build relationships with development teams, not walls',
    ],
  },
];

