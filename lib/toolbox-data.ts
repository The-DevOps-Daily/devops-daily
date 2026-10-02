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
    title: 'Automation & Configuration',
    tools: [
      {
        name: 'Ansible',
        description: 'An open-source IT automation tool that automates provisioning, configuration management, and application deployment.',
        url: 'https://www.ansible.com',
        icon: 'Terminal',
      }
    ],
  }
];