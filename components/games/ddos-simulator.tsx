'use client';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import {
  Award,
  BarChart3,
  Gauge,
  Heart,
  Flame,
  Pause,
  Play,
  RotateCcw,
  Server,
  Shield,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimMissionList,
  SimPhoneBar,
  SimResetButton,
  SimStage,
  useMissions,
  type Mission,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';

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
interface Explosion {
  id: string;
  x: number;
  y: number;
  color: string;
}
interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  icon: string;
}
const ATTACK_TYPES = {
  http: { name: 'HTTP Flood', color: '#3b82f6', description: 'Overwhelming with HTTP requests' },
  syn: { name: 'SYN Flood', color: '#8b5cf6', description: 'Half-open TCP connections' },
  udp: { name: 'UDP Flood', color: '#ec4899', description: 'User Datagram Protocol flood' },
};
const ACHIEVEMENTS_LIST: Achievement[] = [
  {
    id: 'survivor_30',
    title: 'Survivor',
    description: 'Survive for 30 seconds',
    unlocked: false,
    icon: '🛡️',
  },
  {
    id: 'survivor_60',
    title: 'Defender',
    description: 'Survive for 60 seconds',
    unlocked: false,
    icon: '🏰',
  },
  {
    id: 'survivor_120',
    title: 'Fortress',
    description: 'Survive for 2 minutes',
    unlocked: false,
    icon: '🏛️',
  },
  {
    id: 'block_100',
    title: 'Firewall Master',
    description: 'Block 100 attacks',
    unlocked: false,
    icon: '🔥',
  },
  {
    id: 'block_500',
    title: 'Shield Expert',
    description: 'Block 500 attacks',
    unlocked: false,
    icon: '⚔️',
  },
  {
    id: 'survive_max',
    title: 'Unbreakable',
    description: 'Survive max intensity for 30s',
    unlocked: false,
    icon: '👑',
  },
  {
    id: 'recover_full',
    title: 'Phoenix',
    description: 'Recover from critical to full health',
    unlocked: false,
    icon: '🔄',
  },
];
type DdosMissionState = {
  hasFirewall: boolean;
  hasLoadBalancer: boolean;
  autoRateLimiting: boolean;
  rateLimitActive: boolean;
  isRunning: boolean;
  gameOver: boolean;
  blocked: number;
  health: number;
  runSeconds: number;
  runMinIntensity: number;
};
const MISSIONS: Mission<DdosMissionState>[] = [
  {
    id: 'firewall',
    label: 'Turn on the firewall and block 15 requests.',
    hint: 'The firewall drops 30% of incoming requests.',
    check: (s) => s.hasFirewall && s.blocked >= 15,
  },
  {
    id: 'balancer',
    label: 'Turn on the load balancer during an attack.',
    hint: 'Each hit that gets through does half the damage.',
    check: (s) => s.hasLoadBalancer && s.isRunning,
  },
  {
    id: 'rate-limit',
    label: 'Turn on auto rate limiting and raise the intensity until it switches on.',
    hint: 'It switches on when more than 5 requests reach the server in one second.',
    check: (s) => s.autoRateLimiting && s.rateLimitActive,
  },
  {
    id: 'survive',
    label: 'Start an attack at intensity 6 or higher and keep the server online for 60 seconds.',
    hint: 'Turn on all three defences before you start.',
    check: (s) => s.runSeconds >= 60 && s.runMinIntensity >= 6 && s.health > 0 && !s.gameOver,
  },
];
const DOT: Record<Particle['type'], string> = {
  http: 'bg-sky-500',
  syn: 'bg-violet-500',
  udp: 'bg-primary',
};

function DefenceToggle({
  name,
  desc,
  on,
  onChange,
  Icon,
  active,
}: {
  name: string;
  desc: string;
  on: boolean;
  onChange: () => void;
  Icon: LucideIcon;
  active?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 rounded-md border p-2.5',
        on && SIM_TONE.success.surface
      )}
    >
      <div className="flex gap-2">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {name}
            {active && (
              <Badge variant="secondary" className="text-xs">
                {active}
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch aria-label={name} checked={on} onCheckedChange={onChange} />
    </div>
  );
}

export default function DDoSSimulator() {
  const [mounted, setMounted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [intensity, setIntensity] = useState(3);
  const [serverHealth, setServerHealth] = useState(100);
  const [totalRequests, setTotalRequests] = useState(0);
  const [blockedRequests, setBlockedRequests] = useState(0);
  const [currentRPS, setCurrentRPS] = useState(0);
  const [lastSecondRPS, setLastSecondRPS] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [attackType, setAttackType] = useState<keyof typeof ATTACK_TYPES>('http');
  const [hasFirewall, setHasFirewall] = useState(false);
  const [hasLoadBalancer, setHasLoadBalancer] = useState(false);
  const [autoRateLimiting, setAutoRateLimiting] = useState(false);
  const [rateLimitActive, setRateLimitActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [survivalTime, setSurvivalTime] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [currentWave, setCurrentWave] = useState(1);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryRate, setRecoveryRate] = useState(0);
  const [achievements, setAchievements] = useState<Achievement[]>(ACHIEVEMENTS_LIST);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);
  const [, setScreenShake] = useState(false);
  const [lastHealthCheck, setLastHealthCheck] = useState(100);
  const [runSeconds, setRunSeconds] = useState(0);
  const [runMinIntensity, setRunMinIntensity] = useState(3);
  const [dismissed, setDismissed] = useState(false);
  const [wonBefore, setWonBefore] = useState(false);
  const [tab, setTab] = useState<'field' | 'defend'>('field');
  const animationFrameRef = useRef<number | undefined>(undefined);
  const particleIdCounter = useRef(0);
  const explosionIdCounter = useRef(0);
  const lastSpawnTime = useRef(Date.now());
  const startTime = useRef(Date.now());
  const waveStartTime = useRef(Date.now());
  const maxIntensityTime = useRef(0);
  const criticalRecoveryCheck = useRef(false);
  useEffect(() => {
    const saved = localStorage.getItem('ddos-high-score');
    if (saved) setHighScore(parseInt(saved));

    try {
      const savedAchievements = localStorage.getItem('ddos-achievements');
      const parsed = savedAchievements ? JSON.parse(savedAchievements) : null;
      if (Array.isArray(parsed)) setAchievements(parsed);
      else if (savedAchievements) localStorage.removeItem('ddos-achievements');
    } catch {
      // unreadable storage: start fresh
    }

    setMounted(true);
  }, []);
  const getSpawnRate = useCallback(() => {
    const waveMultiplier = 1 + (currentWave - 1) * 0.1; // Increase difficulty by 10% per wave
    const baseRate = Math.max(50, 500 - intensity * 50);
    return Math.max(30, baseRate / waveMultiplier);
  }, [intensity, currentWave]);
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
  const checkAchievements = useCallback(
    (currentTime: number, blockedCount: number) => {
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
    },
    [intensity]
  );
  useEffect(() => {
    if (isRunning && intensity === 10) {
      const interval = setInterval(() => {
        maxIntensityTime.current += 1;
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning, intensity]);
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
  useEffect(() => {
    if (!isRunning) return;

    const checkWaveProgress = setInterval(() => {
      const waveTime = Math.floor((Date.now() - waveStartTime.current) / 1000);
      if (waveTime >= 30) {
        // New wave every 30 seconds
        setCurrentWave((prev) => prev + 1);
        waveStartTime.current = Date.now();
      }
    }, 1000);

    return () => clearInterval(checkWaveProgress);
  }, [isRunning]);
  useEffect(() => {
    if (!isRunning || gameOver) return;
    const i = setInterval(
      () => setRunSeconds(Math.floor((Date.now() - startTime.current) / 1000)),
      500
    );
    return () => clearInterval(i);
  }, [isRunning, gameOver]);
  useEffect(() => {
    if (!autoRateLimiting) {
      setRateLimitActive(false);
      return;
    }

    // Activate when the last full second had too many requests (the loop lands at most
    // about 20 hits a second, so the old 50/20 thresholds never switched it on).
    if (lastSecondRPS > 5) {
      setRateLimitActive(true);
    } else if (lastSecondRPS < 2) {
      setRateLimitActive(false);
    }
  }, [lastSecondRPS, autoRateLimiting]);
  // Server recovery. An effect event reads the load, so hits no longer restart the 1 s
  // timer (before this, health never recovered during an attack).
  const recoverTick = useEffectEvent(() => {
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
      const effectiveRPS =
        lastSecondRPS *
        (hasFirewall ? 0.7 : 1) * // Firewall blocks 30%
        (rateLimitActive ? 0.6 : 1) * // Rate limiter blocks 40%
        (hasLoadBalancer ? 0.5 : 1); // Load balancer reduces load 50%

      // Recovery depends on effective load (lower load = faster recovery)
      const effectiveLoad = Math.min(effectiveRPS / 100, 1); // 0 to 1
      const baseRecovery = 2.5; // Base recovery per second

      // More defenses = better recovery even under load
      const defenseCount = [
        hasFirewall,
        hasLoadBalancer,
        autoRateLimiting && rateLimitActive,
      ].filter(Boolean).length;
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
  });
  useEffect(() => {
    if (gameOver) return;

    const recoveryInterval = setInterval(() => recoverTick(), 1000);

    return () => clearInterval(recoveryInterval);
  }, [isRunning, gameOver]);
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
  }, [
    isRunning,
    intensity,
    hasFirewall,
    hasLoadBalancer,
    rateLimitActive,
    getSpawnRate,
    spawnParticle,
    createExplosion,
  ]);
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
  // Every second, keep the last full second's count (readout, rate limiting, recovery).
  const closeRpsWindow = useEffectEvent(() => {
    setLastSecondRPS(currentRPS);
    setCurrentRPS(0);
  });
  useEffect(() => {
    const interval = setInterval(() => closeRpsWindow(), 1000);

    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (isRunning) {
      const currentTime = Math.floor((Date.now() - startTime.current) / 1000);
      checkAchievements(currentTime, blockedRequests);
    }
  }, [isRunning, survivalTime, blockedRequests, serverHealth, checkAchievements]);
  useEffect(() => {
    setLastHealthCheck(serverHealth);
  }, [serverHealth]);
  const resetGame = useCallback(() => {
    setIsRunning(false);
    setServerHealth(100);
    setTotalRequests(0);
    setBlockedRequests(0);
    setCurrentRPS(0);
    setLastSecondRPS(0);
    setParticles([]);
    setExplosions([]);
    setGameOver(false);
    setSurvivalTime(0);
    setCurrentWave(1);
    setIsRecovering(false);
    setRecoveryRate(0);
    setRateLimitActive(false);
    setRunSeconds(0);
    startTime.current = Date.now();
    waveStartTime.current = Date.now();
    maxIntensityTime.current = 0;
    criticalRecoveryCheck.current = false;
  }, []);
  const toggleSimulation = useCallback(() => {
    if (!isRunning) {
      startTime.current = Date.now();
      waveStartTime.current = Date.now();
      setRunSeconds(0);
      setRunMinIntensity(intensity);
    }
    setIsRunning(!isRunning);
  }, [isRunning, intensity]);
  const getServerStatus = () => {
    if (serverHealth > 70) return { text: 'Healthy', tone: 'success' as const };
    if (serverHealth > 40) return { text: 'Degraded', tone: 'warning' as const };
    if (serverHealth > 0) return { text: 'Critical', tone: 'danger' as const };
    return { text: 'Down', tone: 'danger' as const };
  };
  const serverStatus = getServerStatus();
  const activeDefenses = [hasFirewall, hasLoadBalancer, autoRateLimiting].filter(Boolean).length;
  const unlockedAchievements = achievements.filter((a) => a.unlocked).length;
  const state = useMemo(
    () => ({
      hasFirewall,
      hasLoadBalancer,
      autoRateLimiting,
      rateLimitActive,
      isRunning,
      gameOver,
      blocked: blockedRequests,
      health: serverHealth,
      runSeconds,
      runMinIntensity,
    }),
    [
      hasFirewall,
      hasLoadBalancer,
      autoRateLimiting,
      rateLimitActive,
      isRunning,
      gameOver,
      blockedRequests,
      serverHealth,
      runSeconds,
      runMinIntensity,
    ]
  );
  const missions = useMissions(MISSIONS, state);
  if (missions.complete !== wonBefore) {
    setWonBefore(missions.complete);
    if (missions.complete) setIsRunning(false);
  }
  const startOver = () => {
    resetGame();
    missions.reset();
    setDismissed(false);
    setWonBefore(false);
  };
  if (!mounted) return null;
  const field = (
    <section className="space-y-2 rounded-lg border bg-card p-3">
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full', SIM_TONE[serverStatus.tone].fill)}
          style={{ width: `${serverHealth}%` }}
        />
      </div>
      <div className="flex justify-between text-xs tabular-nums">
        <span>Server health</span>
        <span>{Math.round(serverHealth)}%</span>
        {isRecovering && (
          <span className="text-correct-foreground">Recovering +{recoveryRate.toFixed(1)}/s</span>
        )}
      </div>
      <div
        role="img"
        aria-label={`Attack field: ${particles.length} requests in flight, server at ${Math.round(serverHealth)}% health`}
        // On lg the field fills the stage (--sim-fill-h) less the health bar above it.
        className="relative h-[clamp(14rem,calc(100dvh-24rem),26rem)] overflow-hidden rounded-md border bg-muted/30 lg:h-[max(14rem,calc(var(--sim-fill-h)-4.5rem))]"
      >
        <div
          className="pointer-events-none absolute inset-0 text-border opacity-30"
          aria-hidden="true"
        >
          <svg width="100%" height="100%">
            <defs>
              <pattern id="ddos-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ddos-grid)" />
          </svg>
        </div>
        {particles.map((p) => (
          <span
            key={p.id}
            className={cn('absolute h-2 w-2 rounded-full', DOT[p.type])}
            style={{
              left: `${p.x + (p.targetX - p.x) * p.progress}%`,
              top: `${p.y + (p.targetY - p.y) * p.progress}%`,
            }}
          />
        ))}
        {explosions.map((e) => (
          <span
            key={e.id}
            className="absolute h-4 w-4 rounded-full bg-correct/70"
            style={{ left: `${e.x}%`, top: `${e.y}%` }}
          />
        ))}
        <div
          className={cn(
            'absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-md border',
            serverHealth > 0 ? SIM_TONE[serverStatus.tone].surface : 'border-border bg-muted'
          )}
        >
          {serverHealth <= 0 ? (
            <WifiOff className="h-8 w-8 text-wrong-foreground" aria-hidden="true" />
          ) : (
            <>
              <Server
                className={cn('h-8 w-8', SIM_TONE[serverStatus.tone].text)}
                aria-hidden="true"
              />
              <span className={cn('text-xs font-medium', SIM_TONE[serverStatus.tone].text)}>
                {serverStatus.text}
              </span>
            </>
          )}
          <div className="absolute -bottom-8 flex gap-1">
            {hasFirewall && (
              <span className="inline-flex items-center gap-1 rounded border bg-card px-1 py-0.5 text-xs">
                <Shield className="h-3 w-3" aria-hidden="true" /> Firewall
              </span>
            )}
            {hasLoadBalancer && (
              <span className="inline-flex items-center gap-1 rounded border bg-card px-1 py-0.5 text-xs">
                <BarChart3 className="h-3 w-3" aria-hidden="true" /> Balance
              </span>
            )}
            {autoRateLimiting && (
              <span className="inline-flex items-center gap-1 rounded border bg-card px-1 py-0.5 text-xs">
                <Gauge className="h-3 w-3" aria-hidden="true" /> Rate
              </span>
            )}
          </div>
          {serverHealth < 30 && serverHealth > 0 && (
            <Flame
              className="motion-safe:animate-pulse absolute -top-6 h-5 w-5 text-wrong-foreground"
              aria-hidden="true"
            />
          )}
          {isRecovering && serverHealth < 90 && (
            <Heart
              className="motion-safe:animate-pulse absolute -bottom-6 h-4 w-4 text-correct-foreground"
              aria-hidden="true"
            />
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(ATTACK_TYPES).map(([k, a]) => (
          <span key={k} className="flex items-center gap-1">
            <span
              className={cn('h-2 w-2 rounded-full', DOT[k as Particle['type']])}
              aria-hidden="true"
            />
            {a.name}
          </span>
        ))}
      </div>
    </section>
  );
  const defend = (
    <div className="space-y-2">
      <SimMissionList missions={missions.missions} />
      {newAchievement && (
        <SimFeedback tone="success" label="Achievement unlocked">
          {newAchievement.title}: {newAchievement.description}
        </SimFeedback>
      )}
      <section className="space-y-2 rounded-lg border bg-card p-3">
        <label htmlFor="intensity" className="flex justify-between text-sm font-medium">
          Intensity
          <span className="tabular-nums text-muted-foreground">{intensity} of 10</span>
        </label>
        <input
          id="intensity"
          type="range"
          min="1"
          max="10"
          value={intensity}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            setIntensity(v);
            if (isRunning) setRunMinIntensity((m) => Math.min(m, v));
          }}
          className="w-full accent-primary"
        />
        <p className="text-xs text-muted-foreground">
          Higher intensity sends requests more quickly.
        </p>
      </section>
      <section
        className="space-y-2 rounded-lg border bg-card p-3"
        aria-label={`Defences, ${activeDefenses} on`}
      >
        <DefenceToggle
          name="Firewall"
          desc="Blocks ~30% of attacks."
          on={hasFirewall}
          onChange={() => setHasFirewall(!hasFirewall)}
          Icon={Shield}
        />
        <DefenceToggle
          name="Load Balancer"
          desc="Reduces damage by 50%."
          on={hasLoadBalancer}
          onChange={() => setHasLoadBalancer(!hasLoadBalancer)}
          Icon={BarChart3}
        />
        <DefenceToggle
          name="Auto Rate Limit"
          desc="Switches on above 5 requests per second."
          on={autoRateLimiting}
          onChange={() => setAutoRateLimiting(!autoRateLimiting)}
          Icon={Gauge}
          active={autoRateLimiting ? (rateLimitActive ? 'Active' : 'Standby') : undefined}
        />
      </section>
      <section className="space-y-2 rounded-lg border bg-card p-3">
        <div className="grid grid-cols-2 gap-1.5">
          {[
            ['Total requests', totalRequests],
            ['Blocked', blockedRequests],
            ['Requests/sec', lastSecondRPS],
            ['In flight', particles.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border bg-card px-2 py-1.5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="font-mono text-lg font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs tabular-nums">
            <span>Block rate</span>
            <span>{totalRequests ? ((blockedRequests / totalRequests) * 100).toFixed(1) : 0}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-correct"
              style={{ width: `${totalRequests ? (blockedRequests / totalRequests) * 100 : 0}%` }}
            />
          </div>
        </div>
      </section>
      <details className="rounded-lg border bg-card p-3">
        <summary className="cursor-pointer text-sm font-semibold">
          Achievements ({unlockedAchievements}/{achievements.length})
        </summary>
        <div className="mt-2 space-y-2">
          {achievements.map((a) => (
            <div key={a.id} className="flex gap-2 text-sm">
              <Award
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  a.unlocked ? 'text-primary' : 'text-muted-foreground'
                )}
                aria-hidden="true"
              />
              <p>
                <span className="font-medium">{a.title}:</span> {a.description}
                <span className="sr-only">{a.unlocked ? ' (unlocked)' : ''}</span>
              </p>
            </div>
          ))}
        </div>
      </details>
      <details className="rounded-lg border bg-card p-3 text-sm">
        <summary className="cursor-pointer font-semibold">How DDoS attacks work</summary>
        <div className="mt-2 space-y-3">
          <div>
            <h3 className="font-semibold text-foreground">What is a DDoS attack?</h3>
            <p>
              A distributed denial of service attack overwhelms a server, service or network with
              traffic from many sources.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Common flood types</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>HTTP floods use seemingly legitimate web requests.</li>
              <li>SYN floods leave TCP connections half open.</li>
              <li>UDP floods make servers inspect traffic on many ports.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">How to protect a service</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Use rate limits and traffic filtering.</li>
              <li>Deploy load balancers and auto-scaling infrastructure.</li>
              <li>Monitor traffic patterns and alert on anomalies.</li>
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="DDoS Attack Simulator"
          icon={Shield}
          lead={
            <div
              role="group"
              aria-label="Attack type"
              className="flex min-w-0 flex-1 flex-wrap gap-1"
            >
              {Object.entries(ATTACK_TYPES).map(([k, a]) => (
                <Button
                  key={k}
                  size="sm"
                  className="h-10 lg:h-8"
                  variant={attackType === k ? 'default' : 'outline'}
                  aria-pressed={attackType === k}
                  title={a.description}
                  onClick={() => setAttackType(k as keyof typeof ATTACK_TYPES)}
                >
                  {a.name.replace(' Flood', '')}
                  <span className="hidden sm:inline"> Flood</span>
                </Button>
              ))}
            </div>
          }
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={serverStatus.text}
          meta={
            <>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                  SIM_TONE[serverStatus.tone].surface,
                  SIM_TONE[serverStatus.tone].text
                )}
              >
                <Heart className="h-3 w-3" aria-hidden="true" />
                {Math.round(serverHealth)}%
              </span>
              <Badge variant="secondary" className="tabular-nums">
                Wave {currentWave}
              </Badge>
              {isRunning && (
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {runSeconds}s
                </span>
              )}
            </>
          }
          actions={
            <div className="hidden items-center gap-2 lg:flex">
              <Button
                size="sm"
                className="h-8"
                variant={isRunning ? 'outline' : 'destructive'}
                onClick={toggleSimulation}
                disabled={gameOver}
              >
                {isRunning ? <Pause /> : <Play />}
                {isRunning ? 'Pause attack' : 'Start attack'}
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={resetGame}>
                <RotateCcw />
                Reset run
              </Button>
            </div>
          }
          goal={
            missions.complete ? (
              'Attack survived. Try a higher intensity or fewer defences.'
            ) : (
              <>
                {missions.current?.label}{' '}
                <span className="text-muted-foreground">{missions.current?.hint}</span>
              </>
            )
          }
        />
        <SimAnnouncer
          message={
            gameOver
              ? `Server offline after ${survivalTime} seconds`
              : newAchievement
                ? `Achievement unlocked: ${newAchievement.title}`
                : ''
          }
        />
        {missions.complete && !dismissed ? (
          <SimComplete
            title="Attack survived"
            summary="You blocked requests at the firewall, halved the damage with a load balancer, saw rate limiting switch on, and kept the server online for a full minute of attack at intensity 6."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Blocked', value: blockedRequests },
              { label: 'Server health', value: `${Math.round(serverHealth)}%` },
            ]}
            actions={
              <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
                Keep exploring
              </Button>
            }
            onPlayAgain={startOver}
            playAgainLabel="Start over"
          />
        ) : gameOver ? (
          <SimComplete
            tone="danger"
            title="Server offline"
            summary="The attack overwhelmed the server. Add defences or lower the intensity, then try again."
            stats={[
              { label: 'Survived', value: `${survivalTime}s` },
              { label: 'Blocked', value: blockedRequests },
              { label: 'Best', value: `${highScore}s` },
            ]}
            learned={null}
            next={null}
            actions={
              <Button type="button" onClick={resetGame}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Try again
              </Button>
            }
          />
        ) : (
          <SimStage
            columns="lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
            minHeight="min-h-[24rem]"
            tab={tab}
            onTabChange={(v) => setTab(v as 'field' | 'defend')}
            tabsLabel="Simulator panels"
            panels={[
              { id: 'field', label: 'Attack', content: field },
              { id: 'defend', label: 'Defend', content: defend },
            ]}
          />
        )}
        <SimPhoneBar>
          <Button
            className="h-10 flex-1"
            variant={isRunning ? 'outline' : 'destructive'}
            onClick={toggleSimulation}
            disabled={gameOver}
          >
            {isRunning ? <Pause /> : <Play />}
            {isRunning ? 'Pause attack' : 'Start attack'}
          </Button>
          <Button variant="outline" className="h-10" onClick={resetGame}>
            <RotateCcw />
            Reset run
          </Button>
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
