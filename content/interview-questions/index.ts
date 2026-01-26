import type { InterviewQuestion } from '@/lib/interview-utils';
import type { ExperienceTier } from '@/lib/interview-utils';

// Junior tier
import linuxFilePermissions from './linux-file-permissions.json';
import linuxSystemLogs from './linux-system-logs.json';
import linuxGrepTextSearch from './linux-grep-text-search.json';
import environmentVariables from './environment-variables.json';
import sshBasics from './ssh-basics.json';
import networkingBasicsDns from './networking-basics-dns.json';
import linuxPackageManagement from './linux-package-management.json';
import bashScriptingBasics from './bash-scripting-basics.json';
import dockerBasics from './docker-basics.json';
import cicdPipelineStages from './cicd-pipeline-stages.json';
import gitBasics from './git-basics.json';
import monitoringGoldenSignals from './monitoring-golden-signals.json';
import gitRebaseVsMerge from './git-rebase-vs-merge.json';
import awsVpcNetworking from './aws-vpc-networking.json';
import tcpIpBasics from './tcp-ip-basics.json';
import httpBasics from './http-basics.json';
import cloudIamBasics from './cloud-iam-basics.json';
import gitBranchingStrategies from './git-branching-strategies.json';
import dockerfileBestPractices from './dockerfile-best-practices.json';
import cloudRegionsAvailabilityZones from './cloud-regions-availability-zones.json';
import containerOrchestrationBasics from './container-orchestration-basics.json';
import gitWorkflowStrategies from './git-workflow-strategies.json';
import shellScriptingFundamentals from './shell-scripting-fundamentals.json';
import configurationManagementBasics from './configuration-management-basics.json';
import yamlJsonBasics from './yaml-json-basics.json';
// Mid tier
import kubernetesPodLifecycle from './kubernetes-pod-lifecycle.json';
import dockerLayersCaching from './docker-layers-caching.json';
import cicdBlueGreenDeployment from './cicd-blue-green-deployment.json';
import terraformStateManagement from './terraform-state-management.json';
import kubernetesKubelet from './kubernetes-kubelet.json';
import sliSloSla from './sli-slo-sla.json';
import immutableInfrastructure from './immutable-infrastructure.json';
import kubernetesServicesNetworking from './kubernetes-services-networking.json';
import infrastructureAsCodePatterns from './infrastructure-as-code-patterns.json';
import cicdPipelineDesign from './cicd-pipeline-design.json';
import monitoringAlertingStrategy from './monitoring-alerting-strategy.json';
import serviceMeshConcepts from './service-mesh-concepts.json';
import secretsManagement from './secrets-management.json';
import databaseBackupRecovery from './database-backup-recovery.json';
import logAggregationStrategies from './log-aggregation-strategies.json';
import performanceOptimization from './performance-optimization.json';
import gitopsPrinciples from './gitops-principles.json';
// Senior tier
import linuxProcessDebugging from './linux-process-debugging.json';
import chaosEngineering from './chaos-engineering.json';
import incidentPostmortem from './incident-postmortem.json';
import systemDesignReliability from './system-design-reliability.json';
import disasterRecoveryPlanning from './disaster-recovery-planning.json';
import securityArchitecture from './security-architecture.json';
import cloudCostOptimization from './cloud-cost-optimization.json';
import multiCloudArchitecture from './multi-cloud-architecture.json';
import complianceGovernance from './compliance-governance.json';
import capacityPlanning from './capacity-planning.json';
import platformTeamScaling from './platform-team-scaling.json';
import finopsCostManagement from './finops-cost-management.json';
import zeroTrustArchitecture from './zero-trust-architecture.json';

export const interviewQuestions: InterviewQuestion[] = [
  // Junior tier
  linuxFilePermissions as InterviewQuestion,
  linuxSystemLogs as InterviewQuestion,
  linuxGrepTextSearch as InterviewQuestion,
  environmentVariables as InterviewQuestion,
  sshBasics as InterviewQuestion,
  networkingBasicsDns as InterviewQuestion,
  linuxPackageManagement as InterviewQuestion,
  bashScriptingBasics as InterviewQuestion,
  dockerBasics as InterviewQuestion,
  cicdPipelineStages as InterviewQuestion,
  gitBasics as InterviewQuestion,
  monitoringGoldenSignals as InterviewQuestion,
  gitRebaseVsMerge as InterviewQuestion,
  awsVpcNetworking as InterviewQuestion,
  tcpIpBasics as InterviewQuestion,
  httpBasics as InterviewQuestion,
  cloudIamBasics as InterviewQuestion,
  gitBranchingStrategies as InterviewQuestion,
  dockerfileBestPractices as InterviewQuestion,
  cloudRegionsAvailabilityZones as InterviewQuestion,
  containerOrchestrationBasics as InterviewQuestion,
  gitWorkflowStrategies as InterviewQuestion,
  shellScriptingFundamentals as InterviewQuestion,
  configurationManagementBasics as InterviewQuestion,
  yamlJsonBasics as InterviewQuestion,
  // Mid tier
  kubernetesPodLifecycle as InterviewQuestion,
  dockerLayersCaching as InterviewQuestion,
  cicdBlueGreenDeployment as InterviewQuestion,
  terraformStateManagement as InterviewQuestion,
  kubernetesKubelet as InterviewQuestion,
  sliSloSla as InterviewQuestion,
  immutableInfrastructure as InterviewQuestion,
  kubernetesServicesNetworking as InterviewQuestion,
  infrastructureAsCodePatterns as InterviewQuestion,
  cicdPipelineDesign as InterviewQuestion,
  monitoringAlertingStrategy as InterviewQuestion,
  serviceMeshConcepts as InterviewQuestion,
  secretsManagement as InterviewQuestion,
  databaseBackupRecovery as InterviewQuestion,
  logAggregationStrategies as InterviewQuestion,
  performanceOptimization as InterviewQuestion,
  gitopsPrinciples as InterviewQuestion,
  // Senior tier
  linuxProcessDebugging as InterviewQuestion,
  chaosEngineering as InterviewQuestion,
  incidentPostmortem as InterviewQuestion,
  systemDesignReliability as InterviewQuestion,
  disasterRecoveryPlanning as InterviewQuestion,
  securityArchitecture as InterviewQuestion,
  cloudCostOptimization as InterviewQuestion,
  multiCloudArchitecture as InterviewQuestion,
  complianceGovernance as InterviewQuestion,
  capacityPlanning as InterviewQuestion,
  platformTeamScaling as InterviewQuestion,
  finopsCostManagement as InterviewQuestion,
  zeroTrustArchitecture as InterviewQuestion,
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

export const getQuestionCountsByTier = (): Record<ExperienceTier, number> => {
  return {
    junior: interviewQuestions.filter(q => q.tier === 'junior').length,
    mid: interviewQuestions.filter(q => q.tier === 'mid').length,
    senior: interviewQuestions.filter(q => q.tier === 'senior').length,
  };
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
