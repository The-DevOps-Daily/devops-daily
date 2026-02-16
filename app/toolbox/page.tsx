import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Star,
  Code,
  Server,
  CloudCog,
  Database,
  Lock,
  Activity,
  Terminal,
  LineChart,
  Gauge,
  GitBranch,
  Container,
  Workflow,
  Sparkles,
  ExternalLink,
  PencilRuler,
  Webhook,
  Shield,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'DevOps Toolbox - Essential Tools & Resources',
  description:
    'Browse our curated collection of essential DevOps tools, resources, and services to enhance your workflow and productivity.',
  alternates: {
    canonical: '/toolbox',
  },
  openGraph: {
    title: 'DevOps Toolbox - Essential Tools & Resources',
    description:
      'Browse our curated collection of essential DevOps tools, resources, and services to enhance your workflow and productivity.',
    type: 'website',
    url: '/toolbox',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Toolbox',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevOps Toolbox - Essential Tools & Resources',
    description:
      'Browse our curated collection of essential DevOps tools, resources, and services to enhance your workflow and productivity.',
    images: ['/og-image.png'],
  },
};

// Tool interface to define the structure of our tools
interface Tool {
  name: string;
  description: string;
  href: string;
  category: string;
  icon: React.ElementType;
  badges?: {
    text: string;
    variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  }[];
  isAffiliate?: boolean;
  isPremium?: boolean;
  isPopular?: boolean;
  isNew?: boolean;
}

// Define our tool categories
const categories = [
  { id: 'all', name: 'All Tools', icon: Sparkles },
  { id: 'cicd', name: 'CI/CD', icon: Workflow },
  { id: 'cloud', name: 'Cloud', icon: CloudCog },
  { id: 'containers', name: 'Containers', icon: Container },
  { id: 'monitoring', name: 'Monitoring', icon: Activity },
  { id: 'infrastructure', name: 'Infrastructure', icon: Server },
  { id: 'security', name: 'Security', icon: Shield },
  { id: 'database', name: 'Database', icon: Database },
  { id: 'developer', name: 'Developer', icon: Code },
];

// Sample tools data
const tools: Tool[] = [
  {
    name: 'DigitalOcean',
    description: 'Cloud infrastructure provider offering scalable compute and storage solutions.',
    href: 'https://www.jdoqocy.com/click-101674709-15836238',
    category: 'cloud',
    icon: CloudCog,
    isPopular: true,
    isAffiliate: true,
    badges: [
      { text: 'Cloud Provider', variant: 'outline' },
      { text: 'SaaS', variant: 'secondary' },
    ],
  },
  {
    name: 'Terraform',
    description: 'Infrastructure as code tool for provisioning and managing cloud infrastructure.',
    href: 'https://www.terraform.io/',
    category: 'infrastructure',
    icon: Server,
    isPopular: true,
    badges: [
      { text: 'IaC', variant: 'outline' },
      { text: 'Open Source', variant: 'secondary' },
    ],
  },
  {
    name: 'Docker',
    description: 'Platform for building, shipping, and running applications in containers.',
    href: 'https://www.docker.com/',
    category: 'containers',
    icon: Container,
    isPopular: true,
    badges: [
      { text: 'Containers', variant: 'outline' },
      { text: 'Essential', variant: 'default' },
    ],
  },
  {
    name: 'Kubernetes',
    description:
      'Container orchestration platform for automating deployment, scaling, and management.',
    href: 'https://kubernetes.io/',
    category: 'containers',
    icon: Container,
    isPopular: true,
    badges: [
      { text: 'Orchestration', variant: 'outline' },
      { text: 'Enterprise', variant: 'secondary' },
    ],
  },
  {
    name: 'AWS',
    description:
      'Comprehensive cloud platform offering over 200 services from data centers globally.',
    href: 'https://aws.amazon.com/',
    category: 'cloud',
    icon: CloudCog,
    isAffiliate: true,
    badges: [
      { text: 'Cloud Provider', variant: 'outline' },
      { text: 'Enterprise', variant: 'secondary' },
    ],
  },
  {
    name: 'Azure',
    description:
      "Microsoft's cloud computing service for building, testing, deploying, and managing applications.",
    href: 'https://azure.microsoft.com/',
    category: 'cloud',
    icon: CloudCog,
    isAffiliate: true,
    badges: [
      { text: 'Cloud Provider', variant: 'outline' },
      { text: 'Enterprise', variant: 'secondary' },
    ],
  },
  {
    name: 'Google Cloud',
    description: 'Suite of cloud computing services running on the same infrastructure as Google.',
    href: 'https://cloud.google.com/',
    category: 'cloud',
    icon: CloudCog,
    badges: [{ text: 'Cloud Provider', variant: 'outline' }],
  },
  {
    name: 'GitHub Actions',
    description: 'CI/CD platform integrated with GitHub repositories for automating workflows.',
    href: 'https://github.com/features/actions',
    category: 'cicd',
    icon: Workflow,
    isPopular: true,
    badges: [
      { text: 'CI/CD', variant: 'outline' },
      { text: 'Git Integration', variant: 'secondary' },
    ],
  },
  {
    name: 'Jenkins',
    description: 'Open-source automation server for building, testing, and deploying code.',
    href: 'https://www.jenkins.io/',
    category: 'cicd',
    icon: Workflow,
    badges: [
      { text: 'CI/CD', variant: 'outline' },
      { text: 'Open Source', variant: 'secondary' },
    ],
  },
  {
    name: 'CircleCI',
    description: 'Cloud-native CI/CD platform designed for speed, security, and scalability.',
    href: 'https://circleci.com/',
    category: 'cicd',
    icon: Workflow,
    isAffiliate: true,
    badges: [
      { text: 'CI/CD', variant: 'outline' },
      { text: 'SaaS', variant: 'secondary' },
    ],
  },
  {
    name: 'GitLab CI',
    description: 'Integrated CI/CD within GitLab for building, testing, and deploying code.',
    href: 'https://about.gitlab.com/stages-devops-lifecycle/continuous-integration/',
    category: 'cicd',
    icon: Workflow,
    badges: [
      { text: 'CI/CD', variant: 'outline' },
      { text: 'Git Integration', variant: 'secondary' },
    ],
  },
  {
    name: 'Prometheus',
    description:
      'Open-source monitoring and alerting toolkit designed for reliability and scalability.',
    href: 'https://prometheus.io/',
    category: 'monitoring',
    icon: Activity,
    isPopular: true,
    badges: [
      { text: 'Monitoring', variant: 'outline' },
      { text: 'Open Source', variant: 'secondary' },
    ],
  },
  {
    name: 'Grafana',
    description: 'Multi-platform analytics and interactive visualization web application.',
    href: 'https://grafana.com/',
    category: 'monitoring',
    icon: LineChart,
    isPopular: true,
    badges: [
      { text: 'Visualization', variant: 'outline' },
      { text: 'Dashboard', variant: 'secondary' },
    ],
  },
  {
    name: 'Datadog',
    description:
      'Monitoring service for cloud-scale applications, providing observability of servers, databases, tools, and services.',
    href: 'https://www.datadoghq.com/',
   category: 'monitoring',
   icon: Gauge,
   isPremium: true,
   badges: [
      { text: 'Monitoring', variant: 'outline' },
      { text: 'APM', variant: 'secondary' },
      { text: 'SaaS', variant: 'default' },
    ],
  },
  {
    name: 'New Relic',
    description: 'Observability platform that helps identify and solve software problems.',
    href: 'https://newrelic.com/',
    category: 'monitoring',
    icon: Activity,
    isPremium: true,
    badges: [
      { text: 'APM', variant: 'outline' },
      { text: 'SaaS', variant: 'secondary' },
    ],
  },
  {
    name: 'Ansible',
    description:
      'Automation tool for configuration management, application deployment, and task automation.',
    href: 'https://www.ansible.com/',
    category: 'infrastructure',
    icon: Terminal,
    badges: [
      { text: 'Configuration Management', variant: 'outline' },
      { text: 'Automation', variant: 'secondary' },
    ],
  },
  {
    name: 'Puppet',
    description: 'Configuration management tool for automating infrastructure operations.',
    href: 'https://puppet.com/',
    category: 'infrastructure',
    icon: PencilRuler,
    badges: [{ text: 'Configuration Management', variant: 'outline' }],
 },
 {
    name: 'Acronis',
    description: 'Cyber protection solution providing backup, disaster recovery, and ransomware protection for hybrid cloud environments.',
    href: 'https://www.acronis.com/',
    category: 'security',
    icon: Shield,
    isAffiliate: true,
    badges: [
      { text: 'Backup', variant: 'outline' },
      { text: 'Disaster Recovery', variant: 'secondary' },
      { text: 'Cyber Protection', variant: 'default' },
    ],
  },
  {
   name: 'HashiCorp Vault',
   description: 'Tool for securely accessing secrets like API keys, passwords, and certificates.',
    href: 'https://www.vaultproject.io/',
    category: 'security',
    icon: Lock,
    isPopular: true,
    badges: [
      { text: 'Secrets Management', variant: 'outline' },
      { text: 'Security', variant: 'secondary' },
    ],
  },
  {
    name: 'SonarQube',
    description:
      'Continuous inspection of code quality to detect bugs, vulnerabilities, and code smells.',
    href: 'https://www.sonarqube.org/',
    category: 'security',
    icon: Shield,
    badges: [
      { text: 'Code Analysis', variant: 'outline' },
      { text: 'Security', variant: 'secondary' },
    ],
  },
  {
    name: 'MongoDB',
    description: 'Document-oriented NoSQL database used for high volume data storage.',
    href: 'https://www.mongodb.com/',
   category: 'database',
   icon: Database,
   badges: [
     { text: 'NoSQL', variant: 'outline' },
      { text: 'Document DB', variant: 'secondary' },
    ],
  },
  {
    name: 'PostgreSQL',
    description: 'Powerful, open source object-relational database system.',
    href: 'https://www.postgresql.org/',
    category: 'database',
    icon: Database,
    badges: [
      { text: 'SQL', variant: 'outline' },
      { text: 'Open Source', variant: 'secondary' },
    ],
  },
  {
    name: 'VS Code',
    description:
      'Lightweight but powerful source code editor with support for development operations.',
    href: 'https://code.visualstudio.com/',
    category: 'developer',
    icon: Code,
    isPopular: true,
    badges: [
      { text: 'Editor', variant: 'outline' },
      { text: 'Free', variant: 'secondary' },
    ],
  },
  {
    name: 'Postman',
    description: 'API platform for building and using APIs, including automated testing.',
    href: 'https://www.postman.com/',
    category: 'developer',
    icon: Webhook,
    badges: [
      { text: 'API Testing', variant: 'outline' },
      { text: 'Developer Tool', variant: 'secondary' },
    ],
  },
  {
    name: 'Git',
    description: 'Distributed version control system for tracking changes in source code.',
    href: 'https://git-scm.com/',
    category: 'developer',
    icon: GitBranch,
    badges: [
      { text: 'Version Control', variant: 'outline' },
      { text: 'Essential', variant: 'default' },
    ],
  },
  {
    name: 'Pulumi',
    description: 'Modern infrastructure as code platform using familiar programming languages.',
    href: 'https://www.pulumi.com/',
    category: 'infrastructure',
    icon: Server,
    isNew: true,
    badges: [
      { text: 'IaC', variant: 'outline' },
      { text: 'Cloud Native', variant: 'secondary' },
      { text: 'New', variant: 'default' },
    ],
  },
  {
    name: 'Snyk',
    description:
      'Developer security platform to find and fix vulnerabilities in code, containers, and dependencies.',
    href: 'https://snyk.io/',
   category: 'security',
   icon: Shield,
   isNew: true,
   badges: [
      { text: 'Security', variant: 'outline' },
      { text: 'Vulnerability Scanning', variant: 'secondary' },
      { text: 'New', variant: 'default' },
    ],
  },
];

// Helper to count tools by category
const getCategoryCount = (categoryId: string) => {
  if (categoryId === 'all') return tools.length;
  return tools.filter((tool) => tool.category === categoryId).length;
};

export default function ToolboxPage() {
  return (
    <div className="min-h-screen pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-b from-background via-background to-muted/20 py-20">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid opacity-[0.02]" />
          <div className="absolute top-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-20 left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge
              variant="outline"
              className="mb-6 px-4 py-1.5 border-blue-500/50 bg-blue-500/5 backdrop-blur-sm"
            >
              <Sparkles className="w-3.5 h-3.5 mr-2 text-blue-500" />
              Curated DevOps Resources
            </Badge>

            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              DevOps{' '}
              <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-500 via-purple-500 to-pink-500">
                Toolbox
              </span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Discover essential tools and resources to streamline your DevOps workflow, enhance
              productivity, and keep your infrastructure running smoothly.
            </p>

            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground max-w-2xl mx-auto">
              <p>
                <span className="font-semibold">Affiliate Notice:</span> We earn commissions when
                you shop through the links below.
             </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <Tabs defaultValue="all" className="w-full">
            <div className="mb-8 overflow-x-auto pb-2">
              <TabsList className="h-auto p-1 w-full sm:w-auto inline-flex">
                {categories.map((category) => (
                  <TabsTrigger
                    key={category.id}
                    value={category.id}
                    className="flex items-center gap-1.5 py-2 px-4"
                  >
                    <category.icon className="h-4 w-4" />
                    <span>{category.name}</span>
                    <Badge variant="outline" className="ml-1 px-1.5 py-0 text-xs">
                      {getCategoryCount(category.id)}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* All Tools Tab */}
            <TabsContent value="all" className="mt-0">
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {tools.map((tool) => (
                  <ToolCard key={tool.name} tool={tool} />
                ))}
              </div>
            </TabsContent>

            {/* Category Tabs */}
            {categories
              .filter((category) => category.id !== 'all')
              .map((category) => (
                <TabsContent key={category.id} value={category.id} className="mt-0">
                  <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {tools
                      .filter((tool) => tool.category === category.id)
                      .map((tool) => (
                        <ToolCard key={tool.name} tool={tool} />
                      ))}
                  </div>
                </TabsContent>
              ))}
          </Tabs>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <Card className="bg-linear-to-br from-blue-500/10 via-purple-500/5 to-pink-500/10 backdrop-blur-sm border-border/50">
            <CardContent className="p-8 md:p-12 text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Know a great DevOps tool we missed?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                We're always looking to expand our toolbox with the best resources for DevOps
                engineers. Let us know if you have a suggestion!
              </p>
              <Button asChild size="lg">
                <a href="https://github.com/The-DevOps-Daily/devops-daily/issues/new/choose">
                  Submit a Tool
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

// Tool Card Component
function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden border-border/50 h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="p-2 rounded-lg bg-muted/80 mb-3">
            <tool.icon className="h-5 w-5" />
          </div>
          <div className="flex gap-1">
            {tool.isPopular && (
              <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                <Star className="w-3 h-3 mr-1" />
                Popular
              </Badge>
            )}
            {tool.isNew && (
              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                New
              </Badge>
            )}
          </div>
        </div>
        <CardTitle className="text-xl group-hover:text-primary transition-colors">
          {tool.name}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {tool.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2 grow">
        <div className="flex flex-wrap gap-2">
          {tool.badges?.map((badge) => (
            <Badge key={badge.text} variant={badge.variant || 'default'}>
              {badge.text}
            </Badge>
          ))}
          {tool.isPremium && (
            <Badge variant="outline" className="border-amber-500 text-amber-500">
              Premium
            </Badge>
          )}
          {tool.isAffiliate && (
            <Badge variant="outline" className="border-blue-500 text-blue-500">
              Affiliate
            </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <Button
          asChild
          variant="outline"
          className="w-full group-hover:border-primary transition-colors"
        >
          <Link
            href={tool.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center"
          >
            <span>Visit</span>
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
