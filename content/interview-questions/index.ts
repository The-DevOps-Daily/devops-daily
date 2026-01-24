import type { InterviewQuestion } from '@/lib/interview-utils';
import type { InterviewQuestion, ExperienceTier } from '@/lib/interview-utils';

// Junior tier
import linuxFilePermissions from './linux-file-permissions.json';
import dockerBasics from './docker-basics.json';
import cicdPipelineStages from './cicd-pipeline-stages.json';
import gitBasics from './git-basics.json';
import monitoringGoldenSignals from './monitoring-golden-signals.json';
import gitRebaseVsMerge from './git-rebase-vs-merge.json';
import awsVpcNetworking from './aws-vpc-networking.json';
// Mid tier
import kubernetesPodLifecycle from './kubernetes-pod-lifecycle.json';
import dockerLayersCaching from './docker-layers-caching.json';
import cicdBlueGreenDeployment from './cicd-blue-green-deployment.json';
import terraformStateManagement from './terraform-state-management.json';
import kubernetesKubelet from './kubernetes-kubelet.json';
import sliSloSla from './sli-slo-sla.json';
import immutableInfrastructure from './immutable-infrastructure.json';
// Senior tier
import linuxProcessDebugging from './linux-process-debugging.json';
import chaosEngineering from './chaos-engineering.json';
import incidentPostmortem from './incident-postmortem.json';

export const interviewQuestions: InterviewQuestion[] = [
  // Junior tier
  linuxFilePermissions as InterviewQuestion,
  dockerBasics as InterviewQuestion,
  cicdPipelineStages as InterviewQuestion,
  gitBasics as InterviewQuestion,
  monitoringGoldenSignals as InterviewQuestion,
  gitRebaseVsMerge as InterviewQuestion,
  awsVpcNetworking as InterviewQuestion,
  // Mid tier
  kubernetesPodLifecycle as InterviewQuestion,
  dockerLayersCaching as InterviewQuestion,
  cicdBlueGreenDeployment as InterviewQuestion,
  terraformStateManagement as InterviewQuestion,
  kubernetesKubelet as InterviewQuestion,
  sliSloSla as InterviewQuestion,
  immutableInfrastructure as InterviewQuestion,
  // Senior tier
  linuxProcessDebugging as InterviewQuestion,
  chaosEngineering as InterviewQuestion,
  incidentPostmortem as InterviewQuestion,
];

export const getQuestionBySlug = (slug: string): InterviewQuestion | undefined => {
  return interviewQuestions.find(q => q.slug === slug);
};

export const getQuestionsByCategory = (category: string): InterviewQuestion[] => {
  return interviewQuestions.filter(q => q.category === category);
};

export const getQuestionsByDifficulty = (difficulty: string): InterviewQuestion[] => {
  return interviewQuestions.filter(q => q.difficulty === difficulty);
};

export const getQuestionsByTier = (tier: ExperienceTier): InterviewQuestion[] => {
  return interviewQuestions.filter(q => q.tier === tier);
};

export const getQuestionsByTag = (tag: string): InterviewQuestion[] => {
  return interviewQuestions.filter(q => q.tags.includes(tag));
};

export const getAllCategories = (): string[] => {
  return Array.from(new Set(interviewQuestions.map(q => q.category))).sort();
};

export const getAllTags = (): string[] => {
  const tags = interviewQuestions.flatMap(q => q.tags);
  return Array.from(new Set(tags)).sort();
};

export const getAllTiers = (): ExperienceTier[] => {
  return ['junior', 'mid', 'senior'];
};
