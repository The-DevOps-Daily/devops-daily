'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal, X, Rocket, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Confetti from 'react-confetti';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { Badge } from '@/components/ui/badge';

interface CommandResponse {
  output: string[];
  type: 'success' | 'error' | 'info' | 'deploy';
}

const COMMANDS: Record<string, CommandResponse> = {
  help: {
    output: [
      'Available commands:',
      '  help              - Show this help message',
      '  whoami            - Display current user',
      '  ls                - List contents',
      '  kubectl get pods  - Get running pods',
      '  docker ps         - List containers',
      '  terraform plan    - Show infrastructure plan',
      '  git status        - Check repository status',
      '  deploy            - 🚀 Deploy to production',
      '  deploy production - 🚀 Deploy to production',
      '  clear             - Clear terminal',
      '',
      '💡 Tip: Try typing "deploy" for a surprise!',
    ],
    type: 'info',
  },
  whoami: {
    output: ['devops-ninja 🥷', '', 'You are a DevOps master!'],
    type: 'success',
  },
  ls: {
    output: [
      'Dockerfile',
      'docker-compose.yml',
      'kubernetes/',
      'terraform/',
      '.github/workflows/',
      'README.md',
      'package.json',
    ],
    type: 'info',
  },
  'kubectl get pods': {
    output: [
      'NAME                                READY   STATUS    RESTARTS   AGE',
      'nginx-deployment-7d64f9c5d9-4xk2h   1/1     Running   0          2d',
      'postgres-db-6c8b9f5d7-k9m3p         1/1     Running   0          5d',
      'redis-cache-5d8c7b6f9-p2x4n         1/1     Running   0          3d',
      'api-server-8f7d6c5b4-w8n5m          1/1     Running   0          1d',
    ],
    type: 'success',
  },
  'docker ps': {
    output: [
      'CONTAINER ID   IMAGE              COMMAND                  STATUS         PORTS',
      'a3f2e1d8c9b7   nginx:latest       "nginx -g daemon off"    Up 2 days      0.0.0.0:80->80/tcp',
      'b4c5d6e7f8a9   postgres:14        "docker-entrypoint.s"    Up 5 days      5432/tcp',
      'c5d6e7f8a9b0   redis:alpine       "redis-server"           Up 3 days      6379/tcp',
    ],
    type: 'success',
  },
  'terraform plan': {
    output: [
      'Terraform will perform the following actions:',
      '',
      '  # aws_instance.app_server will be created',
      '  + resource "aws_instance" "app_server" {',
      '      + ami                    = "ami-0c55b159cbfafe1f0"',
      '      + instance_type          = "t3.micro"',
      '      + availability_zone      = "us-east-1a"',
      '    }',
      '',
      'Plan: 1 to add, 0 to change, 0 to destroy.',
    ],
    type: 'info',
  },
  'git status': {
    output: [
      'On branch main',
      "Your branch is up to date with 'origin/main'.",
      '',
      'nothing to commit, working tree clean ✨',
    ],
    type: 'success',
  },
  deploy: {
    output: ['Initiating deployment to production...'],
    type: 'deploy',
  },
  'deploy production': {
    output: ['Initiating deployment to production...'],
    type: 'deploy',
  },
  'rm -rf /': {
    output: [
      '⚠️  WHOA THERE!',
      '',
      'Nice try, but this is a safe environment! 😅',
      '',
      'In production, this would be... catastrophic.',
      'Always double-check your commands!',
    ],
    type: 'error',
  },
  'sudo rm -rf /': {
    output: [
      '🚨 DANGER ZONE DETECTED 🚨',
      '',
      '[sudo] password for devops-ninja: _',
      '',
      'Just kidding! This terminal is read-only.',
      'But seriously, never run this in real life! 💀',
    ],
    type: 'error',
  },
};

const DeploymentAnimation = ({ onComplete }: { onComplete: () => void }) => {
  const [stage, setStage] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const stages = [
    { name: '📦 Building', duration: 2000, icon: '📦' },
    { name: '🧪 Testing', duration: 2500, icon: '🧪' },
    { name: '🐳 Dockerizing', duration: 2000, icon: '🐳' },
    { name: '☸️  Deploying', duration: 2500, icon: '☸️' },
    { name: '✅ Verification', duration: 1500, icon: '✅' },
  ];

  const stageMessages = [
    [
      '→ Installing dependencies...',
      '✓ Dependencies installed (342 packages)',
      '→ Running build...',
      '✓ Build completed successfully',
      '→ Optimizing bundle...',
      '✓ Bundle optimized: 234 KB → 187 KB',
    ],
    [
      '→ Running unit tests...',
      '✓ Unit tests passed (127/127)',
      '→ Running integration tests...',
      '✓ Integration tests passed (43/43)',
      '→ Running E2E tests...',
      '✓ E2E tests passed (18/18)',
      '→ Code coverage: 94.3% 🎉',
    ],
    [
      '→ Building Docker image...',
      '✓ Step 1/8: FROM node:18-alpine',
      '✓ Step 2/8: WORKDIR /app',
      '✓ Step 3/8: COPY package*.json ./',
      '✓ Step 4/8: RUN npm ci',
      '✓ Step 5/8: COPY . .',
      '✓ Step 6/8: RUN npm run build',
      '✓ Step 7/8: EXPOSE 3000',
      '✓ Step 8/8: CMD ["npm", "start"]',
      '✓ Docker image built: devopsdaily:latest',
      '→ Pushing to registry...',
      '✓ Pushed to registry',
    ],
    [
      '→ Connecting to Kubernetes cluster...',
      '✓ Connected to production cluster',
      '→ Applying deployment manifest...',
      '✓ deployment.apps/devopsdaily configured',
      '→ Applying service manifest...',
      '✓ service/devopsdaily configured',
      '→ Scaling replicas...',
      '✓ Scaled to 3 replicas',
      '→ Waiting for rollout...',
      '✓ Rollout completed successfully',
    ],
    [
      '→ Running health checks...',
      '✓ Health check passed: 200 OK',
      '→ Verifying DNS...',
      '✓ DNS resolution successful',
      '→ Running smoke tests...',
      '✓ All smoke tests passed',
      '→ Checking metrics...',
      '✓ CPU: 12%, Memory: 45%, Latency: 42ms',
      '',
      '🎉 DEPLOYMENT SUCCESSFUL! 🎉',
      '',
      '🚀 Your application is now live!',
      '📊 Dashboard: https://devops-daily.com',
      '📈 Metrics: All systems operational',
    ],
  ];

  useEffect(() => {
    if (stage >= stages.length) {
      setTimeout(onComplete, 2000);
      return;
    }

    const messages = stageMessages[stage];
    let messageIndex = 0;

    const interval = setInterval(() => {
      if (messageIndex < messages.length) {
        setLogs((prev) => [...prev, messages[messageIndex]]);
        messageIndex++;
      } else {
        clearInterval(interval);
        setTimeout(() => setStage((s) => s + 1), 500);
      }
    }, 300);

    return () => clearInterval(interval);
  }, [stage]);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-labelledby="deployment-title"
      aria-describedby="deployment-description"
    >
      <div className="w-full max-w-4xl bg-slate-900 rounded-lg border-2 border-blue-500 shadow-2xl overflow-hidden my-4">
        {/* Header */}
        <div className="bg-linear-to-r from-blue-600 to-purple-600 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Rocket
                className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-pulse"
                aria-hidden="true"
              />
              <h2 id="deployment-title" className="text-lg sm:text-xl font-bold text-white">
                Production Deployment Pipeline
              </h2>
            </div>
            <button
              onClick={onComplete}
              className="text-white hover:text-gray-200 transition-colors p-2"
              aria-label="Close deployment"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p id="deployment-description" className="sr-only">
            Automated deployment process running through build, test, dockerize, deploy, and
            verification stages
          </p>
        </div>

        {/* Pipeline Stages */}
        <div className="p-4 sm:p-6 border-b border-slate-700 overflow-x-auto">
          <div className="flex justify-between items-center min-w-max sm:min-w-0">
            {stages.map((s, i) => (
              <div key={i} className="flex items-center">
                <div
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-full transition-all ${
                    i < stage
                      ? 'bg-green-600 text-white'
                      : i === stage
                        ? 'bg-blue-600 text-white animate-pulse'
                        : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  <span className="text-base sm:text-xl" aria-hidden="true">
                    {s.icon}
                  </span>
                  <span className="text-xs sm:text-sm font-medium">
                    {s.name.replace(s.icon, '').trim()}
                  </span>
                  {i < stage && (
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" aria-label="Complete" />
                  )}
                </div>
                {i < stages.length - 1 && (
                  <div
                    className={`w-2 sm:w-4 h-1 mx-0.5 sm:mx-1 transition-all ${
                      i < stage ? 'bg-green-600' : 'bg-slate-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Logs */}
        <div
          ref={logsContainerRef}
          className="bg-slate-950 p-4 sm:p-6 h-64 sm:h-96 overflow-y-auto font-mono text-xs sm:text-sm"
        >
          {logs.map((log, i) => (
            <div
              key={i}
              className={`mb-1 ${
                log?.startsWith('✓')
                  ? 'text-green-400'
                  : log?.startsWith('→')
                    ? 'text-blue-400'
                    : log?.startsWith('🎉')
                      ? 'text-yellow-400 font-bold text-lg'
                      : log?.startsWith('🚀') || log?.startsWith('📊') || log?.startsWith('📈')
                        ? 'text-purple-400'
                        : 'text-slate-300'
              }`}
            >
              {log}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>

        {/* Progress Bar */}
        <div className="p-4 bg-slate-900">
          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-linear-to-r from-blue-500 to-purple-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${((stage + 1) / stages.length) * 100}%` }}
            />
          </div>
          <p className="text-center text-slate-400 text-sm mt-2">
            {stage < stages.length
              ? `Stage ${stage + 1} of ${stages.length}`
              : 'Deployment Complete!'}
          </p>
        </div>
      </div>
    </div>
  );
};

const AchievementModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" aria-describedby="achievement-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <span className="text-4xl" aria-hidden="true">
              🏆
            </span>
            Achievement Unlocked!
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4" id="achievement-description">
          <div className="bg-linear-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500 rounded-lg p-6 text-center">
            <div className="text-6xl mb-4" aria-hidden="true">
              🚀
            </div>
            <h3 className="text-2xl font-bold mb-2">DevOps Master</h3>
            <p className="text-muted-foreground mb-4">You successfully deployed to production!</p>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              Easter Egg Found
            </Badge>
          </div>
          <div className="text-sm text-center text-muted-foreground">
            <p>🎉 Congratulations on finding the secret terminal!</p>
            <p className="mt-2">You&apos;re now part of an elite group of DevOps ninjas.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export function EasterEggTerminal({ variant = 'icon' }: { variant?: 'icon' | 'text' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<Array<{ command: string; response: CommandResponse }>>([
    {
      command: '',
      response: {
        output: [
          '╔═══════════════════════════════════════════════╗',
          '║   Welcome to DevOps Daily Terminal v1.0.0    ║',
          '╚═══════════════════════════════════════════════╝',
          '',
          'Type "help" to see available commands.',
          'Type "deploy" to deploy to production 🚀',
          '',
        ],
        type: 'info',
      },
    },
  ]);
  const [input, setInput] = useState('');
  const [showDeployment, setShowDeployment] = useState(false);
  const [showAchievement, setShowAchievement] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Check if user has found easter egg before
  const [hasFoundBefore, setHasFoundBefore] = useState(false);

  useEffect(() => {
    const found = localStorage.getItem('devops-daily-easter-egg-found');
    if (found) {
      setHasFoundBefore(true);
    }
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (terminalRef.current) {
      // Smooth scroll to bottom
      terminalRef.current.scrollTo({
        top: terminalRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [history]);

  const handleCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim().toLowerCase();

    if (trimmedCmd === 'clear') {
      setHistory([]);
      return;
    }

    const response =
      COMMANDS[trimmedCmd] ||
      ({
        output: [`Command not found: ${cmd}`, 'Type "help" to see available commands.'],
        type: 'error',
      } as CommandResponse);

    setHistory((prev) => [...prev, { command: cmd, response }]);

    if (response.type === 'deploy') {
      setTimeout(() => {
        setShowDeployment(true);
        setIsOpen(false);
      }, 500);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      handleCommand(input);
      setInput('');
    }
  };

  const handleDeploymentComplete = () => {
    setShowDeployment(false);
    setShowConfetti(true);

    // Save achievement
    if (!hasFoundBefore) {
      localStorage.setItem('devops-daily-easter-egg-found', 'true');
      setHasFoundBefore(true);
      setShowAchievement(true);
    } else {
      // Show confetti even if found before
      setTimeout(() => setShowConfetti(false), 5000);
    }
  };

  return (
    <>
      {/* Trigger Button/Text */}
      {variant === 'icon' ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          className="relative group"
          aria-label="Open terminal"
        >
          <Terminal className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </Button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="text-xs text-muted-foreground hover:text-primary transition-colors font-mono group inline-flex items-center gap-1"
          aria-label="Open terminal"
        >
          <Terminal className="w-3 h-3 opacity-50 group-hover:opacity-100" />
          <span className="opacity-50 group-hover:opacity-100">~$</span>
        </button>
      )}

      {/* Terminal Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl h-[90vh] sm:h-[600px] p-0 bg-slate-950" hideCloseButton>
          <VisuallyHidden>
            <DialogTitle>DevOps Terminal</DialogTitle>
          </VisuallyHidden>
          <div className="flex flex-col h-full overflow-hidden">
            {/* Terminal Header */}
            <div className="flex items-center justify-between bg-slate-900 border-b border-slate-700 px-4 py-3">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-green-500" />
                <span className="font-mono text-sm text-slate-300">
                  devops-ninja@devopsdaily:~$
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white"
                aria-label="Close terminal"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Terminal Content */}
            <div
              ref={terminalRef}
              className="flex-1 overflow-y-auto p-4 font-mono text-xs sm:text-sm bg-slate-950 min-h-0"
              onClick={() => inputRef.current?.focus()}
            >
              {history.map((item, i) => (
                <div key={i} className="mb-4">
                  {item.command && (
                    <div className="flex gap-2 text-green-500">
                      <span>$</span>
                      <span>{item.command}</span>
                    </div>
                  )}
                  <div
                    className={`mt-1 ${
                      item.response.type === 'error'
                        ? 'text-red-400'
                        : item.response.type === 'success'
                          ? 'text-green-400'
                          : item.response.type === 'deploy'
                            ? 'text-yellow-400'
                            : 'text-slate-300'
                    }`}
                  >
                    {item.response.output.map((line, j) => (
                      <div key={j}>{line}</div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Input Line */}
              <form onSubmit={handleSubmit} className="flex gap-2 text-green-500 mt-4">
                <span>$</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-slate-100"
                  autoComplete="off"
                  spellCheck="false"
                />
              </form>
            </div>

            {/* Terminal Footer */}
            <div className="bg-slate-900 border-t border-slate-700 px-4 py-2 text-xs text-slate-500 font-mono">
              <div className="flex justify-between">
                <span>Type &quot;help&quot; for commands</span>
                <span className="text-green-500">● Connected</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deployment Animation */}
      {showDeployment && <DeploymentAnimation onComplete={handleDeploymentComplete} />}

      {/* Achievement Modal */}
      {showAchievement && (
        <AchievementModal
          open={showAchievement}
          onClose={() => {
            setShowAchievement(false);
            setTimeout(() => setShowConfetti(false), 3000);
          }}
        />
      )}

      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 z-9999 pointer-events-none">
          <Confetti recycle={false} numberOfPieces={500} gravity={0.3} />
        </div>
      )}
    </>
  );
}
