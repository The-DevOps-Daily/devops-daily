import type { Checklist } from '@/lib/checklist-utils';

import sshHardening from './ssh-hardening.json';
import kubernetsSecurity from './kubernetes-security.json';
import awsSecurity from './aws-security.json';
import cicdPipelineSetup from './cicd-pipeline-setup.json';
import productionDeployment from './production-deployment.json';

export const checklists: Checklist[] = [
  sshHardening as Checklist,
  kubernetsSecurity as Checklist,
  awsSecurity as Checklist,
  cicdPipelineSetup as Checklist,
  productionDeployment as Checklist,
];

export const getChecklistBySlug = (slug: string): Checklist | undefined => {
  return checklists.find(checklist => checklist.slug === slug);
};

export const getChecklistsByCategory = (category: string): Checklist[] => {
  return checklists.filter(checklist => checklist.category === category);
};

export const getChecklistsByDifficulty = (difficulty: string): Checklist[] => {
  return checklists.filter(checklist => checklist.difficulty === difficulty);
};

export const getChecklistsByTag = (tag: string): Checklist[] => {
  return checklists.filter(checklist => checklist.tags.includes(tag));
};
