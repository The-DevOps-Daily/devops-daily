'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RefreshCw,
  Wifi,
  WifiOff,
  Shield,
  Zap,
  Activity,
  AlertTriangle,
  Lock,
  ArrowRightLeft,
  Network,
  type LucideIcon,
} from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFrame,
  SimMissionList,
  SimPhoneBar,
  SimResetButton,
  SimStage,
  useMissions,
  type Mission,
  type SimTone,
} from '@/components/games/sim';

/**
 * TCP vs UDP Visual Simulator
 * Designed for devops-daily.com
 * * Features:
 * - Particle-based network simulation
 * - TCP 3-Way Handshake visualization
 * - Visual representation of ACKs vs Fire-and-Forget
 * - Interactive Network Conditions (Latency, Loss, Jitter)
 */

// --- Constants & Config ---
const MODES = {
  TCP: 'TCP',
  UDP: 'UDP',
};

const CONNECTION_STATES = {
  DISCONNECTED: 'DISCONNECTED',
  HANDSHAKE_SYN: 'HANDSHAKE_SYN', // Client sends SYN
  HANDSHAKE_SYN_ACK: 'HANDSHAKE_SYN_ACK', // Server sends SYN-ACK
  HANDSHAKE_ACK: 'HANDSHAKE_ACK', // Client sends ACK
  CONNECTED: 'CONNECTED', // Data flow
};

const TCP_WINDOW = 3; // Unacknowledged DATA packets allowed in flight
const LOST_TICKS = 30; // TCP: retransmission timeout. UDP: how long the X stays

type Packet = {
  id: number;
  x: number;
  y: number;
  type: string; // DATA, ACK, SYN, SYN-ACK
  status: string; // inflight, lost
  mode: string;
  progress: number;
  retransmitted: boolean;
  dropAt: number | null;
  lostTicks: number;
  speedFactor: number; // 1 = on time; jitter makes some packets slower or faster
};

type LogEntry = { id: number; text: string; type: string };

// Loss is decided once per packet: null, or the point on the wire where it drops
const rollDrop = (lossPercent: number) =>
  Math.random() * 100 < lossPercent ? 20 + Math.random() * 60 : null;

// Jitter is variation in delay: each DATA packet gets its own speed, so a later
// packet can overtake an earlier one and arrive first.
const rollSpeedFactor = (jitterPercent: number) =>
  Math.max(0.35, 1 + (Math.random() * 2 - 1) * (jitterPercent / 100) * 0.65);

type TcpMissionState = {
  mode: string;
  connState: string;
  lost: number;
  retransmits: number;
};

const MISSIONS: Mission<TcpMissionState>[] = [
  {
    id: 'handshake',
    label: 'Open a TCP connection and watch the three-way handshake.',
    hint: 'Pick TCP and press Start: SYN, SYN-ACK, ACK.',
    check: (s) => s.mode === MODES.TCP && s.connState === CONNECTION_STATES.CONNECTED,
  },
  {
    id: 'retransmit',
    label: 'Drop packets on TCP and see a lost segment sent again.',
    hint: 'Raise packet loss, then watch the retransmit count.',
    check: (s) => s.mode === MODES.TCP && s.retransmits >= 1,
  },
  {
    id: 'udp-loss',
    label: 'Drop packets on UDP and see them lost for good.',
    hint: 'UDP never resends: no handshake, no acks.',
    check: (s) => s.mode === MODES.UDP && s.lost >= 1 && s.retransmits === 0,
  },
];

function StatCard({
  label,
  value,
  tone = 'info',
  icon: Icon,
  subtext,
}: {
  label: string;
  value: string | number;
  tone?: SimTone;
  icon: LucideIcon;
  subtext?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg border bg-card p-2">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className={`h-4 w-4 ${SIM_TONE[tone].iconClass}`} aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <span className={`font-mono text-xl font-bold ${SIM_TONE[tone].text}`}>{value}</span>
      {subtext && <span className="text-xs text-muted-foreground">{subtext}</span>}
    </div>
  );
}

// --- Main Application ---

export default function TcpVsUdpSimulator() {
  const [tab, setTab] = useState<'traffic' | 'details'>('traffic');
  const [dismissed, setDismissed] = useState(false);

  // State
  const [mode, setMode] = useState(MODES.TCP);
  const [isPlaying, setIsPlaying] = useState(false);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [stats, setStats] = useState({
    sent: 0,
    received: 0,
    lost: 0,
    retransmits: 0,
    onWire: 0,
    outOfOrder: 0,
    held: 0,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connState, setConnState] = useState(CONNECTION_STATES.DISCONNECTED);
  const [educationalMessage, setEducationalMessage] = useState('');

  // Simulation Controls
  const [speed, setSpeed] = useState(50); // Speed of simulation tick
  const [packetLossChance, setPacketLossChance] = useState(0); // % of packets dropped
  const [jitter, setJitter] = useState(0); // Random movement noise

  // Refs
  const requestRef = useRef(0);
  const packetIdCounter = useRef(0);
  // The simulation reads and writes packets through this ref, outside React
  // updaters, so its side effects (counters, logs, timers) run exactly once.
  const packetsRef = useRef<Packet[]>([]);
  const handshakeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tcpWindow = useRef(new Set()); // IDs of packets in flight for TCP
  // Receiver side, for ordering: the DATA ids in the order they were sent,
  // which of them have arrived, and how many the app has been given in order.
  const dataOrder = useRef<number[]>([]);
  const arrived = useRef(new Set<number>());
  const deliveredInOrder = useRef(0);
  const udpHighestArrived = useRef(-1);
  const lastSpawnTime = useRef(0);
  const containerRef = useRef(null);

  const missionState = useMemo(
    () => ({
      mode,
      connState,
      lost: stats.lost,
      retransmits: stats.retransmits,
    }),
    [mode, connState, stats.lost, stats.retransmits]
  );
  const missions = useMissions(MISSIONS, missionState);

  // --- Logic Engines ---

  const logMessage = useCallback((msg: string, type = 'info') => {
    setLogs((prev) => {
      const newLogs = [{ id: Date.now() + Math.random(), text: msg, type }, ...prev];
      return newLogs.slice(0, 5); // Keep last 5
    });
  }, []);

  // Update educational text based on state
  useEffect(() => {
    if (!isPlaying && connState === CONNECTION_STATES.DISCONNECTED) {
      setEducationalMessage(
        "Click 'Start' to begin. " +
          (mode === MODES.TCP
            ? 'TCP will perform a handshake first.'
            : 'UDP will start streaming immediately.')
      );
      return;
    }

    if (mode === MODES.UDP) {
      setEducationalMessage(
        "UDP Mode: Packets are sent 'Fire and Forget'. No handshake, no delivery confirmation. Fast but unreliable."
      );
      return;
    }

    // TCP Messages
    switch (connState) {
      case CONNECTION_STATES.HANDSHAKE_SYN:
        setEducationalMessage('Step 1/3: Client sends SYN (Synchronize) to ask for a connection.');
        break;
      case CONNECTION_STATES.HANDSHAKE_SYN_ACK:
        setEducationalMessage('Step 2/3: Server replies with SYN-ACK (Synchronize + Acknowledge).');
        break;
      case CONNECTION_STATES.HANDSHAKE_ACK:
        setEducationalMessage('Step 3/3: Client sends final ACK. Connection is established!');
        break;
      case CONNECTION_STATES.CONNECTED:
        setEducationalMessage(
          `Connection Established. Reliable Data Transfer in progress. Note the return receipts (ACKs). At most ${TCP_WINDOW} packets wait for an ACK at once; unacknowledged data is retransmitted after a timeout, whether the data or its ACK was lost.`
        );
        break;
      default:
        break;
    }
  }, [connState, mode, isPlaying]);

  const commitPackets = useCallback((next: Packet[]) => {
    packetsRef.current = next;
    setPackets(next);
  }, []);

  const spawnPacket = useCallback(
    (typeOverride: string | null = null, statusOverride = 'inflight') => {
      // Limits
      if (packetsRef.current.length > 30) return; // Prevent overcrowding

      let type = typeOverride || 'DATA';

      // TCP Window Control: only DATA packets count, not the handshake
      if (mode === MODES.TCP && type === 'DATA' && tcpWindow.current.size >= TCP_WINDOW) return;

      packetIdCounter.current += 1;
      const id = packetIdCounter.current;

      if (mode === MODES.TCP && type === 'DATA') {
        tcpWindow.current.add(id);
      }

      const newPacket: Packet = {
        id,
        x: 10, // Start Left
        y: 50, // Center Y
        type: type, // DATA, ACK, SYN, SYN-ACK
        status: statusOverride,
        mode: mode,
        progress: type === 'SYN-ACK' ? 90 : 10, // SYN-ACK starts at right side
        retransmitted: false,
        // Handshake packets are immune to loss in this basic educational demo to avoid frustration
        dropAt: type === 'DATA' ? rollDrop(packetLossChance) : null,
        lostTicks: 0,
        speedFactor: type === 'DATA' ? rollSpeedFactor(jitter) : 1,
      };
      if (type === 'DATA') dataOrder.current.push(id);

      commitPackets([...packetsRef.current, newPacket]);
      if (type === 'DATA') {
        setStats((prev) => ({ ...prev, sent: prev.sent + 1, onWire: prev.onWire + 1 }));
      }
    },
    [mode, packetLossChance, jitter, commitPackets]
  );

  const handleStartStop = () => {
    if (isPlaying) {
      setIsPlaying(false);
      // Don't reset connection state fully so we can resume data,
      // but if we were handshaking, maybe pause?
      // For simplicity, pause freezes everything in place.
    } else {
      setIsPlaying(true);
      // If we are disconnected, kick off the process
      if (connState === CONNECTION_STATES.DISCONNECTED) {
        if (mode === MODES.UDP) {
          setConnState(CONNECTION_STATES.CONNECTED);
        } else {
          // TCP Start Handshake
          setConnState(CONNECTION_STATES.HANDSHAKE_SYN);
          spawnPacket('SYN');
          logMessage('Sending SYN...', 'syn');
        }
      }
    }
  };

  const updateSimulation = useCallback(() => {
    if (!isPlaying) return;

    const delta = { lost: 0, retransmits: 0, onWire: 0, outOfOrder: 0 };

    let nextPackets = packetsRef.current
      .map((p): Packet | null => {
        // 1. Lost packets: TCP's timer resends the DATA (whether the DATA or its ACK was lost); UDP forgets it
        if (p.status === 'lost') {
          if (p.lostTicks < LOST_TICKS) return { ...p, lostTicks: p.lostTicks + 1 };
          if (p.mode !== MODES.TCP) return null;
          logMessage(`Packet #${p.id} timed out. Retransmitting...`, 'error');
          delta.retransmits += 1;
          delta.onWire += 1;
          return {
            ...p,
            type: 'DATA',
            status: 'inflight',
            progress: 10,
            y: 50,
            retransmitted: true,
            lostTicks: 0,
            dropAt: rollDrop(packetLossChance),
            speedFactor: rollSpeedFactor(jitter),
          };
        }

        // 2. Movement Logic
        let moveSpeed = (0.5 + speed / 100) * (p.speedFactor ?? 1);
        if (p.type === 'SYN' || p.type === 'SYN-ACK') moveSpeed *= 0.7; // Slow down handshake for visibility

        // Jitter
        let noiseY = 0;
        if (jitter > 0 && p.status === 'inflight') {
          noiseY = (Math.random() - 0.5) * (jitter / 10);
        }

        // Direction: DATA/SYN/ACK(final) go Right (1). SYN-ACK/ACK(return) go Left (-1).
        // Note: 'ACK' type is overloaded.
        // In Handshake: Client->Server (Right).
        // In Data Transfer: Server->Client (Left).
        let direction = 1;
        if (p.type === 'SYN-ACK') direction = -1;
        if (p.type === 'ACK' && connState === CONNECTION_STATES.CONNECTED) direction = -1; // Data ACKs return
        if (p.type === 'ACK' && connState === CONNECTION_STATES.HANDSHAKE_ACK) direction = 1; // Handshake ACK goes forward

        let newProgress = p.progress + moveSpeed * direction;
        let newY = p.y + noiseY;

        // Drop the packet where its loss roll said it would go
        if (
          p.status === 'inflight' &&
          p.dropAt !== null &&
          (direction === 1 ? newProgress >= p.dropAt : newProgress <= p.dropAt)
        ) {
          delta.lost += 1;
          return { ...p, status: 'lost', progress: p.dropAt, y: newY, lostTicks: 0 };
        }

        // Clamp Y
        if (newY < 30) newY = 30;
        if (newY > 70) newY = 70;

        // 3. Arrival Logic

        // --- Moving Right (Client -> Server) ---
        if (direction === 1 && p.status === 'inflight' && newProgress >= 90) {
          // Arrived at Server
          if (p.type === 'SYN') {
            logMessage('Server received SYN', 'syn');
            setConnState(CONNECTION_STATES.HANDSHAKE_SYN_ACK);
            // Trigger Server Response next tick (handled in effect or here? Let's do next tick via state)
            handshakeTimers.current.push(
              setTimeout(() => {
                spawnPacket('SYN-ACK');
                logMessage('Server sent SYN-ACK', 'syn');
              }, 500)
            );
            return null;
          } else if (p.type === 'ACK' && connState === CONNECTION_STATES.HANDSHAKE_ACK) {
            logMessage('Server received ACK. Connection ESTABLISHED!', 'success');
            setConnState(CONNECTION_STATES.CONNECTED);
            return null;
          } else if (p.type === 'DATA') {
            if (p.mode === MODES.TCP) {
              // The receiver hands data to the app in order. A packet that
              // arrives before an earlier one waits in the buffer: that
              // wait is head-of-line blocking.
              const expected = dataOrder.current[deliveredInOrder.current];
              if (arrived.current.has(p.id)) {
                // A retransmit after a lost ACK: the data is already here
                logMessage(
                  `Packet #${p.id} arrived again. TCP drops the copy and resends the ACK.`,
                  'info'
                );
              } else {
                arrived.current.add(p.id);
                if (p.id !== expected) {
                  delta.outOfOrder += 1;
                  logMessage(
                    `Packet #${p.id} arrived before #${expected}. TCP holds it until #${expected} arrives.`,
                    'warning'
                  );
                }
                while (arrived.current.has(dataOrder.current[deliveredInOrder.current]))
                  deliveredInOrder.current += 1;
              }
              // TCP: Convert to ACK (Return receipt), which can be lost too
              delta.onWire += 1;
              return {
                ...p,
                type: 'ACK',
                progress: 90,
                status: 'inflight',
                y: newY,
                dropAt: rollDrop(packetLossChance),
              };
            } else {
              // UDP: handed to the app at once, in whatever order it came
              if (p.id < udpHighestArrived.current) {
                delta.outOfOrder += 1;
                logMessage(
                  `Packet #${p.id} arrived after #${udpHighestArrived.current}. UDP delivers it out of order.`,
                  'warning'
                );
              } else {
                udpHighestArrived.current = p.id;
              }
              setStats((s) => ({ ...s, received: s.received + 1 }));
              return null;
            }
          }
        }

        // --- Moving Left (Server -> Client) ---
        if (direction === -1 && p.status === 'inflight' && newProgress <= 10) {
          // Arrived at Client
          if (p.type === 'SYN-ACK') {
            logMessage('Client received SYN-ACK', 'syn');
            setConnState(CONNECTION_STATES.HANDSHAKE_ACK);
            handshakeTimers.current.push(
              setTimeout(() => {
                spawnPacket('ACK'); // Final handshake ACK
                logMessage('Client sent ACK', 'syn');
              }, 500)
            );
            return null;
          } else if (p.type === 'ACK') {
            // Data ACK
            setStats((s) => ({ ...s, received: s.received + 1 }));
            tcpWindow.current.delete(p.id);
            return null;
          }
        }

        return { ...p, progress: newProgress, y: newY };
      })
      .filter((p): p is Packet => p !== null);

    const held = arrived.current.size - deliveredInOrder.current;
    if (
      delta.lost ||
      delta.retransmits ||
      delta.onWire ||
      delta.outOfOrder ||
      held !== stats.held
    ) {
      setStats((s) => ({
        ...s,
        lost: s.lost + delta.lost,
        retransmits: s.retransmits + delta.retransmits,
        onWire: s.onWire + delta.onWire,
        outOfOrder: s.outOfOrder + delta.outOfOrder,
        held,
      }));
    }

    commitPackets(nextPackets);
  }, [
    isPlaying,
    packetLossChance,
    speed,
    jitter,
    connState,
    mode,
    spawnPacket,
    logMessage,
    commitPackets,
    stats.held,
  ]);

  // Game Loop
  useEffect(() => {
    let lastTime = performance.now();

    const animate = (time: number) => {
      const delta = time - lastTime;

      if (delta > 20) {
        updateSimulation();

        // Spawn Control
        // Only spawn DATA if Connected
        if (connState === CONNECTION_STATES.CONNECTED && isPlaying) {
          const spawnRate = mode === MODES.UDP ? 1000 - speed * 8 : 600;
          if (time - lastSpawnTime.current > Math.max(100, spawnRate)) {
            spawnPacket('DATA');
            lastSpawnTime.current = time;
          }
        }

        lastTime = time;
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    }

    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, updateSimulation, mode, speed, spawnPacket, logMessage, connState]);

  // Reset
  const handleReset = () => {
    handshakeTimers.current.forEach(clearTimeout);
    handshakeTimers.current = [];
    commitPackets([]);
    setStats({ sent: 0, received: 0, lost: 0, retransmits: 0, onWire: 0, outOfOrder: 0, held: 0 });
    tcpWindow.current.clear();
    dataOrder.current = [];
    arrived.current = new Set();
    deliveredInOrder.current = 0;
    udpHighestArrived.current = -1;
    setLogs([]);
    setConnState(CONNECTION_STATES.DISCONNECTED);
    setIsPlaying(false);
  };

  useEffect(() => () => handshakeTimers.current.forEach(clearTimeout), []);

  const handleModeChange = (newMode: string) => {
    setMode(newMode);
    handleReset();
    logMessage(`Switched to ${newMode} Protocol`);
  };

  const startOver = () => {
    handleReset();
    missions.reset();
    setDismissed(false);
  };

  // --- Renderers ---

  const connectionTone: SimTone =
    connState === CONNECTION_STATES.CONNECTED
      ? 'success'
      : connState === CONNECTION_STATES.DISCONNECTED
        ? 'info'
        : 'warning';
  const startLabel = isPlaying ? 'Stop' : 'Start';

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="TCP vs UDP"
          icon={Network}
          lead={
            <div role="group" aria-label="Protocol mode" className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={mode === MODES.TCP ? 'default' : 'outline'}
                aria-pressed={mode === MODES.TCP}
                onClick={() => handleModeChange(MODES.TCP)}
                className="h-10 lg:h-8"
              >
                <Shield className="h-4 w-4" aria-hidden="true" /> TCP
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === MODES.UDP ? 'default' : 'outline'}
                aria-pressed={mode === MODES.UDP}
                onClick={() => handleModeChange(MODES.UDP)}
                className="h-10 lg:h-8"
              >
                <Zap className="h-4 w-4" aria-hidden="true" /> UDP
              </Button>
            </div>
          }
          tools={<SimResetButton onReset={startOver} />}
          progress={{ current: missions.done, total: missions.total }}
          heading={isPlaying ? `${mode} traffic is moving` : `${mode} is ready`}
          actions={
            <div className="flex gap-1">
              <Button type="button" size="sm" onClick={handleStartStop} className="h-10 lg:h-8">
                {isPlaying ? (
                  <Pause className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Play className="h-4 w-4" aria-hidden="true" />
                )}
                {startLabel}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={startOver}
                className="h-10 lg:h-8"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Reset
              </Button>
            </div>
          }
          goal={
            missions.complete ? (
              'All three missions are done. Keep comparing the protocols.'
            ) : (
              <>
                {missions.current?.label}{' '}
                <span className="text-muted-foreground">{missions.current?.hint}</span>
              </>
            )
          }
        />

        <SimAnnouncer message={`${mode} ${connState.replace(/_/g, ' ').toLowerCase()}.`} />

        {missions.complete && !dismissed ? (
          <SimComplete
            title="Protocol missions complete"
            summary="You opened TCP, watched it recover a lost segment, and compared UDP's permanent loss."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Lost now', value: stats.lost },
              { label: 'Retries now', value: stats.retransmits },
            ]}
            actions={
              <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
                Keep exploring
              </Button>
            }
            onPlayAgain={startOver}
            playAgainLabel="Start over"
          />
        ) : (
          <SimStage
            columns="lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,0.8fr)]"
            minHeight="min-h-[22rem]"
            tab={tab}
            onTabChange={(next) => {
              if (next === 'traffic' || next === 'details') setTab(next);
            }}
            tabsLabel="TCP and UDP simulator panels"
            panels={[
              {
                id: 'traffic',
                label: 'Traffic',
                scroll: false,
                content: (
                  <section
                    className="relative h-[22rem] overflow-hidden rounded-lg border bg-card"
                    ref={containerRef}
                    aria-label="Packet wire"
                  >
                    <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2">
                      <div
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${SIM_TONE[connectionTone].surface} ${SIM_TONE[connectionTone].text}`}
                      >
                        {connState === CONNECTION_STATES.CONNECTED ? (
                          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {connState.replace(/_/g, ' ')}
                      </div>
                    </div>

                    <div className="absolute left-2 top-1/2 z-10 -translate-y-1/2 sm:left-4">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-lg border-2 text-center text-xs font-bold ${mode === MODES.TCP ? SIM_TONE.info.surface : SIM_TONE.success.surface}`}
                      >
                        CLIENT
                        <br />
                        (Sender)
                      </div>
                    </div>

                    <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2 sm:right-4">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-lg border-2 text-center text-xs font-bold ${connState === CONNECTION_STATES.CONNECTED ? SIM_TONE.success.surface : 'border-border bg-muted'}`}
                      >
                        SERVER
                        <br />
                        (Receiver)
                      </div>
                    </div>

                    <div className="absolute left-16 right-16 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted sm:left-20 sm:right-20">
                      {connState === CONNECTION_STATES.CONNECTED && (
                        <div className="h-full w-full rounded-full bg-primary/50 motion-safe:animate-pulse" />
                      )}
                    </div>

                    {packets.map((p) => {
                      let tone: SimTone = mode === MODES.TCP ? 'info' : 'success';
                      if (p.type === 'ACK') tone = 'warning';
                      if (['SYN', 'SYN-ACK'].includes(p.type)) tone = 'hint';
                      if (p.type === 'ACK' && connState !== CONNECTION_STATES.CONNECTED)
                        tone = 'hint';
                      if (p.status === 'lost') tone = 'danger';

                      const isHandshake =
                        ['SYN', 'SYN-ACK'].includes(p.type) ||
                        (p.type === 'ACK' && connState !== CONNECTION_STATES.CONNECTED);

                      return (
                        <div
                          key={p.id}
                          className="absolute flex items-center justify-center"
                          style={{
                            left: `${p.progress}%`,
                            top: `${p.y}%`,
                            transform: `translate(-50%, -50%) ${p.status === 'lost' ? 'scale(1.5)' : 'scale(1)'}`,
                            opacity: p.status === 'lost' ? 0.35 : 1,
                          }}
                        >
                          <div
                            className={`flex items-center justify-center overflow-hidden rounded-sm font-bold text-foreground ${SIM_TONE[tone].fill} ${isHandshake ? 'h-5 w-8 text-xs' : p.type === 'ACK' ? 'h-4 w-4 rounded-full' : 'h-4 w-4'}`}
                          >
                            {isHandshake ? p.type : ''}
                            {p.status === 'lost' && 'X'}
                          </div>
                        </div>
                      );
                    })}

                    {!isPlaying && packets.length === 0 && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/85 p-4">
                        <div className="text-center">
                          <p className="mb-2 text-sm text-muted-foreground">
                            Ready to compare delivery behavior.
                          </p>
                          <Button type="button" onClick={handleStartStop} className="h-10">
                            <Play className="h-4 w-4" aria-hidden="true" /> Start traffic
                          </Button>
                        </div>
                      </div>
                    )}
                  </section>
                ),
              },
              {
                id: 'details',
                label: 'Details',
                content: (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <StatCard
                        label="Sent"
                        value={stats.sent}
                        tone={mode === MODES.TCP ? 'info' : 'success'}
                        icon={Activity}
                      />
                      <StatCard
                        label="Received"
                        value={stats.received}
                        tone="success"
                        icon={Wifi}
                      />
                      <StatCard label="Lost" value={stats.lost} tone="danger" icon={WifiOff} />
                      <StatCard
                        label="Retries"
                        value={stats.retransmits}
                        tone="warning"
                        icon={RefreshCw}
                      />
                      <StatCard
                        label="Out of order"
                        value={stats.outOfOrder}
                        tone="warning"
                        icon={ArrowRightLeft}
                        subtext={mode === MODES.TCP ? `Held: ${stats.held}` : 'Delivered as is'}
                      />
                      <StatCard label="On wire" value={stats.onWire} tone="info" icon={Activity} />
                    </div>

                    <div className="rounded-lg border bg-card p-3">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                        <AlertTriangle
                          className={`h-4 w-4 ${SIM_TONE.warning.iconClass}`}
                          aria-hidden="true"
                        />{' '}
                        Network conditions
                      </div>
                      <div className="space-y-3">
                        <label className="block text-sm">
                          <span className="mb-1 flex justify-between">
                            <span>Traffic speed</span>
                            <span className="font-mono text-muted-foreground">{speed}%</span>
                          </span>
                          <input
                            type="range"
                            aria-label="Traffic speed"
                            min="10"
                            max="100"
                            value={speed}
                            onChange={(e) => setSpeed(Number(e.target.value))}
                            className="h-10 w-full accent-primary"
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="mb-1 flex justify-between">
                            <span>Packet loss</span>
                            <span className={`font-mono ${SIM_TONE.danger.text}`}>
                              {packetLossChance}%
                            </span>
                          </span>
                          <input
                            type="range"
                            aria-label="Packet loss"
                            min="0"
                            max="30"
                            value={packetLossChance}
                            onChange={(e) => setPacketLossChance(Number(e.target.value))}
                            className="h-10 w-full accent-wrong"
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="mb-1 flex justify-between">
                            <span>Jitter</span>
                            <span className={`font-mono ${SIM_TONE.warning.text}`}>{jitter}%</span>
                          </span>
                          <input
                            type="range"
                            aria-label="Jitter"
                            min="0"
                            max="100"
                            value={jitter}
                            onChange={(e) => setJitter(Number(e.target.value))}
                            className="h-10 w-full accent-partial"
                          />
                        </label>
                      </div>
                    </div>

                    <SimMissionList missions={missions.missions} />

                    <div className="rounded-lg border bg-card p-3">
                      <div className="mb-2 flex items-center justify-between border-b pb-1 font-mono text-xs text-muted-foreground">
                        <span>System log</span>
                        <span>Live</span>
                      </div>
                      <div className="space-y-1 font-mono text-xs">
                        {logs.length === 0 && (
                          <span className="italic text-muted-foreground">
                            Waiting for traffic...
                          </span>
                        )}
                        {logs.map((log) => (
                          <div
                            key={log.id}
                            className={
                              log.type === 'error'
                                ? SIM_TONE.danger.text
                                : log.type === 'syn'
                                  ? SIM_TONE.hint.text
                                  : log.type === 'warning'
                                    ? SIM_TONE.warning.text
                                    : 'text-muted-foreground'
                            }
                          >
                            {log.text}
                          </div>
                        ))}
                      </div>
                    </div>

                    <details className="rounded-lg border bg-card p-3">
                      <summary className="cursor-pointer text-sm font-semibold">
                        How TCP and UDP differ
                      </summary>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {educationalMessage} TCP establishes a connection, acknowledges delivery,
                        and retransmits losses. UDP starts sending immediately and accepts loss or
                        reordering in exchange for less overhead.
                      </p>
                    </details>
                  </div>
                ),
              },
            ]}
          />
        )}

        <SimPhoneBar>
          <Button type="button" onClick={handleStartStop} className="h-10 flex-1">
            {isPlaying ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            {startLabel}
          </Button>
          <Button type="button" variant="outline" onClick={startOver} className="h-10 flex-1">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Reset
          </Button>
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
