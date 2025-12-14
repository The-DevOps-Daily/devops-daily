"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import {
  Server,
  Zap,
  Activity,
  AlertTriangle,
  Cpu,
  ShieldCheck,
  ArrowUpCircle,
  Move,
  Play,
  Pause,
  RotateCcw,
  Database,
  Layers,
  Snowflake,
  Lock,
  Skull,
  Crosshair,
  MonitorCheck,
  TrendingUp,
  Sparkles,
  Flame,
  CircleDot,
  Home,
  HelpCircle,
} from 'lucide-react';

// --- Game Constants & Config ---
const GAME_WIDTH = 800;
const GAME_HEIGHT = 500;

const CONFIG = {
  initialMoney: 800,
  initialHealth: 100,
  waveInterval: 1000,
  baseTrafficRate: 0.025,
  trafficRateMultiplier: 0.25,
  chaosInterval: 25000,
  autoscalerCost: 350,
  autoscalerLifetime: 300,
};

const SERVER_TYPES = {
  api: {
    name: 'API Node',
    cost: 100,
    color: '#6366f1',
    range: 150,
    power: 2.5,
    cooling: 0.6,
    heatGen: 0.8,
    icon: Server,
    desc: 'Balanced processing.',
    type: 'damage'
  },
  cache: {
    name: 'Redis Cache',
    cost: 150,
    color: '#ec4899',
    range: 110,
    power: 1.5,
    cooling: 1.5,
    heatGen: 0.4,
    icon: Layers,
    desc: 'Fast fire rate. Good vs DDoS.',
    type: 'damage'
  },
  db: {
    name: 'Postgres DB',
    cost: 300,
    color: '#f59e0b',
    range: 200,
    power: 15,
    cooling: 0.3,
    heatGen: 3.5,
    icon: Database,
    desc: 'Heavy hitter. Good vs Monoliths.',
    type: 'damage'
  },
  firewall: {
    name: 'Sec Group',
    cost: 200,
    color: '#06b6d4',
    range: 130,
    power: 0.5,
    cooling: 0.8,
    heatGen: 0.5,
    icon: Lock,
    desc: 'Slows traffic (Latency).',
    type: 'slow'
  },
  observability: {
    name: 'Prometheus',
    cost: 400,
    color: '#10b981',
    range: 250,
    power: 0,
    cooling: 0.1,
    heatGen: 0,
    icon: MonitorCheck,
    desc: 'Generates passive income.',
    type: 'support'
  }
};

const TRAFFIC_TYPES = {
  http: { hp: 100, speed: 1.5, color: '#f8fafc', radius: 4, score: 10, name: 'HTTP' },
  ddos: { hp: 35, speed: 3.8, color: '#ef4444', radius: 3, score: 6, name: 'DDoS' },
  sql:  { hp: 700, speed: 0.6, color: '#fbbf24', radius: 9, score: 50, name: 'Heavy SQL' },
  tls:  { hp: 250, speed: 1.2, color: '#34d399', radius: 6, score: 20, name: 'TLS Handshake', tls: true },
  monolith: { hp: 5000, speed: 0.3, color: '#8b5cf6', radius: 25, score: 1000, name: 'The Monolith' }
};

const TARGETING_MODES = {
  nearest: 'Nearest',
  strongest: 'Strongest',
  weakest: 'Weakest'
};

const COLORS = {
  bg: '#0f172a',
  grid: '#1e293b',
  primary: '#3b82f6',
  success: '#22c55e',
  warning: '#eab308',
  danger: '#ef4444',
  frozen: '#0ea5e9',
};

export default function ScalableSentry() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = resolvedTheme === 'dark';

  const [gameState, setGameState] = useState('start');
  const [isMobile, setIsMobile] = useState(false);
  const [stats, setStats] = useState({
    money: CONFIG.initialMoney,
    health: CONFIG.initialHealth,
    requestsProcessed: 0,
    requestsDropped: 0,
    wave: 1,
  });
  const [selection, setSelection] = useState(null);
  const [dragType, setDragType] = useState('api');
  const [freezeActive, setFreezeActive] = useState(false);
  const [chaosActive, setChaosActive] = useState(false);
  const [autoscalerCooldown, setAutoscalerCooldown] = useState(0);

  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  const stateRef = useRef({
    servers: [],
    packets: [],
    particles: [],
    floatingTexts: [],
    shockwaves: [],
    lastTime: 0,
    trafficIntensity: 1,
    trafficOffset: 0,
    mouse: { x: 0, y: 0, isDown: false, draggingId: null },
    freezeTimer: 0,
    chaosTimer: CONFIG.chaosInterval,
    waveTimer: 0,
    bossSpawned: false,
    packetsProcessedSinceLastFrame: 0,
    screenShake: 0,
    criticalHitChance: 0.15,
  });

  const spawnPacket = (gameWidth, gameHeight, intensity, offset, forceType = null) => {
    const centerY = gameHeight / 2;
    const spread = gameHeight * 0.8;
    const noise = (Math.random() - 0.5) * spread;
    const waveBias = Math.sin(offset / 100) * (gameHeight * 0.3);
    let y = centerY + waveBias + noise;
    y = Math.max(40, Math.min(gameHeight - 40, y));

    let typeKey = 'http';

    if (forceType) {
      typeKey = forceType;
    } else {
      const roll = Math.random();
      if (intensity > 3.0 && roll > 0.85) typeKey = 'tls';
      else if (intensity > 2.5 && roll > 0.90) typeKey = 'sql';
      else if (intensity > 1.5 && roll > 0.75) typeKey = 'ddos';
      else if (roll > 0.95) typeKey = 'ddos';
    }

    const type = TRAFFIC_TYPES[typeKey];
    const hpMultiplier = 1 + (stateRef.current.trafficIntensity * 0.2);

    return {
      id: Math.random().toString(36).substr(2, 9),
      x: -20,
      y: y,
      hp: type.hp * hpMultiplier,
      maxHp: type.hp * hpMultiplier,
      baseSpeed: type.speed,
      speed: type.speed + (Math.random() * 0.2),
      type: typeKey,
      radius: type.radius,
      color: type.color,
      score: type.score,
      status: 'pending',
      slowed: false,
      slowTimer: 0
    };
  };

  const createParticle = (x, y, color, type = 'spark') => {
    const speed = type === 'explosion' ? 6 : 4;
    const size = 2 + Math.random() * 2;
    return {
      id: Math.random(), x, y,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed - (type === 'explosion' ? 1 : 0),
      life: 1.0, color, type, size
    };
  };

  const createFloatingText = (x, y, text, color = '#fff', size = 16) => ({
    id: Math.random(), x, y, text, color, size,
    vy: -1.5,
    life: 1.0,
    startLife: 1.0
  });

  const createShockwave = (x, y, color = '#fff', maxRadius = 40) => ({
    id: Math.random(), x, y, color, maxRadius,
    radius: 5,
    life: 1.0
  });

  const triggerScreenShake = (intensity = 8) => {
    stateRef.current.screenShake = intensity;
  };

  const addTempServer = (x, y) => {
      const tempType = SERVER_TYPES.api;
      const tempServer = {
            id: Date.now() * 100,
            type: 'api',
            x, y,
            level: 1,
            range: tempType.range * 0.75,
            power: tempType.power * 1.1,
            load: 0,
            status: 'active',
            rebootTimer: 0,
            targeting: 'nearest',
            isTemporary: true,
            lifetime: CONFIG.autoscalerLifetime,
      };
      stateRef.current.servers.push(tempServer);
      for(let i=0; i<20; i++) stateRef.current.particles.push(createParticle(x, y, tempType.color, 'explosion'));
  };

  const triggerChaosMonkey = () => {
    const state = stateRef.current;
    const activeServers = state.servers.filter(s => s.status === 'active' && !s.isTemporary);

    if (activeServers.length > 0) {
      setChaosActive(true);
      setTimeout(() => setChaosActive(false), 3000);

      const victim = activeServers[Math.floor(Math.random() * activeServers.length)];
      victim.status = 'crashed';
      victim.rebootTimer = 300;

      // Enhanced visual effects
      for(let i=0; i<30; i++) state.particles.push(createParticle(victim.x, victim.y, '#ef4444', 'explosion'));
      state.shockwaves.push(createShockwave(victim.x, victim.y, '#ef4444', 50));
      state.floatingTexts.push(createFloatingText(victim.x, victim.y - 30, 'CHAOS!', '#ef4444', 16));
      triggerScreenShake(8);
    }
  };

  const update = useCallback((time) => {
    const state = stateRef.current;
    const canvas = canvasRef.current;

    if (gameState !== 'playing' || !canvas) return;

    const ctx = canvas.getContext('2d');
    const deltaTime = time - state.lastTime;
    state.lastTime = time;
    state.packetsProcessedSinceLastFrame = 0;

    // Apply screen shake
    ctx.save();
    if (state.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * state.screenShake;
      const shakeY = (Math.random() - 0.5) * state.screenShake;
      ctx.translate(shakeX, shakeY);
      state.screenShake *= 0.9;
      if (state.screenShake < 0.1) state.screenShake = 0;
    }

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= GAME_WIDTH; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, GAME_HEIGHT); }
    for (let y = 0; y <= GAME_HEIGHT; y += 40) { ctx.moveTo(0, y); ctx.lineTo(GAME_WIDTH, y); }
    ctx.stroke();

    // Draw target tower/base on right side
    const baseX = GAME_WIDTH - 60;
    const baseY = GAME_HEIGHT / 2;
    const healthPct = stats.health / 100;

    // Base structure
    ctx.save();
    ctx.translate(baseX, baseY);

    // Tower body with health color
    const towerColor = healthPct > 0.5 ? '#3b82f6' : (healthPct > 0.3 ? '#eab308' : '#ef4444');
    ctx.fillStyle = towerColor;
    ctx.shadowBlur = 15;
    ctx.shadowColor = towerColor;

    // Draw tower as hexagon
    ctx.beginPath();
    for (let j = 0; j < 6; j++) {
      const angle = (Math.PI / 3) * j;
      const x = 35 * Math.cos(angle);
      const y = 35 * Math.sin(angle);
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Inner circle
    ctx.fillStyle = COLORS.bg;
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.fill();

    // Health indicator arc
    ctx.beginPath();
    ctx.arc(0, 0, 30, -Math.PI/2, (-Math.PI/2) + (Math.PI * 2 * healthPct));
    ctx.strokeStyle = towerColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Shield icon
    ctx.fillStyle = towerColor;
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛡️', 0, 0);

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.shadowBlur = 0;
    ctx.fillText('BASE', 0, -45);

    // Pulse effect when low health
    if (healthPct < 0.3 && Math.sin(time / 200) > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    if (state.freezeTimer > 0) {
        state.freezeTimer -= 1;
        ctx.fillStyle = 'rgba(14, 165, 233, 0.1)';
        ctx.fillRect(0,0, GAME_WIDTH, GAME_HEIGHT);
        if(state.freezeTimer <= 0) setFreezeActive(false);
    }

    if (autoscalerCooldown > 0) setAutoscalerCooldown(prev => Math.max(0, prev - 1));

    state.chaosTimer -= 16;
    if (state.chaosTimer <= 0) {
      triggerChaosMonkey();
      state.chaosTimer = CONFIG.chaosInterval + (Math.random() * 10000);
    }

    state.trafficOffset += 1;
    const currentSpawnRate = CONFIG.baseTrafficRate * (1 + (state.trafficIntensity * CONFIG.trafficRateMultiplier));

    if (stats.wave % 5 === 0 && !state.bossSpawned) {
       state.packets.push(spawnPacket(GAME_WIDTH, GAME_HEIGHT, state.trafficIntensity, state.trafficOffset, 'monolith'));
       state.bossSpawned = true;
       setChaosActive(true);
       setTimeout(() => setChaosActive(false), 2000);

       // Boss spawn effects
       state.floatingTexts.push(createFloatingText(GAME_WIDTH / 2, GAME_HEIGHT / 2, '⚠ BOSS WAVE ⚠', '#8b5cf6', 28));
       for (let i = 0; i < 50; i++) {
         state.particles.push(createParticle(
           GAME_WIDTH / 2 + (Math.random() - 0.5) * 200,
           GAME_HEIGHT / 2 + (Math.random() - 0.5) * 200,
           '#8b5cf6'
         ));
       }
       triggerScreenShake(10);
    }

    if (Math.random() < currentSpawnRate && state.freezeTimer <= 0) {
      state.packets.push(spawnPacket(GAME_WIDTH, GAME_HEIGHT, state.trafficIntensity, state.trafficOffset));
    }

    for (let i = state.servers.length - 1; i >= 0; i--) {
      const server = state.servers[i];
      const sType = SERVER_TYPES[server.type];

      if (server.isTemporary) {
          server.lifetime--;
          if (server.lifetime <= 0) {
              state.servers.splice(i, 1);
              continue;
          }
      }

      if (server.status === 'rebooting' || server.status === 'crashed') {
        server.rebootTimer -= 1;
        if (server.rebootTimer <= 0) {
          server.status = 'active';
          server.load = 0;
        }
      } else {
        server.load = Math.max(0, server.load - sType.cooling);

        const throttleFactor = server.load > 50 ? (1 - (server.load - 50) / 50) : 1;
        const attackChance = 0.9 * throttleFactor;

        if (server.status === 'active' && sType.type !== 'support' && Math.random() < attackChance) {
          let targets = state.packets.filter(p => {
              if (p.status !== 'pending') return false;
              const dist = Math.sqrt((p.x - server.x)**2 + (p.y - server.y)**2);
              return dist <= server.range;
          });

          if (targets.length > 0) {
              if (server.targeting === 'strongest') targets.sort((a, b) => b.hp - a.hp);
              else if (server.targeting === 'weakest') targets.sort((a, b) => a.hp - b.hp);
              else targets.sort((a, b) => {
                  const distA = (a.x - server.x)**2 + (a.y - server.y)**2;
                  const distB = (b.x - server.x)**2 + (b.y - server.y)**2;
                  return distA - distB;
              });

              const target = targets[0];

              // Check for critical hit
              const isCrit = Math.random() < state.criticalHitChance;

              // Draw attack line with glow
              ctx.save();
              if (isCrit) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = sType.color;
              } else {
                ctx.shadowBlur = 8;
                ctx.shadowColor = sType.color;
              }
              ctx.beginPath();
              ctx.moveTo(server.x, server.y);
              ctx.lineTo(target.x, target.y);
              ctx.strokeStyle = sType.color;
              ctx.lineWidth = server.type === 'db' ? (isCrit ? 6 : 4) : (server.type === 'firewall' ? 1 : (isCrit ? 3 : 2));
              if (server.type === 'firewall') ctx.setLineDash([5, 5]);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.restore();

              if (server.type === 'firewall') {
                  target.slowTimer = 10;
                  server.load += sType.heatGen;
              } else {
                  let damage = server.power * throttleFactor;

                  let heatMultiplier = 1;
                  if (TRAFFIC_TYPES[target.type]?.tls) {
                      heatMultiplier = 1.5;
                      damage *= 0.75;
                  }

                  // Apply critical hit multiplier
                  if (isCrit) {
                    damage *= 2.0;
                    state.floatingTexts.push(createFloatingText(target.x, target.y - 15, 'CRIT!', '#fbbf24', 14));
                    state.shockwaves.push(createShockwave(target.x, target.y, sType.color, 30));
                    for(let j=0; j<12; j++) state.particles.push(createParticle(target.x, target.y, sType.color));
                  } else if(Math.random() > 0.7) {
                    state.particles.push(createParticle(target.x, target.y, sType.color));
                  }

                  target.hp -= damage;
                  server.load += sType.heatGen * heatMultiplier;
              }

              if (server.load >= 100) {
                  server.status = 'rebooting';
                  server.rebootTimer = 180;
                  for(let j=0; j<8; j++) state.particles.push(createParticle(server.x, server.y, COLORS.danger));
              }
          }
        }
        else if (server.status === 'active' && sType.type === 'support') {
            const nearbyServers = state.servers.filter(s => {
                if (s.id === server.id || s.status !== 'active') return false;
                const dist = Math.sqrt((s.x - server.x)**2 + (s.y - server.y)**2);
                return dist <= server.range;
            });

            const totalLoad = nearbyServers.reduce((sum, s) => sum + s.load, 0);
            const incomeRate = (totalLoad / (nearbyServers.length * 100)) * 0.1 * server.level;

            if (incomeRate > 0) {
                setStats(prev => ({...prev, money: prev.money + incomeRate}));

                if (time % 100 < 16) {
                    ctx.beginPath();
                    ctx.arc(server.x, server.y, server.range, 0, Math.PI * 2);
                    ctx.strokeStyle = '#10b981';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
      }

      // Draw range indicator for selected server
      if (selection === server.id) {
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.arc(server.x, server.y, server.range, 0, Math.PI * 2);
        ctx.fillStyle = sType.color;
        ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = sType.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Glow effect when server is active and has targets in range
      if (server.status === 'active' && sType.type !== 'support') {
        const hasTargets = state.packets.some(p => {
          if (p.status !== 'pending') return false;
          const dist = Math.sqrt((p.x - server.x)**2 + (p.y - server.y)**2);
          return dist <= server.range;
        });

        if (hasTargets) {
          ctx.save();
          ctx.shadowBlur = 15;
          ctx.shadowColor = sType.color;
          ctx.globalAlpha = 0.3 + Math.sin(time / 200) * 0.2;
          ctx.beginPath();
          ctx.arc(server.x, server.y, 28, 0, Math.PI * 2);
          ctx.strokeStyle = sType.color;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.save();
      ctx.translate(server.x, server.y);

      if (server.isTemporary) {
          const lifetimePct = server.lifetime / CONFIG.autoscalerLifetime;
          ctx.beginPath();
          ctx.arc(0, 0, 30, -Math.PI/2, (-Math.PI/2) + (Math.PI * 2 * lifetimePct));
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 2;
          ctx.stroke();
      }

      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        const angle = (Math.PI / 3) * j;
        const sx = 20 * Math.cos(angle);
        const sy = 20 * Math.sin(angle);
        if (j===0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.closePath();

      if (server.status === 'rebooting' || server.status === 'crashed') {
        ctx.fillStyle = '#334155';
        if (server.status === 'crashed') {
            ctx.translate((Math.random()-0.5)*3, (Math.random()-0.5)*3);
        } else if (server.status === 'rebooting') {
            // Pulsing animation for rebooting servers
            const pulse = 0.7 + Math.sin(time / 200) * 0.3;
            ctx.globalAlpha = pulse;
        }
      } else {
        ctx.fillStyle = selection === server.id ? '#f1f5f9' : COLORS.grid;
      }
      ctx.strokeStyle = sType.color;
      ctx.lineWidth = 3;
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = sType.color;
      if (server.type === 'firewall') {
          ctx.strokeStyle = sType.color;
          ctx.lineWidth = 2;
          ctx.strokeRect(-6,-6, 12, 12);
      } else if (server.type === 'cache') {
          ctx.fillRect(-8, -8, 16, 6);
          ctx.fillRect(-8, 2, 16, 6);
      } else if (server.type === 'db') {
          ctx.arc(0, 0, 8, 0, Math.PI*2);
          ctx.fill();
      } else if (server.type === 'observability') {
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI*2);
          ctx.strokeStyle = sType.color;
          ctx.stroke();
          ctx.moveTo(0, 0);
          ctx.lineTo(8, -8);
          ctx.stroke();
      } else {
          ctx.fillRect(-6, -6, 12, 12);
          ctx.fill();
      }

      if (server.status === 'crashed') {
          ctx.fillStyle = '#ef4444';
          ctx.font = '16px Arial';
          ctx.fillText('⚠', -6, 4);
      }

      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`v${server.level}`, 0, -24);

      const loadPct = server.load / 100;
      ctx.beginPath();
      ctx.arc(0, 0, 26, -Math.PI/2, (-Math.PI/2) + (Math.PI * 2 * loadPct));
      ctx.strokeStyle = loadPct > 0.8 ? COLORS.danger : (loadPct > 0.5 ? COLORS.warning : sType.color);
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.restore();
    }

    for (let i = state.packets.length - 1; i >= 0; i--) {
      let p = state.packets[i];

      let speed = p.speed;
      if (p.slowTimer > 0) {
          speed *= 0.4;
          p.slowTimer--;
          if (Math.random() > 0.8) state.particles.push(createParticle(p.x, p.y, '#06b6d4'));
      }

      if (state.freezeTimer > 0) {
      } else if (p.hp > 0) {
        p.x += speed;
      } else {
        p.y -= 1;
        // Only change status if not already counted (prevents re-triggering money award)
        if (p.status !== 'counted') {
          p.status = 'success';
        }
      }

      // Draw trail for fast-moving packets
      if (p.status === 'pending' && (p.type === 'ddos' || p.speed > 2)) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.radius * 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x - p.speed * 3, p.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      if (p.type === 'monolith') {
          // Glow effect for boss
          ctx.save();
          ctx.shadowBlur = 20;
          ctx.shadowColor = p.color;
          ctx.fillStyle = p.color;
          ctx.font = '24px sans-serif';
          ctx.fillText('👾', p.x - 12, p.y + 8);
          ctx.restore();

          ctx.fillStyle = '#000';
          ctx.fillRect(p.x - 20, p.y - 40, 40, 6);
          ctx.fillStyle = '#8b5cf6';
          ctx.fillRect(p.x - 20, p.y - 40, 40 * (p.hp/p.maxHp), 6);
      } else {
          if (p.type === 'sql') { ctx.rect(p.x - p.radius, p.y - p.radius, p.radius*2, p.radius*2); }
          else if (p.type === 'ddos') {
              ctx.moveTo(p.x, p.y - p.radius);
              ctx.lineTo(p.x + p.radius, p.y + p.radius);
              ctx.lineTo(p.x - p.radius, p.y + p.radius);
          } else if (p.type === 'tls') {
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
              ctx.strokeStyle = '#34d399';
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.fillStyle = p.color;
          } else { ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); }

          if (p.status === 'success') {
            ctx.fillStyle = COLORS.success;
            ctx.globalAlpha = Math.max(0, 1 - (p.y % 20) / 20);
          } else {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = 1;
          }
          ctx.fill();
          ctx.globalAlpha = 1;

          if (p.hp < p.maxHp && p.hp > 0) {
            ctx.fillStyle = '#000';
            ctx.fillRect(p.x - 8, p.y - 12, 16, 4);
            ctx.fillStyle = p.type === 'ddos' ? '#ef4444' : '#22c55e';
            ctx.fillRect(p.x - 8, p.y - 12, 16 * (p.hp/p.maxHp), 4);
          }
      }

      if (p.hp <= 0 && p.status !== 'counted') {
        p.status = 'counted';
        const earned = p.score;

        // Create score popup
        const scoreColor = p.type === 'monolith' ? '#8b5cf6' : '#22c55e';
        state.floatingTexts.push(createFloatingText(p.x, p.y, `+$${earned.toFixed(0)}`, scoreColor, 14));

        // Explosion effects
        const particleCount = p.type === 'monolith' ? 40 : (p.type === 'sql' ? 20 : 10);
        for(let j=0; j<particleCount; j++) {
          state.particles.push(createParticle(p.x, p.y, p.color));
        }

        // Screen shake for big kills
        if (p.type === 'monolith') {
          triggerScreenShake(15);
          state.shockwaves.push(createShockwave(p.x, p.y, '#8b5cf6', 80));
        } else if (p.type === 'sql') {
          triggerScreenShake(5);
          state.shockwaves.push(createShockwave(p.x, p.y, p.color, 40));
        }

        setStats(prev => ({
          ...prev,
          money: prev.money + earned,
          requestsProcessed: prev.requestsProcessed + 1
        }));
      }

      // Remove packets that are dead and have floated off screen or are counted
      if (p.hp <= 0 && (p.status === 'counted' || p.status === 'success') && p.y < -20) {
        state.packets.splice(i, 1);
      }
      else if (p.x > GAME_WIDTH + 20) {
        const healthLoss = p.type === 'monolith' ? 50 : (p.type === 'sql' ? 15 : (p.type === 'tls' ? 10 : 5));

        // Base position for visual effects
        const baseX = GAME_WIDTH - 60;
        const baseY = GAME_HEIGHT / 2;

        // Visual effects at base
        const particleCount = p.type === 'monolith' ? 30 : (healthLoss >= 15 ? 20 : 10);
        for(let j=0; j<particleCount; j++) {
          state.particles.push(createParticle(baseX, baseY, '#ef4444', 'explosion'));
        }
        state.shockwaves.push(createShockwave(baseX, baseY, '#ef4444', p.type === 'monolith' ? 60 : 40));
        state.floatingTexts.push(createFloatingText(baseX, baseY - 50, `-${healthLoss} HP`, '#ef4444', 18));

        // Screen shake on health loss
        if (p.type === 'monolith') {
          triggerScreenShake(12);
        } else if (healthLoss >= 15) {
          triggerScreenShake(6);
        } else {
          triggerScreenShake(3);
        }

        setStats(prev => ({
          ...prev,
          health: Math.max(0, prev.health - healthLoss),
          requestsDropped: prev.requestsDropped + 1
        }));
        state.packets.splice(i, 1);
      }
    }

    // Render shockwaves
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      let sw = state.shockwaves[i];
      sw.radius += 2;
      sw.life -= 0.05;

      ctx.globalAlpha = sw.life * 0.6;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      if (sw.life <= 0 || sw.radius > sw.maxRadius) {
        state.shockwaves.splice(i, 1);
      }
    }
    ctx.globalAlpha = 1;

    // Render particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      let p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // Gravity
      p.vx *= 0.98; // Air resistance
      p.life -= 0.04;

      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;

      // Use particle size
      const particleSize = p.size || 3;
      if (p.type === 'explosion') {
        // Circular particles for explosions
        ctx.beginPath();
        ctx.arc(p.x, p.y, particleSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(p.x, p.y, particleSize, particleSize);
      }

      if (p.life <= 0) state.particles.splice(i, 1);
    }
    ctx.globalAlpha = 1;

    // Render floating texts
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
      let ft = state.floatingTexts[i];
      ft.y += ft.vy;
      ft.life -= 0.02;

      ctx.globalAlpha = ft.life;
      ctx.font = `bold ${ft.size}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;

      // Text shadow for better visibility
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#000';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.shadowBlur = 0;

      if (ft.life <= 0) {
        state.floatingTexts.splice(i, 1);
      }
    }
    ctx.globalAlpha = 1;

    // Restore canvas after screen shake
    ctx.restore();

    if (stats.health <= 0) setGameState('gameover');
    requestRef.current = requestAnimationFrame(() => update(performance.now()));
  }, [gameState, stats.health, selection, autoscalerCooldown]);

  useEffect(() => {
    if (gameState === 'playing') requestRef.current = requestAnimationFrame(() => update(performance.now()));
    else cancelAnimationFrame(requestRef.current);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, update]);

  // Handle theme hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || ('ontouchstart' in window));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = setInterval(() => {
      // Gradually increase intensity - slower ramp up for better pacing
      stateRef.current.trafficIntensity += 0.08;
      setStats(prev => {
          const nextWave = prev.wave + 1;
          if (nextWave % 5 === 0) stateRef.current.bossSpawned = false;

          // Wave transition effects (not on boss waves - they get their own)
          if (nextWave % 5 !== 0) {
            const state = stateRef.current;
            state.floatingTexts.push(createFloatingText(GAME_WIDTH / 2, 80, `Wave ${nextWave}`, '#3b82f6', 22));
            for (let i = 0; i < 20; i++) {
              state.particles.push(createParticle(
                GAME_WIDTH / 2 + (Math.random() - 0.5) * 150,
                80 + (Math.random() - 0.5) * 50,
                '#3b82f6'
              ));
            }
          }

          return { ...prev, wave: nextWave };
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [gameState]);

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e) => {
    if (gameState !== 'playing') return;
    const { x, y } = getMousePos(e);
    const state = stateRef.current;

    let clickedServer = null;
    for (let i = state.servers.length - 1; i >= 0; i--) {
      const s = state.servers[i];
      if (Math.sqrt((s.x - x)**2 + (s.y - y)**2) < 25) {
        clickedServer = s;
        break;
      }
    }

    if (clickedServer) {
      setSelection(clickedServer.id);
      state.mouse.draggingId = clickedServer.id;
      state.mouse.isDown = true;
    } else {
      setSelection(null);
    }
  };

  const handleMouseMove = (e) => {
    if (gameState !== 'playing') return;
    const { x, y } = getMousePos(e);
    stateRef.current.mouse.x = x;
    stateRef.current.mouse.y = y;

    if (stateRef.current.mouse.isDown && stateRef.current.mouse.draggingId) {
        const server = stateRef.current.servers.find(s => s.id === stateRef.current.mouse.draggingId);
        if (server) { server.x = x; server.y = y; }
    }
  };

  const handleDropNewServer = (e) => {
    e.preventDefault();
    const typeKey = e.dataTransfer.getData('type');
    const typeConfig = SERVER_TYPES[typeKey];
    if (stats.money < typeConfig.cost) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x > 0 && x < GAME_WIDTH && y > 0 && y < GAME_HEIGHT) {
        setStats(prev => ({ ...prev, money: prev.money - typeConfig.cost }));
        stateRef.current.servers.push({
            id: Date.now(),
            type: typeKey,
            x, y,
            level: 1,
            range: typeConfig.range,
            power: typeConfig.power,
            load: 0,
            status: 'active',
            rebootTimer: 0,
            targeting: 'nearest',
            isTemporary: false,
        });
        for(let i=0; i<10; i++) stateRef.current.particles.push(createParticle(x, y, typeConfig.color));
    }
  };

  const activateFreeze = () => {
      if (stats.money >= 200 && !freezeActive) {
          setStats(prev => ({ ...prev, money: prev.money - 200 }));
          setFreezeActive(true);
          stateRef.current.freezeTimer = 180;

          // Visual feedback
          const state = stateRef.current;
          for (let i = 0; i < 30; i++) {
            state.particles.push(createParticle(
              GAME_WIDTH / 2 + (Math.random() - 0.5) * GAME_WIDTH,
              GAME_HEIGHT / 2 + (Math.random() - 0.5) * GAME_HEIGHT,
              '#0ea5e9'
            ));
          }
          state.floatingTexts.push(createFloatingText(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'RATE LIMITED!', '#0ea5e9', 20));
          triggerScreenShake(4);
      }
  };

  const activateAutoscaler = () => {
      if (stats.money >= CONFIG.autoscalerCost && autoscalerCooldown === 0) {
          setStats(prev => ({ ...prev, money: prev.money - CONFIG.autoscalerCost }));
          setAutoscalerCooldown(600);

          const deployX = GAME_WIDTH / 3;
          const deployY = GAME_HEIGHT / 2;

          addTempServer(deployX, deployY - 40);
          addTempServer(deployX, deployY + 40);

          // Visual feedback
          const state = stateRef.current;
          state.floatingTexts.push(createFloatingText(deployX, deployY, 'AUTO-SCALING!', '#6366f1', 18));
          state.shockwaves.push(createShockwave(deployX, deployY - 40, '#6366f1', 60));
          state.shockwaves.push(createShockwave(deployX, deployY + 40, '#6366f1', 60));
          triggerScreenShake(6);
      }
  };

  const upgradeServer = () => {
    if (!selection) return;
    const state = stateRef.current;
    const server = state.servers.find(s => s.id === selection);
    if (!server || server.isTemporary) return;

    const baseCost = SERVER_TYPES[server.type].cost;
    const cost = Math.floor(baseCost * Math.pow(1.5, server.level));

    if (stats.money >= cost) {
        setStats(prev => ({ ...prev, money: prev.money - cost }));
        server.level += 1;
        server.power *= 1.25;
        server.range += 15;

        // Enhanced upgrade effects
        const sType = SERVER_TYPES[server.type];
        for(let i=0; i<25; i++) state.particles.push(createParticle(server.x, server.y, sType.color));
        state.shockwaves.push(createShockwave(server.x, server.y, sType.color, 45));
        state.floatingTexts.push(createFloatingText(server.x, server.y - 35, `LEVEL ${server.level}!`, sType.color, 14));
        triggerScreenShake(3);
    }
  };

  const toggleTargeting = () => {
      if (!selection) return;
      const server = stateRef.current.servers.find(s => s.id === selection);
      if (!server) return;

      const modes = Object.keys(TARGETING_MODES);
      const currentIndex = modes.indexOf(server.targeting);
      const nextIndex = (currentIndex + 1) % modes.length;
      server.targeting = modes[nextIndex];

      setSelection(prev => prev);
      setStats(prev => ({...prev}));
  };

  const restartGame = () => {
    setStats({ money: CONFIG.initialMoney, health: CONFIG.initialHealth, requestsProcessed: 0, requestsDropped: 0, wave: 1 });
    stateRef.current.servers = [];
    stateRef.current.packets = [];
    stateRef.current.particles = [];
    stateRef.current.floatingTexts = [];
    stateRef.current.shockwaves = [];
    stateRef.current.trafficIntensity = 1;
    stateRef.current.freezeTimer = 0;
    stateRef.current.chaosTimer = CONFIG.chaosInterval;
    stateRef.current.bossSpawned = false;
    stateRef.current.screenShake = 0;
    setFreezeActive(false);
    setAutoscalerCooldown(0);
    setSelection(null);
    setGameState('playing');
  };

  const getUpgradeCost = () => {
    if (!selection) return 0;
    const s = stateRef.current.servers.find(s => s.id === selection);
    if (!s || s.isTemporary) return 0;
    return Math.floor(SERVER_TYPES[s.type].cost * Math.pow(1.5, s.level));
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <div className={cn(
      "min-h-screen font-sans p-2 sm:p-4 select-none",
      isDark 
        ? "bg-slate-950 text-slate-100" 
        : "bg-gradient-to-br from-gray-50 to-blue-50 text-gray-900"
    )}>
      <div className="container mx-auto max-w-4xl">
        {/* Breadcrumb */}
        <nav className={cn(
          "flex items-center space-x-2 text-sm mb-4 sm:mb-6 px-2",
          isDark ? "text-slate-400" : "text-gray-600"
        )}>
          <Link
            href="/games"
            className={cn(
              "transition-colors flex items-center gap-1",
              isDark ? "hover:text-slate-200" : "hover:text-gray-900"
            )}
          >
            <Home className="w-4 h-4" />
            Games
          </Link>
          <span>/</span>
          <span className={cn(
            isDark ? "text-slate-100" : "text-gray-900"
          )}>Scalable Sentry</span>
        </nav>

        {/* Mobile Warning */}
        {isMobile && (
          <div className={cn(
            "mb-4 mx-2 p-4 rounded-xl border",
            isDark 
              ? "bg-amber-900/30 border-amber-700/50" 
              : "bg-amber-50 border-amber-300"
          )}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={cn(
                "shrink-0 mt-0.5",
                isDark ? "text-amber-400" : "text-amber-600"
              )} size={20} />
              <div>
                <h3 className={cn(
                  "font-bold text-sm mb-1",
                  isDark ? "text-amber-300" : "text-amber-900"
                )}>Desktop Recommended</h3>
                <p className={cn(
                  "text-xs leading-relaxed",
                  isDark ? "text-amber-200/80" : "text-amber-800"
                )}>
                  This tower defense game is best experienced on desktop with mouse/keyboard controls. Mobile play may be challenging due to drag-and-drop mechanics.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center">
          <div className={cn(
            "w-full max-w-4xl flex flex-col sm:flex-row justify-between items-center mb-4 p-3 sm:p-4 rounded-xl border shadow-xl gap-3",
            isDark 
              ? "bg-slate-900 border-slate-800" 
              : "bg-white border-gray-200"
          )}>
        <div className="flex flex-wrap gap-3 sm:gap-4 justify-center sm:justify-start w-full sm:w-auto">
          <div className="text-center sm:text-left">
            <div className={cn(
              "text-xs",
              isDark ? "text-slate-400" : "text-gray-600"
            )}>BUDGET</div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-400">${stats.money.toFixed(0)}</div>
          </div>
          <div className="text-center sm:text-left">
            <div className={cn(
              "text-xs",
              isDark ? "text-slate-400" : "text-gray-600"
            )}>SYSTEM INTEGRITY</div>
            <div className="flex items-center gap-2">
                <div className={cn(
                  "w-24 sm:w-32 h-3 rounded-full overflow-hidden",
                  isDark ? "bg-slate-800" : "bg-gray-200"
                )}>
                    <div className={`h-full transition-all duration-300 ${stats.health<30?'bg-red-500':'bg-blue-500'}`} style={{width:`${stats.health}%`}}></div>
                </div>
                <span className="font-mono text-sm">{stats.health}%</span>
            </div>
          </div>

          <button
            onClick={activateFreeze}
            disabled={stats.money < 200 || freezeActive}
            className={cn(
              "flex flex-col items-center justify-center px-3 py-1 rounded border text-xs",
              freezeActive ? "bg-sky-500/20 border-sky-500" : 
              stats.money >= 200 
                ? (isDark 
                    ? "bg-slate-800 hover:bg-slate-700 border-slate-600" 
                    : "bg-gray-100 hover:bg-gray-200 border-gray-300") + " cursor-pointer"
                : (isDark 
                    ? "bg-slate-900 border-slate-800" 
                    : "bg-gray-50 border-gray-200") + " opacity-50 cursor-not-allowed"
            )}
          >
              <span className="font-bold text-sky-400 flex items-center gap-1">
                <Snowflake size={10}/> FREEZE
              </span>
              <span className={cn(
                isDark ? "text-slate-400" : "text-gray-600"
              )}>$200</span>
          </button>

          <button
            onClick={activateAutoscaler}
            disabled={stats.money < CONFIG.autoscalerCost || autoscalerCooldown > 0}
            className={`flex flex-col items-center justify-center px-3 py-1 rounded border transition-all duration-300 text-xs
                ${stats.money >= CONFIG.autoscalerCost && autoscalerCooldown === 0 ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed'}
            `}
          >
              <span className="font-bold flex items-center gap-1">
                  <TrendingUp size={10}/> SCALE
              </span>
              <span>
                {autoscalerCooldown > 0 ? `${(autoscalerCooldown/60).toFixed(1)}s` : `$${CONFIG.autoscalerCost}`}
              </span>
          </button>
        </div>
        <div className="text-center sm:text-right">
            <div className={cn(
              "text-xs",
              isDark ? "text-slate-400" : "text-gray-600"
            )}>WAVE</div>
            <div className="text-xl font-bold text-amber-400">{stats.wave}</div>
            <div className={cn(
              "text-[10px]",
              isDark ? "text-slate-500" : "text-gray-500"
            )}>
                {stats.wave % 5 === 0 ? 'BOSS ACTIVE' : `Next Boss: Wave ${Math.ceil(stats.wave/5)*5}`}
            </div>
        </div>
      </div>

      <div className="relative group w-full overflow-x-auto">
        <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={() => { stateRef.current.mouse.isDown = false; stateRef.current.mouse.draggingId = null; }}
            onMouseLeave={() => { stateRef.current.mouse.isDown = false; stateRef.current.mouse.draggingId = null; }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropNewServer}
            className={cn(
              "rounded-lg shadow-2xl border cursor-crosshair mx-auto",
              isDark ? "bg-slate-900 border-slate-800" : "bg-white border-gray-300",
              gameState === 'gameover' && "grayscale opacity-50"
            )}
            style={{ maxWidth: '100%', height: 'auto' }}
        />

        {chaosActive && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3 bg-red-500/90 text-white rounded-full animate-bounce z-10 shadow-lg shadow-red-500/50">
                <Skull size={24} />
                <span className="font-bold text-lg">SYSTEM ALERT!</span>
            </div>
        )}

        {gameState === 'start' && (
            <div className={cn(
              "absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm rounded-lg z-20",
              isDark ? "bg-slate-950/95" : "bg-white/95"
            )}>
                <h1 className="text-5xl font-black text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-indigo-500 mb-2">SCALABLE SENTRY</h1>
                <p className={cn(
                  "mb-8 tracking-widest uppercase text-sm",
                  isDark ? "text-slate-400" : "text-gray-600"
                )}>Advanced Load Balancer Simulation</p>

                <div className="grid grid-cols-5 gap-4 mb-8 max-w-4xl text-center">
                    {Object.entries(SERVER_TYPES).map(([key, type]) => {
                      const Icon = type.icon;
                      return (
                        <div key={key} className={cn(
                          "p-3 rounded border",
                          isDark 
                            ? "bg-slate-900 border-slate-800" 
                            : "bg-gray-50 border-gray-200"
                        )}>
                            <div className="font-bold mb-1 flex justify-center gap-1 items-center" style={{color: type.color}}>
                                <Icon size={14} color={type.color}/> {type.name}
                            </div>
                            <div className={cn(
                              "text-[10px]",
                              isDark ? "text-slate-400" : "text-gray-600"
                            )}>{type.desc}</div>
                        </div>
                      );
                    })}
                </div>

                <button onClick={() => setGameState('playing')} className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-xl transition-all hover:scale-105 shadow-[0_0_25px_rgba(37,99,235,0.6)]">
                    BOOTSTRAP SYSTEM
                </button>
            </div>
        )}

        {gameState === 'gameover' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-md rounded-lg z-20">
                <AlertTriangle size={64} className="text-red-500 mb-4" />
                <h1 className="text-4xl font-bold text-white mb-2">SYSTEM CRITICAL</h1>
                <p className="text-red-200 mb-2">503 Service Unavailable</p>
                <p className="text-red-300 text-sm mb-6">
                  Processed: {stats.requestsProcessed} | Dropped: {stats.requestsDropped} | Wave: {stats.wave}
                </p>
                <button onClick={restartGame} className="px-8 py-3 bg-white text-red-900 hover:bg-slate-200 rounded-full font-bold">REBOOT</button>
            </div>
        )}
      </div>

      <div className="w-full max-w-4xl mt-4 flex flex-col md:flex-row gap-4">

        <div className="flex gap-2 grow overflow-x-auto h-28 px-2">
            {Object.entries(SERVER_TYPES).map(([key, type]) => {
              const Icon = type.icon;
              return (
                <div
                    key={key}
                    draggable={stats.money >= type.cost}
                    onDragStart={(e) => {
                        setDragType(key);
                        e.dataTransfer.setData('type', key);
                    }}
                    className={cn(
                      "min-w-[70px] sm:min-w-[80px] flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all",
                      stats.money >= type.cost
                        ? (isDark 
                            ? "bg-slate-900 border-slate-700 hover:bg-slate-800" 
                            : "bg-white border-gray-300 hover:bg-gray-50") + " hover:border-blue-500 cursor-grab active:cursor-grabbing"
                        : (isDark 
                            ? "bg-slate-900/50 border-slate-800" 
                            : "bg-gray-50 border-gray-200") + " opacity-40 cursor-not-allowed"
                    )}
                >
                    <Icon className="mb-1" color={type.color} size={20} />
                    <span className={cn(
                      "text-[10px] sm:text-xs font-bold text-center px-1",
                      isDark ? "text-slate-300" : "text-gray-700"
                    )}>{type.name}</span>
                    <span className="text-[10px] sm:text-xs font-mono text-emerald-400">${type.cost}</span>
                </div>
              );
            })}
        </div>

        <div className={cn(
          "w-full md:w-64 p-3 rounded-xl border flex flex-col gap-2 shrink-0 mx-2 md:mx-0",
          isDark 
            ? "bg-slate-900 border-slate-800" 
            : "bg-white border-gray-200"
        )}>
            {selection ? (
                <>
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <div className={cn(
                              "text-xs uppercase",
                              isDark ? "text-slate-500" : "text-gray-600"
                            )}>Pod Config</div>
                            <div className={cn(
                              "font-bold text-sm truncate",
                              isDark ? "text-white" : "text-gray-900"
                            )}>
                                {stateRef.current.servers.find(s=>s.id===selection)?.isTemporary && <span className='text-orange-400'>(TEMP) </span>}
                                v{stateRef.current.servers.find(s=>s.id===selection)?.level} {SERVER_TYPES[stateRef.current.servers.find(s=>s.id===selection)?.type]?.name}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={toggleTargeting}
                        disabled={stateRef.current.servers.find(s=>s.id===selection)?.type === 'firewall' || stateRef.current.servers.find(s=>s.id===selection)?.type === 'observability'}
                        className={cn(
                          "flex items-center justify-between w-full px-3 py-1.5 rounded border text-xs disabled:opacity-50 disabled:cursor-not-allowed",
                          isDark 
                            ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" 
                            : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
                        )}
                    >
                        <span className="flex items-center gap-1"><Crosshair size={12}/> Priority:</span>
                        <span className="font-bold text-blue-400 uppercase text-[10px]">{TARGETING_MODES[stateRef.current.servers.find(s=>s.id===selection)?.targeting || 'nearest']}</span>
                    </button>

                    <button
                        onClick={upgradeServer}
                        disabled={stats.money < getUpgradeCost() || stateRef.current.servers.find(s=>s.id===selection)?.isTemporary}
                        className={cn(
                          "w-full py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1",
                          stats.money >= getUpgradeCost() && !stateRef.current.servers.find(s=>s.id===selection)?.isTemporary
                            ? "bg-indigo-600 text-white hover:bg-indigo-500"
                            : (isDark ? "bg-slate-800 text-slate-500" : "bg-gray-100 text-gray-400")
                        )}
                    >
                       <ArrowUpCircle size={14}/> <span className="truncate">Upgrade ${getUpgradeCost()}</span>
                    </button>
                </>
            ) : (
                <div className={cn(
                  "h-full flex items-center justify-center text-center text-[10px] italic px-2",
                  isDark ? "text-slate-600" : "text-gray-500"
                )}>
                    Select a deployed pod to configure targeting or scale up resources.
                </div>
            )}
        </div>

      </div>

      {/* Instructions */}
      <div className={cn(
        "w-full max-w-4xl mt-4 p-3 sm:p-4 rounded-xl border mx-2",
        isDark 
          ? "bg-slate-900/50 border-slate-800" 
          : "bg-white border-gray-200"
      )}>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h3 className={cn(
              "text-lg sm:text-xl font-bold flex items-center gap-2 mb-2",
              isDark ? "text-white" : "text-gray-900"
            )}>
              <HelpCircle size={20} className="text-blue-500" />
              Game Instructions
            </h3>
            <p className={cn(
              "text-xs sm:text-sm",
              isDark ? "text-slate-400" : "text-gray-600"
            )}>Learn about servers, traffic types, and strategies to defend your infrastructure</p>
          </div>

          {/* Content */}
          <div className="space-y-6">
              {/* Server Types Section */}
              <section>
                <h3 className={cn(
                  "text-xl font-bold mb-4 flex items-center gap-2",
                  isDark ? "text-blue-400" : "text-blue-600"
                )}>
                  <Server size={24} />
                  Server Types
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* API Node */}
                  <div className={cn(
                    "p-4 rounded-lg border",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <Server size={20} color="#6366f1" />
                      <h4 className={cn(
                        "font-bold text-lg",
                        isDark ? "text-white" : "text-gray-900"
                      )}>API Node <span className="text-emerald-400">$100</span></h4>
                    </div>
                    <p className={cn(
                      "text-sm mb-3",
                      isDark ? "text-slate-300" : "text-gray-700"
                    )}>Balanced general-purpose defense server</p>
                    <div className={cn(
                      "text-xs space-y-1",
                      isDark ? "text-slate-400" : "text-gray-600"
                    )}>
                      <div><strong>Range:</strong> 150px | <strong>Power:</strong> 2.5 | <strong>Cooling:</strong> 0.6s</div>
                      <div><strong>Heat Gen:</strong> 0.8 (Medium)</div>
                      <div className="text-green-500"><strong>✓ Good Against:</strong> HTTP, balanced traffic</div>
                      <div className="text-red-500"><strong>✗ Struggles With:</strong> High-volume DDoS, bosses</div>
                      <div className={cn("mt-2 pt-2 border-t", isDark ? "border-slate-700" : "border-gray-200")}>
                        <strong className="text-blue-400">💡 Strategy:</strong> Use as your foundation. Affordable and reliable for early waves.
                      </div>
                    </div>
                  </div>

                  {/* Redis Cache */}
                  <div className={cn(
                    "p-4 rounded-lg border",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <Layers size={20} color="#ec4899" />
                      <h4 className={cn(
                        "font-bold text-lg",
                        isDark ? "text-white" : "text-gray-900"
                      )}>Redis Cache <span className="text-emerald-400">$150</span></h4>
                    </div>
                    <p className={cn(
                      "text-sm mb-3",
                      isDark ? "text-slate-300" : "text-gray-700"
                    )}>Fast-firing cache layer excellent for volume attacks</p>
                    <div className={cn(
                      "text-xs space-y-1",
                      isDark ? "text-slate-400" : "text-gray-600"
                    )}>
                      <div><strong>Range:</strong> 110px | <strong>Power:</strong> 1.5 | <strong>Cooling:</strong> 1.5s</div>
                      <div><strong>Heat Gen:</strong> 0.4 (Low)</div>
                      <div className="text-green-500"><strong>✓ Good Against:</strong> DDoS swarms, multiple small requests</div>
                      <div className="text-red-500"><strong>✗ Struggles With:</strong> Heavy SQL, Monoliths</div>
                      <div className={cn("mt-2 pt-2 border-t", isDark ? "border-slate-700" : "border-gray-200")}>
                        <strong className="text-blue-400">💡 Strategy:</strong> Deploy near spawn points to catch DDoS early. Low heat means continuous fire.
                      </div>
                    </div>
                  </div>

                  {/* Postgres DB */}
                  <div className={cn(
                    "p-4 rounded-lg border",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <Database size={20} color="#f59e0b" />
                      <h4 className={cn(
                        "font-bold text-lg",
                        isDark ? "text-white" : "text-gray-900"
                      )}>Postgres DB <span className="text-emerald-400">$300</span></h4>
                    </div>
                    <p className={cn(
                      "text-sm mb-3",
                      isDark ? "text-slate-300" : "text-gray-700"
                    )}>Heavy-hitting database with massive damage output</p>
                    <div className={cn(
                      "text-xs space-y-1",
                      isDark ? "text-slate-400" : "text-gray-600"
                    )}>
                      <div><strong>Range:</strong> 200px | <strong>Power:</strong> 15 | <strong>Cooling:</strong> 0.3s</div>
                      <div><strong>Heat Gen:</strong> 3.5 (Very High)</div>
                      <div className="text-green-500"><strong>✓ Good Against:</strong> Monoliths, Heavy SQL, boss waves</div>
                      <div className="text-red-500"><strong>✗ Struggles With:</strong> Fast DDoS swarms, overheats quickly</div>
                      <div className={cn("mt-2 pt-2 border-t", isDark ? "border-slate-700" : "border-gray-200")}>
                        <strong className="text-blue-400">💡 Strategy:</strong> Essential for bosses. Place strategically and manage heat carefully.
                      </div>
                    </div>
                  </div>

                  {/* Security Group */}
                  <div className={cn(
                    "p-4 rounded-lg border",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <Lock size={20} color="#06b6d4" />
                      <h4 className={cn(
                        "font-bold text-lg",
                        isDark ? "text-white" : "text-gray-900"
                      )}>Sec Group <span className="text-emerald-400">$200</span></h4>
                    </div>
                    <p className={cn(
                      "text-sm mb-3",
                      isDark ? "text-slate-300" : "text-gray-700"
                    )}>Firewall that slows down incoming traffic</p>
                    <div className={cn(
                      "text-xs space-y-1",
                      isDark ? "text-slate-400" : "text-gray-600"
                    )}>
                      <div><strong>Range:</strong> 130px | <strong>Power:</strong> 0.5 | <strong>Effect:</strong> Slows traffic</div>
                      <div><strong>Heat Gen:</strong> 0.5 (Low)</div>
                      <div className="text-green-500"><strong>✓ Good Against:</strong> Fast targets, buying time</div>
                      <div className="text-red-500"><strong>✗ Struggles With:</strong> Low damage output</div>
                      <div className={cn("mt-2 pt-2 border-t", isDark ? "border-slate-700" : "border-gray-200")}>
                        <strong className="text-blue-400">💡 Strategy:</strong> Place early in path to slow all traffic, giving damage dealers more time.
                      </div>
                    </div>
                  </div>

                  {/* Prometheus */}
                  <div className={cn(
                    "p-4 rounded-lg border",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <MonitorCheck size={20} color="#10b981" />
                      <h4 className={cn(
                        "font-bold text-lg",
                        isDark ? "text-white" : "text-gray-900"
                      )}>Prometheus <span className="text-emerald-400">$400</span></h4>
                    </div>
                    <p className={cn(
                      "text-sm mb-3",
                      isDark ? "text-slate-300" : "text-gray-700"
                    )}>Observability tool that boosts nearby servers</p>
                    <div className={cn(
                      "text-xs space-y-1",
                      isDark ? "text-slate-400" : "text-gray-600"
                    )}>
                      <div><strong>Range:</strong> 250px | <strong>Power:</strong> 0 | <strong>Effect:</strong> +50% damage boost to nearby servers</div>
                      <div><strong>Heat Gen:</strong> 0.2 (Very Low)</div>
                      <div className="text-green-500"><strong>✓ Good Against:</strong> Amplifying existing defenses</div>
                      <div className="text-red-500"><strong>✗ Struggles With:</strong> No direct damage</div>
                      <div className={cn("mt-2 pt-2 border-t", isDark ? "border-slate-700" : "border-gray-200")}>
                        <strong className="text-blue-400">💡 Strategy:</strong> Place centrally to boost multiple servers. Essential for late game.
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Traffic Types */}
              <section>
                <h3 className={cn(
                  "text-xl font-bold mb-4 flex items-center gap-2",
                  isDark ? "text-purple-400" : "text-purple-600"
                )}>
                  <AlertTriangle size={24} />
                  Traffic Types
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={cn(
                    "p-3 rounded-lg border",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className={cn("font-bold mb-1", isDark ? "text-white" : "text-gray-900")}>
                      HTTP Request <span className="text-gray-400">(White)</span>
                    </div>
                    <div className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-600")}>
                      <strong>HP:</strong> 100 | <strong>Speed:</strong> 1.5 | <strong>Score:</strong> 10<br />
                      Standard web traffic. Balanced and common.
                    </div>
                  </div>

                  <div className={cn(
                    "p-3 rounded-lg border",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className={cn("font-bold mb-1", isDark ? "text-white" : "text-gray-900")}>
                      DDoS Attack <span className="text-red-400">(Red)</span>
                    </div>
                    <div className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-600")}>
                      <strong>HP:</strong> 35 | <strong>Speed:</strong> 3.8 | <strong>Score:</strong> 6<br />
                      Fast, low-health swarms. Dangerous in numbers.
                    </div>
                  </div>

                  <div className={cn(
                    "p-3 rounded-lg border",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className={cn("font-bold mb-1", isDark ? "text-white" : "text-gray-900")}>
                      Heavy SQL <span className="text-yellow-400">(Yellow)</span>
                    </div>
                    <div className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-600")}>
                      <strong>HP:</strong> 700 | <strong>Speed:</strong> 0.6 | <strong>Score:</strong> 50<br />
                      Slow but tanky. Requires heavy firepower.
                    </div>
                  </div>

                  <div className={cn(
                    "p-3 rounded-lg border",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className={cn("font-bold mb-1", isDark ? "text-white" : "text-gray-900")}>
                      TLS Handshake <span className="text-green-400">(Green)</span>
                    </div>
                    <div className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-600")}>
                      <strong>HP:</strong> 250 | <strong>Speed:</strong> 1.2 | <strong>Score:</strong> 20<br />
                      Encrypted traffic. 25% damage reduction vs servers.
                    </div>
                  </div>

                  <div className={cn(
                    "p-3 rounded-lg border border-purple-500",
                    isDark ? "bg-purple-900/20" : "bg-purple-50"
                  )}>
                    <div className={cn("font-bold mb-1", isDark ? "text-white" : "text-gray-900")}>
                      The Monolith <span className="text-purple-400">(Purple)</span>
                    </div>
                    <div className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-600")}>
                      <strong>HP:</strong> 5000 | <strong>Speed:</strong> 0.3 | <strong>Score:</strong> 1000<br />
                      <strong className="text-red-500">BOSS WAVE!</strong> Spawns every 5 waves. Massive HP and score.
                    </div>
                  </div>
                </div>
              </section>

              {/* Game Mechanics */}
              <section>
                <h3 className={cn(
                  "text-xl font-bold mb-4 flex items-center gap-2",
                  isDark ? "text-orange-400" : "text-orange-600"
                )}>
                  <Cpu size={24} />
                  Game Mechanics
                </h3>
                <div className="space-y-3">
                  <div className={cn(
                    "p-3 rounded-lg border",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className={cn("font-bold mb-1 flex items-center gap-2", isDark ? "text-white" : "text-gray-900")}>
                      <Flame size={16} className="text-red-500" />
                      Heat Management
                    </div>
                    <p className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-600")}>
                      Each server generates heat when firing. At 100 heat, the server enters "rebooting" status and stops working temporarily. 
                      Servers cool down over time. High-power servers like Postgres DB generate more heat.
                    </p>
                  </div>

                  <div className={cn(
                    "p-3 rounded-lg border",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className={cn("font-bold mb-1 flex items-center gap-2", isDark ? "text-white" : "text-gray-900")}>
                      <Crosshair size={16} className="text-blue-500" />
                      Targeting Modes
                    </div>
                    <p className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-600")}>
                      Click a server to select it, then toggle targeting priority:<br />
                      <strong>• Nearest:</strong> Targets closest traffic (default)<br />
                      <strong>• Strongest:</strong> Focuses on high-HP targets<br />
                      <strong>• Weakest:</strong> Cleans up low-HP targets quickly
                    </p>
                  </div>

                  <div className={cn(
                    "p-3 rounded-lg border",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className={cn("font-bold mb-1 flex items-center gap-2", isDark ? "text-white" : "text-gray-900")}>
                      <ArrowUpCircle size={16} className="text-purple-500" />
                      Upgrades
                    </div>
                    <p className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-600")}>
                      Upgrade servers to increase power, range, and reduce heat generation. Cost increases with each level. 
                      Upgrading is usually more efficient than deploying new servers.
                    </p>
                  </div>

                  <div className={cn(
                    "p-3 rounded-lg border",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className={cn("font-bold mb-1 flex items-center gap-2", isDark ? "text-white" : "text-gray-900")}>
                      <Snowflake size={16} className="text-sky-500" />
                      Freeze Ability ($200)
                    </div>
                    <p className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-600")}>
                      Temporarily freezes all traffic on screen for 5 seconds. Use during overwhelming waves or boss spawns.
                    </p>
                  </div>

                  <div className={cn(
                    "p-3 rounded-lg border",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className={cn("font-bold mb-1 flex items-center gap-2", isDark ? "text-white" : "text-gray-900")}>
                      <TrendingUp size={16} className="text-indigo-500" />
                      Autoscaler ($350)
                    </div>
                    <p className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-600")}>
                      Deploys temporary boosted servers across the field. They last for 60 seconds. Has cooldown after use.
                    </p>
                  </div>
                </div>
              </section>

              {/* Strategy Tips */}
              <section>
                <h3 className={cn(
                  "text-xl font-bold mb-4 flex items-center gap-2",
                  isDark ? "text-green-400" : "text-green-600"
                )}>
                  <Sparkles size={24} />
                  Strategy Tips
                </h3>
                <div className={cn(
                  "space-y-2 text-sm",
                  isDark ? "text-slate-300" : "text-gray-700"
                )}>
                  <div className="flex gap-2">
                    <span className="text-emerald-400">1.</span>
                    <span><strong>Start Simple:</strong> Deploy 2-3 API Nodes early for steady income</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-emerald-400">2.</span>
                    <span><strong>Plan Ahead:</strong> Save budget for boss waves (every 5 waves). Have Postgres DB ready.</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-emerald-400">3.</span>
                    <span><strong>Layered Defense:</strong> Place Sec Groups early, damage dealers in middle, Prometheus centrally</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-emerald-400">4.</span>
                    <span><strong>Heat Management:</strong> Don't over-deploy high-heat servers. Space them out.</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-emerald-400">5.</span>
                    <span><strong>Upgrade Focus:</strong> Upgrade existing servers rather than building new ones when possible</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-emerald-400">6.</span>
                    <span><strong>DDoS Response:</strong> Redis Cache excels against swarms. Deploy 2-3 near spawn points.</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-emerald-400">7.</span>
                    <span><strong>Use Abilities:</strong> Save Freeze for emergencies. Autoscaler is great for boss waves.</span>
                  </div>
                </div>
              </section>
          </div>
        </div>
      </div>

        </div>
      </div>
    </div>
  );
}
