'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  CircleCheck,
  CircleX,
  GitBranch,
  GitCommit,
  Cloud,
  Server,
  RefreshCw,
  AlertTriangle,
  Play,
  GitPullRequest,
  Activity,
  Clock,
  Zap,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimHowTo,
  SimResetButton,
  SimStage,
  SIM_CATEGORY,
  SIM_TONE,
} from '@/components/games/sim';

// Types
type Phase = 'intro' | 'interactive' | 'challenges' | 'complete';
type SyncStatus = 'synced' | 'out-of-sync' | 'syncing' | 'failed';
type HealthStatus = 'healthy' | 'degraded' | 'progressing' | 'unknown';

interface GitCommit {
  id: string;
  sha: string;
  message: string;
  author: string;
  timestamp: string;
  deployed: boolean;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  scenario: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

const challenges: Challenge[] = [
  {
    id: 'drift',
    title: 'Configuration Drift',
    description: 'Someone manually changed the replica count in production',
    scenario:
      'Your production deployment shows 5 replicas, but Git declares only 3. The GitOps operator detected configuration drift.',
    question: 'What should the GitOps operator do?',
    options: [
      'Leave it as is - manual changes are fine',
      'Automatically reconcile to match Git (3 replicas)',
      'Alert the team but keep 5 replicas',
      'Merge the change back to Git',
    ],
    correctAnswer: 1,
    explanation:
      "GitOps principle: Git is the single source of truth. The operator should automatically reconcile the cluster state to match what's declared in Git. This ensures consistency and prevents configuration drift.",
  },
  {
    id: 'rollback',
    title: 'Deployment Rollback',
    description: 'A new deployment is causing errors in production',
    scenario:
      'Version v2.0.0 was deployed but is showing errors. The health status is degraded. You need to rollback quickly.',
    question: "What's the GitOps way to rollback?",
    options: [
      'Run kubectl rollout undo directly',
      'Delete the failing pods manually',
      'Revert the Git commit and let GitOps sync',
      'Scale down the deployment to 0',
    ],
    correctAnswer: 2,
    explanation:
      'In GitOps, you rollback by reverting the commit in Git. The GitOps operator will detect the change and automatically deploy the previous version. This maintains Git as the source of truth and creates an audit trail.',
  },
  {
    id: 'sync-policy',
    title: 'Sync Policy Decision',
    description: 'Choosing between manual and automatic sync',
    scenario:
      "You're setting up GitOps for a critical production environment. Should you enable automatic sync or require manual approval?",
    question: 'Which sync policy is best for critical production workloads?',
    options: [
      'Automatic sync - always stay in sync',
      'Manual sync - review every change',
      'Automatic sync with self-heal and prune',
      'No sync - manual kubectl only',
    ],
    correctAnswer: 2,
    explanation:
      'Best practice: Enable automatic sync with self-heal (corrects drift) and prune (removes orphaned resources). Use Git protections (branch policies, reviews) for safety. This gives you automation without sacrificing control.',
  },
];

const sampleCommits: GitCommit[] = [
  {
    id: '1',
    sha: 'a1b2c3d',
    message: 'feat: Add authentication service',
    author: 'alice',
    timestamp: '1m ago',
    deployed: false,
  },
  {
    id: '2',
    sha: 'e4f5g6h',
    message: 'feat: Add payment API endpoint',
    author: 'bob',
    timestamp: '3m ago',
    deployed: false,
  },
  {
    id: '3',
    sha: 'i7j8k9l',
    message: 'fix: Increase replica count to 3',
    author: 'charlie',
    timestamp: '8m ago',
    deployed: false,
  },
  {
    id: '4',
    sha: 'm1n2o3p',
    message: 'chore: Update Kubernetes manifests',
    author: 'david',
    timestamp: '10m ago',
    deployed: false,
  },
  {
    id: '5',
    sha: 'q4r5s6t',
    message: 'feat: Add caching layer with Redis',
    author: 'eve',
    timestamp: '15m ago',
    deployed: false,
  },
  {
    id: '6',
    sha: 'u7v8w9x',
    message: 'fix: Resolve memory leak in worker',
    author: 'frank',
    timestamp: '20m ago',
    deployed: true,
  },
];

// Additional commit messages for dynamic generation
const commitTemplates = [
  {
    type: 'feat',
    messages: [
      'Add new microservice',
      'Implement webhook handler',
      'Add GraphQL API',
      'Add monitoring dashboard',
      'Implement rate limiting',
    ],
  },
  {
    type: 'fix',
    messages: [
      'Fix database connection pool',
      'Resolve CORS issues',
      'Fix memory leak',
      'Patch security vulnerability',
      'Fix broken health check',
    ],
  },
  {
    type: 'chore',
    messages: [
      'Update dependencies',
      'Bump Go version to 1.21',
      'Update Dockerfile',
      'Refactor deployment configs',
      'Update CI/CD pipeline',
    ],
  },
  {
    type: 'perf',
    messages: [
      'Optimize database queries',
      'Add connection pooling',
      'Enable compression',
      'Add CDN caching',
      'Optimize container images',
    ],
  },
  {
    type: 'docs',
    messages: [
      'Update API documentation',
      'Add architecture diagrams',
      'Update README',
      'Document deployment process',
      'Add troubleshooting guide',
    ],
  },
];

const authors = ['alice', 'bob', 'charlie', 'david', 'eve', 'frank', 'grace', 'henry'];

const PRINCIPLES = [
  {
    icon: GitCommit,
    title: 'Git as Source of Truth',
    description: 'All desired state is stored in Git repositories',
  },
  {
    icon: RefreshCw,
    title: 'Automated Sync',
    description: 'Operators continuously reconcile actual state with desired state',
  },
  {
    icon: Eye,
    title: 'Drift Detection',
    description: 'Automatic detection and correction of configuration drift',
  },
];

function StatusTile({ title, status }: { title: string; status: SyncStatus | HealthStatus }) {
  const icon =
    status === 'synced' || status === 'healthy' ? (
      <CircleCheck className="h-3 w-3 text-correct-foreground" />
    ) : status === 'syncing' || status === 'progressing' ? (
      <RefreshCw className="h-3 w-3 text-info-foreground motion-safe:animate-spin" />
    ) : status === 'out-of-sync' || status === 'degraded' ? (
      <AlertTriangle className="h-3 w-3 text-partial-foreground" />
    ) : status === 'failed' ? (
      <CircleX className="h-3 w-3 text-wrong-foreground" />
    ) : (
      <CircleX className="h-3 w-3 text-muted-foreground" />
    );
  return (
    <div className="rounded-md border bg-card p-2">
      <div className="mb-1 flex items-center gap-1">
        {icon}
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
      </div>
      <div className="text-xs font-medium capitalize">{status}</div>
    </div>
  );
}

export default function GitOpsWorkflow() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [commits, setCommits] = useState<GitCommit[]>(sampleCommits);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('healthy');
  const [autoSync, setAutoSync] = useState(true);
  const [pendingSync, setPendingSync] = useState(false);
  const [nextCommitId, setNextCommitId] = useState(7);
  const [hasDrift, setHasDrift] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<
    'idle' | 'git-to-argocd' | 'argocd-to-k8s' | 'complete'
  >('idle');
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [insights, setInsights] = useState<string[]>([]);
  const [tab, setTab] = useState('git');
  const [announce, setAnnounce] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);

  const addInsight = useCallback((message: string) => {
    setInsights((prev) => [...prev.slice(-4), message]);
  }, []);
  // Effect: When auto-sync is enabled and there's drift or pending sync, auto-heal
  useEffect(() => {
    if (autoSync && (hasDrift || pendingSync)) {
      addInsight('🔄 Auto-sync enabled - initiating reconciliation...');
      setSyncStatus('syncing');
      setHealthStatus('progressing');
      setPendingSync(false);

      setTimeout(() => {
        setSyncStatus('synced');
        setHealthStatus('healthy');
        setHasDrift(false);
        if (hasDrift) {
          addInsight('✅ Drift corrected automatically - cluster reconciled with Git');
        } else {
          addInsight('✅ Auto-sync completed - cluster synced with Git');
        }
      }, 2000);
    }
  }, [autoSync, hasDrift, pendingSync, addInsight]);

  const generateRandomCommit = useCallback(() => {
    const template = commitTemplates[Math.floor(Math.random() * commitTemplates.length)];
    const message = template.messages[Math.floor(Math.random() * template.messages.length)];
    const author = authors[Math.floor(Math.random() * authors.length)];
    const sha = Math.random().toString(36).substring(2, 9);

    const newCommit: GitCommit = {
      id: nextCommitId.toString(),
      sha,
      message: `${template.type}: ${message}`,
      author,
      timestamp: 'Just now',
      deployed: false,
    };

    setCommits((prev) => [newCommit, ...prev]);
    setNextCommitId((prev) => prev + 1);
    addInsight(`📝 New commit by ${author}: ${newCommit.message}`);
  }, [nextCommitId, addInsight]);

  const handleDeploy = useCallback(
    (commitId: string) => {
      const commit = commits.find((c) => c.id === commitId);
      const commitHash = commit ? `\`${commit.sha}\`` : `#${commitId}`;

      // Update commits to show deployed
      setCommits((prev) =>
        prev.map((commit) => ({
          ...commit,
          deployed: commit.id === commitId ? true : commit.deployed,
        }))
      );

      // Start animation from Git to ArgoCD
      setAnimationPhase('git-to-argocd');
      setTimeout(() => setAnimationPhase('idle'), 800);

      if (autoSync) {
        // Auto sync enabled - automatically deploy
        addInsight(`🚀 Commit ${commitHash} pushed to Git`);
        addInsight('🔄 Auto-sync enabled - deploying automatically...');
        setSyncStatus('syncing');
        setHealthStatus('progressing');

        // Continue animation to Kubernetes
        setTimeout(() => {
          setAnimationPhase('argocd-to-k8s');
          setTimeout(() => setAnimationPhase('idle'), 1000);
        }, 800);

        setTimeout(() => {
          setSyncStatus('synced');
          setHealthStatus('healthy');
          addInsight(`✅ Deployment successful - ${commitHash} deployed to cluster`);
        }, 2500);
      } else {
        // Auto sync disabled - manual sync required
        addInsight(`🚀 Commit ${commitHash} pushed to Git`);
        addInsight('⚠️ Auto-sync disabled - manual sync required');
        setSyncStatus('out-of-sync');
        setHealthStatus('unknown');
        setPendingSync(true);
      }
    },
    [addInsight, autoSync, commits]
  );

  const handleManualSync = useCallback(() => {
    if (!pendingSync) return;

    addInsight('🔄 Manual sync triggered...');
    setSyncStatus('syncing');
    setHealthStatus('progressing');
    setPendingSync(false);

    // Animate ArgoCD to Kubernetes
    setAnimationPhase('argocd-to-k8s');
    setTimeout(() => setAnimationPhase('idle'), 1000);

    setTimeout(() => {
      setSyncStatus('synced');
      setHealthStatus('healthy');
      setHasDrift(false);
      addInsight('✅ Manual sync successful - cluster synced with Git');
    }, 2000);
  }, [pendingSync, addInsight, setHasDrift]);

  const handleDriftScenario = useCallback(() => {
    setSyncStatus('out-of-sync');
    setHealthStatus('degraded');
    setHasDrift(true);
    addInsight('⚠️ Configuration drift detected - manual change in cluster!');
    addInsight('🔍 Replicas: Git declares 3, cluster has 5');

    if (autoSync) {
      setTimeout(() => {
        setSyncStatus('syncing');
        addInsight('🔄 Auto-heal: Reconciling to match Git...');
        setAnimationPhase('argocd-to-k8s');
        setTimeout(() => setAnimationPhase('idle'), 1000);
        setTimeout(() => {
          setSyncStatus('synced');
          setHealthStatus('healthy');
          setHasDrift(false);
          addInsight('✅ Drift corrected automatically - cluster now has 3 replicas');
        }, 1500);
      }, 2000);
    } else {
      setTimeout(() => {
        addInsight('⚠️ Auto-heal disabled - drift persists');
        addInsight('💡 Tip: Enable auto-sync to automatically correct drift');
      }, 1500);
    }
  }, [autoSync, addInsight]);

  const resetGame = useCallback(() => {
    setPhase('intro');
    setCommits(sampleCommits);
    setSyncStatus('synced');
    setHealthStatus('healthy');
    setAutoSync(true);
    setPendingSync(false);
    setHasDrift(false);
    setAnimationPhase('idle');
    setNextCommitId(7);
    setCurrentChallenge(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore(0);
    setInsights([]);
  }, []);

  const handleAnswerSelect = useCallback(
    (answerIndex: number) => {
      setSelectedAnswer(answerIndex);
      setShowExplanation(true);

      if (answerIndex === challenges[currentChallenge].correctAnswer) {
        setScore((prev) => prev + 1);
      }
    },
    [currentChallenge]
  );

  const handleNextChallenge = useCallback(() => {
    if (currentChallenge < challenges.length - 1) {
      setCurrentChallenge((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setPhase('complete');
    }
  }, [currentChallenge]);

  const challenge = challenges[currentChallenge];
  const isCorrect = selectedAnswer === challenge.correctAnswer;
  const learned = [
    'Git is the single source of truth for all infrastructure and application state',
    'GitOps operators continuously reconcile desired state with actual state',
    'Automatic sync with self-heal prevents configuration drift',
    'Rollbacks are done by reverting Git commits, maintaining audit trail',
  ];

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame>
        <SimBar
          title="GitOps Workflow Simulator"
          icon={GitBranch}
          lead={
            <ol aria-label="Progress" className="flex gap-1.5">
              {['Board', ...challenges.map((item) => item.title)].map((title, index) => {
                const done =
                  phase === 'complete' ||
                  (index === 0 && phase === 'challenges') ||
                  (index > 0 &&
                    (index - 1 < currentChallenge ||
                      (index - 1 === currentChallenge && showExplanation)));
                const current =
                  (index === 0 && phase === 'interactive') ||
                  (index > 0 && phase === 'challenges' && index - 1 === currentChallenge);
                return (
                  <li
                    key={title}
                    className={cn(
                      'h-1.5 w-6 rounded-full',
                      done ? 'bg-correct' : current ? 'bg-primary' : 'bg-muted'
                    )}
                  >
                    <span className="sr-only">
                      {title}: {done ? 'done' : current ? 'current' : 'not started'}
                    </span>
                  </li>
                );
              })}
            </ol>
          }
          tools={phase !== 'intro' ? <SimResetButton onReset={resetGame} /> : undefined}
          progress={
            phase === 'challenges'
              ? { current: currentChallenge + 1, total: challenges.length }
              : undefined
          }
          heading={
            phase === 'intro'
              ? 'How GitOps works'
              : phase === 'interactive'
                ? 'The GitOps board'
                : phase === 'challenges'
                  ? challenge.title
                  : undefined
          }
          meta={
            phase === 'challenges' ? (
              <Badge variant="secondary" className="tabular-nums">
                Score {score}/{challenges.length}
              </Badge>
            ) : undefined
          }
          actions={
            phase === 'interactive' ? (
              <Button size="sm" className="h-10 lg:h-8" onClick={() => setPhase('challenges')}>
                Continue to Challenges <ArrowRight />
              </Button>
            ) : undefined
          }
          goal={
            phase === 'intro'
              ? 'See how Git, the GitOps operator and the cluster stay in sync, then try it on the board.'
              : phase === 'interactive'
                ? 'Deploy a commit, turn auto-sync off and sync by hand, then simulate drift. Continue to the challenges when you are ready.'
                : phase === 'challenges'
                  ? challenge.question
                  : undefined
          }
        />
        {phase === 'intro' && (
          <section className="space-y-3 rounded-lg border bg-card p-4">
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              GitOps is a modern approach to continuous deployment where Git serves as the single
              source of truth for declarative infrastructure and applications.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {PRINCIPLES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-md bg-muted/50 p-3">
                  <Icon className="mb-2 h-5 w-5 text-primary" />
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
            <SimHowTo summary="What you'll learn">
              <ul className="space-y-2">
                {[
                  'How GitOps operators synchronize Git state with Kubernetes clusters',
                  'Understanding sync status, health status, and configuration drift',
                  'When to use automatic sync vs manual approval',
                  'How to handle deployments, rollbacks, and drift correction',
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-correct-foreground" />
                    {item}
                  </li>
                ))}
              </ul>
            </SimHowTo>
            <Button className="h-10" onClick={() => setPhase('interactive')}>
              Start Learning <Play />
            </Button>
          </section>
        )}
        {phase === 'interactive' && (
          <>
            <section className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-1 items-center gap-2">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border',
                      SIM_CATEGORY.sky.fill,
                      SIM_CATEGORY.sky.border
                    )}
                  >
                    <GitBranch className="h-5 w-5 text-sky-700 dark:text-sky-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Git Repository</p>
                    <p className="text-xs text-muted-foreground">Source of Truth</p>
                  </div>
                </div>
                <div className="hidden flex-1 items-center gap-2 md:flex">
                  <div className="relative h-0.5 flex-1 bg-border">
                    <AnimatePresence>
                      {animationPhase === 'git-to-argocd' && (
                        <motion.div
                          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-sky-500"
                          initial={{ left: 0 }}
                          animate={{ left: '100%' }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.8, ease: 'linear' }}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex flex-1 items-center gap-2">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border',
                      animationPhase === 'argocd-to-k8s'
                        ? 'border-primary bg-primary/15'
                        : 'border-border bg-muted'
                    )}
                  >
                    <RefreshCw
                      className={cn(
                        'h-5 w-5',
                        animationPhase === 'argocd-to-k8s'
                          ? 'text-primary motion-safe:animate-spin'
                          : 'text-muted-foreground'
                      )}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">ArgoCD</p>
                    <p className="text-xs text-muted-foreground">GitOps Operator</p>
                  </div>
                </div>
                <div className="hidden flex-1 items-center gap-2 md:flex">
                  <div className="relative h-0.5 flex-1 bg-border">
                    <AnimatePresence>
                      {animationPhase === 'argocd-to-k8s' && (
                        <motion.div
                          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-correct"
                          initial={{ left: 0 }}
                          animate={{ left: '100%' }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 1, ease: 'linear' }}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex flex-1 items-center gap-2">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border',
                      healthStatus === 'healthy'
                        ? SIM_TONE.success.surface
                        : 'border-border bg-muted'
                    )}
                  >
                    <Cloud
                      className={cn(
                        'h-5 w-5',
                        healthStatus === 'healthy'
                          ? 'text-correct-foreground'
                          : 'text-muted-foreground'
                      )}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Kubernetes</p>
                    <p className="text-xs text-muted-foreground">Live Cluster</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 border-t pt-3">
                <AnimatePresence mode="wait">
                  {animationPhase === 'git-to-argocd' && (
                    <motion.div
                      key="git-push"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="flex items-center gap-2 text-sm text-info-foreground"
                    >
                      <span className="h-2 w-2 rounded-full bg-info motion-safe:animate-pulse" />
                      Commit pushed to Git repository...
                    </motion.div>
                  )}
                  {animationPhase === 'argocd-to-k8s' && (
                    <motion.div
                      key="syncing"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="flex items-center gap-2 text-sm text-correct-foreground"
                    >
                      <span className="h-2 w-2 rounded-full bg-correct motion-safe:animate-pulse" />
                      ArgoCD syncing to Kubernetes cluster...
                    </motion.div>
                  )}
                  {animationPhase === 'idle' && syncStatus === 'synced' && (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-sm text-correct-foreground"
                    >
                      <CircleCheck className="h-4 w-4" />
                      System in sync - waiting for changes...
                    </motion.div>
                  )}
                  {animationPhase === 'idle' && pendingSync && (
                    <motion.div
                      key="pending"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="flex items-center gap-2 text-sm text-partial-foreground"
                    >
                      <Clock className="h-4 w-4" />
                      Manual sync required (auto-sync disabled)
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>
            <SimStage
              columns="lg:grid-cols-3"
              tabsLabel="Board panels"
              tab={tab}
              onTabChange={setTab}
              minHeight="min-h-[20rem]"
              panels={[
                {
                  id: 'git',
                  label: 'Git',
                  content: (
                    <section className="space-y-2 rounded-lg border bg-card p-3">
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <GitBranch className="h-4 w-4" />
                          Git Repository
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Push new commits and deploy to Kubernetes cluster
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="h-10 w-full lg:h-8"
                        onClick={generateRandomCommit}
                      >
                        <GitCommit />
                        Create New Commit
                      </Button>
                      <div className="space-y-2">
                        {commits.map((commit) => (
                          <motion.div
                            key={commit.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={cn(
                              'rounded-md border p-2 text-sm',
                              commit.deployed && SIM_TONE.success.surface
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="mb-1 flex items-center gap-1">
                                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                                    {commit.sha}
                                  </code>
                                  <span className="text-xs text-muted-foreground">
                                    {commit.timestamp}
                                  </span>
                                </div>
                                <p className="text-sm font-medium">{commit.message}</p>
                              </div>
                              {commit.deployed ? (
                                <Badge variant="secondary">
                                  <CircleCheck />
                                  Done
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  className="h-10 lg:h-8"
                                  onClick={() => handleDeploy(commit.id)}
                                >
                                  <GitPullRequest />
                                  Deploy
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </section>
                  ),
                },
                {
                  id: 'argocd',
                  label: 'ArgoCD',
                  content: (
                    <section className="space-y-2 rounded-lg border bg-card p-3">
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <RefreshCw className="h-4 w-4" />
                          ArgoCD Operator
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Monitors Git and syncs to Kubernetes
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2.5">
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-xs font-semibold">Sync Status</h4>
                          <RefreshCw
                            className={cn(
                              'h-4 w-4 text-info-foreground',
                              syncStatus === 'syncing' && 'motion-safe:animate-spin'
                            )}
                          />
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Mode:</span>
                            <Badge variant="outline">Auto-sync: {autoSync ? 'On' : 'Off'}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <span className="font-medium capitalize">{syncStatus}</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <StatusTile title="Sync" status={syncStatus} />
                        <StatusTile title="Health" status={healthStatus} />
                        <div className="rounded-md bg-muted/50 p-2">
                          <div className="mb-1 flex items-center gap-1">
                            <Zap className="h-3 w-3 text-primary" />
                            <span className="text-xs font-semibold text-muted-foreground">
                              Auto-Sync
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant={autoSync ? 'default' : 'outline'}
                            aria-pressed={autoSync}
                            className="h-10 w-full lg:h-8"
                            onClick={() => {
                              setAutoSync(!autoSync);
                              if (!autoSync) setPendingSync(false);
                            }}
                          >
                            <Zap />
                            {autoSync ? 'Auto-sync on' : 'Auto-sync off'}
                          </Button>
                        </div>
                        <div className="rounded-md border bg-card p-2">
                          <div className="mb-1 flex items-center gap-1">
                            <GitCommit className="h-3 w-3 text-info-foreground" />
                            <span className="text-xs font-semibold text-muted-foreground">
                              Deployed
                            </span>
                          </div>
                          <div className="text-xs font-medium">
                            {commits.filter((c) => c.deployed).length} / {commits.length}
                          </div>
                        </div>
                      </div>
                      {insights.length > 0 && (
                        <div>
                          <h4 className="mb-2 flex items-center gap-1 text-xs font-semibold">
                            <Activity className="h-3.5 w-3.5" />
                            Activity Log
                          </h4>
                          <div className="space-y-1.5">
                            <AnimatePresence mode="popLayout">
                              {insights.map((insight, index) => (
                                <motion.div
                                  key={`${insight}-${index}`}
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0 }}
                                  className="rounded-md bg-muted/50 px-2 py-1 text-xs leading-snug"
                                >
                                  {insight.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '')}
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                        </div>
                      )}
                    </section>
                  ),
                },
                {
                  id: 'cluster',
                  label: 'Cluster',
                  content: (
                    <section className="space-y-2 rounded-lg border bg-card p-3">
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <Cloud className="h-4 w-4" />
                          Kubernetes Cluster
                        </h3>
                        <p className="text-xs text-muted-foreground">Live production state</p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2.5">
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="flex items-center gap-2 text-xs font-semibold">
                            <Server className="h-4 w-4" />
                            Deployment
                          </h4>
                          {healthStatus !== 'unknown' && (
                            <Badge
                              variant="secondary"
                              className={cn(
                                healthStatus === 'healthy'
                                  ? `${SIM_TONE.success.surface} ${SIM_TONE.success.text}`
                                  : healthStatus === 'degraded'
                                    ? `${SIM_TONE.warning.surface} ${SIM_TONE.warning.text}`
                                    : `${SIM_TONE.info.surface} ${SIM_TONE.info.text}`
                              )}
                            >
                              {healthStatus}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Replicas:</span>
                            <span className="font-mono">3/3</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Version:</span>
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                              {commits.find((c) => c.deployed)?.sha || 'none'}
                            </code>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Last Sync:</span>
                            <span className="font-mono">Just now</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="h-10 w-full lg:h-8"
                        onClick={handleDriftScenario}
                      >
                        <Zap />
                        Simulate Configuration Drift
                      </Button>
                      {pendingSync && (
                        <SimFeedback tone="warning" label="Manual sync required">
                          <p>Auto-sync is disabled. Click below to manually sync the cluster.</p>
                          <Button
                            size="sm"
                            className="h-10 w-full lg:h-8"
                            onClick={handleManualSync}
                          >
                            <RefreshCw />
                            Sync Now
                          </Button>
                        </SimFeedback>
                      )}
                    </section>
                  ),
                },
              ]}
            />
            <SimAnnouncer message={insights[insights.length - 1] ?? ''} />
          </>
        )}
        {phase === 'challenges' && (
          <section className="space-y-3 rounded-lg border bg-card p-3">
            <p className="text-sm text-muted-foreground">{challenge.description}</p>
            <SimFeedback tone="info" label="Scenario">
              <p>{challenge.scenario}</p>
            </SimFeedback>
            <ol className="space-y-2">
              {challenge.options.map((option, index) => {
                const correct = index === challenge.correctAnswer;
                const selected = selectedAnswer === index;
                return (
                  <li key={option}>
                    <button
                      type="button"
                      disabled={selectedAnswer !== null}
                      onClick={() => {
                        if (selectedAnswer === null) {
                          handleAnswerSelect(index);
                          setAnnounce(
                            `${correct ? 'Correct' : 'Not quite'}. ${challenge.explanation.split('. ')[0]}.`
                          );
                          requestAnimationFrame(() =>
                            resultRef.current?.focus({ preventScroll: true })
                          );
                        }
                      }}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-md border p-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selectedAnswer === null && 'hover:bg-muted/60',
                        selectedAnswer !== null && correct && SIM_TONE.success.surface,
                        selected && !correct && SIM_TONE.danger.surface,
                        selectedAnswer !== null && !selected && !correct && 'opacity-60'
                      )}
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="flex-1">{option}</span>
                      {selectedAnswer !== null && correct && (
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold',
                            SIM_TONE.success.surface,
                            SIM_TONE.success.text
                          )}
                        >
                          <CircleCheck className="h-3 w-3" />
                          Correct answer
                        </span>
                      )}
                      {selected && !correct && (
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold',
                            SIM_TONE.danger.surface,
                            SIM_TONE.danger.text
                          )}
                        >
                          <CircleX className="h-3 w-3" />
                          Your answer
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
            {showExplanation && (
              <>
                <SimFeedback
                  ref={resultRef}
                  tabIndex={-1}
                  tone={isCorrect ? 'success' : 'danger'}
                  label={isCorrect ? 'Correct' : 'Not quite'}
                >
                  <p>{challenge.explanation}</p>
                </SimFeedback>
                <Button className="h-10" onClick={handleNextChallenge}>
                  {currentChallenge < challenges.length - 1 ? 'Next Challenge' : 'View Results'}
                </Button>
              </>
            )}
            <SimAnnouncer message={announce} />
          </section>
        )}
        {phase === 'complete' && (
          <SimComplete
            title="Challenges complete"
            summary={`You answered ${score} of ${challenges.length} challenges correctly.`}
            stats={[
              { label: 'Correct answers', value: `${score}/${challenges.length}` },
              { label: 'Commits on the board', value: String(commits.length) },
            ]}
            learned={learned}
            onPlayAgain={resetGame}
            playAgainLabel="Try again"
          >
            <section className="rounded-lg border bg-card p-3">
              <h3 className="text-sm font-semibold">Next steps</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>Explore ArgoCD, Flux, or other GitOps tools</li>
                <li>Set up a GitOps pipeline for your own projects</li>
                <li>Learn about GitOps security best practices</li>
                <li>Experiment with multi-cluster GitOps deployments</li>
              </ul>
            </section>
          </SimComplete>
        )}
      </SimFrame>
    </MotionConfig>
  );
}
