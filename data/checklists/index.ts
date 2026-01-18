import type { Checklist } from '@/lib/checklist-utils';

import sshHardening from './ssh-hardening.json';
import kubernetsSecurity from './kubernetes-security.json';
import awsSecurity from './aws-security.json';
import cicdPipelineSetup from './cicd-pipeline-setup.json';
import productionDeployment from './production-deployment.json';
import terraformRepoStructure from './terraform-repo-structure.json';
import dockerSecurity from './docker-security.json';
import highAvailability from './high-availability.json';
import monitoringObservability from './monitoring-observability.json';
import awsWellArchitected from './aws-well-architected.json';
import gitopsImplementation from './gitops-implementation.json';

export const checklists: Checklist[] = [
  sshHardening as Checklist,
  kubernetsSecurity as Checklist,
  awsSecurity as Checklist,
  cicdPipelineSetup as Checklist,
  productionDeployment as Checklist,
  terraformRepoStructure,
  dockerSecurity as Checklist,
  highAvailability as Checklist,
  monitoringObservability as Checklist,
  awsWellArchitected as Checklist,
  gitopsImplementation as Checklist,
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
