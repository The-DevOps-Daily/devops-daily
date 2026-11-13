// The /roadmap map: stages -> topics -> subtopics -> resources. Internal
// resources name a content slug; lib/roadmap-resources.ts resolves the title,
// link and size from the content loaders, and tests/roadmap-links.test.ts
// fails on a slug that does not exist. Topic ids are stored in saved
// progress, so never change one; add a new topic instead.

export type TopicKind = 'core' | 'optional';
export type TopicLevel = 'basic' | 'intermediate' | 'advanced';

export type InternalResourceType =
  'guide' | 'post' | 'simulator' | 'lab' | 'challenge' | 'quiz' | 'flashcards' | 'checklist';

export type ResourceRef =
  { type: InternalResourceType; slug: string } | { type: 'external'; href: string; title: string };

export interface RoadmapTopic {
  /** "<stage>/<topic>", stable. Saved progress uses it. */
  id: string;
  name: string;
  kind: TopicKind;
  level: TopicLevel;
  summary: string;
  subtopics: string[];
  resources: ResourceRef[];
}

export interface RoadmapProject {
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  technologies: string[];
  /** A lab, challenge or simulator that covers part of the project. */
  practice?: ResourceRef;
}

export interface RoadmapStage {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  /** Weeks, min and max. Omitted for ongoing stages. */
  weeks?: [number, number];
  /** Ongoing habits: no progress tracking. */
  ongoing?: boolean;
  prerequisites: string[];
  outcomes: string[];
  roles: string[];
  projects: RoadmapProject[];
  topics: RoadmapTopic[];
}

const post = (slug: string): ResourceRef => ({ type: 'post', slug });
const guide = (slug: string): ResourceRef => ({ type: 'guide', slug });
const sim = (slug: string): ResourceRef => ({ type: 'simulator', slug });
const lab = (slug: string): ResourceRef => ({ type: 'lab', slug });
const challenge = (slug: string): ResourceRef => ({ type: 'challenge', slug });
const quiz = (slug: string): ResourceRef => ({ type: 'quiz', slug });
const cards = (slug: string): ResourceRef => ({ type: 'flashcards', slug });
const checklist = (slug: string): ResourceRef => ({ type: 'checklist', slug });
const ext = (title: string, href: string): ResourceRef => ({ type: 'external', title, href });

export const roadmapStages: RoadmapStage[] = [
  {
    id: 'fundamentals',
    title: 'Fundamentals',
    shortTitle: 'Fundamentals',
    description:
      'Build a solid foundation with essential programming and system administration skills.',
    weeks: [2, 3],
    prerequisites: ['Basic computer literacy', 'Willingness to learn'],
    outcomes: ['Command line proficiency', 'Basic programming skills', 'System understanding'],
    roles: ['Junior DevOps Engineer', 'System Administrator', 'Platform Engineer Intern'],
    projects: [
      {
        name: 'Personal Development Environment',
        description:
          'Set up a complete development environment with Linux, Git, and basic automation scripts.',
        difficulty: 'beginner',
        estimatedTime: '1-2 days',
        technologies: ['Linux', 'Git', 'Bash', 'VS Code'],
        practice: lab('cloud-server-setup'),
      },
      {
        name: 'System Monitoring Dashboard',
        description: 'Write Bash scripts that monitor system resources and generate reports.',
        difficulty: 'intermediate',
        estimatedTime: '3-5 days',
        technologies: ['Bash', 'Cron', 'Python', 'HTML/CSS'],
        practice: lab('server-monitoring-maintenance'),
      },
      {
        name: 'Automated Backup Solution',
        description: 'Build an automated backup system with shell scripts and cron jobs.',
        difficulty: 'intermediate',
        estimatedTime: '2-3 days',
        technologies: ['Bash', 'Cron', 'Rsync', 'Git'],
      },
    ],
    topics: [
      {
        id: 'fundamentals/linux',
        name: 'Linux basics',
        kind: 'core',
        level: 'basic',
        summary:
          'Linux runs most servers, containers and cloud machines. Learn to move around the file system, read and change permissions, manage processes and services, and find the logs. Every later stage assumes you are at home in a Linux shell.',
        subtopics: ['Files and permissions', 'Processes and services', 'Package managers', 'Logs'],
        resources: [
          guide('introduction-to-linux'),
          post('linux-git-docker-learning-order'),
          post('find-files-with-wildcards-linux'),
          post('find-files-containing-specific-text-linux'),
          sim('linux-terminal'),
          lab('cloud-server-setup'),
          lab('linux-performance-troubleshooting'),
          quiz('linux-quiz'),
          cards('linux-fundamentals'),
        ],
      },
      {
        id: 'fundamentals/bash',
        name: 'Shell scripting (Bash)',
        kind: 'core',
        level: 'basic',
        summary:
          'Bash glues tools together. Write scripts with variables, loops and functions, chain commands with pipes, and schedule jobs with cron. Small scripts like these remove most repetitive work.',
        subtopics: ['Variables and loops', 'Pipes and redirection', 'Exit codes', 'Cron jobs'],
        resources: [
          guide('introduction-to-bash'),
          post('parse-command-line-arguments-bash'),
          post('bash-loop-through-file-content'),
          post('what-does-2-and-1-mean-linux-bash'),
          ext(
            'Introduction to Bash Scripting (free ebook)',
            'https://github.com/bobbyiliev/introduction-to-bash-scripting'
          ),
          sim('cron-expression-simulator'),
          challenge('script-it'),
          ext('ShellCheck', 'https://www.shellcheck.net/'),
        ],
      },
      {
        id: 'fundamentals/programming',
        name: 'Programming with Python or Go',
        kind: 'core',
        level: 'basic',
        summary:
          'You do not need to be a software engineer, but you need to read and write code. Pick Python or Go and learn enough to write small tools: parse JSON, call an HTTP API, handle errors and add a few tests.',
        subtopics: ['Scripts and CLIs', 'JSON and HTTP APIs', 'Error handling', 'Tests'],
        resources: [
          guide('introduction-to-python'),
          post('what-is-the-quickest-way-to-http-get-in-python'),
          post('go-runs-the-cloud-native-control-plane'),
          ext('The Python Tutorial', 'https://docs.python.org/3/tutorial/'),
          ext('Go by Example', 'https://gobyexample.com/'),
          quiz('python-quiz'),
        ],
      },
      {
        id: 'fundamentals/networking',
        name: 'Networking basics',
        kind: 'core',
        level: 'basic',
        summary:
          'Many outages look like network problems at first. Learn how packets move with TCP/IP, how names resolve with DNS, and what happens in an HTTP request and a TLS handshake. Then you can tell a firewall rule from a stale DNS record.',
        subtopics: ['TCP/IP and ports', 'DNS', 'HTTP and TLS', 'SSH'],
        resources: [
          guide('networking-fundamentals'),
          post('when-is-it-appropriate-to-use-udp-instead-of-tcp'),
          post('ping-timeout-vs-destination-unreachable'),
          sim('dns-simulator'),
          sim('tcp-vs-udp'),
          sim('packet-journey'),
          sim('ssl-tls-handshake'),
          quiz('network-security-quiz'),
        ],
      },
      {
        id: 'fundamentals/git',
        name: 'Git',
        kind: 'core',
        level: 'basic',
        summary:
          'Git tracks every change to code and infrastructure. Learn commits, branches and merges, fix a merge conflict, and work through pull requests. CI/CD and GitOps build on the same workflow.',
        subtopics: ['Commits and branches', 'Merges and conflicts', 'Pull requests', 'Rebase'],
        resources: [
          guide('introduction-to-git'),
          post('how-do-i-resolve-merge-conflicts-in-a-git-repository'),
          post('difference-between-git-pull-and-git-fetch'),
          post('delete-commit-from-branch'),
          sim('git-concepts-simulator'),
          sim('git-merge-conflict-simulator'),
          lab('git-workflow-collaboration'),
          quiz('git-quiz'),
          cards('git-fundamentals'),
        ],
      },
    ],
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure as Code',
    shortTitle: 'IaC',
    description: 'Learn to provision and manage infrastructure through code.',
    weeks: [2, 3],
    prerequisites: ['Linux basics', 'Basic programming'],
    outcomes: ['Infrastructure automation', 'Configuration management', 'Reproducible deployments'],
    roles: ['Infrastructure Engineer', 'Platform Engineer', 'Cloud Engineer', 'DevOps Engineer'],
    projects: [
      {
        name: 'Multi-Environment Infrastructure',
        description: 'Create development, staging, and production environments with Terraform.',
        difficulty: 'intermediate',
        estimatedTime: '1-2 weeks',
        technologies: ['Terraform', 'AWS/Azure', 'Ansible', 'Git'],
        practice: lab('terraform-aws-vpc'),
      },
      {
        name: 'Automated Web Application Stack',
        description:
          'Deploy a web application stack with load balancers, databases, and monitoring.',
        difficulty: 'advanced',
        estimatedTime: '2-3 weeks',
        technologies: ['Terraform', 'Ansible', 'Nginx', 'PostgreSQL', 'Prometheus'],
        practice: lab('ansible-web-server-automation'),
      },
      {
        name: 'Infrastructure Testing Pipeline',
        description: 'Build a CI/CD pipeline that tests infrastructure changes before deployment.',
        difficulty: 'advanced',
        estimatedTime: '1-2 weeks',
        technologies: ['Terraform', 'Terratest', 'GitHub Actions', 'Checkov'],
      },
    ],
    topics: [
      {
        id: 'infrastructure/terraform',
        name: 'Terraform',
        kind: 'core',
        level: 'intermediate',
        summary:
          'Terraform describes servers, networks and DNS records as code, then plans and applies the changes. Learn providers and resources, how state tracks what exists, and how modules keep code reusable.',
        subtopics: ['Providers and resources', 'Plan and apply', 'State', 'Modules'],
        resources: [
          guide('introduction-to-terraform'),
          post('terraform-best-practices'),
          post('terraform-state-remove-move-migrate-backend'),
          post('terraform-module-outputs-inputs-and-sources'),
          sim('terraform-terminal-simulator'),
          sim('terraform-puzzle'),
          lab('terraform-digitalocean-droplet'),
          lab('terraform-aws-vpc'),
          challenge('fix-the-network-module'),
          quiz('terraform-quiz'),
          cards('terraform-basics'),
        ],
      },
      {
        id: 'infrastructure/ansible',
        name: 'Ansible',
        kind: 'core',
        level: 'intermediate',
        summary:
          'Ansible configures servers over SSH with YAML playbooks. Learn inventories, playbooks and roles, and why every task should be safe to run twice.',
        subtopics: ['Inventories', 'Playbooks', 'Roles', 'Idempotence'],
        resources: [
          guide('introduction-to-ansible'),
          lab('ansible-web-server-automation'),
          quiz('ansible-quiz'),
          cards('ansible-basics'),
        ],
      },
      {
        id: 'infrastructure/cloudformation',
        name: 'CloudFormation',
        kind: 'optional',
        level: 'intermediate',
        summary:
          'CloudFormation is the AWS infrastructure as code service. Learn it if your team runs only on AWS or inherits CloudFormation stacks. The ideas map closely to Terraform.',
        subtopics: ['Templates', 'Stacks', 'Change sets'],
        resources: [ext('AWS CloudFormation docs', 'https://docs.aws.amazon.com/cloudformation/')],
      },
      {
        id: 'infrastructure/config-management',
        name: 'Configuration management',
        kind: 'core',
        level: 'basic',
        summary:
          'Configuration management keeps servers and apps in a known, desired state. Describe that state in files, keep the files in Git so every change is reviewed, and learn to spot drift when reality no longer matches.',
        subtopics: ['Desired state', 'Drift', 'YAML', 'Repository layout'],
        resources: [
          post('infrastructure-as-code-fundamentals'),
          post('who-owns-the-terraform-state-file'),
          guide('introduction-to-packer'),
          sim('yaml-parsing-simulator'),
          checklist('terraform-repo-structure'),
        ],
      },
      {
        id: 'infrastructure/testing',
        name: 'Infrastructure testing',
        kind: 'optional',
        level: 'advanced',
        summary:
          'Infrastructure code breaks like any other code. Check it before it reaches production: validate and lint, review the plan in CI, enforce rules with policy as code, and run real tests with tools like Terratest.',
        subtopics: ['Validate and lint', 'Plan checks in CI', 'Policy as code', 'Terratest'],
        resources: [
          post('terraform-plan-gate-digitalocean-inference'),
          ext('Terratest', 'https://terratest.gruntwork.io/'),
          ext('Checkov', 'https://www.checkov.io/'),
        ],
      },
    ],
  },
  {
    id: 'containers',
    title: 'Containerization & Orchestration',
    shortTitle: 'Containers',
    description: 'Learn container technologies and orchestration platforms.',
    weeks: [3, 4],
    prerequisites: ['Linux fundamentals', 'Basic networking'],
    outcomes: ['Container expertise', 'Kubernetes proficiency', 'Microservices understanding'],
    roles: [
      'Container Platform Engineer',
      'Kubernetes Administrator',
      'Site Reliability Engineer',
      'Platform Architect',
    ],
    projects: [
      {
        name: 'Microservices E-commerce Platform',
        description: 'Build and deploy a microservices application with Docker and Kubernetes.',
        difficulty: 'advanced',
        estimatedTime: '2-3 weeks',
        technologies: ['Docker', 'Kubernetes', 'Helm', 'Istio', 'PostgreSQL', 'Redis'],
      },
      {
        name: 'Container CI/CD Pipeline',
        description:
          'Create a pipeline that builds, tests, and deploys containerized applications.',
        difficulty: 'intermediate',
        estimatedTime: '1-2 weeks',
        technologies: ['Docker', 'GitHub Actions', 'Kubernetes', 'Harbor Registry'],
        practice: lab('docker-multi-stage-build'),
      },
      {
        name: 'Kubernetes Cluster Setup',
        description: 'Set up a production-ready Kubernetes cluster with monitoring and logging.',
        difficulty: 'advanced',
        estimatedTime: '1-2 weeks',
        technologies: ['Kubernetes', 'Prometheus', 'Grafana', 'ELK Stack', 'Ingress'],
      },
    ],
    topics: [
      {
        id: 'containers/docker',
        name: 'Docker',
        kind: 'core',
        level: 'basic',
        summary:
          'A container packages an app with everything it needs to run. Learn to write a Dockerfile, build and run images, keep data in volumes and run several services together with Compose.',
        subtopics: ['Images and Dockerfiles', 'Volumes', 'Compose', 'Multi-stage builds'],
        resources: [
          guide('introduction-to-docker'),
          post('how-docker-works-under-the-hood'),
          post('difference-run-cmd-dockerfile'),
          post('docker-data-loss-when-container-exits'),
          sim('docker-terminal-simulator'),
          sim('docker-under-the-hood-simulator'),
          lab('docker-server-deployment'),
          lab('docker-multi-stage-build'),
          challenge('shrink-the-image'),
          quiz('docker-quiz'),
          cards('docker-essentials'),
        ],
      },
      {
        id: 'containers/networking',
        name: 'Container networking',
        kind: 'core',
        level: 'intermediate',
        summary:
          'Containers talk to each other over virtual networks. Learn bridge networks and published ports in Docker, then how Kubernetes gives every pod an IP address, routes Services and limits traffic with network policies.',
        subtopics: [
          'Bridge networks and ports',
          'Service discovery',
          'CNI plugins',
          'Network policies',
        ],
        resources: [
          post('forward-host-port-to-docker-container'),
          post('connect-to-host-localhost-from-docker'),
          sim('kubernetes-networking-cni-simulator'),
          sim('load-balancer-simulator'),
          sim('service-mesh-simulator'),
          lab('nginx-load-balancing-reverse-proxy'),
        ],
      },
      {
        id: 'containers/kubernetes',
        name: 'Kubernetes',
        kind: 'core',
        level: 'intermediate',
        summary:
          'Kubernetes runs containers across many machines and keeps them running. Learn pods, Deployments and Services, how the scheduler places work, and how the Horizontal Pod Autoscaler adds pods under load.',
        subtopics: ['Pods and Deployments', 'Services and Ingress', 'Scheduling', 'Autoscaling'],
        resources: [
          guide('introduction-to-kubernetes'),
          post('difference-between-pod-and-deployment'),
          post('kubernetes-deployments-vs-statefulsets'),
          post('kubernetes-concepts-junior-to-mid-level'),
          sim('kubernetes-terminal-simulator'),
          sim('k8s-scheduler'),
          lab('kubernetes-hpa-lab'),
          challenge('fix-the-deployment'),
          quiz('kubernetes-quiz'),
          cards('kubernetes-basics'),
        ],
      },
      {
        id: 'containers/helm',
        name: 'Helm',
        kind: 'core',
        level: 'intermediate',
        summary:
          'Helm packages Kubernetes manifests into charts with values you can change per environment. Learn to install, upgrade and roll back releases, and write a small chart of your own.',
        subtopics: ['Charts', 'Values', 'Releases and rollbacks'],
        resources: [
          post('how-to-publish-helm-chart'),
          ext('Helm docs', 'https://helm.sh/docs/'),
          lab('helm-kubernetes-packaging'),
          quiz('helm-charts-quiz'),
          cards('helm-fundamentals'),
        ],
      },
      {
        id: 'containers/security-basics',
        name: 'Container security basics',
        kind: 'core',
        level: 'intermediate',
        summary:
          'A container is only as safe as its image. Use small base images, run as a non-root user, scan images for known CVEs and keep secrets out of image layers.',
        subtopics: [
          'Small base images',
          'Non-root users',
          'Image scanning',
          'No secrets in layers',
        ],
        resources: [
          post('docker-image-optimization-best-practices'),
          post('why-your-base-image-has-1684-cves'),
          sim('docker-escape'),
          checklist('docker-security'),
        ],
      },
    ],
  },
  {
    id: 'cicd',
    title: 'CI/CD Pipelines',
    shortTitle: 'CI/CD',
    description: 'Build automated deployment pipelines for continuous delivery.',
    weeks: [2, 3],
    prerequisites: ['Git version control', 'Basic containerization'],
    outcomes: ['Automated deployments', 'Testing integration', 'Release management'],
    roles: ['Release Engineer', 'DevOps Engineer', 'Platform Engineer', 'CI/CD Specialist'],
    projects: [
      {
        name: 'Multi-Stage CI/CD Pipeline',
        description: 'Build a pipeline with testing, security scanning, and deployment.',
        difficulty: 'intermediate',
        estimatedTime: '1-2 weeks',
        technologies: ['GitHub Actions', 'Docker', 'SonarQube', 'Kubernetes', 'ArgoCD'],
        practice: lab('ci-cd-github-actions'),
      },
      {
        name: 'GitOps Deployment System',
        description: 'Set up a GitOps workflow for automated deployments with ArgoCD.',
        difficulty: 'advanced',
        estimatedTime: '2-3 weeks',
        technologies: ['ArgoCD', 'Helm', 'Kubernetes', 'Git', 'Prometheus'],
        practice: lab('gitops-argocd-deployment'),
      },
      {
        name: 'Blue-Green Deployment Pipeline',
        description: 'Create a zero-downtime deployment with automated rollback.',
        difficulty: 'advanced',
        estimatedTime: '1-2 weeks',
        technologies: ['Jenkins', 'Kubernetes', 'Helm', 'Monitoring', 'Load Balancer'],
        practice: sim('deployment-strategies'),
      },
    ],
    topics: [
      {
        id: 'cicd/github-actions',
        name: 'GitHub Actions',
        kind: 'core',
        level: 'basic',
        summary:
          'GitHub Actions runs your build, tests and deploys on every push. Learn workflows, jobs and steps, how runners work, and how to use secrets and caches safely.',
        subtopics: ['Workflows and jobs', 'Runners', 'Secrets', 'Caching'],
        resources: [
          guide('introduction-to-cicd'),
          post('github-actions-fast'),
          post('github-actions-bill-keeps-growing'),
          lab('ci-cd-github-actions'),
          quiz('github-actions-quiz'),
          quiz('cicd-fundamentals-quiz'),
          cards('cicd-concepts'),
          checklist('cicd-pipeline-setup'),
        ],
      },
      {
        id: 'cicd/jenkins',
        name: 'Jenkins',
        kind: 'optional',
        level: 'intermediate',
        summary:
          'Jenkins is a self-hosted CI server that many companies still run. Learn it if your team uses it: pipelines in a Jenkinsfile, build agents and plugins.',
        subtopics: ['Jenkinsfile pipelines', 'Agents', 'Plugins'],
        resources: [
          ext('Jenkins pipeline tour', 'https://www.jenkins.io/doc/pipeline/tour/getting-started/'),
          quiz('jenkins-quiz'),
        ],
      },
      {
        id: 'cicd/gitlab-ci',
        name: 'GitLab CI',
        kind: 'optional',
        level: 'intermediate',
        summary:
          'GitLab CI is built into GitLab. Pipelines live in .gitlab-ci.yml as stages and jobs and run on GitLab runners. Most ideas carry over from GitHub Actions.',
        subtopics: ['.gitlab-ci.yml', 'Stages and jobs', 'Runners'],
        resources: [ext('GitLab CI/CD docs', 'https://docs.gitlab.com/ci/')],
      },
      {
        id: 'cicd/argocd',
        name: 'Argo CD and GitOps',
        kind: 'core',
        level: 'advanced',
        summary:
          'With GitOps, Git holds the desired state of your clusters and a controller makes each cluster match it. Argo CD is the most common controller. Learn sync and drift, and how to lay out a repo for several environments.',
        subtopics: ['GitOps principles', 'Sync and drift', 'Multi-environment repos'],
        resources: [
          post('introduction-to-argocd'),
          post('gitops-argocd-repository-structure-multi-environment'),
          post('gitops-deploy-docker-containers-github-actions-argocd'),
          sim('gitops-workflow'),
          lab('gitops-argocd-deployment'),
          quiz('argocd-multi-environment-quiz'),
          cards('argocd-fundamentals'),
          checklist('gitops-implementation'),
        ],
      },
      {
        id: 'cicd/testing',
        name: 'Test automation and releases',
        kind: 'core',
        level: 'intermediate',
        summary:
          'A pipeline is only useful if it stops bad changes. Run tests on every change, give reviewers a preview environment, and ship with blue-green or canary releases that you can roll back.',
        subtopics: [
          'Tests in CI',
          'Preview environments',
          'Blue-green and canary',
          'Feature flags',
        ],
        resources: [
          post('deployment-strategies-guide'),
          post('api-testing-types-where-each-belongs-in-your-pipeline'),
          post('how-to-implement-progressive-delivery-with-feature-flags'),
          sim('deployment-strategies'),
          sim('preview-environment-simulator'),
          quiz('cicd-pipelines-quiz'),
          checklist('production-deployment'),
        ],
      },
    ],
  },
  {
    id: 'cloud',
    title: 'Cloud Platforms',
    shortTitle: 'Cloud',
    description: 'Learn major cloud service providers and their services.',
    weeks: [4, 6],
    prerequisites: ['Infrastructure as Code', 'Networking fundamentals'],
    outcomes: ['Multi-cloud expertise', 'Cost optimization', 'Architecture design'],
    roles: [
      'Cloud Engineer',
      'Solutions Architect',
      'Cloud Security Engineer',
      'Principal Engineer',
    ],
    projects: [
      {
        name: 'Multi-Cloud Architecture',
        description: 'Design and build an application that runs across AWS, Azure, and GCP.',
        difficulty: 'advanced',
        estimatedTime: '3-4 weeks',
        technologies: ['AWS', 'Azure', 'GCP', 'Terraform', 'Kubernetes', 'Load Balancers'],
      },
      {
        name: 'Serverless Application Suite',
        description: 'Build a serverless application with API Gateway, Lambda, and DynamoDB.',
        difficulty: 'intermediate',
        estimatedTime: '2-3 weeks',
        technologies: ['AWS Lambda', 'API Gateway', 'DynamoDB', 'CloudFormation', 'S3'],
      },
      {
        name: 'Cost Optimization Dashboard',
        description: 'Create automated cost monitoring and optimization recommendations.',
        difficulty: 'advanced',
        estimatedTime: '1-2 weeks',
        technologies: ['CloudWatch', 'AWS Cost Explorer', 'Python', 'Grafana', 'Lambda'],
      },
    ],
    topics: [
      {
        id: 'cloud/digitalocean',
        name: 'DigitalOcean',
        kind: 'optional',
        level: 'basic',
        summary:
          'DigitalOcean is a smaller cloud with simple pricing, which makes it a good first place to run real servers. Create a Droplet, add a managed database and describe it all in Terraform.',
        subtopics: ['Droplets', 'Managed databases', 'Spaces object storage'],
        resources: [
          ext('DigitalOcean docs', 'https://docs.digitalocean.com/'),
          post('migrating-from-heroku-to-digitalocean'),
          lab('terraform-digitalocean-droplet'),
        ],
      },
      {
        id: 'cloud/aws',
        name: 'AWS fundamentals',
        kind: 'core',
        level: 'basic',
        summary:
          'AWS is the largest cloud, so most job posts mention it. Start with IAM, EC2, S3 and VPC networking, then Lambda. Learn how the pieces connect before you learn every service.',
        subtopics: ['IAM', 'EC2 and S3', 'VPC networking', 'Lambda'],
        resources: [
          guide('introduction-to-aws'),
          post('assumerole-service-ec2'),
          sim('aws-vpc-simulator'),
          lab('terraform-aws-vpc'),
          quiz('aws-quiz'),
          cards('aws-essentials'),
        ],
      },
      {
        id: 'cloud/azure',
        name: 'Azure',
        kind: 'optional',
        level: 'intermediate',
        summary:
          'Azure is common in companies that already use Microsoft tools. Learn resource groups, virtual machines, networking and AKS, its managed Kubernetes. The core ideas match AWS under different names.',
        subtopics: ['Resource groups', 'Virtual machines', 'AKS'],
        resources: [ext('Azure documentation', 'https://learn.microsoft.com/en-us/azure/')],
      },
      {
        id: 'cloud/gcp',
        name: 'Google Cloud',
        kind: 'optional',
        level: 'intermediate',
        summary:
          'Google Cloud is strong in Kubernetes and data tools. Learn projects and IAM, Compute Engine, GKE and Cloud Run.',
        subtopics: ['Projects and IAM', 'Compute Engine', 'GKE and Cloud Run'],
        resources: [ext('Google Cloud docs', 'https://docs.cloud.google.com/docs')],
      },
      {
        id: 'cloud/cost',
        name: 'Cloud cost optimization',
        kind: 'core',
        level: 'intermediate',
        summary:
          'Cloud bills grow quietly. Tag resources so every cost has an owner, right-size machines, use reserved and spot capacity where it fits, and watch data transfer fees.',
        subtopics: ['Cost allocation tags', 'Right-sizing', 'Reserved and spot', 'Data transfer'],
        resources: [
          guide('finops-for-devops-engineers'),
          post('what-is-finops-a-beginners-guide-to-cloud-cost-management'),
          post('how-to-set-up-aws-cost-explorer-and-budgets-for-teams'),
          quiz('cloud-cost-optimization-quiz'),
          cards('cloud-cost-allocation-tags'),
          checklist('cloud-cost-allocation-tags'),
        ],
      },
      {
        id: 'cloud/aws-certification',
        name: 'AWS Solutions Architect certification',
        kind: 'optional',
        level: 'advanced',
        summary:
          'The AWS Certified Solutions Architect Associate exam checks that you can design systems on AWS. It is optional, but some employers filter on it. Build real things first, then study the Well-Architected pillars.',
        subtopics: ['Well-Architected pillars', 'High availability', 'Exam practice'],
        resources: [
          ext(
            'AWS Certified Solutions Architect Associate',
            'https://aws.amazon.com/certification/certified-solutions-architect-associate/'
          ),
          post('multi-region-active-active-aws'),
          checklist('aws-well-architected'),
          checklist('high-availability'),
        ],
      },
    ],
  },
  {
    id: 'monitoring',
    title: 'Monitoring & Observability',
    shortTitle: 'Monitoring',
    description: 'Set up monitoring and observability for your systems.',
    weeks: [2, 3],
    prerequisites: ['Container basics', 'Cloud fundamentals'],
    outcomes: ['System visibility', 'Incident response', 'Performance optimization'],
    roles: [
      'Site Reliability Engineer',
      'Observability Engineer',
      'Platform Reliability Engineer',
      'Principal SRE',
    ],
    projects: [
      {
        name: 'Complete Observability Stack',
        description: 'Build end-to-end monitoring for a microservices application.',
        difficulty: 'advanced',
        estimatedTime: '2-3 weeks',
        technologies: ['Prometheus', 'Grafana', 'Jaeger', 'ELK Stack', 'AlertManager'],
        practice: lab('microservices-observability-opentelemetry'),
      },
      {
        name: 'SLO Monitoring Dashboard',
        description: 'Track SLIs and SLOs with automated alerts and error budgets.',
        difficulty: 'advanced',
        estimatedTime: '1-2 weeks',
        technologies: ['Prometheus', 'Grafana', 'SLO Library', 'PagerDuty', 'Kubernetes'],
        practice: lab('prometheus-grafana-monitoring'),
      },
      {
        name: 'Performance Analysis Tool',
        description: 'Build automated detection of performance regressions.',
        difficulty: 'intermediate',
        estimatedTime: '1-2 weeks',
        technologies: ['Prometheus', 'Python', 'Grafana', 'Statistical Analysis', 'Alerts'],
      },
    ],
    topics: [
      {
        id: 'monitoring/prometheus-grafana',
        name: 'Prometheus and Grafana',
        kind: 'core',
        level: 'intermediate',
        summary:
          'Prometheus scrapes metrics from your services and stores them as time series. Grafana turns them into dashboards. Learn PromQL, build a dashboard and write alerts that fire only for real problems.',
        subtopics: ['Metrics and exporters', 'PromQL', 'Dashboards', 'Alerting'],
        resources: [
          ext(
            'Prometheus: getting started',
            'https://prometheus.io/docs/prometheus/latest/getting_started/'
          ),
          sim('promql-playground'),
          lab('prometheus-grafana-monitoring'),
          challenge('write-the-alerts'),
          quiz('monitoring-basics-quiz'),
          quiz('monitoring-observability-quiz'),
          cards('monitoring-observability'),
          checklist('monitoring-observability'),
        ],
      },
      {
        id: 'monitoring/logging',
        name: 'Logging and the ELK stack',
        kind: 'core',
        level: 'intermediate',
        summary:
          'Logs tell you what happened and why. Write structured logs, ship them from many machines to one place, and search them with Elasticsearch and Kibana or with Grafana Loki. Keep an eye on what they cost.',
        subtopics: ['Structured logs', 'Log shipping', 'Search and retention'],
        resources: [
          post('your-logs-cost-more-than-the-service'),
          ext(
            'Install the Elastic Stack on Ubuntu',
            'https://www.digitalocean.com/community/tutorials/how-to-install-elasticsearch-logstash-and-kibana-elastic-stack-on-ubuntu-20-04'
          ),
          sim('log-aggregation-pipeline-simulator'),
        ],
      },
      {
        id: 'monitoring/slos',
        name: 'SLOs, latency and incidents',
        kind: 'core',
        level: 'intermediate',
        summary:
          'Users feel latency and errors, not CPU graphs. Measure request latency at p95 and p99, set SLOs with error budgets, and use them to decide when to page someone. Then practice running an incident.',
        subtopics: [
          'Latency percentiles',
          'SLOs and error budgets',
          'On-call',
          'Incident response',
        ],
        resources: [
          post('slos-slis-error-budgets-practical-guide'),
          post('what-is-p99-latency'),
          post('on-call-rotation-escalation-policy-guide'),
          sim('latency-percentiles-simulator'),
          sim('incident-commander-simulator'),
          quiz('slos-slis-error-budgets-quiz'),
          quiz('sre-quiz'),
          cards('slos-slis-error-budgets'),
          checklist('on-call-rotation-escalation-policy'),
        ],
      },
      {
        id: 'monitoring/tracing',
        name: 'Distributed tracing',
        kind: 'optional',
        level: 'advanced',
        summary:
          'In a system of many services, one slow request can cross ten of them. Tracing follows the request with spans so you can see where the time went. OpenTelemetry is the standard way to add it.',
        subtopics: ['Spans and traces', 'Context propagation', 'OpenTelemetry'],
        resources: [
          post('distributed-tracing-opentelemetry-instrumentation-visualization'),
          post('trace-context-environment-variables'),
          sim('microservices-simulator'),
          lab('microservices-observability-opentelemetry'),
          quiz('opentelemetry-distributed-tracing-quiz'),
          cards('opentelemetry-distributed-tracing'),
          checklist('distributed-tracing-opentelemetry'),
        ],
      },
    ],
  },
  {
    id: 'security',
    title: 'Security & Compliance',
    shortTitle: 'Security',
    description: 'Build security checks into your pipelines and platforms.',
    weeks: [3, 4],
    prerequisites: ['CI/CD pipelines', 'Container security basics'],
    outcomes: ['Security automation', 'Compliance management', 'Threat mitigation'],
    roles: ['DevSecOps Engineer', 'Security Engineer', 'Compliance Engineer', 'Security Architect'],
    projects: [
      {
        name: 'Secure CI/CD Pipeline',
        description: 'Build a pipeline with security scanning and compliance checks.',
        difficulty: 'advanced',
        estimatedTime: '2-3 weeks',
        technologies: ['SAST/DAST', 'Container Scanning', 'Secret Detection', 'Policy as Code'],
        practice: lab('ci-cd-github-actions'),
      },
      {
        name: 'Zero Trust Network',
        description: 'Apply zero-trust principles with a service mesh and mTLS.',
        difficulty: 'advanced',
        estimatedTime: '2-3 weeks',
        technologies: ['Istio', 'Cert-Manager', 'OPA Gatekeeper', 'Falco', 'Network Policies'],
      },
      {
        name: 'Compliance Automation',
        description: 'Automate compliance reports and fixes for SOC 2 or GDPR.',
        difficulty: 'intermediate',
        estimatedTime: '1-2 weeks',
        technologies: ['Open Policy Agent', 'Falco', 'Cloud Security Tools', 'Automation Scripts'],
      },
    ],
    topics: [
      {
        id: 'security/scanning',
        name: 'Security scanning',
        kind: 'core',
        level: 'intermediate',
        summary:
          'Find problems before attackers do. Add static analysis, dependency checks and image scans to your pipeline, and decide which findings block a merge.',
        subtopics: ['SAST', 'Dependency scanning', 'Supply chain', 'Security gates'],
        resources: [
          guide('sast-tools'),
          guide('security-gates'),
          guide('owasp-top-10'),
          post('dependency-scanning-guide'),
          post('dast-integration-guide'),
          post('software-supply-chain-security'),
        ],
      },
      {
        id: 'security/secrets',
        name: 'Secrets management',
        kind: 'core',
        level: 'intermediate',
        summary:
          'Passwords and API keys do not belong in Git or in images. Keep them in a secrets manager like Vault, encrypt config files with SOPS, give each app only the secrets it needs and rotate them.',
        subtopics: ['Vault', 'SOPS', 'Rotation', 'Leaked secrets'],
        resources: [
          post('secrets-management-guide'),
          post('pre-commit-hooks-security-guide'),
          post('you-cannot-rotate-a-secret-you-cannot-find'),
          lab('infrastructure-security-vault-sops'),
          quiz('vault-secrets-management-quiz'),
          cards('vault-secrets-management'),
          checklist('hashicorp-vault-secrets-management'),
        ],
      },
      {
        id: 'security/iam',
        name: 'RBAC and IAM',
        kind: 'core',
        level: 'intermediate',
        summary:
          'Every person and service should have only the access it needs. Learn cloud IAM policies, Kubernetes RBAC, OAuth and OIDC for logins, and how to lock down SSH.',
        subtopics: ['Least privilege', 'Cloud IAM', 'Kubernetes RBAC', 'OAuth and OIDC'],
        resources: [
          guide('security-principles'),
          post('terraform-fargate-task-definition-execution-role'),
          sim('k8s-rbac-simulator'),
          sim('oauth-oidc-flow-simulator'),
          lab('linux-server-security'),
          checklist('ssh-hardening'),
          checklist('aws-security'),
        ],
      },
      {
        id: 'security/compliance',
        name: 'Compliance automation',
        kind: 'optional',
        level: 'advanced',
        summary:
          'Audits like SOC 2 ask you to prove that your controls work. Write the rules as code, check them in CI and collect the evidence automatically. Threat modeling helps you pick which controls matter.',
        subtopics: ['Policy as code', 'Audit evidence', 'Threat modeling'],
        resources: [
          guide('threat-modeling'),
          post('soc2-evidence-from-github-and-terraform'),
          ext('Open Policy Agent docs', 'https://www.openpolicyagent.org/docs'),
        ],
      },
      {
        id: 'security/runtime',
        name: 'Container runtime security',
        kind: 'optional',
        level: 'advanced',
        summary:
          'Some attacks start after deploy. Apply Pod Security Standards, drop Linux capabilities, add seccomp profiles and watch for odd behaviour at runtime. Patch the kernel and the runtime when CVEs land.',
        subtopics: ['Pod Security Standards', 'Capabilities and seccomp', 'Runtime detection'],
        resources: [
          post('security-profiles-operator-seccomp-boundary'),
          sim('docker-escape'),
          quiz('security-incident-response-quiz'),
          cards('pod-security-standards-kubernetes'),
          checklist('kubernetes-security'),
        ],
      },
    ],
  },
  {
    id: 'databases',
    title: 'Database Management',
    shortTitle: 'Databases',
    description: 'Handle data persistence, scaling, and database operations.',
    weeks: [2, 3],
    prerequisites: ['Basic programming', 'Cloud fundamentals'],
    outcomes: ['Database expertise', 'Data reliability', 'Performance optimization'],
    roles: [
      'Database Engineer',
      'Data Platform Engineer',
      'Database Administrator',
      'Data Architect',
    ],
    projects: [
      {
        name: 'Database Migration Pipeline',
        description: 'Automate a migration from a legacy system to a cloud database.',
        difficulty: 'advanced',
        estimatedTime: '2-3 weeks',
        technologies: [
          'Database Migration Service',
          'ETL Tools',
          'Monitoring',
          'Rollback Strategies',
        ],
        practice: checklist('zero-downtime-postgres-migrations'),
      },
      {
        name: 'Multi-Database Architecture',
        description: 'Design polyglot persistence with different database types.',
        difficulty: 'advanced',
        estimatedTime: '2-3 weeks',
        technologies: ['PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Data Sync'],
      },
      {
        name: 'Database Monitoring System',
        description: 'Build performance monitoring for your databases.',
        difficulty: 'intermediate',
        estimatedTime: '1-2 weeks',
        technologies: ['Prometheus', 'Grafana', 'Database Exporters', 'Alert Rules'],
      },
    ],
    topics: [
      {
        id: 'databases/sql-nosql',
        name: 'SQL and NoSQL',
        kind: 'core',
        level: 'basic',
        summary:
          'Most apps keep their data in PostgreSQL or MySQL, with Redis or MongoDB for some jobs. Learn SQL, how tables and indexes work, and when a document or key-value store is a better fit.',
        subtopics: ['SQL queries', 'PostgreSQL', 'Redis and MongoDB', 'Choosing a database'],
        resources: [
          guide('introduction-to-postgres'),
          ext(
            'Introduction to SQL (free ebook)',
            'https://github.com/bobbyiliev/introduction-to-sql'
          ),
          sim('sql-terminal-simulator'),
          sim('postgres-terminal-simulator'),
          sim('mongodb-terminal-simulator'),
          sim('dbms-simulator'),
          quiz('sql-quiz'),
        ],
      },
      {
        id: 'databases/automation',
        name: 'Database automation',
        kind: 'core',
        level: 'intermediate',
        summary:
          'Schema changes should go through the same review and pipeline as code. Use a migration tool, run migrations in CI against real data, and change a busy table without locking it.',
        subtopics: ['Migrations as code', 'Schema changes in CI', 'Zero-downtime changes'],
        resources: [
          post('zero-downtime-postgresql-migrations-production'),
          post('rehearse-migrations-on-a-neon-branch'),
          quiz('zero-downtime-postgres-migrations-quiz'),
          cards('postgresql-zero-downtime-migrations'),
          checklist('zero-downtime-postgres-migrations'),
        ],
      },
      {
        id: 'databases/backups',
        name: 'Backups and recovery',
        kind: 'core',
        level: 'intermediate',
        summary:
          'A backup you have never restored is a guess. Learn full and incremental backups, point-in-time recovery and restore drills, and agree on how much data and time the business can afford to lose.',
        subtopics: ['Backup types', 'Point-in-time recovery', 'Restore drills', 'RPO and RTO'],
        resources: [
          sim('bcdr-simulator'),
          ext(
            'PostgreSQL docs: backup and restore',
            'https://www.postgresql.org/docs/current/backup.html'
          ),
        ],
      },
      {
        id: 'databases/performance',
        name: 'Performance tuning',
        kind: 'optional',
        level: 'advanced',
        summary:
          'Slow queries are a common cause of slow apps. Read query plans with EXPLAIN, add the right indexes, pool connections and cache hot reads.',
        subtopics: ['EXPLAIN and query plans', 'Indexes', 'Connection pooling', 'Caching'],
        resources: [
          post('serverless-killed-your-connection-pool'),
          post('stop-paginating-with-offset'),
          sim('db-indexing-simulator'),
          sim('caching-simulator'),
          lab('redis-caching-strategies'),
          challenge('speed-up-the-queries'),
        ],
      },
      {
        id: 'databases/migration',
        name: 'Data migration',
        kind: 'optional',
        level: 'advanced',
        summary:
          'Moving data between servers, versions or vendors needs a plan. Copy it with replication, check that both sides match, and cut over with a short, tested way back.',
        subtopics: ['Replication', 'Verification', 'Cutover and rollback'],
        resources: [
          post('postgres-cdc-without-dual-writing'),
          sim('database-replication-sharding-scaling'),
        ],
      },
    ],
  },
  {
    id: 'lifetime',
    title: 'Continuous Learning',
    shortTitle: 'Keep learning',
    description: 'Keep learning and share what you know.',
    ongoing: true,
    prerequisites: ['Curiosity', 'Growth mindset'],
    outcomes: ['Continuous growth', 'Community impact', 'Knowledge sharing'],
    roles: ['Senior Engineer', 'Staff Engineer', 'Principal Engineer', 'Distinguished Engineer'],
    projects: [
      {
        name: 'Open Source Contribution',
        description: 'Contribute to a DevOps tool you use, or start your own project.',
        difficulty: 'advanced',
        estimatedTime: 'Ongoing',
        technologies: ['GitHub', 'Community Building', 'Documentation', 'Code Review'],
      },
      {
        name: 'Technical Blog Series',
        description: 'Share your DevOps work and what you learn in regular blog posts.',
        difficulty: 'intermediate',
        estimatedTime: 'Ongoing',
        technologies: ['Writing', 'SEO', 'Community Engagement'],
      },
      {
        name: 'Mentorship Program',
        description: 'Guide junior engineers and help the community grow.',
        difficulty: 'intermediate',
        estimatedTime: 'Ongoing',
        technologies: ['Leadership', 'Communication', 'Knowledge Transfer', 'Career Coaching'],
      },
    ],
    topics: [
      {
        id: 'lifetime/curiosity',
        name: 'Stay curious and experiment',
        kind: 'core',
        level: 'basic',
        summary:
          'Tools change every year, but the habit of trying them carries over. Read changelogs, keep a small lab to break things in, and when something fails, find out why.',
        subtopics: ['Read changelogs', 'Break things on purpose', 'A daily incident'],
        resources: [
          post('top-github-devops-learning-repos-2026'),
          sim('on-call'),
          checklist('litmus-chaos-engineering-experiment'),
        ],
      },
      {
        id: 'lifetime/open-source',
        name: 'Open source',
        kind: 'optional',
        level: 'intermediate',
        summary:
          'Contributing to open source teaches you to read large codebases and to work with strangers through pull requests. Start with docs and small fixes in tools you already use.',
        subtopics: ['First contributions', 'Reading other code', 'Good pull requests'],
        resources: [
          ext('How to contribute to open source', 'https://opensource.guide/how-to-contribute/'),
        ],
      },
      {
        id: 'lifetime/writing',
        name: 'Technical writing',
        kind: 'optional',
        level: 'intermediate',
        summary:
          'Clear writing spreads what you know. Write runbooks, design docs and blameless postmortems, and turn what you learn into a blog post.',
        subtopics: ['Runbooks', 'Postmortems', 'Blog posts'],
        resources: [post('the-postmortem-nobody-reads')],
      },
      {
        id: 'lifetime/mentoring',
        name: 'Mentoring',
        kind: 'optional',
        level: 'advanced',
        summary:
          'Teaching others shows you the gaps in what you know. Pair with junior engineers, give kind and specific code reviews, and share your notes.',
        subtopics: ['Pairing', 'Code review', 'Sharing notes'],
        resources: [],
      },
      {
        id: 'lifetime/side-projects',
        name: 'Side projects',
        kind: 'core',
        level: 'basic',
        summary:
          'A small project you run yourself teaches more than a course. Deploy something real, give it monitoring and backups, and write down what broke.',
        subtopics: ['Ship something small', 'Run it yourself', 'Write it up'],
        resources: [lab('nginx-web-deployment'), lab('docker-server-deployment')],
      },
      {
        id: 'lifetime/conferences',
        name: 'Conferences and workshops',
        kind: 'optional',
        level: 'basic',
        summary:
          'Talks and workshops show how other teams solve the same problems. Many conferences post their talks online for free, so you can learn without travelling.',
        subtopics: ['Recorded talks', 'Workshops', 'Local meetups'],
        resources: [ext('CNCF talks on YouTube', 'https://www.youtube.com/@cncf')],
      },
      {
        id: 'lifetime/communities',
        name: 'Communities',
        kind: 'core',
        level: 'basic',
        summary:
          'You learn faster with people around you. Join a forum, a chat group or a local meetup, ask questions, and answer a few.',
        subtopics: ['Forums and chat', 'Meetups', 'Newsletters'],
        resources: [],
      },
    ],
  },
];

export interface CareerNote {
  /** Occupation name as the BLS writes it. */
  occupation: string;
  href: string;
  roles: string;
  stages: string[];
  low: number;
  median: number;
  high: number;
  /** Projected change in jobs over the projection period, in percent. */
  growth: number;
  growthNote?: string;
}

// Checked against each BLS page on 2026-11-07. The BLS has no DevOps job
// title, so every row is the closest occupation it tracks. Update the numbers
// and the dates together when the BLS publishes new data.
export const careerSource = {
  name: 'US Bureau of Labor Statistics, Occupational Outlook Handbook',
  payPeriod: 'May 2025',
  projection: '2025 to 2035',
  updated: '2026-08-27',
  checked: '2026-11-07',
};

const BLS = 'https://www.bls.gov/ooh/computer-and-information-technology';

export const careerNotes: CareerNote[] = [
  {
    occupation: 'Network and computer systems administrators',
    href: `${BLS}/network-and-computer-systems-administrators.htm`,
    roles: 'System administrator, junior DevOps engineer',
    stages: ['fundamentals', 'infrastructure'],
    low: 62640,
    median: 99130,
    high: 155050,
    growth: -4,
  },
  {
    occupation: 'Software developers',
    href: `${BLS}/software-developers.htm`,
    roles: 'DevOps, platform and release engineer, SRE',
    stages: ['containers', 'cicd', 'monitoring'],
    low: 82460,
    median: 135980,
    high: 214670,
    growth: 10,
    growthNote: 'Growth covers software developers, QA analysts and testers together.',
  },
  {
    occupation: 'Computer network architects',
    href: `${BLS}/computer-network-architects.htm`,
    roles: 'Cloud and network architect',
    stages: ['cloud'],
    low: 79900,
    median: 134050,
    high: 202680,
    growth: 8,
  },
  {
    occupation: 'Information security analysts',
    href: `${BLS}/information-security-analysts.htm`,
    roles: 'DevSecOps and security engineer',
    stages: ['security'],
    low: 75090,
    median: 129180,
    high: 199850,
    growth: 21,
  },
  {
    occupation: 'Database administrators',
    href: `${BLS}/database-administrators.htm`,
    roles: 'Database administrator',
    stages: ['databases'],
    low: 60230,
    median: 104620,
    high: 163320,
    growth: 0,
  },
  {
    occupation: 'Database architects',
    href: `${BLS}/database-administrators.htm`,
    roles: 'Database and data platform engineer',
    stages: ['databases'],
    low: 86240,
    median: 139500,
    high: 204000,
    growth: 9,
  },
];

/** Our own reading for the career notes section. */
export const careerReading: ResourceRef[] = [
  post('devops-engineer-career-paths-next-five-years'),
  post('devops-interviews-situational-questions'),
  quiz('junior-devops-interview-quiz'),
  quiz('devops-interview-quiz'),
];

export function getRoadmapTotals(stages: RoadmapStage[] = roadmapStages) {
  const topics = stages.flatMap((s) => s.topics);
  const tracked = stages.filter((s) => !s.ongoing).flatMap((s) => s.topics);
  const timed = stages.filter((s) => s.weeks);
  return {
    stages: stages.length,
    topics: topics.length,
    core: topics.filter((t) => t.kind === 'core').length,
    tracked: tracked.length,
    projects: stages.reduce((n, s) => n + s.projects.length, 0),
    minWeeks: timed.reduce((n, s) => n + s.weeks![0], 0),
    maxWeeks: timed.reduce((n, s) => n + s.weeks![1], 0),
  };
}

export function stageTimeLabel(stage: RoadmapStage): string {
  return stage.weeks ? `${stage.weeks[0]}-${stage.weeks[1]} weeks` : 'Ongoing';
}
