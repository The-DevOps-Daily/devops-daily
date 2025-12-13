'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Play,
  Pause,
  RotateCcw,
  Zap,
  Shield,
  Activity,
  AlertTriangle,
  Home,
  Info,
  Globe,
  Server,
  Database,
  Wifi,
  Lock,
  Unlock,
  Cloud,
  HardDrive,
  Cpu,
  Network,
  CheckCircle2,
  XCircle,
  Timer,
  Layers,
  GitBranch,
  Box,
  Sparkles,
  TrendingUp,
  Radio,
  FileText,
  Settings,
  BarChart3,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Journey stage interface
interface JourneyStage {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  duration: number; // in ms
  details: string[];
  x: number;
  y: number;
}

// Packet interface
interface Packet {
  id: string;
  currentStage: number;
  progress: number;
  data: string;
}

// Scenario types
type ScenarioType = 'http' | 'https' | 'https-cdn' | 'https-cdn-cache';

const scenarios: Record<ScenarioType, { name: string; description: string; stages: string[] }> = {
  http: {
    name: 'Basic HTTP',
    description: 'Simple unencrypted HTTP request',
    stages: ['browser', 'dns', 'tcp', 'loadbalancer', 'webserver', 'appserver', 'database'],
  },
  https: {
    name: 'HTTPS',
    description: 'Encrypted HTTPS with TLS',
    stages: ['browser', 'dns', 'tcp', 'tls', 'loadbalancer', 'webserver', 'appserver', 'database'],
  },
  'https-cdn': {
    name: 'HTTPS + CDN',
    description: 'With CDN edge server',
    stages: ['browser', 'dns', 'tcp', 'tls', 'cdn', 'loadbalancer', 'webserver', 'appserver', 'database'],
  },
  'https-cdn-cache': {
    name: 'HTTPS + CDN (Cached)',
    description: 'CDN cache hit - fastest!',
    stages: ['browser', 'dns', 'tcp', 'tls', 'cdn'],
  },
};

// All possible stages
const allStages: Record<string, Omit<JourneyStage, 'x' | 'y'>> = {
  browser: {
    id: 'browser',
    name: 'Browser',
    description: 'User initiates request',
    icon: <Globe className="w-6 h-6" />,
    color: '#3b82f6',
    duration: 10,
    details: [
      'Parse URL',
      'Check browser cache',
      'Create HTTP request',
      'Add headers (User-Agent, Accept, etc.)',
    ],
  },
  dns: {
    id: 'dns',
    name: 'DNS Resolution',
    description: 'Convert domain to IP',
    icon: <Radio className="w-6 h-6" />,
    color: '#8b5cf6',
    duration: 50,
    details: [
      'Check local DNS cache',
      'Query recursive resolver',
      'Root DNS → TLD DNS → Authoritative DNS',
      'Receive IP address (e.g., 172.67.154.128)',
    ],
  },
  tcp: {
    id: 'tcp',
    name: 'TCP Handshake',
    description: '3-way handshake',
    icon: <GitBranch className="w-6 h-6" />,
    color: '#06b6d4',
    duration: 30,
    details: [
      '1. SYN: Client → Server',
      '2. SYN-ACK: Server → Client',
      '3. ACK: Client → Server',
      'Connection established!',
    ],
  },
  tls: {
    id: 'tls',
    name: 'TLS Handshake',
    description: 'Establish encryption',
    icon: <Lock className="w-6 h-6" />,
    color: '#10b981',
    duration: 100,
    details: [
      'ClientHello: Supported ciphers',
      'ServerHello: Certificate chain',
      'Verify certificate validity',
      'Exchange keys, establish session',
    ],
  },
  cdn: {
    id: 'cdn',
    name: 'CDN / Edge',
    description: 'Content delivery network',
    icon: <Cloud className="w-6 h-6" />,
    color: '#f59e0b',
    duration: 20,
    details: [
      'Check edge cache',
      'Cache-Control & ETag headers',
      'HIT: Return cached response',
      'MISS: Forward to origin',
    ],
  },
  loadbalancer: {
    id: 'loadbalancer',
    name: 'Load Balancer',
    description: 'Distribute traffic',
    icon: <Network className="w-6 h-6" />,
    color: '#ec4899',
    duration: 5,
    details: [
      'Health check backends',
      'Algorithm: Round-robin/Least-conn',
      'Session persistence (sticky)',
      'Forward to healthy backend',
    ],
  },
  webserver: {
    id: 'webserver',
    name: 'Web Server',
    description: 'nginx/Apache',
    icon: <Server className="w-6 h-6" />,
    color: '#ef4444',
    duration: 10,
    details: [
      'Parse HTTP request',
      'Check static files',
      'Apply rate limiting',
      'Proxy to application server',
    ],
  },
  appserver: {
    id: 'appserver',
    name: 'Application',
    description: 'Business logic',
    icon: <Cpu className="w-6 h-6" />,
    color: '#f97316',
    duration: 50,
    details: [
      'Route request to handler',
      'Authenticate & authorize',
      'Execute business logic',
      'Query database if needed',
    ],
  },
  database: {
    id: 'database',
    name: 'Database',
    description: 'Data persistence',
    icon: <Database className="w-6 h-6" />,
    color: '#14b8a6',
    duration: 30,
    details: [
      'Connection pool: Get connection',
      'Parse & optimize query',
      'Execute query, fetch rows',
      'Return connection to pool',
    ],
  },
};

export default function PacketJourney() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = resolvedTheme === 'dark';

  // Handle theme hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  const [scenario, setScenario] = useState<ScenarioType>('https-cdn');
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [stageProgress, setStageProgress] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [journeyComplete, setJourneyComplete] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [injectFailure, setInjectFailure] = useState<string | null>(null);
  const [failureOccurred, setFailureOccurred] = useState(false);
  const [showEducation, setShowEducation] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showHint, setShowHint] = useState(true);
  const [manualMode, setManualMode] = useState(true); // Start in manual mode for better learning
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showStagesPanel, setShowStagesPanel] = useState(true); // Collapsible on mobile

  const animationFrameRef = useRef<number>();
  const lastFrameTime = useRef<number>(Date.now());
  const journeyStartTime = useRef<number>(0);
  const stageTimes = useRef<Array<{ stage: string; duration: number }>>([]);

  // Build current journey stages - VERTICAL LAYOUT
  const journeyStages = scenarios[scenario].stages.map((stageId, index, array) => {
    const stage = allStages[stageId];
    const totalStages = array.length;
    const spacing = 80 / (totalStages + 1); // Distribute evenly in vertical space

    return {
      ...stage,
      x: 50, // Center horizontally
      y: 10 + (index + 1) * spacing, // Space vertically from top
    };
  });

  // Calculate total journey time
  const totalJourneyTime = journeyStages.reduce((sum, stage) => sum + stage.duration, 0);

  // Start journey
  const startJourney = useCallback(() => {
    setIsRunning(true);
    setIsPaused(false);
    setCurrentStageIndex(0);
    setStageProgress(manualMode ? 1 : 0); // In manual mode, start at 100% of first stage
    setTotalTime(0);
    setJourneyComplete(false);
    setFailureOccurred(false);
    setIsReturning(false);
    journeyStartTime.current = Date.now();
    stageTimes.current = [];
    lastFrameTime.current = Date.now();
  }, [manualMode]);

  // Manual advance to next stage
  const nextStage = useCallback(() => {
    if (!isRunning) {
      startJourney();
      return;
    }

    const currentStage = journeyStages[currentStageIndex];
    if (!currentStage) return;

    // Record stage completion
    if (!stageTimes.current.find(s => s.stage === currentStage.name)) {
      stageTimes.current.push({
        stage: currentStage.name,
        duration: currentStage.duration,
      });
    }

    // Determine next stage
    if (!isReturning) {
      // Going forward (outbound journey)
      if (currentStageIndex < journeyStages.length - 1) {
        setCurrentStageIndex((prev) => prev + 1);
        setStageProgress(1); // Manual mode always at 100%
      } else {
        // Reached the end, start return journey
        setIsReturning(true);
        if (journeyStages.length > 1) {
          setCurrentStageIndex((prev) => prev - 1);
          setStageProgress(1);
        } else {
          setJourneyComplete(true);
          setIsRunning(false);
          setTotalTime(Date.now() - journeyStartTime.current);
        }
      }
    } else {
      // Going backward (return journey)
      if (currentStageIndex > 0) {
        setCurrentStageIndex((prev) => prev - 1);
        setStageProgress(1);
      } else {
        // Reached the beginning, journey complete
        setJourneyComplete(true);
        setIsRunning(false);
        setTotalTime(Date.now() - journeyStartTime.current);
      }
    }
  }, [isRunning, currentStageIndex, journeyStages, isReturning, startJourney]);

  // Pause/Resume
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Reset
  const resetJourney = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setCurrentStageIndex(0);
    setStageProgress(0);
    setTotalTime(0);
    setJourneyComplete(false);
    setFailureOccurred(false);
    setIsReturning(false);
    setInjectFailure(null);
    stageTimes.current = [];
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  // Change scenario
  const handleScenarioChange = useCallback((newScenario: ScenarioType) => {
    setScenario(newScenario);
    resetJourney();
  }, [resetJourney]);

  // Animation loop (only in auto mode)
  useEffect(() => {
    if (!isRunning || isPaused || journeyComplete || failureOccurred || manualMode) return;

    const animate = () => {
      const now = Date.now();
      const deltaTime = (now - lastFrameTime.current);
      lastFrameTime.current = now;

      const currentStage = journeyStages[currentStageIndex];
      if (!currentStage) {
        setIsRunning(false);
        return;
      }

      // Check for failure injection
      if (injectFailure && currentStage.id === injectFailure && stageProgress > 0.3) {
        setFailureOccurred(true);
        setIsRunning(false);
        return;
      }

      // Calculate progress - multiply duration by 3 to slow down animation for visibility
      // speedMultiplier of 1 = normal speed (3x slower than real-time for better UX)
      const effectiveDuration = currentStage.duration * 3;
      const newProgress = stageProgress + (deltaTime * speedMultiplier / effectiveDuration);

      if (newProgress >= 1) {
        // Stage complete
        stageTimes.current.push({
          stage: currentStage.name,
          duration: currentStage.duration,
        });

        // Determine next stage
        if (!isReturning) {
          // Going forward (outbound journey)
          if (currentStageIndex < journeyStages.length - 1) {
            // Move to next stage
            setCurrentStageIndex((prev) => prev + 1);
            setStageProgress(0);
        } else {
          // Reached the end, start return journey
          setIsReturning(true);
          if (journeyStages.length === 1) {
            // Only one stage, complete immediately
            setJourneyComplete(true);
            setIsRunning(false);
            setTotalTime(Date.now() - journeyStartTime.current);
            return;
          }
          // For multiple stages, stay at last stage and animate back
          setStageProgress(0);
        }
      } else {
          // Going backward (return journey)
          if (currentStageIndex > 0) {
            // Move to previous stage
            setCurrentStageIndex((prev) => prev - 1);
            setStageProgress(0);
          } else {
            // Reached the beginning, journey complete
            setJourneyComplete(true);
            setIsRunning(false);
            setTotalTime(Date.now() - journeyStartTime.current);
            return;
          }
        }
      } else {
        setStageProgress(newProgress);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning, isPaused, currentStageIndex, stageProgress, journeyStages, speedMultiplier, injectFailure, journeyComplete, failureOccurred, isReturning]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Spacebar or Enter/ArrowRight for next stage in manual mode
      if (manualMode && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight')) {
        e.preventDefault();
        if (!journeyComplete) {
          nextStage();
        }
      }
      // Spacebar for pause/play in auto mode
      else if (!manualMode && e.code === 'Space') {
        e.preventDefault();
        if (isRunning && !journeyComplete && !failureOccurred) {
          togglePause();
        } else if (!isRunning && !journeyComplete) {
          startJourney();
        }
      }
      // R for reset
      if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        resetJourney();
      }
      // Escape to close details
      if (e.code === 'Escape' && showDetails) {
        e.preventDefault();
        setShowDetails(null);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isRunning, isPaused, journeyComplete, failureOccurred, showDetails, manualMode, togglePause, startJourney, resetJourney, nextStage]);

  // Auto-hide hint after first interaction
  useEffect(() => {
    if (isRunning || showDetails) {
      setShowHint(false);
    }
  }, [isRunning, showDetails]);

  // Get packet position - memoized to prevent unnecessary recalculations
  const packetPos = React.useMemo(() => {
    if (!journeyStages.length || currentStageIndex >= journeyStages.length) {
      return { x: 50, y: 50 };
    }

    const currentStage = journeyStages[currentStageIndex];
    if (!currentStage) return { x: 50, y: 50 };

    const nextStage = isReturning
      ? (currentStageIndex > 0 ? journeyStages[currentStageIndex - 1] : currentStage)
      : (currentStageIndex < journeyStages.length - 1 ? journeyStages[currentStageIndex + 1] : currentStage);

    const x = currentStage.x + (nextStage.x - currentStage.x) * stageProgress;
    const y = currentStage.y + (nextStage.y - currentStage.y) * stageProgress;

    return { x, y };
  }, [currentStageIndex, stageProgress, journeyStages, isReturning]);

  // Prevent theme flash on mount
  if (!mounted) {
    return null;
  }

  return (
    <div className={cn(
      "min-h-screen p-4",
      isDark
        ? "bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white"
        : "bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-gray-900"
    )}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <nav className={cn(
          "flex items-center space-x-2 text-sm mb-6",
          isDark ? "text-slate-400" : "text-gray-600"
        )}>
          <Link
            href="/games"
            className={cn(
              "transition-colors flex items-center gap-1",
              isDark ? "hover:text-cyan-400" : "hover:text-blue-600"
            )}
          >
            <Home className="w-4 h-4" />
            Games
          </Link>
          <span>/</span>
          <span className={cn(
            isDark ? "text-slate-200" : "text-gray-900"
          )}>Network Packet Journey</span>
        </nav>

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-linear-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-cyan-400" />
              Network Packet Journey
            </h1>
            <p className={cn(
              "mt-2",
              isDark ? "text-slate-300" : "text-gray-600"
            )}>
              Follow a packet through the entire network stack - from browser to database and back!
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEducation(!showEducation)}
              className={cn(
                isDark
                  ? "bg-blue-500/20 border-blue-400 hover:bg-blue-500/30 text-white"
                  : "bg-blue-50 border-blue-300 hover:bg-blue-100 text-blue-700"
              )}
            >
              <Info className="w-4 h-4 mr-2" />
              Learn
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className={cn(
                isDark
                  ? "bg-slate-700 border-slate-600 hover:bg-slate-600 text-white"
                  : "bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700"
              )}
            >
              <Link href="/games">
                <Home className="w-4 h-4 mr-2" />
                All Games
              </Link>
            </Button>
          </div>
        </div>

        {/* Keyboard Shortcuts Hint */}
        <AnimatePresence>
          {showHint && !isRunning && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Alert className="bg-linear-to-r from-cyan-500/10 to-blue-500/10 border-cyan-400/50">
                <Sparkles className="h-4 w-4 text-cyan-400" />
                <AlertDescription className="text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span>
                    <strong>Pro tip:</strong> Use keyboard shortcuts - <kbd className={cn("px-2 py-1 rounded text-xs", isDark ? "bg-slate-700" : "bg-gray-200")}>Space</kbd> to play/pause, <kbd className={cn("px-2 py-1 rounded text-xs", isDark ? "bg-slate-700" : "bg-gray-200")}>R</kbd> to reset, <kbd className={cn("px-2 py-1 rounded text-xs", isDark ? "bg-slate-700" : "bg-gray-200")}>Esc</kbd> to close details
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setShowHint(false)} className="text-xs h-6">
                    Got it
                  </Button>
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress Indicator */}
        {isRunning && !journeyComplete && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            className={cn(
            "border rounded-lg p-3 backdrop-blur",
            isDark
              ? "bg-slate-800/50 border-slate-700"
              : "bg-white/80 border-gray-200"
          )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {isReturning ? 'Returning' : 'Outbound'} - Stage {currentStageIndex + 1} of {journeyStages.length}: {journeyStages[currentStageIndex]?.name}
              </span>
              <span className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-600")}>
                {(stageProgress * 100).toFixed(0)}% complete
              </span>
            </div>
            <div className={cn(
              "h-2 rounded-full overflow-hidden",
              isDark ? "bg-slate-700" : "bg-gray-200"
            )}>
              <motion.div
                className="h-full bg-linear-to-r from-cyan-500 to-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${stageProgress * 100}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </motion.div>
        )}

        {/* Educational Alert */}
        <AnimatePresence>
          {showEducation && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Alert className={cn(
                isDark
                  ? "bg-blue-500/10 border-blue-400 text-white"
                  : "bg-blue-50 border-blue-300 text-gray-900"
              )}>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>How it works:</strong> Watch as a single HTTP/HTTPS request travels through multiple layers:
                  DNS resolution (domain → IP), TCP handshake (connection), TLS handshake (encryption), CDN/edge
                  caching, load balancing, web server, application logic, and database queries. Each hop adds latency
                  but provides essential functionality. The round-trip shows how responses travel back through the same
                  path!
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compact Controls */}
        <div className={cn(
          "border rounded-lg p-4 backdrop-blur space-y-3",
          isDark
            ? "bg-slate-800/50 border-slate-700"
            : "bg-white/80 border-gray-200"
        )}>
          {/* Top Row: Scenario + Mode + Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
            {/* Scenario Selection - Compact Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "text-sm font-medium",
                isDark ? "text-slate-400" : "text-gray-600"
              )}>Scenario:</span>
              {(Object.keys(scenarios) as ScenarioType[]).map((key) => (
                <Badge
                  key={key}
                  onClick={() => handleScenarioChange(key)}
                  className={cn(
                    'cursor-pointer px-3 py-1.5 transition-all',
                    scenario === key
                      ? isDark
                        ? 'bg-blue-600 border-blue-400 hover:bg-blue-700 text-white'
                        : 'bg-blue-500 border-blue-400 hover:bg-blue-600 text-white'
                      : isDark
                        ? 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-slate-300'
                        : 'bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700'
                  )}
                  variant={scenario === key ? 'default' : 'outline'}
                >
                  {scenarios[key].name}
                </Badge>
              ))}
            </div>

            {/* Mode Toggle - Inline */}
            <div className="flex items-center gap-2 ml-auto">
              <span className={cn("text-sm", isDark ? "text-slate-400" : "text-gray-600")}>Mode:</span>
              <Button
                size="sm"
                onClick={() => {
                  setManualMode(true);
                  resetJourney();
                }}
                variant={manualMode ? 'default' : 'outline'}
                className={cn(
                  'h-8',
                  manualMode
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : isDark
                      ? 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-slate-300'
                      : 'bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700'
                )}
              >
                <Layers className="w-3 h-3 mr-1" />
                Step-by-Step
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setManualMode(false);
                  resetJourney();
                }}
                variant={!manualMode ? 'default' : 'outline'}
                className={cn(
                  'h-8',
                  !manualMode
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : isDark
                      ? 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-slate-300'
                      : 'bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700'
                )}
              >
                <Zap className="w-3 h-3 mr-1" />
                Auto-Play
              </Button>
            </div>
          </div>

          {/* Main Playback Controls */}
          <div className={cn(
            "flex flex-wrap items-center gap-2 pt-2 border-t",
            isDark ? "border-slate-700" : "border-gray-200"
          )}>
            {manualMode ? (
              <>
                <Button
                  onClick={nextStage}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={journeyComplete}
                  size="lg"
                >
                  {!isRunning ? (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Begin Journey
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-5 h-5 mr-2" />
                      Next Stage
                    </>
                  )}
                </Button>
                {isRunning && !journeyComplete && (
                  <Badge variant="outline" className="bg-green-500/20 border-green-400 text-xs px-2 py-1">
                    <Info className="w-3 h-3 mr-1" />
                    Space / Enter / →
                  </Badge>
                )}
              </>
            ) : (
              <>
                {!isRunning ? (
                  <Button onClick={startJourney} className="bg-green-600 hover:bg-green-700" size="lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Journey
                  </Button>
                ) : (
                  <Button onClick={togglePause} className="bg-yellow-600 hover:bg-yellow-700" size="lg">
                    {isPaused ? <Play className="w-5 h-5 mr-2" /> : <Pause className="w-5 h-5 mr-2" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                )}
                {/* Speed Control - only in auto mode */}
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-xs text-slate-400">Speed:</span>
                  {[0.5, 1, 2, 4].map((speed) => (
                    <Button
                      key={speed}
                      size="sm"
                      variant={speedMultiplier === speed ? 'default' : 'outline'}
                      onClick={() => setSpeedMultiplier(speed)}
                      className={cn(
                        'w-10 h-8 text-xs',
                        speedMultiplier === speed
                          ? 'bg-blue-600 text-white'
                          : isDark
                            ? 'bg-slate-700 border-slate-600 text-slate-300'
                            : 'bg-gray-100 border-gray-300 text-gray-700'
                      )}
                    >
                      {speed}x
                    </Button>
                  ))}
                </div>
              </>
            )}
            <Button onClick={resetJourney} variant="outline" className={cn(
              "ml-auto",
              isDark
                ? "bg-slate-700 border-slate-600 hover:bg-slate-600 text-white"
                : "bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700"
            )}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>

          {/* Advanced Options - Collapsible */}
          <div className={cn("pt-2 border-t", isDark ? "border-slate-700" : "border-gray-200")}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-slate-400 hover:text-slate-200 h-7 text-xs"
            >
              {showAdvanced ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
              Advanced Options
            </Button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 mt-3"
                >
                  {/* Failure Injection */}
                  <div>
                    <label className="text-xs font-medium mb-1.5 block text-slate-400">Inject Failure:</label>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        onClick={() => setInjectFailure(null)}
                        className={cn(
                          'cursor-pointer',
                          injectFailure === null
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-slate-300'
                        )}
                        variant={injectFailure === null ? 'default' : 'outline'}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        None
                      </Badge>
                      {journeyStages.slice(1, -1).map((stage) => (
                        <Badge
                          key={stage.id}
                          onClick={() => setInjectFailure(stage.id)}
                          className={cn(
                            'cursor-pointer text-xs',
                            injectFailure === stage.id
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-slate-300'
                          )}
                          variant={injectFailure === stage.id ? 'default' : 'outline'}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          {stage.name}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Toggle Timeline */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="showTimeline"
                      checked={showTimeline}
                      onChange={(e) => setShowTimeline(e.target.checked)}
                      className="w-3 h-3"
                    />
                    <label htmlFor="showTimeline" className="text-xs cursor-pointer text-slate-400">
                      Show timing waterfall
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Main Visualization Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Journey Visualization */}
          <Card className={cn(
            "lg:col-span-2 backdrop-blur",
            isDark
              ? "bg-slate-800/50 border-slate-700"
              : "bg-white/80 border-gray-200"
          )}>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  <div>
                    <CardTitle className="text-lg">Live Journey</CardTitle>
                    {isRunning && !journeyComplete && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isReturning ? '← Returning' : '→ Outbound'} • Stage {currentStageIndex + 1} of {journeyStages.length}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isRunning && !journeyComplete && (
                    <Badge variant="outline" className="bg-green-500/20 border-green-400">
                      <Activity className="w-3 h-3 mr-1 animate-pulse" />
                      In Transit
                    </Badge>
                  )}
                  {journeyComplete && (
                    <Badge variant="outline" className="bg-blue-500/20 border-blue-400">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {totalTime.toFixed(0)}ms
                    </Badge>
                  )}
                  {/* Mobile toggle for stages panel */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowStagesPanel(!showStagesPanel)}
                    className={cn(
                      "lg:hidden h-8",
                      isDark
                        ? "bg-slate-700 border-slate-600"
                        : "bg-gray-100 border-gray-300"
                    )}
                  >
                    <Layers className="w-3 h-3 mr-1" />
                    {showStagesPanel ? 'Hide' : 'Show'} Stages
                  </Button>
                </div>
              </div>

              {/* Journey Progress Bar */}
              {isRunning && !journeyComplete && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Journey Progress</span>
                    <span>{Math.round(((currentStageIndex + (isReturning ? journeyStages.length : 0)) / (journeyStages.length * 2)) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-linear-to-r from-cyan-500 to-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${((currentStageIndex + (isReturning ? journeyStages.length : 0)) / (journeyStages.length * 2)) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Browser</span>
                    <span>→</span>
                    <span>{journeyStages[journeyStages.length - 1].name}</span>
                    <span>→</span>
                    <span>Browser</span>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {/* SVG Canvas - Redesigned for clarity */}
              <div className={cn(
                "relative w-full rounded-lg border overflow-hidden min-h-[400px] sm:min-h-[600px]",
                isDark
                  ? "bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700"
                  : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300"
              )}>
                <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    {/* Gradient for the path */}
                    <linearGradient id="pathGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.5" />
                    </linearGradient>

                    {/* Glow filter */}
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Background grid for depth */}
                  <g opacity="0.05">
                    {[...Array(10)].map((_, i) => (
                      <line
                        key={`grid-h-${i}`}
                        x1="0"
                        y1={i * 10}
                        x2="100"
                        y2={i * 10}
                        stroke="#94a3b8"
                        strokeWidth="0.1"
                      />
                    ))}
                  </g>

                  {/* Main vertical path line */}
                  <line
                    x1="50"
                    y1="10"
                    x2="50"
                    y2="90"
                    stroke="url(#pathGradient)"
                    strokeWidth="0.8"
                    strokeDasharray="1,1"
                    opacity="0.3"
                  />

                  {/* Connection lines between stages - with progress */}
                  {journeyStages.map((stage, index) => {
                    if (index === journeyStages.length - 1) return null;
                    const nextStage = journeyStages[index + 1];
                    const isActive = currentStageIndex === index && isRunning;
                    const isPassed = currentStageIndex > index || isReturning;

                    return (
                      <g key={`line-group-${stage.id}`}>
                        {/* Base line */}
                        <motion.line
                          key={`line-${stage.id}`}
                          x1={stage.x}
                          y1={stage.y}
                          x2={nextStage.x}
                          y2={nextStage.y}
                          stroke={isPassed ? '#06b6d4' : '#334155'}
                          strokeWidth="0.8"
                          initial={{ strokeOpacity: 0.3 }}
                          animate={{
                            strokeOpacity: isActive ? [0.3, 1, 0.3] : isPassed ? 0.8 : 0.3,
                          }}
                          transition={{
                            strokeOpacity: { duration: 1, repeat: isActive ? Infinity : 0 },
                          }}
                        />

                        {/* Animated data pulse on active line */}
                        {isActive && (
                          <motion.circle
                            cx={stage.x}
                            cy={stage.y}
                            r="0.8"
                            fill="#06b6d4"
                            filter="url(#glow)"
                            animate={{
                              cx: [stage.x, nextStage.x],
                              cy: [stage.y, nextStage.y],
                              opacity: [0, 1, 1, 0],
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* Stage nodes */}
                  {journeyStages.map((stage, index) => {
                    const isActive = currentStageIndex === index && isRunning;
                    const isPassed = currentStageIndex > index;
                    const isFailed = failureOccurred && stage.id === injectFailure;
                    const stageNumber = index + 1;

                    return (
                      <g key={stage.id} className="cursor-pointer" onClick={() => setShowDetails(showDetails === stage.id ? null : stage.id)}>
                        {/* Outer glow ring for active stage */}
                        {isActive && !isFailed && (
                          <circle
                            cx={stage.x}
                            cy={stage.y}
                            r="5"
                            fill="none"
                            stroke={stage.color}
                            strokeWidth="0.3"
                            opacity="0.6"
                            className="animate-ping"
                          />
                        )}

                        {/* Stage background circle */}
                        <circle
                          cx={stage.x}
                          cy={stage.y}
                          r="3.5"
                          fill="#1e293b"
                          opacity="0.9"
                        />

                        {/* Stage circle */}
                        <motion.circle
                          cx={stage.x}
                          cy={stage.y}
                          r="2.8"
                          fill={isFailed ? '#ef4444' : isActive ? stage.color : isPassed ? '#06b6d4' : '#475569'}
                          stroke={isFailed ? '#dc2626' : isActive ? '#fff' : isPassed ? '#06b6d4' : '#64748b'}
                          strokeWidth="0.5"
                          filter={isActive ? 'url(#glow)' : ''}
                          initial={false}
                          animate={{
                            scale: isActive ? [1, 1.15, 1] : 1,
                          }}
                          transition={{
                            scale: { duration: 1.5, repeat: isActive ? Infinity : 0, ease: 'easeInOut' },
                          }}
                        />

                        {/* Stage number */}
                        <text
                          x={stage.x}
                          y={stage.y + 0.8}
                          textAnchor="middle"
                          className={cn(
                            "text-[2.5px] font-bold pointer-events-none",
                            isDark ? "fill-white" : "fill-gray-900"
                          )}
                          style={{ userSelect: 'none' }}
                        >
                          {stageNumber}
                        </text>

                        {/* Stage label on the left */}
                        <text
                          x={stage.x - 8}
                          y={stage.y + 1}
                          textAnchor="end"
                          className={cn(
                            "text-[2.5px] font-semibold pointer-events-none transition-all",
                            isActive
                              ? isDark ? "fill-white" : "fill-gray-900"
                              : isPassed
                                ? "fill-cyan-400"
                                : isDark
                                  ? "fill-slate-400"
                                  : "fill-gray-600"
                          )}
                          style={{ userSelect: 'none' }}
                        >
                          {stage.name}
                        </text>

                        {/* Duration label on the right */}
                        <text
                          x={stage.x + 8}
                          y={stage.y + 1}
                          textAnchor="start"
                          className={cn(
                            "text-[2px] pointer-events-none",
                            isDark ? "fill-slate-500" : "fill-gray-600"
                          )}
                          style={{ userSelect: 'none' }}
                        >
                          {stage.duration}ms
                        </text>
                      </g>
                    );
                  })}

                  {/* Animated packet traveling */}
                  {isRunning && !failureOccurred && currentStageIndex < journeyStages.length && (
                    <g transform={`translate(${packetPos.x}, ${packetPos.y})`}>
                      {/* Packet outer glow - larger */}
                      <motion.circle
                        cx="0"
                        cy="0"
                        r="4"
                        fill="#06b6d4"
                        opacity="0.1"
                        filter="url(#glow)"
                        animate={{ r: [3.5, 4.5, 3.5], opacity: [0.1, 0.2, 0.1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />

                      {/* Packet middle glow */}
                      <motion.circle
                        cx="0"
                        cy="0"
                        r="1.8"
                        fill="#06b6d4"
                        opacity="0.4"
                        animate={{ opacity: [0.4, 0.7, 0.4] }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                      />

                      {/* Packet core */}
                      <circle cx="0" cy="0" r="1.2" fill="#06b6d4" stroke="#fff" strokeWidth="0.3" filter="url(#glow)" />

                      {/* Data packet label */}
                      <text
                        x="2.5"
                        y="0.5"
                        textAnchor="start"
                        className={cn(
                          "text-[1.5px] font-bold pointer-events-none",
                          isDark ? "fill-cyan-300" : "fill-cyan-600"
                        )}
                        stroke={isDark ? "#000" : "#fff"}
                        strokeWidth="0.15"
                        paintOrder="stroke"
                        style={{ userSelect: 'none' }}
                      >
                        DATA
                      </text>

                      {/* Direction indicator - enhanced arrow */}
                      <motion.path
                        d={isReturning ? "M -0.7 1.2 L 0 0.3 L 0.7 1.2" : "M -0.7 -1.2 L 0 -0.3 L 0.7 -1.2"}
                        stroke="#fff"
                        strokeWidth="0.4"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      />

                      {/* Packet trail effect - multiple rings */}
                      <motion.circle
                        cx="0"
                        cy="0"
                        r="2"
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="0.3"
                        animate={{ r: [1.5, 3.5], opacity: [0.6, 0] }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'easeOut' }}
                      />
                      <motion.circle
                        cx="0"
                        cy="0"
                        r="2"
                        fill="none"
                        stroke="#0ea5e9"
                        strokeWidth="0.2"
                        animate={{ r: [1.5, 3], opacity: [0.5, 0] }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
                      />

                      {/* Particle effects */}
                      {[0, 120, 240].map((angle) => (
                        <motion.circle
                          key={angle}
                          cx="0"
                          cy="0"
                          r="0.3"
                          fill="#06b6d4"
                          animate={{
                            cx: [0, Math.cos((angle * Math.PI) / 180) * 2],
                            cy: [0, Math.sin((angle * Math.PI) / 180) * 2],
                            opacity: [0.8, 0],
                          }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                        />
                      ))}
                    </g>
                  )}

                  {/* Failure indicator */}
                  {failureOccurred && injectFailure && (
                    <motion.g
                      initial={{ scale: 0, x: packetPos.x, y: packetPos.y }}
                      animate={{ scale: [0, 1.5, 1], x: packetPos.x, y: packetPos.y }}
                      transition={{ duration: 0.5 }}
                    >
                      <circle r="2" fill="#ef4444" opacity="0.3" />
                      <circle r="1.2" fill="#ef4444" stroke="#fff" strokeWidth="0.3" />
                      <text
                        y="-3"
                        textAnchor="middle"
                        className="fill-red-400 text-[2px] font-bold"
                      >
                        FAILED
                      </text>
                    </motion.g>
                  )}
                </svg>

                {/* Helpful overlay */}
                {!isRunning && !journeyComplete && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className={cn(
                      "backdrop-blur px-6 py-4 rounded-lg border-2 border-blue-400 shadow-lg",
                      isDark ? "bg-slate-800/95" : "bg-white/95"
                    )}>
                      <p className="text-lg font-semibold text-blue-400 mb-2 flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        Ready to Begin!
                      </p>
                      <p className={cn("text-sm", isDark ? "text-slate-300" : "text-gray-700")}>
                        Press <kbd className={cn("px-2 py-1 rounded text-xs font-mono", isDark ? "bg-slate-700" : "bg-gray-200")}>Space</kbd> or click "Start Journey" below
                      </p>
                    </div>
                  </div>
                )}

                {/* Legend */}
                <div className={cn(
                  "absolute bottom-2 left-2 backdrop-blur px-3 py-2 rounded-lg border text-xs",
                  isDark
                    ? "bg-slate-800/90 border-slate-600"
                    : "bg-white/90 border-gray-300"
                )}>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        "w-3 h-3 rounded-full border",
                        isDark
                          ? "bg-slate-600 border-slate-500"
                          : "bg-gray-400 border-gray-500"
                      )}></div>
                      <span className={cn(isDark ? "text-slate-400" : "text-gray-700")}>Pending</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-cyan-500 border border-cyan-400 animate-pulse"></div>
                      <span className={cn(isDark ? "text-slate-300" : "text-gray-700")}>Active</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-cyan-500 border border-cyan-400"></div>
                      <span className={cn(isDark ? "text-slate-300" : "text-gray-700")}>Complete</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500 border border-red-400"></div>
                      <span className={cn(isDark ? "text-slate-300" : "text-gray-700")}>Failed</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Journey Complete */}
              <AnimatePresence>
                {journeyComplete && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 p-4 bg-linear-to-r from-green-500/20 to-blue-500/20 border border-green-400 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-8 h-8 text-green-400" />
                      <div>
                        <h3 className="font-bold text-lg">Journey Complete!</h3>
                        <p className={cn("text-sm", isDark ? "text-slate-300" : "text-gray-700")}>
                          Round-trip completed in <strong>{totalTime.toFixed(0)}ms</strong>
                          {' '}({(totalJourneyTime * 2).toFixed(0)}ms simulated)
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Real-world timing varies based on network conditions, server load, and geographic distance
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Failure Message */}
              <AnimatePresence>
                {failureOccurred && injectFailure && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 p-4 bg-linear-to-r from-red-500/20 to-orange-500/20 border border-red-400 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <XCircle className="w-8 h-8 text-red-400" />
                      <div>
                        <h3 className="font-bold text-lg">Connection Failed!</h3>
                        <p className={cn("text-sm", isDark ? "text-slate-300" : "text-gray-700")}>
                          Failure at <strong>{allStages[injectFailure]?.name}</strong> stage
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          In production, this would trigger retries, fallbacks, circuit breakers, or error pages
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Stage Details Panel - Collapsible on mobile */}
          <div className={cn("space-y-4", !showStagesPanel && "hidden lg:block")}>
            {/* Current Stage Info */}
            {isRunning && currentStageIndex < journeyStages.length && (
              <Card className={cn(
                "backdrop-blur",
                isDark
                  ? "bg-slate-800/50 border-slate-700"
                  : "bg-white/80 border-gray-200"
              )}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Timer className="w-5 h-5" />
                    Current Stage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${journeyStages[currentStageIndex].color}20` }}
                      >
                        {journeyStages[currentStageIndex].icon}
                      </div>
                      <div>
                        <h3 className="font-bold">{journeyStages[currentStageIndex].name}</h3>
                        <p className="text-xs text-slate-400">{journeyStages[currentStageIndex].description}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progress</span>
                        <span>{(stageProgress * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: journeyStages[currentStageIndex].color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${stageProgress * 100}%` }}
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className={cn("text-xs font-semibold", isDark ? "text-slate-400" : "text-gray-700")}>What's happening:</p>
                      {journeyStages[currentStageIndex].details.map((detail, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: stageProgress > i * 0.25 ? 1 : 0.3, x: 0 }}
                          className="flex items-start gap-2 text-xs"
                        >
                          <CheckCircle2
                            className={cn(
                              'w-3 h-3 mt-0.5 shrink-0',
                              stageProgress > i * 0.25
                                ? 'text-green-400'
                                : isDark
                                  ? 'text-slate-600'
                                  : 'text-gray-400'
                            )}
                          />
                          <span className={cn(
                            stageProgress > i * 0.25
                              ? isDark ? 'text-slate-200' : 'text-gray-900'
                              : isDark ? 'text-slate-500' : 'text-gray-600'
                          )}>
                            {detail}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All Stages List */}
            <Card className={cn(
              "backdrop-blur",
              isDark
                ? "bg-slate-800/50 border-slate-700"
                : "bg-white/80 border-gray-200"
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Layers className="w-5 h-5" />
                    Journey Stages
                  </CardTitle>
                  {isRunning && (
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      isDark
                        ? "bg-slate-700 border-slate-600"
                        : "bg-gray-100 border-gray-300"
                    )}>
                      {currentStageIndex + 1} / {journeyStages.length}
                    </Badge>
                  )}
                </div>
                {/* Mini timeline progress */}
                {isRunning && (
                  <div className="mt-2 flex items-center gap-1">
                    {journeyStages.map((_, index) => {
                      const isPassed = index < currentStageIndex;
                      const isActive = index === currentStageIndex;
                      return (
                        <div
                          key={index}
                          className={cn(
                            'flex-1 h-1 rounded-full transition-all',
                            isActive && 'bg-blue-500',
                            isPassed && 'bg-green-500',
                            !isActive && !isPassed && (isDark ? 'bg-slate-700' : 'bg-gray-300')
                          )}
                        />
                      );
                    })}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {journeyStages.map((stage, index) => {
                    const isActive = currentStageIndex === index && isRunning;
                    const isPassed = currentStageIndex > index || (isReturning && currentStageIndex <= index);
                    const isFailed = failureOccurred && stage.id === injectFailure;
                    const stepNumber = index + 1;

                    return (
                      <motion.div
                        key={stage.id}
                        className={cn(
                          'p-3 rounded-lg border cursor-pointer transition-all',
                          isActive && 'border-blue-400 bg-blue-500/20 ring-2 ring-blue-400/30',
                          isPassed && !isActive && 'border-green-400/50 bg-green-500/10',
                          isFailed && 'border-red-400 bg-red-500/20',
                          !isActive && !isPassed && !isFailed && (isDark
                            ? 'border-slate-700 bg-slate-800/50 hover:bg-slate-700/50'
                            : 'border-gray-300 bg-gray-50 hover:bg-gray-100')
                        )}
                        onClick={() => setShowDetails(showDetails === stage.id ? null : stage.id)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {/* Step number badge - inline instead of absolute */}
                            <div className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                              isActive && 'bg-blue-500 text-white',
                              isPassed && !isActive && 'bg-green-500 text-white',
                              !isActive && !isPassed && (isDark
                                ? 'bg-slate-700 text-slate-400'
                                : 'bg-gray-300 text-gray-700')
                            )}>
                              {stepNumber}
                            </div>
                            <div
                              className="p-1.5 rounded"
                              style={{ backgroundColor: `${stage.color}20` }}
                            >
                              {stage.icon}
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm">{stage.name}</h4>
                              <p className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-600")}>{stage.duration}ms</p>
                            </div>
                          </div>
                          {isActive && <Activity className="w-4 h-4 text-blue-400 animate-pulse" />}
                          {isPassed && !isActive && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                          {isFailed && <XCircle className="w-4 h-4 text-red-400" />}
                        </div>

                        <AnimatePresence>
                          {showDetails === stage.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className={cn(
                                "mt-3 pt-3 border-t space-y-1",
                                isDark ? "border-slate-600" : "border-gray-300"
                              )}
                            >
                              <p className={cn("text-xs mb-2", isDark ? "text-slate-300" : "text-gray-700")}>{stage.description}</p>
                              {stage.details.map((detail, i) => (
                                <div key={i} className={cn("flex items-start gap-2 text-xs", isDark ? "text-slate-400" : "text-gray-600")}>
                                  <span className={cn(isDark ? "text-slate-500" : "text-gray-500")}>•</span>
                                  <span>{detail}</span>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Timeline Waterfall */}
        {showTimeline && isRunning && (
          <Card className={cn(
            "backdrop-blur",
            isDark
              ? "bg-slate-800/50 border-slate-700"
              : "bg-white/80 border-gray-200"
          )}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Timing Waterfall
              </CardTitle>
              <CardDescription>Cumulative latency at each stage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {journeyStages.map((stage, index) => {
                  const isPassed = currentStageIndex > index || (currentStageIndex === index && stageProgress === 1);
                  const isActive = currentStageIndex === index;
                  const cumulativeTime = journeyStages
                    .slice(0, index + 1)
                    .reduce((sum, s) => sum + s.duration, 0);
                  const percentage = (cumulativeTime / totalJourneyTime) * 100;

                  return (
                    <div key={stage.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className={cn('font-medium', isActive && 'text-blue-400')}>
                          {stage.name}
                        </span>
                        <span className="text-slate-400">{cumulativeTime}ms</span>
                      </div>
                      <div className="h-6 bg-slate-700/50 rounded overflow-hidden relative">
                        <motion.div
                          className="h-full rounded flex items-center px-2"
                          style={{ backgroundColor: stage.color }}
                          initial={{ width: 0 }}
                          animate={{
                            width: isPassed
                              ? `${percentage}%`
                              : isActive
                              ? `${((cumulativeTime - stage.duration * (1 - stageProgress)) / totalJourneyTime) * 100}%`
                              : 0,
                          }}
                          transition={{ duration: 0.3 }}
                        >
                          <span className="text-xs font-medium text-white">
                            +{stage.duration}ms
                          </span>
                        </motion.div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-600">
                <div className="flex justify-between items-center">
                  <span className="font-bold">Total Journey Time:</span>
                  <span className="text-2xl font-bold text-blue-400">{totalJourneyTime}ms</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Round-trip (request + response): {totalJourneyTime * 2}ms
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-linear-to-br from-blue-500/20 to-cyan-500/20 border-blue-400">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-blue-400" />
                <div>
                  <div className="text-2xl font-bold">{journeyStages.length}</div>
                  <div className={cn("text-sm", isDark ? "text-slate-300" : "text-gray-600")}>Network Hops</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-linear-to-br from-purple-500/20 to-pink-500/20 border-purple-400">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Timer className="w-8 h-8 text-purple-400" />
                <div>
                  <div className="text-2xl font-bold">{totalJourneyTime}ms</div>
                  <div className={cn("text-sm", isDark ? "text-slate-300" : "text-gray-600")}>Total Latency</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-linear-to-br from-green-500/20 to-teal-500/20 border-green-400">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-green-400" />
                <div>
                  <div className="text-2xl font-bold">{(totalJourneyTime * 2).toFixed(0)}ms</div>
                  <div className={cn("text-sm", isDark ? "text-slate-300" : "text-gray-600")}>Round-Trip Time</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scenario Comparison */}
        <Card className={cn(
          "backdrop-blur",
          isDark
            ? "bg-slate-800/50 border-slate-700"
            : "bg-white/80 border-gray-200"
        )}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Scenario Comparison
            </CardTitle>
            <CardDescription>See how different configurations affect performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn("border-b", isDark ? "border-slate-700" : "border-gray-200")}>
                    <th className="text-left py-3 px-2 font-semibold">Scenario</th>
                    <th className="text-center py-3 px-2 font-semibold">Stages</th>
                    <th className="text-center py-3 px-2 font-semibold">One-Way</th>
                    <th className="text-center py-3 px-2 font-semibold">Round-Trip</th>
                    <th className="text-left py-3 px-2 font-semibold">Best For</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(scenarios) as ScenarioType[]).map((key) => {
                    const stages = scenarios[key].stages.map((id) => allStages[id]);
                    const oneWay = stages.reduce((sum, s) => sum + s.duration, 0);
                    const roundTrip = oneWay * 2;
                    const isCurrent = scenario === key;

                    return (
                      <tr
                        key={key}
                        className={cn(
                          'border-b transition-colors cursor-pointer',
                          isDark
                            ? 'border-slate-700/50'
                            : 'border-gray-200',
                          isCurrent
                            ? 'bg-blue-500/10'
                            : isDark
                              ? 'hover:bg-slate-700/30'
                              : 'hover:bg-gray-100'
                        )}
                        onClick={() => handleScenarioChange(key)}
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            {isCurrent && <Activity className="w-4 h-4 text-blue-400" />}
                            <span className={cn('font-medium', isCurrent && 'text-blue-400')}>
                              {scenarios[key].name}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">{scenarios[key].description}</div>
                        </td>
                        <td className={cn("text-center py-3 px-2", isDark ? "text-slate-300" : "text-gray-900")}>{stages.length}</td>
                        <td className={cn("text-center py-3 px-2 font-mono", isDark ? "text-slate-300" : "text-gray-900")}>{oneWay}ms</td>
                        <td className="text-center py-3 px-2 font-mono font-semibold text-cyan-400">{roundTrip}ms</td>
                        <td className={cn("py-3 px-2 text-xs", isDark ? "text-slate-400" : "text-gray-600")}>
                          {key === 'http' && 'Development, testing'}
                          {key === 'https' && 'Production, secure data'}
                          {key === 'https-cdn' && 'Global users, static content'}
                          {key === 'https-cdn-cache' && 'Repeated requests, optimal speed'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className={cn(
              "mt-4 p-3 rounded-lg border",
              isDark
                ? "bg-slate-700/30 border-slate-600"
                : "bg-blue-50 border-blue-200"
            )}>
              <p className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-700")}>
                <strong className={cn(isDark ? "text-slate-300" : "text-gray-900")}>💡 Insight:</strong> The CDN cached scenario is {' '}
                {Math.round((
                  (scenarios['https-cdn'].stages.map(id => allStages[id]).reduce((sum, s) => sum + s.duration, 0) -
                  scenarios['https-cdn-cache'].stages.map(id => allStages[id]).reduce((sum, s) => sum + s.duration, 0)) /
                  scenarios['https-cdn'].stages.map(id => allStages[id]).reduce((sum, s) => sum + s.duration, 0)
                ) * 100)}% faster than the full CDN journey! This is why caching is crucial for performance.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Educational Footer */}
        <Card className="bg-linear-to-r from-indigo-500/10 to-purple-500/10 border-indigo-400">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <h3 className="font-bold flex items-center gap-2">
                <Info className="w-5 h-5" />
                Did You Know?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Speed of Light:</strong> Even at the speed of light, a packet takes ~30ms to travel
                  from New York to London (3,500 miles). Network latency is bound by physics!
                </div>
                <div>
                  <strong>CDN Magic:</strong> Content Delivery Networks cache data at edge servers close to users,
                  reducing latency from 200ms+ to under 20ms!
                </div>
                <div>
                  <strong>DNS Caching:</strong> Your browser caches DNS lookups for hours, so subsequent
                  requests to the same domain skip the DNS resolution step entirely!
                </div>
                <div>
                  <strong>HTTP/3:</strong> The latest HTTP protocol uses QUIC (UDP-based) to establish
                  connections faster, combining TCP + TLS handshakes into one step!
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
