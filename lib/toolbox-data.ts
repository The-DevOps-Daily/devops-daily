import { SVGProps } from 'react';

export interface Tool {
  name: string;
  description: string;
  url: string;
  icon: string;
}

export interface ToolboxCategory {
  title: string;
  tools: Tool[];
}

export const toolboxCategories: ToolboxCategory[] = [
  {
    title: 'CI/CD & GitOps',
    tools: [
      {
        name: 'Argo CD',
        description: 'Declarative GitOps continuous delivery tool for Kubernetes.',
        url: 'https://argo-cd.readthedocs.io',
        icon: 'GitBranch',
      },
      {
        name: 'Tekton',
        description: 'Kubernetes-native framework for building and running CI/CD pipelines.',
        url: 'https://tekton.dev',
        icon: 'Workflow',
      },
    ],
  },
];
