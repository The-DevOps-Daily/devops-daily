"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Server,
  FileText,
  GitBranch,
  RefreshCw,
  Database,
  Shield,
  Zap,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  RotateCcw,
  Home,
  Award,
  Clock,
  Flame,
  Heart,
  Cpu,
  HardDrive,
  Network,
  CloudOff,
  Bug,
  Webhook,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

// Game constants
const INITIAL_UPTIME = 100;
const GAME_DURATION = 60; // seconds
const INCIDENT_SPAWN_INTERVAL = 4000; // ms - balanced spawn rate
const INCIDENT_LIFETIME = 8000; // ms - generous time to respond (8 seconds)
const UPTIME_DRAIN_RATE = 0.4; // per second when incidents are active (reduced)
const UPTIME_RECOVERY_RATE = 0.3; // per second when no active incidents (increased)

// Incident types with their required actions
const INCIDENT_TYPES = [
  {
    id: 'high-load',
    name: 'High Traffic Load',
    icon: Activity,
    color: 'from-orange-500 to-red-600',
    textColor: 'text-orange-600 dark:text-orange-400',
    action: 'add-nodes',
    actionName: 'Add Nodes',
    description: 'Traffic spike detected!',
    severity: 'high',
  },
  {
    id: 'disk-full',
    name: 'Disk Space Critical',
    icon: HardDrive,
    color: 'from-yellow-500 to-orange-600',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    action: 'rotate-logs',
    actionName: 'Rotate Logs',
    description: 'Disk at 95% capacity!',
    severity: 'medium',
  },
  {
    id: 'primary-down',
    name: 'Primary Node Down',
    icon: CloudOff,
    color: 'from-red-500 to-pink-600',
    textColor: 'text-red-600 dark:text-red-400',
    action: 'failover',
    actionName: 'Fail Over',
    description: 'Primary instance unresponsive!',
    severity: 'critical',
  },
  {
    id: 'pod-crash',
    name: 'Pod CrashLoopBackOff',
    icon: RefreshCw,
    color: 'from-purple-500 to-pink-600',
    textColor: 'text-purple-600 dark:text-purple-400',
    action: 'restart-pods',
    actionName: 'Restart Pods',
    description: 'Container restart loop!',
    severity: 'high',
  },
  {
    id: 'db-slow',
    name: 'Database Slow Query',
    icon: Database,
    color: 'from-blue-500 to-purple-600',
    textColor: 'text-blue-600 dark:text-blue-400',
    action: 'scale-db',
    actionName: 'Scale DB',
    description: 'Query execution > 10s!',
    severity: 'medium',
  },
  {
    id: 'ddos',
    name: 'DDoS Attack',
    icon: Shield,
    color: 'from-red-600 to-orange-600',
    textColor: 'text-red-600 dark:text-red-400',
    action: 'enable-waf',
    actionName: 'Enable WAF',
    description: 'Malicious traffic detected!',
    severity: 'critical',
  },
  {
    id: 'memory-leak',
    name: 'Memory Leak',
    icon: Cpu,
    color: 'from-pink-500 to-red-600',
    textColor: 'text-pink-600 dark:text-pink-400',
    action: 'restart-pods',
    actionName: 'Restart Pods',
    description: 'Memory usage at 98%!',
    severity: 'high',
  },
  {
    id: 'network-partition',
    name: 'Network Partition',
    icon: Network,
    color: 'from-indigo-500 to-purple-600',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    action: 'failover',
    actionName: 'Fail Over',
    description: 'Cross-region failure!',
    severity: 'critical',
  },
  {
    id: 'webhook-flood',
    name: 'Webhook Flood',
    icon: Webhook,
    color: 'from-cyan-500 to-blue-600',
    textColor: 'text-cyan-600 dark:text-cyan-400',
    action: 'enable-waf',
    actionName: 'Enable WAF',
    description: 'Webhook spam detected!',
    severity: 'medium',
  },
  {
    id: 'bug-critical',
    name: 'Critical Bug',
    icon: Bug,
    color: 'from-red-500 to-rose-600',
    textColor: 'text-red-600 dark:text-red-400',
    action: 'rollback',
    actionName: 'Rollback',
    description: 'Production error spike!',
    severity: 'critical',
  },
];

// Action buttons configuration
const ACTIONS = [
  { id: 'add-nodes', name: 'Add Nodes', icon: Server, color: 'bg-green-600 hover:bg-green-700' },
  { id: 'rotate-logs', name: 'Rotate Logs', icon: FileText, color: 'bg-yellow-600 hover:bg-yellow-700' },
  { id: 'failover', name: 'Fail Over', icon: GitBranch, color: 'bg-red-600 hover:bg-red-700' },
  { id: 'restart-pods', name: 'Restart Pods', icon: RefreshCw, color: 'bg-purple-600 hover:bg-purple-700' },
  { id: 'scale-db', name: 'Scale DB', icon: Database, color: 'bg-blue-600 hover:bg-blue-700' },
  { id: 'enable-waf', name: 'Enable WAF', icon: Shield, color: 'bg-orange-600 hover:bg-orange-700' },
  { id: 'rollback', name: 'Rollback', icon: RotateCcw, color: 'bg-pink-600 hover:bg-pink-700' },
];

interface Incident {
  id: string;
  type: typeof INCIDENT_TYPES[number];
  spawnTime: number;
  expiryTime: number;
  position: number; // For visual positioning
}

export default function UptimeDefender() {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'paused' | 'gameover'>('start');
  const [uptime, setUptime] = useState(INITIAL_UPTIME);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeIncidents, setActiveIncidents] = useState<Set<string>>(new Set());
  const [combo, setCombo] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [totalIncidents, setTotalIncidents] = useState(0);
  const [resolvedIncidents, setResolvedIncidents] = useState(0);
  const [missedIncidents, setMissedIncidents] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [recentAction, setRecentAction] = useState<string | null>(null);

  const gameLoopRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const difficultyRef = useRef<number>(1);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem('uptime-defender-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // Spawn incidents
  const spawnIncident = useCallback(() => {
    const now = Date.now();
    const incidentType = INCIDENT_TYPES[Math.floor(Math.random() * INCIDENT_TYPES.length)];

    // Reduce lifetime based on difficulty (minimum 5 seconds even at max difficulty)
    const adjustedLifetime = Math.max(5000, INCIDENT_LIFETIME - (difficultyRef.current * 200));

    const newIncident: Incident = {
      id: `incident-${now}-${Math.random()}`,
      type: incidentType,
      spawnTime: now,
      expiryTime: now + adjustedLifetime,
      position: Math.random(),
    };

    setIncidents(prev => [...prev, newIncident]);
    setActiveIncidents(prev => new Set([...prev, newIncident.id]));
    setTotalIncidents(prev => prev + 1);
  }, []);

  // Handle action button click
  const handleAction = useCallback((actionId: string) => {
    const matchingIncidents = incidents.filter(
      inc => activeIncidents.has(inc.id) && inc.type.action === actionId
    );

    if (matchingIncidents.length > 0) {
      // Correct action!
      const incident = matchingIncidents[0];
      const timeBonus = Math.floor((incident.expiryTime - Date.now()) / 100);
      const severityMultiplier = incident.type.severity === 'critical' ? 3 : incident.type.severity === 'high' ? 2 : 1;
      const comboMultiplier = 1 + (combo * 0.1);
      const points = Math.floor((100 + timeBonus) * severityMultiplier * comboMultiplier);

      setScore(prev => prev + points);
      setCombo(prev => prev + 1);
      setResolvedIncidents(prev => prev + 1);
      setUptime(prev => Math.min(100, prev + 2));

      // Remove incident
      setActiveIncidents(prev => {
        const next = new Set(prev);
        next.delete(incident.id);
        return next;
      });

      // Visual feedback
      setRecentAction(actionId);
      setTimeout(() => setRecentAction(null), 300);

      // Confetti for combos
      if (combo > 0 && combo % 5 === 0) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 }
        });
      }
    } else {
      // Wrong action - penalty
      setCombo(0);
      setScore(prev => Math.max(0, prev - 50));
      setUptime(prev => Math.max(0, prev - 5));
    }
  }, [incidents, activeIncidents, combo]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const gameLoop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // Update timer
      setTimeLeft(prev => {
        const next = Math.max(0, prev - deltaTime / 1000);
        if (next === 0) {
          setGameState('gameover');
          // Save high score
          setHighScore(prevHigh => {
            const newHigh = Math.max(prevHigh, score);
            localStorage.setItem('uptime-defender-highscore', newHigh.toString());
            return newHigh;
          });
        }
        return next;
      });

      // Spawn incidents
      if (timestamp - lastSpawnRef.current > INCIDENT_SPAWN_INTERVAL / difficultyRef.current) {
        spawnIncident();
        lastSpawnRef.current = timestamp;
      }

      // Check for expired incidents
      const now = Date.now();
      setIncidents(prev => {
        const expired = prev.filter(inc =>
          activeIncidents.has(inc.id) && inc.expiryTime <= now
        );

        if (expired.length > 0) {
          // Penalty for missed incidents
          setUptime(u => Math.max(0, u - (5 * expired.length)));
          setCombo(0);
          setMissedIncidents(m => m + expired.length);

          // Remove expired from active set
          setActiveIncidents(active => {
            const next = new Set(active);
            expired.forEach(inc => next.delete(inc.id));
            return next;
          });
        }

        // Keep only non-expired or resolved incidents for a bit longer for animation
        return prev.filter(inc => inc.expiryTime > now - 1000);
      });

      // Uptime drain/recovery
      setUptime(prev => {
        if (activeIncidents.size > 0) {
          // Drain faster with more incidents
          const drainRate = UPTIME_DRAIN_RATE * (1 + activeIncidents.size * 0.2);
          return Math.max(0, prev - (drainRate * deltaTime / 1000));
        } else {
          // Recover when no incidents
          return Math.min(100, prev + (UPTIME_RECOVERY_RATE * deltaTime / 1000));
        }
      });

      // Increase difficulty over time
      difficultyRef.current = 1 + (GAME_DURATION - timeLeft) / 20;

      // Game over if uptime hits 0
      if (uptime <= 0) {
        setGameState('gameover');
        setHighScore(prevHigh => {
          const newHigh = Math.max(prevHigh, score);
          localStorage.setItem('uptime-defender-highscore', newHigh.toString());
          return newHigh;
        });
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, activeIncidents, spawnIncident, uptime, timeLeft, score]);

  const startGame = () => {
    setGameState('playing');
    setUptime(INITIAL_UPTIME);
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setIncidents([]);
    setActiveIncidents(new Set());
    setCombo(0);
    setTotalIncidents(0);
    setResolvedIncidents(0);
    setMissedIncidents(0);
    lastTimeRef.current = 0;
    lastSpawnRef.current = 0;
    difficultyRef.current = 1;
  };

  const togglePause = () => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
      lastTimeRef.current = 0; // Reset timing
    }
  };

  const getUptimeColor = () => {
    if (uptime >= 99.9) return 'text-green-500';
    if (uptime >= 99) return 'text-blue-500';
    if (uptime >= 95) return 'text-yellow-500';
    if (uptime >= 90) return 'text-orange-500';
    return 'text-red-500';
  };

  const getUptimeBarColor = () => {
    if (uptime >= 99.9) return 'bg-green-500';
    if (uptime >= 99) return 'bg-blue-500';
    if (uptime >= 95) return 'bg-yellow-500';
    if (uptime >= 90) return 'bg-orange-500';
    return 'bg-red-500';
  };

  // Start screen
  if (gameState === 'start') {
    return (
      <div className="container px-4 py-8 mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-5xl font-bold mb-4 bg-linear-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
            Uptime Defender
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Defend your infrastructure's uptime against incoming incidents!
          </p>

          <Card className="p-8 mb-8 max-w-2xl mx-auto">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2">
                  <Zap className="w-6 h-6 text-yellow-500" />
                  How to Play
                </h2>
                <div className="text-left space-y-3">
                  <p className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                    <span>Incidents will appear as alerts that need immediate action</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                    <span>Click the correct action button to resolve each incident</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                    <span>Resolve incidents quickly for bonus points and combo multipliers</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
                    <span>Missing incidents or wrong actions will drain your uptime</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Heart className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                    <span>Keep your uptime above 0% and survive for 60 seconds!</span>
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-lg font-semibold mb-3">Incident Types</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {INCIDENT_TYPES.slice(0, 6).map(type => (
                    <div key={type.id} className="flex items-center gap-2">
                      <type.icon className={`w-4 h-4 ${type.textColor}`} />
                      <span className="text-muted-foreground">{type.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {highScore > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-lg font-semibold flex items-center justify-center gap-2">
                    <Award className="w-5 h-5 text-yellow-500" />
                    High Score: <span className="text-green-500">{highScore.toLocaleString()}</span>
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Button
            onClick={startGame}
            size="lg"
            className="bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xl px-8 py-6 h-auto"
          >
            <Play className="w-6 h-6 mr-2" />
            Start Game
          </Button>

          <div className="mt-8">
            <Button asChild variant="outline">
              <Link href="/games">
                <Home className="w-4 h-4 mr-2" />
                Back to Games
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Game over screen
  if (gameState === 'gameover') {
    const successRate = totalIncidents > 0 ? (resolvedIncidents / totalIncidents) * 100 : 0;
    const isNewHighScore = score > highScore && highScore > 0;

    if (isNewHighScore) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    return (
      <div className="container px-4 py-8 mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <h1 className="text-5xl font-bold mb-4">
            {uptime > 0 ? '🎉 Mission Complete!' : '💥 System Down!'}
          </h1>

          {isNewHighScore && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="mb-4"
            >
              <p className="text-2xl font-bold text-yellow-500 flex items-center justify-center gap-2">
                <Award className="w-8 h-8" />
                New High Score!
              </p>
            </motion.div>
          )}

          <Card className="p-8 mb-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
              <div>
                <p className="text-4xl font-bold text-green-500">{score.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Score</p>
              </div>
              <div>
                <p className={`text-4xl font-bold ${getUptimeColor()}`}>{uptime.toFixed(2)}%</p>
                <p className="text-sm text-muted-foreground">Final Uptime</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-blue-500">{resolvedIncidents}</p>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-red-500">{missedIncidents}</p>
                <p className="text-sm text-muted-foreground">Missed</p>
              </div>
            </div>

            <div className="space-y-3 pt-6 border-t">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Success Rate:</span>
                <span className="font-semibold text-lg">{successRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Incidents:</span>
                <span className="font-semibold text-lg">{totalIncidents}</span>
              </div>
              {highScore > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">High Score:</span>
                  <span className="font-semibold text-lg text-yellow-500">{highScore.toLocaleString()}</span>
                </div>
              )}
            </div>
          </Card>

          <div className="flex flex-wrap gap-4 justify-center">
            <Button
              onClick={startGame}
              size="lg"
              className="bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
            >
              <Play className="w-5 h-5 mr-2" />
              Play Again
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/games">
                <Home className="w-5 h-5 mr-2" />
                Back to Games
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Playing screen
  return (
    <div className="container px-4 pb-4 md:pb-8 mx-auto max-w-7xl">
      {/* Header Stats */}
      <div className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          {/* Uptime */}
          <Card className="p-3 md:p-4 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <Activity className={`w-5 h-5 ${getUptimeColor()}`} />
              <span className="text-sm font-medium">Uptime</span>
            </div>
            <p className={`text-3xl md:text-4xl font-bold ${getUptimeColor()}`}>
              {uptime.toFixed(2)}%
            </p>
            <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${getUptimeBarColor()}`}
                initial={{ width: '100%' }}
                animate={{ width: `${uptime}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </Card>

          {/* Score */}
          <Card className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium">Score</span>
            </div>
            <p className="text-3xl md:text-4xl font-bold text-green-500">
              {score.toLocaleString()}
            </p>
          </Card>

          {/* Time */}
          <Card className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium">Time</span>
            </div>
            <p className="text-3xl md:text-4xl font-bold text-blue-500">
              {Math.ceil(timeLeft)}s
            </p>
          </Card>

          {/* Combo */}
          <Card className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-medium">Combo</span>
            </div>
            <p className="text-3xl md:text-4xl font-bold text-orange-500">
              {combo}x
            </p>
          </Card>

          {/* Controls */}
          <Card className="p-3 md:p-4 flex items-center justify-center gap-2">
            <Button
              onClick={togglePause}
              variant="outline"
              size={isMobile ? "sm" : "default"}
            >
              {gameState === 'paused' ? (
                <Play className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </Button>
            <Button
              onClick={startGame}
              variant="outline"
              size={isMobile ? "sm" : "default"}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </Card>
        </div>
      </div>

      {/* Incidents Area */}
      <Card className="p-4 md:p-6 mb-6 min-h-[300px] md:min-h-[400px] relative overflow-hidden">
        <div className="mb-4">
          <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            Active Incidents ({activeIncidents.size})
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <AnimatePresence mode="popLayout">
            {incidents
              .filter(inc => activeIncidents.has(inc.id))
              .map(incident => {
                const timeRemaining = Math.max(0, incident.expiryTime - Date.now());
                const adjustedLifetime = Math.max(5000, INCIDENT_LIFETIME - (difficultyRef.current * 200));
                const progress = (timeRemaining / adjustedLifetime) * 100;
                const IncidentIcon = incident.type.icon;

                return (
                  <motion.div
                    key={incident.id}
                    initial={{ scale: 0, opacity: 0, rotate: -10 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0, opacity: 0, rotate: 10 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="relative"
                  >
                    <Card className={`p-4 border-2 bg-linear-to-br ${incident.type.color} bg-opacity-10`}>
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-white dark:bg-gray-900`}>
                          <IncidentIcon className={`w-6 h-6 ${incident.type.textColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm md:text-base truncate">
                            {incident.type.name}
                          </h3>
                          <p className="text-xs md:text-sm text-muted-foreground">
                            {incident.type.description}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full ${progress > 50 ? 'bg-green-500' : progress > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                initial={{ width: '100%' }}
                                animate={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono">
                              {(timeRemaining / 1000).toFixed(1)}s
                            </span>
                          </div>
                        </div>
                      </div>

                      {incident.type.severity === 'critical' && (
                        <div className="absolute -top-1 -right-1">
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full"
                          >
                            CRITICAL
                          </motion.div>
                        </div>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>

        {activeIncidents.size === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground text-lg">
              {gameState === 'paused' ? '⏸️ Game Paused' : '✅ All clear! No active incidents'}
            </p>
          </div>
        )}
      </Card>

      {/* Action Buttons */}
      <Card className="p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold mb-4 flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-500" />
          Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 md:gap-3">
          {ACTIONS.map(action => {
            const ActionIcon = action.icon;
            const isActive = recentAction === action.id;

            return (
              <motion.div
                key={action.id}
                whileTap={{ scale: 0.95 }}
                animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.2 }}
              >
                <Button
                  onClick={() => handleAction(action.id)}
                  disabled={gameState === 'paused'}
                  className={`${action.color} text-white w-full h-auto py-3 md:py-4 flex flex-col items-center gap-1 md:gap-2 text-xs md:text-sm font-semibold ${isActive ? 'ring-4 ring-yellow-400' : ''}`}
                >
                  <ActionIcon className="w-5 h-5 md:w-6 md:h-6" />
                  <span className="leading-tight">{action.name}</span>
                </Button>
              </motion.div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
