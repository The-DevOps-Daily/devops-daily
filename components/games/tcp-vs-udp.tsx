'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RefreshCw, Wifi, WifiOff, Shield, Zap, Activity, AlertTriangle, Info, Lock, ArrowRightLeft } from 'lucide-react';

// --- Constants & Config ---
const COLORS = {
  bg: '#0f172a',
  panel: '#1e293b',
  tcp: '#06b6d4',
  udp: '#22c55e',
  loss: '#ef4444',
  ack: '#f59e0b',
  syn: '#d946ef',
  text: '#f8fafc',
  textDim: '#94a3b8'
};

const MODES = {
  TCP: 'TCP',
  UDP: 'UDP'
} as const;

const CONNECTION_STATES = {
  DISCONNECTED: 'DISCONNECTED',
  HANDSHAKE_SYN: 'HANDSHAKE_SYN',
  HANDSHAKE_SYN_ACK: 'HANDSHAKE_SYN_ACK',
  HANDSHAKE_ACK: 'HANDSHAKE_ACK',
  CONNECTED: 'CONNECTED'
} as const;

type Mode = typeof MODES[keyof typeof MODES];
type ConnectionState = typeof CONNECTION_STATES[keyof typeof CONNECTION_STATES];

// --- Helper Components ---
const Tooltip = ({ children, text }: { children: React.ReactNode; text: string }) => (
  <div className="group relative flex items-center">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-black/90 text-xs text-white rounded shadow-lg z-50 pointer-events-none border border-slate-700">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/90"></div>
    </div>
  </div>
);

const StatCard = ({ label, value, color, icon: Icon, subtext }: {
  label: string;
  value: string | number;
  color: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  subtext?: string
}) => (
  <div className="bg-slate-800/80 backdrop-blur-sm p-3 rounded-lg border border-slate-700 flex flex-col items-center justify-center min-w-[100px] flex-1">
    <div className="flex items-center gap-2 mb-1">
      <Icon size={16} color={color} />
      <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">{label}</span>
    </div>
    <span className="text-2xl font-mono font-bold" style={{ color }}>{value}</span>
    {subtext && <span className="text-[10px] text-slate-500">{subtext}</span>}
  </div>
);

interface Packet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: string;
  status: string;
  direction: string;
}

interface LogMessage {
  id: number;
  text: string;
  type: string;
}

interface Stats {
  sent: number;
  received: number;
  lost: number;
  retransmits: number;
}

export default function TcpVsUdpSimulator() {
  const [mode, setMode] = useState<Mode>(MODES.TCP);
  const [isPlaying, setIsPlaying] = useState(false);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [stats, setStats] = useState<Stats>({ sent: 0, received: 0, lost: 0, retransmits: 0 });
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [connState, setConnState] = useState<ConnectionState>(CONNECTION_STATES.DISCONNECTED);
  const [educationalMessage, setEducationalMessage] = useState("");
  const [speed, setSpeed] = useState(50);
  const [packetLossChance, setPacketLossChance] = useState(0);
  const [jitter, setJitter] = useState(0);
  
  const requestRef = useRef<number>();
  const packetIdCounter = useRef(0);
  const tcpWindow = useRef(new Set<number>());
  const lastSpawnTime = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const logMessage = useCallback((msg: string, type = 'info') => {
    setLogs(prev => {
      const newLogs = [{ id: Date.now() + Math.random(), text: msg, type }, ...prev];
      return newLogs.slice(0, 5);
    });
  }, []);

  useEffect(() => {
    if (!isPlaying && connState === CONNECTION_STATES.DISCONNECTED) {
        setEducationalMessage("Click 'Start' to begin. " + (mode === MODES.TCP ? "TCP will perform a handshake first." : "UDP will start streaming immediately."));
        return;
    }
    if (mode === MODES.UDP) {
        setEducationalMessage("UDP Mode: Packets are sent 'Fire and Forget'. No handshake, no delivery confirmation. Fast but unreliable.");
        return;
    }
    switch (connState) {
        case CONNECTION_STATES.HANDSHAKE_SYN:
            setEducationalMessage("Step 1/3: Client sends SYN (Synchronize) to ask for a connection.");
            break;
        case CONNECTION_STATES.HANDSHAKE_SYN_ACK:
            setEducationalMessage("Step 2/3: Server replies with SYN-ACK (Synchronize + Acknowledge).");
            break;
        case CONNECTION_STATES.HANDSHAKE_ACK:
            setEducationalMessage("Step 3/3: Client sends final ACK. Connection is established!");
            break;
        case CONNECTION_STATES.CONNECTED:
            setEducationalMessage("Connection Established. Reliable Data Transfer in progress. Note the return receipts (ACKs).");
            break;
        default:
            break;
    }
  }, [connState, mode, isPlaying]);

  const spawnPacket = useCallback((typeOverride: string | null = null, statusOverride = 'inflight') => {
    if (packets.length > 100) return;
    const id = packetIdCounter.current++;
    const container = containerRef.current;
    if (!container) return;
    const canvasWidth = container.offsetWidth;
    const canvasHeight = container.offsetHeight;
    const direction = typeOverride === 'ack' ? 'return' : 'forward';
    const pktType = typeOverride || (mode === MODES.TCP && connState !== CONNECTION_STATES.CONNECTED ? 'syn' : 'data');
    setPackets(prev => [...prev, {
      id,
      x: direction === 'return' ? canvasWidth - 80 : 80,
      y: Math.random() * (canvasHeight - 60) + 30,
      vx: direction === 'return' ? -(3 + Math.random() * 2) : (3 + Math.random() * 2),
      vy: (Math.random() - 0.5) * 1.5,
      type: pktType,
      status: statusOverride,
      direction
    }]);
    if (direction === 'forward' && mode === MODES.TCP && connState === CONNECTION_STATES.CONNECTED) {
      tcpWindow.current.add(id);
    }
    setStats(prev => ({ ...prev, sent: prev.sent + 1 }));
  }, [packets.length, mode, connState]);

  const animate = useCallback((time: number) => {
    if (!isPlaying) return;
    const container = containerRef.current;
    if (!container) return;
    const canvasWidth = container.offsetWidth;
    const canvasHeight = container.offsetHeight;
    setPackets(prev => {
      const updated = prev.map(p => {
        if (p.status === 'delivered' || p.status === 'lost') return p;
        let newX = p.x + p.vx * (speed / 50);
        let newY = p.y + p.vy * (speed / 50);
        if (jitter > 0) {
          newX += (Math.random() - 0.5) * (jitter / 10);
          newY += (Math.random() - 0.5) * (jitter / 10);
        }
        if (p.status === 'inflight' && Math.random() * 100 < packetLossChance / 10) {
          setStats(s => ({ ...s, lost: s.lost + 1 }));
          logMessage(`Packet #${p.id} LOST in transit!`, 'error');
          return { ...p, status: 'lost' };
        }
        if (p.direction === 'forward' && newX > canvasWidth - 60) {
          setStats(s => ({ ...s, received: s.received + 1 }));
          logMessage(`Packet #${p.id} delivered`, p.type === 'syn' ? 'syn' : 'info');
          if (mode === MODES.TCP && p.direction === 'forward' && tcpWindow.current.has(p.id)) {
            setTimeout(() => spawnPacket('ack'), 100);
            tcpWindow.current.delete(p.id);
          }
          return { ...p, status: 'delivered', x: canvasWidth - 60 };
        }
        if (p.direction === 'return' && newX < 60) {
          setStats(s => ({ ...s, received: s.received + 1 }));
          logMessage(`ACK #${p.id} received`);
          return { ...p, status: 'delivered', x: 60 };
        }
        if (newY < 10) newY = 10;
        if (newY > canvasHeight - 10) newY = canvasHeight - 10;
        return { ...p, x: newX, y: newY };
      });
      return updated.filter(p => p.status === 'inflight' || (Date.now() - p.id) < 2000);
    });
    const spawnInterval = Math.max(500, 2000 - speed * 10);
    if (time - lastSpawnTime.current > spawnInterval) {
      lastSpawnTime.current = time;
      spawnPacket();
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [isPlaying, speed, packetLossChance, jitter, mode, spawnPacket, logMessage]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying, animate]);

  useEffect(() => {
    if (!isPlaying) return;
    if (mode === MODES.UDP) {
      setConnState(CONNECTION_STATES.CONNECTED);
      return;
    }
    if (connState === CONNECTION_STATES.DISCONNECTED) {
      setConnState(CONNECTION_STATES.HANDSHAKE_SYN);
      setTimeout(() => {
        spawnPacket('syn');
        logMessage('SYN: Requesting connection...', 'syn');
      }, 500);
    } else if (connState === CONNECTION_STATES.HANDSHAKE_SYN) {
      setTimeout(() => {
        setConnState(CONNECTION_STATES.HANDSHAKE_SYN_ACK);
        spawnPacket('syn', 'inflight');
        logMessage('SYN-ACK: Server accepts connection', 'syn');
      }, 2000);
    } else if (connState === CONNECTION_STATES.HANDSHAKE_SYN_ACK) {
      setTimeout(() => {
        setConnState(CONNECTION_STATES.HANDSHAKE_ACK);
        spawnPacket('ack');
        logMessage('ACK: Connection established!', 'syn');
      }, 2000);
    } else if (connState === CONNECTION_STATES.HANDSHAKE_ACK) {
      setTimeout(() => {
        setConnState(CONNECTION_STATES.CONNECTED);
        logMessage('Data transfer can now begin.');
      }, 1500);
    }
  }, [isPlaying, connState, mode, spawnPacket, logMessage]);

  const handleStartStop = () => {
    if (!isPlaying && connState === CONNECTION_STATES.DISCONNECTED) {
      setStats({ sent: 0, received: 0, lost: 0, retransmits: 0 });
      setLogs([]);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setPackets([]);
    setStats({ sent: 0, received: 0, lost: 0, retransmits: 0 });
    setLogs([]);
    setConnState(CONNECTION_STATES.DISCONNECTED);
    packetIdCounter.current = 0;
    tcpWindow.current.clear();
    lastSpawnTime.current = 0;
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    handleReset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-3 mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white flex items-center justify-center gap-3">
            <ArrowRightLeft className="text-cyan-500" size={40} />
            TCP vs UDP Simulator
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Visualize the differences between TCP's reliable, connection-oriented protocol and UDP's fast, connectionless approach.
          </p>
        </div>
        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={() => handleModeChange(MODES.TCP)}
            className={`px-8 py-3 rounded-lg font-bold text-lg transition-all ${mode === MODES.TCP ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            <Shield className="inline mr-2" size={20} />
            TCP Mode
          </button>
          <button
            onClick={() => handleModeChange(MODES.UDP)}
            className={`px-8 py-3 rounded-lg font-bold text-lg transition-all ${mode === MODES.UDP ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            <Zap className="inline mr-2" size={20} />
            UDP Mode
          </button>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex items-start gap-3">
          <Info className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-blue-100 text-sm">{educationalMessage}</p>
        </div>
        <div 
          ref={containerRef}
          className="bg-slate-900 border-2 border-slate-700 rounded-xl overflow-hidden relative"
          style={{ height: '400px' }}
        >
          <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
            <div className="w-12 h-12 bg-slate-800 rounded-lg border-2 border-cyan-500 flex items-center justify-center">
              <Wifi className="text-cyan-500" size={24} />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase">Client</div>
              <div className="text-sm font-bold text-white">192.168.1.10</div>
            </div>
          </div>
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <div>
              <div className="text-xs text-slate-500 uppercase text-right">Server</div>
              <div className="text-sm font-bold text-white text-right">203.0.113.5</div>
            </div>
            <div className="w-12 h-12 bg-slate-800 rounded-lg border-2 border-green-500 flex items-center justify-center">
              <Activity className="text-green-500" size={24} />
            </div>
          </div>
          {packets.map(p => (
            <div
              key={p.id}
              className={`absolute transition-opacity duration-300 ${
                p.status === 'delivered' ? 'opacity-0' : p.status === 'lost' ? 'opacity-20' : 'opacity-100'
              }`}
              style={{ left: `${p.x}px`, top: `${p.y}px`, transform: 'translate(-50%, -50%)' }}
            >
              <div 
                className={`w-4 h-4 rounded-full ${
                  p.type === 'syn' ? 'bg-fuchsia-500 shadow-lg shadow-fuchsia-500/50' :
                  p.type === 'ack' ? 'bg-amber-500 shadow-lg shadow-amber-500/50' :
                  mode === MODES.TCP ? 'bg-cyan-500 shadow-lg shadow-cyan-500/50' : 'bg-green-500 shadow-lg shadow-green-500/50'
                } ${
                  p.status === 'lost' ? 'bg-red-500 shadow-red-500/50' : ''
                }`}
              />
            </div>
          ))}
          {mode === MODES.TCP && connState !== CONNECTION_STATES.CONNECTED && isPlaying && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="text-center">
                <Lock className="text-fuchsia-500 mx-auto mb-2" size={48} />
                <div className="text-xl font-bold text-white">3-Way Handshake in Progress</div>
                <div className="text-sm text-slate-400 mt-1">
                  {connState === CONNECTION_STATES.HANDSHAKE_SYN && 'Sending SYN...'}
                  {connState === CONNECTION_STATES.HANDSHAKE_SYN_ACK && 'Receiving SYN-ACK...'}
                  {connState === CONNECTION_STATES.HANDSHAKE_ACK && 'Sending ACK...'}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Sent" value={stats.sent} color={COLORS.tcp} icon={Zap} />
          <StatCard label="Received" value={stats.received} color={COLORS.udp} icon={Activity} />
          <StatCard label="Lost" value={stats.lost} color={COLORS.loss} icon={WifiOff} />
          <StatCard label="Retransmits" value={stats.retransmits} color={COLORS.ack} icon={RefreshCw} subtext="TCP Only" />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <Activity size={16} /> Simulation Control</h3>
              <div className="flex gap-2">
                <button 
                  onClick={handleStartStop}
                  className={`p-2 rounded-full ${isPlaying ? 'bg-amber-500/20 text-amber-500' : 'bg-green-500/20 text-green-500'} hover:bg-white/10 transition-colors`}
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <button 
                  onClick={handleReset}
                  className="p-2 rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                >
                  <RefreshCw size={20} />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Traffic Speed</span>
                  <span className="text-cyan-400">{speed}%</span>
                </div>
                <input 
                  type="range" min="10" max="100" value={speed} 
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
              <AlertTriangle size={100} />
            </div>
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <AlertTriangle size={16} /> Network Conditions
            </h3>
            <div className="space-y-4 relative z-10">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="flex items-center gap-1">Packet Loss <Tooltip text="Randomly destroys packets in transit."><Info size={12} className="text-slate-500"/></Tooltip></span>
                  <span className="text-red-400">{packetLossChance / 10}%</span>
                </div>
                <input 
                  type="range" min="0" max="50" value={packetLossChance} 
                  onChange={(e) => setPacketLossChance(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="flex items-center gap-1">Jitter (Instability) <Tooltip text="Adds random variance to packet timing and path."><Info size={12} className="text-slate-500"/></Tooltip></span>
                  <span className="text-amber-400">{jitter}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" value={jitter} 
                  onChange={(e) => setJitter(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="bg-black/50 rounded-lg p-4 font-mono text-xs h-32 overflow-hidden border border-slate-800">
          <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-1">
            <span className="text-slate-500">SYSTEM LOG</span>
            <span className="text-slate-600">LIVE</span>
          </div>
          <div className="flex flex-col-reverse gap-1">
            {logs.length === 0 && <span className="text-slate-700 italic">Waiting for traffic...</span>}
            {logs.map(log => (
              <div key={log.id} className={`${log.type === 'error' ? 'text-red-400' : log.type === 'syn' ? 'text-fuchsia-400' : 'text-slate-300'} animate-in fade-in slide-in-from-left-4`}>
                <span className="text-slate-600 mr-2">[{new Date(log.id).toLocaleTimeString().split(' ')[0]}]</span>
                {log.text}
              </div>
            ))}
          </div>
        </div>
        <div className="text-center mt-4">
          <p className="text-slate-500 text-sm">
            Experiment by increasing \"Packet Loss\" to see how TCP retries vs UDP just loses data.
          </p>
        </div>
      </div>
    </div>
  );
}
