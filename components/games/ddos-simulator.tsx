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
  Settings,
  Target,
  TrendingUp,
  Server,
  Wifi,
  WifiOff,
  Flame,
  Heart,
  Award,
  BarChart3,
  ShieldCheck,
  Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Attack particle interface
interface Particle {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  color: string;
  type: 'http' | 'syn' | 'udp';
  progress: number;
}

// Explosion interface
interface Explosion {
  id: string;
  x: number;
  y: number;
  color: string;
}

// Achievement interface
interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  icon: string;
}

// Attack types
const ATTACK_TYPES = {
  http: { name: 'HTTP Flood', color: '#3b82f6', description: 'Overwhelming with HTTP requests' },
  syn: { name: 'SYN Flood', color: '#8b5cf6', description: 'Half-open TCP connections' },
  udp: { name: 'UDP Flood', color: '#ec4899', description: 'User Datagram Protocol flood' },
};

// Achievements list
const ACHIEVEMENTS_LIST: Achievement[] = [
  { id: 'survivor_30', title: 'Survivor', description: 'Survive for 30 seconds', unlocked: false, icon: '🛡️' },
  { id: 'survivor_60', title: 'Defender', description: 'Survive for 60 seconds', unlocked: false, icon: '🏰' },
  { id: 'survivor_120', title: 'Fortress', description: 'Survive for 2 minutes', unlocked: false, icon: '🏛️' },
  { id: 'block_100', title: 'Firewall Master', description: 'Block 100 attacks', unlocked: false, icon: '🔥' },
  { id: 'block_500', title: 'Shield Expert', description: 'Block 500 attacks', unlocked: false, icon: '⚔️' },
  { id: 'survive_max', title: 'Unbreakable', description: 'Survive max intensity for 30s', unlocked: false, icon: '👑' },
  { id: 'recover_full', title: 'Phoenix', description: 'Recover from critical to full health', unlocked: false, icon: '🔄' },
];

// Slider component
function Slider({
  value,
  onValueChange,
  min,
  max,
  step,
  className,
}: {
  value: number[];
  onValueChange: (value: number[]) => void;
  min: number;
  max: number;
  step: number;
  className?: string;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value[0]}
      onChange={(e) => onValueChange([parseInt(e.target.value)])}
      className={cn(
        'w-full h-3 bg-linear-to-r from-green-200 via-yellow-200 to-red-200 rounded-lg appearance-none cursor-pointer slider-thumb',
        className
      )}
      style={{
        background: `linear-gradient(to right, #86efac 0%, #fef08a ${(value[0] / max) * 50}%, #fca5a5 100%)`,
      }}
    />
  );
}

export default function DDoSSimulator() {
  // Theme
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = resolvedTheme === 'dark';

  // Game state
  const [isRunning, setIsRunning] = useState(false);
  const [intensity, setIntensity] = useState(3);
  const [serverHealth, setServerHealth] = useState(100);
  const [totalRequests, setTotalRequests] = useState(0);
  const [blockedRequests, setBlockedRequests] = useState(0);
  const [currentRPS, setCurrentRPS] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [attackType, setAttackType] = useState<keyof typeof ATTACK_TYPES>('http');
  const [hasFirewall, setHasFirewall] = useState(false);
  const [hasLoadBalancer, setHasLoadBalancer] = useState(false);
  const [autoRateLimiting, setAutoRateLimiting] = useState(false);
  const [rateLimitActive, setRateLimitActive] = useState(false);
  const [showEducation, setShowEducation] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [survivalTime, setSurvivalTime] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [currentWave, setCurrentWave] = useState(1);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryRate, setRecoveryRate] = useState(0);
  const [achievements, setAchievements] = useState<Achievement[]>(ACHIEVEMENTS_LIST);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);
  const [screenShake, setScreenShake] = useState(false);
  const [lastHealthCheck, setLastHealthCheck] = useState(100);

  // Refs
  const animationFrameRef = useRef<number>();
  const particleIdCounter = useRef(0);
  const explosionIdCounter = useRef(0);
  const lastSpawnTime = useRef(Date.now());
  const startTime = useRef(Date.now());
  const waveStartTime = useRef(Date.now());
  const maxIntensityTime = useRef(0);
  const criticalRecoveryCheck = useRef(false);

  // Load high score from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ddos-high-score');
    if (saved) setHighScore(parseInt(saved));

    const savedAchievements = localStorage.getItem('ddos-achievements');
    if (savedAchievements) {
      setAchievements(JSON.parse(savedAchievements));
    }

    setMounted(true);

    // Ensure page starts at top
    window.scrollTo(0, 0);
  }, []);

  // Calculate spawn rate based on intensity and wave
  const getSpawnRate = useCallback(() => {
    const waveMultiplier = 1 + (currentWave - 1) * 0.1; // Increase difficulty by 10% per wave
    const baseRate = Math.max(50, 500 - intensity * 50);
    return Math.max(30, baseRate / waveMultiplier);
  }, [intensity, currentWave]);

  // Generate random spawn position (from edges)
  const getRandomSpawnPosition = useCallback(() => {
    const side = Math.floor(Math.random() * 4);
    const centerX = 50;
    const centerY = 50;

    switch (side) {
      case 0: // Top
        return { x: Math.random() * 100, y: 0, targetX: centerX, targetY: centerY };
      case 1: // Right
        return { x: 100, y: Math.random() * 100, targetX: centerX, targetY: centerY };
      case 2: // Bottom
        return { x: Math.random() * 100, y: 100, targetX: centerX, targetY: centerY };
      case 3: // Left
        return { x: 0, y: Math.random() * 100, targetX: centerX, targetY: centerY };
      default:
        return { x: 0, y: 0, targetX: centerX, targetY: centerY };
    }
  }, []);

  // Create explosion effect
  const createExplosion = useCallback((x: number, y: number, color: string) => {
    const explosion: Explosion = {
      id: `explosion-${explosionIdCounter.current++}`,
      x,
      y,
      color,
    };
    setExplosions((prev) => [...prev, explosion]);

    // Remove explosion after animation
    setTimeout(() => {
      setExplosions((prev) => prev.filter((e) => e.id !== explosion.id));
    }, 500);
  }, []);

  // Check and unlock achievements
  const checkAchievements = useCallback((currentTime: number, blockedCount: number) => {
    setAchievements((prev) => {
      const updated = prev.map((achievement) => {
        if (achievement.unlocked) return achievement;

        let shouldUnlock = false;

        switch (achievement.id) {
          case 'survivor_30':
            shouldUnlock = currentTime >= 30;
            break;
          case 'survivor_60':
            shouldUnlock = currentTime >= 60;
            break;
          case 'survivor_120':
            shouldUnlock = currentTime >= 120;
            break;
          case 'block_100':
            shouldUnlock = blockedCount >= 100;
            break;
          case 'block_500':
            shouldUnlock = blockedCount >= 500;
            break;
          case 'survive_max':
            shouldUnlock = intensity === 10 && maxIntensityTime.current >= 30;
            break;
          case 'recover_full':
            shouldUnlock = criticalRecoveryCheck.current;
            break;
        }

        if (shouldUnlock && !achievement.unlocked) {
          setNewAchievement({ ...achievement, unlocked: true });
          setTimeout(() => setNewAchievement(null), 3000);
          return { ...achievement, unlocked: true };
        }

        return achievement;
      });

      // Save to localStorage
      localStorage.setItem('ddos-achievements', JSON.stringify(updated));
      return updated;
    });
  }, [intensity]);

  // Track max intensity time
  useEffect(() => {
    if (isRunning && intensity === 10) {
      const interval = setInterval(() => {
        maxIntensityTime.current += 1;
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning, intensity]);

  // Spawn new particle
  const spawnParticle = useCallback(() => {
    const position = getRandomSpawnPosition();
    const newParticle: Particle = {
      id: `particle-${particleIdCounter.current++}`,
      ...position,
      speed: 0.5 + Math.random() * 0.5,
      color: ATTACK_TYPES[attackType].color,
      type: attackType,
      progress: 0,
    };
    setParticles((prev) => [...prev, newParticle]);
  }, [attackType, getRandomSpawnPosition]);

  // Wave system
  useEffect(() => {
    if (!isRunning) return;

    const checkWaveProgress = setInterval(() => {
      const waveTime = Math.floor((Date.now() - waveStartTime.current) / 1000);
      if (waveTime >= 30) { // New wave every 30 seconds
        setCurrentWave((prev) => prev + 1);
        waveStartTime.current = Date.now();
      }
    }, 1000);

    return () => clearInterval(checkWaveProgress);
  }, [isRunning]);

  // Auto rate limiting
  useEffect(() => {
    if (!autoRateLimiting) {
      setRateLimitActive(false);
      return;
    }

    // Activate when RPS is too high
    if (currentRPS > 50) {
      setRateLimitActive(true);
    } else if (currentRPS < 20) {
      setRateLimitActive(false);
    }
  }, [currentRPS, autoRateLimiting]);

  // Server recovery system
  useEffect(() => {
    if (gameOver) return;

    const recoveryInterval = setInterval(() => {
      setServerHealth((prev) => {
        if (prev >= 100) {
          setIsRecovering(false);
          setRecoveryRate(0);
          return 100;
        }

        // If paused, always recover (server resources normalizing)
        if (!isRunning) {
          const pausedRecovery = 3; // Faster recovery when paused
          setIsRecovering(true);
          setRecoveryRate(pausedRecovery);
          return Math.min(100, prev + pausedRecovery);
        }

        // Calculate effective RPS based on active defenses
        const effectiveRPS = currentRPS *
          (hasFirewall ? 0.7 : 1) *  // Firewall blocks 30%
          (rateLimitActive ? 0.6 : 1) *  // Rate limiter blocks 40%
          (hasLoadBalancer ? 0.5 : 1);  // Load balancer reduces load 50%

        // Recovery depends on effective load (lower load = faster recovery)
        const effectiveLoad = Math.min(effectiveRPS / 100, 1); // 0 to 1
        const baseRecovery = 2.5; // Base recovery per second

        // More defenses = better recovery even under load
        const defenseCount = [hasFirewall, hasLoadBalancer, autoRateLimiting && rateLimitActive].filter(Boolean).length;
        const defenseBonus = defenseCount * 0.5; // Each active defense adds 0.5/s

        // Recovery calculation: better recovery when load is low and defenses are active
        const loadRecovery = baseRecovery * (1 - effectiveLoad * 0.7);
        const totalRecovery = Math.max(0.2, loadRecovery + defenseBonus); // Minimum 0.2/s recovery

        setIsRecovering(true);
        setRecoveryRate(totalRecovery);

        // Check for phoenix achievement
        if (prev < 30 && prev + totalRecovery >= 90) {
          criticalRecoveryCheck.current = true;
        }

        return Math.min(100, prev + totalRecovery);
      });
    }, 1000);

    return () => clearInterval(recoveryInterval);
  }, [isRunning, gameOver, currentRPS, hasLoadBalancer, hasFirewall, rateLimitActive, autoRateLimiting]);

  // Animation loop
  const animate = useCallback(() => {
    if (!isRunning) return;

    const now = Date.now();

    // Spawn particles based on intensity
    if (now - lastSpawnTime.current > getSpawnRate()) {
      spawnParticle();
      lastSpawnTime.current = now;
    }

    // Update particles
    setParticles((prevParticles) => {
      const updatedParticles = prevParticles
        .map((particle) => {
          const newProgress = particle.progress + particle.speed * 0.02;

          // Check if particle reached target
          if (newProgress >= 1) {
            // Particle hit the server
            setTotalRequests((prev) => prev + 1);
            setCurrentRPS((prev) => prev + 1);

            // Calculate if blocked
            let blocked = false;

            // Firewall blocks 30%
            if (hasFirewall && Math.random() < 0.3) {
              blocked = true;
            }

            // Rate limiting blocks 40% when active
            if (rateLimitActive && Math.random() < 0.4) {
              blocked = true;
            }

            // Load balancer reduces damage by 50%
            const damageMultiplier = hasLoadBalancer ? 0.5 : 1;

            if (blocked) {
              setBlockedRequests((prev) => prev + 1);
              createExplosion(particle.targetX, particle.targetY, particle.color);
              return null;
            }

            // Damage server health
            const baseDamage = intensity * 0.5;
            const damage = baseDamage * damageMultiplier;

            setServerHealth((prev) => {
              const newHealth = Math.max(0, prev - damage);

              // Trigger screen shake on heavy hits
              if (damage > 2 && newHealth < 50) {
                setScreenShake(true);
                setTimeout(() => setScreenShake(false), 200);
              }

              return newHealth;
            });

            return null;
          }

          return {
            ...particle,
            progress: newProgress,
          };
        })
        .filter(Boolean) as Particle[];

      return updatedParticles;
    });

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [isRunning, intensity, hasFirewall, hasLoadBalancer, rateLimitActive, getSpawnRate, spawnParticle, createExplosion]);

  // Start/stop animation
  useEffect(() => {
    if (isRunning) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning, animate]);

  // Check game over
  useEffect(() => {
    if (serverHealth <= 0 && isRunning) {
      setGameOver(true);
      setIsRunning(false);
      const finalTime = Math.floor((Date.now() - startTime.current) / 1000);
      setSurvivalTime(finalTime);

      // Update high score
      if (finalTime > highScore) {
        setHighScore(finalTime);
        localStorage.setItem('ddos-high-score', finalTime.toString());
      }
    }
  }, [serverHealth, isRunning, highScore]);

  // Reset current RPS every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentRPS(0);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Check achievements
  useEffect(() => {
    if (isRunning) {
      const currentTime = Math.floor((Date.now() - startTime.current) / 1000);
      checkAchievements(currentTime, blockedRequests);
    }
  }, [isRunning, survivalTime, blockedRequests, serverHealth, checkAchievements]);

  // Track health changes for achievements
  useEffect(() => {
    setLastHealthCheck(serverHealth);
  }, [serverHealth]);

  // Reset game
  const resetGame = useCallback(() => {
    setIsRunning(false);
    setServerHealth(100);
    setTotalRequests(0);
    setBlockedRequests(0);
    setCurrentRPS(0);
    setParticles([]);
    setExplosions([]);
    setGameOver(false);
    setSurvivalTime(0);
    setCurrentWave(1);
    setIsRecovering(false);
    setRecoveryRate(0);
    setRateLimitActive(false);
    startTime.current = Date.now();
    waveStartTime.current = Date.now();
    maxIntensityTime.current = 0;
    criticalRecoveryCheck.current = false;
  }, []);

  // Toggle simulation
  const toggleSimulation = useCallback(() => {
    if (!isRunning) {
      startTime.current = Date.now();
      waveStartTime.current = Date.now();
    }
    setIsRunning(!isRunning);
  }, [isRunning]);

  // Get server status
  const getServerStatus = () => {
    if (serverHealth > 70) return { text: 'Healthy', color: 'text-green-500', bg: 'bg-green-500' };
    if (serverHealth > 40)
      return { text: 'Degraded', color: 'text-yellow-500', bg: 'bg-yellow-500' };
    if (serverHealth > 0) return { text: 'Critical', color: 'text-red-500', bg: 'bg-red-500' };
    return { text: 'Down', color: 'text-gray-500', bg: 'bg-gray-500' };
  };

  const serverStatus = getServerStatus();
  const activeDefenses = [hasFirewall, hasLoadBalancer, autoRateLimiting].filter(Boolean).length;
  const unlockedAchievements = achievements.filter((a) => a.unlocked).length;

  // Early return to prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <div className={cn(
      "min-h-screen",
      isDark
        ? "bg-linear-to-br from-slate-950 via-slate-900 to-slate-950"
        : "bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50"
    )}>
      <div className={cn("container mx-auto px-4 py-6 sm:py-8 transition-transform duration-200", screenShake && "animate-shake")}>
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
          <Link
            href="/games"
            className="hover:text-primary transition-colors flex items-center gap-1"
          >
            <Home className="w-4 h-4" />
            Games
          </Link>
          <span>/</span>
          <span className="text-foreground">DDoS Simulator</span>
        </nav>

        {/* Achievement Notification */}
        <AnimatePresence>
          {newAchievement && (
            <motion.div
              initial={{ opacity: 0, y: -50, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -50, x: '-50%' }}
              className="fixed top-20 left-1/2 z-50 bg-linear-to-r from-yellow-500/90 to-orange-500/90 backdrop-blur-sm px-6 py-4 rounded-xl shadow-2xl border-2 border-yellow-400"
            >
              <div className="flex items-center gap-3">
                <Award className="w-6 h-6 text-white" />
                <div className="text-white">
                  <div className="font-bold flex items-center gap-2">
                    <span>{newAchievement.icon}</span>
                    <span>Achievement Unlocked!</span>
                  </div>
                  <div className="text-sm">{newAchievement.title}: {newAchievement.description}</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/50">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-linear-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
              DDoS Attack Simulator
            </h1>
          </div>
          <p className={cn(
            "text-lg max-w-2xl mx-auto mb-4",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            Educational simulator to understand how Distributed Denial of Service attacks work and
            why protection is crucial
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Badge variant="outline" className="border-red-500/30 text-red-400">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Educational Only
            </Badge>
            <Badge variant="outline" className="border-blue-500/30 text-blue-400">
              <Activity className="w-3 h-3 mr-1" />
              Wave {currentWave}
            </Badge>
            <Badge variant="outline" className="border-purple-500/30 text-purple-400">
              <Award className="w-3 h-3 mr-1" />
              {unlockedAchievements}/{achievements.length} Achievements
            </Badge>
            {highScore > 0 && (
              <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                <Target className="w-3 h-3 mr-1" />
                Best: {highScore}s
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEducation(!showEducation)}
              className={cn(
                isDark
                  ? "text-gray-400 hover:text-white"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Info className="w-4 h-4 mr-2" />
              Learn More
            </Button>
          </div>
        </motion.div>

        {/* Educational Content */}
        <AnimatePresence>
          {showEducation && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8"
            >
              <Card className={cn(
                "backdrop-blur border",
                isDark
                  ? "bg-slate-900/50 border-blue-500/20"
                  : "bg-white/80 border-blue-200"
              )}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-400">
                    <Info className="w-5 h-5" />
                    What is a DDoS Attack?
                  </CardTitle>
                </CardHeader>
                <CardContent className={cn(
                  "space-y-4 text-sm",
                  isDark ? "text-gray-300" : "text-gray-700"
                )}>
                  <p>
                    A <strong>Distributed Denial of Service (DDoS)</strong> attack is a malicious
                    attempt to disrupt the normal traffic of a targeted server, service, or network
                    by overwhelming it with a flood of internet traffic from multiple sources.
                  </p>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <h4 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                        <Wifi className="w-4 h-4" />
                        HTTP Flood
                      </h4>
                      <p className="text-xs">
                        Overwhelms the server with seemingly legitimate HTTP GET or POST requests
                      </p>
                    </div>
                    <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <h4 className="font-semibold text-purple-400 mb-2 flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        SYN Flood
                      </h4>
                      <p className="text-xs">
                        Exploits TCP handshake by sending many SYN requests without completing the
                        connection
                      </p>
                    </div>
                    <div className="p-4 bg-pink-500/10 rounded-lg border border-pink-500/20">
                      <h4 className="font-semibold text-pink-400 mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        UDP Flood
                      </h4>
                      <p className="text-xs">
                        Floods random ports with UDP packets, forcing the server to check for
                        applications
                      </p>
                    </div>
                  </div>
                  <Alert className="bg-yellow-500/10 border-yellow-500/20">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription className="text-yellow-200 text-xs">
                      <strong>Important:</strong> This is purely educational. Launching actual DDoS
                      attacks is illegal and unethical. Always use proper DDoS protection services
                      in production.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Game Area */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Controls Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Attack Controls */}
            <Card className={cn(
              "backdrop-blur",
              isDark 
                ? "bg-slate-900/50 border-slate-700/50" 
                : "bg-white border-gray-200"
            )}>
              <CardHeader>
                <CardTitle className={cn(
                  "flex items-center gap-2",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  <Settings className="w-5 h-5" />
                  Attack Configuration
                </CardTitle>
                <CardDescription className={cn(
                  isDark ? "" : "text-gray-600"
                )}>Adjust attack parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Attack Type */}
                <div className="space-y-3">
                  <label className={cn(
                    "text-sm font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}>Attack Type</label>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(ATTACK_TYPES).map(([key, attack]) => (
                      <button
                        key={key}
                        onClick={() => setAttackType(key as keyof typeof ATTACK_TYPES)}
                        disabled={isRunning}
                        className={cn(
                          'p-3 rounded-lg border-2 transition-all text-left',
                          attackType === key
                            ? 'border-current shadow-lg scale-[1.02]'
                            : 'border-slate-700 hover:border-slate-600',
                          isRunning && 'opacity-50 cursor-not-allowed'
                        )}
                        style={{
                          borderColor: attackType === key ? attack.color : undefined,
                          backgroundColor:
                            attackType === key ? `${attack.color}15` : 'transparent',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: attack.color }}
                          />
                          <span className={cn(
                            "font-semibold text-sm",
                            isDark ? "text-white" : "text-gray-900"
                          )}>{attack.name}</span>
                        </div>
                        <p className={cn(
                          "text-xs",
                          isDark ? "text-gray-400" : "text-gray-600"
                        )}>{attack.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Intensity Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className={cn(
                      "text-sm font-medium",
                      isDark ? "text-gray-300" : "text-gray-700"
                    )}>
                      Attack Intensity: Level {intensity}
                    </label>
                    <Badge
                      variant="outline"
                      className={cn(
                        intensity <= 3
                          ? 'border-green-500/50 text-green-400'
                          : intensity <= 6
                            ? 'border-yellow-500/50 text-yellow-400'
                            : 'border-red-500/50 text-red-400'
                      )}
                    >
                      {intensity <= 3 ? 'Low' : intensity <= 6 ? 'Medium' : 'High'}
                    </Badge>
                  </div>
                  <Slider
                    value={[intensity]}
                    onValueChange={(val) => setIntensity(val[0])}
                    min={1}
                    max={10}
                    step={1}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Gentle</span>
                    <span>Moderate</span>
                    <span>Devastating</span>
                  </div>
                </div>

                {/* Defense Mechanisms */}
                <div className="space-y-3">
                  <div className={cn(
                    "flex items-center justify-between text-sm font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}>
                    <span>Defense Systems</span>
                    <Badge variant="outline" className="text-xs">
                      {activeDefenses}/3 Active
                    </Badge>
                  </div>

                  {/* Firewall */}
                  <div className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    isDark
                      ? "bg-slate-800/50 border-slate-700/50"
                      : "bg-gray-100 border-gray-300"
                  )}>
                    <div className="flex items-center gap-2">
                      <Shield
                        className={cn('w-5 h-5', hasFirewall ? 'text-green-400' : 'text-gray-500')}
                      />
                      <div>
                        <div className={cn(
                          "text-sm font-medium",
                          isDark ? "text-white" : "text-gray-900"
                        )}>Firewall</div>
                        <div className={cn(
                          "text-xs",
                          isDark ? "text-gray-400" : "text-gray-600"
                        )}>Blocks ~30% of attacks</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setHasFirewall(!hasFirewall)}
                      className={cn(
                        'relative w-12 h-6 rounded-full transition-colors',
                        hasFirewall ? 'bg-green-500' : 'bg-slate-600'
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform',
                          hasFirewall ? 'translate-x-6' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>

                  {/* Load Balancer */}
                  <div className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    isDark
                      ? "bg-slate-800/50 border-slate-700/50"
                      : "bg-gray-100 border-gray-300"
                  )}>
                    <div className="flex items-center gap-2">
                      <BarChart3
                        className={cn('w-5 h-5', hasLoadBalancer ? 'text-blue-400' : 'text-gray-500')}
                      />
                      <div>
                        <div className={cn(
                          "text-sm font-medium",
                          isDark ? "text-white" : "text-gray-900"
                        )}>Load Balancer</div>
                        <div className={cn(
                          "text-xs",
                          isDark ? "text-gray-400" : "text-gray-600"
                        )}>Reduces damage by 50%</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setHasLoadBalancer(!hasLoadBalancer)}
                      className={cn(
                        'relative w-12 h-6 rounded-full transition-colors',
                        hasLoadBalancer ? 'bg-blue-500' : 'bg-slate-600'
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform',
                          hasLoadBalancer ? 'translate-x-6' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>

                  {/* Auto Rate Limiting */}
                  <div className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    isDark
                      ? "bg-slate-800/50 border-slate-700/50"
                      : "bg-gray-100 border-gray-300"
                  )}>
                    <div className="flex items-center gap-2">
                      <Gauge
                        className={cn('w-5 h-5', autoRateLimiting ? 'text-purple-400' : 'text-gray-500')}
                      />
                      <div>
                        <div className={cn(
                          "text-sm font-medium flex items-center gap-2",
                          isDark ? "text-white" : "text-gray-900"
                        )}>
                          Auto Rate Limit
                          {rateLimitActive && (
                            <Badge variant="outline" className="text-xs border-purple-500 text-purple-400">
                              Active
                            </Badge>
                          )}
                        </div>
                        <div className={cn(
                          "text-xs",
                          isDark ? "text-gray-400" : "text-gray-600"
                        )}>Auto-blocks high traffic</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setAutoRateLimiting(!autoRateLimiting)}
                      className={cn(
                        'relative w-12 h-6 rounded-full transition-colors',
                        autoRateLimiting ? 'bg-purple-500' : 'bg-slate-600'
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform',
                          autoRateLimiting ? 'translate-x-6' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Defense Info Tip */}
                {activeDefenses > 0 && (
                  <div className={cn(
                    "p-3 rounded-lg border",
                    isDark
                      ? "bg-blue-500/10 border-blue-500/20"
                      : "bg-blue-50 border-blue-300"
                  )}>
                    <p className={cn(
                      "text-xs",
                      isDark ? "text-blue-300" : "text-blue-800"
                    )}>
                      💡 <strong>Tip:</strong> Active defenses reduce effective load and boost server recovery rate (+{activeDefenses * 0.5}/s). Pause to normalize faster!
                    </p>
                  </div>
                )}

                {/* Control Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={toggleSimulation}
                    className={cn(
                      'flex-1',
                      isRunning
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-linear-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600'
                    )}
                    disabled={gameOver}
                  >
                    {isRunning ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Stop Attack
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Attack
                      </>
                    )}
                  </Button>
                  <Button onClick={resetGame} variant="outline" className="border-slate-600">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Visualization Panel */}
          <div className="lg:col-span-1">
            <Card className={cn(
              "backdrop-blur h-full border",
              isDark
                ? "bg-slate-900/50 border-slate-700/50"
                : "bg-white/80 border-gray-200"
            )}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className={cn(
                    "flex items-center gap-2",
                    isDark ? "text-white" : "text-gray-900"
                  )}>
                    <Target className="w-5 h-5" />
                    Network Visualization
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn('border-current', serverStatus.color)}>
                      <Activity className="w-3 h-3 mr-1" />
                      {serverStatus.text}
                    </Badge>
                    {isRecovering && serverHealth < 100 && (
                      <Badge variant="outline" className="border-green-500/50 text-green-400">
                        <Heart className="w-3 h-3 mr-1 animate-pulse" />
                        {!isRunning ? 'Normalizing +3.0/s' : `Recovering +${recoveryRate.toFixed(1)}/s`}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Server Health Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      "text-sm font-medium",
                      isDark ? "text-gray-300" : "text-gray-700"
                    )}>Server Health</span>
                    <span className={cn('text-sm font-bold', serverStatus.color)}>
                      {Math.floor(serverHealth)}%
                    </span>
                  </div>
                  <div className={cn(
                    "h-3 rounded-full overflow-hidden border",
                    isDark 
                      ? "bg-slate-800 border-slate-700" 
                      : "bg-gray-200 border-gray-300"
                  )}>
                    <motion.div
                      className={cn('h-full transition-all duration-300', serverStatus.bg)}
                      style={{ width: `${serverHealth}%` }}
                      animate={{
                        opacity: serverHealth < 30 ? [1, 0.5, 1] : 1,
                      }}
                      transition={{
                        duration: 0.5,
                        repeat: serverHealth < 30 ? Infinity : 0,
                      }}
                    />
                  </div>
                </div>

                {/* Visualization Area */}
                <div
                  className={cn(
                    "relative w-full rounded-lg border-2 overflow-hidden",
                    isDark ? "bg-slate-950 border-slate-800" : "bg-gray-100 border-gray-300"
                  )}
                  style={{ height: '450px' }}
                >
                  {/* Background Grid */}
                  <div className="absolute inset-0 opacity-10">
                    <svg width="100%" height="100%">
                      <defs>
                        <pattern
                          id="grid"
                          width="40"
                          height="40"
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d="M 40 0 L 0 0 0 40"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="0.5"
                          />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                  </div>

                  {/* Particles */}
                  <AnimatePresence>
                    {particles.map((particle) => {
                      const currentX =
                        particle.x + (particle.targetX - particle.x) * particle.progress;
                      const currentY =
                        particle.y + (particle.targetY - particle.y) * particle.progress;

                      return (
                        <motion.div
                          key={particle.id}
                          className="absolute w-2 h-2 rounded-full"
                          style={{
                            left: `${currentX}%`,
                            top: `${currentY}%`,
                            backgroundColor: particle.color,
                            boxShadow: `0 0 10px ${particle.color}`,
                          }}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                        />
                      );
                    })}
                  </AnimatePresence>

                  {/* Explosions */}
                  <AnimatePresence>
                    {explosions.map((explosion) => (
                      <motion.div
                        key={explosion.id}
                        className="absolute"
                        style={{
                          left: `${explosion.x}%`,
                          top: `${explosion.y}%`,
                        }}
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 3, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                      >
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{
                            backgroundColor: explosion.color,
                            boxShadow: `0 0 20px ${explosion.color}`,
                          }}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Central Server */}
                  <motion.div
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                    animate={{
                      scale: serverHealth < 30 ? [1, 0.95, 1] : 1,
                    }}
                    transition={{
                      duration: 0.3,
                      repeat: serverHealth < 30 ? Infinity : 0,
                    }}
                  >
                    <div
                      className={cn(
                        'relative w-24 h-24 rounded-2xl flex items-center justify-center transition-all duration-300',
                        serverHealth > 70
                          ? 'bg-linear-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-500/50'
                          : serverHealth > 40
                            ? 'bg-linear-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50'
                            : serverHealth > 0
                              ? 'bg-linear-to-br from-red-500/20 to-rose-500/20 border-2 border-red-500/50'
                              : 'bg-linear-to-br from-gray-500/20 to-slate-500/20 border-2 border-gray-500/50'
                      )}
                    >
                      <Server
                        className={cn(
                          'w-12 h-12',
                          serverHealth > 70
                            ? 'text-green-400'
                            : serverHealth > 40
                              ? 'text-yellow-400'
                              : serverHealth > 0
                                ? 'text-red-400'
                                : 'text-gray-500'
                        )}
                      />

                      {/* Defense indicators */}
                      {hasFirewall && (
                        <motion.div
                          className="absolute -top-2 -right-2"
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/50">
                            <Shield className="w-5 h-5 text-white" />
                          </div>
                        </motion.div>
                      )}

                      {hasLoadBalancer && (
                        <motion.div
                          className="absolute -bottom-2 -right-2"
                          animate={{ y: [0, -3, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/50">
                            <BarChart3 className="w-5 h-5 text-white" />
                          </div>
                        </motion.div>
                      )}

                      {autoRateLimiting && (
                        <motion.div
                          className="absolute -top-2 -left-2"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/50">
                            <Gauge className="w-5 h-5 text-white" />
                          </div>
                        </motion.div>
                      )}

                      {/* Fire effect when critical */}
                      {serverHealth < 30 && serverHealth > 0 && (
                        <motion.div
                          className="absolute -top-6"
                          animate={{
                            y: [0, -5, 0],
                            opacity: [0.7, 1, 0.7],
                          }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                          }}
                        >
                          <Flame className="w-6 h-6 text-orange-500" />
                        </motion.div>
                      )}

                      {/* Recovery indicator */}
                      {isRecovering && serverHealth < 90 && (
                        <motion.div
                          className="absolute -bottom-6"
                          animate={{
                            y: [0, -3, 0],
                            opacity: [0.5, 1, 0.5],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                          }}
                        >
                          <Heart className="w-6 h-6 text-green-400" />
                        </motion.div>
                      )}

                      {/* Offline icon when down */}
                      {serverHealth <= 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-2xl">
                          <WifiOff className="w-12 h-12 text-gray-500" />
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Game Over Overlay */}
                  <AnimatePresence>
                    {gameOver && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center"
                      >
                        <div className={cn(
                          "text-center p-8 rounded-2xl border-2 border-red-500/50 shadow-2xl max-w-md",
                          isDark ? "bg-slate-900/90" : "bg-white/95"
                        )}>
                          <WifiOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
                          <h3 className={cn(
                            "text-2xl font-bold mb-2",
                            isDark ? "text-white" : "text-gray-900"
                          )}>Server Offline</h3>
                          <p className={cn(
                            "mb-4",
                            isDark ? "text-gray-400" : "text-gray-600"
                          )}>
                            The server was overwhelmed by the DDoS attack!
                          </p>
                          <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className={cn(
                              "p-4 rounded-lg",
                              isDark ? "bg-slate-800/50" : "bg-gray-100"
                            )}>
                              <div className="text-3xl font-bold text-orange-400">
                                {survivalTime}s
                              </div>
                              <div className={cn(
                                "text-sm",
                                isDark ? "text-gray-400" : "text-gray-600"
                              )}>Survival Time</div>
                            </div>
                            <div className={cn(
                              "p-4 rounded-lg",
                              isDark ? "bg-slate-800/50" : "bg-gray-100"
                            )}>
                              <div className="text-3xl font-bold text-green-400">
                                {blockedRequests}
                              </div>
                              <div className={cn(
                                "text-sm",
                                isDark ? "text-gray-400" : "text-gray-600"
                              )}>Blocked</div>
                            </div>
                          </div>
                          {survivalTime === highScore && highScore > 0 && (
                            <Badge className="mb-4 bg-linear-to-r from-yellow-500 to-orange-500">
                              🏆 New High Score!
                            </Badge>
                          )}
                          <Button
                            onClick={resetGame}
                            className="bg-linear-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Try Again
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs">
                  {Object.entries(ATTACK_TYPES).map(([key, attack]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: attack.color }}
                      />
                      <span className={cn(
                        isDark ? "text-gray-400" : "text-gray-600"
                      )}>{attack.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Stats and Achievements Row */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Stats Panel */}
          <Card
            className={cn(
              "backdrop-blur border",
              isDark ? "bg-slate-900/50 border-slate-700/50" : "bg-white/80 border-gray-200"
            )}
          >
            <CardHeader>
              <CardTitle
                className={cn("flex items-center gap-2", isDark ? "text-white" : "text-gray-900")}
              >
                <TrendingUp className="w-5 h-5" />
                Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="text-2xl font-bold text-blue-400">{totalRequests}</div>
                  <div className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-600")}>
                    Total Requests
                  </div>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="text-2xl font-bold text-green-400">{blockedRequests}</div>
                  <div className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-600")}>
                    Blocked
                  </div>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <div className="text-2xl font-bold text-purple-400">{currentRPS}</div>
                  <div className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-600")}>
                    Requests/sec
                  </div>
                </div>
                <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <div className="text-2xl font-bold text-orange-400">{particles.length}</div>
                  <div className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-600")}>
                    Active Packets
                  </div>
                </div>
              </div>

              {/* Block Rate */}
              {blockedRequests > 0 && totalRequests > 0 && (
                <div
                  className={cn(
                    "p-3 rounded-lg border",
                    isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-gray-100 border-gray-300"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>
                      Block Rate
                    </span>
                    <span className="text-sm font-bold text-green-400">
                      {((blockedRequests / totalRequests) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-green-500 to-emerald-500"
                      style={{ width: `${(blockedRequests / totalRequests) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Achievements Panel */}
          <Card
            className={cn(
              "backdrop-blur border",
              isDark ? "bg-slate-900/50 border-slate-700/50" : "bg-white/80 border-gray-200"
            )}
          >
            <CardHeader>
              <CardTitle
                className={cn("flex items-center gap-2", isDark ? "text-white" : "text-gray-900")}
              >
                <Award className="w-5 h-5" />
                Achievements
              </CardTitle>
              <CardDescription>
                {unlockedAchievements}/{achievements.length} unlocked
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={cn(
                      'p-3 rounded-lg border transition-all',
                      achievement.unlocked
                        ? 'bg-linear-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30'
                        : isDark
                          ? 'bg-slate-800/30 border-slate-700/30 opacity-50'
                          : 'bg-gray-100 border-gray-300 opacity-50'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-2xl">{achievement.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            "text-sm font-semibold flex items-center gap-2",
                            isDark ? "text-white" : "text-gray-900"
                          )}
                        >
                          {achievement.title}
                          {achievement.unlocked && (
                            <ShieldCheck className="w-4 h-4 text-yellow-400" />
                          )}
                        </div>
                        <div className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-600")}>
                          {achievement.description}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Educational Tips */}
        <Card className={cn(
          "border backdrop-blur",
          isDark 
            ? "bg-linear-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20" 
            : "bg-linear-to-br from-blue-50 to-purple-50 border-blue-200"
        )}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                isDark ? "bg-blue-500/20" : "bg-blue-100"
              )}>
                <Shield className={cn(
                  "w-5 h-5",
                  isDark ? "text-blue-400" : "text-blue-600"
                )} />
              </div>
              <div>
                <h3 className={cn(
                  "font-semibold mb-2",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  How to Protect Against DDoS Attacks
                </h3>
                <ul className={cn(
                  "text-sm space-y-1",
                  isDark ? "text-gray-300" : "text-gray-700"
                )}>
                  <li>• Use CDN services like Cloudflare, Akamai, or AWS CloudFront</li>
                  <li>• Implement rate limiting and traffic filtering</li>
                  <li>• Deploy load balancers and auto-scaling infrastructure</li>
                  <li>• Monitor traffic patterns and set up alerts for anomalies</li>
                  <li>• Use DDoS protection services (AWS Shield, Azure DDoS Protection)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <style jsx global>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
          cursor: pointer;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
          border: 2px solid white;
        }

        .slider-thumb::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
          cursor: pointer;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
          border: 2px solid white;
        }

        .bg-grid {
          background-image: linear-gradient(to right, rgba(100, 100, 100, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(100, 100, 100, 0.1) 1px, transparent 1px);
          background-size: 40px 40px;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }

        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}
