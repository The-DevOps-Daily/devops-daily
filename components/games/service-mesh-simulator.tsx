'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Network,
  Play,
  Pause,
  RotateCcw,
  Lock,
  Shield,
  Zap,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

interface Scenario {
  id: string;
  title: string;
  description: string;
  problem: string;
  solution: string;
  visual: 'before' | 'after-sidecar' | 'mtls' | 'traffic-split' | 'retry' | 'circuit-breaker';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

const SCENARIOS: Scenario[] = [
  {
    id: 'intro',
    title: '🎯 The Problem: Insecure Communication',
    description: 'Your services talk directly without encryption',
    problem:
      "Two services are sending data over the network. But there's a problem: anyone can read the messages! No encryption, no authentication, no control.",
    solution:
      "This is risky in production. One compromised service could impersonate another. Let's see how a service mesh solves this.",
    visual: 'before',
    difficulty: 'beginner',
  },
  {
    id: 'sidecar',
    title: '✨ The Solution: Sidecar Proxies',
    description: 'Add a security guard next to each service',
    problem:
      "We can't modify every service's code to add security. That would take months and break things!",
    solution:
      "Service mesh deploys a 'sidecar proxy' next to each service. It intercepts all traffic and handles security automatically. Your code stays unchanged!",
    visual: 'after-sidecar',
    difficulty: 'beginner',
  },
  {
    id: 'mtls',
    title: '🔐 Feature 1: Automatic Encryption',
    description: 'Every request is encrypted with mTLS',
    problem: 'Hackers can read your network traffic and steal sensitive data.',
    solution:
      'The sidecars automatically encrypt ALL traffic using mTLS (mutual TLS). Both services verify each other\'s identity. No code changes required!',
    visual: 'mtls',
    difficulty: 'intermediate',
  },
  {
    id: 'traffic-split',
    title: '🎛️ Feature 2: Safe Deployments',
    description: 'Test new versions without risking everything',
    problem:
      'You deployed v2.0 and it crashed. Now all users are affected. How do you test safely in production?',
    solution:
      'The mesh can route 90% of traffic to the stable version and 10% to the new one. If v2.0 has bugs, only 10% of users see them. Instant rollback!',
    visual: 'traffic-split',
    difficulty: 'intermediate',
  },
  {
    id: 'retry',
    title: '🔄 Feature 3: Smart Retries',
    description: 'Automatically retry failed requests',
    problem:
      'Networks are unreliable. Random failures happen. Your users see errors even though the service is working.',
    solution:
      'The sidecar automatically retries failed requests with smart backoff. Your users never see temporary network blips!',
    visual: 'retry',
    difficulty: 'advanced',
  },
  {
    id: 'circuit-breaker',
    title: '🛡️ Feature 4: Circuit Breaker',
    description: 'Stop hitting a failing service',
    problem:
      'One slow service is taking down your entire system. Every request waits 30 seconds before timing out. Disaster!',
    solution:
      'When failures exceed a threshold, the circuit breaker "trips" and stops sending requests. Gives the service time to recover. Prevents cascading failures.',
    visual: 'circuit-breaker',
    difficulty: 'advanced',
  },
];

export default function ServiceMeshSimulator() {
  const [currentScenario, setCurrentScenario] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [circuitState, setCircuitState] = useState<'closed' | 'open'>('closed');

  const scenario = SCENARIOS[currentScenario];

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setAnimationProgress((prev) => (prev + 1) % 100);
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Reset animation when scenario changes
  useEffect(() => {
    // Reset animation progress but keep playing state
    setAnimationProgress(0);
    setCircuitState('closed');
}, [currentScenario]);

// Circuit breaker state management
useEffect(() => {
  if (scenario.visual === 'circuit-breaker') {
    if (isPlaying && animationProgress > 50) {
      setCircuitState('open');
    } else {
      setCircuitState('closed');
    }
  }
}, [animationProgress, isPlaying, scenario.visual]);

// Keyboard navigation
useEffect(() => {
  if (typeof window === 'undefined') return;

    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;
        case 'ArrowLeft':
          if (currentScenario > 0) {
            setCurrentScenario(currentScenario - 1);
          }
          break;
        case 'ArrowRight':
          if (currentScenario < SCENARIOS.length - 1) {
            setCurrentScenario(currentScenario + 1);
          }
          break;
        case 'r':
        case 'R':
          setAnimationProgress(0);
          setIsPlaying(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentScenario, isPlaying]);

  const handleNext = () => {
    if (currentScenario < SCENARIOS.length - 1) {
      setCurrentScenario(currentScenario + 1);
    }
  };

  const handlePrevious = () => {
    if (currentScenario > 0) {
      setCurrentScenario(currentScenario - 1);
    }
  };

  const handleReset = () => {
    setAnimationProgress(0);
    setIsPlaying(false);
  };

  const renderVisualization = () => {
    const progress = animationProgress / 100;

    switch (scenario.visual) {
      case 'before':
        return (
          <div className="relative w-full h-80 flex items-center justify-center gap-16 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 rounded-xl p-8 border-2 border-red-200 dark:border-red-800">
            {/* Service A */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-32 h-32 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600" />
                <div className="relative text-white text-center">
                  <div className="font-bold text-lg">Service A</div>
                  <div className="text-xs opacity-80">Frontend</div>
                </div>
              </div>
              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                ⚠️ No Protection
              </Badge>
            </div>

            {/* Traffic Line */}
            <div className="relative flex flex-col items-center gap-3">
              <div className="relative w-48 h-1 bg-red-300 dark:bg-red-700 rounded-full">
               {isPlaying && (
                 <div
                   className="absolute top-1/2 -translate-y-1/2 flex items-center gap-2"
                   style={{ left: `${progress * 90}%`, transition: 'left 0.05s linear' }}
                 >
                   <div className="w-4 h-4 bg-red-500 rounded-full shadow-lg animate-pulse" />
                 </div>
               )}
                <ArrowRight className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-6 h-6 text-red-300 dark:text-red-700" />
             </div>
             <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-semibold">
               <AlertTriangle className="w-4 h-4" />
                <span>Unencrypted Data</span>
              </div>
            </div>

            {/* Service B */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-32 h-32 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-green-600" />
                <div className="relative text-white text-center">
                  <div className="font-bold text-lg">Service B</div>
                  <div className="text-xs opacity-80">API</div>
                </div>
              </div>
              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                ⚠️ No Protection
              </Badge>
            </div>

            {/* Hacker Warning */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-4 py-2 rounded-full border border-red-300 dark:border-red-700">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm font-semibold">Anyone can read this data!</span>
            </div>
          </div>
        );

      case 'after-sidecar':
        return (
          <div className="relative w-full h-80 flex items-center justify-center gap-16 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl p-8 border-2 border-green-200 dark:border-green-800">
            {/* Service A with Sidecar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-32 h-32 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600" />
                  <div className="relative text-white text-center">
                    <div className="font-bold text-lg">Service A</div>
                    <div className="text-xs opacity-80">Frontend</div>
                  </div>
                </div>
                {/* Sidecar Badge */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg flex items-center gap-1 border-2 border-white dark:border-gray-900">
                  <Shield className="w-3 h-3" />
                  Sidecar
                </div>
              </div>
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                ✅ Protected
              </Badge>
            </div>

            {/* Traffic Line */}
            <div className="relative flex flex-col items-center gap-3">
              <div className="relative w-48 h-1 bg-green-300 dark:bg-green-700 rounded-full">
               {isPlaying && (
                 <div
                   className="absolute top-1/2 -translate-y-1/2 flex items-center gap-2"
                   style={{ left: `${progress * 90}%`, transition: 'left 0.05s linear' }}
                 >
                   <div className="w-4 h-4 bg-green-500 rounded-full shadow-lg animate-pulse" />
                 </div>
               )}
                <ArrowRight className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-6 h-6 text-green-300 dark:text-green-700" />
             </div>
             <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-semibold">
               <Shield className="w-4 h-4" />
                <span>Proxied by Sidecars</span>
              </div>
            </div>

            {/* Service B with Sidecar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-32 h-32 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-green-600" />
                  <div className="relative text-white text-center">
                    <div className="font-bold text-lg">Service B</div>
                    <div className="text-xs opacity-80">API</div>
                  </div>
                </div>
                {/* Sidecar Badge */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg flex items-center gap-1 border-2 border-white dark:border-gray-900">
                  <Shield className="w-3 h-3" />
                  Sidecar
                </div>
              </div>
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                ✅ Protected
              </Badge>
            </div>

            {/* Success Message */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-full border border-green-300 dark:border-green-700">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-semibold">All traffic goes through sidecars!</span>
            </div>
          </div>
        );

      case 'mtls':
        return (
          <div className="relative w-full h-80 flex items-center justify-center gap-16 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 rounded-xl p-8 border-2 border-yellow-200 dark:border-yellow-800">
            {/* Service A */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-32 h-32 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600" />
                  <div className="relative text-white text-center">
                    <div className="font-bold text-lg">Service A</div>
                    <div className="text-xs opacity-80">Frontend</div>
                  </div>
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg flex items-center gap-1 border-2 border-white dark:border-gray-900">
                  <Shield className="w-3 h-3" />
                  Sidecar
                </div>
              </div>
            </div>

            {/* Encrypted Traffic */}
            <div className="relative flex flex-col items-center gap-3">
              <div className="relative w-48 h-1 bg-yellow-300 dark:bg-yellow-700 rounded-full">
               {isPlaying && (
                 <div
                   className="absolute top-1/2 -translate-y-1/2 flex items-center gap-2"
                   style={{ left: `${progress * 90}%`, transition: 'left 0.05s linear' }}
                 >
                   <Lock className="w-5 h-5 text-yellow-600 fill-yellow-200 dark:fill-yellow-800" />
                   <div className="w-4 h-4 bg-yellow-500 rounded-full shadow-lg" />
                 </div>
               )}
                <ArrowRight className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-6 h-6 text-yellow-300 dark:text-yellow-700" />
             </div>
             <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm font-semibold bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1 rounded-full">
               <Lock className="w-4 h-4" />
                <span>mTLS Encrypted</span>
              </div>
            </div>

            {/* Service B */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-32 h-32 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-green-600" />
                  <div className="relative text-white text-center">
                    <div className="font-bold text-lg">Service B</div>
                    <div className="text-xs opacity-80">API</div>
                  </div>
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg flex items-center gap-1 border-2 border-white dark:border-gray-900">
                  <Shield className="w-3 h-3" />
                  Sidecar
                </div>
              </div>
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-4 py-2 rounded-full border border-yellow-300 dark:border-yellow-700">
              <Lock className="w-5 h-5" />
              <span className="text-sm font-semibold">Encrypted + Authenticated</span>
            </div>
          </div>
        );

      case 'traffic-split':
        return (
          <div className="relative w-full h-80 flex items-center justify-around bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-8 border-2 border-blue-200 dark:border-blue-800">
            {/* Service A */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-28 h-28 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600" />
                  <div className="relative text-white text-center">
                    <div className="font-bold">Service A</div>
                  </div>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold shadow-lg flex items-center gap-1 border-2 border-white dark:border-gray-900">
                  <Shield className="w-3 h-3" />
                </div>
              </div>
            </div>

            {/* Split Traffic */}
            <div className="flex flex-col gap-8">
              {/* 90% to v1.0 */}
              <div className="relative flex items-center gap-3">
                <Badge className="bg-green-500 text-white">90%</Badge>
               <div className="relative w-32 h-1 bg-green-300 dark:bg-green-700 rounded-full">
                 {isPlaying && Math.random() > 0.1 && (
                   <div
                     className="absolute top-1/2 -translate-y-1/2"
                     style={{ left: `${progress * 90}%`, transition: 'left 0.05s linear' }}
                   >
                     <div className="w-3 h-3 bg-green-500 rounded-full shadow-lg" />
                   </div>
                 )}
                  <ArrowRight className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-5 h-5 text-green-300 dark:text-green-700" />
               </div>
             </div>

              {/* 10% to v2.0 */}
              <div className="relative flex items-center gap-3">
                <Badge className="bg-orange-500 text-white">10%</Badge>
               <div className="relative w-32 h-1 bg-orange-300 dark:bg-orange-700 rounded-full">
                 {isPlaying && Math.random() < 0.1 && (
                   <div
                     className="absolute top-1/2 -translate-y-1/2"
                     style={{ left: `${progress * 90}%`, transition: 'left 0.05s linear' }}
                   >
                     <div className="w-3 h-3 bg-orange-500 rounded-full shadow-lg" />
                   </div>
                 )}
                  <ArrowRight className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-5 h-5 text-orange-300 dark:text-orange-700" />
               </div>
             </div>
           </div>

            {/* Destination Services */}
            <div className="flex flex-col gap-8">
              {/* v1.0 Stable */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <div className="w-24 h-24 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-green-600" />
                    <div className="relative text-white text-center">
                      <div className="font-bold text-sm">Service B</div>
                      <div className="text-xs">v1.0</div>
                    </div>
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold shadow-lg flex items-center gap-1 border-2 border-white dark:border-gray-900">
                    <Shield className="w-3 h-3" />
                  </div>
                </div>
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs">
                  Stable
                </Badge>
              </div>

              {/* v2.0 Testing */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <div className="w-24 h-24 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600" />
                    <div className="relative text-white text-center">
                      <div className="font-bold text-sm">Service B</div>
                      <div className="text-xs">v2.0</div>
                    </div>
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold shadow-lg flex items-center gap-1 border-2 border-white dark:border-gray-900">
                    <Shield className="w-3 h-3" />
                  </div>
                </div>
                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                  Testing
                </Badge>
              </div>
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-4 py-2 rounded-full border border-blue-300 dark:border-blue-700">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-semibold">Canary Deployment: Low-risk testing</span>
            </div>
          </div>
        );

      case 'retry':
        return (
          <div className="relative w-full h-80 flex items-center justify-center gap-16 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl p-8 border-2 border-purple-200 dark:border-purple-800">
            {/* Service A */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-32 h-32 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600" />
                  <div className="relative text-white text-center">
                    <div className="font-bold text-lg">Service A</div>
                  </div>
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg flex items-center gap-1 border-2 border-white dark:border-gray-900">
                  <Shield className="w-3 h-3" />
                  Sidecar
                </div>
              </div>
            </div>

            {/* Traffic with Retry */}
            <div className="relative flex flex-col items-center gap-3">
              <div className="relative w-48 h-1 bg-purple-300 dark:bg-purple-700 rounded-full">
               {isPlaying && (
                 <div
                   className="absolute top-1/2 -translate-y-1/2 flex items-center gap-2"
                   style={{ left: `${progress * 90}%`, transition: 'left 0.05s linear' }}
                 >
                   <RefreshCw className="w-5 h-5 text-purple-600 animate-spin" />
                   <div className="w-4 h-4 bg-purple-500 rounded-full shadow-lg" />
                 </div>
               )}
                <ArrowRight className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-6 h-6 text-purple-300 dark:text-purple-700" />
             </div>
             <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-sm font-semibold bg-purple-100 dark:bg-purple-900/30 px-3 py-1 rounded-full">
               <RefreshCw className="w-4 h-4" />
                <span>Auto-Retry on Failure</span>
              </div>
            </div>

            {/* Service B */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-32 h-32 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-green-600" />
                  <div className="relative text-white text-center">
                    <div className="font-bold text-lg">Service B</div>
                  </div>
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg flex items-center gap-1 border-2 border-white dark:border-gray-900">
                  <Shield className="w-3 h-3" />
                  Sidecar
                </div>
              </div>
              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                ⚠️ Flaky (50% fail)
              </Badge>
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-4 py-2 rounded-full border border-purple-300 dark:border-purple-700">
              <RefreshCw className="w-5 h-5" />
              <span className="text-sm font-semibold">Failed? The sidecar retries automatically!</span>
            </div>
          </div>
        );

      case 'circuit-breaker':
        return (
          <div className="relative w-full h-80 flex items-center justify-center gap-16 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 rounded-xl p-8 border-2 border-red-200 dark:border-red-800">
            {/* Service A */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-32 h-32 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600" />
                  <div className="relative text-white text-center">
                    <div className="font-bold text-lg">Service A</div>
                  </div>
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg flex items-center gap-1 border-2 border-white dark:border-gray-900">
                  <Shield className="w-3 h-3" />
                  Sidecar
                </div>
              </div>
            </div>

            {/* Circuit Breaker Visualization */}
            <div className="relative flex flex-col items-center gap-3">
              <div className="relative w-48 h-1 bg-gray-300 dark:bg-gray-700 rounded-full">
               {isPlaying && circuitState === 'closed' && (
                 <div
                   className="absolute top-1/2 -translate-y-1/2 flex items-center gap-2"
                   style={{ left: `${progress * 90}%`, transition: 'left 0.05s linear' }}
                 >
                   <div className="w-4 h-4 bg-red-500 rounded-full shadow-lg" />
                 </div>
               )}
               {circuitState === 'open' && (
                 <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2">
                   <Zap className="w-8 h-8 text-red-600 fill-red-200 dark:fill-red-900" />
                 </div>
               )}
               {circuitState === 'closed' && (
                  <ArrowRight className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-6 h-6 text-gray-300 dark:text-gray-700" />
               )}
             </div>
             <div
                className={`flex items-center gap-2 text-sm font-semibold px-3 py-1 rounded-full ${
                  circuitState === 'open'
                    ? 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
                    : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700'
                }`}
              >
                {circuitState === 'open' ? (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Circuit OPEN</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Circuit Closed</span>
                  </>
                )}
              </div>
            </div>

            {/* Service B */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-32 h-32 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-400 to-red-600" />
                  <div className="relative text-white text-center">
                    <div className="font-bold text-lg">Service B</div>
                  </div>
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg flex items-center gap-1 border-2 border-white dark:border-gray-900">
                  <Shield className="w-3 h-3" />
                  Sidecar
                </div>
              </div>
              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                💥 Failing (100%)
              </Badge>
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-4 py-2 rounded-full border border-red-300 dark:border-red-700">
              <Zap className="w-5 h-5" />
              <span className="text-sm font-semibold">
                {circuitState === 'open' ? 'Circuit tripped! Requests blocked.' : 'Too many failures...'}
              </span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'advanced':
        return 'bg-red-100 text-red-700 border-red-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Network className="w-8 h-8 text-primary" />
                <CardTitle className="text-2xl">Service Mesh Traffic Simulator</CardTitle>
              </div>
              <CardDescription className="text-base">
                Learn how service meshes solve real production problems through interactive scenarios
              </CardDescription>
            </div>
            <Badge variant="outline" className={getDifficultyColor(scenario.difficulty)}>
              {scenario.difficulty}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Scenario Navigation */}
          <div className="flex items-center justify-between gap-4">
            <Button onClick={handlePrevious} disabled={currentScenario === 0} variant="outline" size="lg">
              <ChevronLeft className="mr-2 h-5 w-5" />
              Previous
            </Button>
            <div className="flex-1 text-center">
              <div className="text-sm text-muted-foreground mb-1">
                Scenario {currentScenario + 1} of {SCENARIOS.length}
              </div>
              <div className="flex items-center justify-center gap-1.5">
                {SCENARIOS.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentScenario
                        ? 'w-8 bg-primary'
                        : idx < currentScenario
                          ? 'w-2 bg-primary/50'
                          : 'w-2 bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>
            <Button
              onClick={handleNext}
              disabled={currentScenario === SCENARIOS.length - 1}
              variant="outline"
              size="lg"
            >
              Next
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Scenario Title */}
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold">{scenario.title}</h3>
            <p className="text-muted-foreground">{scenario.description}</p>
          </div>

          {/* Visualization */}
          <div className="border-2 border-muted rounded-xl overflow-hidden">{renderVisualization()}</div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => setIsPlaying(!isPlaying)} size="lg" variant="default">
              {isPlaying ? (
                <>
                  <Pause className="mr-2 h-5 w-5" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  Play
                </>
              )}
            </Button>
            <Button onClick={handleReset} variant="outline" size="lg">
              <RotateCcw className="mr-2 h-5 w-5" />
              Reset
            </Button>
          </div>

          {/* Problem/Solution Cards */}
          <div className="grid md:grid-cols-2 gap-4">
              <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <AlertDescription>
                  <div className="font-semibold text-red-900 dark:text-red-100 mb-1">The Problem</div>
                  <div className="text-red-700 dark:text-red-300 text-sm">{scenario.problem}</div>
                </AlertDescription>
              </Alert>
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <AlertDescription>
                  <div className="font-semibold text-green-900 dark:text-green-100 mb-1">The Solution</div>
                  <div className="text-green-700 dark:text-green-300 text-sm">{scenario.solution}</div>
                </AlertDescription>
              </Alert>
            </div>

          {/* Keyboard Shortcuts */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-medium mb-2">Keyboard Shortcuts:</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1">
              <span>
                <kbd className="px-2 py-1 bg-background rounded border text-xs">Space/Enter</kbd> Play/Pause
              </span>
              <span>
                <kbd className="px-2 py-1 bg-background rounded border text-xs">←/→</kbd> Navigate
              </span>
              <span>
                <kbd className="px-2 py-1 bg-background rounded border text-xs">R</kbd> Reset
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
