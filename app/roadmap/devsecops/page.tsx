'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ReportIssue } from '@/components/report-issue';
import {
  Shield,
  Lock,
  Key,
  Bug,
  Scan,
  AlertTriangle,
  Eye,
  FileSearch,
  Server,
  Container,
  Cloud,
  GitBranch,
  Workflow,
  Terminal,
  BookOpen,
  CheckCircle2,
  Clock,
  Target,
  Lightbulb,
  Rocket,
  ChevronRight,
  ExternalLink,
  Star,
  Heart,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Trophy,
  MapPin,
  PlayCircle,
  FileText,
  Code,
  Globe,
  LucideIcon,
  ShieldAlert,
  Network,
  Database,
  Fingerprint,
} from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface DevSecOpsSkill {
  name: string;
  description: string;
  link?: string;
  external?: boolean;
  icon: LucideIcon;
  priority: 'essential' | 'important' | 'nice-to-have';
  estimatedHours: number;
}

interface DevSecOpsMilestone {
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

const milestones: DevSecOpsMilestone[] = [
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
        link: '/guides/secure-coding-practices',
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
       link: '/guides/dependency-scanning',
      },
      {
        name: 'Pre-commit Hooks',
        description: 'Implement security checks before code is committed using git hooks',
        icon: GitBranch,
        priority: 'important',
        estimatedHours: 8,
        link: '/guides/pre-commit-hooks',
      },
      {
        name: 'Code Review for Security',
        description: 'Learn to identify security issues during code reviews',
        icon: Eye,
        priority: 'important',
        estimatedHours: 15,
        link: '/guides/code-review-security',
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
        link: '/guides/pipeline-hardening',
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
        link: '/guides/secrets-management',
      },
      {
        name: 'DAST Integration',
        description: 'Dynamic Application Security Testing with OWASP ZAP or Burp Suite',
        icon: Bug,
        priority: 'important',
        estimatedHours: 20,
      },
      {
        name: 'Supply Chain Security',
        description: 'SBOM generation, artifact verification, and Sigstore/cosign',
        icon: Network,
        priority: 'important',
        estimatedHours: 15,
      },
      {
        name: 'Security Gates',
        description: 'Implement quality gates that block deployments on security failures',
        icon: ShieldAlert,
        priority: 'essential',
        estimatedHours: 10,
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

const priorityColors = {
  essential: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  important: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'nice-to-have': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const difficultyColors = {
  easy: 'text-green-600 dark:text-green-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  hard: 'text-red-600 dark:text-red-400',
};

export default function DevSecOpsRoadmapPage() {
  const [expandedMilestones, setExpandedMilestones] = useState<string[]>(['security-fundamentals']);
  const [completedSkills, setCompletedSkills] = useState<Set<string>>(new Set());

  const toggleMilestone = (id: string) => {
    setExpandedMilestones((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const toggleSkill = (milestoneId: string, skillName: string) => {
    const key = `${milestoneId}-${skillName}`;
    setCompletedSkills((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const getTotalProgress = () => {
    const totalSkills = milestones.reduce((acc, m) => acc + m.skills.length, 0);
    return Math.round((completedSkills.size / totalSkills) * 100);
  };

  const getMilestoneProgress = (milestone: DevSecOpsMilestone) => {
    const completed = milestone.skills.filter((s) =>
      completedSkills.has(`${milestone.id}-${s.name}`)
    ).length;
    return Math.round((completed / milestone.skills.length) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-purple-500/5" />
        <div className="container mx-auto px-4 max-w-6xl relative">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-sm font-medium">
              <ShieldCheck className="h-4 w-4" />
              <span>Security-First DevOps</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              DevSecOps{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-purple-500">
                Roadmap
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Master the art of integrating security into every stage of the software development
              lifecycle. Shift left, automate security, and build resilient systems.
            </p>

            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Badge variant="outline" className="px-3 py-1">
                <Clock className="h-3 w-3 mr-1" />
                6-7 Months
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                <Target className="h-3 w-3 mr-1" />
                6 Milestones
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                <Shield className="h-3 w-3 mr-1" />
                30+ Security Skills
              </Badge>
            </div>

            {/* Progress Overview */}
            <div className="max-w-md mx-auto pt-8">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Your Progress</span>
                <span className="font-medium">{getTotalProgress()}%</span>
              </div>
              <Progress value={getTotalProgress()} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Click on skills to mark them as completed
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Principles */}
      <section className="py-12 container mx-auto px-4 max-w-6xl">
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ArrowRight className="h-5 w-5 text-red-500" />
                Shift Left
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Integrate security early in the development process to catch vulnerabilities before
                they reach production.
              </p>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-purple-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Workflow className="h-5 w-5 text-purple-500" />
                Automate Everything
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Embed security checks into CI/CD pipelines for consistent, repeatable security
                validation.
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="h-5 w-5 text-blue-500" />
                Continuous Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Monitor, detect, and respond to security threats in real-time across your entire
                infrastructure.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Milestones */}
      <section className="py-12 container mx-auto px-4 max-w-6xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
          Your DevSecOps Journey
        </h2>

        <div className="space-y-6">
          {milestones.map((milestone, index) => {
            const isExpanded = expandedMilestones.includes(milestone.id);
            const progress = getMilestoneProgress(milestone);
            const Icon = milestone.icon;

            return (
              <Card
                key={milestone.id}
                className={cn('transition-all duration-300', milestone.bgColor)}
              >
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => toggleMilestone(milestone.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'p-3 rounded-xl',
                          milestone.bgColor.replace('border', 'bg')
                        )}
                      >
                        <Icon className={cn('h-6 w-6', milestone.color)} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xl">{milestone.title}</CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {milestone.subtitle}
                          </Badge>
                        </div>
                        <CardDescription className="mt-1">
                          {milestone.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <div className="text-sm font-medium">{progress}%</div>
                        <div className="text-xs text-muted-foreground">
                          {milestone.skills.filter((s) =>
                            completedSkills.has(`${milestone.id}-${s.name}`)
                          ).length}
                          /{milestone.skills.length} skills
                        </div>
                      </div>
                      <ChevronRight
                        className={cn(
                          'h-5 w-5 transition-transform',
                          isExpanded && 'rotate-90'
                        )}
                      />
                    </div>
                  </div>
                  <Progress value={progress} className="h-1 mt-4" />
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="grid lg:grid-cols-3 gap-6">
                      {/* Skills */}
                      <div className="lg:col-span-2 space-y-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Skills to Learn
                        </h4>
                        <div className="space-y-2">
                          {milestone.skills.map((skill) => {
                            const isCompleted = completedSkills.has(
                              `${milestone.id}-${skill.name}`
                            );
                            const SkillIcon = skill.icon;

                            return (
                              <div
                                key={skill.name}
                                className={cn(
                                  'p-3 rounded-lg border bg-background/50 cursor-pointer transition-all',
                                  isCompleted && 'bg-green-500/10 border-green-500/30'
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSkill(milestone.id, skill.name);
                                }}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={cn(
                                      'p-1.5 rounded-md',
                                      isCompleted
                                        ? 'bg-green-500/20'
                                        : 'bg-muted'
                                    )}
                                  >
                                    {isCompleted ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <SkillIcon className="h-4 w-4" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className={cn(
                                          'font-medium',
                                          isCompleted && 'line-through opacity-70'
                                        )}
                                      >
                                        {skill.name}
                                      </span>
                                      <Badge
                                        className={cn(
                                          'text-xs',
                                          priorityColors[skill.priority]
                                        )}
                                      >
                                        {skill.priority}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        ~{skill.estimatedHours}h
                                      </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {skill.description}
                                    </p>
                                    {skill.link && (
                                      <Link
                                        href={skill.link}
                                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <PlayCircle className="h-3 w-3" />
                                        Learn more
                                        {skill.external && (
                                          <ExternalLink className="h-3 w-3" />
                                        )}
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Sidebar */}
                      <div className="space-y-4">
                        {/* Project */}
                        <div className="p-4 rounded-lg border bg-background/50">
                          <h4 className="font-semibold flex items-center gap-2 mb-2">
                            <Rocket className="h-4 w-4" />
                            Milestone Project
                          </h4>
                          <p className="font-medium text-sm">{milestone.project.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {milestone.project.description}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn('mt-2', difficultyColors[milestone.project.difficulty])}
                          >
                            {milestone.project.difficulty}
                          </Badge>
                        </div>

                        {/* Outcomes */}
                        <div className="p-4 rounded-lg border bg-background/50">
                          <h4 className="font-semibold flex items-center gap-2 mb-2">
                            <Target className="h-4 w-4" />
                            Outcomes
                          </h4>
                          <ul className="space-y-1">
                            {milestone.outcomes.map((outcome) => (
                              <li
                                key={outcome}
                                className="text-xs text-muted-foreground flex items-start gap-2"
                              >
                                <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                                {outcome}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Tips */}
                        <div className="p-4 rounded-lg border bg-background/50">
                          <h4 className="font-semibold flex items-center gap-2 mb-2">
                            <Lightbulb className="h-4 w-4 text-yellow-500" />
                            Pro Tips
                          </h4>
                          <ul className="space-y-1">
                            {milestone.tips.map((tip) => (
                              <li
                                key={tip}
                                className="text-xs text-muted-foreground flex items-start gap-2"
                              >
                                <Star className="h-3 w-3 text-yellow-500 mt-0.5 shrink-0" />
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 container mx-auto px-4 max-w-4xl">
        <Card className="border-2 border-dashed">
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-2xl font-bold mb-2">Ready to Secure Your Pipeline?</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start with the Security Fundamentals milestone and work your way up. Remember:
              security is a journey, not a destination.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild>
                <Link href="/checklists">
                  <Shield className="h-4 w-4 mr-2" />
                  Security Checklists
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/roadmap">
                  <MapPin className="h-4 w-4 mr-2" />
                  Full DevOps Roadmap
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Resources */}
      <section className="py-12 container mx-auto px-4 max-w-6xl mb-16">
        <h2 className="text-2xl font-bold text-center mb-8">Additional Resources</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/checklists/aws-security"
            className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
          >
            <Cloud className="h-8 w-8 text-orange-500 mb-2" />
            <h4 className="font-semibold">AWS Security</h4>
            <p className="text-xs text-muted-foreground">Cloud security checklist</p>
          </Link>
          <Link
            href="/checklists/kubernetes-security"
            className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
          >
            <Container className="h-8 w-8 text-blue-500 mb-2" />
            <h4 className="font-semibold">Kubernetes Security</h4>
            <p className="text-xs text-muted-foreground">Container security checklist</p>
          </Link>
          <Link
            href="/checklists/docker-security"
            className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
          >
            <Container className="h-8 w-8 text-cyan-500 mb-2" />
            <h4 className="font-semibold">Docker Security</h4>
            <p className="text-xs text-muted-foreground">Image hardening checklist</p>
          </Link>
          <Link
            href="/checklists/ssh-hardening"
            className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
          >
            <Lock className="h-8 w-8 text-green-500 mb-2" />
            <h4 className="font-semibold">SSH Hardening</h4>
            <p className="text-xs text-muted-foreground">Secure access checklist</p>
          </Link>
        </div>
      </section>

      {/* Report Issue */}
      <div className="fixed bottom-4 right-4 z-50">
        <ReportIssue />
      </div>
    </div>
  );
}
