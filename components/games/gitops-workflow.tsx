'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  GitBranch,
  GitCommit,
  Cloud,
  Server,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Home,
  Info,
  GitPullRequest,
  FileCode,
  Activity,
  Clock,
  Zap,
  Shield,
  Eye,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
      'GitOps principle: Git is the single source of truth. The operator should automatically reconcile the cluster state to match what\'s declared in Git. This ensures consistency and prevents configuration drift.',
  },
  {
    id: 'rollback',
    title: 'Deployment Rollback',
    description: 'A new deployment is causing errors in production',
    scenario:
      'Version v2.0.0 was deployed but is showing errors. The health status is degraded. You need to rollback quickly.',
    question: 'What\'s the GitOps way to rollback?',
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
      'You\'re setting up GitOps for a critical production environment. Should you enable automatic sync or require manual approval?',
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
  { type: 'feat', messages: ['Add new microservice', 'Implement webhook handler', 'Add GraphQL API', 'Add monitoring dashboard', 'Implement rate limiting'] },
  { type: 'fix', messages: ['Fix database connection pool', 'Resolve CORS issues', 'Fix memory leak', 'Patch security vulnerability', 'Fix broken health check'] },
  { type: 'chore', messages: ['Update dependencies', 'Bump Go version to 1.21', 'Update Dockerfile', 'Refactor deployment configs', 'Update CI/CD pipeline'] },
  { type: 'perf', messages: ['Optimize database queries', 'Add connection pooling', 'Enable compression', 'Add CDN caching', 'Optimize container images'] },
  { type: 'docs', messages: ['Update API documentation', 'Add architecture diagrams', 'Update README', 'Document deployment process', 'Add troubleshooting guide'] },
];

const authors = ['alice', 'bob', 'charlie', 'david', 'eve', 'frank', 'grace', 'henry'];

export default function GitOpsWorkflow() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [commits, setCommits] = useState<GitCommit[]>(sampleCommits);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('healthy');
  const [autoSync, setAutoSync] = useState(true);
  const [pendingSync, setPendingSync] = useState(false);
  const [nextCommitId, setNextCommitId] = useState(7);
  const [hasDrift, setHasDrift] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [insights, setInsights] = useState<string[]>([]);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      // Update commits to show deployed
      setCommits((prev) =>
        prev.map((commit) => ({
          ...commit,
          deployed: commit.id === commitId ? true : commit.deployed,
        }))
      );

      if (autoSync) {
        // Auto sync enabled - automatically deploy
        addInsight(`🚀 Commit ${commitId} pushed to Git`);
        addInsight('🔄 Auto-sync enabled - deploying automatically...');
        setSyncStatus('syncing');
        setHealthStatus('progressing');

        setTimeout(() => {
          setSyncStatus('synced');
          setHealthStatus('healthy');
          addInsight('✅ Deployment successful - cluster synced with Git');
        }, 2500);
      } else {
        // Auto sync disabled - manual sync required
        addInsight(`🚀 Commit ${commitId} pushed to Git`);
        addInsight('⚠️ Auto-sync disabled - manual sync required');
        setSyncStatus('out-of-sync');
        setHealthStatus('unknown');
        setPendingSync(true);
      }
    },
    [addInsight, autoSync]
  );

  const handleManualSync = useCallback(() => {
    if (!pendingSync) return;
    
    addInsight('🔄 Manual sync triggered...');
    setSyncStatus('syncing');
    setHealthStatus('progressing');
    setPendingSync(false);

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

  // Intro Phase
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link href="/games">
              <Button variant="ghost" size="sm">
                <Home className="w-4 h-4 mr-2" />
                Games
              </Button>
            </Link>
            <Badge variant="secondary" className="text-sm">
              <GitBranch className="w-3 h-3 mr-1" />
              GitOps Learning
            </Badge>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 mb-4">
              <GitBranch className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4">GitOps Workflow Simulator</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Learn GitOps principles through interactive scenarios
            </p>
          </motion.div>

          <div className="grid gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Info className="w-5 h-5 mr-2 text-blue-500" />
                  What is GitOps?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  GitOps is a modern approach to continuous deployment where Git serves as the single source of truth
                  for declarative infrastructure and applications.
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-blue-100/60 dark:bg-blue-950/20">
                    <GitCommit className="w-6 h-6 text-blue-500 mb-2" />
                    <h3 className="font-semibold mb-1">Git as Source of Truth</h3>
                    <p className="text-sm text-muted-foreground">
                      All desired state is stored in Git repositories
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-purple-100/60 dark:bg-purple-950/20">
                    <RefreshCw className="w-6 h-6 text-purple-500 mb-2" />
                    <h3 className="font-semibold mb-1">Automated Sync</h3>
                    <p className="text-sm text-muted-foreground">
                      Operators continuously reconcile actual state with desired state
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-green-100/60 dark:bg-green-950/20">
                    <Eye className="w-6 h-6 text-green-500 mb-2" />
                    <h3 className="font-semibold mb-1">Drift Detection</h3>
                    <p className="text-sm text-muted-foreground">
                      Automatic detection and correction of configuration drift
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>What You'll Learn</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>How GitOps operators synchronize Git state with Kubernetes clusters</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Understanding sync status, health status, and configuration drift</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>When to use automatic sync vs manual approval</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>How to handle deployments, rollbacks, and drift correction</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <Button size="lg" onClick={() => setPhase('interactive')} className="text-lg px-8">
              Start Learning
              <Play className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Interactive Workflow Phase
  if (phase === 'interactive') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link href="/games">
              <Button variant="ghost" size="sm">
                <Home className="w-4 h-4 mr-2" />
                Games
              </Button>
            </Link>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetGame}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button size="sm" onClick={() => setPhase('challenges')}>
                Continue to Challenges
              </Button>
            </div>
          </div>

          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-3xl font-bold mb-6 text-center"
          >
            GitOps Workflow Simulator
          </motion.h1>

          {/* Status Dashboard */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Sync Status</p>
                    <p className="text-lg font-semibold capitalize">{syncStatus}</p>
                  </div>
                  {syncStatus === 'synced' && <CheckCircle2 className="w-8 h-8 text-green-500" />}
                  {syncStatus === 'out-of-sync' && <AlertTriangle className="w-8 h-8 text-yellow-500" />}
                  {syncStatus === 'syncing' && <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />}
                  {syncStatus === 'failed' && <XCircle className="w-8 h-8 text-red-500" />}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Health Status</p>
                    <p className="text-lg font-semibold capitalize">{healthStatus}</p>
                  </div>
                  {healthStatus === 'healthy' && <CheckCircle2 className="w-8 h-8 text-green-500" />}
                  {healthStatus === 'degraded' && <AlertTriangle className="w-8 h-8 text-yellow-500" />}
                  {healthStatus === 'progressing' && <Activity className="w-8 h-8 text-blue-500 animate-pulse" />}
                  {healthStatus === 'unknown' && <XCircle className="w-8 h-8 text-gray-500" />}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Auto Sync</p>
                    <p className="text-lg font-semibold">{autoSync ? 'Enabled' : 'Disabled'}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newAutoSync = !autoSync;
                      setAutoSync(newAutoSync);
                      addInsight(
                        newAutoSync
                          ? '🔄 Auto-sync enabled - changes will sync automatically'
                          : '⏸️ Auto-sync disabled - manual sync required for changes'
                      );
                    }}
                    className={cn(autoSync && 'border-green-500 text-green-600 dark:text-green-400')}
                  >
                    {autoSync ? 'On' : 'Off'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Deployed</p>
                    <p className="text-lg font-semibold">{commits.filter((c) => c.deployed).length} commits</p>
                  </div>
                  <GitCommit className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Git Repository */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <GitBranch className="w-5 h-5 mr-2" />
                  Git Repository (Source of Truth)
                </CardTitle>
                <CardDescription>
                  Push new commits and deploy to Kubernetes cluster
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Button onClick={generateRandomCommit} variant="outline" className="w-full">
                    <GitCommit className="w-4 h-4 mr-2" />
                    Create New Commit
                  </Button>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {commits.map((commit) => (
                    <motion.div
                      key={commit.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        'p-3 rounded-lg border',
                        commit.deployed
                          ? 'bg-green-100 border-green-300 dark:bg-green-950/20 dark:border-green-900'
                          : 'bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-700'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                              {commit.sha}
                            </code>
                            <span className="text-xs text-muted-foreground">{commit.timestamp}</span>
                          </div>
                          <p className="text-sm font-medium mb-1">{commit.message}</p>
                          <p className="text-xs text-muted-foreground">by {commit.author}</p>
                        </div>
                        {commit.deployed ? (
                          <Badge variant="secondary" className="ml-2">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Deployed
                          </Badge>
                        ) : (
                          <Button size="sm" onClick={() => handleDeploy(commit.id)} className="ml-2">
                            <GitPullRequest className="w-3 h-3 mr-1" />
                            Deploy
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Kubernetes Cluster */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Cloud className="w-5 h-5 mr-2" />
                  Kubernetes Cluster (Live State)
                </CardTitle>
                <CardDescription>GitOps operator monitors and syncs state</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-blue-100/50 border border-blue-300 dark:bg-blue-950/20 dark:border-blue-900">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">GitOps Operator</h3>
                      <RefreshCw
                        className={cn(
                          'w-5 h-5 text-blue-500',
                          syncStatus === 'syncing' && 'animate-spin'
                        )}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">Continuously reconciles desired state</p>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">
                        Watching Git
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Auto-heal: {autoSync ? 'On' : 'Off'}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-100 border border-slate-300 dark:bg-slate-900 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold flex items-center">
                        <Server className="w-4 h-4 mr-2" />
                        Production Deployment
                      </h3>
                      {healthStatus === 'healthy' && (
                        <Badge variant="secondary" className="bg-green-600 text-white dark:bg-green-950 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Healthy
                        </Badge>
                      )}
                      {healthStatus === 'degraded' && (
                        <Badge variant="secondary" className="bg-yellow-600 text-white dark:bg-yellow-950 dark:text-yellow-400">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Degraded
                        </Badge>
                      )}
                      {healthStatus === 'progressing' && (
                        <Badge variant="secondary" className="bg-blue-600 text-white dark:bg-blue-950 dark:text-blue-400">
                          <Activity className="w-3 h-3 mr-1" />
                          Progressing
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Replicas:</span>
                        <span className="font-mono">3/3</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Version:</span>
                        <code className="text-xs bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {commits.find((c) => c.deployed)?.sha || 'none'}
                        </code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Sync:</span>
                        <span className="font-mono text-xs">Just now</span>
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" onClick={handleDriftScenario} className="w-full">
                    <Zap className="w-4 h-4 mr-2" />
                    Simulate Configuration Drift
                  </Button>

                  {pendingSync && (
                    <Alert className="border-orange-500">
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription>
                        <strong>Manual Sync Required</strong>
                        <p className="text-sm mt-1">
                          Auto-sync is disabled. Click below to manually sync the cluster.
                        </p>
                        <Button onClick={handleManualSync} className="mt-2 w-full" size="sm">
                          <RefreshCw className="w-3 h-3 mr-2" />
                          Sync Now
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Activity Feed */}
          {insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Activity Feed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {insights.map((insight, index) => (
                      <motion.div
                        key={`${insight}-${index}`}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 rounded-lg bg-slate-100 border border-slate-300 dark:bg-slate-900 dark:border-slate-700 text-sm"
                      >
                        {insight}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Challenges Phase
  if (phase === 'challenges') {
    const challenge = challenges[currentChallenge];
    const isCorrect = selectedAnswer === challenge.correctAnswer;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link href="/games">
              <Button variant="ghost" size="sm">
                <Home className="w-4 h-4 mr-2" />
                Games
              </Button>
            </Link>
            <div className="flex gap-2">
              <Badge variant="secondary">
                Challenge {currentChallenge + 1}/{challenges.length}
              </Badge>
              <Badge variant="secondary">
                Score: {score}/{challenges.length}
              </Badge>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950">
                    <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <CardTitle>{challenge.title}</CardTitle>
                    <CardDescription>{challenge.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Alert className="mb-6">
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Scenario:</strong> {challenge.scenario}
                  </AlertDescription>
                </Alert>

                <h3 className="font-semibold mb-4">{challenge.question}</h3>

                <div className="space-y-3 mb-6">
                  {challenge.options.map((option, index) => (
                    <motion.button
                      key={index}
                      whileHover={{ scale: selectedAnswer === null ? 1.02 : 1 }}
                      whileTap={{ scale: selectedAnswer === null ? 0.98 : 1 }}
                      onClick={() => selectedAnswer === null && handleAnswerSelect(index)}
                      disabled={selectedAnswer !== null}
                      className={cn(
                        'w-full p-4 rounded-lg border-2 text-left transition-all',
                        'hover:border-blue-300 dark:hover:border-blue-700',
                        selectedAnswer === null &&
                          'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700',
                        selectedAnswer === index &&
                          index === challenge.correctAnswer &&
                          'bg-green-100/60 dark:bg-green-950/20 border-green-500',
                        selectedAnswer === index &&
                          index !== challenge.correctAnswer &&
                          'bg-red-50 dark:bg-red-950/20 border-red-500',
                        selectedAnswer !== null &&
                          selectedAnswer !== index &&
                          index === challenge.correctAnswer &&
                          'bg-green-100/60 dark:bg-green-950/20 border-green-500',
                        selectedAnswer !== null &&
                          selectedAnswer !== index &&
                          index !== challenge.correctAnswer &&
                          'opacity-50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span>{option}</span>
                        {selectedAnswer === index && index === challenge.correctAnswer && (
                          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                        )}
                        {selectedAnswer === index && index !== challenge.correctAnswer && (
                          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>

                <AnimatePresence>
                  {showExplanation && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <Alert className={cn(isCorrect ? 'border-green-500' : 'border-orange-500')}>
                        <Info className="w-4 h-4" />
                        <AlertDescription>
                          <strong>{isCorrect ? '✅ Correct!' : '📚 Learning Moment:'}</strong>
                          <p className="mt-2">{challenge.explanation}</p>
                        </AlertDescription>
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>

            {showExplanation && (
              <div className="flex justify-center">
                <Button size="lg" onClick={handleNextChallenge}>
                  {currentChallenge < challenges.length - 1 ? 'Next Challenge' : 'View Results'}
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // Complete Phase
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 mb-6">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Great Work!</h1>
          <p className="text-xl text-muted-foreground">
            You\'ve completed the GitOps Workflow Simulator
          </p>
        </motion.div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <div className="text-5xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                {score}/{challenges.length}
              </div>
              <p className="text-muted-foreground">Challenges Completed</p>
            </div>

            <div className="grid gap-4">
              <div className="p-4 rounded-lg bg-blue-100/60 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <GitBranch className="w-5 h-5 text-blue-500" />
                  <h3 className="font-semibold">Key Takeaways</h3>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✓ Git is the single source of truth for all infrastructure and application state</li>
                  <li>✓ GitOps operators continuously reconcile desired state with actual state</li>
                  <li>✓ Automatic sync with self-heal prevents configuration drift</li>
                  <li>✓ Rollbacks are done by reverting Git commits, maintaining audit trail</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg bg-purple-100/60 dark:bg-purple-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <FileCode className="w-5 h-5 text-purple-500" />
                  <h3 className="font-semibold">Next Steps</h3>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Explore ArgoCD, Flux, or other GitOps tools</li>
                  <li>• Set up a GitOps pipeline for your own projects</li>
                  <li>• Learn about GitOps security best practices</li>
                  <li>• Experiment with multi-cluster GitOps deployments</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 justify-center">
          <Button variant="outline" size="lg" onClick={resetGame}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Link href="/games">
            <Button size="lg">
              <Home className="w-4 h-4 mr-2" />
              More Games
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
