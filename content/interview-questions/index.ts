import type { InterviewQuestion } from '@/lib/interview-utils';

import kubernetesPodLifecycle from './kubernetes-pod-lifecycle.json';
import dockerLayersCaching from './docker-layers-caching.json';
import cicdBlueGreenDeployment from './cicd-blue-green-deployment.json';
import terraformStateManagement from './terraform-state-management.json';
import linuxProcessDebugging from './linux-process-debugging.json';
import gitRebaseVsMerge from './git-rebase-vs-merge.json';
import awsVpcNetworking from './aws-vpc-networking.json';

export const interviewQuestions: InterviewQuestion[] = [
  kubernetesPodLifecycle as InterviewQuestion,
  dockerLayersCaching as InterviewQuestion,
  cicdBlueGreenDeployment as InterviewQuestion,
  terraformStateManagement as InterviewQuestion,
  linuxProcessDebugging as InterviewQuestion,
  gitRebaseVsMerge as InterviewQuestion,
  awsVpcNetworking as InterviewQuestion,
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
